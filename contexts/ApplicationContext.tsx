

import React, { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react';
import type { ProcessState, ModelConfig, SettingsSuggestionSource, StaticAiModelDetails, SelectableModelName, AutologosProjectFile, PlanTemplate, IterationLogEntry, Version, PlanStage, LoadedFile } from '../types/index.ts';
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
import { generateFileName } from '../services/utils.ts';
import { reconstructProduct } from '../services/diffService.ts';
import { formatVersion } from '../services/versionUtils.ts';

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
    handleAcceptStrategy: ReturnType<typeof useIterativeLogic>['handleAcceptStrategy'];
    handleIgnoreStrategy: ReturnType<typeof useIterativeLogic>['handleIgnoreStrategy'];
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

  const autoSave = useAutoSave(processState, modelParams, processActions.updateProcessState, planTemplates.overwriteUserTemplates, createInitialProcessState(processState.apiKeyStatus, processState.selectedModelName), modelParams, modelParams.setUserManuallyAdjustedSettings);
  
  const projectIO = useProjectIO(
    processState, 
    modelParams, 
    processActions.updateProcessState, 
    planTemplates.overwriteUserTemplates,
    createInitialProcessState(processState.apiKeyStatus, processState.selectedModelName),
    modelParams,
    (params) => {
        modelParams.handleTemperatureChange(params.temperature);
        modelParams.handleTopPChange(params.topP);
        modelParams.handleTopKChange(params.topK);
        modelParams.setUserManuallyAdjustedSettings(params.userManuallyAdjustedSettings);
    }
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
        const loadedFiles: LoadedFile[] = await Promise.all(Array.from(files).map(async (file) => ({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            content: await file.text()
        })));
        processActions.handleLoadedFilesChange(loadedFiles, 'add');
        setPromptChangedByFileLoad(true);
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
    processActions.updateProcessState({
        currentProduct: product,
        currentMajorVersion: version.major,
        currentMinorVersion: version.minor,
        finalProduct: null,
        statusMessage: `Rewound to version ${formatVersion(version)}`,
    });
  };

  const handleExportIterationMarkdown = (version: Version) => {
    const { product } = reconstructProduct(version, processState.iterationHistory, processState.initialPrompt);
    const fileName = generateFileName(processState.projectName, `product_v${formatVersion(version)}`, "md");
    const blob = new Blob([product], { type: 'text/markdown;charset=utf-t' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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