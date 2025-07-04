// types/ui.ts

export type SettingsSuggestionSource = 'mode' | 'input' | 'manual' | 'plan_stage' | 'strategy_service';
export type DiffViewType = 'words';

export interface CommonControlProps {
  commonInputClasses?: string;
  commonSelectClasses?: string;
  commonCheckboxLabelClasses?: string;
  commonCheckboxInputClasses?: string;
  commonButtonClasses?: string;
}
