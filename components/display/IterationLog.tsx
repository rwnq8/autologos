

import React, { useState, useContext } from 'react';
import type { IterationLogEntry, ReconstructedProductResult, DiffViewType } from '../../types'; 
import LogEntryItem from './LogEntryItem';
import { useProcessContext } from '../../contexts/ProcessContext';

export interface IterationLogProps {
  onSaveLog: () => void; 
}

const IterationLog: React.FC<IterationLogProps> = ({
  onSaveLog,
}) => {
  const processCtx = useProcessContext();
  const [expandedLogItem, setExpandedLogItem] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<{ [key: number]: string }>({});

  const toggleLogItem = (iteration: number) => {
    setExpandedLogItem(expandedLogItem === iteration ? null : iteration);
  };

  const handleCopyDiagnostics = async (logEntry: IterationLogEntry) => {
    let diagString = `== Iteration ${logEntry.iteration} Diagnostics ==\n`;
    diagString += `Timestamp: ${new Date(logEntry.timestamp).toISOString()}\n`;
    diagString += `Status: ${logEntry.status}\n`;
    if (logEntry.linesAdded || logEntry.linesRemoved) {
      diagString += `Changes: +${logEntry.linesAdded || 0} lines, -${logEntry.linesRemoved || 0} lines\n`;
    }
    if (logEntry.readabilityScoreFlesch !== undefined) {
      diagString += `Readability (Flesch): ${logEntry.readabilityScoreFlesch.toFixed(1)}\n`;
    }

    if (logEntry.processedProductHead || logEntry.iteration === 0) { // Iteration 0 uses processedProduct fields as they are same as direct response
      diagString += `\n== Final Iteration Product (Used for Next Step / Displayed) ==\n`;
      diagString += `  Processed Product Length: ${logEntry.processedProductLengthChars ?? 'N/A'} chars\n`;
      diagString += `  Processed Product Head (first ${logEntry.processedProductHead?.length || 0} chars):\n${logEntry.processedProductHead || '(empty)'}\n`;
      if (logEntry.processedProductTail && logEntry.processedProductLengthChars && logEntry.processedProductLengthChars > (logEntry.processedProductHead?.length || 0)) {
        diagString += `  Processed Product Tail (last ${logEntry.processedProductTail.length} chars):\n${logEntry.processedProductTail}\n`;
      }
    }
    
    // Include direct AI response if it's different from processed or for iterations > 0
    if (logEntry.iteration > 0 && logEntry.directAiResponseHead && 
        (logEntry.directAiResponseHead !== logEntry.processedProductHead || logEntry.directAiResponseTail !== logEntry.processedProductTail)) {
      diagString += `\n== Direct AI Response (Raw from API) ==\n`;
      diagString += `  Direct AI Response Length: ${logEntry.directAiResponseLengthChars ?? 'N/A'} chars\n`;
      diagString += `  Direct AI Response Head (first ${logEntry.directAiResponseHead.length} chars):\n${logEntry.directAiResponseHead}\n`;
      if (logEntry.directAiResponseTail && logEntry.directAiResponseLengthChars && logEntry.directAiResponseLengthChars > logEntry.directAiResponseHead.length) {
        diagString += `  Direct AI Response Tail (last ${logEntry.directAiResponseTail.length} chars):\n${logEntry.directAiResponseTail}\n`;
      }
    }


    if (logEntry.fileProcessingInfo) {
        diagString += `\n== File Processing Info ==\n`;
        diagString += `  File Manifest Chars (this iter prompt): ${logEntry.fileProcessingInfo.fileManifestProvidedCharacterCount}\n`;
        if (logEntry.fileProcessingInfo.filesSentToApiIteration !== null) {
            diagString += `  Actual File Data Sent in Iteration (API Call): ${logEntry.fileProcessingInfo.filesSentToApiIteration}\n`;
            diagString += `  Number of Files Sent (API Call): ${logEntry.fileProcessingInfo.numberOfFilesActuallySent}\n`;
            diagString += `  Total Bytes Sent (API Data): ${logEntry.fileProcessingInfo.totalFilesSizeBytesSent}\n`;
        } else if (logEntry.iteration === 0 && logEntry.fileProcessingInfo.numberOfFilesActuallySent > 0) {
            diagString += `  Files Loaded into Application: Yes\n`;
            diagString += `  Number of Files Loaded: ${logEntry.fileProcessingInfo.numberOfFilesActuallySent}\n`;
            diagString += `  Total Bytes Loaded (App Data): ${logEntry.fileProcessingInfo.totalFilesSizeBytesSent}\n`;
        } else {
             diagString += `  Actual File Data: Not sent in this API call (expected if files were sent initially or no files loaded).\n`;
        }
    }
    if (logEntry.modelConfigUsed) {
      diagString += `\n== Model Config Used ==\n  Temperature: ${logEntry.modelConfigUsed.temperature.toFixed(2)}\n  Top-P: ${logEntry.modelConfigUsed.topP.toFixed(2)}\n  Top-K: ${logEntry.modelConfigUsed.topK}\n`;
    }

    if (logEntry.promptSystemInstructionSent) {
      diagString += `\n== System Instruction Sent (approx. first 300 chars) ==\n${logEntry.promptSystemInstructionSent.substring(0, 300)}...\n`;
    }
    if (logEntry.promptCoreUserInstructionsSent) {
        diagString += `\n== Core User Instructions Sent (approx. first 300 chars) ==\n${logEntry.promptCoreUserInstructionsSent.substring(0,300)}...\n`;
    }
    if (logEntry.promptFullUserPromptSent) {
      diagString += `\n== Full User Prompt Sent (details, truncated if long) ==\n`;
      if (logEntry.promptFullUserPromptSent.length > 600) {
        diagString += `Prompt Length: ${logEntry.promptFullUserPromptSent.length} chars\nStart: ${logEntry.promptFullUserPromptSent.substring(0, 300)}...\n...\nEnd: ...${logEntry.promptFullUserPromptSent.slice(-300)}\n`;
      } else {
        diagString += `${logEntry.promptFullUserPromptSent}\n`;
      }
    }
    if (logEntry.apiStreamDetails && logEntry.apiStreamDetails.length > 0) {
      diagString += `\n== API Stream Call Summary ==\n`;
      logEntry.apiStreamDetails.forEach(d => {
        diagString += `  Call ${d.callCount}: ${d.isContinuation ? '(Continuation)' : '(Initial)'}, Finish: ${d.finishReason || 'N/A'}, TextLen: ${d.textLengthThisCall}\n`;
      });
    }
    diagString += `\n== End of Diagnostics ==\n`;

    try {
      await navigator.clipboard.writeText(diagString);
      setCopyStatus(prev => ({ ...prev, [logEntry.iteration]: "Copied!" }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [logEntry.iteration]: "" })), 2000);
    } catch (err) {
      console.error('Failed to copy diagnostics: ', err);
      setCopyStatus(prev => ({ ...prev, [logEntry.iteration]: "Copy Failed" }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [logEntry.iteration]: "" })), 2000);
    }
  };


  if (processCtx.iterationHistory.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/50 dark:bg-black/20 p-6 rounded-lg border border-slate-300/70 dark:border-white/10">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-300">Iteration Log</h2>
        <button
          onClick={onSaveLog}
          className="inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-white/20 text-xs font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black/50 focus:ring-primary-500 transition-colors"
          aria-label="Download iteration log"
          disabled={processCtx.iterationHistory.length === 0}
        >
          Download Log (.json)
        </button>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {processCtx.iterationHistory.slice().reverse().map((log) => (
          <LogEntryItem
            key={log.iteration}
            logEntry={log}
            isExpanded={expandedLogItem === log.iteration}
            onToggleExpand={toggleLogItem}
            onCopyDiagnostics={handleCopyDiagnostics}
            reconstructProductCallback={(iter, hist) => processCtx.reconstructProductCallback(iter, hist, processCtx.initialPrompt)}
            iterationHistory={processCtx.iterationHistory}
            copyStatusForThisItem={copyStatus[log.iteration]}
            onRewind={processCtx.handleRewind}
            onExportIterationMarkdown={processCtx.handleExportIterationMarkdown}
            isProcessing={processCtx.isProcessing}
          />
        ))}
      </div>
    </div>
  );
};

export default IterationLog;
