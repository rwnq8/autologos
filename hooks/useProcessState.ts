// hooks/useProcessState.ts

import { useState, useCallback } from 'react';
import type { ProcessState, LoadedFile, IterationLogEntry, ModelConfig, ApiStreamCallDetail, FileProcessingInfo, SelectableModelName, AiResponseValidationInfo, DiffViewType, StagnationInfo, IterationEntryType, DevLogEntry, Version, PlanTemplate, ModelStrategy, OutlineNode } from '../types/index.ts';
import * as geminiService from '../services/geminiService.ts';
import * as storageService from '../services/storageService.ts';
import { INITIAL_PROJECT_NAME_STATE } from '../services/utils.ts';
import { getProductSummary } from '../services/iterationUtils.ts';
import * as Diff from 'diff';
import { compareVersions } from '../services/versionUtils.ts';

const normalizeNewlines = (str: string): string => {
  if (typeof str !== 'string') return "";
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

export const createInitialProcessState = (
  apiKeyStatusInput: 'loaded' | 'missing',
  selectedModelNameInput: SelectableModelName
): ProcessState => ({
  initialPrompt: "",
  currentProduct: null,
  iterationHistory: [],
  documentChunks: [], // Initialize new chunking structure
  currentFocusChunkIndex: null, // For context windowing
  currentMajorVersion: 0,
  currentMinorVersion: 0,
  maxMajorVersions: 20,
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
  streamBuffer: null,
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
    consecutiveCoherenceDegradation: 0,
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
  bootstrapSampleSizePercent: 40,
  bootstrapSubIterations: 2,
  ensembleSubProducts: null,
  awaitingStrategyDecision: false,
  projectCodename: null,
  isDiffViewerOpen: false,
  diffViewerContent: null,
  isOutlineMode: false,
  currentOutline: null,
  finalOutline: null,
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
      let statusMessageUpdate = "";
      let aiInsightUpdate = "";
      let resetProcessFields = false;

      switch (action) {
        case 'add': {
          const existingFileNames = new Set(prev.loadedFiles.map(f => f.name));
          const newFilesToAdd = newlySelectedFiles.filter(f => !existingFileNames.has(f.name));

          const numDuplicates = newlySelectedFiles.length - newFilesToAdd.length;
          const duplicateMessage = numDuplicates > 0 ? ` (${numDuplicates} duplicate(s) were ignored).` : '';

          if (newFilesToAdd.length === 0) {
              statusMessageUpdate = `No new files added.${duplicateMessage || ' All selected files are already loaded.'}`;
              aiInsightUpdate = prev.aiProcessInsight;
              updatedLoadedFiles = prev.loadedFiles;
              resetProcessFields = false; // no change, so don't reset
              break;
          }
          
          updatedLoadedFiles = [...prev.loadedFiles, ...newFilesToAdd];
          resetProcessFields = true; // Any change to input files should reset the process
          
          statusMessageUpdate = `${newFilesToAdd.length} file(s) added. Total is now ${updatedLoadedFiles.length}.${duplicateMessage}`;
          aiInsightUpdate = `Ready to process ${updatedLoadedFiles.length} file(s).`;
          break;
        }
        
        case 'remove': {
          const fileToRemoveName = newlySelectedFiles[0]?.name;
          updatedLoadedFiles = prev.loadedFiles.filter(f => f.name !== fileToRemoveName);
          resetProcessFields = true; // Always reset if the file list changes.
          
          if (updatedLoadedFiles.length === 0) {
              statusMessageUpdate = "Last file removed. Load new input to begin.";
              aiInsightUpdate = "Input files cleared.";
          } else {
              statusMessageUpdate = `File "${fileToRemoveName}" removed. Total is now ${updatedLoadedFiles.length}.`;
              aiInsightUpdate = `${updatedLoadedFiles.length} file(s) remain loaded.`;
          }
          break;
        }

        case 'clear':
        default:
          updatedLoadedFiles = [];
          resetProcessFields = true;
          statusMessageUpdate = "All files cleared. Load new input to begin.";
          aiInsightUpdate = "Input files cleared.";
          break;
      }
      
      const newInitialPrompt = updatedLoadedFiles.length > 0 
        ? `Input consists of ${updatedLoadedFiles.length} file(s): ${updatedLoadedFiles.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)}KB)`).join('; ')}.`
        : "";

      const newComplexity = calculateInputComplexity(newInitialPrompt, updatedLoadedFiles);
      
      const updates: Partial<ProcessState> = {
        loadedFiles: updatedLoadedFiles,
        initialPrompt: newInitialPrompt,
        promptSourceName: updatedLoadedFiles.length > 0 ? "File Input" : prev.promptSourceName,
        statusMessage: statusMessageUpdate,
        aiProcessInsight: aiInsightUpdate,
        promptChangedByFileLoad: true,
        inputComplexity: newComplexity,
      };

      if (resetProcessFields) {
        updates.currentProduct = null;
        updates.finalProduct = null;
        updates.iterationHistory = [];
        updates.documentChunks = [];
        updates.projectCodename = null; // Also reset codename on input change
        updates.currentOutline = null;
        updates.finalOutline = null;
      }
      
      return { ...prev, ...updates };
    });
  }, []);

  const handleInitialPromptChange = useCallback((newPromptText: string) => {
    setState(prev => {
      const newComplexity = calculateInputComplexity(newPromptText, prev.loadedFiles);
      return {
        ...prev,
        initialPrompt: newPromptText,
        promptSourceName: "Typed Prompt",
        promptChangedByFileLoad: false, // Explicitly false as it's a manual change
        inputComplexity: newComplexity,
      };
    });
  }, []);

  const addLogEntry = useCallback((logData: AddLogEntryParams) => {
    setState(prev => {
      const { currentFullProduct, previousFullProduct, ...restOfLogData } = logData;

      const normalizedNew = normalizeNewlines(currentFullProduct || "");
      const normalizedOld = normalizeNewlines(previousFullProduct || "");

      const diffPatch = Diff.createPatch(
        `product.txt`, 
        normalizedOld,
        normalizedNew
      );

      let linesAdded = 0;
      let linesRemoved = 0;
      if (diffPatch) {
          const diffLines = diffPatch.split('\n').slice(4); // Skip header lines
          diffLines.forEach(line => {
            if (line.startsWith('+')) linesAdded++;
            if (line.startsWith('-')) linesRemoved++;
          });
      }
      
      const newEntry: IterationLogEntry = {
        ...restOfLogData,
        timestamp: Date.now(),
        productSummary: getProductSummary(currentFullProduct),
        productDiff: diffPatch,
        linesAdded,
        linesRemoved,
        charDelta: (currentFullProduct?.length || 0) - (previousFullProduct?.length || 0)
      };

      const newHistory = [...prev.iterationHistory, newEntry].sort(compareVersions);
      
      return { ...prev, iterationHistory: newHistory };
    });
  }, []);

  const handleReset = useCallback(async (baseConfig: ModelConfig, baseTemplates: PlanTemplate[]) => {
    await storageService.clearState();
    setState(createInitialProcessState('loaded', geminiService.DEFAULT_MODEL_NAME));
    updateProcessState({ savedPlanTemplates: baseTemplates, statusMessage: "Process reset." });
  }, [updateProcessState]);

  const addDevLogEntry = useCallback((newEntryData: Omit<DevLogEntry, 'id' | 'timestamp' | 'lastModified'>) => {
    const newEntry: DevLogEntry = {
      ...newEntryData,
      id: `devlog-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      lastModified: Date.now(),
    };
    setState(prev => ({ ...prev, devLog: [...(prev.devLog || []), newEntry] }));
  }, []);

  const updateDevLogEntry = useCallback((updatedEntry: DevLogEntry) => {
    setState(prev => ({
      ...prev,
      devLog: (prev.devLog || []).map(entry =>
        entry.id === updatedEntry.id
          ? { ...updatedEntry, lastModified: Date.now() }
          : entry
      ),
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
    handleInitialPromptChange,
    addLogEntry,
    handleReset,
    addDevLogEntry,
    updateDevLogEntry,
    deleteDevLogEntry,
  };
};
