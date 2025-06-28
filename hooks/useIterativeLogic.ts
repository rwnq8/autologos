

import { useRef, useState, useCallback }
from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, IsLikelyAiErrorResponseResult, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, ModelStrategy, IterationEntryType, StrategistLLMContext } from '../types.ts'; // Added StrategistLLMContext
import * as GeminaiService from '../services/geminiService';
import { determineInitialStrategy, reevaluateStrategy, FOCUSED_END_DEFAULTS as STRATEGY_FOCUSED_END_DEFAULTS } from '../services/ModelStrategyService'; // Renamed import
import { getUserPromptComponents } from '../services/promptBuilderService'; // Corrected import
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX, MIN_CHARS_FOR_DEVELOPED_PRODUCT, MIN_CHARS_SHORT_PRODUCT_THRESHOLD, MIN_CHARS_MATURE_PRODUCT_THRESHOLD } from '../services/iterationUtils'; // Imported new constants
import { calculateFleschReadingEase, calculateJaccardSimilarity, calculateLexicalDensity, calculateAvgSentenceLength, calculateSimpleTTR } from '../services/textAnalysisService';
import { DETERMINISTIC_TARGET_ITERATION } from '../hooks/useModelParameters';
import * as Diff from 'diff';
import type { AddLogEntryParams } from './useProcessState';
import { getRelevantDevLogContext } from '../services/devLogContextualizerService'; 
import { reconstructProduct } from '../services/diffService';


const SELF_CORRECTION_MAX_ATTEMPTS = 2;

const BASE_THRESHOLD_PARAMS_LIGHT = 1;
const BASE_THRESHOLD_PARAMS_HEAVY = 2;
const BASE_THRESHOLD_META_INSTRUCT = 3; 

const STAGNATION_SIMILARITY_THRESHOLD = 0.95; 
const STAGNATION_MIN_CHANGE_THRESHOLD_CHARS = 100; 
const STAGNATION_MIN_CHANGE_THRESHOLD_LINES = 5; 

const IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT = 20; 
const IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT = 1; 


const FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT = 0.985;
const FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT = 1;
const FORCED_CONVERGENCE_CHAR_DELTA_STRICT = 50;
const FORCED_CONVERGENCE_MAX_NUDGES = 3; // Max meta_instruct nudges before forced convergence if product is mature

const STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT = 0.85; 
const MIN_TOTAL_INPUT_SIZE_BYTES_FOR_SEGMENTATION = 200 * 1024; 


interface OutlineSegment {
    title: string;
    content: string;
    level: number;
    isPreface?: boolean; 
}

const parseOutlineToSegments = (outlineMarkdown: string): { segments: OutlineSegment[], documentTitle?: string } => {
    const segments: OutlineSegment[] = [];
    if (!outlineMarkdown || !outlineMarkdown.trim()) return { segments };

    const lines = outlineMarkdown.split('\n');
    let documentTitle: string | undefined = undefined;

    const firstNonEmptyLineIndex = lines.findIndex(line => line.trim() !== "");
    if (firstNonEmptyLineIndex !== -1) {
        const firstLine = lines[firstNonEmptyLineIndex].trim();
        if (firstLine.startsWith('# ') && !firstLine.startsWith('##')) {
            const hasH2sFollowing = lines.slice(firstNonEmptyLineIndex + 1).some(line => line.trim().startsWith('## '));
            if (hasH2sFollowing) {
                documentTitle = firstLine.substring(2).trim();
                lines.splice(firstNonEmptyLineIndex, 1);
            }
        }
    }

    let primaryHeadingRegex = /^(##\s+.*)/; 
    let primaryLevel = 2;
    if (!lines.some(line => primaryHeadingRegex.test(line.trim()))) {
        primaryHeadingRegex = /^(#\s+.*)/; 
        primaryLevel = 1;
    }

    let currentSegment: OutlineSegment | null = null;
    let prefaceContent = "";

    for (const line of lines) {
        const trimmedLine = line.trim();
        const headingMatch = trimmedLine.match(primaryHeadingRegex);

        if (headingMatch) {
            if (prefaceContent.trim() && segments.length === 0 && !currentSegment) {
                segments.push({ title: "Introduction / Preface (Auto-Segmented)", content: prefaceContent.trim(), level: 0, isPreface: true });
                prefaceContent = ""; 
            }
            if (currentSegment) {
                segments.push({ ...currentSegment, content: currentSegment.content.trim() });
            }
            currentSegment = { title: headingMatch[0].replace(primaryHeadingRegex, '$1').replace(/^#+\s*/, '').trim(), content: "", level: primaryLevel };
        } else if (currentSegment) {
            currentSegment.content += line + '\n';
        } else if (trimmedLine !== "") { 
            prefaceContent += line + '\n';
        }
    }

    if (currentSegment) {
        segments.push({ ...currentSegment, content: currentSegment.content.trim() });
    } else if (prefaceContent.trim() && segments.length === 0) {
        segments.push({ title: "Full Document (Auto-Segmented)", content: prefaceContent.trim(), level: 0, isPreface: true });
    }

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

// Constants MIN_CHARS_SHORT_PRODUCT_THRESHOLD and MIN_CHARS_MATURE_PRODUCT_THRESHOLD are now imported from iterationUtils.ts


const calculateQualitativeStatesForStrategist = (
    currentProduct: string | null,
    stagnationInfo: StagnationInfo,
    inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX',
    stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH'
): Pick<StrategistLLMContext, 'productDevelopmentState' | 'stagnationSeverity' | 'recentIterationPerformance'> => {
    const currentProductLength = currentProduct?.length || 0;

    let productDevelopmentState: StrategistLLMContext['productDevelopmentState'] = 'UNKNOWN';
    if (stagnationInfo.consecutiveLowValueIterations >= 2 && currentProductLength < MIN_CHARS_FOR_DEVELOPED_PRODUCT) {
        productDevelopmentState = 'NEEDS_EXPANSION_STALLED';
    } else if (currentProductLength < MIN_CHARS_SHORT_PRODUCT_THRESHOLD && (inputComplexity !== 'SIMPLE' || (stagnationInfo.lastMeaningfulChangeProductLength && currentProductLength < stagnationInfo.lastMeaningfulChangeProductLength * 0.7))) {
        productDevelopmentState = 'UNDERDEVELOPED_KERNEL';
    } else if (currentProductLength > MIN_CHARS_MATURE_PRODUCT_THRESHOLD) {
        productDevelopmentState = 'MATURE_PRODUCT';
    } else {
        productDevelopmentState = 'DEVELOPED_DRAFT';
    }

    let stagnationSeverity: StrategistLLMContext['stagnationSeverity'] = 'NONE';
    const identThreshold = stagnationNudgeAggressiveness === 'HIGH' ? 1 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 2 : 3);
    const lowValueThresholdSevere = stagnationNudgeAggressiveness === 'HIGH' ? 2 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 3 : 4);
    const stagnantThresholdSevere = stagnationNudgeAggressiveness === 'HIGH' ? 2 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 3 : 4);
    
    if (stagnationInfo.consecutiveIdenticalProductIterations >= identThreshold) {
        stagnationSeverity = 'CRITICAL'; // Most severe
    } else if (stagnationInfo.consecutiveLowValueIterations >= lowValueThresholdSevere || stagnationInfo.consecutiveStagnantIterations >= stagnantThresholdSevere) {
        stagnationSeverity = 'SEVERE';
    } else if (stagnationInfo.consecutiveLowValueIterations >=1 || stagnationInfo.consecutiveStagnantIterations >=1) {
        stagnationSeverity = 'MODERATE';
    } else if (stagnationInfo.isStagnant) {
        stagnationSeverity = 'MILD';
    }


    let recentIterationPerformance: StrategistLLMContext['recentIterationPerformance'] = 'PRODUCTIVE';
    if (stagnationInfo.consecutiveIdenticalProductIterations > 0) {
        recentIterationPerformance = 'STALLED';
    } else if (stagnationInfo.consecutiveLowValueIterations > 0) {
        recentIterationPerformance = 'LOW_VALUE';
    }

    return { productDevelopmentState, stagnationSeverity, recentIterationPerformance };
};


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
  const metaInstructNudgeCountRef = useRef(0);

  const logIterationData = useCallback((
    iterationNumber: number,
    entryType: IterationEntryType, 
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
    isCriticalFailure?: boolean,
    targetedSelection?: string,
    targetedRefinementInstructions?: string,
    netLineChange?: number, 
    charDelta?: number,
    similarityWithPreviousLogged?: number, // Added
    isStagnantIterationLogged?: boolean,  // Added
    isEffectivelyIdenticalLogged?: boolean, // Added
    isLowValueIterationLogged?: boolean // Added
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
      netLineChange, 
      charDelta,     
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
      isCriticalFailure, 
      isSegmentedSynthesis: entryType === 'segmented_synthesis_milestone',
      isTargetedRefinement: entryType === 'targeted_refinement',
      targetedSelection,
      targetedRefinementInstructions,
      similarityWithPreviousLogged, // Pass through
      isStagnantIterationLogged,  // Pass through
      isEffectivelyIdenticalLogged, // Pass through
      isLowValueIterationLogged // Pass through
    });
  }, [addLogEntryFromHook, processState.isPlanActive, processState.currentPlanStageIndex, processState.planStages]);


  const handleHalt = () => {
    haltSignalRef.current = true;
    isProcessingRef.current = false; 
  };

  const onStreamChunk = (chunkText: string) => {
    currentStreamBufferRef.current += chunkText;
    updateProcessState({ currentProduct: currentStreamBufferRef.current });
  };

  const determineNudgeStrategyForNext = (
    stagnationInfo: StagnationInfo,
    isStagnationNudgeEnabled: boolean,
    iterationProgressPercent: number,
    aggressiveness: 'LOW' | 'MEDIUM' | 'HIGH',
    isStuckOnMaxTokens?: boolean 
  ): NudgeStrategy => {
    if (!isStagnationNudgeEnabled || iterationProgressPercent >= STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT) {
        return 'none';
    }

    let thresholdLight = BASE_THRESHOLD_PARAMS_LIGHT;
    let thresholdHeavy = BASE_THRESHOLD_PARAMS_HEAVY;
    let thresholdMeta = BASE_THRESHOLD_META_INSTRUCT; 
    
    let identicalThresholdForMeta = aggressiveness === 'HIGH' ? 1 : (aggressiveness === 'MEDIUM' ? 2 : 3);
    let lowValueThresholdForMeta = aggressiveness === 'HIGH' ? 2 : (aggressiveness === 'MEDIUM' ? 3 : 4);


    if (aggressiveness === 'LOW') {
        thresholdLight = 2; // Low: Needs 2 stagnant iters for light nudge
        thresholdHeavy = 3; // Low: Needs 3 for heavy
        thresholdMeta  = 4; // Low: Needs 4 for meta
        identicalThresholdForMeta = 3; 
        lowValueThresholdForMeta = 4;  
    } else if (aggressiveness === 'HIGH') {
        thresholdLight = 1; // High: 1 stagnant iter for light nudge
        thresholdHeavy = 1; // High: 1 for heavy (effectively, heavy nudge happens if light one did not work, as threshold is same)
        thresholdMeta  = 2; // High: 2 for meta
        identicalThresholdForMeta = 1; 
        lowValueThresholdForMeta = 2; 
    }
    // For MEDIUM: thresholds remain as BASE_THRESHOLD defaults
    
    thresholdHeavy = Math.max(thresholdLight, thresholdHeavy); // Ensure heavy is at least as high as light
    thresholdMeta = Math.max(thresholdHeavy, thresholdMeta); // Ensure meta is at least as high as heavy

    if (isStuckOnMaxTokens && stagnationInfo.consecutiveLowValueIterations >= (aggressiveness === 'LOW' ? 2 : 1)) { 
      return 'meta_instruct'; // If stuck on MAX_TOKENS and low value, try meta-instruction quickly
    }
    // Use new stricter identical check first for meta_instruct
    if (stagnationInfo.consecutiveIdenticalProductIterations >= identicalThresholdForMeta) return 'meta_instruct';
    // Then check combined low value + general stagnation
    if (stagnationInfo.consecutiveLowValueIterations >= lowValueThresholdForMeta && stagnationInfo.consecutiveStagnantIterations > 0) return 'meta_instruct';
    // Then check just high low value iterations
    if (stagnationInfo.consecutiveLowValueIterations >= (lowValueThresholdForMeta + (aggressiveness === 'LOW' ? 1 : 0) )) return 'meta_instruct';

    // General stagnation thresholds
    if (stagnationInfo.consecutiveStagnantIterations >= thresholdMeta) return 'meta_instruct';
    if (stagnationInfo.consecutiveStagnantIterations >= thresholdHeavy) return 'params_heavy';
    if (stagnationInfo.consecutiveStagnantIterations >= thresholdLight) return 'params_light';
    return 'none';
  };


  const handleStart = async (
    options?: {
      isTargetedRefinement?: boolean;
      targetedSelection?: string;
      targetedInstructions?: string;
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
    metaInstructNudgeCountRef.current = 0; // Reset meta-instruction nudge counter

    let currentIter = processState.currentProductBeforeHalt !== null ? (processState.currentIterationBeforeHalt ?? processState.currentIteration) : processState.currentIteration;
    let currentProd = options?.isTargetedRefinement ? processState.currentProduct : (processState.currentProductBeforeHalt ?? processState.currentProduct);


    let currentPlanStageIdx = processState.currentProductBeforeHalt !== null ? (processState.currentPlanStageIndex ?? (processState.isPlanActive && processState.planStages.length > 0 ? 0 : null)) : (processState.isPlanActive && processState.planStages.length > 0 ? (processState.currentPlanStageIndex ?? 0) : null);
    let currentStageIterCount = processState.currentProductBeforeHalt !== null ? (processState.currentStageIteration ?? 0) : (processState.currentStageIteration ?? 0);

    if (options?.isTargetedRefinement) {
        currentPlanStageIdx = null; 
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
      aiProcessInsight: options?.isTargetedRefinement ? "Initializing strategy for targeted refinement..." : `Strategy for Iteration 1: ${iterationStrategy.rationale}`,
      currentProductBeforeHalt: null, currentIterationBeforeHalt: undefined,
      currentModelForIteration: iterationStrategy.modelName,
      currentAppliedModelConfig: iterationStrategy.config,
      activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
    });

    let outlineResultForIter1: OutlineGenerationResult | undefined = undefined;
    let devLogContextForOutline: string | undefined = undefined;

    if (currentIter === 0 && !options?.isTargetedRefinement && (currentProd === null || currentProd.trim() === "")) {
      const iterationZeroActualProduct = processState.initialPrompt; 
      const initialFileProcessingInfo: FileProcessingInfo = {
        filesSentToApiIteration: null,
        numberOfFilesActuallySent: processState.loadedFiles.length,
        totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
        fileManifestProvidedCharacterCount: iterationZeroActualProduct.length,
        loadedFilesForIterationContext: processState.loadedFiles,
      };

      if (processState.loadedFiles.length > 0) {
        if (processState.devLog && processState.devLog.length > 0) {
            const outlineUserPrompt = `User requested an initial outline and redundancy analysis for the provided file inputs (see manifest below):\n${iterationZeroActualProduct}`;
            devLogContextForOutline = await getRelevantDevLogContext(processState.devLog, outlineUserPrompt);
            if (devLogContextForOutline && (devLogContextForOutline.startsWith("Error") || devLogContextForOutline.startsWith("No DevLog entries") || devLogContextForOutline.startsWith("DevLog Contextualizer Inactive"))) {
                devLogContextForOutline = undefined; 
            }
        }

        updateProcessState({ statusMessage: "Iteration 0: Generating initial outline from files...", aiProcessInsight: "Requesting outline and redundancy analysis from AI."});
        outlineResultForIter1 = await GeminaiService.generateInitialOutline(
            iterationZeroActualProduct, 
            processState.loadedFiles,
            iterationStrategy.config,
            iterationStrategy.modelName,
            devLogContextForOutline
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
            logIterationData(0, 'initial_state', iterationZeroActualProduct, `Outline Generation Failed: ${outlineResultForIter1.errorMessage}`, "", apiResultForFailedOutline, iterationStrategy.config, initialFileProcessingInfo, {checkName: "OutlineGen", passed:false, reason: outlineResultForIter1.errorMessage, isCriticalFailure: true}, 0,0,0, iterationStrategy.rationale, iterationStrategy.modelName, undefined, true);
            isProcessingRef.current = false;
            await performAutoSave();
            return;
        }
        
        const { documentTitle } = parseOutlineToSegments(outlineResultForIter1.outline);
        const statusMsgForLog = documentTitle
            ? `Initial outline (Doc Title: "${documentTitle}") and redundancies generated.`
            : "Initial outline and redundancies generated.";
        logIterationData(
          0, 'initial_state', iterationZeroActualProduct, 
          statusMsgForLog, "", 
          { product: "", status: 'COMPLETED', apiStreamDetails: outlineResultForIter1.apiDetails, promptFullUserPromptSent: `Outline requested for ${processState.loadedFiles.length} files.` },
          iterationStrategy.config,
          initialFileProcessingInfo, undefined,
          iterationZeroActualProduct.length, iterationZeroActualProduct.length, 0,
          iterationStrategy.rationale,
          iterationStrategy.modelName,
          iterationStrategy.activeMetaInstruction,
          false, undefined, undefined, 0, 0, // Stagnation metrics for Iter 0
          undefined, false, true, true // Iter 0 is "identical" to empty if prompt is empty
        );
      } else { 
        logIterationData(
          0, 'initial_state', iterationZeroActualProduct, 
          "Initial state loaded from prompt.", "",
          undefined, iterationStrategy.config,
          initialFileProcessingInfo, undefined,
          iterationZeroActualProduct.length, iterationZeroActualProduct.length, 0,
          iterationStrategy.rationale,
          iterationStrategy.modelName,
          iterationStrategy.activeMetaInstruction,
          false, undefined, undefined, 0, 0, // Stagnation metrics for Iter 0
          undefined, false, true, true // Iter 0 is "identical" to empty if prompt is empty
        );
      }

      currentProd = iterationZeroActualProduct; 
      updateProcessState({
        currentProduct: iterationZeroActualProduct, 
        currentIteration: 0,
        stagnationInfo: {
            ...processState.stagnationInfo,
            consecutiveStagnantIterations: 0,
            consecutiveIdenticalProductIterations: 0,
            consecutiveLowValueIterations: 0,
            similarityWithPrevious: undefined,
            lastProductLengthForStagnation: iterationZeroActualProduct?.length ?? 0,
            lastMeaningfulChangeProductLength: iterationZeroActualProduct?.length ?? 0,
        }
      });
      await performAutoSave();
    }

    
    if (currentIter === 0 && !options?.isTargetedRefinement) {
        const initialFileProcessingInfoForIter1Decision: FileProcessingInfo = { 
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
            updateProcessState({ statusMessage: "Starting segmented synthesis for Iteration 1...", aiProcessInsight: "Segmented Iteration 1: Preparing outline segments."});
            const { segments, documentTitle } = parseOutlineToSegments(outlineResultForIter1!.outline); 
            if (segments.length === 0) {
                updateProcessState({ isProcessing: false, statusMessage: "Iteration 1 Error: Outline parsed into zero segments. Cannot proceed with segmented synthesis.", aiProcessInsight: "Segmented synthesis halted: No segments found in outline."});
                logIterationData(1, 'segmented_synthesis_milestone', "", "Outline parsing yielded no segments.", currentProd || "", undefined, iterationStrategy.config, undefined, {checkName:"SegmentParse", passed:false, reason:"No segments in outline", isCriticalFailure: true}, 0,0,0,iterationStrategy.rationale, undefined, undefined, true);
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
            currentIter = 1; 

            const fileProcessingInfoForIter1Segmented: FileProcessingInfo = {
                filesSentToApiIteration: 1, 
                numberOfFilesActuallySent: processState.loadedFiles.length,
                totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
                fileManifestProvidedCharacterCount: processState.initialPrompt.length,
                loadedFilesForIterationContext: processState.loadedFiles,
            };
            
            const iterZeroProductResult = reconstructProduct(0, processState.iterationHistory, processState.initialPrompt);
            let previousProductForLog = iterZeroProductResult.product || processState.initialPrompt; 
            if (iterZeroProductResult.error && iterZeroProductResult.product !== processState.initialPrompt) { 
                // console.warn(`Warning: Could not reconstruct product for Iteration 0 to log as previous product for Iteration 1 (segmented). Error: ${iterZeroProductResult.error}. Using initialPrompt as fallback.`);
            }
            
            const netLineChangeSeg = currentProd.split('\n').length - previousProductForLog.split('\n').length;
            const charDeltaSeg = currentProd.length - previousProductForLog.length;
            const similaritySeg = calculateJaccardSimilarity(previousProductForLog, currentProd);

            logIterationData(
                currentIter, 
                'segmented_synthesis_milestone',
                currentProd, 
                segmentedSynthesisError || "Segmented Iteration 1 completed.",
                previousProductForLog, 
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
                iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction,
                !!segmentedSynthesisError,
                undefined, undefined, netLineChangeSeg, charDeltaSeg, // Log deltas
                similaritySeg, charDeltaSeg < STAGNATION_MIN_CHANGE_THRESHOLD_CHARS, charDeltaSeg < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT, charDeltaSeg < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT // Stagnation metrics for segmented synthesis
            );

            updateProcessState({
                currentProduct: currentProd,
                currentIteration: currentIter,
                statusMessage: segmentedSynthesisError || "Segmented Iteration 1 synthesis complete.",
                aiProcessInsight: segmentedSynthesisError || `Iteration 1 (Segmented): Assembled product from ${segments.length} segments.`,
                isProcessing: !!segmentedSynthesisError || haltSignalRef.current ? false : true,
                 stagnationInfo: { 
                    ...processState.stagnationInfo,
                    consecutiveStagnantIterations: 0,
                    consecutiveIdenticalProductIterations: 0,
                    consecutiveLowValueIterations: 0,
                    lastProductLengthForStagnation: currentProd?.length || 0,
                    lastMeaningfulChangeProductLength: currentProd?.length || 0,
                },
            });

            if (segmentedSynthesisError || haltSignalRef.current) {
                isProcessingRef.current = false;
                await performAutoSave();
                return;
            }
            await performAutoSave();
        } else { 
            const singlePassReason = !(outlineResultForIter1 && outlineResultForIter1.outline.trim())
                ? "No usable outline generated. Iteration 1 will be single-pass synthesis from files/prompt."
                : `Input size (${(initialFileProcessingInfoForIter1Decision.totalFilesSizeBytesSent / 1024).toFixed(1)}KB) below threshold for segmented synthesis. Iteration 1 will be single-pass.`;

            updateProcessState({
                statusMessage: singlePassReason,
                aiProcessInsight: singlePassReason
            });
        }
    }


    const maxOverallIterations = processState.maxIterations;
    let productBeforeThisFailedIteration: string | null = currentProd;


    while (true) {
      let apiResultForLog: IterateProductResult | undefined = undefined;
      let currentEntryType: IterationEntryType = 'ai_iteration'; 
      let previousProductSnapshot: string | null = currentProd; 
      let fileProcessingInfoForApi: FileProcessingInfo | undefined = undefined;
      let iterationAttemptCount: number = 0;
      let isCurrentIterationCriticalFailure = false;
      let specificMetaInstructionForIteration: string | undefined = undefined;


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
        if (apiResultForLog) {
             logIterationData(currentIter + 1, currentEntryType, currentStreamBufferRef.current || currentProd, "Halted by user", previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, undefined, undefined, undefined, iterationAttemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
        } else {
             logIterationData(currentIter + 1, currentEntryType, currentStreamBufferRef.current || currentProd, "Halted by user", previousProductSnapshot);
        }
        isProcessingRef.current = false;
        await performAutoSave();
        return;
      }
      currentIter++;
      if (currentIter > maxOverallIterations && !processState.isPlanActive) {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Reached max iterations (${maxOverallIterations}). Global process complete.`, configAtFinalization: iterationStrategy.config, aiProcessInsight: `Global Mode: Max iterations reached. Final product displayed.` });
        isProcessingRef.current = false;
        await performAutoSave();
        return;
      }

      if (processState.isPlanActive) {
        if (currentPlanStageIdx === null || currentPlanStageIdx >= processState.planStages.length) {
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "All plan stages completed.", configAtFinalization: iterationStrategy.config, aiProcessInsight: `Iterative Plan: All ${processState.planStages.length} stages completed. Final product displayed.` });
          isProcessingRef.current = false;
          await performAutoSave();
          return;
        }
        currentStageIterCount++;
        const currentStage = processState.planStages[currentPlanStageIdx];
        if (currentStageIterCount > currentStage.stageIterations) {
          currentPlanStageIdx++;
          currentStageIterCount = 1;
          if (currentPlanStageIdx >= processState.planStages.length) {
            updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "All plan stages completed.", configAtFinalization: iterationStrategy.config, aiProcessInsight: `Iterative Plan: Finished final stage. Final product displayed.` });
            isProcessingRef.current = false;
            await performAutoSave();
            return;
          }
        }
         updateProcessState({ currentPlanStageIndex: currentPlanStageIdx, currentStageIteration: currentStageIterCount -1 });
      }

      let devLogContextForIteration: string | undefined = undefined;
      const userPromptForDevLogContextualizer = options?.userRawPromptForContextualizer || `Refine current product for Iteration ${currentIter}. Current strategy is: ${iterationStrategy.rationale}`;
      if (processState.devLog && processState.devLog.length > 0 && processState.strategistInfluenceLevel !== 'OFF') { // Only get if strategist can use it
          devLogContextForIteration = await getRelevantDevLogContext(processState.devLog, userPromptForDevLogContextualizer);
          if (devLogContextForIteration && (devLogContextForIteration.startsWith("Error") || devLogContextForIteration.startsWith("No DevLog entries") || devLogContextForIteration.startsWith("DevLog Contextualizer Inactive"))) {
              devLogContextForIteration = undefined; 
          }
      }

      currentStreamBufferRef.current = ""; 
      let retryIterationContext: RetryContext | undefined = undefined;
      isCurrentIterationCriticalFailure = false;

      // Update the specificMetaInstructionForIteration based on current client-side nudge strategy IF it's meta_instruct
      // This allows ModelStrategyService to potentially use this client-determined meta-instruction
      // if the Strategist LLM doesn't provide one or is turned off.
      if (processState.stagnationInfo.nudgeStrategyApplied === 'meta_instruct' && !processState.activeMetaInstructionForNextIter) {
          const currentProductLength = currentProd?.length || 0;
          const isUnderdeveloped = currentProductLength < MIN_CHARS_FOR_DEVELOPED_PRODUCT && (processState.inputComplexity !== 'SIMPLE' || currentProductLength < (processState.stagnationInfo.lastMeaningfulChangeProductLength || currentProductLength) * 0.8);

          if (isUnderdeveloped) {
              specificMetaInstructionForIteration = `The product (currently ${currentProductLength} chars) seems underdeveloped or stuck in minor edits. Please focus on substantial conceptual expansion, adding more details, examples, or exploring new perspectives based on the original source material. Avoid mere wordsmithing.`;
          } else {
              specificMetaInstructionForIteration = `Refinement seems to be stalling. Please attempt a significantly different approach. Consider focusing on one of these: radically restructuring a section, rephrasing key arguments for clarity, or critically re-evaluating the overall coherence. If no substantial conceptual improvement can be made, consider declaring convergence.`;
          }
          // This client-side instruction will be passed to reevaluateStrategy.
      } else {
        specificMetaInstructionForIteration = processState.activeMetaInstructionForNextIter;
      }


      for (iterationAttemptCount = 0; iterationAttemptCount <= SELF_CORRECTION_MAX_ATTEMPTS; iterationAttemptCount++) {
        const activePlanStageForCall = processState.isPlanActive && currentPlanStageIdx !== null ? processState.planStages[currentPlanStageIdx] : null;
        
        const { productDevelopmentState, stagnationSeverity, recentIterationPerformance } = calculateQualitativeStatesForStrategist(
            currentProd,
            processState.stagnationInfo,
            processState.inputComplexity,
            processState.stagnationNudgeAggressiveness
        );

        let currentRefinementFocusHint = "General Refinement";
        if (stagnationSeverity !== 'NONE' && productDevelopmentState === 'UNDERDEVELOPED_KERNEL') {
            currentRefinementFocusHint = "Expansion (Product appears underdeveloped and stagnant)";
        } else if (productDevelopmentState === 'UNDERDEVELOPED_KERNEL') {
            currentRefinementFocusHint = "Expansion (Product appears underdeveloped)";
        } else if (stagnationSeverity !== 'NONE' && productDevelopmentState === 'MATURE_PRODUCT') {
            currentRefinementFocusHint = "Polish/Convergence Attempt (Mature product, but stagnant)";
        }
        
        const strategyCallState = {
            currentProduct: processState.currentProduct,
            currentIteration: currentIter - 1,
            maxIterations: processState.maxIterations,
            inputComplexity: processState.inputComplexity,
            stagnationInfo: processState.stagnationInfo,
            iterationHistory: processState.iterationHistory,
            currentModelForIteration: processState.currentModelForIteration,
            currentAppliedModelConfig: processState.currentAppliedModelConfig,
            isPlanActive: processState.isPlanActive,
            planStages: processState.planStages,
            currentPlanStageIndex: processState.currentPlanStageIndex,
            selectedModelName: processState.selectedModelName,
            stagnationNudgeEnabled: processState.stagnationNudgeEnabled,
            strategistInfluenceLevel: processState.strategistInfluenceLevel,
            stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
            initialPrompt: processState.initialPrompt,
            loadedFiles: processState.loadedFiles,
            activeMetaInstructionForNextIter: specificMetaInstructionForIteration, 
            // Extended context for strategist LLM
            lastNValidationSummariesString: processState.iterationHistory.slice(-3).map(e => e.aiValidationInfo?.reason || "Passed").join('; ') || "N/A",
            productDevelopmentState,
            stagnationSeverity,
            recentIterationPerformance
        };

        iterationStrategy = await reevaluateStrategy(strategyCallState, userBaseConfig);
        
        // Update activeMetaInstructionForNextIter based on what strategy service decided
        // This ensures it's correctly logged and potentially used by the next iteration's reevaluateStrategy call
        if (processState.activeMetaInstructionForNextIter !== iterationStrategy.activeMetaInstruction) {
            updateProcessState({ activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction });
        }


        updateProcessState({
            statusMessage: `Iteration ${currentIter}${processState.isPlanActive && currentPlanStageIdx !== null ? ` (Stage ${currentPlanStageIdx+1}, Stage Iter ${currentStageIterCount})` : ''}: Processing... (Attempt ${iterationAttemptCount + 1})`,
            aiProcessInsight: iterationStrategy.rationale,
            currentModelForIteration: iterationStrategy.modelName,
            currentAppliedModelConfig: iterationStrategy.config,
        });
        
        fileProcessingInfoForApi = {
            filesSentToApiIteration: (currentIter === 1 && processState.loadedFiles.length > 0 && !outlineResultForIter1) ? 1 : null, 
            numberOfFilesActuallySent: (currentIter === 1 && processState.loadedFiles.length > 0 && !outlineResultForIter1) ? processState.loadedFiles.length : 0,
            totalFilesSizeBytesSent: (currentIter === 1 && processState.loadedFiles.length > 0 && !outlineResultForIter1) ? processState.loadedFiles.reduce((sum, f) => sum + f.size, 0) : 0,
            fileManifestProvidedCharacterCount: processState.initialPrompt.length,
            loadedFilesForIterationContext: (currentIter === 1 && processState.loadedFiles.length > 0 && !outlineResultForIter1) ? processState.loadedFiles : []
        };

        if (options?.isTargetedRefinement) {
            currentEntryType = 'targeted_refinement';
            fileProcessingInfoForApi.filesSentToApiIteration = null;
            fileProcessingInfoForApi.numberOfFilesActuallySent = 0;
            fileProcessingInfoForApi.totalFilesSizeBytesSent = 0;
            const refinedConfig = {...iterationStrategy.config};
            delete (refinedConfig as any).responseMimeType; 
            iterationStrategy.config = refinedConfig;
        } else {
            currentEntryType = 'ai_iteration';
        }

        apiResultForLog = await GeminaiService.iterateProduct({
            currentProduct: currentProd || "",
            currentIterationOverall: currentIter,
            maxIterationsOverall: maxOverallIterations,
            fileManifest: processState.initialPrompt,
            loadedFiles: processState.loadedFiles,
            activePlanStage: activePlanStageForCall,
            outputParagraphShowHeadings: processState.outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth,
            outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
            modelConfigToUse: iterationStrategy.config,
            isGlobalMode: !processState.isPlanActive,
            modelToUse: iterationStrategy.modelName,
            onStreamChunk,
            isHaltSignalled: () => haltSignalRef.current,
            retryContext: retryIterationContext,
            stagnationNudgeStrategy: processState.stagnationInfo.nudgeStrategyApplied,
            initialOutlineForIter1: (currentIter === 1 && !options?.isTargetedRefinement) ? outlineResultForIter1 : undefined,
            activeMetaInstruction: iterationStrategy.activeMetaInstruction, // This is crucial; pass the final decided meta-instruction
            devLogContextString: devLogContextForIteration,
            isTargetedRefinementMode: !!options?.isTargetedRefinement,
            targetedSelectionText: options?.targetedSelection,
            targetedRefinementInstructions: options?.targetedInstructions,
        });

        if (haltSignalRef.current) break; 
        if (apiResultForLog.isRateLimitError) { handleRateLimitErrorEncountered(); break; }

        const newProductCandidate = currentStreamBufferRef.current || "";

        let validationResult: IsLikelyAiErrorResponseResult | null = null;
        const iterationLogEntryForValidation: IterationLogEntry = {
            iteration: currentIter,
            productSummary: getProductSummary(newProductCandidate),
            status: "Validating...",
            timestamp: Date.now(),
            fileProcessingInfo: fileProcessingInfoForApi,
            apiStreamDetails: apiResultForLog.apiStreamDetails,
            modelConfigUsed: iterationStrategy.config,
            currentModelForIteration: iterationStrategy.modelName,
        };
        
        validationResult = isLikelyAiErrorResponse(newProductCandidate, currentProd || "", iterationLogEntryForValidation, (currentIter === 1 ? outlineResultForIter1 : undefined), activePlanStageForCall?.length, activePlanStageForCall?.format, processState.inputComplexity);
        isCurrentIterationCriticalFailure = validationResult.isCriticalFailure || false;

        if (validationResult.isError && iterationAttemptCount < SELF_CORRECTION_MAX_ATTEMPTS && !isCurrentIterationCriticalFailure) {
          retryIterationContext = {
              previousErrorReason: validationResult.reason,
              originalCoreInstructions: getUserPromptComponents( 
                currentIter, maxOverallIterations, activePlanStageForCall,
                processState.outputParagraphShowHeadings, processState.outputParagraphMaxHeadingDepth, processState.outputParagraphNumberedHeadings,
                !processState.isPlanActive, (currentIter === 1 && processState.loadedFiles.length > 0 && !outlineResultForIter1),
                undefined, processState.stagnationInfo.nudgeStrategyApplied,
                (currentIter === 1 ? outlineResultForIter1 : undefined), processState.loadedFiles, iterationStrategy.activeMetaInstruction
              ).coreUserInstructions
          };
          updateProcessState({ statusMessage: `Iteration ${currentIter}: Error detected ("${validationResult.reason}"). Attempting self-correction ${iterationAttemptCount + 1}/${SELF_CORRECTION_MAX_ATTEMPTS}...` });
          productBeforeThisFailedIteration = currentProd; 
          currentStreamBufferRef.current = ""; 
          continue; 
        }

        const aiValidationInfoForLog: AiResponseValidationInfo = {
            checkName: validationResult.checkDetails?.type?.toString() || "ProductValidation",
            passed: !validationResult.isError,
            isCriticalFailure: validationResult.isCriticalFailure,
            reason: validationResult.reason,
            details: validationResult.checkDetails,
        };
        
        // Calculate per-iteration stagnation metrics before logging
        const charDeltaForLog = newProductCandidate.length - (currentProd || "").length;
        const netLineChangeForLog = newProductCandidate.split('\n').length - (currentProd || "").split('\n').length;
        const similarityForLog = calculateJaccardSimilarity(currentProd, newProductCandidate);

        let isStagnantIterLogged = false;
        let isIdenticalIterLogged = false;
        let isLowValueIterLogged = false;

        isIdenticalIterLogged = (Math.abs(charDeltaForLog) < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT && Math.abs(netLineChangeForLog) <= IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT) || apiResultForLog.product.startsWith(CONVERGED_PREFIX);
        if (similarityForLog > STAGNATION_SIMILARITY_THRESHOLD && (Math.abs(charDeltaForLog) < STAGNATION_MIN_CHANGE_THRESHOLD_CHARS || Math.abs(netLineChangeForLog) < STAGNATION_MIN_CHANGE_THRESHOLD_LINES)) {
            isStagnantIterLogged = true;
        }
        if(isIdenticalIterLogged || (isStagnantIterLogged && (Math.abs(charDeltaForLog) < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT || Math.abs(netLineChangeForLog) <= IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT))) {
            isLowValueIterLogged = true;
        }

        logIterationData(
            currentIter, currentEntryType, newProductCandidate,
            validationResult.isError ? `Validation Failed (Attempt ${iterationAttemptCount+1}): ${validationResult.reason}` : apiResultForLog.status,
            iterationAttemptCount > 0 ? productBeforeThisFailedIteration : previousProductSnapshot,
            apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi,
            aiValidationInfoForLog,
            newProductCandidate.length,
            (apiResultForLog.product || "").startsWith(CONVERGED_PREFIX) ? (apiResultForLog.product || "").substring(CONVERGED_PREFIX.length).length : (apiResultForLog.product || "").length,
            iterationAttemptCount + 1,
            iterationStrategy.rationale,
            iterationStrategy.modelName,
            iterationStrategy.activeMetaInstruction,
            isCurrentIterationCriticalFailure, 
            options?.targetedSelection, options?.targetedInstructions,
            netLineChangeForLog, charDeltaForLog, // Pass calculated deltas
            similarityForLog, isStagnantIterLogged, isIdenticalIterLogged, isLowValueIterLogged // Pass new stagnation flags
        );

        if (validationResult.isError) { 
          updateProcessState({ isProcessing: false, statusMessage: `Iteration ${currentIter}: Process halted due to error: ${validationResult.reason}. Last product state shown.`, aiProcessInsight: `Halted due to critical error or failed retry: ${validationResult.reason}` });
          isProcessingRef.current = false;
          await performAutoSave();
          return;
        }
        break; 
      } 

      if (haltSignalRef.current || apiResultForLog.isRateLimitError) { break; }

      let finalProductForIter = (apiResultForLog.product || "").startsWith(CONVERGED_PREFIX)
                                ? (apiResultForLog.product || "").substring(CONVERGED_PREFIX.length)
                                : (apiResultForLog.product || "");
      
      const activePlanStageForPostProcessing = processState.isPlanActive && currentPlanStageIdx !== null ? processState.planStages[currentPlanStageIdx] : null;
      if (activePlanStageForPostProcessing && activePlanStageForPostProcessing.format === 'json' && finalProductForIter) {
         finalProductForIter = parseAndCleanJsonOutput(finalProductForIter);
      }
      
      currentProd = finalProductForIter;
      const charDelta = currentProd.length - (previousProductSnapshot || "").length;
      const netLineChange = currentProd.split('\n').length - (previousProductSnapshot || "").split('\n').length;
      const similarity = calculateJaccardSimilarity(previousProductSnapshot, currentProd);

      let isStagnantIteration = false;
      let isLowValueIteration = false;

      const isEffectivelyIdentical =
        (Math.abs(charDelta) < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT && Math.abs(netLineChange) <= IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT) ||
        apiResultForLog.product.startsWith(CONVERGED_PREFIX);

      if (similarity > STAGNATION_SIMILARITY_THRESHOLD && (Math.abs(charDelta) < STAGNATION_MIN_CHANGE_THRESHOLD_CHARS || Math.abs(netLineChange) < STAGNATION_MIN_CHANGE_THRESHOLD_LINES)) {
          isStagnantIteration = true;
      }
      
      if(isEffectivelyIdentical || 
         (isStagnantIteration && Math.abs(charDelta) < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT) || 
         (isStagnantIteration && Math.abs(netLineChange) <= IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT)
        ) {
          isLowValueIteration = true;
      }


      const newStagnationInfo: StagnationInfo = {
          isStagnant: isStagnantIteration,
          consecutiveStagnantIterations: isStagnantIteration ? (processState.stagnationInfo.consecutiveStagnantIterations || 0) + 1 : 0,
          consecutiveIdenticalProductIterations: isEffectivelyIdentical ? (processState.stagnationInfo.consecutiveIdenticalProductIterations || 0) + 1 : 0,
          consecutiveLowValueIterations: isLowValueIteration ? (processState.stagnationInfo.consecutiveLowValueIterations || 0) + 1 : 0,
          similarityWithPrevious: similarity,
          lastProductLengthForStagnation: currentProd?.length || 0,
          lastMeaningfulChangeProductLength: (isLowValueIteration && processState.stagnationInfo.lastMeaningfulChangeProductLength) ? processState.stagnationInfo.lastMeaningfulChangeProductLength : (currentProd?.length || 0),
          nudgeStrategyApplied: 'none' 
      };
      newStagnationInfo.nudgeStrategyApplied = determineNudgeStrategyForNext(newStagnationInfo, processState.stagnationNudgeEnabled, (currentIter / maxOverallIterations), processState.stagnationNudgeAggressiveness, apiResultForLog.isStuckOnMaxTokensContinuation);

      if (newStagnationInfo.nudgeStrategyApplied === 'meta_instruct') {
          metaInstructNudgeCountRef.current +=1;
      }


      updateProcessState({
        currentProduct: currentProd, currentIteration: currentIter,
        statusMessage: `Iteration ${currentIter} ${apiResultForLog.status}.`,
        stagnationInfo: newStagnationInfo,
        aiProcessInsight: iterationStrategy.rationale, 
        // activeMetaInstructionForNextIter is handled by reevaluateStrategy
      });
      
      // If the iteration strategy resulted in a meta instruction, clear it from the *next* iteration's state
      // unless the strategy service sets it again for the *next* iteration specifically.
      if (iterationStrategy.activeMetaInstruction) {
          updateProcessState({activeMetaInstructionForNextIter: undefined});
      }

      const isMatureProductForForcedConvergence = currentProd && currentProd.length > MIN_CHARS_MATURE_PRODUCT_THRESHOLD;
      if (apiResultForLog.status === 'CONVERGED' || 
         (!processState.isPlanActive && processState.stagnationNudgeEnabled && 
          metaInstructNudgeCountRef.current >= FORCED_CONVERGENCE_MAX_NUDGES && 
          isMatureProductForForcedConvergence &&
          newStagnationInfo.consecutiveLowValueIterations >= FORCED_CONVERGENCE_MAX_NUDGES && // Ensure low value persists
          similarity > FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT && 
          Math.abs(netLineChange) <= FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT && 
          Math.abs(charDelta) <= FORCED_CONVERGENCE_CHAR_DELTA_STRICT
         )
         ) {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Process converged at Iteration ${currentIter}.`, configAtFinalization: iterationStrategy.config, aiProcessInsight: `Convergence declared at Iteration ${currentIter}. ${apiResultForLog.status === 'CONVERGED' ? 'AI declared convergence.' : 'System forced convergence after multiple meta-instruction nudges on mature, stagnant product.'}` });
        isProcessingRef.current = false;
        await performAutoSave();
        return;
      }
      await performAutoSave();
    }
  };

  return { handleStart, handleHalt };
};
