// services/iterationUtils.ts

import type { OutputLength, OutputFormat, IsLikelyAiErrorResponseResult, AiResponseValidationInfo, ReductionDetailValue } from '../types.ts';
import { countWords } from './textAnalysisService'; // Assuming countWords is exported

// --- Constants for Content Reduction Checks ---
// These apply to character lengths primarily, with word counts as secondary checks/logging.

// For 'isLikelyAiErrorResponse' checks:
const MIN_CHARS_FOR_REDUCTION_CHECK = 100; // Min char length of previous product to apply reduction checks.
const MIN_WORDS_FOR_REDUCTION_CHECK = 20;  // Min word length of previous product for word-based checks.

// **Extreme Reduction (CRITICAL ERROR - Halts Process in ALL MODES unless adapted for Global Mode)**
const EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD = 0.20; // New product is < 20% of old (char length)
const EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD = 0.20; // New product is < 20% of old (word count)
// Absolute loss checks for larger documents to catch significant deletions even if percentage isn't extreme
const MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK = 500; // Only apply absolute word loss if previous doc was substantial
const EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS = 1000;       // e.g., losing >1000 words

// **Drastic Reduction (Suspicious - Error in Plan Mode, Tolerated but Logged in Global Mode)**
const DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD = 0.50; // New product is < 50% of old (char length)
const DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD = 0.50; // New product is < 50% of old (word count)

// For AI Error Phrase checks
const MIN_LENGTH_FOR_ERROR_PHRASE_CHECK = 10; // For the "short response overall" condition.
const MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR = 60; // Phrases longer than this are "specific", trigger error if included anywhere.
const MIN_WORDS_FOR_NEW_PRODUCT_NOT_FRAGMENT = 10; // If new product has fewer words than this, it's a fragment.

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
  "Okay, I'm ready. Please provide me with the last part of the response I was working on, or the prompt that you'd like me to continue. I will do my best to seamlessly pick up where I left off and complete the task you've assigned. Just give me the context I need!"
];

const PROMPT_LEAKAGE_MARKERS = [
  // Markers from prompt structure used in buildTextualPromptPart
  "---FILE MANIFEST (Original Input Summary)---",
  "---CURRENT STATE OF PRODUCT (", // Check for the start of this line in prompt
  "------------------------------------------", // The exact separator line from prompt
  "REMINDER: Your response should be ONLY the new, modified textual product.",
  "NEW MODIFIED PRODUCT (Iteration ", // Catches "NEW MODIFIED PRODUCT (Iteration X):"

  // Markers from system instructions in getUserPromptComponents
  "CRITICAL CONTEXT OF ORIGINAL FILES:",
  "GLOBAL MODE DYNAMIC PARAMS:",
  "ITERATIVE PLAN MODE:",
  "GENERAL RULES:", // Section header in system instruction

  // Markers from core user instructions in getUserPromptComponents
  "Executing Iterative Plan Stage (Overall Iteration", // Plan mode
  "This is Iteration ", // Global mode - often followed by "X of Y in Global Autonomous Mode."
  // Common instruction prefixes/phrases
  "Analyze & Refine:",
  "Substantial Change:",
  "Output:", // As in "Output: Provide ONLY..."
  "Adhere to Stage Goals:",
  "Formatting Details (if 'paragraph' format):",
  "JSON Output (if 'json' format):",
  "Content Consistency:",
  "Specific Instructions for Stage:"
];

export const CONVERGED_PREFIX = "CONVERGED:";

export function isLikelyAiErrorResponse(
  newProduct: string, // This should be the raw AI output before cleaning for JSON, etc.
  previousProduct: string,
  lengthInstruction?: OutputLength,
  formatInstruction?: OutputFormat
): IsLikelyAiErrorResponseResult {
  const newCleanedForErrorPhrases = newProduct.trim().toLowerCase(); // Use for error phrase checks
  const newLengthChars = newProduct.trim().length; 
  const prevLengthChars = previousProduct.trim().length;

  const newWordCount = countWords(newProduct);
  const prevWordCount = countWords(previousProduct);

  const isGlobalModeContext = !lengthInstruction && !formatInstruction;

  // 1. Check for Empty JSON response
  if (newLengthChars === 0 && formatInstruction === 'json') {
    return { 
      isError: true, 
      reason: "AI returned an empty response when JSON format was expected.",
      checkDetails: { type: 'empty_json' }
    };
  }

  // 2. Check for common AI error/meta-comment phrases
  for (const phrase of AI_ERROR_PHRASES) {
    const lowerPhrase = phrase.toLowerCase();
    if (newCleanedForErrorPhrases.includes(lowerPhrase)) {
        const isExactMatch = newCleanedForErrorPhrases === lowerPhrase;
        const startsWithPhrase = newCleanedForErrorPhrases.startsWith(lowerPhrase);
        const endsWithPhrase = newCleanedForErrorPhrases.endsWith(lowerPhrase);
        const isShortResponseOverall = newLengthChars <= MIN_LENGTH_FOR_ERROR_PHRASE_CHECK * 3;
        const isConsideredSpecificPhrase = lowerPhrase.length >= MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR;

        if (isExactMatch || startsWithPhrase || endsWithPhrase || isShortResponseOverall || isConsideredSpecificPhrase) {
            return {
                isError: true,
                reason: `AI response appears to be a meta-comment or error, including the phrase: "${phrase}"`,
                checkDetails: { type: 'error_phrase', value: phrase }
            };
        }
    }
  }

  // 3. Check for Prompt Leakage (AI outputting parts of its instructions)
  // This uses the raw `newProduct` for case-sensitive matching of prompt markers.
  for (const marker of PROMPT_LEAKAGE_MARKERS) {
    if (newProduct.includes(marker)) {
      return {
        isError: true,
        reason: `AI response appears to contain parts of the input prompt instructions (marker: "${marker}"). This indicates AI confusion.`,
        checkDetails: { type: 'prompt_leakage', value: marker }
      };
    }
  }
  
  // 4. Content Reduction Checks (Extreme and Drastic)
  const isInstructedToShorten = lengthInstruction === 'shorter';
  const mightNaturallyShortenDueToFormat = formatInstruction && ['auto', 'json', 'key_points', 'outline'].includes(formatInstruction);

  if (prevLengthChars >= MIN_CHARS_FOR_REDUCTION_CHECK && prevWordCount >= MIN_WORDS_FOR_REDUCTION_CHECK) {
    const charPercentageChange = prevLengthChars > 0 ? (newLengthChars / prevLengthChars) : 1.0;
    const wordPercentageChange = prevWordCount > 0 ? (newWordCount / prevWordCount) : 1.0;

    const reductionDetailsBase: Omit<ReductionDetailValue, 'thresholdUsed' | 'additionalInfo'> = {
      previousLengthChars: prevLengthChars,
      newLengthChars: newLengthChars,
      previousWordCount: prevWordCount,
      newWordCount: newWordCount,
      percentageCharChange: parseFloat(((charPercentageChange - 1) * 100).toFixed(2)),
      percentageWordChange: parseFloat(((wordPercentageChange - 1) * 100).toFixed(2)),
    };

    // 4a. **Extreme Reduction Check**
    let isExtremeReduction = false;
    let extremeReason = "";
    let extremeThresholdUsed = "";

    if (charPercentageChange < EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD) {
        isExtremeReduction = true;
        extremeReason = `AI response resulted in EXTREME content reduction (char length < ${EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD*100}% of previous).`;
        extremeThresholdUsed = `EXTREME_REDUCTION_CHAR_PERCENT_LT_${EXTREME_REDUCTION_CHAR_PERCENT_THRESHOLD.toFixed(2)}`;
    } else if (wordPercentageChange < EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD && prevWordCount > MIN_WORDS_FOR_REDUCTION_CHECK) {
        isExtremeReduction = true;
        extremeReason = `AI response resulted in EXTREME content reduction (word count < ${EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD*100}% of previous).`;
        extremeThresholdUsed = `EXTREME_REDUCTION_WORD_PERCENT_LT_${EXTREME_REDUCTION_WORD_PERCENT_THRESHOLD.toFixed(2)}`;
    } else if (prevWordCount >= MIN_PREVIOUS_WORDS_FOR_ABSOLUTE_EXTREME_CHECK && (prevWordCount - newWordCount) > EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS) {
        isExtremeReduction = true;
        extremeReason = `AI response resulted in EXTREME content reduction (absolute loss > ${EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS} words from a large document).`;
        extremeThresholdUsed = `EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS_GT_${EXTREME_REDUCTION_ABSOLUTE_WORD_LOSS}`;
    }

    if (isExtremeReduction) {
      const isNewProductVeryShort = newLengthChars < MIN_CHARS_FOR_SPECIFIC_PHRASE_ERROR || newWordCount < MIN_WORDS_FOR_NEW_PRODUCT_NOT_FRAGMENT;
      const additionalInfoForLog = isNewProductVeryShort ? "New product also very short." : undefined;

      if (!isGlobalModeContext || isNewProductVeryShort) { // Critical error if not global mode OR if new product is tiny
        return {
          isError: true,
          reason: `${extremeReason} Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars. Process halted.`,
          checkDetails: { 
            type: 'extreme_reduction_error', 
            value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed, additionalInfo: additionalInfoForLog }
          }
        };
      } else { // Global Mode and new product is not tiny, despite extreme reduction
        return {
          isError: false, // Not an error that halts the process in this specific Global Mode scenario
          reason: `${extremeReason} Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars. This severe reduction is tolerated in Global Mode as the new product is not a trivial fragment. Monitor closely.`,
          checkDetails: { 
            type: 'extreme_reduction_tolerated_global_mode', 
            value: { ...reductionDetailsBase, thresholdUsed: extremeThresholdUsed }
          }
        };
      }
    }

    // 4b. **Drastic Reduction Check (Error in Plan Mode, Tolerated in Global Mode)**
    if (!isInstructedToShorten && !mightNaturallyShortenDueToFormat) {
      let isDrasticReduction = false;
      let drasticReason = "";
      let drasticThresholdUsed = "";

      if (charPercentageChange < DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD) {
          isDrasticReduction = true;
          drasticReason = `AI response is drastically shorter (char length < ${DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD*100}% of previous).`;
          drasticThresholdUsed = `DRASTIC_REDUCTION_CHAR_PERCENT_LT_${DRASTIC_REDUCTION_CHAR_PERCENT_THRESHOLD.toFixed(2)}`;
      } else if (wordPercentageChange < DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD && prevWordCount > MIN_WORDS_FOR_REDUCTION_CHECK) {
          isDrasticReduction = true;
          drasticReason = `AI response is drastically shorter (word count < ${DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD*100}% of previous).`;
          drasticThresholdUsed = `DRASTIC_REDUCTION_WORD_PERCENT_LT_${DRASTIC_REDUCTION_WORD_PERCENT_THRESHOLD.toFixed(2)}`;
      }
      
      if (isDrasticReduction) {
        const fullDrasticReason = `${drasticReason} Previous: ${prevWordCount} words, ${prevLengthChars} chars. New: ${newWordCount} words, ${newLengthChars} chars.`;
        if (!isGlobalModeContext) {
          return {
            isError: true,
            reason: `${fullDrasticReason} This is flagged as an error in Plan Mode or when specific output structure is expected.`,
            checkDetails: { 
              type: 'drastic_reduction_error_plan_mode', 
              value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed } 
            }
          };
        } else { 
          return {
            isError: false, 
            reason: `${fullDrasticReason} This level of reduction is tolerated in Global Mode but noted.`,
            checkDetails: { 
              type: 'drastic_reduction_tolerated_global_mode', 
              value: { ...reductionDetailsBase, thresholdUsed: drasticThresholdUsed }
            }
          };
        }
      }
    }
  }

  // 5. Check for Invalid JSON if JSON is expected
  const looksLikeJsonAttempt = newProduct.trim().startsWith("{") || newProduct.trim().startsWith("[");
  if ((formatInstruction === 'json' || (formatInstruction === 'auto' && looksLikeJsonAttempt)) && newLengthChars > 0) {
    try {
      JSON.parse(newProduct); 
    } catch (e: any) {
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = newProduct.trim().match(fenceRegex);
      if (match && match[2]) {
        try {
          JSON.parse(match[2].trim());
        } catch (e2: any) {
          return { 
            isError: true, 
            reason: `AI response for format '${formatInstruction}' (or auto-detected JSON) is not valid JSON (even after attempting to extract from markdown): ${e2.message}`,
            checkDetails: { type: 'invalid_json', value: `Attempted fenced extraction. Error: ${e2.message}` }
          };
        }
      } else { 
        return { 
          isError: true, 
          reason: `AI response for format '${formatInstruction}' (or auto-detected JSON) is not valid JSON: ${e.message}`,
          checkDetails: { type: 'invalid_json', value: `Error: ${e.message}` }
        };
      }
    }
  }

  return { 
    isError: false, 
    reason: "AI response passed validation checks.",
    checkDetails: { type: 'passed' }
  };
}

export const getProductSummary = (productText: string | undefined | null): string => {
  if (!productText) return "N/A";
  const limit = 100;
  const cleanedText = productText.replace(/\s+/g, ' ').trim();
  return cleanedText.length > limit ? cleanedText.substring(0, limit - 3) + "..." : cleanedText;
};

export const parseAndCleanJsonOutput = (rawJsonString: string): string => {
  if (!rawJsonString || typeof rawJsonString !== 'string') {
    return typeof rawJsonString === 'string' ? rawJsonString : ''; 
  }
  let jsonStr = rawJsonString.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);

  if (match && match[2]) {
    jsonStr = match[2].trim();
  }

  try {
    const parsedData = JSON.parse(jsonStr);
    return JSON.stringify(parsedData, null, 2); 
  } catch (e) {
    return jsonStr; 
  }
};