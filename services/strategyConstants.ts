import type { ModelConfig } from '../types.ts';

// Nudge values for light adjustments
export const STAGNATION_TEMP_NUDGE_LIGHT = 0.05;
export const STAGNATION_TOPP_NUDGE_LIGHT = 0.02;
export const STAGNATION_TOPK_NUDGE_FACTOR_LIGHT = 1.05; // Multiplicative factor

// Nudge values for heavy adjustments
export const STAGNATION_TEMP_NUDGE_HEAVY = 0.10;
export const STAGNATION_TOPP_NUDGE_HEAVY = 0.05;
export const STAGNATION_TOPK_NUDGE_FACTOR_HEAVY = 1.15; // Multiplicative factor

// Iteration by which Global Mode aims for deterministic params
export const DETERMINISTIC_TARGET_ITERATION = 20;

// The focused end-state for the parameter sweep in Global Mode
export const FOCUSED_END_DEFAULTS: ModelConfig = { temperature: 0.0, topP: 0.9, topK: 5 };
