
import React, { useContext } from 'react';
import type { CommonControlProps } from '../../types.ts';
import { useApplicationContext } from '../../contexts/ApplicationContext';
import { useProcessContext } from '../../contexts/ProcessContext';
import { usePlanContext } from '../../contexts/PlanContext'; // Added for plan-related conditions

// MainActionButtonsProps removed

const MainActionButtons: React.FC<CommonControlProps> = ({
  commonButtonClasses,
}) => {
  const appCtx = useApplicationContext();
  const processCtx = useProcessContext();
  const planCtx = usePlanContext(); // Get plan context

  // Derive startProcessButtonText locally based on context
  const startProcessButtonTextValue = (processCtx.isProcessing && processCtx.currentProductBeforeHalt) || 
                                (!processCtx.isProcessing && processCtx.currentProduct !== null && processCtx.finalProduct === null && processCtx.iterationHistory.length > 0) 
                                ? "Resume Process" : "Start Process";

  return (
    <div className="flex flex-col space-y-3 pt-4">
      {!processCtx.isProcessing ? (
        <button
          onClick={processCtx.handleStartProcess}
          disabled={appCtx.apiKeyStatus !== 'loaded' || processCtx.loadedFiles.length === 0 || (planCtx.isPlanActive && planCtx.planStages.length === 0) || appCtx.isApiRateLimited}
          className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:bg-slate-400 dark:disabled:bg-slate-600/70 disabled:cursor-not-allowed transition-colors"
          aria-label={startProcessButtonTextValue}
        >
          {startProcessButtonTextValue}
        </button>
      ) : (
        <>
          <button
            disabled
            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-slate-500 cursor-default"
            aria-label="Processing in progress"
          >
            Processing...
          </button>
          <button
            onClick={processCtx.handleHaltProcess}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-500 dark:border-red-600 text-sm font-medium rounded-md shadow-sm text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-700/40 hover:bg-red-200 dark:hover:bg-red-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-red-500 transition-colors"
            aria-label="Halt current process"
          >
            Halt Process
          </button>
        </>
      )}
      {appCtx.isApiRateLimited && appCtx.rateLimitCooldownActiveSeconds && appCtx.rateLimitCooldownActiveSeconds > 0 && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-1">
          API rate limit active. Operations paused for {appCtx.rateLimitCooldownActiveSeconds}s.
        </p>
      )}
      <div className="flex space-x-3">
        <button
          onClick={processCtx.handleResetApp}
          disabled={processCtx.isProcessing}
          className={commonButtonClasses}
          aria-label="Reset all inputs, results, and model settings to defaults"
        >
          Reset
        </button>
      </div>
      {appCtx.apiKeyStatus !== 'loaded' && (
        <p className="text-xs text-yellow-600 dark:text-yellow-300 text-center mt-2">
          Warning: API_KEY is not configured. The AI process cannot start.
        </p>
      )}
    </div>
  );
};

export default MainActionButtons;
