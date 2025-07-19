

import { useRef, useState, useCallback, useEffect } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, IsLikelyAiErrorResponseResult, IterationEntryType, DevLogEntry, StrategistLLMContext, Version, ModelStrategy, OutlineNode, DocumentChunk, ChunkOperation } from '../types/index.ts';
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
import { splitToChunks, reconstructFromChunks, classifyChunkType, createChunk } from '../services/chunkingService.ts';


const SELF_CORRECTION_MAX_ATTEMPTS = 2;

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
}

const applyChunkOperations = (
    originalChunks: DocumentChunk[], 
    operations: ChunkOperation[]
): { product: string, updatedChunks: DocumentChunk[] } => {
    
    let newChunks: DocumentChunk[] = originalChunks.map(chunk => ({...chunk, lastOperation: undefined, changeRationale: undefined }));
    
    for (const op of operations) {
        const targetIndex = newChunks.findIndex(c => c.id === op.chunkId);
        
        if (targetIndex === -1) {
            console.warn(`Operation for unknown chunkId '${op.chunkId}' ignored.`);
            continue;
        }

        switch (op.op) {
            case 'update':
                if (op.content !== undefined && op.changeRationale) {
                    const originalChunk = newChunks[targetIndex];
                    newChunks[targetIndex] = {
                        ...originalChunk,
                        content: op.content,
                        type: classifyChunkType(op.content),
                        sourceFileNames: op.sourceFileNames || originalChunk.sourceFileNames,
                        changeRationale: op.changeRationale,
                        lastOperation: 'modified'
                    };
                }
                break;
            case 'insert_after':
                if (op.content && op.changeRationale) {
                    const newChunk = createChunk(op.content, op.sourceFileNames, op.changeRationale);
                    newChunks.splice(targetIndex + 1, 0, newChunk);
                }
                break;
            case 'delete':
                newChunks.splice(targetIndex, 1);
                break;
            case 'merge_up':
                if (targetIndex > 0) {
                    const prevChunk = newChunks[targetIndex - 1];
                    const currentChunk = newChunks[targetIndex];
                    const mergedContent = `${prevChunk.content}\n\n${currentChunk.content}`;
                    newChunks[targetIndex - 1] = {
                        ...prevChunk,
                        content: mergedContent,
                        type: classifyChunkType(mergedContent),
                        changeRationale: op.changeRationale,
                        lastOperation: 'modified'
                    };
                    newChunks.splice(targetIndex, 1);
                }
                break;
            case 'split':
                 if (op.splitPoint && op.content === undefined) { // content is not used for split
                    const chunkToSplit = newChunks[targetIndex];
                    const splitIndex = chunkToSplit.content.indexOf(op.splitPoint);
                    if (splitIndex !== -1) {
                        const contentA = chunkToSplit.content.substring(0, splitIndex);
                        const contentB = chunkToSplit.content.substring(splitIndex);

                        if (contentA.trim() && contentB.trim()) {
                            const chunkA = createChunk(contentA, chunkToSplit.sourceFileNames, `Part 1 of split: ${op.changeRationale}`);
                            const chunkB = createChunk(contentB, chunkToSplit.sourceFileNames, `Part 2 of split: ${op.changeRationale}`);
                            newChunks.splice(targetIndex, 1, chunkA, chunkB);
                        }
                    }
                }
                break;
        }
    }
    
    return {
        product: reconstructFromChunks(newChunks),
        updatedChunks: newChunks
    };
};

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
      directAiResponseLengthChars: directAiResponseLengthChars_param,
      processedProductLengthChars: processedProductLengthChars_param,
      attemptCount: attemptCount,
      strategyRationale: strategyRationale,
      currentModelForIteration: currentModelForIteration,
      activeMetaInstruction: activeMetaInstruction,
      isCriticalFailure: isCriticalFailure,
      targetedSelection: targetedSelection,
      targetedRefinementInstructions: targetedRefinementInstructions,
      similarityWithPreviousLogged: similarityWithPreviousLogged,
      isStagnantIterationLogged: isStagnantIterationLogged,
      isEffectivelyIdenticalLogged: isEffectivelyIdenticalLogged,
      isLowValueIterationLogged: isLowValueIterationLogged,
      isWordsmithingIterationLogged: isWordsmithingIterationLogged,
      bootstrapRun: bootstrapRun
    });
  }, [addLogEntryFromHook]);

  const handleHaltProcess = useCallback(() => {
    haltSignalRef.current = true;
    updateProcessState({ statusMessage: 'Halt signal received. Finishing current step...' });
  }, [updateProcessState]);
  
  const handleStartProcess = useCallback(async (options: {
    isTargetedRefinement?: boolean;
    targetedSelection?: string;
    targetedInstructions?: string;
    userRawPromptForContextualizer?: string;
  } = {}) => {
    if (isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    haltSignalRef.current = false;
    
    let {
        processState: localProcessState,
        getUserSetBaseConfig: getLocalUserSetBaseConfig
    } = latestStateRef.current;
    
    let {
        initialPrompt, currentProduct, documentChunks, currentOutline, currentMajorVersion, currentMinorVersion, maxMajorVersions, iterationHistory,
        loadedFiles, isPlanActive, planStages, currentPlanStageIndex, currentStageIteration,
        selectedModelName, isSearchGroundingEnabled, isUrlBrowsingEnabled, stagnationNudgeEnabled,
        stagnationNudgeAggressiveness, strategistInfluenceLevel, devLog, isOutlineMode
    } = localProcessState;

    const isInitialRun = currentMajorVersion === 0 && currentMinorVersion === 0;

    if (isInitialRun && !documentChunks?.length && currentProduct) {
        documentChunks = splitToChunks(currentProduct);
    }
    
    let currentVersion: Version = { major: currentMajorVersion, minor: currentMinorVersion };
    
    if (isInitialRun) {
        currentVersion = { major: 1, minor: 0 };
        currentProduct = null;
        documentChunks = [];
        iterationHistory = [];
        const codename = await GeminaiService.generateProjectCodename(initialPrompt, loadedFiles);
        
        updateProcessState({ 
            projectCodename: codename, 
            projectName: localProcessState.projectName || codename,
            currentProduct, 
            documentChunks,
            iterationHistory, 
            currentMajorVersion: 1, 
            currentMinorVersion: 0,
            finalProduct: null,
            configAtFinalization: null,
            currentProductBeforeHalt: null,
            currentVersionBeforeHalt: undefined,
        });
    }

    try {
        updateProcessState({
            isProcessing: true,
            statusMessage: `Starting iterative process... v${currentVersion.major}.${currentVersion.minor}`,
            finalProduct: null,
            configAtFinalization: null,
        });

        let attempt = 0;
        let selfCorrectionAttempt = 0;
        let lastApiResult: IterateProductResult | undefined = undefined;
        let retryContext: RetryContext | undefined = undefined;
        let isRadicalRefinementKickstart = false;

        const totalIterationsLimit = maxMajorVersions;
        
        let exitStatus: 'COMPLETED_MAX_ITERATIONS' | 'CONVERGED' | 'HALTED_BY_USER' | 'CRITICAL_ERROR' = 'COMPLETED_MAX_ITERATIONS';
        let exitMessage = '';

        for (let i = 0; i < totalIterationsLimit; i++) {
            if (haltSignalRef.current) {
                 const { currentMajorVersion: haltMajor, currentMinorVersion: haltMinor, currentProduct: haltProduct } = latestStateRef.current.processState;
                exitStatus = 'HALTED_BY_USER';
                exitMessage = `Process halted by user at v${haltMajor}.${haltMinor}.`;
                updateProcessState({
                    currentProductBeforeHalt: haltProduct,
                    currentVersionBeforeHalt: { major: haltMajor, minor: haltMinor }
                });
                break;
            }

            const {
                processState: loopProcessState,
                getUserSetBaseConfig: loopGetUserSetConfig
            } = latestStateRef.current;
            const userSetConfig = loopGetUserSetConfig();

            if (isInitialRun && i === 0) {
              currentVersion = { major: 1, minor: 0 };
            } else {
              currentVersion = { major: loopProcessState.currentMajorVersion, minor: loopProcessState.currentMinorVersion + 1 };
              if (currentVersion.minor >= 20) {
                currentVersion.major += 1;
                currentVersion.minor = 0;
              }
            }
            updateProcessState({ currentMajorVersion: currentVersion.major, currentMinorVersion: currentVersion.minor });


            const isFirstIterationOfProcess = currentVersion.major === 1 && currentVersion.minor === 0;

            const relevantDevLogContext = await getRelevantDevLogContext(devLog || [], options.userRawPromptForContextualizer || initialPrompt);

            const isBootstrappedBase = !!loopProcessState.ensembleSubProducts && loopProcessState.ensembleSubProducts.length > 0 && isFirstIterationOfProcess;
            
            const productOfLastIteration = currentProduct || "";
            let productOfTwoIterationsAgo = "";
            const lastCompletedVersion = { major: loopProcessState.currentMajorVersion, minor: loopProcessState.currentMinorVersion };
            
            if (lastCompletedVersion.major > 1 || (lastCompletedVersion.major === 1 && lastCompletedVersion.minor > 0)) {
                const versionBeforeLast = { major: lastCompletedVersion.major, minor: lastCompletedVersion.minor - 1 };
                if (versionBeforeLast.minor < 0) {
                    versionBeforeLast.major--;
                    versionBeforeLast.minor = 19;
                }
                if (versionBeforeLast.major >= 1) {
                    productOfTwoIterationsAgo = reconstructProduct(
                        versionBeforeLast,
                        loopProcessState.iterationHistory,
                        loopProcessState.initialPrompt
                    ).product;
                }
            }

            const similarity = calculateJaccardSimilarity(productOfLastIteration, productOfTwoIterationsAgo);
            const charDelta = (productOfLastIteration.length) - (productOfTwoIterationsAgo.length);
            const isEffectivelyIdentical = similarity > 0.999 && Math.abs(charDelta) < 15;
            const isWordsmithing = !isEffectivelyIdentical && similarity > 0.95 && Math.abs(charDelta) < (productOfLastIteration.length * 0.05);

            const newStagnationInfo: StagnationInfo = { ...loopProcessState.stagnationInfo, similarityWithPrevious: similarity };
            if (isEffectivelyIdentical) {
                newStagnationInfo.consecutiveIdenticalProductIterations += 1;
                newStagnationInfo.consecutiveWordsmithingIterations = 0;
            } else if (isWordsmithing) {
                newStagnationInfo.consecutiveWordsmithingIterations += 1;
                newStagnationInfo.consecutiveIdenticalProductIterations = 0;
            } else {
                newStagnationInfo.consecutiveIdenticalProductIterations = 0;
                newStagnationInfo.consecutiveWordsmithingIterations = 0;
            }
            updateProcessState({ stagnationInfo: newStagnationInfo });

            const qualitativeStates = calculateQualitativeStates(
                loopProcessState.currentProduct,
                newStagnationInfo,
                loopProcessState.inputComplexity,
                loopProcessState.stagnationNudgeAggressiveness,
                isBootstrappedBase
            );

            const strategy = await ModelStrategyService.reevaluateStrategy({ 
                ...loopProcessState, 
                stagnationInfo: newStagnationInfo,
                ...qualitativeStates 
            }, userSetConfig);
            
            isRadicalRefinementKickstart = strategy.activeMetaInstruction?.includes("CRITICAL: Process is stuck") ?? false;
            
            updateProcessState({
                statusMessage: `v${currentVersion.major}.${currentVersion.minor}: Running... (Attempt ${attempt + 1})`,
                aiProcessInsight: strategy.rationale,
                currentModelForIteration: strategy.modelName,
                currentAppliedModelConfig: strategy.config,
                activeMetaInstructionForNextIter: strategy.activeMetaInstruction
            });
            
            const apiResult = await GeminaiService.iterateProduct({
                currentProduct: currentProduct || "",
                documentChunks,
                currentOutline,
                currentFocusChunkIndex: loopProcessState.currentFocusChunkIndex,
                currentVersion,
                maxIterationsOverall: maxMajorVersions,
                fileManifest: initialPrompt,
                loadedFiles,
                activePlanStage: null, // Simplified for now
                outputParagraphShowHeadings: loopProcessState.outputParagraphShowHeadings,
                outputParagraphMaxHeadingDepth: loopProcessState.outputParagraphMaxHeadingDepth,
                outputParagraphNumberedHeadings: loopProcessState.outputParagraphNumberedHeadings,
                modelConfigToUse: strategy.config,
                isGlobalMode: !isPlanActive,
                isSearchGroundingEnabled,
                isUrlBrowsingEnabled,
                modelToUse: strategy.modelName,
                onStreamChunk: (chunk) => {
                    currentStreamBufferRef.current += chunk;
                    updateProcessState({ streamBuffer: currentStreamBufferRef.current });
                },
                isHaltSignalled: () => haltSignalRef.current,
                retryContext,
                devLogContextString: relevantDevLogContext,
                isTargetedRefinementMode: options.isTargetedRefinement,
                targetedSelectionText: options.targetedSelection,
                targetedRefinementInstructions: options.targetedInstructions,
                isRadicalRefinementKickstart,
                isOutlineMode,
                addDevLogEntry,
            });
            
            currentStreamBufferRef.current = "";
            updateProcessState({ streamBuffer: null });

            if (apiResult.status === 'ERROR' || (!apiResult.product && !apiResult.chunkOperations && !apiResult.outline)) {
                logIterationData(currentVersion, 'ai_iteration', currentProduct, `Error on v${currentVersion.major}.${currentVersion.minor}: ${apiResult.errorMessage}`, currentProduct, apiResult, strategy.config);
                exitMessage = `Error: ${apiResult.errorMessage || 'Unknown error from API result.'}`;
                exitStatus = 'CRITICAL_ERROR';
                if (apiResult.isRateLimitError) handleRateLimitErrorEncountered();
                break;
            }
            
            const previousProduct = currentProduct;
            let newProduct: string;
            let newChunks: DocumentChunk[] | null = documentChunks;

            if (apiResult.chunkOperations) {
                const { product, updatedChunks } = applyChunkOperations(documentChunks || [], apiResult.chunkOperations);
                newProduct = product;
                newChunks = updatedChunks;
            } else if (apiResult.outline) {
                newProduct = JSON.stringify(apiResult.outline, null, 2); // For logging/diffing
                updateProcessState({ currentOutline: apiResult.outline, outlineId: apiResult.outlineId });
            } else {
                let textResponse = apiResult.product;
                const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
                const match = textResponse.match(fenceRegex);
                if (match && match[2]) {
                    textResponse = match[2].trim();
                }
                newProduct = textResponse;
                newChunks = splitToChunks(newProduct);
            }

            const validationResult = isLikelyAiErrorResponse(newProduct, previousProduct || "", { ...apiResult } as any);

            const aiValidationInfo: AiResponseValidationInfo = {
                checkName: validationResult.checkDetails?.type || 'general_validation',
                passed: !validationResult.isError,
                isCriticalFailure: validationResult.isCriticalFailure,
                reason: validationResult.reason,
                details: validationResult.checkDetails,
            };
            
            logIterationData(currentVersion, 'ai_iteration', newProduct, apiResult.status, previousProduct, apiResult, strategy.config, undefined, aiValidationInfo, undefined, undefined, attempt, strategy.rationale, strategy.modelName, strategy.activeMetaInstruction, validationResult.isCriticalFailure, undefined, undefined, similarity, undefined, isEffectivelyIdentical, isWordsmithing);

            if (validationResult.isError) {
                updateProcessState({ statusMessage: `v${currentVersion.major}.${currentVersion.minor}: Validation failed. ${validationResult.reason}` });
                if (validationResult.isCriticalFailure) {
                    exitMessage = `Critical Failure: ${validationResult.reason}. Process halted.`;
                    exitStatus = 'CRITICAL_ERROR';
                    break;
                }
                selfCorrectionAttempt++;
                if (selfCorrectionAttempt < SELF_CORRECTION_MAX_ATTEMPTS) {
                    retryContext = {
                        previousErrorReason: validationResult.reason,
                        originalCoreInstructions: getUserPromptComponents(currentVersion, maxMajorVersions, null, false, 0, false, !isPlanActive, isFirstIterationOfProcess, true, isOutlineMode).coreUserInstructions
                    };
                    updateProcessState({ statusMessage: `Validation failed. Attempting self-correction (${selfCorrectionAttempt}/${SELF_CORRECTION_MAX_ATTEMPTS}).` });
                    i--; 
                    continue; 
                } else {
                    exitMessage = `Self-correction failed after ${selfCorrectionAttempt} attempts. Process halted.`;
                    exitStatus = 'CRITICAL_ERROR';
                    break;
                }
            }
            
            selfCorrectionAttempt = 0;
            retryContext = undefined;
            currentProduct = newProduct;
            documentChunks = newChunks;

            updateProcessState({
                currentProduct,
                documentChunks,
                statusMessage: `Completed v${currentVersion.major}.${currentVersion.minor}.`,
            });
            
            if (isFirstIterationOfProcess) {
                const hasMapContent = isOutlineMode 
                    ? (apiResult.outline && apiResult.outline.length > 0)
                    : newChunks?.some(c => c.type.startsWith('heading_'));
                
                if (hasMapContent) {
                    updateProcessState({ isDocumentMapOpen: true });
                }
            }

            await performAutoSave();

            if (apiResult.status === 'CONVERGED') {
                exitStatus = 'CONVERGED';
                break;
            }
        }

        const { processState: finalLoopState, getUserSetBaseConfig: finalConfigGetter } = latestStateRef.current;
        const finalConfig = finalConfigGetter();
        let finalUpdates: Partial<ProcessState> = {
            configAtFinalization: finalConfig,
        };

        switch(exitStatus) {
            case 'COMPLETED_MAX_ITERATIONS':
                finalUpdates.finalProduct = finalLoopState.currentProduct;
                finalUpdates.finalOutline = finalLoopState.currentOutline;
                finalUpdates.statusMessage = `Process completed its run of ${maxMajorVersions} iterations. Final product generated.`;
                break;
            case 'CONVERGED':
                finalUpdates.finalProduct = finalLoopState.currentProduct;
                finalUpdates.finalOutline = finalLoopState.currentOutline;
                finalUpdates.statusMessage = `Process converged at v${finalLoopState.currentMajorVersion}.${finalLoopState.currentMinorVersion}. Final product generated.`;
                break;
            case 'HALTED_BY_USER':
                finalUpdates.statusMessage = exitMessage;
                break;
            case 'CRITICAL_ERROR':
                finalUpdates.statusMessage = exitMessage;
                break;
        }
        updateProcessState(finalUpdates);

    } finally {
        isProcessingRef.current = false;
        updateProcessState({
            isProcessing: false,
        });
        await performAutoSave();
    }
  }, [
      processState, updateProcessState, addLogEntryFromHook, addDevLogEntry, getUserSetBaseConfig, performAutoSave, handleRateLimitErrorEncountered, logIterationData
  ]);

  return {
    handleStartProcess,
    handleHaltProcess,
  };
};
