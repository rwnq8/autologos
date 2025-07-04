import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import { formatVersion } from '../../services/versionUtils.ts';
import { reconstructFromChunks } from '../../services/chunkingService.ts';
import type { OutlineNode } from '../../types/index.ts';
import { OutlineNodeDisplay } from './OutlineNodeDisplay.tsx';


export interface ProductOutputDisplayProps {
  onSaveFinalProduct: () => void;
}

const convertOutlineToMarkdown = (nodes: OutlineNode[], level = 0): string => {
    let markdown = "";
    const prefix = "#".repeat(level + 1);
    nodes.forEach(node => {
        markdown += `${prefix} ${node.content}\n\n`;
        if (node.children && node.children.length > 0) {
            markdown += convertOutlineToMarkdown(node.children, level + 1);
        }
    });
    return markdown;
};


const ProductOutputDisplay: React.FC<ProductOutputDisplayProps> = ({
  onSaveFinalProduct,
}) => {
  const { process: processCtx, app: appCtx } = useEngine();
  const productDisplayRef = useRef<HTMLPreElement>(null);
  const [isCurrentProductDetailsExpanded, setIsCurrentProductDetailsExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  const { productToDisplay, characterCount, wordCount } = useMemo(() => {
      if (processCtx.isOutlineMode) {
          const outline = processCtx.currentOutline || processCtx.finalOutline;
          const text = outline ? JSON.stringify(outline, null, 2) : "";
          return {
              productToDisplay: outline,
              characterCount: text.length,
              wordCount: text.split(/\s+/).filter(Boolean).length
          };
      } else {
          const text = processCtx.isEditingCurrentProduct
              ? (processCtx.editedProductBuffer || "")
              : (processCtx.documentChunks && processCtx.documentChunks.length > 0)
                  ? reconstructFromChunks(processCtx.documentChunks)
                  : (processCtx.finalProduct || processCtx.currentProduct || "");
          return {
              productToDisplay: text,
              characterCount: text.length,
              wordCount: text.split(/\s+/).filter(Boolean).length
          };
      }
  }, [processCtx.isOutlineMode, processCtx.currentOutline, processCtx.finalOutline, processCtx.isEditingCurrentProduct, processCtx.editedProductBuffer, processCtx.documentChunks, processCtx.finalProduct, processCtx.currentProduct]);

  const handleCopy = () => {
    if (copyStatus !== 'idle' || !productToDisplay) return;

    let textToCopy: string;
    if (processCtx.isOutlineMode && Array.isArray(productToDisplay)) {
        textToCopy = convertOutlineToMarkdown(productToDisplay);
    } else if (typeof productToDisplay === 'string') {
        textToCopy = productToDisplay;
    } else {
        return;
    }

    setCopyStatus('copying');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
      console.error("Failed to copy product:", err);
      setCopyStatus('idle'); // Reset on error
    });
  };
  
  const handleTextSelection = () => {
    if (processCtx.isOutlineMode || processCtx.isEditingCurrentProduct) return; // Disable for outlines and while editing
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && !processCtx.isProcessing) {
      processCtx.updateProcessState({ 
        currentTextSelectionForRefinement: selectedText,
        isTargetedRefinementModalOpen: true,
      });
    }
  };
  
  const handleEditClick = () => {
    const currentProductText = reconstructFromChunks(processCtx.documentChunks) || processCtx.currentProduct || "";
    processCtx.updateProcessState({
        isEditingCurrentProduct: true,
        editedProductBuffer: currentProductText,
    });
  };
  
  const handleCancelEditClick = () => {
    processCtx.updateProcessState({
        isEditingCurrentProduct: false,
        editedProductBuffer: null,
    });
  };

  const handleSaveEditClick = () => {
    processCtx.saveManualEdits();
  };

  let productSectionTitleValue = "Current Output";
  if (processCtx.finalProduct || processCtx.finalOutline) {
    productSectionTitleValue = `Final Product (v${processCtx.currentMajorVersion}.${processCtx.currentMinorVersion})`;
  } else if (processCtx.currentMajorVersion > 0 || processCtx.currentMinorVersion > 0) {
    productSectionTitleValue = `Current Product (v${processCtx.currentMajorVersion}.${processCtx.currentMinorVersion})`;
  } else if (!productToDisplay && processCtx.loadedFiles.length > 0) {
      productSectionTitleValue = "Awaiting Initial Synthesis";
  } else if (!productToDisplay) {
      productSectionTitleValue = "Output (No Product Yet)";
  }

  const commonButtonClasses = "px-3 py-1 text-xs rounded-md border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50";

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
            {!processCtx.isEditingCurrentProduct ? (
                 <button onClick={handleEditClick} disabled={!productToDisplay || processCtx.isProcessing || processCtx.isOutlineMode} className={commonButtonClasses}>Edit</button>
            ) : (
                <>
                 <button onClick={handleCancelEditClick} className={`${commonButtonClasses} bg-slate-200 dark:bg-slate-600`}>Cancel</button>
                 <button onClick={handleSaveEditClick} className={`${commonButtonClasses} bg-green-500 text-white hover:bg-green-600`}>Save Edit</button>
                </>
            )}
            <button onClick={handleCopy} disabled={!productToDisplay || copyStatus !== 'idle'} className={commonButtonClasses}>
                {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={onSaveFinalProduct} disabled={!(processCtx.finalProduct || processCtx.currentProduct || processCtx.finalOutline || processCtx.currentOutline)} className="px-3 py-1 text-xs font-semibold rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
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
            Character Count: <span className="font-semibold text-slate-600 dark:text-slate-300">{characterCount.toLocaleString()}</span> | Word Count: <span className="font-semibold text-slate-600 dark:text-slate-300">{wordCount.toLocaleString()}</span>
          </p>
          {!processCtx.isProcessing && !processCtx.isEditingCurrentProduct && !processCtx.isOutlineMode && (
            <p className="italic text-sky-600 dark:text-sky-400">
              You can select a portion of the text below to open the Targeted Refinement modal.
            </p>
          )}
        </div>
      )}
      
      <div className="w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg p-4 border border-slate-200 dark:border-white/10 min-h-[200px] max-h-[70vh] overflow-y-auto">
        {processCtx.isOutlineMode ? (
            Array.isArray(productToDisplay) && productToDisplay.length > 0 ? (
                <ul className="space-y-1">
                    {productToDisplay.map(node => <OutlineNodeDisplay key={node.id} node={node} />)}
                </ul>
            ) : (
                <span className="text-slate-400 dark:text-slate-500 italic">No outline generated yet...</span>
            )
        ) : processCtx.isEditingCurrentProduct ? (
            <textarea
                value={processCtx.editedProductBuffer || ''}
                onChange={(e) => processCtx.updateProcessState({ editedProductBuffer: e.target.value })}
                className="w-full h-full min-h-[40vh] bg-transparent border-0 p-0 text-slate-700 dark:text-slate-200 font-sans text-base leading-relaxed focus:ring-0"
                aria-label="Product editing area"
            />
        ) : (
            <pre 
                ref={productDisplayRef} 
                className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 font-sans text-base leading-relaxed"
                onMouseUp={handleTextSelection}
                onTouchEnd={handleTextSelection}
                aria-live="polite"
            >
              {typeof productToDisplay === 'string' && productToDisplay || <span className="text-slate-400 dark:text-slate-500 italic">No product generated yet...</span>}
              {processCtx.isProcessing && processCtx.streamBuffer && (
                 <span className="text-slate-500 dark:text-slate-400 animate-pulse">{processCtx.streamBuffer}</span>
              )}
            </pre>
        )}
      </div>
    </div>
  );
};

export default ProductOutputDisplay;
