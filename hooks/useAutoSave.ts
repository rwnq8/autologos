
import { useState, useEffect, useCallback } from 'react';
import type { ProcessState, AutologosIterativeEngineData, ModelConfig, LoadedFile, SettingsSuggestionSource, PlanTemplate, SelectableModelName } from '../types.ts';
import * as storageService from '../services/storageService';
import { DEFAULT_PROJECT_NAME_FALLBACK } from '../services/utils';
import { reconstructProduct } from '../services/diffService';

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'loaded' | 'not_found' | 'found_autosave' | 'cleared' | 'loading' | 'clearing';

export const useAutoSave = (
  stateRef: React.MutableRefObject<ProcessState>,
  modelParamsRef: React.MutableRefObject<{
      temperature: number;
      topP: number;
      topK: number;
      settingsSuggestionSource: SettingsSuggestionSource;
      userManuallyAdjustedSettings: boolean;
  }>,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  overwriteUserPlanTemplates: (templates: PlanTemplate[]) => void,
  initialProcessStateValues: ProcessState,
  initialModelParamValues: {
      temperature: number;
      topP: number;
      topK: number;
      settingsSuggestionSource: SettingsSuggestionSource;
      userManuallyAdjustedSettings: boolean;
  },
  setLoadedModelParams: (params: {
      temperature: number;
      topP: number;
      topK: number;
      settingsSuggestionSource: SettingsSuggestionSource;
      userManuallyAdjustedSettings: boolean;
  }) => void


) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorableStateInfo, setRestorableStateInfo] = useState<{ projectName: string | null, lastAutoSavedAt: number | null } | null>(null);

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
    const currentState = stateRef.current;
    const currentModelParams = modelParamsRef.current;

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
        strategistInfluenceLevel: currentState.strategistInfluenceLevel, // Added
        stagnationNudgeAggressiveness: currentState.stagnationNudgeAggressiveness, // Added
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
  }, [stateRef, modelParamsRef, updateProcessState]);


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

        const lastIter = engineData.iterationHistory.length > 0 ? engineData.iterationHistory[engineData.iterationHistory.length - 1].iteration : 0;
        const productAtLastIter = engineData.finalProduct || (engineData.iterationHistory.length > 0 ? reconstructProduct(lastIter, engineData.iterationHistory, engineData.initialPrompt).product : engineData.initialPrompt);

        const restoredProcessState: ProcessState = {
          ...initialProcessStateValues,
          ...engineData,

          apiKeyStatus: initialProcessStateValues.apiKeyStatus, // Preserve current API key status
          isProcessing: false, // Ensure not processing on restore
          statusMessage: "Session restored from auto-save.",

          currentProduct: engineData.currentProductBeforeHalt || productAtLastIter,
          currentIteration: engineData.currentIterationBeforeHalt ?? lastIter,

          selectedModelName: engineData.selectedModelName || initialProcessStateValues.selectedModelName,

          loadedFiles: engineData.loadedFiles || [],
          planStages: engineData.planStages || [],
          // savedPlanTemplates is handled by overwriteUserPlanTemplates
          iterationHistory: engineData.iterationHistory || [],

          outputParagraphShowHeadings: engineData.outputParagraphShowHeadings ?? initialProcessStateValues.outputParagraphShowHeadings,
          outputParagraphMaxHeadingDepth: engineData.outputParagraphMaxHeadingDepth ?? initialProcessStateValues.outputParagraphMaxHeadingDepth,
          outputParagraphNumberedHeadings: engineData.outputParagraphNumberedHeadings ?? initialProcessStateValues.outputParagraphNumberedHeadings,
          isPlanActive: engineData.isPlanActive ?? false,
          currentDiffViewType: engineData.currentDiffViewType || 'words',
          aiProcessInsight: initialProcessStateValues.aiProcessInsight, // Don't restore old insights, let it re-evaluate
          stagnationNudgeEnabled: engineData.stagnationNudgeEnabled ?? initialProcessStateValues.stagnationNudgeEnabled,
          strategistInfluenceLevel: engineData.strategistInfluenceLevel ?? initialProcessStateValues.strategistInfluenceLevel, // Added
          stagnationNudgeAggressiveness: engineData.stagnationNudgeAggressiveness ?? initialProcessStateValues.stagnationNudgeAggressiveness, // Added
        };
        updateProcessState(restoredProcessState);

        setLoadedModelParams({
          temperature: engineData.temperature ?? initialModelParamValues.temperature,
          topP: engineData.topP ?? initialModelParamValues.topP,
          topK: engineData.topK ?? initialModelParamValues.topK,
          settingsSuggestionSource: engineData.settingsSuggestionSource ?? initialModelParamValues.settingsSuggestionSource,
          userManuallyAdjustedSettings: engineData.userManuallyAdjustedSettings ?? initialModelParamValues.userManuallyAdjustedSettings,
        });

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