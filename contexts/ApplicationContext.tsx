

import React, { createContext, useContext, useCallback, useState, useEffect, useMemo, ReactNode } from 'react';
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
import { getAiModelDetails } from '../services/geminiService.ts';
import { inferProjectNameFromInput } from '../services/projectUtils.ts';
import { generateFileName } from '../services/utils.ts';
import { reconstructProduct } from '../services/diffService.ts';
import { formatVersion, compareVersions } from '../services/versionUtils.ts';
import { splitToChunks } from '../services/chunkingService.ts';

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

  const handleReset = useCallback(async () => {
    await autoSave.handleClearAutoSaveAndDismiss();
    const baseTemplates = planTemplates.savedPlanTemplates;
    await processActions.handleReset(geminiService.CREATIVE_DEFAULTS, baseTemplates);
    modelParams.resetModelParametersToDefaults();
  }, [autoSave, planTemplates.savedPlanTemplates, processActions, modelParams]);

  const handleRewind = useCallback((version: Version) => {
    const { product } = reconstructProduct(version, processState.iterationHistory, processState.initialPrompt);
    const newChunks = splitToChunks(product);
    processActions.updateProcessState({
        currentProduct: product,
        documentChunks: newChunks,
        currentMajorVersion: version.major,
        currentMinorVersion: version.minor,
        finalProduct: null,
        isEditingCurrentProduct: false,
        editedProductBuffer: null,
    });
  }, [processState.iterationHistory, processState.initialPrompt, processActions]);

  const handleExportIterationMarkdown = useCallback((version: Version) => {
    const { product } = reconstructProduct(version, processState.iterationHistory, processState.initialPrompt);
    const versionString = formatVersion(version);
    const fileName = generateFileName("product", "md", {
      projectCodename: processState.projectCodename,
      projectName: processState.projectName,
      contentForSlug: product,
      versionString: versionString,
    });
    const blob = new Blob([product], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [processState.iterationHistory, processState.initialPrompt, processState.projectCodename, processState.projectName]);

  const saveManualEdits = useCallback(async () => {
    const { editedProductBuffer, currentProduct, currentMajorVersion, currentMinorVersion } = processState;
    if (editedProductBuffer === null || typeof editedProductBuffer === 'undefined') return;
  
    processActions.addLogEntry({
      majorVersion: currentMajorVersion,
      minorVersion: currentMinorVersion + 1,
      entryType: 'manual_edit',
      currentFullProduct: editedProductBuffer,
      previousFullProduct: currentProduct,
      status: 'Manual Edit Applied',
      fileProcessingInfo: { numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0, filesSentToApiIteration: null },
    });
  
    const newChunks = splitToChunks(editedProductBuffer);
    processActions.updateProcessState({
      currentProduct: editedProductBuffer,
      documentChunks: newChunks,
      currentMinorVersion: currentMinorVersion + 1,
      isEditingCurrentProduct: false,
      editedProductBuffer: null,
    });
    await autoSave.performAutoSave();
  }, [processState, processActions, autoSave]);

  const openDiffViewer = useCallback((version: Version) => {
    const history = processState.iterationHistory;
    const sortedHistory = [...history].sort(compareVersions);
    const currentIndex = sortedHistory.findIndex(e => formatVersion(e) === formatVersion(version));

    const oldText = currentIndex > 0
      ? reconstructProduct(sortedHistory[currentIndex - 1], history, processState.initialPrompt).product
      : "";
    const newText = reconstructProduct(version, history, processState.initialPrompt).product;

    processActions.updateProcessState({
      isDiffViewerOpen: true,
      diffViewerContent: {
        oldText,
        newText,
        version: formatVersion(version),
      },
    });
  }, [processState.iterationHistory, processState.initialPrompt, processActions]);

  const closeDiffViewer = useCallback(() => {
    processActions.updateProcessState({ isDiffViewerOpen: false, diffViewerContent: null });
  }, [processActions]);

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
          const text = e.target?.result;
          if (typeof text !== 'string') throw new Error("File content is not a string");
          const projectData: AutologosProjectFile = JSON.parse(text);
          projectIO.handleImportProjectData(projectData);
        } catch (err) {
          const error = err as Error;
          console.error("Failed to parse project file:", error);
          alert(`Error parsing project file: ${error.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      const loadedFiles: LoadedFile[] = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          content: await file.text(),
          size: file.size,
        }))
      );
      processActions.handleLoadedFilesChange(loadedFiles, 'add');
      setPromptChangedByFileLoad(true);
    }
  };

  const value: EngineContextType = useMemo(() => ({
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
      reconstructProductCallback: reconstructProduct,
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
      onMaxIterationsChange,
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
  }), [
    processState,
    staticAiModelDetails,
    onSelectedModelChange,
    onFilesSelectedForImport,
    iterativeLogic,
    processActions,
    handleReset,
    handleRewind,
    handleExportIterationMarkdown,
    saveManualEdits,
    openDiffViewer,
    closeDiffViewer,
    modelParams,
    onMaxIterationsChange,
    planTemplates,
    onIsPlanActiveChange,
    onPlanStagesChange,
    onLoadPlanTemplate,
    projectIO,
    autoSave,
  ]);
  
  return (
    <EngineContext.Provider value={value}>
      {children}
    </EngineContext.Provider>
  );
};