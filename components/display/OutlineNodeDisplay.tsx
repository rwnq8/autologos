
import React, { useState } from 'react';
import type { OutlineNode } from '../../types/index.ts';
import ChevronDownIcon from '../shared/ChevronDownIcon.tsx';
import ChevronUpIcon from '../shared/ChevronUpIcon.tsx';

interface OutlineNodeDisplayProps {
  node: OutlineNode;
  level?: number;
}

export const OutlineNodeDisplay: React.FC<OutlineNodeDisplayProps> = ({ node, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = node.children && node.children.length > 0;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const sourceFilesTooltip = node.sourceFileNames.length > 0
    ? `Source(s): ${node.sourceFileNames.join(', ')}`
    : 'Source not specified';

  return (
    <li className={`ml-${level * 4} list-none`}>
      <div 
        className="flex items-start group p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50"
        title={sourceFilesTooltip}
      >
        {hasChildren ? (
          <button onClick={toggleExpand} className="flex-shrink-0 w-6 h-6 p-1 mr-1 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
        ) : (
          <div className="flex-shrink-0 w-6 h-6 mr-1 flex items-center justify-center text-slate-400 dark:text-slate-500">&bull;</div>
        )}
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 mr-2 pt-0.5 w-16 text-right flex-shrink-0">{node.wbs}</span>
        <span className="text-slate-800 dark:text-slate-200 break-words flex-grow">
            {node.content}
        </span>
        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pt-0.5">
            [{node.sourceFileNames.length} source(s)]
        </span>
      </div>
      {hasChildren && isExpanded && (
        <ul className="mt-1 space-y-1">
          {node.children.map(childNode => (
            <OutlineNodeDisplay key={childNode.wbs} node={childNode} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};
