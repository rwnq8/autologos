import React, { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react';
import type { ProcessState, ModelConfig, SettingsSuggestionSource, StaticAiModelDetails, SelectableModelName, AutologosProjectFile, PlanTemplate, IterationLogEntry, Version, PlanStage, LoadedFile, DocumentChunk } from '../types/index.ts';
import { SELECTABLE_MODELS } from '../types/index.ts';
import type { ModelConfigContextType } from './ModelConfigContext.tsx';
import { useProcessState, createInitialProcessState } from '../hooks/useProcessState.ts';
import { useModelParameters } from '../hooks/useModelParameters.ts';
import { usePlanTemplates } from '../hooks/usePlanTemplates.ts';
import { useIterativeLogic } from '../hooks/useIterativeLogic.ts';
import { useProjectIO } from '../hooks/useProjectIO.ts';
import { useAutoSave } from '../hooks/useAutoSave.ts';
import * as geminiService from '../services/geminiService.ts';
import { getAiModelDetails, isApiKeyAvailable } from '../services/geminiService.ts';
import { inferProjectNameFromInput } from '../services/projectUtils.ts';
import { generateFileName, toYamlStringLiteral } from '../services/utils.ts';
import { reconstructProduct } from '../services/diffService.ts';
import { formatVersion } from '../services/versionUtils.ts';
import { splitToChunks, reconstructFromChunks } from '../services/chunkingService.ts';

// Define the shape of the comprehensive engine object
interface EngineContextType {
  app: {
    apiKeyStatus: 'loaded' | 'missing';
    isApiRateLimited: boolean;
    rateLimitCooldownActiveSeconds: number;
    staticAiModelDetails: StaticAiModelDetails | null;
    onSelectedModelChange: (modelName: SelectableModelName) => void;
    onFilesSelectedForImport: (files: FileList | null) => Promise<void>;
    projectName: string | null;
  };
  process: ReturnType<typeof useProcessState>['state'] & {
    handleStartProcess: ReturnType<typeof useIterativeLogic>['handleStartProcess'];
    handleHaltProcess: ReturnType<typeof useIterativeLogic>['handleHaltProcess'];
    handleBootstrapSynthesis: ReturnType<typeof useIterativeLogic>['handleBootstrapSynthesis'];
    updateProcessState: ReturnType<typeof useProcessState>['updateProcessState'];
    handleLoadedFilesChange: ReturnType<typeof useProcessState>['handleLoadedFilesChange'];
    handleReset: () => Promise<void>;
    handleRewind: (version: Version) => void;
    handleExportIterationMarkdown: (version: Version) => void;
    reconstructProductCallback: (targetVersion: Version, history: IterationLogEntry[], basePrompt: string) => ReturnType<typeof reconstructProduct>;
    handleInitialPromptChange: (newPromptText: string) => void;
    addDevLogEntry: ReturnType<typeof useProcessState>['addDevLogEntry'];
    updateDevLogEntry: ReturnType<typeof useProcessState>['updateDevLogEntry'];
    deleteDevLogEntry: ReturnType<typeof useProcessState>['deleteDevLogEntry'];
    saveManualEdits: () => Promise<void>;
    openDiffViewer: (version: Version) => void;
    closeDiffViewer: () => void;
  };
  modelConfig: ModelConfigContextType;
  plan: ReturnType<typeof usePlanTemplates> & {
    isPlanActive: boolean;
    planStages: PlanTemplate['stages'];
    onIsPlanActiveChange: (isActive: boolean) => void;
    onPlanStagesChange: (stages: PlanTemplate['stages']) => void;
    onLoadPlanTemplate: (template: PlanTemplate) => void;
  };
  projectIO: ReturnType<typeof useProjectIO>;
  autoSave: ReturnType<typeof useAutoSave>;
}

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export const useEngine = () => {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return context;
};

export const EngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- Core State Hooks ---
  const { state: processState, ...processActions } = useProcessState();
  const [promptChangedByFileLoad, setPromptChangedByFileLoad] = useState(false);
  const modelParams = useModelParameters(
    processState.initialPrompt,
    processState.loadedFiles.length,
    processState.isPlanActive,
    promptChangedByFileLoad,
    () => setPromptChangedByFileLoad(false)
  );
  const planTemplates = usePlanTemplates();
  
  // --- State dependent on other state ---
  const [staticAiModelDetails, setStaticAiModelDetails] = useState<StaticAiModelDetails | null>(
    getAiModelDetails(processState.selectedModelName)
  );
  
  // --- Update static model details when selected model changes ---
  useEffect(() => {
    setStaticAiModelDetails(getAiModelDetails(processState.selectedModelName));
  }, [processState.selectedModelName]);

  // --- Update Project Name when input changes ---
  useEffect(() => {
      if (promptChangedByFileLoad) {
        const newName = inferProjectNameFromInput(processState.initialPrompt, processState.loadedFiles);
        if (newName) {
          processActions.updateProcessState({ projectName: newName });
        }
      }
  }, [processState.initialPrompt, processState.loadedFiles, promptChangedByFileLoad, processActions]);

  const onIsPlanActiveChange = useCallback((isActive: boolean) => {
    processActions.updateProcessState({ isPlanActive: isActive });
  }, [processActions]);
  
  const onPlanStagesChange = useCallback((stages: PlanStage[]) => {
    processActions.updateProcessState({ planStages: stages });
  }, [processActions]);

  const onLoadPlanTemplate = useCallback((template: PlanTemplate) => {
      onPlanStagesChange(template.stages);
  }, [onPlanStagesChange]);

  const onMaxIterationsChange = useCallback((value: number) => {
    processActions.updateProcessState({ maxMajorVersions: value });
  }, [processActions]);

  const onSelectedModelChange = useCallback((modelName: SelectableModelName) => {
      processActions.updateProcessState({ selectedModelName: modelName });
  }, [processActions]);

  const handleRateLimitErrorEncountered = useCallback(() => {
    processActions.updateProcessState({
      isApiRateLimited: true,
      rateLimitCooldownActiveSeconds: 60,
    });
  }, [processActions]);

  const autoSave = useAutoSave(
    processState, 
    modelParams, 
    processActions.updateProcessState, 
    planTemplates.overwriteUserTemplates, 
    createInitialProcessState(processState.apiKeyStatus, processState.selectedModelName), 
    modelParams, 
    () => modelParams.resetModelParametersToDefaults()
  );
  
  const projectIO = useProjectIO(
    processState, 
    modelParams, 
    processActions.updateProcessState, 
    planTemplates.overwriteUserTemplates,
    createInitialProcessState(processState.apiKeyStatus, processState.selectedModelName),
    modelParams,
    () => modelParams.resetModelParametersToDefaults()
  );

  const iterativeLogic = useIterativeLogic(processState, processActions.updateProcessState, processActions.addLogEntry, processActions.addDevLogEntry, modelParams.getUserSetBaseConfig, autoSave.performAutoSave, handleRateLimitErrorEncountered);

  const onFilesSelectedForImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const isProjectFile = Array.from(files).some(file => file.name.endsWith('.autologos.json'));

    if (isProjectFile) {
        if (files.length > 1) {
            alert("Please import project files one at a time.");
            return;
        }
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const projectData: AutologosProjectFile = JSON.parse(e.target?.result as string);
                projectIO.handleImportProjectData(projectData);
            } catch (error) {
                console.error("Error parsing project file:", error);
                processActions.updateProcessState({ statusMessage: "Error: Could not parse the project file." });
            }
        };
        reader.readAsText(file);
    } else {
        const loadPromises = Array.from(files).map(async (file) => {
            try {
                const content = await file.text();
                return {
                    name: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size,
                    content,
                    status: 'success'
                };
            } catch (error) {
                console.error(`Failed to read file "${file.name}":`, error);
                return { name: file.name, status: 'error' };
            }
        });

        const results = await Promise.all(loadPromises);
        
        const loadedFiles = results.filter(r => r.status === 'success') as LoadedFile[];
        const failedFiles = results.filter(r => r.status === 'error').map(r => r.name);

        if (loadedFiles.length > 0) {
            processActions.handleLoadedFilesChange(loadedFiles, 'add');
            setPromptChangedByFileLoad(true);
        }

        if (failedFiles.length > 0) {
            // This message is important and should overwrite any success message from handleLoadedFilesChange
            processActions.updateProcessState({ 
                statusMessage: `Warning: Could not read ${failedFiles.length} file(s): ${failedFiles.join(', ')}. They might be binary files.`
            });
        }
    }
  };

  const handleReset = async () => {
    await processActions.handleReset(
      geminiService.CREATIVE_DEFAULTS,
      planTemplates.savedPlanTemplates
    );
    modelParams.resetModelParametersToDefaults(geminiService.CREATIVE_DEFAULTS);
  };
  
  const handleRewind = (version: Version) => {
    const { product } = reconstructProduct(version, processState.iterationHistory, processState.initialPrompt);
    const newChunks = splitToChunks(product);
    processActions.updateProcessState({
        currentProduct: product,
        documentChunks: newChunks,
        currentMajorVersion: version.major,
        currentMinorVersion: version.minor || 0,
        finalProduct: null,
        statusMessage: `Rewound to version ${formatVersion(version)}`,
    });
  };

  const handleExportIterationMarkdown = (version: Version) => {
    const logEntry = processState.iterationHistory.find(
      (e) =>
        e.majorVersion === version.major &&
        e.minorVersion === version.minor &&
        (version.patch === undefined || e.patchVersion === version.patch)
    );

    if (!logEntry) {
      processActions.updateProcessState({ statusMessage: `Could not find log entry for version ${formatVersion(version)}` });
      return;
    }

    const { product } = reconstructProduct(version, processState.iterationHistory, processState.initialPrompt);
    const generationTimestamp = new Date(logEntry.timestamp).toISOString();
    const versionString = formatVersion(version);
    
    let yamlFrontmatter = `---
export_type: ITERATION_SNAPSHOT
generation_timestamp: ${generationTimestamp}
project_name: ${toYamlStringLiteral(processState.projectName || "Untitled Project")}
project_codename: ${toYamlStringLiteral(processState.projectCodename || "none")}
iteration_version: ${versionString}
iteration_status: ${toYamlStringLiteral(logEntry.status)}
`;

    if (logEntry.modelConfigUsed) {
      const modelDisplayName = SELECTABLE_MODELS.find(m => m.name === logEntry.currentModelForIteration)?.displayName || logEntry.currentModelForIteration || "N/A";
      yamlFrontmatter += `model_configuration_used:
  model_name: '${modelDisplayName}'
  temperature: ${logEntry.modelConfigUsed.temperature.toFixed(2)}
  top_p: ${logEntry.modelConfigUsed.topP.toFixed(2)}
  top_k: ${logEntry.modelConfigUsed.topK}
`;
    } else {
      yamlFrontmatter += `model_configuration_used: N/A\n`;
    }
    yamlFrontmatter += `---\n\n`;

    const markdownContent = yamlFrontmatter + product;
    const fileName = generateFileName("snapshot", "md", {
      projectCodename: processState.projectCodename,
      projectName: processState.projectName,
      contentForSlug: product,
      versionString: versionString,
    });
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const saveManualEdits = useCallback(async () => {
    const { editedProductBuffer, currentProduct, currentMajorVersion, currentMinorVersion } = processState;
    if (editedProductBuffer === null || editedProductBuffer === currentProduct) {
        processActions.updateProcessState({ isEditingCurrentProduct: false }); // Just cancel if no changes
        return;
    }
    const newMinorVersion = currentMinorVersion + 1;
    const newVersion = { major: currentMajorVersion, minor: newMinorVersion };
    
    processActions.addLogEntry({
        majorVersion: newVersion.major,
        minorVersion: newVersion.minor,
        entryType: 'manual_edit',
        currentFullProduct: editedProductBuffer,
        previousFullProduct: currentProduct,
        status: 'Manual Edit Applied',
        versionRationale: 'User manually edited the product content.',
        fileProcessingInfo: { filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0 },
    });
    
    processActions.updateProcessState({
        currentProduct: editedProductBuffer,
        documentChunks: splitToChunks(editedProductBuffer),
        currentMinorVersion: newMinorVersion,
        isEditingCurrentProduct: false,
        editedProductBuffer: null,
        statusMessage: `Saved manual edit as version ${formatVersion(newVersion)}`,
    });
    
  }, [processState, processActions]);

  const openDiffViewer = useCallback((version: Version) => {
    const history = processState.iterationHistory;
    const basePrompt = processState.initialPrompt;
    
    const { product: newText } = reconstructProduct(version, history, basePrompt);

    const currentEntryIndex = history.findIndex(e => e.majorVersion === version.major && e.minorVersion === version.minor && (version.patch === undefined || e.patchVersion === version.patch));
    
    let oldText = "";
    if (currentEntryIndex > 0) {
        const previousEntry = history[currentEntryIndex - 1];
        const prevVersion = { major: previousEntry.majorVersion, minor: previousEntry.minorVersion, patch: previousEntry.patchVersion };
        const { product } = reconstructProduct(prevVersion, history, basePrompt);
        oldText = product;
    } else if (currentEntryIndex === 0) {
        // The first entry is compared against an empty string or the initial prompt
        oldText = "";
    }

    processActions.updateProcessState({
        isDiffViewerOpen: true,
        diffViewerContent: { oldText, newText, version: formatVersion(version) }
    });
  }, [processState.iterationHistory, processState.initialPrompt, processActions]);

  const closeDiffViewer = useCallback(() => {
    processActions.updateProcessState({ isDiffViewerOpen: false, diffViewerContent: null });
  }, [processActions]);


  const engineValue: EngineContextType = {
    app: {
      apiKeyStatus: processState.apiKeyStatus,
      isApiRateLimited: processState.isApiRateLimited,
      rateLimitCooldownActiveSeconds: processState.rateLimitCooldownActiveSeconds,
      staticAiModelDetails,
      onSelectedModelChange,
      onFilesSelectedForImport,
      projectName: processState.projectName,
    },
    process: {
      ...processState,
      ...iterativeLogic,
      updateProcessState: processActions.updateProcessState,
      handleLoadedFilesChange: processActions.handleLoadedFilesChange,
      handleReset,
      handleRewind,
      handleExportIterationMarkdown,
      reconstructProductCallback: (targetVersion, history, basePrompt) => reconstructProduct(targetVersion, history, basePrompt),
      handleInitialPromptChange: processActions.handleInitialPromptChange,
      addDevLogEntry: processActions.addDevLogEntry,
      updateDevLogEntry: processActions.updateDevLogEntry,
      deleteDevLogEntry: processActions.deleteDevLogEntry,
      saveManualEdits,
      openDiffViewer,
      closeDiffViewer,
    },
    modelConfig: {
      ...modelParams,
      maxIterations: processState.maxMajorVersions,
      onMaxIterationsChange
    },
    plan: {
      ...planTemplates,
      isPlanActive: processState.isPlanActive,
      planStages: processState.planStages,
      onIsPlanActiveChange,
      onPlanStagesChange,
      onLoadPlanTemplate,
    },
    projectIO,
    autoSave,
  };

  return (
    <EngineContext.Provider value={engineValue}>
      {children}
    </EngineContext.Provider>
  );
};