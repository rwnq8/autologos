

import React from 'react';
import type { IterationLogEntry, PlanStage } from '../types/index.ts';
import { generateFileName } from '../services/utils.ts';
import { useEngine } from '../contexts/ApplicationContext.tsx';
// PlanContext is not directly used for rendering by DisplayArea itself, 
// but its state (isPlanActive, planStages) is available via processCtx for YAML.

import ProcessStatusDisplay from './display/ProcessStatusDisplay.tsx';
import ProductOutputDisplay from './display/ProductOutputDisplay.tsx';
import IterationLog from './display/IterationLog.tsx';

const DisplayArea: React.FC = () => {
  const { app: appCtx, process: processCtx } = useEngine();

   const handleSaveFinalProduct = () => {
    if (!processCtx.finalProduct || !appCtx.staticAiModelDetails || !processCtx.configAtFinalization) return;
    const generationTimestamp = new Date().toISOString();
    const initialPromptSummary = (processCtx.initialPrompt.length > 150 ? processCtx.initialPrompt.substring(0, 147) + "..." : processCtx.initialPrompt).replace(/\n+/g, ' ').trim();
    let contentWarning = (!processCtx.finalProduct.trim() || processCtx.finalProduct.trim().length < 10) ? `\nWARNING_NOTE: The main product content below appears to be empty or very short...\n` : "";
    
    let overallIterationCountForYAML = processCtx.currentMajorVersion;
    
    let yamlFrontmatter = `---
export_type: FINAL_PRODUCT
generation_timestamp: ${generationTimestamp}
project_name: "${(appCtx.projectName || "Untitled Project").replace(/"/g, '\\\\"')}"
`;
    if (processCtx.isPlanActive && processCtx.planStages.length > 0) {
        yamlFrontmatter += `autologos_process_plan_active: true\n`;
        yamlFrontmatter += `autologos_process_plan_stages:\n`;
        processCtx.planStages.forEach((stage, index) => { 
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
            if (stage.customInstruction) {
                 yamlFrontmatter += `    custom_instruction: "${stage.customInstruction.replace(/"/g, '\\\\"')}"\n`;
            }
        });
    } else {
        yamlFrontmatter += `autologos_process_plan_active: false\n`;
        yamlFrontmatter += `autologos_process_settings:\n`;
        yamlFrontmatter += `  mode: global_autonomous\n`; 
        yamlFrontmatter += `  paragraph_show_headings_preference: ${processCtx.outputParagraphShowHeadings}\n`;
        if (processCtx.outputParagraphShowHeadings) {
            yamlFrontmatter += `  paragraph_max_heading_depth_preference: ${processCtx.outputParagraphMaxHeadingDepth}\n`;
            yamlFrontmatter += `  paragraph_numbered_headings_preference: ${processCtx.outputParagraphNumberedHeadings}\n`;
        }
    }
    yamlFrontmatter += `initial_prompt_summary: "${initialPromptSummary.replace(/"/g, '\\\\"')}"
final_iteration_count: ${overallIterationCountForYAML}
max_iterations_setting: ${processCtx.maxMajorVersions}
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