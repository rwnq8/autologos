
import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import type { StaticAiModelDetails, IterationLogEntry, PlanTemplate, ModelConfig, LoadedFile, PlanStage, SettingsSuggestionSource, ReconstructedProductResult, SelectableModelName, ProcessState, CommonControlProps, AutologosProjectFile, IterationEntryType, DevLogEntry, Version, ModelStrategy } from './types/index.ts';
import { SELECTABLE_MODELS, AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION, THIS_APP_ID } from './types/index.ts';
import * as GeminaiService from './services/geminiService.ts';
import { generateFileName, INITIAL_PROJECT_NAME_STATE } from './services/utils.ts';
import Controls from './components/Controls.tsx';
import TargetedRefinementModal from './components/modals/TargetedRefinementModal.tsx';
import AppHeader from './components/AppHeader.tsx';
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
import { formatVersion, compareVersions } from './services/versionUtils.ts';
import ProcessStatusDisplay from './components/display/ProcessStatusDisplay.tsx';
import ProductOutputDisplay from './components/display/ProductOutputDisplay.tsx';
import IterationLog from './components/display/IterationLog.tsx';
import StrategyInsightCard from './components/display/StrategyInsightCard.tsx';



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
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const [activeControlTab, setActiveControlTab] = useState<'run' | 'plan' | 'devlog'>('run');

    const toggleControlsPanel = (tab: 'run' | 'plan' | 'devlog') => {
        setActiveControlTab(tab);
        setIsControlsOpen(true);
    };
    
    const closeControlsPanel = () => {
        setIsControlsOpen(false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
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
    
    const handleSaveFinalProduct = () => {
        const productToSave = processCtx.finalProduct || (processCtx.currentMajorVersion === 0 && processCtx.currentProduct ? processCtx.currentProduct : null);
        if (!productToSave) return;
        const fileName = generateFileName(appCtx.projectName, "product", "md");
        const blob = new Blob([productToSave], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    };


    return (
        <div className="min-h-screen bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col">
            <AppHeader 
                fileInputRef={fileInputRef}
                onImportClick={handleImportClick}
                onFilesSelectedForImport={appCtx.onFilesSelectedForImport}
                onToggleControls={toggleControlsPanel}
            />
            
            <Controls 
                commonControlProps={commonControlProps} 
                isOpen={isControlsOpen} 
                onClose={closeControlsPanel}
                initialTab={activeControlTab}
                onImportClick={handleImportClick}
            />

            <main className="flex-1 overflow-y-auto">
                 <div className="space-y-8 p-6">
                    {processCtx.awaitingStrategyDecision && processCtx.pendingStrategySuggestion && (
                        <StrategyInsightCard 
                            suggestion={processCtx.pendingStrategySuggestion}
                            onAccept={processCtx.handleAcceptStrategy}
                            onIgnore={processCtx.handleIgnoreStrategy}
                        />
                    )}
                    <ProcessStatusDisplay />
                    <ProductOutputDisplay onSaveFinalProduct={handleSaveFinalProduct} />
                    <IterationLog
                        onSaveLog={appCtx.handleExportProject} // Reusing export project as it saves everything
                    />
                </div>
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

    const { handleStartProcess, handleHaltProcess, handleBootstrapSynthesis, handleAcceptStrategy, handleIgnoreStrategy } = useIterativeLogic(processState, updateProcessState, addLogEntry, addDevLogEntry, modelParamsHook.getUserSetBaseConfig, autoSaveHook.performAutoSave, handleRateLimitErrorEncountered);

    const projectIOHook = useProjectIO(processState, modelParamsHook, updateProcessState, planTemplatesHook.overwriteUserTemplates, initialProcessStateForReset, initialModelParamsForReset, setLoadedModelParams);
    
    useEffect(() => {
        setStaticAiModelDetails(GeminaiService.getAiModelDetails(processState.selectedModelName));
    }, [processState.selectedModelName]);

    useEffect(() => {
        const registerServiceWorker = () => {
            if ('serviceWorker' in navigator) {
                // To robustly handle sandboxed environments where window.location might be misleading,
                // we find the URL of the currently executing script and use it as a base.
                const mainScript = document.querySelector('script[src*="index.tsx"]');
                if (!mainScript) {
                    console.error('Could not find main application script to register service worker. Registration failed.');
                    return;
                }
                const mainScriptUrl = new URL(mainScript.getAttribute('src'), window.location.href);

                const swUrl = new URL('service-worker.js', mainScriptUrl.href).href;

                navigator.serviceWorker.register(swUrl)
                    .then(registration => {
                        console.log('Service Worker registered successfully with scope:', registration.scope);
                    })
                    .catch(error => {
                        console.error('Service Worker registration failed with URL:', swUrl, error);
                    });
            }
        };

        // Wait for the window to load before registering the service worker.
        window.addEventListener('load', registerServiceWorker);

        // Cleanup the event listener when the component unmounts.
        return () => {
            window.removeEventListener('load', registerServiceWorker);
        };
    }, []);

    const onFilesSelectedForImport = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
    
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
                return;
            }
    
            if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    let isLogFile = false;
                    try {
                        const logData: IterationLogEntry[] = JSON.parse(e.target?.result as string);
                        if (Array.isArray(logData) && logData.length > 0 && typeof logData[0].majorVersion === 'number') { 
                            projectIOHook.handleImportIterationLogData(logData, file.name);
                            isLogFile = true;
                        }
                    } catch (err) {
                    }
                    if (!isLogFile) {
                        loadGenericFiles(files);
                    }
                };
                reader.readAsText(file);
                return;
            }
        }
    
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
          return compareVersions(entryVersion, version) <= 0;
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
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
        handleAcceptStrategy,
        handleIgnoreStrategy,
    }), [
        processState, updateProcessState, handleLoadedFilesChange, addLogEntry, handleResetApp,
        handleStartProcess, handleHaltProcess, handleBootstrapSynthesis, handleRewind, handleExportIterationMarkdown,
        reconstructProductCallback, handleInitialPromptChange, openTargetedRefinementModal, toggleEditMode,
        saveManualEdits, addDevLogEntry, updateDevLogEntry, deleteDevLogEntry, handleAcceptStrategy, handleIgnoreStrategy,
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
