import { useState, useEffect, useCallback } from 'react';
import type { ModelConfig, SettingsSuggestionSource, ParameterAdvice, ModelParameterGuidance, SuggestedParamsResponse, StagnationInfo } from '../types.ts';
import * as geminiService from '../services/geminiService';

// Stagnation Nudge constants
const STAGNATION_TEMP_NUDGE = 0.05;
const STAGNATION_TOPP_NUDGE = 0.02;
const STAGNATION_TOPK_NUDGE_FACTOR = 1.1; // Multiplicative, e.g., 1.1 for 10% wider
const STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT = 0.80; // Don't nudge if 80% or more iterations are done

const DETERMINISTIC_TARGET_ITERATION = 40; // Target iteration for parameters to become highly deterministic

export const useModelParameters = (
    initialPrompt: string,
    loadedFilesCount: number,
    isPlanActive: boolean,
    currentIterationFromState: number,
    maxIterationsFromState: number,
    stagnationInfo: StagnationInfo,
    promptChangedByFileLoad: boolean,
    onPromptChangedByFileLoadHandled: () => void,
    initialTemp: number = geminiService.CREATIVE_DEFAULTS.temperature,
    initialTopP: number = geminiService.CREATIVE_DEFAULTS.topP,
    initialTopK: number = geminiService.CREATIVE_DEFAULTS.topK,
    stagnationNudgeEnabled: boolean // Added for this phase
) => {
  const [temperature, setTemperature] = useState(initialTemp);
  const [topP, setTopP] = useState(initialTopP);
  const [topK, setTopK] = useState(initialTopK);
  const [settingsSuggestionSource, setSettingsSuggestionSource] = useState<SettingsSuggestionSource>('mode');
  const [userManuallyAdjustedSettings, setUserManuallyAdjustedSettings] = useState(false);
  const [modelConfigRationales, setModelConfigRationales] = useState<string[]>(isPlanActive ? ["Using general purpose defaults for plan stages."] : ["Using creative starting defaults for Global Mode's dynamic sweep."]);
  const [modelParameterAdvice, setModelParameterAdvice] = useState<ParameterAdvice>({});
  const [modelConfigWarnings, setModelConfigWarnings] = useState<string[]>([]);

  const handleTemperatureChange = (value: number) => { setTemperature(value); setUserManuallyAdjustedSettings(true); };
  const handleTopPChange = (value: number) => { setTopP(value); setUserManuallyAdjustedSettings(true); };
  const handleTopKChange = (value: number) => { setTopK(value); setUserManuallyAdjustedSettings(true); };

  const resetToDefaults = (baseConfig: ModelConfig, baseRationales: string[], baseAdvice: ParameterAdvice, baseWarnings: string[]) => {
    setTemperature(baseConfig.temperature);
    setTopP(baseConfig.topP);
    setTopK(baseConfig.topK);
    setUserManuallyAdjustedSettings(false);
    setSettingsSuggestionSource('mode');
    setModelConfigRationales(baseRationales);
    setModelParameterAdvice(baseAdvice);
    setModelConfigWarnings(baseWarnings);
  };

  useEffect(() => {
    if (userManuallyAdjustedSettings && !promptChangedByFileLoad) return;

    const basisForSuggestion = initialPrompt;
    let baseConfigToUse: ModelConfig = isPlanActive ? { ...geminiService.GENERAL_BALANCED_DEFAULTS } : { ...geminiService.CREATIVE_DEFAULTS };
    let defaultRationales = isPlanActive ? [`Using general purpose defaults for plan stages.`] : [`Using creative starting defaults for Global Mode.`];

    try {
      if (geminiService && typeof geminiService.suggestModelParameters === 'function' && basisForSuggestion.trim()) {
        const suggestion: SuggestedParamsResponse = geminiService.suggestModelParameters(basisForSuggestion);
        setTemperature(suggestion.config.temperature);
        setTopP(suggestion.config.topP);
        setTopK(suggestion.config.topK);
        setSettingsSuggestionSource(isPlanActive ? 'plan_stage' : (loadedFilesCount > 0 ? 'input' : 'mode'));
        setModelConfigRationales(suggestion.rationales);
        setUserManuallyAdjustedSettings(false);
      } else {
        setTemperature(baseConfigToUse.temperature);
        setTopP(baseConfigToUse.topP);
        setTopK(baseConfigToUse.topK);
        setSettingsSuggestionSource(isPlanActive ? 'plan_stage' : 'mode');
        setModelConfigRationales(defaultRationales);
        setUserManuallyAdjustedSettings(false);
      }
      if (promptChangedByFileLoad) {
        onPromptChangedByFileLoadHandled();
      }
    } catch (error) {
      console.error("Error fetching model parameter suggestions:", error);
      setTemperature(baseConfigToUse.temperature);
      setTopP(baseConfigToUse.topP);
      setTopK(baseConfigToUse.topK);
      setSettingsSuggestionSource(isPlanActive ? 'plan_stage' : 'mode');
      setModelConfigRationales(["Error getting suggestions; using mode defaults."]);
      setUserManuallyAdjustedSettings(false);
    }
  }, [initialPrompt, loadedFilesCount, isPlanActive, userManuallyAdjustedSettings, promptChangedByFileLoad, onPromptChangedByFileLoadHandled]);

  useEffect(() => {
    try {
      if (geminiService && typeof geminiService.getModelParameterGuidance === 'function') {
        const guidance: ModelParameterGuidance = geminiService.getModelParameterGuidance({ temperature, topP, topK }, !isPlanActive);
        setModelConfigWarnings(guidance.warnings);
        setModelParameterAdvice(guidance.advice);
      } else {
        setModelConfigWarnings(["Model parameter advice service not available."]);
        setModelParameterAdvice({});
      }
    } catch (error) {
      console.error("Error getting model parameter guidance:", error);
      setModelConfigWarnings(["Error loading model parameter advice."]);
      setModelParameterAdvice({});
    }
  }, [temperature, topP, topK, isPlanActive]);


  const getCalculatedModelConfigForIteration = useCallback((iterNum: number, maxIterScope: number): ModelConfig => {
    if (isPlanActive) {
      return { temperature, topP, topK };
    }

    const startCreativeConfig: ModelConfig = { temperature, topP, topK };
    const focusedEndConfig: ModelConfig = geminiService.FOCUSED_END_DEFAULTS;

    const safeCurrentIteration = Math.max(1, iterNum);
    const sweepEffectiveDuration = Math.min(maxIterScope, DETERMINISTIC_TARGET_ITERATION);
    const effectiveMaxSweepIter = Math.max(1, sweepEffectiveDuration);

    let interpolationFactor: number;
    if (safeCurrentIteration >= effectiveMaxSweepIter) {
        interpolationFactor = 1.0;
    } else if (effectiveMaxSweepIter === 1) {
        interpolationFactor = 1.0;
    } else {
        interpolationFactor = (safeCurrentIteration - 1) / (effectiveMaxSweepIter - 1);
    }

    let iterTemp = startCreativeConfig.temperature - interpolationFactor * (startCreativeConfig.temperature - focusedEndConfig.temperature);
    let iterTopP = startCreativeConfig.topP - interpolationFactor * (startCreativeConfig.topP - focusedEndConfig.topP);
    let iterTopK = Math.max(1, Math.round(startCreativeConfig.topK - interpolationFactor * (startCreativeConfig.topK - focusedEndConfig.topK)));

    const iterationProgressPercentInScope = maxIterScope > 0 ? safeCurrentIteration / maxIterScope : 0;

    if (stagnationInfo.isStagnant && stagnationNudgeEnabled && iterationProgressPercentInScope < STAGNATION_NUDGE_IGNORE_AFTER_ITERATION_PERCENT) {
        console.log(`Applying stagnation nudge for iteration ${safeCurrentIteration} in scope of ${maxIterScope}. Consecutive stagnant: ${stagnationInfo.consecutiveStagnantIterations}`);
        iterTemp = Math.min(startCreativeConfig.temperature, iterTemp + STAGNATION_TEMP_NUDGE);
        iterTopP = Math.min(startCreativeConfig.topP, iterTopP + STAGNATION_TOPP_NUDGE);
        iterTopK = Math.min(startCreativeConfig.topK, Math.max(1, Math.round(iterTopK * STAGNATION_TOPK_NUDGE_FACTOR)));
    }

    return {
      temperature: Math.max(0, Math.min(2.0, iterTemp)),
      topP: Math.max(0, Math.min(1.0, iterTopP)),
      topK: Math.max(1, iterTopK),
    };
  }, [isPlanActive, temperature, topP, topK, stagnationInfo, stagnationNudgeEnabled]);

  return {
    temperature,
    topP,
    topK,
    settingsSuggestionSource,
    userManuallyAdjustedSettings,
    modelConfigRationales,
    modelParameterAdvice,
    modelConfigWarnings,
    handleTemperatureChange,
    handleTopPChange,
    handleTopKChange,
    getCalculatedModelConfigForIteration,
    resetModelParametersToDefaults: (baseConfig?: ModelConfig) => {
        const configToUse = baseConfig || (isPlanActive ? geminiService.GENERAL_BALANCED_DEFAULTS : geminiService.CREATIVE_DEFAULTS);
        const rationales = isPlanActive ? [`Settings reset to general defaults for plan stages.`] : [`Settings reset to creative starting defaults for Global Mode.`];
        const guidance = geminiService.getModelParameterGuidance(configToUse, !isPlanActive);
        resetToDefaults(configToUse, rationales, guidance.advice, guidance.warnings);
    },
    setUserManuallyAdjustedSettings,
  };
};