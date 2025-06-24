

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
  AiResponseValidationInfo,
  PlanStage,
  SelectableModelName,
  StagnationInfo, 
  PlanTemplate
} from '../types';

export type AddLogEntryType = (logData: {
  iteration: number;
  currentFullProduct: string | null;
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
  activeMetaInstruction?: string;
  strategyRationale?: string;
  currentModelForIteration?: SelectableModelName;
  attemptCount?: number;
  directAiResponseHead?: string;
  directAiResponseTail?: string;
  directAiResponseLengthChars?: number;
  processedProductHead?: string;
  processedProductTail?: string;
  processedProductLengthChars?: number;
}) => void;


export interface ProcessContextType extends Omit<ProcessState,
  'apiKeyStatus' | 'selectedModelName' | 'projectName' | 'projectId' | 
  'isApiRateLimited' | 'rateLimitCooldownActiveSeconds' | 
  'promptChangedByFileLoad' 
> {
  updateProcessState: (updates: Partial<ProcessState>) => void; 
  handleLoadedFilesChange: (files: LoadedFile[], action?: 'add' | 'remove' | 'clear') => void;
  addLogEntry: AddLogEntryType;
  handleResetApp: () => Promise<void>; // Updated to match App.tsx's signature
  handleStartProcess: () => Promise<void>;
  handleHaltProcess: () => void;
  handleRewind: (iterationNumber: number) => void;
  handleExportIterationMarkdown: (iterationNumber: number) => void;
  reconstructProductCallback: (targetIteration: number, history: IterationLogEntry[], basePrompt: string) => ReconstructedProductResult;
  handleInitialPromptChange: (newPromptText: string) => void;

  initialPrompt: string;
  currentProduct: string | null;
  iterationHistory: IterationLogEntry[];
  currentIteration: number;
  maxIterations: number; 
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
  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  aiProcessInsight?: string;
  currentAppliedModelConfig?: ModelConfig | null;
  stagnationNudgeEnabled: boolean;
  stagnationInfo: StagnationInfo;
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  savedPlanTemplates: PlanTemplate[]; 
  currentDiffViewType: DiffViewType;
  inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  currentModelForIteration?: SelectableModelName;
  activeMetaInstructionForNextIter?: string;
  strategistInfluenceLevel: 'OFF' | 'SUGGEST' | 'ADVISE_PARAMS_ONLY' | 'OVERRIDE_FULL';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';
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