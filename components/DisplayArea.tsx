
import React, { useState } from 'react';
import type { IterationLogEntry, ProcessingMode, ModelConfig, StaticAiModelDetails, DisplayAreaExternalProps } from '../types';
import * as Diff from 'diff';
import InfoIcon from './InfoIcon';
import ChevronDownIcon from './ChevronDownIcon';
import ChevronUpIcon from './ChevronUpIcon';

interface DisplayAreaProps extends DisplayAreaExternalProps {
  statusMessage: string;
  currentProduct: string | null;
  finalProduct: string | null;
  iterationHistory: IterationLogEntry[];
  currentIteration: number;
  maxIterations: number;
  isProcessing: boolean;
  promptSourceName: string | null; 
  processingMode: ProcessingMode;
  onRewind: (iterationNumber: number) => void;
  // overallEvolutionSummary: string | null; // New prop - Commented out
}

const DownloadIcon: React.FC<{className?: string}> = ({className}) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5 mr-1"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const JsonIcon: React.FC<{className?: string}> = ({className}) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5 mr-1"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V5.75A2.25 2.25 0 0018 3.5H6A2.25 2.25 0 003.75 5.75v12.5A2.25 2.25 0 006 20.25z" />
  </svg>
);

const RewindIcon: React.FC<{className?: string}> = ({className = "w-4 h-4 mr-1"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
);


const DisplayArea: React.FC<DisplayAreaProps> = ({
  statusMessage,
  currentProduct,
  finalProduct,
  iterationHistory,
  currentIteration,
  maxIterations,
  isProcessing,
  promptSourceName,
  processingMode,
  onRewind,
  initialPromptForYAML,
  configAtFinalizationForYAML,
  staticAiModelDetailsForYAML,
  // overallEvolutionSummary, // Commented out
}) => {
  const [expandedLogItem, setExpandedLogItem] = useState<number | null>(null);
  const [showConvergenceInfo, setShowConvergenceInfo] = useState(false);
  const [isCurrentProductDetailsExpanded, setIsCurrentProductDetailsExpanded] = useState(false);
  // const [isOverallSummaryExpanded, setIsOverallSummaryExpanded] = useState(true); // Commented out


  const toggleLogItem = (iteration: number) => {
    setExpandedLogItem(expandedLogItem === iteration ? null : iteration);
  };
  
  const getProductSummary = (product: string | undefined | null, length: number = 100): string => {
    if (!product) return "N/A";
    return product.length > length ? product.substring(0, length - 3) + "..." : product;
  };

  const generateFileName = (baseName: string | null, suffix: string, mode: ProcessingMode, extension: string): string => {
    let namePart = "ai_generated";
    const extRegex = /\.(txt|md|json|csv|xml|html|js|py|java|c|cpp|h|hpp|cs|rb|php|swift|kt|go|rs|ts|css|scss|less|sh|bat)$/i;

    if (baseName) {
      namePart = baseName.replace(extRegex, '');
    } else if (promptSourceName) {
       namePart = promptSourceName.replace(extRegex, '');
    } else {
      namePart = "typed_prompt";
    }
    
    namePart = namePart.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

    return `${namePart}_${suffix}_${mode}_${timestamp}.${extension}`;
  }

  const handleSaveProduct = () => {
    if (!finalProduct || !staticAiModelDetailsForYAML || !configAtFinalizationForYAML) return;

    const generationTimestamp = new Date().toISOString();
    const initialPromptSummary = getProductSummary(initialPromptForYAML, 150);

    let contentWarning = "";
    if (!finalProduct.trim() || finalProduct.trim().length < 10) { 
        contentWarning = `\nWARNING_NOTE: The main product content below appears to be empty or very short. This might indicate an issue during generation or incomplete output from the AI.\n`;
    }

    let yamlFrontmatter = `---
generation_timestamp: ${generationTimestamp}
processing_mode: ${processingMode}
initial_prompt_summary: "${initialPromptSummary.replace(/"/g, '\\"')}"
final_iteration_count: ${currentIteration}
max_iterations_setting: ${maxIterations}
model_configuration:
  model_name: '${staticAiModelDetailsForYAML.modelName}'
  temperature: ${configAtFinalizationForYAML.temperature.toFixed(2)}
  top_p: ${configAtFinalizationForYAML.topP.toFixed(2)}
  top_k: ${configAtFinalizationForYAML.topK}
prompt_source_name: ${promptSourceName || 'typed_prompt'}
---
${contentWarning}
`;
    
    let markdownContent = yamlFrontmatter + finalProduct;

    /* // Commented out overall summary inclusion
    if (overallEvolutionSummary) {
        markdownContent += `\n\n## Process Evolution Summary\n\n${overallEvolutionSummary}`;
    }
    */
    
    const fileName = generateFileName(promptSourceName, "product", processingMode, "md");
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveLog = () => {
    if (iterationHistory.length === 0) return;
    const fileName = generateFileName(promptSourceName, "log", processingMode, "json");
    const logContent = JSON.stringify(iterationHistory, null, 2); 
    const blob = new Blob([logContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderDiff = (oldStr: string, newStr: string): { component: JSX.Element[], summary: {added: number, removed: number} } => {
    const changes = Diff.diffLines(oldStr, newStr, { newlineIsToken: false, ignoreWhitespace: false });
    let linesAdded = 0;
    let linesRemoved = 0;

    const component = changes.map((part, index) => {
      const partLines = part.count || 0;
      if (part.added) linesAdded += partLines;
      if (part.removed) linesRemoved += partLines;

      const partClasses = part.added 
        ? 'bg-green-800 bg-opacity-30 text-green-300' 
        : part.removed 
        ? 'bg-red-800 bg-opacity-30 text-red-300' 
        : 'text-slate-300';
      
      const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
      
      const lines = part.value.length > 0 ? part.value.split('\n') : ['']; 
      if (part.value.endsWith('\n') && lines[lines.length-1] === '') {
      } else if (lines[lines.length-1] === '' && lines.length > 1) { 
        lines.pop(); 
      }

      return (
        <span key={index} className={`${partClasses} block`}>
          {lines.map((line, lineIndex) => (
            <span key={lineIndex} className="block" style={{ textIndent: '-1.5em', paddingLeft: '1.5em' }}>
              {prefix}{line}
            </span>
          ))}
        </span>
      );
    });
    return { component, summary: { added: linesAdded, removed: linesRemoved } };
  };

  const showProductSection = currentProduct || finalProduct;
  const showLogSection = iterationHistory.length > 0;
  // const showOverallSummarySection = !!overallEvolutionSummary; // Commented out
  const convergenceTooltipText = `The AI signals convergence by prefixing its output with "CONVERGED:".
- In Expansive Mode, this is an exception, indicating the AI believes no further meaningful expansion is possible. The process usually runs until max iterations.
- In Convergent Mode, this is the primary goal, indicating the AI has distilled the input to its core essence.`;


  return (
    <div className="space-y-8">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
        <div className="flex items-center mb-3 relative">
          <h2 className="text-xl font-semibold text-sky-300 mr-2">Process Status</h2>
          <div 
            className="relative"
            onMouseEnter={() => setShowConvergenceInfo(true)}
            onMouseLeave={() => setShowConvergenceInfo(false)}
            onFocus={() => setShowConvergenceInfo(true)}
            onBlur={() => setShowConvergenceInfo(false)}
            tabIndex={0}
            aria-describedby="convergence-tooltip"
          >
            <InfoIcon className="w-5 h-5 text-sky-400 cursor-pointer" />
            {showConvergenceInfo && (
              <div
                id="convergence-tooltip"
                role="tooltip" 
                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 bg-slate-700 text-slate-200 text-xs p-3 rounded-md shadow-lg z-10 border border-slate-600"
              >
                {convergenceTooltipText.split('\n').map((line, i) => <p key={i} className={line.startsWith('-') ? 'ml-2' : ''}>{line}</p>)}
              </div>
            )}
          </div>
        </div>
        <p className="text-slate-300 min-h-[2em] break-words">{statusMessage}</p>
        {isProcessing && (
          <div className="w-full bg-slate-700 rounded-full h-2.5 mt-3">
            <div
              className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, (currentIteration / maxIterations) * 100)}%` }}
              aria-valuenow={currentIteration}
              aria-valuemin={0}
              aria-valuemax={maxIterations}
              role="progressbar"
              aria-label="Process progress"
            ></div>
          </div>
        )}
         {isProcessing && <p className="text-sm text-slate-400 mt-1 text-right" aria-live="polite">Iteration {currentIteration} / {maxIterations}</p>}
      </div>
      
      {/* Product and Current Output Section */}
      {showProductSection && (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <h2 className="text-xl font-semibold text-sky-300">
              {finalProduct ? "Final Product" : (isProcessing ? "Current Output (In Progress)" : "Last Output")}
            </h2>
            <div className="flex items-center gap-2">
              {finalProduct && (
                  <button
                    onClick={handleSaveProduct}
                    className="inline-flex items-center px-3 py-1.5 border border-sky-500 text-xs font-medium rounded-md shadow-sm text-sky-300 bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 transition-colors"
                    aria-label="Download final product as Markdown"
                  >
                    <DownloadIcon />
                    Download Product (.md)
                  </button>
                )}
              {!finalProduct && currentProduct && (
                <button
                  onClick={() => setIsCurrentProductDetailsExpanded(!isCurrentProductDetailsExpanded)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-expanded={isCurrentProductDetailsExpanded}
                  aria-controls="current-product-content"
                >
                  {isCurrentProductDetailsExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                  <span className="sr-only">{isCurrentProductDetailsExpanded ? "Collapse current output" : "Expand current output"}</span>
                </button>
              )}
            </div>
          </div>
          
          {finalProduct ? (
            <div className="bg-slate-900 p-4 rounded-md max-h-[400px] overflow-y-auto border border-slate-700">
              <pre className="whitespace-pre-wrap break-words text-slate-200 text-sm">
                {finalProduct}
              </pre>
            </div>
          ) : currentProduct && isCurrentProductDetailsExpanded ? (
            <div id="current-product-content" className="bg-slate-900 p-4 rounded-md max-h-[400px] overflow-y-auto border border-slate-700">
              <pre className="whitespace-pre-wrap break-words text-slate-200 text-sm">
                {currentProduct}
              </pre>
            </div>
          ) : currentProduct && !finalProduct && !isCurrentProductDetailsExpanded ? (
              <div className="bg-slate-900 p-4 rounded-md border border-slate-700">
              <p className="text-slate-400 italic text-sm">
                Summary: {getProductSummary(currentProduct, 150)}
              </p>
                <p className="text-slate-400 text-xs mt-1">(Expand to view full current output)</p>
            </div>
          ): null}
        </div>
      )}

      {/* Overall Evolution Summary Section - Commented Out
      {showOverallSummarySection && (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-sky-300">Overall Evolution Summary</h2>
            <button
              onClick={() => setIsOverallSummaryExpanded(!isOverallSummaryExpanded)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-expanded={isOverallSummaryExpanded}
              aria-controls="overall-summary-content"
            >
              {isOverallSummaryExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
              <span className="sr-only">{isOverallSummaryExpanded ? "Collapse overall summary" : "Expand overall summary"}</span>
            </button>
          </div>
          {isOverallSummaryExpanded && (
            <div id="overall-summary-content" className="bg-slate-900 p-4 rounded-md max-h-[400px] overflow-y-auto border border-slate-700">
              <pre className="whitespace-pre-wrap break-words text-slate-200 text-sm">
                {overallEvolutionSummary}
              </pre>
            </div>
          )}
        </div>
      )}
      */}

      {/* Iteration Log Section */}
      {showLogSection && (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <h2 className="text-xl font-semibold text-sky-300">Iteration Log</h2>
            <button
              onClick={handleSaveLog}
              className="inline-flex items-center px-3 py-1.5 border border-slate-500 text-xs font-medium rounded-md shadow-sm text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 transition-colors"
              aria-label="Download iteration log"
              disabled={iterationHistory.length === 0}
            >
              <JsonIcon />
              Download Log
            </button>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {iterationHistory.slice().reverse().map((log) => {
              const previousLog = log.iteration > 0 
                ? iterationHistory.find(entry => entry.iteration === log.iteration - 1) 
                : undefined;
              const oldText = previousLog?.fullProduct ?? (log.iteration === 0 && log.fullProduct ? "" : "Error: Previous log not found or initial state product missing");
              const currentText = log.fullProduct ?? "";
              const diffResult = renderDiff(oldText, currentText);

              return (
                <div key={log.iteration} className="bg-slate-700 p-4 rounded-md shadow">
                  <div className="flex justify-between items-start">
                    <button 
                        onClick={() => toggleLogItem(log.iteration)} 
                        className="flex-grow flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-sky-500 rounded mr-2"
                        aria-expanded={expandedLogItem === log.iteration}
                        aria-controls={`log-details-${log.iteration}`}
                    >
                      <div>
                        <p className="font-medium text-sky-400">
                          Iteration {log.iteration === 0 ? "Initial State" : log.iteration}
                          <span className="ml-2 text-xs text-slate-400">({log.timestamp})</span>
                        </p>
                        <p className="text-sm text-slate-300 break-words">{log.status}</p>
                        {expandedLogItem !== log.iteration && <p className="text-xs text-slate-400 mt-1 italic">Summary: {getProductSummary(log.fullProduct)}</p>}
                      </div>
                      <svg 
                          className={`w-5 h-5 text-slate-400 transform transition-transform duration-200 ${expandedLogItem === log.iteration ? 'rotate-180' : ''}`} 
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {log.iteration > 0 && log.fullProduct && ( 
                          <button
                            onClick={() => onRewind(log.iteration)}
                            disabled={isProcessing}
                            className="ml-2 mt-1 flex-shrink-0 inline-flex items-center px-2.5 py-1 border border-slate-600 text-xs font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={`Use Iteration ${log.iteration} as new starting point`}
                            aria-label={`Use Iteration ${log.iteration} as new starting point`}
                          >
                            <RewindIcon />
                            Use as New Start
                          </button>
                    )}
                  </div>
                  {expandedLogItem === log.iteration && (
                    <div 
                      id={`log-details-${log.iteration}`}
                      className="mt-3 pt-3 border-t border-slate-600"
                    >
                      <div className="mb-2">
                        <h4 className="text-sm font-semibold text-sky-300 mb-1">
                          {log.iteration === 0 ? "Initial Content:" : "Changes from Previous Iteration:"}
                        </h4>
                        {log.iteration > 0 && (diffResult.summary.added > 0 || diffResult.summary.removed > 0) && (
                            <p className="text-xs text-slate-400">
                                (<span className="text-green-400">+{diffResult.summary.added} lines</span>, <span className="text-red-400">-{diffResult.summary.removed} lines</span>)
                            </p>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-xs text-slate-200 bg-slate-900 p-2 rounded max-h-96 overflow-y-auto">
                        {diffResult.component}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisplayArea;