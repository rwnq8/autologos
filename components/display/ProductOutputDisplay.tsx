

import React, { useRef, useEffect, useState } from 'react';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import { formatVersion } from '../../services/versionUtils.ts';
import { reconstructFromChunks } from '../../services/chunkingService.ts';


export interface ProductOutputDisplayProps {
  onSaveFinalProduct: () => void;
}


const ProductOutputDisplay: React.FC<ProductOutputDisplayProps> = ({
  onSaveFinalProduct,
}) => {
  const { process: processCtx, app: appCtx } = useEngine();
  const productDisplayRef = useRef<HTMLPreElement>(null);
  const [isCurrentProductDetailsExpanded, setIsCurrentProductDetailsExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  const productToDisplay = (processCtx.documentChunks && processCtx.documentChunks.length > 0)
    ? reconstructFromChunks(processCtx.documentChunks)
    : (processCtx.finalProduct || processCtx.currentProduct || "");

  const handleCopy = () => {
    if (copyStatus !== 'idle' || !productToDisplay) return;
    setCopyStatus('copying');
    navigator.clipboard.writeText(productToDisplay).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
      console.error("Failed to copy product:", err);
      setCopyStatus('idle'); // Reset on error
    });
  };
  
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && !processCtx.isProcessing) {
      processCtx.updateProcessState({ 
        currentTextSelectionForRefinement: selectedText,
        isTargetedRefinementModalOpen: true,
      });
    }
  };


  let productSectionTitleValue = "Current Output";
  if (processCtx.finalProduct) {
    productSectionTitleValue = `Final Product (v${processCtx.currentMajorVersion}.${processCtx.currentMinorVersion})`;
  } else if (processCtx.currentMajorVersion > 0 || processCtx.currentMinorVersion > 0) {
    productSectionTitleValue = `Current Product (v${processCtx.currentMajorVersion}.${processCtx.currentMinorVersion})`;
  } else if (!productToDisplay && processCtx.loadedFiles.length > 0) {
      productSectionTitleValue = "Awaiting Initial Synthesis";
  } else if (!productToDisplay) {
      productSectionTitleValue = "Output (No Product Yet)";
  }

  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex flex-wrap justify-between items-center mb-2">
        <div className="flex items-center">
            <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300">{productSectionTitleValue}</h2>
            <button
                onClick={() => setIsCurrentProductDetailsExpanded(!isCurrentProductDetailsExpanded)}
                className="ml-2 px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10"
                aria-expanded={isCurrentProductDetailsExpanded}
            >
                {isCurrentProductDetailsExpanded ? 'Hide Details' : 'Show Details'}
            </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!productToDisplay || copyStatus !== 'idle'}
            className="px-3 py-1 text-xs rounded-md border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
            aria-label="Copy product to clipboard"
          >
            {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onSaveFinalProduct}
            disabled={!processCtx.finalProduct && !processCtx.currentProduct}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
            aria-label="Save final product"
          >
            Save Product
          </button>
        </div>
      </div>

      {isCurrentProductDetailsExpanded && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 space-y-1">
          <p>
            Project: <span className="font-semibold text-slate-600 dark:text-slate-300">{appCtx.projectName || 'Untitled Project'}</span>
            <span className="text-slate-400 dark:text-slate-500 italic"> (Codename: {processCtx.projectCodename || 'none'})</span>
          </p>
          <p>
            Character Count: <span className="font-semibold text-slate-600 dark:text-slate-300">{productToDisplay.length.toLocaleString()}</span> | Word Count: <span className="font-semibold text-slate-600 dark:text-slate-300">{productToDisplay.split(/\s+/).filter(Boolean).length.toLocaleString()}</span>
          </p>
          {!processCtx.isProcessing && (
            <p className="italic text-sky-600 dark:text-sky-400">
              You can select a portion of the text below to open the Targeted Refinement modal.
            </p>
          )}
        </div>
      )}
      
      <div 
        className="w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg p-4 border border-slate-200 dark:border-white/10 min-h-[200px] max-h-[70vh] overflow-y-auto"
      >
        <pre 
            ref={productDisplayRef} 
            className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 font-sans text-base leading-relaxed"
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
            aria-live="polite"
        >
          {productToDisplay || <span className="text-slate-400 dark:text-slate-500 italic">No product generated yet...</span>}
          {processCtx.isProcessing && processCtx.streamBuffer && (
             <span className="text-slate-500 dark:text-slate-400 animate-pulse">{processCtx.streamBuffer}</span>
          )}
        </pre>
      </div>
    </div>
  );
};

export default ProductOutputDisplay;
