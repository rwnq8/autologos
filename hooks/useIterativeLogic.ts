



import { useRef, useState, useCallback, useEffect } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, IsLikelyAiErrorResponseResult, IterationEntryType, DevLogEntry, StrategistLLMContext, Version, ModelStrategy } from '../types/index.ts';
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

interface UseIterativeLogicReturn {
  handleStartProcess: (options?: {
    isTargetedRefinement?: boolean;
    targetedSelection?: string;
    targetedInstructions?: string;
    userRawPromptForContextualizer?: string;
  }) => Promise<void>;
  handleHaltProcess: () => void;
  handleBootstrapSynthesis: () => Promise<void>;
  handleAcceptStrategy: () => Promise<void>;
  handleIgnoreStrategy: () => Promise<void>;
}

const shouldPauseForStrategy = (newStrategy: ModelStrategy, currentConfig: ModelConfig | null | undefined): boolean => {
  if (!currentConfig) return true; // Pause if there's no current config to compare against
  if (newStrategy.modelName !== currentConfig.modelName) return true;
  if (newStrategy.activeMetaInstruction) return true;
  if (Math.abs(newStrategy.config.temperature - currentConfig.temperature) > 0.2) return true;
  return false;
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
    version: Version,
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
      majorVersion: version.major,
      minorVersion: version.minor,
      patchVersion: version.patch,
      entryType: entryType,
      currentFullProduct: finalProductForSummary,
      status: statusMessage,
      previousFullProduct: previousProductForLog,
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
    currentVersionForHalt: Version, 
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
        currentVersionBeforeHalt: currentVersionForHalt,
        finalProduct: processState.finalProduct || ((currentStreamBufferRef.current || currentProdForHalt || "").startsWith(CONVERGED_PREFIX) ? null : (currentStreamBufferRef.current || currentProdForHalt)),
    });
    const fileInfo = { filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0 };
    logIterationData(
        currentVersionForHalt, 
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

  const runIterationLoop = useCallback(async (
    options?: {
      isTargetedRefinement?: boolean;
      targetedSelection?: string;
      targetedInstructions?: string;
      userRawPromptForContextualizer?: string;
    }
  ) => {
    isProcessingRef.current = true;
    updateProcessState({ isProcessing: true });

    let { currentMajorVersion, currentMinorVersion, currentProduct, maxMajorVersions } = latestStateRef.current.processState;

    while (currentMajorVersion < maxMajorVersions) {
        if (haltSignalRef.current) { handleProcessHalt({ major: currentMajorVersion, minor: currentMinorVersion }, currentProduct, "Process halted by user."); return; }

        let attemptCount = 0;
        let selfCorrectionSuccess = false;

        while (attemptCount < SELF_CORRECTION_MAX_ATTEMPTS && !selfCorrectionSuccess) {
            const { processState: currentState, getUserSetBaseConfig: getBaseConfigLoop } = latestStateRef.current;
            if (haltSignalRef.current) { handleProcessHalt({ major: currentMajorVersion, minor: currentMinorVersion }, currentProduct, "Process halted by user."); return; }

            const currentVersionForAttempt: Version = { major: currentMajorVersion + 1, minor: currentMinorVersion + attemptCount };

            const isBootstrappedBase = currentState.iterationHistory.some(e => e.entryType === 'bootstrap_synthesis_milestone');
            const qualitativeStates = calculateQualitativeStates(currentState.currentProduct, currentState.stagnationInfo, currentState.inputComplexity, currentState.stagnationNudgeAggressiveness, isBootstrappedBase);
            const devLogContextString = await getRelevantDevLogContext(currentState.devLog, options?.userRawPromptForContextualizer || currentState.initialPrompt);

            const strategyArgs = { ...currentState, ...qualitativeStates, isRadicalRefinementKickstartAttempt: false };
            const iterationStrategy = await ModelStrategyService.reevaluateStrategy(strategyArgs, getBaseConfigLoop());

            if (shouldPauseForStrategy(iterationStrategy, currentState.currentAppliedModelConfig)) {
                updateProcessState({
                    pendingStrategySuggestion: iterationStrategy,
                    awaitingStrategyDecision: true,
                    isProcessing: false,
                    statusMessage: `AI Strategist recommends a new approach. Please review.`,
                    aiProcessInsight: `Paused for strategy decision. Rationale: ${iterationStrategy.rationale}`
                });
                isProcessingRef.current = false;
                return; // PAUSE and wait for user action
            }

            updateProcessState({
                currentModelForIteration: iterationStrategy.modelName,
                currentAppliedModelConfig: iterationStrategy.config,
                activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
                aiProcessInsight: iterationStrategy.rationale,
                statusMessage: `Processing v${currentVersionForAttempt.major}.${currentVersionForAttempt.minor}...`
            });

            currentStreamBufferRef.current = "";
            const productBeforeThisAttempt = currentProduct;

            const apiResult = await GeminaiService.iterateProduct({
                currentProduct: currentProduct || "",
                currentIterationOverall: currentMajorVersion + 1,
                maxIterationsOverall: maxMajorVersions,
                fileManifest: currentState.initialPrompt,
                loadedFiles: currentState.loadedFiles,
                activePlanStage: null,
                outputParagraphShowHeadings: currentState.outputParagraphShowHeadings,
                outputParagraphMaxHeadingDepth: currentState.outputParagraphMaxHeadingDepth,
                outputParagraphNumberedHeadings: currentState.outputParagraphNumberedHeadings,
                modelConfigToUse: iterationStrategy.config,
                isGlobalMode: !currentState.isPlanActive,
                isSearchGroundingEnabled: currentState.isSearchGroundingEnabled,
                isUrlBrowsingEnabled: currentState.isUrlBrowsingEnabled,
                modelToUse: iterationStrategy.modelName,
                onStreamChunk,
                isHaltSignalled: () => haltSignalRef.current,
                activeMetaInstruction: iterationStrategy.activeMetaInstruction,
                devLogContextString: devLogContextString,
                ensembleSubProducts: currentState.ensembleSubProducts,
                isTargetedRefinementMode: options?.isTargetedRefinement,
                targetedSelectionText: options?.targetedSelection,
                targetedRefinementInstructions: options?.targetedInstructions
            });
            
            if (haltSignalRef.current) { handleProcessHalt(currentVersionForAttempt, productBeforeThisAttempt, "Process halted by user during AI response."); return; }
            if (apiResult.isRateLimitError) { handleRateLimitErrorEncountered(); handleProcessHalt(currentVersionForAttempt, productBeforeThisAttempt, `Process Halted: ${apiResult.errorMessage}`); return; }
            if (apiResult.status === 'ERROR') { handleProcessHalt(currentVersionForAttempt, productBeforeThisAttempt, `Process Halted: ${apiResult.errorMessage}`); return; }

            const directAiResponse = currentStreamBufferRef.current;
            const validationResult = isLikelyAiErrorResponse(directAiResponse, productBeforeThisAttempt || "", { ...currentState.iterationHistory[0], majorVersion: currentVersionForAttempt.major, minorVersion: currentVersionForAttempt.minor } );
            
            const aiValidationInfoForLog: AiResponseValidationInfo = {
                checkName: "AI Response Validation",
                passed: !validationResult.isError,
                isCriticalFailure: validationResult.isCriticalFailure,
                reason: validationResult.reason,
                details: validationResult.checkDetails,
            };

            if (validationResult.isError) {
                attemptCount++;
                logIterationData(currentVersionForAttempt, 'ai_iteration', directAiResponse, `Failed Validation (Attempt ${attemptCount}): ${validationResult.reason}`, productBeforeThisAttempt, apiResult, iterationStrategy.config, undefined, aiValidationInfoForLog, directAiResponse.length, undefined, attemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, validationResult.isCriticalFailure);
                if (validationResult.isCriticalFailure || attemptCount >= SELF_CORRECTION_MAX_ATTEMPTS) {
                    handleProcessHalt(currentVersionForAttempt, productBeforeThisAttempt, `Process Halted: Critical validation failure or max retries exceeded. Reason: ${validationResult.reason}`);
                    return;
                }
                updateProcessState({ statusMessage: `v${currentVersionForAttempt.major}.${currentVersionForAttempt.minor} failed validation. Retrying (Attempt ${attemptCount + 1})...`, aiProcessInsight: `Validation Fail: ${validationResult.reason}`});
                currentMinorVersion++; // To log the failed attempt correctly
                continue;
            }

            selfCorrectionSuccess = true;
            currentProduct = apiResult.product;
            currentMajorVersion++;
            currentMinorVersion = 0;

            const similarity = calculateJaccardSimilarity(productBeforeThisAttempt, currentProduct);
            const isStagnant = similarity > STAGNATION_SIMILARITY_THRESHOLD;
            const newStagnationInfo: StagnationInfo = {
              ...currentState.stagnationInfo,
              isStagnant: isStagnant,
              consecutiveStagnantIterations: isStagnant ? currentState.stagnationInfo.consecutiveStagnantIterations + 1 : 0,
              similarityWithPrevious: similarity,
            };
            
            logIterationData(currentVersionForAttempt, 'ai_iteration', directAiResponse, apiResult.status, productBeforeThisAttempt, apiResult, iterationStrategy.config, undefined, aiValidationInfoForLog, directAiResponse.length, currentProduct.length, attemptCount, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction);
            updateProcessState({ currentProduct, currentMajorVersion, currentMinorVersion, statusMessage: `Version ${currentVersionForAttempt.major}.${currentVersionForAttempt.minor} complete. Status: ${apiResult.status}.`, stagnationInfo: newStagnationInfo });
            await performAutoSave();

            if (apiResult.status === 'CONVERGED') {
                handleProcessHalt({major: currentMajorVersion, minor: currentMinorVersion}, currentProduct, `Process converged at v${currentMajorVersion}.${currentMinorVersion}.`);
                return;
            }
        }
    }

    isProcessingRef.current = false;
    updateProcessState({ isProcessing: false, finalProduct: currentProduct, statusMessage: "Maximum iterations reached. Process complete." });
    await performAutoSave();
  }, [
    latestStateRef, updateProcessState, logIterationData, performAutoSave, onStreamChunk, 
    handleHaltProcess, handleRateLimitErrorEncountered
  ]);

  const handleStartProcess = useCallback(async (
    options?: {
        isTargetedRefinement?: boolean;
        targetedSelection?: string;
        targetedInstructions?: string;
        userRawPromptForContextualizer?: string;
    }
  ) => {
    const { processState: initialProcessState } = latestStateRef.current;
    if (isProcessingRef.current) return;

    let { currentMajorVersion, currentMinorVersion, currentProduct } = initialProcessState;

    if (currentMajorVersion === 0 && currentMinorVersion === 0 && initialProcessState.iterationHistory.length === 0) {
        let iterZeroProduct = "";
        if (initialProcessState.loadedFiles.length === 0 && initialProcessState.initialPrompt.trim() !== "") {
            iterZeroProduct = initialProcessState.initialPrompt;
        } else if (initialProcessState.currentProduct) {
            iterZeroProduct = initialProcessState.currentProduct;
        }
        currentProduct = iterZeroProduct;
        logIterationData({ major: 0, minor: 0 }, 'initial_state', iterZeroProduct, "Initial state loaded.", "", undefined, undefined, { filesSentToApiIteration: null, numberOfFilesActuallySent: initialProcessState.loadedFiles.length, totalFilesSizeBytesSent: initialProcessState.loadedFiles.reduce((s,f) => s+f.size, 0), fileManifestProvidedCharacterCount: initialProcessState.initialPrompt.length });
        updateProcessState({ currentProduct: iterZeroProduct, currentMajorVersion: 0, currentMinorVersion: 0 });
        await performAutoSave();
    }
    
    updateProcessState({
        finalProduct: null,
        currentProductBeforeHalt: null,
        currentVersionBeforeHalt: undefined,
        isApiRateLimited: false,
        rateLimitCooldownActiveSeconds: 0,
    });

    runIterationLoop(options);
  }, [latestStateRef, logIterationData, updateProcessState, performAutoSave, runIterationLoop]);

  const handleAcceptStrategy = useCallback(async () => {
    const { processState } = latestStateRef.current;
    const { pendingStrategySuggestion } = processState;
    if (!pendingStrategySuggestion || !processState.awaitingStrategyDecision) return;

    updateProcessState({
      awaitingStrategyDecision: false,
      pendingStrategySuggestion: null,
      currentAppliedModelConfig: pendingStrategySuggestion.config,
      currentModelForIteration: pendingStrategySuggestion.modelName,
      activeMetaInstructionForNextIter: pendingStrategySuggestion.activeMetaInstruction,
      statusMessage: "Strategy accepted. Resuming process...",
      aiProcessInsight: `Accepted Strategy: ${pendingStrategySuggestion.rationale}`
    });

    // Use a short timeout to allow state to update before resuming the heavy process
    setTimeout(() => runIterationLoop(), 50);

  }, [latestStateRef, updateProcessState, runIterationLoop]);

  const handleIgnoreStrategy = useCallback(async () => {
    const { processState } = latestStateRef.current;
    if (!processState.awaitingStrategyDecision) return;
    
    updateProcessState({
      awaitingStrategyDecision: false,
      pendingStrategySuggestion: null,
      statusMessage: "Strategy ignored. Resuming with previous configuration...",
    });
    
    setTimeout(() => runIterationLoop(), 50);
  }, [latestStateRef, updateProcessState, runIterationLoop]);
  
  const handleBootstrapSynthesis = useCallback(async () => {
    // This logic remains largely the same as it's a distinct starting process
    const { processState: initialProcessState, getUserSetBaseConfig: getBaseConfig } = latestStateRef.current;
    if (isProcessingRef.current || initialProcessState.loadedFiles.length < 2) {
      updateProcessState({ statusMessage: "Ensemble synthesis requires at least 2 files and cannot run while another process is active." });
      return;
    }

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    updateProcessState({ isProcessing: true, statusMessage: "Starting Ensemble Synthesis...", iterationHistory: [], currentMajorVersion: 0, currentMinorVersion: 0, currentProduct: null });

    const subProducts: string[] = [];
    const userBaseConfig = getBaseConfig();
    const originalLoadedFiles = [...initialProcessState.loadedFiles];

    for (let i = 0; i < initialProcessState.bootstrapSamples; i++) {
      const shuffled = [...originalLoadedFiles].sort(() => 0.5 - Math.random());
      const sampleSize = Math.max(1, Math.round(shuffled.length * (initialProcessState.bootstrapSampleSizePercent / 100)));
      const sampledFiles = shuffled.slice(0, sampleSize);
      const sampleManifest = `Ensemble Sample ${i + 1}: ${sampledFiles.map(f => f.name).join(', ')}.`;
      let productForThisSample = "";

      for (let j = 0; j < initialProcessState.bootstrapSubIterations; j++) {
        const currentVersion: Version = { major: 0, minor: 0, patch: i * initialProcessState.bootstrapSubIterations + j + 1 };
        if (haltSignalRef.current) { handleProcessHalt(currentVersion, productForThisSample, "Ensemble process halted by user."); return; }
        
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
          handleProcessHalt(currentVersion, apiResult.product, `Error during ensemble sample ${i + 1}: ${apiResult.errorMessage || 'Process Halted'}`);
          return;
        }

        const prevProductForLog = productForThisSample;
        productForThisSample = apiResult.product;
        logIterationData(
          currentVersion,
          'ensemble_sub_iteration',
          productForThisSample,
          `Sample ${i + 1}, Sub-run ${j + 1}`,
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
          i + 1
        );
      }
      subProducts.push(productForThisSample);
    }

    updateProcessState({ ensembleSubProducts: subProducts });

    const integrationVersion: Version = { major: 0, minor: 0 };
    if (haltSignalRef.current) { handleProcessHalt(integrationVersion, null, "Ensemble process halted by user before final integration."); return; }
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
      currentIterationOverall: 1, // For prompt context
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
      ensembleSubProducts: subProducts,
    });

    if (finalApiResult.status === 'ERROR' || finalApiResult.status === 'HALTED') {
      handleProcessHalt(integrationVersion, finalApiResult.product, `Error during final ensemble integration: ${finalApiResult.errorMessage || 'Process Halted'}`);
      return;
    }
    
    const finalSynthesizedProduct = finalApiResult.product;
    logIterationData(
      integrationVersion,
      'ensemble_integration',
      finalSynthesizedProduct,
      'Final Ensemble Integration',
      subProducts.join('\n\n---\n\n'),
      finalApiResult,
      userBaseConfig,
      { filesSentToApiIteration: 0, numberOfFilesActuallySent: integrationFiles.length, totalFilesSizeBytesSent: integrationFiles.reduce((s, f) => s + f.size, 0), fileManifestProvidedCharacterCount: integrationManifest.length },
      undefined, // aiValidationInfo
      finalSynthesizedProduct?.length, // directAiResponseLengthChars_param
      finalSynthesizedProduct?.length, // processedProductLengthChars_param
      undefined, // attemptCount
      undefined, // strategyRationale
      initialProcessState.selectedModelName, // currentModelForIteration
      undefined, // activeMetaInstruction
      undefined, // isCriticalFailure
      undefined, // targetedSelection
      undefined, // targetedRefinementInstructions
      undefined, // similarityWithPreviousLogged
      undefined, // isStagnantIterationLogged
      undefined, // isEffectivelyIdenticalLogged
      undefined, // isLowValueIterationLogged
      undefined  // bootstrapRun
    );

    updateProcessState({
      isProcessing: false,
      statusMessage: "Ensemble Synthesis complete. Ready for main iterative process.",
      initialPrompt: `Product synthesized via ensemble sub-sampling from ${originalLoadedFiles.length} files. Original Objective: ${initialProcessState.initialPrompt}`,
      loadedFiles: [], 
      currentProduct: finalSynthesizedProduct,
      finalProduct: null,
      currentMajorVersion: 0,
      currentMinorVersion: 0, 
      activeMetaInstructionForNextIter: "The process will now refine a robustly synthesized document created via an ensemble method (bootstrapping). This baseline represents a statistical 'mean' of the source material.",
    });
    isProcessingRef.current = false;
    await performAutoSave();
  }, [latestStateRef, updateProcessState, logIterationData, performAutoSave, onStreamChunk, handleHaltProcess]);


  return { handleStartProcess, handleHaltProcess, handleBootstrapSynthesis, handleAcceptStrategy, handleIgnoreStrategy };
};
