// services/iterationUtils.ts

import type { OutputLength, OutputFormat, AiResponseValidationInfo, ReductionDetailValue, PromptLeakageDetailValue, IterationLogEntry, LoadedFile, OutlineGenerationResult, FileProcessingInfo, IsLikelyAiErrorResponseResult } from '../types/index.ts';
import { countWords } from './textAnalysisService.ts'; // Assuming countWords is exported

// --- Constants for Content Reduction Checks ---
const MIN_CHARS_FOR_REDUCTION_CHECK = 100;
const MIN_WORDS_FOR_REDUCTION_CHECK = 20;

const EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD = 0.25; // Output <25% of previous (char)
const EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD = 0.25; // Output <25% of previous (word)
const MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK = 500;
const EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS = 1000; // Threshold from user example

const DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD = 0.50;
const DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD = 0.50;

const SIGNIFICANT_REDUCTION_WITH_ERROR_PHRASE_THRESHOLD = 0.80; // new is <80% of old

// Initial Synthesis Check (Iteration 1 specific)
const INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_CHARS = 2.0;
const INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_CHARS_OUTLINE_DRIVEN = 50.0;
const MAX_INPUT_CHARS_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 = 500 * 1024;
const ABSOLUTE_MAX_CHARS_ITER1_PRODUCT = 1200000;

// Catastrophic Collapse Check
const MIN_CHARS_FOR_CATASTROPHIC_COLLAPSE = 20;
const MIN_WORDS_FOR_CATASTROPHIC_COLLAPSE = 5;
const PREVIOUS_MIN_CHARS_FOR_CATASTROPHIC_CHECK = 200; // Previous product must have been somewhat substantial

// Premature Convergence Check - Constants moved to strategistUtils.ts


const AI_ERROR_PHRASES = [
  "i'm sorry", "i am sorry", "my apologies",
  "i cannot", "i can't", "unable to", "i'm unable", "i am unable",
  "cannot fulfill this request", "can't process this request",
  "an error occurred", "encountered a problem", "failed to generate", "failed to process",
  "as a large language model", "as an ai language model",
  "i do not have the capability", "i'm not able to provide",
  "the request is unclear", "please provide more context",
  "violates policy", "content policy",
  "i'm ready. please provide the last sentence, paragraph, or idea that needs to be continued.",
  "i need the context to provide a relevant and coherent continuation.",
  "just paste the text here and i'll do my best to pick up where you left off!",
  "okay, i need the context from where i left off.",
  "please provide the last sentence or paragraph i generated, or a summary of the topic we were discussing, so i can continue the response appropriately and ensure completion.",
  "i'm ready to pick up where i left off!",
  "Okay, I'm ready! Please provide me with the text you want me to continue generating from. I will do my best to seamlessly pick up where I left off and complete the task you've assigned. Just give me the context I need!",
  "okay, i'm ready!", "please provide me with the text", "i need the previous part of the response",
  "once you provide the starting point", "what has already been said", "i'm ready when you are! just paste the text.",
  "what you've already written", "complete your response!", "complete the thought or idea.",
  "i look forward to hearing from you",
  "i'm eager to see where this goes",
  "let me know when you're ready",
  "what would you like me to do next?",
  "how can i help you continue?",
  "tell me how to proceed",
  "ready for more input",
  "provide the next part",
  "give me the next instruction",
  "once you provide the",
  "if you can provide the",
  "looking forward to your input",
  "happy to help further once you provide",
  "once you give me the last bit",
  "Okay, I'm ready! Please provide me with the text you want me to continue generating from.",
  "Please provide me with the text you would like me to continue generating from!",
  "Please provide the portion of the response that you would like me to continue generating from.",
  "Okay, I'm ready. Please provide me with the text you'd like me to continue generating from.",
  "Please provide me with the text you'd like me to continue generating from! I need the starting point",
];

// This is no longer the primary validation method for prompt leakage, as JSON output prevents it.
// Kept for historical reference or if a non-JSON mode is ever re-introduced.
const PROMPT_LEAKAGE_MARKERS = [
  "---FILE MANIFEST (Original Input Summary)---",
  "---CURRENT STATE OF PRODUCT (",
  "------------------------------------------",
  "CRITICAL CONTEXT OF ORIGINAL FILES:",
  "GLOBAL MODE DYNAMIC PARAMS:",
  "ITERATIVE PLAN MODE:",
  "GENERAL RULES:",
  "CRITICAL INITIAL SYNTHESIS (Version 1 from Files):",
  "Executing Iterative Plan Stage (Overall Version",
  "This is Version ",
  "Task: Initial Document Synthesis.",
];

export const isDataDump = (
  newProduct: string,
  fileProcessingInfo: FileProcessingInfo,
  isOutlineDriven: boolean
): { isError: boolean; reason: string } => {
  if (
    !fileProcessingInfo ||
    fileProcessingInfo.numberOfFilesActuallySent === 0 ||
    !fileProcessingInfo.loadedFilesForIterationContext ||
    fileProcessingInfo.loadedFilesForIterationContext.length === 0
  ) {
    return { isError: false, reason: "No file info to check for data dump." };
  }

  const newLengthChars = newProduct.length;
  const loadedFilesForIter1 = fileProcessingInfo.loadedFilesForIterationContext;
  const totalInputChars = loadedFilesForIter1.reduce((sum, f) => sum + f.content.length, 0);

  if (totalInputChars === 0) {
      return { isError: false, reason: "No text content in files to check for data dump." };
  }

  let synthesisFailed = false;
  let synthesisReason = "";

  const expansionFactor = isOutlineDriven
    ? INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_CHARS_OUTLINE_DRIVEN
    : INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_CHARS;

  if (newLengthChars > totalInputChars * expansionFactor) {
      synthesisFailed = true;
      synthesisReason = `Initial synthesis ${
        isOutlineDriven ? "(outline-driven)" : ""
      } resulted in output (${newLengthChars} chars) much larger (>${expansionFactor}x) than total input characters (${totalInputChars} chars).`;
  }

  if (
    !synthesisFailed &&
    totalInputChars < MAX_INPUT_CHARS_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 &&
    newLengthChars > ABSOLUTE_MAX_CHARS_ITER1_PRODUCT
  ) {
    synthesisFailed = true;
    synthesisReason = `Initial synthesis from files (<${
      MAX_INPUT_CHARS_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 / 1024
    }KB) ${
      isOutlineDriven ? "(outline-driven)" : ""
    } likely failed. Output product size (${newLengthChars} chars) exceeds absolute limit of ${ABSOLUTE_MAX_CHARS_ITER1_PRODUCT} chars.`;
  }

  if (synthesisFailed) {
    if (isOutlineDriven) {
      return {
        isError: false, // Tolerated
        reason: `${synthesisReason} This may be acceptable for outline-driven synthesis. Manual review advised.`,
      };
    } else {
      return {
        isError: true,
        reason: `CRITICAL: ${synthesisReason} This suggests a data dump rather than synthesis.`,
      };
    }
  }

  return { isError: false, reason: "Initial synthesis size is within tolerance." };
};


export function isLikelyAiErrorResponse(
  newProduct: string,
  previousProduct: string,
  currentLogEntryForValidation: IterationLogEntry,
  initialOutlineForIter1?: OutlineGenerationResult,
  lengthInstruction?: OutputLength,
  formatInstruction?: OutputFormat,
  inputComplexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX'
): IsLikelyAiErrorResponseResult {

  const newCleanedForErrorPhrases = newProduct.trim().toLowerCase();
  const newLengthChars = newProduct.trim().length;
  const prevLengthChars = previousProduct.trim().length;
  const newWordCount = countWords(newProduct);
  const prevWordCount = countWords(previousProduct);

  const isGlobalModeContext = !lengthInstruction && !formatInstruction;
  const isInstructedToShortenOrCondense = lengthInstruction === 'shorter' ||
                                      (formatInstruction && ['key_points', 'outline'].includes(formatInstruction));

  const lastApiCallDetails = currentLogEntryForValidation.apiStreamDetails && currentLogEntryForValidation.apiStreamDetails.length > 0
    ? currentLogEntryForValidation.apiStreamDetails[currentLogEntryForValidation.apiStreamDetails.length - 1]
    : null;

  // --- Start of Prioritized Critical Checks ---
  // NOTE: Prompt leakage is no longer checked here as structured JSON output from the AI prevents it.
  // The primary validation for that is now the JSON parsing step in geminiService.

  // 1. Problematic API Finish Reason + Minimal Output
  if (lastApiCallDetails) {
    const problematicFinishReasons = ["UNKNOWN", "OTHER", "FINISH_REASON_UNSPECIFIED"];
    if (lastApiCallDetails.finishReason && problematicFinishReasons.includes(lastApiCallDetails.finishReason) && newLengthChars < 50) {
      return { isError: true, isCriticalFailure: true, reason: `CRITICAL: API call finished with reason '${lastApiCallDetails.finishReason}' and produced minimal output (${newLengthChars} chars).`, checkDetails: { type: 'unknown_finish_reason_minimal_output', value: `API Finish Reason: ${lastApiCallDetails.finishReason}, Output Length: ${newLengthChars}` }};
    }
  }

  // 2. Catastrophic Collapse
  if (prevLengthChars >= PREVIOUS_MIN_CHARS_FOR_CATASTROPHIC_CHECK &&
      newLengthChars < MIN_CHARS_FOR_CATASTROPHIC_COLLAPSE &&
      newWordCount < MIN_WORDS_FOR_CATASTROPHIC_COLLAPSE &&
      !isInstructedToShortenOrCondense) {
    return {
        isError: true, isCriticalFailure: true,
        reason: `CRITICAL: AI response resulted in catastrophic content collapse (from ${prevLengthChars} chars to ${newLengthChars} chars) without instruction.`,
        checkDetails: { type: 'catastrophic_collapse', value: { previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, previousWordCount: prevWordCount, newWordCount: newWordCount } as any }
    };
  }


  // 3. Error Phrase Detection
  let foundErrorPhrase: string | null = null;
  for (const phrase of AI_ERROR_PHRASES) {
    if (newCleanedForErrorPhrases.includes(phrase.toLowerCase())) { foundErrorPhrase = phrase; break; }
  }

  // 4. Combined Error Phrase + Significant Uninstructed Reduction
  if (foundErrorPhrase && prevLengthChars > MIN_CHARS_FOR_REDUCTION_CHECK && newLengthChars < prevLengthChars * SIGNIFICANT_REDUCTION_WITH_ERROR_PHRASE_THRESHOLD && !isInstructedToShortenOrCondense) {
    return { isError: true, isCriticalFailure: true, reason: `CRITICAL: AI response contains an error/stall phrase ("${foundErrorPhrase}") AND resulted in significant content reduction (>20%) without instruction.`, checkDetails: { type: 'error_phrase_with_significant_reduction', value: { phrase: foundErrorPhrase, previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, percentageCharChange: parseFloat(((newLengthChars / prevLengthChars - 1) * 100).toFixed(2))} as any }};
  }
  
  // 5. Reduction Checks (Extreme and Drastic)
  if (prevLengthChars >= MIN_CHARS_FOR_REDUCTION_CHECK && prevWordCount >= MIN_WORDS_FOR_REDUCTION_CHECK) {
    const charPercentageChange = prevLengthChars > 0 ? (newLengthChars / prevLengthChars) : 1.0;
    const wordPercentageChange = prevWordCount > 0 ? (newWordCount / prevWordCount) : 1.0;
    const reductionDetailsBase: Omit<ReductionDetailValue, 'thresholdUsed' | 'additionalInfo'> = { previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, previousWordCount: prevWordCount, newWordCount: newWordCount, percentageCharChange: parseFloat(((charPercentageChange - 1) * 100).toFixed(2)), percentageWordChange: parseFloat(((wordPercentageChange - 1) * 100).toFixed(2)) };
    
    const isExtremeReduction = (charPercentageChange < EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD && wordPercentageChange < EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD) ||
                               (prevWordCount > MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK && (prevWordCount - newWordCount) > EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS);
    
    if (isExtremeReduction) {
        if (foundErrorPhrase) { return { isError: true, isCriticalFailure: true, reason: `CRITICAL: Extreme reduction combined with an error phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'extreme_reduction_instructed_but_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: 'extreme', additionalInfo: `Error phrase found: ${foundErrorPhrase}` }}}; }
        if (isInstructedToShortenOrCondense) { return { isError: false, isCriticalFailure: false, reason: 'Tolerated extreme reduction as instructed.', checkDetails: { type: 'extreme_reduction_tolerated_instruction', value: { ...reductionDetailsBase, thresholdUsed: 'extreme' }}}; }
        if (isGlobalModeContext) { return { isError: false, isCriticalFailure: false, reason: 'Tolerated extreme reduction in Global Mode, may be intentional restructuring.', checkDetails: { type: 'extreme_reduction_tolerated_global_mode', value: { ...reductionDetailsBase, thresholdUsed: 'extreme' }}}; }
        return { isError: true, isCriticalFailure: true, reason: `CRITICAL: Extreme uninstructed reduction of content occurred (over 75% reduction).`, checkDetails: { type: 'extreme_reduction_error', value: { ...reductionDetailsBase, thresholdUsed: 'extreme' }}};
    }
    
    const isDrasticReduction = charPercentageChange < DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD && wordPercentageChange < DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD;
    if (isDrasticReduction) {
        if (foundErrorPhrase) { return { isError: true, isCriticalFailure: false, reason: `Drastic reduction combined with an error phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'drastic_reduction_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: 'drastic', additionalInfo: `Error phrase found: ${foundErrorPhrase}` }}}; }
        if (isInstructedToShortenOrCondense) { return { isError: false, isCriticalFailure: false, reason: 'Tolerated drastic reduction as instructed.', checkDetails: { type: 'drastic_reduction_tolerated_instruction', value: { ...reductionDetailsBase, thresholdUsed: 'drastic' }}}; }
        if (isGlobalModeContext) { return { isError: false, isCriticalFailure: false, reason: 'Tolerated drastic reduction in Global Mode.', checkDetails: { type: 'drastic_reduction_tolerated_global_mode', value: { ...reductionDetailsBase, thresholdUsed: 'drastic' }}}; }
        return { isError: true, isCriticalFailure: false, reason: `Uninstructed drastic reduction of content (over 50% reduction).`, checkDetails: { type: 'uninstructed_reduction', value: { ...reductionDetailsBase, thresholdUsed: 'drastic' }}};
    }
  }


  // 6. Simple Error Phrase Check (if not combined with other issues)
  if (foundErrorPhrase) {
    // If the output is VERY short and contains an error phrase, it's a critical failure.
    if (newLengthChars < (foundErrorPhrase.length + 50)) {
       return { isError: true, isCriticalFailure: true, reason: `CRITICAL: AI response is minimal and consists almost entirely of an error/stall phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'error_phrase', value: `Phrase: ${foundErrorPhrase}` } };
    }
    // Otherwise, it's a non-critical error, allowing for retry.
    return { isError: true, isCriticalFailure: false, reason: `AI response contains a potential error/stall phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'error_phrase', value: `Phrase: ${foundErrorPhrase}` } };
  }


  // --- Final checks for less critical but still problematic outputs ---
  if (lastApiCallDetails?.finishReason === 'MAX_TOKENS') {
      const lastChar = newProduct.trim().slice(-1);
      if (/[a-zA-Z0-9]/.test(lastChar)) { // Ends mid-word or sentence
          return { isError: false, isCriticalFailure: false, reason: 'Warning: MAX_TOKENS reached with incomplete sentence. Auto-continuation will be triggered.', checkDetails: { type: 'max_tokens_with_incomplete_sentence' } };
      }
  }

  // If no other checks have returned an error, the response is considered valid.
  return { isError: false, isCriticalFailure: false, reason: 'Passed all validation checks.', checkDetails: { type: 'passed' } };
}

// Minimal placeholder for getProductSummary
export const getProductSummary = (product: string | null): string => {
  if (!product) return "No product yet.";
  const cleaned = product.replace(/\s+/g, ' ').trim();
  if (cleaned.length > 150) {
    return cleaned.substring(0, 147) + "...";
  }
  return cleaned;
};

// Minimal placeholder for parseAndCleanJsonOutput
export const parseAndCleanJsonOutput = (text: string): string => {
  try {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    const parsed = JSON.parse(jsonStr);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // It's possible the AI just returns the JSON without fences
    // if JSON is requested, so we still return the original text on failure.
    return text; // Return original text if parsing fails
  }
};