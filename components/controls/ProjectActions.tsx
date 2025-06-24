
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
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsLoadingFile(true);
      try {
        await appCtx.onFilesSelectedForImport(files); // Pass FileList
      } catch (e) {
        console.error("Error during file processing:", e);
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
          multiple // Allow multiple file selection
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
          aria-label="Import project or load input data file(s)"
          title="Import an .autologos.json project file or load data files (text, images, etc.). Supports multiple file selection."
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
    </>
  );
};

export default ProjectActions;