


import { useState, useEffect, useCallback } from 'react';
import type { ModelConfig, SettingsSuggestionSource, ParameterAdvice, ModelParameterGuidance, SuggestedParamsResponse, StagnationInfo, NudgeStrategy, SelectableModelName } from '../types.ts';
import * as geminiService from '../services/geminiService.ts';
import { FOCUSED_END_DEFAULTS } from '../services/strategyConstants.ts';


export const useModelParameters = (
    initialPromptText: string,
    loadedFilesCount: number,
    isPlanActive: boolean,
    promptChangedByFileLoad: boolean,
    onPromptChangedByFileLoadHandled: () => void,
    initialTemp: number = geminiService.CREATIVE_DEFAULTS.temperature,
    initialTopP: number = geminiService.CREATIVE_DEFAULTS.topP,
    initialTopK: number = geminiService.CREATIVE_DEFAULTS.topK
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

    const basisForSuggestion = initialPromptText;
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
        setUserManuallyAdjustedSettings(false); // This is a suggestion, not manual override yet
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPromptText, loadedFilesCount, isPlanActive, promptChangedByFileLoad, onPromptChangedByFileLoadHandled]); // userManuallyAdjustedSettings intentionally omitted to allow suggestions after manual change IF prompt/files change

  useEffect(() => {
    try {
      if (geminiService && typeof geminiService.getModelParameterGuidance === 'function') {
        const guidance: ModelParameterGuidance = geminiService.getModelParameterGuidance({ temperature, topP, topK, modelName: geminiService.DEFAULT_MODEL_NAME }, !isPlanActive);
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


  const getUserSetBaseConfig = useCallback((): ModelConfig => {
    return { temperature, topP, topK };
  }, [temperature, topP, topK]);

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
    getUserSetBaseConfig,
    resetModelParametersToDefaults: (baseConfig?: ModelConfig) => {
        const configToUse = baseConfig || (isPlanActive ? geminiService.GENERAL_BALANCED_DEFAULTS : geminiService.CREATIVE_DEFAULTS);
        const rationales = isPlanActive ? [`Settings reset to general defaults for plan stages.`] : [`Settings reset to creative starting defaults for Global Mode.`];
        const guidance = geminiService.getModelParameterGuidance(configToUse, !isPlanActive);
        resetToDefaults(configToUse, rationales, guidance.advice, guidance.warnings);
    },
    setUserManuallyAdjustedSettings,
  };
};