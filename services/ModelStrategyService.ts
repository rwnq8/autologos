
import type { ProcessState, ModelConfig, SelectableModelName, IterationLogEntry, PlanStage, StagnationInfo, ModelStrategy, LoadedFile, StrategistAdvice, AiResponseValidationInfo } from '../types.ts';
import { CREATIVE_DEFAULTS, FOCUSED_END_DEFAULTS, GENERAL_BALANCED_DEFAULTS, DEFAULT_MODEL_NAME, getStrategicAdviceFromLLM } from './geminiService';
import { DETERMINISTIC_TARGET_ITERATION, STAGNATION_TEMP_NUDGE_LIGHT, STAGNATION_TOPP_NUDGE_LIGHT, STAGNATION_TOPK_NUDGE_FACTOR_LIGHT, STAGNATION_TEMP_NUDGE_HEAVY, STAGNATION_TOPP_NUDGE_HEAVY, STAGNATION_TOPK_NUDGE_FACTOR_HEAVY } from '../hooks/useModelParameters'; // Assuming these constants are still relevant for base nudge values
import { SELECTABLE_MODELS } from '../types.ts';

const sanitizeConfig = (config: ModelConfig, rationaleParts: string[]): ModelConfig => {
    const originalConf = {...config};
    const newConfig: ModelConfig = {
        temperature: Math.max(0.0, Math.min(2.0, parseFloat((originalConf.temperature || 0).toFixed(2)))),
        topP: Math.max(0.0, Math.min(1.0, parseFloat((originalConf.topP || 0).toFixed(2)))),
        topK: Math.max(1, Math.round(originalConf.topK || 1)),
    };
    if (originalConf.thinkingConfig !== undefined) { // Preserve if it exists
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
    let config = { ...baseUserConfig }; // Start with user's slider preferences
    const rationales: string[] = [];
    let thinkingBudget: number | undefined = undefined;

    // Heuristic for initial model based on input complexity
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
            modelName = 'gemini-2.5-flash-preview-04-17'; // Could also be Pro if cost/speed not an issue
            thinkingBudget = 1;
            rationales.push("Heuristic: Initial Strategy - Using Gemini 2.5 Flash Preview (thinking enabled) for complex/large input, focusing on efficient processing. User preferences applied.");
            break;
        default: // Should not happen if inputComplexity is always set
            modelName = processState.selectedModelName || DEFAULT_MODEL_NAME;
            rationales.push("Heuristic: Initial Strategy - Defaulting to user-selected model or application default. User preferences applied.");
            if (modelName === 'gemini-2.5-flash-preview-04-17') thinkingBudget = 1; // Default thinking for Flash
            break;
    }
    
    // Apply thinking budget if applicable
    if (thinkingBudget !== undefined && modelName === 'gemini-2.5-flash-preview-04-17') {
        config.thinkingConfig = { thinkingBudget };
    } else {
        // Ensure no thinkingConfig if model doesn't support it or budget not set
        delete config.thinkingConfig;
    }

    // No LLM strategist call for initial strategy in this simplified version
    // If strategistInfluenceLevel logic were to apply here, it would be very limited.

    return { modelName, config: sanitizeConfig(config, rationales), rationale: rationales.join(' | '), activeMetaInstruction: undefined };
};

export const reevaluateStrategy = async (
    processState: Pick<ProcessState, 'currentIteration' | 'maxIterations' | 'inputComplexity' | 'stagnationInfo' | 'iterationHistory' | 'currentModelForIteration' | 'currentAppliedModelConfig' | 'isPlanActive' | 'planStages'| 'currentPlanStageIndex' | 'selectedModelName' | 'stagnationNudgeEnabled' | 'strategistInfluenceLevel' | 'stagnationNudgeAggressiveness'>,
    baseUserConfig: ModelConfig // User's current slider settings
): Promise<ModelStrategy> => {
    const { currentIteration, maxIterations, inputComplexity, stagnationInfo, iterationHistory, currentModelForIteration, currentAppliedModelConfig, isPlanActive, planStages, currentPlanStageIndex, selectedModelName, stagnationNudgeEnabled, strategistInfluenceLevel, stagnationNudgeAggressiveness } = processState;

    let nextModelName: SelectableModelName = currentModelForIteration || selectedModelName || DEFAULT_MODEL_NAME;
    let nextConfig: ModelConfig;
    const rationales: string[] = [];
    let activeMetaInstructionForThisIteration: string | undefined = undefined;

    // 1. Determine Base Parameters (Sweep for Global Mode or Fixed for Plan Mode)
    if (isPlanActive) {
        nextConfig = { ...baseUserConfig }; // Plan mode uses the user's current slider settings as fixed
        rationales.push("Plan Mode: Using fixed parameters set by user for all plan stages.");
    } else { // Global Mode - Parameter Sweep
        const startCreativeConfig = { ...baseUserConfig }; // User's current sliders are the starting point
        const focusedEndConfig = FOCUSED_END_DEFAULTS;
        const safeCurrentIteration = Math.max(1, currentIteration + 1); // For the upcoming iteration
        const sweepEffectiveDuration = Math.min(maxIterations, DETERMINISTIC_TARGET_ITERATION);
        const effectiveMaxSweepIter = Math.max(1, sweepEffectiveDuration);
        
        let interpolationFactor = 0;
        if (effectiveMaxSweepIter <= 1) interpolationFactor = 1.0; // If duration is 1 or less, jump to end
        else if (safeCurrentIteration >= effectiveMaxSweepIter) interpolationFactor = 1.0; // Past or at end of sweep
        else interpolationFactor = (safeCurrentIteration - 1) / (effectiveMaxSweepIter - 1);

        nextConfig = {
            temperature: startCreativeConfig.temperature - interpolationFactor * (startCreativeConfig.temperature - focusedEndConfig.temperature),
            topP: startCreativeConfig.topP - interpolationFactor * (startCreativeConfig.topP - focusedEndConfig.topP),
            topK: Math.max(1, Math.round(startCreativeConfig.topK - interpolationFactor * (startCreativeConfig.topK - focusedEndConfig.topK)))
        };
        rationales.push(`Heuristic Sweep: Iter ${safeCurrentIteration}/${maxIterations} (Target for Determinism: ${DETERMINISTIC_TARGET_ITERATION}). User Base: T:${baseUserConfig.temperature.toFixed(2)},P:${baseUserConfig.topP.toFixed(2)},K:${baseUserConfig.topK}. Swept to: T:${nextConfig.temperature.toFixed(2)},P:${nextConfig.topP.toFixed(2)},K:${nextConfig.topK}.`);

        // Apply code-based parameter nudges based on stagnation and aggressiveness
        if (stagnationNudgeEnabled && stagnationInfo.isStagnant && (stagnationInfo.nudgeStrategyApplied === 'params_light' || stagnationInfo.nudgeStrategyApplied === 'params_heavy')) {
            let tempNudgeMultiplier = 1.0, pNudgeMultiplier = 1.0, kFactorMultiplier = 1.0;
            if (stagnationNudgeAggressiveness === 'LOW') { tempNudgeMultiplier = 0.6; pNudgeMultiplier = 0.6; kFactorMultiplier = 0.6; }
            else if (stagnationNudgeAggressiveness === 'HIGH') { tempNudgeMultiplier = 1.4; pNudgeMultiplier = 1.4; kFactorMultiplier = 1.4; }

            const isLightNudge = stagnationInfo.nudgeStrategyApplied === 'params_light';
            const baseTempNudge = isLightNudge ? STAGNATION_TEMP_NUDGE_LIGHT : STAGNATION_TEMP_NUDGE_HEAVY;
            const basePNudge = isLightNudge ? STAGNATION_TOPP_NUDGE_LIGHT : STAGNATION_TOPP_NUDGE_HEAVY;
            const baseKFactorChange = (isLightNudge ? STAGNATION_TOPK_NUDGE_FACTOR_LIGHT : STAGNATION_TOPK_NUDGE_FACTOR_HEAVY) - 1.0; // e.g., 0.05 or 0.15

            const actualTempNudge = baseTempNudge * tempNudgeMultiplier;
            const actualPNudge = basePNudge * pNudgeMultiplier;
            const actualKFactor = 1.0 + (baseKFactorChange * kFactorMultiplier);

            nextConfig.temperature += actualTempNudge;
            nextConfig.topP += actualPNudge;
            nextConfig.topK = Math.max(1, Math.round(nextConfig.topK * actualKFactor));
            rationales.push(`Heuristic Nudge (Code): Stagnation (${stagnationInfo.consecutiveStagnantIterations}x) triggered '${stagnationInfo.nudgeStrategyApplied}' (Aggressiveness: ${stagnationNudgeAggressiveness}). Applied T+=${actualTempNudge.toFixed(3)}, P+=${actualPNudge.toFixed(3)}, K*=${actualKFactor.toFixed(3)} to swept params.`);
        }
    }

    // 2. Code-Based Model Switching Logic (Global Mode Only, if not using meta_instruct for stagnation)
    if (!isPlanActive && stagnationInfo.nudgeStrategyApplied !== 'meta_instruct') {
        const lastModelUsed = currentModelForIteration || nextModelName;
        const stagnationTriggerCount = stagnationNudgeAggressiveness === 'HIGH' ? 1 : (stagnationNudgeAggressiveness === 'MEDIUM' ? 2 : 3);

        if (stagnationNudgeEnabled && stagnationInfo.consecutiveStagnantIterations >= stagnationTriggerCount ) {
            if (lastModelUsed.includes('flash') || lastModelUsed.includes('lite') || lastModelUsed === 'gemini-pro' /* legacy general */) {
                nextModelName = 'gemini-2.5-pro'; // Upgrade from less capable or legacy
                rationales.push(`Heuristic Model Switch (Code): Stagnation (${stagnationInfo.consecutiveStagnantIterations}x with ${lastModelUsed}); switching to Gemini 2.5 Pro.`);
            } else if (lastModelUsed.includes('pro') && inputComplexity === 'COMPLEX') { // If already on Pro and complex input, try Flash Preview for different approach
                nextModelName = 'gemini-2.5-flash-preview-04-17';
                rationales.push(`Heuristic Model Switch (Code): Stagnation on ${lastModelUsed} with complex input; switching to Flash Preview for a different approach.`);
            }
        } else if (stagnationNudgeEnabled && stagnationInfo.consecutiveStagnantIterations === 0 && lastModelUsed.includes('pro') && inputComplexity === 'COMPLEX' && currentIteration > 3) {
            // If good progress with Pro on complex input, consider switching to Flash for efficiency later
             if (iterationHistory.length > 0) {
                const prevLog = iterationHistory[iterationHistory.length - 1];
                // Simple progress metric: significant lines added and low similarity
                if (prevLog && ((prevLog.linesAdded || 0) - (prevLog.linesRemoved || 0) > 20) && (prevLog.aiValidationInfo?.passed ?? true) && (stagnationInfo.similarityWithPrevious ?? 1.0) < 0.90) {
                    nextModelName = 'gemini-2.5-flash-preview-04-17';
                    rationales.push(`Heuristic Model Switch (Code): Good progress with ${lastModelUsed} on complex input; switching to Flash Preview for efficiency.`);
                }
            }
        }
    }
    
    // 3. LLM Strategist Consultation
    let strategistAdvice: StrategistAdvice | null = null;
    if (strategistInfluenceLevel !== 'OFF') {
        const lastLogEntry = iterationHistory.length > 0 ? iterationHistory[iterationHistory.length - 1] : undefined;
        let currentGoal = "Global Mode: General refinement towards user's implicit objective.";
        if (isPlanActive && currentPlanStageIndex !== null && planStages && planStages[currentPlanStageIndex]) {
            const stage = planStages[currentPlanStageIndex];
            currentGoal = `Plan Stage ${currentPlanStageIndex + 1}: Format=${stage.format}, Length=${stage.length}, Complexity=${stage.complexity}. Custom Instr: ${stage.customInstruction || 'None'}`;
        }
        const recentSummariesCount = Math.min(3, iterationHistory.length);
        const recentIterationSummaries: string[] = iterationHistory
            .slice(-recentSummariesCount)
            .map(entry => `Iter ${entry.iteration} (Status: ${entry.status}, Valid: ${entry.aiValidationInfo?.passed ?? 'N/A'} - Reason: ${entry.aiValidationInfo?.reason || 'OK'}, Changes: +${entry.linesAdded || 0}/-${entry.linesRemoved || 0}): ${entry.productSummary || 'N/A'}`)
            .filter(summary => summary.length > 0);

        strategistAdvice = await getStrategicAdviceFromLLM(currentIteration, maxIterations, inputComplexity, currentModelForIteration, currentAppliedModelConfig, stagnationInfo, lastLogEntry?.aiValidationInfo, currentGoal, recentIterationSummaries);
    } else {
        rationales.push("Strategist LLM consultation skipped: Influence level set to 'OFF'. Using code heuristics only.");
    }

    // 4. Integrate Strategist Advice
    if (strategistAdvice) {
        rationales.push(`Strategist LLM Advice Received: "${strategistAdvice.rationale}"`);

        const canStrategistInfluenceModel = strategistInfluenceLevel === 'ADVISE_PARAMS_ONLY' || strategistInfluenceLevel === 'OVERRIDE_FULL';
        const canStrategistInfluenceCoreParams = strategistInfluenceLevel === 'OVERRIDE_FULL';
        const canStrategistInfluenceMeta = (strategistInfluenceLevel === 'ADVISE_PARAMS_ONLY' || strategistInfluenceLevel === 'OVERRIDE_FULL') && stagnationInfo.nudgeStrategyApplied === 'meta_instruct';

        // Model Name
        if (strategistAdvice.suggestedModelName && SELECTABLE_MODELS.find(m => m.name === strategistAdvice.suggestedModelName)) {
            if (canStrategistInfluenceModel) {
                if (nextModelName !== strategistAdvice.suggestedModelName) {
                    rationales.push(`Strategist overrode heuristic model. New: '${strategistAdvice.suggestedModelName}' (was '${nextModelName}').`);
                    nextModelName = strategistAdvice.suggestedModelName;
                } else {
                    rationales.push(`Strategist concurred with heuristic model choice: '${nextModelName}'.`);
                }
            } else if (strategistInfluenceLevel === 'SUGGEST') {
                 rationales.push(`Strategist suggested model '${strategistAdvice.suggestedModelName}', but not applied due to influence level 'SUGGEST'. Using heuristic model '${nextModelName}'.`);
            }
        }
        // Thinking Budget (Only for Flash Preview & if Strategist can influence model choice)
        if (canStrategistInfluenceModel && nextModelName === 'gemini-2.5-flash-preview-04-17' && strategistAdvice.suggestedThinkingBudget !== undefined) {
            nextConfig.thinkingConfig = { thinkingBudget: strategistAdvice.suggestedThinkingBudget };
            rationales.push(`Strategist set Flash thinking budget to: ${strategistAdvice.suggestedThinkingBudget}.`);
        } else if (strategistInfluenceLevel === 'SUGGEST' && strategistAdvice.suggestedThinkingBudget !== undefined && nextModelName === 'gemini-2.5-flash-preview-04-17') {
             rationales.push(`Strategist suggested Flash thinking budget ${strategistAdvice.suggestedThinkingBudget}, but not applied due to influence 'SUGGEST'. Current budget: ${nextConfig.thinkingConfig?.thinkingBudget ?? 'N/A (or determined by heuristic)'}.`);
        }


        // Core Parameters (Temp, TopP, TopK)
        const strategistParamChangeDetails: string[] = [];
        if (strategistAdvice.suggestedTemperature !== undefined) {
            if (canStrategistInfluenceCoreParams) {
                const originalT = nextConfig.temperature; nextConfig.temperature = strategistAdvice.suggestedTemperature;
                strategistParamChangeDetails.push(`Temp to ${nextConfig.temperature.toFixed(2)} (heuristic was ${originalT.toFixed(2)})`);
            } else if (strategistInfluenceLevel === 'SUGGEST' || strategistInfluenceLevel === 'ADVISE_PARAMS_ONLY') {
                rationales.push(`Strategist parameter advice for Temperature (${strategistAdvice.suggestedTemperature.toFixed(2)}) logged but ignored due to influence level '${strategistInfluenceLevel}'.`);
            }
        }
        if (strategistAdvice.suggestedTopP !== undefined) {
            if (canStrategistInfluenceCoreParams) {
                const originalP = nextConfig.topP; nextConfig.topP = strategistAdvice.suggestedTopP;
                strategistParamChangeDetails.push(`TopP to ${nextConfig.topP.toFixed(2)} (heuristic was ${originalP.toFixed(2)})`);
            } else if (strategistInfluenceLevel === 'SUGGEST' || strategistInfluenceLevel === 'ADVISE_PARAMS_ONLY') {
                rationales.push(`Strategist parameter advice for TopP (${strategistAdvice.suggestedTopP.toFixed(2)}) logged but ignored due to influence level '${strategistInfluenceLevel}'.`);
            }
        }
        if (strategistAdvice.suggestedTopK !== undefined) {
            if (canStrategistInfluenceCoreParams) {
                const originalK = nextConfig.topK; nextConfig.topK = strategistAdvice.suggestedTopK;
                strategistParamChangeDetails.push(`TopK to ${nextConfig.topK} (heuristic was ${originalK})`);
            } else if (strategistInfluenceLevel === 'SUGGEST' || strategistInfluenceLevel === 'ADVISE_PARAMS_ONLY') {
                 rationales.push(`Strategist parameter advice for TopK (${strategistAdvice.suggestedTopK}) logged but ignored due to influence level '${strategistInfluenceLevel}'.`);
            }
        }
        if (canStrategistInfluenceCoreParams && strategistParamChangeDetails.length > 0) {
            rationales.push(`Strategist adjusted core parameters: ${strategistParamChangeDetails.join(', ')}.`);
        }

        // Meta-instruction
        if (canStrategistInfluenceMeta && strategistAdvice.suggestedMetaInstruction && strategistAdvice.suggestedMetaInstruction.trim() !== "") {
            activeMetaInstructionForThisIteration = strategistAdvice.suggestedMetaInstruction.trim();
            rationales.push(`Strategist provided dynamic meta-instruction: "${activeMetaInstructionForThisIteration}"`);
        } else if (stagnationInfo.nudgeStrategyApplied === 'meta_instruct' && canStrategistInfluenceMeta && (!strategistAdvice.suggestedMetaInstruction || strategistAdvice.suggestedMetaInstruction.trim() === "")) {
            rationales.push("System nudge is 'meta_instruct' (and strategist could influence), but strategist did not provide a dynamic instruction. Static fallback will be used by prompt builder if applicable.");
        } else if (strategistInfluenceLevel === 'SUGGEST' && strategistAdvice.suggestedMetaInstruction && strategistAdvice.suggestedMetaInstruction.trim() !== "") {
            rationales.push(`Strategist suggested meta-instruction "${strategistAdvice.suggestedMetaInstruction.trim()}", but not applied due to 'SUGGEST' influence level. Static fallback may apply if code heuristic chooses 'meta_instruct'.`);
        }


    } else if (strategistInfluenceLevel !== 'OFF') {
        rationales.push("Strategist LLM advice was invalid, empty, or consultation failed; relying solely on code heuristics.");
    }
    
    // 5. Final Thinking Config based on FINAL model choice (if not explicitly set by strategist and model supports it)
    if (nextModelName === 'gemini-2.5-flash-preview-04-17') {
        if (nextConfig.thinkingConfig === undefined) { // Only set if not already set (e.g. by strategist)
            let budget = 1; // Default to thinking enabled
            if (!isPlanActive) { // Global mode specific logic
                const progressPercent = maxIterations > 0 ? (currentIteration + 1) / maxIterations : 0;
                if (progressPercent > 0.75 && nextConfig.temperature < 0.3) { // Heuristic: late, focused iterations
                    budget = 0;
                    rationales.push("Heuristic Fallback (Post-Strategist): Disabling thinking for Flash model in late, focused global iterations.");
                } else {
                    rationales.push("Heuristic Fallback (Post-Strategist): Defaulting to thinking enabled for Flash model.");
                }
            } else { // Plan mode
                rationales.push("Heuristic Fallback (Post-Strategist): Defaulting to thinking enabled for Flash model in Plan mode.");
            }
            nextConfig.thinkingConfig = { thinkingBudget: budget };
        }
    } else { // If final model is NOT Flash Preview, ensure no thinkingConfig
        if (nextConfig.thinkingConfig) {
            delete nextConfig.thinkingConfig;
            rationales.push("Heuristic Correction: Removed thinking config as final model chosen does not support it or is not 'gemini-2.5-flash-preview-04-17'.");
        }
    }


    // 6. Final parameter clamping
    nextConfig = sanitizeConfig(nextConfig, rationales);

    return { modelName: nextModelName, config: nextConfig, rationale: rationales.join(' | '), activeMetaInstruction: activeMetaInstructionForThisIteration };
};
