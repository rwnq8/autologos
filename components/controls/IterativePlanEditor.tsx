
import React, { useState, useEffect, useRef } from 'react';
import type { PlanStage, PlanTemplate, OutputFormat, OutputLength, OutputComplexity, CommonControlProps } from '../../types/index.ts';
import { usePlanContext } from '../../contexts/PlanContext.tsx';
import { useProcessContext } from '../../contexts/ProcessContext.tsx';
import ChevronDownIcon from '../shared/ChevronDownIcon.tsx';
import ChevronUpIcon from '../shared/ChevronUpIcon.tsx';


export const IterativePlanEditor: React.FC<CommonControlProps> = ({
  commonSelectClasses,
  commonInputClasses,
  commonCheckboxLabelClasses,
  commonCheckboxInputClasses,
}) => {
  const planCtx = usePlanContext();
  const processCtx = useProcessContext();

  const [showPlanInfo, setShowPlanInfo] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const planInfoTriggerRef = useRef<HTMLDivElement>(null);
  const [templateSaveName, setTemplateSaveName] = useState('');

  const planInfoTooltipText = `Define a sequence of AI refinement stages.
- Each stage has specific goals: Output Format (paragraph, JSON, etc.), desired Length change, Complexity adjustment, and number of Iterations for that stage.
- Custom Instructions can be provided per stage for more targeted refinement.
- Paragraph settings (headings, depth) can be overridden per 'paragraph' format stage using the "Output Structure Defaults" below as a base.
- The AI executes these stages sequentially on the product.
- **Model Parameters (Temp, Top-P, Top-K) are set once from the global sliders at the start of the plan and remain fixed for all stages.** They do not dynamically change during a plan.
- Useful for complex tasks, e.g., generate content -> summarize -> convert to JSON.`;

  useEffect(() => {
    if (planCtx.planTemplateStatus) {
      const timer = setTimeout(() => {
        planCtx.clearPlanTemplateStatus();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [planCtx.planTemplateStatus, planCtx.clearPlanTemplateStatus]);
  
  const handleStageChange = (index: number, field: keyof PlanStage, value: any) => {
    if (processCtx.isProcessing) return;
    const newStages = [...planCtx.planStages];
    (newStages[index] as any)[field] = value;
    planCtx.onPlanStagesChange(newStages);
  };
  
  const addStage = () => {
    if (processCtx.isProcessing) return;
    const newStage: PlanStage = {
      id: `stage_${Date.now()}`,
      format: 'paragraph',
      length: 'same',
      complexity: 'maintain',
      stageIterations: 1,
    };
    planCtx.onPlanStagesChange([...planCtx.planStages, newStage]);
  };
  
  const removeStage = (index: number) => {
    if (processCtx.isProcessing) return;
    const newStages = planCtx.planStages.filter((_, i) => i !== index);
    planCtx.onPlanStagesChange(newStages);
  };
  
  const moveStage = (index: number, direction: 'up' | 'down') => {
    if (processCtx.isProcessing) return;
    const newStages = [...planCtx.planStages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    planCtx.onPlanStagesChange(newStages);
  };

  const handleSaveTemplate = () => {
      if (templateSaveName.trim() && planCtx.planStages.length > 0) {
          planCtx.handleSavePlanAsTemplate(templateSaveName, planCtx.planStages);
          setTemplateSaveName(''); // Clear after saving
      } else {
          alert('Please enter a template name and ensure there is at least one stage in the plan.');
      }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div 
          className="flex items-center relative cursor-help" 
          ref={planInfoTriggerRef} 
          onMouseEnter={() => setShowPlanInfo(true)} 
          onMouseLeave={() => setShowPlanInfo(false)}
        >
          <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300">Iterative Plan (?)</h3>
          {showPlanInfo && (
            <div role="tooltip" className="absolute bottom-full left-0 mb-2 w-80 bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm text-slate-700 dark:text-slate-200 text-xs p-3 rounded-md shadow-lg z-20 border border-slate-300/70 dark:border-white/20">
              {planInfoTooltipText.split('\n').map((line, i) => <p key={i} className={line.startsWith('-') ? 'ml-2' : ''}>{line}</p>)}
            </div>
          )}
        </div>
        <label className={commonCheckboxLabelClasses}>
          <span className="mr-2">Enable Plan Mode</span>
          <input 
            type="checkbox" 
            checked={planCtx.isPlanActive} 
            onChange={e => planCtx.onIsPlanActiveChange(e.target.checked)} 
            disabled={processCtx.isProcessing}
            className={commonCheckboxInputClasses}
          />
        </label>
      </div>
      
      {planCtx.planStages.map((stage, index) => (
        <div key={stage.id} className="p-3 bg-slate-100/70 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 space-y-2 relative">
           <div className="flex justify-between items-start">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">Stage {index + 1}</h4>
              <div className="flex items-center space-x-1">
                 <button onClick={() => moveStage(index, 'up')} disabled={index === 0 || processCtx.isProcessing} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"><ChevronUpIcon /></button>
                 <button onClick={() => moveStage(index, 'down')} disabled={index === planCtx.planStages.length - 1 || processCtx.isProcessing} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"><ChevronDownIcon /></button>
                 <button onClick={() => removeStage(index)} disabled={processCtx.isProcessing} className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-30">&times;</button>
              </div>
            </div>
          {/* Stage controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                  <label className="text-xs text-primary-600 dark:text-primary-400">Iterations</label>
                  <input type="number" min="1" value={stage.stageIterations} onChange={e => handleStageChange(index, 'stageIterations', parseInt(e.target.value) || 1)} className={commonInputClasses + " text-sm py-1.5"} disabled={processCtx.isProcessing} />
              </div>
               <div>
                  <label className="text-xs text-primary-600 dark:text-primary-400">Format</label>
                  <select value={stage.format} onChange={e => handleStageChange(index, 'format', e.target.value)} className={commonSelectClasses + " text-sm py-1.5"} disabled={processCtx.isProcessing}>
                      {['paragraph', 'key_points', 'outline', 'json', 'auto'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
              </div>
               <div>
                  <label className="text-xs text-primary-600 dark:text-primary-400">Length</label>
                  <select value={stage.length} onChange={e => handleStageChange(index, 'length', e.target.value)} className={commonSelectClasses + " text-sm py-1.5"} disabled={processCtx.isProcessing}>
                      {['shorter', 'same', 'longer', 'much_longer', 'auto'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
              </div>
              <div>
                  <label className="text-xs text-primary-600 dark:text-primary-400">Complexity</label>
                  <select value={stage.complexity} onChange={e => handleStageChange(index, 'complexity', e.target.value)} className={commonSelectClasses + " text-sm py-1.5"} disabled={processCtx.isProcessing}>
                      {['simplify', 'maintain', 'enrich', 'auto'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
          </div>
          <div>
            <label className="text-xs text-primary-600 dark:text-primary-400">Custom Instruction (Optional)</label>
            <input type="text" value={stage.customInstruction || ''} onChange={e => handleStageChange(index, 'customInstruction', e.target.value)} className={commonInputClasses + " text-sm py-1.5"} placeholder="e.g., 'Focus on the business impact'" disabled={processCtx.isProcessing} />
          </div>
        </div>
      ))}

      <button onClick={addStage} disabled={processCtx.isProcessing} className="w-full mt-2 text-sm px-3 py-1.5 border-2 border-dashed border-slate-400 dark:border-white/30 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10 disabled:opacity-50">
        + Add Stage
      </button>

      {/* Template Management */}
      <div className="pt-4 mt-4 border-t border-slate-300/70 dark:border-white/10 space-y-2">
        <h4 className="font-semibold text-md text-primary-600 dark:text-primary-300">Plan Templates</h4>
        <div className="flex gap-2">
          <input type="text" value={templateSaveName} onChange={e => setTemplateSaveName(e.target.value)} placeholder="New template name" className={commonInputClasses + " flex-grow"} disabled={processCtx.isProcessing}/>
          <button onClick={handleSaveTemplate} disabled={processCtx.isProcessing || !templateSaveName.trim() || planCtx.planStages.length === 0} className="px-3 py-1.5 border border-primary-500 text-primary-600 dark:text-primary-200 bg-primary-100/80 dark:bg-primary-600/50 hover:bg-primary-200 dark:hover:bg-primary-500/50 rounded-md text-sm disabled:opacity-50">Save</button>
        </div>
        <div ref={templateDropdownRef} className="relative">
          <button onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)} className="w-full flex justify-between items-center px-3 py-2 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm text-sm" disabled={processCtx.isProcessing}>
            <span>Load a Template</span>
            <ChevronDownIcon />
          </button>
          {isTemplateDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
              {planCtx.savedPlanTemplates.map(template => (
                <div key={template.name} className="flex justify-between items-center p-2 hover:bg-slate-100 dark:hover:bg-slate-600">
                    <button onClick={() => { planCtx.onLoadPlanTemplate(template); setIsTemplateDropdownOpen(false); }} className="text-left flex-grow text-sm">{template.name}</button>
                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete template "${template.name}"?`)) {planCtx.handleDeletePlanTemplate(template.name)}}} className="text-xs text-red-500 hover:text-red-700 ml-2">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {planCtx.planTemplateStatus && <p className="text-xs text-green-600 dark:text-green-400 italic mt-1">{planCtx.planTemplateStatus}</p>}
      </div>
    </div>
  );
};

export default IterativePlanEditor;
