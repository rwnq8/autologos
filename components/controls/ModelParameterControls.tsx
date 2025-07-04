import React, { useState } from 'react';
import type { CommonControlProps, ProcessState, SelectableModelName } from '../../types/index.ts';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import ChevronDownIcon from '../shared/ChevronDownIcon.tsx';
import ChevronUpIcon from '../shared/ChevronUpIcon.tsx';
import { SELECTABLE_MODELS } from '../../types/models.ts';


const ModelParameterControls: React.FC<CommonControlProps & { children?: React.ReactNode }> = ({
  commonInputClasses,
  commonSelectClasses,
  commonCheckboxLabelClasses,
  commonCheckboxInputClasses,
  children,
}) => {
  const { modelConfig: modelConfigCtx, plan: planCtx, process: processCtx, app: appCtx } = useEngine();
  const [isModelConfigExpanded, setIsModelConfigExpanded] = useState(false);
  const [isAdvancedSettingsExpanded, setIsAdvancedSettingsExpanded] = useState(false);

  const getSettingsNoteAndRationales = () => {
    let noteText = "";
    switch (modelConfigCtx.settingsSuggestionSource) {
      case 'mode': noteText = planCtx.isPlanActive ? `Values are general defaults for plan stages.` : `Values are creative starting defaults for Global Mode's dynamic sweep.`; break;
      case 'input': noteText = planCtx.isPlanActive ? `Values suggested for plan stages based on input.` : `Starting values suggested for Global Mode based on input analysis.`; break;
      case 'plan_stage': noteText = `Values are defaults for current plan stage's settings.`; break;
      case 'manual': noteText = "Values manually set. Auto-suggestions paused."; break;
      default: noteText = "Adjust model parameters as needed.";
    }

    return (
      <>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-3">{noteText}</p>
        {modelConfigCtx.modelConfigRationales.length > 0 && (
          <div className="mb-3 p-3 bg-primary-50/80 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700/70 rounded-md space-y-1">
            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">AI Rationale for Suggestions:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {modelConfigCtx.modelConfigRationales.map((r, i) => <li key={i} className="text-xs text-primary-600 dark:text-primary-400">{r}</li>)}
            </ul>
          </div>
        )}
      </>
    );
  };

  const handleOutlineModeChange = (enabled: boolean) => {
    processCtx.updateProcessState({ isOutlineMode: enabled });
    if (enabled) {
        modelConfigCtx.onMaxIterationsChange(5);
    } else {
        modelConfigCtx.onMaxIterationsChange(20); // Reset to default when disabled
    }
  };

  const totalPlanIterationsValue = planCtx.isPlanActive ? planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0) : 0;
  const isSlidersDisabled = processCtx.isProcessing;
  const isMaxIterationsControlDisabled = processCtx.isProcessing || planCtx.isPlanActive || processCtx.isOutlineMode;

  return (
    <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300 mr-2">Model Configuration</h3>
        <button onClick={() => setIsModelConfigExpanded(!isModelConfigExpanded)} className="px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10" aria-expanded={isModelConfigExpanded}>
          {isModelConfigExpanded ? "Collapse" : "Expand"}
        </button>
      </div>
      
      {isModelConfigExpanded && (
        <div className="space-y-4 p-3 bg-slate-100/50 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 animate-fadeIn">
          
          <div className="space-y-3">
              <h4 className="text-sm font-semibold text-primary-600 dark:text-primary-400">Process Mode</h4>
              <label className={commonCheckboxLabelClasses}>
                <input 
                    type="checkbox" 
                    checked={processCtx.isOutlineMode} 
                    onChange={(e) => handleOutlineModeChange(e.target.checked)} 
                    disabled={processCtx.isProcessing}
                    className={commonCheckboxInputClasses + " mr-2"}
                />
                Enable Outline Synthesis Mode
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 ml-6">
                Extracts and structures information from files into an interactive, hierarchical outline. Sets max iterations to 5.
              </p>
          </div>

          <div>
            <label htmlFor="model-select" className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">Model Preference</label>
            <select id="model-select" value={processCtx.selectedModelName} onChange={(e) => appCtx.onSelectedModelChange(e.target.value as SelectableModelName)} className={commonSelectClasses} disabled={processCtx.isProcessing}>
              {SELECTABLE_MODELS.map(m => <option key={m.name} value={m.name}>{m.displayName}</option>)}
            </select>
          </div>
          
          {getSettingsNoteAndRationales()}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label htmlFor="temperature" className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                <span>Temperature</span><span>{modelConfigCtx.temperature.toFixed(2)}</span>
              </label>
              <input type="range" id="temperature" min="0" max="2" step="0.01" value={modelConfigCtx.temperature} onChange={(e) => modelConfigCtx.handleTemperatureChange(parseFloat(e.target.value))} disabled={isSlidersDisabled} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
            </div>
            <div>
              <label htmlFor="topP" className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                <span>Top-P</span><span>{modelConfigCtx.topP.toFixed(2)}</span>
              </label>
              <input type="range" id="topP" min="0" max="1" step="0.01" value={modelConfigCtx.topP} onChange={(e) => modelConfigCtx.handleTopPChange(parseFloat(e.target.value))} disabled={isSlidersDisabled} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
            </div>
            <div>
              <label htmlFor="topK" className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                <span>Top-K</span><span>{modelConfigCtx.topK}</span>
              </label>
              <input type="range" id="topK" min="1" max="100" step="1" value={modelConfigCtx.topK} onChange={(e) => modelConfigCtx.handleTopKChange(parseInt(e.target.value))} disabled={isSlidersDisabled} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
            </div>
            <div>
              <label htmlFor="maxIterations" className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                <span>Max Iterations (Global)</span><span>{planCtx.isPlanActive ? `Plan: ${totalPlanIterationsValue}` : modelConfigCtx.maxIterations}</span>
              </label>
              <input type="range" id="maxIterations" min="1" max="100" step="1" value={modelConfigCtx.maxIterations} onChange={(e) => modelConfigCtx.onMaxIterationsChange(parseInt(e.target.value))} disabled={isMaxIterationsControlDisabled} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
            </div>
          </div>
          
          <div className="text-center mt-2">
            <button onClick={() => modelConfigCtx.resetModelParametersToDefaults()} disabled={processCtx.isProcessing} className="text-xs px-3 py-1.5 border border-slate-300 dark:border-white/20 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50">Reset to Defaults</button>
          </div>
          
          {children}

          <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
            <button onClick={() => setIsAdvancedSettingsExpanded(!isAdvancedSettingsExpanded)} className="w-full flex justify-between items-center text-sm font-medium text-primary-600 dark:text-primary-400">
                <span>Advanced Settings</span>
                {isAdvancedSettingsExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            {isAdvancedSettingsExpanded && (
                <div className="space-y-4 mt-2">
                    <label className={commonCheckboxLabelClasses}><input type="checkbox" checked={processCtx.stagnationNudgeEnabled} onChange={(e) => processCtx.updateProcessState({ stagnationNudgeEnabled: e.target.checked })} className={commonCheckboxInputClasses + " mr-2"} />Enable Stagnation Nudge System</label>
                    <label className={commonCheckboxLabelClasses}><input type="checkbox" checked={processCtx.isSearchGroundingEnabled} onChange={(e) => processCtx.updateProcessState({ isSearchGroundingEnabled: e.target.checked })} className={commonCheckboxInputClasses + " mr-2"} />Enable Google Search Grounding</label>
                    <label className={commonCheckboxLabelClasses}><input type="checkbox" checked={processCtx.isUrlBrowsingEnabled} onChange={(e) => processCtx.updateProcessState({ isUrlBrowsingEnabled: e.target.checked })} className={commonCheckboxInputClasses + " mr-2"} />Enable URL Browsing Tool</label>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelParameterControls;
