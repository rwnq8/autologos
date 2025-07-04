// services/diagnosticsFormatter.ts

import type { IterationLogEntry, ReconstructedProductResult, PromptLeakageDetailValue, ReductionDetailValue } from '../types/index.ts';
import { SELECTABLE_MODELS } from '../types/index.ts';
import { formatVersion } from './versionUtils.ts';

const DIAG_PROMPT_COPY_MAX_LENGTH = 100000;

const truncateForCopy = (text: string | undefined, maxLength: number = DIAG_PROMPT_COPY_MAX_LENGTH): string => {
  if (!text) return "(Not available)";
  if (text.length <= maxLength) return text;
  const halfMax = Math.floor(maxLength / 2) - 50; 
  return `${text.substring(0, halfMax)}...\n[--- TRUNCATED (Total Length: ${text.length} chars) ---]\n...${text.substring(text.length - halfMax)}`;
};

export const formatLogEntryDiagnostics = (
  logEntry: IterationLogEntry,
  allHistory: IterationLogEntry[],
  baseInitialPrompt: string
): string => {
  const versionString = formatVersion(logEntry);
  let diagString = `== Diagnostics for Version ${versionString} ==\n`;
  diagString += `Timestamp: ${new Date(logEntry.timestamp).toISOString()}\n`;
  diagString += `Status: ${logEntry.status}\n`;
  if (logEntry.linesAdded !== undefined || logEntry.linesRemoved !== undefined) {
    diagString += `Changes: +${logEntry.linesAdded || 0} lines, -${logEntry.linesRemoved || 0} lines\n`;
  }
  if (logEntry.readabilityScoreFlesch !== undefined) {
    diagString += `Readability (Flesch): ${logEntry.readabilityScoreFlesch.toFixed(1)}\n`;
  }
  if (logEntry.lexicalDensity !== undefined) {
    diagString += `Lexical Density: ${logEntry.lexicalDensity.toFixed(3)}\n`;
  }
  if (logEntry.avgSentenceLength !== undefined) {
    diagString += `Avg Sentence Length: ${logEntry.avgSentenceLength.toFixed(1)} words\n`;
  }
  if (logEntry.typeTokenRatio !== undefined) {
    diagString += `Type-Token Ratio (TTR): ${logEntry.typeTokenRatio.toFixed(3)}\n`;
  }


  if (logEntry.aiValidationInfo) {
    diagString += `\n== AI Response Validation (${logEntry.aiValidationInfo.checkName || 'N/A'}) ==\n`;
    diagString += `  Passed: ${logEntry.aiValidationInfo.passed}\n`;
    if (logEntry.aiValidationInfo.reason) diagString += `  Reason: ${logEntry.aiValidationInfo.reason}\n`;
    if (logEntry.aiValidationInfo.details) {
        diagString += `  Details Type: ${logEntry.aiValidationInfo.details.type}\n`;
        if (typeof logEntry.aiValidationInfo.details.value === 'string') {
            diagString += `  Details Value: "${logEntry.aiValidationInfo.details.value}"\n`;
        } else if (logEntry.aiValidationInfo.details.value && typeof logEntry.aiValidationInfo.details.value === 'object') {
             const detailsValue = logEntry.aiValidationInfo.details.value as any;
             if ('marker' in detailsValue && 'snippet' in detailsValue) { 
                diagString += `    Marker: "${detailsValue.marker}"\n`;
                diagString += `    Snippet: "${detailsValue.snippet}"\n`;
            } else if ('previousLengthChars' in detailsValue && 'newLengthChars' in detailsValue) { 
                diagString += `    Previous Length (Chars): ${detailsValue.previousLengthChars}\n`;
                diagString += `    New Length (Chars): ${detailsValue.newLengthChars}\n`;
                diagString += `    Previous Word Count: ${detailsValue.previousWordCount}\n`;
                diagString += `    New Word Count: ${detailsValue.newWordCount}\n`;
                diagString += `    Char Change (%): ${detailsValue.percentageCharChange}%\n`;
                diagString += `    Word Change (%): ${detailsValue.percentageWordChange}%\n`;
                diagString += `    Threshold Used: ${detailsValue.thresholdUsed}\n`;
                if (detailsValue.additionalInfo) diagString += `    Additional Info: ${detailsValue.additionalInfo}\n`;
            } else { 
                diagString += `  Details Value (Object): ${JSON.stringify(logEntry.aiValidationInfo.details.value, null, 2)}\n`;
            }
        } else {
             diagString += `  Details Value: ${logEntry.aiValidationInfo.details.value}\n`;
        }
    }
  }

  diagString += "\n== Model Configuration Used ==\n";
  if (logEntry.modelConfigUsed) {
    const modelUsedName = SELECTABLE_MODELS.find(m => m.name === logEntry.currentModelForIteration)?.displayName || logEntry.currentModelForIteration || "N/A";
    diagString += `Model: ${modelUsedName}\n`;
    diagString += `Temperature: ${logEntry.modelConfigUsed.temperature}\n`;
    diagString += `Top-P: ${logEntry.modelConfigUsed.topP}\n`;
    diagString += `Top-K: ${logEntry.modelConfigUsed.topK}\n`;
    if (logEntry.modelConfigUsed.thinkingConfig !== undefined) {
      diagString += `Thinking Budget: ${logEntry.modelConfigUsed.thinkingConfig.thinkingBudget}\n`;
    }
  } else {
    diagString += "Not available for this entry.\n";
  }

  diagString += "\n== Prompt & Response Details ==\n";
  if (logEntry.promptSystemInstructionSent) {
    diagString += "--- System Instruction Sent ---\n";
    diagString += truncateForCopy(logEntry.promptSystemInstructionSent) + "\n\n";
  }
   if (logEntry.promptFullUserPromptSent) {
    diagString += "--- Full User Prompt Sent ---\n";
    diagString += truncateForCopy(logEntry.promptFullUserPromptSent) + "\n";
  }

  diagString += "\n\n== Diff ==";
  diagString += `\n${logEntry.productDiff || "No diff generated for this version."}\n`;

  return diagString;
};
