
import React, { useRef, useEffect, useState } from 'react';
import { useEngine } from '../../contexts/ApplicationContext.tsx';
import { formatVersion } from '../../services/versionUtils.ts';


export interface ProductOutputDisplayProps {
  onSaveFinalProduct: () => void;
}


const ProductOutputDisplay: React.FC<ProductOutputDisplayProps> = ({
  onSaveFinalProduct,
}) => {
  const { process: processCtx } = useEngine();
  const productDisplayRef = useRef<HTMLPreElement>(null);
  const [isCurrentProductDetailsExpanded, setIsCurrentProductDetailsExpanded] = useState(true);

  useEffect(() => {
    if (processCtx.isProcessing && productDisplayRef.current) {
      productDisplayRef.current.scrollTop = productDisplayRef.current.scrollHeight;
    }
  }, [processCtx.currentProduct, processCtx.isProcessing]);

  let productSectionTitleValue = "Current Output";
  if (processCtx.finalProduct) {
    productSectionTitleValue = `Final Product (v${processCtx.currentMajorVersion}.${processCtx.currentMinorVersion})`;
  } else if (processCtx.currentMajorVersion === 0 && processCtx.iterationHistory.some(e => e.entryType === 'ensemble_integration')) {
    productSectionTitleValue = `Ensemble-Synthesized Base Product (v0.0)`;
  } else if (processCtx.isProcessing) {
    productSectionTitleValue = "Current Output (Processing...)";
  } else if (processCtx.currentProduct) {
    productSectionTitleValue = `Current Product (v${processCtx.currentMajorVersion}.${processCtx.currentMinorVersion})`;
  }

  const commonButtonClasses = "inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 transition-colors";
  const primaryButtonClasses = `${commonButtonClasses} border-primary-400 dark:border-primary-500/70 text-primary-700 dark:text-primary-200 bg-primary-100 dark:bg-primary-600/80 hover:bg-primary-200 dark:hover:bg-primary-700/80 focus:ring-primary-500`;
  const showDownloadButton = processCtx.finalProduct || (processCtx.currentProduct && processCtx.currentMajorVersion === 0 && processCtx.iterationHistory.some(e => e.entryType === 'ensemble_integration'));

  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300">
          {productSectionTitleValue}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {showDownloadButton && !processCtx.isProcessing && (
            <button onClick={onSaveFinalProduct} className={primaryButtonClasses} aria-label="Download product as Markdown">
              Download Product (.md)
            </button>
          )}
          {processCtx.currentProduct && !processCtx.finalProduct && !processCtx.isProcessing && (
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

      {(processCtx.finalProduct || (processCtx.currentProduct && (processCtx.isProcessing || isCurrentProductDetailsExpanded))) ? (
        <div
          id="current-product-content"
          className={`bg-slate-100/80 dark:bg-black/30 p-4 rounded-md border border-slate-300/50 dark:border-white/10 ${processCtx.isProcessing ? 'h-[400px] overflow-hidden' : 'max-h-[400px] overflow-y-auto'}`}
        >
          <pre
            ref={productDisplayRef}
            className={`whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 text-sm ${processCtx.isProcessing ? 'h-full overflow-y-auto' : ''} select-text`}
            aria-multiline="true"
            onMouseUp={(e) => {
              const selection = window.getSelection()?.toString();
              if (selection && selection.length > 10) {
                  processCtx.updateProcessState({ isTargetedRefinementModalOpen: true, currentTextSelectionForRefinement: selection });
              }
            }}
          >
            {processCtx.finalProduct || processCtx.currentProduct}
          </pre>
        </div>
      ) : (
        <div className="bg-slate-100/80 dark:bg-black/30 p-4 rounded-md border-2 border-dashed border-slate-300 dark:border-slate-600">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">No product to display. Load input and start a process.</p>
        </div>
      )}
    </div>
  );
};

export default ProductOutputDisplay;
