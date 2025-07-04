

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
            currentMinorVersion: 0 
        });
    } else {
        currentVersion = { major: currentMajorVersion, minor: currentMinorVersion + 1 };
        updateProcessState({ currentMinorVersion: currentMinorVersion + 1 });
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

        while (currentVersion.major <= maxMajorVersions) {
            if (haltSignalRef.current) {
                updateProcessState({
                    statusMessage: `Process halted by user at v${currentVersion.major}.${currentVersion.minor}.`,
                    currentProductBeforeHalt: currentProduct,
                    currentVersionBeforeHalt: currentVersion,
                });
                break;
            }

            const {
                processState: loopProcessState,
                getUserSetBaseConfig: loopGetUserSetConfig
            } = latestStateRef.current;
            const userSetConfig = loopGetUserSetConfig();

            const isFirstIterationOfProcess = currentVersion.major === 1 && currentVersion.minor === 0;

            const relevantDevLogContext = await getRelevantDevLogContext(devLog || [], options.userRawPromptForContextualizer || initialPrompt);

            const isBootstrappedBase = !!loopProcessState.ensembleSubProducts && loopProcessState.ensembleSubProducts.length > 0 && isFirstIterationOfProcess;
            const qualitativeStates = calculateQualitativeStates(
                loopProcessState.currentProduct,
                loopProcessState.stagnationInfo,
                loopProcessState.inputComplexity,
                loopProcessState.stagnationNudgeAggressiveness,
                isBootstrappedBase
            );

            const strategy = await ModelStrategyService.reevaluateStrategy({ 
                ...loopProcessState, 
                ...qualitativeStates 
            }, userSetConfig);
            
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

            if (apiResult.status === 'ERROR' || !apiResult.product && !apiResult.chunkOperations && !apiResult.outline) {
                logIterationData(currentVersion, 'ai_iteration', currentProduct, `Error on v${currentVersion.major}.${currentVersion.minor}: ${apiResult.errorMessage}`, currentProduct, apiResult, strategy.config);
                updateProcessState({ statusMessage: `Error: ${apiResult.errorMessage}` });
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
                // Text-based response (e.g., from search grounding)
                let textResponse = apiResult.product;
                // Sanitize markdown fences from text-based responses
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
            
            logIterationData(currentVersion, 'ai_iteration', newProduct, apiResult.status, previousProduct, apiResult, strategy.config, undefined, aiValidationInfo);

            if (validationResult.isError) {
                updateProcessState({ statusMessage: `v${currentVersion.major}.${currentVersion.minor}: Validation failed. ${validationResult.reason}` });
                if (validationResult.isCriticalFailure) {
                    updateProcessState({ statusMessage: `Critical Failure: ${validationResult.reason}. Process halted.` });
                    break;
                }
                // Handle non-critical retry
                selfCorrectionAttempt++;
                if (selfCorrectionAttempt < SELF_CORRECTION_MAX_ATTEMPTS) {
                    retryContext = {
                        previousErrorReason: validationResult.reason,
                        originalCoreInstructions: getUserPromptComponents(currentVersion, maxMajorVersions, null, false, 0, false, !isPlanActive, isFirstIterationOfProcess, true, isOutlineMode).coreUserInstructions
                    };
                    updateProcessState({ statusMessage: `Validation failed. Attempting self-correction (${selfCorrectionAttempt}/${SELF_CORRECTION_MAX_ATTEMPTS}).` });
                    continue; // Skip version increment and loop again
                } else {
                    updateProcessState({ statusMessage: `Self-correction failed after ${selfCorrectionAttempt} attempts. Process halted.` });
                    break;
                }
            }
            
            // Success path
            selfCorrectionAttempt = 0;
            retryContext = undefined;
            currentProduct = newProduct;
            documentChunks = newChunks;

            updateProcessState({
                currentProduct,
                documentChunks,
                currentMajorVersion: currentVersion.major,
                currentMinorVersion: currentVersion.minor,
                statusMessage: `Completed v${currentVersion.major}.${currentVersion.minor}.`,
            });
            
            await performAutoSave();

            if (apiResult.status === 'CONVERGED') {
                updateProcessState({ finalProduct: currentProduct, configAtFinalization: strategy.config });
                break;
            }

            currentVersion.minor++;
            if (currentVersion.minor >= maxMajorVersions) { // Simplified logic for now
                 currentVersion.major++;
                 currentVersion.minor = 0;
            }
        }
    } finally {
        isProcessingRef.current = false;
        updateProcessState({
            isProcessing: false,
            currentProductBeforeHalt: null,
            currentVersionBeforeHalt: undefined
        });
        await performAutoSave();
    }
  }, [
      processState.initialPrompt, processState.currentProduct, processState.documentChunks, processState.currentOutline,
      processState.currentMajorVersion, processState.currentMinorVersion, processState.maxMajorVersions,
      processState.iterationHistory, processState.loadedFiles, processState.isPlanActive, processState.planStages,
      processState.currentPlanStageIndex, processState.currentStageIteration, processState.selectedModelName,
      processState.isSearchGroundingEnabled, processState.isUrlBrowsingEnabled, processState.stagnationNudgeEnabled,
      processState.stagnationNudgeAggressiveness, processState.strategistInfluenceLevel, processState.devLog,
      processState.isOutlineMode,
      updateProcessState, logIterationData, performAutoSave, addDevLogEntry, handleRateLimitErrorEncountered
  ]);

  return {
    handleStartProcess,
    handleHaltProcess,
  };
};
