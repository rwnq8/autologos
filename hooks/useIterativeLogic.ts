

import { useRef, useState, useCallback }
from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, IsLikelyAiErrorResponseResult, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, ModelStrategy } from '../types.ts';
import * as GeminaiService from '../services/geminiService';
import { determineInitialStrategy, reevaluateStrategy } from '../services/ModelStrategyService';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX } from '../services/iterationUtils';
import { calculateFleschReadingEase, calculateJaccardSimilarity } from '../services/textAnalysisService';

const SELF_CORRECTION_MAX_ATTEMPTS = 2;

// Base thresholds for nudge strategy determination
const BASE_THRESHOLD_PARAMS_LIGHT = 1; 
const BASE_THRESHOLD_PARAMS_HEAVY = 2; 
const BASE_THRESHOLD_META_INSTRUCT = 3;

const STAGNATION_SIMILARITY_THRESHOLD = 0.95; // If Jaccard > this, it's considered similar
const STAGNATION_MIN_CHANGE_THRESHOLD = 5; // If net lines added/removed < this, considered low change

const STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT = 0.85; 

const USE_MULTI_STAGE_INITIAL_SYNTHESIS = true;
const STAGED_SYNTHESIS_INPUT_THRESHOLD_BYTES = 200 * 1024; // 200KB

export const useIterativeLogic = (
  processState: ProcessState,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  addLogEntryFromHook: (logData: {
    iteration: number;
    currentFullProduct: string | null;
    status: string;
    previousFullProduct?: string | null;
    promptSystemInstructionSent?: string;
    promptCoreUserInstructionsSent?: string;
    promptFullUserPromptSent?: string;
    apiStreamDetails?: ApiStreamCallDetail[];
    modelConfigUsed?: ModelConfig;
    readabilityScoreFlesch?: number;
    fileProcessingInfo: FileProcessingInfo;
    aiValidationInfo?: AiResponseValidationInfo;
    directAiResponseHead?: string;
    directAiResponseTail?: string;
    directAiResponseLengthChars?: number;
    processedProductHead?: string;
    processedProductTail?: string;
    processedProductLengthChars?: number;
    attemptCount?: number;
    strategyRationale?: string;
    currentModelForIteration?: SelectableModelName;
    activeMetaInstruction?: string;
  }) => void,
  getUserSetBaseConfig: () => ModelConfig,
  performAutoSave: () => Promise<void>,
  handleRateLimitErrorEncountered: () => void,
) => {
  const isProcessingRef = useRef(false);
  const haltSignalRef = useRef(false);
  const currentStreamBufferRef = useRef("");

  const logIterationData = useCallback((
    iterationNumber: number,
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
    activeMetaInstruction?: string
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
      currentFullProduct: finalProductForSummary,
      status: statusMessage,
      previousFullProduct: previousProductForLog,
      promptSystemInstructionSent: apiResult?.promptSystemInstructionSent,
      promptCoreUserInstructionsSent: apiResult?.promptCoreUserInstructionsSent,
      promptFullUserPromptSent: apiResult?.promptFullUserPromptSent,
      apiStreamDetails: apiResult?.apiStreamDetails,
      modelConfigUsed: modelConfigUsed,
      readabilityScoreFlesch: calculateFleschReadingEase(finalProductForSummary),
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
    });
  }, [addLogEntryFromHook, processState.isPlanActive, processState.currentPlanStageIndex, processState.planStages]);


  const handleHalt = () => {
    haltSignalRef.current = true;
    isProcessingRef.current = false; // Ensure this is set immediately
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
        thresholdMeta  = 2; // Meta can trigger faster on high aggression
    }
    // Ensure thresholds are ordered logically after adjustment
    thresholdHeavy = Math.max(thresholdLight, thresholdHeavy);
    thresholdMeta = Math.max(thresholdHeavy, thresholdMeta);


    if (consecutiveStagnantIterations >= thresholdMeta) return 'meta_instruct';
    if (consecutiveStagnantIterations >= thresholdHeavy) return 'params_heavy';
    if (consecutiveStagnantIterations >= thresholdLight) return 'params_light';

    return 'none';
  };


  const handleStart = async () => {
    if (isProcessingRef.current) {
      updateProcessState({ statusMessage: "Process already running." }); return;
    }
    if (!GeminaiService.isApiKeyAvailable()) {
      updateProcessState({ statusMessage: "API Key not available. Cannot start process." }); return;
    }
    if (processState.loadedFiles.length === 0 && !processState.initialPrompt.trim()) {
      updateProcessState({ statusMessage: "No input data provided. Load files or ensure initial prompt is set." }); return;
    }

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    currentStreamBufferRef.current = "";

    let currentIter = processState.currentIterationBeforeHalt ?? processState.currentIteration;
    let currentProd = processState.currentProductBeforeHalt ?? processState.currentProduct;
    let currentPlanStageIdx = processState.currentPlanStageIndex ?? (processState.isPlanActive && processState.planStages.length > 0 ? 0 : null);
    let currentStageIterCount = processState.currentStageIteration ?? 0;
    
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
      statusMessage: "Starting process...", aiProcessInsight: "Initializing strategy for Iteration 1...",
      currentProductBeforeHalt: null, currentIterationBeforeHalt: undefined,
      currentModelForIteration: iterationStrategy.modelName,
      currentAppliedModelConfig: iterationStrategy.config,
      activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
    });

    if (currentIter === 0 && (currentProd === null || currentProd.trim() === "")) {
      const initialFileProcessingInfo: FileProcessingInfo = {
        filesSentToApiIteration: null, // No API call for Iteration 0 product itself
        numberOfFilesActuallySent: processState.loadedFiles.length,
        totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
        fileManifestProvidedCharacterCount: processState.initialPrompt.length, // Manifest length
        loadedFilesForIterationContext: processState.loadedFiles, // Provide all files for context of Iter 0
      };
      let iterZeroProduct = ""; // Default to empty if files are primary input
      if (processState.loadedFiles.length === 0 && processState.initialPrompt.trim() !== "") {
        iterZeroProduct = processState.initialPrompt; // Use direct prompt if no files
      }
      currentProd = iterZeroProduct;
      logIterationData(
        0, iterZeroProduct, "Initial state loaded.", "",
        undefined, iterationStrategy.config, // Use the initially determined config for logging
        initialFileProcessingInfo, undefined,
        iterZeroProduct.length, iterZeroProduct.length, 0,
        iterationStrategy.rationale, // Log initial strategy rationale
        iterationStrategy.modelName, // Log initial model
        iterationStrategy.activeMetaInstruction // Log initial meta instruction (likely undefined)
      );
      updateProcessState({ currentProduct: iterZeroProduct, currentIteration: 0 });
      await performAutoSave();
    }

    const maxOverallIterations = processState.maxIterations;
    let productBeforeThisFailedIteration: string | null = currentProd;


    while (true) {
      if (haltSignalRef.current) {
        updateProcessState({ isProcessing: false, statusMessage: "Process halted by user.", currentProductBeforeHalt: productBeforeThisFailedIteration, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
        break;
      }

      const isGlobalMode = !processState.isPlanActive;
      let activePlanStage: PlanStage | null = null;
      let iterationScopeMax = maxOverallIterations;

      if (processState.isPlanActive) {
        if (currentPlanStageIdx === null || currentPlanStageIdx >= processState.planStages.length) {
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "Iterative plan completed.", aiProcessInsight: "All plan stages executed.", configAtFinalization: iterationStrategy.config });
          break;
        }
        activePlanStage = processState.planStages[currentPlanStageIdx];
        iterationScopeMax = activePlanStage.stageIterations;

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
      } else { // Global Mode
        if (currentIter >= maxOverallIterations) {
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "Maximum global iterations reached.", aiProcessInsight: "Global iterations complete.", configAtFinalization: iterationStrategy.config });
          break;
        }
      }

      productBeforeThisFailedIteration = currentProd;
      let iterationAttemptCount = 0; 

      // --- Strategy Evaluation for the UPCOMING iteration (currentIter + 1) ---
      // This uses state reflective of *before* this iteration runs, to decide strategy *for* this iteration.
      const iterationProgressPercentForNudge = maxOverallIterations > 0 ? currentIter / maxOverallIterations : 0;
      const nudgeStrategyForThisIteration = determineNudgeStrategyForNext(
          processState.stagnationInfo.consecutiveStagnantIterations,
          processState.stagnationNudgeEnabled,
          iterationProgressPercentForNudge,
          processState.stagnationNudgeAggressiveness
      );
      const stagnationInfoForStrategyCall = { ...processState.stagnationInfo, nudgeStrategyApplied: nudgeStrategyForThisIteration };
      const stateForCurrentStrategyEval: Pick<ProcessState, 'currentIteration' | 'maxIterations' | 'inputComplexity' | 'stagnationInfo' | 'iterationHistory' | 'currentModelForIteration' | 'currentAppliedModelConfig' | 'isPlanActive' | 'planStages'| 'currentPlanStageIndex' | 'selectedModelName' | 'stagnationNudgeEnabled' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness'> = {
        currentIteration: currentIter, // Iteration about to run is currentIter
        maxIterations: processState.maxIterations,
        inputComplexity: processState.inputComplexity,
        stagnationInfo: stagnationInfoForStrategyCall,
        iterationHistory: processState.iterationHistory, // Full history up to last completed iter
        currentModelForIteration: processState.currentModelForIteration, // Model used in *last* iter
        currentAppliedModelConfig: processState.currentAppliedModelConfig, // Config used in *last* iter
        isPlanActive: processState.isPlanActive, planStages: processState.planStages, currentPlanStageIndex: currentPlanStageIdx,
        selectedModelName: processState.selectedModelName, stagnationNudgeEnabled: processState.stagnationNudgeEnabled,
        strategistInfluenceLevel: processState.strategistInfluenceLevel, stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
      };
      iterationStrategy = await reevaluateStrategy(stateForCurrentStrategyEval, userBaseConfig);
      // --- End Strategy Evaluation ---

      updateProcessState({ // Update state with the strategy chosen for *this* iteration run
          currentModelForIteration: iterationStrategy.modelName,
          currentAppliedModelConfig: iterationStrategy.config,
          activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction 
      });

      let currentStatusMsg = `Iteration ${currentIter + 1}`;
      if (activePlanStage) {
        currentStatusMsg = `Plan Stage ${currentPlanStageIdx! + 1}/${processState.planStages.length} (Iter. ${currentStageIterCount + 1}/${activePlanStage.stageIterations}): Processing...`;
      } else {
        currentStatusMsg = `Global Iteration ${currentIter + 1}/${maxOverallIterations}: Processing...`;
      }
      currentStatusMsg += ` Using Model: ${iterationStrategy.modelName}`;
      if (iterationStrategy.activeMetaInstruction && nudgeStrategyForThisIteration === 'meta_instruct') {
          currentStatusMsg += ` (Nudge: AI Meta-Guidance Applied)`;
      } else if (nudgeStrategyForThisIteration !== 'none' && nudgeStrategyForThisIteration !== 'meta_instruct') {
          currentStatusMsg += ` (Nudge: ${nudgeStrategyForThisIteration.replace('params_', '')} Parameter Adjustment)`;
      }
      updateProcessState({ statusMessage: currentStatusMsg, aiProcessInsight: `Strategy for Iter ${currentIter + 1}: ${iterationStrategy.rationale}` });

      currentStreamBufferRef.current = "";
      const previousProductSnapshot = currentProd;

      let outlineResultForIter1: OutlineGenerationResult | undefined = undefined;
      const totalFilesSize = processState.loadedFiles.reduce((sum, file) => sum + file.size, 0);
      const isIter0AndNeedsOutline = USE_MULTI_STAGE_INITIAL_SYNTHESIS && currentIter === 0 && processState.loadedFiles.length > 0 && totalFilesSize > STAGED_SYNTHESIS_INPUT_THRESHOLD_BYTES;
      
      if (isIter0AndNeedsOutline) {
          updateProcessState({ statusMessage: "Generating initial outline from files...", aiProcessInsight: "Multi-Stage: Outline Generation" });
          const outlineInitialStrategyArgs: Pick<ProcessState, 'inputComplexity' | 'initialPrompt' | 'loadedFiles' | 'selectedModelName' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness'> = {
            inputComplexity: processState.inputComplexity, initialPrompt: processState.initialPrompt, loadedFiles: processState.loadedFiles, selectedModelName: iterationStrategy.modelName, strategistInfluenceLevel: processState.strategistInfluenceLevel, stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness
          };
          const outlineInitialStrategy = determineInitialStrategy(outlineInitialStrategyArgs, iterationStrategy.config); // Use the already decided config for outline generation model
          outlineResultForIter1 = await GeminaiService.generateInitialOutline(processState.initialPrompt, processState.loadedFiles, outlineInitialStrategy.config, outlineInitialStrategy.modelName);

          if (outlineResultForIter1.errorMessage) {
              updateProcessState({ isProcessing: false, statusMessage: `Error generating outline: ${outlineResultForIter1.errorMessage}`, aiProcessInsight: `Outline generation failed. ${outlineResultForIter1.errorMessage}`});
              logIterationData(currentIter + 1, currentProd, `Outline Gen Error: ${outlineResultForIter1.errorMessage}`, previousProductSnapshot, undefined, outlineInitialStrategy.config, { filesSentToApiIteration: 0, numberOfFilesActuallySent: processState.loadedFiles.length, totalFilesSizeBytesSent: totalFilesSize, fileManifestProvidedCharacterCount: processState.initialPrompt.length, loadedFilesForIterationContext: processState.loadedFiles }, {checkName: "OutlineGeneration", passed: false, reason: outlineResultForIter1.errorMessage, details: { type: 'error_phrase', value: outlineResultForIter1.errorMessage }}, 0, 0, 1, outlineInitialStrategy.rationale, outlineInitialStrategy.modelName, undefined);
              isProcessingRef.current = false; break;
          }
          updateProcessState({statusMessage: "Outline generated. Proceeding to synthesis...", aiProcessInsight: "Multi-Stage: Document Synthesis from Outline"});
      }

      let iterationSuccessful = false;
      let iterationProductFromApi = "";
      let apiResultForLog: IterateProductResult | undefined;
      let validationInfoForLog: AiResponseValidationInfo | undefined;
      let fileProcessingInfoForApi: FileProcessingInfo; 

      for (let attempt = 1; attempt <= SELF_CORRECTION_MAX_ATTEMPTS; attempt++) {
          iterationAttemptCount = attempt;
          currentStreamBufferRef.current = ""; 

          let retryCtx: RetryContext | undefined = undefined;
          if (attempt > 1 && processState.iterationHistory.length > 0) {
              const lastLogEntriesForThisIter = processState.iterationHistory.filter(e => e.iteration === (currentIter + 1));
              const lastFailedAttemptLog = lastLogEntriesForThisIter.sort((a,b) => (b.attemptCount || 0) - (a.attemptCount || 0))[0];
              if(lastFailedAttemptLog && lastFailedAttemptLog.aiValidationInfo && !lastFailedAttemptLog.aiValidationInfo.passed && lastFailedAttemptLog.promptCoreUserInstructionsSent) {
                  retryCtx = { previousErrorReason: lastFailedAttemptLog.aiValidationInfo.reason || "AI response validation failed.", originalCoreInstructions: lastFailedAttemptLog.promptCoreUserInstructionsSent };
              }
          }
          
          // Files are sent only if it's iteration 1 AND no outline was pre-generated.
          const filesSentToThisIterateCall = (currentIter + 1) === 1 && processState.loadedFiles.length > 0 && !outlineResultForIter1;
          fileProcessingInfoForApi = { 
              filesSentToApiIteration: filesSentToThisIterateCall ? (currentIter + 1) : null,
              numberOfFilesActuallySent: filesSentToThisIterateCall ? processState.loadedFiles.length : 0,
              totalFilesSizeBytesSent: filesSentToThisIterateCall ? processState.loadedFiles.reduce((sum, f) => sum + f.size, 0) : 0,
              fileManifestProvidedCharacterCount: processState.initialPrompt.length,
              loadedFilesForIterationContext: (currentIter + 1) === 1 && processState.loadedFiles.length > 0 ? processState.loadedFiles : undefined,
          };
          const productInputForApi = (currentIter === 0 && outlineResultForIter1) ? (outlineResultForIter1.outline || "") : (currentProd || "");

          apiResultForLog = await GeminaiService.iterateProduct(
            productInputForApi, currentIter + 1, iterationScopeMax,
            processState.initialPrompt, processState.loadedFiles, activePlanStage,
            processState.outputParagraphShowHeadings, processState.outputParagraphMaxHeadingDepth, processState.outputParagraphNumberedHeadings,
            iterationStrategy.config, isGlobalMode, iterationStrategy.modelName,
            onStreamChunk, () => haltSignalRef.current,
            retryCtx, nudgeStrategyForThisIteration,
            outlineResultForIter1, iterationStrategy.activeMetaInstruction
          );

          if (haltSignalRef.current) {
            updateProcessState({ isProcessing: false, statusMessage: "Process halted by user during AI response.", currentProductBeforeHalt: currentStreamBufferRef.current || currentProd, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
            logIterationData(currentIter + 1, currentStreamBufferRef.current || currentProd, "Halted by user", previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, undefined, (currentStreamBufferRef.current || currentProd)?.length, (currentStreamBufferRef.current || currentProd)?.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
            iterationSuccessful = false; break; 
          }
          iterationProductFromApi = currentStreamBufferRef.current;

          if (apiResultForLog.isRateLimitError) {
            handleRateLimitErrorEncountered();
            updateProcessState({ isProcessing: false, statusMessage: apiResultForLog.errorMessage || "API Rate Limit Hit.", aiProcessInsight: apiResultForLog.errorMessage || "Process paused due to API rate limits.", currentProductBeforeHalt: iterationProductFromApi, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
            logIterationData(currentIter + 1, iterationProductFromApi, `API Rate Limit: ${apiResultForLog.errorMessage}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, { checkName: "APILimit", passed: false, reason: apiResultForLog.errorMessage, details: { type: 'error_phrase', value: apiResultForLog.errorMessage } }, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
            iterationSuccessful = false; isProcessingRef.current = false; break;
          }
          if (apiResultForLog.status === 'ERROR') {
            updateProcessState({ isProcessing: false, statusMessage: `Error in Iteration ${currentIter + 1}: ${apiResultForLog.errorMessage}`, aiProcessInsight: `AI Error: ${apiResultForLog.errorMessage}` });
            logIterationData(currentIter + 1, iterationProductFromApi, `Error: ${apiResultForLog.errorMessage}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, { checkName: "APIError", passed: false, reason: apiResultForLog.errorMessage, details: {type: 'error_phrase', value: apiResultForLog.errorMessage } }, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
            iterationSuccessful = false; isProcessingRef.current = false; break;
          }

          let processedProduct = iterationProductFromApi;
          if (activePlanStage && activePlanStage.format === 'json') {
              processedProduct = parseAndCleanJsonOutput(iterationProductFromApi);
          }
          if (processedProduct.startsWith(CONVERGED_PREFIX)) {
              processedProduct = processedProduct.substring(CONVERGED_PREFIX.length);
          }
          const tempLogEntryForValidation: IterationLogEntry = { iteration: currentIter + 1, productSummary: "", status: "", timestamp: Date.now(), fileProcessingInfo: fileProcessingInfoForApi };
          const aiValidationResult: IsLikelyAiErrorResponseResult = isLikelyAiErrorResponse( iterationProductFromApi, previousProductSnapshot || "", tempLogEntryForValidation, activePlanStage?.length, activePlanStage?.format );
          validationInfoForLog = aiValidationResult.checkDetails ? { checkName: "AIResponseValidation", passed: !aiValidationResult.isError, reason: aiValidationResult.reason, details: aiValidationResult.checkDetails } : undefined;
          let isCritFailureFromValidation = false;
          if (aiValidationResult.isError && validationInfoForLog?.details?.type) {
              const criticalErrorTypes: AiResponseValidationInfo['details']['type'][] = [ 'prompt_leakage', 'error_phrase_with_significant_reduction', 'extreme_reduction_error', 'extreme_reduction_instructed_but_with_error_phrase', 'initial_synthesis_failed_large_output' ];
              if (criticalErrorTypes.includes(validationInfoForLog.details.type)) isCritFailureFromValidation = true;
          }

          if (aiValidationResult.isError) {
              if (isCritFailureFromValidation || attempt >= SELF_CORRECTION_MAX_ATTEMPTS) {
                  currentProd = productBeforeThisFailedIteration; 
                  const finalReason = isCritFailureFromValidation ? `CRITICAL: ${aiValidationResult.reason}` : `Failed Validation (Max Attempts): ${aiValidationResult.reason}`;
                  updateProcessState({ isProcessing: false, statusMessage: `Iteration ${currentIter + 1}: ${finalReason}. Process halted.`, aiProcessInsight: `Halted. AI response issue: ${finalReason}`, finalProduct: currentProd, currentProductBeforeHalt: currentProd, currentIterationBeforeHalt: currentIter, configAtFinalization: iterationStrategy.config });
                  logIterationData(currentIter + 1, iterationProductFromApi, finalReason, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, processedProduct.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
                  iterationSuccessful = false; isProcessingRef.current = false; break;
              } else { 
                  updateProcessState({ statusMessage: `Iteration ${currentIter + 1} Attempt ${attempt + 1}: AI response flagged (${aiValidationResult.reason}). Retrying...`, aiProcessInsight: `Self-correction attempt ${attempt + 1} for: ${aiValidationResult.reason}` });
                  logIterationData(currentIter + 1, iterationProductFromApi, `Attempt ${attempt} Failed Validation: ${aiValidationResult.reason}. Retrying...`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, processedProduct.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
                  await performAutoSave();
              }
          } else { 
              iterationSuccessful = true;
              currentProd = processedProduct;
              break; 
          }
      } 

      if (!iterationSuccessful || haltSignalRef.current) {
          isProcessingRef.current = false; break; 
      }

      let newStagnationInfo: StagnationInfo = { ...processState.stagnationInfo, nudgeStrategyApplied: 'none' }; 
      if (isGlobalMode) {
          const similarity = calculateJaccardSimilarity(previousProductSnapshot, currentProd);
          const prevLogEntry = processState.iterationHistory.find(e => e.iteration === currentIter);
          const netLineChange = (prevLogEntry?.linesAdded || 0) - (prevLogEntry?.linesRemoved || 0);
          let isNowStagnant = false;
          if ( (similarity > STAGNATION_SIMILARITY_THRESHOLD || Math.abs(netLineChange) < STAGNATION_MIN_CHANGE_THRESHOLD) && (currentProd || "").length > 0 && (previousProductSnapshot || "").length > 0 ) {
              isNowStagnant = true;
              newStagnationInfo.consecutiveStagnantIterations++;
          } else {
              newStagnationInfo.consecutiveStagnantIterations = 0;
          }
          newStagnationInfo.isStagnant = isNowStagnant;
          newStagnationInfo.similarityWithPrevious = similarity;
          updateProcessState({ stagnationInfo: { ...newStagnationInfo } }); 
      }

      currentIter++;
      if (activePlanStage) currentStageIterCount++;

      logIterationData(currentIter, iterationProductFromApi, apiResultForLog?.status === 'CONVERGED' ? "Converged" : "Completed", previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, currentProd?.length || 0, iterationAttemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
      updateProcessState({ currentProduct: currentProd, currentIteration: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx, statusMessage: `Iteration ${currentIter} ${apiResultForLog?.status}.`, aiProcessInsight: `AI refinement complete for iter ${currentIter}. ${newStagnationInfo.isStagnant && isGlobalMode ? `Stagnation detected (${newStagnationInfo.consecutiveStagnantIterations}x).` : 'Progress good.'}` });
      await performAutoSave();

      if (apiResultForLog?.status === 'CONVERGED') {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Process converged at Iteration ${currentIter}.`, aiProcessInsight: "AI indicated convergence.", configAtFinalization: iterationStrategy.config });
        isProcessingRef.current = false; break;
      }
    } 
    isProcessingRef.current = false;
    await performAutoSave();
  };
  return { handleStart, handleHalt };
};
