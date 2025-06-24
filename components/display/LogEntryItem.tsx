
import React, { useState, useContext } from 'react';
import type { IterationLogEntry, ReconstructedProductResult, ModelConfig, AiResponseValidationInfo, ReductionDetailValue, PromptLeakageDetailValue, SelectableModelName } from '../../types';
import * as GeminaiDiff from 'diff';
import { useProcessContext } from '../../contexts/ProcessContext';
import { countWords } from '../../services/textAnalysisService';
import { SELECTABLE_MODELS } from '../../types';
import { formatLogEntryDiagnostics } from '../../services/diagnosticsFormatter'; // Import the new formatter


interface LogEntryItemProps {
  logEntry: IterationLogEntry;
  isExpanded: boolean;
  onToggleExpand: (iteration: number) => void;
  onRewind: (iterationNumber: number) => void;
  onExportIterationMarkdown: (iterationNumber: number) => void;
  reconstructProductCallback: (targetIteration: number, history: IterationLogEntry[]) => ReconstructedProductResult; // baseInitialPrompt is now handled by ProcessContext
  iterationHistory: IterationLogEntry[]; // Keep this for local diff reconstruction logic
  copyStatusForThisItem: string | undefined;
  isProcessing: boolean;
}

const LogEntryItem: React.FC<LogEntryItemProps> = ({
  logEntry,
  isExpanded,
  onToggleExpand,
  onRewind,
  onExportIterationMarkdown,
  reconstructProductCallback, // Used for local diff display
  iterationHistory, // Used for local diff display
  copyStatusForThisItem,
  isProcessing,
}) => {
  const { initialPrompt: baseInitialPrompt } = useProcessContext(); // Get baseInitialPrompt from context
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<{ [key: string]: boolean }>({});

  const toggleDiagnosticSection = (key: string) => {
    setExpandedDiagnostics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopySingleDiagnostic = async () => {
    setLocalCopyStatus("Copying...");
    try {
      // Pass the full history and baseInitialPrompt for context if the formatter needs it
      // for things like reconstructing products for diffs within the diagnostic string.
      const diagString = formatLogEntryDiagnostics(logEntry, iterationHistory, baseInitialPrompt);
      await navigator.clipboard.writeText(diagString);
      setLocalCopyStatus("Copied!");
    } catch (err) {
      console.error('Failed to copy diagnostics for iter ' + logEntry.iteration + ':', err);
      setLocalCopyStatus("Copy Failed");
    }
    setTimeout(() => setLocalCopyStatus(undefined), 2000);
  };


  const getProductSummaryForDisplay = (entry: IterationLogEntry): string => {
    return entry.productSummary || "Summary N/A";
  };

  const getReadabilityInterpretation = (score: number | undefined): string => {
    if (score === undefined) return "";
    if (score >= 90) return " (Very Easy)";
    if (score >= 80) return " (Easy)";
    if (score >= 70) return " (Fairly Easy)";
    if (score >= 60) return " (Standard / Plain English)";
    if (score >= 50) return " (Fairly Difficult)";
    if (score >= 30) return " (Difficult)";
    return " (Very Confusing)";
  };

  const renderWordDiffDisplay = (oldStr: string, newStr: string): JSX.Element[] => {
    const changes = GeminaiDiff.diffWordsWithSpace(oldStr, newStr);
    return changes.map((part, index) => {
      const partClasses = part.added ? 'bg-green-100 dark:bg-green-600/30 text-green-700 dark:text-green-200'
        : part.removed ? 'bg-red-100 dark:bg-red-600/30 text-red-700 dark:text-red-200 line-through'
        : 'text-slate-600 dark:text-slate-300';
      return (<span key={index} className={partClasses}>{part.value}</span>);
    });
  };

  let diffDisplayComponent: JSX.Element[] | null = null;
  let netWordChange: number | undefined = undefined;


  if (isExpanded) {
    try {
      let oldTextResult: ReconstructedProductResult;
      let newTextResult: ReconstructedProductResult;
      let overallReconstructionError: string | undefined;

      // reconstructProductCallback implicitly uses baseInitialPrompt from context now
      newTextResult = reconstructProductCallback(logEntry.iteration, iterationHistory);

      if (logEntry.iteration === 0) {
         oldTextResult = { product: "", error: undefined };
      } else {
        oldTextResult = reconstructProductCallback(logEntry.iteration - 1, iterationHistory);
      }

      if (newTextResult.error && oldTextResult.error && logEntry.iteration > 0) overallReconstructionError = `Error reconstructing Iter. ${logEntry.iteration}: ${newTextResult.error}\nError reconstructing Prev. Iter. (${logEntry.iteration - 1}): ${oldTextResult.error}`;
      else if (newTextResult.error) overallReconstructionError = `Error reconstructing Iteration ${logEntry.iteration}: ${newTextResult.error}`;
      else if (oldTextResult.error && logEntry.iteration > 0) overallReconstructionError = `Error reconstructing Previous Iteration (${logEntry.iteration - 1}): ${oldTextResult.error}`;


      if (overallReconstructionError) {
        diffDisplayComponent = [<span key="recon_error" className="text-red-500 dark:text-red-400 block whitespace-pre-wrap">{overallReconstructionError}</span>];
      } else if (logEntry.iteration > 0 && !logEntry.productDiff && !overallReconstructionError) {
        const productToShow = typeof newTextResult.product === 'string' ? newTextResult.product : "Content unavailable";
        diffDisplayComponent = [<span key="no_change" className="text-slate-600 dark:text-slate-300 block">No textual changes recorded from Iteration {logEntry.iteration - 1}.<br />Current Content:<br />{productToShow}</span>];
      } else if (!overallReconstructionError && typeof oldTextResult.product === 'string' && typeof newTextResult.product === 'string') {
        diffDisplayComponent = renderWordDiffDisplay(oldTextResult.product, newTextResult.product);

        const prevWords = countWords(oldTextResult.product);
        const currentWords = countWords(newTextResult.product);
        netWordChange = currentWords - prevWords;

      } else {
        diffDisplayComponent = [<span key="unknown_error" className="text-orange-500 dark:text-orange-400 block">Could not display diff due to an unknown reconstruction issue.</span>];
      }
    } catch (e: any) {
      console.error(`Error preparing diff display for iteration ${logEntry.iteration}:`, e);
      diffDisplayComponent = [<span key="diff_error" className="text-red-500 dark:text-red-400 block">Error displaying diff: {e.message}</span>];
    }
  }
  // Ensure copyStatus (local state for individual copy button) is properly scoped here
  const [localCopyStatus, setLocalCopyStatus] = useState<string | undefined>(undefined);


  const canRewind = logEntry.iteration >= 0 && !isProcessing;
  const iterZeroResultForExportCheck = logEntry.iteration === 0 ? reconstructProductCallback(0, iterationHistory) : null;
  const canExportIteration = (logEntry.iteration === 0 && iterZeroResultForExportCheck && !iterZeroResultForExportCheck.error && iterZeroResultForExportCheck.product.trim() !== "") || (logEntry.iteration > 0 && logEntry.productDiff && logEntry.productDiff.trim() !== "");

  const DIAG_PROMPT_MAX_DISPLAY_LENGTH = 2000;

  const truncateForDisplay = (text: string | undefined, maxLength: number = DIAG_PROMPT_MAX_DISPLAY_LENGTH): string => {
    if (!text) return "(Not available)";
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength / 2)}...\n[TRUNCATED - Full prompt in copied diagnostics or raw log - Total Length: ${text.length} chars]\n...${text.substring(text.length - maxLength / 2)}`;
  };

  const modelUsedDisplayName = logEntry.currentModelForIteration
    ? SELECTABLE_MODELS.find(m => m.name === logEntry.currentModelForIteration)?.displayName || logEntry.currentModelForIteration
    : "N/A";

  const renderStrategyRationale = (rationale: string | undefined) => {
    if (!rationale) return <p className="mt-1 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-black/40 p-1.5 rounded">No specific strategy rationale logged.</p>;

    const parts = rationale.split(' | ');
    const knownPrefixes: { prefix: string; className: string; label?: string }[] = [
        { prefix: "Strategist LLM Advice Received:", className: "text-purple-600 dark:text-purple-400 font-semibold", label: "Strategist LLM Advice:" },
        { prefix: "Strategist overrode heuristic model.", className: "text-amber-600 dark:text-amber-400 font-semibold", label: "Strategist Model Override:" },
        { prefix: "Strategist concurred with heuristic model choice:", className: "text-sky-500 dark:text-sky-300", label: "Strategist Model Concurrence:" },
        { prefix: "Strategist suggested model", className: "text-slate-500 dark:text-slate-400 italic", label: "Strategist Model Suggestion (Ignored/Logged):" },
        { prefix: "Strategist set Flash thinking budget to:", className: "text-teal-600 dark:text-teal-400 font-semibold", label: "Strategist Flash Config:" },
        { prefix: "Strategist adjusted core parameters:", className: "text-rose-600 dark:text-rose-400 font-semibold", label: "Strategist Core Param Adjust:" },
        { prefix: "Strategist parameter advice", className: "text-slate-500 dark:text-slate-400 italic", label: "Strategist Param Advice (Ignored/Logged):" },
        { prefix: "Strategist provided dynamic meta-instruction:", className: "text-fuchsia-600 dark:text-fuchsia-400 font-semibold", label: "Strategist Meta-Instruction:" },
        { prefix: "Strategist suggested meta-instruction", className: "text-slate-500 dark:text-slate-400 italic", label: "Strategist Meta-Instruction Suggestion (Ignored/Logged):" },
        { prefix: "Strategist LLM consultation skipped", className: "text-slate-500 dark:text-slate-500", label: "Strategist Skipped:" },
        { prefix: "Strategist consultation skipped", className: "text-slate-500 dark:text-slate-500", label: "Strategist Skipped:" },
        { prefix: "Heuristic Sweep:", className: "text-indigo-600 dark:text-indigo-400", label: "Heuristic Sweep:" },
        { prefix: "Heuristic Nudge (Code):", className: "text-purple-600 dark:text-purple-400", label: "Heuristic Nudge (Code):" },
        { prefix: "Heuristic Model Switch (Code):", className: "text-orange-600 dark:text-orange-400", label: "Heuristic Model Switch (Code):" },
        { prefix: "Heuristic Fallback:", className: "text-gray-500 dark:text-gray-400", label: "Heuristic Fallback:" },
        { prefix: "Heuristic Correction:", className: "text-yellow-600 dark:text-yellow-400", label: "Heuristic Correction:" },
        { prefix: "Heuristic:", className: "text-indigo-600 dark:text-indigo-400", label: "Heuristic:" },
        { prefix: "Parameter Clamp:", className: "text-red-500 dark:text-red-400 font-semibold", label: "System Param Clamp:" },
        { prefix: "Plan Mode:", className: "text-blue-600 dark:text-blue-400", label: "Mode:" },
    ];

    return (
        <ul className="list-none mt-1 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-black/40 p-1.5 rounded space-y-0.5 text-xs">
            {parts.map((part, index) => {
                let styledPart: React.ReactNode = part.trim();
                let matched = false;
                for (const item of knownPrefixes) {
                    if (part.trim().startsWith(item.prefix)) {
                        styledPart = <><strong className={item.className}>{item.label || item.prefix}</strong>{part.trim().substring(item.prefix.length)}</>;
                        matched = true;
                        break;
                    }
                }
                return <li key={index} className={`break-words ${matched ? "pl-1" : "pl-3"}`}>{styledPart}</li>;
            })}
        </ul>
    );
  };


  return (
    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-md shadow hover:bg-slate-100/80 dark:hover:bg-white/10 transition-colors duration-150">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <button
          onClick={() => onToggleExpand(logEntry.iteration)}
          className="flex-grow flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-primary-500 rounded mr-2"
          aria-expanded={isExpanded}
          aria-controls={`log-details-${logEntry.iteration}`}
        >
          <div>
            <p className="font-medium text-primary-600 dark:text-primary-400">
              Iteration {logEntry.iteration === 0 ? "Initial State" : logEntry.iteration}
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({new Date(logEntry.timestamp).toLocaleTimeString()})</span>
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 break-words">{logEntry.status}</p>
            {!isExpanded && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Summary: {getProductSummaryForDisplay(logEntry)}</p>}

            {(logEntry.iteration >= 0 && !isExpanded) && (
              <p className="text-xs mt-1">
                {(logEntry.linesAdded !== undefined || logEntry.linesRemoved !== undefined ) && (
                  <>
                    Changes: {logEntry.linesAdded !== undefined ? <span className="text-green-600 dark:text-green-400">+{logEntry.linesAdded} lines</span> : ''}
                    {(logEntry.linesAdded !== undefined && logEntry.linesRemoved !== undefined) ? ', ' : ''}
                    {logEntry.linesRemoved !== undefined ? <span className="text-red-600 dark:text-red-400">-{logEntry.linesRemoved} lines</span> : ''}
                  </>
                )}
                {logEntry.currentModelForIteration && <span className="ml-2 text-slate-500 dark:text-slate-400">Model: {SELECTABLE_MODELS.find(m=>m.name === logEntry.currentModelForIteration)?.displayName || logEntry.currentModelForIteration}</span>}
              </p>
            )}
            {isExpanded && (
               <p className="text-xs mt-1">
                {netWordChange !== undefined && (
                  <>
                    Net Word Change: <span className={netWordChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {netWordChange >= 0 ? "+" : ""}{netWordChange}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{isExpanded ? 'Collapse' : 'Expand'}</span>
        </button>
        <div className="flex-shrink-0 flex items-center space-x-2 mt-2 sm:mt-0 self-start">
          {canExportIteration && (
            <button
              onClick={() => onExportIterationMarkdown(logEntry.iteration)}
              className="inline-flex items-center px-2.5 py-1 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              title={`Download Iteration ${logEntry.iteration} as Markdown`}
              aria-label={`Download Iteration ${logEntry.iteration} as Markdown`}
              disabled={isProcessing}
            >
              Iter. .md
            </button>
          )}
          {canRewind && (
            <button
              onClick={() => onRewind(logEntry.iteration)}
              disabled={isProcessing}
              className="inline-flex items-center px-2.5 py-1 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={`Use Iteration ${logEntry.iteration}'s output as new starting point`}
              aria-label={`Use Iteration ${logEntry.iteration}'s output as new starting point`}
            >
              Use as Start
            </button>
          )}
          <button
            onClick={handleCopySingleDiagnostic}
            className="inline-flex items-center px-2.5 py-1 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 transition-colors relative"
            title="Copy diagnostics for this iteration to clipboard"
            aria-label="Copy diagnostics for this iteration"
            disabled={isProcessing}
          >
            {localCopyStatus || "Copy Diag."}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div
          id={`log-details-${logEntry.iteration}`}
          className="mt-3 pt-3 border-t border-slate-300/70 dark:border-white/10 space-y-3"
        >
          {diffDisplayComponent && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-primary-600 dark:text-primary-300">
                  {logEntry.iteration === 0 ? "Initial Content (Diff from Empty):" : "Word Changes from Previous Iteration:"}
                </h4>
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs bg-slate-100/80 dark:bg-black/40 p-2 rounded max-h-96 overflow-y-auto text-slate-700 dark:text-slate-200">
                {diffDisplayComponent}
              </pre>
            </div>
          )}
          <div className="pt-3 border-t border-slate-300/70 dark:border-white/10">
            <h4 className="text-sm font-semibold text-primary-600 dark:text-primary-300 mb-2">
               AI Interaction Diagnostics
            </h4>
            {(logEntry.promptSystemInstructionSent || logEntry.promptCoreUserInstructionsSent || logEntry.promptFullUserPromptSent || (logEntry.apiStreamDetails && logEntry.apiStreamDetails.length > 0) || logEntry.modelConfigUsed || logEntry.readabilityScoreFlesch !== undefined || logEntry.fileProcessingInfo || logEntry.aiValidationInfo || logEntry.directAiResponseHead || logEntry.processedProductHead || logEntry.strategyRationale || logEntry.activeMetaInstruction) ? (
              <div className="space-y-2 text-xs">
                {logEntry.strategyRationale && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`strategy_rationale_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      Strategy Rationale <span className="ml-1">{expandedDiagnostics[`strategy_rationale_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`strategy_rationale_${logEntry.iteration}`] && renderStrategyRationale(logEntry.strategyRationale)}
                  </div>
                )}
                 {logEntry.activeMetaInstruction && (
                  <div className="mt-1.5">
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-0.5">
                      Active Meta-Instruction Applied:
                    </h5>
                    <p className="italic text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/30 p-1 rounded text-xs">
                        "{logEntry.activeMetaInstruction}"
                    </p>
                  </div>
                )}
                {logEntry.currentModelForIteration && (
                  <div className="mt-1.5">
                     <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                       Model Used for Iteration:
                       <span className="font-normal ml-1 text-slate-600 dark:text-slate-400">
                         {modelUsedDisplayName}
                       </span>
                     </p>
                  </div>
                )}
                 {logEntry.modelConfigUsed && (
                  <div className="mt-1">
                     <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                       Applied Parameters:
                       <span className="font-normal ml-1 text-slate-600 dark:text-slate-400">
                         Temp: {logEntry.modelConfigUsed.temperature.toFixed(2)}, Top-P: {logEntry.modelConfigUsed.topP.toFixed(2)}, Top-K: {logEntry.modelConfigUsed.topK}
                         {logEntry.modelConfigUsed.thinkingConfig !== undefined && ` (Thinking Budget: ${logEntry.modelConfigUsed.thinkingConfig.thinkingBudget})`}
                       </span>
                     </p>
                  </div>
                )}
                {logEntry.processedProductHead && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`processed_product_info_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      Final Iteration Product Details <span className="ml-1">{expandedDiagnostics[`processed_product_info_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`processed_product_info_${logEntry.iteration}`] && (
                      <div className="mt-1 space-y-0.5 bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400">
                        <p>Processed Product Length: {logEntry.processedProductLengthChars ?? 'N/A'} chars</p>
                        <p className="font-medium mt-1">Processed Product Head (first {logEntry.processedProductHead.length} chars):</p>
                        <pre className="whitespace-pre-wrap break-words bg-slate-200 dark:bg-black/50 p-1 rounded max-h-32 overflow-y-auto">{logEntry.processedProductHead}</pre>
                        {logEntry.processedProductTail && logEntry.processedProductLengthChars && logEntry.processedProductLengthChars > logEntry.processedProductHead.length && (
                          <>
                            <p className="font-medium mt-1">Processed Product Tail (last {logEntry.processedProductTail.length} chars):</p>
                            <pre className="whitespace-pre-wrap break-words bg-slate-200 dark:bg-black/50 p-1 rounded max-h-32 overflow-y-auto">{logEntry.processedProductTail}</pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {logEntry.directAiResponseHead && (logEntry.directAiResponseHead !== logEntry.processedProductHead || logEntry.directAiResponseTail !== logEntry.processedProductTail || logEntry.directAiResponseLengthChars !== logEntry.processedProductLengthChars) && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`direct_ai_response_info_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      Direct AI Response Details (if different) <span className="ml-1">{expandedDiagnostics[`direct_ai_response_info_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`direct_ai_response_info_${logEntry.iteration}`] && (
                      <div className="mt-1 space-y-0.5 bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400">
                        <p>Direct AI Response Length: {logEntry.directAiResponseLengthChars ?? 'N/A'} chars</p>
                        <p className="font-medium mt-1">Direct AI Response Head (first {logEntry.directAiResponseHead.length} chars):</p>
                        <pre className="whitespace-pre-wrap break-words bg-slate-200 dark:bg-black/50 p-1 rounded max-h-32 overflow-y-auto">{logEntry.directAiResponseHead}</pre>
                        {logEntry.directAiResponseTail && logEntry.directAiResponseLengthChars && logEntry.directAiResponseLengthChars > logEntry.directAiResponseHead.length && (
                          <>
                            <p className="font-medium mt-1">Direct AI Response Tail (last {logEntry.directAiResponseTail.length} chars):</p>
                            <pre className="whitespace-pre-wrap break-words bg-slate-200 dark:bg-black/50 p-1 rounded max-h-32 overflow-y-auto">{logEntry.directAiResponseTail}</pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {logEntry.fileProcessingInfo && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`file_info_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      File Processing Info <span className="ml-1">{expandedDiagnostics[`file_info_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`file_info_${logEntry.iteration}`] && (
                      <div className="mt-1 space-y-0.5 bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400">
                        <p>File Manifest Chars (this iter prompt): {logEntry.fileProcessingInfo.fileManifestProvidedCharacterCount}</p>
                        {logEntry.fileProcessingInfo.filesSentToApiIteration !== null ? (
                          <>
                            <p>Actual File Data Sent in Iteration (API Call): {logEntry.fileProcessingInfo.filesSentToApiIteration}</p>
                            <p>Number of Files Sent (API Call): {logEntry.fileProcessingInfo.numberOfFilesActuallySent}</p>
                            <p>Total Bytes Sent (API Data): {logEntry.fileProcessingInfo.totalFilesSizeBytesSent}</p>
                          </>
                        ) : logEntry.iteration === 0 && logEntry.fileProcessingInfo.numberOfFilesActuallySent > 0 ? (
                          <>
                            <p>Files Loaded into Application: Yes</p>
                            <p>Number of Files Loaded: {logEntry.fileProcessingInfo.numberOfFilesActuallySent}</p>
                            <p>Total Bytes Loaded (App Data): {logEntry.fileProcessingInfo.totalFilesSizeBytesSent}</p>
                          </>
                        ) : (
                          <p>Actual File Data: Not sent in this API call (expected if files were sent initially or no files loaded).</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                 {logEntry.aiValidationInfo && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`ai_validation_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                       AI Response Validation ({logEntry.aiValidationInfo.checkName}) <span className={`ml-1 ${logEntry.aiValidationInfo.passed ? 'text-green-500' : 'text-red-500 font-bold'}`}>{expandedDiagnostics[`ai_validation_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`ai_validation_${logEntry.iteration}`] && (
                        <div className={`mt-1 space-y-0.5 bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400 border-l-2 ${logEntry.aiValidationInfo.passed ? 'border-green-500' : 'border-red-500'}`}>
                            <p>Passed: <span className={logEntry.aiValidationInfo.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{logEntry.aiValidationInfo.passed ? 'Yes' : 'No'}</span></p>
                            {logEntry.aiValidationInfo.reason && <p>Reason: {logEntry.aiValidationInfo.reason}</p>}
                            {logEntry.aiValidationInfo.details && (
                                <div>Details:
                                  <ul className="list-disc list-inside ml-2">
                                    <li>Type: '{logEntry.aiValidationInfo.details.type}'</li>
                                    {logEntry.aiValidationInfo.details.value && typeof logEntry.aiValidationInfo.details.value === 'string' && <li>Value: "{logEntry.aiValidationInfo.details.value}"</li>}
                                    {logEntry.aiValidationInfo.details.value && typeof logEntry.aiValidationInfo.details.value === 'object' && 'marker' in logEntry.aiValidationInfo.details.value && 'snippet' in logEntry.aiValidationInfo.details.value ? (
                                      <>
                                        <li>Marker: "{(logEntry.aiValidationInfo.details.value as PromptLeakageDetailValue).marker}"</li>
                                        <li>Snippet: <pre className="whitespace-pre-wrap text-xs bg-slate-200 dark:bg-black/50 p-1 rounded">{(logEntry.aiValidationInfo.details.value as PromptLeakageDetailValue).snippet}</pre></li>
                                      </>
                                    ) : logEntry.aiValidationInfo.details.value && typeof logEntry.aiValidationInfo.details.value === 'object' && !( 'marker' in logEntry.aiValidationInfo.details.value) ? (
                                      Object.entries(logEntry.aiValidationInfo.details.value as ReductionDetailValue).map(([key, val]) => (
                                        <li key={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {typeof val === 'number' ? val.toFixed(2) : val}</li>
                                      ))
                                    ) : null}
                                  </ul>
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                )}

                {logEntry.readabilityScoreFlesch !== undefined && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`readability_score_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      Readability (Flesch) <span className="ml-1">{expandedDiagnostics[`readability_score_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`readability_score_${logEntry.iteration}`] && logEntry.readabilityScoreFlesch !== undefined && (
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        Score: {logEntry.readabilityScoreFlesch.toFixed(1)}
                        <span className="italic text-slate-500 dark:text-slate-500">{getReadabilityInterpretation(logEntry.readabilityScoreFlesch)}</span>
                      </p>
                    )}
                  </div>
                )}
                {logEntry.promptSystemInstructionSent && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`sys_instr_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      System Instruction Sent <span className="ml-1">{expandedDiagnostics[`sys_instr_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`sys_instr_${logEntry.iteration}`] && <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400 max-h-48 overflow-y-auto">{truncateForDisplay(logEntry.promptSystemInstructionSent, 1000)}</pre>}
                  </div>
                )}
                 {logEntry.promptCoreUserInstructionsSent && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`core_instr_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                        Core User Instructions Sent <span className="ml-1">{expandedDiagnostics[`core_instr_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`core_instr_${logEntry.iteration}`] && <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400 max-h-48 overflow-y-auto">{truncateForDisplay(logEntry.promptCoreUserInstructionsSent, 1000)}</pre>}
                  </div>
                )}
                {logEntry.promptFullUserPromptSent && (
                  <div>
                    <button onClick={() => toggleDiagnosticSection(`full_prompt_init_${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline flex items-center text-xs">
                      Initial Full User Prompt Sent (for Iteration) <span className="ml-1">{expandedDiagnostics[`full_prompt_init_${logEntry.iteration}`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiagnostics[`full_prompt_init_${logEntry.iteration}`] && <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400 max-h-72 overflow-y-auto">{truncateForDisplay(logEntry.promptFullUserPromptSent)}</pre>}
                  </div>
                )}
                {logEntry.apiStreamDetails && logEntry.apiStreamDetails.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-2 mb-1 text-xs">API Stream Call Details (within this Iteration):</p>
                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {logEntry.apiStreamDetails.map((detail, index) => (
                        <div key={index} className="bg-slate-100/70 dark:bg-black/30 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                          <p><strong>API Call {detail.callCount}:</strong> {detail.isContinuation ? '(Continuation)' : '(Initial Call for Iteration)'}</p>
                          <p>Finish Reason: <span className="font-mono text-primary-700 dark:text-primary-300">{detail.finishReason || 'N/A'}</span></p>
                          <p>Text Length This Call: {detail.textLengthThisCall} chars</p>
                          {detail.safetyRatings && <p>Safety Ratings: <span className="font-mono text-orange-600 dark:text-orange-400">{JSON.stringify(detail.safetyRatings)}</span></p>}
                          {detail.promptForThisCall && detail.promptForThisCall !== "N/A (Initial State - Input becomes first product)" && (
                            <div>
                              <button onClick={() => toggleDiagnosticSection(`stream_prompt_${logEntry.iteration}_${index}`)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center">
                                View Full Prompt for this Specific API Call <span className="ml-1 text-xs">{expandedDiagnostics[`stream_prompt_${logEntry.iteration}_${index}`] ? '▲' : '▼'}</span>
                              </button>
                              {expandedDiagnostics[`stream_prompt_${logEntry.iteration}_${index}`] && <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-200 dark:bg-black/50 p-1 rounded text-slate-600 dark:text-slate-400 max-h-72 overflow-y-auto">{truncateForDisplay(detail.promptForThisCall)}</pre>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 italic">No detailed AI interaction diagnostics available for this entry.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LogEntryItem;
