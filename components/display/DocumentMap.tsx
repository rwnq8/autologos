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
        process.updateProcessState({ activeChunkId: chunkId });
    };

    if (headingChunks.length === 0) {
        return (
            <div className="w-full h-full">
                <h3 className="text-sm font-semibold text-primary-600 dark:text-primary-300 mb-3 uppercase tracking-wider">Document Map</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">No headings found in the current document.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <h3 className="text-sm font-semibold text-primary-600 dark:text-primary-300 mb-3 uppercase tracking-wider">Document Map</h3>
            <ul className="space-y-1">
                {headingChunks.map(chunk => {
                    const level = getHeadingLevel(chunk.type);
                    const paddingLeft = `${(level - 1) * 0.75}rem`; // 0.75rem = 12px
                    const isActive = chunk.id === process.activeChunkId;
                    const buttonClasses = `w-full text-left text-xs p-1 rounded transition-colors ${
                        isActive 
                        ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-200 font-semibold' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`;

                    return (
                        <li key={chunk.id}>
                            <button
                                onClick={() => handleHeadingClick(chunk.id)}
                                className={buttonClasses}
                                style={{ paddingLeft }}
                                aria-current={isActive ? 'location' : 'false'}
                            >
                                {chunk.content.replace(/^#+\s*/, '')}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default DocumentMap;