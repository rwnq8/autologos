// types/models.ts

export const SELECTABLE_MODELS = [
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Highest quality, for complex reasoning, multimodal understanding, and advanced coding.', supportsThinking: false, supportsFunctionCalling: true },
  { name: 'gemini-2.5-flash-preview-04-17', displayName: 'Gemini 2.5 Flash', description: 'Fast, multimodal, latest preview. Supports thinkingConfig for lower latency. Recommended for general text tasks.', supportsThinking: true, supportsFunctionCalling: true },
  { name: 'gemini-2.5-lite-preview-04-17', displayName: 'Gemini 2.5 Lite', description: 'Cost-effective and low-latency model for large-scale, efficient processing.', supportsThinking: false, supportsFunctionCalling: true },
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
