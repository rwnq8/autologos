// types.ts

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  thinkingConfig?: {
    thinkingBudget: number; 
  };
  modelName?: SelectableModelName;
  maxIterations?: number;
}

export interface ApiStreamCallDetail {
  callCount: number;
  promptForThisCall: string;
  finishReason: string | null;
  safetyRatings: any | null;
  textLengthThisCall: number;
  isContinuation: boolean;
  segmentIndex?: number;
  segmentTitle?: string;
  functionCall?: { name: string; args: any };
  functionResponse?: { name: string; response: any };
  groundingMetadata?: any;
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
  { name: 'gemini-2.5-flash-preview-04-17', displayName: 'Gemini 2.5 Flash Preview (04-17)', description: 'Fast, multimodal, latest preview. Supports thinkingConfig. Recommended for general text tasks.', supportsFunctionCalling: false },
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more. (No thinkingConfig)', supportsFunctionCalling: true },
  { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro (Legacy)', description: 'Advanced reasoning, long context, multimodal capabilities. (No thinkingConfig)', supportsFunctionCalling: true },
  { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash (Legacy)', description: 'Fast, efficient, long context, multimodal model. (No thinkingConfig)', supportsFunctionCalling: false },
  { name: 'gemini-pro', displayName: 'Gemini Pro (Legacy)', description: 'General purpose model for text generation, chat, and code. (No thinkingConfig)', supportsFunctionCalling: true },
] as const;


export type SelectableModelName = typeof SELECTABLE_MODELS[number]['name'];
export type SettingsSuggestionSource = 'mode' | 'input' | 'manual' | 'plan_stage' | 'strategy_service';
export type DiffViewType = 'words';
export const THIS_APP_ID = "com.autologos.iterativeengine";
export const APP_VERSION = "2.0.0"; // Version bump for new versioning system

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

export const AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION = "AutologosProjectFile/2.0"; // Version Bump for new versioning

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

export type IterationEntryType = 
  | 'initial_state' 
  | 'ai_iteration' 
  | 'manual_edit' 
  | 'ensemble_sub_iteration' 
  | 'ensemble_integration'
  | 'targeted_refinement'
  | 'bootstrap_sub_iteration'
  | 'bootstrap_synthesis_milestone';

export interface Version {
  major: number;
  minor: number;
  patch?: number;
}

export interface IterationLogEntry {
  majorVersion: number;
  minorVersion: number;
  patchVersion?: number; 

  entryType: IterationEntryType;
  productSummary: string;
  status: string;
  timestamp: number;
  productDiff?: string;
  linesAdded?: number;
  linesRemoved?: number;
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
  strategyRationale?: string;
  currentModelForIteration?: SelectableModelName;
  activeMetaInstruction?: string;
  isCriticalFailure?: boolean;
  groundingMetadata?: any;
  similarityWithPreviousLogged?: number;
  isStagnantIterationLogged?: boolean;
  isEffectivelyIdenticalLogged?: boolean;
  isLowValueIterationLogged?: boolean;
  ensembleSampleId?: number; 
  isSegmentedSynthesis?: boolean;
  isTargetedRefinement?: boolean;
  targetedSelection?: string;
  targetedRefinementInstructions?: string;
  attemptCount?: number;
  bootstrapRun?: number;
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
  relatedIteration?: string; // Storing the formatted version string 'v1.2'
  tags?: string[];
  resolution?: string;
}

export interface AutologosIterativeEngineData {
  initialPrompt: string;
  iterationHistory: IterationLogEntry[];
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
  isProcessing: boolean;
  statusMessage: string;
  apiKeyStatus: 'loaded' | 'missing';
  currentMajorVersion: number;
  currentMinorVersion: number;
  currentProduct: string | null;
  promptChangedByFileLoad: boolean;
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  aiProcessInsight?: string;
  currentAppliedModelConfig?: ModelConfig | null;
  stagnationInfo: StagnationInfo;
  currentModelForIteration?: SelectableModelName;
  activeMetaInstructionForNextIter?: string;
  isTargetedRefinementModalOpen?: boolean;
  currentTextSelectionForRefinement?: string | null;
  instructionsForSelectionRefinement?: string;
  isEditingCurrentProduct?: boolean;
  editedProductBuffer?: string | null;
}

export interface FileProcessingInfo {
  filesSentToApiIteration: number | null;
  numberOfFilesActuallySent: number;
  totalFilesSizeBytesSent: number;
  fileManifestProvidedCharacterCount: number;
  loadedFilesForIterationContext?: LoadedFile[];
}

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
}

export type NudgeStrategy = 'none' | 'params_light' | 'params_heavy' | 'meta_instruct' | 'radical_kickstart';

export interface CommonControlProps {
  commonInputClasses?: string;
  commonSelectClasses?: string;
  commonCheckboxLabelClasses?: string;
  commonCheckboxInputClasses?: string;
  commonButtonClasses?: string;
}

export interface LoadedFile {
  name: string;
  mimeType: string;
  content: string;
  size: number;
}


export interface AutologosProjectFile {
  header: ProjectFileHeader;
  applicationData: {
    [appId: string]: AutologosIterativeEngineData;
  };
}

export type PromptLeakageDetailValue = { marker: string; snippet: string; };
export type ReductionDetailValue = { previousLengthChars: number; newLengthChars: number; previousWordCount: number; newWordCount: number; percentageCharChange: number; percentageWordChange: number; thresholdUsed: 'extreme' | 'drastic' | 'significant'; additionalInfo?: string; };
export type InitialSynthesisDetailValue = { dataDumpReason: string; };
export type AiResponseValidationInfoDetailsValue = string | PromptLeakageDetailValue | ReductionDetailValue | InitialSynthesisDetailValue | { [key: string]: any };

export interface AiResponseValidationInfo {
  checkName: string;
  passed: boolean;
  isCriticalFailure?: boolean;
  reason: string;
  details?: {
    type: string;
    value?: AiResponseValidationInfoDetailsValue;
  };
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

export interface IsLikelyAiErrorResponseResult {
  isError: boolean;
  isCriticalFailure: boolean;
  reason: string;
  checkDetails: AiResponseValidationInfo['details'];
}

export interface StrategistLLMContext {
  productDevelopmentState: 'UNKNOWN' | 'UNDERDEVELOPED_KERNEL' | 'NEEDS_EXPANSION_STALLED' | 'DEVELOPED_DRAFT' | 'MATURE_PRODUCT';
  stagnationSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  recentIterationPerformance: 'PRODUCTIVE' | 'LOW_VALUE' | 'STALLED';
  lastNValidationSummaries: string;
}

export interface ModelStrategy {
    modelName: SelectableModelName;
    config: ModelConfig;
    rationale: string;
    activeMetaInstruction?: string;
}
