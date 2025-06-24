
import React, { useState, useContext } from 'react';
import { useProcessContext } from '../../contexts/ProcessContext';
import { useApplicationContext } from '../../contexts/ApplicationContext';
import { usePlanContext } from '../../contexts/PlanContext'; 
import { useModelConfigContext } from '../../contexts/ModelConfigContext'; 

// Props interface removed as all data comes from context or is local
// interface ProcessStatusDisplayProps {}

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

  if (processCtx.isProcessing) {
    if (planCtx.isPlanActive && planCtx.planStages.length > 0 && planCtx.currentPlanStageIndex != null) {
      const currentStage = planCtx.planStages[planCtx.currentPlanStageIndex];
      const totalPlanIterations = planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0);
      let completedIterationsInPreviousStages = 0;
      for (let i = 0; i < planCtx.currentPlanStageIndex; i++) {
        completedIterationsInPreviousStages += planCtx.planStages[i].stageIterations;
      }
      const overallCompletedIterations = completedIterationsInPreviousStages + planCtx.currentStageIteration;
      progressPercentValue = totalPlanIterations > 0 ? (overallCompletedIterations / totalPlanIterations) * 100 : 0;
      progressText = `Stage ${planCtx.currentPlanStageIndex + 1}/${planCtx.planStages.length} (Iter. ${planCtx.currentStageIteration}/${currentStage.stageIterations}) | Overall ${Math.round(progressPercentValue)}%`;
    } else {
      progressPercentValue = modelConfigCtx.maxIterations > 0 ? (processCtx.currentIteration / modelConfigCtx.maxIterations) * 100 : 0;
      progressText = `Iteration ${processCtx.currentIteration > 0 ? processCtx.currentIteration : (processCtx.isProcessing ? 1 : 0)} / ${modelConfigCtx.maxIterations}`;
    }
  }
  const clampedProgressPercent = Math.min(100, Math.max(0, progressPercentValue));

  const checkAndRenderQuotaError = () => {
    if (!processCtx.aiProcessInsight && !appCtx.isApiRateLimited) return null;

    const lowerInsight = (processCtx.aiProcessInsight || "").toLowerCase();
    // Check if the insight indicates a quota/rate limit issue, or if the app context flags it.
    const isQuotaErrorIndicatedByInsight = 
        lowerInsight.includes("api quota exceeded") || 
        lowerInsight.includes("rate limit hit") || // Matches new message from geminiService
        lowerInsight.includes("error 429") || 
        lowerInsight.includes("resource_exhausted");

    if (appCtx.isApiRateLimited || isQuotaErrorIndicatedByInsight) {
      const rateLimitUrl = "https://ai.google.dev/gemini-api/docs/rate-limits";
      const modelName = appCtx.selectedModelName || "the selected model";
      let originalApiMessage = "";

      // Try to extract the specific "Original API message: "..." part
      const originalMsgMatch = (processCtx.aiProcessInsight || "").match(/Original API message:\s*"(.*?)"$/i);
      if (originalMsgMatch && originalMsgMatch[1]) {
        originalApiMessage = originalMsgMatch[1].trim();
      } else if (appCtx.isApiRateLimited) { 
        // Fallback if the specific format isn't found but we know it's a rate limit from app context
        originalApiMessage = `The API rate limit is currently active. Please wait for the cooldown (${appCtx.rateLimitCooldownActiveSeconds}s).`;
        if (processCtx.aiProcessInsight && !isQuotaErrorIndicatedByInsight) {
           // If aiProcessInsight doesn't seem to be about quota but rate limit is active, append it.
           originalApiMessage += ` General AI Insight: ${processCtx.aiProcessInsight}`;
        } else if (processCtx.aiProcessInsight) {
           // If aiProcessInsight also indicated quota, but wasn't parsed, it might be the only detail.
           originalApiMessage = processCtx.aiProcessInsight;
        }
      } else if (processCtx.aiProcessInsight) {
        // If not caught by specific regex and not appCtx.isApiRateLimited, but insight *still* indicates quota
        originalApiMessage = processCtx.aiProcessInsight;
      }


      return (
        <div className="mt-2 p-4 bg-yellow-50 dark:bg-yellow-700/30 border-l-4 border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-200 rounded-md shadow-md">
          <div className="flex items-start">
            <div className="mr-3 font-bold text-yellow-500 dark:text-yellow-400 text-xl">!</div>
            <div>
              <h3 className="text-md font-semibold mb-1">API Quota Limit Reached or Cooldown Active</h3>
              <p className="text-sm mb-2">
                The process may be halted or delayed due to API quota limits for model <strong className="font-semibold">{modelName}</strong> or an active cooldown period.
              </p>
              <p className="text-sm mb-2">
                <strong>Suggestions:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                  <li>Check your Gemini API plan and billing details.</li>
                  <li>Try selecting a different model from the dropdown (if available and not processing).</li>
                  <li>Wait for your quota to reset or the cooldown period ({appCtx.rateLimitCooldownActiveSeconds > 0 ? `${appCtx.rateLimitCooldownActiveSeconds}s` : 'to end'}).</li>
                </ul>
              </p>
              <p className="text-sm mb-2">
                For more information on rate limits, visit: <a href={rateLimitUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-600 dark:hover:text-yellow-100 font-medium">{rateLimitUrl}</a>
              </p>
              {originalApiMessage && (
                <details className="text-xs mt-2">
                  <summary className="cursor-pointer hover:underline">Details / Original API Message</summary>
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
  
  let dynamicInsightText = processCtx.aiProcessInsight;
  if (processCtx.isProcessing && !planCtx.isPlanActive && processCtx.currentAppliedModelConfig) {
    const { temperature, topP, topK } = processCtx.currentAppliedModelConfig;
    dynamicInsightText = `Global Mode: AI refining (Iter ${processCtx.currentIteration}/${modelConfigCtx.maxIterations}). Current Params: T:${temperature.toFixed(2)}, P:${topP.toFixed(2)}, K:${topK}. ${processCtx.aiProcessInsight || ''}`;
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
        {processCtx.statusMessage}
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
