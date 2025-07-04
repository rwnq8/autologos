import React, { useState, useEffect } from 'react';
import type { CommonControlProps } from '../types.ts'; 

import InputDataControls from './controls/InputDataControls.tsx';
import IterativePlanEditor from './controls/IterativePlanEditor.tsx';
import ModelParameterControls from './controls/ModelParameterControls.tsx';
import OutputStructureDefaults from './controls/OutputStructureDefaults.tsx';
import DevLogControls from './controls/DevLogControls.tsx';

interface ControlsProps {
  commonControlProps: CommonControlProps;
  isOpen: boolean;
  onClose: () => void;
  initialTab: 'run' | 'plan' | 'devlog';
}

const Controls: React.FC<ControlsProps> = ({ commonControlProps, isOpen, onClose, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
        setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const getTabButtonClasses = (tabName: 'run' | 'plan' | 'devlog') => {
    const baseClasses = "flex-1 py-2 px-4 text-center text-sm font-medium focus:outline-none focus:z-10 focus:ring-2 focus:ring-primary-500";
    if (activeTab === tabName) {
      return `${baseClasses} bg-slate-100 dark:bg-slate-800/60 text-primary-600 dark:text-primary-300 border-b-2 border-primary-500`;
    }
    return `${baseClasses} text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border-b border-slate-300 dark:border-slate-600`;
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`fixed inset-y-0 left-0 w-full max-w-lg bg-slate-100 dark:bg-slate-800 shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="flex justify-between items-center p-4 border-b border-slate-300 dark:border-slate-600 flex-shrink-0">
          <h2 className="text-lg font-semibold text-primary-600 dark:text-primary-300">Controls</h2>
          <button onClick={onClose} className="px-3 py-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Close controls panel">
            Close
          </button>
        </div>
        
        <div className="flex border-b border-slate-300 dark:border-slate-600 flex-shrink-0">
          <button className={getTabButtonClasses('run')} onClick={() => setActiveTab('run')} role="tab" aria-selected={activeTab === 'run'} aria-controls="run-panel">Run</button>
          <button className={getTabButtonClasses('plan')} onClick={() => setActiveTab('plan')} role="tab" aria-selected={activeTab === 'plan'} aria-controls="plan-panel">Plan</button>
          <button className={getTabButtonClasses('devlog')} onClick={() => setActiveTab('devlog')} role="tab" aria-selected={activeTab === 'devlog'} aria-controls="devlog-panel">Dev Log</button>
        </div>

        <div className="overflow-y-auto flex-1">
            {activeTab === 'run' && (
              <div id="run-panel" role="tabpanel" className="p-6 space-y-6 animate-fadeIn">
                <InputDataControls {...commonControlProps} />
                <hr className="border-slate-300 dark:border-slate-600"/>
                <ModelParameterControls {...commonControlProps}>
                  <OutputStructureDefaults {...commonControlProps} />
                </ModelParameterControls>
              </div>
            )}
            {activeTab === 'plan' && (
               <div id="plan-panel" role="tabpanel" className="p-6 space-y-6 animate-fadeIn">
                 <IterativePlanEditor {...commonControlProps} />
               </div>
            )}
            {activeTab === 'devlog' && (
              <div id="devlog-panel" role="tabpanel" className="p-6 space-y-6 animate-fadeIn">
                <DevLogControls {...commonControlProps} />
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default Controls;
