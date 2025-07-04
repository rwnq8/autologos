
import React from 'react';
import { useEngine } from '../contexts/ApplicationContext.tsx';

interface AppHeaderProps {
    fileInputRef: React.RefObject<HTMLInputElement>;
    onImportClick: () => void;
    onFilesSelected: (files: FileList | null) => Promise<void>;
    onToggleControls: (tab: 'run' | 'plan' | 'devlog') => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    fileInputRef,
    onImportClick,
    onFilesSelected,
    onToggleControls
}) => {
    const { app, process, projectIO, autoSave } = useEngine();

    const getAutoSaveStatusDisplay = () => {
        const status = autoSave.autoSaveStatus;
        if (status === 'idle' || status === 'found_autosave' || status === 'cleared') return null;

        let text = '', colorClass = '';
        switch (status) {
            case 'saving': text = 'Saving...'; colorClass = 'bg-blue-500'; break;
            case 'saved': text = 'Saved'; colorClass = 'bg-green-500'; break;
            case 'error': text = 'Save Error'; colorClass = 'bg-red-500'; break;
            default: return null;
        }
        return <span className={`ml-3 px-2 py-1 text-xs rounded-full ${colorClass} text-white animate-pulse`}>{text}</span>;
    };
    
    const headerButtonClasses = "px-3 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50";
    const primaryActionButtonClasses = "px-4 py-2 text-sm font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 transition-colors";
    const startButtonClasses = `${primaryActionButtonClasses} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`;
    const stopButtonClasses = `${primaryActionButtonClasses} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`;
    const neutralButtonClasses = `${primaryActionButtonClasses} bg-slate-600 hover:bg-slate-700 text-slate-100 focus:ring-slate-500`;

    return (
        <header className="bg-slate-800 dark:bg-black/50 text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-20 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-primary-300 whitespace-nowrap">Autologos Engine</h1>
                <nav className="flex items-center gap-2 sm:gap-4 border-l border-slate-600 pl-4">
                    <button onClick={() => onToggleControls('run')} className={headerButtonClasses}>Configure</button>
                    <button onClick={() => onToggleControls('plan')} className={headerButtonClasses}>Plan</button>
                    <button onClick={() => onToggleControls('devlog')} className={headerButtonClasses}>Dev Log</button>
                </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-grow justify-center">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => onFilesSelected(e.target.files)}
                    className="hidden"
                    multiple
                    accept=".txt,.md,.json,.autologos.json"
                />
                <button onClick={onImportClick} disabled={process.isProcessing} className={neutralButtonClasses}>Import / Load Data</button>
                <button onClick={projectIO.handleExportProject} disabled={process.isProcessing} className={neutralButtonClasses}>Export Project</button>
                
                <div className="w-px h-6 bg-slate-600 mx-2"></div>

                {!process.isProcessing ? (
                    <button onClick={() => process.handleStartProcess()} disabled={!process.initialPrompt?.trim() || process.awaitingStrategyDecision} className={startButtonClasses}>
                        Start Process
                    </button>
                ) : (
                    <button onClick={process.handleHaltProcess} className={stopButtonClasses}>
                        Stop Process
                    </button>
                )}
                <button onClick={process.handleReset} disabled={process.isProcessing} className={neutralButtonClasses}>
                    Reset
                </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {getAutoSaveStatusDisplay()}
            </div>
        </header>
    );
};

export default AppHeader;