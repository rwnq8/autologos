
export interface IterationLogEntry {
  iteration: number;
  productSummary: string; // A summary or key aspect of the product at this iteration
  status: string;
  timestamp: string;
  fullProduct?: string; // Optional full product for detailed view
  linesAdded?: number;
  linesRemoved?: number;
}

export interface LoadedFile {
  name: string;
  content: string;
}

export type ProcessingMode = 'expansive' | 'convergent';
export type SettingsSuggestionSource = 'mode' | 'input' | 'manual';

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
}

export interface ParameterAdvice {
  temperature?: string;
  topP?: string;
  topK?: string;
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
  processingMode: ProcessingMode;
  temperature: number;
  topP: number;
  topK: number;
  settingsSuggestionSource: SettingsSuggestionSource;
  userManuallyAdjustedSettings: boolean;
  modelConfigRationales: string[]; // New: Reasons for AI's suggestions
  modelParameterAdvice: ParameterAdvice; // New: Dynamic advice for parameters
  // overallEvolutionSummary: string | null; 
  configAtFinalization: ModelConfig | null; 
}

// Used for static details in the footer
export interface StaticAiModelDetails {
  modelName: string;
  tools: string; 
}

// Props needed by DisplayArea for generating YAML frontmatter and displaying overall summary
export interface DisplayAreaExternalProps {
  initialPromptForYAML: string;
  configAtFinalizationForYAML: ModelConfig | null; 
  staticAiModelDetailsForYAML: StaticAiModelDetails | null;
  // overallEvolutionSummary: string | null; 
}

// For services/geminiService.ts
export interface SuggestedParamsResponse {
    config: ModelConfig;
    rationales: string[];
}

export interface ModelParameterGuidance {
    warnings: string[];
    advice: ParameterAdvice;
}