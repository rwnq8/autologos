

import React, { createContext, useContext } from 'react';
import type { PlanStage, PlanTemplate, ProcessState } from '../types';

export interface PlanContextType {
  isPlanActive: boolean;
  planStages: PlanStage[];
  currentPlanStageIndex: number | null;
  currentStageIteration: number;
  savedPlanTemplates: PlanTemplate[];
  planTemplateStatus: string;
  updateProcessState: (updates: Partial<Pick<ProcessState, 'isPlanActive' | 'planStages' | 'currentPlanStageIndex' | 'currentStageIteration' | 'savedPlanTemplates'>>) => void;
  onIsPlanActiveChange: (isActive: boolean) => void;
  onPlanStagesChange: (stages: PlanStage[]) => void;
  handleSavePlanAsTemplate: (templateName: string, stages: PlanStage[]) => void;
  handleDeletePlanTemplate: (templateName: string) => void;
  clearPlanTemplateStatus: () => void;
  onLoadPlanTemplate: (template: PlanTemplate) => void;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const usePlanContext = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlanContext must be used within a PlanProvider');
  }
  return context;
};

export const PlanProvider = PlanContext.Provider;