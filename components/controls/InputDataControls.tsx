

import React, { useState, useContext } from 'react'; // Removed useRef
import type { LoadedFile, CommonControlProps } from '../../types.ts';
import { useProcessContext } from '../../contexts/ProcessContext';

// InputDataControlsProps removed

const InputDataControls: React.FC<CommonControlProps> = ({
  // commonButtonClasses is no longer needed here
}) => {
  const processCtx = useProcessContext();
  // fileInputRef and related handlers are removed

  const getLoadedFileNamesDisplay = () => {
    // isReadingFiles state is removed as file reading is handled by the unified import
    if (processCtx.loadedFiles.length === 0) return "No files loaded. Use 'Import / Load Data' to add input.";
    const MAX_DISPLAY_FILENAMES = 2;
    const namesAndTypes = processCtx.loadedFiles.map(f => `${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB)`);
    if (namesAndTypes.length > MAX_DISPLAY_FILENAMES) {
      return `Input from: ${namesAndTypes.slice(0, MAX_DISPLAY_FILENAMES).join('; ')}, +${namesAndTypes.length - MAX_DISPLAY_FILENAMES} more`;
    }
    return `Input from: ${namesAndTypes.join('; ')}`;
  };

  return (
    <div>
      <label className="block text-sm font-medium text-primary-600 dark:text-primary-300 mb-1">
        Currently Loaded Input Data
      </label>
      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 min-h-[2.5rem] break-all bg-slate-50 dark:bg-black/10 p-2 rounded-md border border-slate-200 dark:border-white/5">
        {getLoadedFileNamesDisplay()}
      </p>
      {/* File input and "Load File(s)" button removed */}
      {processCtx.loadedFiles.length > 0 && (
         <button
            onClick={() => processCtx.handleLoadedFilesChange([])} // Clear files
            disabled={processCtx.isProcessing}
            className="w-full mt-2 text-xs px-3 py-1.5 border border-slate-300 dark:border-white/20 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
            aria-label="Clear all loaded input files"
          >
            Clear Loaded Files
        </button>
      )}
    </div>
  );
};

export default InputDataControls;
