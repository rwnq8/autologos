
// services/iterationUtils.ts

import type { OutputLength, OutputFormat, IsLikelyAiErrorResponseResult, AiResponseValidationInfo, ReductionDetailValue, PromptLeakageDetailValue, IterationLogEntry, LoadedFile } from '../types.ts';
import { countWords } from './textAnalysisService'; // Assuming countWords is exported

// --- Constants for Content Reduction Checks ---
const MIN_CHARS_FOR_REDUCTION_CHECK = 100;
const MIN_WORDS_FOR_REDUCTION_CHECK = 20;

const EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD = 0.25; // Output <25% of previous (char)
const EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD = 0.25; // Output <25% of previous (word)
const MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK = 500;
const EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS = 1000;

const DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD = 0.50;
const DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD = 0.50;

const SIGNIFICANT_REDUCTION_WITH_ERROR_PHRASE_THRESHOLD = 0.80; // new is <80% of old

// Initial Synthesis Check (Iteration 1 specific)
const INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES = 2.0; // Stricter: output chars > 2.0 * input bytes
const CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT = 1.5; // For text-heavy input, output chars > 1.5 * input chars
const TEXT_DOMINANT_THRESHOLD_PERCENT = 0.80; // If >80% of files (by count or size) are text
const MAX_INPUT_BYTES_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 = 500 * 1024; // 500KB
const ABSOLUTE_MAX_CHARS_ITER1_PRODUCT = 1200000; // 1.2M chars absolute cap for Iter 1 if input is <500KB


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
  lengthInstruction?: OutputLength,
  formatInstruction?: OutputFormat
): IsLikelyAiErrorResponseResult {
  const newCleanedForErrorPhrases = newProduct.trim().toLowerCase();
  const newLengthChars = newProduct.trim().length;
  const prevLengthChars = previousProduct.trim().length;

  const newWordCount = countWords(newProduct);
  const prevWordCount = countWords(previousProduct);

  const isGlobalModeContext = !lengthInstruction && !formatInstruction;
  const isInstructedToShorten = lengthInstruction === 'shorter';

  // --- Start of Prioritized Critical Checks ---

  // 1. Check for Prompt Leakage (CRITICAL)
  for (const marker of PROMPT_LEAKAGE_MARKERS) {
    let isActualLeak = false;
    let markerIndexForSnippet = -1;

    if (marker === "Output:") {
      let searchIndex = 0;
      let tempMarkerIndex = -1;
      while ((tempMarkerIndex = newProduct.indexOf(marker, searchIndex)) !== -1) {
        const followingText = newProduct.substring(tempMarkerIndex + marker.length, tempMarkerIndex + marker.length + 30).toLowerCase();
        if (followingText.trim().startsWith("provide only") || followingText.trim().startsWith("the new modified textual product") || followingText.trim().startsWith("the modified text")) {
          isActualLeak = true; markerIndexForSnippet = tempMarkerIndex; break;
        }
        searchIndex = tempMarkerIndex + 1;
      }
    } else if (marker === "------------------------------------------") {
        let searchIndex = 0; let tempMarkerIndex = -1;
        while ((tempMarkerIndex = newProduct.indexOf(marker, searchIndex)) !== -1) {
            const lineStartIndex = newProduct.lastIndexOf('\n', tempMarkerIndex) + 1;
            let lineEndIndex = newProduct.indexOf('\n', tempMarkerIndex);
            if (lineEndIndex === -1) lineEndIndex = newProduct.length;
            const lineContent = newProduct.substring(lineStartIndex, lineEndIndex).trim();
            if (lineContent === marker) { isActualLeak = true; markerIndexForSnippet = tempMarkerIndex; break; }
            searchIndex = tempMarkerIndex + marker.length;
        }
    } else {
      const foundIndex = newProduct.indexOf(marker);
      if (foundIndex !== -1) { isActualLeak = true; markerIndexForSnippet = foundIndex; }
    }

    if (isActualLeak && markerIndexForSnippet !== -1) {
      const snippetStart = Math.max(0, markerIndexForSnippet - PROMPT_LEAKAGE_SNIPPET_RADIUS);
      const snippetEnd = Math.min(newProduct.length, markerIndexForSnippet + marker.length + PROMPT_LEAKAGE_SNIPPET_RADIUS);
      const snippet = newProduct.substring(snippetStart, snippetEnd).replace(/\n/g, '\\n');
      return { isError: true, reason: `AI response appears to contain parts of the input prompt instructions (marker: "${marker}"). This indicates AI confusion.`, checkDetails: { type: 'prompt_leakage', value: { marker, snippet } as PromptLeakageDetailValue }};
    }
  }

  // 2. Check for combined Error Phrase + Significant Uninstructed Reduction (CRITICAL)
  let foundErrorPhrase: string | null = null;
  for (const phrase of AI_ERROR_PHRASES) {
    if (newCleanedForErrorPhrases.includes(phrase.toLowerCase())) {
        foundErrorPhrase = phrase; break;
    }
  }

  if (foundErrorPhrase && prevLengthChars > MIN_CHARS_FOR_REDUCTION_CHECK && newLengthChars < prevLengthChars * SIGNIFICANT_REDUCTION_WITH_ERROR_PHRASE_THRESHOLD && !isInstructedToShorten) {
    return {
        isError: true,
        reason: `CRITICAL: AI response contains an error/stall phrase ("${foundErrorPhrase}") AND resulted in significant content reduction (>20%, from ${prevLengthChars} to ${newLengthChars} chars) without instruction.`,
        checkDetails: { type: 'error_phrase_with_significant_reduction', value: { phrase: foundErrorPhrase, previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, percentageCharChange: parseFloat(((newLengthChars / prevLengthChars - 1) * 100).toFixed(2))} as any }
    };
  }

  // 3. Extreme Reduction Check (CRITICAL if not instructed to shorten)
  if (prevLengthChars >= MIN_CHARS_FOR_REDUCTION_CHECK && prevWordCount >= MIN_WORDS_FOR_REDUCTION_CHECK) {
    const charPercentageChange = prevLengthChars > 0 ? (newLengthChars / prevLengthChars) : 1.0;
    const wordPercentageChange = prevWordCount > 0 ? (newWordCount / prevWordCount) : 1.0;
    const reductionDetailsBase: Omit<ReductionDetailValue, 'thresholdUsed' | 'additionalInfo'> = { previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, previousWordCount: prevWordCount, newWordCount: newWordCount, percentageCharChange: parseFloat(((charPercentageChange - 1) * 100).toFixed(2)), percentageWordChange: parseFloat(((wordPercentageChange - 1) * 100).toFixed(2)) };
    let isExtremeReduction = false; let extremeReason = ""; let extremeThresholdUsed = "";

    if (charPercentageChange < EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD) {
        isExtremeReduction = true; extremeReason = `AI response resulted in EXTREME content reduction (char length < ${EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD*100}% of previous).`; extremeThresholdUsed = `CHAR_PERCENT_LT_${EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD.toFixed(2)}`;
    } else if (wordPercentageChange < EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD) {
        isExtremeReduction = true; extremeReason = `AI response resulted in EXTREME content reduction (word count < ${EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD*100}% of previous).`; extremeThresholdUsed = `WORD_PERCENT_LT_${EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD.toFixed(2)}`;
    }
    if (!isExtremeReduction && prevWordCount >= MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK && (prevWordCount - newWordCount) > EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS) {
        isExtremeReduction = true; extremeReason = `AI response resulted in EXTREME content reduction (absolute loss > ${EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS} words from a large document).`; extremeThresholdUsed = `ABSOLUTE_WORD_LOSS_GT_${EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS}`;
    }

    if (isExtremeReduction) {
      const additionalInfoForLog = foundErrorPhrase ? `Also contains error phrase: "${foundErrorPhrase}"` : undefined;
      const fullExtremeReason = `${extremeReason} Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars.`;
      if (isInstructedToShorten && foundErrorPhrase) {
        return { isError: true, reason: `CRITICAL: ${fullExtremeReason} Shortening was requested, but response also contains an error/stall phrase ("${foundErrorPhrase}"). Process halted.`, checkDetails: { type: 'extreme_reduction_instructed_but_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed, additionalInfo: `Error phrase: "${foundErrorPhrase}"` } as ReductionDetailValue }};
      } else if (!isInstructedToShorten) {
        return { isError: true, reason: `CRITICAL: ${fullExtremeReason} Process halted.`, checkDetails: { type: 'extreme_reduction_error', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed, additionalInfo: additionalInfoForLog } as ReductionDetailValue }};
      } else {
         return { isError: false, reason: `${fullExtremeReason} Extreme reduction occurred but was requested ('shorter' length instruction) and no error phrase detected.`, checkDetails: { type: 'extreme_reduction_tolerated_global_mode', value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed, additionalInfo: "Shortening instruction active." } as ReductionDetailValue }};
      }
    }
  }

  // 4. Initial Synthesis Check for Iteration 1 Output (CRITICAL)
  if (currentLogEntryForValidation.iteration === 1 && currentLogEntryForValidation.fileProcessingInfo && currentLogEntryForValidation.fileProcessingInfo.numberOfFilesActuallySent > 1 && currentLogEntryForValidation.fileProcessingInfo.totalFilesSizeBytesSent > 0) {
    const { totalFilesSizeBytesSent, filesSentToApiIteration } = currentLogEntryForValidation.fileProcessingInfo;
    const loadedFilesForIter1 = currentLogEntryForValidation.fileProcessingInfo.loadedFilesForIterationContext || []; // Assume this is passed if needed

    let synthesisFailed = false;
    let synthesisReason = "";
    
    // Heuristic 1: Text-dominant input compare output chars to input chars
    const textFiles = loadedFilesForIter1.filter(f => f.mimeType.startsWith('text/'));
    if (textFiles.length / loadedFilesForIter1.length >= TEXT_DOMINANT_THRESHOLD_PERCENT || textFiles.reduce((sum, f) => sum + f.size, 0) / totalFilesSizeBytesSent >= TEXT_DOMINANT_THRESHOLD_PERCENT ) {
      const totalEstimatedInputChars = textFiles.reduce((sum, f) => sum + estimateCharsFromBase64Text(f.base64Data), 0);
      if (totalEstimatedInputChars > 0 && newLengthChars > totalEstimatedInputChars * CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT) {
        synthesisFailed = true;
        synthesisReason = `Initial synthesis from text-dominant files likely failed. Output product size (${newLengthChars} chars) is much larger (>${CHAR_EXPANSION_FACTOR_ITER1_TEXT_DOMINANT}x) than estimated input character count (${totalEstimatedInputChars} chars).`;
      }
    }

    // Heuristic 2 (Fallback or for mixed/binary): Absolute char limit for smaller inputs
    if (!synthesisFailed && totalFilesSizeBytesSent < MAX_INPUT_BYTES_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 && newLengthChars > ABSOLUTE_MAX_CHARS_ITER1_PRODUCT) {
      synthesisFailed = true;
      synthesisReason = `Initial synthesis from files (<${MAX_INPUT_BYTES_FOR_ABSOLUTE_CHAR_LIMIT_ITER1 / 1024}KB) likely failed. Output product size (${newLengthChars} chars) exceeds absolute limit of ${ABSOLUTE_MAX_CHARS_ITER1_PRODUCT} chars.`;
    }
    
    // Heuristic 3 (Original byte-to-char, stricter factor)
    if (!synthesisFailed && newLengthChars > totalFilesSizeBytesSent * INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES) {
        synthesisFailed = true;
        synthesisReason = `Initial synthesis from multiple files likely failed. Output product size (${newLengthChars} chars) is excessively larger (>${INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES}x) than total input file size (${totalFilesSizeBytesSent} bytes).`;
    }

    if (synthesisFailed) {
      return { isError: true, reason: `CRITICAL: ${synthesisReason} This suggests a data dump rather than synthesis.`, checkDetails: { type: 'initial_synthesis_failed_large_output', value: { inputBytes: totalFilesSizeBytesSent, outputChars: newLengthChars, factorUsed: INITIAL_SYNTHESIS_OUTPUT_SIZE_FACTOR_VS_INPUT_BYTES } as any }};
    }
  }
  // --- End of Prioritized Critical Checks ---

  // 5. Check for Empty JSON response
  if (newLengthChars === 0 && formatInstruction === 'json') {
    return { isError: true, reason: "AI returned an empty response when JSON format was expected.", checkDetails: { type: 'empty_json' }};
  }

  // 6. Check for standalone error phrases (if not caught by combo check and new product is short)
  const MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR = 60;
  if (foundErrorPhrase && (newCleanedForErrorPhrases.length < MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR && newCleanedForErrorPhrases.length < (foundErrorPhrase.length + 20))) {
     return { isError: true, reason: `AI response is very short and appears to be primarily an error/stall phrase: "${foundErrorPhrase}"`, checkDetails: { type: 'error_phrase', value: foundErrorPhrase }};
  }

  // 7. Drastic Reduction Check (Not critical in Global Mode unless an error phrase is also present)
  const mightNaturallyShortenDueToFormat = formatInstruction && ['auto', 'json', 'key_points', 'outline'].includes(formatInstruction);
  if (prevLengthChars >= MIN_CHARS_FOR_REDUCTION_CHECK && prevWordCount >= MIN_WORDS_FOR_REDUCTION_CHECK) {
    const charPercentageChange = prevLengthChars > 0 ? (newLengthChars / prevLengthChars) : 1.0;
    const wordPercentageChange = prevWordCount > 0 ? (newWordCount / prevWordCount) : 1.0;
    const reductionDetailsBase: Omit<ReductionDetailValue, 'thresholdUsed' | 'additionalInfo'> = { previousLengthChars: prevLengthChars, newLengthChars: newLengthChars, previousWordCount: prevWordCount, newWordCount: newWordCount, percentageCharChange: parseFloat(((charPercentageChange - 1) * 100).toFixed(2)), percentageWordChange: parseFloat(((wordPercentageChange - 1) * 100).toFixed(2)) };
    if (!isInstructedToShorten && !mightNaturallyShortenDueToFormat) {
      let isDrasticReduction = false; let drasticReason = ""; let drasticThresholdUsed = "";
      if (charPercentageChange < DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD) {
          isDrasticReduction = true; drasticReason = `AI response is drastically shorter (char length < ${DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD*100}% of previous).`; drasticThresholdUsed = `DRASTIC_CHAR_PERCENT_LT_${DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD.toFixed(2)}`;
      } else if (wordPercentageChange < DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD) {
          isDrasticReduction = true; drasticReason = `AI response is drastically shorter (word count < ${DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD*100}% of previous).`; drasticThresholdUsed = `DRASTIC_WORD_PERCENT_LT_${DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD.toFixed(2)}`;
      }
      if (isDrasticReduction) {
        const fullDrasticReason = `${drasticReason} Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars.`;
        if (foundErrorPhrase) {
             return { isError: true, reason: `${fullDrasticReason} Also contains error/stall phrase ("${foundErrorPhrase}"). Flagged as error.`, checkDetails: { type: 'drastic_reduction_with_error_phrase', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed, additionalInfo: `Error phrase: "${foundErrorPhrase}"` } as ReductionDetailValue }};
        }
        if (!isGlobalModeContext) {
          return { isError: true, reason: `${fullDrasticReason} This is flagged as an error in Plan Mode or when specific output structure is expected.`, checkDetails: { type: 'drastic_reduction_error_plan_mode', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed } as ReductionDetailValue }};
        } else {
          return { isError: false, reason: `${fullDrasticReason} This level of reduction is tolerated in Global Mode but noted.`, checkDetails: { type: 'drastic_reduction_tolerated_global_mode', value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed } as ReductionDetailValue }};
        }
      }
    }
  }

  // 8. Check for Invalid JSON if JSON is expected
  const looksLikeJsonAttempt = newProduct.trim().startsWith("{") || newProduct.trim().startsWith("[");
  if ((formatInstruction === 'json' || (formatInstruction === 'auto' && looksLikeJsonAttempt)) && newLengthChars > 0) {
    try { JSON.parse(newProduct); } catch (e: any) {
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; const match = newProduct.trim().match(fenceRegex); let parsedFromFence = false;
      if (match && match[2]) { try { JSON.parse(match[2].trim()); parsedFromFence = true; } catch (e2: any) {} }
      if (!parsedFromFence) { return { isError: true, reason: `AI response for format '${formatInstruction}' (or auto-detected JSON) is not valid JSON: ${e.message}`, checkDetails: { type: 'invalid_json', value: `Error: ${e.message}. Attempted fenced extraction: ${match ? 'Yes, but failed' : 'No fence found'}` }}; }
    }
  }

  // 9. Fallback: If an error phrase was found but didn't trigger any more specific checks
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

// Add `loadedFilesForIterationContext` to `FileProcessingInfo` if it's not already there.
// This is needed for the refined `initial_synthesis_failed_large_output` check.
// The type change will be in `types.ts`.
declare module '../types.ts' {
  interface FileProcessingInfo {
    loadedFilesForIterationContext?: LoadedFile[];
  }
}
