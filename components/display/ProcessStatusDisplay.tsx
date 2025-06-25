

import React, { useState, useContext } from 'react';
import { useProcessContext } from '../../contexts/ProcessContext';
import { useApplicationContext } from '../../contexts/ApplicationContext';
import { usePlanContext } from '../../contexts/PlanContext';
import { useModelConfigContext } from '../../contexts/ModelConfigContext';
import { SELECTABLE_MODELS, type ProcessState } from '../../types';
import * as ModelStrategyService from '../../services/ModelStrategyService';

const ProcessStatusDisplay: React.FC = () => {
  const processCtx = useProcessContext();
  const appCtx = useApplicationContext();
  const planCtx = usePlanContext();
  const modelConfigCtx = useModelConfigContext();

  const [showConvergenceInfo, setShowConvergenceInfo] = useState(false);
  const convergenceTooltipText = `The AI signals convergence by prefixing its output with "CONVERGED:":
- It believes the current Plan Stage goals or Global Mode refinement is maximally achieved.
- OR the output is identical to the previous iteration.
- Further changes would be trivial, purely stylistic, or detrimental.`;

  let progressPercentValue = 0;
  let progressText = "";
  let statusMessageForDisplay = processCtx.statusMessage;

  if (processCtx.isProcessing) {
    const iter1LogEntry = processCtx.iterationHistory.find(e => e.iteration === 1 && e.isSegmentedSynthesis);
    if (iter1LogEntry && processCtx.currentIteration === 0) { // Special case: currentIter is 0 during segmented Iter 1 processing
        // Extract current segment info from statusMessage if it's there
        const segmentMatch = processCtx.statusMessage.match(/Segmented Iteration 1 \((\d+)\/(\d+)\): Synthesizing "(.*?)"\.\.\./);
        if (segmentMatch) {
            const currentSegmentNum = parseInt(segmentMatch[1], 10);
            const totalSegments = parseInt(segmentMatch[2], 10);
            progressPercentValue = totalSegments > 0 ? (currentSegmentNum / totalSegments) * 100 : 0;
            progressText = `Iter. 1 (Segment ${currentSegmentNum}/${totalSegments}) | Overall ${Math.round(progressPercentValue)}%`;
            statusMessageForDisplay = `Iteration 1 (Segmented): Processing segment ${currentSegmentNum}/${totalSegments} - "${segmentMatch[3]}"...`;
        } else {
            // Fallback if statusMessage format doesn't match expected for segments
            progressPercentValue = 0; // Or some other heuristic
            progressText = `Iter. 1 (Segmented Processing)`;
        }
    } else if (planCtx.isPlanActive && planCtx.planStages.length > 0 && planCtx.currentPlanStageIndex != null) {
      const currentStage = planCtx.planStages[planCtx.currentPlanStageIndex];
      const totalPlanIterations = planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0);
      let completedIterationsInPreviousStages = 0;
      for (let i = 0; i < planCtx.currentPlanStageIndex; i++) {
        completedIterationsInPreviousStages += planCtx.planStages[i].stageIterations;
      }
      const overallCompletedIterations = completedIterationsInPreviousStages + processCtx.currentStageIteration;
      progressPercentValue = totalPlanIterations > 0 ? (overallCompletedIterations / totalPlanIterations) * 100 : 0;
      progressText = `Stage ${planCtx.currentPlanStageIndex + 1}/${planCtx.planStages.length} (Iter. ${processCtx.currentStageIteration}/${currentStage.stageIterations}) | Overall ${Math.round(progressPercentValue)}%`;
    } else {
      progressPercentValue = modelConfigCtx.maxIterations > 0 ? (processCtx.currentIteration / modelConfigCtx.maxIterations) * 100 : 0;
      progressText = `Global Iter. ${processCtx.currentIteration > 0 ? processCtx.currentIteration : (processCtx.isProcessing ? 1 : 0)} / ${modelConfigCtx.maxIterations}`;
    }
  }
  const clampedProgressPercent = Math.min(100, Math.max(0, progressPercentValue));

  const checkAndRenderQuotaError = () => {
    if (!processCtx.aiProcessInsight && !appCtx.isApiRateLimited) return null;
    const lowerInsight = (processCtx.aiProcessInsight || "").toLowerCase();
    const isQuotaErrorIndicatedByInsight =
        lowerInsight.includes("api quota exceeded") ||
        lowerInsight.includes("rate limit hit") ||
        lowerInsight.includes("error 429") ||
        lowerInsight.includes("resource_exhausted");

    if (appCtx.isApiRateLimited || isQuotaErrorIndicatedByInsight) {
      const rateLimitUrl = "https://ai.google.dev/gemini-api/docs/rate-limits";
      const modelNameInUse = processCtx.currentModelForIteration || appCtx.selectedModelName || "the selected model";
      const modelDisplayName = SELECTABLE_MODELS.find(m => m.name === modelNameInUse)?.displayName || modelNameInUse;
      let originalApiMessage = "";
      const originalMsgMatch = (processCtx.aiProcessInsight || "").match(/Original(?: API Message)?:\s*"(.*?)"/i);

      if (originalMsgMatch && originalMsgMatch[1]) {
        originalApiMessage = originalMsgMatch[1].trim();
      } else if (appCtx.isApiRateLimited) {
        originalApiMessage = `The API rate limit is currently active. Please wait for the cooldown (${appCtx.rateLimitCooldownActiveSeconds}s).`;
        if (processCtx.aiProcessInsight && !isQuotaErrorIndicatedByInsight) {
           originalApiMessage += ` General AI Insight: ${processCtx.aiProcessInsight}`;
        } else if (processCtx.aiProcessInsight) {
           originalApiMessage = processCtx.aiProcessInsight;
        }
      } else if (processCtx.aiProcessInsight) {
        originalApiMessage = processCtx.aiProcessInsight;
      }


      return (
        <div className="mt-2 p-4 bg-yellow-50 dark:bg-yellow-700/30 border-l-4 border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-200 rounded-md shadow-md">
          <div className="flex items-start">
            <div className="mr-3 font-bold text-yellow-500 dark:text-yellow-400 text-xl">!</div>
            <div>
              <h3 className="text-md font-semibold mb-1">API Quota Limit Reached or Cooldown Active</h3>
              <p className="text-sm mb-2">
                The process may be halted or delayed due to API quota limits for model <strong className="font-semibold">{modelDisplayName}</strong> or an active cooldown period.
              </p>
              <p className="text-sm mb-2">
                <strong>Suggestions:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                  <li>Check your Gemini API plan and billing details.</li>
                  <li>Try selecting a different model preference from the dropdown (if available and not processing). The system will consider this for future strategy.</li>
                  <li>Wait for your quota to reset or the cooldown period ({appCtx.rateLimitCooldownActiveSeconds > 0 ? `${appCtx.rateLimitCooldownActiveSeconds}s` : 'to end'}).</li>
                </ul>
              </p>
              <p className="text-sm mb-2">
                For more information on rate limits, visit: <a href={rateLimitUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-600 dark:hover:text-yellow-100 font-medium">{rateLimitUrl}</a>
              </p>
              {originalApiMessage && (
                <details className="text-xs mt-2">
                  <summary className="cursor-pointer hover:underline">Details / Original Message</summary>
                  <p className="mt-1 p-2 bg-yellow-100/50 dark:bg-yellow-600/30 rounded break-words">{originalApiMessage}</p>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const quotaErrorDisplay = checkAndRenderQuotaError();

  let dynamicInsightText = "";
  const modelNameInUse = processCtx.currentModelForIteration || appCtx.selectedModelName || "N/A";
  const modelDisplayName = SELECTABLE_MODELS.find(m => m.name === modelNameInUse)?.displayName || modelNameInUse;

  let strategyRationaleText = processCtx.aiProcessInsight || 'System Idle. Ready for input.';
  const lastLogEntry = processCtx.iterationHistory.length > 0 ? processCtx.iterationHistory[processCtx.iterationHistory.length - 1] : null;

  if (processCtx.isProcessing) {
    if (lastLogEntry && lastLogEntry.iteration === processCtx.currentIteration) { 
        strategyRationaleText = lastLogEntry.strategyRationale || processCtx.aiProcessInsight || 'Evaluating strategy...';
    } else if (lastLogEntry && lastLogEntry.iteration === processCtx.currentIteration -1 && processCtx.currentIteration > 0) { 
        strategyRationaleText = processCtx.aiProcessInsight || 'Preparing next strategy...';
    } else if (processCtx.currentIteration === 0 && processCtx.statusMessage.startsWith("Segmented Iteration 1")) { // During segmented Iter 1
        strategyRationaleText = processCtx.aiProcessInsight || 'Segmented synthesis in progress...';
    }


    const modelConfig = processCtx.currentAppliedModelConfig;
    let modelDetails = `Using: ${modelDisplayName}`;
    if (modelConfig) {
        modelDetails += ` (T:${modelConfig.temperature.toFixed(2)}, P:${modelConfig.topP.toFixed(2)}, K:${modelConfig.topK}${modelConfig.thinkingConfig !== undefined ? `, Budget:${modelConfig.thinkingConfig.thinkingBudget}` : ''})`;
    }

    let nudgeInfo = "";
    if (processCtx.stagnationInfo.nudgeStrategyApplied !== 'none') {
      switch (processCtx.stagnationInfo.nudgeStrategyApplied) {
        case 'params_light': nudgeInfo = "(Nudge: Light Parameter Adjustment)"; break;
        case 'params_heavy': nudgeInfo = "(Nudge: Heavy Parameter Adjustment)"; break;
        case 'meta_instruct':
          nudgeInfo = "(Nudge: AI Meta-Guidance";
          if (processCtx.activeMetaInstructionForNextIter) {
            const snippet = processCtx.activeMetaInstructionForNextIter.length > 30
                            ? processCtx.activeMetaInstructionForNextIter.substring(0, 27) + "..."
                            : processCtx.activeMetaInstructionForNextIter;
            nudgeInfo += `: '${snippet}'`;
          }
          nudgeInfo += ")";
          break;
      }
    }
    const iterationNumberForDisplay = processCtx.currentIteration + 1; // For non-segmented display
    let modeText = "";
    if (processCtx.currentIteration === 0 && processCtx.statusMessage.startsWith("Segmented Iteration 1")) {
        modeText = "Segmented Iteration 1.";
    } else if (planCtx.isPlanActive) {
        modeText = `Plan Mode (Next: Stage ${ (processCtx.currentPlanStageIndex ?? -1) +1}, Iter ${processCtx.currentStageIteration + 1}).`;
    } else {
        modeText = `Global Mode (Next: Iter ${iterationNumberForDisplay}/${modelConfigCtx.maxIterations}).`;
    }
    
    dynamicInsightText = `${modeText} ${modelDetails}${nudgeInfo ? ' ' + nudgeInfo : ''}. Strategy: ${strategyRationaleText}`;

  } else if (processCtx.finalProduct) {
      dynamicInsightText = `Process completed. Final product generated. Input Complexity: ${processCtx.inputComplexity || 'N/A'}. ${strategyRationaleText}`;
  } else if (processCtx.currentProductBeforeHalt) {
      dynamicInsightText = `Process Halted. Input Complexity: ${processCtx.inputComplexity || 'N/A'}. ${strategyRationaleText}`;
  } else { 
      const initialStrategyArgs: Pick<ProcessState, 'inputComplexity' | 'initialPrompt' | 'loadedFiles' | 'selectedModelName' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness'> = {
        inputComplexity: processCtx.inputComplexity, initialPrompt: processCtx.initialPrompt, loadedFiles: processCtx.loadedFiles, selectedModelName: appCtx.selectedModelName, strategistInfluenceLevel: processCtx.strategistInfluenceLevel, stagnationNudgeAggressiveness: processCtx.stagnationNudgeAggressiveness
      };
      const initialStrategy = ModelStrategyService.determineInitialStrategy(initialStrategyArgs, modelConfigCtx);
      dynamicInsightText = `Input Complexity: ${processCtx.inputComplexity || 'N/A'}. Initial Strategy: ${initialStrategy.rationale}`;
  }


  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex items-center mb-1 relative">
         <div
          className="relative"
          onMouseEnter={() => setShowConvergenceInfo(true)}
          onMouseLeave={() => setShowConvergenceInfo(false)}
          onFocus={() => setShowConvergenceInfo(true)}
          onBlur={() => setShowConvergenceInfo(false)}
          tabIndex={0}
          aria-describedby="convergence-tooltip"
        >
          <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300 mr-2 cursor-help">Process Status (?)</h2>
          {showConvergenceInfo && (
            <div
              id="convergence-tooltip"
              role="tooltip"
              className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm text-slate-700 dark:text-slate-200 text-xs p-3 rounded-md shadow-lg z-10 border border-slate-300/70 dark:border-white/20"
            >
              {convergenceTooltipText.split('\n').map((line, i) => <p key={i} className={line.startsWith('-') ? 'ml-2' : ''}>{line}</p>)}
            </div>
          )}
        </div>
      </div>
      <p className="text-slate-600 dark:text-slate-300 min-h-[1.5em] break-words mb-1" aria-live="polite">
        {statusMessageForDisplay}
      </p>

      {quotaErrorDisplay ? quotaErrorDisplay : (
        dynamicInsightText && <p className="text-xs text-sky-600 dark:text-sky-400 italic min-h-[1.25em] break-words" aria-live="polite">{dynamicInsightText}</p>
      )}

      {processCtx.isProcessing && (
        <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 mt-3">
          <div
            className="bg-primary-600 dark:bg-primary-500 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${clampedProgressPercent}%` }}
            aria-valuenow={clampedProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
            aria-label="Process progress"
          ></div>
        </div>
      )}
      {processCtx.isProcessing && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-right" aria-live="polite">{progressText}</p>}
    </div>
  );
};

export default ProcessStatusDisplay;