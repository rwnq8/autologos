// hooks/useAutoSave.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProcessState, AutologosIterativeEngineData, ModelConfig, LoadedFile, SettingsSuggestionSource, PlanTemplate, SelectableModelName, Version, OutlineNode } from '../types/index.ts';
import * as storageService from '../services/storageService.ts';
import { DEFAULT_PROJECT_NAME_FALLBACK } from '../services/utils.ts';
import { reconstructProduct } from '../services/diffService.ts';
import { splitToChunks, reconstructFromChunks } from '../services/chunkingService.ts';
import { compareVersions } from '../services/versionUtils.ts';

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
  overwriteUserTemplates: (templates: PlanTemplate[]) => void,
  initialProcessStateValues: ProcessState,
  initialModelParamValues: ModelParams,
  resetModelParameters: () => void
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
  }, [updateProcessState]);

  const performAutoSave = useCallback(async () => {
    setAutoSaveStatus('saving');
    try {
      const { processState, modelParams } = latestDataRef.current;

      const engineData: AutologosIterativeEngineData = {
        initialPrompt: processState.initialPrompt,
        iterationHistory: processState.iterationHistory,
        documentChunks: processState.documentChunks,
        currentFocusChunkIndex: processState.currentFocusChunkIndex,
        isOutlineMode: processState.isOutlineMode,
        outlineId: processState.outlineId,
        currentOutline: processState.currentOutline,
        finalOutline: processState.finalOutline,
        maxMajorVersions: processState.maxMajorVersions,
        temperature: modelParams.temperature,
        topP: modelParams.topP,
        topK: modelParams.topK,
        settingsSuggestionSource: modelParams.settingsSuggestionSource,
        userManuallyAdjustedSettings: modelParams.userManuallyAdjustedSettings,
        selectedModelName: processState.selectedModelName,
        finalProduct: processState.finalProduct,
        currentProductBeforeHalt: processState.currentProductBeforeHalt,
        currentVersionBeforeHalt: processState.currentVersionBeforeHalt,
        promptSourceName: processState.promptSourceName,
        configAtFinalization: processState.configAtFinalization,
        loadedFiles: processState.loadedFiles,
        lastAutoSavedAt: Date.now(),
        outputParagraphShowHeadings: processState.outputParagraphShowHeadings,
        outputParagraphMaxHeadingDepth: processState.outputParagraphMaxHeadingDepth,
        outputParagraphNumberedHeadings: processState.outputParagraphNumberedHeadings,
        isPlanActive: processState.isPlanActive,
        planStages: processState.planStages,
        currentPlanStageIndex: processState.currentPlanStageIndex,
        savedPlanTemplates: processState.savedPlanTemplates,
        currentDiffViewType: processState.currentDiffViewType,
        projectName: processState.projectName,
        projectObjective: processState.projectObjective,
        projectId: processState.projectId,
        projectCodename: processState.projectCodename,
        isApiRateLimited: processState.isApiRateLimited,
        rateLimitCooldownActiveSeconds: processState.rateLimitCooldownActiveSeconds,
        stagnationNudgeEnabled: processState.stagnationNudgeEnabled,
        isSearchGroundingEnabled: processState.isSearchGroundingEnabled,
        isUrlBrowsingEnabled: processState.isUrlBrowsingEnabled,
        inputComplexity: processState.inputComplexity,
        strategistInfluenceLevel: processState.strategistInfluenceLevel,
        stagnationNudgeAggressiveness: processState.stagnationNudgeAggressiveness,
        devLog: processState.devLog,
        bootstrapSamples: processState.bootstrapSamples,
        bootstrapSampleSizePercent: processState.bootstrapSampleSizePercent,
        bootstrapSubIterations: processState.bootstrapSubIterations,
        ensembleSubProducts: processState.ensembleSubProducts,
        isDocumentMapOpen: processState.isDocumentMapOpen,
        activeChunkId: processState.activeChunkId,
      };

      await storageService.saveState(engineData);
      setAutoSaveStatus('saved');
      setRestorableStateInfo({ projectName: engineData.projectName, lastAutoSavedAt: engineData.lastAutoSavedAt });
    } catch (error) {
      console.error("Auto-save failed:", error);
      setAutoSaveStatus('error');
    }
  }, [latestDataRef]);

  const handleRestoreAutoSave = useCallback(async () => {
    setAutoSaveStatus('loading');
    setShowRestorePrompt(false);
    try {
      const loadedData = await storageService.loadState();
      if (loadedData) {
        if (Array.isArray(loadedData.savedPlanTemplates)) {
          overwriteUserTemplates(loadedData.savedPlanTemplates);
        } else {
          overwriteUserTemplates([]);
        }

        let correctedInitialPrompt = loadedData.initialPrompt;
        const loadedFilesFromData = loadedData.loadedFiles || [];
        if (loadedFilesFromData.length > 0) {
          correctedInitialPrompt = `Input consists of ${loadedFilesFromData.length} file(s): ${loadedFilesFromData.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)}KB)`).join('; ')}.`;
        }
        
        const lastEntry = loadedData.iterationHistory && loadedData.iterationHistory.length > 0 ? [...loadedData.iterationHistory].sort((a,b) => compareVersions(b, a))[0] : null;
        const lastVersion = lastEntry ? { major: lastEntry.majorVersion, minor: lastEntry.minorVersion, patch: lastEntry.patchVersion } : { major: 0, minor: 0, patch: 0 };
          
        const { product: productAtLastIter } = reconstructProduct(lastVersion, loadedData.iterationHistory, correctedInitialPrompt);

        const documentChunks = loadedData.documentChunks && loadedData.documentChunks.length > 0
            ? loadedData.documentChunks
            : splitToChunks(loadedData.currentProductBeforeHalt || productAtLastIter || "");

        const restoredProcessStateBase: Partial<ProcessState> = {
            initialPrompt: correctedInitialPrompt,
            loadedFiles: loadedFilesFromData,
            iterationHistory: loadedData.iterationHistory || [],
            devLog: loadedData.devLog || [],
            documentChunks: documentChunks,
            currentFocusChunkIndex: loadedData.currentFocusChunkIndex ?? null,
            isOutlineMode: loadedData.isOutlineMode ?? false,
            outlineId: loadedData.outlineId ?? null,
            currentOutline: loadedData.currentOutline ?? null,
            finalOutline: loadedData.finalOutline ?? null,
            projectId: loadedData.projectId,
            projectName: loadedData.projectName || DEFAULT_PROJECT_NAME_FALLBACK,
            projectObjective: loadedData.projectObjective || null,
            projectCodename: loadedData.projectCodename || null,
            isPlanActive: loadedData.isPlanActive ?? false,
            planStages: loadedData.planStages || [],
            savedPlanTemplates: loadedData.savedPlanTemplates || [],
            finalProduct: loadedData.finalProduct,
            currentProduct: loadedData.currentProductBeforeHalt || productAtLastIter,
            currentProductBeforeHalt: loadedData.currentProductBeforeHalt,
            currentVersionBeforeHalt: loadedData.currentVersionBeforeHalt,
            currentMajorVersion: loadedData.currentVersionBeforeHalt?.major ?? lastVersion.major,
            currentMinorVersion: loadedData.currentVersionBeforeHalt?.minor ?? lastVersion.minor,
            ensembleSubProducts: loadedData.ensembleSubProducts || null,
            isDocumentMapOpen: loadedData.isDocumentMapOpen ?? true,
            activeChunkId: loadedData.activeChunkId ?? null
        };
        
        const fullNewState: ProcessState = {
            ...initialProcessStateValues,
            ...restoredProcessStateBase,
            statusMessage: `Restored auto-saved session for "${restoredProcessStateBase.projectName || 'Untitled'}".`,
            aiProcessInsight: "Session restored. Review state and resume.",
        };

        updateProcessState(fullNewState);
        resetModelParameters();
        setAutoSaveStatus('loaded');
      } else {
        setAutoSaveStatus('not_found');
        updateProcessState({ statusMessage: 'Auto-saved session not found.' });
      }
    } catch (error) {
      console.error("Error restoring session:", error);
      setAutoSaveStatus('error');
      updateProcessState({ statusMessage: 'Failed to restore session.' });
    }
  }, [updateProcessState, overwriteUserTemplates, initialProcessStateValues, resetModelParameters]);

  const handleClearAutoSaveAndDismiss = useCallback(async () => {
    setAutoSaveStatus('clearing');
    setShowRestorePrompt(false);
    try {
      await storageService.clearState();
      setRestorableStateInfo(null);
      setAutoSaveStatus('cleared');
    } catch (error) {
      console.error("Error clearing auto-saved state:", error);
      setAutoSaveStatus('error');
    }
  }, []);

  return {
    autoSaveStatus,
    showRestorePrompt,
    restorableStateInfo,
    performAutoSave,
    handleRestoreAutoSave,
    handleClearAutoSaveAndDismiss,
  };
};