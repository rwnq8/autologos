
import React, { useState } from 'react';
import type { CommonControlProps } from '../../types/index.ts';
import { useEngine } from '../../contexts/ApplicationContext.tsx';

const OutputStructureDefaults: React.FC<CommonControlProps> = ({
  commonInputClasses,
  commonCheckboxLabelClasses,
  commonCheckboxInputClasses,
}) => {
  const { process: processCtx } = useEngine();
  const [showParagraphFormattingOptions, setShowParagraphFormattingOptions] = useState(false);

  return (
    <div className="pt-4 border-t border-slate-300/70 dark:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold text-primary-600 dark:text-primary-300">
          Output Structure Defaults
        </h3>
        <button
          onClick={() => setShowParagraphFormattingOptions(!showParagraphFormattingOptions)}
          className="px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-expanded={showParagraphFormattingOptions}
          aria-controls="paragraph-formatting-details"
          disabled={processCtx.isProcessing}
        >
          {showParagraphFormattingOptions ? "Collapse" : "Expand"}
        </button>
      </div>
      {showParagraphFormattingOptions && (
        <div id="paragraph-formatting-details" className="mt-1 p-3 bg-slate-100/60 dark:bg-black/20 rounded-md border border-slate-200 dark:border-white/10 space-y-3 animate-fadeIn">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            These settings define default paragraph formatting for Plan stages.
          </p>
          <label className={commonCheckboxLabelClasses}>
            <input id="output-show-headings" type="checkbox" checked={processCtx.outputParagraphShowHeadings} onChange={(e) => processCtx.updateProcessState({ outputParagraphShowHeadings: e.target.checked })} disabled={processCtx.isProcessing} className={(commonCheckboxInputClasses ?? '') + " mr-2"} />
            Include Headings (Default)
          </label>
          {processCtx.outputParagraphShowHeadings && (
            <>
              <label className={commonCheckboxLabelClasses + " ml-4"}>
                <input id="output-numbered-headings" type="checkbox" checked={processCtx.outputParagraphNumberedHeadings} onChange={(e) => processCtx.updateProcessState({ outputParagraphNumberedHeadings: e.target.checked })} disabled={processCtx.isProcessing} className={(commonCheckboxInputClasses ?? '') + " mr-2"} />
                Numbered Headings (Default, APA Style)
              </label>
              <div>
                <label htmlFor="outputParagraphMaxHeadingDepth" className="block text-xs font-medium text-primary-600 dark:text-primary-400 mb-1 ml-4">Max Heading Depth (Default, 1-6)</label>
                <input type="number" id="outputParagraphMaxHeadingDepth" value={processCtx.outputParagraphMaxHeadingDepth} onChange={(e) => processCtx.updateProcessState({ outputParagraphMaxHeadingDepth: Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)) })} min="1" max="6" disabled={processCtx.isProcessing} className={commonInputClasses + " text-xs py-1.5 px-2 w-20 ml-4"} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OutputStructureDefaults;
