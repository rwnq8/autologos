

import React, { useRef, useState, useCallback } from 'react';
import { toYamlStringLiteral, generateFileName } from './services/utils.ts';
import Controls from './components/Controls.tsx';
import TargetedRefinementModal from './components/modals/TargetedRefinementModal.tsx';
import DiffViewerModal from './components/modals/DiffViewerModal.tsx';
import AppHeader from './components/AppHeader.tsx';
import ErrorBoundary from './components/shared/ErrorBoundary.tsx';
import ProcessStatusDisplay from './components/display/ProcessStatusDisplay.tsx';
import ProductOutputDisplay from './components/display/ProductOutputDisplay.tsx';
import IterationLog from './components/display/IterationLog.tsx';
import DocumentMap from './components/display/DocumentMap.tsx';
import { EngineProvider, useEngine } from './contexts/ApplicationContext.tsx';
import { inferProjectNameFromInput } from './services/projectUtils.ts';
import { reconstructProduct } from './services/diffService.ts';
import { formatVersion } from './services/versionUtils.ts';
import ChevronDownIcon from './components/shared/ChevronDownIcon.tsx';


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
        const { isOutlineMode, outlineId, finalOutline, finalProduct, currentProduct, currentMajorVersion, currentMinorVersion, configAtFinalization, initialPrompt, projectName, projectCodename, loadedFiles, promptSourceName } = engine.process;

        if (isOutlineMode) {
            const outlineToSave = finalOutline || engine.process.currentOutline;
            if (!outlineToSave) return;
            const content = JSON.stringify({ outlineId, outline: outlineToSave }, null, 2);
            const versionString = formatVersion({ major: currentMajorVersion, minor: currentMinorVersion });
            const fileName = generateFileName("outline", "json", {
                projectCodename: projectCodename,
                outlineId: outlineId,
                projectName: projectName,
                versionString: versionString,
            });
            const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = fileName;
            document.body.appendChild(link); link.click();
            document.body.removeChild(link); URL.revokeObjectURL(url);
            return;
        }

        const productToSave = finalProduct || currentProduct;
        if (!productToSave) return;
        
        const finalVersionString = formatVersion({
            major: currentMajorVersion,
            minor: currentMinorVersion
        });

        if (!engine.app.staticAiModelDetails || !configAtFinalization) {
          const fileName = generateFileName("product", "md", {
            projectCodename: projectCodename,
            projectName: projectName, 
            contentForSlug: productToSave,
            versionString: finalVersionString,
          });
          const blob = new Blob([productToSave], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = fileName;
          document.body.appendChild(link); link.click();
          document.body.removeChild(link); URL.revokeObjectURL(url);
          return;
        }

        // Rich YAML save for completed processes
        const generationTimestamp = new Date().toISOString();
        const initialPromptSummary = toYamlStringLiteral((initialPrompt.length > 150 ? initialPrompt.substring(0, 147) + "..." : initialPrompt).replace(/\n+/g, ' ').trim());
        let contentWarning = (!productToSave.trim() || productToSave.trim().length < 10) ? `\nWARNING_NOTE: The main product content below appears to be empty or very short...\n` : "";
        
        
        let yamlFrontmatter = `---
export_type: FINAL_PRODUCT
generation_timestamp: ${generationTimestamp}
project_name: ${toYamlStringLiteral(projectName || "Untitled Project")}
project_codename: ${toYamlStringLiteral(projectCodename || "none")}
`;
        if (engine.process.isPlanActive && engine.process.planStages.length > 0) {
            yamlFrontmatter += `autologos_process_plan_active: true\n`;
            yamlFrontmatter += `autologos_process_plan_stages:\n`;
            engine.process.planStages.forEach((stage, index) => { 
                yamlFrontmatter += `  - stage: ${index + 1}\n`;
                yamlFrontmatter += `    format: ${stage.format}\n`;
                yamlFrontmatter += `    length: ${stage.length}\n`;
                yamlFrontmatter += `    complexity: ${stage.complexity}\n`;
                yamlFrontmatter += `    target_iterations: ${stage.stageIterations}\n`;
                if (stage.format === 'paragraph') {
                    yamlFrontmatter += `    paragraph_show_headings: ${stage.outputParagraphShowHeadings ?? engine.process.outputParagraphShowHeadings}\n`;
                    if (stage.outputParagraphShowHeadings ?? engine.process.outputParagraphShowHeadings) {
                        yamlFrontmatter += `    paragraph_max_heading_depth: ${stage.outputParagraphMaxHeadingDepth ?? engine.process.outputParagraphMaxHeadingDepth}\n`;
                        yamlFrontmatter += `    paragraph_numbered_headings: ${stage.outputParagraphNumberedHeadings ?? engine.process.outputParagraphNumberedHeadings}\n`;
                    }
                }
                if (stage.customInstruction) {
                     yamlFrontmatter += `    custom_instruction: ${toYamlStringLiteral(stage.customInstruction)}\n`;
                }
            });
        } else {
            yamlFrontmatter += `autologos_process_plan_active: false\n`;
            yamlFrontmatter += `autologos_process_settings:\n`;
            yamlFrontmatter += `  mode: global_autonomous\n`; 
            yamlFrontmatter += `  paragraph_show_headings_preference: ${engine.process.outputParagraphShowHeadings}\n`;
            if (engine.process.outputParagraphShowHeadings) {
                 yamlFrontmatter += `  paragraph_max_heading_depth: ${engine.process.outputParagraphMaxHeadingDepth}\n`;
                 yamlFrontmatter += `  paragraph_numbered_headings: ${engine.process.outputParagraphNumberedHeadings}\n`;
            }
        }

        yamlFrontmatter += `initial_prompt_summary: ${initialPromptSummary}\n`;
        yamlFrontmatter += `final_iteration_count: ${finalVersionString.replace('v','')}\n`;
        yamlFrontmatter += `max_iterations_setting: ${engine.process.maxMajorVersions}\n`;

        const promptInputType = loadedFiles.length > 0 ? "files" : "text";
        yamlFrontmatter += `prompt_input_type: ${promptInputType}\n`;

        if (loadedFiles.length > 0) {
            yamlFrontmatter += `prompt_source_files:\n`;
            loadedFiles.forEach(f => {
                yamlFrontmatter += `  - ${toYamlStringLiteral(f.name)}\n`;
            });
        }
        
        yamlFrontmatter += `model_configuration_at_finalization:\n`;
        yamlFrontmatter += `  model_name: '${engine.app.staticAiModelDetails.modelName}'\n`;
        yamlFrontmatter += `  temperature: ${configAtFinalization.temperature}\n`;
        yamlFrontmatter += `  top_p: ${configAtFinalization.topP}\n`;
        yamlFrontmatter += `  top_k: ${configAtFinalization.topK}\n`;
        
        const titleFromContent = inferProjectNameFromInput(productToSave, []);
        if (titleFromContent) {
            yamlFrontmatter += `title: ${toYamlStringLiteral(titleFromContent)}\n`;
            yamlFrontmatter += `aliases:\n  - ${toYamlStringLiteral(titleFromContent)}\n`;
        }
        yamlFrontmatter += `modified: ${generationTimestamp}\n`;
        
        yamlFrontmatter += `---\n\n`;

        const finalContent = yamlFrontmatter + contentWarning + productToSave;
        
        const fileName = generateFileName("product", "md", {
          projectCodename: projectCodename,
          projectName: projectName,
          contentForSlug: productToSave,
          versionString: finalVersionString,
        });

        const blob = new Blob([finalContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [engine.process, engine.app]);

    const { autoSave } = engine;
    
    // MAIN RENDER
    return (
        <div className="flex flex-col h-screen bg-slate-200 dark:bg-slate-900 overflow-hidden">
            <AppHeader
                fileInputRef={fileInputRef}
                onImportClick={handleImportClick}
                onFilesSelected={handleOnFilesSelected}
                onToggleControls={toggleControlsPanel}
            />

            {autoSave.showRestorePrompt && (
              <div className="p-3 bg-yellow-100 dark:bg-yellow-800/60 border-b border-yellow-300 dark:border-yellow-600 flex justify-between items-center text-sm">
                <p className="text-yellow-800 dark:text-yellow-100">
                  Found an auto-saved session for project "<strong>{autoSave.restorableStateInfo?.projectName || 'Untitled'}</strong>" from {autoSave.restorableStateInfo?.lastAutoSavedAt ? new Date(autoSave.restorableStateInfo.lastAutoSavedAt).toLocaleString() : 'a previous session'}.
                </p>
                <div>
                  <button onClick={autoSave.handleRestoreAutoSave} className="font-semibold text-green-700 dark:text-green-300 hover:underline px-3 py-1">Restore</button>
                  <button onClick={autoSave.handleClearAutoSaveAndDismiss} className="text-red-600 dark:text-red-400 hover:underline px-3 py-1">Dismiss</button>
                </div>
              </div>
            )}
            
            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
                    <ErrorBoundary>
                        <ProcessStatusDisplay />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <ProductOutputDisplay
                            onSaveFinalProduct={onSaveFinalProduct}
                        />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <IterationLog
                            onSaveLog={engine.projectIO.handleExportProject}
                        />
                    </ErrorBoundary>
                </div>
                
                <div 
                    className={`transition-all duration-300 ease-in-out ${engine.process.isDocumentMapOpen ? 'w-64' : 'w-0'} flex-shrink-0`}
                >
                    <div className={`w-64 h-full bg-slate-100 dark:bg-slate-800/50 p-4 border-l border-slate-300 dark:border-slate-700 overflow-y-auto ${engine.process.isDocumentMapOpen ? 'opacity-100' : 'opacity-0'}`}>
                        <ErrorBoundary>
                            <DocumentMap />
                        </ErrorBoundary>
                    </div>
                </div>

            </main>
            
            <ErrorBoundary>
                <Controls 
                    commonControlProps={commonControlProps} 
                    isOpen={isControlsOpen} 
                    onClose={closeControlsPanel}
                    initialTab={activeControlTab}
                    onImportClick={handleImportClick}
                />
            </ErrorBoundary>

            <ErrorBoundary>
                <TargetedRefinementModal
                    isOpen={engine.process.isTargetedRefinementModalOpen ?? false}
                    onClose={() => engine.process.updateProcessState({ isTargetedRefinementModalOpen: false, currentTextSelectionForRefinement: null, instructionsForSelectionRefinement: "" })}
                    onSubmit={() => {
                        engine.process.handleStartProcess({
                            isTargetedRefinement: true,
                            targetedSelection: engine.process.currentTextSelectionForRefinement || '',
                            targetedInstructions: engine.process.instructionsForSelectionRefinement || '',
                        });
                        engine.process.updateProcessState({ isTargetedRefinementModalOpen: false, currentTextSelectionForRefinement: null, instructionsForSelectionRefinement: "" });
                    }}
                    selectedText={engine.process.currentTextSelectionForRefinement || ''}
                    instructions={engine.process.instructionsForSelectionRefinement || ''}
                    onInstructionsChange={(value) => engine.process.updateProcessState({ instructionsForSelectionRefinement: value })}
                />
            </ErrorBoundary>

            <ErrorBoundary>
              <DiffViewerModal
                isOpen={engine.process.isDiffViewerOpen}
                onClose={engine.process.closeDiffViewer}
                diffContent={engine.process.diffViewerContent}
              />
            </ErrorBoundary>
        </div>
    );
};


// The main App component that wraps everything with the provider
const App: React.FC = () => {
  return (
    <EngineProvider>
      <AppLayout />
    </EngineProvider>
  );
};


export default App;