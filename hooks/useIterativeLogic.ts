



import { useRef, useState, useCallback, useEffect } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, IsLikelyAiErrorResponseResult, IterationEntryType, DevLogEntry, StrategistLLMContext, Version, ModelStrategy, OutlineNode, DocumentChunk } from '../types/index.ts';
import { SELECTABLE_MODELS } from '../types/index.ts';
import * as GeminaiService from '../services/geminiService.ts';
import { getUserPromptComponents } from '../services/promptBuilderService.ts';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput } from '../services/iterationUtils.ts';
import * as ModelStrategyService from '../services/ModelStrategyService.ts';
import { calculateQualitativeStates } from '../services/strategistUtils.ts';
import { calculateFleschReadingEase, calculateJaccardSimilarity, calculateLexicalDensity, calculateAvgSentenceLength, calculateSimpleTTR } from '../services/textAnalysisService.ts';
import type { AddLogEntryParams } from './useProcessState.ts';
import { getRelevantDevLogContext } from '../services/devLogContextualizerService.ts';
import { reconstructProduct } from '../services/diffService.ts';
import { splitToChunks, reconstructFromChunks } from '../services/chunkingService.ts';


const SELF_CORRECTION_MAX_ATTEMPTS = 2;

const STAGNATION_SIMILARITY_THRESHOLD = 0.95;
const CONTEXT_WINDOW_SIZE = 20;
const CONTEXT_WINDOW_OVERLAP = 5;

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
    isWordsmithingIterationLogged?: boolean,
    bootstrapRun?: number
  ) => {
    const directResponseHead = iterationProductForLog ? iterationProductForLog.substring(0, 500) : "";
    const directResponseTail = iterationProductForLog && iterationProductForLog.length > 500 ? iterationProductForLog.substring(iterationProductForLog.length - 500) : "";

    addLogEntryFromHook({
      majorVersion: version.major,
      minorVersion: version.minor,
      patchVersion: version.patch,
      entryType: entryType,
      currentFullProduct: iterationProductForLog,
      status: statusMessage,
      previousFullProduct: previousProductForLog,
      readabilityScoreFlesch: calculateFleschReadingEase(iterationProductForLog),
      lexicalDensity: calculateLexicalDensity(iterationProductForLog), 
      avgSentenceLength: calculateAvgSentenceLength(iterationProductForLog), 
      typeTokenRatio: calculateSimpleTTR(iterationProductForLog), 
      versionRationale: apiResult?.versionRationale,
      selfCritique: apiResult?.selfCritique,
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
      processedProductHead: iterationProductForLog ? iterationProductForLog.substring(0, 500) : "",
      processedProductTail: iterationProductForLog && iterationProductForLog.length > 500 ? iterationProductForLog.substring(iterationProductForLog.length - 500) : "",
      processedProductLengthChars: iterationProductForLog?.length,
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
      isWordsmithingIterationLogged,
      bootstrapRun,
    });
  }, [addLogEntryFromHook]);

  const handleProcessHalt = useCallback((
    currentVersionForHalt: Version, 
    lastGoodProduct: string | null, 
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
      currentProduct: lastGoodProduct, // Revert to the last known good product
      streamBuffer: null,
      currentProductBeforeHalt: lastGoodProduct,
      currentVersionBeforeHalt: currentVersionForHalt,
    });
  }, [updateProcessState]);

  const handleStartProcess = useCallback(async (options?: { isTargetedRefinement?: boolean; targetedSelection?: string; targetedInstructions?: string, userRawPromptForContextualizer?: string }) => {
    const { processState: initialProcessState, getUserSetBaseConfig: getInitialUserConfig } = latestStateRef.current;
    if (initialProcessState.isProcessing) return;

    if (!initialProcessState.projectCodename) {
      updateProcessState({
        statusMessage: 'Generating project codename...',
        aiProcessInsight: 'Analyzing input to create a unique codename for this run.',
      });
      const codename = await GeminaiService.generateProjectCodename(
        initialProcessState.initialPrompt,
        initialProcessState.loadedFiles
      );
      updateProcessState({ projectCodename: codename });
    }

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    currentStreamBufferRef.current = "";

    updateProcessState({
      isProcessing: true,
      statusMessage: 'Starting process...',
      streamBuffer: null,
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
      ensembleSubProducts,
      documentChunks,
      isOutlineMode,
      outlineId,
      currentOutline,
    } = initialProcessState;

    let currentFocusChunkIndex = initialProcessState.currentFocusChunkIndex ?? 0;

    // Ensure product string is reconstructed from chunks if they exist
    if (!isOutlineMode && documentChunks && documentChunks.length > 0) {
      currentProductForIteration = reconstructFromChunks(documentChunks);
    }
    
    if (initialProcessState.ensembleSubProducts && !isTargetedRefinementMode) {
        addDevLogEntry({ type: 'note', status: 'in_progress', summary: 'Starting main process: Ensemble Integration' });
    } else if (isTargetedRefinementMode) {
        addDevLogEntry({ type: 'note', status: 'in_progress', summary: 'Starting main process: Targeted Refinement' });
    } else {
        addDevLogEntry({ type: 'note', status: 'in_progress', summary: 'Starting main process: Standard Iteration' });
    }

    if (isTargetedRefinementMode && !targetedSelectionText) {
      handleProcessHalt({major: majorVersionForIteration, minor: minorVersionForIteration, patch: 0}, currentProductForIteration, "Targeted refinement started without a text selection.");
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

    // The for loop provides a hard limit on total iterations in a single run.
    for (let loopCounter = 0; loopCounter < maxMajorVersions; loopCounter++) {
      if (haltSignalRef.current) {
        handleProcessHalt({major: majorVersionForIteration, minor: minorVersionForIteration, patch: 0}, currentProductForIteration, "Halt signal received. Process stopped.");
        break;
      }
      
      const previousProductForLog = isOutlineMode ? JSON.stringify(currentOutline, null, 2) : currentProductForIteration;
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
      
      const currentVersionForLoop: Version = {major: majorVersionForIteration, minor: minorVersionForIteration, patch: 0};
      
      updateProcessState({
        currentMajorVersion: majorVersionForIteration,
        currentMinorVersion: minorVersionForIteration,
        statusMessage: `Preparing for Iteration v${majorVersionForIteration}.${minorVersionForIteration}...`,
      });

      const userSetBaseConfig = getInitialUserConfig();

      if (stagnationInfo.consecutiveWordsmithingIterations >= 2) {
        kickstart = true;
        stagnationInfo.consecutiveWordsmithingIterations = 0;
      }

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
          currentStreamBufferRef.current = accumulatedText;
          // Update the transient stream buffer for UI feedback
          updateProcessState({ streamBuffer: currentStreamBufferRef.current });
        }
      };

      currentStreamBufferRef.current = "";
      updateProcessState({ streamBuffer: "" }); // Clear buffer at start of attempt
      let attempt = 0;
      let result: IterateProductResult | null = null;
      let validationInfo: AiResponseValidationInfo = { checkName: 'N/A', passed: true, reason: 'Validation not run.' };
      let isCriticalFailure = false;
      let finalProduct = "";
      let finalOutline: OutlineNode[] | null = null;
      let finalOutlineId: string | null = null;
      let updatedChunksFromApi: DocumentChunk[] | undefined = undefined;


      let retryContext: RetryContext | undefined = undefined;

      while (attempt < SELF_CORRECTION_MAX_ATTEMPTS) {
        if (haltSignalRef.current) {
          handleProcessHalt(currentVersionForLoop, currentProductForIteration, 'Halt signal received. Process stopped.');
          return;
        }

        updateProcessState({ statusMessage: `Iteration v${majorVersionForIteration}.${minorVersionForIteration}: Running... (Attempt ${attempt + 1})`});
        
        result = await GeminaiService.iterateProduct({
            currentProduct: currentProductForIteration,
            documentChunks,
            currentOutline,
            currentFocusChunkIndex,
            currentVersion: currentVersionForLoop,
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
            isOutlineMode,
            addDevLogEntry,
        });
        
        if (result.status === 'ERROR' || result.status === 'HALTED') {
          if (result.isRateLimitError) handleRateLimitErrorEncountered();
          handleProcessHalt(currentVersionForLoop, currentProductForIteration, result.errorMessage || 'Unknown error occurred.', result);
          return; 
        }

        if (isOutlineMode) {
          finalOutline = result.outline || null;
          finalOutlineId = result.outlineId || null;
          finalProduct = result.product;
        } else {
          finalProduct = result.product;
          updatedChunksFromApi = result.updatedChunks;
        }
        
        const isConverged = result.suggestedNextStep === 'declare_convergence' || result.status === 'CONVERGED';

        const validationResult: IsLikelyAiErrorResponseResult = isLikelyAiErrorResponse(
            finalProduct,
            previousProductForLog || "",
            {
                majorVersion: majorVersionForIteration, minorVersion: minorVersionForIteration, patchVersion: 0,
                entryType: 'ai_iteration', productSummary: "", status: "", timestamp: 0, fileProcessingInfo: fileProcessingInfoForLog,
                apiStreamDetails: result.apiStreamDetails,
            },
            undefined, 
            undefined, 
            undefined
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
            
            const modelDataForRetry = SELECTABLE_MODELS.find(m => m.name === modelStrategy.modelName);
            const isUsingToolsForRetry = isSearchGroundingEnabled || (isUrlBrowsingEnabled && !!modelDataForRetry?.supportsFunctionCalling);

            retryContext = {
                previousErrorReason: validationInfo.reason,
                originalCoreInstructions: getUserPromptComponents(currentVersionForLoop, maxMajorVersions, null, false, 0, false, true, false, !isUsingToolsForRetry, isOutlineMode).coreUserInstructions,
            };
            updateProcessState({statusMessage: `Iteration v${majorVersionForIteration}.${minorVersionForIteration}: Validation failed. Retrying...`});
            accumulatedText = "";
            currentStreamBufferRef.current = "";
            updateProcessState({ streamBuffer: "" }); // Clear buffer for retry
        } else {
            break;
        }
      }
      
      // The `finalProduct` is the raw string from the API. We need a canonical version
      // for logging and state to ensure consistency, especially for JSON-based modes.
      let canonicalProduct = finalProduct;
      if (isOutlineMode && finalProduct) {
        canonicalProduct = parseAndCleanJsonOutput(finalProduct);
      }

      const newLexicalDensity = calculateLexicalDensity(canonicalProduct);
      const newTTR = calculateSimpleTTR(canonicalProduct);
      const prevLogEntry = iterationHistory.length > 0 ? iterationHistory[iterationHistory.length - 1] : null;

      let coherenceDegraded = false;
      if (prevLogEntry && !isTargetedRefinementMode && !isOutlineMode) {
          const prevLexicalDensity = prevLogEntry.lexicalDensity;
          const prevTTR = prevLogEntry.typeTokenRatio;
          const lexicalDensityDrop = prevLexicalDensity && newLexicalDensity && newLexicalDensity < prevLexicalDensity * 0.95; // 5% drop
          const ttrDrop = prevTTR && newTTR && newTTR < prevTTR * 0.95; // 5% drop
          if (lexicalDensityDrop || ttrDrop) {
              coherenceDegraded = true;
          }
      }

      const similarity = calculateJaccardSimilarity(previousProductForLog, canonicalProduct);
      const isStagnant = similarity > STAGNATION_SIMILARITY_THRESHOLD;
      const isEffectivelyIdentical = similarity > 0.99;
      const isLowValue = isStagnant && !isEffectivelyIdentical;
      const isWordsmithing = similarity > 0.97 && similarity < 0.995 && !isLowValue && !isEffectivelyIdentical;

      let newStagnationInfo: StagnationInfo = { ...stagnationInfo };
      if (isEffectivelyIdentical) {
        newStagnationInfo.consecutiveIdenticalProductIterations++;
        newStagnationInfo.consecutiveStagnantIterations++;
        newStagnationInfo.consecutiveWordsmithingIterations = 0;
      } else if (isWordsmithing) {
        newStagnationInfo.consecutiveWordsmithingIterations++;
        newStagnationInfo.consecutiveStagnantIterations++;
        newStagnationInfo.consecutiveIdenticalProductIterations = 0;
      } else if (isLowValue) {
        newStagnationInfo.consecutiveLowValueIterations++;
        newStagnationInfo.consecutiveStagnantIterations++;
        newStagnationInfo.consecutiveIdenticalProductIterations = 0;
        newStagnationInfo.consecutiveWordsmithingIterations = 0;
      } else {
        newStagnationInfo = { ...stagnationInfo, isStagnant: false, consecutiveStagnantIterations: 0, consecutiveIdenticalProductIterations: 0, consecutiveLowValueIterations: 0, consecutiveWordsmithingIterations: 0, consecutiveCoherenceDegradation: 0 };
      }

      if (coherenceDegraded) {
          newStagnationInfo.consecutiveCoherenceDegradation = (newStagnationInfo.consecutiveCoherenceDegradation || 0) + 1;
      } else if (!isStagnant) {
          newStagnationInfo.consecutiveCoherenceDegradation = 0;
      }
      
      logIterationData(
        currentVersionForLoop,
        isTargetedRefinementMode ? 'targeted_refinement' : 'ai_iteration',
        canonicalProduct,
        result?.status || 'UNKNOWN',
        previousProductForLog,
        result || undefined,
        modelStrategy.config,
        fileProcessingInfoForLog,
        validationInfo,
        accumulatedText.length,
        canonicalProduct.length,
        attempt + 1,
        modelStrategy.rationale,
        modelStrategy.modelName,
        modelStrategy.activeMetaInstruction,
        isCriticalFailure,
        isTargetedRefinementMode ? targetedSelectionText : undefined,
        isTargetedRefinementMode ? targetedRefinementInstructions : undefined,
        similarity,
        isStagnant,
        isEffectivelyIdentical,
        isLowValue,
        isWordsmithing
      );
      
      currentProductForIteration = canonicalProduct;
      
      if (isOutlineMode) {
        try {
          currentOutline = canonicalProduct ? JSON.parse(canonicalProduct) : null;
        } catch(e) {
            console.error("Could not parse outline for next iteration state: ", e);
            currentOutline = null;
        }
      } else {
        // This is the critical fix. If we got here from initial synthesis,
        // updatedChunksFromApi will be empty, but canonicalProduct will have content.
        // We must chunk the canonicalProduct to prepare for the next iteration.
        if (updatedChunksFromApi && updatedChunksFromApi.length > 0) {
            documentChunks = updatedChunksFromApi;
        } else if (canonicalProduct) {
            documentChunks = splitToChunks(canonicalProduct);
        } else {
            documentChunks = [];
        }

        let newFocusIndex = currentFocusChunkIndex + (CONTEXT_WINDOW_SIZE - CONTEXT_WINDOW_OVERLAP);
        if (documentChunks && newFocusIndex >= documentChunks.length && documentChunks.length > 0) {
            newFocusIndex = 0; // Loop back to start
        }
        currentFocusChunkIndex = newFocusIndex;
      }
      
      updateProcessState({
          currentProduct: canonicalProduct,
          outlineId: finalOutlineId || outlineId,
          currentOutline: currentOutline,
          documentChunks: documentChunks,
          currentFocusChunkIndex: currentFocusChunkIndex,
          stagnationInfo: newStagnationInfo,
          streamBuffer: null,
      });
      
      // CRITICAL FIX: Clear ensemble products after the integration step (v1.0)
      // so that subsequent iterations perform standard refinement.
      const wasEnsembleIntegration = !!ensembleSubProducts;
      if (wasEnsembleIntegration) {
          updateProcessState({ ensembleSubProducts: null });
          ensembleSubProducts = null; // Also clear the local variable for the next loop
      }

      performAutoSave();

      const isConverged = result?.suggestedNextStep === 'declare_convergence' || result?.status === 'CONVERGED';

      if (isConverged || isCriticalFailure) {
        handleProcessHalt(currentVersionForLoop, canonicalProduct, isCriticalFailure ? validationInfo.reason : 'AI declared convergence.', result);
        updateProcessState({ finalProduct: canonicalProduct, outlineId: finalOutlineId, finalOutline: currentOutline, configAtFinalization: modelStrategy.config });
        break;
      }

      if (!isTargetedRefinementMode) {
        minorVersionForIteration++;
      } else {
        handleProcessHalt(currentVersionForLoop, canonicalProduct, 'Targeted refinement completed.');
        break;
      }

      if (minorVersionForIteration >= maxMajorVersions) {
          handleProcessHalt(currentVersionForLoop, canonicalProduct, 'Maximum number of iterations reached.');
          updateProcessState({ finalProduct: canonicalProduct, outlineId: finalOutlineId, finalOutline: currentOutline, configAtFinalization: modelStrategy.config });
          break;
      }
    }
    
    isProcessingRef.current = false;
  }, [latestStateRef, updateProcessState, addLogEntryFromHook, addDevLogEntry, handleProcessHalt, performAutoSave, handleRateLimitErrorEncountered, logIterationData]);

  const handleHaltProcess = useCallback(() => {
    haltSignalRef.current = true;
  }, []);

  const handleBootstrapSynthesis = useCallback(async () => {
    const { processState: initialProcessState, getUserSetBaseConfig: getInitialUserConfig } = latestStateRef.current;
    if (initialProcessState.isProcessing || initialProcessState.loadedFiles.length < 2) {
      updateProcessState({ statusMessage: "Ensemble Synthesis requires at least 2 loaded files."});
      return;
    }

    if (!initialProcessState.projectCodename) {
        updateProcessState({ statusMessage: 'Generating project codename...'});
        const codename = await GeminaiService.generateProjectCodename(initialProcessState.initialPrompt, initialProcessState.loadedFiles);
        updateProcessState({ projectCodename: codename });
    }

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    
    const { loadedFiles, bootstrapSamples, bootstrapSampleSizePercent, selectedModelName, isOutlineMode } = initialProcessState;
    const sampleSizePercent = isOutlineMode ? 100 : bootstrapSampleSizePercent;
    const sampleSize = Math.max(1, Math.floor(loadedFiles.length * (sampleSizePercent / 100)));

    addDevLogEntry({
        type: 'note',
        status: 'in_progress',
        summary: 'Starting Ensemble Synthesis',
        details: `Generating ${initialProcessState.bootstrapSamples} samples from ${loadedFiles.length} files. Sample size: ${sampleSize} files (${sampleSizePercent}%). Mode: ${isOutlineMode ? 'Outline' : 'Text'}.`
    });

    updateProcessState({
        isProcessing: true,
        statusMessage: `Starting Ensemble Synthesis with ${initialProcessState.bootstrapSamples} samples...`,
        aiProcessInsight: 'Generating diverse outlines from file samples.',
        iterationHistory: [], // Clear history for the new synthesis
        currentMajorVersion: 0,
        currentMinorVersion: 0,
    });
    
    const subProducts: string[] = [];
    const subOutlines: OutlineNode[][] = [];

    for (let i = 0; i < bootstrapSamples; i++) {
        if (haltSignalRef.current) {
            handleProcessHalt({major:0, minor:0, patch:i}, null, "Halt signal received during ensemble synthesis.");
            return;
        }

        updateProcessState({ statusMessage: `Ensemble Synthesis: Processing sample ${i + 1} of ${bootstrapSamples}...` });
        
        addDevLogEntry({
            type: 'note',
            status: 'in_progress',
            summary: `Ensemble: Processing sample ${i + 1}/${bootstrapSamples}`
        });

        const shuffled = [...loadedFiles].sort(() => 0.5 - Math.random());
        const sampleFiles = shuffled.slice(0, sampleSize);
        const sampleFileManifest = `Input consists of ${sampleFiles.length} file(s): ${sampleFiles.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)}KB)`).join('; ')}.`;
        
        const result = await GeminaiService.generateInitialOutline(
            sampleFileManifest, 
            sampleFiles, 
            getInitialUserConfig(), 
            selectedModelName,
            isOutlineMode
        );

        if (result.errorMessage) {
            addDevLogEntry({
                type: 'issue',
                status: 'closed',
                summary: `Ensemble sample ${i + 1} failed`,
                details: result.errorMessage,
                tags: ['ensemble-synthesis', 'error']
            });
            handleProcessHalt({major:0, minor:0, patch:i}, null, `Error in ensemble sample ${i+1}: ${result.errorMessage}`);
            return;
        }
        
        let productForLog: string;
        if (isOutlineMode && result.outlineNodes) {
            subOutlines.push(result.outlineNodes);
            productForLog = JSON.stringify(result.outlineNodes, null, 2);
            // This is the first point an outlineId might be generated for a sub-product
            // but we only care about the final integrated one. So we don't save this sub-ID.
        } else {
            subProducts.push(result.outline);
            productForLog = result.outline;
        }
        
        addDevLogEntry({
            type: 'note',
            status: 'implemented',
            summary: `Ensemble sample ${i + 1} completed`,
            details: `Generated outline/product of length ${productForLog.length}.`,
            relatedIteration: `v0.0.${i}`,
            tags: ['ensemble-synthesis', 'success']
        });
        
        logIterationData(
            { major: 0, minor: 0, patch: i },
            'ensemble_sub_iteration',
            productForLog,
            `Ensemble Sample ${i+1} Processed`,
            null, // No previous product
            undefined, // No iterateProduct result
            getInitialUserConfig(),
            { filesSentToApiIteration: sampleFiles.length, numberOfFilesActuallySent: sampleFiles.length, totalFilesSizeBytesSent: sampleFiles.reduce((s, f) => s + f.size, 0), fileManifestProvidedCharacterCount: sampleFileManifest.length, loadedFilesForIterationContext: sampleFiles },
            undefined, // No validation info
            productForLog.length
        );
    }
    
    const subProductsForIntegration = isOutlineMode ? subOutlines.map(o => JSON.stringify(o, null, 2)) : subProducts;
    const totalChars = subProductsForIntegration.reduce((sum, p) => sum + p.length, 0);
    
    addDevLogEntry({
        type: 'note',
        status: 'in_progress',
        summary: 'Ensemble samples processed, starting integration.',
        details: `Total characters from ${subProductsForIntegration.length} sub-products to be integrated: ${totalChars.toLocaleString()}.`
    });
    
    updateProcessState({
        ensembleSubProducts: subProductsForIntegration,
        statusMessage: "All samples processed. Integrating results into final base document...",
        aiProcessInsight: "Synthesizing a coherent document from diverse outlines."
    });

    // Final Integration Step using handleStartProcess
    await handleStartProcess();
    
    isProcessingRef.current = false;

  }, [latestStateRef, updateProcessState, logIterationData, handleProcessHalt, handleStartProcess, addDevLogEntry]);

  return {
    handleStartProcess,
    handleHaltProcess,
    handleBootstrapSynthesis,
  };
};
