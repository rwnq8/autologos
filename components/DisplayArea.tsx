
import React, { useContext } from 'react';
import type { IterationLogEntry, PlanStage, DiffViewType, ReconstructedProductResult } from '../types'; // Adjusted type imports
import { generateFileName } from '../services/utils';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { useProcessContext } from '../contexts/ProcessContext';

import ProcessStatusDisplay from './display/ProcessStatusDisplay';
import ProductOutputDisplay from './display/ProductOutputDisplay';
import IterationLog from './display/IterationLog';

// No direct props needed from App.tsx anymore as data comes from context
// interface DisplayAreaProps { ... } // Removed

const DisplayArea: React.FC = () => {
  const appCtx = useApplicationContext();
  const processCtx = useProcessContext();

   const handleSaveFinalProduct = () => {
    if (!processCtx.finalProduct || !appCtx.staticAiModelDetails || !processCtx.configAtFinalization) return;
    const generationTimestamp = new Date().toISOString();
    const initialPromptSummary = (processCtx.initialPrompt.length > 150 ? processCtx.initialPrompt.substring(0, 147) + "..." : processCtx.initialPrompt).replace(/\n+/g, ' ').trim();
    let contentWarning = (!processCtx.finalProduct.trim() || processCtx.finalProduct.trim().length < 10) ? `\nWARNING_NOTE: The main product content below appears to be empty or very short...\n` : "";
    
    let overallIterationCountForYAML = processCtx.currentIteration;
    // Recalculate if plan was active and history exists
    const planCtxIsPlanActive = processCtx.iterationHistory.some(h => h.modelConfigUsed !== undefined); // Simple check if plan was used
    const planCtxPlanStages = processCtx.iterationHistory.find(h => h.modelConfigUsed !== undefined)?.modelConfigUsed !== undefined ? processCtx.iterationHistory[0]?.modelConfigUsed ? [] : [] : []; // Placeholder

    if (planCtxIsPlanActive && processCtx.iterationHistory.length > 0) {
      overallIterationCountForYAML = processCtx.iterationHistory.length > 0 ? Math.max(...processCtx.iterationHistory.map(i => i.iteration)) : 0;
    }

    let yamlFrontmatter = `---
export_type: FINAL_PRODUCT
generation_timestamp: ${generationTimestamp}
project_name: "${(appCtx.projectName || "Untitled Project").replace(/"/g, '\\\\"')}"
`;
    // YAML construction using context data
    // Assuming PlanContext data (isPlanActive, planStages) would be accessed here if needed,
    // For now, using derived or processCtx properties for simplicity as PlanContext isn't directly consumed by DisplayArea
    // This part might need further refinement based on how PlanContext data is made available or used for YAML
    const isPlanCurrentlyActive = processCtx.iterationHistory.some(e => e.modelConfigUsed !== undefined && e.modelConfigUsed !== processCtx.configAtFinalization); // A guess
    const actualPlanStagesUsed = processCtx.iterationHistory.map(e => e.modelConfigUsed ? "stage_data_placeholder" : null).filter(s => s) as unknown as PlanStage[]; // Placeholder


    if (isPlanCurrentlyActive && actualPlanStagesUsed.length > 0) {
        yamlFrontmatter += `autologos_process_plan_active: true\n`;
        yamlFrontmatter += `autologos_process_plan_stages:\n`;
        actualPlanStagesUsed.forEach((stage, index) => { // This needs actual plan stage data
            yamlFrontmatter += `  - stage: ${index + 1}\n`;
            yamlFrontmatter += `    format: ${stage.format}\n`;
            yamlFrontmatter += `    length: ${stage.length}\n`;
            yamlFrontmatter += `    complexity: ${stage.complexity}\n`;
            yamlFrontmatter += `    target_iterations: ${stage.stageIterations}\n`;
            if (stage.format === 'paragraph') {
                yamlFrontmatter += `    paragraph_show_headings: ${stage.outputParagraphShowHeadings ?? processCtx.outputParagraphShowHeadings}\n`;
                if (stage.outputParagraphShowHeadings ?? processCtx.outputParagraphShowHeadings) {
                    yamlFrontmatter += `    paragraph_max_heading_depth: ${stage.outputParagraphMaxHeadingDepth ?? processCtx.outputParagraphMaxHeadingDepth}\n`;
                    yamlFrontmatter += `    paragraph_numbered_headings: ${stage.outputParagraphNumberedHeadings ?? processCtx.outputParagraphNumberedHeadings}\n`;
                }
            }
        });
    } else {
        yamlFrontmatter += `autologos_process_plan_active: false\n`;
        yamlFrontmatter += `autologos_process_settings:\n`;
        yamlFrontmatter += `  mode: basic_autonomous\n`;
        yamlFrontmatter += `  paragraph_show_headings_preference: ${processCtx.outputParagraphShowHeadings}\n`;
        if (processCtx.outputParagraphShowHeadings) {
            yamlFrontmatter += `  paragraph_max_heading_depth_preference: ${processCtx.outputParagraphMaxHeadingDepth}\n`;
            yamlFrontmatter += `  paragraph_numbered_headings_preference: ${processCtx.outputParagraphNumberedHeadings}\n`;
        }
    }
    yamlFrontmatter += `initial_prompt_summary: "${initialPromptSummary.replace(/"/g, '\\\\"')}"
final_iteration_count: ${overallIterationCountForYAML}
max_iterations_setting: ${processCtx.iterationHistory.length > 0 ? (processCtx.iterationHistory[0].modelConfigUsed ? 0 : processCtx.currentIteration) : processCtx.currentIteration} 
prompt_input_type: ${processCtx.loadedFiles && processCtx.loadedFiles.length > 0 ? 'files' : 'direct_text'}
`;
    if (processCtx.loadedFiles && processCtx.loadedFiles.length > 0) {
      yamlFrontmatter += `prompt_source_files:\n`;
      processCtx.loadedFiles.forEach(file => { yamlFrontmatter += `  - "${file.name.replace(/"/g, '\\\\"')}"\n`; });
    } else {
      yamlFrontmatter += `prompt_source_details: "${(processCtx.promptSourceName || 'typed_prompt').replace(/"/g, '\\\\"')}"\n`;
    }
    yamlFrontmatter += `model_configuration_at_finalization:
  model_name: '${appCtx.staticAiModelDetails.modelName}'
  temperature: ${processCtx.configAtFinalization.temperature.toFixed(2)}
  top_p: ${processCtx.configAtFinalization.topP.toFixed(2)}
  top_k: ${processCtx.configAtFinalization.topK}
---
${contentWarning}
`;
    const markdownContent = yamlFrontmatter + processCtx.finalProduct;
    const fileName = generateFileName(appCtx.projectName, "product", "md");
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const handleSaveLog = () => {
    if (processCtx.iterationHistory.length === 0) return;
    const fileName = generateFileName(appCtx.projectName, "log", "json");
    const logContent = JSON.stringify(processCtx.iterationHistory, null, 2);
    const blob = new Blob([logContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-8 p-6">
      <ProcessStatusDisplay />

      <ProductOutputDisplay
        onSaveFinalProduct={handleSaveFinalProduct}
      />

      <IterationLog
        onSaveLog={handleSaveLog}
      />
    </div>
  );
};

export default DisplayArea;
