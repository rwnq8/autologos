import React from 'react';
import type { DocumentChunk } from '../../types/index.ts';
import InfoIcon from '../shared/InfoIcon.tsx';

const getHeadingClasses = (type: DocumentChunk['type']) => {
    switch (type) {
        case 'heading_1': return 'text-3xl font-bold mt-6 mb-3 border-b-2 border-slate-300 dark:border-slate-600 pb-2';
        case 'heading_2': return 'text-2xl font-bold mt-5 mb-2 border-b border-slate-300 dark:border-slate-600 pb-1';
        case 'heading_3': return 'text-xl font-bold mt-4 mb-2';
        case 'heading_4': return 'text-lg font-bold mt-3 mb-1';
        case 'heading_5': return 'text-base font-bold mt-2 mb-1';
        case 'heading_6': return 'text-sm font-bold mt-1 mb-1';
        default: return '';
    }
};

export const DocumentChunkDisplay: React.FC<{ chunk: DocumentChunk }> = ({ chunk }) => {
    const sourceTooltip = chunk.sourceFileNames && chunk.sourceFileNames.length > 0
        ? `Source(s): ${chunk.sourceFileNames.join(', ')}`
        : undefined;

    const rationaleTooltip = chunk.changeRationale ? `AI Rationale: ${chunk.changeRationale}` : undefined;

    const RationaleIcon = () => chunk.changeRationale ? (
        <span className="ml-2 inline-block opacity-50 group-hover:opacity-100 transition-opacity" title={rationaleTooltip}>
            <InfoIcon />
        </span>
    ) : null;

    const isNew = chunk.lastOperation === 'added';
    const isModified = chunk.lastOperation === 'modified';

    const wrapperProps = {
        className: `group relative py-1 transition-all duration-500 rounded-md
            ${isNew ? 'animate-pulse-once' : ''} 
            ${isModified ? 'bg-blue-500/10' : ''}`,
        title: sourceTooltip,
        id: `chunk-${chunk.id}`,
        'data-chunk-id': chunk.id
    };


    switch (chunk.type) {
        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
        case 'heading_4':
        case 'heading_5':
        case 'heading_6':
            const HeadingTag = chunk.type.replace('_', '') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            return (
                <div {...wrapperProps} className={`${wrapperProps.className} heading-chunk`}>
                    <HeadingTag className={getHeadingClasses(chunk.type)}>
                        {chunk.content.replace(/^#+\s*/, '')} <RationaleIcon />
                    </HeadingTag>
                </div>
            );
        case 'code_block':
            return (
                <div {...wrapperProps}>
                    <pre className="bg-slate-200 dark:bg-slate-900 p-3 rounded-md my-2 text-sm font-mono overflow-x-auto">
                        <code>{chunk.content.replace(/^```(\w*)\n|```$/g, '')}</code>
                    </pre>
                </div>
            );
        case 'blockquote':
            return (
                <div {...wrapperProps}>
                    <blockquote className="border-l-4 border-slate-400 dark:border-slate-600 pl-4 italic my-2">
                        <p>{chunk.content.replace(/^>\s*/gm, '')} <RationaleIcon /></p>
                    </blockquote>
                </div>
            );
        case 'list':
             return (
                <div {...wrapperProps}>
                     <p className="my-2 whitespace-pre-line">{chunk.content} <RationaleIcon /></p>
                </div>
            );
        case 'thematic_break':
            return <hr className="my-4 border-slate-300 dark:border-slate-700" id={`chunk-${chunk.id}`}/>;
        case 'paragraph':
        default:
            return (
                <div {...wrapperProps}>
                    <p className="my-2">{chunk.content} <RationaleIcon /></p>
                </div>
            );
    }
};