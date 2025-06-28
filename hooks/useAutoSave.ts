import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProcessState, AutologosIterativeEngineData, ModelConfig, LoadedFile, SettingsSuggestionSource, PlanTemplate, SelectableModelName } from '../types.ts';
import * as storageService from '../services/storageService';
import { DEFAULT_PROJECT_NAME_FALLBACK } from '../services/utils';
import { reconstructProduct } from '../services/diffService';

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'loaded' | 'not_found' | 'found_autosave' | 'cleared' | 'loading' | 'clearing';

type ModelParams = {
    temperature: number;
    topP: number;
    topK: number;
    settingsSuggestionSource: SettingsSuggestionSource;
    userManuallyAdjustedSettings: boolean;
};

export const useAutoSave = (
  processState: ProcessState,
  modelParams: ModelParams,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  overwriteUserPlanTemplates: (templates: PlanTemplate[]) => void,
  initialProcessStateValues: ProcessState,
  initialModelParamValues: ModelParams,
  setLoadedModelParams: (params: ModelParams) => void
) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorableStateInfo, setRestorableStateInfo] = useState<{ projectName: string | null, lastAutoSavedAt: number | null } | null>(null);

  const latestDataRef = useRef({ processState, modelParams });
  useEffect(() => {
    latestDataRef.current = { processState, modelParams };
  }, [processState, modelParams]);

  useEffect(() => {
    const checkForAutoSavedState = async () => {
      try {
        const loadedData = await storageService.loadState();
        if (loadedData) {
          setRestorableStateInfo({ projectName: loadedData.projectName || null, lastAutoSavedAt: loadedData.lastAutoSavedAt || null });
          setShowRestorePrompt(true);
          setAutoSaveStatus('found_autosave');
        } else {
          setAutoSaveStatus('not_found');
        }
      } catch (error) {
        console.error("Error checking for auto-saved state:", error);
        setAutoSaveStatus('error');
        updateProcessState({ statusMessage: "Could not check for auto-saved session." });
      }
    };
    checkForAutoSavedState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const performAutoSave = useCallback(async () => {
    setAutoSaveStatus('saving');
    const { processState: currentState, modelParams: currentModelParams } = latestDataRef.current;

    const dataToSave: AutologosIterativeEngineData = {
        initialPrompt: currentState.initialPrompt,
        iterationHistory: currentState.iterationHistory,
        maxIterations: currentState.maxIterations,
        temperature: currentModelParams.temperature,
        topP: currentModelParams.topP,
        topK: currentModelParams.topK,
        settingsSuggestionSource: currentModelParams.settingsSuggestionSource,
        userManuallyAdjustedSettings: currentModelParams.userManuallyAdjustedSettings,
        selectedModelName: currentState.selectedModelName,
        finalProduct: currentState.finalProduct,
        currentProductBeforeHalt: currentState.currentProductBeforeHalt,
        currentIterationBeforeHalt: currentState.currentIterationBeforeHalt,
        promptSourceName: currentState.promptSourceName,
        configAtFinalization: currentState.configAtFinalization,
        loadedFiles: currentState.loadedFiles,
        lastAutoSavedAt: Date.now(),
        outputParagraphShowHeadings: currentState.outputParagraphShowHeadings,
        outputParagraphMaxHeadingDepth: currentState.outputParagraphMaxHeadingDepth,
        outputParagraphNumberedHeadings: currentState.outputParagraphNumberedHeadings,
        isPlanActive: currentState.isPlanActive,
        planStages: currentState.planStages,
        currentPlanStageIndex: currentState.currentPlanStageIndex,
        savedPlanTemplates: currentState.savedPlanTemplates,
        currentDiffViewType: currentState.currentDiffViewType,
        projectName: currentState.projectName,
        projectId: currentState.projectId,
        isApiRateLimited: currentState.isApiRateLimited,
        rateLimitCooldownActiveSeconds: currentState.rateLimitCooldownActiveSeconds,
        stagnationNudgeEnabled: currentState.stagnationNudgeEnabled,
        inputComplexity: currentState.inputComplexity,
        strategistInfluenceLevel: currentState.strategistInfluenceLevel, 
        stagnationNudgeAggressiveness: currentState.stagnationNudgeAggressiveness, 
        devLog: currentState.devLog,
    };

    try {
      await storageService.saveState(dataToSave);
      updateProcessState({ lastAutoSavedAt: dataToSave.lastAutoSavedAt });
      setAutoSaveStatus('saved');
      setTimeout(() => {
        setAutoSaveStatus(prevStatus => prevStatus === 'saved' ? 'idle' : prevStatus);
      }, 3000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setAutoSaveStatus('error');
      updateProcessState({ statusMessage: "Warning: Auto-save failed." });
    }
  }, [updateProcessState]);


  const handleRestoreAutoSave = useCallback(async () => {
    setAutoSaveStatus('loading');
    try {
      const engineData = await storageService.loadState();
      if (engineData) {
        if (Array.isArray(engineData.savedPlanTemplates)) {
          overwriteUserPlanTemplates(engineData.savedPlanTemplates);
        } else {
          overwriteUserPlanTemplates([]);
        }
        
        let correctedInitialPrompt = engineData.initialPrompt;
        const loadedFilesFromData = engineData.loadedFiles || [];
        if (loadedFilesFromData.length > 0) {
            correctedInitialPrompt = `Input consists of ${loadedFilesFromData.length} file(s): ${loadedFilesFromData.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)}KB)`).join('; ')}.`;
        }

        const lastIter = engineData.iterationHistory.length > 0 ? engineData.iterationHistory[engineData.iterationHistory.length - 1].iteration : 0;
        
        const { product: productAtLastIter } = reconstructProduct(lastIter, engineData.iterationHistory, correctedInitialPrompt);

        const restoredProcessState: ProcessState = {
          ...initialProcessStateValues,
          ...engineData,
          initialPrompt: correctedInitialPrompt, 
          loadedFiles: loadedFilesFromData,     

          apiKeyStatus: initialProcessStateValues.apiKeyStatus, 
          isProcessing: false, 
          statusMessage: "Session restored from auto-save.",

          currentProduct: engineData.currentProductBeforeHalt || productAtLastIter,
          currentIteration: engineData.currentIterationBeforeHalt ?? lastIter,

          selectedModelName: engineData.selectedModelName || initialProcessStateValues.selectedModelName,
          
          planStages: engineData.planStages || [],
          savedPlanTemplates: engineData.savedPlanTemplates || [], 
          iterationHistory: engineData.iterationHistory || [],

          outputParagraphShowHeadings: engineData.outputParagraphShowHeadings ?? initialProcessStateValues.outputParagraphShowHeadings,
          outputParagraphMaxHeadingDepth: engineData.outputParagraphMaxHeadingDepth ?? initialProcessStateValues.outputParagraphMaxHeadingDepth,
          outputParagraphNumberedHeadings: engineData.outputParagraphNumberedHeadings ?? initialProcessStateValues.outputParagraphNumberedHeadings,
          isPlanActive: engineData.isPlanActive ?? false,
          currentDiffViewType: engineData.currentDiffViewType || 'words',
          aiProcessInsight: initialProcessStateValues.aiProcessInsight, 
          stagnationNudgeEnabled: engineData.stagnationNudgeEnabled ?? initialProcessStateValues.stagnationNudgeEnabled,
          strategistInfluenceLevel: engineData.strategistInfluenceLevel ?? initialProcessStateValues.strategistInfluenceLevel, 
          stagnationNudgeAggressiveness: engineData.stagnationNudgeAggressiveness ?? initialProcessStateValues.stagnationNudgeAggressiveness,
          devLog: engineData.devLog || [],
        };
        updateProcessState(restoredProcessState);

        setLoadedModelParams({
          temperature: engineData.temperature ?? initialModelParamValues.temperature,
          topP: engineData.topP ?? initialModelParamValues.topP,
          topK: engineData.topK ?? initialModelParamValues.topK,
          settingsSuggestionSource: engineData.settingsSuggestionSource ?? initialModelParamValues.settingsSuggestionSource,
          userManuallyAdjustedSettings: engineData.userManuallyAdjustedSettings ?? initialModelParamValues.userManuallyAdjustedSettings,
        });
        updateProcessState({statusMessage: `Project "${restoredProcessState.projectName || 'Restored Project'}" loaded.`});

        setAutoSaveStatus('loaded');
      } else {
        updateProcessState({ statusMessage: "Could not find auto-saved state to restore." });
        setAutoSaveStatus('not_found');
      }
    } catch (e) {
      console.error("Error restoring state:", e);
      updateProcessState({ statusMessage: "Error during session restore." });
      setAutoSaveStatus('error');
    }
    setShowRestorePrompt(false);
    setRestorableStateInfo(null);
  }, [updateProcessState, overwriteUserPlanTemplates, initialProcessStateValues, initialModelParamValues, setLoadedModelParams]);

  const handleClearAutoSaveAndDismiss = useCallback(async () => {
    setAutoSaveStatus('clearing');
    try {
      await storageService.clearState();
      updateProcessState({ statusMessage: "Auto-saved session dismissed and cleared." });
      setAutoSaveStatus('cleared');
    } catch (e) {
      console.error("Error clearing auto-saved state:", e);
      updateProcessState({ statusMessage: "Error clearing auto-saved state." });
      setAutoSaveStatus('error');
    }
    setShowRestorePrompt(false);
    setRestorableStateInfo(null);
  }, [updateProcessState]);

  return {
    autoSaveStatus,
    showRestorePrompt,
    restorableStateInfo,
    performAutoSave,
    handleRestoreAutoSave,
    handleClearAutoSaveAndDismiss,
  };
};