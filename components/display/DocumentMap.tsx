import React from 'react';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import type { DocumentChunk } from '../../types/document.ts';

const getHeadingLevel = (type: DocumentChunk['type']): number => {
    if (type.startsWith('heading_')) {
        return parseInt(type.split('_')[1], 10);
    }
    return 0;
};

const DocumentMap: React.FC = () => {
    const { process } = useEngine();
    const headingChunks = process.documentChunks?.filter(chunk => chunk.type.startsWith('heading_')) || [];

    const handleHeadingClick = (chunkId: string) => {
        const element = document.getElementById(`chunk-${chunkId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (headingChunks.length === 0) {
        return (
            <aside className="w-64 flex-shrink-0 bg-slate-100 dark:bg-slate-800/50 p-4 border-r border-slate-300 dark:border-slate-700 overflow-y-auto">
                <h3 className="text-sm font-semibold text-primary-600 dark:text-primary-300 mb-3 uppercase tracking-wider">Document Map</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">No headings found in the current document.</p>
            </aside>
        );
    }

    return (
        <aside className="w-64 flex-shrink-0 bg-slate-100 dark:bg-slate-800/50 p-4 border-r border-slate-300 dark:border-slate-700 overflow-y-auto">
            <h3 className="text-sm font-semibold text-primary-600 dark:text-primary-300 mb-3 uppercase tracking-wider">Document Map</h3>
            <ul className="space-y-1">
                {headingChunks.map(chunk => {
                    const level = getHeadingLevel(chunk.type);
                    const paddingLeft = `${(level - 1) * 0.75}rem`; // 0.75rem = 12px
                    return (
                        <li key={chunk.id}>
                            <button
                                onClick={() => handleHeadingClick(chunk.id)}
                                className="w-full text-left text-xs text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-1 transition-colors"
                                style={{ paddingLeft }}
                            >
                                {chunk.content.replace(/^#+\s*/, '')}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
};

export default DocumentMap;
