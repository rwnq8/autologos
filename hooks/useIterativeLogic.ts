


import { useRef, useState, useCallback, useEffect } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, IsLikelyAiErrorResponseResult, IterationEntryType, DevLogEntry, StrategistLLMContext } from '../types.ts';
import * as GeminaiService from '../services/geminiService.ts';
import { getUserPromptComponents } from '../services/promptBuilderService.ts';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX, isDataDump } from '../services/iterationUtils.ts';
import * as ModelStrategyService from '../services/ModelStrategyService.ts';
import { calculateQualitativeStates } from '../services/strategistUtils.ts';
import { calculateFleschReadingEase, calculateJaccardSimilarity, calculateLexicalDensity, calculateAvgSentenceLength, calculateSimpleTTR } from '../services/textAnalysisService.ts';
import type { AddLogEntryParams } from './useProcessState.ts';
import { getRelevantDevLogContext } from '../services/devLogContextualizerService.ts';
import { reconstructProduct } from '../services/diffService.ts';


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
  handleStartProcess: (options?: {
    isTargetedRefinement?: boolean;
    targetedSelection?: string;
    targetedInstructions?: string;
    userRawPromptForContextualizer?: string;
  }) => Promise<void>;
  handleHaltProcess: () => void;
  handleBootstrapSynthesis: () => Promise<void>;
}

export const useIterativeLogic = (
  processState: ProcessState,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  addLogEntryFromHook: (logData: AddLogEntryParams) => void,
  addDevLogEntry: (newEntryData: Omit<DevLogEntry, 'id' | 'timestamp' | 'lastModified'>) => void,
  getUserSetBaseConfig: () => ModelConfig,
  performAutoSave: () => Promise<void>,
  handleRateLimitErrorEncountered: () => void,
): UseIterativeLogicReturn => {
  const isProcessingRef = useRef(false);
  const haltSignalRef = useRef(false);
  const currentStreamBufferRef = useRef("");

  const latestStateRef = useRef({ processState, getUserSetBaseConfig });
  useEffect(() => {
    latestStateRef.current = { processState, getUserSetBaseConfig };
  }, [processState, getUserSetBaseConfig]);
  
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
    isLowValueIterationLogged?: boolean,
    bootstrapRun?: number
  ) => {
    const { processState } = latestStateRef.current;
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
      groundingMetadata: apiResult?.groundingMetadata,
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
      isLowValueIterationLogged,
      bootstrapRun,
    });
  }, [addLogEntryFromHook, latestStateRef]);

  const handleProcessHalt = useCallback((
    currentIterForHalt: number, 
    currentProdForHalt: string | null, 
    haltMessage: string, 
    apiResultForHalt?: IterateProductResult, 
    currentEntryTypeForHalt: IterationEntryType = 'ai_iteration'
  ) => {
    const { processState } = latestStateRef.current;
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
    logIterationData(
        currentIterForHalt, 
        currentEntryTypeForHalt, 
        currentStreamBufferRef.current || currentProdForHalt, 
        haltMessage, 
        currentProdForHalt, 
        apiResultForHalt, 
        processState.currentAppliedModelConfig || undefined, 
        fileInfo, 
        undefined, 
        undefined, 
        undefined, 
        undefined, 
        processState.aiProcessInsight, 
        processState.currentModelForIteration, 
        processState.activeMetaInstructionForNextIter
    );
    performAutoSave();
  }, [latestStateRef, updateProcessState, logIterationData, performAutoSave]);

  const onStreamChunk = useCallback((chunkText: string) => {
    if (haltSignalRef.current) return;
    currentStreamBufferRef.current += chunkText;
    updateProcessState({ currentProduct: currentStreamBufferRef.current });
  }, [updateProcessState]);
  
  const handleHaltProcess = useCallback(() => {
    haltSignalRef.current = true;
  }, []);

  const handleBootstrapSynthesis = useCallback(async () => {
    const { processState: initialProcessState, getUserSetBaseConfig: getBaseConfig } = latestStateRef.current;
    if (isProcessingRef.current || initialProcessState.loadedFiles.length < 2) {
      updateProcessState({ statusMessage: "Ensemble synthesis requires at least 2 files and cannot run while another process is active." });
      return;
    }

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    updateProcessState({ isProcessing: true, statusMessage: "Starting Ensemble Synthesis...", iterationHistory: [], currentIteration: 0, currentProduct: null });

    const subProducts: string[] = [];
    let logCounter = 0;
    const userBaseConfig = getBaseConfig();
    const originalLoadedFiles = [...initialProcessState.loadedFiles];

    // Phase 1: Sub-processing
    for (let i = 0; i < initialProcessState.bootstrapSamples; i++) {
      const shuffled = [...originalLoadedFiles].sort(() => 0.5 - Math.random());
      const sampleSize = Math.max(1, Math.round(shuffled.length * (initialProcessState.bootstrapSampleSizePercent / 100)));
      const sampledFiles = shuffled.slice(0, sampleSize);
      const sampleManifest = `Ensemble Sample ${i + 1}: ${sampledFiles.map(f => f.name).join(', ')}.`;
      let productForThisSample = "";

      for (let j = 0; j < initialProcessState.bootstrapSubIterations; j++) {
        if (haltSignalRef.current) { handleProcessHalt(logCounter, productForThisSample, "Ensemble process halted by user."); return; }
        
        updateProcessState({ statusMessage: `Processing Sample ${i + 1}/${initialProcessState.bootstrapSamples}, Sub-iteration ${j + 1}/${initialProcessState.bootstrapSubIterations}...` });
        currentStreamBufferRef.current = "";

        const apiResult = await GeminaiService.iterateProduct({
          currentProduct: productForThisSample,
          loadedFiles: sampledFiles,
          fileManifest: sampleManifest,
          currentIterationOverall: j + 1,
          maxIterationsOverall: initialProcessState.bootstrapSubIterations,
          activePlanStage: null,
          outputParagraphShowHeadings: initialProcessState.outputParagraphShowHeadings,
          outputParagraphMaxHeadingDepth: initialProcessState.outputParagraphMaxHeadingDepth,
          outputParagraphNumberedHeadings: initialProcessState.outputParagraphNumberedHeadings,
          modelConfigToUse: userBaseConfig,
          isGlobalMode: true,
          isSearchGroundingEnabled: initialProcessState.isSearchGroundingEnabled,
          isUrlBrowsingEnabled: initialProcessState.isUrlBrowsingEnabled,
          modelToUse: initialProcessState.selectedModelName,
          onStreamChunk,
          isHaltSignalled: () => haltSignalRef.current,
        });

        if (apiResult.status === 'ERROR' || apiResult.status === 'HALTED') {
          handleProcessHalt(logCounter, apiResult.product, `Error during ensemble sample ${i + 1}: ${apiResult.errorMessage || 'Process Halted'}`);
          return;
        }

        const prevProductForLog = productForThisSample;
        productForThisSample = apiResult.product;
        logIterationData(
          logCounter++,
          'bootstrap_sub_iteration',
          productForThisSample,
          `Sample ${i + 1}, Sub-iter ${j + 1}`,
          prevProductForLog,
          apiResult,
          userBaseConfig,
          { filesSentToApiIteration: j === 0 ? 0 : null, numberOfFilesActuallySent: sampledFiles.length, totalFilesSizeBytesSent: sampledFiles.reduce((s, f) => s + f.size, 0), fileManifestProvidedCharacterCount: sampleManifest.length },
          undefined,
          productForThisSample?.length,
          productForThisSample?.length,
          undefined,
          undefined,
          initialProcessState.selectedModelName,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          i + 1
        );
      }
      subProducts.push(productForThisSample);
    }

    // Phase 2: Final Integration
    if (haltSignalRef.current) { handleProcessHalt(logCounter, null, "Ensemble process halted by user before final integration."); return; }
    updateProcessState({ statusMessage: "Integrating ensemble results..." });
    currentStreamBufferRef.current = "";

    const integrationFiles: LoadedFile[] = subProducts.map((p, i) => ({
      name: `Ensemble_Result_${i + 1}.md`,
      content: p, mimeType: 'text/markdown', size: p.length
    }));
    const integrationManifest = `Input consists of ${integrationFiles.length} ensemble-synthesized products from original file samples. Your task is to integrate these into one final, coherent document.`;

    const finalApiResult = await GeminaiService.iterateProduct({
      currentProduct: "",
      loadedFiles: integrationFiles,
      fileManifest: integrationManifest,
      currentIterationOverall: 1,
      maxIterationsOverall: 1,
      activePlanStage: null,
      outputParagraphShowHeadings: initialProcessState.outputParagraphShowHeadings,
      outputParagraphMaxHeadingDepth: initialProcessState.outputParagraphMaxHeadingDepth,
      outputParagraphNumberedHeadings: initialProcessState.outputParagraphNumberedHeadings,
      modelConfigToUse: userBaseConfig,
      isGlobalMode: true,
      isSearchGroundingEnabled: initialProcessState.isSearchGroundingEnabled,
      isUrlBrowsingEnabled: initialProcessState.isUrlBrowsingEnabled,
      modelToUse: initialProcessState.selectedModelName,
      onStreamChunk,
      isHaltSignalled: () => haltSignalRef.current,
    });

    if (finalApiResult.status === 'ERROR' || finalApiResult.status === 'HALTED') {
      handleProcessHalt(logCounter, finalApiResult.product, `Error during final ensemble integration: ${finalApiResult.errorMessage || 'Process Halted'}`);
      return;
    }
    
    // Finalize State
    const finalSynthesizedProduct = finalApiResult.product;
    logIterationData(
      0, // The final integration becomes Iteration 0
      'bootstrap_synthesis_milestone',
      finalSynthesizedProduct,
      `Final Ensemble Integration`,
      subProducts.join('\n\n---\n\n'),
      finalApiResult,
      userBaseConfig,
      { filesSentToApiIteration: 0, numberOfFilesActuallySent: integrationFiles.length, totalFilesSizeBytesSent: integrationFiles.reduce((s, f) => s + f.size, 0), fileManifestProvidedCharacterCount: integrationManifest.length },
      undefined,
      finalSynthesizedProduct?.length,
      finalSynthesizedProduct?.length,
      undefined,
      undefined,
      initialProcessState.selectedModelName,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    updateProcessState({
      isProcessing: false,
      statusMessage: "Ensemble Synthesis complete. Ready for main iterative process.",
      initialPrompt: `Product synthesized via ensemble sub-sampling from ${originalLoadedFiles.length} files. Original Objective: ${initialProcessState.initialPrompt}`,
      loadedFiles: [], // Clear original files, the product is now the base
      currentProduct: finalSynthesizedProduct,
      finalProduct: null,
      currentIteration: 0, // This is now the base state for iteration 0
      activeMetaInstructionForNextIter: "The process will now refine a robustly synthesized document created via an ensemble method (bootstrapping). This baseline represents a statistical 'mean' of the source material.",
    });
    isProcessingRef.current = false;
    await performAutoSave();
  }, [latestStateRef, updateProcessState, logIterationData, performAutoSave, onStreamChunk, handleProcessHalt, addLogEntryFromHook]);


  const handleStartProcess = useCallback(async (
    options?: {
      isTargetedRefinement?: boolean;
      targetedSelection?: string;
      targetedInstructions?: string;
      userRawPromptForContextualizer?: string;
    }
  ) => {
    const { processState, getUserSetBaseConfig: getBaseConfig } = latestStateRef.current;
    if (isProcessingRef.current) {
      updateProcessState({ statusMessage: "Process already running." }); return;
    }
    if (!GeminaiService.isApiKeyAvailable()) {
      updateProcessState({ statusMessage: "API Key not available. Cannot start process." }); return;
    }
    if (!options?.isTargetedRefinement && processState.loadedFiles.length === 0 && !processState.initialPrompt.trim() && processState.currentProduct === null) {
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

    const userBaseConfig = getBaseConfig();
    
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

    if (currentIter === 0 && !options?.isTargetedRefinement && (currentProd === null || currentProd.trim() === "") && processState.iterationHistory.length === 0) {
      let initialProductForStateAndLog: string;
      let statusForLog: string;
      
      if (processState.loadedFiles.length > 0) {
        initialProductForStateAndLog = processState.loadedFiles.map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n');
        statusForLog = "Initial State from Loaded Files";
      } else {
        initialProductForStateAndLog = processState.initialPrompt;
        statusForLog = "Initial State from Prompt Text";
      }

      const fileInfo = {
        filesSentToApiIteration: null, 
        numberOfFilesActuallySent: processState.loadedFiles.length,
        totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
        fileManifestProvidedCharacterCount: processState.initialPrompt.length,
        loadedFilesForIterationContext: processState.loadedFiles,
      };

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

      const { processState: currentStateForStrategy } = latestStateRef.current;
      const isBootstrappedBase = currentStateForStrategy.iterationHistory[0]?.entryType === 'bootstrap_synthesis_milestone';
      const { productDevelopmentState, stagnationSeverity, recentIterationPerformance } = calculateQualitativeStates(currentProd, currentStagnationInfo, currentStateForStrategy.inputComplexity, currentStateForStrategy.stagnationNudgeAggressiveness, isBootstrappedBase);
      const isRadicalRefinementKickstartAttempt = stagnationSeverity === 'CRITICAL' || (stagnationSeverity === 'SEVERE' && productDevelopmentState === 'NEEDS_EXPANSION_STALLED');

      const strategyArgs = {
        ...currentStateForStrategy,
        currentProduct: previousProductSnapshot,
        currentIteration: currentIter,
        stagnationInfo: currentStagnationInfo,
        productDevelopmentState,
        stagnationSeverity,
        recentIterationPerformance,
        isRadicalRefinementKickstartAttempt,
        isBootstrappedBase,
      };

      const { modelName: nextModelName, config: nextConfig, rationale: strategyRationale, activeMetaInstruction } = await ModelStrategyService.reevaluateStrategy(strategyArgs, userBaseConfig);
      
      updateProcessState({
        aiProcessInsight: strategyRationale,
        currentModelForIteration: nextModelName,
        currentAppliedModelConfig: nextConfig,
        activeMetaInstructionForNextIter: activeMetaInstruction,
      });


      for (iterationAttemptCount = 0; iterationAttemptCount <= SELF_CORRECTION_MAX_ATTEMPTS; iterationAttemptCount++) {
        if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user."); return; }
        const { processState: currentStateForLoop } = latestStateRef.current;
        const activePlanStageForCall = currentStateForLoop.isPlanActive && currentPlanStageIdx !== null ? currentStateForLoop.planStages[currentPlanStageIdx] : null;
        
        const isKickstartThisAttempt = isRadicalRefinementKickstartAttempt && iterationAttemptCount === 0;

        apiResultForLog = await GeminaiService.iterateProduct({
            currentProduct: currentProd || "",
            currentIterationOverall: currentIter,
            maxIterationsOverall: maxIterationsOverall,
            fileManifest: currentStateForLoop.initialPrompt,
            loadedFiles: currentStateForLoop.loadedFiles,
            activePlanStage: activePlanStageForCall,
            outputParagraphShowHeadings: currentStateForLoop.outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth: currentStateForLoop.outputParagraphMaxHeadingDepth,
            outputParagraphNumberedHeadings: currentStateForLoop.outputParagraphNumberedHeadings,
            modelConfigToUse: nextConfig,
            isGlobalMode: !currentStateForLoop.isPlanActive,
            isSearchGroundingEnabled: currentStateForLoop.isSearchGroundingEnabled,
            isUrlBrowsingEnabled: currentStateForLoop.isUrlBrowsingEnabled,
            modelToUse: nextModelName,
            onStreamChunk,
            isHaltSignalled: () => haltSignalRef.current,
            retryContext,
            activeMetaInstruction: activeMetaInstruction,
            devLogContextString: devLogContextString,
            isTargetedRefinementMode: options?.isTargetedRefinement,
            targetedSelectionText: options?.targetedSelection,
            targetedRefinementInstructions: options?.targetedInstructions,
            isRadicalRefinementKickstart: isKickstartThisAttempt
        });

        if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user.", apiResultForLog); return; }
        if (apiResultForLog.isRateLimitError) {
          handleRateLimitErrorEncountered();
          updateProcessState({ statusMessage: `API Rate Limit Hit. Process halted. ${apiResultForLog.errorMessage || ''}`});
          addDevLogEntry({
            type: 'issue',
            summary: `API Rate Limit Hit at Iteration ${currentIter}`,
            details: `The process was halted due to an API rate limit or quota exhaustion error. Error message: ${apiResultForLog.errorMessage || 'No details.'}`,
            status: 'open',
            resolution: 'Process halted. Check API billing/quota, wait for cooldown, or switch models.',
            relatedIteration: currentIter,
            tags: ['api', 'quota']
          });
          handleProcessHalt(currentIter, currentProd, 'Process Halted (API Rate Limit)', apiResultForLog);
          break;
        }

        const newProductCandidate = currentStreamBufferRef.current || "";
        
        const isInitialSynthesisFromFile = currentIter === 1 && currentStateForLoop.loadedFiles.length > 0;
        if (isInitialSynthesisFromFile) {
            const tempFileProcessingInfoForCheck: FileProcessingInfo = {
                filesSentToApiIteration: 1,
                numberOfFilesActuallySent: currentStateForLoop.loadedFiles.length,
                totalFilesSizeBytesSent: currentStateForLoop.loadedFiles.reduce((acc, f) => acc + f.size, 0),
                fileManifestProvidedCharacterCount: currentStateForLoop.initialPrompt.length,
                loadedFilesForIterationContext: currentStateForLoop.loadedFiles
            };
            const dataDumpCheck = isDataDump(newProductCandidate, tempFileProcessingInfoForCheck, false); // Outline feature not used, so false
            if (dataDumpCheck.isError) {
                validationResult = { 
                    isError: true, 
                    isCriticalFailure: true,
                    reason: dataDumpCheck.reason, 
                    checkDetails: { type: 'initial_synthesis_failed_data_dump', value: { dataDumpReason: dataDumpCheck.reason } }
                };
            }
        }

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
                fileManifestProvidedCharacterCount: currentStateForLoop.initialPrompt.length,
                loadedFilesForIterationContext: []
            },
            apiStreamDetails: apiResultForLog.apiStreamDetails,
        };
        
        if (!validationResult) {
            validationResult = isLikelyAiErrorResponse(
              newProductCandidate,
              previousProductSnapshot || "",
              currentLogIncomplete,
              undefined,
              activePlanStageForCall?.length,
              activePlanStageForCall?.format,
              currentStateForLoop.inputComplexity
            );
        }
        
        isCurrentIterationCriticalFailure = validationResult.isCriticalFailure || false;

        if (!validationResult.isError || isCurrentIterationCriticalFailure) {
            break; 
        }

        currentStreamBufferRef.current = "";
        updateProcessState({ currentProduct: previousProductSnapshot });
        
        const { coreUserInstructions } = getUserPromptComponents(
            currentIter, maxIterationsOverall, activePlanStageForCall,
            currentStateForLoop.outputParagraphShowHeadings, currentStateForLoop.outputParagraphMaxHeadingDepth, currentStateForLoop.outputParagraphNumberedHeadings,
            !currentStateForLoop.isPlanActive, false, undefined, undefined, undefined, currentStateForLoop.loadedFiles,
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

        logIterationData(currentIter, 'ai_iteration', newProductCandidate, `Attempt ${iterationAttemptCount + 1} failed validation: ${validationResult.reason}. Retrying...`, previousProductSnapshot, apiResultForLog, nextConfig, currentLogIncomplete.fileProcessingInfo, aiValidationInfoForLog, newProductCandidate.length, newProductCandidate.length, iterationAttemptCount + 1, strategyRationale, nextModelName, activeMetaInstruction);
      }
      
      if (haltSignalRef.current) { handleProcessHalt(currentIter, currentProd, "Process halted by user.", apiResultForLog); return; }
      if (apiResultForLog && apiResultForLog.isRateLimitError) break;
      if (!apiResultForLog) {
          handleProcessHalt(currentIter, currentProd, "Process halted due to unexpected error before API call completion.");
          return;
      }

      if (isCurrentIterationCriticalFailure) {
        addDevLogEntry({
            type: 'issue',
            summary: `Critical validation failure at Iteration ${currentIter}`,
            details: `The AI's response failed a critical validation check: "${validationResult?.reason || 'Unknown reason'}". The process was stopped to prevent corrupted output.`,
            status: 'open',
            relatedIteration: currentIter,
            tags: ['validation', 'critical-error']
        });
        handleProcessHalt(currentIter, currentProd, `Process Halted due to Critical Failure: ${validationResult?.reason}`, apiResultForLog);
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
          nudgeStrategyApplied: activeMetaInstruction ? 'meta_instruct' : 'none'
      };
      
      currentStagnationInfo = newStagnationInfo;
      
      const finalValidationInfoForLog: AiResponseValidationInfo | undefined = validationResult
        ? { checkName: "isLikelyAiErrorResponse_Final", passed: !validationResult.isError, isCriticalFailure: validationResult.isCriticalFailure, reason: validationResult.reason, details: validationResult.checkDetails } : undefined;

      logIterationData(
        currentIter, currentEntryType, currentProd, `Iteration ${currentIter} ${apiResultForLog.status}.`, previousProductSnapshot,
        apiResultForLog, nextConfig, fileProcessingInfoForApi, finalValidationInfoForLog, currentProd?.length,
        currentProd?.length, iterationAttemptCount, strategyRationale, nextModelName,
        activeMetaInstruction, isCurrentIterationCriticalFailure,
        options?.isTargetedRefinement ? options.targetedSelection : undefined, options?.isTargetedRefinement ? options.targetedInstructions : undefined,
        netLineChange, charDelta, similarity, isStagnantIteration, isEffectivelyIdentical, isLowValueIteration
      );

      updateProcessState({ currentProduct: currentProd, currentIteration: currentIter, statusMessage: `Iteration ${currentIter} ${apiResultForLog.status}.`, stagnationInfo: currentStagnationInfo });
      
      if (apiResultForLog.status === 'CONVERGED') {
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Process converged at Iteration ${currentIter}.`, configAtFinalization: nextConfig, aiProcessInsight: `Convergence declared at Iteration ${currentIter}. AI declared.` });
        isProcessingRef.current = false;
        addDevLogEntry({
          type: 'decision',
          summary: `AI declared convergence at Iteration ${currentIter}`,
          details: `The AI signaled that the product is complete and no further meaningful improvements could be made according to the current goals.`,
          status: 'implemented',
          relatedIteration: currentIter,
          tags: ['convergence', 'ai-decision']
        });
        await performAutoSave(); return;
      }

      await performAutoSave();
    }
  }, [
    latestStateRef,
    updateProcessState,
    addLogEntryFromHook,
    addDevLogEntry,
    performAutoSave,
    handleRateLimitErrorEncountered,
    logIterationData,
    handleProcessHalt,
    onStreamChunk,
  ]);

  return { handleStartProcess, handleHaltProcess, handleBootstrapSynthesis };
};