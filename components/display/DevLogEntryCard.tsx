
import React from 'react';
import type { DevLogEntry, DevLogEntryType, DevLogEntryStatus } from '../../types/index.ts';

interface DevLogEntryCardProps {
  entry: DevLogEntry;
  onEdit: (entry: DevLogEntry) => void;
  isProcessing: boolean;
  isCompact?: boolean;
  allEntries: DevLogEntry[];
  onClick?: () => void;
}

const DevLogEntryCard: React.FC<DevLogEntryCardProps> = ({ entry, onEdit, isProcessing, isCompact = false, allEntries, onClick }) => {
  const entryTypeColors: Record<DevLogEntryType, string> = {
    issue: 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-800/40',
    fix: 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-800/40',
    feature: 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-800/40',
    decision: 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-800/40',
    note: 'border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-700/60',
  };

  const entryStatusColors: Record<DevLogEntryStatus, string> = {
    open: 'bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-100',
    in_progress: 'bg-sky-200 dark:bg-sky-700 text-sky-800 dark:text-sky-100',
    resolved: 'bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-100',
    implemented: 'bg-teal-200 dark:bg-teal-700 text-teal-800 dark:text-teal-100',
    closed: 'bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-slate-100',
    deferred: 'bg-indigo-200 dark:bg-indigo-700 text-indigo-800 dark:text-indigo-100',
  };

  const parentEntry = entry.parentEntryId ? allEntries.find(e => e.id === entry.parentEntryId) : null;
  const childEntries = allEntries.filter(e => e.parentEntryId === entry.id);

  const cardContent = (
    <>
      <div className="flex justify-between items-start mb-1">
        <div className="flex-grow">
          <strong className="block text-slate-800 dark:text-slate-100 break-words leading-tight">{entry.summary}</strong>
          <div className="mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full mr-1.5 font-medium ${entryStatusColors[entry.status]}`}>{entry.status.replace('_', ' ')}</span>
              {!isCompact && (
                <span className="text-slate-500 dark:text-slate-400 text-xxs align-middle">
                   {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} | Created: {new Date(entry.timestamp).toLocaleDateString()}
                   {entry.lastModified !== entry.timestamp ? ` (Modified: ${new Date(entry.lastModified).toLocaleDateString()})`: ''}
                   {entry.relatedIteration && ` | Version: ${entry.relatedIteration}`}
                </span>
              )}
          </div>
        </div>
        {!isCompact && (
          <div className="flex-shrink-0 space-x-1.5 self-start">
            <button onClick={(e) => { e.stopPropagation(); onEdit(entry); }} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium" disabled={isProcessing} aria-label={`Edit entry ${entry.id.substring(0,8)}`}>Edit</button>
          </div>
        )}
      </div>
      
      {parentEntry && (
        <div className="text-xs mt-1.5 text-slate-500 dark:text-slate-400">
            Resolves: <span className="font-semibold">{`[${parentEntry.type}] ${parentEntry.summary}`}</span>
        </div>
      )}
      
      {!isCompact && (
        <>
            {entry.details && <details className="mt-1.5" onClick={e => e.stopPropagation()}><summary className="text-xs cursor-pointer text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">Details</summary><pre className="mt-1 text-xs whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-800/40 p-1.5 rounded text-slate-700 dark:text-slate-200">{entry.details}</pre></details>}
            {entry.resolution && <details className="mt-1.5" onClick={e => e.stopPropagation()}><summary className="text-xs cursor-pointer text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">Resolution</summary><pre className="mt-1 text-xs whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-800/40 p-1.5 rounded text-slate-700 dark:text-slate-200">{entry.resolution}</pre></details>}
            
            {childEntries.length > 0 && (
                 <details className="mt-1.5" onClick={e => e.stopPropagation()}>
                    <summary className="text-xs cursor-pointer text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">Child Entries ({childEntries.length})</summary>
                    <ul className="list-disc list-inside pl-2 mt-1">
                        {childEntries.map(child => (
                           <li key={child.id} className="text-xs text-slate-600 dark:text-slate-300">{`[${child.type}] ${child.summary}`}</li>
                        ))}
                    </ul>
                 </details>
            )}
            
            {(entry.tags && entry.tags.length > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1 items-center text-xxs">
                    <strong className="text-slate-600 dark:text-slate-300 text-xxs">Tags:</strong>
                    {(entry.tags || []).map(tag => <span key={tag} className="px-1.5 py-0.5 bg-sky-100 dark:bg-sky-800/70 rounded-full text-sky-700 dark:text-sky-200">{tag}</span>)}
                </div>
            )}
        </>
      )}
    </>
  );

  if (onClick) {
    return (
        <button onClick={onClick} className={`block w-full text-left p-2.5 rounded-md border-l-4 ${entryTypeColors[entry.type]} text-sm shadow-sm hover:shadow-md transition-shadow`}>
            {cardContent}
        </button>
    )
  }

  return (
    <div className={`p-2.5 rounded-md border-l-4 ${entryTypeColors[entry.type]} text-sm shadow-sm`}>
      {cardContent}
    </div>
  );
};

export default DevLogEntryCard;
