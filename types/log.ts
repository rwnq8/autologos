// types/log.ts

import type { ApiStreamCallDetail, AiResponseValidationInfo, OutlineGenerationResult } from './api';
import type { ModelConfig, SelectableModelName } from './models';
import type { FileProcessingInfo } from './project';


export interface Version {
  major: number;
  minor: number;
  patch?: number;
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
  versionRationale?: string;
  selfCritique?: string;
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
  isWordsmithingIterationLogged?: boolean;
  ensembleSampleId?: number; 
  isSegmentedSynthesis?: boolean;
  isTargetedRefinement?: boolean;
  targetedSelection?: string;
  targetedRefinementInstructions?: string;
  attemptCount?: number;
  bootstrapRun?: number;
  outlineForIter1?: OutlineGenerationResult;
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