
import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AdvancedIterationState, IterationLogEntry, ModelConfig } from '../../types';
import { AdjustmentsHorizontalIcon, ChevronDownIcon, XCircleIcon, CheckCircleIcon, ArrowUturnLeftIcon } from '../icons';

interface AdvancedIterationModalProps {
  isOpen: boolean;
  onClose: () => void;
  iterationState: AdvancedIterationState | null;
  onInstructionChange: (instruction: string) => void;
  onModelConfigChange: (field: keyof ModelConfig, value: string | number) => void;
  onRunIteration: () => Promise<void>;
  onRevertToHistory: (logEntry: IterationLogEntry) => void;
  onSaveAsNewVersion: () => Promise<void>;
  isLoadingSave: boolean;
  selectedHistoryEntry: IterationLogEntry | null;
  onSelectHistoryEntry: (entry: IterationLogEntry | null) => void;
  showConfig: boolean;
  onToggleShowConfig: () => void;
}

export const AdvancedIterationModal: React.FC<AdvancedIterationModalProps> = ({
  isOpen,
  onClose,
  iterationState,
  onInstructionChange,
  onModelConfigChange,
  onRunIteration,
  onRevertToHistory,
  onSaveAsNewVersion,
  isLoadingSave,
  selectedHistoryEntry,
  onSelectHistoryEntry,
  showConfig,
  onToggleShowConfig,
}) => {
  if (!isOpen || !iterationState) return null;

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={`Advanced Output Iteration: ${iterationState.parentTaskName || 'Task'}`}
    >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Left Panel: Config & Instructions */}
            <div className="space-y-3">
                <div>
                    <h4 className="font-semibold text-sky-300 mb-1">Base Output (v: ...{iterationState.baseOutputVersion.versionId.slice(-6)})</h4>
                    <pre className="p-2 bg-gray-700 rounded whitespace-pre-wrap max-h-24 overflow-y-auto">{iterationState.baseOutputVersion.data}</pre>
                </div>
                <div>
                    <Button size="sm" variant="ghost" onClick={onToggleShowConfig} className="text-xs mb-1" leftIcon={<AdjustmentsHorizontalIcon className="w-3 h-3"/>}>
                        Model Configuration {showConfig ? <ChevronDownIcon className="w-3 h-3 inline-block transform rotate-180 ml-1"/> : <ChevronDownIcon className="w-3 h-3 inline-block ml-1"/>}
                    </Button>
                    {showConfig && (
                        <div className="p-2 bg-gray-700/50 rounded space-y-1">
                            <div>
                                <label>Temperature: {iterationState.currentModelConfig.temperature.toFixed(2)}</label>
                                <input type="range" min="0" max="1" step="0.01" value={iterationState.currentModelConfig.temperature} onChange={e => onModelConfigChange('temperature', e.target.value)} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"/>
                            </div>
                            <div>
                                <label>Top P: {iterationState.currentModelConfig.topP.toFixed(2)}</label>
                                <input type="range" min="0" max="1" step="0.01" value={iterationState.currentModelConfig.topP} onChange={e => onModelConfigChange('topP', e.target.value)} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"/>
                            </div>
                            <div>
                                <label>Top K: {iterationState.currentModelConfig.topK}</label>
                                <input type="range" min="1" max="128" step="1" value={iterationState.currentModelConfig.topK} onChange={e => onModelConfigChange('topK', e.target.value)} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"/>
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <label className="block font-medium text-gray-300 mb-0.5">Refinement Instruction (Iteration {iterationState.currentIterationNumber + 1} of {iterationState.maxIterationsInSession}):</label>
                    <textarea 
                        rows={3}
                        value={iterationState.currentRefinementInstruction}
                        onChange={(e) => onInstructionChange(e.target.value)}
                        className="w-full p-1.5 bg-gray-700 border-gray-600 rounded"
                        placeholder="e.g., Make it more concise, Explain concept X in simpler terms..."
                        disabled={iterationState.status === 'processing' || iterationState.status === 'max_iterations_reached'}
                    />
                </div>
                <Button 
                    onClick={onRunIteration} 
                    disabled={iterationState.status === 'processing' || iterationState.status === 'max_iterations_reached' || !iterationState.currentRefinementInstruction.trim()}
                    className="w-full"
                >
                    {iterationState.status === 'processing' ? <LoadingSpinner size="sm" text="Iterating..."/> : `Run Iteration ${iterationState.currentIterationNumber + 1}`}
                </Button>
                {iterationState.status === 'max_iterations_reached' && <p className="text-yellow-400 text-center">Max iterations reached for this session.</p>}
                {iterationState.status === 'error' && <p className="text-red-400">Error: {iterationState.errorMessage}</p>}
            </div>

            {/* Right Panel: History & Output */}
            <div className="space-y-3">
                <h4 className="font-semibold text-sky-300 mb-1">Iteration History ({iterationState.iterationHistory.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 bg-gray-800/50 p-1 rounded">
                    {iterationState.iterationHistory.slice().reverse().map(entry => (
                        <div 
                            key={entry.iterationNumber} 
                            className={`p-1.5 rounded cursor-pointer ${selectedHistoryEntry?.iterationNumber === entry.iterationNumber ? 'bg-sky-700/40' : 'bg-gray-700/60 hover:bg-gray-600/60'}`}
                            onClick={() => onSelectHistoryEntry(entry)}
                        >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Iter {entry.iterationNumber}: {entry.refinementInstruction.substring(0,30)}...</span>
                              {entry.status === 'error' ? <XCircleIcon className="w-3 h-3 text-red-400"/> : <CheckCircleIcon className="w-3 h-3 text-green-400"/> }
                            </div>
                        </div>
                    ))}
                </div>
                
                {selectedHistoryEntry && (
                    <div className="p-2 bg-gray-700 rounded">
                        <h5 className="font-semibold text-sky-200 mb-0.5">Selected History: Iteration {selectedHistoryEntry.iterationNumber}</h5>
                        <p className="text-gray-400 italic mb-0.5">Instruction: "{selectedHistoryEntry.refinementInstruction}"</p>
                        <pre className="p-1.5 bg-gray-900 rounded whitespace-pre-wrap max-h-24 overflow-y-auto">{selectedHistoryEntry.output}</pre>
                        {selectedHistoryEntry.status === 'error' && <p className="text-red-300 mt-0.5">Error: {selectedHistoryEntry.errorDetails}</p>}
                        <Button onClick={() => onRevertToHistory(selectedHistoryEntry)} size="sm" variant="ghost" className="mt-1 text-xs" leftIcon={<ArrowUturnLeftIcon className="w-3 h-3"/>}>Revert to & Continue from Here</Button>
                    </div>
                )}
                  {!selectedHistoryEntry && iterationState.iterationHistory.length > 0 && (
                    <p className="text-gray-400 text-center text-xs">Select an iteration from history to view its details or revert.</p>
                )}
            </div>
        </div>
          <div className="mt-4 flex justify-between items-center">
            <Button variant="secondary" onClick={onClose}>Cancel Session</Button>
            <Button 
                onClick={onSaveAsNewVersion} 
                disabled={iterationState.iterationHistory.length === 0 || iterationState.iterationHistory[iterationState.iterationHistory.length - 1].status === 'error' || isLoadingSave}
            >
                {isLoadingSave ? <LoadingSpinner size="sm"/> : "Save Final Output as New Version"}
            </Button>
        </div>
    </Modal>
  );
};
