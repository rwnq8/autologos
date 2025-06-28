
import React from 'react';
import { 
    Project, ProjectTask, StepType, OutputVersion, ViewMode, ProjectTaskStatus, Program
} from '../types';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { 
  ArrowUturnLeftIcon, CogIcon, ListBulletIcon, ClipboardCopyIcon, 
  SparklesIcon, PlusIcon, ChevronDownIcon, PlayIcon, AcademicCapIcon
} from '../components/icons';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ProjectWorkspaceViewProps {
  activeProject: Project | null;
  selectedTaskId: string | null;
  isLoading: boolean;
  programs: Program[]; // Added to display program name context

  onSetCurrentView: (viewMode: ViewMode) => void;
  onSetActiveProject: React.Dispatch<React.SetStateAction<Project | null>>;
  onSetSelectedTaskId: (taskId: string | null) => void;
  onSaveActiveProject: () => void;
  onOpenTaskModal: (task: Partial<ProjectTask> | null, index?: number | null) => void;
  onDeleteTask: (taskIndex: number) => void;
  onMakeTaskOutputVersionCurrent: (projectId: string, taskId: string, versionId: string) => void;
  onOpenAdvancedIterationModal: (projectId: string, taskId: string, baseVersionId: string) => void;
  onShowSuccessMessage: (message: string) => void;
  onViewOutputVersion: (projectId: string, taskId: string, version: OutputVersion) => void;
  onGenerateAIOutput: (projectId: string, taskId: string, taskType: StepType, config: ProjectTask['config'], currentOutput?: OutputVersion) => Promise<void>;
  onRunAISimulation: (projectId: string, taskId: string) => Promise<void>;
  onRunCriticalAnalysis: (projectId: string, taskId: string) => Promise<void>;
  onSaveTextAsOutput: (projectId: string, taskId: string, textData: string, currentOutput?: OutputVersion) => void;
  
  isProjectDetailsPanelExpanded: boolean;
  onSetIsProjectDetailsPanelExpanded: (isExpanded: boolean) => void;
  allTaskStatuses: ProjectTaskStatus[];
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  activeProject,
  selectedTaskId,
  isLoading,
  programs,
  onSetCurrentView,
  onSetActiveProject,
  onSetSelectedTaskId,
  onSaveActiveProject,
  onOpenTaskModal,
  onDeleteTask,
  onMakeTaskOutputVersionCurrent,
  onOpenAdvancedIterationModal,
  onShowSuccessMessage,
  onViewOutputVersion,
  onGenerateAIOutput,
  onRunAISimulation,
  onRunCriticalAnalysis,
  onSaveTextAsOutput,
  isProjectDetailsPanelExpanded,
  onSetIsProjectDetailsPanelExpanded,
  allTaskStatuses,
}) => {
  if (!activeProject) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <ListBulletIcon className="w-16 h-16 mb-4"/>
            <p>No project selected.</p>
            <Button onClick={() => onSetCurrentView(ViewMode.DASHBOARD)} variant="secondary" className="mt-4">
                Go to Dashboard
            </Button>
        </div>
    );
  }

  const currentSelectedTask = activeProject.tasks.find(t => t.id === selectedTaskId);
  const currentTaskOutput = currentSelectedTask?.outputs.find(ov => ov.versionId === currentSelectedTask.currentOutputVersionId);
  const textInputRef = React.useRef<HTMLTextAreaElement>(null);


  const handleSaveInputText = () => {
    if (currentSelectedTask && textInputRef.current) {
        onSaveTextAsOutput(activeProject.id, currentSelectedTask.id, textInputRef.current.value, currentTaskOutput);
    }
  };

  const handleGenerateAI = () => {
    if (currentSelectedTask) {
        onGenerateAIOutput(activeProject.id, currentSelectedTask.id, currentSelectedTask.type, currentSelectedTask.config, currentTaskOutput);
    }
  };
  
  const handleRunSimulation = () => {
    if (currentSelectedTask && currentSelectedTask.type === StepType.AI_SIMULATION) {
      onRunAISimulation(activeProject.id, currentSelectedTask.id);
    }
  };

  const handleRunAnalysis = () => {
    if (currentSelectedTask && currentSelectedTask.type === StepType.AI_CRITICAL_ANALYSIS) {
      onRunCriticalAnalysis(activeProject.id, currentSelectedTask.id);
    }
  };

  const renderOutputData = (task: ProjectTask, output: OutputVersion) => {
    if ((task.config?.outputFormat === 'markdown' || output.source === 'llm_simulation_report' || output.source === 'llm_critical_analysis_report') && output.data) {
      const cleanHtml = DOMPurify.sanitize(marked.parse(output.data || '') as string, {
        USE_PROFILES: { html: true },
         ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img'],
         ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class'] 
      });
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: cleanHtml }} 
          className="text-sm bg-gray-900 p-3 rounded whitespace-normal max-h-96 overflow-y-auto prose prose-sm prose-invert max-w-none" 
        />
      );
    }
    return (
      <pre className="text-sm bg-gray-900 p-2 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">{output.data || ""}</pre>
    );
  };


  return (
    <div className="flex h-[calc(100vh-4rem)]"> {/* Adjust height as needed */}
      <div className="w-1/4 min-w-[300px] bg-gray-800 p-4 space-y-4 overflow-y-auto border-r border-gray-700">
        <div>
          <Button onClick={() => { onSetCurrentView(ViewMode.DASHBOARD); onSetActiveProject(null); onSetSelectedTaskId(null); }} variant="ghost" size="sm" leftIcon={<ArrowUturnLeftIcon className="w-4 h-4"/>} className="mb-2">Back to Dashboard</Button>
          <h2 className="text-xl font-semibold text-sky-400 truncate" title={activeProject.name}>{activeProject.name}</h2>
          <p className="text-xs text-gray-400">Program: {programs.find(p => p.id === activeProject.programId)?.name || 'N/A'}</p>
        </div>
        
        <div className="border-t border-b border-gray-700 py-3">
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-300">Project Definition</h3>
              <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-1"
                  onClick={() => onSetIsProjectDetailsPanelExpanded(!isProjectDetailsPanelExpanded)}
                  leftIcon={isProjectDetailsPanelExpanded ? <ChevronDownIcon className="w-4 h-4 transform rotate-180"/> : <ChevronDownIcon className="w-4 h-4"/>}
                  aria-label={isProjectDetailsPanelExpanded ? "Hide project details" : "Show project details"}
              />
          </div>
          {isProjectDetailsPanelExpanded && (
              <div className="space-y-2 text-xs">
                  <div>
                      <label className="block font-medium text-gray-400">Name</label>
                      <input type="text" value={activeProject.name} onChange={e => onSetActiveProject({...activeProject, name: e.target.value})} className="mt-0.5 w-full p-1.5 bg-gray-700 border-gray-600 rounded-md text-sm"/>
                  </div>
                  <div>
                      <label className="block font-medium text-gray-400">Description</label>
                      <textarea rows={2} className="mt-0.5 w-full p-1.5 bg-gray-700 border-gray-600 rounded-md text-sm" value={activeProject.description || ''} onChange={e => onSetActiveProject({...activeProject, description: e.target.value})}/>
                  </div>
                   <div>
                      <label className="block font-medium text-gray-400">Objective</label>
                      <textarea rows={3} className="mt-0.5 w-full p-1.5 bg-gray-700 border-gray-600 rounded-md text-sm" value={activeProject.projectObjective || ''} onChange={e => onSetActiveProject({...activeProject, projectObjective: e.target.value})}/>
                  </div>
                  <Button onClick={onSaveActiveProject} size="sm" variant="secondary" className="mt-2 w-full">Save Project Details</Button>
              </div>
          )}
        </div>

        <div>
          <h3 className="text-md font-semibold text-sky-300 mb-2">Tasks (WBS L2/L3) ({activeProject.tasks.length})</h3>
          <Button onClick={() => onOpenTaskModal(null)} leftIcon={<PlusIcon className="w-4 h-4"/>} size="sm" variant="ghost" className="w-full text-left justify-start mb-2">Add New Task</Button>
          <div className="space-y-2">
            {activeProject.tasks.map((task, index) => (
              <div 
                key={task.id} 
                className={`p-2 rounded-md cursor-pointer border hover:border-sky-500
                            ${selectedTaskId === task.id ? 'bg-sky-700/30 border-sky-600' : 'bg-gray-700/40 border-gray-600'}`}
                onClick={() => onSetSelectedTaskId(task.id)}
              >
                <p className="font-medium text-sm text-gray-100 truncate" title={task.name}>{task.name}</p>
                <p className="text-xs text-gray-400">Status: {task.status} | Outputs: {task.outputs.length}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow p-6 overflow-y-auto">
        {currentSelectedTask ? (
          <div className="space-y-4">
            <div className="pb-3 border-b border-gray-700">
              <h1 className="text-2xl font-bold text-sky-300">{currentSelectedTask.name}</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span>Status:</span>
                  <select value={currentSelectedTask.status} 
                          onChange={(e) => {
                              const newStatus = e.target.value as ProjectTaskStatus;
                              onSetActiveProject(prev => prev ? ({
                                  ...prev,
                                  tasks: prev.tasks.map(t => t.id === selectedTaskId ? {...t, status: newStatus, lastWorkedOn: new Date().toISOString()} : t)
                              }) : null);
                              // Consider auto-saving here or call onSaveActiveProject() after a short delay
                          }}
                          className="bg-gray-700 border border-gray-600 rounded p-0.5 text-xs"
                          aria-label="Task status"
                  >
                      {allTaskStatuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>)}
                  </select>
                  <span>| Type: {currentSelectedTask.type.replace(/_/g, ' ')}</span>
                  <Button onClick={() => onOpenTaskModal(currentSelectedTask, activeProject.tasks.findIndex(t=>t.id === selectedTaskId))} variant="ghost" size="sm" className="p-1 text-xs" leftIcon={<CogIcon className="w-3 h-3"/>}>Edit Config</Button>
              </div>
              {currentSelectedTask.taskObjective && <p className="text-sm text-gray-300 mt-1 italic">Objective: {currentSelectedTask.taskObjective}</p>}
            </div>

            <div className="bg-gray-800 p-4 rounded-md shadow">
              <h3 className="text-lg font-semibold text-sky-400 mb-2">Task Action / Input</h3>
              {currentSelectedTask.type === StepType.INPUT_TEXT && (
                  <div>
                      <label htmlFor={`taskInputText-${currentSelectedTask.id}`} className="block text-sm text-gray-300 mb-1">Enter/Edit Text Output:</label>
                      <textarea 
                                id={`taskInputText-${currentSelectedTask.id}`}
                                key={currentTaskOutput?.versionId || 'initial'} // Re-render if output changes
                                ref={textInputRef}
                                rows={5} 
                                defaultValue={currentTaskOutput?.data || currentSelectedTask.config.initialText || ""} 
                                className="w-full p-2 bg-gray-700 border-gray-600 rounded"
                                placeholder="Type your content here..."
                                aria-label="Text input for task output"
                      />
                      <Button className="mt-2" onClick={handleSaveInputText} disabled={isLoading}>
                          {isLoading ? <LoadingSpinner size="sm"/> : "Save as Output Version"}
                      </Button>
                  </div>
              )}
               {currentSelectedTask.type === StepType.AI_PROCESS && (
                  <div className="space-y-2">
                      {currentSelectedTask.config.prompt && <p className="text-xs text-gray-400">Prompt: <span className="italic line-clamp-1" title={currentSelectedTask.config.prompt}>{currentSelectedTask.config.prompt}</span></p>}
                      {currentSelectedTask.config.initialText && currentSelectedTask.config.inputSource === 'config' && (
                         <div>
                           <p className="text-xs text-gray-400">Base Text (from config):</p>
                           <pre className="text-xs bg-gray-700 p-1.5 rounded max-h-20 overflow-y-auto">{currentSelectedTask.config.initialText}</pre>
                         </div>
                      )}
                       {currentTaskOutput && currentSelectedTask.config.inputSource !== 'config' && ( // Only show current output as base if not using config's initialText
                         <div>
                           <p className="text-xs text-gray-400">Base Text (from current output version ...{currentTaskOutput.versionId.slice(-6)}):</p>
                           <pre className="text-xs bg-gray-700 p-1.5 rounded max-h-20 overflow-y-auto">{currentTaskOutput.data}</pre>
                         </div>
                      )}
                      <Button 
                          onClick={handleGenerateAI}
                          disabled={isLoading}
                          leftIcon={isLoading ? undefined : <SparklesIcon className="w-4 h-4"/>}
                      >
                          {isLoading ? <LoadingSpinner size="sm"/> : (currentTaskOutput ? "Iterate with AI" : "Generate with AI")}
                      </Button>
                  </div>
              )}
              {currentSelectedTask.type === StepType.AI_SIMULATION && (
                <div className="space-y-3">
                    {currentSelectedTask.config.simulationCode && (
                        <div className="p-2 border border-gray-700 rounded-md bg-gray-800/50">
                            <p className="text-xs font-semibold text-sky-200 mb-1">Simulation Code:</p>
                            <pre className="text-xs bg-gray-900 p-2 rounded max-h-48 overflow-y-auto font-mono">{currentSelectedTask.config.simulationCode}</pre>
                        </div>
                    )}
                    {currentSelectedTask.config.simulationContext && (
                        <div className="p-2 border border-gray-700 rounded-md bg-gray-800/50">
                            <p className="text-xs font-semibold text-sky-200 mb-1">Simulation Context:</p>
                            <pre className="text-xs bg-gray-900 p-2 rounded max-h-24 overflow-y-auto">{currentSelectedTask.config.simulationContext}</pre>
                        </div>
                    )}
                     <Button 
                        onClick={handleRunSimulation}
                        disabled={isLoading || !currentSelectedTask.config.simulationCode}
                        leftIcon={isLoading ? undefined : <PlayIcon className="w-4 h-4"/>}
                    >
                        {isLoading ? <LoadingSpinner size="sm" text="Simulating..." /> : "Run AI Simulation"}
                    </Button>
                </div>
              )}
              {currentSelectedTask.type === StepType.AI_CRITICAL_ANALYSIS && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-400">Analysis Type: {currentSelectedTask.config.analysisType?.replace(/_/g, ' ') || 'N/A'}</p>
                    {currentSelectedTask.config.initialText && (
                        <div className="p-2 border border-gray-700 rounded-md bg-gray-800/50">
                            <p className="text-xs font-semibold text-sky-200 mb-1">Text to Analyze (from config):</p>
                            <pre className="text-xs bg-gray-900 p-2 rounded max-h-48 overflow-y-auto">{currentSelectedTask.config.initialText}</pre>
                        </div>
                    )}
                     <Button 
                        onClick={handleRunAnalysis}
                        disabled={isLoading || !currentSelectedTask.config.initialText}
                        leftIcon={isLoading ? undefined : <AcademicCapIcon className="w-4 h-4"/>}
                    >
                        {isLoading ? <LoadingSpinner size="sm" text="Analyzing..." /> : `Run ${currentSelectedTask.config.analysisType === 'LOGICAL_CONSISTENCY' ? 'Logical Consistency Check' : 'Analysis'}`}
                    </Button>
                </div>
              )}
            </div>

            <div className="bg-gray-800 p-4 rounded-md shadow">
              <h3 className="text-lg font-semibold text-sky-400 mb-2">Task Outputs & Versions ({currentSelectedTask.outputs.length})</h3>
              {currentTaskOutput && currentSelectedTask ? (
                <div className="bg-gray-700/50 p-3 rounded">
                  <div className="flex justify-between items-center mb-1">
                      <h4 className="text-md font-semibold text-sky-200">Current Output (v: ...{currentTaskOutput.versionId.slice(-6)})</h4>
                      <div className="flex items-center space-x-1">
                           <Button 
                              onClick={() => onOpenAdvancedIterationModal(activeProject.id, currentSelectedTask.id, currentTaskOutput.versionId)} 
                              variant="ghost" size="sm" className="p-1 text-xs" leftIcon={<SparklesIcon className="w-3 h-3"/>} title="Iterate on this output"/>
                          <Button onClick={() => navigator.clipboard.writeText(currentTaskOutput.data)} variant="ghost" size="sm" className="p-1 text-xs" leftIcon={<ClipboardCopyIcon className="w-3 h-3"/>} title="Copy"/>
                      </div>
                  </div>
                  {renderOutputData(currentSelectedTask, currentTaskOutput)}
                   {currentTaskOutput.changeSummaryFromIteration && (
                      <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-300">View AI Change Summary</summary>
                          <p className="mt-1 text-gray-300 italic bg-gray-800 p-2 rounded">{currentTaskOutput.changeSummaryFromIteration}</p>
                      </details>
                  )}
                </div>
              ) : <p className="text-sm text-gray-400">No outputs yet for this task.</p>}
              
              {currentSelectedTask.outputs.length > 1 && (
                   <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-300">Show Full Output History ({currentSelectedTask.outputs.length})</summary>
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-2">
                          {currentSelectedTask.outputs.slice().reverse().map(version => (
                              <div key={version.versionId} className={`p-2 rounded-md ${version.versionId === currentSelectedTask.currentOutputVersionId ? 'bg-sky-800/30 border border-sky-700' : 'bg-gray-700/30'}`}>
                                  <div className="flex justify-between items-center text-xs mb-1">
                                      <span className="font-semibold text-gray-300">Version ...{version.versionId.slice(-6)}</span>
                                      <div className="flex items-center space-x-1">
                                      {version.versionId !== currentSelectedTask.currentOutputVersionId && (
                                          <Button onClick={() => onMakeTaskOutputVersionCurrent(activeProject.id, currentSelectedTask.id, version.versionId)} variant="ghost" size="sm" className="p-0.5 text-xs" title="Make current">Set Current</Button>
                                      )}
                                      <Button onClick={() => onViewOutputVersion(activeProject.id, currentSelectedTask.id, version)} variant="ghost" size="sm" className="p-0.5 text-xs" title="View details">View</Button>
                                      </div>
                                  </div>
                                  <pre 
                                    className="text-xs bg-gray-900/70 p-1 rounded whitespace-pre-wrap max-h-16 overflow-y-auto line-clamp-2" 
                                    title={version.data}
                                  >
                                    {(version.data || "").substring(0,150) + (version.data && version.data.length > 150 ? "..." : "")}
                                  </pre>
                                  <p className="text-xs text-gray-500 mt-0.5">Source: {version.source} | {new Date(version.timestamp).toLocaleTimeString()}</p>
                              </div>
                          ))}
                      </div>
                   </details>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center text-gray-400 py-10">
            <ListBulletIcon className="w-16 h-16 mx-auto mb-4 text-gray-600"/>
            <p className="text-lg">Select a task (WBS item) from the list to view its details and work on it.</p>
            <p className="text-sm">Or, add a new task to the project.</p>
          </div>
        )}
      </div>
    </div>
  );
};