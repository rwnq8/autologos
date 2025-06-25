import { useState, useCallback } from 'react';
import type { ProcessState, LoadedFile, IterationLogEntry, ModelConfig, ApiStreamCallDetail, ParameterAdvice, PlanTemplate, FileProcessingInfo, SelectableModelName, AiResponseValidationInfo, DiffViewType, StagnationInfo, IterationEntryType, DevLogEntry } from '../types.ts'; // Added DevLogEntry
import * as geminiService from '../services/geminiService';
import * as storageService from '../services/storageService';
import { INITIAL_PROJECT_NAME_STATE } from '../services/utils';
import { getProductSummary } from '../services/iterationUtils';
import { CONVERGED_PREFIX } from '../services/promptBuilderService';
import * as Diff from 'diff';


export const createInitialProcessState = (
  apiKeyStatusInput: 'loaded' | 'missing',
  selectedModelNameInput: SelectableModelName
): ProcessState => ({
  initialPrompt: "",
  currentProduct: null,
  iterationHistory: [],
  currentIteration: 0,
  maxIterations: 40, // Production default
  isProcessing: false,
  finalProduct: null,
  statusMessage: "Load input file(s) or type prompt, then configure model settings to begin.",
  apiKeyStatus: apiKeyStatusInput,
  loadedFiles: [],
  promptSourceName: null,
  selectedModelName: selectedModelNameInput,
  configAtFinalization: null,
  projectId: null,
  projectName: INITIAL_PROJECT_NAME_STATE,
  projectObjective: null,
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
  currentDiffViewType: 'words',
  aiProcessInsight: "System idle. Load input to begin.",
  isApiRateLimited: false,
  rateLimitCooldownActiveSeconds: 0,
  stagnationNudgeEnabled: true,
  stagnationInfo: { 
    isStagnant: false, 
    consecutiveStagnantIterations: 0, 
    similarityWithPrevious: undefined, 
    nudgeStrategyApplied: 'none',
    consecutiveLowValueIterations: 0, 
    lastProductLengthForStagnation: undefined 
  },
  inputComplexity: 'SIMPLE',
  currentModelForIteration: selectedModelNameInput,
  currentAppliedModelConfig: null,
  activeMetaInstructionForNextIter: undefined,
  strategistInfluenceLevel: 'OVERRIDE_FULL',
  stagnationNudgeAggressiveness: 'MEDIUM',
  isTargetedRefinementModalOpen: false,
  currentTextSelectionForRefinement: null,
  instructionsForSelectionRefinement: "",
  isEditingCurrentProduct: false,
  editedProductBuffer: null,
  devLog: [], // Initialize devLog as an empty array
});

const calculateInputComplexity = (initialPrompt: string, loadedFiles: LoadedFile[]): 'SIMPLE' | 'MODERATE' | 'COMPLEX' => {
  const totalFilesSize = loadedFiles.reduce((sum, file) => sum + file.size, 0);
  const promptTextLength = initialPrompt?.trim().length || 0;

  if (loadedFiles.length === 0 && promptTextLength < 500) return 'SIMPLE';
  if (loadedFiles.length === 1 && loadedFiles[0].size < 50 * 1024 && promptTextLength < 1000) return 'SIMPLE';
  if (loadedFiles.length <= 3 && totalFilesSize < 200 * 1024 && promptTextLength < 5000) return 'MODERATE';
  return 'COMPLEX';
};

export type AddLogEntryParams = {
  iteration: number;
  entryType?: IterationEntryType;
  currentFullProduct: string | null;
  status: string;
  previousFullProduct?: string | null;
  promptSystemInstructionSent?: string;
  promptCoreUserInstructionsSent?: string;
  promptFullUserPromptSent?: string;
  apiStreamDetails?: ApiStreamCallDetail[];
  modelConfigUsed?: ModelConfig;
  readabilityScoreFlesch?: number;
  lexicalDensity?: number;
  avgSentenceLength?: number;
  typeTokenRatio?: number;
  fileProcessingInfo: FileProcessingInfo;
  aiValidationInfo?: AiResponseValidationInfo;
  directAiResponseHead?: string;
  directAiResponseTail?: string;
  directAiResponseLengthChars?: number;
  processedProductHead?: string;
  processedProductTail?: string;
  processedProductLengthChars?: number;
  attemptCount?: number;
  strategyRationale?: string;
  currentModelForIteration?: SelectableModelName;
  activeMetaInstruction?: string;
  isSegmentedSynthesis?: boolean;
  isTargetedRefinement?: boolean;
  targetedSelection?: string;
  targetedRefinementInstructions?: string;
};


export const useProcessState = () => {
  const [state, setState] = useState<ProcessState>(
    createInitialProcessState(
      geminiService.isApiKeyAvailable() ? 'loaded' : 'missing',
      geminiService.DEFAULT_MODEL_NAME
    )
  );

  const updateProcessState = useCallback((updates: Partial<ProcessState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleLoadedFilesChange = useCallback((newlySelectedFiles: LoadedFile[], action: 'add' | 'remove' | 'clear' = 'add') => {
    setState(prev => {
      let updatedLoadedFiles: LoadedFile[];
      let newInitialPrompt = "";
      let statusMessageUpdate = "";
      let aiInsightUpdate = "";
      let resetProcessFields = false;

      if (action === 'clear') {
        updatedLoadedFiles = [];
        resetProcessFields = true;
        statusMessageUpdate = "All files cleared. Load new input to begin.";
        aiInsightUpdate = "Input files cleared.";
        newInitialPrompt = "";
      } else if (action === 'remove') {
        const fileToRemoveName = newlySelectedFiles[0]?.name;
        updatedLoadedFiles = prev.loadedFiles.filter(f => f.name !== fileToRemoveName);
        if (updatedLoadedFiles.length === 0) {
            resetProcessFields = true;
            statusMessageUpdate = "Last file removed. Load new input to begin.";
            aiInsightUpdate = "Input files cleared.";
            newInitialPrompt = "";
        } else {
            statusMessageUpdate = `File "${fileToRemoveName}" removed.`;
            aiInsightUpdate = `${updatedLoadedFiles.length} file(s) remain loaded.`;
        }
      } else { // 'add' action
        const existingFileNames = new Set(prev.loadedFiles.map(f => f.name));
        const filesToAdd = newlySelectedFiles.filter(nf => !existingFileNames.has(nf.name));
        updatedLoadedFiles = [...prev.loadedFiles, ...filesToAdd];

        if (filesToAdd.length < newlySelectedFiles.length) {
            const numDuplicates = newlySelectedFiles.length - filesToAdd.length;
            statusMessageUpdate = `${filesToAdd.length} new file(s) added. ${numDuplicates} duplicate(s) ignored. `;
        } else {
            statusMessageUpdate = `${filesToAdd.length} new file(s) added. `;
        }

        if (updatedLoadedFiles.length === 0) {
            resetProcessFields = true;
            statusMessageUpdate += "Load input to begin.";
            aiInsightUpdate = "Input files cleared.";
            newInitialPrompt = "";
        } else {
             statusMessageUpdate += "Configure model and start or continue process.";
             aiInsightUpdate = `${updatedLoadedFiles.length} file(s) loaded. Ready for processing.`;
        }
      }

      if (updatedLoadedFiles.length > 0) {
        newInitialPrompt = `Input consists of ${updatedLoadedFiles.length} file(s): ${updatedLoadedFiles.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)}KB)`).join('; ')}.`;
      } else {
        newInitialPrompt = resetProcessFields ? "" : prev.initialPrompt;
      }

      const newComplexity = calculateInputComplexity(newInitialPrompt, updatedLoadedFiles);

      const updates: Partial<ProcessState> = {
        loadedFiles: updatedLoadedFiles,
        initialPrompt: newInitialPrompt,
        promptSourceName: updatedLoadedFiles.length > 0 ? (updatedLoadedFiles.length === 1 ? updatedLoadedFiles[0].name : `${updatedLoadedFiles.length} files loaded`) : (newInitialPrompt.trim() ? "direct_text" : null),
        statusMessage: statusMessageUpdate,
        aiProcessInsight: aiInsightUpdate,
        promptChangedByFileLoad: action === 'add' || action === 'remove' || action === 'clear',
        inputComplexity: newComplexity,
      };

      if (resetProcessFields || (action === 'add' && prev.loadedFiles.length === 0 && updatedLoadedFiles.length > 0) || (action === 'clear' && prev.loadedFiles.length > 0)) {
        updates.currentProduct = null;
        updates.iterationHistory = [];
        updates.finalProduct = null;
        updates.currentIteration = 0;
        updates.projectName = INITIAL_PROJECT_NAME_STATE; 
        updates.stagnationInfo = { isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined, nudgeStrategyApplied: 'none', consecutiveLowValueIterations: 0, lastProductLengthForStagnation: undefined };
        updates.currentProductBeforeHalt = null;
        updates.currentIterationBeforeHalt = undefined;
        updates.configAtFinalization = null;
        updates.isPlanActive = false;
        updates.planStages = [];
        updates.currentPlanStageIndex = null;
        updates.currentStageIteration = 0;
        updates.isEditingCurrentProduct = false; 
        updates.editedProductBuffer = null;
        updates.devLog = []; // Reset devLog when primary input changes significantly
      }
      return { ...prev, ...updates };
    });
  }, []);

  const handleInitialPromptChange = useCallback((newPromptText: string) => {
      setState(prev => {
          if (prev.loadedFiles.length > 0) { 
            // If files are loaded, initialPrompt is derived from file manifest and should not be user-editable.
            return prev;
          }
          const newComplexity = calculateInputComplexity(newPromptText, prev.loadedFiles);
          return {
              ...prev,
              initialPrompt: newPromptText,
              inputComplexity: newComplexity,
              promptChangedByFileLoad: true, // Signify that suggestions might need update
              promptSourceName: newPromptText.trim() ? "direct_text" : null,
              // Reset process if prompt changes substantially when no files are loaded
              currentProduct: null,
              iterationHistory: [],
              finalProduct: null,
              currentIteration: 0,
              stagnationInfo: { isStagnant: false, consecutiveStagnantIterations: 0, similarityWithPrevious: undefined, nudgeStrategyApplied: 'none', consecutiveLowValueIterations: 0, lastProductLengthForStagnation: undefined },
              currentProductBeforeHalt: null,
              currentIterationBeforeHalt: undefined,
              configAtFinalization: null,
              isPlanActive: false,
              planStages: [],
              currentPlanStageIndex: null,
              currentStageIteration: 0,
              isEditingCurrentProduct: false, 
              editedProductBuffer: null,
              devLog: prev.devLog || [], // Keep existing devLog on prompt change
          };
      });
  }, []);


  const addLogEntry = useCallback((logData: AddLogEntryParams) => {
    let productDiff: string | undefined = undefined;
    let linesAdded = 0;
    let linesRemoved = 0;
    const entryType = logData.entryType || 'ai_iteration'; // Default to 'ai_iteration' if not specified

    const normalizeNewlines = (str: string | null | undefined): string => (str || "").replace(/\r\n/g, '\n');

    const currentPForDiff = normalizeNewlines(
        (logData.currentFullProduct ?? "").startsWith(CONVERGED_PREFIX)
            ? (logData.currentFullProduct ?? "").substring(CONVERGED_PREFIX.length)
            : (logData.currentFullProduct ?? "")
    );
    const previousPForDiff = normalizeNewlines(
        (logData.previousFullProduct ?? "").startsWith(CONVERGED_PREFIX)
            ? (logData.previousFullProduct ?? "").substring(CONVERGED_PREFIX.length)
            : (logData.previousFullProduct ?? "")
    );
    
    // For initial state or segmented synthesis milestone, diff from empty or previous state as appropriate.
    // For other types, diff from previous product.
    const diffBase = (entryType === 'initial_state' && logData.iteration === 0) ? "" : previousPForDiff;

    if (currentPForDiff !== diffBase) { // Only calculate diff if there's a change or it's an initial entry
        productDiff = Diff.createTwoFilesPatch(
            `iteration_content_prev.txt`,
            `iteration_content_curr.txt`,
            diffBase, 
            currentPForDiff,
            undefined, undefined, { context: 3 }
        );
        const lineChanges = Diff.diffLines(diffBase, currentPForDiff, { newlineIsToken: true, ignoreWhitespace: false });
        lineChanges.forEach(part => {
            if (part.added) linesAdded += part.count || 0;
            if (part.removed) linesRemoved += part.count || 0;
        });
    } else {
        productDiff = undefined; linesAdded = 0; linesRemoved = 0;
    }

    const newEntry: IterationLogEntry = {
      iteration: logData.iteration,
      entryType: entryType,
      productSummary: getProductSummary(logData.currentFullProduct),
      status: logData.status,
      timestamp: Date.now(),
      productDiff: productDiff,
      linesAdded: linesAdded > 0 ? linesAdded : (logData.iteration === 0 && entryType === 'initial_state' && linesAdded === 0 && currentPForDiff.length > 0 ? currentPForDiff.split('\n').length : (linesAdded === 0 ? undefined : 0)),
      linesRemoved: linesRemoved > 0 ? linesRemoved : undefined,
      readabilityScoreFlesch: logData.readabilityScoreFlesch,
      lexicalDensity: logData.lexicalDensity, 
      avgSentenceLength: logData.avgSentenceLength, 
      typeTokenRatio: logData.typeTokenRatio, 
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
      attemptCount: logData.attemptCount,
      strategyRationale: logData.strategyRationale,
      currentModelForIteration: logData.currentModelForIteration,
      activeMetaInstruction: logData.activeMetaInstruction,
      isSegmentedSynthesis: entryType === 'segmented_synthesis_milestone',
      isTargetedRefinement: entryType === 'targeted_refinement',
      targetedSelection: logData.targetedSelection,
      targetedRefinementInstructions: logData.targetedRefinementInstructions,
    };

    setState(prev => {
        // Ensure log entries are unique based on iteration AND entry type if multiple entries per iter exist
        // Also consider attemptCount for uniqueness if multiple attempts for the same (iter, type) are logged.
        const existingEntryIndex = prev.iterationHistory.findIndex(entry => 
            entry.iteration === newEntry.iteration && 
            entry.entryType === newEntry.entryType &&
            // If attemptCount is logged, it should be part of the uniqueness key
            (newEntry.attemptCount ? entry.attemptCount === newEntry.attemptCount : true) 
        );
        let updatedHistory;
        if (existingEntryIndex !== -1) {
            updatedHistory = [...prev.iterationHistory];
            updatedHistory[existingEntryIndex] = newEntry;
        } else {
            updatedHistory = [...prev.iterationHistory, newEntry];
        }
        // Sort history: iteration ascending, then by entry type order, then by attempt count
        updatedHistory.sort((a, b) => {
            if (a.iteration !== b.iteration) return a.iteration - b.iteration;
            const typeOrder: Record<IterationEntryType, number> = { 
                'initial_state': 0, 
                'segmented_synthesis_milestone': 1, 
                'ai_iteration': 2, 
                'targeted_refinement': 3, 
                'manual_edit': 4 
            };
            const aTypeOrder = typeOrder[a.entryType || 'ai_iteration'];
            const bTypeOrder = typeOrder[b.entryType || 'ai_iteration'];
            if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder;
            return (a.attemptCount || 0) - (b.attemptCount || 0); // Sort by attempt if iter and type are same
        });
        return { ...prev, iterationHistory: updatedHistory };
    });
  }, []);


  const handleReset = useCallback(async (
        baseModelConfig: ModelConfig,
        currentSavedPlanTemplates: PlanTemplate[]
    ) => {
    const resetApiKeyStatus = geminiService.isApiKeyAvailable() ? 'loaded' : 'missing';
    const resetSelectedModelName = geminiService.DEFAULT_MODEL_NAME;

    const initialStateFromCreator = createInitialProcessState(resetApiKeyStatus, resetSelectedModelName);

    const initialComplexity = calculateInputComplexity(initialStateFromCreator.initialPrompt, initialStateFromCreator.loadedFiles);

    const resetState: ProcessState = {
        ...initialStateFromCreator, 
        apiKeyStatus: resetApiKeyStatus,
        selectedModelName: resetSelectedModelName,
        currentModelForIteration: resetSelectedModelName,
        statusMessage: "System reset. Load input file(s) or type prompt to begin.",
        aiProcessInsight: "System reset. Ready for new input.",
        savedPlanTemplates: currentSavedPlanTemplates, 
        projectId: await storageService.hasSavedState() ? state.projectId : null, 
        stagnationNudgeEnabled: true,
        currentDiffViewType: 'words',
        inputComplexity: initialComplexity,
        currentAppliedModelConfig: baseModelConfig, 
        stagnationInfo: { 
            isStagnant: false, 
            consecutiveStagnantIterations: 0, 
            similarityWithPrevious: undefined, 
            nudgeStrategyApplied: 'none',
            consecutiveLowValueIterations: 0,
            lastProductLengthForStagnation: undefined 
        },
        isTargetedRefinementModalOpen: false,
        currentTextSelectionForRefinement: null,
        instructionsForSelectionRefinement: "",
        isEditingCurrentProduct: false, 
        editedProductBuffer: null,
        devLog: [], // Reset devLog on full app reset
    };
    setState(resetState);

  }, [state.projectId]);

  // --- DevLog Management Functions ---
  const addDevLogEntry = useCallback((newEntryData: Omit<DevLogEntry, 'id' | 'timestamp' | 'lastModified'>) => {
    const newEntry: DevLogEntry = {
      ...newEntryData,
      id: `devlog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      lastModified: Date.now(),
    };
    setState(prev => ({
      ...prev,
      devLog: [...(prev.devLog || []), newEntry].sort((a,b) => b.timestamp - a.timestamp), // Sort newest first
    }));
  }, []);

  const updateDevLogEntry = useCallback((updatedEntry: DevLogEntry) => {
    setState(prev => ({
      ...prev,
      devLog: (prev.devLog || []).map(entry =>
        entry.id === updatedEntry.id ? { ...updatedEntry, lastModified: Date.now() } : entry
      ).sort((a,b) => b.timestamp - a.timestamp), // Re-sort by original timestamp
    }));
  }, []);

  const deleteDevLogEntry = useCallback((entryId: string) => {
    setState(prev => ({
      ...prev,
      devLog: (prev.devLog || []).filter(entry => entry.id !== entryId),
    }));
  }, []);


  return {
    state,
    updateProcessState,
    handleLoadedFilesChange,
    addLogEntry,
    handleReset,
    handleInitialPromptChange,
    // DevLog functions
    addDevLogEntry,
    updateDevLogEntry,
    deleteDevLogEntry,
  };
};

declare module '../types.ts' {
  interface IterationLogEntry {
    entryType?: IterationEntryType;
  }
}