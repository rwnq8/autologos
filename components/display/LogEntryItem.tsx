
import React, { useState, useContext } from 'react';
import type { IterationLogEntry, ReconstructedProductResult, ModelConfig, AiResponseValidationInfo, ReductionDetailValue, PromptLeakageDetailValue, SelectableModelName, IterationEntryType } from '../../types.ts';
import * as GeminaiDiff from 'diff';
import { useProcessContext } from '../../contexts/ProcessContext';
import { countWords } from '../../services/textAnalysisService';
import { SELECTABLE_MODELS } from '../../types.ts';
import { formatLogEntryDiagnostics } from '../../services/diagnosticsFormatter'; 


interface LogEntryItemProps {
  logEntry: IterationLogEntry;
  isExpanded: boolean;
  onToggleExpand: (iteration: number) => void;
  onRewind: (iterationNumber: number) => void;
  onExportIterationMarkdown: (iterationNumber: number) => void;
  reconstructProductCallback: (targetIteration: number, history: IterationLogEntry[]) => ReconstructedProductResult; 
  iterationHistory: IterationLogEntry[]; 
  isProcessing: boolean;
}

// Helper function to determine the title for the diff section
const getDiffTitle = (entry: IterationLogEntry): string => {
  if (entry.entryType === 'initial_state' && entry.iteration === 0) {
    return "Initial Product";
  }
  if (entry.entryType === 'segmented_synthesis_milestone' && entry.iteration === 1) {
    return `Changes from Iteration 0 (Full Product after Segmented Synthesis)`;
  }
  // For all other cases, including AI iterations, manual edits, targeted refinements
  // that are not Iteration 0 or the special Iteration 1 milestone.
  if (entry.iteration > 0) {
    return `Changes from Iteration ${entry.iteration - 1}`;
  }
  // Fallback for Iteration 0 if not 'initial_state' (should not happen with good data)
  // or other unexpected scenarios.
  return `Product at Iteration ${entry.iteration}`;
};

export const LogEntryItem: React.FC<LogEntryItemProps> = ({
  logEntry,
  isExpanded,
  onToggleExpand,
  onRewind,
  onExportIterationMarkdown,
  reconstructProductCallback, 
  iterationHistory, 
  isProcessing,
}) => {
  const { initialPrompt: baseInitialPrompt } = useProcessContext(); 
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<{ [key: string]: boolean }>({});
  const [expandedPrompts, setExpandedPrompts] = useState<{ [key: string]: boolean }>({});

  const toggleDiagnosticSection = (key: string) => {
    setExpandedDiagnostics(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const togglePromptExpansion = (key: string) => {
    setExpandedPrompts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [localCopyStatus, setLocalCopyStatus] = useState<string | undefined>(undefined);

  const handleCopySingleDiagnostic = async () => {
    setLocalCopyStatus("Copying...");
    try {
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

  const isAiEntry = logEntry.entryType === 'ai_iteration' || logEntry.entryType === 'targeted_refinement' || logEntry.entryType === 'segmented_synthesis_milestone';


  if (isExpanded) {
    try {
      let oldTextResult: ReconstructedProductResult;
      let newTextResult: ReconstructedProductResult;
      let overallReconstructionError: string | undefined;

      newTextResult = reconstructProductCallback(logEntry.iteration, iterationHistory);

      if (logEntry.entryType === 'initial_state' && logEntry.iteration === 0) {
         oldTextResult = { product: "", error: undefined }; // Diff initial state from empty
      } else if (logEntry.entryType === 'segmented_synthesis_milestone' && logEntry.iteration === 1) {
         // Diff segmented synthesis result from the initial state (Iter 0)
         oldTextResult = reconstructProductCallback(0, iterationHistory);
      } else {
        // For other AI iterations, manual edits, targeted refinements, diff from previous iteration's state
         oldTextResult = reconstructProductCallback(logEntry.iteration - 1 , iterationHistory);
      }

      if (newTextResult.error && oldTextResult.error && !(logEntry.entryType === 'initial_state' && logEntry.iteration === 0)) {
        overallReconstructionError = `Error reconstructing Iter. ${logEntry.iteration}: ${newTextResult.error}\nError reconstructing Prev. Iter. (${logEntry.iteration -1}): ${oldTextResult.error}`;
      }
      else if (newTextResult.error) overallReconstructionError = `Error reconstructing Iteration ${logEntry.iteration}: ${newTextResult.error}`;
      else if (oldTextResult.error && !(logEntry.entryType === 'initial_state' && logEntry.iteration === 0)) overallReconstructionError = `Error reconstructing Previous Iteration (${logEntry.iteration -1}): ${oldTextResult.error}`;


      if (overallReconstructionError) {
        diffDisplayComponent = [<span key="recon_error" className="text-red-500 dark:text-red-400 block whitespace-pre-wrap">{overallReconstructionError}</span>];
      } else if (logEntry.iteration > 0 && !logEntry.productDiff && !overallReconstructionError && logEntry.entryType !== 'initial_state') {
        const productToShow = typeof newTextResult.product === 'string' ? newTextResult.product : "Content unavailable";
        diffDisplayComponent = [<span key="no_change" className="text-slate-600 dark:text-slate-300 block">No textual changes recorded from Iteration ${logEntry.iteration - 1}.<br />Current Content:<br />{productToShow}</span>];
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
  
  const canRewind = logEntry.iteration >= 0 && !isProcessing;
  const iterZeroResultForExportCheck = logEntry.iteration === 0 ? reconstructProductCallback(0, iterationHistory) : null;
  const canExportIteration = 
    (logEntry.entryType === 'initial_state' && logEntry.iteration === 0 && iterZeroResultForExportCheck && !iterZeroResultForExportCheck.error && iterZeroResultForExportCheck.product.trim() !== "") ||
    (logEntry.entryType === 'segmented_synthesis_milestone' && logEntry.iteration === 1) ||
    (logEntry.iteration > 0 && logEntry.productDiff && logEntry.productDiff.trim() !== "" && logEntry.entryType !== 'initial_state' && logEntry.entryType !== 'segmented_synthesis_milestone');


  const modelUsedDisplayName = logEntry.currentModelForIteration
    ? SELECTABLE_MODELS.find(m => m.name === logEntry.currentModelForIteration)?.displayName || logEntry.currentModelForIteration
    : (logEntry.entryType === 'manual_edit' ? "N/A (Manual Edit)" : (logEntry.entryType === 'initial_state' ? "N/A (Initial State)" : "N/A"));
    
  const entryTypeDisplay: Record<IterationEntryType, string> = {
    'initial_state': "Initial State",
    'ai_iteration': "AI Iteration",
    'manual_edit': "Manual Edit",
    'segmented_synthesis_milestone': "Segmented Synthesis Milestone",
    'targeted_refinement': "Targeted Refinement"
  };
  const displayEntryType = entryTypeDisplay[logEntry.entryType || 'ai_iteration'];


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

  const PROMPT_UI_TRUNCATE_LENGTH = 300; // Length for initial UI truncation

  const renderExpandablePrompt = (promptText: string | undefined, promptKey: string, title: string) => {
    if (!promptText) return <p className="text-xs text-slate-500 dark:text-slate-400">({title} not available)</p>;

    const isPromptExpanded = expandedPrompts[promptKey];
    const canExpand = promptText.length > PROMPT_UI_TRUNCATE_LENGTH;

    return (
      <div className="text-xs">
        <div className="flex justify-between items-center mb-0.5">
          <h5 className="font-semibold text-slate-700 dark:text-slate-300">{title}</h5>
          {canExpand && (
            <button
              onClick={() => togglePromptExpansion(promptKey)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline focus:outline-none"
              aria-expanded={isPromptExpanded}
              aria-controls={`prompt-content-${promptKey}`}
            >
              {isPromptExpanded ? 'Show Less' : 'Show More'}
            </button>
          )}
        </div>
        <pre
          id={`prompt-content-${promptKey}`}
          className={`whitespace-pre-wrap break-words bg-slate-100 dark:bg-black/40 p-1.5 rounded text-slate-600 dark:text-slate-400 ${isPromptExpanded ? 'max-h-96 overflow-y-auto' : ''}`}
        >
          {isPromptExpanded ? promptText : (promptText.length > PROMPT_UI_TRUNCATE_LENGTH ? promptText.substring(0, PROMPT_UI_TRUNCATE_LENGTH) + "..." : promptText)}
        </pre>
      </div>
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
              Iteration {logEntry.iteration}
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">({displayEntryType})</span>
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
                {isAiEntry && logEntry.currentModelForIteration && <span className="ml-2 text-slate-500 dark:text-slate-400">Model: {SELECTABLE_MODELS.find(m=>m.name === logEntry.currentModelForIteration)?.displayName || logEntry.currentModelForIteration}</span>}
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
              disabled={!canExportIteration} 
              className="inline-flex items-center px-2.5 py-1 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              title={`Download Iteration ${logEntry.iteration} as Markdown`}
              aria-label={`Download Iteration ${logEntry.iteration} as Markdown`}
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
                  {getDiffTitle(logEntry)}
                </h4>
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs bg-slate-100 dark:bg-black/40 p-2 rounded max-h-96 overflow-y-auto">
                {diffDisplayComponent}
              </pre>
            </div>
          )}

          {(isAiEntry || (logEntry.entryType === 'initial_state' && logEntry.iteration === 0)) && logEntry.modelConfigUsed && (
            <div className="text-xs">
              <button onClick={() => toggleDiagnosticSection(`modelConfig-${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 hover:underline w-full text-left">
                Model Config Used {expandedDiagnostics[`modelConfig-${logEntry.iteration}`] ? '▼' : '▶'}
              </button>
              {expandedDiagnostics[`modelConfig-${logEntry.iteration}`] && (
                <div className="ml-2 pl-2 border-l border-slate-300 dark:border-slate-600">
                  <p>Model: {modelUsedDisplayName}</p>
                  <p>Temp: {logEntry.modelConfigUsed.temperature.toFixed(2)}, Top-P: {logEntry.modelConfigUsed.topP.toFixed(2)}, Top-K: {logEntry.modelConfigUsed.topK}</p>
                  {logEntry.modelConfigUsed.thinkingConfig && (
                    <p>Thinking Budget: {logEntry.modelConfigUsed.thinkingConfig.thinkingBudget}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {logEntry.fileProcessingInfo && (logEntry.fileProcessingInfo.fileManifestProvidedCharacterCount > 0 || logEntry.fileProcessingInfo.numberOfFilesActuallySent > 0) && (
            <div className="text-xs">
              <button onClick={() => toggleDiagnosticSection(`fileInfo-${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 hover:underline w-full text-left">
                File Processing Info {expandedDiagnostics[`fileInfo-${logEntry.iteration}`] ? '▼' : '▶'}
              </button>
              {expandedDiagnostics[`fileInfo-${logEntry.iteration}`] && (
                <div className="ml-2 pl-2 border-l border-slate-300 dark:border-slate-600">
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
                     <p>Actual File Data: Not sent in this API call.</p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {logEntry.aiValidationInfo && (
             <div className="text-xs">
                <button onClick={() => toggleDiagnosticSection(`validation-${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 hover:underline w-full text-left">
                  AI Response Validation {expandedDiagnostics[`validation-${logEntry.iteration}`] ? '▼' : '▶'}
                </button>
                {expandedDiagnostics[`validation-${logEntry.iteration}`] && (
                  <div className={`ml-2 pl-2 border-l ${logEntry.aiValidationInfo.passed ? 'border-green-500' : 'border-red-500'}`}>
                    <p>Passed: <span className={logEntry.aiValidationInfo.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{logEntry.aiValidationInfo.passed ? 'Yes' : 'No'}</span></p>
                    {logEntry.aiValidationInfo.reason && <p>Reason: {logEntry.aiValidationInfo.reason}</p>}
                    {logEntry.aiValidationInfo.details && (
                      <p>Details Type: {logEntry.aiValidationInfo.details.type} | Value: {
                          typeof logEntry.aiValidationInfo.details.value === 'string' ? `"${logEntry.aiValidationInfo.details.value}"`
                          : logEntry.aiValidationInfo.details.value && typeof logEntry.aiValidationInfo.details.value === 'object' ? JSON.stringify(logEntry.aiValidationInfo.details.value)
                          : 'N/A'
                      }</p>
                    )}
                  </div>
                )}
             </div>
          )}

          {isAiEntry && logEntry.strategyRationale && (
             <div className="text-xs">
                <button onClick={() => toggleDiagnosticSection(`strategy-${logEntry.iteration}`)} className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5 hover:underline w-full text-left">
                  Strategy Rationale {expandedDiagnostics[`strategy-${logEntry.iteration}`] ? '▼' : '▶'}
                </button>
                {expandedDiagnostics[`strategy-${logEntry.iteration}`] && renderStrategyRationale(logEntry.strategyRationale)}
             </div>
          )}

          {(isAiEntry || (logEntry.entryType === 'initial_state' && logEntry.iteration === 0)) && (logEntry.promptSystemInstructionSent || logEntry.promptCoreUserInstructionsSent || logEntry.promptFullUserPromptSent) && (
            <div className="text-xs space-y-2">
              {renderExpandablePrompt(logEntry.promptSystemInstructionSent, `sys-${logEntry.iteration}`, "System Instruction Sent")}
              {renderExpandablePrompt(logEntry.promptCoreUserInstructionsSent, `core-${logEntry.iteration}`, "Core User Instructions Sent")}
              {renderExpandablePrompt(logEntry.promptFullUserPromptSent, `full-${logEntry.iteration}`, "Initial Full User Prompt Sent (for Iteration's First API Call)")}
            </div>
          )}

          {logEntry.readabilityScoreFlesch !== undefined && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Readability (Flesch): {logEntry.readabilityScoreFlesch.toFixed(1)}
              {getReadabilityInterpretation(logEntry.readabilityScoreFlesch)}
            </p>
          )}
           {logEntry.lexicalDensity !== undefined && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lexical Density: {logEntry.lexicalDensity.toFixed(3)}
            </p>
          )}
          {logEntry.avgSentenceLength !== undefined && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Avg. Sentence Length: {logEntry.avgSentenceLength.toFixed(1)} words
            </p>
          )}
          {logEntry.typeTokenRatio !== undefined && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Type-Token Ratio (TTR): {logEntry.typeTokenRatio.toFixed(3)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
