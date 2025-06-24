

import React, { useRef, useContext, useState } from 'react';
import type { CommonControlProps } from '../../types';
import { useApplicationContext } from '../../contexts/ApplicationContext';
import { useProcessContext } from '../../contexts/ProcessContext';
import LoadingSpinner from '../shared/LoadingSpinner'; // Assuming LoadingSpinner exists

const ProjectActions: React.FC<CommonControlProps> = ({
  commonInputClasses,
  commonButtonClasses,
}) => {
  const appCtx = useApplicationContext();
  const processCtx = useProcessContext();
  const unifiedFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const handleUnifiedFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoadingFile(true);
      try {
        await appCtx.onFileSelectedForImport(file);
      } catch (e) {
        // Error already handled by onFileSelectedForImport or its delegates
        console.error("Error during file processing:", e)
      } finally {
        setIsLoadingFile(false);
      }
    }
    if (event.target) event.target.value = ''; // Reset file input
  };

  return (
    <>
      <div>
        <label htmlFor="projectName" className="block text-sm font-medium text-primary-600 dark:text-primary-300 mb-1">
          Project Name
        </label>
        <input
          type="text"
          id="projectName"
          value={appCtx.projectName || ''}
          onChange={(e) => appCtx.updateProcessState({ projectName: e.target.value })}
          className={commonInputClasses}
          placeholder="Enter project name..."
          disabled={processCtx.isProcessing || isLoadingFile}
          aria-label="Project Name"
        />
      </div>

       <div className="grid grid-cols-2 gap-3">
        <input
          type="file"
          ref={unifiedFileInputRef}
          onChange={handleUnifiedFileSelected}
          className="hidden"
          accept=".autologos.json,.json,.txt,.md,.csv,.xml,.html,.js,.py,.pdf,image/png,image/jpeg,image/gif,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={processCtx.isProcessing || isLoadingFile}
          aria-hidden="true"
        />
        <button
          onClick={() => unifiedFileInputRef.current?.click()}
          disabled={processCtx.isProcessing || isLoadingFile}
          className={`${commonButtonClasses} w-full flex items-center justify-center`}
          aria-label="Import project, portable diffs, or load input data file(s)"
        >
          {isLoadingFile && <LoadingSpinner size="sm" color="text-slate-700 dark:text-slate-200 mr-2" />}
          {isLoadingFile ? "Processing..." : "Import / Load Data"}
        </button>
         <button
            onClick={appCtx.handleExportProject}
            disabled={processCtx.isProcessing || isLoadingFile}
            className={`${commonButtonClasses} w-full`}
            aria-label="Export Autologos Project File"
            title="Save the complete project state for full restoration or sharing."
          >
            Export Project
          </button>
      </div>
      <button
        onClick={appCtx.handleExportPortableDiffs}
        disabled={processCtx.isProcessing || isLoadingFile}
        className={`${commonButtonClasses} w-full`}
        aria-label="Export Portable Diffs"
        title="Export a minimal archive of line-based changes for product reconstruction, suitable for auditing or lightweight sharing."
      >
        Export Diffs
      </button>
    </>
  );
};

export default ProjectActions;
