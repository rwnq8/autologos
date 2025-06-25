
import React from 'react';

interface TargetedRefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  selectedText: string;
  instructions: string;
  onInstructionsChange: (value: string) => void;
}

const TargetedRefinementModal: React.FC<TargetedRefinementModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedText,
  instructions,
  onInstructionsChange,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="targeted-refinement-title"
    >
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-2xl border border-primary-500/50">
        <h2 
            id="targeted-refinement-title" 
            className="text-xl font-semibold text-primary-600 dark:text-primary-300 mb-4"
        >
          Refine Selected Text
        </h2>
        
        <div className="mb-4">
          <label htmlFor="selected-text-display" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Selected Text (for context):
          </label>
          <div 
            id="selected-text-display"
            className="max-h-32 overflow-y-auto p-3 bg-slate-100 dark:bg-slate-700/50 rounded-md border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300"
          >
            <pre className="whitespace-pre-wrap break-words">{selectedText}</pre>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="refinement-instructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Instructions for Refining this Selection:
          </label>
          <textarea
            id="refinement-instructions"
            rows={4}
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            className="w-full p-3 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 placeholder-slate-500 dark:placeholder-slate-400 text-slate-700 dark:text-slate-100 resize-y"
            placeholder="e.g., Make this section more concise, expand on the third point, or change the tone to be more formal."
            aria-label="Instructions for refining the selected text"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Cancel targeted refinement"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            disabled={!instructions.trim()}
            aria-label="Submit targeted refinement instructions"
          >
            Submit Refinement
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetedRefinementModal;
