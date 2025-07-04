
import React, { useState } from 'react';
import type { IterationLogEntry, ReconstructedProductResult, Version, IterationEntryType } from '../../types/index.ts';
import * as GeminaiDiff from 'diff';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import { formatLogEntryDiagnostics } from '../../services/diagnosticsFormatter.ts'; 
import { formatVersion } from '../../services/versionUtils.ts';

interface LogEntryItemProps {
  logEntry: IterationLogEntry;
  isExpanded: boolean;
  onToggleExpand: (versionKey: string) => void;
  onRewind: (version: Version) => void;
  onExportIterationMarkdown: (version: Version) => void;
  reconstructProductCallback: (targetVersion: Version, history: IterationLogEntry[], basePrompt: string) => ReconstructedProductResult; 
  iterationHistory: IterationLogEntry[]; 
  isProcessing: boolean;
}

const MAX_DIFF_RENDER_SIZE = 200000;

const getDiffTitle = (entry: IterationLogEntry): string => {
  const currentVersionString = formatVersion(entry);
  if (entry.entryType === 'initial_state') {
    return `Initial Product (${currentVersionString})`;
  }
  if (entry.entryType === 'ensemble_integration') {
    return `Changes to create Integrated Base (${currentVersionString})`;
  }
  if (entry.entryType === 'ensemble_sub_iteration' || entry.entryType === 'bootstrap_sub_iteration') {
      const runType = entry.entryType === 'ensemble_sub_iteration' ? 'Ensemble' : 'Bootstrap';
      return `Product of ${runType} Sub-Iteration (Run ${entry.bootstrapRun || entry.ensembleSampleId})`;
  }
  return `Changes for ${currentVersionString}`;
};

const getEntryTypeFriendlyName = (entryType?: IterationEntryType): string => {
    switch(entryType) {
        case 'initial_state': return 'Initial State';
        case 'ai_iteration': return 'AI Version';
        case 'manual_edit': return 'Manual Edit';
        case 'ensemble_integration': return 'Ensemble Integration';
        case 'ensemble_sub_iteration': return 'Ensemble Sub-Run';
        case 'targeted_refinement': return 'Targeted Refinement';
        case 'bootstrap_sub_iteration': return 'Bootstrap Sub-Run';
        case 'bootstrap_synthesis_milestone': return 'Bootstrap Milestone';
        default: return 'AI Version';
    }
}

const renderDiff = (diffStr: string) => {
  if (diffStr.length > MAX_DIFF_RENDER_SIZE) {
    return <pre className="text-xs text-yellow-600 dark:text-yellow-400">Diff is too large to render ({diffStr.length} chars).</pre>;
  }
  try {
    const diffJson = GeminaiDiff.parsePatch(diffStr);
    return diffJson.map((file, i) => (
      <div key={i}>
        {file.hunks.map((hunk, j) => (
          <pre key={j} className="text-xs font-mono whitespace-pre-wrap break-all">
            <div className="bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-t-md">{`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}</div>
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
  } catch (e) {
      console.error("Error parsing diff string:", e, diffStr.substring(0, 100));
      return <pre className="text-xs text-red-600 dark:text-red-400">Error rendering diff.</pre>;
  }
};


export const LogEntryItem: React.FC<LogEntryItemProps> = ({
  logEntry,
  isExpanded,
  onToggleExpand,
  onRewind,
  onExportIterationMarkdown,
  iterationHistory, 
  isProcessing,
}) => {
  const { process } = useEngine();
  const { initialPrompt: baseInitialPrompt } = process; 
  const [localCopyStatus, setLocalCopyStatus] = useState<string | undefined>(undefined);

  const handleCopySingleDiagnostic = async () => {
    setLocalCopyStatus("Copying...");
    try {
      const diagString = formatLogEntryDiagnostics(logEntry, iterationHistory, baseInitialPrompt);
      await navigator.clipboard.writeText(diagString);
      setLocalCopyStatus("Copied!");
    } catch (err) {
      console.error(`Failed to copy diagnostics for v${logEntry.majorVersion}.${logEntry.minorVersion}:`, err);
      setLocalCopyStatus("Copy Failed");
    }
    setTimeout(() => setLocalCopyStatus(undefined), 2000);
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
    const commonButtonClasses = "inline-flex items-center px-2 py-1 border text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-primary-500 disabled:opacity-50 transition-colors";
    const neutralButtonClasses = `${commonButtonClasses} border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20`;
    const versionString = formatVersion(logEntry);
    const versionKey = `${logEntry.majorVersion}.${logEntry.minorVersion}${logEntry.patchVersion !== undefined ? '.' + logEntry.patchVersion : ''}`;

    const versionForActions: Version = {
        major: logEntry.majorVersion,
        minor: logEntry.minorVersion,
        patch: logEntry.patchVersion,
    };
    
    const isHalted = logEntry.status?.includes('Halt');

  return (
    <div className={`p-3 rounded-md transition-colors duration-200 ${isExpanded ? 'bg-white dark:bg-slate-800 shadow-lg border border-primary-500/30 dark:border-primary-500/50' : 'bg-slate-100/70 dark:bg-black/10 hover:bg-slate-200/70 dark:hover:bg-black/20'}`}>
        <button onClick={() => onToggleExpand(versionKey)} className="w-full text-left flex justify-between items-start gap-2 focus:outline-none">
            <div className="flex-grow">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-primary-600 dark:text-primary-300">{versionString}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${logEntry.isCriticalFailure ? 'bg-red-200 dark:bg-red-800/70 text-red-800 dark:text-red-100' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>{logEntry.status}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{getEntryTypeFriendlyName(logEntry.entryType)}</span>
                    {logEntry.ensembleSampleId && <span className="text-xs text-teal-600 dark:text-teal-400">(Sample {logEntry.ensembleSampleId})</span>}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 break-words">{logEntry.productSummary}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    {logEntry.linesAdded !== undefined && <span className="text-green-600 dark:text-green-400">+{logEntry.linesAdded} lines</span>}
                    {logEntry.linesRemoved !== undefined && <span className="text-red-600 dark:text-red-400">-{logEntry.linesRemoved} lines</span>}
                    <span>Readability: <span className={readability.color}>{readability.text} ({logEntry.readabilityScoreFlesch?.toFixed(1) || 'N/A'})</span></span>
                </div>
            </div>
            <div className="flex-shrink-0 text-slate-500 dark:text-slate-400">
                {isExpanded ? <span>[−]</span> : <span>[+]</span>}
            </div>
        </button>

        {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-300/80 dark:border-white/10 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => onRewind(versionForActions)} disabled={isProcessing || isHalted} className={neutralButtonClasses} title={isHalted ? "Cannot rewind to a halted version" : ""}>Rewind to this Version</button>
                    <button onClick={() => onExportIterationMarkdown(versionForActions)} disabled={isProcessing || isHalted} className={neutralButtonClasses} title={isHalted ? "Cannot export a halted version" : ""}>Export Markdown</button>
                    <button onClick={handleCopySingleDiagnostic} className={`${neutralButtonClasses} min-w-[120px]`}>
                       {localCopyStatus || '[Copy] Diagnostics'}
                    </button>
                </div>
                {logEntry.productDiff && logEntry.productDiff.trim() && (
                    <details className="space-y-1" open>
                        <summary className="text-sm font-medium cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200">{getDiffTitle(logEntry)}</summary>
                        <div className="p-2 bg-slate-100/70 dark:bg-black/20 rounded-md max-h-80 overflow-y-auto">
                            {renderDiff(logEntry.productDiff)}
                        </div>
                    </details>
                )}
            </div>
        )}
    </div>
  );
};
