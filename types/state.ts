
// types/state.ts

import type { IterationLogEntry, DevLogEntry, Version } from './log';
import type { ModelConfig, SelectableModelName, ModelStrategy } from './models';
import type { PlanStage, PlanTemplate } from './plan';
import type { LoadedFile } from './project';
import type { SettingsSuggestionSource, DiffViewType } from './ui';

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
  currentModelForIteration: SelectableModelName;
  activeMetaInstructionForNextIter?: string;
  isTargetedRefinementModalOpen?: boolean;
  currentTextSelectionForRefinement?: string | null;
  instructionsForSelectionRefinement?: string;
  isEditingCurrentProduct?: boolean;
  editedProductBuffer?: string | null;
  awaitingStrategyDecision: boolean;
  pendingStrategySuggestion: ModelStrategy | null;
}
