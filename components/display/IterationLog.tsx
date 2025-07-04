
import React, { useState, useMemo } from 'react';
import type { IterationLogEntry, Version } from '../../types/index.ts'; 
import { LogEntryItem } from './LogEntryItem.tsx';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import { formatLogEntryDiagnostics } from '../../services/diagnosticsFormatter.ts';
import { formatVersion } from '../../services/versionUtils.ts';

interface IterationLogProps {
  onSaveLog: () => void;
}

const RECENT_COUNT = 5;
const GROUP_SIZE = 10;

const IterationLog: React.FC<IterationLogProps> = ({
  onSaveLog,
}) => {
  const { process: processCtx } = useEngine();
  const [expandedLogItemKey, setExpandedLogItemKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});
  const [globalCopyStatus, setGlobalCopyStatus] = useState<string>(''); 

  const toggleLogItem = (versionKey: string) => {
    setExpandedLogItemKey(expandedLogItemKey === versionKey ? null : versionKey);
  };
  
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleCopyAllDiagnostics = async () => {
    if (processCtx.iterationHistory.length === 0) return;
    setGlobalCopyStatus('Copying...');
    try {
      const allDiagStrings = processCtx.iterationHistory.map(entry =>
        formatLogEntryDiagnostics(entry, processCtx.iterationHistory, processCtx.initialPrompt)
      );
      const fullDiagnosticText = allDiagStrings.join('\n\n==== END OF VERSION DIAGNOSTICS ====\n\n');
      await navigator.clipboard.writeText(fullDiagnosticText);
      setGlobalCopyStatus('All Copied!');
    } catch (err) {
      console.error('Failed to copy all diagnostics:', err);
      setGlobalCopyStatus('Copy Failed!');
    }
    setTimeout(() => setGlobalCopyStatus(''), 3000);
  };

  const { recentEntries, groupedOlderEntries } = useMemo(() => {
    const reversedHistory = [...processCtx.iterationHistory].reverse();
    const recent = reversedHistory.slice(0, RECENT_COUNT);
    const older = reversedHistory.slice(RECENT_COUNT);
    
    const grouped: IterationLogEntry[][] = [];
    if (older.length > 0) {
      for (let i = 0; i < older.length; i += GROUP_SIZE) {
        grouped.push(older.slice(i, i + GROUP_SIZE));
      }
    }
    return { recentEntries: recent, groupedOlderEntries: grouped };
  }, [processCtx.iterationHistory]);

  if (processCtx.iterationHistory.length === 0) {
    return null;
  }
  
  const commonButtonClasses = "inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 transition-colors";

  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300">Version Log</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyAllDiagnostics}
            disabled={processCtx.iterationHistory.length === 0 || processCtx.isProcessing}
            className={commonButtonClasses}
            aria-label="Copy all version diagnostics to clipboard"
          >
            {globalCopyStatus || "Copy All Diagnostics"}
          </button>
          <button
            onClick={onSaveLog}
            className={commonButtonClasses}
            aria-label="Download full version log"
            disabled={processCtx.iterationHistory.length === 0}
          >
            Download Full Project
          </button>
        </div>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {recentEntries.map((log) => {
          const versionKey = `${log.majorVersion}.${log.minorVersion}${log.patchVersion !== undefined ? '.' + log.patchVersion : ''}`;
          return (
            <LogEntryItem
              key={versionKey} 
              logEntry={log}
              isExpanded={expandedLogItemKey === versionKey}
              onToggleExpand={toggleLogItem}
              reconstructProductCallback={processCtx.reconstructProductCallback}
              iterationHistory={processCtx.iterationHistory} 
              onRewind={processCtx.handleRewind}
              onExportIterationMarkdown={processCtx.handleExportIterationMarkdown}
              isProcessing={processCtx.isProcessing}
            />
          );
        })}

        {groupedOlderEntries.map((group, index) => {
          if (group.length === 0) return null;
          const firstInGroup = group[0];
          const lastInGroup = group[group.length - 1];
          const groupKey = `${formatVersion(lastInGroup)}-${formatVersion(firstInGroup)}`;
          const isGroupExpanded = !!expandedGroups[groupKey];
          
          return (
            <div key={groupKey} className="bg-slate-100/70 dark:bg-white/5 rounded-md">
              <button
                onClick={() => toggleGroup(groupKey)}
                className="w-full flex justify-between items-center p-3 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
                aria-expanded={isGroupExpanded}
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">Versions {formatVersion(lastInGroup)} to {formatVersion(firstInGroup)}</span>
                <span className="text-slate-500">{isGroupExpanded ? '[−]' : '[+]'}</span>
              </button>
              {isGroupExpanded && (
                <div className="p-2 space-y-3 border-t border-slate-200 dark:border-white/10">
                  {group.map((log) => {
                    const versionKey = `${log.majorVersion}.${log.minorVersion}${log.patchVersion !== undefined ? '.' + log.patchVersion : ''}`;
                    return (
                      <LogEntryItem
                        key={versionKey} 
                        logEntry={log}
                        isExpanded={expandedLogItemKey === versionKey}
                        onToggleExpand={toggleLogItem}
                        reconstructProductCallback={processCtx.reconstructProductCallback}
                        iterationHistory={processCtx.iterationHistory} 
                        onRewind={processCtx.handleRewind}
                        onExportIterationMarkdown={processCtx.handleExportIterationMarkdown}
                        isProcessing={processCtx.isProcessing}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IterationLog;
