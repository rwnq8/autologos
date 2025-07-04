
import React, { useRef, useState, useCallback } from 'react';
import { generateFileName } from './services/utils.ts';
import Controls from './components/Controls.tsx';
import TargetedRefinementModal from './components/modals/TargetedRefinementModal.tsx';
import AppHeader from './components/AppHeader.tsx';
import ErrorBoundary from './components/shared/ErrorBoundary.tsx';
import ProcessStatusDisplay from './components/display/ProcessStatusDisplay.tsx';
import ProductOutputDisplay from './components/display/ProductOutputDisplay.tsx';
import IterationLog from './components/display/IterationLog.tsx';
import StrategyInsightCard from './components/display/StrategyInsightCard.tsx';
import { EngineProvider, useEngine } from './contexts/ApplicationContext.tsx';
import { inferProjectNameFromInput } from './services/projectUtils.ts';
import { reconstructProduct } from './services/diffService.ts';
import { formatVersion } from './services/versionUtils.ts';


const commonControlProps = {
    commonInputClasses: "w-full p-3 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 placeholder-slate-500 dark:placeholder-slate-400 text-slate-700 dark:text-slate-100",
    commonSelectClasses: "w-full p-2.5 bg-slate-50/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-slate-700 dark:text-slate-100 text-sm",
    commonCheckboxLabelClasses: "flex items-center text-sm text-primary-600 dark:text-primary-400",
    commonCheckboxInputClasses: "h-4 w-4 text-primary-600 border-slate-300 dark:border-white/20 rounded focus:ring-primary-500 dark:bg-white/10 dark:checked:bg-primary-500 dark:focus:ring-offset-black/50",
    commonButtonClasses: "flex-1 inline-flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-white/20 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
};

// Component for the UI Layout
const AppLayout: React.FC = () => {
    const engine = useEngine();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const [activeControlTab, setActiveControlTab] = useState<'run' | 'plan' | 'devlog'>('run');

    const toggleControlsPanel = (tab: 'run' | 'plan' | 'devlog') => {
        setActiveControlTab(tab);
        setIsControlsOpen(true);
    };
    
    const closeControlsPanel = () => {
        setIsControlsOpen(false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleOnFilesSelected = async (files: FileList | null) => {
        await engine.app.onFilesSelectedForImport(files);
    };

    const onSaveFinalProduct = useCallback(() => {
        const productToSave = engine.process.finalProduct || (engine.process.currentMajorVersion === 0 && engine.process.currentProduct ? engine.process.currentProduct : null);
        if (!productToSave) return;
        
        const fileName = generateFileName(engine.process.projectName, "product", "md");
        const blob = new Blob([productToSave], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    }, [engine.process.finalProduct, engine.process.currentMajorVersion, engine.process.currentProduct, engine.process.projectName]);

    return (
        <div className="min-h-screen bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col">
            <AppHeader 
                fileInputRef={fileInputRef}
                onImportClick={handleImportClick}
                onFilesSelected={handleOnFilesSelected}
                onToggleControls={toggleControlsPanel}
            />
            
            <Controls 
                commonControlProps={commonControlProps} 
                isOpen={isControlsOpen} 
                onClose={closeControlsPanel}
                initialTab={activeControlTab}
                onImportClick={handleImportClick}
            />

            <main className="flex-1 overflow-y-auto">
                 <div className="space-y-8 p-6">
                    {engine.process.awaitingStrategyDecision && engine.process.pendingStrategySuggestion && (
                        <StrategyInsightCard 
                            suggestion={engine.process.pendingStrategySuggestion}
                            onAccept={engine.process.handleAcceptStrategy}
                            onIgnore={engine.process.handleIgnoreStrategy}
                        />
                    )}
                    <ProcessStatusDisplay />
                    <ProductOutputDisplay onSaveFinalProduct={onSaveFinalProduct} />
                    <IterationLog
                        onSaveLog={engine.projectIO.handleExportProject} // Reusing export project as it saves everything
                    />
                </div>
            </main>

            <TargetedRefinementModal
                isOpen={engine.process.isTargetedRefinementModalOpen || false}
                onClose={() => engine.process.updateProcessState({ isTargetedRefinementModalOpen: false })}
                onSubmit={() => {
                     engine.process.handleStartProcess({
                        isTargetedRefinement: true,
                        targetedSelection: engine.process.currentTextSelectionForRefinement || undefined,
                        targetedInstructions: engine.process.instructionsForSelectionRefinement || undefined,
                        userRawPromptForContextualizer: engine.process.instructionsForSelectionRefinement
                    });
                    engine.process.updateProcessState({ isTargetedRefinementModalOpen: false });
                }}
                selectedText={engine.process.currentTextSelectionForRefinement || ""}
                instructions={engine.process.instructionsForSelectionRefinement || ""}
                onInstructionsChange={(value) => engine.process.updateProcessState({ instructionsForSelectionRefinement: value })}
            />
            
            {engine.autoSave.showRestorePrompt && (
                <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-700 shadow-lg rounded-lg p-4 border border-primary-500/50 max-w-sm z-50">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Found Auto-Saved Session</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Project: "{engine.autoSave.restorableStateInfo?.projectName || 'Untitled'}" saved at {engine.autoSave.restorableStateInfo?.lastAutoSavedAt ? new Date(engine.autoSave.restorableStateInfo.lastAutoSavedAt).toLocaleTimeString() : 'an unknown time'}.
                    </p>
                    <div className="flex justify-end gap-2 mt-3">
                        <button onClick={engine.autoSave.handleClearAutoSaveAndDismiss} className="px-3 py-1 text-xs rounded-md border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10">Dismiss</button>
                        <button onClick={engine.autoSave.handleRestoreAutoSave} className="px-3 py-1 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700">Restore</button>
                    </div>
                </div>
            )}
        </div>
    );
};


const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <EngineProvider>
        <AppLayout />
      </EngineProvider>
    </ErrorBoundary>
  );
};

export default App;
