

export enum AnalysisType {
  STRUCTURAL_CRITIQUE = 'StructuralCritique',
  RISK_ASSESSMENT_FAILURE_MODES = 'RiskAssessmentFailureModes',
  ASSUMPTION_CHALLENGE = 'AssumptionChallenge',
  GAP_OMISSION_ANALYSIS = 'GapOmissionAnalysis',
  ALTERNATIVE_STRATEGIES = 'AlternativeStrategies',
  RHETORICAL_FALLACY_CRITIQUE = 'RhetoricalFallacyCritique', // New analysis type
  FULL_REPORT_EXPORT = 'FullReportExport', // Added for combined export placeholder
}

export const ALL_ANALYSIS_TYPES = Object.values(AnalysisType);

export interface AnalysisResult {
  type: AnalysisType;
  isLoading: boolean;
  isStreaming: boolean;
  content: string;
  error: string | null;
  originalFileName?: string | null; // To store filename if input was from a file
}

export type AnalysisResultsState = Record<AnalysisType, AnalysisResult>;

export interface AppState {
  userInput: string;
  originalFileName: string | null;
  analysisResults: AnalysisResultsState;
  globalError: string | null;
  isInstructionsCollapsed: boolean;
  isInputCollapsed: boolean;
  isRunAllActive: boolean;
  activeAnalysesCount: number; // Count of individual analyses currently running
  theme: 'light' | 'dark'; // For theme switching if implemented
}

// Helper to initialize analysis results state
export const initializeAnalysisResults = (): AnalysisResultsState => {
  const initialState = {} as AnalysisResultsState;
  ALL_ANALYSIS_TYPES.forEach(type => {
    initialState[type] = {
      type: type,
      isLoading: false,
      isStreaming: false,
      content: '',
      error: null,
      originalFileName: null,
    };
  });
  return initialState;
};

// --- Added Project Management Types ---

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  PROJECT_WORKSPACE = 'PROJECT_WORKSPACE',
}

export enum ProjectTaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  DEFERRED = 'deferred',
}
export const ALL_TASK_STATUSES: ProjectTaskStatus[] = Object.values(ProjectTaskStatus);

export enum StepType {
  INPUT_TEXT = 'INPUT_TEXT',
  AI_PROCESS = 'AI_PROCESS',
  FILE_UPLOAD = 'FILE_UPLOAD',
  AI_SIMULATION = 'AI_SIMULATION',
  AI_CRITICAL_ANALYSIS = 'AI_CRITICAL_ANALYSIS',
}

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  // Add other model config parameters if needed
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
};

export interface OutputVersion {
  versionId: string;
  timestamp: string; // ISO date string
  data: string;
  source: string; // e.g., 'user_input', 'llm_generation', 'iteration', 'llm_simulation_report', 'llm_critical_analysis_report'
  changeSummaryFromIteration?: string; // Optional summary from advanced iteration
  iterationDetails?: { // Optional details if from advanced iteration
    instruction: string;
    modelConfig: ModelConfig;
  };
}

export interface IterationLogEntry {
  iterationNumber: number;
  refinementInstruction: string;
  output: string;
  modelConfigUsed: ModelConfig;
  timestamp: string;
  status: 'success' | 'error';
  errorDetails?: string;
}

export interface AdvancedIterationState {
  parentProjectId: string;
  parentTaskId: string;
  parentTaskName?: string;
  baseOutputVersion: OutputVersion;
  currentIterationNumber: number;
  maxIterationsInSession: number;
  currentRefinementInstruction: string;
  currentModelConfig: ModelConfig;
  iterationHistory: IterationLogEntry[];
  status: 'idle' | 'processing' | 'error' | 'max_iterations_reached' | 'success';
  errorMessage?: string;
}

export interface ProjectTaskConfig {
  prompt?: string;
  initialText?: string; // Used by INPUT_TEXT, AI_PROCESS (base), AI_CRITICAL_ANALYSIS (text to analyze)
  outputFormat?: 'text' | 'markdown';
  inputSource?: 'config' | 'previous_task_output' | 'active_editor_content'; // For AI_PROCESS
  acceptedFileTypes?: string; // For FILE_UPLOAD
  simulationCode?: string; // For AI_SIMULATION
  simulationContext?: string; // For AI_SIMULATION
  analysisType?: 'LOGICAL_CONSISTENCY' | 'ASSUMPTION_IDENTIFICATION'; // For AI_CRITICAL_ANALYSIS
}

export interface ProjectTask {
  id: string;
  name: string;
  type: StepType;
  config: ProjectTaskConfig;
  status: ProjectTaskStatus;
  outputs: OutputVersion[];
  currentOutputVersionId?: string | null;
  taskObjective?: string;
  lastWorkedOn?: string; // ISO date string
  dependencies?: string[]; // Array of task IDs
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  programId: string;
  tasks: ProjectTask[];
  projectObjective?: string;
  documentStatus?: string; // e.g., 'Draft', 'Review', 'Approved'
}

export interface Program {
  id: string;
  name: string;
}