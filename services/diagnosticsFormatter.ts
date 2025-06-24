
import type { IterationLogEntry, ReconstructedProductResult, PromptLeakageDetailValue, ReductionDetailValue } from '../types.ts';
import { reconstructProduct } from './diffService'; // Assuming reconstructProduct is in diffService
import { SELECTABLE_MODELS } from '../types.ts';

const DIAG_PROMPT_COPY_MAX_LENGTH = 100000;

const truncateForCopy = (text: string | undefined, maxLength: number = DIAG_PROMPT_COPY_MAX_LENGTH): string => {
  if (!text) return "(Not available)";
  if (text.length <= maxLength) return text;
  const halfMax = Math.floor(maxLength / 2) - 50; // leave room for truncation message
  return `${text.substring(0, halfMax)}...\n[--- TRUNCATED (Total Length: ${text.length} chars) ---]\n...${text.substring(text.length - halfMax)}`;
};

export const formatLogEntryDiagnostics = (
  logEntry: IterationLogEntry,
  allHistory: IterationLogEntry[],
  baseInitialPrompt: string
): string => {
  let diagString = `== Iteration ${logEntry.iteration} Diagnostics ==\n`;
  diagString += `Timestamp: ${new Date(logEntry.timestamp).toISOString()}\n`;
  diagString += `Status: ${logEntry.status}\n`;
  if (logEntry.linesAdded !== undefined || logEntry.linesRemoved !== undefined) {
    diagString += `Changes: +${logEntry.linesAdded || 0} lines, -${logEntry.linesRemoved || 0} lines\n`;
  }
  if (logEntry.readabilityScoreFlesch !== undefined) {
    diagString += `Readability (Flesch): ${logEntry.readabilityScoreFlesch.toFixed(1)}\n`;
  }

  if (logEntry.aiValidationInfo) {
    diagString += `\n== AI Response Validation (${logEntry.aiValidationInfo.checkName}) ==\n`;
    diagString += `  Passed: ${logEntry.aiValidationInfo.passed}\n`;
    if (logEntry.aiValidationInfo.reason) diagString += `  Reason: ${logEntry.aiValidationInfo.reason}\n`;
    if (logEntry.aiValidationInfo.details) {
        diagString += `  Details Type: ${logEntry.aiValidationInfo.details.type}\n`;
        if (typeof logEntry.aiValidationInfo.details.value === 'string') {
            diagString += `  Details Value: "${logEntry.aiValidationInfo.details.value}"\n`;
        } else if (logEntry.aiValidationInfo.details.value && typeof logEntry.aiValidationInfo.details.value === 'object') {
             if ('marker' in logEntry.aiValidationInfo.details.value && 'snippet' in logEntry.aiValidationInfo.details.value) {
                const promptLeak = logEntry.aiValidationInfo.details.value as PromptLeakageDetailValue;
                diagString += `  Details Marker: "${promptLeak.marker}"\n`;
                diagString += `  Details Snippet: "${promptLeak.snippet}"\n`;
            } else {
                diagString += `  Details Value: ${JSON.stringify(logEntry.aiValidationInfo.details.value, null, 2)}\n`;
            }
        }
    }
  }

  if (logEntry.processedProductHead || logEntry.iteration === 0) {
    diagString += `\n== Final Iteration Product (Used for Next Step / Displayed) ==\n`;
    diagString += `  Processed Product Length: ${logEntry.processedProductLengthChars ?? 'N/A'} chars\n`;
    diagString += `  Processed Product Head (first ${logEntry.processedProductHead?.length || 0} chars):\n${logEntry.processedProductHead || '(empty)'}\n`;
    if (logEntry.processedProductTail && logEntry.processedProductLengthChars && logEntry.processedProductLengthChars > (logEntry.processedProductHead?.length || 0)) {
      diagString += `  Processed Product Tail (last ${logEntry.processedProductTail.length} chars):\n${logEntry.processedProductTail}\n`;
    }
  }
  
  if (logEntry.iteration > 0 && logEntry.directAiResponseHead && 
      (logEntry.directAiResponseHead !== logEntry.processedProductHead || logEntry.directAiResponseTail !== logEntry.processedProductTail || logEntry.directAiResponseLengthChars !== logEntry.processedProductLengthChars)) {
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
    const modelUsedDisplayName = SELECTABLE_MODELS.find(m => m.name === logEntry.modelConfigUsed?.modelName)?.displayName || logEntry.modelConfigUsed?.modelName || "N/A";
    diagString += `\n== Model Config Used ==\n  Model Name: ${modelUsedDisplayName}\n  Temperature: ${logEntry.modelConfigUsed.temperature.toFixed(2)}\n  Top-P: ${logEntry.modelConfigUsed.topP.toFixed(2)}\n  Top-K: ${logEntry.modelConfigUsed.topK}\n`;
    if (logEntry.modelConfigUsed.thinkingConfig) {
        diagString += `  Thinking Budget: ${logEntry.modelConfigUsed.thinkingConfig.thinkingBudget}\n`;
    }
  }

  if (logEntry.promptSystemInstructionSent) {
    diagString += `\n== System Instruction Sent ==\n${truncateForCopy(logEntry.promptSystemInstructionSent)}\n`;
  }
  if (logEntry.promptCoreUserInstructionsSent) {
      diagString += `\n== Core User Instructions Sent ==\n${truncateForCopy(logEntry.promptCoreUserInstructionsSent)}\n`;
  }
  
  if (logEntry.promptFullUserPromptSent) {
    diagString += `\n== Initial Full User Prompt Sent (for Iteration's First API Call) ==\n`;
    diagString += `Prompt Length: ${logEntry.promptFullUserPromptSent.length} chars\n${truncateForCopy(logEntry.promptFullUserPromptSent)}\n`;
  }

  if (logEntry.apiStreamDetails && logEntry.apiStreamDetails.length > 0) {
    diagString += `\n== API Stream Call Details (within this Iteration) ==\n`;
    logEntry.apiStreamDetails.forEach((d) => {
      diagString += `\n  -- API Call ${d.callCount} --\n`;
      diagString += `  Type: ${d.isContinuation ? '(Continuation)' : '(Initial Call for Iteration)'}\n`;
      diagString += `  Finish Reason: ${d.finishReason || 'N/A'}\n`;
      diagString += `  Text Length This Call: ${d.textLengthThisCall} chars\n`;
      if (d.safetyRatings) {
          diagString += `  Safety Ratings: ${JSON.stringify(d.safetyRatings)}\n`;
      }
      if (d.promptForThisCall && d.promptForThisCall !== "N/A (Initial State - Input becomes first product)") {
          diagString += `  Full Prompt For This Specific API Call (Length: ${d.promptForThisCall.length} chars):\n${truncateForCopy(d.promptForThisCall)}\n`;
      }
    });
  }
  diagString += `\n== End of Diagnostics ==\n`;
  return diagString;
};
