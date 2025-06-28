
import React, { useState, useContext } from 'react';
import type { IterationLogEntry, ReconstructedProductResult, ModelConfig, AiResponseValidationInfo, ReductionDetailValue, PromptLeakageDetailValue, SelectableModelName, IterationEntryType } from '../../types.ts';
import * as GeminaiDiff from 'diff';
import { useProcessContext } from '../../contexts/ProcessContext.tsx';
import { countWords } from '../../services/textAnalysisService.ts';
import { SELECTABLE_MODELS } from '../../types.ts';
import { formatLogEntryDiagnostics } from '../../services/diagnosticsFormatter.ts'; 
import ChevronDownIcon from '../shared/ChevronDownIcon.tsx';
import ChevronUpIcon from '../shared/ChevronUpIcon.tsx';
import DocumentDuplicateIcon from '../shared/DocumentDuplicateIcon.tsx';


interface LogEntryItemProps {
  logEntry: IterationLogEntry;
  isExpanded: boolean;
  onToggleExpand: (iteration: number) => void;
  onRewind: (iterationNumber: number) => void;
  onExportIterationMarkdown: (iterationNumber: number) => void;
  reconstructProductCallback: (targetIteration: number, history: IterationLogEntry[]) => ReconstructedProductResult; 
  iterationHistory: IterationLogEntry[]; 
  isProcessing: boolean;
}

const MAX_DIFF_RENDER_SIZE = 200000; // 200k chars max for rendering a diff to prevent UI freeze

// Helper function to determine the title for the diff section
const getDiffTitle = (entry: IterationLogEntry): string => {
  if (entry.entryType === 'initial_state' && entry.iteration === 0) {
    return "Initial Product";
  }
  if (entry.entryType === 'segmented_synthesis_milestone' && entry.iteration === 1) {
    return `Changes from Iteration 0 (Full Product after Segmented Synthesis)`;
  }
  // For all other cases, including AI iterations, manual edits, targeted refinements
  // that are not Iteration 0 or the special Iteration 1 milestone.
  if (entry.iteration > 0) {
    return `Changes from Iteration ${entry.iteration - 1}`;
  }
  // Fallback for Iteration 0 if not 'initial_state' (should not happen with good data)
  // or other unexpected scenarios.
  return `Product at Iteration ${entry.iteration}`;
};

const getEntryTypeFriendlyName = (entryType?: IterationEntryType): string => {
    switch(entryType) {
        case 'initial_state': return 'Initial State';
        case 'ai_iteration': return 'AI Iteration';
        case 'manual_edit': return 'Manual Edit';
        case 'segmented_synthesis_milestone': return 'Segmented Synthesis';
        case 'targeted_refinement': return 'Targeted Refinement';
        default: return 'AI Iteration';
    }
}

const renderDiff = (diffStr: string) => {
  if (diffStr.length > MAX_DIFF_RENDER_SIZE) {
    return <pre className="text-xs text-yellow-600 dark:text-yellow-400">Diff is too large to render ({diffStr.length} chars). Use 'Export Iteration Diffs' to view.</pre>;
  }
  const diffJson = GeminaiDiff.parsePatch(diffStr);
  return diffJson.map((file, i) => (
    <div key={i}>
      {file.hunks.map((hunk, j) => (
        <pre key={j} className="text-xs font-mono whitespace-pre-wrap break-all">
          <div className="bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-t-md">{hunk.header}</div>
          {hunk.lines.map((line, k) => {
            const colorClass = line.startsWith('+') ? 'bg-green-100/50 dark:bg-green-800/20 text-green-800 dark:text-green-200'
                             : line.startsWith('-') ? 'bg-red-100/50 dark:bg-red-800/20 text-red-800 dark:text-red-200'
                             : 'text-slate-600 dark:text-slate-400';
            return <div key={k} className={`${colorClass} px-2`}>{line}</div>;
          })}
        </pre>
      ))}
    </div>
  ));
};


export const LogEntryItem: React.FC<LogEntryItemProps> = ({
  logEntry,
  isExpanded,
  onToggleExpand,
  onRewind,
  onExportIterationMarkdown,
  reconstructProductCallback, 
  iterationHistory, 
  isProcessing,
}) => {
  const { initialPrompt: baseInitialPrompt } = useProcessContext(); 
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<{ [key: string]: boolean }>({});
  const [expandedPrompts, setExpandedPrompts] = useState<{ [key: string]: boolean }>({});

  const toggleDiagnosticSection = (key: string) => {
    setExpandedDiagnostics(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const togglePromptExpansion = (key: string) => {
    setExpandedPrompts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [localCopyStatus, setLocalCopyStatus] = useState<string | undefined>(undefined);

  const handleCopySingleDiagnostic = async () => {
    setLocalCopyStatus("Copying...");
    try {
      const diagString = formatLogEntryDiagnostics(logEntry, iterationHistory, baseInitialPrompt);
      await navigator.clipboard.writeText(diagString);
      setLocalCopyStatus("Copied!");
    } catch (err) {
      console.error('Failed to copy diagnostics for iter ' + logEntry.iteration + ':', err);
      setLocalCopyStatus("Copy Failed");
    }
    setTimeout(() => setLocalCopyStatus(undefined), 2000);
  };


  const getProductSummaryForDisplay = (entry: IterationLogEntry): string => {
    return entry.productSummary || "Summary N/A";
  };
  
    const getReadabilityInterpretation = (score: number | undefined): { text: string; color: string } => {
        if (score === undefined) return { text: "N/A", color: "text-slate-500" };
        if (score >= 90) return { text: "Very Easy", color: "text-green-700 dark:text-green-300" };
        if (score >= 70) return { text: "Easy", color: "text-green-600 dark:text-green-400" };
        if (score >= 60) return { text: "Fairly Easy", color: "text-lime-600 dark:text-lime-400" };
        if (score >= 50) return { text: "Standard", color: "text-yellow-600 dark:text-yellow-400" };
        if (score >= 30) return { text: "Fairly Difficult", color: "text-orange-500 dark:text-orange-400" };
        return { text: "Very Difficult", color: "text-red-600 dark:text-red-400" };
    };

    const readability = getReadabilityInterpretation(logEntry.readabilityScoreFlesch);
    const commonButtonClasses = "inline-flex items-center px-2 py-1 border text-xxs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-primary-500 disabled:opacity-50 transition-colors";
    const neutralButtonClasses = `${commonButtonClasses} border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20`;

  return (
    <div className={`p-3 rounded-md transition-colors duration-200 ${isExpanded ? 'bg-white dark:bg-slate-800 shadow-lg border border-primary-500/30 dark:border-primary-500/50' : 'bg-slate-100/70 dark:bg-black/10 hover:bg-slate-200/70 dark:hover:bg-black/20'}`}>
        <button onClick={() => onToggleExpand(logEntry.iteration)} className="w-full text-left flex justify-between items-start gap-2 focus:outline-none">
            <div className="flex-grow">
                <div className="flex items-baseline gap-2">
                    <span className="font-bold text-primary-600 dark:text-primary-300">Iter. {logEntry.iteration}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${logEntry.isCriticalFailure ? 'bg-red-200 dark:bg-red-800/70 text-red-800 dark:text-red-100' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>{logEntry.status}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{getEntryTypeFriendlyName(logEntry.entryType)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 break-words">{getProductSummaryForDisplay(logEntry)}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    {logEntry.linesAdded !== undefined && <span className="text-green-600 dark:text-green-400">+{logEntry.linesAdded} lines</span>}
                    {logEntry.linesRemoved !== undefined && <span className="text-red-600 dark:text-red-400">-{logEntry.linesRemoved} lines</span>}
                    <span>Readability: <span className={readability.color}>{readability.text} ({logEntry.readabilityScoreFlesch?.toFixed(1) || 'N/A'})</span></span>
                </div>
            </div>
            <div className="flex-shrink-0 text-slate-500 dark:text-slate-400">
                {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </div>
        </button>

        {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-300/80 dark:border-white/10 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => onRewind(logEntry.iteration)} disabled={isProcessing} className={neutralButtonClasses}>Rewind to this Iteration</button>
                    <button onClick={() => onExportIterationMarkdown(logEntry.iteration)} disabled={isProcessing} className={neutralButtonClasses}>Export Markdown</button>
                    <button onClick={handleCopySingleDiagnostic} className={`${neutralButtonClasses} min-w-[120px]`}>
                       <DocumentDuplicateIcon className="w-3 h-3 mr-1"/> {localCopyStatus || 'Copy Diagnostics'}
                    </button>
                </div>
                {logEntry.productDiff && logEntry.productDiff.trim() && (
                    <details className="space-y-1" open>
                        <summary className="text-sm font-medium cursor-pointer text-primary-600 dark:text-primary-400 hover:underline">{getDiffTitle(logEntry)}</summary>
                        <div className="p-2 bg-slate-50 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 max-h-96 overflow-y-auto">{renderDiff(logEntry.productDiff)}</div>
                    </details>
                )}
            </div>
        )}
    </div>
  );
};
