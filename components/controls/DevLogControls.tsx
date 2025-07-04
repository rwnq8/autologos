

import React, { useState, useCallback, useMemo } from 'react';
import type { DevLogEntry, DevLogEntryType, DevLogEntryStatus, CommonControlProps } from '../../types/index.ts';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import RoadmapDisplay from '../display/RoadmapDisplay.tsx';
import DevLogEntryCard from '../display/DevLogEntryCard.tsx';

type FormState = {
  mode: 'hidden' | 'add' | 'edit';
  entryData: DevLogEntry | null;
}

const DevLogControls: React.FC<CommonControlProps> = ({ 
    commonInputClasses, 
    commonSelectClasses, 
    commonButtonClasses,
 }) => {
  const { process: processCtx } = useEngine();
  const { devLog = [], addDevLogEntry, updateDevLogEntry, isProcessing } = processCtx;
  
  const [activeTab, setActiveTab] = useState<'log' | 'roadmap'>('log');
  
  const [formState, setFormState] = useState<FormState>({ mode: 'hidden', entryData: null });

  // Filter and search state
  const [typeFilter, setTypeFilter] = useState<DevLogEntryType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DevLogEntryStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form input state
  const [currentType, setCurrentType] = useState<DevLogEntryType>('note');
  const [currentSummary, setCurrentSummary] = useState('');
  const [currentDetails, setCurrentDetails] = useState('');
  const [currentStatus, setCurrentStatus] = useState<DevLogEntryStatus>('open');
  const [currentTags, setCurrentTags] = useState('');
  const [currentResolution, setCurrentResolution] = useState('');
  const [currentRelatedIteration, setCurrentRelatedIteration] = useState<string>('');
  const [currentParentEntryId, setCurrentParentEntryId] = useState<string | undefined>(undefined);

  const resetAndHideForm = useCallback(() => {
    setCurrentType('note');
    setCurrentSummary('');
    setCurrentDetails('');
    setCurrentStatus('open');
    setCurrentTags('');
    setCurrentResolution('');
    setCurrentRelatedIteration('');
    setCurrentParentEntryId(undefined);
    setFormState({ mode: 'hidden', entryData: null });
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
      parentEntryId: currentParentEntryId,
    };

    if (formState.mode === 'edit' && formState.entryData) {
      updateDevLogEntry({ ...formState.entryData, ...entryData });
    } else {
      addDevLogEntry(entryData);
    }
    resetAndHideForm();
  }, [currentSummary, currentType, currentDetails, currentStatus, currentTags, currentResolution, currentRelatedIteration, currentParentEntryId, formState, addDevLogEntry, updateDevLogEntry, resetAndHideForm]);

  const handleEditEntry = useCallback((entry: DevLogEntry) => {
    setCurrentType(entry.type);
    setCurrentSummary(entry.summary);
    setCurrentDetails(entry.details || '');
    setCurrentStatus(entry.status);
    setCurrentTags((entry.tags || []).join(', '));
    setCurrentResolution(entry.resolution || '');
    setCurrentRelatedIteration(entry.relatedIteration || '');
    setCurrentParentEntryId(entry.parentEntryId);
    setFormState({ mode: 'edit', entryData: entry });
  }, []);
  
  const handleAddNewEntryClick = useCallback(() => {
    setCurrentType('note');
    setCurrentSummary('');
    setCurrentDetails('');
    setCurrentStatus('open');
    setCurrentTags('');
    setCurrentResolution('');
    setCurrentRelatedIteration('');
    setCurrentParentEntryId(undefined);
    setFormState({ mode: 'add', entryData: null });
  }, []);
  
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

  const getTabClass = (tabName: 'log' | 'roadmap') =>
    `px-4 py-1.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
      activeTab === tabName
        ? 'bg-primary-600 text-white shadow'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`;

  const potentialParents = useMemo(() => {
    return devLog
      .filter(entry => entry.type === 'issue' || entry.type === 'feature')
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [devLog]);

  return (
    <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300">
          Development Log & Roadmap
        </h3>
        <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-900/50 rounded-lg">
          <button onClick={() => setActiveTab('log')} className={getTabClass('log')}>Log ({filteredDevLog.length})</button>
          <button onClick={() => setActiveTab('roadmap')} className={getTabClass('roadmap')}>Roadmap</button>
        </div>
      </div>

        <div className="space-y-3 p-3 bg-slate-100/50 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 animate-fadeIn">
          {activeTab === 'log' && (
            <>
              {formState.mode === 'hidden' && (
                <button
                  onClick={handleAddNewEntryClick}
                  className={`${commonButtonClasses} w-full bg-primary-500/10 hover:bg-primary-500/20 dark:bg-primary-600/30 dark:hover:bg-primary-700/40 text-primary-700 dark:text-primary-200`}
                  disabled={isProcessing}
                  aria-label="Add new development log entry"
                >
                  + Add New Log Entry
                </button>
              )}

              {formState.mode !== 'hidden' && (
                <div className="p-3 bg-white dark:bg-slate-700/60 rounded-md border border-slate-300 dark:border-slate-500 space-y-3 shadow">
                  <h4 className="text-sm font-medium text-primary-700 dark:text-primary-300">{formState.mode === 'edit' ? `Edit Entry (ID: ${formState.entryData?.id.substring(0,8)})` : 'Add New Log Entry'}</h4>
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
                      <label htmlFor="devlog-parent" className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-0.5">Parent Entry (Optional)</label>
                      <select id="devlog-parent" value={currentParentEntryId || ''} onChange={(e) => setCurrentParentEntryId(e.target.value || undefined)} className={commonSelectClasses + " text-sm py-1.5"} disabled={isProcessing}>
                        <option value="">None</option>
                        {potentialParents.map(parent => (
                          <option key={parent.id} value={parent.id} disabled={formState.entryData?.id === parent.id}>
                            {`[${parent.type}] ${parent.summary.substring(0, 50)}...`}
                          </option>
                        ))}
                      </select>
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
                    <button onClick={resetAndHideForm} className={`${commonButtonClasses} bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-600/80 dark:hover:bg-slate-500/80 text-xs`} disabled={isProcessing}>Cancel</button>
                    <button onClick={handleAddOrUpdateEntry} className={`${commonButtonClasses} bg-primary-500 hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700 text-white text-xs`} disabled={isProcessing || !currentSummary.trim()}>{formState.mode === 'edit' ? 'Update Entry' : 'Add Entry'}</button>
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

              {filteredDevLog.length === 0 && formState.mode === 'hidden' && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-3">No development log entries match the current filters.</p>
              )}
              
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredDevLog.map(entry => (
                  <DevLogEntryCard 
                    key={entry.id}
                    entry={entry}
                    onEdit={handleEditEntry}
                    isProcessing={isProcessing}
                    allEntries={devLog}
                  />
                ))}
              </div>
            </>
          )}
          {activeTab === 'roadmap' && (
            <RoadmapDisplay 
                devLog={devLog} 
                onEditEntry={handleEditEntry} 
                onNavigateToLog={(entry) => {
                  setSearchTerm(entry.summary);
                  setActiveTab('log');
                }}
            />
          )}
        </div>
    </div>
  );
};

export default DevLogControls;
