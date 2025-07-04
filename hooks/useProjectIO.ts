// hooks/useProjectIO.ts

import { useCallback, useRef, useEffect } from 'react';
import type { ProcessState, AutologosProjectFile, AutologosIterativeEngineData, ProjectFileHeader, ModelConfig, LoadedFile, PlanTemplate, SettingsSuggestionSource, SelectableModelName, IterationLogEntry, Version } from '../types.ts';
import { AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION, THIS_APP_ID, APP_VERSION, SELECTABLE_MODELS } from '../types.ts';
import { generateFileName, DEFAULT_PROJECT_NAME_FALLBACK } from '../services/utils.ts';
import { reconstructProduct } from '../services/diffService.ts';
import * as GeminaiService from '../services/geminiService.ts';
import { formatVersion } from '../services/versionUtils.ts';


function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type ModelParams = {
    temperature: number;
    topP: number;
    topK: number;
    settingsSuggestionSource: SettingsSuggestionSource;
    userManuallyAdjustedSettings: boolean;
};

export const useProjectIO = (
  processState: ProcessState,
  modelParams: ModelParams,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  overwriteUserTemplates: (templates: PlanTemplate[]) => void,
  initialProcessStateValues: ProcessState,
  initialModelParamValues: ModelParams,
  setLoadedModelParams: (params: ModelParams) => void
) => {
  const latestDataRef = useRef({ processState, modelParams });
  useEffect(() => {
    latestDataRef.current = { processState, modelParams };
  }, [processState, modelParams]);

  const handleExportProject = useCallback(async () => {
    const { processState: currentState, modelParams: currentModelParams } = latestDataRef.current;

    if (currentState.iterationHistory.length === 0 && currentState.loadedFiles.length === 0 && !currentState.initialPrompt.trim()) {
      updateProcessState({ statusMessage: "Nothing to export yet." });
      return;
    }

    const currentProjectId = currentState.projectId || uuidv4();

    const header: ProjectFileHeader = {
      fileFormatVersion: AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION,
      projectId: currentProjectId,
      projectName: currentState.projectName || DEFAULT_PROJECT_NAME_FALLBACK,
      projectObjective: currentState.projectObjective || undefined,
      createdAt: currentState.iterationHistory.length > 0 ? new Date(currentState.iterationHistory[0].timestamp).toISOString() : new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      lastExportedByAppId: THIS_APP_ID,
      lastExportedByAppVersion: APP_VERSION,
      appManifest: [{ appId: THIS_APP_ID, appName: "Autologos Iterative Engine", appVersion: APP_VERSION, dataDescription: "Iterative text processing data" }]
    };

    const engineData: AutologosIterativeEngineData = {
      initialPrompt: currentState.initialPrompt,
      iterationHistory: currentState.iterationHistory,
      maxMajorVersions: currentState.maxMajorVersions,
      temperature: currentModelParams.temperature,
      topP: currentModelParams.topP,
      topK: currentModelParams.topK,
      settingsSuggestionSource: currentModelParams.settingsSuggestionSource,
      userManuallyAdjustedSettings: currentModelParams.userManuallyAdjustedSettings,
      selectedModelName: currentState.selectedModelName,
      finalProduct: currentState.finalProduct,
      currentProductBeforeHalt: currentState.currentProductBeforeHalt,
      currentVersionBeforeHalt: currentState.currentVersionBeforeHalt,
      promptSourceName: currentState.promptSourceName,
      configAtFinalization: currentState.configAtFinalization,
      loadedFiles: currentState.loadedFiles,
      lastAutoSavedAt: currentState.lastAutoSavedAt,
      outputParagraphShowHeadings: currentState.outputParagraphShowHeadings,
      outputParagraphMaxHeadingDepth: currentState.outputParagraphMaxHeadingDepth,
      outputParagraphNumberedHeadings: currentState.outputParagraphNumberedHeadings,
      isPlanActive: currentState.isPlanActive,
      planStages: currentState.planStages,
      currentPlanStageIndex: currentState.currentPlanStageIndex,
      savedPlanTemplates: currentState.savedPlanTemplates,
      currentDiffViewType: currentState.currentDiffViewType,
      projectName: currentState.projectName,
      projectObjective: currentState.projectObjective,
      projectId: currentProjectId,
      isApiRateLimited: currentState.isApiRateLimited,
      rateLimitCooldownActiveSeconds: currentState.rateLimitCooldownActiveSeconds,
      stagnationNudgeEnabled: currentState.stagnationNudgeEnabled,
      isSearchGroundingEnabled: currentState.isSearchGroundingEnabled,
      isUrlBrowsingEnabled: currentState.isUrlBrowsingEnabled,
      inputComplexity: currentState.inputComplexity,
      strategistInfluenceLevel: currentState.strategistInfluenceLevel, 
      stagnationNudgeAggressiveness: currentState.stagnationNudgeAggressiveness, 
      devLog: currentState.devLog,
      bootstrapSamples: currentState.bootstrapSamples,
      bootstrapSampleSizePercent: currentState.bootstrapSampleSizePercent,
      bootstrapSubIterations: currentState.bootstrapSubIterations,
      ensembleSubProducts: currentState.ensembleSubProducts,
    };

    const projectFile: AutologosProjectFile = {
      header: header,
      applicationData: {
        [THIS_APP_ID]: engineData
      }
    };

    const fileName = generateFileName(currentState.projectName, "project", "autologos.json");
    const blob = new Blob([JSON.stringify(projectFile, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    updateProcessState({ statusMessage: "Project exported successfully.", projectId: currentProjectId });
  }, [updateProcessState]);

  const handleImportProjectData = useCallback((projectFile: AutologosProjectFile) => {
    if (!projectFile.header || !projectFile.header.fileFormatVersion?.startsWith("AutologosProjectFile/")) {
      updateProcessState({ statusMessage: `Error: Invalid or unsupported project file format.` });
      return;
    }
    if (!projectFile.applicationData || !projectFile.applicationData[THIS_APP_ID]) {
      updateProcessState({ statusMessage: `Error: Project file does not contain data for this application (${THIS_APP_ID}).` });
      return;
    }

    const engineData = projectFile.applicationData[THIS_APP_ID] as AutologosIterativeEngineData;

    if (Array.isArray(engineData.savedPlanTemplates)) {
      overwriteUserTemplates(engineData.savedPlanTemplates);
    } else {
      overwriteUserTemplates([]);
    }

    let correctedInitialPrompt = engineData.initialPrompt;
    const loadedFilesFromData = engineData.loadedFiles || [];
    if (loadedFilesFromData.length > 0) {
        correctedInitialPrompt = `Input consists of ${loadedFilesFromData.length} file(s): ${loadedFilesFromData.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)}KB)`).join('; ')}.`;
    }

    const lastEntry = engineData.iterationHistory && engineData.iterationHistory.length > 0 ? [...engineData.iterationHistory].sort((a,b) => b.majorVersion - a.majorVersion || b.minorVersion - a.minorVersion)[0] : null;
    const lastVersion = lastEntry ? { major: lastEntry.majorVersion, minor: lastEntry.minorVersion, patch: lastEntry.patchVersion } : { major: 0, minor: 0 };
    
    const { product: productAtLastIter } = reconstructProduct(lastVersion, engineData.iterationHistory, correctedInitialPrompt);

    const importedProcessStateBase: Partial<ProcessState> = {
      ...engineData,
      initialPrompt: correctedInitialPrompt,
      loadedFiles: loadedFilesFromData,    
      projectId: projectFile.header.projectId,
      projectName: projectFile.header.projectName || DEFAULT_PROJECT_NAME_FALLBACK,
      projectObjective: projectFile.header.projectObjective || null,
      devLog: engineData.devLog || [],
      ensembleSubProducts: engineData.ensembleSubProducts || null,
    };

    const fullNewState: ProcessState = {
      ...initialProcessStateValues,
      ...importedProcessStateBase,
      apiKeyStatus: initialProcessStateValues.apiKeyStatus,
      isProcessing: false,
      statusMessage: `Project "${projectFile.header.projectName || 'Imported Project'}" imported successfully.`,
      currentProduct: engineData.currentProductBeforeHalt || productAtLastIter,
      currentMajorVersion: engineData.currentVersionBeforeHalt?.major ?? lastVersion.major,
      currentMinorVersion: engineData.currentVersionBeforeHalt?.minor ?? lastVersion.minor,
      currentStageIteration: 0,
      selectedModelName: engineData.selectedModelName || initialProcessStateValues.selectedModelName,
      planStages: engineData.planStages || [],
      savedPlanTemplates: engineData.savedPlanTemplates || [], 
      iterationHistory: engineData.iterationHistory || [],
      outputParagraphShowHeadings: engineData.outputParagraphShowHeadings ?? initialProcessStateValues.outputParagraphShowHeadings,
      outputParagraphMaxHeadingDepth: engineData.outputParagraphMaxHeadingDepth ?? initialProcessStateValues.outputParagraphMaxHeadingDepth,
      outputParagraphNumberedHeadings: engineData.outputParagraphNumberedHeadings ?? initialProcessStateValues.outputParagraphNumberedHeadings,
      isPlanActive: engineData.isPlanActive ?? false,
      currentDiffViewType: engineData.currentDiffViewType || 'words',
      aiProcessInsight: "Project loaded. Review state and resume or start new process.",
      stagnationNudgeEnabled: engineData.stagnationNudgeEnabled ?? initialProcessStateValues.stagnationNudgeEnabled,
      isSearchGroundingEnabled: engineData.isSearchGroundingEnabled ?? initialProcessStateValues.isSearchGroundingEnabled,
      isUrlBrowsingEnabled: engineData.isUrlBrowsingEnabled ?? initialProcessStateValues.isUrlBrowsingEnabled,
      strategistInfluenceLevel: engineData.strategistInfluenceLevel ?? initialProcessStateValues.strategistInfluenceLevel, 
      stagnationNudgeAggressiveness: engineData.stagnationNudgeAggressiveness ?? initialProcessStateValues.stagnationNudgeAggressiveness, 
    };
    updateProcessState(fullNewState);

    setLoadedModelParams({
      temperature: engineData.temperature ?? initialModelParamValues.temperature,
      topP: engineData.topP ?? initialModelParamValues.topP,
      topK: engineData.topK ?? initialModelParamValues.topK,
      settingsSuggestionSource: engineData.settingsSuggestionSource ?? initialModelParamValues.settingsSuggestionSource,
      userManuallyAdjustedSettings: engineData.userManuallyAdjustedSettings ?? initialModelParamValues.userManuallyAdjustedSettings,
    });
    updateProcessState({statusMessage: `Project "${fullNewState.projectName}" imported successfully.`});

  }, [updateProcessState, overwriteUserTemplates, initialProcessStateValues, initialModelParamValues, setLoadedModelParams]);

  const handleImportIterationLogData = useCallback((
    logData: IterationLogEntry[],
    originalFilename: string
  ) => {
      // This function needs significant rework for versioning and is complex.
      // For now, it will be simplified to avoid introducing bugs.
      updateProcessState({ statusMessage: "Importing from plain log files is currently disabled due to versioning changes." });

  }, [updateProcessState]);

  const handleExportIterationDiffs = useCallback(() => {
    const { processState: currentState } = latestDataRef.current;
    if (currentState.iterationHistory.length === 0) {
      updateProcessState({ statusMessage: "No history to export diffs from." });
      return;
    }
    const diffs = currentState.iterationHistory.map(entry => `==== Version ${formatVersion(entry)} ====\n${entry.productDiff || 'No diff available.'}`).join('\n\n');
    const fileName = generateFileName(currentState.projectName, "diffs", "txt");
    const blob = new Blob([diffs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [updateProcessState]);

  return { handleExportProject, handleImportProjectData, handleImportIterationLogData, handleExportIterationDiffs };
};
