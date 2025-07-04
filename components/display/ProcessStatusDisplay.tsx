
import React, { useState } from 'react';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import { SELECTABLE_MODELS, type ProcessState, type StrategistLLMContext } from '../../types/index.ts'; 
import * as ModelStrategyService from '../../services/ModelStrategyService.ts';
import { calculateQualitativeStates } from '../../services/strategistUtils.ts'; 


const ProcessStatusDisplay: React.FC = () => {
  const engine = useEngine();
  const { process: processCtx, app: appCtx, modelConfig: modelConfigCtx, plan: planCtx } = engine;

  const [showConvergenceInfo, setShowConvergenceInfo] = useState(false);
  const convergenceTooltipText = `The AI signals convergence by prefixing its output with "CONVERGED:":
- It believes the current Plan Stage goals or Global Mode refinement is maximally achieved.
- OR the output is identical to the previous iteration.
- Further changes would be trivial, purely stylistic, or detrimental.`;

  let progressPercentValue = 0;
  let progressText = "";
  let statusMessageForDisplay = processCtx.statusMessage;

  if (processCtx.isProcessing) {
    if (planCtx.isPlanActive && planCtx.planStages.length > 0 && processCtx.currentPlanStageIndex != null) {
      const currentStage = planCtx.planStages[processCtx.currentPlanStageIndex];
      const totalPlanIterations = planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0);
      let completedIterationsInPreviousStages = 0;
      for (let i = 0; i < processCtx.currentPlanStageIndex; i++) {
        completedIterationsInPreviousStages += planCtx.planStages[i].stageIterations;
      }
      const overallCompletedIterations = completedIterationsInPreviousStages + processCtx.currentStageIteration;
      progressPercentValue = totalPlanIterations > 0 ? (overallCompletedIterations / totalPlanIterations) * 100 : 0;
      progressText = `Stage ${processCtx.currentPlanStageIndex + 1}/${planCtx.planStages.length} (Iter. ${processCtx.currentStageIteration +1 }/${currentStage.stageIterations}) | Overall ${Math.round(progressPercentValue)}%`;
    } else {
      const iterationBeingProcessedGlobal = processCtx.currentMajorVersion + 1;
      progressPercentValue = modelConfigCtx.maxIterations > 0 ? (iterationBeingProcessedGlobal / modelConfigCtx.maxIterations) * 100 : 0;
      progressText = `Global Iter. ${Math.max(1, iterationBeingProcessedGlobal)} / ${modelConfigCtx.maxIterations}`;
    }
  } else {
    if (!planCtx.isPlanActive) {
        progressPercentValue = modelConfigCtx.maxIterations > 0 ? (processCtx.currentMajorVersion / modelConfigCtx.maxIterations) * 100 : 0;
        progressText = `Global Iter. ${processCtx.currentMajorVersion} / ${modelConfigCtx.maxIterations} (Completed)`;
    } else if (planCtx.isPlanActive && planCtx.planStages.length > 0 && processCtx.currentPlanStageIndex != null) {
        const totalPlanIterations = planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0);
        progressPercentValue = totalPlanIterations > 0 ? ( (processCtx.currentMajorVersion) / totalPlanIterations) * 100 : 0;
        progressText = `Plan Completed (${processCtx.currentMajorVersion} iters) | Overall ${Math.round(progressPercentValue)}%`;
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
      const modelNameInUse = processCtx.currentModelForIteration || processCtx.selectedModelName || "the selected model";
      const modelDisplayName = SELECTABLE_MODELS.find(m => m.name === modelNameInUse)?.displayName || modelNameInUse;
      let originalApiMessage = "";
      const originalMsgMatch = (processCtx.aiProcessInsight || "").match(/Original(?: API Message)?:\s*"(.*?)"/i);

      if (originalMsgMatch && originalMsgMatch[1]) {
        originalApiMessage = originalMsgMatch[1].trim();
      } else if (appCtx.isApiRateLimited) {
        if (appCtx.rateLimitCooldownActiveSeconds > 0) {
            originalApiMessage = `The API rate limit is currently active. Please wait for the cooldown (${appCtx.rateLimitCooldownActiveSeconds}s).`;
        } else {
            originalApiMessage = `The API rate limit is currently active. Please wait for the cooldown period to end.`;
        }
      } else if (processCtx.aiProcessInsight) {
        originalApiMessage = processCtx.aiProcessInsight;
      }

      return (
        <div className="mt-2 p-4 bg-yellow-50 dark:bg-yellow-700/30 border-l-4 border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-200 rounded-md shadow-md">
          <h3 className="text-md font-semibold mb-1">API Quota Limit Reached</h3>
          <p className="text-sm mb-2">The process is halted due to API quota limits for model <strong>{modelDisplayName}</strong>.</p>
        </div>
      );
    }
    return null;
  };

  const quotaErrorDisplay = checkAndRenderQuotaError();
  
  const modelNameInUse = processCtx.currentModelForIteration || processCtx.selectedModelName;
  const modelDisplayName = SELECTABLE_MODELS.find(m => m.name === modelNameInUse)?.displayName || modelNameInUse;

  let strategyRationaleText = processCtx.aiProcessInsight || 'System Idle. Ready for input.';
  let dynamicInsightText = "";
  if (processCtx.isProcessing) {
    strategyRationaleText = processCtx.aiProcessInsight || 'Evaluating strategy...';
    let modelDetails = `Using: ${modelDisplayName}`;
    if (processCtx.currentAppliedModelConfig) {
        const { temperature, topP, topK, thinkingConfig } = processCtx.currentAppliedModelConfig;
        modelDetails += ` (T:${temperature.toFixed(2)}, P:${topP.toFixed(2)}, K:${topK}${thinkingConfig !== undefined ? `, Budget:${thinkingConfig.thinkingBudget}` : ''})`;
    }
    dynamicInsightText = `${strategyRationaleText}`;
  } else if (processCtx.finalProduct) {
      dynamicInsightText = `Process completed. Final product generated. Input Complexity: ${processCtx.inputComplexity || 'N/A'}. ${strategyRationaleText}`;
  } else if (processCtx.currentProductBeforeHalt) {
      dynamicInsightText = `Process Halted. Input Complexity: ${processCtx.inputComplexity || 'N/A'}. ${strategyRationaleText}`;
  } else {
      const initialStrategy = ModelStrategyService.determineInitialStrategy(processCtx, modelConfigCtx.getUserSetBaseConfig());
      dynamicInsightText = `Input Complexity: ${processCtx.inputComplexity}. Initial Strategy: ${initialStrategy.rationale}`;
  }

  const { stagnationInfo } = processCtx;
  const isBootstrappedBase = processCtx.iterationHistory[0]?.entryType === 'bootstrap_synthesis_milestone';
  const { stagnationSeverity } = calculateQualitativeStates(processCtx.currentProduct, stagnationInfo, processCtx.inputComplexity, processCtx.stagnationNudgeAggressiveness, isBootstrappedBase);
  let stagnationStatusText = `System Stagnation Assessment: ${stagnationSeverity}. Details: Identical Prods: ${stagnationInfo.consecutiveIdenticalProductIterations}, Low Value Iters: ${stagnationInfo.consecutiveLowValueIterations}, Stagnant Iters: ${stagnationInfo.consecutiveStagnantIterations}. Nudge Strategy System Applied: ${stagnationInfo.nudgeStrategyApplied || 'none'}.`;


  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex items-center mb-1 relative">
        <div className="relative" onMouseEnter={() => setShowConvergenceInfo(true)} onMouseLeave={() => setShowConvergenceInfo(false)} tabIndex={0} aria-describedby="convergence-tooltip">
          <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300 mr-2 cursor-help">Process Status (?)</h2>
          {showConvergenceInfo && (
            <div id="convergence-tooltip" role="tooltip" className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm text-slate-700 dark:text-slate-200 text-xs p-3 rounded-md shadow-lg z-10 border border-slate-300/70 dark:border-white/20">
              {convergenceTooltipText.split('\n').map((line, i) => <p key={i} className={line.startsWith('-') ? 'ml-2' : ''}>{line}</p>)}
            </div>
          )}
        </div>
      </div>
      <p className="text-slate-600 dark:text-slate-300 min-h-[1.5em] break-words mb-1" aria-live="polite">
        {statusMessageForDisplay}
      </p>

      {quotaErrorDisplay ? quotaErrorDisplay : (
        <>
          <p className="text-xs text-sky-600 dark:text-sky-400 italic min-h-[1.25em] break-words mb-1" aria-live="polite">{dynamicInsightText}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 min-h-[1.25em] break-words" aria-live="polite">{stagnationStatusText}</p>
        </>
      )}

      {(processCtx.isProcessing || (!processCtx.isProcessing && processCtx.iterationHistory.length > 0 && !processCtx.finalProduct )) &&
        <>
          <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 mt-3">
            <div className="bg-primary-600 dark:bg-primary-500 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${clampedProgressPercent}%` }} aria-valuenow={clampedProgressPercent} aria-valuemin={0} aria-valuemax={100} role="progressbar" aria-label="Process progress"></div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-right" aria-live="polite">{progressText}</p>
        </>
      }
    </div>
  );
};

export default ProcessStatusDisplay;
