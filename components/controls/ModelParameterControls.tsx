
import React, { useState, useContext } from 'react';
import type { CommonControlProps, ProcessState } from '../../types.ts';
import { useModelConfigContext } from '../../contexts/ModelConfigContext';
import { usePlanContext } from '../../contexts/PlanContext';
import { useProcessContext } from '../../contexts/ProcessContext';


const ModelParameterControls: React.FC<CommonControlProps & { children?: React.ReactNode }> = ({
  commonInputClasses,
  commonSelectClasses,
  commonCheckboxLabelClasses,
  commonCheckboxInputClasses,
  children,
}) => {
  const modelConfigCtx = useModelConfigContext();
  const planCtx = usePlanContext();
  const processCtx = useProcessContext();

  const [showModelConfigInfo, setShowModelConfigInfo] = useState(false);
  const [isModelConfigExpanded, setIsModelConfigExpanded] = useState(false);
  const [isAdvancedSettingsExpanded, setIsAdvancedSettingsExpanded] = useState(false);


  const modelConfigTooltipText = `Control the AI's behavior:
- Temperature: ${planCtx.isPlanActive ? 'Fixed creativity level for plan stages.' : 'STARTING creativity level (0.0-2.0). Higher (e.g., 0.9) for diverse, lower (e.g., 0.2) for focused. Will decrease over iterations in Global Mode.'}
- Top-P: ${planCtx.isPlanActive ? 'Fixed nucleus sampling probability for plan stages.' : 'STARTING nucleus sampling (0.0-1.0). Filters by cumulative probability. Will decrease in Global Mode.'}
- Top-K: ${planCtx.isPlanActive ? 'Fixed token selection limit for plan stages.' : 'STARTING token selection limit (1-100+). Filters to K most likely tokens. Will decrease in Global Mode.'}
- Max Iterations: ${planCtx.isPlanActive ? 'Total iterations determined by plan stages.' : 'Max iterations for Global Mode (governs dynamic parameter sweep from creative to focused). Target for deterministic params: Iteration 20.'}`;

  const getSettingsNoteAndRationales = () => {
    let noteText = "";
    switch (modelConfigCtx.settingsSuggestionSource) {
      case 'mode':
        noteText = planCtx.isPlanActive ? `Values are general defaults for plan stages.` : `Values are creative starting defaults for Global Mode's dynamic sweep. Adjust as needed.`;
        break;
      case 'input':
        noteText = planCtx.isPlanActive ? `Values suggested for plan stages based on input. Feel free to override.` : `Starting values suggested for Global Mode based on input analysis. Feel free to override.`;
        break;
      case 'plan_stage':
        noteText = `Values are defaults for current plan stage's settings. Adjust global settings (fixed for plan) as needed.`;
        break;
      case 'manual':
        noteText = "Values manually set. Auto-suggestions paused until next significant change or reset.";
        break;
      default:
        noteText = "Adjust model parameters as needed.";
    }

    return (
      <>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-3">
          {noteText}
        </p>
        {(modelConfigCtx.settingsSuggestionSource === 'input' || modelConfigCtx.settingsSuggestionSource === 'mode' || modelConfigCtx.settingsSuggestionSource === 'plan_stage') && modelConfigCtx.modelConfigRationales.length > 0 && (
          <div className="mb-3 p-3 bg-primary-50/80 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700/70 rounded-md space-y-1">
            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">AI Rationale for Suggestions:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {modelConfigCtx.modelConfigRationales.map((rationale, index) => (
                <li key={index} className="text-xs text-primary-600 dark:text-primary-400">{rationale}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  const totalPlanIterationsValue = planCtx.isPlanActive ? planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0) : 0;
  const isSlidersDisabled = processCtx.isProcessing || planCtx.isPlanActive;
  const isMaxIterationsControlDisabled = processCtx.isProcessing || planCtx.isPlanActive;


  const strategistInfluenceTooltip = `Controls how advice from the LLM Strategist (a meta-AI suggesting model/config/meta-instruction changes) is used:
- Off: Strategist AI is NOT called. System uses code-based rules (heuristics) only. Strategy rationale will reflect this.
- Suggest Only: Strategist AI is called. Its advice (model, parameters, meta-instruction) is logged for your review, but code heuristics solely determine the actual strategy applied. No strategist advice is automatically applied.
- Advise Parameters Only: Strategist AI can influence Model choice, Thinking Configuration (for Flash models), and provide dynamic Meta-Instructions (if stagnation nudge is 'meta_instruct'). However, its advice on core generation parameters (Temperature, Top-P, Top-K) is logged but explicitly ignored. These core parameters remain controlled by code heuristics (parameter sweep + aggressiveness-scaled nudges).
- Full Override (Default): Strategist AI has maximum influence. Its advice can change the Model, Thinking Config, Meta-Instructions, AND core parameters (Temperature, Top-P, Top-K), potentially overriding code heuristics. All parameter changes are subject to predefined operational limits (e.g., Temp 0.0-2.0).`;

  const nudgeAggressivenessTooltip = `Controls how quickly and intensely the system applies "nudges" when Global Mode progress appears to stall. Affects:
1. Thresholds: The number of consecutive stagnant iterations needed to trigger different nudge types (params_light, params_heavy, meta_instruct). 'Low' requires more stagnant iterations; 'High' requires fewer.
2. Intensity (for 'params_light' & 'params_heavy' nudges): The magnitude of code-driven parameter adjustments (e.g., how much Temperature or Top-K is changed). 'Low' uses smaller adjustments (e.g., 0.6x base nudge); 'High' uses larger adjustments (e.g., 1.4x base nudge), within safe operational bounds.
This setting does NOT apply in Plan Mode.`;


  return (
    <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
      <div className="flex items-center justify-between mb-1">
        <div
            className="flex items-center relative"
            onMouseEnter={() => setShowModelConfigInfo(true)}
            onMouseLeave={() => setShowModelConfigInfo(false)}
            onFocus={() => setShowModelConfigInfo(true)}
            onBlur={() => setShowModelConfigInfo(false)}
            tabIndex={0}
            aria-describedby="model-config-tooltip"
          >
          <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300 mr-2 cursor-help">Model Configuration (?)</h3>
            {showModelConfigInfo && (
              <div
                id="model-config-tooltip"
                role="tooltip"
                className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm text-slate-700 dark:text-slate-200 text-xs p-3 rounded-md shadow-lg z-20 border border-slate-300/70 dark:border-white/20"
              >
                {modelConfigTooltipText.split('\n').map((line, i) => <p key={i} className={line.startsWith('-') ? 'ml-2' : ''}>{line}</p>)}
              </div>
            )}
        </div>
        <button
          onClick={() => setIsModelConfigExpanded(!isModelConfigExpanded)}
          className="px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-expanded={isModelConfigExpanded}
          aria-controls="model-config-details"
        >
          {isModelConfigExpanded ? "Collapse" : "Expand"}
          <span className="sr-only">{isModelConfigExpanded ? "Collapse Model Configuration" : "Expand Model Configuration"}</span>
        </button>
      </div>

      {isModelConfigExpanded && (
        <div id="model-config-details" className="space-y-4 mt-2 animate-fadeIn">
          {planCtx.isPlanActive && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/60 rounded-md text-xs text-blue-700 dark:text-blue-200">
              <p className="font-semibold">Iterative Plan Active:</p>
              <ul className="list-disc list-inside ml-4">
                <li>Global model parameters (Temperature, Top-P, Top-K) are fixed for the duration of this plan, based on their values when the plan started.</li>
                <li>Total iterations are determined by the sum of iterations in each plan stage ({totalPlanIterationsValue} iterations).</li>
              </ul>
            </div>
          )}
          {getSettingsNoteAndRationales()}

          {modelConfigCtx.modelConfigWarnings.length > 0 && !planCtx.isPlanActive && (
            <div className="p-3 bg-yellow-100/80 dark:bg-yellow-500/30 border border-yellow-400/80 dark:border-yellow-500/50 rounded-md mb-3 space-y-1">
              {modelConfigCtx.modelConfigWarnings.map((warning, index) => (
                <p key={index} className="text-xs text-yellow-700 dark:text-yellow-200 flex items-start">
                  <span className="font-bold mr-1">Warning:</span>
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="maxIterations" className="block text-sm font-medium text-primary-600 dark:text-primary-300 mb-1">
              Max Iterations (Global Mode)
            </label>
            <input
              type="number"
              id="maxIterations"
              value={modelConfigCtx.maxIterations}
              onChange={(e) => modelConfigCtx.onMaxIterationsChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min="1"
              max="200"
              className={commonInputClasses + " text-sm py-2"}
              disabled={isMaxIterationsControlDisabled || processCtx.isProcessing }
              aria-label="Maximum number of global iterations for dynamic parameter sweep"
            />
            {planCtx.isPlanActive && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                (Global Max Iterations disabled. Plan defines total iterations: {totalPlanIterationsValue})
              </p>
            )}
            {!planCtx.isPlanActive && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                In Global Mode, parameters sweep from creative to focused over these iterations. Target for deterministic params: Iteration 20.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-primary-600 dark:text-primary-400 mb-1">
              {planCtx.isPlanActive ? "Temperature (Fixed for Plan)" : "Starting Temperature"}: <span className="text-slate-800 dark:text-slate-100 font-mono">{modelConfigCtx.temperature.toFixed(2)}</span>
            </label>
            <input
              type="range"
              id="temperature"
              min="0"
              max="2"
              step="0.01"
              value={modelConfigCtx.temperature}
              onChange={(e) => modelConfigCtx.handleTemperatureChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500 dark:accent-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50"
              disabled={isSlidersDisabled || processCtx.isProcessing}
              aria-label={planCtx.isPlanActive ? "Temperature setting (fixed for plan)" : "Starting temperature for dynamic sweep"}
            />
            {modelConfigCtx.modelParameterAdvice.temperature && <p className="text-xs text-primary-600 dark:text-primary-200 mt-1">{modelConfigCtx.modelParameterAdvice.temperature}</p>}
          </div>
          <div>
            <label htmlFor="topP" className="block text-sm font-medium text-primary-600 dark:text-primary-400 mb-1">
              {planCtx.isPlanActive ? "Top-P (Fixed for Plan)" : "Starting Top-P"}: <span className="text-slate-800 dark:text-slate-100 font-mono">{modelConfigCtx.topP.toFixed(2)}</span>
            </label>
            <input
              type="range"
              id="topP"
              min="0"
              max="1"
              step="0.01"
              value={modelConfigCtx.topP}
              onChange={(e) => modelConfigCtx.handleTopPChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500 dark:accent-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50"
              disabled={isSlidersDisabled || processCtx.isProcessing}
              aria-label={planCtx.isPlanActive ? "Top-P setting (fixed for plan)" : "Starting Top-P for dynamic sweep"}
            />
            {modelConfigCtx.modelParameterAdvice.topP && <p className="text-xs text-primary-600 dark:text-primary-200 mt-1">{modelConfigCtx.modelParameterAdvice.topP}</p>}
          </div>
          <div>
            <label htmlFor="topK" className="block text-sm font-medium text-primary-600 dark:text-primary-400 mb-1">
              {planCtx.isPlanActive ? "Top-K (Fixed for Plan)" : "Starting Top-K"}: <span className="text-slate-800 dark:text-slate-100 font-mono">{modelConfigCtx.topK}</span>
            </label>
            <input
              type="range"
              id="topK"
              min="1"
              max="100"
              step="1"
              value={modelConfigCtx.topK}
              onChange={(e) => modelConfigCtx.handleTopKChange(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500 dark:accent-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50"
              disabled={isSlidersDisabled || processCtx.isProcessing}
              aria-label={planCtx.isPlanActive ? "Top-K setting (fixed for plan)" : "Starting Top-K for dynamic sweep"}
            />
            {modelConfigCtx.modelParameterAdvice.topK && <p className="text-xs text-primary-600 dark:text-primary-200 mt-1">{modelConfigCtx.modelParameterAdvice.topK}</p>}
          </div>

          {children} {/* For OutputStructureDefaults */}

          <div className="pt-3 mt-3 border-t border-slate-300/70 dark:border-white/10">
            <button
                onClick={() => setIsAdvancedSettingsExpanded(!isAdvancedSettingsExpanded)}
                className="w-full text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none flex justify-between items-center py-1"
                aria-expanded={isAdvancedSettingsExpanded}
                aria-controls="advanced-model-settings-details"
            >
                Advanced Autonomous Strategy Settings
                <span>{isAdvancedSettingsExpanded ? '▲' : '▼'}</span>
            </button>
            {isAdvancedSettingsExpanded && (
                <div id="advanced-model-settings-details" className="mt-2 space-y-4 p-3 bg-slate-100/50 dark:bg-black/10 rounded-md border border-slate-200 dark:border-white/5 animate-fadeIn">
                     <label className={(commonCheckboxLabelClasses ?? '') + " justify-between"}>
                        <span className="flex-grow mr-2" title="If enabled, the system adaptively adjusts parameters or prompts the AI with meta-instructions when Global Mode progress appears to stall, aiming to break out of unproductive refinement loops.">
                            Enable Stagnation Nudge (Global Mode)
                        </span>
                        <input
                            type="checkbox"
                            checked={processCtx.stagnationNudgeEnabled}
                            onChange={(e) => processCtx.updateProcessState({ stagnationNudgeEnabled: e.target.checked })}
                            disabled={processCtx.isProcessing || planCtx.isPlanActive}
                            className={commonCheckboxInputClasses}
                        />
                    </label>

                    <div>
                        <label htmlFor="strategistInfluenceLevel" className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-1" title={strategistInfluenceTooltip}>
                            LLM Strategist Influence
                        </label>
                        <select
                            id="strategistInfluenceLevel"
                            value={processCtx.strategistInfluenceLevel}
                            onChange={(e) => processCtx.updateProcessState({ strategistInfluenceLevel: e.target.value as ProcessState['strategistInfluenceLevel'] })}
                            className={commonSelectClasses}
                            disabled={processCtx.isProcessing}
                        >
                            <option value="OFF">Off (Code Heuristics Only)</option>
                            <option value="SUGGEST">Suggest Only (Log AI Advice)</option>
                            <option value="ADVISE_PARAMS_ONLY">Advise (Model/Nudge; Params by Code)</option>
                            <option value="OVERRIDE_FULL">Full Override (Model & Params)</option>
                        </select>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Controls how advice from the LLM Strategist (meta-AI) is used.</p>
                    </div>

                    <div>
                        <label htmlFor="stagnationNudgeAggressiveness" className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-1" title={nudgeAggressivenessTooltip}>
                            Stagnation Nudge Aggressiveness
                        </label>
                        <select
                            id="stagnationNudgeAggressiveness"
                            value={processCtx.stagnationNudgeAggressiveness}
                            onChange={(e) => processCtx.updateProcessState({ stagnationNudgeAggressiveness: e.target.value as ProcessState['stagnationNudgeAggressiveness'] })}
                            className={commonSelectClasses}
                            disabled={processCtx.isProcessing || !processCtx.stagnationNudgeEnabled || planCtx.isPlanActive}
                        >
                            <option value="LOW">Low (Less Frequent/Intense)</option>
                            <option value="MEDIUM">Medium (Balanced)</option>
                            <option value="HIGH">High (More Frequent/Intense)</option>
                        </select>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Adjusts how quickly and strongly the system reacts to stagnation.</p>
                    </div>
                </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default ModelParameterControls;
