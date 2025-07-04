// types/models.ts

export const SELECTABLE_MODELS = [
  { name: 'gemini-2.5-flash-preview-04-17', displayName: 'Gemini 2.5 Flash Preview (04-17)', description: 'Fast, multimodal, latest preview. Supports thinkingConfig. Recommended for general text tasks.', supportsFunctionCalling: false },
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more. (No thinkingConfig)', supportsFunctionCalling: true },
  { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro (Legacy)', description: 'Advanced reasoning, long context, multimodal capabilities. (No thinkingConfig)', supportsFunctionCalling: true },
  { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash (Legacy)', description: 'Fast, efficient, long context, multimodal model. (No thinkingConfig)', supportsFunctionCalling: false },
  { name: 'gemini-pro', displayName: 'Gemini Pro (Legacy)', description: 'General purpose model for text generation, chat, and code. (No thinkingConfig)', supportsFunctionCalling: true },
] as const;


export type SelectableModelName = typeof SELECTABLE_MODELS[number]['name'];

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

export interface StaticAiModelDetails {
  modelName: string;
  tools: string;
}

export interface SuggestedParamsResponse {
  config: ModelConfig;
  rationales: string[];
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

export interface ModelStrategy {
    modelName: SelectableModelName;
    config: ModelConfig;
    rationale: string;
    activeMetaInstruction?: string;
}
