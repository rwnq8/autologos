// types/models.ts

export const SELECTABLE_MODELS = [
  { name: 'gemini-2.5-flash-preview-04-17', displayName: 'Gemini 2.5 Flash', description: 'Fast, multimodal, latest preview. Supports thinkingConfig for lower latency. Recommended for general text tasks.', supportsThinking: true, supportsFunctionCalling: true },
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
    id?: string;
    modelName: SelectableModelName;
    config: ModelConfig;
    rationale: string;
    activeMetaInstruction?: string;
    shouldHalt?: boolean;
}