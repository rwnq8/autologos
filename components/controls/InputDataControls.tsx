import React from 'react'; 
import type { LoadedFile, CommonControlProps } from '../../types/index.ts';
import { useEngine } from '../../contexts/ApplicationContext.tsx';

interface InputDataControlsProps extends CommonControlProps {
  onImportClick: () => void;
}

const InputDataControls: React.FC<InputDataControlsProps> = ({
  commonInputClasses, 
  commonButtonClasses,
  onImportClick,
}) => {
  const { process: processCtx } = useEngine();

  const handleRemoveFile = (fileToRemove: LoadedFile) => {
    if (processCtx.isProcessing) return;
    processCtx.handleLoadedFilesChange([fileToRemove], 'remove');
  };

  const handleClearAllFiles = () => {
    if (processCtx.isProcessing) return;
    processCtx.handleLoadedFilesChange([], 'clear');
  };

  const onInitialPromptTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (processCtx.isProcessing) return;
    if (processCtx.loadedFiles.length === 0) {
      processCtx.handleInitialPromptChange(e.target.value);
    }
  };

  return (
    <div>
      <label htmlFor="initialPromptText" className="block text-sm font-medium text-primary-600 dark:text-primary-300 mb-1">
        Initial Prompt / Starting Text (if no files loaded)
      </label>
      <textarea
        id="initialPromptText"
        rows={processCtx.loadedFiles.length > 0 ? 2 : 4}
        className={commonInputClasses + " resize-y"}
        placeholder={
          processCtx.loadedFiles.length > 0
            ? "File manifest will appear here when files are loaded..."
            : "Enter your initial prompt or starting text here..."
        }
        value={processCtx.initialPrompt}
        onChange={onInitialPromptTextAreaChange}
        disabled={processCtx.isProcessing || processCtx.loadedFiles.length > 0}
        aria-label="Initial prompt or starting text"
      />
      {processCtx.loadedFiles.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Initial prompt is auto-generated from loaded files. You can add more files from other directories by clicking 'Import' again. Clear all files to edit the prompt directly.
          </p>
      )}


      <label className="block text-sm font-medium text-primary-600 dark:text-primary-300 mb-1 mt-4">
        Currently Loaded Input Data ({processCtx.loadedFiles.length})
      </label>
      {processCtx.loadedFiles.length === 0 ? (
        <div className="text-center p-4 bg-slate-50 dark:bg-black/10 rounded-md border-2 border-dashed border-slate-300 dark:border-slate-600">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                No files loaded.
            </p>
            <button 
                onClick={onImportClick} 
                className={`${commonButtonClasses} bg-primary-500 hover:bg-primary-600 text-white font-semibold`}
            >
                Import / Load Data to Add Input
            </button>
        </div>
      ) : (
        <div className="mt-1 space-y-1.5 max-h-48 overflow-y-auto bg-slate-50 dark:bg-black/10 p-2 rounded-md border border-slate-200 dark:border-white/5">
          {processCtx.loadedFiles.map((file) => (
            <div
              key={file.name} 
              className="flex justify-between items-center p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-600/50"
            >
              <div className="truncate flex-grow">
                <span className="font-medium text-slate-700 dark:text-slate-200">{file.name}</span>
                <span className="ml-2 text-slate-500 dark:text-slate-400">
                  ({file.mimeType}, {(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={() => handleRemoveFile(file)}
                disabled={processCtx.isProcessing}
                className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 font-mono text-xs"
                aria-label={`Remove file ${file.name}`}
              >
                [remove]
              </button>
            </div>
          ))}
        </div>
      )}

      {processCtx.loadedFiles.length > 0 && (
         <button
            onClick={handleClearAllFiles}
            disabled={processCtx.isProcessing}
            className="w-full mt-2 text-xs px-3 py-1.5 border border-slate-300 dark:border-white/20 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
            aria-label="Clear all loaded input files"
          >
            Clear All Loaded Files
        </button>
      )}

      {processCtx.loadedFiles.length > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-300/70 dark:border-white/10">
            <h4 className="text-md font-medium text-primary-600 dark:text-primary-300 mb-1">
                Ensemble Synthesis
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
               This optional step creates a more stable starting document from multiple files. It runs AI sub-processes on random samples of your files, then integrates the results.
               The 'Generate Ensemble Base' button is now located in the main header for easier access.
            </p>
        </div>
      )}
    </div>
  );
};

export default InputDataControls;