import { useState, useCallback } from 'react';
import type { ProcessState, LoadedFile, IterationLogEntry, ModelConfig, ApiStreamCallDetail, ParameterAdvice, PlanTemplate, FileProcessingInfo, SelectableModelName, AiResponseValidationInfo, DiffViewType } from '../types.ts';
import * as geminiService from '../services/geminiService';
import * as storageService from '../services/storageService';
import { INITIAL_PROJECT_NAME_STATE } from '../services/utils';
import { getProductSummary } from '../services/iterationUtils';
import { CONVERGED_PREFIX } from '../services/promptBuilderService'; // Moved from iterationUtils
import * as Diff from 'diff';


export const createInitialProcessState = (
  apiKeyStatusInput: 'loaded' | 'missing',
  selectedModelNameInput: SelectableModelName
): ProcessState => ({
  initialPrompt: "",
  currentProduct: null,
  iterationHistory: [],
  currentIteration: 0,
  maxIterations: 100,
  isProcessing: false,
  finalProduct: null,
  statusMessage: "Load input file(s), then configure model settings to begin.",
  apiKeyStatus: apiKeyStatusInput,
  loadedFiles: [],
  promptSourceName: null,
  selectedModelName: selectedModelNameInput,
  configAtFinalization: null,
  projectId: null,
  projectName: INITIAL_PROJECT_NAME_STATE,
  projectObjective: null,
  otherAppsData: {},
  lastAutoSavedAt: null,
  currentProductBeforeHalt: null,
  currentIterationBeforeHalt: undefined,
  promptChangedByFileLoad: false,
  outputParagraphShowHeadings: false,
  outputParagraphMaxHeadingDepth: 3,
  outputParagraphNumberedHeadings: false,
  isPlanActive: false,
  planStages: [],
  currentPlanStageIndex: null,
  currentStageIteration: 0,
  savedPlanTemplates: [],
  currentDiffViewType: 'words', // Default to words, no longer user-selectable
  aiProcessInsight: "System idle. Load files to begin.",
  isApiRateLimited: false,
  rateLimitCooldownActiveSeconds: 0,
  stagnationNudgeEnabled: true, // Added for this phase
});

export const useProcessState = () => {
  const [state, setState] = useState<ProcessState>(
    createInitialProcessState(
      geminiService.isApiKeyAvailable() ? 'loaded' : 'missing',
      geminiService.DEFAULT_MODEL_NAME as SelectableModelName
    )
  );

  const updateProcessState = useCallback((updates: Partial<ProcessState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleLoadedFilesChange = useCallback((newFiles: LoadedFile[]) => {
    let fileManifest = "";
    if (newFiles.length > 0) {
      fileManifest = `Input consists of ${newFiles.length} file(s): ${newFiles.map(f => `${f.name} (${f.mimeType})`).join(', ')}.`;
    }

    const newPromptSourceName = newFiles.length > 0
      ? (newFiles.length === 1 ? newFiles[0].name : `${newFiles.length} files loaded`)
      : null;

    updateProcessState({
      loadedFiles: newFiles,
      initialPrompt: fileManifest,
      promptSourceName: newPromptSourceName,
      promptChangedByFileLoad: true,
      currentProduct: null,
      iterationHistory: [],
      finalProduct: null,
      currentIteration: 0,
      statusMessage: newFiles.length > 0 ? "File(s) loaded. Configure model and start." : "Files cleared. Load new input.",
      aiProcessInsight: newFiles.length > 0 ? "Files loaded. Ready for processing." : "Input files cleared.",
      projectName: newFiles.length > 0 ? state.projectName : INITIAL_PROJECT_NAME_STATE,
    });
  }, [updateProcessState, state.projectName]);

  const addLogEntry = useCallback((logData: {
    iteration: number;
    currentFullProduct: string | null; // This is iterationProductForLog
    status: string;
    previousFullProduct?: string | null;
    promptSystemInstructionSent?: string;
    promptCoreUserInstructionsSent?: string;
    promptFullUserPromptSent?: string;
    apiStreamDetails?: ApiStreamCallDetail[];
    modelConfigUsed?: ModelConfig;
    readabilityScoreFlesch?: number;
    fileProcessingInfo: FileProcessingInfo;
    aiValidationInfo?: AiResponseValidationInfo;
    directAiResponseHead?: string;
    directAiResponseTail?: string;
    directAiResponseLengthChars?: number;
    processedProductHead?: string;
    processedProductTail?: string;
    processedProductLengthChars?: number;
  }) => {
    let productDiff: string | undefined = undefined;
    let linesAdded = 0;
    let linesRemoved = 0;

    const currentPForDiff = (logData.currentFullProduct ?? "").startsWith(CONVERGED_PREFIX)
                            ? (logData.currentFullProduct ?? "").substring(CONVERGED_PREFIX.length)
                            : (logData.currentFullProduct ?? "");
    const previousPForDiff = (logData.previousFullProduct ?? "").startsWith(CONVERGED_PREFIX)
                            ? (logData.previousFullProduct ?? "").substring(CONVERGED_PREFIX.length)
                            : (logData.previousFullProduct ?? "");

    if (logData.iteration === 0 || currentPForDiff !== previousPForDiff) {
        productDiff = Diff.createTwoFilesPatch(
            `iteration_content_prev.txt`, 
            `iteration_content_curr.txt`,
            previousPForDiff, 
            currentPForDiff,  
            undefined, undefined, { context: 3 } 
        );
        const lineChanges = Diff.diffLines(previousPForDiff, currentPForDiff, { newlineIsToken: true, ignoreWhitespace: false });
        lineChanges.forEach(part => {
            if (part.added) linesAdded += part.count || 0;
            if (part.removed) linesRemoved += part.count || 0;
        });
    } else {
        productDiff = undefined; linesAdded = 0; linesRemoved = 0;
    }

    const newEntry: IterationLogEntry = {
      iteration: logData.iteration,
      productSummary: getProductSummary(logData.currentFullProduct),
      status: logData.status,
      timestamp: Date.now(),
      productDiff: productDiff,
      linesAdded: linesAdded > 0 ? linesAdded : (logData.iteration === 0 && linesAdded === 0 ? 0 : undefined),
      linesRemoved: linesRemoved > 0 ? linesRemoved : undefined,
      readabilityScoreFlesch: logData.readabilityScoreFlesch,
      fileProcessingInfo: logData.fileProcessingInfo,
      promptSystemInstructionSent: logData.promptSystemInstructionSent,
      promptCoreUserInstructionsSent: logData.promptCoreUserInstructionsSent,
      promptFullUserPromptSent: logData.promptFullUserPromptSent,
      apiStreamDetails: logData.apiStreamDetails,
      modelConfigUsed: logData.modelConfigUsed,
      aiValidationInfo: logData.aiValidationInfo,
      directAiResponseHead: logData.directAiResponseHead,
      directAiResponseTail: logData.directAiResponseTail,
      directAiResponseLengthChars: logData.directAiResponseLengthChars,
      processedProductHead: logData.processedProductHead,
      processedProductTail: logData.processedProductTail,
      processedProductLengthChars: logData.processedProductLengthChars,
    };

    setState(prev => {
        const existingEntryIndex = prev.iterationHistory.findIndex(entry => entry.iteration === newEntry.iteration);
        let updatedHistory;
        if (existingEntryIndex !== -1) {
            updatedHistory = [...prev.iterationHistory];
            updatedHistory[existingEntryIndex] = newEntry;
        } else {
            updatedHistory = [...prev.iterationHistory, newEntry];
        }
        updatedHistory.sort((a, b) => a.iteration - b.iteration);
        return { ...prev, iterationHistory: updatedHistory };
    });
  }, []);


  const handleReset = useCallback(async (
        baseModelConfig: ModelConfig,
        baseModelParameterAdvice: ParameterAdvice,
        baseModelConfigRationales: string[],
        currentSavedPlanTemplates: PlanTemplate[]
    ) => {
    const resetApiKeyStatus = geminiService.isApiKeyAvailable() ? 'loaded' : 'missing';
    const resetSelectedModelName = geminiService.DEFAULT_MODEL_NAME as SelectableModelName;

    const initialStateFromCreator = createInitialProcessState(resetApiKeyStatus, resetSelectedModelName);

    const resetState: ProcessState = {
        ...initialStateFromCreator,
        apiKeyStatus: resetApiKeyStatus,
        selectedModelName: resetSelectedModelName,
        statusMessage: "System reset. Load input file(s) to begin.",
        aiProcessInsight: "System reset. Ready for new input.",
        savedPlanTemplates: currentSavedPlanTemplates,
        projectId: await storageService.hasSavedState() ? state.projectId : null,
        stagnationNudgeEnabled: true, 
        currentDiffViewType: 'words', 
    };
    setState(resetState);

  }, [state.projectId]);


  return {
    state,
    updateProcessState,
    handleLoadedFilesChange,
    addLogEntry,
    handleReset,
  };
};
