

import { useRef, useState, useCallback } from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, IsLikelyAiErrorResponseResult, ReductionDetailValue } from '../types.ts'; 
import * as geminiService from '../services/geminiService';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput } from '../services/iterationUtils';
import { CONVERGED_PREFIX } from '../services/promptBuilderService'; 
import { calculateFleschReadingEase, calculateJaccardSimilarity, countWords } from '../services/textAnalysisService';


// Constants for stagnation detection
const STAGNATION_THRESHOLD_LINES = 10;
const STAGNATION_SIMILARITY_THRESHOLD = 0.90; // If Jaccard similarity is > this, it's considered very similar
const STAGNATION_CONSECUTIVE_COUNT = 2;

// Constants for raw output logging
const RAW_OUTPUT_HEAD_TAIL_LENGTH = 500; // Applied to both direct and processed product head/tail


export const useIterativeLogic = (
  state: ProcessState,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  addLogEntryCallback: (logData: {
    iteration: number;
    currentFullProduct: string | null; // This will be iterationProductForLog
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
  }) => void,
  getCalculatedModelConfig: (iterNum: number, maxIterScope: number) => ModelConfig,
  performAutoSave: () => Promise<void>,
  selectedModelName: string,
  onRateLimitErrorEncountered: () => void
) => {
  const haltSignalRef = useRef(false);
  const [stagnationInfo, setStagnationInfo] = useState<StagnationInfo>({ isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined });

  const checkStagnation = useCallback(() => { 
    if (state.isPlanActive || state.isProcessing === false || haltSignalRef.current) {
      setStagnationInfo({ isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined });
      return;
    }

    const relevantHistory = state.iterationHistory.filter(entry => entry.iteration > 0);
    if (relevantHistory.length < STAGNATION_CONSECUTIVE_COUNT) {
      setStagnationInfo({ isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined });
      return;
    }

    let consecutiveLowChangeCount = 0;

    for (let i = relevantHistory.length - 1; i >= 0 && i >= relevantHistory.length - STAGNATION_CONSECUTIVE_COUNT; i--) {
      const entry = relevantHistory[i];
      if (entry.status.startsWith(CONVERGED_PREFIX) || entry.status.toUpperCase().includes('ERROR') || entry.status.toUpperCase().includes('HALTED')) {
        consecutiveLowChangeCount = 0;
        break;
      }
      const linesChanged = (entry.linesAdded || 0) + (entry.linesRemoved || 0);

      if (linesChanged < STAGNATION_THRESHOLD_LINES) {
        consecutiveLowChangeCount++;
      } else {
        consecutiveLowChangeCount = 0;
        break;
      }
    }

    if (consecutiveLowChangeCount >= STAGNATION_CONSECUTIVE_COUNT) {
      setStagnationInfo(prev => ({ ...prev, isStagnant: true, consecutiveStagnantIterations: consecutiveLowChangeCount }));
    } else {
      setStagnationInfo({ isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined });
    }
  }, [state.iterationHistory, state.isPlanActive, state.isProcessing]);


  const processSingleIteration = useCallback(async (
    productToProcess: string,
    currentProcessingIterationNumber: number,
    maxIterForScope: number,
    activePlanStage: PlanStage | null,
    globalParaShowHeadings: boolean,
    globalParaMaxDepth: number,
    globalParaNumHeadings: boolean,
    currentStageDisplayInfo?: string,
    scopeIterNum?: number
  ): Promise<IterationResultDetails> => {

    const modelCfgForThisIteration = getCalculatedModelConfig(currentProcessingIterationNumber, maxIterForScope);
    let aiInsightMessage = state.aiProcessInsight || "";

    let currentIterStatusMsg = currentStageDisplayInfo ?
        `${currentStageDisplayInfo}, Iter. ${scopeIterNum}/${maxIterForScope} (Overall ${currentProcessingIterationNumber})` :
        `Processing Iteration ${currentProcessingIterationNumber}/${maxIterForScope} (Global Dynamic Mode)`;
    
    updateProcessState({ currentAppliedModelConfig: modelCfgForThisIteration });


    if (activePlanStage) {
        if (['auto'].includes(activePlanStage.format) || ['auto'].includes(activePlanStage.length) || ['auto'].includes(activePlanStage.complexity) ) {
             currentIterStatusMsg = `${currentStageDisplayInfo}, Iter. ${scopeIterNum}/${maxIterForScope} (Overall ${currentProcessingIterationNumber}): AI auto-analyzing...`;
             aiInsightMessage = "Iterative Plan active: AI auto-analyzing stage goals.";
        } else {
            aiInsightMessage = "Iterative Plan active: AI following predefined stage goals.";
        }
    } else {
        aiInsightMessage = `Global Mode: AI refining autonomously. Params: T:${modelCfgForThisIteration.temperature.toFixed(2)}, P:${modelCfgForThisIteration.topP.toFixed(2)}, K:${modelCfgForThisIteration.topK}.`;
        currentIterStatusMsg = `Iteration ${currentProcessingIterationNumber}/${maxIterForScope} (Global Dynamic: T:${modelCfgForThisIteration.temperature.toFixed(2)}): Waiting for AI response...`;
         if (stagnationInfo.isStagnant) {
            currentIterStatusMsg += ` (Stagnation detected, applying nudge.)`;
            aiInsightMessage += ` Stagnation detected (${stagnationInfo.consecutiveStagnantIterations} low-change iters), applying creative nudge.`;
        }
    }

    updateProcessState({
        currentIteration: currentProcessingIterationNumber,
        ...(currentStageDisplayInfo && scopeIterNum && { currentStageIteration: scopeIterNum }),
        statusMessage: currentIterStatusMsg,
        aiProcessInsight: aiInsightMessage,
    });

    let accumulatedStreamTextForCurrentIteration = "";
    let isFirstChunkOfIteration = true;

    const manifestForAPICall = state.loadedFiles.length > 0 ? state.initialPrompt : "";
    
    updateProcessState({ statusMessage: `${currentIterStatusMsg} - Waiting for AI response...` });

    // This 'result.product' will be the raw AI output
    const result: IterateProductResult = await geminiService.iterateProduct(
        productToProcess,
        currentProcessingIterationNumber,
        maxIterForScope,
        manifestForAPICall,
        state.loadedFiles,
        activePlanStage,
        globalParaShowHeadings, globalParaMaxDepth, globalParaNumHeadings,
        modelCfgForThisIteration,
        !activePlanStage,
        selectedModelName,
        (chunkText) => {
            if (isFirstChunkOfIteration) {
                accumulatedStreamTextForCurrentIteration = ""; // Reset for this specific API call stream
                updateProcessState({ statusMessage: `${currentIterStatusMsg} - Receiving AI response...` });
            }
            accumulatedStreamTextForCurrentIteration += chunkText;
            updateProcessState({ currentProduct: accumulatedStreamTextForCurrentIteration }); // Show raw stream in UI
            if (isFirstChunkOfIteration && accumulatedStreamTextForCurrentIteration.startsWith(CONVERGED_PREFIX)) {
                const convergeMsg = `${currentStageDisplayInfo || `Iteration ${currentProcessingIterationNumber}`} (Global Dynamic Mode): AI signaled convergence early.`;
                updateProcessState({ statusMessage: convergeMsg, aiProcessInsight: `${aiInsightMessage} AI signaled convergence early.` });
            }
            isFirstChunkOfIteration = false;
        },
        () => haltSignalRef.current
    );
    
    updateProcessState({ statusMessage: `${currentIterStatusMsg} - Processing AI response...` });

    const directAiResponse = result.product; // This is accumulatedStreamTextForCurrentIteration
    const directAiResponseLengthChars = directAiResponse.length;
    const directAiResponseHead = directAiResponse.substring(0, RAW_OUTPUT_HEAD_TAIL_LENGTH);
    const directAiResponseTail = directAiResponse.substring(Math.max(0, directAiResponseLengthChars - RAW_OUTPUT_HEAD_TAIL_LENGTH));

    let iterationProductForLog = directAiResponse; 
    let iterationProductForProcessing = directAiResponse;

    if (activePlanStage && activePlanStage.format === 'json' && result.status !== 'ERROR' && result.status !== 'HALTED') {
        iterationProductForProcessing = parseAndCleanJsonOutput(iterationProductForProcessing);
        if (directAiResponse.startsWith(CONVERGED_PREFIX) && !iterationProductForProcessing.startsWith(CONVERGED_PREFIX)) {
            iterationProductForLog = CONVERGED_PREFIX + iterationProductForProcessing;
        } else if (iterationProductForProcessing !== directAiResponse) {
            iterationProductForLog = iterationProductForProcessing;
        }
    }

    if (result.status === 'CONVERGED') {
        iterationProductForProcessing = iterationProductForLog.startsWith(CONVERGED_PREFIX)
            ? iterationProductForLog.substring(CONVERGED_PREFIX.length)
            : iterationProductForLog;
    }
    
    const processedProductLengthChars = iterationProductForProcessing.length;
    const processedProductHead = iterationProductForProcessing.substring(0, RAW_OUTPUT_HEAD_TAIL_LENGTH);
    const processedProductTail = iterationProductForProcessing.substring(Math.max(0, processedProductLengthChars - RAW_OUTPUT_HEAD_TAIL_LENGTH));


    let iterStatusLogMsg = result.status === 'HALTED' ? `${currentStageDisplayInfo || `Iteration ${currentProcessingIterationNumber}`} halted.`
                            : result.status === 'CONVERGED' ? `${currentStageDisplayInfo || `Iteration ${currentProcessingIterationNumber}`} CONVERGED.`
                            : result.status === 'ERROR' ? `Error in ${currentStageDisplayInfo || `Iteration ${currentProcessingIterationNumber}`}: ${result.errorMessage || 'Unknown'}`
                            : `${currentStageDisplayInfo || `Iteration ${currentProcessingIterationNumber}`} completed.`;

    const readabilityScore = calculateFleschReadingEase(iterationProductForProcessing); 

    const wasFileContentSentInThisApiCall = currentProcessingIterationNumber === 1 &&
                                          result.apiStreamDetails &&
                                          result.apiStreamDetails.some(d => d.callCount === 1 && !d.isContinuation);

    const fileProcessingLogInfo: FileProcessingInfo = {
        filesSentToApiIteration: wasFileContentSentInThisApiCall ? 1 : null,
        numberOfFilesActuallySent: wasFileContentSentInThisApiCall ? state.loadedFiles.length : 0,
        totalFilesSizeBytesSent: wasFileContentSentInThisApiCall ? state.loadedFiles.reduce((sum, f) => sum + f.size, 0) : 0,
        fileManifestProvidedCharacterCount: manifestForAPICall.length,
    };

    if (result.status === 'ERROR' && result.errorMessage) {
        if (result.isRateLimitError) {
            aiInsightMessage = `API Rate Limit: ${result.errorMessage}`;
            onRateLimitErrorEncountered();
        } else if (result.errorMessage.includes("Error 429") || result.errorMessage.toUpperCase().includes("RESOURCE_EXHAUSTED")) {
            aiInsightMessage = `API Quota Limit Reached for model "${selectedModelName}". Consider switching models or checking your API plan.`;
            onRateLimitErrorEncountered();
        } else {
            aiInsightMessage = `An API error occurred: ${result.errorMessage.substring(0, 100)}...`;
        }
    }
    
    let aiValidationInfoForLog: AiResponseValidationInfo | undefined = undefined;

    if (result.status === 'COMPLETED' || result.status === 'CONVERGED') {
        const aiErrorCheck: IsLikelyAiErrorResponseResult = isLikelyAiErrorResponse(
            iterationProductForProcessing, 
            productToProcess,
            activePlanStage?.length,
            activePlanStage?.format
        );

        aiValidationInfoForLog = {
            checkName: 'isLikelyAiErrorResponse',
            passed: !aiErrorCheck.isError,
            reason: aiErrorCheck.reason, 
            details: aiErrorCheck.checkDetails
        };
        
        if (aiErrorCheck.isError) { 
            let criticalErrorMsg = `AI Output Suspicious: ${aiErrorCheck.reason}`;
            if (aiErrorCheck.checkDetails?.type === 'extreme_reduction_error') {
                criticalErrorMsg = `CRITICAL ERROR: AI response resulted in EXTREME data loss. ${aiErrorCheck.reason}. Process halted to protect data integrity.`;
            }
            console.warn(`Potential AI-generated error detected in ${currentStageDisplayInfo || `Iteration ${currentProcessingIterationNumber}`}: ${aiErrorCheck.reason}`);
            iterStatusLogMsg = criticalErrorMsg;
            addLogEntryCallback({ 
                iteration: currentProcessingIterationNumber, 
                currentFullProduct: iterationProductForLog, 
                previousFullProduct: productToProcess, 
                status: iterStatusLogMsg, 
                ...result, 
                modelConfigUsed: modelCfgForThisIteration, 
                readabilityScoreFlesch: readabilityScore, 
                fileProcessingInfo: fileProcessingLogInfo, 
                aiValidationInfo: aiValidationInfoForLog,
                directAiResponseHead, 
                directAiResponseTail, 
                directAiResponseLengthChars,
                processedProductHead,
                processedProductTail,
                processedProductLengthChars
            });
            
            updateProcessState({ isProcessing: false, finalProduct: productToProcess, statusMessage: criticalErrorMsg, configAtFinalization: modelCfgForThisIteration, aiProcessInsight: criticalErrorMsg });
            await performAutoSave();
            return { ...result, product: productToProcess, status: 'ERROR', errorMessage: criticalErrorMsg, modelConfigUsed: modelCfgForThisIteration };
        }
    }


    addLogEntryCallback({ 
      iteration: currentProcessingIterationNumber, 
      currentFullProduct: iterationProductForLog, 
      previousFullProduct: productToProcess, 
      status: iterStatusLogMsg, 
      ...result, 
      modelConfigUsed: modelCfgForThisIteration, 
      readabilityScoreFlesch: readabilityScore, 
      fileProcessingInfo: fileProcessingLogInfo,
      aiValidationInfo: aiValidationInfoForLog,
      directAiResponseHead,
      directAiResponseTail,
      directAiResponseLengthChars,
      processedProductHead,
      processedProductTail,
      processedProductLengthChars
    });

    updateProcessState({ currentProduct: iterationProductForProcessing, aiProcessInsight: result.status === 'ERROR' ? aiInsightMessage : (aiValidationInfoForLog?.reason || state.aiProcessInsight) });
    await performAutoSave();

    if (!activePlanStage) { // Global mode stagnation check
      const currentWordCount = countWords(iterationProductForProcessing);
      const prevWordCount = countWords(productToProcess);
      const wordDiff = Math.abs(currentWordCount - prevWordCount);
      const jaccardSim = calculateJaccardSimilarity(productToProcess, iterationProductForProcessing);
      
      const linesAddedOrRemoved = state.iterationHistory.find(e => e.iteration === currentProcessingIterationNumber)
                                  ? (state.iterationHistory.find(e => e.iteration === currentProcessingIterationNumber)?.linesAdded || 0) + 
                                    (state.iterationHistory.find(e => e.iteration === currentProcessingIterationNumber)?.linesRemoved || 0)
                                  : wordDiff; 

      if (linesAddedOrRemoved < STAGNATION_THRESHOLD_LINES && jaccardSim > STAGNATION_SIMILARITY_THRESHOLD) {
          setStagnationInfo(prev => ({
              isStagnant: true,
              consecutiveStagnantIterations: prev.consecutiveStagnantIterations + 1,
              similarityWithPrevious: jaccardSim
          }));
      } else {
          setStagnationInfo({ isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: jaccardSim });
      }
    }

    return { ...result, product: iterationProductForProcessing, modelConfigUsed: modelCfgForThisIteration };

  }, [state.initialPrompt, state.loadedFiles, state.iterationHistory, state.aiProcessInsight, getCalculatedModelConfig, updateProcessState, addLogEntryCallback, performAutoSave, stagnationInfo, selectedModelName, onRateLimitErrorEncountered]);


  const handleStart = async () => {
    if (state.loadedFiles.length === 0 && !state.initialPrompt.trim() && !state.currentProduct) {
        updateProcessState({ statusMessage: "Please load input file(s) or provide an initial text prompt." });
        return;
    }
    if (state.isPlanActive && state.planStages.length === 0) {
        updateProcessState({ statusMessage: "Iterative Plan is active but no stages are defined. Add stages or deactivate the plan." });
        return;
    }

    haltSignalRef.current = false;
    setStagnationInfo({ isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined });

    const isResuming = state.currentIteration > 0 && state.iterationHistory.some(entry => entry.iteration === state.currentIteration) && state.currentProduct !== null;

    let productForFirstProcessingStep: string;
    let initialOverallIterationCounter: number;
    let fileManifestForIter0Logging: string = state.loadedFiles.length > 0 ? state.initialPrompt : "";

    if (isResuming) {
        productForFirstProcessingStep = state.currentProduct!;
        initialOverallIterationCounter = state.currentIteration;
        updateProcessState({
            isProcessing: true,
            finalProduct: null,
            statusMessage: `Resuming process from Iteration ${state.currentIteration}...`,
            configAtFinalization: null,
            aiProcessInsight: "Resuming process...",
            isApiRateLimited: false,
            rateLimitCooldownActiveSeconds: 0,
            currentAppliedModelConfig: null,
        });
    } else {
        productForFirstProcessingStep = state.loadedFiles.length > 0 ? "" : state.initialPrompt; 
        if (state.loadedFiles.length > 0 && state.initialPrompt && !state.initialPrompt.startsWith("Input consists of")) {
            productForFirstProcessingStep = "";
        }

        initialOverallIterationCounter = 0;
        updateProcessState({
            isProcessing: true,
            currentIteration: 0,
            iterationHistory: [], 
            currentProduct: productForFirstProcessingStep, 
            finalProduct: null,
            statusMessage: "Starting new process...",
            aiProcessInsight: "Initiating process. AI will generate initial content from files if provided, or refine prompt.",
            currentProductBeforeHalt: null,
            currentIterationBeforeHalt: undefined,
            configAtFinalization: null,
            isApiRateLimited: false, 
            rateLimitCooldownActiveSeconds: 0,
            currentAppliedModelConfig: null,
        });
        
        const iterZeroProduct = state.loadedFiles.length > 0 ? "" : state.initialPrompt;
        const iterZeroFileProcessingInfo: FileProcessingInfo = {
            filesSentToApiIteration: null, 
            numberOfFilesActuallySent: state.loadedFiles.length, 
            totalFilesSizeBytesSent: state.loadedFiles.reduce((sum, f) => sum + f.size, 0),
            fileManifestProvidedCharacterCount: fileManifestForIter0Logging.length, 
        };
        // For Iteration 0, direct response and processed product are the same
        const iterZeroLength = iterZeroProduct.length;
        const iterZeroHead = iterZeroProduct.substring(0, RAW_OUTPUT_HEAD_TAIL_LENGTH);
        const iterZeroTail = iterZeroProduct.substring(Math.max(0, iterZeroLength - RAW_OUTPUT_HEAD_TAIL_LENGTH));

        addLogEntryCallback({
            iteration: 0,
            currentFullProduct: iterZeroProduct, 
            previousFullProduct: "", 
            status: "Initial state loaded. Ready for first AI processing step.",
            modelConfigUsed: getCalculatedModelConfig(0, state.isPlanActive && state.planStages.length > 0 ? (state.planStages[0]?.stageIterations || 1) : state.maxIterations), 
            readabilityScoreFlesch: calculateFleschReadingEase(iterZeroProduct),
            fileProcessingInfo: iterZeroFileProcessingInfo,
            aiValidationInfo: { checkName: 'InitialState', passed: true, reason: 'No AI response to validate yet.', details: { type: 'passed' } },
            directAiResponseHead: iterZeroHead,
            directAiResponseTail: iterZeroTail,
            directAiResponseLengthChars: iterZeroLength,
            processedProductHead: iterZeroHead,
            processedProductTail: iterZeroTail,
            processedProductLengthChars: iterZeroLength,
        });
        productForFirstProcessingStep = iterZeroProduct; 
    }

    let currentProductForIteration = productForFirstProcessingStep;
    let overallIteration = initialOverallIterationCounter;
    let processingCompletedSuccessfully = true;

    if (!state.isPlanActive) { // Global Mode
        for (let i = overallIteration + 1; i <= state.maxIterations; i++) {
            if (haltSignalRef.current) { processingCompletedSuccessfully = false; break; }
            const result = await processSingleIteration(
                currentProductForIteration, i, state.maxIterations,
                null, state.outputParagraphShowHeadings, state.outputParagraphMaxHeadingDepth, state.outputParagraphNumberedHeadings,
                undefined, i 
            );
            currentProductForIteration = result.product;
            overallIteration = i;
            if (result.status !== 'COMPLETED' && result.status !== 'CONVERGED') { 
                if(result.status === 'ERROR' || result.status === 'HALTED') processingCompletedSuccessfully = false;
                break;
            }
             if (result.status === 'CONVERGED') break; 
        }
    } else { // Plan Mode
        let currentPlanStageRuntimeIndex = state.currentPlanStageIndex ?? 0;
        if (isResuming && state.currentPlanStageIndex !== null) {
            currentPlanStageRuntimeIndex = state.currentPlanStageIndex;
        } else {
             updateProcessState({currentPlanStageIndex: 0, currentStageIteration: 0});
        }

        for (let stageIdx = currentPlanStageRuntimeIndex; stageIdx < state.planStages.length; stageIdx++) {
            const currentStage = state.planStages[stageIdx];
            updateProcessState({ currentPlanStageIndex: stageIdx });
            
            let startIterForStage = 1; 
            if(isResuming && stageIdx === currentPlanStageRuntimeIndex && state.currentStageIteration > 0) {
                startIterForStage = state.currentStageIteration + 1;
            } else if (stageIdx === currentPlanStageRuntimeIndex && state.currentStageIteration === 0 && isResuming) {
                 startIterForStage = 1; 
            }


            for (let stageIter = startIterForStage; stageIter <= currentStage.stageIterations; stageIter++) {
                overallIteration++; 
                 updateProcessState({ currentStageIteration: stageIter });
                if (haltSignalRef.current) { processingCompletedSuccessfully = false; break; }

                const stageDisplayInfo = `Plan Stage ${stageIdx + 1}/${state.planStages.length} (${currentStage.format}, ${currentStage.length}, ${currentStage.complexity})`;
                const result = await processSingleIteration(
                    currentProductForIteration, overallIteration, currentStage.stageIterations,
                    currentStage,
                    currentStage.outputParagraphShowHeadings ?? state.outputParagraphShowHeadings,
                    currentStage.outputParagraphMaxHeadingDepth ?? state.outputParagraphMaxHeadingDepth,
                    currentStage.outputParagraphNumberedHeadings ?? state.outputParagraphNumberedHeadings,
                    stageDisplayInfo,
                    stageIter
                );
                currentProductForIteration = result.product;
                if (result.status !== 'COMPLETED' && result.status !== 'CONVERGED') {
                    if(result.status === 'ERROR' || result.status === 'HALTED') processingCompletedSuccessfully = false;
                    break; 
                }
                 if (result.status === 'CONVERGED') break; 
            }
            if (haltSignalRef.current || !processingCompletedSuccessfully) break; 
        }
    }
    
    const finalStatusMessage = haltSignalRef.current ? "Process halted by user."
        : !processingCompletedSuccessfully ? (state.statusMessage || "Process encountered an error.")
        : currentProductForIteration.startsWith(CONVERGED_PREFIX) ? "Process converged."
        : "Process completed successfully.";

    const finalAiInsight = haltSignalRef.current ? "Process was halted by the user."
        : !processingCompletedSuccessfully ? (state.aiProcessInsight || "An error occurred during processing.")
        : currentProductForIteration.startsWith(CONVERGED_PREFIX) ? "AI signaled convergence criteria met."
        : "All iterations/plan stages completed.";

    updateProcessState({
        isProcessing: false,
        finalProduct: currentProductForIteration.startsWith(CONVERGED_PREFIX) ? currentProductForIteration.substring(CONVERGED_PREFIX.length) : currentProductForIteration,
        statusMessage: finalStatusMessage,
        aiProcessInsight: finalAiInsight,
        configAtFinalization: getCalculatedModelConfig(overallIteration, state.isPlanActive ? (state.planStages[state.currentPlanStageIndex ?? 0]?.stageIterations || 1) : state.maxIterations),
        currentIteration: overallIteration, 
        currentAppliedModelConfig: null, 
    });
    
    await performAutoSave();
  };

  const handleHalt = useCallback(() => {
    haltSignalRef.current = true;
    updateProcessState({ 
        statusMessage: "Halt signal received. Finishing current AI call...",
        currentProductBeforeHalt: state.currentProduct, 
        currentIterationBeforeHalt: state.currentIteration, 
    });
  }, [updateProcessState, state.currentProduct, state.currentIteration]);

  return { handleStart, handleHalt };
};
