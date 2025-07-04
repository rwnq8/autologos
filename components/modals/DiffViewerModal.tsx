
import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffContent: {
    oldText: string;
    newText: string;
    version: string;
  } | null;
}

const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ isOpen, onClose, diffContent }) => {
  if (!isOpen || !diffContent) {
    return null;
  }

  const newStyles = {
    variables: {
        dark: {
            color: '#f1f5f9', // slate-100
            background: '#1e293b', // slate-800
            addedBackground: 'rgba(34, 197, 94, 0.15)', // green-500 with opacity
            addedColor: '#dcfce7', // green-100
            removedBackground: 'rgba(239, 68, 68, 0.15)', // red-500 with opacity
            removedColor: '#fee2e2', // red-100
            wordAddedBackground: 'rgba(34, 197, 94, 0.3)', // green-500
            wordRemovedBackground: 'rgba(239, 68, 68, 0.3)', // red-500
            emptyLineBackground: 'rgba(64, 84, 100, 0.1)',
            gutterColor: '#475569', // slate-600
            gutterBackground: '#0f172a', // slate-900
        },
    },
    line: {
        padding: '10px 2px',
        '&:hover': {
            background: '#334155', // slate-700
        },
    },
    wordDiff: {
        padding: '2px 4px',
        borderRadius: '4px',
    },
    gutter: {
        minWidth: '3rem',
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-viewer-title"
      onClick={onClose}
    >
      <div
        className="bg-slate-100 dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-primary-500/30"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-300 dark:border-slate-700 flex-shrink-0">
          <h2 id="diff-viewer-title" className="text-xl font-semibold text-primary-600 dark:text-primary-300">
            Visual Diff for Version {diffContent.version}
          </h2>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close diff viewer"
          >
            Close
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          <ReactDiffViewer
            oldValue={diffContent.oldText}
            newValue={diffContent.newText}
            splitView={true}
            useDarkTheme={window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches}
            styles={newStyles}
            compareMethod={DiffMethod.WORDS}
            leftTitle="Previous Version"
            rightTitle={`Version ${diffContent.version}`}
          />
        </main>
      </div>
    </div>
  );
};

export default DiffViewerModal;
