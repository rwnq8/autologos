import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import type { StaticAiModelDetails, IterationLogEntry, PlanTemplate, ModelConfig, LoadedFile, PlanStage, SettingsSuggestionSource, ReconstructedProductResult, SelectableModelName, ProcessState, CommonControlProps, AutologosProjectFile, IterationEntryType, DevLogEntry, Version } from './types.ts';
import { SELECTABLE_MODELS, AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION, THIS_APP_ID } from './types.ts';
import * as GeminaiService from './services/geminiService.ts';
import { generateFileName, INITIAL_PROJECT_NAME_STATE } from './services/utils.ts';
import Controls from './components/Controls.tsx';
import DisplayArea from './components/DisplayArea.tsx';
import TargetedRefinementModal from './components/modals/TargetedRefinementModal.tsx';
import { usePlanTemplates } from './hooks/usePlanTemplates.ts';
import { useProcessState, createInitialProcessState, AddLogEntryParams } from './hooks/useProcessState.ts';
import { useModelParameters } from './hooks/useModelParameters.ts';
import { useIterativeLogic } from './hooks/useIterativeLogic.ts';
import { useProjectIO } from './hooks/useProjectIO.ts';
import { useAutoSave } from './hooks/useAutoSave.ts';
import { reconstructProduct } from './services/diffService.ts';
import { inferProjectNameFromInput } from './services/projectUtils.ts';
import { useDebounce } from './hooks/useDebounce.ts';
import { getRelevantDevLogContext } from './services/devLogContextualizerService.ts';

import { ApplicationProvider, useApplicationContext, type ApplicationContextType } from './contexts/ApplicationContext.tsx';
import type { ProcessContextType } from './contexts/ProcessContext.tsx';
import { ProcessProvider, useProcessContext } from './contexts/ProcessContext.tsx';
import { ModelConfigProvider, type ModelConfigContextType } from './contexts/ModelConfigContext.tsx';
import { PlanProvider, type PlanContextType } from './contexts/PlanContext.tsx';
import ErrorBoundary from './components/shared/ErrorBoundary.tsx';
import { formatVersion } from './services/versionUtils.ts';



const commonControlProps: CommonControlProps = {
    commonInputClasses: "w-full p-3 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 placeholder-slate-500 dark:placeholder-slate-400 text-slate-700 dark:text-slate-100",
    commonSelectClasses: "w-full p-2.5 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-slate-700 dark:text-slate-100 text-sm",
    commonCheckboxLabelClasses: "flex items-center text-sm text-primary-600 dark:text-primary-400",
    commonCheckboxInputClasses: "h-4 w-4 text-primary-600 border-slate-300 dark:border-white/20 rounded focus:ring-primary-500 dark:bg-white/10 dark:checked:bg-primary-500 dark:focus:ring-offset-black/50",
    commonButtonClasses: "flex-1 inline-flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-white/20 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
};

// Component for the UI Layout
const AppLayout: React.FC = () => {
    const appCtx = useApplicationContext();
    const processCtx = useProcessContext();
    const autoSaveHook = appCtx.autoSaveHook; 
    
    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const [activeControlTab, setActiveControlTab] = useState<'run' | 'plan' | 'devlog'>('run');

    const toggleControlsPanel = (tab: 'run' | 'plan' | 'devlog') => {
        setActiveControlTab(tab);
        setIsControlsOpen(true);
    };
    
    const closeControlsPanel = () => {
        setIsControlsOpen(false);
    };


    const closeTargetedRefinementModal = () => {
        processCtx.updateProcessState({
            isTargetedRefinementModalOpen: false,
            currentTextSelectionForRefinement: null,
            instructionsForSelectionRefinement: "",
        });
    };

    const submitTargetedRefinement = async () => {
        if (processCtx.currentTextSelectionForRefinement && processCtx.instructionsForSelectionRefinement) {
            await processCtx.handleStartProcess({
                isTargetedRefinement: true,
                targetedSelection: processCtx.currentTextSelectionForRefinement,
                targetedInstructions: processCtx.instructionsForSelectionRefinement,
                userRawPromptForContextualizer: processCtx.instructionsForSelectionRefinement,
            });
        }
        closeTargetedRefinementModal();
    };
    
    const getAutoSaveStatusDisplay = () => {
        if (!autoSaveHook) return null;
        const status = autoSaveHook.autoSaveStatus;

        if (status === 'idle' || status === 'found_autosave' || status === 'cleared') {
            return null;
        }

        let text = '';
        let colorClass = '';

        switch (status) {
            case 'saving': text = 'Saving...'; colorClass = 'bg-blue-500/80'; break;
            case 'saved': text = 'Saved'; colorClass = 'bg-green-500/80'; break;
            case 'error': text = 'Save Error'; colorClass = 'bg-red-500/80'; break;
            case 'loading': text = 'Loading...'; colorClass = 'bg-blue-500/80'; break;
            case 'loaded': text = 'Loaded'; colorClass = 'bg-green-500/80'; break;
            case 'clearing': text = 'Clearing...'; colorClass = 'bg-yellow-500/80'; break;
            case 'not_found': text = 'No Save'; colorClass = 'bg-slate-500/80'; break;
            default: return null;
        }

        return (
            <span className={`ml-3 px-2 py-1 text-xs rounded-full ${colorClass} text-white animate-pulse`}>
                {text}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col">
            <header className="bg-slate-800 dark:bg-black/50 text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-20 gap-4">
                <h1 className="text-xl font-semibold text-primary-300 whitespace-nowrap">Autologos Engine</h1>
                
                <div className="flex items-center gap-2 sm:gap-4 flex-grow justify-center">
                    <button onClick={() => toggleControlsPanel('run')} className="px-3 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700 hover:text-white" title="Configure Run & Model">Configure</button>
                    <button onClick={() => toggleControlsPanel('plan')} className="px-3 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700 hover:text-white" title="Open Iterative Plan Editor">Plan</button>
                    <button onClick={() => toggleControlsPanel('devlog')} className="px-3 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700 hover:text-white" title="Open Development Log & Roadmap">Dev Log</button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <div className="flex items-center text-xs text-slate-400">
                        {getAutoSaveStatusDisplay()}
                    </div>
                </div>
            </header>
            
            <Controls 
                commonControlProps={commonControlProps} 
                isOpen={isControlsOpen} 
                onClose={closeControlsPanel}
                initialTab={activeControlTab}
            />

            <main className="flex-1 overflow-y-auto">
                <DisplayArea />
            </main>

            <TargetedRefinementModal
                isOpen={processCtx.isTargetedRefinementModalOpen || false}
                onClose={closeTargetedRefinementModal}
                onSubmit={submitTargetedRefinement}
                selectedText={processCtx.currentTextSelectionForRefinement || ""}
                instructions={processCtx.instructionsForSelectionRefinement || ""}
                onInstructionsChange={(value) => processCtx.updateProcessState({ instructionsForSelectionRefinement: value })}
            />
            
            {autoSaveHook && autoSaveHook.showRestorePrompt && (
                <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-700 shadow-lg rounded-lg p-4 border border-primary-500/50 max-w-sm z-50">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Found Auto-Saved Session</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Project: "{autoSaveHook.restorableStateInfo?.projectName || 'Untitled'}" saved at {autoSaveHook.restorableStateInfo?.lastAutoSavedAt ? new Date(autoSaveHook.restorableStateInfo.lastAutoSavedAt).toLocaleTimeString() : 'an unknown time'}.
                    </p>
                    <div className="flex justify-end gap-2 mt-3">
                        <button onClick={autoSaveHook.handleClearAutoSaveAndDismiss} className="px-3 py-1 text-xs rounded-md border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10">Dismiss</button>
                        <button onClick={autoSaveHook.handleRestoreAutoSave} className="px-3 py-1 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700">Restore</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AppContent: React.FC = () => {
    // --- STATE AND HOOKS ---
    const [apiKeyStatus] = useState<'loaded' | 'missing'>(GeminaiService.isApiKeyAvailable() ? 'loaded' : 'missing');
    const [staticAiModelDetails, setStaticAiModelDetails] = useState<StaticAiModelDetails | null>(null);

    const { state: processState, ...processStateActions } = useProcessState();
    const { 
      updateProcessState, handleLoadedFilesChange, addLogEntry, handleReset, 
      handleInitialPromptChange, addDevLogEntry, updateDevLogEntry, deleteDevLogEntry 
    } = processStateActions;

    const debouncedInitialPrompt = useDebounce(processState.initialPrompt, 500);

    const modelParamsHook = useModelParameters(
        debouncedInitialPrompt,
        processState.loadedFiles.length,
        processState.isPlanActive,
        processState.promptChangedByFileLoad,
        () => updateProcessState({ promptChangedByFileLoad: false })
    );

    const planTemplatesHook = usePlanTemplates();

    const debouncedProjectNameInput = useDebounce(processState.projectName, 800);
    useEffect(() => {
        if ((!debouncedProjectNameInput || debouncedProjectNameInput === INITIAL_PROJECT_NAME_STATE) && (processState.loadedFiles.length > 0 || processState.initialPrompt.trim().length > 0)) {
            const inferredName = inferProjectNameFromInput(processState.initialPrompt, processState.loadedFiles);
            if (inferredName) updateProcessState({ projectName: inferredName });
        }
    }, [processState.initialPrompt, processState.loadedFiles, debouncedProjectNameInput, updateProcessState]);
    
    const setLoadedModelParams = useCallback((params: { temperature: number, topP: number, topK: number, settingsSuggestionSource: SettingsSuggestionSource, userManuallyAdjustedSettings: boolean }) => {
      modelParamsHook.handleTemperatureChange(params.temperature);
      modelParamsHook.handleTopPChange(params.topP);
      modelParamsHook.handleTopKChange(params.topK);
      modelParamsHook.setUserManuallyAdjustedSettings(params.userManuallyAdjustedSettings);
    }, [modelParamsHook]);

    const initialProcessStateForReset = useMemo(() => createInitialProcessState(apiKeyStatus, GeminaiService.DEFAULT_MODEL_NAME), [apiKeyStatus]);
    const initialModelParamsForReset = useMemo(() => ({
      temperature: GeminaiService.CREATIVE_DEFAULTS.temperature,
      topP: GeminaiService.CREATIVE_DEFAULTS.topP,
      topK: GeminaiService.CREATIVE_DEFAULTS.topK,
      settingsSuggestionSource: 'mode' as SettingsSuggestionSource,
      userManuallyAdjustedSettings: false
    }), []);
    
    const autoSaveHook = useAutoSave(processState, modelParamsHook, updateProcessState, planTemplatesHook.overwriteUserTemplates, initialProcessStateForReset, initialModelParamsForReset, setLoadedModelParams);

    const handleRateLimitErrorEncountered = useCallback(() => {
        updateProcessState({ isApiRateLimited: true, statusMessage: "API Rate Limit Hit. Process halted." });
    }, [updateProcessState]);

    const { handleStartProcess, handleHaltProcess, handleBootstrapSynthesis } = useIterativeLogic(processState, updateProcessState, addLogEntry, addDevLogEntry, modelParamsHook.getUserSetBaseConfig, autoSaveHook.performAutoSave, handleRateLimitErrorEncountered);

    const projectIOHook = useProjectIO(processState, modelParamsHook, updateProcessState, planTemplatesHook.overwriteUserTemplates, initialProcessStateForReset, initialModelParamsForReset, setLoadedModelParams);
    
    useEffect(() => {
        setStaticAiModelDetails(GeminaiService.getAiModelDetails(processState.selectedModelName));
    }, [processState.selectedModelName]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
              .then(registration => {
                console.log('Service Worker registered successfully with scope: ', registration.scope);
              })
              .catch(error => {
                console.error('Service Worker registration failed: ', error);
              });
          });
        }
      }, []);

    // --- MEMOIZED CALLBACKS for Contexts ---
    const onFilesSelectedForImport = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
    
        // --- Special Handling for Single Project/Log Files ---
        if (files.length === 1) {
            const file = files[0];
            if (file.name.endsWith('.autologos.json')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const projectFile: AutologosProjectFile = JSON.parse(e.target?.result as string);
                        projectIOHook.handleImportProjectData(projectFile);
                    } catch (err) {
                        updateProcessState({ statusMessage: 'Error parsing project file.' });
                    }
                };
                reader.readAsText(file);
                return; // Exit after handling
            }
    
            if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    let isLogFile = false;
                    try {
                        const logData: IterationLogEntry[] = JSON.parse(e.target?.result as string);
                        if (Array.isArray(logData) && logData.length > 0 && typeof logData[0].majorVersion === 'number') { // Check for new versioning
                            projectIOHook.handleImportIterationLogData(logData, file.name);
                            isLogFile = true;
                        }
                    } catch (err) {
                        // Not a valid log file, will be treated as a generic text file below.
                    }
                    if (!isLogFile) {
                        loadGenericFiles(files);
                    }
                };
                reader.readAsText(file);
                return; // Exit, loadGenericFiles will be called from onload if needed
            }
        }
    
        // --- Generic File Loader for all other cases ---
        const loadGenericFiles = async (fileList: FileList) => {
            const textFileExtensions = ['.md', '.txt', '.csv', '.xml', '.html', '.js', '.py', '.css', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.json'];
            
            const filePromises = Array.from(fileList).map(f => new Promise<LoadedFile | null>((resolve) => {
                const isTextFileByExtension = textFileExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
    
                if (isTextFileByExtension || f.type.startsWith('text/') || !f.type || f.type === 'application/octet-stream') {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve({ name: f.name, mimeType: 'text/plain', content: e.target?.result as string, size: f.size });
                    reader.onerror = () => { console.error('File read error:', f.name); resolve(null); };
                    reader.readAsText(f);
                } else if (f.type.startsWith('image/')) {
                    console.warn(`Image file loading not yet fully supported for API calls: ${f.name}`);
                    resolve({ name: f.name, mimeType: f.type, content: `[Content of image file '${f.name}' not displayed]`, size: f.size });
                } else {
                    console.warn(`Unsupported file type: ${f.name} (${f.type}). Treating as plain text.`);
                    const reader = new FileReader();
                    reader.onload = (e) => resolve({ name: f.name, mimeType: 'text/plain', content: e.target?.result as string, size: f.size });
                    reader.onerror = () => { console.error('File read error:', f.name); resolve(null); };
                    reader.readAsText(f);
                }
            }));
    
            const results = await Promise.all(filePromises);
            const successfullyLoadedFiles = results.filter((r): r is LoadedFile => r !== null);
            if (successfullyLoadedFiles.length > 0) {
                handleLoadedFilesChange(successfullyLoadedFiles, 'add');
            }
        };
    
        loadGenericFiles(files);
    
    }, [handleLoadedFilesChange, projectIOHook.handleImportProjectData, projectIOHook.handleImportIterationLogData, updateProcessState]);
    
    const handleResetApp = useCallback(async () => {
        if (window.confirm("Are you sure you want to reset everything? All current progress will be lost.")) {
            const baseModelConfigForReset: ModelConfig = {
                temperature: initialModelParamsForReset.temperature,
                topP: initialModelParamsForReset.topP,
                topK: initialModelParamsForReset.topK,
            };
            await handleReset(baseModelConfigForReset, planTemplatesHook.savedPlanTemplates);
            modelParamsHook.resetModelParametersToDefaults();
        }
    }, [handleReset, modelParamsHook, initialModelParamsForReset, planTemplatesHook.savedPlanTemplates]);

    const handleRewind = useCallback((version: Version) => {
        if (processState.isProcessing) return;
        const targetHistory = processState.iterationHistory.filter(e => {
          const entryVersion = { major: e.majorVersion, minor: e.minorVersion, patch: e.patchVersion };
          return JSON.stringify(entryVersion) <= JSON.stringify(version); // Simplistic but effective for this structure
        });

        if (targetHistory.length > 0) {
            const { product, error } = reconstructProduct(version, targetHistory, processState.initialPrompt);
            if (error) {
                updateProcessState({ statusMessage: `Error rewinding: ${error}` });
            } else {
                updateProcessState({ currentProduct: product, currentMajorVersion: version.major, currentMinorVersion: version.minor, iterationHistory: targetHistory, finalProduct: null, statusMessage: `Rewound to ${formatVersion(version)}.`, currentProductBeforeHalt: null, currentVersionBeforeHalt: undefined });
            }
        }
    }, [processState.isProcessing, processState.iterationHistory, processState.initialPrompt, updateProcessState]);
    
    const handleExportIterationMarkdown = useCallback((version: Version) => {
        const { product, error } = reconstructProduct(version, processState.iterationHistory, processState.initialPrompt);
        if (error) { updateProcessState({ statusMessage: `Error exporting markdown: ${error}` }); return; }
        const fileName = generateFileName(processState.projectName, `product_${formatVersion(version)}`, "md");
        const blob = new Blob([product], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    }, [processState.iterationHistory, processState.initialPrompt, processState.projectName, updateProcessState]);

    const onSelectedModelChange = useCallback((modelName: SelectableModelName) => {
        updateProcessState({ selectedModelName: modelName });
    }, [updateProcessState]);

    const reconstructProductCallback = useCallback((targetVersion: Version, hist: IterationLogEntry[], prompt: string) => {
        return reconstructProduct(targetVersion, hist, prompt);
    }, []);

    const openTargetedRefinementModal = useCallback((selectedText: string) => {
        updateProcessState({ isTargetedRefinementModalOpen: true, currentTextSelectionForRefinement: selectedText });
    }, [updateProcessState]);

    const toggleEditMode = useCallback((forceOff = false) => {
        updateProcessState({
            isEditingCurrentProduct: forceOff ? false : !processState.isEditingCurrentProduct,
            editedProductBuffer: !processState.isEditingCurrentProduct ? processState.currentProduct : null
        });
    }, [updateProcessState, processState.isEditingCurrentProduct, processState.currentProduct]);

    const saveManualEdits = useCallback(async () => {
        const { currentMajorVersion, currentMinorVersion, currentProduct, editedProductBuffer } = processState;
        const newVersion: Version = { major: currentMajorVersion, minor: currentMinorVersion + 1 };
        
        const manualEditEntry: AddLogEntryParams = {
            majorVersion: newVersion.major,
            minorVersion: newVersion.minor,
            entryType: 'manual_edit',
            currentFullProduct: editedProductBuffer,
            previousFullProduct: currentProduct,
            status: 'Manual Edit Applied',
            fileProcessingInfo: { filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0, fileManifestProvidedCharacterCount: 0 }
        };
        addLogEntry(manualEditEntry);
        updateProcessState({
            currentProduct: editedProductBuffer,
            currentMajorVersion: newVersion.major,
            currentMinorVersion: newVersion.minor,
            isEditingCurrentProduct: false,
            editedProductBuffer: null,
            statusMessage: `Manual edit applied as ${formatVersion(newVersion)}.`
        });
        await autoSaveHook.performAutoSave();
    }, [addLogEntry, updateProcessState, processState, autoSaveHook]);

    const onMaxIterationsChange = useCallback((val: number) => {
        updateProcessState({ maxMajorVersions: val });
    }, [updateProcessState]);

    const onIsPlanActiveChange = useCallback((isActive: boolean) => {
        updateProcessState({ isPlanActive: isActive });
    }, [updateProcessState]);

    const onPlanStagesChange = useCallback((stages: PlanStage[]) => {
        updateProcessState({ planStages: stages });
    }, [updateProcessState]);

    const onLoadPlanTemplate = useCallback((template: PlanTemplate) => {
        updateProcessState({ planStages: template.stages });
    }, [updateProcessState]);

    // --- Memoized Context Values ---
    const applicationContextValue: ApplicationContextType = useMemo(() => ({
      apiKeyStatus,
      selectedModelName: processState.selectedModelName,
      projectName: processState.projectName,
      projectId: processState.projectId,
      isApiRateLimited: processState.isApiRateLimited,
      rateLimitCooldownActiveSeconds: processState.rateLimitCooldownActiveSeconds,
      updateProcessState,
      handleImportProjectData: projectIOHook.handleImportProjectData,
      handleImportIterationLogData: projectIOHook.handleImportIterationLogData,
      handleExportProject: projectIOHook.handleExportProject,
      handleExportIterationDiffs: projectIOHook.handleExportIterationDiffs,
      handleRateLimitErrorEncountered,
      staticAiModelDetails,
      onSelectedModelChange,
      onFilesSelectedForImport,
      autoSaveHook,
    }), [
      apiKeyStatus,
      processState.selectedModelName,
      processState.projectName,
      processState.projectId,
      processState.isApiRateLimited,
      processState.rateLimitCooldownActiveSeconds,
      updateProcessState,
      projectIOHook.handleImportProjectData,
      projectIOHook.handleImportIterationLogData,
      projectIOHook.handleExportProject,
      projectIOHook.handleExportIterationDiffs,
      handleRateLimitErrorEncountered,
      staticAiModelDetails,
      onSelectedModelChange,
      onFilesSelectedForImport,
      autoSaveHook,
    ]);

    const processContextValue: ProcessContextType = useMemo(() => ({
        ...processState,
        updateProcessState,
        handleLoadedFilesChange,
        addLogEntry,
        handleReset: handleResetApp,
        handleStartProcess,
        handleHaltProcess,
        handleBootstrapSynthesis,
        handleRewind,
        handleExportIterationMarkdown,
        reconstructProductCallback,
        handleInitialPromptChange,
        openTargetedRefinementModal,
        toggleEditMode,
        saveManualEdits,
        addDevLogEntry,
        updateDevLogEntry,
        deleteDevLogEntry,
    }), [
        processState, updateProcessState, handleLoadedFilesChange, addLogEntry, handleResetApp,
        handleStartProcess, handleHaltProcess, handleBootstrapSynthesis, handleRewind, handleExportIterationMarkdown,
        reconstructProductCallback, handleInitialPromptChange, openTargetedRefinementModal, toggleEditMode,
        saveManualEdits, addDevLogEntry, updateDevLogEntry, deleteDevLogEntry,
    ]);

    const modelConfigContextValue: ModelConfigContextType = useMemo(() => ({
        temperature: modelParamsHook.temperature,
        topP: modelParamsHook.topP,
        topK: modelParamsHook.topK,
        maxIterations: processState.maxMajorVersions,
        settingsSuggestionSource: modelParamsHook.settingsSuggestionSource,
        userManuallyAdjustedSettings: modelParamsHook.userManuallyAdjustedSettings,
        modelConfigRationales: modelParamsHook.modelConfigRationales,
        modelParameterAdvice: modelParamsHook.modelParameterAdvice,
        modelConfigWarnings: modelParamsHook.modelConfigWarnings,
        handleTemperatureChange: modelParamsHook.handleTemperatureChange,
        handleTopPChange: modelParamsHook.handleTopPChange,
        handleTopKChange: modelParamsHook.handleTopKChange,
        onMaxIterationsChange,
        setUserManuallyAdjustedSettings: modelParamsHook.setUserManuallyAdjustedSettings,
        getUserSetBaseConfig: modelParamsHook.getUserSetBaseConfig,
    }), [
        modelParamsHook,
        processState.maxMajorVersions,
        onMaxIterationsChange,
    ]);

    const planContextValue: PlanContextType = useMemo(() => ({
        isPlanActive: processState.isPlanActive,
        planStages: processState.planStages,
        currentPlanStageIndex: processState.currentPlanStageIndex,
        currentStageIteration: processState.currentStageIteration,
        savedPlanTemplates: planTemplatesHook.savedPlanTemplates,
        planTemplateStatus: planTemplatesHook.planTemplateStatusMessage,
        onIsPlanActiveChange,
        onPlanStagesChange,
        handleSavePlanAsTemplate: planTemplatesHook.handleSavePlanAsTemplate,
        handleDeletePlanTemplate: planTemplatesHook.handleDeletePlanTemplate,
        clearPlanTemplateStatus: planTemplatesHook.clearPlanTemplateStatusMessage,
        onLoadPlanTemplate,
        updateProcessState,
    }), [
        processState.isPlanActive,
        processState.planStages,
        processState.currentPlanStageIndex,
        processState.currentStageIteration,
        planTemplatesHook.savedPlanTemplates,
        planTemplatesHook.planTemplateStatusMessage,
        onIsPlanActiveChange,
        onPlanStagesChange,
        planTemplatesHook.handleSavePlanAsTemplate,
        planTemplatesHook.handleDeletePlanTemplate,
        planTemplatesHook.clearPlanTemplateStatusMessage,
        onLoadPlanTemplate,
        updateProcessState,
    ]);

    return (
        <ApplicationProvider value={applicationContextValue}>
            <ProcessProvider value={processContextValue}>
                <ModelConfigProvider value={modelConfigContextValue}>
                    <PlanProvider value={planContextValue}>
                        <AppLayout />
                    </PlanProvider>
                </ModelConfigProvider>
            </ProcessProvider>
        </ApplicationProvider>
    );
};


const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;