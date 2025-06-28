
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProjectTask, StepType, ProjectTaskStatus, OutputVersion } from '../../types';

interface TaskEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: ProjectTask, originalTaskIndex: number | null) => void;
  initialTaskData: Partial<ProjectTask> | null;
  originalTaskIndex: number | null;
  activeProjectId: string | null;
  generalErrorProp: string | null;
}

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTaskData,
  originalTaskIndex,
  // activeProjectId, // Not used in this minimal placeholder but available
  generalErrorProp,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<StepType>(StepType.INPUT_TEXT);
  const [taskObjective, setTaskObjective] = useState('');
  // Config fields
  const [configPrompt, setConfigPrompt] = useState('');
  const [configInitialText, setConfigInitialText] = useState('');
  const [configSimulationCode, setConfigSimulationCode] = useState('');
  const [configSimulationContext, setConfigSimulationContext] = useState('');
  const [configOutputFormat, setConfigOutputFormat] = useState<'text' | 'markdown'>('text');
  const [configAnalysisType, setConfigAnalysisType] = useState<'LOGICAL_CONSISTENCY' | 'ASSUMPTION_IDENTIFICATION'>('LOGICAL_CONSISTENCY');


  useEffect(() => {
    if (isOpen && initialTaskData) {
      setName(initialTaskData.name || '');
      setType(initialTaskData.type || StepType.INPUT_TEXT);
      setTaskObjective(initialTaskData.taskObjective || '');
      setConfigPrompt(initialTaskData.config?.prompt || '');
      setConfigInitialText(initialTaskData.config?.initialText || '');
      setConfigSimulationCode(initialTaskData.config?.simulationCode || '');
      setConfigSimulationContext(initialTaskData.config?.simulationContext || '');
      setConfigOutputFormat(initialTaskData.config?.outputFormat || 'text');
      setConfigAnalysisType(initialTaskData.config?.analysisType || 'LOGICAL_CONSISTENCY');
    } else if (isOpen && !initialTaskData) { // Reset for new task
      setName('');
      setType(StepType.INPUT_TEXT);
      setTaskObjective('');
      setConfigPrompt('');
      setConfigInitialText('');
      setConfigSimulationCode('');
      setConfigSimulationContext('');
      setConfigOutputFormat('text');
      setConfigAnalysisType('LOGICAL_CONSISTENCY');
    }
  }, [initialTaskData, isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      // More robust error handling can be added
      alert("Task name cannot be empty.");
      return;
    }

    const newConfig: ProjectTask['config'] = {
        prompt: configPrompt,
        initialText: configInitialText, // Used by INPUT_TEXT, AI_PROCESS (base), AI_CRITICAL_ANALYSIS (text to analyze)
        outputFormat: configOutputFormat,
    };

    if (type === StepType.AI_SIMULATION) {
        newConfig.simulationCode = configSimulationCode;
        newConfig.simulationContext = configSimulationContext;
        newConfig.outputFormat = 'markdown'; // Default AI_SIMULATION output to markdown
    }
    if (type === StepType.AI_PROCESS) {
        newConfig.inputSource = initialTaskData?.config?.inputSource || 'config'; // Preserve or default
    }
     if (type === StepType.FILE_UPLOAD) {
        newConfig.acceptedFileTypes = initialTaskData?.config?.acceptedFileTypes || ''; // Preserve or default
    }
    if (type === StepType.AI_CRITICAL_ANALYSIS) {
        newConfig.analysisType = configAnalysisType;
        // initialText is already set for text to analyze
        newConfig.outputFormat = 'markdown'; // Default AI_CRITICAL_ANALYSIS output to markdown
    }


    const taskToSave: ProjectTask = {
      id: initialTaskData?.id || crypto.randomUUID(),
      name: name.trim(),
      type: type,
      config: newConfig,
      taskObjective: taskObjective.trim(),
      status: initialTaskData?.status || ProjectTaskStatus.TODO, // Use enum member
      outputs: initialTaskData?.outputs || [],
      currentOutputVersionId: initialTaskData?.currentOutputVersionId,
      lastWorkedOn: initialTaskData?.lastWorkedOn, // Will be updated by App.tsx on save
    };
    onSubmit(taskToSave, originalTaskIndex);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialTaskData?.id ? "Edit Task" : "Create New Task"}>
      <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-2">
        <div>
          <label htmlFor="taskName" className="block font-medium text-gray-300">Task Name</label>
          <input
            type="text"
            id="taskName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            placeholder="Enter task name"
          />
        </div>
        <div>
          <label htmlFor="taskObjective" className="block font-medium text-gray-300">Task Objective (Optional)</label>
          <textarea
            id="taskObjective"
            rows={2}
            value={taskObjective}
            onChange={(e) => setTaskObjective(e.target.value)}
            className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            placeholder="Describe the specific goal of this task"
          />
        </div>
        <div>
          <label htmlFor="taskType" className="block font-medium text-gray-300">Task Type</label>
          <select
            id="taskType"
            value={type}
            onChange={(e) => {
                const newType = e.target.value as StepType;
                setType(newType);
                if (newType === StepType.AI_SIMULATION || newType === StepType.AI_CRITICAL_ANALYSIS) {
                    setConfigOutputFormat('markdown');
                } else if (newType === StepType.AI_PROCESS && !configOutputFormat) {
                    setConfigOutputFormat('text'); 
                }
            }}
            className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
          >
            {Object.values(StepType).map(stepType => (
              <option key={stepType} value={stepType}>{stepType.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* --- AI_PROCESS Specific Config --- */}
        {type === StepType.AI_PROCESS && (
          <>
            <div>
              <label htmlFor="configPrompt" className="block font-medium text-gray-300">AI Prompt Template</label>
              <textarea
                id="configPrompt"
                rows={3}
                value={configPrompt}
                onChange={(e) => setConfigPrompt(e.target.value)}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                placeholder="e.g., Summarize the following text: {{INPUT}}"
              />
            </div>
            <div>
              <label htmlFor="configInitialText" className="block font-medium text-gray-300">Base Text / Initial Content (Optional)</label>
              <textarea
                id="configInitialText"
                rows={3}
                value={configInitialText}
                onChange={(e) => setConfigInitialText(e.target.value)}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                placeholder="Text for AI to process if inputSource is 'config', or default for other inputs."
              />
            </div>
             <div>
              <label htmlFor="configOutputFormat" className="block font-medium text-gray-300">AI Output Format</label>
              <select
                id="configOutputFormat"
                value={configOutputFormat}
                onChange={(e) => setConfigOutputFormat(e.target.value as 'text' | 'markdown')}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              >
                <option value="text">Plain Text</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
          </>
        )}

        {/* --- INPUT_TEXT Specific Config --- */}
        {type === StepType.INPUT_TEXT && (
            <div>
              <label htmlFor="configInitialTextForInput" className="block font-medium text-gray-300">Initial Content / Placeholder (Optional)</label>
              <textarea
                id="configInitialTextForInput"
                rows={3}
                value={configInitialText} // Re-using state, but specific to INPUT_TEXT here
                onChange={(e) => setConfigInitialText(e.target.value)}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                placeholder="Default text or prompt for the user when this task is selected."
              />
            </div>
        )}
        
        {/* --- AI_SIMULATION Specific Config --- */}
        {type === StepType.AI_SIMULATION && (
          <>
            <div>
              <label htmlFor="configSimulationCode" className="block font-medium text-gray-300">Simulation Code</label>
              <textarea
                id="configSimulationCode"
                rows={6}
                value={configSimulationCode}
                onChange={(e) => setConfigSimulationCode(e.target.value)}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md font-mono text-xs"
                placeholder="Enter the code to be conceptually simulated by the AI."
              />
            </div>
            <div>
              <label htmlFor="configSimulationContext" className="block font-medium text-gray-300">Simulation Context (Optional)</label>
              <textarea
                id="configSimulationContext"
                rows={3}
                value={configSimulationContext}
                onChange={(e) => setConfigSimulationContext(e.target.value)}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                placeholder="Provide any context, parameters, or specific focus for the AI simulation (e.g., 'Assume input X is 10 and Y is 'abc'. Focus on the loop in function Z.')"
              />
               <p className="text-xs text-gray-400 mt-1">The AI simulation report will be in Markdown format.</p>
            </div>
          </>
        )}

        {/* --- AI_CRITICAL_ANALYSIS Specific Config --- */}
        {type === StepType.AI_CRITICAL_ANALYSIS && (
          <>
            <div>
              <label htmlFor="configAnalysisType" className="block font-medium text-gray-300">Analysis Type</label>
              <select
                id="configAnalysisType"
                value={configAnalysisType}
                onChange={(e) => setConfigAnalysisType(e.target.value as 'LOGICAL_CONSISTENCY' | 'ASSUMPTION_IDENTIFICATION')}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              >
                <option value="LOGICAL_CONSISTENCY">Logical Consistency Check</option>
                <option value="ASSUMPTION_IDENTIFICATION" disabled>Assumption Identification (Coming Soon)</option> 
                {/* Add more types as they are implemented */}
              </select>
            </div>
            <div>
              <label htmlFor="configInitialTextForAnalysis" className="block font-medium text-gray-300">Text to Analyze</label>
              <textarea
                id="configInitialTextForAnalysis"
                rows={6}
                value={configInitialText} // Re-using state, specific to AI_CRITICAL_ANALYSIS here
                onChange={(e) => setConfigInitialText(e.target.value)}
                className="mt-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                placeholder="Enter the text you want the AI to analyze for logical consistency."
              />
              <p className="text-xs text-gray-400 mt-1">The AI analysis report will be in Markdown format.</p>
            </div>
          </>
        )}

        {generalErrorProp && <p className="text-sm text-red-400 mt-2">{generalErrorProp}</p>}
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Save Task</Button>
      </div>
    </Modal>
  );
};