
import { useRef, useState, useCallback }
from 'react';
import type { ProcessState, IterationLogEntry, IterateProductResult, PlanStage, ModelConfig, StagnationInfo, ApiStreamCallDetail, FileProcessingInfo, IterationResultDetails, AiResponseValidationInfo, IsLikelyAiErrorResponseResult, NudgeStrategy, RetryContext, OutlineGenerationResult, SelectableModelName, LoadedFile, ModelStrategy, IterationEntryType } from '../types.ts';
import * as GeminaiService from '../services/geminiService';
import { determineInitialStrategy, reevaluateStrategy } from '../services/ModelStrategyService';
import { isLikelyAiErrorResponse, getProductSummary, parseAndCleanJsonOutput, CONVERGED_PREFIX } from '../services/iterationUtils';
import { calculateFleschReadingEase, calculateJaccardSimilarity, calculateLexicalDensity, calculateAvgSentenceLength, calculateSimpleTTR } from '../services/textAnalysisService';
import { DETERMINISTIC_TARGET_ITERATION } from '../hooks/useModelParameters';
import * as Diff from 'diff';
import type { AddLogEntryParams } from './useProcessState';


const SELF_CORRECTION_MAX_ATTEMPTS = 2;

const BASE_THRESHOLD_PARAMS_LIGHT = 1; 
const BASE_THRESHOLD_PARAMS_HEAVY = 2; 
const BASE_THRESHOLD_META_INSTRUCT = 3;

const STAGNATION_SIMILARITY_THRESHOLD = 0.95; 
const STAGNATION_MIN_CHANGE_THRESHOLD = 5; 

const FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT = 0.985; 
const FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT = 1; 
const FORCED_CONVERGENCE_CHAR_DELTA_STRICT = 50;


const STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT = 0.85; 

interface OutlineSegment {
    title: string;
    content: string; 
    level: number; 
}

const parseOutlineToSegments = (outlineMarkdown: string): OutlineSegment[] => {
    const segments: OutlineSegment[] = [];
    if (!outlineMarkdown || !outlineMarkdown.trim()) return segments;

    const lines = outlineMarkdown.split('\n');
    let currentSegment: OutlineSegment | null = null;
    
    let primaryHeadingRegex = /^(##\s+.*)/; 
    if (!lines.some(line => primaryHeadingRegex.test(line))) {
        primaryHeadingRegex = /^(#\s+.*)/; 
    }


    for (const line of lines) {
        const headingMatch = line.match(primaryHeadingRegex);
        if (headingMatch) {
            if (currentSegment) {
                segments.push({...currentSegment, content: currentSegment.content.trim()});
            }
            const level = headingMatch[0].startsWith('##') ? 2 : 1;
            currentSegment = { title: headingMatch[0].replace(primaryHeadingRegex, '$1').replace(/^#+\s*/, '').trim(), content: "", level };
        } else if (currentSegment) {
            currentSegment.content += line + '\n';
        } else if (segments.length === 0 && line.trim() !== "") { 
            currentSegment = { title: "Introduction / Preface (Auto-Segmented)", content: line + '\n', level: 0 };
        }
    }
    if (currentSegment) {
         segments.push({...currentSegment, content: currentSegment.content.trim()});
    }
    
    if (segments.length === 0 && outlineMarkdown.trim()) {
        segments.push({ title: "Full Document (Auto-Segmented)", content: outlineMarkdown.trim(), level: 0 });
    }

    return segments;
};


export const useIterativeLogic = (
  processState: ProcessState,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  addLogEntryFromHook: (logData: AddLogEntryParams) => void,
  getUserSetBaseConfig: () => ModelConfig,
  performAutoSave: () => Promise<void>,
  handleRateLimitErrorEncountered: () => void,
) => {
  const isProcessingRef = useRef(false);
  const haltSignalRef = useRef(false);
  const currentStreamBufferRef = useRef("");

  const logIterationData = useCallback((
    iterationNumber: number,
    entryType: IterationEntryType, // Added
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
    // isSegmentedSynthesis and isTargetedRefinement are now inferred from entryType
    targetedSelection?: string, 
    targetedRefinementInstructions?: string 
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
      promptSystemInstructionSent: apiResult?.promptSystemInstructionSent,
      promptCoreUserInstructionsSent: apiResult?.promptCoreUserInstructionsSent,
      promptFullUserPromptSent: apiResult?.promptFullUserPromptSent,
      apiStreamDetails: apiResult?.apiStreamDetails,
      modelConfigUsed: modelConfigUsed,
      readabilityScoreFlesch: calculateFleschReadingEase(finalProductForSummary),
      lexicalDensity: calculateLexicalDensity(finalProductForSummary),
      avgSentenceLength: calculateAvgSentenceLength(finalProductForSummary),
      typeTokenRatio: calculateSimpleTTR(finalProductForSummary),
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
      isSegmentedSynthesis: entryType === 'segmented_synthesis_milestone',
      isTargetedRefinement: entryType === 'targeted_refinement', 
      targetedSelection, 
      targetedRefinementInstructions 
    });
  }, [addLogEntryFromHook, processState.isPlanActive, processState.currentPlanStageIndex, processState.planStages]);


  const handleHalt = () => {
    haltSignalRef.current = true;
    isProcessingRef.current = false; 
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
        thresholdMeta  = 2; 
    }
    thresholdHeavy = Math.max(thresholdLight, thresholdHeavy);
    thresholdMeta = Math.max(thresholdHeavy, thresholdMeta);

    if (consecutiveStagnantIterations >= thresholdMeta) return 'meta_instruct';
    if (consecutiveStagnantIterations >= thresholdHeavy) return 'params_heavy';
    if (consecutiveStagnantIterations >= thresholdLight) return 'params_light';
    return 'none';
  };


  const handleStart = async (
    options?: { 
      isTargetedRefinement?: boolean; 
      targetedSelection?: string; 
      targetedInstructions?: string; 
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

    let currentIter = processState.currentProductBeforeHalt !== null ? (processState.currentIterationBeforeHalt ?? processState.currentIteration) : processState.currentIteration;
    let currentProd = options?.isTargetedRefinement ? processState.currentProduct : (processState.currentProductBeforeHalt ?? processState.currentProduct);


    let currentPlanStageIdx = processState.currentProductBeforeHalt !== null ? (processState.currentPlanStageIndex ?? (processState.isPlanActive && processState.planStages.length > 0 ? 0 : null)) : (processState.isPlanActive && processState.planStages.length > 0 ? (processState.currentPlanStageIndex ?? 0) : null);
    let currentStageIterCount = processState.currentProductBeforeHalt !== null ? (processState.currentStageIteration ?? 0) : (processState.currentStageIteration ?? 0);
    
    if (options?.isTargetedRefinement) {
        currentPlanStageIdx = null; 
        currentStageIterCount = 0;
    }
    
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
      statusMessage: options?.isTargetedRefinement ? "Starting targeted section refinement..." : "Starting process...", 
      aiProcessInsight: options?.isTargetedRefinement ? "Initializing strategy for targeted refinement..." : "Initializing strategy for Iteration 1...",
      currentProductBeforeHalt: null, currentIterationBeforeHalt: undefined, 
      currentModelForIteration: iterationStrategy.modelName,
      currentAppliedModelConfig: iterationStrategy.config,
      activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
    });

    if (currentIter === 0 && !options?.isTargetedRefinement && (currentProd === null || currentProd.trim() === "")) {
      const initialFileProcessingInfo: FileProcessingInfo = {
        filesSentToApiIteration: null, 
        numberOfFilesActuallySent: processState.loadedFiles.length,
        totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
        fileManifestProvidedCharacterCount: processState.initialPrompt.length, 
        loadedFilesForIterationContext: processState.loadedFiles, 
      };
      let iterZeroProduct = ""; 
      if (processState.loadedFiles.length === 0 && processState.initialPrompt.trim() !== "") {
        iterZeroProduct = processState.initialPrompt; 
      }
      currentProd = iterZeroProduct;
      logIterationData(
        0, 'initial_state', iterZeroProduct, "Initial state loaded.", "",
        undefined, iterationStrategy.config, 
        initialFileProcessingInfo, undefined,
        iterZeroProduct.length, iterZeroProduct.length, 0,
        iterationStrategy.rationale, 
        iterationStrategy.modelName, 
        iterationStrategy.activeMetaInstruction,
        undefined, undefined 
      );
      updateProcessState({ 
        currentProduct: iterZeroProduct, 
        currentIteration: 0,
        stagnationInfo: { 
            ...processState.stagnationInfo, 
            consecutiveStagnantIterations: 0,
            similarityWithPrevious: undefined,
            consecutiveLowValueIterations: 0, 
            lastProductLengthForStagnation: iterZeroProduct.length 
        }
      });
      await performAutoSave();
    }
    
    const outlineResultForIter1 = processState.iterationHistory.find(entry => entry.iteration === 0)?.apiStreamDetails?.[0] ? 
        { 
            outline: (processState.iterationHistory.find(entry => entry.iteration === 0)?.apiStreamDetails?.[0] as any).outlineContent || "", 
            identifiedRedundancies: (processState.iterationHistory.find(entry => entry.iteration === 0)?.apiStreamDetails?.[0] as any).redundancyContent || "", 
            apiDetails: processState.iterationHistory.find(entry => entry.iteration === 0)?.apiStreamDetails 
        } as OutlineGenerationResult 
        : undefined; 

    if (currentIter === 0 && !options?.isTargetedRefinement && outlineResultForIter1 && outlineResultForIter1.outline.trim() && processState.loadedFiles.length > 0) {
        updateProcessState({ statusMessage: "Starting segmented synthesis for Iteration 1...", aiProcessInsight: "Segmented Iteration 1: Preparing outline segments."});
        const segments = parseOutlineToSegments(outlineResultForIter1.outline);
        let assembledProductFromSegments = "";
        const allSegmentApiDetails: ApiStreamCallDetail[] = [];
        let segmentedSynthesisError = null;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            updateProcessState({ statusMessage: `Segmented Iteration 1 (${i+1}/${segments.length}): Synthesizing "${segment.title}"...`});
            
            if (haltSignalRef.current) {
                segmentedSynthesisError = "Halted by user during segmented synthesis.";
                break;
            }
            currentStreamBufferRef.current = ""; 

             const segmentStrategy = iterationStrategy; 
            
            const segmentApiResult = await GeminaiService.iterateProduct({
                currentProduct: "", 
                currentIterationOverall: 0, 
                maxIterationsOverall: 1, 
                fileManifest: processState.initialPrompt, 
                loadedFiles: processState.loadedFiles, 
                activePlanStage: null, 
                outputParagraphShowHeadings: processState.outputParagraphShowHeadings,
                outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth,
                outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
                modelConfigToUse: segmentStrategy.config,
                isGlobalMode: false, 
                modelToUse: segmentStrategy.modelName,
                onStreamChunk,
                isHaltSignalled: () => haltSignalRef.current,
                initialOutlineForIter1: outlineResultForIter1, 
                activeMetaInstruction: undefined, 
                operationType: "segment_synthesis",
                currentSegmentOutlineText: `${segment.title}\n${segment.content}`,
                fullOutlineForContext: outlineResultForIter1.outline,
            });

            if (segmentApiResult.apiStreamDetails) {
                segmentApiResult.apiStreamDetails.forEach(detail => {
                    allSegmentApiDetails.push({ ...detail, segmentIndex: i, segmentTitle: segment.title });
                });
            }

            if (segmentApiResult.status === 'ERROR' || segmentApiResult.isRateLimitError) {
                segmentedSynthesisError = `Error in segment "${segment.title}": ${segmentApiResult.errorMessage}`;
                if (segmentApiResult.isRateLimitError) handleRateLimitErrorEncountered();
                break;
            }
            if (haltSignalRef.current) {
                segmentedSynthesisError = `Halted by user during segment "${segment.title}".`;
                assembledProductFromSegments += (currentStreamBufferRef.current || ""); 
                break;
            }
            assembledProductFromSegments += (currentStreamBufferRef.current || "") + "\n\n"; 
        }

        currentProd = assembledProductFromSegments.trim();
        currentIter = 1; 

        logIterationData(
            currentIter, 'segmented_synthesis_milestone', currentProd, 
            segmentedSynthesisError || "Segmented Iteration 1 completed.", 
            processState.iterationHistory.find(e => e.iteration === 0)?.productSummary || processState.initialPrompt, 
            { 
                product: currentProd,
                status: segmentedSynthesisError ? 'ERROR' : 'COMPLETED',
                errorMessage: segmentedSynthesisError || undefined,
                apiStreamDetails: allSegmentApiDetails,
                promptFullUserPromptSent: `Segmented synthesis performed for Iteration 1 using ${segments.length} segments from outline. Full file data used for each segment.`
            },
            iterationStrategy.config,
            { 
                filesSentToApiIteration: 1, 
                numberOfFilesActuallySent: processState.loadedFiles.length,
                totalFilesSizeBytesSent: processState.loadedFiles.reduce((sum, f) => sum + f.size, 0),
                fileManifestProvidedCharacterCount: processState.initialPrompt.length,
                loadedFilesForIterationContext: processState.loadedFiles,
            },
            undefined, 
            currentProd.length, currentProd.length, 1, 
            iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction,
            undefined, undefined 
        );
        
        updateProcessState({ 
            currentProduct: currentProd, 
            currentIteration: currentIter, 
            statusMessage: segmentedSynthesisError || "Segmented Iteration 1 synthesis complete.",
            aiProcessInsight: segmentedSynthesisError || `Iteration 1 (Segmented): Assembled product from ${segments.length} segments.`,
            isProcessing: !!segmentedSynthesisError || haltSignalRef.current ? false : true, 
        });

        if (segmentedSynthesisError || haltSignalRef.current) {
            isProcessingRef.current = false;
            await performAutoSave();
            return; 
        }
        await performAutoSave();
    }


    const maxOverallIterations = processState.maxIterations;
    let productBeforeThisFailedIteration: string | null = currentProd;


    while (true) {
      if (haltSignalRef.current) {
        updateProcessState({ isProcessing: false, statusMessage: "Process halted by user.", currentProductBeforeHalt: productBeforeThisFailedIteration, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
        break;
      }

      const isThisIterationTargeted = !!(options?.isTargetedRefinement && currentIter === processState.currentIteration); 
      const currentEntryType: IterationEntryType = isThisIterationTargeted ? 'targeted_refinement' : 'ai_iteration';
      const isGlobalMode = !processState.isPlanActive || isThisIterationTargeted; 
      let activePlanStage: PlanStage | null = null;
      let iterationScopeMax = maxOverallIterations;

      if (processState.isPlanActive && !isThisIterationTargeted) {
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
      } else if (!isThisIterationTargeted) { 
        if (currentIter >= maxOverallIterations) {
          updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: "Maximum global iterations reached.", aiProcessInsight: "Global iterations complete.", configAtFinalization: iterationStrategy.config });
          break;
        }
      }

      productBeforeThisFailedIteration = currentProd;
      let iterationAttemptCount = 0; 

      const iterationProgressPercentForNudge = maxOverallIterations > 0 ? currentIter / maxOverallIterations : 0;
      const nudgeStrategyForThisIteration = isThisIterationTargeted ? 'none' : determineNudgeStrategyForNext(
          processState.stagnationInfo.consecutiveStagnantIterations,
          processState.stagnationNudgeEnabled,
          iterationProgressPercentForNudge,
          processState.stagnationNudgeAggressiveness
      );
      const stagnationInfoForStrategyCall = { ...processState.stagnationInfo, nudgeStrategyApplied: nudgeStrategyForThisIteration };
      
      const stateForCurrentStrategyEval: Pick<ProcessState, 'currentProduct' | 'currentIteration' | 'maxIterations' | 'inputComplexity' | 'stagnationInfo' | 'iterationHistory' | 'currentModelForIteration' | 'currentAppliedModelConfig' | 'isPlanActive' | 'planStages'| 'currentPlanStageIndex' | 'selectedModelName' | 'stagnationNudgeEnabled' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness' | 'initialPrompt' | 'loadedFiles'> = {
        currentProduct: currentProd, currentIteration: currentIter, maxIterations: processState.maxIterations,
        inputComplexity: processState.inputComplexity, stagnationInfo: stagnationInfoForStrategyCall,
        iterationHistory: processState.iterationHistory, currentModelForIteration: processState.currentModelForIteration, 
        currentAppliedModelConfig: processState.currentAppliedModelConfig,
        isPlanActive: processState.isPlanActive && !isThisIterationTargeted, 
        planStages: processState.planStages, currentPlanStageIndex: currentPlanStageIdx,
        selectedModelName: processState.selectedModelName, stagnationNudgeEnabled: processState.stagnationNudgeEnabled,
        strategistInfluenceLevel: processState.strategistInfluenceLevel, stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
        initialPrompt: processState.initialPrompt, loadedFiles: processState.loadedFiles,
      };
      iterationStrategy = await reevaluateStrategy(stateForCurrentStrategyEval, userBaseConfig);
      
      updateProcessState({ 
          currentModelForIteration: iterationStrategy.modelName,
          currentAppliedModelConfig: iterationStrategy.config,
          activeMetaInstructionForNextIter: iterationStrategy.activeMetaInstruction 
      });

      let currentStatusMsg = `Iteration ${currentIter + 1}`;
      if (isThisIterationTargeted) {
        currentStatusMsg = `Iteration ${currentIter + 1}: Refining selected text...`;
      } else if (activePlanStage) {
        currentStatusMsg = `Plan Stage ${currentPlanStageIdx! + 1}/${processState.planStages.length} (Iter. ${currentStageIterCount + 1}/${activePlanStage.stageIterations}): Processing...`;
      } else {
        currentStatusMsg = `Global Iteration ${currentIter + 1}/${maxOverallIterations}: Processing...`;
      }
      currentStatusMsg += ` Using Model: ${iterationStrategy.modelName}`;
      if (!isThisIterationTargeted && iterationStrategy.activeMetaInstruction && nudgeStrategyForThisIteration === 'meta_instruct') {
          currentStatusMsg += ` (Nudge: AI Meta-Guidance Applied)`;
      } else if (!isThisIterationTargeted && nudgeStrategyForThisIteration !== 'none' && nudgeStrategyForThisIteration !== 'meta_instruct') {
          currentStatusMsg += ` (Nudge: ${nudgeStrategyForThisIteration.replace('params_', '')} Parameter Adjustment)`;
      }
      updateProcessState({ statusMessage: currentStatusMsg, aiProcessInsight: `Strategy for Iter ${currentIter + 1}: ${iterationStrategy.rationale}` });

      currentStreamBufferRef.current = "";
      const previousProductSnapshot = currentProd;

      let iterationSuccessful = false;
      let iterationProductFromApi = "";
      let apiResultForLog: IterateProductResult | undefined;
      let validationInfoForLog: AiResponseValidationInfo | undefined;
      let fileProcessingInfoForApi: FileProcessingInfo; 

      for (let attempt = 1; attempt <= SELF_CORRECTION_MAX_ATTEMPTS; attempt++) {
          iterationAttemptCount = attempt;
          currentStreamBufferRef.current = ""; 

          let currentRetryContext: RetryContext | undefined = undefined;
          if (attempt > 1 && processState.iterationHistory.length > 0) {
              const lastLogEntriesForThisIter = processState.iterationHistory.filter(e => e.iteration === (currentIter + 1));
              const lastFailedAttemptLog = lastLogEntriesForThisIter.sort((a,b) => (b.attemptCount || 0) - (a.attemptCount || 0))[0];
              if(lastFailedAttemptLog && lastFailedAttemptLog.aiValidationInfo && !lastFailedAttemptLog.aiValidationInfo.passed && lastFailedAttemptLog.promptCoreUserInstructionsSent) {
                  currentRetryContext = { previousErrorReason: lastFailedAttemptLog.aiValidationInfo.reason || "AI response validation failed.", originalCoreInstructions: lastFailedAttemptLog.promptCoreUserInstructionsSent };
              }
          }
          
          const filesActuallySentInIterateProductCall = (currentIter + 1) === 1 && processState.loadedFiles.length > 0 && !processState.iterationHistory.some(e=>e.iteration === 1 && e.entryType === 'segmented_synthesis_milestone') && !isThisIterationTargeted;
          fileProcessingInfoForApi = { 
              filesSentToApiIteration: filesActuallySentInIterateProductCall ? (currentIter + 1) : null,
              numberOfFilesActuallySent: filesActuallySentInIterateProductCall ? processState.loadedFiles.length : 0,
              totalFilesSizeBytesSent: filesActuallySentInIterateProductCall ? processState.loadedFiles.reduce((sum, f) => sum + f.size, 0) : 0,
              fileManifestProvidedCharacterCount: processState.initialPrompt.length, 
              loadedFilesForIterationContext: filesActuallySentInIterateProductCall ? processState.loadedFiles : undefined,
          };
          
          const outlineForThisCall = (currentIter + 1) === 1 && !processState.iterationHistory.some(e=>e.iteration === 1 && e.entryType === 'segmented_synthesis_milestone') && !isThisIterationTargeted ? outlineResultForIter1 : undefined;

          apiResultForLog = await GeminaiService.iterateProduct({
            currentProduct: currentProd || "", 
            currentIterationOverall: currentIter + 1, 
            maxIterationsOverall: isThisIterationTargeted ? currentIter + 1 : iterationScopeMax, 
            fileManifest: processState.initialPrompt, 
            loadedFiles: processState.loadedFiles, 
            activePlanStage: isThisIterationTargeted ? null : activePlanStage,
            outputParagraphShowHeadings: processState.outputParagraphShowHeadings, 
            outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth, 
            outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
            modelConfigToUse: iterationStrategy.config, 
            isGlobalMode, 
            modelToUse: iterationStrategy.modelName,
            onStreamChunk, 
            isHaltSignalled: () => haltSignalRef.current,
            retryContext: currentRetryContext, 
            stagnationNudgeStrategy: nudgeStrategyForThisIteration,
            initialOutlineForIter1: outlineForThisCall, 
            activeMetaInstruction: iterationStrategy.activeMetaInstruction,
            operationType: "full", 
            isTargetedRefinementMode: isThisIterationTargeted,
            targetedSelectionText: options?.targetedSelection,
            targetedRefinementInstructions: options?.targetedInstructions,
          });

          if (haltSignalRef.current) {
            updateProcessState({ isProcessing: false, statusMessage: "Process halted by user during AI response.", currentProductBeforeHalt: currentStreamBufferRef.current || currentProd, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
            logIterationData(currentIter + 1, currentEntryType, currentStreamBufferRef.current || currentProd, "Halted by user", previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, undefined, (currentStreamBufferRef.current || currentProd)?.length, (currentStreamBufferRef.current || currentProd)?.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
            iterationSuccessful = false; break; 
          }
          iterationProductFromApi = currentStreamBufferRef.current;

          if (apiResultForLog.isRateLimitError) {
            handleRateLimitErrorEncountered();
            updateProcessState({ isProcessing: false, statusMessage: apiResultForLog.errorMessage || "API Rate Limit Hit.", aiProcessInsight: apiResultForLog.errorMessage || "Process paused due to API rate limits.", currentProductBeforeHalt: iterationProductFromApi, currentIterationBeforeHalt: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx });
            logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `API Rate Limit: ${apiResultForLog.errorMessage}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, { checkName: "APILimit", passed: false, reason: apiResultForLog.errorMessage, details: { type: 'error_phrase', value: apiResultForLog.errorMessage } }, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
            iterationSuccessful = false; isProcessingRef.current = false; break;
          }
          if (apiResultForLog.status === 'ERROR') {
            updateProcessState({ isProcessing: false, statusMessage: `Error in Iteration ${currentIter + 1}: ${apiResultForLog.errorMessage}`, aiProcessInsight: `AI Error: ${apiResultForLog.errorMessage}` });
            logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `Error: ${apiResultForLog.errorMessage}`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, { checkName: "APIError", passed: false, reason: apiResultForLog.errorMessage, details: {type: 'error_phrase', value: apiResultForLog.errorMessage } }, iterationProductFromApi.length, iterationProductFromApi.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
            iterationSuccessful = false; isProcessingRef.current = false; break;
          }

          let processedProduct = iterationProductFromApi;
          if (activePlanStage && activePlanStage.format === 'json' && !isThisIterationTargeted) {
              processedProduct = parseAndCleanJsonOutput(iterationProductFromApi);
          }
          if (processedProduct.startsWith(CONVERGED_PREFIX)) {
              processedProduct = processedProduct.substring(CONVERGED_PREFIX.length);
          }
          
          const tempLogEntryForValidation: IterationLogEntry = {
            iteration: currentIter + 1,
            entryType: currentEntryType,
            productSummary: getProductSummary(iterationProductFromApi), 
            status: apiResultForLog?.status || "VALIDATING",
            timestamp: Date.now(),
            fileProcessingInfo: fileProcessingInfoForApi,
            apiStreamDetails: apiResultForLog?.apiStreamDetails, 
            linesAdded: 0, linesRemoved: 0, 
          };
          const aiValidationResult: IsLikelyAiErrorResponseResult = isLikelyAiErrorResponse( iterationProductFromApi, previousProductSnapshot || "", tempLogEntryForValidation, isThisIterationTargeted ? undefined : activePlanStage?.length, isThisIterationTargeted ? undefined : activePlanStage?.format );
          validationInfoForLog = aiValidationResult.checkDetails ? { checkName: "AIResponseValidation", passed: !aiValidationResult.isError, reason: aiValidationResult.reason, details: aiValidationResult.checkDetails } : undefined;
          
          let isCritFailureFromValidation = false;
          if (aiValidationResult.isError && validationInfoForLog?.details?.type) {
              const criticalErrorTypes: AiResponseValidationInfo['details']['type'][] = [ 'prompt_leakage', 'error_phrase_with_significant_reduction', 'extreme_reduction_error', 'extreme_reduction_instructed_but_with_error_phrase', 'initial_synthesis_failed_large_output', 'catastrophic_collapse' ];
              if (criticalErrorTypes.includes(validationInfoForLog.details.type)) isCritFailureFromValidation = true;
              if (validationInfoForLog.details.type === 'error_phrase' && typeof validationInfoForLog.details.value === 'string' && validationInfoForLog.details.value.startsWith('API Finish Reason: UNKNOWN')) {
                isCritFailureFromValidation = true;
              }
          }

          if (aiValidationResult.isError) {
              if (isCritFailureFromValidation || attempt >= SELF_CORRECTION_MAX_ATTEMPTS) {
                  currentProd = productBeforeThisFailedIteration; 
                  const finalReason = isCritFailureFromValidation ? `CRITICAL: ${aiValidationResult.reason}` : `Failed Validation (Max Attempts): ${aiValidationResult.reason}`;
                  updateProcessState({ isProcessing: false, statusMessage: `Iteration ${currentIter + 1}: ${finalReason}. Process halted.`, aiProcessInsight: `Halted. AI response issue: ${finalReason}`, finalProduct: currentProd, currentProductBeforeHalt: currentProd, currentIterationBeforeHalt: currentIter, configAtFinalization: iterationStrategy.config });
                  logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, finalReason, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, processedProduct.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
                  iterationSuccessful = false; isProcessingRef.current = false; break;
              } else { 
                  updateProcessState({ statusMessage: `Iteration ${currentIter + 1} Attempt ${attempt + 1}: AI response flagged (${aiValidationResult.reason}). Retrying...`, aiProcessInsight: `Self-correction attempt ${attempt + 1} for: ${aiValidationResult.reason}` });
                  logIterationData(currentIter + 1, currentEntryType, iterationProductFromApi, `Attempt ${attempt} Failed Validation: ${aiValidationResult.reason}. Retrying...`, previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, processedProduct.length, attempt, iterationStrategy.rationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
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

      let finalStrategyRationale = iterationStrategy.rationale;
      let systemForcedConvergence = false;
      let newStagnationInfo: StagnationInfo = { ...processState.stagnationInfo, nudgeStrategyApplied: 'none' }; 
      let currentSimilarity = 0;
      let netLineChange = 0;
      let charLengthChange = 0;

      if (apiResultForLog?.status !== 'CONVERGED' && currentIter >= 0 && !isThisIterationTargeted) { 
        currentSimilarity = calculateJaccardSimilarity(previousProductSnapshot, currentProd);
        
        const iterLogDiffLines = Diff.diffLines(previousProductSnapshot || "", currentProd || "", { newlineIsToken: true, ignoreWhitespace: false });
        netLineChange = iterLogDiffLines.reduce((acc, part) => acc + (part.added ? (part.count || 0) : (part.removed ? -(part.count || 0) : 0)), 0);
        
        charLengthChange = Math.abs((currentProd?.length || 0) - (processState.stagnationInfo.lastProductLengthForStagnation ?? (currentProd?.length || 0)));

        if (currentIter > 0 && 
            currentSimilarity >= FORCED_CONVERGENCE_SIMILARITY_THRESHOLD_STRICT && 
            Math.abs(netLineChange) <= FORCED_CONVERGENCE_LINE_CHANGE_THRESHOLD_STRICT &&
            charLengthChange <= FORCED_CONVERGENCE_CHAR_DELTA_STRICT) {
            newStagnationInfo.consecutiveLowValueIterations = (processState.stagnationInfo.consecutiveLowValueIterations || 0) + 1;
        } else if (currentIter > 0) { 
            newStagnationInfo.consecutiveLowValueIterations = 0;
        }
        
        const currentModelConfigIsHighlyDeterministic = iterationStrategy.config.temperature <= 0.1 && iterationStrategy.config.topK <= 3;
        const forceConvergenceCondition1 = newStagnationInfo.consecutiveLowValueIterations >= 2;
        const forceConvergenceCondition2 = newStagnationInfo.consecutiveLowValueIterations >= 1 && isGlobalMode && (currentIter + 1) > DETERMINISTIC_TARGET_ITERATION && currentModelConfigIsHighlyDeterministic;
        
        if (forceConvergenceCondition1 || forceConvergenceCondition2) {
            systemForcedConvergence = true;
            apiResultForLog = { ...apiResultForLog, status: 'CONVERGED' }; 
            const forcedReason = `System-forced convergence: ${newStagnationInfo.consecutiveLowValueIterations} consecutive iter(s) with minimal substantive change (High Similarity: ${currentSimilarity.toFixed(3)}, Line Δ: ${netLineChange}, Char Δ: ${charLengthChange}). ${forceConvergenceCondition2 && !forceConvergenceCondition1 ? "In late-stage deterministic global mode with restrictive params." : ""}`;
            validationInfoForLog = { checkName: "SystemConvergence", passed: true, reason: forcedReason, details: { type: 'passed' }}; 
            finalStrategyRationale = `${finalStrategyRationale} | ${forcedReason}`;
        }
      }

      if (isGlobalMode && !isThisIterationTargeted) { 
          const similarity = calculateJaccardSimilarity(previousProductSnapshot, currentProd);
          const prevLogEntryForStagnation = processState.iterationHistory.find(e => e.iteration === currentIter); 
          const netLineChangeForStagnation = (prevLogEntryForStagnation?.linesAdded || 0) - (prevLogEntryForStagnation?.linesRemoved || 0);
          
          let isNowStagnant = false;
          if (currentIter > 0 && ( (similarity > STAGNATION_SIMILARITY_THRESHOLD || Math.abs(netLineChangeForStagnation) < STAGNATION_MIN_CHANGE_THRESHOLD) && (currentProd || "").length > 0 && (previousProductSnapshot || "").length > 0) ) {
              isNowStagnant = true;
              newStagnationInfo.consecutiveStagnantIterations = (processState.stagnationInfo.consecutiveStagnantIterations || 0) + 1;
          } else if (currentIter > 0) { 
              newStagnationInfo.consecutiveStagnantIterations = 0;
          }
          newStagnationInfo.isStagnant = isNowStagnant;
          newStagnationInfo.similarityWithPrevious = similarity;
      }
      newStagnationInfo.lastProductLengthForStagnation = currentProd?.length || 0; 
      updateProcessState({ stagnationInfo: { ...newStagnationInfo } }); 

      currentIter++;
      if (activePlanStage && !isThisIterationTargeted) currentStageIterCount++;

      logIterationData(currentIter, currentEntryType, iterationProductFromApi, systemForcedConvergence ? "System Forced Convergence" : (apiResultForLog?.status === 'CONVERGED' ? "AI Converged" : "Completed"), previousProductSnapshot, apiResultForLog, iterationStrategy.config, fileProcessingInfoForApi, validationInfoForLog, iterationProductFromApi.length, currentProd?.length || 0, iterationAttemptCount, finalStrategyRationale, iterationStrategy.modelName, iterationStrategy.activeMetaInstruction, options?.targetedSelection, options?.targetedInstructions);
      updateProcessState({ currentProduct: currentProd, currentIteration: currentIter, currentStageIteration: currentStageIterCount, currentPlanStageIndex: currentPlanStageIdx, statusMessage: `Iteration ${currentIter} ${systemForcedConvergence ? "System Forced Convergence" : (apiResultForLog?.status === 'CONVERGED' ? 'AI Converged' : 'Completed')}.`, aiProcessInsight: `AI refinement complete for iter ${currentIter}. ${newStagnationInfo.isStagnant && isGlobalMode && !isThisIterationTargeted ? `Stagnation detected (${newStagnationInfo.consecutiveStagnantIterations}x). Low-value iters: ${newStagnationInfo.consecutiveLowValueIterations}.` : 'Progress good.'}` });
      await performAutoSave();

      if (apiResultForLog?.status === 'CONVERGED') { 
        updateProcessState({ isProcessing: false, finalProduct: currentProd, statusMessage: `Process converged at Iteration ${currentIter}.`, aiProcessInsight: systemForcedConvergence ? `System-forced convergence: ${newStagnationInfo.consecutiveLowValueIterations} consecutive iter(s) with minimal substantive change (Similarity: ${currentSimilarity.toFixed(3)}, Line Δ: ${netLineChange}, Char Δ: ${charLengthChange}).` : "AI indicated convergence.", configAtFinalization: iterationStrategy.config });
        isProcessingRef.current = false; break;
      }
      if (isThisIterationTargeted) {
        updateProcessState({ isProcessing: false, statusMessage: `Targeted refinement for Iteration ${currentIter} complete.` });
        isProcessingRef.current = false; break;
      }
    } 
    isProcessingRef.current = false;
    await performAutoSave();
  };
  return { handleStart, handleHalt };
};
