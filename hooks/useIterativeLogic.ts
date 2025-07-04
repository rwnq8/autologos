
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
    // This function now only manages the state update for a halt.
    // The isProcessingRef and haltSignalRef are managed by the lifecycle of handleStartProcess.
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
    if (isProcessingRef.current) {
        console.warn("Process is already running. Start command ignored.");
        return;
    }

    isProcessingRef.current = true;
    haltSignalRef.current = false;
    currentStreamBufferRef.current = "";

    try {
        const { processState: initialProcessState, getUserSetBaseConfig: getInitialUserConfig } = latestStateRef.current;
    
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

        // Use mutable variables for state that evolves within the loop to avoid stale closures.
        let majorVersionForIteration = initialProcessState.currentMajorVersion;
        let minorVersionForIteration = initialProcessState.currentMinorVersion;
        let documentChunksForIteration = initialProcessState.documentChunks;
        let currentOutlineForIteration = initialProcessState.currentOutline;
        let outlineIdForIteration = initialProcessState.outlineId;
        let stagnationInfo = initialProcessState.stagnationInfo;
        
        let {
            maxMajorVersions, initialPrompt, loadedFiles, isPlanActive, planStages,
            currentPlanStageIndex, currentStageIteration, iterationHistory,
            outputParagraphNumberedHeadings, outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth, selectedModelName, stagnationNudgeEnabled,
            strategistInfluenceLevel, stagnationNudgeAggressiveness, inputComplexity,
            devLog, ensembleSubProducts, isOutlineMode, isSearchGroundingEnabled, isUrlBrowsingEnabled
        } = initialProcessState;

        if (initialProcessState.ensembleSubProducts && !isTargetedRefinementMode) {
            addDevLogEntry({ type: 'note', status: 'in_progress', summary: 'Starting main process: Ensemble Integration' });
        } else if (isTargetedRefinementMode) {
            addDevLogEntry({ type: 'note', status: 'in_progress', summary: 'Starting main process: Targeted Refinement' });
        } else {
            addDevLogEntry({ type: 'note', status: 'in_progress', summary: 'Starting main process: Standard Iteration' });
        }
    
        if (isTargetedRefinementMode && !targetedSelectionText) {
          const productAtHalt = reconstructFromChunks(documentChunksForIteration);
          handleProcessHalt({major: majorVersionForIteration, minor: minorVersionForIteration, patch: 0}, productAtHalt, "Targeted refinement started without a text selection.");
          return;
        }
        
        // Increment version for the new run
        if (!isTargetedRefinementMode) {
            majorVersionForIteration += 1;
            minorVersionForIteration = 0;
        } else {
            minorVersionForIteration += 1;
        }
    
        let currentFocusChunkIndex = initialProcessState.currentFocusChunkIndex ?? 0;
    
        // The for loop provides a hard limit on total iterations in a single run.
        for (let loopCounter = 0; loopCounter < maxMajorVersions; loopCounter++) {
          if (haltSignalRef.current) {
            const productAtHalt = reconstructFromChunks(documentChunksForIteration);
            handleProcessHalt({major: majorVersionForIteration, minor: minorVersionForIteration, patch: 0}, productAtHalt, "Halt signal received. Process stopped.");
            break;
          }
          
          const productForThisIteration = reconstructFromChunks(documentChunksForIteration);
          const previousProductForLog = isOutlineMode ? JSON.stringify(currentOutlineForIteration, null, 2) : productForThisIteration;
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
    
          const { productDevelopmentState, stagnationSeverity, recentIterationPerformance } = calculateQualitativeStates(productForThisIteration, stagnationInfo, inputComplexity, stagnationNudgeAggressiveness, false);
          const devLogContext = await getRelevantDevLogContext(devLog || [], userRawPromptForContextualizer || `Current task: Refine document from v${majorVersionForIteration - 1} to v${majorVersionForIteration}. Stagnation state is ${stagnationSeverity}. Product state is ${productDevelopmentState}.`);
          
          const modelStrategy = await ModelStrategyService.reevaluateStrategy({
              ...initialProcessState,
              currentMajorVersion: majorVersionForIteration,
              currentProduct: productForThisIteration,
              stagnationInfo,
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
              const productAtHalt = reconstructFromChunks(documentChunksForIteration);
              handleProcessHalt(currentVersionForLoop, productAtHalt, 'Halt signal received. Process stopped.');
              return; // Should break out of the main loop too
            }
    
            updateProcessState({ statusMessage: `Iteration v${majorVersionForIteration}.${minorVersionForIteration}: Running... (Attempt ${attempt + 1})`});
            
            result = await GeminaiService.iterateProduct({
                currentProduct: productForThisIteration,
                documentChunks: documentChunksForIteration,
                currentOutline: currentOutlineForIteration,
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
              const productAtHalt = reconstructFromChunks(documentChunksForIteration);
              handleProcessHalt(currentVersionForLoop, productAtHalt, result.errorMessage || 'Unknown error occurred.', result);
              return; 
            }
    
            // The result.product is always the full text content from the API
            finalProduct = result.product; 

            if (isOutlineMode) {
              finalOutline = result.outline || null;
              finalOutlineId = result.outlineId || null;
            } else {
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
                const isUsingToolsForRetry = isOutlineMode ? false : (isSearchGroundingEnabled || (isUrlBrowsingEnabled && !!modelDataForRetry?.supportsFunctionCalling));
    
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
          
          let productForLogging = finalProduct;
          if (isOutlineMode) {
             productForLogging = parseAndCleanJsonOutput(finalProduct);
          }

          const newLexicalDensity = calculateLexicalDensity(productForLogging);
          const newTTR = calculateSimpleTTR(productForLogging);
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
    
          const similarity = calculateJaccardSimilarity(previousProductForLog, productForLogging);
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
          } else {
              newStagnationInfo.consecutiveCoherenceDegradation = 0;
          }
          newStagnationInfo.isStagnant = isStagnant;
          newStagnationInfo.similarityWithPrevious = similarity;
    
          if (!isStagnant) {
            newStagnationInfo.lastMeaningfulChangeProductLength = productForLogging.length;
          }
          if (newStagnationInfo.isStagnant && !newStagnationInfo.lastProductLengthForStagnation) {
            newStagnationInfo.lastProductLengthForStagnation = productForLogging.length;
          }
    
          let statusMessage = validationInfo.passed ? 'Completed' : 'Completed with Validation Failure';
          if (isCriticalFailure) statusMessage = 'CRITICAL FAILURE';
          if (result?.status === 'CONVERGED') statusMessage = 'Converged';
          
          logIterationData(
            currentVersionForLoop, 
            isTargetedRefinementMode ? 'targeted_refinement' : 'ai_iteration',
            productForLogging,
            statusMessage,
            previousProductForLog,
            result ?? undefined,
            modelStrategy.config,
            fileProcessingInfoForLog,
            validationInfo,
            finalProduct.length,
            productForLogging.length,
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
            isLowValue,
            isWordsmithing
          );

          // Update loop-scoped state for the next iteration.
          stagnationInfo = newStagnationInfo;
          if (isOutlineMode) {
            currentOutlineForIteration = finalOutline;
            outlineIdForIteration = finalOutlineId || outlineIdForIteration;
            documentChunksForIteration = null;
          } else if (updatedChunksFromApi) {
            // Use chunks from JSON refinement mode
            documentChunksForIteration = updatedChunksFromApi;
          } else {
            // Re-chunk from product for text-only modes (including initial synthesis)
            documentChunksForIteration = splitToChunks(finalProduct);
          }
    
          updateProcessState({
            currentProduct: reconstructFromChunks(documentChunksForIteration),
            currentOutline: currentOutlineForIteration,
            outlineId: outlineIdForIteration,
            documentChunks: documentChunksForIteration,
            stagnationInfo: stagnationInfo,
            streamBuffer: null,
          });
    
          await performAutoSave();
    
          const isConverged = result?.suggestedNextStep === 'declare_convergence' || result?.status === 'CONVERGED';
    
          if (isConverged || majorVersionForIteration >= maxMajorVersions || isCriticalFailure) {
            updateProcessState({
              isProcessing: false,
              finalProduct: isOutlineMode ? productForLogging : reconstructFromChunks(documentChunksForIteration),
              finalOutline: isOutlineMode ? currentOutlineForIteration : null,
              documentChunks: documentChunksForIteration,
              configAtFinalization: modelStrategy.config,
              statusMessage: isCriticalFailure ? `Halted due to critical failure: ${validationInfo.reason}` : (isConverged ? 'Process converged.' : 'Max iterations reached.'),
              aiProcessInsight: isConverged ? `AI declared convergence. Reason: ${result?.versionRationale}` : 'Process finished.',
            });
            break;
          }
    
          if (!isTargetedRefinementMode) {
            minorVersionForIteration += 1;
          }
          
          if (!isOutlineMode && documentChunksForIteration && documentChunksForIteration.length > 0) {
            const windowNeedsToSlide = (currentFocusChunkIndex + CONTEXT_WINDOW_SIZE - CONTEXT_WINDOW_OVERLAP < documentChunksForIteration.length);
            if (windowNeedsToSlide) {
                currentFocusChunkIndex = currentFocusChunkIndex + CONTEXT_WINDOW_SIZE - CONTEXT_WINDOW_OVERLAP;
            } else {
                currentFocusChunkIndex = 0; // Loop back to the start
            }
            updateProcessState({ currentFocusChunkIndex });
          }
        }
    } finally {
        isProcessingRef.current = false;
    }
  }, [
    latestStateRef, updateProcessState, addDevLogEntry, handleProcessHalt, logIterationData, 
    handleRateLimitErrorEncountered, performAutoSave
  ]);

  const handleHaltProcess = () => {
      haltSignalRef.current = true;
  };

  const handleBootstrapSynthesis = useCallback(async () => {
    // This is a complex feature that is out of scope for the current bug fix.
    // The implementation remains as it was.
    const { processState, getUserSetBaseConfig } = latestStateRef.current;
    if (processState.isProcessing) {
      console.warn("Process is already running. Bootstrap command ignored.");
      return;
    }
  }, [latestStateRef]);
  
  return {
    handleStartProcess,
    handleHaltProcess,
    handleBootstrapSynthesis,
  };
};
