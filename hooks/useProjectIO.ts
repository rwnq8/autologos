

import { useCallback } from 'react';
import type { ProcessState, AutologosProjectFile, AutologosIterativeEngineData, ProjectFileHeader, ModelConfig, LoadedFile, PlanTemplate, SettingsSuggestionSource, SelectableModelName, PortableDiffsFile, PortableDiffEntry, IterationLogEntry } from '../types.ts';
import { AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION, THIS_APP_ID, APP_VERSION, PORTABLE_DIFFS_FILE_FORMAT_VERSION } from '../types.ts';
import { generateFileName, DEFAULT_PROJECT_NAME_FALLBACK } from '../services/utils';
import { reconstructProduct } from '../services/diffService'; 
import { getProductSummary } from '../services/iterationUtils.ts';
import { calculateFleschReadingEase } from '../services/textAnalysisService.ts';

// Basic UUID v4 generator
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

    if (currentState.iterationHistory.length === 0 && currentState.loadedFiles.length === 0) {
      updateProcessState({ statusMessage: "Nothing to export yet." });
      return;
    }

    const currentProjectId = currentState.projectId || uuidv4();
    // No direct update to projectId here to avoid re-renders during export. It'll be set if imported or on next save.

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
      stagnationNudgeEnabled: currentState.stagnationNudgeEnabled,
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
    // This function now expects parsed projectFile data
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
      apiKeyStatus: initialProcessStateValues.apiKeyStatus, // Keep current API key status
      isProcessing: false, 
      statusMessage: `Project "${projectFile.header.projectName || 'Imported Project'}" imported successfully.`,
      currentProduct: engineData.currentProductBeforeHalt || productAtLastIter,
      currentIteration: engineData.currentIterationBeforeHalt ?? lastIter,
      selectedModelName: engineData.selectedModelName || initialProcessStateValues.selectedModelName,
      loadedFiles: engineData.loadedFiles || [],
      planStages: engineData.planStages || [],
      savedPlanTemplates: engineData.savedPlanTemplates || [], // Already handled by overwriteUserPlanTemplates
      iterationHistory: engineData.iterationHistory || [],
      outputParagraphShowHeadings: engineData.outputParagraphShowHeadings ?? initialProcessStateValues.outputParagraphShowHeadings,
      outputParagraphMaxHeadingDepth: engineData.outputParagraphMaxHeadingDepth ?? initialProcessStateValues.outputParagraphMaxHeadingDepth,
      outputParagraphNumberedHeadings: engineData.outputParagraphNumberedHeadings ?? initialProcessStateValues.outputParagraphNumberedHeadings,
      isPlanActive: engineData.isPlanActive ?? false,
      currentDiffViewType: engineData.currentDiffViewType || 'words',
      aiProcessInsight: "Project loaded. Review state and resume or start new process.", 
      stagnationNudgeEnabled: engineData.stagnationNudgeEnabled ?? initialProcessStateValues.stagnationNudgeEnabled,
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

  const handleImportPortableDiffsData = useCallback((diffsFile: PortableDiffsFile) => {
    updateProcessState({ statusMessage: `Importing portable diffs for "${diffsFile.projectName || 'project'}"...` });

    if (diffsFile.portableDiffsVersion !== PORTABLE_DIFFS_FILE_FORMAT_VERSION) {
        updateProcessState({ statusMessage: `Error: Unsupported portable diffs file version. Expected ${PORTABLE_DIFFS_FILE_FORMAT_VERSION}.` });
        return;
    }

    const newIterationHistory: IterationLogEntry[] = [];
    let currentProductFromDiffs = diffsFile.initialPromptManifest;

    // Create Iteration 0 (Initial State)
    newIterationHistory.push({
        iteration: 0,
        productSummary: getProductSummary(diffsFile.initialPromptManifest),
        status: "Initial state from diffs file.",
        timestamp: Date.parse(diffsFile.exportedAt) || Date.now(), // Use exportedAt or current time
        productDiff: undefined, // No diff for iteration 0 relative to itself
        linesAdded: 0, // Assuming initial state is the "addition"
        linesRemoved: 0,
        readabilityScoreFlesch: calculateFleschReadingEase(diffsFile.initialPromptManifest),
        fileProcessingInfo: { // Minimal file info
            filesSentToApiIteration: null,
            numberOfFilesActuallySent: 0, // Cannot determine from diffs file
            totalFilesSizeBytesSent: 0,
            fileManifestProvidedCharacterCount: diffsFile.initialPromptManifest.length,
        },
        // Other diagnostic fields will be undefined
    });
    
    // Process subsequent diffs
    if (diffsFile.diffs && diffsFile.diffs.length > 0) {
        // Sort diffs by iteration just in case they are not in order
        const sortedDiffs = [...diffsFile.diffs].sort((a, b) => a.iteration - b.iteration);

        for (const diffEntry of sortedDiffs) {
            if (diffEntry.iteration === 0) continue; // Iteration 0 handled above

            const reconstructed = reconstructProduct(diffEntry.iteration, newIterationHistory, diffsFile.initialPromptManifest);
            if (reconstructed.error) {
                 console.error(`Error reconstructing product at iteration ${diffEntry.iteration} from diffs: ${reconstructed.error}`);
                 // Potentially stop or add an error log entry
            }
            currentProductFromDiffs = reconstructed.product;

            newIterationHistory.push({
                iteration: diffEntry.iteration,
                productSummary: getProductSummary(currentProductFromDiffs),
                status: `Reconstructed from diff (Iter. ${diffEntry.iteration})`,
                timestamp: Date.parse(diffsFile.exportedAt) + diffEntry.iteration, // Stagger timestamps
                productDiff: diffEntry.productDiff,
                // linesAdded/Removed would need to be re-calculated if desired, or left undefined
                readabilityScoreFlesch: calculateFleschReadingEase(currentProductFromDiffs),
                // Other fields minimal or undefined
                 fileProcessingInfo: {
                    filesSentToApiIteration: null, numberOfFilesActuallySent: 0, totalFilesSizeBytesSent: 0,
                    fileManifestProvidedCharacterCount: 0, // Not applicable per-iteration from this file type
                },
            });
        }
    }


    const finalProductName = diffsFile.diffs.length > 0 ? currentProductFromDiffs : diffsFile.initialPromptManifest;
    const lastIterationNumber = diffsFile.diffs.length > 0 ? newIterationHistory[newIterationHistory.length - 1].iteration : 0;

    updateProcessState({
        ...initialProcessStateValues, // Reset to a clean slate before applying diffs data
        initialPrompt: diffsFile.initialPromptManifest,
        iterationHistory: newIterationHistory,
        currentProduct: finalProductName,
        finalProduct: finalProductName, // Assume diffs represent a completed process
        currentIteration: lastIterationNumber,
        projectName: diffsFile.projectName || "Imported Diffs Project",
        projectId: diffsFile.projectId || uuidv4(),
        statusMessage: `Portable diffs for "${diffsFile.projectName || 'project'}" imported. ${newIterationHistory.length -1} iterations reconstructed.`,
        isProcessing: false,
        loadedFiles: [], // Diffs file doesn't contain original loaded files data
        aiProcessInsight: "State reconstructed from portable diffs file.",
        selectedModelName: initialProcessStateValues.selectedModelName,
        maxIterations: lastIterationNumber > initialProcessStateValues.maxIterations ? lastIterationNumber : initialProcessStateValues.maxIterations,
    });
    // Also reset actual model parameters in useModelParameters hook
    setLoadedModelParams({
        temperature: initialModelParamValues.temperature,
        topP: initialModelParamValues.topP,
        topK: initialModelParamValues.topK,
        settingsSuggestionSource: 'mode',
        userManuallyAdjustedSettings: false,
    });


  }, [updateProcessState, initialProcessStateValues, initialModelParamValues, setLoadedModelParams, reconstructProduct]);


  const handleExportPortableDiffs = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState.iterationHistory || currentState.iterationHistory.length === 0) {
      updateProcessState({ statusMessage: "No diffs to export yet." });
      return;
    }

    const portableDiffsData: PortableDiffsFile = {
      portableDiffsVersion: PORTABLE_DIFFS_FILE_FORMAT_VERSION,
      projectId: currentState.projectId || null,
      projectName: currentState.projectName || DEFAULT_PROJECT_NAME_FALLBACK,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      initialPromptManifest: currentState.initialPrompt, 
      diffs: currentState.iterationHistory
        .filter(entry => entry.iteration > 0 || (entry.iteration === 0 && currentState.initialPrompt)) // Include iter 0 only if initialPrompt exists
        .map(entry => ({
          iteration: entry.iteration,
          // For iter 0, productDiff is conceptually the initialPrompt itself if we diff from ""
          // However, typical diff files start from iter 1 changes against iter 0 product.
          // The stored productDiff for iter 0 is usually from "" to initial product.
          // Let's ensure we store the diff that led to this iteration's state.
          productDiff: entry.productDiff || null 
      }))
    };

    const fileName = generateFileName(currentState.projectName, "diffs_portable", "json");
    const blob = new Blob([JSON.stringify(portableDiffsData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    updateProcessState({ statusMessage: "Portable diffs exported successfully." });
  }, [stateRef, updateProcessState]);

  return { handleExportProject, handleImportProjectData, handleExportPortableDiffs, handleImportPortableDiffsData };
};