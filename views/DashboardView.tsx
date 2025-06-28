
import React from 'react';
import { Project, Program, ProjectTask, ProjectTaskStatus } from '../types';
import { Button } from '../components/ui/Button';
import { 
  PlusIcon, EyeIcon, DocumentPlusIcon, SparklesIcon, ArchiveBoxArrowDownIcon, 
  ArchiveBoxArrowUpIcon, AcademicCapIcon, QuestionMarkCircleIcon, DocumentMagnifyingGlassIcon, BookOpenIcon
} from '../components/icons';

const ALL_TASK_STATUSES_DASHBOARD: ProjectTaskStatus[] = [
    ProjectTaskStatus.TODO, 
    ProjectTaskStatus.IN_PROGRESS, 
    ProjectTaskStatus.REVIEW, 
    ProjectTaskStatus.COMPLETED, 
    ProjectTaskStatus.BLOCKED, 
    ProjectTaskStatus.DEFERRED
];


interface DashboardViewProps {
  projects: Project[];
  programs: Program[];
  selectedProgramId: string;
  autologosProjectId: string | null;
  autologosProjectName: string | null;
  autologosProjectObjective: string | null;
  autologosMasterPlanMarkdown: string | null;
  appVersion: string;

  onSetSelectedProgramId: (id: string) => void;
  onSetPrograms: React.Dispatch<React.SetStateAction<Program[]>>;
  onLoadSystemSpecs: () => void;
  onOpenAiHelpModal: () => void;
  onOpenProjectWorkspace: (project: Project) => void;
  onCreateBlankProject: () => void;
  onOpenTemplateModal: () => void;
  onOpenAIIdeaModal: () => void;
  onOpenAiAssistedImportModal: () => void;
  onExportAutologosProjectFile: () => void;
  onRequestImportAutologosProjectFile: () => void;
  onOpenMasterPlanModal: () => void;
  onDeleteProject: (projectId: string) => void; 
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  programs,
  selectedProgramId,
  autologosProjectId,
  autologosProjectName,
  autologosProjectObjective,
  autologosMasterPlanMarkdown,
  appVersion,
  onSetSelectedProgramId,
  onSetPrograms,
  onLoadSystemSpecs,
  onOpenAiHelpModal,
  onOpenProjectWorkspace,
  onCreateBlankProject,
  onOpenTemplateModal,
  onOpenAIIdeaModal,
  onOpenAiAssistedImportModal,
  onExportAutologosProjectFile,
  onRequestImportAutologosProjectFile,
  onOpenMasterPlanModal,
  onDeleteProject,
}) => {

  const filteredProjects = projects.filter(p => p.programId === selectedProgramId);

  const getTaskStatusSummary = (projectTasks: ProjectTask[]): string => {
    if (!projectTasks || projectTasks.length === 0) return "No tasks.";
    
    const counts: Record<ProjectTaskStatus, number> = {
        [ProjectTaskStatus.TODO]: 0,
        [ProjectTaskStatus.IN_PROGRESS]: 0,
        [ProjectTaskStatus.REVIEW]: 0,
        [ProjectTaskStatus.COMPLETED]: 0,
        [ProjectTaskStatus.BLOCKED]: 0,
        [ProjectTaskStatus.DEFERRED]: 0,
    };
    projectTasks.forEach(task => {
        counts[task.status] = (counts[task.status] || 0) + 1;
    });

    const parts = ALL_TASK_STATUSES_DASHBOARD
        .map(status => ({ status, count: counts[status] }))
        .filter(item => item.count > 0)
        .map(item => `${item.count} ${item.status.replace('-', ' ')}`);
    
    return parts.length > 0 ? parts.join(', ') : "All tasks accounted for or no tasks.";
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-sky-400">Autologos Orchestrator</h1>
          <div className="flex items-center space-x-2">
            <Button onClick={onLoadSystemSpecs} variant="ghost" size="sm" leftIcon={<AcademicCapIcon className="w-4 h-4"/>}>System Specs</Button>
            <Button onClick={onOpenAiHelpModal} variant="ghost" size="sm" leftIcon={<QuestionMarkCircleIcon className="w-4 h-4"/>}>AI Help</Button>
          </div>
        </div>
        <p className="text-lg text-gray-400">Iteratively manage projects, tasks, and AI-powered deliverable generation.</p>
        <p className="text-xs text-gray-500 mt-1">App Version: {appVersion}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-sky-400 mb-2">Autologos Project File & Master Plan</h3>
              {autologosProjectId && autologosProjectName ? (
                  <div className="text-sm space-y-1 mb-3">
                      <p><span className="font-semibold text-gray-300">File Project ID:</span> {autologosProjectId}</p>
                      <p><span className="font-semibold text-gray-300">File Project Name:</span> {autologosProjectName}</p>
                      {autologosProjectObjective && <p><span className="font-semibold text-gray-300">Objective:</span> {autologosProjectObjective}</p>}
                      <p><span className="font-semibold text-gray-300">Master Plan:</span> {autologosMasterPlanMarkdown === null ? 'Not set' : (autologosMasterPlanMarkdown.trim() === '' ? 'Empty' : 'Exists')}</p>
                  </div>
              ) : (
                  <p className="text-sm text-gray-400 mb-3">No Autologos Project File loaded. Import one or create projects to initialize.</p>
              )}
              <div className="flex space-x-2 flex-wrap gap-y-2">
                  <Button onClick={onRequestImportAutologosProjectFile} variant="secondary" size="sm" leftIcon={<ArchiveBoxArrowUpIcon />}>Import .ALP</Button>
                  <Button onClick={onExportAutologosProjectFile} disabled={!autologosProjectId} variant="secondary" size="sm" leftIcon={<ArchiveBoxArrowDownIcon />}>Export .ALP</Button>
                  <Button onClick={onOpenMasterPlanModal} variant="secondary" size="sm" leftIcon={<BookOpenIcon />} disabled={!autologosProjectId}>View/Edit Master Plan</Button>
              </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg shadow">
             <h3 className="text-lg font-semibold text-sky-400 mb-2">Program Selection</h3>
                <select 
                    value={selectedProgramId} 
                    onChange={(e) => onSetSelectedProgramId(e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 mb-2"
                    aria-label="Select Program"
                >
                {programs.map(prog => <option key={prog.id} value={prog.id}>{prog.name}</option>)}
              </select>
              <Button onClick={() => {
                  const newProgramName = prompt("Enter new program name:");
                  if (newProgramName && newProgramName.trim() !== "") {
                      const newProgram = { id: crypto.randomUUID(), name: newProgramName.trim() };
                      onSetPrograms(prev => [...prev, newProgram]);
                      onSetSelectedProgramId(newProgram.id);
                  }
              }} variant="ghost" size="sm" leftIcon={<PlusIcon />}>New Program</Button>
          </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-sky-500 mb-4">Projects (WBS L1/L2) in "{programs.find(p=>p.id === selectedProgramId)?.name || 'Selected Program'}"</h2>
          <div className="flex space-x-2 mb-4 flex-wrap gap-y-2">
            <Button onClick={onCreateBlankProject} leftIcon={<PlusIcon />}>New Blank Project</Button>
            <Button onClick={onOpenTemplateModal} variant="secondary" leftIcon={<DocumentPlusIcon />}>New from Template</Button>
            <Button onClick={onOpenAIIdeaModal} variant="secondary" leftIcon={<SparklesIcon />}>AI New Project Assistant</Button>
            <Button onClick={onOpenAiAssistedImportModal} variant="secondary" leftIcon={<DocumentMagnifyingGlassIcon />}>AI-Assisted Document Import</Button>
          </div>
          {filteredProjects.length === 0 && (
            <p className="text-gray-400">No projects yet. Create one to get started!</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => ( 
              <div key={project.id} 
                   className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-sky-500/30 transition-shadow duration-300 flex flex-col justify-between cursor-pointer"
                   onClick={() => onOpenProjectWorkspace(project)} 
              >
                <div>
                  <h3 className="text-xl font-semibold text-sky-400 mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-400 mb-1 leading-relaxed line-clamp-2" title={project.description}>{project.description || "No description."}</p>
                  <p className="text-xs text-gray-500 mb-1">Tasks (WBS L2/L3): {project.tasks.length}</p>
                  <p className="text-xs text-gray-500 mb-3 truncate" title={getTaskStatusSummary(project.tasks)}>Status Summary: {getTaskStatusSummary(project.tasks)}</p>
                   {project.projectObjective && <p className="text-xs text-gray-500 mb-1 line-clamp-1" title={project.projectObjective}><span className="font-semibold">Objective:</span> {project.projectObjective}</p>}
                  {project.documentStatus && <p className="text-xs text-gray-500"><span className="font-semibold">Doc Status:</span> {project.documentStatus}</p>}
                </div>
                <div 
                  className="flex space-x-2 mt-4 pt-4 border-t border-gray-700/50"
                  onClick={(e) => e.stopPropagation()} 
                >
                  <Button onClick={() => onOpenProjectWorkspace(project)} size="sm" leftIcon={<EyeIcon />} aria-label={`Open project ${project.name}`}>Open Workspace</Button>
                   {/* <Button onClick={() => onDeleteProject(project.id)} variant="danger" size="sm" leftIcon={<TrashIcon />} className="ml-auto" aria-label={`Delete project ${project.name}`}>Delete</Button> */}

                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};