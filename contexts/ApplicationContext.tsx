




import React, { createContext, useContext } from 'react';
import type { SelectableModelName, StaticAiModelDetails, ProcessState, AutologosProjectFile, IterationLogEntry } from '../types';

export interface ApplicationContextType {
  apiKeyStatus: 'loaded' | 'missing';
  selectedModelName: SelectableModelName;
  projectName: string | null;
  projectId: string | null;
  isApiRateLimited: boolean;
  rateLimitCooldownActiveSeconds: number;
  updateProcessState: (updates: Partial<Pick<ProcessState, 'apiKeyStatus' | 'selectedModelName' | 'projectName' | 'projectId' | 'isApiRateLimited' | 'rateLimitCooldownActiveSeconds' | 'inputComplexity' >>) => void;
  handleImportProjectData: (projectFile: AutologosProjectFile) => void;
  handleImportIterationLogData: (logData: IterationLogEntry[], originalFilename: string) => void;
  handleExportProject: () => void;
  handleExportIterationDiffs: () => void; 
  handleRateLimitErrorEncountered: () => void;
  staticAiModelDetails: StaticAiModelDetails | null;
  onSelectedModelChange: (modelName: SelectableModelName) => void;
  onFilesSelectedForImport: (files: FileList | null) => Promise<void>;
  autoSaveHook?: any;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

export const useApplicationContext = () => {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useApplicationContext must be used within an ApplicationProvider');
  }
  return context;
};

export const ApplicationProvider = ApplicationContext.Provider;