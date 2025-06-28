import { useRef, useState, useCallback } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, IsLikelyAiErrorResponseResult, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, ModelStrategy, IterationEntryType, StrategistLLMContext } from '../types.ts';
import * as GeminaiService from '../services/geminiService';
import { determineInitialStrategy, reevaluateStrategy, FOCUSED_END_DEFAULTS as STRATEGY_FOCUSED_END_DEFAULTS } from '../services/ModelStrategyService';
import { getUserPromptComponents } from '../services/promptBuilderService';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX, MIN_CHARS_FOR_DEVELOPED_PRODUCT, MIN_CHARS_SHORT_PRODUCT_THRESHOLD, MIN_CHARS_MATURE_PRODUCT_THRESHOLD, isDataDump } from '../services/iterationUtils';
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

const IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT = 10;
const IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT = 1;

// Wordsmithing specific thresholds
const WORDSMITHING_SIMILARITY_SEVERE_THRESHOLD = 0.98; 
const WORDSMITHING_SIMILARITY_EXTREME_THRESHOLD = 0.99;
const WORDSMITHING_CHAR_DELTA_THRESHOLD = 30;
const WORDSMITHING_EXTREME_SIMILARITY_CHAR_DELTA_THRESHOLD = 50; 
const WORDSMITHING_LINE_CHANGE_THRESHOLD = 1;
const WORDSMITHING_FORCE_META_THRESHOLD_HIGH = 2;
const WORDSMITHING_FORCE_META_THRESHOLD_MEDIUM = 3;
const WORDSMITHING_FORCE_META_THRESHOLD_LOW = 4;

// Thresholds for Radical Refinement Kickstart
const RADICAL_REFINEMENT_WORDSMITHING_THRESHOLD = 3; 
const RADICAL_REFINEMENT_LOW_VALUE_THRESHOLD = 4; 

const FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD_HIGH = 2;
const FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD_MEDIUM = 2;
const FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD_LOW = 3;

const FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT = 0.985;
const FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT = 1;
const FORCED_CONVERGENCE_CHAR_DELTA_STRICT = 50;
const FORCED_CONVERGENCE_MAX_NUDGES = 3;

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


const calculateQualitativeStatesForStrategist = (
    currentProduct: string | null,
    stagnationInfo: StagnationInfo,
    inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX'
): Pick<StrategistLLMContext, 'productDevelopmentState' | 'stagnationSeverity' | 'recentIterationPerformance'> => {
    const currentProductLength = currentProduct?.length || 0;
    const { 
        consecutiveLowValueIterations, 
        consecutiveIdenticalProductIterations, 
        consecutiveStagnantIterations,
        consecutiveWordsmithingIterations,
        isStagnant
    } = stagnationInfo;

    let productDevelopmentState: StrategistLLMContext['productDevelopmentState'] = 'UNKNOWN';
    if ((consecutiveLowValueIterations >= 2 || (consecutiveWordsmithingIterations || 0) >= 2) && currentProductLength < MIN_CHARS_FOR_DEVELOPED_PRODUCT) {
        productDevelopmentState = 'NEEDS_EXPANSION_STALLED';
    } else if (currentProductLength < MIN_CHARS_SHORT_PRODUCT_THRESHOLD && (inputComplexity !== 'SIMPLE' || (stagnationInfo.lastMeaningfulChangeProductLength && currentProductLength < stagnationInfo.lastMeaningfulChangeProductLength * 0.7))) {
        productDevelopmentState = 'UNDERDEVELOPED_KERNEL';
    } else if (currentProductLength > MIN_CHARS_MATURE_PRODUCT_THRESHOLD) {
        productDevelopmentState = 'MATURE_PRODUCT';
    } else {
        productDevelopmentState = 'DEVELOPED_DRAFT';
    }

    let stagnationSeverity: StrategistLLMContext['stagnationSeverity'] = 'NONE';
    const identThreshold = 2; 
    const lowValueThresholdSevere = 3;
    const stagnantThresholdSevere = 3; 
    const wordsmithingThresholdSevere = 2; 

    if (consecutiveIdenticalProductIterations >= identThreshold || (consecutiveWordsmithingIterations || 0) >= wordsmithingThresholdSevere + 1) {
        stagnationSeverity = 'CRITICAL';
    } else if (consecutiveLowValueIterations >= lowValueThresholdSevere || consecutiveStagnantIterations >= stagnantThresholdSevere || (consecutiveWordsmithingIterations || 0) >= wordsmithingThresholdSevere) {
        stagnationSeverity = 'SEVERE';
    } else if (consecutiveLowValueIterations >= 1 || consecutiveStagnantIterations >= 1 || (consecutiveWordsmithingIterations || 0) >= 1) {
        stagnationSeverity = 'MODERATE';
    } else if (isStagnant) {
        stagnationSeverity = 'MILD';
    }

    let recentIterationPerformance: StrategistLLMContext['recentIterationPerformance'] = 'PRODUCTIVE';
    if (consecutiveIdenticalProductIterations > 0 || (consecutiveWordsmithingIterations || 0) > 0) {
        recentIterationPerformance = 'STALLED';
    } else if (consecutiveLowValueIterations > 0) {
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
    similarityWithPreviousLogged?: number,
    isStagnantIterationLogged?: boolean,
    isEffectivelyIdenticalLogged?: boolean,
    isLowValueIterationLogged?: boolean
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
      similarityWithPreviousLogged,
      isStagnantIterationLogged,
      isEffectivelyIdenticalLogged,
      isLowValueIterationLogged
    });
  }, [addLogEntryFromHook, processState.isPlanActive, processState.currentPlanStageIndex, processState.planStages]);

  const handleProcessHalt = (currentIterForHalt: number, currentProdForHalt: string | null, haltMessage: string, apiResultForHalt?: IterateProductResult, currentEntryTypeForHalt: IterationEntryType = 'ai_iteration') => {
    isProcessingRef.current = false;
    haltSignalRef.current = true;
    updateProcessState({
        isProcessing: false,
        statusMessage: haltMessage,
        currentProductBeforeHalt: currentStreamBufferRef.current || currentProdForHalt,
        currentIterationBeforeHalt: currentIterForHalt,
        finalProduct: processState.finalProduct || ((currentStreamBufferRef.current || currentProdForHalt || "").startsWith(CONVERGED_PREFIX) ? null : (currentStreamBufferRef.current || currentProdForHalt)),
    });
    logIterationData(currentIterForHalt, currentEntryTypeForHalt, currentStreamBufferRef.current || currentProdForHalt, haltMessage, currentProdForHalt, apiResultForHalt, processState.currentAppliedModelConfig || undefined, undefined, undefined, undefined, undefined, undefined, processState.aiProcessInsight, processState.currentModelForIteration, processState.activeMetaInstructionForNextIter);
    performAutoSave();
  };

  const handleHalt = () => {
    haltSignalRef.current = true;
  };

  const onStreamChunk = (chunkText: string) => {
    if (haltSignalRef.current) return;
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
    let thresholdMeta  = BASE_THRESHOLD_META_INSTRUCT;

    let identicalThresholdForMeta = aggressiveness === 'HIGH' ? 1 : (aggressiveness === 'MEDIUM' ? 2 : 3);
    let lowValueThresholdForMeta = aggressiveness === 'HIGH' ? 2 : (aggressiveness === 'MEDIUM' ? 3 : 4);
    
    let wordsmithingForceMetaThreshold = WORDSMITHING_FORCE_META_THRESHOLD_MEDIUM;
    if (aggressiveness === 'HIGH') wordsmithingForceMetaThreshold = WORDSMITHING_FORCE_META_THRESHOLD_HIGH;
    else if (aggressiveness === 'LOW') wordsmithingForceMetaThreshold = WORDSMITHING_FORCE_META_THRESHOLD_LOW;

    if (aggressiveness === 'LOW') {
        thresholdLight = 2; thresholdHeavy = 3; thresholdMeta  = 4;
        identicalThresholdForMeta = 3; lowValueThresholdForMeta = 4;
    } else if (aggressiveness === 'HIGH') {
        thresholdLight = 1; thresholdHeavy = 1; thresholdMeta  = 2;
        identicalThresholdForMeta = 1; lowValueThresholdForMeta = 2;
    }

    thresholdHeavy = Math.max(thresholdLight, thresholdHeavy);
    thresholdMeta = Math.max(thresholdHeavy, thresholdMeta);
    
    if ((stagnationInfo.consecutiveWordsmithingIterations || 0) >= wordsmithingForceMetaThreshold) return 'meta_instruct';
    if (isStuckOnMaxTokens && stagnationInfo.consecutiveLowValueIterations >= (aggressiveness === 'LOW' ? 2 : 1)) return 'meta_instruct';
    if (stagnationInfo.consecutiveIdenticalProductIterations >= identicalThresholdForMeta) return 'meta_instruct';
    if (stagnationInfo.consecutiveLowValueIterations >= lowValueThresholdForMeta && stagnationInfo.consecutiveStagnantIterations > 0) return 'meta_instruct';
    if (stagnationInfo.consecutiveLowValueIterations >= (lowValueThresholdForMeta + (aggressiveness === 'LOW' ? 1 : 0) )) return 'meta_instruct';
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
    metaInstructNudgeCountRef.current = 0;
    
    const maxIterationsOverall = processState.maxIterations;
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
        inputComplexity: processState.inputComplexity, initialPrompt: processState.initialPrompt, loadedFiles: processState.loadedFiles, selectedModelName: processState.selectedModelName, strategistInfluenceLevel: processState.strategistInfluenceLevel, stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
    };
    let iterationStrategy: ModelStrategy = determineInitialStrategy(initialStrategyState, userBaseConfig);
    
    // Manage stagnation info within the scope of a single process run
    let currentStagnationInfo: StagnationInfo = { ...(processState.stagnationInfo) };
    if (currentIter === 0) {
        currentStagnationInfo = { isStagnant: false, consecutiveStagnantIterations: 0, consecutiveIdenticalProductIterations: 0, nudgeStrategyApplied: 'none', consecutiveLowValueIterations: 0, consecutiveWordsmithingIterations: 0 };
    }

    updateProcessState({
      isProcessing: true, finalProduct: null, statusMessage: options?.isTargetedRefinement ? "Starting targeted section refinement..." : "Starting process...",
      aiProcessInsight: options?.isTargetedRefinement ? "Initializing strategy for targeted refinement..." : `Strategy for Iteration 1: ${iterationStrategy.rationale}`,
      currentProductBeforeHalt: null, currentIterationBeforeHalt: undefined, currentModelForIteration: iterationStrategy.modelName,
      currentAppliedModelConfig: iterationStrategy.config, activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
      stagnationInfo: currentStagnationInfo, 
    });

    // --- FOUNDATION STAGE ---
    if (currentIter === 0 && !options?.isTargetedRefinement && processState.loadedFiles.length > 0) {
        // Step 1: Generate Outline
        updateProcessState({ statusMessage: "Foundation Stage: Generating document outline..." });
        
        const contextualizerPromptForOutline = `Generate initial outline and identify redundancies from loaded files. Project goal: ${processState.initialPrompt}`;
        const devLogContextForOutline = await getRelevantDevLogContext(processState.devLog || [], contextualizerPromptForOutline);

        const outlineResult = await GeminaiService.generateInitialOutline(
            processState.initialPrompt, processState.loadedFiles, iterationStrategy.config, iterationStrategy.modelName, devLogContextForOutline
        );
        
        if (outlineResult.errorMessage || !outlineResult.outline.trim()) {
            handleProcessHalt(0, null, `Process Halted: Failed to generate document outline. Error: ${outlineResult.errorMessage || "AI returned empty outline."}`, { product: "", status: 'ERROR', errorMessage: outlineResult.errorMessage }, 'initial_state');
            return;
        }

        const { segments, documentTitle } = parseOutlineToSegments(outlineResult.outline);
        let synthesizedSegments: string[] = [];

        // Step 2: Segmented Synthesis
        for (let i = 0; i < segments.length; i++) {
            if (haltSignalRef.current) { handleProcessHalt(0, null, "Process halted by user during segmented synthesis."); return; }
            const segment = segments[i];
            updateProcessState({ statusMessage: `Foundation Stage (Segmented Iteration 1 (${i + 1}/${segments.length})): Synthesizing "${segment.title}"...` });
            currentStreamBufferRef.current = "";
            
            const contextualizerPromptForSegment = `Synthesize content for outline segment: "${segment.title}".`;
            const devLogContextForSegment = await getRelevantDevLogContext(processState.devLog || [], contextualizerPromptForSegment);

            const segmentResult = await GeminaiService.iterateProduct({
                currentProduct: "",
                currentIterationOverall: 0,
                maxIterationsOverall: maxIterationsOverall,
                fileManifest: processState.initialPrompt,
                loadedFiles: processState.loadedFiles,
                activePlanStage: null,
                outputParagraphShowHeadings: processState.outputParagraphShowHeadings,
                outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth,
                outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
                modelConfigToUse: iterationStrategy.config,
                isGlobalMode: true,
                modelToUse: iterationStrategy.modelName,
                onStreamChunk,
                isHaltSignalled: () => haltSignalRef.current,
                operationType: "segment_synthesis",
                currentSegmentOutlineText: `#${'#'.repeat(segment.level-1)} ${segment.title}\n${segment.content}`,
                fullOutlineForContext: outlineResult.outline,
                devLogContextString: devLogContextForSegment,
            });

            if (segmentResult.status === 'ERROR' || segmentResult.status === 'HALTED') {
                handleProcessHalt(0, null, `Process Halted: Error during synthesis of segment "${segment.title}". Error: ${segmentResult.errorMessage}`);
                return;
            }
            synthesizedSegments.push(segmentResult.product);
            const fileProcessingInfoForSegmentLog: FileProcessingInfo = {
                filesSentToApiIteration: 0,
                numberOfFilesActuallySent: processState.loadedFiles.length,
                totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
                fileManifestProvidedCharacterCount: processState.initialPrompt.length,
                loadedFilesForIterationContext: processState.loadedFiles
            };
            logIterationData(1, 'segmented_synthesis_milestone', segmentResult.product, `Completed Synthesis for Segment "${segment.title}"`, null, segmentResult, iterationStrategy.config, fileProcessingInfoForSegmentLog, undefined, segmentResult.product.length, segmentResult.product.length, 1, `Segment ${i+1}/${segments.length}`, iterationStrategy.modelName);
        }

        // Step 3: Assemble and Quality Gate
        let assembledProduct = (documentTitle ? `# ${documentTitle}\n\n` : "") + synthesizedSegments.join('\n\n');
        
        const fileProcessingInfoForLog: FileProcessingInfo = {
            filesSentToApiIteration: 0, // Placeholder, as files were sent for outline and segments
            numberOfFilesActuallySent: processState.loadedFiles.length,
            totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
            fileManifestProvidedCharacterCount: processState.initialPrompt.length,
            loadedFilesForIterationContext: processState.loadedFiles
        };

        const qualityGateResult = isDataDump(assembledProduct, fileProcessingInfoForLog, true);
        if (qualityGateResult.isError) {
             handleProcessHalt(0, assembledProduct, `Process Halted: Initial synthesis failed quality validation (likely data dump). Reason: ${qualityGateResult.reason}`, { product: assembledProduct, status: 'ERROR', errorMessage: qualityGateResult.reason }, 'initial_state');
             return;
        }

        currentProd = assembledProduct;
        updateProcessState({ currentProduct: currentProd, statusMessage: "Foundation Stage: Initial document synthesis complete. Proceeding to refinement." });
        logIterationData(0, 'initial_state', currentProd, "Initial synthesis complete (Segmented)", "", undefined, iterationStrategy.config, fileProcessingInfoForLog);

    } else if (currentIter === 0 && !options?.isTargetedRefinement && (currentProd === null || currentProd.trim() === "")) {
      // Logic for Iteration 0 if NOT file-based (i.e., from prompt only)
      logIterationData(0, 'initial_state', processState.initialPrompt, "Initial State from Prompt", "");
      currentProd = processState.initialPrompt;
      updateProcessState({ currentProduct: currentProd });
    }

    let consecutiveIdenticalProductIterations = currentStagnationInfo.consecutiveIdenticalProductIterations;
    let consecutiveWordsmithingIterations = currentStagnationInfo.consecutiveWordsmithingIterations || 0;

    while (true) {
      if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user."); return; }
      let apiResultForLog: IterateProductResult | undefined = undefined;
      let currentEntryType: IterationEntryType = options?.isTargetedRefinement ? 'targeted_refinement' : 'ai_iteration';
      let previousProductSnapshot: string | null = currentProd;
      let fileProcessingInfoForApi: FileProcessingInfo | undefined = undefined;
      let iterationAttemptCount: number = 0;
      let isCurrentIterationCriticalFailure = false;
      let radicalRefinementKickstartNeeded = false;
      let validationResult: IsLikelyAiErrorResponseResult | undefined;
      let retryContext: RetryContext | undefined;
      let currentLogIncomplete;

      currentIter++;
      if (currentIter > maxIterationsOverall && !processState.isPlanActive) {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Reached max iterations (${maxIterationsOverall}). Global process complete.`, configAtFinalization: iterationStrategy.config, aiProcessInsight: `Global Mode: Max iterations reached. Final product displayed.` });
        isProcessingRef.current = false; await performAutoSave(); return;
      }
      if (processState.isPlanActive) { /* ... plan logic ... */ }

      currentStreamBufferRef.current = "";
      
      const kickstartWordsmithingThreshold = RADICAL_REFINEMENT_WORDSMITHING_THRESHOLD + (processState.stagnationNudgeAggressiveness === 'LOW' ? 1 : 0) - (processState.stagnationNudgeAggressiveness === 'HIGH' ? 1 : 0);
      
      if (!processState.isPlanActive && processState.stagnationNudgeEnabled && (currentStagnationInfo.consecutiveWordsmithingIterations || 0) >= kickstartWordsmithingThreshold && currentStagnationInfo.nudgeStrategyApplied === 'meta_instruct') {
        radicalRefinementKickstartNeeded = true;
      }

      let activeMetaInstructionForThisIteration: string | undefined = processState.activeMetaInstructionForNextIter;
      if (currentStagnationInfo.nudgeStrategyApplied === 'meta_instruct' && (currentStagnationInfo.consecutiveWordsmithingIterations || 0) >= kickstartWordsmithingThreshold && !processState.activeMetaInstructionForNextIter && !radicalRefinementKickstartNeeded) {
        let baseMeta = `CRITICAL STAGNATION (WORDSMITHING DETECTED for ${currentStagnationInfo.consecutiveWordsmithingIterations} iters): Previous iteration(s) produced almost no meaningful change. For THIS iteration, you MUST make a SUBSTANTIAL and QUALITATIVELY DIFFERENT change.`;
        if (metaInstructNudgeCountRef.current >= 1) baseMeta += ` Previous meta-instruction to break wordsmithing was insufficient. This attempt MUST be even bolder.`;
        activeMetaInstructionForThisIteration = `${baseMeta} EITHER: 1) Add AT LEAST one completely new sentence introducing a novel concept or example relevant to the topic. 2) Radically rephrase the core argument or conclusion of the LAST major section. OR 3) Delete a demonstrably redundant sentence/phrase and replace it with a distinct, insightful point. Minor wording adjustments or reordering of existing ideas are NOT acceptable. If truly no substantive change can be made, declare convergence.`;
        metaInstructNudgeCountRef.current += 1;
      } else {
        metaInstructNudgeCountRef.current = 0;
      }

      const devLogContextPrompt = options?.isTargetedRefinement
        ? `Refine selected text with these instructions: "${options.targetedInstructions}"`
        : `Continue developing product based on this initial prompt/goal: "${processState.initialPrompt}"`;

      const devLogContextString = await getRelevantDevLogContext(processState.devLog || [], devLogContextPrompt);

      
      
      for (iterationAttemptCount = 0; iterationAttemptCount <= SELF_CORRECTION_MAX_ATTEMPTS; iterationAttemptCount++) {
        if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user."); return; }
        const activePlanStageForCall = processState.isPlanActive && currentPlanStageIdx !== null ? processState.planStages[currentPlanStageIdx] : null;

        const { productDevelopmentState, stagnationSeverity, recentIterationPerformance } = calculateQualitativeStatesForStrategist(currentProd, currentStagnationInfo, processState.inputComplexity);
        
        let currentRefinementFocusHint = "General Refinement"; //... (focus hint logic)

        iterationStrategy = await reevaluateStrategy({
            ...processState,
            currentIteration: currentIter - 1, currentProduct: currentProd,
            stagnationInfo: currentStagnationInfo,
            activeMetaInstructionForNextIter: activeMetaInstructionForThisIteration,
            productDevelopmentState, stagnationSeverity, recentIterationPerformance,
            isRadicalRefinementKickstartAttempt: radicalRefinementKickstartNeeded,
        }, userBaseConfig);
        
        updateProcessState({
            aiProcessInsight: iterationStrategy.rationale,
            currentModelForIteration: iterationStrategy.modelName,
            currentAppliedModelConfig: iterationStrategy.config,
            activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
        });

        apiResultForLog = await GeminaiService.iterateProduct({
            currentProduct: currentProd || "",
            currentIterationOverall: currentIter,
            maxIterationsOverall: maxIterationsOverall,
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
            retryContext,
            stagnationNudgeStrategy: currentStagnationInfo.nudgeStrategyApplied,
            initialOutlineForIter1: undefined,
            activeMetaInstruction: activeMetaInstructionForThisIteration,
            devLogContextString: devLogContextString,
            isTargetedRefinementMode: options?.isTargetedRefinement,
            targetedSelectionText: options?.targetedSelection,
            targetedRefinementInstructions: options?.targetedInstructions,
            isRadicalRefinementKickstart: radicalRefinementKickstartNeeded,
        });

        if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user.", apiResultForLog); return; }
        if (apiResultForLog.isRateLimitError) {
          handleRateLimitErrorEncountered();
          updateProcessState({ statusMessage: `API Rate Limit Hit. Process halted. ${apiResultForLog.errorMessage || ''}`});
          handleProcessHalt(currentIter, currentProd, 'Process Halted (API Rate Limit)', apiResultForLog);
          break;
        }

        const newProductCandidate = currentStreamBufferRef.current || "";
        currentLogIncomplete = {
            iteration: currentIter,
            fileProcessingInfo: {
                filesSentToApiIteration: null,
                numberOfFilesActuallySent: 0,
                totalFilesSizeBytesSent: 0,
                fileManifestProvidedCharacterCount: processState.initialPrompt.length,
                loadedFilesForIterationContext: []
            },
            apiStreamDetails: apiResultForLog.apiStreamDetails,
        };
        
        validationResult = isLikelyAiErrorResponse(
          newProductCandidate,
          previousProductSnapshot || "",
          currentLogIncomplete as any,
          undefined,
          activePlanStageForCall?.length,
          activePlanStageForCall?.format,
          processState.inputComplexity
        );
        
        isCurrentIterationCriticalFailure = validationResult.isCriticalFailure || false;

        if (!validationResult.isError || isCurrentIterationCriticalFailure) {
            break; 
        }

        currentStreamBufferRef.current = "";
        updateProcessState({ currentProduct: previousProductSnapshot });
        
        const { coreUserInstructions } = getUserPromptComponents(
            currentIter, maxIterationsOverall, activePlanStageForCall,
            processState.outputParagraphShowHeadings, processState.outputParagraphMaxHeadingDepth, processState.outputParagraphNumberedHeadings,
            !processState.isPlanActive,
            false,
            undefined, 
            currentStagnationInfo.nudgeStrategyApplied,
            undefined,
            processState.loadedFiles,
            activeMetaInstructionForThisIteration,
            false, undefined, undefined,
            options?.isTargetedRefinement,
            options?.targetedSelection,
            options?.targetedInstructions,
            radicalRefinementKickstartNeeded
        );
        
        retryContext = {
            previousErrorReason: validationResult.reason || 'Unknown validation error.',
            originalCoreInstructions: coreUserInstructions
        };
        
        const aiValidationInfoForLog: AiResponseValidationInfo = {
            checkName: "isLikelyAiErrorResponse_RetryAttempt",
            passed: !validationResult.isError,
            isCriticalFailure: validationResult.isCriticalFailure,
            reason: validationResult.reason,
            details: validationResult.checkDetails,
        };

        logIterationData(currentIter, 'ai_iteration', newProductCandidate, `Attempt ${iterationAttemptCount + 1} failed validation: ${validationResult.reason}. Retrying...`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, currentLogIncomplete.fileProcessingInfo, aiValidationInfoForLog, newProductCandidate.length, newProductCandidate.length, iterationAttemptCount + 1, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
      }
      
      if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user.", apiResultForLog); return; }
      if (apiResultForLog && apiResultForLog.isRateLimitError) break;
      if (!apiResultForLog) {
          handleProcessHalt(currentIter, currentProd, "Process halted due to unexpected error before API call completion.");
          return;
      }

      let finalProductForIter = apiResultForLog.product.startsWith(CONVERGED_PREFIX) ? apiResultForLog.product.substring(CONVERGED_PREFIX.length) : apiResultForLog.product;
      currentProd = finalProductForIter;
      
      const charDelta = currentProd.length - (previousProductSnapshot || "").length;
      const netLineChange = currentProd.split('\n').length - (previousProductSnapshot || "").split('\n').length;
      const similarity = calculateJaccardSimilarity(previousProductSnapshot, currentProd);
      
      const isEffectivelyIdentical = (Math.abs(charDelta) < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT && Math.abs(netLineChange) <= IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT);
      const isStagnantIteration = similarity > STAGNATION_SIMILARITY_THRESHOLD && (Math.abs(charDelta) < STAGNATION_MIN_CHANGE_THRESHOLD_CHARS || Math.abs(netLineChange) < STAGNATION_MIN_CHANGE_THRESHOLD_LINES);
      const charDeltaThreshForWordsmithing = similarity > WORDSMITHING_SIMILARITY_EXTREME_THRESHOLD ? WORDSMITHING_EXTREME_SIMILARITY_CHAR_DELTA_THRESHOLD : WORDSMITHING_CHAR_DELTA_THRESHOLD;
      const isWordsmithingIteration = similarity > WORDSMITHING_SIMILARITY_SEVERE_THRESHOLD && Math.abs(charDelta) < charDeltaThreshForWordsmithing && Math.abs(netLineChange) <= WORDSMITHING_LINE_CHANGE_THRESHOLD;
      const isLowValueIteration = isEffectivelyIdentical || isWordsmithingIteration || (isStagnantIteration && (Math.abs(charDelta) < IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT || Math.abs(netLineChange) <= IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT));
      
      consecutiveIdenticalProductIterations = isEffectivelyIdentical ? (consecutiveIdenticalProductIterations + 1) : 0;
      consecutiveWordsmithingIterations = isWordsmithingIteration ? (consecutiveWordsmithingIterations + 1) : 0;

      const newStagnationInfo: StagnationInfo = {
          isStagnant: isStagnantIteration,
          consecutiveStagnantIterations: isStagnantIteration ? (currentStagnationInfo.consecutiveStagnantIterations || 0) + 1 : 0,
          consecutiveIdenticalProductIterations,
          consecutiveLowValueIterations: isLowValueIteration ? (currentStagnationInfo.consecutiveLowValueIterations || 0) + 1 : 0,
          consecutiveWordsmithingIterations,
          similarityWithPrevious: similarity, lastProductLengthForStagnation: currentProd?.length || 0,
          lastMeaningfulChangeProductLength: (isLowValueIteration && currentStagnationInfo.lastMeaningfulChangeProductLength) ? currentStagnationInfo.lastMeaningfulChangeProductLength : (currentProd?.length || 0),
          nudgeStrategyApplied: 'none'
      };
      newStagnationInfo.nudgeStrategyApplied = determineNudgeStrategyForNext(newStagnationInfo, processState.stagnationNudgeEnabled, (currentIter / maxIterationsOverall), processState.stagnationNudgeAggressiveness, apiResultForLog.isStuckOnMaxTokensContinuation);
      
      currentStagnationInfo = newStagnationInfo;

      const FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD = processState.stagnationNudgeAggressiveness === 'HIGH' ? FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD_HIGH : processState.stagnationNudgeAggressiveness === 'MEDIUM' ? FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD_MEDIUM : FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD_LOW;
      if (processState.stagnationNudgeEnabled && currentStagnationInfo.consecutiveIdenticalProductIterations >= FORCED_CONVERGENCE_ON_IDENTICAL_THRESHOLD) {
          const haltMsg = `Process Halted (Forced Convergence): System stopped after ${currentStagnationInfo.consecutiveIdenticalProductIterations} identical iterations. Product is considered stable.`;
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: haltMsg, configAtFinalization: iterationStrategy.config, aiProcessInsight: `Forced Convergence: Halted after ${currentStagnationInfo.consecutiveIdenticalProductIterations} identical outputs.` });
          isProcessingRef.current = false;
          await performAutoSave();
          return;
      }
      
      const finalValidationInfoForLog: AiResponseValidationInfo | undefined = validationResult
        ? {
            checkName: "isLikelyAiErrorResponse_Final",
            passed: !validationResult.isError,
            isCriticalFailure: validationResult.isCriticalFailure,
            reason: validationResult.reason,
            details: validationResult.checkDetails,
          }
        : undefined;

      logIterationData(
        currentIter,
        currentEntryType,
        currentProd,
        `Iteration ${currentIter} ${apiResultForLog.status}.`,
        previousProductSnapshot,
        apiResultForLog,
        iterationStrategy.config,
        fileProcessingInfoForApi,
        finalValidationInfoForLog,
        currentProd?.length,
        currentProd?.length,
        iterationAttemptCount,
        iterationStrategy.rationale,
        iterationStrategy.modelName,
        activeMetaInstructionForThisIteration,
        isCurrentIterationCriticalFailure,
        options?.isTargetedRefinement ? options.targetedSelection : undefined,
        options?.isTargetedRefinement ? options.targetedInstructions : undefined,
        netLineChange,
        charDelta,
        similarity,
        isStagnantIteration,
        isEffectivelyIdentical,
        isLowValueIteration
      );

      updateProcessState({ currentProduct: currentProd, currentIteration: currentIter, statusMessage: `Iteration ${currentIter} ${apiResultForLog.status}.`, stagnationInfo: currentStagnationInfo, aiProcessInsight: iterationStrategy.rationale, });
      if (iterationStrategy.activeMetaInstruction) updateProcessState({activeMetaInstructionForNextIter: undefined});

      if (apiResultForLog.status === 'CONVERGED') {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Process converged at Iteration ${currentIter}.`, configAtFinalization: iterationStrategy.config, aiProcessInsight: `Convergence declared at Iteration ${currentIter}. AI declared.` });
        isProcessingRef.current = false; await performAutoSave(); return;
      }

      await performAutoSave();
    }
  };

  return { handleStart, handleHalt };
};