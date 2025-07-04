// contexts/ProcessContext.tsx


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
  PlanTemplate,
  IterationEntryType,
  DevLogEntry,
  Version,
  ModelStrategy
} from '../types/index.ts';

export type AddLogEntryType = (logData: {
  majorVersion: number;
  minorVersion: number;
  patchVersion?: number;
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
  isSegmentedSynthesis?: boolean;
  isTargetedRefinement?: boolean;
  targetedSelection?: string;
  targetedRefinementInstructions?: string;
  bootstrapRun?: number;
}) => void;


export interface ProcessContextType extends Omit<ProcessState,
  'apiKeyStatus' | 'selectedModelName' | 'projectName' | 'projectId' | 
  'isApiRateLimited' | 'rateLimitCooldownActiveSeconds' | 
  'promptChangedByFileLoad' 
> {
  updateProcessState: (updates: Partial<ProcessState>) => void; 
  handleLoadedFilesChange: (files: LoadedFile[], action?: 'add' | 'remove' | 'clear') => void;
  handleReset: () => Promise<void>; 
  handleStartProcess: (options?: { 
    isTargetedRefinement?: boolean; 
    targetedSelection?: string; 
    targetedInstructions?: string; 
    userRawPromptForContextualizer?: string;
  }) => Promise<void>;
  handleHaltProcess: () => void;
  handleBootstrapSynthesis: () => Promise<void>;
  handleRewind: (version: Version) => void;
  handleExportIterationMarkdown: (version: Version) => void;
  reconstructProductCallback: (targetVersion: Version, history: IterationLogEntry[], basePrompt: string) => ReconstructedProductResult;
  handleInitialPromptChange: (newPromptText: string) => void;
  openTargetedRefinementModal: (selectedText: string) => void;
  toggleEditMode: (forceOff?: boolean) => void; 
  saveManualEdits: () => Promise<void>; 
  handleAcceptStrategy: () => Promise<void>;
  handleIgnoreStrategy: () => Promise<void>;

  initialPrompt: string;
  currentProduct: string | null;
  iterationHistory: IterationLogEntry[];
  currentMajorVersion: number;
  currentMinorVersion: number;
  maxMajorVersions: number;
  isProcessing: boolean;
  finalProduct: string | null;
  statusMessage: string;
  loadedFiles: LoadedFile[];
  promptSourceName: string | null;
  configAtFinalization: ModelConfig | null;
  projectObjective: string | null;
  lastAutoSavedAt?: number | null;
  currentProductBeforeHalt: string | null;
  currentVersionBeforeHalt?: Version;
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
  currentModelForIteration: SelectableModelName;
  activeMetaInstructionForNextIter?: string;
  strategistInfluenceLevel: 'OFF' | 'SUGGEST' | 'ADVISE_PARAMS_ONLY' | 'OVERRIDE_FULL';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';
  isEditingCurrentProduct?: boolean; 
  editedProductBuffer?: string | null; 
  devLog: DevLogEntry[];
  addLogEntry: (params: any) => void;
  addDevLogEntry: (newEntryData: Omit<DevLogEntry, 'id' | 'timestamp' | 'lastModified'>) => void;
  updateDevLogEntry: (updatedEntry: DevLogEntry) => void;
  deleteDevLogEntry: (entryId: string) => void;
  awaitingStrategyDecision: boolean;
  pendingStrategySuggestion: ModelStrategy | null;
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
