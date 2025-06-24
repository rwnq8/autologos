

import React, { useEffect, useCallback, useRef, useState } from 'react';
import type { StaticAiModelDetails, IterationLogEntry, PlanTemplate, ModelConfig, LoadedFile, PlanStage, SettingsSuggestionSource, ReconstructedProductResult, SelectableModelName, ProcessState, CommonControlProps, AutologosProjectFile } from './types.ts';
import { SELECTABLE_MODELS, AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION } from './types.ts';
import * as GeminaiService from './services/geminiService';
import { DEFAULT_PROJECT_NAME_FALLBACK, INITIAL_PROJECT_NAME_STATE, generateFileName } from './services/utils';
import Controls from './components/Controls';
import DisplayArea from './components/DisplayArea';
import { usePlanTemplates } from './hooks/usePlanTemplates';
import { useProcessState, createInitialProcessState } from './hooks/useProcessState';
import { useModelParameters } from './hooks/useModelParameters';
import { useIterativeLogic } from './hooks/useIterativeLogic';
import { useProjectIO } from './hooks/useProjectIO';
import { useAutoSave } from './hooks/useAutoSave';
import { reconstructProduct } from './services/diffService';
import { inferProjectNameFromInput } from './services/projectUtils';
import { useDebounce } from './hooks/useDebounce';

import { ApplicationProvider, type ApplicationContextType } from './contexts/ApplicationContext';
import type { AddLogEntryType, ProcessContextType } from './contexts/ProcessContext';
import { ProcessProvider } from './contexts/ProcessContext';
import { ModelConfigProvider, type ModelConfigContextType } from './contexts/ModelConfigContext';
import { PlanProvider, type PlanContextType } from './contexts/PlanContext';
import ErrorBoundary from './components/shared/ErrorBoundary';


const App: React.FC = () => {
  const { state: processState, updateProcessState, handleLoadedFilesChange, addLogEntry: addLogEntryFromHook, handleReset: processStateResetHook, handleInitialPromptChange } = useProcessState();
  const { savedPlanTemplates, handleSavePlanAsTemplate, handleDeletePlanTemplate, planTemplateStatusMessage, clearPlanTemplateStatusMessage, loadUserTemplates, overwriteUserTemplates } = usePlanTemplates();

  const debouncedLoadedFilesCount = useDebounce(processState.loadedFiles.length, 750);
  const debouncedInitialPromptText = useDebounce(processState.initialPrompt, 750);


  const processStateRef = useRef(processState);
  useEffect(() => {
    processStateRef.current = processState;
  }, [processState]);

  const appInitialModelParams = {
      temperature: GeminaiService.CREATIVE_DEFAULTS.temperature,
      topP: GeminaiService.CREATIVE_DEFAULTS.topP,
      topK: GeminaiService.CREATIVE_DEFAULTS.topK,
      settingsSuggestionSource: 'mode' as SettingsSuggestionSource,
      userManuallyAdjustedSettings: false,
  };

  const modelParamsRef = useRef(appInitialModelParams);

  const {
    temperature, topP, topK, settingsSuggestionSource, userManuallyAdjustedSettings,
    modelConfigRationales, modelParameterAdvice, modelConfigWarnings,
    handleTemperatureChange, handleTopPChange, handleTopKChange,
    getUserSetBaseConfig,
    resetModelParametersToDefaults, setUserManuallyAdjustedSettings
  } = useModelParameters(
    debouncedInitialPromptText,
    debouncedLoadedFilesCount,
    processState.isPlanActive,
    processState.promptChangedByFileLoad,
    () => updateProcessState({ promptChangedByFileLoad: false }),
    appInitialModelParams.temperature,
    appInitialModelParams.topP,
    appInitialModelParams.topK,
  );

  const maxIterationsForContext = processState.maxIterations;
  const onMaxIterationsChangeForContext = (value: number) => updateProcessState({ maxIterations: value });


  useEffect(() => {
    modelParamsRef.current = {temperature, topP, topK, settingsSuggestionSource, userManuallyAdjustedSettings};
  }, [temperature, topP, topK, settingsSuggestionSource, userManuallyAdjustedSettings]);

  const setLoadedModelParametersCallback = useCallback((params: {
    temperature: number;
    topP: number;
    topK: number;
    settingsSuggestionSource: SettingsSuggestionSource;
    userManuallyAdjustedSettings: boolean;
  }) => {
    handleTemperatureChange(params.temperature);
    handleTopPChange(params.topP);
    handleTopKChange(params.topK);
    setUserManuallyAdjustedSettings(params.userManuallyAdjustedSettings);
  }, [handleTemperatureChange, handleTopPChange, handleTopKChange, setUserManuallyAdjustedSettings]);

  const [isApiRateLimitedLocal, setIsApiRateLimitedLocal] = useState(processState.isApiRateLimited || false);
  const [rateLimitCooldownActiveSecondsLocal, setRateLimitCooldownActiveSecondsLocal] = useState(processState.rateLimitCooldownActiveSeconds || 0);
  const cooldownTimerRef = useRef<number | null>(null);
  const rateLimitCooldownDuration = 60;

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setIsApiRateLimitedLocal(processState.isApiRateLimited || false);
    setRateLimitCooldownActiveSecondsLocal(processState.rateLimitCooldownActiveSeconds || 0);
    if (!(processState.isApiRateLimited || false)) {
        clearCooldownTimer();
    }
  }, [processState.isApiRateLimited, processState.rateLimitCooldownActiveSeconds, clearCooldownTimer]);

  const handleRateLimitErrorEncountered = useCallback(() => {
    clearCooldownTimer();
    updateProcessState({ isApiRateLimited: true, rateLimitCooldownActiveSeconds: rateLimitCooldownDuration });
    setIsApiRateLimitedLocal(true);
    setRateLimitCooldownActiveSecondsLocal(rateLimitCooldownDuration);

    cooldownTimerRef.current = window.setInterval(() => { 
      setRateLimitCooldownActiveSecondsLocal(prev => {
        const newTime = prev - 1;
        updateProcessState({ rateLimitCooldownActiveSeconds: newTime });
        if (newTime <= 0) {
          clearCooldownTimer();
          updateProcessState({ isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0 });
          setIsApiRateLimitedLocal(false);
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [clearCooldownTimer, updateProcessState, rateLimitCooldownDuration]);

  useEffect(() => {
    return () => clearCooldownTimer();
  }, [clearCooldownTimer]);

  const autoSaveHook = useAutoSave(
    processStateRef, modelParamsRef, updateProcessState, overwriteUserTemplates,
    createInitialProcessState(GeminaiService.isApiKeyAvailable() ? 'loaded' : 'missing', GeminaiService.DEFAULT_MODEL_NAME),
    appInitialModelParams, setLoadedModelParametersCallback
  );
  const { performAutoSave } = autoSaveHook;

  const addLogEntryForContext: AddLogEntryType = addLogEntryFromHook as any;

  const iterativeLogicInstance = useIterativeLogic(
    processState, updateProcessState, addLogEntryForContext,
    getUserSetBaseConfig, 
    performAutoSave,
    handleRateLimitErrorEncountered
  );

  const projectIO = useProjectIO(
    processStateRef, modelParamsRef, updateProcessState, overwriteUserTemplates,
    createInitialProcessState(GeminaiService.isApiKeyAvailable() ? 'loaded' : 'missing', GeminaiService.DEFAULT_MODEL_NAME),
    appInitialModelParams, setLoadedModelParametersCallback
  );

  const [currentModelUIDetails, setCurrentModelUIDetails] = useState<StaticAiModelDetails | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUserTemplates();
  }, [loadUserTemplates]);

  useEffect(() => {
    setCurrentModelUIDetails(GeminaiService.getAiModelDetails(processState.selectedModelName || GeminaiService.DEFAULT_MODEL_NAME));
  }, [processState.selectedModelName]);


  useEffect(() => {
    if (processState.isProcessing) return;
    const shouldInfer = (processState.projectName === INITIAL_PROJECT_NAME_STATE) ||
                       (processState.loadedFiles.length === 0 && processState.projectName !== DEFAULT_PROJECT_NAME_FALLBACK && processState.projectName !== INITIAL_PROJECT_NAME_STATE);

    if (shouldInfer || (processState.loadedFiles.length > 0 && processState.projectName === INITIAL_PROJECT_NAME_STATE)) {
      const newInferredName = inferProjectNameFromInput(processState.initialPrompt, processState.loadedFiles);
      updateProcessState({ projectName: newInferredName || (processState.loadedFiles.length === 0 ? INITIAL_PROJECT_NAME_STATE : DEFAULT_PROJECT_NAME_FALLBACK) });
    }
  }, [processState.initialPrompt, processState.loadedFiles, processState.isProcessing, processState.projectName, updateProcessState]);

  const handleResetApp = useCallback(async () => {
    const baseConfigForReset = GeminaiService.CREATIVE_DEFAULTS; 
    await processStateResetHook(
        baseConfigForReset, 
        savedPlanTemplates 
    );
    resetModelParametersToDefaults(baseConfigForReset); 
    if (autoSaveHook.showRestorePrompt) {
        await autoSaveHook.handleClearAutoSaveAndDismiss();
    }
    updateProcessState({
        promptChangedByFileLoad: false,
        selectedModelName: GeminaiService.DEFAULT_MODEL_NAME,
        currentModelForIteration: GeminaiService.DEFAULT_MODEL_NAME,
        currentAppliedModelConfig: baseConfigForReset, 
    });
    clearCooldownTimer();
    setIsApiRateLimitedLocal(false);
    setRateLimitCooldownActiveSecondsLocal(0);
  }, [processStateResetHook, resetModelParametersToDefaults, savedPlanTemplates, autoSaveHook.showRestorePrompt, autoSaveHook.handleClearAutoSaveAndDismiss, updateProcessState, clearCooldownTimer]);


  const handleRewind = useCallback(async (iterationNumber: number) => {
    if (processState.isProcessing) {
      updateProcessState({ statusMessage: "Cannot rewind while processing." }); return;
    }
    const targetHistory = processState.iterationHistory.filter(entry => entry.iteration <= iterationNumber);
    if (targetHistory.length === 0 && iterationNumber !== 0) {
      updateProcessState({ statusMessage: `No history found for iteration ${iterationNumber} to rewind to.` }); return;
    }
    const { product: reconstructedProductValue, error: reconstructionError } = reconstructProduct(iterationNumber, targetHistory, processState.initialPrompt);
    if (reconstructionError) {
      updateProcessState({ statusMessage: `Error rewinding to iteration ${iterationNumber}: ${reconstructionError}` }); return;
    }

    const targetLogEntry = targetHistory.find(entry => entry.iteration === iterationNumber);
    const modelForRewind = targetLogEntry?.currentModelForIteration || processState.selectedModelName;
    const configForRewind = targetLogEntry?.modelConfigUsed || getUserSetBaseConfig();

    updateProcessState({
      currentProduct: reconstructedProductValue, iterationHistory: targetHistory, currentIteration: iterationNumber,
      finalProduct: null, isProcessing: false, currentPlanStageIndex: null, currentStageIteration: 0,
      statusMessage: `Rewound to Iteration ${iterationNumber}. Resume or start new process.`,
      isApiRateLimited: false, rateLimitCooldownActiveSeconds: 0,
      currentModelForIteration: modelForRewind,
      currentAppliedModelConfig: configForRewind,
      stagnationInfo: { isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined, nudgeStrategyApplied: 'none' } 
    });
    if (configForRewind) {
        setLoadedModelParametersCallback({
            temperature: configForRewind.temperature,
            topP: configForRewind.topP,
            topK: configForRewind.topK,
            settingsSuggestionSource: 'manual',
            userManuallyAdjustedSettings: true,
        });
    }

    clearCooldownTimer();
    await performAutoSave();
  }, [processState.isProcessing, processState.iterationHistory, processState.initialPrompt, processState.selectedModelName, updateProcessState, performAutoSave, clearCooldownTimer, getUserSetBaseConfig, setLoadedModelParametersCallback]);

  const handleExportIterationMarkdown = useCallback((iterationNumber: number) => {
    const logEntry = processState.iterationHistory.find(entry => entry.iteration === iterationNumber);
    if (!logEntry) { updateProcessState({ statusMessage: `Log entry for iter ${iterationNumber} not found.` }); return; }
    const { product: reconstructedProductValue, error: reconstructionError } = reconstructProduct(iterationNumber, processState.iterationHistory, processState.initialPrompt);
    if (reconstructionError) { updateProcessState({ statusMessage: `Error reconstructing product for iter ${iterationNumber} export: ${reconstructionError}` }); return; }
    const fileName = generateFileName(processState.projectName, "iter_snapshot", "md", iterationNumber);
    const blob = new Blob([`---\niteration: ${iterationNumber}\n---\n\n${reconstructedProductValue}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    updateProcessState({ statusMessage: `Exported Markdown for Iteration ${iterationNumber}.` });
  }, [processState.iterationHistory, processState.initialPrompt, processState.projectName, updateProcessState]);

  const handleSelectedModelChange = (modelName: SelectableModelName) => {
    updateProcessState({ selectedModelName: modelName });
    setIsModelDropdownOpen(false);
  };

  const onFilesSelectedForImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    updateProcessState({ statusMessage: `Processing ${files.length} file(s)...` });
    try {
      const loadedFilesArray: LoadedFile[] = [];
      const filePromises = Array.from(files).map(async (file) => {
        const fileNameLower = file.name.toLowerCase();

        if (files.length === 1 && fileNameLower.endsWith('.autologos.json')) {
            const fileContent = await file.text();
            try {
                const parsedJson = JSON.parse(fileContent);
                if (parsedJson.header && parsedJson.header.fileFormatVersion === AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION) {
                    projectIO.handleImportProjectData(parsedJson as AutologosProjectFile);
                    return null; 
                }
            } catch (e) { /* Fall through */ }
        }

        if (fileNameLower.endsWith('.json')) {
          const fileContent = await file.text();
          try {
            const parsedJson = JSON.parse(fileContent);
            if (Array.isArray(parsedJson) && parsedJson.length > 0 && 'iteration' in parsedJson[0] && 'productSummary' in parsedJson[0] && 'timestamp' in parsedJson[0]) {
              projectIO.handleImportIterationLogData(parsedJson as IterationLogEntry[], file.name);
              return null; // Indicate this file was handled as a log import
            }
          } catch(e) { /* Fall through */ }
        }

        if (file.type.startsWith("image/") || file.type === "application/pdf" || !file.type.startsWith("text/")) {
          return new Promise<LoadedFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e_reader) => {
              const dataUrl = e_reader.target?.result as string;
              const base64Data = dataUrl.substring(dataUrl.indexOf(',') + 1);
              resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', base64Data, size: file.size });
            };
            reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
            reader.readAsDataURL(file);
          });
        } else {
          const fileContent = await file.text();
          const base64Data = btoa(unescape(encodeURIComponent(fileContent)));
          return { name: file.name, mimeType: file.type || 'text/plain', base64Data, size: file.size };
        }
      });

      const results = await Promise.all(filePromises);
      const newValidLoadedFiles = results.filter(result => result !== null) as LoadedFile[];

      if (newValidLoadedFiles.length > 0) {
        handleLoadedFilesChange(newValidLoadedFiles, 'add'); // Explicitly 'add'
      } else if (files.length === 1 && results[0] === null) {
        // Project file or log file loaded and handled
      } else {
         updateProcessState({ statusMessage: "No new data files were added."});
      }

    } catch (error: any) {
      console.error("Error importing/loading files:", error);
      updateProcessState({ statusMessage: `Error processing files: ${error.message}` });
    }
  };

  const handleExportPortableDiffs = useCallback(() => {
    updateProcessState({ statusMessage: "Exporting portable diffs has been removed. Download the main log file (.json) for iteration diffs."});
  }, [updateProcessState]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) setIsModelDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applicationContextValue: ApplicationContextType = {
    apiKeyStatus: processState.apiKeyStatus, selectedModelName: processState.selectedModelName,
    projectName: processState.projectName, projectId: processState.projectId,
    isApiRateLimited: isApiRateLimitedLocal, rateLimitCooldownActiveSeconds: rateLimitCooldownActiveSecondsLocal,
    updateProcessState: updateProcessState as any, // Cast for broader partial updates from this context
    handleImportProjectData: projectIO.handleImportProjectData,
    handleImportIterationLogData: projectIO.handleImportIterationLogData,
    handleExportProject: projectIO.handleExportProject,
    handleExportPortableDiffs,
    handleRateLimitErrorEncountered,
    staticAiModelDetails: currentModelUIDetails, onSelectedModelChange: handleSelectedModelChange,
    onFilesSelectedForImport,
  };

  const processContextValue: ProcessContextType = {
    ...processState,
    updateProcessState: updateProcessState as any,
    handleLoadedFilesChange,
    handleInitialPromptChange,
    addLogEntry: addLogEntryForContext, handleResetApp,
    handleStartProcess: iterativeLogicInstance.handleStart, handleHaltProcess: iterativeLogicInstance.handleHalt,
    handleRewind, handleExportIterationMarkdown,
    reconstructProductCallback: (iter: number, hist: IterationLogEntry[], base: string) => reconstructProduct(iter, hist, base),
  };

  const modelConfigContextValue: ModelConfigContextType = {
    temperature, topP, topK, maxIterations: maxIterationsForContext, settingsSuggestionSource, userManuallyAdjustedSettings,
    modelConfigRationales, modelParameterAdvice, modelConfigWarnings,
    handleTemperatureChange, handleTopPChange, handleTopKChange, onMaxIterationsChange: onMaxIterationsChangeForContext,
    setUserManuallyAdjustedSettings,
  };

  const planContextValue: PlanContextType = {
    isPlanActive: processState.isPlanActive, planStages: processState.planStages,
    currentPlanStageIndex: processState.currentPlanStageIndex, currentStageIteration: processState.currentStageIteration,
    savedPlanTemplates, planTemplateStatus: planTemplateStatusMessage,
    updateProcessState: updateProcessState as any,
    onIsPlanActiveChange: (isActive: boolean) => updateProcessState({ isPlanActive: isActive }),
    onPlanStagesChange: (stages: PlanStage[]) => updateProcessState({ planStages: stages }),
    handleSavePlanAsTemplate, handleDeletePlanTemplate, clearPlanTemplateStatus: clearPlanTemplateStatusMessage,
    onLoadPlanTemplate: (template: PlanTemplate) => {
      updateProcessState({ planStages: template.stages.map(s => ({...s, id: `stage_${Date.now()}_${Math.random().toString(36).substring(2,7)}`})), isPlanActive: true, currentPlanStageIndex:0, currentStageIteration:0 });
      if(planTemplateStatusMessage) clearPlanTemplateStatusMessage();
    },
  };

  const commonControlProps: CommonControlProps = {
    commonInputClasses: "w-full p-3 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 placeholder-slate-500 dark:placeholder-slate-400 text-slate-700 dark:text-slate-100",
    commonSelectClasses: "w-full p-2.5 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-slate-700 dark:text-slate-100 text-sm",
    commonCheckboxLabelClasses: "flex items-center text-sm text-primary-600 dark:text-primary-400",
    commonCheckboxInputClasses: "h-4 w-4 text-primary-600 border-slate-300 dark:border-white/20 rounded focus:ring-primary-500 dark:bg-white/10 dark:checked:bg-primary-500 dark:focus:ring-offset-black/50",
    commonButtonClasses: "flex-1 inline-flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-white/20 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  };


  return (
    <ApplicationProvider value={applicationContextValue}>
      <ProcessProvider value={processContextValue}>
        <ModelConfigProvider value={modelConfigContextValue}>
          <PlanProvider value={planContextValue}>
            <ErrorBoundary>
              <div className="min-h-screen bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col">
                <header className="bg-slate-800 dark:bg-black/50 text-white p-4 shadow-md flex justify-between items-center">
                  <h1 className="text-2xl font-semibold text-primary-300">Autologos Iterative Engine</h1>
                  <div className="flex items-center text-xs text-slate-400">
                    <span className="mr-2">Model Pref:</span>
                    <div className="relative" ref={modelDropdownRef}>
                      <button
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className="flex items-center px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        aria-haspopup="true"
                        aria-expanded={isModelDropdownOpen}
                        disabled={processState.isProcessing || isApiRateLimitedLocal}
                      >
                        {SELECTABLE_MODELS.find(m => m.name === processState.selectedModelName)?.displayName || processState.selectedModelName || 'Select Model'}
                        <span className="ml-1.5 text-xs">{isModelDropdownOpen ? '▲' : '▼'}</span>
                      </button>
                      {isModelDropdownOpen && (
                        <div className="absolute right-0 mt-1.5 w-80 bg-slate-700 rounded-md shadow-lg z-20 border border-slate-600 max-h-96 overflow-y-auto">
                          {SELECTABLE_MODELS.map((model) => (
                            <button
                              key={model.name}
                              onClick={() => handleSelectedModelChange(model.name)}
                              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-600
                                          ${processState.selectedModelName === model.name ? 'text-primary-300 font-semibold' : 'text-slate-300'}`}
                            >
                              {model.displayName} {processState.selectedModelName === model.name ? ' (Current Pref.)' : ''}
                              <span className="block text-xxs text-slate-400">{model.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {autoSaveHook.autoSaveStatus !== 'idle' && autoSaveHook.autoSaveStatus !== 'found_autosave' && autoSaveHook.autoSaveStatus !== 'cleared' && (
                      <span className={`ml-3 px-2 py-0.5 rounded-full text-xs
                          ${autoSaveHook.autoSaveStatus === 'saving' ? 'bg-blue-500/70 text-white' : ''}
                          ${autoSaveHook.autoSaveStatus === 'saved' ? 'bg-green-500/70 text-white' : ''}
                          ${autoSaveHook.autoSaveStatus === 'error' ? 'bg-red-500/70 text-white' : ''}
                          ${autoSaveHook.autoSaveStatus === 'loaded' ? 'bg-teal-500/70 text-white' : ''}
                          ${autoSaveHook.autoSaveStatus === 'not_found' ? 'bg-slate-500/70 text-white' : ''}
                      `}>
                          Autosave: {autoSaveHook.autoSaveStatus.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </header>

                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                  <aside className="w-full md:w-[420px] lg:w-[480px] h-auto md:h-full md:overflow-y-auto bg-white/70 dark:bg-slate-800/70 p-0 border-r border-slate-300 dark:border-white/10 shadow-lg flex-shrink-0">
                    <ErrorBoundary>
                      <Controls commonControlProps={commonControlProps} />
                    </ErrorBoundary>
                  </aside>
                  <main className="flex-grow h-auto md:h-full md:overflow-y-auto bg-slate-100/50 dark:bg-slate-900/50">
                    <ErrorBoundary>
                      <DisplayArea />
                    </ErrorBoundary>
                  </main>
                </div>

                {autoSaveHook.showRestorePrompt && autoSaveHook.restorableStateInfo && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="restore-dialog-title">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-primary-500/50">
                      <h2 id="restore-dialog-title" className="text-lg font-semibold text-primary-600 dark:text-primary-300 mb-3">Autosaved Session Found</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Project: <strong>{autoSaveHook.restorableStateInfo.projectName || DEFAULT_PROJECT_NAME_FALLBACK}</strong></p>
                      {autoSaveHook.restorableStateInfo.lastAutoSavedAt && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Saved: {new Date(autoSaveHook.restorableStateInfo.lastAutoSavedAt).toLocaleString()}</p>}
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Do you want to restore this session?</p>
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={autoSaveHook.handleClearAutoSaveAndDismiss}
                          className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                          Dismiss & Clear
                        </button>
                        <button
                          onClick={autoSaveHook.handleRestoreAutoSave}
                          className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                        >
                          Restore Session
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </PlanProvider>
        </ModelConfigProvider>
      </ProcessProvider>
    </ApplicationProvider>
  );
};
export default App;
export type { ReconstructedProductResult };