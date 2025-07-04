import React from 'react';
import type { PlanStage } from '../types.ts';
import { generateFileName } from '../services/utils.ts';
import { useApplicationContext } from '../contexts/ApplicationContext.tsx';
import { useProcessContext } from '../contexts/ProcessContext.tsx';

import ProcessStatusDisplay from './display/ProcessStatusDisplay.tsx';
import ProductOutputDisplay from './display/ProductOutputDisplay.tsx';
import IterationLog from './display/IterationLog.tsx';
import { formatVersion } from '../services/versionUtils.ts';

const DisplayArea: React.FC = () => {
  const appCtx = useApplicationContext();
  const processCtx = useProcessContext();

   const handleSaveFinalProduct = () => {
    const productToSave = processCtx.finalProduct || processCtx.currentProduct;
    const isFinalProduct = !!processCtx.finalProduct;
    const currentVersion = { major: processCtx.currentMajorVersion, minor: processCtx.currentMinorVersion };

    if (!productToSave) return;

    const generationTimestamp = new Date().toISOString();
    const initialPromptSummary = (processCtx.initialPrompt.length > 150 ? processCtx.initialPrompt.substring(0, 147) + "..." : processCtx.initialPrompt).replace(/\n+/g, ' ').trim();
    let contentWarning = (!productToSave.trim() || productToSave.trim().length < 10) ? `\nWARNING_NOTE: The main product content below appears to be empty or very short...\n` : "";
    
    let yamlFrontmatter = `---
export_type: ${isFinalProduct ? 'FINAL_PRODUCT' : 'INTERMEDIATE_PRODUCT'}
export_version: ${formatVersion(currentVersion)}
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
            if (stage.customInstruction) {
                 yamlFrontmatter += `    custom_instruction: "${stage.customInstruction.replace(/"/g, '\\\\"')}"\n`;
            }
        });
    } else {
        yamlFrontmatter += `autologos_process_plan_active: false\n`;
        yamlFrontmatter += `autologos_process_settings:\n`;
        yamlFrontmatter += `  mode: global_autonomous\n`; 
    }
    yamlFrontmatter += `initial_prompt_summary: "${initialPromptSummary.replace(/"/g, '\\\\"')}"
final_version: ${formatVersion(currentVersion)}
max_versions_setting: ${processCtx.maxMajorVersions}
prompt_input_type: ${processCtx.loadedFiles && processCtx.loadedFiles.length > 0 ? 'files' : 'direct_text'}
`;
    if (processCtx.loadedFiles && processCtx.loadedFiles.length > 0) {
      yamlFrontmatter += `prompt_source_files:\n`;
      processCtx.loadedFiles.forEach(file => { yamlFrontmatter += `  - "${file.name.replace(/"/g, '\\\\"')}"\n`; });
    } else {
      yamlFrontmatter += `prompt_source_details: "${(processCtx.promptSourceName || 'typed_prompt').replace(/"/g, '\\\\"')}"\n`;
    }
    const modelConfigForYAML = processCtx.configAtFinalization || processCtx.currentAppliedModelConfig;
    if (modelConfigForYAML) {
        yamlFrontmatter += `model_configuration_at_${isFinalProduct ? 'finalization' : 'export'}:
  model_name: '${appCtx.staticAiModelDetails?.modelName || 'N/A'}'
  temperature: ${modelConfigForYAML.temperature.toFixed(2)}
  top_p: ${modelConfigForYAML.topP.toFixed(2)}
  top_k: ${modelConfigForYAML.topK}
`;
    }
    yamlFrontmatter += `---
${contentWarning}
`;
    const markdownContent = yamlFrontmatter + productToSave;
    const fileNameSuffix = isFinalProduct ? "product_final" : `product_${formatVersion(currentVersion)}`;
    const fileName = generateFileName(appCtx.projectName, fileNameSuffix, "md");
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
