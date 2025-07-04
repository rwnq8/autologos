// types/project.ts
// MERGED FROM types/state.ts and types/project.ts to resolve circular dependency

import type { IterationLogEntry, DevLogEntry, Version } from './log.ts';
import type { ModelConfig, SelectableModelName, ModelStrategy } from './models.ts';
import type { PlanStage, PlanTemplate } from './plan.ts';
import type { SettingsSuggestionSource, DiffViewType } from './ui.ts';

// Originally from project.ts
export interface LoadedFile {
  name: string;
  mimeType: string;
  content: string;
  size: number;
}

export interface DocumentChunk {
  id: string; // Unique identifier (UUID)
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6' | 'paragraph' | 'list' | 'code_block' | 'blockquote' | 'thematic_break';
  content: string; // The raw markdown content of the chunk
  lang?: string; // Language for code blocks
}


// Originally from state.ts
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
  lastNValidationSummaries: string;
}

export interface AutologosIterativeEngineData {
  initialPrompt: string;
  iterationHistory: IterationLogEntry[];
  documentChunks: DocumentChunk[]; // The new structured product
  maxMajorVersions: number;
  temperature: number;
  topP: number;
  topK: number;
  settingsSuggestionSource: SettingsSuggestionSource;
  userManuallyAdjustedSettings: boolean;
  selectedModelName: SelectableModelName;
  finalProduct: string | null;
  currentProductBeforeHalt: string | null;
  currentVersionBeforeHalt?: Version;
  promptSourceName: string | null;
  configAtFinalization: ModelConfig | null;
  loadedFiles: LoadedFile[];
  lastAutoSavedAt?: number | null;
  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  savedPlanTemplates: PlanTemplate[];
  currentDiffViewType: DiffViewType;
  projectName: string | null;
  projectObjective: string | null;
  projectId: string | null;
  projectCodename: string | null;
  isApiRateLimited: boolean;
  rateLimitCooldownActiveSeconds: number;
  stagnationNudgeEnabled: boolean;
  isSearchGroundingEnabled: boolean;
  isUrlBrowsingEnabled: boolean;
  inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  strategistInfluenceLevel: 'OFF' | 'SUGGEST' | 'ADVISE_PARAMS_ONLY' | 'OVERRIDE_FULL';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';
  devLog: DevLogEntry[];
  bootstrapSamples: number;
  bootstrapSampleSizePercent: number;
  bootstrapSubIterations: number;
  ensembleSubProducts: string[] | null;
}

export interface ProcessState extends Omit<AutologosIterativeEngineData, 'iterationHistory' | 'temperature' | 'topP' | 'topK' | 'settingsSuggestionSource' | 'userManuallyAdjustedSettings' > {
  iterationHistory: IterationLogEntry[];
  documentChunks: DocumentChunk[];
  isProcessing: boolean;
  statusMessage: string;
  apiKeyStatus: 'loaded' | 'missing';
  currentMajorVersion: number;
  currentMinorVersion: number;
  currentProduct: string | null;
  promptChangedByFileLoad: boolean;
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  streamBuffer: string | null;
  aiProcessInsight?: string;
  currentAppliedModelConfig?: ModelConfig | null;
  stagnationInfo: StagnationInfo;
  currentModelForIteration: SelectableModelName;
  activeMetaInstructionForNextIter?: string;
  isTargetedRefinementModalOpen?: boolean;
  currentTextSelectionForRefinement?: string | null;
  instructionsForSelectionRefinement?: string;
  isEditingCurrentProduct?: boolean;
  editedProductBuffer?: string | null;
  awaitingStrategyDecision?: boolean;
}


// Originally from project.ts
export const THIS_APP_ID = "com.autologos.iterativeengine";
export const APP_VERSION = "2.0.0"; // Version bump for new versioning system
export const AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION = "AutologosProjectFile/2.0"; // Version Bump for new versioning

export interface ReconstructedProductResult {
  product: string;
  error?: string;
}

export interface FileProcessingInfo {
  filesSentToApiIteration: number | null;
  numberOfFilesActuallySent: number;
  totalFilesSizeBytesSent: number;
  fileManifestProvidedCharacterCount: number;
  loadedFilesForIterationContext?: LoadedFile[];
}

export interface ThemeHints {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

export interface AppManifestEntry {
  appId: string;
  appName: string;
  appVersion: string;
  dataDescription: string;
}

export interface ProjectFileHeader {
  fileFormatVersion: string;
  projectId: string;
  projectName: string;
  projectObjective?: string;
  createdAt: string;
  lastModifiedAt: string;
  lastExportedByAppId?: string;
  lastExportedByAppVersion?: string;
  themeHints?: ThemeHints;
  appManifest?: AppManifestEntry[];
}

export interface AutologosProjectFile {
  header: ProjectFileHeader;
  applicationData: {
    [appId: string]: AutologosIterativeEngineData;
  };
}
