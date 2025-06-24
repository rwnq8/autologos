

import React, { useState, useEffect, useRef, useContext } from 'react';
import type { PlanStage, PlanTemplate, OutputFormat, OutputLength, OutputComplexity, CommonControlProps } from '../../types.ts';
import { usePlanContext } from '../../contexts/PlanContext';
import { useProcessContext } from '../../contexts/ProcessContext';

// IterativePlanEditorProps removed

const IterativePlanEditor: React.FC<CommonControlProps> = ({
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDefaultStageIterations = (format: OutputFormat): number => {
    switch (format) {
      case 'paragraph': return 2;
      case 'key_points': return 1;
      case 'outline': return 1;
      case 'json': return 2;
      case 'auto': return 2;
      default: return 1;
    }
  };

  const handleAddPlanStage = () => {
    const newFormat: OutputFormat = 'paragraph';
    const newStage: PlanStage = {
      id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      length: 'same',
      format: newFormat,
      complexity: 'maintain',
      stageIterations: getDefaultStageIterations(newFormat),
      outputParagraphShowHeadings: undefined,
      outputParagraphMaxHeadingDepth: undefined,
      outputParagraphNumberedHeadings: undefined,
      customInstruction: "", // Initialize customInstruction
    };
    planCtx.onPlanStagesChange([...planCtx.planStages, newStage]);
  };

  const handleRemovePlanStage = (stageIdToRemove: string) => {
    planCtx.onPlanStagesChange(planCtx.planStages.filter(stage => stage.id !== stageIdToRemove));
  };

  const handlePlanStageChange = <K extends keyof PlanStage>(
    stageId: string,
    field: K,
    value: PlanStage[K]
  ) => {
    planCtx.onPlanStagesChange(
      planCtx.planStages.map(stage => {
        if (stage.id === stageId) {
          const updatedStage = { ...stage, [field]: value };
          if (field === 'format') {
            updatedStage.stageIterations = getDefaultStageIterations(updatedStage.format);
          }
          return updatedStage;
        }
        return stage;
      })
    );
  };

  const handleMovePlanStage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === planCtx.planStages.length - 1)
    ) {
      return;
    }
    const newStages = [...planCtx.planStages];
    const itemToMove = newStages.splice(index, 1)[0];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    newStages.splice(newIndex, 0, itemToMove);
    planCtx.onPlanStagesChange(newStages);
  };

  const totalPlanIterations = planCtx.isPlanActive ? planCtx.planStages.reduce((sum, stage) => sum + stage.stageIterations, 0) : 0;

  const handleSaveCurrentPlanAsTemplate = () => {
    if (planCtx.planStages.length === 0) {
      alert("Cannot save an empty plan as a template.");
      return;
    }
    const templateName = prompt("Enter a name for this plan template:", "My Custom Plan");
    if (templateName && templateName.trim()) {
      planCtx.handleSavePlanAsTemplate(templateName.trim(), planCtx.planStages);
    }
  };


  return (
    <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div
            className="flex items-center relative"
            ref={planInfoTriggerRef}
            onMouseEnter={() => setShowPlanInfo(true)}
            onMouseLeave={() => setShowPlanInfo(false)}
            onFocus={() => setShowPlanInfo(true)}
            onBlur={() => setShowPlanInfo(false)}
            tabIndex={0}
            aria-describedby="plan-info-tooltip"
          >
          <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300 mr-2 cursor-help">Iterative Plan (?)</h3>
            {showPlanInfo && (
              <div
                id="plan-info-tooltip"
                role="tooltip"
                className="absolute bottom-full left-0 mb-2 w-80 bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm text-slate-700 dark:text-slate-200 text-xs p-3 rounded-md shadow-lg z-20 border border-slate-300/70 dark:border-white/20"
              >
                {planInfoTooltipText.split('\n').map((line, i) => (
                  <p key={i} className={`mb-1 ${line.startsWith('- **') ? 'ml-2 font-semibold' : line.startsWith('-') ? 'ml-2' : ''}`}>
                    {line.replace(/- \*\*/g, '- ').replace(/\*\*/g, '')}
                  </p>
                ))}
              </div>
            )}
        </div>
        <div className="flex items-center">
          <span className={`mr-2 text-sm ${planCtx.isPlanActive ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {planCtx.isPlanActive ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={() => planCtx.onIsPlanActiveChange(!planCtx.isPlanActive)}
            disabled={processCtx.isProcessing}
            className={`${planCtx.isPlanActive ? 'bg-primary-600 dark:bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 disabled:opacity-50`}
            role="switch"
            aria-checked={planCtx.isPlanActive}
            aria-label="Toggle Iterative Plan"
          >
            <span
              className={`${planCtx.isPlanActive ? 'translate-x-5' : 'translate-x-0'
                } inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-300 shadow ring-0 transition duration-200 ease-in-out`}
            />
          </button>
        </div>
      </div>

      {planCtx.isPlanActive && (
        <div className="space-y-4 p-4 bg-slate-100/50 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 animate-fadeIn">
          {planCtx.planTemplateStatus && (
            <p className="text-xs text-center text-primary-600 dark:text-primary-400 p-1 bg-primary-100 dark:bg-primary-700/30 rounded-md">
              {planCtx.planTemplateStatus}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <button
              onClick={handleSaveCurrentPlanAsTemplate}
              disabled={processCtx.isProcessing || planCtx.planStages.length === 0}
              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 border border-primary-400 dark:border-primary-500/70 text-xs font-medium rounded-md text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-700/30 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              title="Save current plan stages as a reusable template"
            >
              Save Plan as Template
            </button>
            <div className="relative flex-1" ref={templateDropdownRef}>
              <button
                onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                disabled={processCtx.isProcessing}
                className="w-full inline-flex items-center justify-center px-3 py-1.5 border border-primary-400 dark:border-primary-500/70 text-xs font-medium rounded-md text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-700/30 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                aria-haspopup="true"
                aria-expanded={isTemplateDropdownOpen}
              >
                Load Template <span className="ml-1 text-xs">{isTemplateDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isTemplateDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 rounded-md shadow-lg border border-slate-200 dark:border-slate-600 max-h-60 overflow-y-auto">
                  {planCtx.savedPlanTemplates.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400 p-2 text-center">No saved templates yet.</p>}
                  {planCtx.savedPlanTemplates.map((template) => (
                    <div key={template.name} className="flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-600">
                      <button
                        onClick={() => { planCtx.onLoadPlanTemplate(template); setIsTemplateDropdownOpen(false); }}
                        className="block w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                      >
                        {template.name} ({template.stages.length} stages)
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete template "${template.name}"?`)) planCtx.handleDeletePlanTemplate(template.name); }}
                        className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 mr-1 rounded"
                        title={`Delete template "${template.name}"`}
                         aria-label={`Delete plan template "${template.name}"`}
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {planCtx.planStages.map((stage, index) => (
            <div key={stage.id} className="p-4 bg-white/70 dark:bg-slate-800/40 rounded-lg shadow border border-slate-300 dark:border-slate-600/80 relative group mb-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-300">Stage {index + 1}</h4>
                <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleMovePlanStage(index, 'up')} disabled={index === 0 || processCtx.isProcessing} className="p-1 rounded text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 disabled:opacity-30 text-xs" title="Move stage up" aria-label={`Move stage ${index + 1} up`}>Up</button>
                  <button onClick={() => handleMovePlanStage(index, 'down')} disabled={index === planCtx.planStages.length - 1 || processCtx.isProcessing} className="p-1 rounded text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 disabled:opacity-30 text-xs" title="Move stage down" aria-label={`Move stage ${index + 1} down`}>Down</button>
                  <button onClick={() => handleRemovePlanStage(stage.id)} disabled={processCtx.isProcessing} className="p-1 rounded text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 text-xs" title="Remove stage" aria-label={`Remove stage ${index + 1}`}>Remove</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`stage-format-${stage.id}`} className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5">Format</label>
                  <select id={`stage-format-${stage.id}`} value={stage.format} onChange={e => handlePlanStageChange(stage.id, 'format', e.target.value as OutputFormat)} disabled={processCtx.isProcessing} className={(commonSelectClasses ?? '') + " text-xs py-1.5"}>
                    <option value="auto">Auto (AI Decides)</option>
                    <option value="paragraph">Paragraph</option>
                    <option value="key_points">Key Points</option>
                    <option value="outline">Outline</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`stage-iterations-${stage.id}`} className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5">Stage Iterations</label>
                  <input type="number" id={`stage-iterations-${stage.id}`} value={stage.stageIterations} onChange={e => handlePlanStageChange(stage.id, 'stageIterations', Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" max="50" disabled={processCtx.isProcessing} className={commonInputClasses + " text-xs py-1.5 px-2"} />
                </div>
                <div>
                  <label htmlFor={`stage-length-${stage.id}`} className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5">Length</label>
                  <select id={`stage-length-${stage.id}`} value={stage.length} onChange={e => handlePlanStageChange(stage.id, 'length', e.target.value as OutputLength)} disabled={processCtx.isProcessing} className={(commonSelectClasses ?? '') + " text-xs py-1.5"}>
                    <option value="auto">Auto (AI Decides)</option>
                    <option value="shorter">Shorter</option><option value="same">Same</option><option value="longer">Longer</option><option value="much_longer">Much Longer</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`stage-complexity-${stage.id}`} className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5">Complexity</label>
                  <select id={`stage-complexity-${stage.id}`} value={stage.complexity} onChange={e => handlePlanStageChange(stage.id, 'complexity', e.target.value as OutputComplexity)} disabled={processCtx.isProcessing} className={(commonSelectClasses ?? '') + " text-xs py-1.5"}>
                    <option value="auto">Auto (AI Decides)</option>
                    <option value="simplify">Simplify</option><option value="maintain">Maintain</option><option value="enrich">Enrich</option>
                  </select>
                </div>

                {stage.format !== 'auto' && (
                   <div className="sm:col-span-2">
                    <label htmlFor={`stage-custom-instruction-${stage.id}`} className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5">
                      Custom Instruction for this Stage (Optional)
                    </label>
                    <textarea
                      id={`stage-custom-instruction-${stage.id}`}
                      rows={2}
                      value={stage.customInstruction || ''}
                      onChange={e => handlePlanStageChange(stage.id, 'customInstruction', e.target.value)}
                      disabled={processCtx.isProcessing}
                      className={commonInputClasses + " text-xs py-1.5 px-2"}
                      placeholder="e.g., Focus on clarifying the introduction, Adopt a formal tone..."
                    />
                  </div>
                )}

                {stage.format === 'paragraph' && (
                  <div className="sm:col-span-2 mt-2 p-2 bg-slate-50/50 dark:bg-slate-700/30 rounded-md border border-slate-200 dark:border-slate-600/50 space-y-2">
                    <h5 className="text-xs font-medium text-primary-600 dark:text-primary-400">Paragraph Settings for Stage (Overrides Global if Checked):</h5>
                    <label className={(commonCheckboxLabelClasses ?? '') + " text-xs"}>
                      <input type="checkbox" checked={stage.outputParagraphShowHeadings ?? processCtx.outputParagraphShowHeadings} onChange={(e) => handlePlanStageChange(stage.id, 'outputParagraphShowHeadings', e.target.checked)} disabled={processCtx.isProcessing} className={(commonCheckboxInputClasses ?? '') + " mr-2"} />
                      Include Headings
                    </label>
                    {(stage.outputParagraphShowHeadings ?? processCtx.outputParagraphShowHeadings) && (
                      <>
                        <label className={(commonCheckboxLabelClasses ?? '') + " text-xs ml-4"}>
                          <input type="checkbox" checked={stage.outputParagraphNumberedHeadings ?? processCtx.outputParagraphNumberedHeadings} onChange={(e) => handlePlanStageChange(stage.id, 'outputParagraphNumberedHeadings', e.target.checked)} disabled={processCtx.isProcessing} className={(commonCheckboxInputClasses ?? '') + " mr-2"} />
                          Numbered Headings
                        </label>
                        <div>
                          <label htmlFor={`stage-maxdepth-${stage.id}`} className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5 ml-4">Max Heading Depth (1-6)</label>
                          <input type="number" id={`stage-maxdepth-${stage.id}`} value={stage.outputParagraphMaxHeadingDepth ?? processCtx.outputParagraphMaxHeadingDepth} onChange={e => handlePlanStageChange(stage.id, 'outputParagraphMaxHeadingDepth', Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))} min="1" max="6" disabled={processCtx.isProcessing} className={commonInputClasses + " text-xs py-1 px-1.5 w-16 ml-4"} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={handleAddPlanStage}
            disabled={processCtx.isProcessing}
            className="w-full mt-3 inline-flex items-center justify-center px-3 py-2 border border-dashed border-primary-400 dark:border-primary-500/80 text-sm font-medium rounded-md text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-700/30 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
          >
            Add Stage to Plan
          </button>
          {planCtx.planStages.length > 0 && (
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
              Total plan iterations: {totalPlanIterations} (approx.)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default IterativePlanEditor;