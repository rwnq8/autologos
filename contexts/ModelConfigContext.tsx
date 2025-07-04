// contexts/ModelConfigContext.tsx

import React, { createContext, useContext } from 'react';
import type { SettingsSuggestionSource, ParameterAdvice, ProcessState, ModelConfig } from '../types';

export interface ModelConfigContextType {
  temperature: number;
  topP: number;
  topK: number;
  maxIterations: number;
  settingsSuggestionSource: SettingsSuggestionSource;
  userManuallyAdjustedSettings: boolean;
  modelConfigRationales: string[];
  modelParameterAdvice: ParameterAdvice;
  modelConfigWarnings: string[];
  handleTemperatureChange: (value: number) => void;
  handleTopPChange: (value: number) => void;
  handleTopKChange: (value: number) => void;
  onMaxIterationsChange: (value: number) => void;
  setUserManuallyAdjustedSettings: (value: boolean) => void;
  getUserSetBaseConfig: () => ModelConfig;
}

const ModelConfigContext = createContext<ModelConfigContextType | undefined>(undefined);

export const useModelConfigContext = () => {
  const context = useContext(ModelConfigContext);
  if (!context) {
    throw new Error('useModelConfigContext must be used within a ModelConfigProvider');
  }
  return context;
};

export const ModelConfigProvider = ModelConfigContext.Provider;