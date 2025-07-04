// types/api.ts

import type { ModelConfig } from './models';
import type { LoadedFile } from './project';

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

export interface IsLikelyAiErrorResponseResult {
  isError: boolean;
  isCriticalFailure: boolean;
  reason: string;
  checkDetails: AiResponseValidationInfo['details'];
}
