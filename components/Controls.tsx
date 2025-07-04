
import React, { useState, useEffect } from 'react';
import type { CommonControlProps } from '../types/index.ts';

// Import sub-components
import InputDataControls from './controls/InputDataControls.tsx';
import ModelParameterControls from './controls/ModelParameterControls.tsx';
import IterativePlanEditor from './controls/IterativePlanEditor.tsx';
import DevLogControls from './controls/DevLogControls.tsx';
import OutputStructureDefaults from './controls/OutputStructureDefaults.tsx';

interface ControlsProps {
    commonControlProps: CommonControlProps;
    isOpen: boolean;
    onClose: () => void;
    initialTab: 'run' | 'plan' | 'devlog';
    onImportClick: () => void;
}

const Controls: React.FC<ControlsProps> = ({
    commonControlProps,
    isOpen,
    onClose,
    initialTab,
    onImportClick,
}) => {
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [initialTab, isOpen]);

    if (!isOpen) {
        return null;
    }

    const getTabClass = (tabName: 'run' | 'plan' | 'devlog') => {
        return `px-4 py-2 text-sm font-medium rounded-t-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors -mb-px border-b-0 ${
            activeTab === tabName
                ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-300 border-t border-x border-slate-300 dark:border-white/20'
                : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border-transparent'
        }`;
    };

    return (
        <div 
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 shadow-[0_-4px_30px_rgba(0,0,0,0.2)] border-t border-slate-300 dark:border-white/20 animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-labelledby="controls-panel-title"
        >
            <div className="container mx-auto max-w-7xl px-4">
                <div className="flex justify-between items-center pt-2">
                    <div id="controls-panel-title" className="flex border-b border-slate-300 dark:border-white/20">
                        <button onClick={() => setActiveTab('run')} className={getTabClass('run')}>Configure & Run</button>
                        <button onClick={() => setActiveTab('plan')} className={getTabClass('plan')}>Iterative Plan</button>
                        <button onClick={() => setActiveTab('devlog')} className={getTabClass('devlog')}>Dev Log</button>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Close controls panel">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="py-4 px-2 max-h-[75vh] overflow-y-auto">
                    {activeTab === 'run' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <InputDataControls {...commonControlProps} onImportClick={onImportClick} />
                            </div>
                            <div className="space-y-4">
                                <ModelParameterControls {...commonControlProps}>
                                  <OutputStructureDefaults {...commonControlProps} />
                                </ModelParameterControls>
                            </div>
                        </div>
                    )}
                    {activeTab === 'plan' && <IterativePlanEditor {...commonControlProps} />}
                    {activeTab === 'devlog' && <DevLogControls {...commonControlProps} />}
                </div>
            </div>
        </div>
    );
};

export default Controls;
