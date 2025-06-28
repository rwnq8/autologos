// types.ts

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxIterations?: number; // Kept here as it can be part of a "mode" config default
  modelName?: SelectableModelName; // For logging/reference if set with config
  thinkingConfig?: {
    thinkingBudget: number; // 0 to disable, >0 for budget (e.g., 1 for enabled on Flash)
  };
}

export interface ApiStreamCallDetail {
  callCount: number;
  promptForThisCall: string;
  finishReason: string | null;
  safetyRatings: any | null;
  textLengthThisCall: number;
  isContinuation: boolean;
  segmentIndex?: number; // For segmented synthesis
  segmentTitle?: string; // For segmented synthesis
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
  isStuckOnMaxTokensContinuation?: boolean;
  groundingMetadata?: any;
}

export interface IterationResultDetails extends IterateProductResult {
  modelConfigUsed: ModelConfig;
  isCriticalFailure?: boolean;
}

export interface StaticAiModelDetails {
  modelName: string;
  tools: string;
}

export const SELECTABLE_MODELS = [
  // Current & Recommended
  { name: 'gemini-2.5-flash-preview-04-17', displayName: 'Gemini 2.5 Flash Preview (04-17)', description: 'Fast, multimodal, latest preview. Supports thinkingConfig. Recommended for general text tasks.' },
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more. (No thinkingConfig)' },
 
  // All other models as requested by user, including those previously marked deprecated
  { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro (Legacy)', description: 'Advanced reasoning, long context, multimodal capabilities. (No thinkingConfig)' },
  { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash (Legacy)', description: 'Fast, efficient, long context, multimodal model. (No thinkingConfig)' },
  { name: 'gemini-pro', displayName: 'Gemini Pro (Legacy)', description: 'General purpose model for text generation, chat, and code. (No thinkingConfig)'},
 
  // Older models, included per user request (functionality may vary, thinkingConfig likely not supported)
  { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash (User Requested)', description: 'Adaptive thinking, cost efficiency. (Check API for thinkingConfig support)' },
  { name: 'gemini-2.5-flash-lite-preview-06-17', displayName: 'Gemini 2.5 Flash-Lite Preview (06-17, User Requested)', description: 'Most cost-efficient model supporting high throughput. (Likely no thinkingConfig)' },
  { name: 'gemini-2.5-flash-preview-05-20', displayName: 'Gemini 2.5 Flash Preview (05-20, User Requested)', description: 'Fast, multimodal, preview version. (Check API for thinkingConfig support)' },
  { name: 'gemini-2.5-flash-preview-native-audio-dialog', displayName: 'Gemini 2.5 Flash Native Audio (User Requested)', description: 'High quality conversational audio outputs. (May have implicit thinking)' },
  { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash (User Requested)', description: 'Next generation features, speed. (Likely no thinkingConfig)' },
  { name: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash Lite (User Requested)', description: 'Cost efficiency and low latency. (Likely no thinkingConfig)' },
] as const;


export type SelectableModelName = typeof SELECTABLE_MODELS[number]['name'];
export type SettingsSuggestionSource = 'mode' | 'input' | 'manual' | 'plan_stage' | 'strategy_service';
export type DiffViewType = 'words';
export const THIS_APP_ID = "com.autologos.iterativeengine";
export const APP_VERSION = "1.0.0";

export interface ReconstructedProductResult {
  product: string;
  error?: string;
}

export type OutputLength = 'shorter' | 'same' | 'longer' | 'much_longer' | 'auto';
export type OutputFormat = 'paragraph' | 'key_points' | 'outline' | 'json' | 'auto';
export type OutputComplexity = 'simplify' | 'maintain' | 'enrich' | 'auto';

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

export const AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION = "AutologosProjectFile/1.0";

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

export type IterationEntryType = 'initial_state' | 'ai_iteration' | 'manual_edit' | 'segmented_synthesis_milestone' | 'targeted_refinement';

export interface IterationLogEntry {
  iteration: number;
  entryType?: IterationEntryType;
  productSummary: string;
  status: string;
  timestamp: number;
  productDiff?: string;
  linesAdded?: number;
  linesRemoved?: number;
  netLineChange?: number;
  charDelta?: number;
  readabilityScoreFlesch?: number;
  lexicalDensity?: number;
  avgSentenceLength?: number;
  typeTokenRatio?: number;
  fileProcessingInfo: FileProcessingInfo;
  promptSystemInstructionSent?: string;
  promptCoreUserInstructionsSent?: string;
  promptFullUserPromptSent?: string;
  apiStreamDetails?: ApiStreamCallDetail[];
  modelConfigUsed?: ModelConfig;
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
  isCriticalFailure?: boolean;
  groundingMetadata?: any;
  // Fields for per-iteration stagnation metrics
  similarityWithPreviousLogged?: number;
  isStagnantIterationLogged?: boolean;
  isEffectivelyIdenticalLogged?: boolean;
  isLowValueIterationLogged?: boolean;
}

export type DevLogEntryType = 'issue' | 'fix' | 'feature' | 'decision' | 'note';
export type DevLogEntryStatus = 'open' | 'in_progress' | 'resolved' | 'implemented' | 'closed' | 'deferred';

export interface DevLogEntry {
  id: string;
  timestamp: number;
  lastModified: number;
  type: DevLogEntryType;
  summary: string;
  details?: string;
  status: DevLogEntryStatus;
  relatedIteration?: number;
  tags?: string[];
  resolution?: string;
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
  currentDiffViewType?: DiffViewType;
  projectName?: string | null;
  projectId?: string | null;
  isApiRateLimited?: boolean;
  rateLimitCooldownActiveSeconds?: number;
  stagnationNudgeEnabled?: boolean;
  isSearchGroundingEnabled?: boolean;
  inputComplexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  strategistInfluenceLevel: 'OFF' | 'SUGGEST' | 'ADVISE_PARAMS_ONLY' | 'OVERRIDE_FULL';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';
  devLog?: DevLogEntry[];
}

export interface AutologosProjectFile {
  header: ProjectFileHeader;
  applicationData: {
    [appId: string]: any;
  };
}

export interface LoadedFile {
  name: string;
  mimeType: string;
  content: string; // Changed from base64Data to simplify and focus on text
  size: number;
}

export interface ParameterAdvice {
  temperature?: string;
  topP?: string;
  topK?: string;
  thinkingConfig?: string;
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
  loadedFilesForIterationContext?: LoadedFile[];
}

export type ReductionDetailValue = {
  previousLengthChars: number;
  newLengthChars: number;
  previousWordCount: number;
  newWordCount: number;
  percentageCharChange: number;
  percentageWordChange: number;
  thresholdUsed: string;
  additionalInfo?: string;
};

export interface PromptLeakageDetailValue {
  marker: string;
  snippet: string;
}

export interface AiResponseValidationInfoDetailsValue_InitialSynthesis extends Partial<ReductionDetailValue> {
    inputChars?: number;
    outputChars?: number;
    isOutlineDriven?: boolean;
    factorUsed?: number;
    phrase?: string;
    isDataDump?: boolean;
    dataDumpReason?: string;
}

export type AiResponseValidationInfoDetailsType =
  | 'error_phrase'
  | 'empty_json'
  | 'invalid_json'
  | 'passed'
  | 'prompt_leakage'
  | 'initial_synthesis_failed_data_dump'
  | 'catastrophic_collapse'
  | 'error_phrase_with_significant_reduction'
  | 'extreme_reduction_error'
  | 'extreme_reduction_instructed_but_with_error_phrase'
  | 'extreme_reduction_tolerated_instruction'
  | 'extreme_reduction_tolerated_global_mode'
  | 'drastic_reduction_error_plan_mode'
  | 'drastic_reduction_with_error_phrase'
  | 'drastic_reduction_tolerated_instruction'
  | 'drastic_reduction_tolerated_global_mode'
  | 'uninstructed_reduction'
  | 'unknown_finish_reason_minimal_output'
  | 'unknown_finish_reason_abrupt_end'
  | 'max_tokens_with_incomplete_sentence'
  | 'convergence_on_underdeveloped_product';

export interface AiResponseValidationInfoDetails {
  type: AiResponseValidationInfoDetailsType;
  value?: string | ReductionDetailValue | PromptLeakageDetailValue | AiResponseValidationInfoDetailsValue_InitialSynthesis | { [key: string]: any };
}

export interface AiResponseValidationInfo {
  checkName: string;
  passed: boolean;
  isCriticalFailure?: boolean;
  reason?: string;
  details?: AiResponseValidationInfoDetails;
}

export interface IsLikelyAiErrorResponseResult {
  isError: boolean;
  isCriticalFailure: boolean;
  reason: string;
  checkDetails: AiResponseValidationInfoDetails;
}


export interface CommonControlProps {
  commonInputClasses: string;
  commonSelectClasses: string;
  commonCheckboxLabelClasses: string;
  commonCheckboxInputClasses: string;
  commonButtonClasses: string;
}

export type NudgeStrategy = 'none' | 'params_light' | 'params_heavy' | 'meta_instruct';

export interface StagnationInfo {
  isStagnant: boolean;
  consecutiveStagnantIterations: number;
  consecutiveIdenticalProductIterations: number;
  lastMeaningfulChangeProductLength?: number;
  similarityWithPrevious?: number;
  nudgeStrategyApplied: NudgeStrategy;
  consecutiveLowValueIterations: number;
  lastProductLengthForStagnation?: number;
  consecutiveWordsmithingIterations?: number;
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
  lastAutoSavedAt?: number | null;
  currentProductBeforeHalt?: string | null;
  currentIterationBeforeHalt?: number;
  promptChangedByFileLoad: boolean;
  outputParagraphShowHeadings: boolean;
  outputParagraphMaxHeadingDepth: number;
  outputParagraphNumberedHeadings: boolean;
  aiProcessInsight?: string;
  currentAppliedModelConfig?: ModelConfig | null;
  stagnationNudgeEnabled: boolean;
  isSearchGroundingEnabled: boolean;
  stagnationInfo: StagnationInfo;
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  savedPlanTemplates: PlanTemplate[];
  currentDiffViewType: DiffViewType;
  isApiRateLimited?: boolean;
  rateLimitCooldownActiveSeconds?: number;
  inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  currentModelForIteration?: SelectableModelName;
  activeMetaInstructionForNextIter?: string;
  strategistInfluenceLevel: 'OFF' | 'SUGGEST' | 'ADVISE_PARAMS_ONLY' | 'OVERRIDE_FULL';
  stagnationNudgeAggressiveness: 'LOW' | 'MEDIUM' | 'HIGH';
  isTargetedRefinementModalOpen?: boolean;
  currentTextSelectionForRefinement?: string | null;
  instructionsForSelectionRefinement?: string;
  isEditingCurrentProduct?: boolean;
  editedProductBuffer?: string | null;
  devLog?: DevLogEntry[];
}

export interface RetryContext {
    previousErrorReason: string;
    originalCoreInstructions: string;
}
export interface OutlineGenerationResult {
    outline: string;
    identifiedRedundancies: string;
    errorMessage?: string;
    apiDetails?: ApiStreamCallDetail[];
}

export interface StrategistLLMContext {
  productDevelopmentState: 'UNKNOWN' | 'NEEDS_EXPANSION_STALLED' | 'UNDERDEVELOPED_KERNEL' | 'MATURE_PRODUCT' | 'DEVELOPED_DRAFT';
  stagnationSeverity: 'NONE' | 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'MILD';
  recentIterationPerformance: 'PRODUCTIVE' | 'STALLED' | 'LOW_VALUE';
}

export interface ModelStrategy {
  modelName: SelectableModelName;
  config: ModelConfig;
  rationale: string;
  activeMetaInstruction: string | undefined;
}

export interface StrategistAdvice {
  modelName?: SelectableModelName;
  config?: Partial<ModelConfig>;
  metaInstruction?: string;
  confidence?: number;
  rationale: string;
}