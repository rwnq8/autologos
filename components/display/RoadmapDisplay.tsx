
import React from 'react';
import type { DevLogEntry } from '../../types/index.ts';
import DevLogEntryCard from './DevLogEntryCard.tsx';

interface RoadmapDisplayProps {
  devLog: DevLogEntry[];
  onEditEntry: (entry: DevLogEntry) => void;
  onNavigateToLog: (entry: DevLogEntry) => void;
}

const RoadmapDisplay: React.FC<RoadmapDisplayProps> = ({ devLog, onEditEntry, onNavigateToLog }) => {
  const backlog = devLog.filter(e => e.type === 'feature' && e.status === 'open');
  const planned = devLog.filter(e => e.type === 'issue' && e.status === 'open');
  const inProgress = devLog.filter(e => e.status === 'in_progress');
  const recentlyCompleted = devLog
    .filter(e => ['resolved', 'implemented', 'closed'].includes(e.status))
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(0, 5);

  const RoadmapColumn: React.FC<{ title: string; entries: DevLogEntry[], bgColorClass: string }> = ({ title, entries, bgColorClass }) => (
    <div className={`flex-1 min-w-[200px] p-2 rounded-lg ${bgColorClass}`}>
      <h4 className="font-bold text-sm mb-2 text-slate-700 dark:text-slate-200 px-1 sticky top-0 bg-inherit py-1">{title} ({entries.length})</h4>
      <div className="space-y-2">
        {entries.length > 0 ? (
          entries.map(entry => (
            <DevLogEntryCard 
              key={entry.id} 
              entry={entry} 
              onEdit={onEditEntry} 
              isProcessing={false} // Roadmap is read-only for processing status
              isCompact={true}
              allEntries={devLog}
              onClick={() => onNavigateToLog(entry)}
            />
          ))
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic px-1">Nothing here.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <RoadmapColumn title="Backlog / Ideas" entries={backlog} bgColorClass="bg-blue-100/60 dark:bg-blue-900/40" />
      <RoadmapColumn title="Up Next / Planned" entries={planned} bgColorClass="bg-yellow-100/60 dark:bg-yellow-900/40" />
      <RoadmapColumn title="In Progress" entries={inProgress} bgColorClass="bg-purple-100/60 dark:bg-purple-900/40" />
      <RoadmapColumn title="Recently Completed" entries={recentlyCompleted} bgColorClass="bg-green-100/60 dark:bg-green-900/40" />
    </div>
  );
};

export default RoadmapDisplay;
