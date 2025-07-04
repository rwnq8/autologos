import React from 'react';
import { useApplicationContext } from '../contexts/ApplicationContext.tsx';
import { useProcessContext } from '../contexts/ProcessContext.tsx';

interface AppHeaderProps {
    fileInputRef: React.RefObject<HTMLInputElement>;
    onImportClick: () => void;
    onFilesSelectedForImport: (files: FileList | null) => Promise<void>;
    onToggleControls: (tab: 'run' | 'plan' | 'devlog') => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    fileInputRef,
    onImportClick,
    onFilesSelectedForImport,
    onToggleControls
}) => {
    const appCtx = useApplicationContext();
    const processCtx = useProcessContext();
    const autoSaveHook = appCtx.autoSaveHook;

    const getAutoSaveStatusDisplay = () => {
        if (!autoSaveHook) return null;
        const status = autoSaveHook.autoSaveStatus;

        if (status === 'idle' || status === 'found_autosave' || status === 'cleared') {
            return null;
        }

        let text = '';
        let colorClass = '';

        switch (status) {
            case 'saving': text = 'Saving...'; colorClass = 'bg-blue-500/80'; break;
            case 'saved': text = 'Saved'; colorClass = 'bg-green-500/80'; break;
            case 'error': text = 'Save Error'; colorClass = 'bg-red-500/80'; break;
            case 'loading': text = 'Loading...'; colorClass = 'bg-blue-500/80'; break;
            case 'loaded': text = 'Loaded'; colorClass = 'bg-green-500/80'; break;
            case 'clearing': text = 'Clearing...'; colorClass = 'bg-yellow-500/80'; break;
            case 'not_found': text = 'No Save'; colorClass = 'bg-slate-500/80'; break;
            default: return null;
        }

        return (
            <span className={`ml-3 px-2 py-1 text-xs rounded-full ${colorClass} text-white animate-pulse`}>
                {text}
            </span>
        );
    };
    
    const headerButtonClasses = "px-3 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed";
    const primaryActionButtonClasses = "px-4 py-2 text-sm font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
    const startButtonClasses = `${primaryActionButtonClasses} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`;
    const stopButtonClasses = `${primaryActionButtonClasses} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`;
    const neutralButtonClasses = `${primaryActionButtonClasses} bg-slate-600 hover:bg-slate-700 text-slate-100 focus:ring-slate-500`;


    return (
        <header className="bg-slate-800 dark:bg-black/50 text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-20 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-primary-300 whitespace-nowrap">Autologos Engine</h1>
                <div className="flex items-center gap-2 sm:gap-4 border-l border-slate-600 pl-4">
                    <button onClick={() => onToggleControls('run')} className={headerButtonClasses} title="Configure Run & Model">Configure</button>
                    <button onClick={() => onToggleControls('plan')} className={headerButtonClasses} title="Open Iterative Plan Editor">Plan</button>
                    <button onClick={() => onToggleControls('devlog')} className={headerButtonClasses} title="Open Development Log & Roadmap">Dev Log</button>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-grow justify-center">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => onFilesSelectedForImport(e.target.files)}
                    className="hidden"
                    multiple
                />
                <button onClick={onImportClick} disabled={processCtx.isProcessing} className={neutralButtonClasses}>Import / Load Data</button>
                <button onClick={appCtx.handleExportProject} disabled={processCtx.isProcessing} className={neutralButtonClasses}>Export Project</button>
                
                <div className="w-px h-6 bg-slate-600 mx-2"></div>
                
                {processCtx.loadedFiles.length > 1 && !processCtx.isProcessing && (
                     <button onClick={processCtx.handleBootstrapSynthesis} className={`${primaryActionButtonClasses} bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500`} title="Generate a robust starting document from a random sample of loaded files">
                       Generate Ensemble Base
                     </button>
                )}

                {!processCtx.isProcessing && (
                    <button onClick={() => processCtx.handleStartProcess()} disabled={!processCtx.initialPrompt?.trim() || processCtx.awaitingStrategyDecision} className={startButtonClasses}>
                        Start Process
                    </button>
                )}
                {processCtx.isProcessing && (
                    <button onClick={processCtx.handleHaltProcess} className={stopButtonClasses}>
                        Stop Process
                    </button>
                )}
                <button onClick={processCtx.handleReset} disabled={processCtx.isProcessing} className={neutralButtonClasses}>
                    Reset
                </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="flex items-center text-xs text-slate-400">
                    {getAutoSaveStatusDisplay()}
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
