




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
    currentVersionForHalt: Version, 
    currentProdForHalt: string | null, 
    haltMessage: string, 
    apiResult?: IterateProductResult
  ) => {
    isProcessingRef.current = false;
    haltSignalRef.current = false;
    currentStreamBufferRef.current = "";
    const finalHaltMessage = `Halted at v${currentVersionForHalt.major}.${currentVersionForHalt.minor}. ${haltMessage}`;
    updateProcessState({
      isProcessing: false,
      statusMessage: finalHaltMessage,
      aiProcessInsight: apiResult?.errorMessage || 'User initiated halt.',
      currentProductBeforeHalt: currentProdForHalt,
      currentVersionBeforeHalt: currentVersionForHalt,
    });
  }, [updateProcessState]);

  const handleStartProcess = useCallback(async (options?: { isTargetedRefinement?: boolean; targetedSelection?: string; targetedInstructions?: string, userRawPromptForContextualizer?: string }) => {
    const { processState: initialProcessState, getUserSetBaseConfig: getInitialUserConfig } = latestStateRef.current;
    if (initialProcessState.isProcessing) return;

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    currentStreamBufferRef.current = "";

    updateProcessState({
      isProcessing: true,
      statusMessage: 'Starting process...',
      aiProcessInsight: 'Initializing...',
      finalProduct: null,
      configAtFinalization: null,
      currentProductBeforeHalt: null,
      currentVersionBeforeHalt: undefined,
      isApiRateLimited: false,
      rateLimitCooldownActiveSeconds: 0,
      awaitingStrategyDecision: false,
    });

    const isTargetedRefinementMode = options?.isTargetedRefinement ?? false;
    const targetedSelectionText = options?.targetedSelection;
    const targetedRefinementInstructions = options?.targetedInstructions;
    const userRawPromptForContextualizer = options?.userRawPromptForContextualizer;

    let {
      currentProduct: currentProductForIteration,
      currentMajorVersion: majorVersionForIteration,
      currentMinorVersion: minorVersionForIteration,
      maxMajorVersions,
      initialPrompt,
      loadedFiles,
      isPlanActive,
      planStages,
      currentPlanStageIndex,
      currentStageIteration,
      iterationHistory,
      outputParagraphNumberedHeadings,
      outputParagraphShowHeadings,
      outputParagraphMaxHeadingDepth,
      stagnationInfo,
      selectedModelName,
      stagnationNudgeEnabled,
      strategistInfluenceLevel,
      stagnationNudgeAggressiveness,
      inputComplexity,
      devLog,
      ensembleSubProducts
    } = initialProcessState;

    if (isTargetedRefinementMode && !targetedSelectionText) {
      handleProcessHalt({major: majorVersionForIteration, minor: minorVersionForIteration}, currentProductForIteration, "Targeted refinement started without a text selection.");
      return;
    }
    
    // Increment version for the new run
    if (!isTargetedRefinementMode) {
        majorVersionForIteration += 1;
        minorVersionForIteration = 0;
    } else {
        minorVersionForIteration += 1;
    }

    const { isSearchGroundingEnabled, isUrlBrowsingEnabled } = initialProcessState;

    for (let currentIteration = 1; currentIteration <= maxMajorVersions; currentIteration++) {
      if (haltSignalRef.current) {
        handleProcessHalt({major: majorVersionForIteration, minor: minorVersionForIteration}, currentProductForIteration, "Halt signal received before loop start.");
        break;
      }
      
      const previousProductForLog = currentProductForIteration;
      let kickstart = false;

      let fileProcessingInfoForLog: FileProcessingInfo = {
        filesSentToApiIteration: null,
        numberOfFilesActuallySent: 0,
        totalFilesSizeBytesSent: 0,
        fileManifestProvidedCharacterCount: initialPrompt.length,
        loadedFilesForIterationContext: loadedFiles
      };
      if (majorVersionForIteration === 1 && loadedFiles.length > 0) {
        fileProcessingInfoForLog.filesSentToApiIteration = 1;
        fileProcessingInfoForLog.numberOfFilesActuallySent = loadedFiles.length;
        fileProcessingInfoForLog.totalFilesSizeBytesSent = loadedFiles.reduce((sum, f) => sum + f.size, 0);
      }
      
      const currentVersionForLoop: Version = {major: majorVersionForIteration, minor: minorVersionForIteration};
      
      updateProcessState({
        currentMajorVersion: majorVersionForIteration,
        currentMinorVersion: minorVersionForIteration,
        statusMessage: `Preparing for Iteration v${majorVersionForIteration}.${minorVersionForIteration}...`,
      });

      const userSetBaseConfig = getInitialUserConfig();

      const { productDevelopmentState, stagnationSeverity, recentIterationPerformance } = calculateQualitativeStates(currentProductForIteration, stagnationInfo, inputComplexity, stagnationNudgeAggressiveness, false);
      const devLogContext = await getRelevantDevLogContext(devLog || [], userRawPromptForContextualizer || `Current task: Refine document from v${majorVersionForIteration - 1} to v${majorVersionForIteration}. Stagnation state is ${stagnationSeverity}. Product state is ${productDevelopmentState}.`);
      
      const modelStrategy = await ModelStrategyService.reevaluateStrategy({
          ...initialProcessState,
          lastNValidationSummariesString: "", 
          productDevelopmentState, stagnationSeverity, recentIterationPerformance,
          isRadicalRefinementKickstartAttempt: kickstart
        }, userSetBaseConfig);
      
      updateProcessState({
        aiProcessInsight: modelStrategy.rationale,
        currentModelForIteration: modelStrategy.modelName,
        currentAppliedModelConfig: modelStrategy.config,
        activeMetaInstructionForNextIter: modelStrategy.activeMetaInstruction,
      });

      let accumulatedText = "";
      const handleStreamChunk = (chunkText: string) => {
        if (!haltSignalRef.current) {
          accumulatedText += chunkText;
          currentStreamBufferRef.current += chunkText;
          updateProcessState({ currentProduct: previousProductForLog + currentStreamBufferRef.current });
        }
      };

      currentStreamBufferRef.current = "";
      let attempt = 0;
      let result: IterateProductResult | null = null;
      let validationInfo: AiResponseValidationInfo = { checkName: 'N/A', passed: true, reason: 'Validation not run.' };
      let isCriticalFailure = false;
      let finalProduct = "";

      let retryContext: RetryContext | undefined = undefined;

      while (attempt < SELF_CORRECTION_MAX_ATTEMPTS) {
        if (haltSignalRef.current) {
          handleProcessHalt(currentVersionForLoop, currentProductForIteration, 'Halt signal received during retry loop.');
          return;
        }

        updateProcessState({ statusMessage: `Iteration v${majorVersionForIteration}.${minorVersionForIteration}: Running... (Attempt ${attempt + 1})`});
        
        result = await GeminaiService.iterateProduct({
            currentProduct: currentProductForIteration,
            currentIterationOverall: majorVersionForIteration,
            maxIterationsOverall: maxMajorVersions,
            fileManifest: initialPrompt,
            loadedFiles,
            activePlanStage: null, 
            outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth,
            outputParagraphNumberedHeadings,
            modelConfigToUse: modelStrategy.config,
            isGlobalMode: !isPlanActive,
            isSearchGroundingEnabled,
            isUrlBrowsingEnabled,
            modelToUse: modelStrategy.modelName,
            onStreamChunk: handleStreamChunk,
            isHaltSignalled: () => haltSignalRef.current,
            retryContext,
            stagnationNudgeStrategy: stagnationInfo.nudgeStrategyApplied,
            initialOutlineForIter1: iterationHistory.find(e => e.entryType === 'initial_state')?.outlineForIter1,
            activeMetaInstruction: modelStrategy.activeMetaInstruction,
            ensembleSubProducts,
            devLogContextString: devLogContext,
            isTargetedRefinementMode,
            targetedSelectionText,
            targetedRefinementInstructions,
            isRadicalRefinementKickstart: kickstart,
        });

        if (result.status === 'ERROR' || result.status === 'HALTED') {
          if (result.isRateLimitError) handleRateLimitErrorEncountered();
          handleProcessHalt(currentVersionForLoop, currentProductForIteration, result.errorMessage || 'Unknown error occurred.', result);
          return;
        }

        finalProduct = result.product;
        const isConverged = finalProduct.trim().startsWith(CONVERGED_PREFIX);
        if (isConverged) {
            finalProduct = finalProduct.substring(CONVERGED_PREFIX.length);
        }

        const validationResult: IsLikelyAiErrorResponseResult = isLikelyAiErrorResponse(
            finalProduct,
            previousProductForLog || "",
            {
                majorVersion: majorVersionForIteration, minorVersion: minorVersionForIteration,
                entryType: 'ai_iteration', productSummary: "", status: "", timestamp: 0, fileProcessingInfo: fileProcessingInfoForLog,
                apiStreamDetails: result.apiStreamDetails,
            },
            undefined, // outline
            undefined, // length instruction
            undefined // format instruction
        );

        validationInfo = {
            checkName: "isLikelyAiErrorResponse",
            passed: !validationResult.isError,
            reason: validationResult.reason,
            details: validationResult.checkDetails,
            isCriticalFailure: validationResult.isCriticalFailure,
        };
        isCriticalFailure = validationResult.isCriticalFailure || false;
        
        if (validationInfo.passed && !isConverged) {
            break; 
        } else if (!isCriticalFailure && attempt < SELF_CORRECTION_MAX_ATTEMPTS - 1 && !isConverged) {
            attempt++;
            retryContext = {
                previousErrorReason: validationInfo.reason,
                originalCoreInstructions: getUserPromptComponents(currentVersionForLoop, maxMajorVersions, null, false, 0, false, true, false).coreUserInstructions,
            };
            updateProcessState({statusMessage: `Iteration v${majorVersionForIteration}.${minorVersionForIteration}: Validation failed. Retrying...`});
            accumulatedText = "";
            currentStreamBufferRef.current = "";
        } else {
            break;
        }
      }
      
      const similarity = calculateJaccardSimilarity(previousProductForLog, finalProduct);
      const isStagnant = similarity > STAGNATION_SIMILARITY_THRESHOLD;
      const isEffectivelyIdentical = similarity > 0.99;
      const isLowValue = isStagnant && !isEffectivelyIdentical;

      let newStagnationInfo: StagnationInfo = { ...stagnationInfo };
      if (isEffectivelyIdentical) {
        newStagnationInfo.consecutiveIdenticalProductIterations++;
        newStagnationInfo.consecutiveStagnantIterations++;
      } else if (isLowValue) {
        newStagnationInfo.consecutiveLowValueIterations++;
        newStagnationInfo.consecutiveStagnantIterations++;
        newStagnationInfo.consecutiveIdenticalProductIterations = 0;
      } else {
        newStagnationInfo = { ...stagnationInfo, isStagnant: false, consecutiveStagnantIterations: 0, consecutiveIdenticalProductIterations: 0, consecutiveLowValueIterations: 0 };
      }
      
      logIterationData(
        currentVersionForLoop,
        isTargetedRefinementMode ? 'targeted_refinement' : 'ai_iteration',
        finalProduct,
        `Completed Iteration ${currentVersionForLoop.major}.${currentVersionForLoop.minor}`,
        previousProductForLog,
        result,
        modelStrategy.config,
        fileProcessingInfoForLog,
        validationInfo,
        accumulatedText.length,
        finalProduct.length,
        attempt + 1,
        modelStrategy.rationale,
        modelStrategy.modelName,
        modelStrategy.activeMetaInstruction,
        isCriticalFailure,
        targetedSelectionText,
        targetedRefinementInstructions,
        similarity,
        isStagnant,
        isEffectivelyIdentical,
        isLowValue
      );
      
      currentProductForIteration = finalProduct;
      updateProcessState({ currentProduct: finalProduct, stagnationInfo: newStagnationInfo });
      
      if (result.status === 'CONVERGED' || result.status === 'HALTED' || result.status === 'ERROR' || isCriticalFailure) {
        updateProcessState({
          isProcessing: false,
          finalProduct: currentProductForIteration,
          statusMessage: `Process ended: ${isCriticalFailure ? 'Critical validation failure' : result.status}.`,
          configAtFinalization: modelStrategy.config,
        });
        isProcessingRef.current = false;
        break;
      }
      
      if (majorVersionForIteration >= maxMajorVersions) {
        updateProcessState({
          isProcessing: false,
          finalProduct: currentProductForIteration,
          statusMessage: 'Process ended: Reached max iterations.',
          configAtFinalization: modelStrategy.config,
        });
        isProcessingRef.current = false;
        break;
      }

      await performAutoSave();

      if (isTargetedRefinementMode) {
        updateProcessState({
            isProcessing: false,
            statusMessage: `Targeted refinement to v${majorVersionForIteration}.${minorVersionForIteration} complete.`,
            instructionsForSelectionRefinement: "",
            currentTextSelectionForRefinement: null,
        });
        isProcessingRef.current = false;
        break; // Exit the loop after one targeted refinement
      }
      
      majorVersionForIteration++;
    }
  }, [updateProcessState, logIterationData, handleProcessHalt, addDevLogEntry, performAutoSave, handleRateLimitErrorEncountered]);
  
  const handleHaltProcess = () => {
    haltSignalRef.current = true;
  };

  const handleBootstrapSynthesis = async () => {
    const { loadedFiles, bootstrapSamples, bootstrapSampleSizePercent, bootstrapSubIterations } = latestStateRef.current.processState;
    if (loadedFiles.length < 2) {
      updateProcessState({ statusMessage: "Need at least 2 files for ensemble synthesis." });
      return;
    }
    
    isProcessingRef.current = true;
    haltSignalRef.current = false;
    updateProcessState({
        isProcessing: true,
        statusMessage: 'Starting ensemble synthesis...',
        aiProcessInsight: 'Preparing file samples for sub-processes.',
        currentProduct: null,
        iterationHistory: [],
        currentMajorVersion: 0,
        currentMinorVersion: 0,
        finalProduct: null,
    });
    
    const samplesToRun = loadedFiles.length > 50 ? bootstrapSamples + 2 : (loadedFiles.length > 30 ? bootstrapSamples + 1 : bootstrapSamples);
    const subProducts: string[] = [];
    const baseModelConfig = latestStateRef.current.getUserSetBaseConfig();
    
    for (let i = 0; i < samplesToRun; i++) {
        if (haltSignalRef.current) break;
        
        // Stratified random sampling
        const filesByMimeType = loadedFiles.reduce((acc, file) => {
            const mimeType = file.mimeType || 'unknown';
            if (!acc[mimeType]) acc[mimeType] = [];
            acc[mimeType].push(file);
            return acc;
        }, {} as Record<string, LoadedFile[]>);

        let sampleFiles: LoadedFile[] = [];
        const sampleSize = Math.floor(loadedFiles.length * (bootstrapSampleSizePercent / 100));

        Object.values(filesByMimeType).forEach(stratum => {
            const proportion = stratum.length / loadedFiles.length;
            const countToSample = Math.ceil(proportion * sampleSize); // Use ceil to ensure small strata are represented
            const shuffled = [...stratum].sort(() => 0.5 - Math.random());
            sampleFiles.push(...shuffled.slice(0, countToSample));
        });
        
        sampleFiles = [...new Set(sampleFiles)]; // Ensure uniqueness if ceil pushes it over
        if (sampleFiles.length > sampleSize) {
            sampleFiles = sampleFiles.slice(0, sampleSize);
        }

        const sampleManifest = `Ensemble Sample ${i+1}/${samplesToRun}: ${sampleFiles.map(f => f.name).join(', ')}.`;
        updateProcessState({ statusMessage: `Running sub-process for sample ${i + 1}/${samplesToRun}...`});
        
        let subProduct = "";
        for (let j = 0; j < bootstrapSubIterations; j++) {
            if (haltSignalRef.current) break;
            
            const result = await GeminaiService.iterateProduct({
                currentProduct: subProduct,
                currentIterationOverall: j + 1,
                maxIterationsOverall: bootstrapSubIterations,
                fileManifest: sampleManifest,
                loadedFiles: sampleFiles,
                activePlanStage: null,
                outputParagraphShowHeadings: false,
                outputParagraphMaxHeadingDepth: 2,
                outputParagraphNumberedHeadings: false,
                modelConfigToUse: baseModelConfig,
                isGlobalMode: true,
                isSearchGroundingEnabled: false,
                isUrlBrowsingEnabled: false,
                modelToUse: 'gemini-2.5-flash-preview-04-17',
                onStreamChunk: () => {}, // No live streaming for sub-runs
                isHaltSignalled: () => haltSignalRef.current,
            });

            subProduct = result.product;
            
            logIterationData(
                { major: 0, minor: 0, patch: i * bootstrapSubIterations + j + 1 },
                'bootstrap_sub_iteration',
                subProduct,
                `Sample ${i + 1}, Sub-run ${j + 1}`,
                j > 0 ? subProducts[subProducts.length-1] : "", // Use previous state if available
                result,
                baseModelConfig,
                { filesSentToApiIteration: j, numberOfFilesActuallySent: sampleFiles.length, totalFilesSizeBytesSent: sampleFiles.reduce((s,f)=>s+f.size,0), fileManifestProvidedCharacterCount: sampleManifest.length },
                undefined,
                result.product.length,
                result.product.length,
                1,
                "Ensemble Sub-process run",
                'gemini-2.5-flash-preview-04-17',
                undefined,
                false, undefined, undefined, undefined, undefined, undefined, undefined,
                i+1
            );
        }
        if (subProduct) subProducts.push(subProduct);
    }
    
    if (subProducts.length > 0) {
        updateProcessState({ statusMessage: "Integrating ensemble results...", ensembleSubProducts: subProducts });
        const integrationResult = await GeminaiService.iterateProduct({
            currentProduct: "",
            currentIterationOverall: 1, // It's like the first "real" iteration
            maxIterationsOverall: 1,
            fileManifest: "Multiple ensemble sub-products generated.",
            loadedFiles: [], // Files aren't sent for integration, only sub-products
            ensembleSubProducts: subProducts,
            activePlanStage: null,
            outputParagraphShowHeadings: false,
            outputParagraphMaxHeadingDepth: 2,
            outputParagraphNumberedHeadings: false,
            modelConfigToUse: baseModelConfig,
            isGlobalMode: true,
            isSearchGroundingEnabled: false,
            isUrlBrowsingEnabled: false,
            modelToUse: 'gemini-2.5-pro', // Use a more powerful model for integration
            onStreamChunk: (chunk) => {
                const { processState: currentState } = latestStateRef.current;
                updateProcessState({ currentProduct: (currentState.currentProduct || "") + chunk });
            },
            isHaltSignalled: () => haltSignalRef.current,
        });

        logIterationData(
            { major: 0, minor: 0, patch: undefined },
            'ensemble_integration',
            integrationResult.product,
            `Ensemble Integration Complete`,
            "",
            integrationResult,
            baseModelConfig
        );
        updateProcessState({
            currentProduct: integrationResult.product,
            finalProduct: integrationResult.product, // Treat this as a final base product for now
            statusMessage: "Ensemble synthesis complete. You can now save this base product or start a refinement process.",
            aiProcessInsight: "Generated a robust base product from multiple file samples.",
        });
    } else {
         updateProcessState({ statusMessage: "Ensemble synthesis finished, but no sub-products were generated." });
    }
    
    isProcessingRef.current = false;
    updateProcessState({ isProcessing: false });
  };


  return { handleStartProcess, handleHaltProcess, handleBootstrapSynthesis };
};
