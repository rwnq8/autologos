
import { useRef, useState, useCallback }
from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, IsLikelyAiErrorResponseResult, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, ModelStrategy, IterationEntryType } from '../types.ts';
import * as GeminaiService from '../services/geminiService';
import { determineInitialStrategy, reevaluateStrategy } from '../services/ModelStrategyService';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX } from '../services/iterationUtils';
import { calculateFleschReadingEase, calculateJaccardSimilarity, calculateLexicalDensity, calculateAvgSentenceLength, calculateSimpleTTR } from '../services/textAnalysisService';
import { DETERMINISTIC_TARGET_ITERATION } from '../hooks/useModelParameters';
import * as Diff from 'diff';
import type { AddLogEntryParams } from './useProcessState';
import { getRelevantDevLogContext } from '../services/devLogContextualizerService'; // Import the new service


const SELF_CORRECTION_MAX_ATTEMPTS = 2;

const BASE_THRESHOLD_PARAMS_LIGHT = 1;
const BASE_THRESHOLD_PARAMS_HEAVY = 2;
const BASE_THRESHOLD_META_INSTRUCT = 3;

const STAGNATION_SIMILARITY_THRESHOLD = 0.95;
const STAGNATION_MIN_CHANGE_THRESHOLD = 5;

const FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT = 0.985;
const FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT = 1;
const FORCED_CONVERGENCE_CHAR_DELTA_STRICT = 50;


const STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT = 0.85;
const MIN_TOTAL_INPUT_SIZE_BYTES_FOR_SEGMENTATION = 200 * 1024; // 200KB threshold for attempting segmented synthesis

interface OutlineSegment {
    title: string;
    content: string;
    level: number;
    isPreface?: boolean; // Mark if it's an auto-generated preface
}

const parseOutlineToSegments = (outlineMarkdown: string): { segments: OutlineSegment[], documentTitle?: string } => {
    const segments: OutlineSegment[] = [];
    if (!outlineMarkdown || !outlineMarkdown.trim()) return { segments };

    const lines = outlineMarkdown.split('\n');
    let documentTitle: string | undefined = undefined;

    // Check for a unique H1 at the very beginning
    const firstNonEmptyLineIndex = lines.findIndex(line => line.trim() !== "");
    if (firstNonEmptyLineIndex !== -1) {
        const firstLine = lines[firstNonEmptyLineIndex].trim();
        if (firstLine.startsWith('# ') && !firstLine.startsWith('##')) {
            // Check if subsequent lines indicate this H1 is a document title (e.g., followed by H2s)
            const hasH2sFollowing = lines.slice(firstNonEmptyLineIndex + 1).some(line => line.trim().startsWith('## '));
            if (hasH2sFollowing) {
                documentTitle = firstLine.substring(2).trim();
                // Remove the H1 title line from lines to be processed for segments
                lines.splice(firstNonEmptyLineIndex, 1);
            }
        }
    }

    // Determine primary heading level for segmentation (H2 if present, else H1)
    let primaryHeadingRegex = /^(##\s+.*)/; // Default to H2
    let primaryLevel = 2;
    if (!lines.some(line => primaryHeadingRegex.test(line.trim()))) {
        primaryHeadingRegex = /^(#\s+.*)/; // Fallback to H1 if no H2s
        primaryLevel = 1;
    }

    let currentSegment: OutlineSegment | null = null;
    let prefaceContent = "";

    for (const line of lines) {
        const trimmedLine = line.trim();
        const headingMatch = trimmedLine.match(primaryHeadingRegex);

        if (headingMatch) {
            if (prefaceContent.trim() && segments.length === 0 && !currentSegment) {
                // If there was content before the first primary heading, save it as a preface
                segments.push({ title: "Introduction / Preface (Auto-Segmented)", content: prefaceContent.trim(), level: 0, isPreface: true });
                prefaceContent = ""; // Reset preface content
            }
            if (currentSegment) {
                segments.push({ ...currentSegment, content: currentSegment.content.trim() });
            }
            currentSegment = { title: headingMatch[0].replace(primaryHeadingRegex, '$1').replace(/^#+\s*/, '').trim(), content: "", level: primaryLevel };
        } else if (currentSegment) {
            currentSegment.content += line + '\n';
        } else if (trimmedLine !== "") { // Content before the first primary heading
            prefaceContent += line + '\n';
        }
    }

    if (currentSegment) {
        segments.push({ ...currentSegment, content: currentSegment.content.trim() });
    } else if (prefaceContent.trim() && segments.length === 0) {
        // If there's only preface content and no primary headings were found after potential H1 title removal
        segments.push({ title: "Full Document (Auto-Segmented)", content: prefaceContent.trim(), level: 0, isPreface: true });
    }

    // If no segments were created at all (e.g. empty outline after title removal),
    // and the original outline wasn't just the title.
    if (segments.length === 0 && outlineMarkdown.trim() && outlineMarkdown.trim() !== documentTitle) {
        segments.push({ title: "Full Document (Auto-Segmented)", content: outlineMarkdown.trim(), level: 0 });
    }

    return { segments, documentTitle };
};

interface UseIterativeLogicReturn {
  handleStart: (options?: {
    isTargetedRefinement?: boolean;
    targetedSelection?: string;
    targetedInstructions?: string;
    userRawPromptForContextualizer?: string;
  }) => Promise<void>;
  handleHalt: () => void;
}

export const useIterativeLogic = (
  processState: ProcessState,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  addLogEntryFromHook: (logData: AddLogEntryParams) => void,
  getUserSetBaseConfig: () => ModelConfig,
  performAutoSave: () => Promise<void>,
  handleRateLimitErrorEncountered: () => void,
): UseIterativeLogicReturn => {
  const isProcessingRef = useRef(false);
  const haltSignalRef = useRef(false);
  const currentStreamBufferRef = useRef("");

  const logIterationData = useCallback((
    iterationNumber: number,
    entryType: IterationEntryType, // Added
    iterationProductForLog: string | null,
    statusMessage: string,
    previousProductForLog: string | null,
    apiResult?: IterateProductResult,
    modelConfigUsed?: ModelConfig,
    fileProcessingInfoForLog?: FileProcessingInfo,
    aiValidationInfo?: AiResponseValidationInfo,
    directAiResponseLengthChars_param?: number,
    processedProductLengthChars_param?: number,
    attemptCount?: number,
    strategyRationale?: string,
    currentModelForIteration?: SelectableModelName,
    activeMetaInstruction?: string,
    // isSegmentedSynthesis and isTargetedRefinement are now inferred from entryType
    targetedSelection?: string,
    targetedRefinementInstructions?: string
  ) => {
    const directResponseHead = iterationProductForLog ? iterationProductForLog.substring(0, 500) : "";
    const directResponseTail = iterationProductForLog && iterationProductForLog.length > 500 ? iterationProductForLog.substring(iterationProductForLog.length - 500) : "";

    let finalProductForSummary = iterationProductForLog;
    if (iterationProductForLog && iterationProductForLog.startsWith(CONVERGED_PREFIX)) {
        finalProductForSummary = iterationProductForLog.substring(CONVERGED_PREFIX.length);
    }
    const activePlanStage = processState.isPlanActive && processState.currentPlanStageIndex !== null ? processState.planStages[processState.currentPlanStageIndex] : null;
    if (activePlanStage && activePlanStage.format === 'json' && finalProductForSummary) {
        finalProductForSummary = parseAndCleanJsonOutput(finalProductForSummary);
    }

    addLogEntryFromHook({
      iteration: iterationNumber,
      entryType: entryType,
      currentFullProduct: finalProductForSummary,
      status: statusMessage,
      previousFullProduct: previousProductForLog,
      promptSystemInstructionSent: apiResult?.promptSystemInstructionSent,
      promptCoreUserInstructionsSent: apiResult?.promptCoreUserInstructionsSent,
      promptFullUserPromptSent: apiResult?.promptFullUserPromptSent,
      apiStreamDetails: apiResult?.apiStreamDetails,
      modelConfigUsed: modelConfigUsed,
      readabilityScoreFlesch: calculateFleschReadingEase(finalProductForSummary),
      lexicalDensity: calculateLexicalDensity(finalProductForSummary),
      avgSentenceLength: calculateAvgSentenceLength(finalProductForSummary),
      typeTokenRatio: calculateSimpleTTR(finalProductForSummary),
      fileProcessingInfo: fileProcessingInfoForLog || { filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0, loadedFilesForIterationContext: [] },
      aiValidationInfo,
      directAiResponseHead: directResponseHead,
      directAiResponseTail: directResponseTail,
      directAiResponseLengthChars: directAiResponseLengthChars_param ?? iterationProductForLog?.length,
      processedProductHead: finalProductForSummary ? finalProductForSummary.substring(0, 500) : "",
      processedProductTail: finalProductForSummary && finalProductForSummary.length > 500 ? finalProductForSummary.substring(finalProductForSummary.length - 500) : "",
      processedProductLengthChars: processedProductLengthChars_param ?? finalProductForSummary?.length,
      attemptCount,
      strategyRationale,
      currentModelForIteration,
      activeMetaInstruction,
      isSegmentedSynthesis: entryType === 'segmented_synthesis_milestone',
      isTargetedRefinement: entryType === 'targeted_refinement',
      targetedSelection,
      targetedRefinementInstructions
    });
  }, [addLogEntryFromHook, processState.isPlanActive, processState.currentPlanStageIndex, processState.planStages]);


  const handleHalt = () => {
    haltSignalRef.current = true;
    isProcessingRef.current = false; // Should be set to false in the main loop when halt is detected
  };

  const onStreamChunk = (chunkText: string) => {
    currentStreamBufferRef.current += chunkText;
    updateProcessState({ currentProduct: currentStreamBufferRef.current });
  };

  const determineNudgeStrategyForNext = (
    consecutiveStagnantIterations: number,
    isStagnationNudgeEnabled: boolean,
    iterationProgressPercent: number,
    aggressiveness: 'LOW' | 'MEDIUM' | 'HIGH'
  ): NudgeStrategy => {
    if (!isStagnationNudgeEnabled || iterationProgressPercent >= STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT) {
        return 'none';
    }

    let thresholdLight = BASE_THRESHOLD_PARAMS_LIGHT;
    let thresholdHeavy = BASE_THRESHOLD_PARAMS_HEAVY;
    let thresholdMeta = BASE_THRESHOLD_META_INSTRUCT;

    if (aggressiveness === 'LOW') {
        thresholdLight = 2;
        thresholdHeavy = 3;
        thresholdMeta  = 4;
    } else if (aggressiveness === 'HIGH') {
        thresholdLight = 1;
        thresholdHeavy = 2;
        thresholdMeta  = 2; // Stricter: meta-instruct sooner if HIGH
    }
    // Ensure thresholds are non-decreasing
    thresholdHeavy = Math.max(thresholdLight, thresholdHeavy);
    thresholdMeta = Math.max(thresholdHeavy, thresholdMeta);

    if (consecutiveStagnantIterations >= thresholdMeta) return 'meta_instruct';
    if (consecutiveStagnantIterations >= thresholdHeavy) return 'params_heavy';
    if (consecutiveStagnantIterations >= thresholdLight) return 'params_light';
    return 'none';
  };


  const handleStart = async (
    options?: {
      isTargetedRefinement?: boolean;
      targetedSelection?: string;
      targetedInstructions?: string;
      // This 'userRawPromptForContextualizer' is the text the user typed to initiate this 'handleStart'
      // It's NOT the full prompt sent to the AI, but the user's request.
      userRawPromptForContextualizer?: string;
    }
  ) => {
    if (isProcessingRef.current) {
      updateProcessState({ statusMessage: "Process already running." }); return;
    }
    if (!GeminaiService.isApiKeyAvailable()) {
      updateProcessState({ statusMessage: "API Key not available. Cannot start process." }); return;
    }
    if (!options?.isTargetedRefinement && processState.loadedFiles.length === 0 && !processState.initialPrompt.trim()) {
      updateProcessState({ statusMessage: "No input data provided. Load files or ensure initial prompt is set." }); return;
    }
    if (options?.isTargetedRefinement && (!options.targetedSelection || !processState.currentProduct)) {
      updateProcessState({ statusMessage: "Targeted refinement requires a selection from the current product."}); return;
    }


    isProcessingRef.current = true;
    haltSignalRef.current = false;
    currentStreamBufferRef.current = "";

    let currentIter = processState.currentProductBeforeHalt !== null ? (processState.currentIterationBeforeHalt ?? processState.currentIteration) : processState.currentIteration;
    let currentProd = options?.isTargetedRefinement ? processState.currentProduct : (processState.currentProductBeforeHalt ?? processState.currentProduct);


    let currentPlanStageIdx = processState.currentProductBeforeHalt !== null ? (processState.currentPlanStageIndex ?? (processState.isPlanActive && processState.planStages.length > 0 ? 0 : null)) : (processState.isPlanActive && processState.planStages.length > 0 ? (processState.currentPlanStageIndex ?? 0) : null);
    let currentStageIterCount = processState.currentProductBeforeHalt !== null ? (processState.currentStageIteration ?? 0) : (processState.currentStageIteration ?? 0);

    if (options?.isTargetedRefinement) {
        currentPlanStageIdx = null; // Targeted refinement runs outside of plan stages
        currentStageIterCount = 0;
    }

    const userBaseConfig = getUserSetBaseConfig();

    const initialStrategyState: Pick<ProcessState, 'inputComplexity' | 'initialPrompt' | 'loadedFiles' | 'selectedModelName' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness'> = {
        inputComplexity: processState.inputComplexity,
        initialPrompt: processState.initialPrompt,
        loadedFiles: processState.loadedFiles,
        selectedModelName: processState.selectedModelName,
        strategistInfluenceLevel: processState.strategistInfluenceLevel,
        stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
    };
    let iterationStrategy: ModelStrategy = determineInitialStrategy(initialStrategyState, userBaseConfig);

    updateProcessState({
      isProcessing: true, finalProduct: null,
      statusMessage: options?.isTargetedRefinement ? "Starting targeted section refinement..." : "Starting process...",
      aiProcessInsight: options?.isTargetedRefinement ? "Initializing strategy for targeted refinement..." : "Initializing strategy for Iteration 1...",
      currentProductBeforeHalt: null, currentIterationBeforeHalt: undefined,
      currentModelForIteration: iterationStrategy.modelName,
      currentAppliedModelConfig: iterationStrategy.config,
      activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
    });

    let outlineResultForIter1: OutlineGenerationResult | undefined = undefined;
    // Iteration 0: Initial state setup or outline generation
    if (currentIter === 0 && !options?.isTargetedRefinement && (currentProd === null || currentProd.trim() === "")) {
      const initialFileProcessingInfo: FileProcessingInfo = {
        filesSentToApiIteration: null,
        numberOfFilesActuallySent: processState.loadedFiles.length,
        totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
        fileManifestProvidedCharacterCount: processState.initialPrompt.length,
        loadedFilesForIterationContext: processState.loadedFiles,
      };

      if (processState.loadedFiles.length > 0) {
        updateProcessState({ statusMessage: "Iteration 0: Generating initial outline from files...", aiProcessInsight: "Requesting outline and redundancy analysis from AI."});
        outlineResultForIter1 = await GeminaiService.generateInitialOutline(
            processState.initialPrompt,
            processState.loadedFiles,
            iterationStrategy.config,
            iterationStrategy.modelName
        );
        if (outlineResultForIter1.errorMessage) {
            updateProcessState({ isProcessing: false, statusMessage: `Iteration 0 (Outline Failed): ${outlineResultForIter1.errorMessage}`, aiProcessInsight: `Outline gen error: ${outlineResultForIter1.errorMessage}` });
            const apiResultForFailedOutline: IterateProductResult = {
              product: "",
              status: 'ERROR',
              errorMessage: outlineResultForIter1.errorMessage,
              apiStreamDetails: outlineResultForIter1.apiDetails,
              promptFullUserPromptSent: `Outline generation failed. Error: ${outlineResultForIter1.errorMessage}`
            };
            logIterationData(0, 'initial_state', "", `Outline Generation Failed: ${outlineResultForIter1.errorMessage}`, "", apiResultForFailedOutline, iterationStrategy.config, initialFileProcessingInfo, {checkName: "OutlineGen", passed:false, reason: outlineResultForIter1.errorMessage}, 0,0,0, iterationStrategy.rationale, iterationStrategy.modelName);
            isProcessingRef.current = false;
            await performAutoSave();
            return;
        }
        currentProd = "";
        const { documentTitle } = parseOutlineToSegments(outlineResultForIter1.outline);
        const statusMsgForLog = documentTitle
            ? `Initial outline (Doc Title: "${documentTitle}") and redundancies generated.`
            : "Initial outline and redundancies generated.";
        logIterationData(
          0, 'initial_state', currentProd, statusMsgForLog, "",
          { product: "", status: 'COMPLETED', apiStreamDetails: outlineResultForIter1.apiDetails, promptFullUserPromptSent: `Outline requested for ${processState.loadedFiles.length} files.` },
          iterationStrategy.config,
          initialFileProcessingInfo, undefined,
          currentProd.length, currentProd.length, 0,
          iterationStrategy.rationale,
          iterationStrategy.modelName,
          iterationStrategy.activeMetaInstruction
        );
      } else {
        currentProd = processState.initialPrompt;
        logIterationData(
          0, 'initial_state', currentProd, "Initial state loaded from prompt.", "",
          undefined, iterationStrategy.config,
          initialFileProcessingInfo, undefined,
          currentProd.length, currentProd.length, 0,
          iterationStrategy.rationale,
          iterationStrategy.modelName,
          iterationStrategy.activeMetaInstruction
        );
      }

      updateProcessState({
        currentProduct: currentProd,
        currentIteration: 0,
        stagnationInfo: {
            ...processState.stagnationInfo,
            consecutiveStagnantIterations: 0,
            similarityWithPrevious: undefined,
            consecutiveLowValueIterations: 0,
            lastProductLengthForStagnation: currentProd?.length ?? 0
        }
      });
      await performAutoSave();
       // currentIter remains 0, outlineResultForIter1 is now populated (or not, if no files)
    }

    // Iteration 1: Segmented Synthesis (if conditions met) or prepare for Single-Pass
    if (currentIter === 0 && !options?.isTargetedRefinement) {
        const initialFileProcessingInfoForIter1Decision: FileProcessingInfo = { // Re-evaluate for this decision point
            filesSentToApiIteration: null,
            numberOfFilesActuallySent: processState.loadedFiles.length,
            totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
            fileManifestProvidedCharacterCount: processState.initialPrompt.length,
            loadedFilesForIterationContext: processState.loadedFiles,
        };

        const shouldAttemptSegmentedSynthesis =
            outlineResultForIter1 &&
            outlineResultForIter1.outline.trim() &&
            initialFileProcessingInfoForIter1Decision.totalFilesSizeBytesSent > MIN_TOTAL_INPUT_SIZE_BYTES_FOR_SEGMENTATION;

        if (shouldAttemptSegmentedSynthesis) {
            // Segmented Synthesis for Iteration 1
            updateProcessState({ statusMessage: "Starting segmented synthesis for Iteration 1...", aiProcessInsight: "Segmented Iteration 1: Preparing outline segments."});
            const { segments, documentTitle } = parseOutlineToSegments(outlineResultForIter1!.outline); // Safe to use ! as checked by shouldAttemptSegmentedSynthesis
            if (segments.length === 0) {
                updateProcessState({ isProcessing: false, statusMessage: "Iteration 1 Error: Outline parsed into zero segments. Cannot proceed with segmented synthesis.", aiProcessInsight: "Segmented synthesis halted: No segments found in outline."});
                logIterationData(1, 'segmented_synthesis_milestone', "", "Outline parsing yielded no segments.", processState.currentProduct || "", undefined, iterationStrategy.config, undefined, {checkName:"SegmentParse", passed:false, reason:"No segments in outline"}, 0,0,0,iterationStrategy.rationale);
                isProcessingRef.current = false; await performAutoSave(); return;
            }

            let assembledProductFromSegments = documentTitle ? `# ${documentTitle}\n\n` : "";
            const allSegmentApiDetails: ApiStreamCallDetail[] = [];
            let segmentedSynthesisError = null;

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const segmentTitleForStatus = segment.isPreface && documentTitle ? `${documentTitle} - ${segment.title}` : segment.title;
                updateProcessState({ statusMessage: `Segmented Iteration 1 (${i+1}/${segments.length}): Synthesizing "${segmentTitleForStatus}"...`});

                if (haltSignalRef.current) {
                    segmentedSynthesisError = "Halted by user during segmented synthesis.";
                    break;
                }
                currentStreamBufferRef.current = "";

                const segmentStrategy = iterationStrategy;

                const segmentApiResult = await GeminaiService.iterateProduct({
                    currentProduct: "",
                    currentIterationOverall: 0,
                    maxIterationsOverall: 1,
                    fileManifest: processState.initialPrompt,
                    loadedFiles: processState.loadedFiles,
                    activePlanStage: null,
                    outputParagraphShowHeadings: processState.outputParagraphShowHeadings,
                    outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth,
                    outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
                    modelConfigToUse: segmentStrategy.config,
                    isGlobalMode: false,
                    modelToUse: segmentStrategy.modelName,
                    onStreamChunk,
                    isHaltSignalled: () => haltSignalRef.current,
                    initialOutlineForIter1: outlineResultForIter1,
                    activeMetaInstruction: undefined,
                    operationType: "segment_synthesis",
                    currentSegmentOutlineText: `${segment.title}\n${segment.content}`,
                    fullOutlineForContext: outlineResultForIter1!.outline,
                });

                if (segmentApiResult.apiStreamDetails) {
                    segmentApiResult.apiStreamDetails.forEach(detail => {
                        allSegmentApiDetails.push({ ...detail, segmentIndex: i, segmentTitle: segment.title });
                    });
                }

                if (segmentApiResult.status === 'ERROR' || segmentApiResult.isRateLimitError) {
                    segmentedSynthesisError = `Error in segment "${segment.title}": ${segmentApiResult.errorMessage}`;
                    if (segmentApiResult.isRateLimitError) handleRateLimitErrorEncountered();
                    assembledProductFromSegments += (currentStreamBufferRef.current || "");
                    break;
                }
                if (haltSignalRef.current) {
                    segmentedSynthesisError = `Halted by user during segment "${segment.title}".`;
                    assembledProductFromSegments += (currentStreamBufferRef.current || "");
                    break;
                }
                assembledProductFromSegments += (currentStreamBufferRef.current || "") + "\n\n";
            }

            currentProd = assembledProductFromSegments.trim();
            currentIter = 1; // Mark Iteration 1 (segmented) as complete

            const fileProcessingInfoForIter1Segmented: FileProcessingInfo = {
                filesSentToApiIteration: 1,
                numberOfFilesActuallySent: processState.loadedFiles.length,
                totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
                fileManifestProvidedCharacterCount: processState.initialPrompt.length,
                loadedFilesForIterationContext: processState.loadedFiles,
            };

            logIterationData(
                currentIter, 'segmented_synthesis_milestone', currentProd,
                segmentedSynthesisError || "Segmented Iteration 1 completed.",
                processState.iterationHistory.find(e => e.iteration === 0)?.productSummary || processState.initialPrompt,
                {
                    product: currentProd,
                    status: segmentedSynthesisError ? 'ERROR' : 'COMPLETED',
                    errorMessage: segmentedSynthesisError || undefined,
                    apiStreamDetails: allSegmentApiDetails,
                    promptFullUserPromptSent: `Segmented synthesis performed for Iteration 1 using ${segments.length} segments from outline. Full file data used for each segment.`
                },
                iterationStrategy.config,
                fileProcessingInfoForIter1Segmented,
                undefined,
                currentProd.length, currentProd.length, segments.length,
                iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction
            );

            updateProcessState({
                currentProduct: currentProd,
                currentIteration: currentIter,
                statusMessage: segmentedSynthesisError || "Segmented Iteration 1 synthesis complete.",
                aiProcessInsight: segmentedSynthesisError || `Iteration 1 (Segmented): Assembled product from ${segments.length} segments.`,
                isProcessing: !!segmentedSynthesisError || haltSignalRef.current ? false : true,
            });

            if (segmentedSynthesisError || haltSignalRef.current) {
                isProcessingRef.current = false;
                await performAutoSave();
                return;
            }
            await performAutoSave();
        } else {
            // Single-Pass path chosen for Iteration 1 (main loop will handle it)
            // currentIter remains 0. currentProd is from Iter 0. outlineResultForIter1 is available if generated.
            const singlePassReason = !(outlineResultForIter1 && outlineResultForIter1.outline.trim())
                ? "No usable outline generated. Iteration 1 will be single-pass synthesis from files/prompt."
                : `Input size (${(initialFileProcessingInfoForIter1Decision.totalFilesSizeBytesSent / 1024).toFixed(1)}KB) below threshold (${(MIN_TOTAL_INPUT_SIZE_BYTES_FOR_SEGMENTATION / 1024).toFixed(1)}KB) for segmented synthesis. Iteration 1 will be single-pass.`;

            updateProcessState({
                statusMessage: singlePassReason,
                aiProcessInsight: singlePassReason
            });
            // The main loop will now execute, with currentIter=0.
            // It will calculate currentIterationForPrompt as currentIter+1=1.
            // iterateProduct will receive currentIterationOverall=1.
            // promptBuilderService will use the "Initial Synthesis (Single Pass)" instructions for Iteration 1.
        }
    }

    const maxOverallIterations = processState.maxIterations;
    let productBeforeThisFailedIteration: string | null = currentProd;


    while (true) {
      // Moved declarations to the top of the while loop
      let apiResultForLog: IterateProductResult | undefined = undefined;
      let currentEntryType: IterationEntryType = 'ai_iteration'; // Default, will be updated
      let previousProductSnapshot: string | null = currentProd; // Initialize with currentProd at loop start
      let fileProcessingInfoForApi: FileProcessingInfo | undefined = undefined;
      let iterationAttemptCount: number = 0;

      if (haltSignalRef.current) {
        const finalProductOnHalt = (currentStreamBufferRef.current || currentProd || "").startsWith(CONVERGED_PREFIX)
            ? null
            : (currentStreamBufferRef.current || currentProd);
        updateProcessState({
            isProcessing: false,
            statusMessage: "Process halted by user.",
            currentProductBeforeHalt: currentStreamBufferRef.current || currentProd,
            currentIterationBeforeHalt: currentIter,
            finalProduct: processState.finalProduct || finalProductOnHalt,
            currentStageIteration: currentStageIterCount,
            currentPlanStageIndex: currentPlanStageIdx
        });
        // Log data for the halted iteration if API call was made
        if (apiResultForLog) {
            logIterationData(currentIter + 1, currentEntryType, currentStreamBufferRef.current || currentProd, "Halted by user", previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, undefined, (currentStreamBufferRef.current || currentProd)?.length, (currentStreamBufferRef.current || currentProd)?.length, iterationAttemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
        }
        break;
      }

      const isThisIterationTargeted = !!(options?.isTargetedRefinement && currentIter === processState.currentIteration);
      currentEntryType = isThisIterationTargeted ? 'targeted_refinement' : 'ai_iteration';
      const isGlobalMode = !processState.isPlanActive || isThisIterationTargeted;
      let activePlanStage: PlanStage | null = null;
      let iterationScopeMax = maxOverallIterations;
      let currentIterationForPrompt = currentIter;

      // Update previousProductSnapshot for this iteration
      previousProductSnapshot = currentProd;


      if (processState.isPlanActive && !isThisIterationTargeted) {
        if (currentPlanStageIdx === null || currentPlanStageIdx >= processState.planStages.length) {
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "Iterative plan completed.", aiProcessInsight: "All plan stages executed.", configAtFinalization: iterationStrategy.config });
          break;
        }
        activePlanStage = processState.planStages[currentPlanStageIdx];
        iterationScopeMax = activePlanStage.stageIterations;
        currentIterationForPrompt = currentStageIterCount + 1;

        if (currentStageIterCount >= activePlanStage.stageIterations) {
          currentPlanStageIdx++;
          currentStageIterCount = 0;
          const nextStageMessage = currentPlanStageIdx < processState.planStages.length ? `Transitioning to Stage ${currentPlanStageIdx + 1}...` : "Final plan stage finished.";
          updateProcessState({statusMessage: nextStageMessage, aiProcessInsight: `Stage ${currentPlanStageIdx > 0 ? currentPlanStageIdx : 1} finished.` , currentPlanStageIndex: currentPlanStageIdx, currentStageIteration: currentStageIterCount});
          await performAutoSave();
          if (currentPlanStageIdx >= processState.planStages.length) {
             updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "Iterative plan completed.", aiProcessInsight: "All plan stages executed.", configAtFinalization: iterationStrategy.config });
             break;
          }
        }
      } else if (!isThisIterationTargeted) {
        currentIterationForPrompt = currentIter +1;
        if (currentIter >= maxOverallIterations) {
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "Maximum global iterations reached.", aiProcessInsight: "Global iterations complete.", configAtFinalization: iterationStrategy.config });
          break;
        }
      }

      productBeforeThisFailedIteration = currentProd;
      // iterationAttemptCount is already initialized to 0 at the top of the loop

      const iterationProgressPercentForNudge = maxOverallIterations > 0 ? currentIter / maxOverallIterations : 0;
      const nudgeStrategyForThisIteration = isThisIterationTargeted ? 'none' : determineNudgeStrategyForNext(
          processState.stagnationInfo.consecutiveStagnantIterations,
          processState.stagnationNudgeEnabled,
          iterationProgressPercentForNudge,
          processState.stagnationNudgeAggressiveness
      );
      const stagnationInfoForStrategyCall = { ...processState.stagnationInfo, nudgeStrategyApplied: nudgeStrategyForThisIteration };

      const stateForCurrentStrategyEval: Pick<ProcessState, 'currentProduct' | 'currentIteration' | 'maxIterations' | 'inputComplexity' | 'stagnationInfo' | 'iterationHistory' | 'currentModelForIteration' | 'currentAppliedModelConfig' | 'isPlanActive' | 'planStages'| 'currentPlanStageIndex' | 'selectedModelName' | 'stagnationNudgeEnabled' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness' | 'initialPrompt' | 'loadedFiles'> = {
        currentProduct: currentProd, currentIteration: currentIter, maxIterations: processState.maxIterations,
        inputComplexity: processState.inputComplexity, stagnationInfo: stagnationInfoForStrategyCall,
        iterationHistory: processState.iterationHistory, currentModelForIteration: processState.currentModelForIteration,
        currentAppliedModelConfig: processState.currentAppliedModelConfig,
        isPlanActive: processState.isPlanActive && !isThisIterationTargeted,
        planStages: processState.planStages, currentPlanStageIndex: currentPlanStageIdx,
        selectedModelName: processState.selectedModelName, stagnationNudgeEnabled: processState.stagnationNudgeEnabled,
        strategistInfluenceLevel: processState.strategistInfluenceLevel, stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
        initialPrompt: processState.initialPrompt, loadedFiles: processState.loadedFiles,
      };
      iterationStrategy = await reevaluateStrategy(stateForCurrentStrategyEval, userBaseConfig);

      updateProcessState({
          currentModelForIteration: iterationStrategy.modelName,
          currentAppliedModelConfig: iterationStrategy.config,
          activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction
      });

      let currentStatusMsg = `Iteration ${currentIterationForPrompt}`;
      if (isThisIterationTargeted) {
        currentStatusMsg = `Iteration ${currentIter + 1}: Refining selected text...`;
      } else if (activePlanStage) {
        currentStatusMsg = `Plan Stage ${currentPlanStageIdx! + 1}/${processState.planStages.length} (Iter. ${currentStageIterCount + 1}/${activePlanStage.stageIterations}): Processing...`;
      } else {
        currentStatusMsg = `Global Iteration ${currentIter + 1}/${maxOverallIterations}: Processing...`;
      }
      currentStatusMsg += ` Using Model: ${iterationStrategy.modelName}`;
      if (!isThisIterationTargeted && iterationStrategy.activeMetaInstruction && nudgeStrategyForThisIteration === 'meta_instruct') {
          currentStatusMsg += ` (Nudge: AI Meta-Guidance Applied)`;
      } else if (!isThisIterationTargeted && nudgeStrategyForThisIteration !== 'none' && nudgeStrategyForThisIteration !== 'meta_instruct') {
          currentStatusMsg += ` (Nudge: ${nudgeStrategyForThisIteration.replace('params_', '')} Parameter Adjustment)`;
      }
      updateProcessState({ statusMessage: currentStatusMsg, aiProcessInsight: `Strategy for Iter ${currentIterationForPrompt}: ${iterationStrategy.rationale}` });

      currentStreamBufferRef.current = "";
      // previousProductSnapshot is already set at the top of the loop

      let iterationSuccessful = false;
      let iterationProductFromApi = "";
      // apiResultForLog is already initialized at the top of the loop
      let validationInfoForLog: AiResponseValidationInfo | undefined;
      // fileProcessingInfoForApi is already initialized at the top of the loop

      for (let attempt = 1; attempt <= SELF_CORRECTION_MAX_ATTEMPTS; attempt++) {
          iterationAttemptCount = attempt;
          currentStreamBufferRef.current = "";

          let currentRetryContext: RetryContext | undefined = undefined;
          if (attempt > 1 && processState.iterationHistory.length > 0) {
              const lastLogEntriesForThisIter = processState.iterationHistory.filter(e => e.iteration === (currentIter + 1));
              const lastFailedAttemptLog = lastLogEntriesForThisIter.sort((a,b) => (b.attemptCount || 0) - (a.attemptCount || 0))[0];
              if(lastFailedAttemptLog && lastFailedAttemptLog.aiValidationInfo && !lastFailedAttemptLog.aiValidationInfo.passed && lastFailedAttemptLog.promptCoreUserInstructionsSent) {
                  currentRetryContext = { previousErrorReason: lastFailedAttemptLog.aiValidationInfo.reason || "AI response validation failed.", originalCoreInstructions: lastFailedAttemptLog.promptCoreUserInstructionsSent };
              }
          }

          const sendFilesThisCall = (currentIter + 1) === 1 && processState.loadedFiles.length > 0 && !processState.iterationHistory.some(e=>e.iteration === 1 && e.entryType === 'segmented_synthesis_milestone') && !isThisIterationTargeted;
          fileProcessingInfoForApi = {
              filesSentToApiIteration: sendFilesThisCall ? (currentIter + 1) : null,
              numberOfFilesActuallySent: sendFilesThisCall ? processState.loadedFiles.length : 0,
              totalFilesSizeBytesSent: sendFilesThisCall ? processState.loadedFiles.reduce((sum, f) => sum + f.size, 0) : 0,
              fileManifestProvidedCharacterCount: processState.initialPrompt.length,
              loadedFilesForIterationContext: sendFilesThisCall ? processState.loadedFiles : undefined,
          };

          const outlineForSinglePassIter1 = (currentIter + 1) === 1 && !processState.iterationHistory.some(e=>e.iteration === 1 && e.entryType === 'segmented_synthesis_milestone') && !isThisIterationTargeted ? outlineResultForIter1 : undefined;

          // DevLog Contextualization
          let devLogContextStringForApi: string | undefined = undefined;
          if (options?.userRawPromptForContextualizer && processState.devLog && processState.devLog.length > 0) {
            try {
              console.log("DevLog Contextualizer: Calling for user prompt:", options.userRawPromptForContextualizer.substring(0,100) + "...");
              const devLogContextString = await getRelevantDevLogContext(processState.devLog, options.userRawPromptForContextualizer);
              if (devLogContextString && !devLogContextString.startsWith("Error") && !devLogContextString.startsWith("No DevLog entries") && !devLogContextString.startsWith("DevLog Contextualizer Inactive")) {
                 devLogContextStringForApi = devLogContextString;
                 console.log("DevLog Contextualizer: Context to be used:", devLogContextString);
              } else {
                 console.log("DevLog Contextualizer: No relevant context found or service inactive/error:", devLogContextString);
              }
            } catch (e) {
              console.error("DevLog Contextualizer: Error during contextualization:", e);
            }
          }


          apiResultForLog = await GeminaiService.iterateProduct({
            currentProduct: currentProd || "",
            currentIterationOverall: currentIter + 1,
            maxIterationsOverall: isThisIterationTargeted ? currentIter + 1 : (activePlanStage ? activePlanStage.stageIterations : maxOverallIterations),
            fileManifest: processState.initialPrompt,
            loadedFiles: processState.loadedFiles,
            activePlanStage: isThisIterationTargeted ? null : activePlanStage,
            outputParagraphShowHeadings: processState.outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth,
            outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
            modelConfigToUse: iterationStrategy.config, 
            isGlobalMode,
            modelToUse: iterationStrategy.modelName,
            onStreamChunk,
            isHaltSignalled: () => haltSignalRef.current,
            retryContext: currentRetryContext,
            stagnationNudgeStrategy: nudgeStrategyForThisIteration,
            initialOutlineForIter1: outlineForSinglePassIter1,
            activeMetaInstruction: iterationStrategy.activeMetaInstruction,
            operationType: "full",
            isTargetedRefinementMode: isThisIterationTargeted,
            targetedSelectionText: options?.targetedSelection,
            targetedRefinementInstructions: options?.targetedInstructions,
            devLogContextString: devLogContextStringForApi, // Pass the prepared DevLog context
          });

          if (haltSignalRef.current) { // Check halt immediately after API call returns
             const finalProductOnHaltAfterApi = (currentStreamBufferRef.current || currentProd || "").startsWith(CONVERGED_PREFIX)
                ? null
                : (currentStreamBufferRef.current || currentProd);
            updateProcessState({
                isProcessing: false,
                statusMessage: "Process halted by user during AI response.",
                currentProductBeforeHalt: currentStreamBufferRef.current || currentProd,
                currentIterationBeforeHalt: currentIter,
                finalProduct: processState.finalProduct || finalProductOnHaltAfterApi,
                currentStageIteration: currentStageIterCount,
                currentPlanStageIndex: currentPlanStageIdx
            });
            logIterationData(currentIter + 1, currentEntryType, currentStreamBufferRef.current || currentProd, "Halted by user", previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, undefined, (currentStreamBufferRef.current || currentProd)?.length, (currentStreamBufferRef.current || currentProd)?.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
            iterationSuccessful = false; break;
          }
          iterationProductFromApi = currentStreamBufferRef.current;

          if (apiResultForLog.isRateLimitError) {
            handleRateLimitErrorEncountered();
            updateProcessState({ isProcessing: false, statusMessage: apiResultForLog.errorMessage || "API Rate Limit Hit.", aiProcessInsight: apiResultForLog.errorMessage || "Process paused due to API rate limits.", currentProductBeforeHalt: iterationProductFromApi, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
            logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `API Rate Limit: ${apiResultForLog.errorMessage}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, { checkName: "APILimit", passed: false, reason: apiResultForLog.errorMessage, details: { type: 'error_phrase', value: apiResultForLog.errorMessage } }, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
            iterationSuccessful = false; isProcessingRef.current = false; break;
          }
          if (apiResultForLog.status === 'ERROR') {
            updateProcessState({ isProcessing: false, statusMessage: `Error in Iteration ${currentIter + 1}: ${apiResultForLog.errorMessage}`, aiProcessInsight: `AI Error: ${apiResultForLog.errorMessage}` });
            logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `Error: ${apiResultForLog.errorMessage}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, { checkName: "APIError", passed: false, reason: apiResultForLog.errorMessage, details: {type: 'error_phrase', value: apiResultForLog.errorMessage } }, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
            iterationSuccessful = false; isProcessingRef.current = false; break;
          }

          let processedProduct = iterationProductFromApi;
          if (activePlanStage && activePlanStage.format === 'json' && !isThisIterationTargeted) {
              processedProduct = parseAndCleanJsonOutput(iterationProductFromApi);
          }
          if (processedProduct.startsWith(CONVERGED_PREFIX)) {
              processedProduct = processedProduct.substring(CONVERGED_PREFIX.length);
          }

          const tempLogEntryForValidation: IterationLogEntry = {
            iteration: currentIter + 1,
            entryType: currentEntryType,
            productSummary: getProductSummary(iterationProductFromApi),
            status: apiResultForLog?.status || "VALIDATING",
            timestamp: Date.now(),
            fileProcessingInfo: fileProcessingInfoForApi,
            apiStreamDetails: apiResultForLog?.apiStreamDetails,
            linesAdded: 0, linesRemoved: 0,
          };
          const aiValidationResult: IsLikelyAiErrorResponseResult = isLikelyAiErrorResponse( iterationProductFromApi, previousProductSnapshot || "", tempLogEntryForValidation, isThisIterationTargeted ? undefined : activePlanStage?.length, isThisIterationTargeted ? undefined : activePlanStage?.format );
          validationInfoForLog = aiValidationResult.checkDetails ? { checkName: "AIResponseValidation", passed: !aiValidationResult.isError, reason: aiValidationResult.reason, details: aiValidationResult.checkDetails } : undefined;

          let isCritFailureFromValidation = false;
          if (aiValidationResult.isError && validationInfoForLog?.details?.type) {
              const criticalErrorTypes: AiResponseValidationInfo['details']['type'][] = [ 'prompt_leakage', 'error_phrase_with_significant_reduction', 'extreme_reduction_error', 'extreme_reduction_instructed_but_with_error_phrase', 'initial_synthesis_failed_large_output', 'catastrophic_collapse' ];
              if (criticalErrorTypes.includes(validationInfoForLog.details.type)) isCritFailureFromValidation = true;
              if (validationInfoForLog.details.type === 'catastrophic_collapse') {
                  updateProcessState({ statusMessage: `CRITICAL: AI produced catastrophic output collapse. Iteration ${currentIter + 1}, Attempt ${attempt}. Halting.`, aiProcessInsight: `Catastrophic collapse: ${validationInfoForLog.reason || 'Unknown reason'}` });
                  iterationSuccessful = false;
                  logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `Catastrophic Collapse: ${aiValidationResult.reason}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
                  isProcessingRef.current = false;
                  break;
              }
          }

          if (aiValidationResult.isError && attempt < SELF_CORRECTION_MAX_ATTEMPTS) {
              updateProcessState({ statusMessage: `Attempt ${attempt} for Iter. ${currentIter + 1} failed validation: "${aiValidationResult.reason}". Retrying...`, aiProcessInsight: `Self-correction attempt ${attempt+1} for: ${aiValidationResult.reason}` });
              logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `Validation Failed (Attempt ${attempt}): ${aiValidationResult.reason}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
              await performAutoSave();
              continue;
          } else if (aiValidationResult.isError) {
              updateProcessState({ isProcessing: false, statusMessage: `Iteration ${currentIter + 1} failed validation after ${attempt} attempts: "${aiValidationResult.reason}". Process halted.`, aiProcessInsight: `Halted due to validation failure: ${aiValidationResult.reason}`, currentProductBeforeHalt: productBeforeThisFailedIteration, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
              iterationSuccessful = false; isProcessingRef.current = false;
          } else {
              iterationSuccessful = true;
          }
          break;
      }

      if (!iterationSuccessful) {
        if (haltSignalRef.current) { /* Already handled */ }
        else if (apiResultForLog?.isRateLimitError) { /* Already handled */ }
        else if (apiResultForLog?.status === 'ERROR') { /* Already handled */ }
        else {
             logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `Validation Failed (Final Attempt ${iterationAttemptCount}): ${validationInfoForLog?.reason || "Unknown reason"}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, iterationProductFromApi.length, iterationAttemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
        }
        isProcessingRef.current = false;
        break;
      }
      if (haltSignalRef.current) break;

      let finalProductForIteration = iterationProductFromApi;
      if (apiResultForLog?.status === 'CONVERGED' || iterationProductFromApi.startsWith(CONVERGED_PREFIX)) {
          finalProductForIteration = iterationProductFromApi.startsWith(CONVERGED_PREFIX) ? iterationProductFromApi.substring(CONVERGED_PREFIX.length) : iterationProductFromApi;
      } else if (activePlanStage && activePlanStage.format === 'json' && !isThisIterationTargeted) {
          finalProductForIteration = parseAndCleanJsonOutput(iterationProductFromApi);
      }

      currentProd = finalProductForIteration;

      let newStagnationInfo: StagnationInfo = { ...processState.stagnationInfo };
      if (!isThisIterationTargeted && !processState.isPlanActive && !haltSignalRef.current && apiResultForLog?.status !== 'ERROR' && !apiResultForLog?.isRateLimitError) {
          const similarityScore = calculateJaccardSimilarity(previousProductSnapshot, currentProd);
          const prevLength = previousProductSnapshot?.length || 0;
          const currentLength = currentProd?.length || 0;
          const charDelta = Math.abs(currentLength - prevLength);
          const lineChanges = Diff.diffLines(previousProductSnapshot || "", currentProd || "");
          const netLineChange = lineChanges.reduce((sum, part) => sum + (part.added ? (part.count || 0) : 0) - (part.removed ? (part.count || 0) : 0), 0);

          const isSubstantiallySimilar = similarityScore >= STAGNATION_SIMILARITY_THRESHOLD &&
                                        charDelta < STAGNATION_MIN_CHANGE_THRESHOLD * (currentLength > 1000 ? 5 : 1) &&
                                        Math.abs(netLineChange) < STAGNATION_MIN_CHANGE_THRESHOLD;


          let isLowValueIteration = isSubstantiallySimilar;
          if (apiResultForLog?.status === 'CONVERGED' || (validationInfoForLog && !validationInfoForLog.passed && (validationInfoForLog.details?.type === 'drastic_reduction_tolerated_global_mode' || validationInfoForLog.details?.type === 'extreme_reduction_tolerated_global_mode'))) {
              isLowValueIteration = true;
          }

          if (isSubstantiallySimilar) {
              newStagnationInfo.consecutiveStagnantIterations++;
              if (newStagnationInfo.consecutiveStagnantIterations >= 2 && similarityScore > FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT && Math.abs(netLineChange) <= FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT && charDelta < FORCED_CONVERGENCE_CHAR_DELTA_STRICT) {
                   currentProd = CONVERGED_PREFIX + currentProd;
                   apiResultForLog = {...apiResultForLog, status: 'CONVERGED', product: currentProd } as IterateProductResult;
                   updateProcessState({statusMessage: `Forced CONVERGENCE due to extreme similarity over ${newStagnationInfo.consecutiveStagnantIterations} iterations.`});
              }
          } else {
              newStagnationInfo.consecutiveStagnantIterations = 0;
          }
          newStagnationInfo.isStagnant = newStagnationInfo.consecutiveStagnantIterations > 0;
          newStagnationInfo.similarityWithPrevious = similarityScore;
          newStagnationInfo.consecutiveLowValueIterations = isLowValueIteration ? (newStagnationInfo.consecutiveLowValueIterations + 1) : 0;
          newStagnationInfo.lastProductLengthForStagnation = currentLength;
          updateProcessState({ stagnationInfo: newStagnationInfo });
      }

      logIterationData(currentIter + 1, currentEntryType, currentProd, apiResultForLog?.status === 'CONVERGED' || currentProd.startsWith(CONVERGED_PREFIX) ? "Converged" : `Iteration ${currentIter + 1} completed.`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, currentProd.length, iterationAttemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);

      updateProcessState({ currentProduct: currentProd, currentIteration: currentIter + 1 });

      if (apiResultForLog?.status === 'CONVERGED' || currentProd.startsWith(CONVERGED_PREFIX)) {
        const finalProductDisplay = currentProd.startsWith(CONVERGED_PREFIX) ? currentProd.substring(CONVERGED_PREFIX.length) : currentProd;
        updateProcessState({ isProcessing: false, finalProduct: finalProductDisplay, statusMessage: "Process converged.", aiProcessInsight: "AI signaled convergence.", configAtFinalization: iterationStrategy.config });
        break;
      }

      if (isThisIterationTargeted) {
          updateProcessState({ isProcessing: false, statusMessage: `Targeted refinement for Iteration ${currentIter + 1} complete.`, aiProcessInsight: "Targeted refinement applied." });
          break;
      }

      if (processState.isPlanActive) {
        currentStageIterCount++;
      }
      currentIter++;
      await performAutoSave();
    }

    isProcessingRef.current = false;
    // If process was halted inside the loop and finalProduct isn't set, set it from currentProduct
    // This condition needs to use the ref to get the latest state if updateProcessState is async
    const finalCurrentState = processState; // Assuming processState is up-to-date here after loop
    if (haltSignalRef.current && finalCurrentState.currentProduct && !finalCurrentState.finalProduct) {
        if (!finalCurrentState.currentProduct.startsWith(CONVERGED_PREFIX)) {
            updateProcessState({ finalProduct: finalCurrentState.currentProduct });
        }
    }
    await performAutoSave();
  };

  return { handleStart, handleHalt };
};
