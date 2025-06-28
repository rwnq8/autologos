// services/iterationUtils.ts

import type { OutputLength, OutputFormat, IsLikelyAiErrorResponseResult, AiResponseValidationInfo, ReductionDetailValue, PromptLeakageDetailValue, IterationLogEntry, LoadedFile, OutlineGenerationResult } from '../types.ts';
import { countWords } from './textAnalysisService'; // Assuming countWords is exported

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
const INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES = 2.0;
const INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES_OUTLINE_DRIVEN = 50.0; // New factor for outline-driven
const CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT = 1.5;
const CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT_OUTLINE_DRIVEN = 25.0; // New factor for outline-driven

const TEXT_DOMINANT_THRESHOLD_PERCENT = 0.80;
const MAX_INPUT_BYTES_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 = 500 * 1024;
const ABSOLUTE_MAX_CHARS_ITER1_PRODUCT = 1200000;

// Catastrophic Collapse Check
const MIN_CHARS_FOR_CATASTROPHIC_COLLAPSE = 20;
const MIN_WORDS_FOR_CATASTROPHIC_COLLAPSE = 5;
const PREVIOUS_MIN_CHARS_FOR_CATASTROPHIC_CHECK = 200; // Previous product must have been somewhat substantial


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
  "Okay, I'm ready. Please provide me with the last part of the response I was working on, or the prompt that you'd like me to continue. I will do my best to seamlessly pick up where I left off and complete the task you've assigned. Just give me the context I need!",
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

const PROMPT_LEAKAGE_MARKERS = [
  "---FILE MANIFEST (Original Input Summary)---",
  "---CURRENT STATE OF PRODUCT (",
  "------------------------------------------",
  "REMINDER: Your response should be ONLY the new, modified textual product.",
  "NEW MODIFIED PRODUCT (Iteration ",
  "---PREVIOUSLY_GENERATED_PARTIAL_RESPONSE_THIS_ITERATION---",
  "---CONTINUATION_REQUEST---",
  "CRITICAL CONTEXT OF ORIGINAL FILES:",
  "GLOBAL MODE DYNAMIC PARAMS:",
  "ITERATIVE PLAN MODE:",
  "GENERAL RULES:",
  "CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files):",
  "Executing Iterative Plan Stage (Overall Iteration",
  "This is Iteration ",
  "Task: Initial Document Synthesis.",
  "Analyze & Refine:",
  "Substantial Change:",
  "Output:",
  "Adhere to Stage Goals:",
  "Formatting Details (if 'paragraph' format):",
  "JSON Output (if 'json' format):",
  "Content Consistency:",
  "Specific Instructions for Stage:"
];

export const CONVERGED_PREFIX = "CONVERGED:";
const PROMPT_LEAKAGE_SNIPPET_RADIUS = 50;

// Helper to estimate character count from base64 text data
const estimateCharsFromBase64Text = (base64Data: string): number => {
  try {
    const decoded = atob(base64Data);
    // This is a rough estimate; actual character count can vary with UTF-8
    return decoded.length;
  } catch (e) {
    return 0; // Error in decoding
  }
};


export function isLikelyAiErrorResponse(
  newProduct: string,
  previousProduct: string,
  currentLogEntryForValidation: IterationLogEntry,
  initialOutlineForIter1?: OutlineGenerationResult, // New parameter
  lengthInstruction?: OutputLength,
  formatInstruction?: OutputFormat
): IsLikelyAiErrorResponseResult {
  const newCleanedForErrorPhrases = newProduct.trim().toLowerCase();
  const newLengthChars = newProduct.trim().length;
  const prevLengthChars = previousProduct.trim().length;
  const newWordCount = countWords(newProduct);
  const prevWordCount = countWords(previousProduct);

  const isGlobalModeContext = !lengthInstruction && !formatInstruction;
  const isInstructedToShortenOrCondense = lengthInstruction === 'shorter' ||
                                      (formatInstruction && ['key_points', 'outline'].includes(formatInstruction));


  // --- Start of Prioritized Critical Checks ---

  // 1. Problematic API Finish Reason + Minimal Output
  if (currentLogEntryForValidation.apiStreamDetails && currentLogEntryForValidation.apiStreamDetails.length > 0) {
    const lastApiCall = currentLogEntryForValidation.apiStreamDetails[currentLogEntryForValidation.apiStreamDetails.length - 1];
    const problematicFinishReasons = ["UNKNOWN", "OTHER", "FINISH_REASON_UNSPECIFIED"];
    if (lastApiCall.finishReason && problematicFinishReasons.includes(lastApiCall.finishReason) && newLengthChars < 50) {
      return { isError: true, reason: `CRITICAL: API call finished with reason '${lastApiCall.finishReason}' and produced minimal output (${newLengthChars} chars).`, checkDetails: { type: 'error_phrase', value: `API Finish Reason: ${lastApiCall.finishReason}, Output Length: ${newLengthChars}` }};
    }
  }

  // 2. Prompt Leakage
  for (const marker of PROMPT_LEAKAGE_MARKERS) {
    let isActualLeak = false; let markerIndexForSnippet = -1;
    if (marker === "Output:") { /* ... (existing complex marker check) ... */ }
    else if (marker === "------------------------------------------") { /* ... (existing complex marker check) ... */ }
    else { const foundIndex = newProduct.indexOf(marker); if (foundIndex !== -1) { isActualLeak = true; markerIndexForSnippet = foundIndex; } }
    if (isActualLeak && markerIndexForSnippet !== -1) {
      const snippetStart = Math.max(0, markerIndexForSnippet - PROMPT_LEAKAGE_SNIPPET_RADIUS);
      const snippetEnd = Math.min(newProduct.length, markerIndexForSnippet + marker.length + PROMPT_LEAKAGE_SNIPPET_RADIUS);
      const snippet = newProduct.substring(snippetStart, snippetEnd).replace(/\n/g, '\\n');
      return { isError: true, reason: `CRITICAL: AI response appears to contain parts of the input prompt instructions (marker: "${marker}").`, checkDetails: { type: 'prompt_leakage', value: { marker, snippet } as PromptLeakageDetailValue }};
    }
  }

  // 3. Catastrophic Collapse
  if (prevLengthChars >= PREVIOUS_MIN_CHARS_FOR_CATASTROPHIC_CHECK &&
      newLengthChars < MIN_CHARS_FOR_CATASTROPHIC_COLLAPSE &&
      newWordCount < MIN_WORDS_FOR_CATASTROPHIC_COLLAPSE &&
      !isInstructedToShortenOrCondense) {
    return {
        isError: true,
        reason: `CRITICAL: AI response resulted in catastrophic content collapse (from ${prevLengthChars} chars to ${newLengthChars} chars) without instruction.`,
        checkDetails: { type: 'catastrophic_collapse', value: { previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, previousWordCount: prevWordCount, newWordCount: newWordCount } as any }
    };
  }


  // 4. Error Phrase Detection
  let foundErrorPhrase: string | null = null;
  for (const phrase of AI_ERROR_PHRASES) {
    if (newCleanedForErrorPhrases.includes(phrase.toLowerCase())) { foundErrorPhrase = phrase; break; }
  }

  // 5. Combined Error Phrase + Significant Uninstructed Reduction
  if (foundErrorPhrase && prevLengthChars > MIN_CHARS_FOR_REDUCTION_CHECK && newLengthChars < prevLengthChars * SIGNIFICANT_REDUCTION_WITH_ERROR_PHRASE_THRESHOLD && !isInstructedToShortenOrCondense) {
    return { isError: true, reason: `CRITICAL: AI response contains an error/stall phrase ("${foundErrorPhrase}") AND resulted in significant content reduction (>20%) without instruction.`, checkDetails: { type: 'error_phrase_with_significant_reduction', value: { phrase: foundErrorPhrase, previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, percentageCharChange: parseFloat(((newLengthChars / prevLengthChars - 1) * 100).toFixed(2))} as any }};
  }

  // 6. Initial Synthesis Check for Iteration 1 (Large Output vs Input)
  if (currentLogEntryForValidation.iteration === 1 &&
      currentLogEntryForValidation.fileProcessingInfo &&
      currentLogEntryForValidation.fileProcessingInfo.numberOfFilesActuallySent > 0 &&
      currentLogEntryForValidation.fileProcessingInfo.totalFilesSizeBytesSent > 0) {

    const { totalFilesSizeBytesSent } = currentLogEntryForValidation.fileProcessingInfo;
    const loadedFilesForIter1 = currentLogEntryForValidation.fileProcessingInfo.loadedFilesForIterationContext || [];
    let synthesisFailed = false;
    let synthesisReason = "";
    const isOutlineDriven = !!initialOutlineForIter1;

    const textFiles = loadedFilesForIter1.filter(f => f.mimeType.startsWith('text/'));
    const isTextDominant = textFiles.length / loadedFilesForIter1.length >= TEXT_DOMINANT_THRESHOLD_PERCENT ||
                           textFiles.reduce((sum, f) => sum + f.size, 0) / totalFilesSizeBytesSent >= TEXT_DOMINANT_THRESHOLD_PERCENT;

    let currentTextDominantFactor = isOutlineDriven ? CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT_OUTLINE_DRIVEN : CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT;
    let currentByteExpansionFactor = isOutlineDriven ? INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES_OUTLINE_DRIVEN : INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES;

    if (isTextDominant) {
      const totalEstimatedInputChars = textFiles.reduce((sum, f) => sum + estimateCharsFromBase64Text(f.base64Data), 0);
      if (totalEstimatedInputChars > 0 && newLengthChars > totalEstimatedInputChars * currentTextDominantFactor) {
        synthesisFailed = true;
        synthesisReason = `Initial synthesis from text-dominant files ${isOutlineDriven ? "(outline-driven)" : ""} resulted in output (${newLengthChars} chars) much larger (>${currentTextDominantFactor}x) than input characters (${totalEstimatedInputChars} chars).`;
      }
    }

    if (!synthesisFailed && totalFilesSizeBytesSent < MAX_INPUT_BYTES_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 && newLengthChars > ABSOLUTE_MAX_CHARS_ITER1_PRODUCT) {
      synthesisFailed = true;
      synthesisReason = `Initial synthesis from files (<${MAX_INPUT_BYTES_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 / 1024}KB) ${isOutlineDriven ? "(outline-driven)" : ""} likely failed. Output product size (${newLengthChars} chars) exceeds absolute limit of ${ABSOLUTE_MAX_CHARS_ITER1_PRODUCT} chars.`;
    }

    if (!synthesisFailed && newLengthChars > totalFilesSizeBytesSent * currentByteExpansionFactor) {
        synthesisFailed = true;
        synthesisReason = `Initial synthesis ${isOutlineDriven ? "(outline-driven)" : ""} resulted in output (${newLengthChars} chars) much larger (>${currentByteExpansionFactor}x) than total input file size (${totalFilesSizeBytesSent} bytes).`;
    }

    if (synthesisFailed) {
      if (isOutlineDriven) {
        // For outline-driven synthesis, large expansion might be acceptable.
        return {
          isError: false, // Not a critical error, but a note.
          reason: `${synthesisReason} This may be acceptable for outline-driven synthesis. Manual review advised.`,
          checkDetails: {
            type: 'initial_synthesis_tolerated_large_output_outline_driven',
            value: { inputBytes: totalFilesSizeBytesSent, outputChars: newLengthChars, isOutlineDriven: true, factorUsed: isTextDominant ? currentTextDominantFactor : currentByteExpansionFactor } as any
          }
        };
      } else {
        // For non-outline-driven, this is likely a critical error.
        return {
          isError: true,
          reason: `CRITICAL: ${synthesisReason} This suggests a data dump rather than synthesis.`,
          checkDetails: { type: 'initial_synthesis_failed_large_output', value: { inputBytes: totalFilesSizeBytesSent, outputChars: newLengthChars, isOutlineDriven: false } as any }
        };
      }
    }
  }


  // 7. Reduction Checks (Extreme and Drastic)
  if (prevLengthChars >= MIN_CHARS_FOR_REDUCTION_CHECK && prevWordCount >= MIN_WORDS_FOR_REDUCTION_CHECK) {
    const charPercentageChange = prevLengthChars > 0 ? (newLengthChars / prevLengthChars) : 1.0;
    const wordPercentageChange = prevWordCount > 0 ? (newWordCount / prevWordCount) : 1.0;
    const reductionDetailsBase: Omit<ReductionDetailValue, 'thresholdUsed' | 'additionalInfo'> = { previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, previousWordCount: prevWordCount, newWordCount: newWordCount, percentageCharChange: parseFloat(((charPercentageChange - 1) * 100).toFixed(2)), percentageWordChange: parseFloat(((wordPercentageChange - 1) * 100).toFixed(2)) };

    let isExtremeReduction = false; let extremeReason = ""; let extremeThresholdUsed = "";
    if (charPercentageChange < EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD) { isExtremeReduction = true; extremeReason = "EXTREME content reduction (char length)"; extremeThresholdUsed = `CHAR_PERCENT_LT_${EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD.toFixed(2)}`; }
    else if (wordPercentageChange < EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD) { isExtremeReduction = true; extremeReason = "EXTREME content reduction (word count)"; extremeThresholdUsed = `WORD_PERCENT_LT_${EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD.toFixed(2)}`; }
    else if (prevWordCount >= MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK && (prevWordCount - newWordCount) > EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS) { isExtremeReduction = true; extremeReason = `EXTREME content reduction (absolute loss > ${EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS} words)`; extremeThresholdUsed = `ABSOLUTE_WORD_LOSS_GT_${EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS}`; }

    if (isExtremeReduction) {
      const fullReasonPrefix = `AI response resulted in ${extremeReason}. Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars.`;
      if (isInstructedToShortenOrCondense) {
        if (foundErrorPhrase) {
          return { isError: true, reason: `CRITICAL: ${fullReasonPrefix} Instructed to shorten, but also contains error phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'extreme_reduction_instructed_but_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed, additionalInfo: `Error phrase: "${foundErrorPhrase}"` } }};
        }
        return { isError: false, reason: `${fullReasonPrefix} Tolerated as shortening was instructed.`, checkDetails: { type: 'extreme_reduction_tolerated_instruction', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed } }};
      } else { // Not instructed to shorten
        if (foundErrorPhrase) { // Already caught by combo check, but for clarity if it were to reach here
            return { isError: true, reason: `CRITICAL: ${fullReasonPrefix} Uninstructed, and contains error phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'error_phrase_with_significant_reduction', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed, additionalInfo: `Error phrase: "${foundErrorPhrase}"`, phrase: foundErrorPhrase } as any }};
        }
        if (isGlobalModeContext) {
          return { isError: false, reason: `${fullReasonPrefix} Tolerated in Global Mode.`, checkDetails: { type: 'extreme_reduction_tolerated_global_mode', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed } }};
        }
        return { isError: true, reason: `CRITICAL: ${fullReasonPrefix} Uninstructed and not in Global Mode (e.g., Plan Mode).`, checkDetails: { type: 'extreme_reduction_error', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed } }};
      }
    }

    // Drastic Reduction (if not extreme)
    let isDrasticReduction = false; let drasticReason = ""; let drasticThresholdUsed = "";
    if (charPercentageChange < DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD) { isDrasticReduction = true; drasticReason = "DRASTIC content reduction (char length)"; drasticThresholdUsed = `DRASTIC_CHAR_PERCENT_LT_${DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD.toFixed(2)}`; }
    else if (wordPercentageChange < DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD) { isDrasticReduction = true; drasticReason = "DRASTIC content reduction (word count)"; drasticThresholdUsed = `DRASTIC_WORD_PERCENT_LT_${DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD.toFixed(2)}`; }

    if (isDrasticReduction) {
      const fullReasonPrefix = `AI response resulted in ${drasticReason}. Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars.`;
      if (isInstructedToShortenOrCondense) {
        if (foundErrorPhrase) {
          return { isError: true, reason: `CRITICAL: ${fullReasonPrefix} Instructed to shorten, but also contains error phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'drastic_reduction_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed, additionalInfo: `Error phrase: "${foundErrorPhrase}"` } }};
        }
        return { isError: false, reason: `${fullReasonPrefix} Tolerated as shortening was instructed.`, checkDetails: { type: 'drastic_reduction_tolerated_instruction', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed } }};
      } else { // Not instructed to shorten
        if (foundErrorPhrase) { // Already caught by combo check
            return { isError: true, reason: `CRITICAL: ${fullReasonPrefix} Uninstructed, and contains error phrase ("${foundErrorPhrase}").`, checkDetails: { type: 'drastic_reduction_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed, additionalInfo: `Error phrase: "${foundErrorPhrase}"` } }};
        }
        if (isGlobalModeContext) {
          return { isError: false, reason: `${fullReasonPrefix} Tolerated in Global Mode.`, checkDetails: { type: 'drastic_reduction_tolerated_global_mode', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed } }};
        }
        return { isError: true, reason: `CRITICAL: ${fullReasonPrefix} Uninstructed and not in Global Mode (e.g., Plan Mode).`, checkDetails: { type: 'drastic_reduction_error_plan_mode', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed } }};
      }
    }
  }

  // --- Lower Priority Checks ---

  // 8. Empty JSON response
  if (newLengthChars === 0 && formatInstruction === 'json') {
    return { isError: true, reason: "AI returned an empty response when JSON format was expected.", checkDetails: { type: 'empty_json' }};
  }

  // 9. Invalid JSON if JSON is expected
  const looksLikeJsonAttempt = newProduct.trim().startsWith("{") || newProduct.trim().startsWith("[");
  if ((formatInstruction === 'json' || (formatInstruction === 'auto' && looksLikeJsonAttempt)) && newLengthChars > 0) {
    try { JSON.parse(newProduct); } catch (e: any) {
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; const match = newProduct.trim().match(fenceRegex); let parsedFromFence = false;
      if (match && match[2]) { try { JSON.parse(match[2].trim()); parsedFromFence = true; } catch (e2: any) {} }
      if (!parsedFromFence) { return { isError: true, reason: `AI response for format '${formatInstruction}' (or auto-detected JSON) is not valid JSON: ${e.message}`, checkDetails: { type: 'invalid_json', value: `Error: ${e.message}. Attempted fenced extraction: ${match ? 'Yes, but failed' : 'No fence found'}` }}; }
    }
  }

  // 10. Standalone error phrases (if not caught by combo check and new product is short)
  const MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR = 60;
  if (foundErrorPhrase && (newCleanedForErrorPhrases.length < MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR && newCleanedForErrorPhrases.length < (foundErrorPhrase.length + 20))) {
     return { isError: true, reason: `AI response is very short and appears to be primarily an error/stall phrase: "${foundErrorPhrase}"`, checkDetails: { type: 'error_phrase', value: foundErrorPhrase }};
  }

  // Fallback: If an error phrase was found but didn't trigger any more specific checks (and product isn't very short)
  if (foundErrorPhrase) {
    return { isError: true, reason: `AI response appears to be a meta-comment or error, including the phrase: "${foundErrorPhrase}"`, checkDetails: { type: 'error_phrase', value: foundErrorPhrase }};
  }

  return { isError: false, reason: "AI response passed validation checks.", checkDetails: { type: 'passed' }};
}

export const getProductSummary = (productText: string | undefined | null): string => {
  if (!productText) return "N/A";
  const limit = 100;
  const cleanedText = productText.replace(/\s+/g, ' ').trim();
  return cleanedText.length > limit ? cleanedText.substring(0, limit - 3) + "..." : cleanedText;
};

export const parseAndCleanJsonOutput = (rawJsonString: string): string => {
  if (!rawJsonString || typeof rawJsonString !== 'string') return typeof rawJsonString === 'string' ? rawJsonString : '';
  let jsonStr = rawJsonString.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; const match = jsonStr.match(fenceRegex);
  if (match && match[2]) jsonStr = match[2].trim();
  try { const parsedData = JSON.parse(jsonStr); return JSON.stringify(parsedData, null, 2); } catch (e) { return jsonStr; }
};


declare module '../types.ts' {
  interface FileProcessingInfo {
    loadedFilesForIterationContext?: LoadedFile[];
  }
  interface AiResponseValidationInfoDetailsValue { // To extend the union type for value
      isOutlineDriven?: boolean;
      factorUsed?: number;
  }
  interface AiResponseValidationInfoDetails { // To extend the union type for type
    type: // ... existing types
      | 'initial_synthesis_tolerated_large_output_outline_driven'; // Add new type
  }
}
