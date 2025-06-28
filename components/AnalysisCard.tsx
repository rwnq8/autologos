import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AnalysisResult, AnalysisType } from '../types';
import { ANALYSIS_TYPE_DESCRIPTIONS } from '../constants';
import { LoadingSpinner } from './LoadingSpinner';
import { ClipboardCopyIcon, SaveIcon } from './icons';

interface AnalysisCardProps {
  result: AnalysisResult;
  onCopyToClipboard: (content: string, type: AnalysisType) => void;
  onSaveAsMarkdown: (type: AnalysisType, content: string, originalFileName?: string | null) => void;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ 
  result, 
  onCopyToClipboard,
  onSaveAsMarkdown 
}) => {
  const { type, isLoading, isStreaming, content, error, originalFileName } = result;

  const getSanitizedHtml = (markdownText: string) => {
    const dirtyHtml = marked.parse(markdownText, { gfm: true, breaks: true });
    return DOMPurify.sanitize(dirtyHtml as string, {
        USE_PROFILES: { html: true },
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'del'],
        ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id']
    });
  };
  
  const formattedTypeName = type.replace(/([A-Z])/g, ' $1').trim();

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 flex flex-col min-h-[200px]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-sky-400">{formattedTypeName}</h3>
        {(isLoading || isStreaming) && <LoadingSpinner size="sm" color="border-sky-400" />}
      </div>
      <p className="text-xs text-gray-400 mb-2 italic">{ANALYSIS_TYPE_DESCRIPTIONS[type]}</p>
      
      <div className="flex-grow overflow-y-auto mb-2 prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1.5" style={{ wordBreak: 'break-word' }}>
        {error && <p className="text-red-400">Error: {error}</p>}
        {!error && !isLoading && !content && !isStreaming && <p className="text-gray-500">No analysis performed yet or no content generated.</p>}
        {content && <div dangerouslySetInnerHTML={{ __html: getSanitizedHtml(content) }} />}
        {isStreaming && !content && <p className="text-gray-400">Receiving response...</p>}
      </div>

      {!isLoading && !isStreaming && content && !error && (
        <div className="mt-auto pt-2 border-t border-gray-700/50 flex space-x-2">
          <button
            onClick={() => onCopyToClipboard(content, type)}
            className="text-xs py-1 px-2 rounded bg-sky-600 hover:bg-sky-700 text-white flex items-center space-x-1 transition-colors"
            aria-label={`Copy ${formattedTypeName} to clipboard`}
          >
            <ClipboardCopyIcon className="w-3 h-3" />
            <span>Copy</span>
          </button>
          <button
            onClick={() => onSaveAsMarkdown(type, content, originalFileName)}
            className="text-xs py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1 transition-colors"
            aria-label={`Save ${formattedTypeName} as Markdown`}
          >
            <SaveIcon className="w-3 h-3" />
            <span>Save .md</span>
          </button>
        </div>
      )}
    </div>
  );
};