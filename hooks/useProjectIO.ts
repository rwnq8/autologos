
import { useCallback } from 'react';
import type { ProcessState, AutologosProjectFile, AutologosIterativeEngineData, ProjectFileHeader, ModelConfig, LoadedFile, PlanTemplate, SettingsSuggestionSource, SelectableModelName, IterationLogEntry } from '../types.ts';
import { AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION, THIS_APP_ID, APP_VERSION, SELECTABLE_MODELS } from '../types.ts';
import { generateFileName, DEFAULT_PROJECT_NAME_FALLBACK } from '../services/utils';
import { reconstructProduct } from '../services/diffService';
import * as GeminaiService from '../services/geminiService';


function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const useProjectIO = (
  stateRef: React.MutableRefObject<ProcessState>,
  modelParamsRef: React.MutableRefObject<{temperature: number, topP: number, topK: number, settingsSuggestionSource: SettingsSuggestionSource, userManuallyAdjustedSettings: boolean}>,
  updateProcessState: (updates: Partial<ProcessState>) => void,
  overwriteUserPlanTemplates: (templates: PlanTemplate[]) => void,
  initialProcessStateValues: ProcessState,
  initialModelParamValues: {temperature: number, topP: number, topK: number, settingsSuggestionSource: SettingsSuggestionSource, userManuallyAdjustedSettings: boolean},
  setLoadedModelParams: (params: {temperature: number, topP: number, topK: number, settingsSuggestionSource: SettingsSuggestionSource, userManuallyAdjustedSettings: boolean}) => void

) => {
  const handleExportProject = useCallback(async () => {
    const currentState = stateRef.current;
    const currentModelParams = modelParamsRef.current;

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
      projectId: currentProjectId,
      isApiRateLimited: currentState.isApiRateLimited,
      rateLimitCooldownActiveSeconds: currentState.rateLimitCooldownActiveSeconds,
      stagnationNudgeEnabled: currentState.stagnationNudgeEnabled,
      inputComplexity: currentState.inputComplexity,
      strategistInfluenceLevel: currentState.strategistInfluenceLevel, // Added
      stagnationNudgeAggressiveness: currentState.stagnationNudgeAggressiveness, // Added
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
  }, [stateRef, modelParamsRef, updateProcessState]);

  const handleImportProjectData = useCallback((projectFile: AutologosProjectFile) => {
    if (!projectFile.header || projectFile.header.fileFormatVersion !== AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION) {
      updateProcessState({ statusMessage: `Error: Invalid or unsupported project file format. Expected ${AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION}.` });
      return;
    }
    if (!projectFile.applicationData || !projectFile.applicationData[THIS_APP_ID]) {
      updateProcessState({ statusMessage: `Error: Project file does not contain data for this application (${THIS_APP_ID}).` });
      return;
    }

    const engineData = projectFile.applicationData[THIS_APP_ID] as AutologosIterativeEngineData;

    if (Array.isArray(engineData.savedPlanTemplates)) {
      overwriteUserPlanTemplates(engineData.savedPlanTemplates);
    } else {
      overwriteUserPlanTemplates([]);
    }

    const lastIter = engineData.iterationHistory && engineData.iterationHistory.length > 0 ? engineData.iterationHistory[engineData.iterationHistory.length -1].iteration : 0;
    const productAtLastIter = engineData.finalProduct || (engineData.iterationHistory && engineData.iterationHistory.length > 0 ? reconstructProduct(lastIter, engineData.iterationHistory, engineData.initialPrompt).product : engineData.initialPrompt);

    const importedProcessStateBase: Partial<ProcessState> = {
      ...engineData,
      projectId: projectFile.header.projectId,
      projectName: projectFile.header.projectName || DEFAULT_PROJECT_NAME_FALLBACK,
      projectObjective: projectFile.header.projectObjective || null,
    };

    const fullNewState: ProcessState = {
      ...initialProcessStateValues,
      ...importedProcessStateBase,
      apiKeyStatus: initialProcessStateValues.apiKeyStatus,
      isProcessing: false,
      statusMessage: `Project "${projectFile.header.projectName || 'Imported Project'}" imported successfully.`,
      currentProduct: engineData.currentProductBeforeHalt || productAtLastIter,
      currentIteration: engineData.currentIterationBeforeHalt ?? lastIter,
      selectedModelName: engineData.selectedModelName || initialProcessStateValues.selectedModelName,
      loadedFiles: engineData.loadedFiles || [],
      planStages: engineData.planStages || [],
      savedPlanTemplates: engineData.savedPlanTemplates || [], // ensure this is from engineData if present
      iterationHistory: engineData.iterationHistory || [],
      outputParagraphShowHeadings: engineData.outputParagraphShowHeadings ?? initialProcessStateValues.outputParagraphShowHeadings,
      outputParagraphMaxHeadingDepth: engineData.outputParagraphMaxHeadingDepth ?? initialProcessStateValues.outputParagraphMaxHeadingDepth,
      outputParagraphNumberedHeadings: engineData.outputParagraphNumberedHeadings ?? initialProcessStateValues.outputParagraphNumberedHeadings,
      isPlanActive: engineData.isPlanActive ?? false,
      currentDiffViewType: engineData.currentDiffViewType || 'words',
      aiProcessInsight: "Project loaded. Review state and resume or start new process.",
      stagnationNudgeEnabled: engineData.stagnationNudgeEnabled ?? initialProcessStateValues.stagnationNudgeEnabled,
      strategistInfluenceLevel: engineData.strategistInfluenceLevel ?? initialProcessStateValues.strategistInfluenceLevel, // Added
      stagnationNudgeAggressiveness: engineData.stagnationNudgeAggressiveness ?? initialProcessStateValues.stagnationNudgeAggressiveness, // Added
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

  }, [updateProcessState, overwriteUserPlanTemplates, initialProcessStateValues, initialModelParamValues, setLoadedModelParams]);

  const handleImportIterationLogData = useCallback((
    logData: IterationLogEntry[],
    originalFilename: string
  ) => {
    if (!logData || logData.length === 0) {
      updateProcessState({ statusMessage: "Error: Imported log data is empty or invalid." });
      return;
    }

    const restoredState: Partial<ProcessState> = {
        ...initialProcessStateValues,
        apiKeyStatus: stateRef.current.apiKeyStatus,
        savedPlanTemplates: stateRef.current.savedPlanTemplates, // Keep current user's templates
    };

    restoredState.iterationHistory = logData;
    const lastLogEntry = logData[logData.length - 1];
    restoredState.currentIteration = lastLogEntry.iteration;
    
    // Try to find the initial prompt from Iteration 0 if it exists and no files were used for it.
    const iterZeroEntry = logData.find(entry => entry.iteration === 0);
    let basePromptForReconstruction = "";
    if (iterZeroEntry) {
        if (iterZeroEntry.fileProcessingInfo && iterZeroEntry.fileProcessingInfo.numberOfFilesActuallySent === 0 && iterZeroEntry.promptFullUserPromptSent) {
           // If iter 0 had no files but had a full user prompt, use that as the base
           basePromptForReconstruction = iterZeroEntry.promptFullUserPromptSent;
           restoredState.initialPrompt = basePromptForReconstruction;
           restoredState.loadedFiles = [];
           restoredState.promptSourceName = "Restored from Log (Direct Prompt)";
        } else if (iterZeroEntry.fileProcessingInfo && iterZeroEntry.fileProcessingInfo.fileManifestProvidedCharacterCount > 0 && iterZeroEntry.promptFullUserPromptSent) {
            // If iter 0 had files, the manifest from its full prompt is the "initialPrompt" for consistency
            basePromptForReconstruction = iterZeroEntry.promptFullUserPromptSent.substring(0, iterZeroEntry.fileProcessingInfo.fileManifestProvidedCharacterCount);
            restoredState.initialPrompt = basePromptForReconstruction;
            // We don't have the actual file content here, so loadedFiles remains empty. The process relied on the manifest.
            restoredState.loadedFiles = []; 
            restoredState.promptSourceName = "Restored from Log (Files Manifest Only)";
        } else {
            restoredState.initialPrompt = "Initial prompt not available in log for Iteration 0.";
            restoredState.loadedFiles = [];
            restoredState.promptSourceName = "Restored from Log (Prompt Unavailable)";
        }
    }


    const { product: reconstructedLastProduct, error: reconstructionError } = reconstructProduct(
      lastLogEntry.iteration, logData, basePromptForReconstruction
    );

    if (reconstructionError) {
      updateProcessState({ statusMessage: `Error reconstructing product from log: ${reconstructionError}` });
      return;
    }
    restoredState.currentProduct = reconstructedLastProduct;

    let importedMaxIterations = initialProcessStateValues.maxIterations;
    if (lastLogEntry.promptCoreUserInstructionsSent) {
        const match = lastLogEntry.promptCoreUserInstructionsSent.match(/Iteration \d+ of (\d+)/);
        if (match && match[1]) importedMaxIterations = parseInt(match[1], 10);
    } else if (lastLogEntry.promptSystemInstructionSent) {
        const match = lastLogEntry.promptSystemInstructionSent.match(/over (\d+) iterations/);
         if (match && match[1]) importedMaxIterations = parseInt(match[1], 10);
    }
    restoredState.maxIterations = importedMaxIterations > 0 ? importedMaxIterations : 100;

    const importedModelConfig = lastLogEntry.modelConfigUsed || initialModelParamValues;
    setLoadedModelParams({
      temperature: importedModelConfig.temperature,
      topP: importedModelConfig.topP,
      topK: importedModelConfig.topK,
      settingsSuggestionSource: 'manual',
      userManuallyAdjustedSettings: true,
    });

    let modelNameFromLog: SelectableModelName | undefined = lastLogEntry.currentModelForIteration;
    if (!modelNameFromLog && lastLogEntry.modelConfigUsed?.modelName) {
        modelNameFromLog = lastLogEntry.modelConfigUsed.modelName;
    }
    if (!modelNameFromLog) { // Fallback further if still not found
        const modelMatch = lastLogEntry.status.match(/model ['"](.*?)['"]/i) ||
                           (lastLogEntry.promptSystemInstructionSent || "").match(/model:\s*['"]?(.*?)['"\s]/i);
        if (modelMatch && modelMatch[1]) {
            const foundModel = SELECTABLE_MODELS.find(m => m.name.includes(modelMatch[1]) || m.displayName.includes(modelMatch[1]));
            if (foundModel) modelNameFromLog = foundModel.name;
        }
    }
    restoredState.selectedModelName = modelNameFromLog || stateRef.current.selectedModelName || GeminaiService.DEFAULT_MODEL_NAME;


    let pName = "Restored Log Project";
    const nameMatch = originalFilename.match(/^(.*?)(_project|_log)?(_\d{8}_\d{6})?\.json$/i);
    if (nameMatch && nameMatch[1] && nameMatch[1].toLowerCase() !== "untitled project") {
      pName = nameMatch[1].replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
      pName = pName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    restoredState.projectName = pName;
    restoredState.projectId = uuidv4();

    restoredState.finalProduct = null;
    restoredState.isProcessing = false;
    restoredState.configAtFinalization = null;
    restoredState.currentProductBeforeHalt = null;
    restoredState.currentIterationBeforeHalt = undefined;
    restoredState.isPlanActive = false; // Logs don't store full plan state easily
    restoredState.planStages = [];
    restoredState.currentPlanStageIndex = null;
    restoredState.currentStageIteration = 0;
    restoredState.statusMessage = `State restored from log: ${originalFilename}. Last Iteration: ${lastLogEntry.iteration}.`;
    restoredState.aiProcessInsight = "Review restored state. You can resume, rewind, or reset.";
    restoredState.stagnationNudgeEnabled = initialProcessStateValues.stagnationNudgeEnabled;
    restoredState.currentDiffViewType = 'words';
    restoredState.strategistInfluenceLevel = initialProcessStateValues.strategistInfluenceLevel;
    restoredState.stagnationNudgeAggressiveness = initialProcessStateValues.stagnationNudgeAggressiveness;
    restoredState.inputComplexity = initialProcessStateValues.inputComplexity; // Or re-calculate based on reconstructed product


    updateProcessState(restoredState as ProcessState);

  }, [updateProcessState, setLoadedModelParams, initialProcessStateValues, initialModelParamValues, stateRef]);


  return { handleExportProject, handleImportProjectData, handleImportIterationLogData };
};