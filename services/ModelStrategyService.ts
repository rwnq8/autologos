import type { ProcessState, ModelConfig, SelectableModelName, IterationLogEntry, PlanStage, StagnationInfo, ModelStrategy, LoadedFile, AiResponseValidationInfo, StrategistLLMContext } from '../types.ts';
import { CREATIVE_DEFAULTS, GENERAL_BALANCED_DEFAULTS, DEFAULT_MODEL_NAME } from './geminiService.ts';
import { CONVERGED_PREFIX } from './promptBuilderService.ts';
import { STAGNATION_TEMP_NUDGE_LIGHT, STAGNATION_TOPP_NUDGE_LIGHT, STAGNATION_TOPK_NUDGE_FACTOR_LIGHT, STAGNATION_TEMP_NUDGE_HEAVY, STAGNATION_TOPP_NUDGE_HEAVY, STAGNATION_TOPK_NUDGE_FACTOR_HEAVY, DETERMINISTIC_TARGET_ITERATION, FOCUSED_END_DEFAULTS } from '../hooks/useModelParameters.ts';
import { SELECTABLE_MODELS } from '../types.ts';
import { MIN_CHARS_FOR_DEVELOPED_PRODUCT } from './iterationUtils.ts';


export const sanitizeConfig = (config: ModelConfig, rationaleParts: string[]): ModelConfig => {
    const originalConf = {...config};
    const newConfig: ModelConfig = {
        temperature: Math.max(0.0, Math.min(2.0, parseFloat((originalConf.temperature || 0).toFixed(2)))),
        topP: Math.max(0.0, Math.min(1.0, parseFloat((originalConf.topP || 0).toFixed(2)))),
        topK: Math.max(1, Math.round(originalConf.topK || 1)),
    };
    if (originalConf.thinkingConfig !== undefined) {
        newConfig.thinkingConfig = { thinkingBudget: originalConf.thinkingConfig.thinkingBudget === 0 ? 0 : 1 };
    }

    if (newConfig.temperature !== originalConf.temperature) rationaleParts.push(`Parameter Clamp: Temperature adjusted from ${originalConf.temperature.toFixed(2)} to ${newConfig.temperature.toFixed(2)}.`);
    if (newConfig.topP !== originalConf.topP) rationaleParts.push(`Parameter Clamp: TopP adjusted from ${originalConf.topP.toFixed(2)} to ${newConfig.topP.toFixed(2)}.`);
    if (newConfig.topK !== originalConf.topK) rationaleParts.push(`Parameter Clamp: TopK adjusted from ${originalConf.topK} to ${newConfig.topK}.`);
    if (newConfig.thinkingConfig && originalConf.thinkingConfig && newConfig.thinkingConfig.thinkingBudget !== originalConf.thinkingConfig.thinkingBudget) {
        rationaleParts.push(`Parameter Clamp: Thinking Budget adjusted from ${originalConf.thinkingConfig.thinkingBudget} to ${newConfig.thinkingConfig.thinkingBudget}.`);
    }
    return newConfig;
};

export const determineInitialStrategy = (
    processState: Pick<ProcessState, 'inputComplexity' | 'initialPrompt' | 'loadedFiles' | 'selectedModelName' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness'>,
    baseUserConfig: ModelConfig
): ModelStrategy => {
    let modelName: SelectableModelName = processState.selectedModelName || DEFAULT_MODEL_NAME;
    let config = { ...baseUserConfig };
    const rationales: string[] = [];
    let thinkingBudget: number | undefined = undefined;

    switch (processState.inputComplexity) {
        case 'SIMPLE':
            modelName = 'gemini-2.5-pro';
            rationales.push("Heuristic: Initial Strategy - Using Gemini 2.5 Pro for simple input, aiming for high-quality initial output. User preferences applied.");
            break;
        case 'MODERATE':
            modelName = 'gemini-2.5-flash-preview-04-17';
            thinkingBudget = 1;
            rationales.push("Heuristic: Initial Strategy - Using Gemini 2.5 Flash Preview (thinking enabled) for moderate input, balancing capability and efficiency. User preferences applied.");
            break;
        case 'COMPLEX':
            modelName = 'gemini-2.5-flash-preview-04-17';
            thinkingBudget = 1;
            rationales.push("Heuristic: Initial Strategy - Using Gemini 2.5 Flash Preview (thinking enabled) for complex/large input, focusing on efficient processing. User preferences applied.");
            break;
        default:
            modelName = processState.selectedModelName || DEFAULT_MODEL_NAME;
            rationales.push("Heuristic: Initial Strategy - Defaulting to user-selected model or application default. User preferences applied.");
            if (modelName === 'gemini-2.5-flash-preview-04-17') thinkingBudget = 1;
            break;
    }

    if (thinkingBudget !== undefined && modelName === 'gemini-2.5-flash-preview-04-17') {
        config.thinkingConfig = { thinkingBudget };
    } else {
        delete config.thinkingConfig;
    }
    return { modelName, config: sanitizeConfig(config, rationales), rationale: rationales.join(' | '), activeMetaInstruction: undefined };
};

export const reevaluateStrategy = async (
    processState: Pick<ProcessState, 'currentProduct' | 'currentIteration' | 'maxIterations' | 'inputComplexity' | 'stagnationInfo' | 'iterationHistory' | 'currentModelForIteration' | 'currentAppliedModelConfig' | 'isPlanActive' | 'planStages'| 'currentPlanStageIndex' | 'selectedModelName' | 'stagnationNudgeEnabled' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness' | 'initialPrompt' | 'loadedFiles' | 'activeMetaInstructionForNextIter'> & {
        lastNValidationSummariesString?: string,
        productDevelopmentState: StrategistLLMContext['productDevelopmentState'],
        stagnationSeverity: StrategistLLMContext['stagnationSeverity'],
        recentIterationPerformance: StrategistLLMContext['recentIterationPerformance'],
        isRadicalRefinementKickstartAttempt?: boolean; 
    },
    baseUserConfig: ModelConfig
): Promise<ModelStrategy> => {
    const { currentIteration, maxIterations, isPlanActive, strategistInfluenceLevel } = processState;
    const rationales: string[] = [];
    let nextConfig: ModelConfig;
    let nextModelName: SelectableModelName = processState.currentModelForIteration || processState.selectedModelName || DEFAULT_MODEL_NAME;
    let activeMetaInstruction = processState.activeMetaInstructionForNextIter;

    if (isPlanActive) {
        nextConfig = { ...baseUserConfig };
        rationales.push("Plan Mode: Using fixed parameters set by user for all plan stages.");
    } else {
        const interpolationFactor = Math.min(1.0, currentIteration / DETERMINISTIC_TARGET_ITERATION);
        nextConfig = {
            temperature: baseUserConfig.temperature - interpolationFactor * (baseUserConfig.temperature - FOCUSED_END_DEFAULTS.temperature),
            topP: baseUserConfig.topP - interpolationFactor * (baseUserConfig.topP - FOCUSED_END_DEFAULTS.topP),
            topK: Math.max(1, Math.round(baseUserConfig.topK - interpolationFactor * (baseUserConfig.topK - FOCUSED_END_DEFAULTS.topK)))
        };
        rationales.push(`Heuristic Sweep: Iter ${currentIteration + 1}/${maxIterations}. Swept towards deterministic params.`);
    }
    
    return {
        modelName: nextModelName,
        config: sanitizeConfig(nextConfig, rationales),
        rationale: rationales.join(' | '),
        activeMetaInstruction: activeMetaInstruction
    };
};