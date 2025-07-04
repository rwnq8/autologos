// types/project.ts
import type { IterationLogEntry, DevLogEntry, Version } from './log.ts';
import type { ModelConfig, SelectableModelName } from './models.ts';
import type { PlanStage, PlanTemplate } from './plan.ts';
import type { SettingsSuggestionSource, DiffViewType } from './ui.ts';
import type { DocumentChunk, OutlineNode } from './document.ts';
import { AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION, THIS_APP_ID, APP_VERSION } from './constants.ts';


export interface LoadedFile {
  name: string;
  mimeType: string;
  content: string;
  size: number;
}

export type NudgeStrategy = 'none' | 'params_light' | 'params_heavy' | 'meta_instruct' | 'radical_kickstart';

export interface StagnationInfo {
    isStagnant: boolean;
    consecutiveStagnantIterations: number;
    consecutiveIdenticalProductIterations: number;
    lastMeaningfulChangeProductLength: number | undefined;
    lastProductLengthForStagnation: number | undefined;
    similarityWithPrevious: number | undefined;
    nudgeStrategyApplied: NudgeStrategy;
    consecutiveLowValueIterations: number;
    consecutiveWordsmithingIterations: number;
    consecutiveCoherenceDegradation: number;
}

export interface StrategistLLMContext {
  productDevelopmentState: 'UNKNOWN' | 'UNDERDEVELOPED_KERNEL' | 'NEEDS_EXPANSION_STALLED' | 'DEVELOPED_DRAFT' | 'MATURE_PRODUCT';
  stagnationSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  recentIterationPerformance: 'PRODUCTIVE' | 'LOW_VALUE' | 'STALLED';
}

export interface FileProcessingInfo {
  filesSentToApiIteration: number | null;
  numberOfFilesActuallySent: number;
  totalFilesSizeBytesSent: number;
  fileManifestProvidedCharacterCount: number;
  loadedFilesForIterationContext?: LoadedFile[];
}

export interface ProcessState {
  initialPrompt: string;
  currentProduct: string | null;
  iterationHistory: IterationLogEntry[];
  documentChunks: DocumentChunk[] | null;
  currentFocusChunkIndex: number | null;
  isOutlineMode: boolean;
  outlineId: string | null;
  currentOutline: OutlineNode[] | null;
  finalOutline: OutlineNode[] | null;
  
  currentMajorVersion: number;
  currentMinorVersion: number;
  maxMajorVersions: number;
  isProcessing: boolean;
  finalProduct: string | null;
  statusMessage: string;
  apiKeyStatus: 'loaded' | 'missing';
  loadedFiles: LoadedFile[];
  promptSourceName: string | null;
  selectedModelName: SelectableModelName;
  configAtFinalization: ModelConfig | null;
  projectId: string | null;
  projectName: string;
  projectObjective: string | null;
  lastAutoSavedAt: number | null;
  currentProductBeforeHalt: string | null;
  currentVersionBeforeHalt?: Version;
  promptChangedByFileLoad: boolean;
  streamBuffer: string | null;

  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  savedPlanTemplates: PlanTemplate[];

  currentDiffViewType: DiffViewType;
  aiProcessInsight?: string;
  isApiRateLimited: boolean;
  rateLimitCooldownActiveSeconds: number;

  stagnationNudgeEnabled: boolean;
  isSearchGroundingEnabled: boolean;
  isUrlBrowsingEnabled: boolean;
  stagnationInfo: StagnationInfo;
  inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  currentModelForIteration: SelectableModelName;
  currentAppliedModelConfig: ModelConfig | null;
  activeMetaInstructionForNextIter?: string;
  strategistInfluenceLevel: 'OVERRIDE_FULL' | 'OVERRIDE_PARTIAL' | 'SUGGEST_ONLY' | 'DISABLED';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';

  isTargetedRefinementModalOpen?: boolean;
  currentTextSelectionForRefinement?: string | null;
  instructionsForSelectionRefinement?: string;
  isEditingCurrentProduct?: boolean;
  editedProductBuffer?: string | null;
  
  devLog?: DevLogEntry[];
  bootstrapSamples: number;
  bootstrapSampleSizePercent: number;
  bootstrapSubIterations: number;
  ensembleSubProducts: string[] | null;
  awaitingStrategyDecision: boolean;
  projectCodename: string | null;

  isDocumentMapOpen: boolean;
  isDiffViewerOpen: boolean;
  diffViewerContent: { oldText: string, newText: string, version: string } | null;
}


export interface AutologosProjectFile {
  header: ProjectFileHeader;
  applicationData: {
    [appId: string]: AutologosIterativeEngineData;
  };
}

export interface AutologosIterativeEngineData extends Omit<ModelConfig, 'maxIterations'> {
  initialPrompt: string;
  iterationHistory: IterationLogEntry[];
  documentChunks: DocumentChunk[] | null;
  currentFocusChunkIndex: number | null;
  
  isOutlineMode?: boolean;
  outlineId?: string | null;
  currentOutline?: OutlineNode[] | null;
  finalOutline?: OutlineNode[] | null;

  maxMajorVersions: number;
  selectedModelName: SelectableModelName;
  finalProduct: string | null;
  currentProductBeforeHalt: string | null;
  currentVersionBeforeHalt?: Version;
  promptSourceName: string | null;
  configAtFinalization: ModelConfig | null;
  loadedFiles: LoadedFile[];
  lastAutoSavedAt: number | null;

  settingsSuggestionSource: SettingsSuggestionSource;
  userManuallyAdjustedSettings: boolean;

  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  savedPlanTemplates: PlanTemplate[];
  
  currentDiffViewType: DiffViewType;

  projectName: string;
  projectObjective: string | null;
  projectId: string | null;
  projectCodename: string | null;

  isApiRateLimited: boolean;
  rateLimitCooldownActiveSeconds: number;
  
  stagnationNudgeEnabled: boolean;
  isSearchGroundingEnabled: boolean;
  isUrlBrowsingEnabled: boolean;
  
  inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  strategistInfluenceLevel: 'OVERRIDE_FULL' | 'OVERRIDE_PARTIAL' | 'SUGGEST_ONLY' | 'DISABLED';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';
  
  devLog?: DevLogEntry[];
  bootstrapSamples: number;
  bootstrapSampleSizePercent: number;
  bootstrapSubIterations: number;
  ensembleSubProducts: string[] | null;
  isDocumentMapOpen?: boolean;
}

export interface ProjectFileHeader {
  fileFormatVersion: typeof AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION;
  projectId: string;
  projectName: string;
  projectObjective?: string;
  createdAt: string;
  lastModifiedAt: string;
  lastExportedByAppId: typeof THIS_APP_ID;
  lastExportedByAppVersion: typeof APP_VERSION;
  appManifest: {
    appId: string;
    appName: string;
    appVersion: string;
    dataDescription: string;
  }[];
}
