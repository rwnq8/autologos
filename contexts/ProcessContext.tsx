

import React, { createContext, useContext } from 'react';
import type {
  ProcessState,
  LoadedFile,
  IterationLogEntry,
  ModelConfig,
  ReconstructedProductResult,
  DiffViewType,
  ApiStreamCallDetail,
  FileProcessingInfo,
  AiResponseValidationInfo
} from '../types';

// Simplified AddLogEntryType for context to avoid complex conditional types from useProcessState hook return
export type AddLogEntryType = (logData: {
  iteration: number;
  currentFullProduct: string | null;
  status: string;
  previousFullProduct?: string | null; // Make it optional for iter 0
  promptSystemInstructionSent?: string;
  promptCoreUserInstructionsSent?: string;
  promptFullUserPromptSent?: string;
  apiStreamDetails?: ApiStreamCallDetail[];
  modelConfigUsed?: ModelConfig;
  readabilityScoreFlesch?: number;
  fileProcessingInfo: FileProcessingInfo;
  aiValidationInfo?: AiResponseValidationInfo;
}) => void;


export interface ProcessContextType {
  initialPrompt: string;
  currentProduct: string | null;
  iterationHistory: IterationLogEntry[];
  currentIteration: number;
  isProcessing: boolean;
  finalProduct: string | null;
  statusMessage: string;
  loadedFiles: LoadedFile[];
  promptSourceName: string | null;
  configAtFinalization: ModelConfig | null;
  projectObjective: string | null;
  lastAutoSavedAt?: number | null;
  currentProductBeforeHalt?: string | null;
  currentIterationBeforeHalt?: number;
  promptChangedByFileLoad?: boolean;
  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  aiProcessInsight?: string;
  currentAppliedModelConfig?: ModelConfig | null; 
  stagnationNudgeEnabled: boolean; 
  updateProcessState: (updates: Partial<Omit<ProcessState, 'apiKeyStatus' | 'selectedModelName' | 'projectName' | 'projectId' | 'isApiRateLimited' | 'rateLimitCooldownActiveSeconds' | 'isPlanActive' | 'planStages' | 'currentPlanStageIndex' | 'currentStageIteration' | 'savedPlanTemplates' | 'temperature' | 'topP' | 'topK' | 'maxIterations' | 'settingsSuggestionSource' | 'userManuallyAdjustedSettings'>>) => void;
  handleLoadedFilesChange: (files: LoadedFile[]) => void;
  addLogEntry: AddLogEntryType;
  handleResetApp: () => Promise<void>; 
  handleStartProcess: () => Promise<void>; 
  handleHaltProcess: () => void; 
  handleRewind: (iterationNumber: number) => void;
  handleExportIterationMarkdown: (iterationNumber: number) => void;
  reconstructProductCallback: (targetIteration: number, history: IterationLogEntry[], basePrompt: string) => ReconstructedProductResult;
  currentDiffViewType: DiffViewType; // Fixed to 'words'
  // onDiffViewTypeChange removed as diff view is fixed
}

const ProcessContext = createContext<ProcessContextType | undefined>(undefined);

export const useProcessContext = () => {
  const context = useContext(ProcessContext);
  if (!context) {
    throw new Error('useProcessContext must be used within a ProcessProvider');
  }
  return context;
};

export const ProcessProvider = ProcessContext.Provider;