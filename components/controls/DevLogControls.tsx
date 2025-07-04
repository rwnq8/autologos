import React, { useState, useCallback, useMemo } from 'react';
import type { DevLogEntry, DevLogEntryType, DevLogEntryStatus, CommonControlProps } from '../../types/index.ts';
import { useEngine } from '../../contexts/ApplicationContext.tsx';

const DevLogControls: React.FC<CommonControlProps> = ({ 
    commonInputClasses, 
    commonSelectClasses, 
    commonButtonClasses,
 }) => {
  const { process: processCtx } = useEngine();
  const { devLog = [], addDevLogEntry, updateDevLogEntry, deleteDevLogEntry, isProcessing } = processCtx;
  
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DevLogEntry | null>(null);

  // Filter and search state
  const [typeFilter, setTypeFilter] = useState<DevLogEntryType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DevLogEntryStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [currentType, setCurrentType] = useState<DevLogEntryType>('note');
  const [currentSummary, setCurrentSummary] = useState('');
  const [currentDetails, setCurrentDetails] = useState('');
  const [currentStatus, setCurrentStatus] = useState<DevLogEntryStatus>('open');
  const [currentTags, setCurrentTags] = useState('');
  const [currentResolution, setCurrentResolution] = useState('');
  const [currentRelatedIteration, setCurrentRelatedIteration] = useState<string>('');

  const resetForm = useCallback(() => {
    setCurrentType('note');
    setCurrentSummary('');
    setCurrentDetails('');
    setCurrentStatus('open');
    setCurrentTags('');
    setCurrentResolution('');
    setCurrentRelatedIteration('');
    setEditingEntry(null);
    setShowAddForm(false);
  }, []);

  const handleAddOrUpdateEntry = useCallback(() => {
    if (!currentSummary.trim()) {
      alert('Summary is required.');
      return;
    }

    const entryData = {
      type: currentType,
      summary: currentSummary.trim(),
      details: currentDetails.trim() || undefined,
      status: currentStatus,
      tags: currentTags.split(',').map(tag => tag.trim()).filter(tag => tag),
      resolution: currentResolution.trim() || undefined,
      relatedIteration: currentRelatedIteration.trim() || undefined,
    };

    if (editingEntry) {
      updateDevLogEntry({ ...editingEntry, ...entryData });
    } else {
      addDevLogEntry(entryData);
    }
    resetForm();
  }, [currentSummary, currentType, currentDetails, currentStatus, currentTags, currentResolution, currentRelatedIteration, editingEntry, addDevLogEntry, updateDevLogEntry, resetForm]);

  const handleEditEntry = useCallback((entry: DevLogEntry) => {
    setEditingEntry(entry);
    setCurrentType(entry.type);
    setCurrentSummary(entry.summary);
    setCurrentDetails(entry.details || '');
    setCurrentStatus(entry.status);
    setCurrentTags((entry.tags || []).join(', '));
    setCurrentResolution(entry.resolution || '');
    setCurrentRelatedIteration(entry.relatedIteration || '');
    setShowAddForm(true);
    setIsSectionExpanded(true); // Ensure section is expanded when editing
  }, []);
  
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

  const filteredDevLog = useMemo(() => {
    return devLog
      .filter(entry => {
        const typeMatch = typeFilter === 'all' || entry.type === typeFilter;
        const statusMatch = statusFilter === 'all' || entry.status === statusFilter;
        const searchMatch = searchTerm === '' || entry.summary.toLowerCase().includes(searchTerm.toLowerCase());
        return typeMatch && statusMatch && searchMatch;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [devLog, typeFilter, statusFilter, searchTerm]);

  return (
    <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300">
          Development Log & Roadmap ({filteredDevLog.length}/{devLog.length})
        </h3>
        <button
          onClick={() => setIsSectionExpanded(!isSectionExpanded)}
          className="px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-expanded={isSectionExpanded}
          aria-controls="devlog-content"
        >
          {isSectionExpanded ? 'Collapse Log' : 'Expand Log'}
        </button>
      </div>

      {isSectionExpanded && (
        <div id="devlog-content" className="space-y-3 p-3 bg-slate-100/50 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 animate-fadeIn">
          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setEditingEntry(null); resetForm(); }}
              className={`${commonButtonClasses} w-full bg-primary-500/10 hover:bg-primary-500/20 dark:bg-primary-600/30 dark:hover:bg-primary-700/40 text-primary-700 dark:text-primary-200`}
              disabled={isProcessing}
              aria-label="Add new development log entry"
            >
              + Add New Log Entry
            </button>
          )}

          {(showAddForm || editingEntry) && (
            <div className="p-3 bg-white dark:bg-slate-700/60 rounded-md border border-slate-300 dark:border-slate-500 space-y-3 shadow">
              <h4 className="text-sm font-medium text-primary-700 dark:text-primary-300">{editingEntry ? `Edit Entry (ID: ${editingEntry.id.substring(0,8)})` : 'Add New Log Entry'}</h4>
              <div>
                <label htmlFor="devlog-summary" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Summary*</label>
                <input type="text" id="devlog-summary" value={currentSummary} onChange={(e) => setCurrentSummary(e.target.value)} className={commonInputClasses + " text-sm py-1.5"} placeholder="Brief summary of the item" disabled={isProcessing}/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="devlog-type" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Type</label>
                  <select id="devlog-type" value={currentType} onChange={(e) => setCurrentType(e.target.value as DevLogEntryType)} className={commonSelectClasses + " text-sm py-1.5"} disabled={isProcessing}>
                    <option value="note">Note</option>
                    <option value="issue">Issue</option>
                    <option value="fix">Fix</option>
                    <option value="feature">Feature Request</option>
                    <option value="decision">Decision</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="devlog-status" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Status</label>
                  <select id="devlog-status" value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value as DevLogEntryStatus)} className={commonSelectClasses + " text-sm py-1.5"} disabled={isProcessing}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="implemented">Implemented</option>
                    <option value="closed">Closed</option>
                    <option value="deferred">Deferred</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="devlog-details" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Details (Markdown supported)</label>
                <textarea id="devlog-details" value={currentDetails} onChange={(e) => setCurrentDetails(e.target.value)} rows={3} className={commonInputClasses + " text-sm py-1.5 resize-y"} placeholder="More details, steps, context..." disabled={isProcessing}/>
              </div>
              <div>
                <label htmlFor="devlog-resolution" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Resolution (if applicable)</label>
                <textarea id="devlog-resolution" value={currentResolution} onChange={(e) => setCurrentResolution(e.target.value)} rows={2} className={commonInputClasses + " text-sm py-1.5 resize-y"} placeholder="How was this resolved or implemented?" disabled={isProcessing}/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label htmlFor="devlog-tags" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Tags (comma-separated)</label>
                    <input type="text" id="devlog-tags" value={currentTags} onChange={(e) => setCurrentTags(e.target.value)} className={commonInputClasses + " text-sm py-1.5"} placeholder="e.g., UI, API, Bug" disabled={isProcessing}/>
                </div>
                <div>
                    <label htmlFor="devlog-related-iter" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Related Version</label>
                    <input type="text" id="devlog-related-iter" value={currentRelatedIteration} onChange={(e) => setCurrentRelatedIteration(e.target.value)} className={commonInputClasses + " text-sm py-1.5"} placeholder="e.g., v1.2" disabled={isProcessing}/>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-2">
                <button onClick={resetForm} className={`${commonButtonClasses} bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-600/80 dark:hover:bg-slate-500/80 text-xs`} disabled={isProcessing}>Cancel</button>
                <button onClick={handleAddOrUpdateEntry} className={`${commonButtonClasses} bg-primary-500 hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-xs`} disabled={isProcessing || !currentSummary.trim()}>{editingEntry ? 'Update Entry' : 'Add Entry'}</button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <div className="flex-1">
              <label htmlFor="devlog-filter-type" className="sr-only">Filter by type</label>
              <select id="devlog-filter-type" value={typeFilter} onChange={e => setTypeFilter(e.target.value as DevLogEntryType | 'all')} className={commonSelectClasses}>
                <option value="all">All Types</option>
                <option value="note">Note</option>
                <option value="issue">Issue</option>
                <option value="fix">Fix</option>
                <option value="feature">Feature Request</option>
                <option value="decision">Decision</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="devlog-filter-status" className="sr-only">Filter by status</label>
              <select id="devlog-filter-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as DevLogEntryStatus | 'all')} className={commonSelectClasses}>
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="implemented">Implemented</option>
                <option value="closed">Closed</option>
                <option value="deferred">Deferred</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="devlog-filter-search" className="sr-only">Search summaries</label>
              <input 
                id="devlog-filter-search"
                type="text" 
                placeholder="Search summaries..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className={commonInputClasses}/>
            </div>
          </div>

          {filteredDevLog.length === 0 && !showAddForm && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-3">No development log entries match the current filters.</p>
          )}
          
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredDevLog.map(entry => (
              <div key={entry.id} className={`p-2.5 rounded-md border-l-4 ${entryTypeColors[entry.type]} text-sm shadow-sm`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-grow">
                    <strong className="block text-slate-800 dark:text-slate-100 break-words leading-tight">{entry.summary}</strong>
                    <div className="mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full mr-1.5 font-medium ${entryStatusColors[entry.status]}`}>{entry.status.replace('_', ' ')}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xxs align-middle">
                           {entry.type.toString().charAt(0).toUpperCase() + entry.type.toString().slice(1)} | Created: {new Date(entry.timestamp).toLocaleDateString()}
                           {entry.lastModified !== entry.timestamp ? ` (Modified: ${new Date(entry.lastModified).toLocaleDateString()})`: ''}
                           {entry.relatedIteration !== undefined ? ` | Version: ${entry.relatedIteration}` : ''}
                        </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 space-x-1.5 self-start">
                    <button onClick={() => handleEditEntry(entry)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium" disabled={isProcessing} aria-label={`Edit entry ${entry.id.substring(0,8)}`}>Edit</button>
                    <button onClick={() => {if(window.confirm(`Are you sure you want to delete this log entry: "${entry.summary}"?`)) deleteDevLogEntry(entry.id)}} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium" disabled={isProcessing} aria-label={`Delete entry ${entry.id.substring(0,8)}`}>Delete</button>
                  </div>
                </div>
                {entry.details && <details className="mt-1.5"><summary className="text-xs cursor-pointer text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">Details</summary><pre className="mt-1 text-xs whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-800/40 p-1.5 rounded text-slate-700 dark:text-slate-200">{entry.details}</pre></details>}
                {entry.resolution && <details className="mt-1.5"><summary className="text-xs cursor-pointer text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">Resolution</summary><pre className="mt-1 text-xs whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-800/40 p-1.5 rounded text-slate-700 dark:text-slate-200">{entry.resolution}</pre></details>}
                {(entry.tags && entry.tags.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1 items-center text-xxs">
                        <strong className="text-slate-600 dark:text-slate-300 text-xxs">Tags:</strong>
                        {(entry.tags || []).map(tag => <span key={tag} className="px-1.5 py-0.5 bg-sky-100 dark:bg-sky-800/70 rounded-full text-sky-700 dark:text-sky-200">{tag}</span>)}
                    </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevLogControls;