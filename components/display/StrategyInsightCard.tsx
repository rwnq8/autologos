import React from 'react';
import type { ModelStrategy } from '../../types/index.ts';
import { SELECTABLE_MODELS } from '../../types/index.ts';

interface StrategyInsightCardProps {
  suggestion: ModelStrategy;
  onAccept: () => void;
  onIgnore: () => void;
}

const StrategyInsightCard: React.FC<StrategyInsightCardProps> = ({ suggestion, onAccept, onIgnore }) => {
  const commonButtonClasses = "inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors";
  const acceptButtonClasses = `${commonButtonClasses} border-transparent bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500`;
  const ignoreButtonClasses = `${commonButtonClasses} border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:ring-primary-500`;
  
  const modelDisplayName = SELECTABLE_MODELS.find(m => m.name === suggestion.modelName)?.displayName || suggestion.modelName;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/40 p-4 rounded-lg border-2 border-dashed border-blue-400 dark:border-blue-500/80 mb-6 animate-fadeIn">
      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
        Strategy Suggestion for Next Version
      </h3>
      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4 italic">
        <strong>Rationale:</strong> {suggestion.rationale}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
        <div className="bg-white/60 dark:bg-slate-800/50 p-3 rounded-md">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Proposed Changes:</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                <li><strong>Model:</strong> {modelDisplayName}</li>
                <li><strong>Temperature:</strong> {suggestion.config.temperature.toFixed(2)}</li>
                <li><strong>Top-P:</strong> {suggestion.config.topP.toFixed(2)}</li>
                <li><strong>Top-K:</strong> {suggestion.config.topK}</li>
                {suggestion.config.thinkingConfig && (
                    <li><strong>Thinking Budget:</strong> {suggestion.config.thinkingConfig.thinkingBudget}</li>
                )}
                {suggestion.activeMetaInstruction && (
                    <li><strong>Meta-Instruction:</strong> <span className="italic">"{suggestion.activeMetaInstruction}"</span></li>
                )}
            </ul>
        </div>
      </div>

      <div className="flex justify-end items-center gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">The process is paused. Please choose an option to continue.</p>
        <button onClick={onIgnore} className={ignoreButtonClasses}>
          Ignore & Continue
        </button>
        <button onClick={onAccept} className={acceptButtonClasses}>
          Accept & Continue
        </button>
      </div>
    </div>
  );
};

export default StrategyInsightCard;
