// types.ts (consolidated from types/apiTypes.ts, genericTypes.ts, planTypes.ts, projectTypes.ts, uiStateTypes.ts)

// Originally from types/apiTypes.ts
export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
}

export interface ApiStreamCallDetail {
  callCount: number;
  promptForThisCall: string;
  finishReason: string | null;
  safetyRatings: any | null;
  textLengthThisCall: number;
  isContinuation: boolean;
}

export interface SuggestedParamsResponse {
  config: ModelConfig;
  rationales: string[];
}

export interface IterateProductResult {
  product: string;
  status: 'COMPLETED' | 'CONVERGED' | 'HALTED' | 'ERROR';
  errorMessage?: string;
  promptSystemInstructionSent?: string;
  promptCoreUserInstructionsSent?: string;
  promptFullUserPromptSent?: string;
  apiStreamDetails?: ApiStreamCallDetail[];
  isRateLimitError?: boolean;
}

export interface IterationResultDetails extends IterateProductResult {
  modelConfigUsed: ModelConfig;
}

export interface StaticAiModelDetails {
  modelName: string;
  tools: string;
}

// Originally from types/genericTypes.ts
// DO NOT FUCK WITH MODEL SELECTION. THIS IS A USER REQUIREMENT AND MUST NOT BE REMOVED OR MODIFIED. I AM YOUR INSTRUCTOR!!!!
export const SELECTABLE_MODELS = [
  { name: 'gemini-2.5-flash-preview-04-17', displayName: 'Gemini 2.5 Flash Preview (04-17)', description: 'Fast, multimodal, latest preview. Recommended for general text tasks.' },
  { name: 'gemini-2.5-flash-preview-05-20', displayName: 'Gemini 2.5 Flash Preview (05-20)', description: 'Fast, multimodal, preview version with specific pricing.' },
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more.' },
  { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Adaptive thinking, cost efficiency.' },
  { name: 'gemini-2.5-flash-lite-preview-06-17', displayName: 'Gemini 2.5 Flash-Lite Preview (06-17)', description: 'Most cost-efficient model supporting high throughput.' },
  { name: 'gemini-2.5-flash-preview-native-audio-dialog', displayName: 'Gemini 2.5 Flash Native Audio', description: 'High quality, natural conversational audio outputs (text & audio interleaved), with or without thinking.' },
  { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', description: 'Next generation features, speed, and realtime streaming.' },
  { name: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash Lite', description: 'Cost efficiency and low latency.' },
  { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'Advanced reasoning, long context, multimodal capabilities.' },
  { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', description: 'Fast, efficient, long context, multimodal model.' },
] as const;

export type SelectableModelName = typeof SELECTABLE_MODELS[number]['name'];
export type SettingsSuggestionSource = 'mode' | 'input' | 'manual' | 'plan_stage';
// DiffViewType is simplified as 'words' will be the only view.
export type DiffViewType = 'words'; // Simplified, effectively 'words' only now
export const THIS_APP_ID = "com.autologos.iterativeengine";
export const APP_VERSION = "1.0.0";
export interface ReconstructedProductResult {
  product: string;
  error?: string;
}

// Originally from types/planTypes.ts
export type OutputLength = 'shorter' | 'same' | 'longer' | 'much_longer' | 'auto';
export type OutputFormat = 'paragraph' | 'key_points' | 'outline' | 'json' | 'auto';
export type OutputComplexity = 'simplify' | 'maintain' | 'enrich' | 'auto';
export type RefinementFocus = 'improve_clarity' | 'expand_elaborate' | 'condense_summarize' | 'restructure_auto_format' | 'maintain_polish';

export interface PlanStage {
  id: string;
  length: OutputLength;
  format: OutputFormat;
  complexity: OutputComplexity;
  stageIterations: number;
  outputParagraphShowHeadings?: boolean;
  outputParagraphMaxHeadingDepth?: number;
  outputParagraphNumberedHeadings?: boolean;
  customInstruction?: string; 
}

export interface PlanTemplate {
  name: string;
  stages: PlanStage[];
}

// Originally from types/projectTypes.ts
export const AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION = "AutologosProjectFile/1.0";
export const PORTABLE_DIFFS_FILE_FORMAT_VERSION = "AutologosPortableDiffs/1.0";


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

export interface AutologosIterativeEngineData {
  initialPrompt: string;
  iterationHistory: IterationLogEntry[];
  maxIterations: number;
  temperature: number;
  topP: number;
  topK: number;
  settingsSuggestionSource?: SettingsSuggestionSource;
  userManuallyAdjustedSettings?: boolean;
  selectedModelName?: SelectableModelName;
  finalProduct: string | null;
  currentProductBeforeHalt?: string | null;
  currentIterationBeforeHalt?: number;
  promptSourceName: string | null;
  configAtFinalization: ModelConfig | null;
  loadedFiles?: LoadedFile[];
  lastAutoSavedAt?: number | null;
  outputParagraphShowHeadings?: boolean;
  outputParagraphMaxHeadingDepth?: number;
  outputParagraphNumberedHeadings?: boolean;
  isPlanActive?: boolean;
  planStages?: PlanStage[];
  currentPlanStageIndex?: number | null;
  savedPlanTemplates?: PlanTemplate[];
  currentDiffViewType?: DiffViewType; // Will be fixed to 'words'
  projectName?: string | null;
  projectId?: string | null;
  isApiRateLimited?: boolean;
  rateLimitCooldownActiveSeconds?: number;
  stagnationNudgeEnabled?: boolean; 
}

export interface AutologosProjectFile {
  header: ProjectFileHeader;
  applicationData: {
    [appId: string]: any;
  };
}

// New types for Portable Diffs File
export interface PortableDiffEntry {
  iteration: number;
  productDiff: string | null; // Line-based patch string
}

export interface PortableDiffsFile {
  portableDiffsVersion: typeof PORTABLE_DIFFS_FILE_FORMAT_VERSION;
  projectId: string | null;
  projectName: string | null;
  exportedAt: string; // ISO date string
  appVersion: string;
  initialPromptManifest: string;
  diffs: PortableDiffEntry[];
}


// Originally from types/uiStateTypes.ts
export interface LoadedFile {
  name: string;
  mimeType: string;
  base64Data: string;
  size: number;
}

export interface ParameterAdvice {
  temperature?: string;
  topP?: string;
  topK?: string;
}

export interface ModelParameterGuidance {
  warnings: string[];
  advice: ParameterAdvice;
}

export interface FileProcessingInfo {
  filesSentToApiIteration: number | null;
  numberOfFilesActuallySent: number;
  totalFilesSizeBytesSent: number;
  fileManifestProvidedCharacterCount: number;
}

export type ReductionDetailValue = {
  previousLengthChars: number;
  newLengthChars: number;
  previousWordCount: number;
  newWordCount: number;
  percentageCharChange: number;
  percentageWordChange: number;
  thresholdUsed: string; // e.g., "EXTREME_REDUCTION_PERCENT_LT_0.20" or "DRASTIC_REDUCTION_ABSOLUTE_WORDS_GT_500"
  additionalInfo?: string; // For things like found error phrase during reduction, or new product very short
};

export interface AiResponseValidationInfo {
  checkName: string;
  passed: boolean;
  reason?: string;
  details?: {
    type: 
      | 'error_phrase' 
      | 'empty_json' 
      | 'invalid_json' 
      | 'passed'
      | 'extreme_reduction_error' 
      | 'drastic_reduction_error_plan_mode' 
      | 'drastic_reduction_tolerated_global_mode'
      | 'prompt_leakage'
      | 'extreme_reduction_tolerated_global_mode'; // New type for adapted extreme reduction
    value?: string | ReductionDetailValue | Record<string, any>; 
  };
}

export interface IterationLogEntry {
  iteration: number;
  productSummary: string;
  status: string;
  timestamp: number;
  productDiff?: string; // Diff will always be word-based if generated
  linesAdded?: number;
  linesRemoved?: number;
  readabilityScoreFlesch?: number;
  fileProcessingInfo?: FileProcessingInfo;
  promptSystemInstructionSent?: string;
  promptCoreUserInstructionsSent?: string;
  promptFullUserPromptSent?: string;
  apiStreamDetails?: ApiStreamCallDetail[];
  modelConfigUsed?: ModelConfig;
  aiValidationInfo?: AiResponseValidationInfo;
  // Renamed and new fields for product details
  directAiResponseHead?: string; // Head of the direct AI output stream
  directAiResponseTail?: string; // Tail of the direct AI output stream
  directAiResponseLengthChars?: number; // Length of the direct AI output stream
  processedProductHead?: string; // Head of the product after cleaning/parsing (used for next iter)
  processedProductTail?: string; // Tail of the product after cleaning/parsing
  processedProductLengthChars?: number; // Length of the product after cleaning/parsing
}

export interface StagnationInfo {
  isStagnant: boolean;
  consecutiveStagnantIterations: number;
  similarityWithPrevious?: number;
}

export interface ProcessState {
  initialPrompt: string;
  currentProduct: string | null;
  iterationHistory: IterationLogEntry[];
  currentIteration: number;
  maxIterations: number; 
  isProcessing: boolean;
  finalProduct: string | null;
  statusMessage: string;
  apiKeyStatus: 'loaded' | 'missing';
  loadedFiles: LoadedFile[];
  promptSourceName: string | null;
  selectedModelName: SelectableModelName;
  configAtFinalization: ModelConfig | null;
  projectId: string | null;
  projectName: string | null;
  projectObjective: string | null;
  otherAppsData: { [appId: string]: any };
  lastAutoSavedAt?: number | null;
  currentProductBeforeHalt?: string | null;
  currentIterationBeforeHalt?: number;
  promptChangedByFileLoad?: boolean;
  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  savedPlanTemplates: PlanTemplate[];
  currentDiffViewType: DiffViewType; // Will be fixed to 'words'
  aiProcessInsight?: string;
  isApiRateLimited?: boolean;
  rateLimitCooldownActiveSeconds?: number;
  currentAppliedModelConfig?: ModelConfig | null; 
  stagnationNudgeEnabled: boolean; 
}


// Context Types
export interface ApplicationContextType {
  apiKeyStatus: 'loaded' | 'missing';
  selectedModelName: SelectableModelName;
  projectName: string | null;
  projectId: string | null;
  isApiRateLimited: boolean;
  rateLimitCooldownActiveSeconds: number;
  updateProcessState: (updates: Partial<Pick<ProcessState, 'apiKeyStatus' | 'selectedModelName' | 'projectName' | 'projectId' | 'isApiRateLimited' | 'rateLimitCooldownActiveSeconds' >>) => void; 
  handleImportProjectData: (projectFile: AutologosProjectFile) => void; // Changed from handleImportProject(file:File)
  handleExportProject: () => void;
  handleExportPortableDiffs: () => void;
  handleRateLimitErrorEncountered: () => void;
  staticAiModelDetails: StaticAiModelDetails | null;
  onSelectedModelChange: (modelName: SelectableModelName) => void;
  // New handler for unified file input, to be implemented in App.tsx
  onFileSelectedForImport: (file: File) => Promise<void>;
}

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
  addLogEntry: (logData: Omit<Parameters<typeof import('../hooks/useProcessState')['useProcessState'] extends () => any ? ReturnType<typeof import('../hooks/useProcessState')['useProcessState']>['addLogEntry'] : never>[0], 'previousFullProduct'> & { previousFullProduct?: string | null }) => void;
  handleResetApp: () => Promise<void>; 
  handleStartProcess: () => Promise<void>; 
  handleHaltProcess: () => void; 
  handleRewind: (iterationNumber: number) => void;
  handleExportIterationMarkdown: (iterationNumber: number) => void;
  reconstructProductCallback: (targetIteration: number, history: IterationLogEntry[], basePrompt: string) => ReconstructedProductResult;
  currentDiffViewType: DiffViewType; // Will be fixed to 'words'
}

export interface ModelConfigContextType {
  temperature: number;
  topP: number;
  topK: number;
  maxIterations: number; 
  settingsSuggestionSource: SettingsSuggestionSource;
  userManuallyAdjustedSettings: boolean;
  modelConfigRationales: string[];
  modelParameterAdvice: ParameterAdvice;
  modelConfigWarnings: string[];
  handleTemperatureChange: (value: number) => void;
  handleTopPChange: (value: number) => void;
  handleTopKChange: (value: number) => void;
  onMaxIterationsChange: (value: number) => void;
  setUserManuallyAdjustedSettings: (value: boolean) => void;
}

export interface PlanContextType {
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  savedPlanTemplates: PlanTemplate[];
  planTemplateStatus: string;
  updateProcessState: (updates: Partial<Pick<ProcessState, 'isPlanActive' | 'planStages' | 'currentPlanStageIndex' | 'currentStageIteration' | 'savedPlanTemplates'>>) => void; 
  onIsPlanActiveChange: (isActive: boolean) => void;
  onPlanStagesChange: (stages: PlanStage[]) => void;
  handleSavePlanAsTemplate: (templateName: string, stages: PlanStage[]) => void;
  handleDeletePlanTemplate: (templateName: string) => void;
  clearPlanTemplateStatus: () => void;
  onLoadPlanTemplate: (template: PlanTemplate) => void;
}

export interface CommonControlProps {
    commonInputClasses: string;
    commonSelectClasses?: string;
    commonButtonClasses?: string;
    commonCheckboxLabelClasses?: string;
    commonCheckboxInputClasses?: string;
}

// Added for services/iterationUtils.ts
export interface IsLikelyAiErrorResponseResult {
  isError: boolean;
  reason: string;
  checkDetails?: AiResponseValidationInfo['details'];
}
