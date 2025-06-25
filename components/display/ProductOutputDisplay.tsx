
import React, { useRef, useEffect, useState, useContext } from 'react';
import { useProcessContext } from '../../contexts/ProcessContext';

export interface ProductOutputDisplayProps {
  onSaveFinalProduct: () => void;
}


const ProductOutputDisplay: React.FC<ProductOutputDisplayProps> = ({
  onSaveFinalProduct,
}) => {
  const processCtx = useProcessContext();
  const productDisplayRef = useRef<HTMLPreElement>(null);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const [isCurrentProductDetailsExpanded, setIsCurrentProductDetailsExpanded] = useState(true);
  const [currentTextSelection, setCurrentTextSelection] = useState<string | null>(null);

  useEffect(() => {
    if (processCtx.isProcessing && !processCtx.isEditingCurrentProduct && productDisplayRef.current) {
      productDisplayRef.current.scrollTop = productDisplayRef.current.scrollHeight;
    }
  }, [processCtx.currentProduct, processCtx.isProcessing, processCtx.isEditingCurrentProduct]);

  // Auto-focus and select all text in textarea when edit mode is entered
  useEffect(() => {
    if (processCtx.isEditingCurrentProduct && editTextAreaRef.current) {
      editTextAreaRef.current.focus();
      editTextAreaRef.current.select();
    }
  }, [processCtx.isEditingCurrentProduct]);

  const handleTextSelection = () => {
    if (processCtx.isEditingCurrentProduct || processCtx.isProcessing || processCtx.finalProduct) {
      setCurrentTextSelection(null);
      return;
    }
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : null;
    if (selectedText && selectedText.length > 0) {
      setCurrentTextSelection(selectedText);
    } else {
      setCurrentTextSelection(null);
    }
  };
  
  useEffect(() => {
    if (processCtx.isTargetedRefinementModalOpen === false || processCtx.isProcessing || processCtx.finalProduct || processCtx.isEditingCurrentProduct) {
      setCurrentTextSelection(null);
    }
  }, [processCtx.isTargetedRefinementModalOpen, processCtx.isProcessing, processCtx.finalProduct, processCtx.isEditingCurrentProduct]);


  const showProductSection = processCtx.currentProduct || processCtx.finalProduct || processCtx.isEditingCurrentProduct;
  
  let productSectionTitleValue = "Current Output";
  if (processCtx.finalProduct) {
    productSectionTitleValue = "Final Product";
  } else if (processCtx.isEditingCurrentProduct) {
    productSectionTitleValue = "Editing Current Output...";
  } else if (processCtx.isProcessing) {
    productSectionTitleValue = "Current Output (Processing...)";
  }


  const handleRefineSelectionClick = () => {
    if (currentTextSelection && !processCtx.isProcessing && !processCtx.finalProduct && !processCtx.isEditingCurrentProduct) {
      processCtx.openTargetedRefinementModal(currentTextSelection);
    }
  };

  const handleToggleEditMode = () => {
    processCtx.toggleEditMode();
  };

  const handleSaveEdits = () => {
    processCtx.saveManualEdits();
  };


  if (!showProductSection) {
    return null;
  }

  const commonButtonClasses = "inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 transition-colors";
  const primaryButtonClasses = `${commonButtonClasses} border-primary-400 dark:border-primary-500/70 text-primary-700 dark:text-primary-200 bg-primary-100 dark:bg-primary-600/80 hover:bg-primary-200 dark:hover:bg-primary-700/80 focus:ring-primary-500`;
  const secondaryButtonClasses = `${commonButtonClasses} border-secondary-500 dark:border-secondary-600/70 text-secondary-700 dark:text-secondary-300 bg-secondary-100 dark:bg-secondary-700/30 hover:bg-secondary-200 dark:hover:bg-secondary-800/40 focus:ring-secondary-500`;
  const neutralButtonClasses = `${commonButtonClasses} border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 focus:ring-slate-500`;


  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300">
          {productSectionTitleValue}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit/Save/Cancel Buttons */}
          {!processCtx.isProcessing && processCtx.currentProduct && !processCtx.finalProduct && (
            processCtx.isEditingCurrentProduct ? (
              <>
                <button onClick={handleSaveEdits} className={primaryButtonClasses} aria-label="Save manual edits">
                  Save Manual Edits
                </button>
                <button onClick={() => processCtx.toggleEditMode(true)} className={neutralButtonClasses} aria-label="Cancel manual editing">
                  Cancel Edit
                </button>
              </>
            ) : (
              <button onClick={handleToggleEditMode} className={secondaryButtonClasses} aria-label="Edit current product">
                Edit Product
              </button>
            )
          )}

          {currentTextSelection && !processCtx.isProcessing && !processCtx.finalProduct && !processCtx.isEditingCurrentProduct && (
            <button
              onClick={handleRefineSelectionClick}
              className={`${secondaryButtonClasses} animate-pulse`}
              aria-label="Refine selected text"
              title="Refine the currently selected text from the output below."
            >
              Refine Selected Text
            </button>
          )}
          {processCtx.finalProduct && (
            <button onClick={onSaveFinalProduct} className={primaryButtonClasses} aria-label="Download final product as Markdown">
              Download Product (.md)
            </button>
          )}
          {!processCtx.finalProduct && processCtx.currentProduct && !processCtx.isProcessing && !processCtx.isEditingCurrentProduct && (
            <button
              onClick={() => setIsCurrentProductDetailsExpanded(!isCurrentProductDetailsExpanded)}
              className="px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-expanded={isCurrentProductDetailsExpanded}
              aria-controls="current-product-content"
            >
              {isCurrentProductDetailsExpanded ? "Collapse Output" : "Expand Output"}
            </button>
          )}
        </div>
      </div>

      {processCtx.isEditingCurrentProduct ? (
        <textarea
          ref={editTextAreaRef}
          value={processCtx.editedProductBuffer || ""}
          onChange={(e) => processCtx.updateProcessState({ editedProductBuffer: e.target.value })}
          className="w-full h-[400px] p-3 bg-white dark:bg-slate-900 border border-primary-500 dark:border-primary-400 rounded-md shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-700 dark:text-slate-100 text-sm resize-y"
          aria-label="Current product text for editing"
        />
      ) : (processCtx.finalProduct || (processCtx.currentProduct && (processCtx.isProcessing || isCurrentProductDetailsExpanded))) ? (
        <div
          id="current-product-content"
          className={`bg-slate-100/80 dark:bg-black/30 p-4 rounded-md border border-slate-300/50 dark:border-white/10 ${processCtx.isProcessing ? 'h-[400px] overflow-hidden' : 'max-h-[400px] overflow-y-auto'
            }`}
        >
          <pre
            ref={productDisplayRef}
            onMouseUp={handleTextSelection}
            onDoubleClick={handleTextSelection}
            className={`whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 text-sm ${processCtx.isProcessing ? 'h-full overflow-y-auto' : ''} select-text`}
            aria-multiline="true"
          >
            {processCtx.finalProduct || processCtx.currentProduct}
          </pre>
        </div>
      ) : processCtx.currentProduct && !processCtx.finalProduct && !processCtx.isProcessing && !isCurrentProductDetailsExpanded ? (
        <div className="bg-slate-100/80 dark:bg-black/30 p-4 rounded-md border border-slate-300/50 dark:border-white/10">
          <p className="text-slate-500 dark:text-slate-400 italic text-sm">
            Summary: {(processCtx.currentProduct.length > 150 ? processCtx.currentProduct.substring(0, 147) + "..." : processCtx.currentProduct).replace(/\n+/g, ' ').trim()}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">(Expand to view full current output)</p>
        </div>
      ) : null}
    </div>
  );
};

export default ProductOutputDisplay;
