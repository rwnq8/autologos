// hooks/useProcessState.ts

import { useState, useCallback } from 'react';
import type { ProcessState, LoadedFile, IterationLogEntry, ModelConfig, ApiStreamCallDetail, FileProcessingInfo, SelectableModelName, AiResponseValidationInfo, DiffViewType, StagnationInfo, IterationEntryType, DevLogEntry, Version, PlanTemplate } from '../types.ts';
import * as geminiService from '../services/geminiService';
import * as storageService from '../services/storageService';
import { INITIAL_PROJECT_NAME_STATE } from '../services/utils';
import { getProductSummary } from '../services/iterationUtils';
import { CONVERGED_PREFIX } from '../services/promptBuilderService';
import * as Diff from 'diff';
import { compareVersions } from '../services/versionUtils';


export const createInitialProcessState = (
  apiKeyStatusInput: 'loaded' | 'missing',
  selectedModelNameInput: SelectableModelName
): ProcessState => ({
  initialPrompt: "",
  currentProduct: null,
  iterationHistory: [],
  currentMajorVersion: 0,
  currentMinorVersion: 0,
  maxMajorVersions: 40,
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
  currentVersionBeforeHalt: undefined,
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
  isSearchGroundingEnabled: true,
  isUrlBrowsingEnabled: true,
  stagnationInfo: { 
    isStagnant: false, 
    consecutiveStagnantIterations: 0, 
    consecutiveIdenticalProductIterations: 0, 
    lastMeaningfulChangeProductLength: undefined, 
    similarityWithPrevious: undefined, 
    nudgeStrategyApplied: 'none',
    consecutiveLowValueIterations: 0, 
    lastProductLengthForStagnation: undefined,
    consecutiveWordsmithingIterations: 0, 
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
  devLog: [], 
  bootstrapSamples: 2,
  bootstrapSampleSizePercent: 60,
  bootstrapSubIterations: 2,
  ensembleSubProducts: null,
});

const calculateInputComplexity = (initialPrompt: string, loadedFiles: LoadedFile[]): 'SIMPLE' | 'MODERATE' | 'COMPLEX' => {
  const totalFilesSize = loadedFiles.reduce((sum, file) => sum + file.size, 0);
  const promptTextLength = initialPrompt?.trim().length || 0;

  if (loadedFiles.length === 0 && promptTextLength < 500) return 'SIMPLE';
  if (loadedFiles.length === 1 && loadedFiles[0].size < 50 * 1024 && promptTextLength < 1000) return 'SIMPLE';
  if (loadedFiles.length <= 3 && totalFilesSize < 200 * 1024 && promptTextLength < 5000) return 'MODERATE';
  return 'COMPLEX';
};

export type AddLogEntryParams = Omit<IterationLogEntry, 'productSummary' | 'timestamp' | 'productDiff' | 'linesAdded' | 'linesRemoved' | 'charDelta'> & {
    currentFullProduct: string | null;
    previousFullProduct?: string | null;
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
      } else { 
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
        updates.currentMajorVersion = 0;
        updates.currentMinorVersion = 0;
        updates.projectName = INITIAL_PROJECT_NAME_STATE; 
        updates.stagnationInfo = { 
            isStagnant: false, 
            consecutiveStagnantIterations: 0, 
            consecutiveIdenticalProductIterations: 0, 
            lastMeaningfulChangeProductLength: undefined, 
            similarityWithPrevious: undefined, 
            nudgeStrategyApplied: 'none', 
            consecutiveLowValueIterations: 0, 
            lastProductLengthForStagnation: undefined,
            consecutiveWordsmithingIterations: 0, 
        };
        updates.currentProductBeforeHalt = null;
        updates.currentVersionBeforeHalt = undefined;
        updates.configAtFinalization = null;
        updates.isPlanActive = false;
        updates.planStages = [];
        updates.currentPlanStageIndex = null;
        updates.isEditingCurrentProduct = false; 
        updates.editedProductBuffer = null;
        updates.devLog = []; 
        updates.ensembleSubProducts = null;
      }
      return { ...prev, ...updates };
    });
  }, []);

  const handleInitialPromptChange = useCallback((newPromptText: string) => {
      setState(prev => {
          if (prev.loadedFiles.length > 0) { 
            return prev;
          }
          const newComplexity = calculateInputComplexity(newPromptText, prev.loadedFiles);
          return {
              ...prev,
              initialPrompt: newPromptText,
              inputComplexity: newComplexity,
              promptChangedByFileLoad: true, 
              promptSourceName: newPromptText.trim() ? "direct_text" : null,
              currentProduct: null,
              iterationHistory: [],
              finalProduct: null,
              currentMajorVersion: 0,
              currentMinorVersion: 0,
              stagnationInfo: { 
                isStagnant: false, 
                consecutiveStagnantIterations: 0, 
                consecutiveIdenticalProductIterations: 0, 
                lastMeaningfulChangeProductLength: undefined, 
                similarityWithPrevious: undefined, 
                nudgeStrategyApplied: 'none',
                consecutiveLowValueIterations: 0,
                lastProductLengthForStagnation: undefined,
                consecutiveWordsmithingIterations: 0, 
              },
              currentProductBeforeHalt: null,
              currentVersionBeforeHalt: undefined,
              configAtFinalization: null,
              isPlanActive: false,
              planStages: [],
              currentPlanStageIndex: null,
              isEditingCurrentProduct: false, 
              editedProductBuffer: null,
              devLog: [], 
              ensembleSubProducts: null,
          };
      });
  }, []);


  const addLogEntry = useCallback((logData: AddLogEntryParams) => {
    let productDiff: string | undefined = undefined;
    let linesAdded = 0;
    let linesRemoved = 0;

    const normalizeNewlines = (str: string | null | undefined): string => {
        if (!str) return "";
        return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    };

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
    
    const diffBase = (logData.entryType === 'initial_state' && logData.majorVersion === 0) ? "" : previousPForDiff;

    if (currentPForDiff !== diffBase) { 
        const prevVersionString = `v${logData.majorVersion - 1}.${logData.minorVersion}`;
        const currentVersionString = `v${logData.majorVersion}.${logData.minorVersion}${logData.patchVersion !== undefined ? '.' + logData.patchVersion : ''}`;

        productDiff = Diff.createTwoFilesPatch(
            prevVersionString, currentVersionString,
            diffBase, currentPForDiff,
            undefined, undefined, { context: 3 }
        );
        const lineChanges = Diff.diffLines(diffBase, currentPForDiff, { newlineIsToken: true, ignoreWhitespace: false });
        lineChanges.forEach(part => {
            if (part.added) linesAdded += part.count || 0;
            if (part.removed) linesRemoved += part.count || 0;
        });
    }

    const newEntry: IterationLogEntry = {
      ...logData,
      productSummary: getProductSummary(logData.currentFullProduct), 
      timestamp: Date.now(), 
      productDiff: productDiff,
      linesAdded: linesAdded > 0 ? linesAdded : (logData.majorVersion === 0 && logData.entryType === 'initial_state' && linesAdded === 0 && currentPForDiff.length > 0 ? currentPForDiff.split('\n').length : (linesAdded === 0 ? undefined : 0)),
      linesRemoved: linesRemoved > 0 ? linesRemoved : undefined,
      charDelta: currentPForDiff.length - previousPForDiff.length,
    };

    setState(prev => {
        const updatedHistory = [...prev.iterationHistory, newEntry];
        updatedHistory.sort(compareVersions);
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
        apiKeyStatus: resetApiKeyStatus, selectedModelName: resetSelectedModelName, currentModelForIteration: resetSelectedModelName,
        statusMessage: "System reset. Load input file(s) or type prompt to begin.", aiProcessInsight: "System reset. Ready for new input.",
        savedPlanTemplates: currentSavedPlanTemplates, 
        projectId: await storageService.hasSavedState() ? state.projectId : null, 
        stagnationNudgeEnabled: true, isSearchGroundingEnabled: true, isUrlBrowsingEnabled: true, currentDiffViewType: 'words', inputComplexity: initialComplexity,
        currentAppliedModelConfig: baseModelConfig, 
        stagnationInfo: { 
            isStagnant: false, consecutiveStagnantIterations: 0, consecutiveIdenticalProductIterations: 0, 
            lastMeaningfulChangeProductLength: undefined, similarityWithPrevious: undefined, nudgeStrategyApplied: 'none',
            consecutiveLowValueIterations: 0, lastProductLengthForStagnation: undefined,
            consecutiveWordsmithingIterations: 0, 
        },
        isTargetedRefinementModalOpen: false, currentTextSelectionForRefinement: null, instructionsForSelectionRefinement: "",
        isEditingCurrentProduct: false, editedProductBuffer: null, devLog: [], 
        ensembleSubProducts: null,
    };
    setState(resetState);
  }, [state.projectId]);

  const addDevLogEntry = useCallback((newEntryData: Omit<DevLogEntry, 'id' | 'timestamp' | 'lastModified'>) => {
    const newEntry: DevLogEntry = {
      ...newEntryData,
      id: `devlog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(), lastModified: Date.now(),
    };
    setState(prev => ({ ...prev, devLog: [...(prev.devLog || []), newEntry].sort((a,b) => b.timestamp - a.timestamp) }));
  }, []);

  const updateDevLogEntry = useCallback((updatedEntry: DevLogEntry) => {
    setState(prev => ({ ...prev, devLog: (prev.devLog || []).map(entry => entry.id === updatedEntry.id ? { ...updatedEntry, lastModified: Date.now() } : entry ).sort((a,b) => b.timestamp - a.timestamp) }));
  }, []);

  const deleteDevLogEntry = useCallback((entryId: string) => {
    setState(prev => ({ ...prev, devLog: (prev.devLog || []).filter(entry => entry.id !== entryId) }));
  }, []);

  return {
    state, updateProcessState, handleLoadedFilesChange, addLogEntry, handleReset, handleInitialPromptChange,
    addDevLogEntry, updateDevLogEntry, deleteDevLogEntry,
  };
};