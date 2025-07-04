// types/plan.ts

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
