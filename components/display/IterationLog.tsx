


import React, { useState, useContext } from 'react';
import type { IterationLogEntry, ReconstructedProductResult, DiffViewType } from '../../types'; 
import LogEntryItem from './LogEntryItem';
import { useProcessContext } from '../../contexts/ProcessContext';
import { formatLogEntryDiagnostics } from '../../services/diagnosticsFormatter'; // Import the new formatter

export interface IterationLogProps {
  onSaveLog: () => void; 
}

const IterationLog: React.FC<IterationLogProps> = ({
  onSaveLog,
}) => {
  const processCtx = useProcessContext();
  const [expandedLogItem, setExpandedLogItem] = useState<number | null>(null);
  const [individualCopyStatus, setIndividualCopyStatus] = useState<{ [key: number]: string }>({}); // For individual items
  const [globalCopyStatus, setGlobalCopyStatus] = useState<string>(''); // For "Copy All" button


  const toggleLogItem = (iteration: number) => {
    setExpandedLogItem(expandedLogItem === iteration ? null : iteration);
  };

  const handleCopyAllDiagnostics = async () => {
    if (processCtx.iterationHistory.length === 0) return;
    setGlobalCopyStatus('Copying...');
    try {
      const allDiagStrings = processCtx.iterationHistory.map(entry =>
        formatLogEntryDiagnostics(entry, processCtx.iterationHistory, processCtx.initialPrompt)
      );
      const fullDiagnosticText = allDiagStrings.join('\n\n==== END OF ITERATION DIAGNOSTICS ====\n\n');
      await navigator.clipboard.writeText(fullDiagnosticText);
      setGlobalCopyStatus('All Copied!');
    } catch (err) {
      console.error('Failed to copy all diagnostics:', err);
      setGlobalCopyStatus('Copy Failed!');
    }
    setTimeout(() => setGlobalCopyStatus(''), 3000);
  };


  if (processCtx.iterationHistory.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300">Iteration Log</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAllDiagnostics}
            disabled={processCtx.iterationHistory.length === 0 || processCtx.isProcessing}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 transition-colors"
            aria-label="Copy all iteration diagnostics to clipboard"
          >
            {globalCopyStatus || "Copy All Diagnostics"}
          </button>
          <button
            onClick={onSaveLog}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 transition-colors"
            aria-label="Download iteration log"
            disabled={processCtx.iterationHistory.length === 0}
          >
            Download Log (.json)
          </button>
        </div>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {processCtx.iterationHistory.slice().reverse().map((log) => (
          <LogEntryItem
            key={log.iteration + (log.attemptCount || 0) * 0.1} // Ensure unique key for re-attempts if logged separately
            logEntry={log}
            isExpanded={expandedLogItem === log.iteration}
            onToggleExpand={toggleLogItem}
            // handleCopyDiagnostics is now internal to LogEntryItem using the formatter
            reconstructProductCallback={(iter, hist) => processCtx.reconstructProductCallback(iter, hist, processCtx.initialPrompt)}
            iterationHistory={processCtx.iterationHistory} // Still needed for diff reconstruction in LogEntryItem
            copyStatusForThisItem={individualCopyStatus[log.iteration]} // Use individualCopyStatus
            onRewind={processCtx.handleRewind}
            onExportIterationMarkdown={processCtx.handleExportIterationMarkdown}
            isProcessing={processCtx.isProcessing}
          />
        ))}
      </div>
    </div>
  );
};

export default IterationLog;
