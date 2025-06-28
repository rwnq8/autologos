import { useRef, useState, useCallback } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, IsLikelyAiErrorResponseResult, IterationEntryType } from '../types.ts';
import * as GeminaiService from '../services/geminiService';
import { getUserPromptComponents } from '../services/promptBuilderService';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX, MIN_CHARS_FOR_DEVELOPED_PRODUCT, isDataDump } from '../services/iterationUtils';
import { calculateFleschReadingEase, calculateJaccardSimilarity, calculateLexicalDensity, calculateAvgSentenceLength, calculateSimpleTTR } from '../services/textAnalysisService';
import { DETERMINISTIC_TARGET_ITERATION, FOCUSED_END_DEFAULTS } from '../hooks/useModelParameters';
import * as Diff from 'diff';
import type { AddLogEntryParams } from './useProcessState';
import { getRelevantDevLogContext } from '../services/devLogContextualizerService';
import { reconstructProduct } from '../services/diffService';


const SELF_CORRECTION_MAX_ATTEMPTS = 2;

const STAGNATION_SIMILARITY_THRESHOLD = 0.95;
const STAGNATION_MIN_CHANGE_THRESHOLD_CHARS = 100;
const STAGNATION_MIN_CHANGE_THRESHOLD_LINES = 5;

const IDENTICAL_PRODUCT_CHAR_THRESHOLD_STRICT = 10;
const IDENTICAL_PRODUCT_LINE_THRESHOLD_STRICT = 1;

const WORDSMITHING_SIMILARITY_SEVERE_THRESHOLD = 0.98;
const WORDSMITHING_CHAR_DELTA_THRESHOLD = 30;
const WORDSMITHING_LINE_CHANGE_THRESHOLD = 1;

const STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT = 0.85;

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
      readabilityScoreFlesch: calculateFleschReadingEase(finalProductForSummary),
      lexicalDensity: calculateLexicalDensity(finalProductForSummary), 
      avgSentenceLength: calculateAvgSentenceLength(finalProductForSummary), 
      typeTokenRatio: calculateSimpleTTR(finalProductForSummary), 
      fileProcessingInfo: fileProcessingInfoForLog || { filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0, loadedFilesForIterationContext: [] },
      promptSystemInstructionSent: apiResult?.promptSystemInstructionSent,
      promptCoreUserInstructionsSent: apiResult?.promptCoreUserInstructionsSent,
      promptFullUserPromptSent: apiResult?.promptFullUserPromptSent,
      apiStreamDetails: apiResult?.apiStreamDetails,
      modelConfigUsed: modelConfigUsed,
      aiValidationInfo: aiValidationInfo,
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
    const fileInfo = { filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0 };
    logIterationData(currentIterForHalt, currentEntryTypeForHalt, currentStreamBufferRef.current || currentProdForHalt, haltMessage, currentProdForHalt, apiResultForHalt, processState.currentAppliedModelConfig || undefined, fileInfo, undefined, undefined, undefined, undefined, processState.aiProcessInsight, processState.currentModelForIteration, processState.activeMetaInstructionForNextIter);
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
    
    let currentStagnationInfo: StagnationInfo = { ...(processState.stagnationInfo) };
    if (currentIter === 0) {
        currentStagnationInfo = { isStagnant: false, consecutiveStagnantIterations: 0, consecutiveIdenticalProductIterations: 0, nudgeStrategyApplied: 'none', consecutiveLowValueIterations: 0, consecutiveWordsmithingIterations: 0 };
    }

    updateProcessState({
      isProcessing: true, finalProduct: null, statusMessage: options?.isTargetedRefinement ? "Starting targeted section refinement..." : "Starting process...",
      aiProcessInsight: options?.isTargetedRefinement ? "Initializing for targeted refinement..." : `Initializing...`,
      currentProductBeforeHalt: null, currentIterationBeforeHalt: undefined, currentModelForIteration: processState.selectedModelName,
      currentAppliedModelConfig: userBaseConfig,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
      stagnationInfo: currentStagnationInfo, 
    });

    if (currentIter === 0 && !options?.isTargetedRefinement && (currentProd === null || currentProd.trim() === "")) {
      let initialProductForStateAndLog: string;
      let statusForLog: string;
      
      if (processState.loadedFiles.length > 0) {
        // Concatenate file contents with a separator for clarity
        initialProductForStateAndLog = processState.loadedFiles.map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n');
        statusForLog = "Initial State from Loaded Files";
      } else {
        initialProductForStateAndLog = processState.initialPrompt;
        statusForLog = "Initial State from Prompt Text";
      }

      const fileInfo = {
        filesSentToApiIteration: null, // No API call for initial state
        numberOfFilesActuallySent: processState.loadedFiles.length,
        totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
        fileManifestProvidedCharacterCount: processState.initialPrompt.length,
        loadedFilesForIterationContext: processState.loadedFiles,
      };

      // Log this true initial state. previousProductForLog is "" to generate the initial diff.
      logIterationData(
        0, 
        'initial_state', 
        initialProductForStateAndLog, 
        statusForLog, 
        "", 
        undefined, 
        undefined, 
        fileInfo
      );
      
      currentProd = initialProductForStateAndLog;
      // Immediately update the state so the rest of the loop and UI has the correct product and iteration number.
      updateProcessState({ currentProduct: currentProd, currentIteration: 0 });
    }

    while (true) {
      if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user."); return; }
      let apiResultForLog: IterateProductResult | undefined = undefined;
      let currentEntryType: IterationEntryType = options?.isTargetedRefinement ? 'targeted_refinement' : 'ai_iteration';
      let previousProductSnapshot: string | null = currentProd;
      let fileProcessingInfoForApi: FileProcessingInfo | undefined = undefined;
      let iterationAttemptCount: number = 0;
      let isCurrentIterationCriticalFailure = false;
      let validationResult: IsLikelyAiErrorResponseResult | undefined;
      let retryContext: RetryContext | undefined;
      let currentLogIncomplete: IterationLogEntry;
      let activeMetaInstruction: string | undefined = undefined;

      currentIter++;
      if (currentIter > maxIterationsOverall && !processState.isPlanActive) {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Reached max iterations (${maxIterationsOverall}). Global process complete.`, configAtFinalization: userBaseConfig, aiProcessInsight: `Global Mode: Max iterations reached. Final product displayed.` });
        isProcessingRef.current = false; await performAutoSave(); return;
      }
      if (processState.isPlanActive) { /* ... plan logic ... */ }

      currentStreamBufferRef.current = "";
      
      const devLogContextPrompt = options?.isTargetedRefinement
        ? `Refine selected text with these instructions: "${options.targetedInstructions}"`
        : `Continue developing product based on this initial prompt/goal: "${processState.initialPrompt}"`;

      const devLogContextString = await getRelevantDevLogContext(processState.devLog || [], devLogContextPrompt);

      // Simplified strategy logic
      const rationales: string[] = [];
      let nextConfig = { ...userBaseConfig };
      if (!processState.isPlanActive) {
        const interpolationFactor = Math.min(1.0, currentIter / DETERMINISTIC_TARGET_ITERATION);
        nextConfig.temperature = userBaseConfig.temperature - interpolationFactor * (userBaseConfig.temperature - FOCUSED_END_DEFAULTS.temperature);
        nextConfig.topP = userBaseConfig.topP - interpolationFactor * (userBaseConfig.topP - FOCUSED_END_DEFAULTS.topP);
        nextConfig.topK = Math.max(1, Math.round(userBaseConfig.topK - interpolationFactor * (userBaseConfig.topK - FOCUSED_END_DEFAULTS.topK)));
        rationales.push(`Heuristic Sweep: Iter ${currentIter}/${maxIterationsOverall}.`);
      } else {
        rationales.push("Plan Mode: Using fixed user-defined parameters.");
      }

      // Simple stagnation nudge
      if (currentStagnationInfo.consecutiveStagnantIterations >= 2 && processState.stagnationNudgeEnabled) {
          nextConfig.temperature = Math.min(2.0, nextConfig.temperature + 0.1);
          activeMetaInstruction = "Previous iteration was stagnant. Please make a more significant and creative change.";
          rationales.push("Heuristic Nudge: Stagnation detected, increasing temperature and adding meta-instruction.");
      }

      updateProcessState({
          aiProcessInsight: rationales.join(' | '),
          currentModelForIteration: processState.selectedModelName,
          currentAppliedModelConfig: nextConfig,
          activeMetaInstructionForNextIter: activeMetaInstruction,
      });

      for (iterationAttemptCount = 0; iterationAttemptCount <= SELF_CORRECTION_MAX_ATTEMPTS; iterationAttemptCount++) {
        if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user."); return; }
        const activePlanStageForCall = processState.isPlanActive && currentPlanStageIdx !== null ? processState.planStages[currentPlanStageIdx] : null;
        
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
            modelConfigToUse: nextConfig,
            isGlobalMode: !processState.isPlanActive,
            modelToUse: processState.selectedModelName,
            onStreamChunk,
            isHaltSignalled: () => haltSignalRef.current,
            retryContext,
            activeMetaInstruction: activeMetaInstruction,
            devLogContextString: devLogContextString,
            isTargetedRefinementMode: options?.isTargetedRefinement,
            targetedSelectionText: options?.targetedSelection,
            targetedRefinementInstructions: options?.targetedInstructions
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
            entryType: 'ai_iteration',
            productSummary: getProductSummary(newProductCandidate),
            status: 'Validating...',
            timestamp: Date.now(),
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
          currentLogIncomplete,
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
            !processState.isPlanActive, false, undefined, undefined, undefined, processState.loadedFiles,
            activeMetaInstruction, false, undefined, undefined,
            options?.isTargetedRefinement, options?.targetedSelection, options?.targetedInstructions, false
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

        logIterationData(currentIter, 'ai_iteration', newProductCandidate, `Attempt ${iterationAttemptCount + 1} failed validation: ${validationResult.reason}. Retrying...`, previousProductSnapshot, apiResultForLog, nextConfig, currentLogIncomplete.fileProcessingInfo, aiValidationInfoForLog, newProductCandidate.length, newProductCandidate.length, iterationAttemptCount + 1, rationales.join(' | '), processState.selectedModelName, activeMetaInstruction);
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
      const isWordsmithingIteration = similarity > WORDSMITHING_SIMILARITY_SEVERE_THRESHOLD && Math.abs(charDelta) < WORDSMITHING_CHAR_DELTA_THRESHOLD && Math.abs(netLineChange) <= WORDSMITHING_LINE_CHANGE_THRESHOLD;
      const isLowValueIteration = isEffectivelyIdentical || isWordsmithingIteration;
      
      const newStagnationInfo: StagnationInfo = {
          isStagnant: isStagnantIteration,
          consecutiveStagnantIterations: isStagnantIteration ? (currentStagnationInfo.consecutiveStagnantIterations || 0) + 1 : 0,
          consecutiveIdenticalProductIterations: isEffectivelyIdentical ? (currentStagnationInfo.consecutiveIdenticalProductIterations + 1) : 0,
          consecutiveLowValueIterations: isLowValueIteration ? (currentStagnationInfo.consecutiveLowValueIterations || 0) + 1 : 0,
          consecutiveWordsmithingIterations: isWordsmithingIteration ? ((currentStagnationInfo.consecutiveWordsmithingIterations || 0) + 1) : 0,
          similarityWithPrevious: similarity, 
          lastProductLengthForStagnation: currentProd?.length || 0,
          lastMeaningfulChangeProductLength: (isLowValueIteration && currentStagnationInfo.lastMeaningfulChangeProductLength) ? currentStagnationInfo.lastMeaningfulChangeProductLength : (currentProd?.length || 0),
          nudgeStrategyApplied: 'none' // Nudge is determined and applied at start of loop now
      };
      
      currentStagnationInfo = newStagnationInfo;
      
      const finalValidationInfoForLog: AiResponseValidationInfo | undefined = validationResult
        ? { checkName: "isLikelyAiErrorResponse_Final", passed: !validationResult.isError, isCriticalFailure: validationResult.isCriticalFailure, reason: validationResult.reason, details: validationResult.checkDetails } : undefined;

      logIterationData(
        currentIter, currentEntryType, currentProd, `Iteration ${currentIter} ${apiResultForLog.status}.`, previousProductSnapshot,
        apiResultForLog, nextConfig, fileProcessingInfoForApi, finalValidationInfoForLog, currentProd?.length,
        currentProd?.length, iterationAttemptCount, rationales.join(' | '), processState.selectedModelName,
        activeMetaInstruction, isCurrentIterationCriticalFailure,
        options?.isTargetedRefinement ? options.targetedSelection : undefined, options?.isTargetedRefinement ? options.targetedInstructions : undefined,
        netLineChange, charDelta, similarity, isStagnantIteration, isEffectivelyIdentical, isLowValueIteration
      );

      updateProcessState({ currentProduct: currentProd, currentIteration: currentIter, statusMessage: `Iteration ${currentIter} ${apiResultForLog.status}.`, stagnationInfo: currentStagnationInfo });
      
      if (apiResultForLog.status === 'CONVERGED') {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Process converged at Iteration ${currentIter}.`, configAtFinalization: nextConfig, aiProcessInsight: `Convergence declared at Iteration ${currentIter}. AI declared.` });
        isProcessingRef.current = false; await performAutoSave(); return;
      }

      await performAutoSave();
    }
  };

  return { handleStart, handleHalt };
};
