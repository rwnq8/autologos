
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import type { ProcessingMode, ModelConfig, SuggestedParamsResponse, ModelParameterGuidance, ParameterAdvice, StaticAiModelDetails } from "../types";

let API_KEY: string | undefined = undefined;
try {
    // Safely check for process, process.env, and process.env.API_KEY
    if (typeof process !== 'undefined' && process.env && typeof process.env.API_KEY === 'string') {
        API_KEY = process.env.API_KEY;
    } else if (typeof process !== 'undefined' && process.env && process.env.API_KEY === undefined) {
        console.warn("process.env.API_KEY is undefined. Gemini API calls will be disabled if a key is not found by other means.");
    }
} catch (e) {
    // This catch block might be for other errors during API_KEY retrieval,
    // but the main check for 'process' undefined is above.
    console.warn("Could not access process.env.API_KEY. This might be expected in some browser environments. Gemini API calls will be disabled if a key is not found.", e);
}


let ai: GoogleGenAI | null = null;
let apiKeyAvailable = false;

try {
  if (API_KEY) {
    // Ensure GoogleGenAI is available before trying to instantiate
    if (typeof GoogleGenAI === 'function') {
        ai = new GoogleGenAI({ apiKey: API_KEY });
        apiKeyAvailable = true;
    } else {
        console.error("GoogleGenAI constructor is not available from @google/genai module. Gemini API calls will be disabled.");
        apiKeyAvailable = false;
    }
  } else {
    console.warn("API_KEY was not found or is not configured. Gemini API calls will be disabled.");
    apiKeyAvailable = false; 
  }
} catch (error) {
  console.error("Error during GoogleGenAI initialization. Gemini API calls will be disabled.", error);
  ai = null; 
  apiKeyAvailable = false; 
}

const MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
    temperature: 0.75, 
    topP: 0.95,
    topK: 64,
};

// Base defaults, adjustments will be made from these
export const EXPANSIVE_MODE_DEFAULTS: ModelConfig = { temperature: 0.8, topP: 0.95, topK: 60 };
export const CONVERGENT_MODE_DEFAULTS: ModelConfig = { temperature: 0.4, topP: 0.9, topK: 40 };


// StaticAiModelDetails is now imported from ../types

export const getStaticModelDetails = (): StaticAiModelDetails => {
  return {
    modelName: MODEL_NAME,
    tools: "None", 
  };
};

export const isApiKeyAvailable = (): boolean => apiKeyAvailable;

export const suggestModelParameters = (
  prompt: string,
  currentMode: ProcessingMode
): SuggestedParamsResponse => {
  let suggestedConfig = currentMode === 'expansive' ? 
    { ...EXPANSIVE_MODE_DEFAULTS } : 
    { ...CONVERGENT_MODE_DEFAULTS };
  const rationales: string[] = [`Base settings for '${currentMode}' mode applied.`];

  if (!prompt || prompt.trim().length === 0) {
    rationales.push("No prompt provided; using mode defaults.");
    return { config: suggestedConfig, rationales }; 
  }

  const lowerPrompt = prompt.toLowerCase();
  const promptLength = prompt.split(/\s+/).length; 
  let oldTempValue: number, oldTopPValue: number, oldTopKValue: number;

  // Helper to add rationale if value changed
  const addRationale = (paramName: string, oldValue: number, newValue: number, specificMsg: string) => {
    // For temperature and topP, compare with a tolerance for floating point
    const valueChanged = paramName === 'topK' ? oldValue !== newValue : Math.abs(oldValue - newValue) > 0.001;
    if (valueChanged) {
      const changeDir = newValue > oldValue ? "increased" : "decreased";
      const formattedOld = paramName === 'topK' ? oldValue.toFixed(0) : oldValue.toFixed(2);
      const formattedNew = paramName === 'topK' ? newValue.toFixed(0) : newValue.toFixed(2);
      rationales.push(`${specificMsg}: ${paramName} ${changeDir} from ${formattedOld} to ${formattedNew}.`);
    }
  };
  
  // 1. Code Content Detection (strong influence)
  if (/[{};()\[\]=><\/\+\-\*]|function|class|const|let|var|import|export|def|printf|console\.log/.test(prompt)) {
    oldTempValue = suggestedConfig.temperature;
    suggestedConfig.temperature = Math.max(0.05, Math.min(0.4, suggestedConfig.temperature * 0.4));
    addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Code-like content detected, prioritizing precision");

    oldTopPValue = suggestedConfig.topP;
    suggestedConfig.topP = Math.max(0.85, Math.min(1.0, suggestedConfig.topP + 0.05)); // Allow slightly wider net if temperature is very low
    addRationale("Top-P", oldTopPValue, suggestedConfig.topP, "Code-like content, adjusting Top-P");
    
    oldTopKValue = suggestedConfig.topK;
    suggestedConfig.topK = Math.max(10, Math.min(50, Math.floor(suggestedConfig.topK * 0.6)));
    addRationale("Top-K", oldTopKValue, suggestedConfig.topK, "Code-like content, focusing Top-K");
    rationales.push("Code-like content significantly influences parameters towards precision and deterministic output.");
  }

  // 2. Mode-Specific Keyword Adjustments
  if (currentMode === 'expansive') {
    if (/(story|poem|imagine|create|generate ideas|brainstorm|narrative|fiction|dialogue|explore options|what if|vision|concept|artistic|invent)/.test(lowerPrompt)) {
      oldTempValue = suggestedConfig.temperature;
      suggestedConfig.temperature += 0.3;
      addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Creative/brainstorming keywords");
      
      oldTopKValue = suggestedConfig.topK;
      suggestedConfig.topK += 20;
      addRationale("Top-K", oldTopKValue, suggestedConfig.topK, "Creative/brainstorming keywords, broadening token selection");

      oldTopPValue = suggestedConfig.topP;
      suggestedConfig.topP += 0.03;
       addRationale("Top-P", oldTopPValue, suggestedConfig.topP, "Creative/brainstorming keywords, slightly widening probability mass");
    } else if (/(explain in detail|elaborate on|provide examples|discuss implications|expand upon|deep dive|breakdown)/.test(lowerPrompt)) {
      oldTempValue = suggestedConfig.temperature;
      suggestedConfig.temperature += 0.15;
      addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Elaborative keywords, encouraging detailed output");

      oldTopKValue = suggestedConfig.topK;
      suggestedConfig.topK += 10;
      addRationale("Top-K", oldTopKValue, suggestedConfig.topK, "Elaborative keywords");
    }
  } else { // Convergent Mode
    if (/(summarize|analyze|distill|extract|define|essence|core|minimal|identify key points|gist|tl;dr|conclusion|abstract|precis)/.test(lowerPrompt)) {
      oldTempValue = suggestedConfig.temperature;
      suggestedConfig.temperature -= 0.25;
      addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Analytical/distilling keywords, focusing on conciseness");

      oldTopKValue = suggestedConfig.topK;
      suggestedConfig.topK -= 20;
      addRationale("Top-K", oldTopKValue, suggestedConfig.topK, "Analytical/distilling keywords, narrowing token selection");
      
      oldTopPValue = suggestedConfig.topP;
      suggestedConfig.topP -= 0.08;
      addRationale("Top-P", oldTopPValue, suggestedConfig.topP, "Analytical/distilling keywords, restricting to more probable tokens");
    } else if (/(what is|who is|when did|how does|explain .*\?|define .*\?|list facts|details for:)/.test(lowerPrompt) || (lowerPrompt.includes("?") && promptLength < 50)) {
      oldTempValue = suggestedConfig.temperature;
      suggestedConfig.temperature -= 0.3; // Could go very low for factual
      addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Factual question/specific query, prioritizing accuracy");
      
      oldTopKValue = suggestedConfig.topK;
      suggestedConfig.topK -= 25;
      addRationale("Top-K", oldTopKValue, suggestedConfig.topK, "Factual question/specific query");

      oldTopPValue = suggestedConfig.topP;
      suggestedConfig.topP -= 0.1;
      addRationale("Top-P", oldTopPValue, suggestedConfig.topP, "Factual question/specific query");
    }
  }

  // 3. General Length Adjustments (fine-tuning)
  if (promptLength < 15 && currentMode === 'expansive' && suggestedConfig.temperature < 0.9) {
    oldTempValue = suggestedConfig.temperature;
    suggestedConfig.temperature += 0.15;
    addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Short prompt in expansive mode, encouraging broader exploration");
  } else if (promptLength > 250) { // For very long prompts, slightly reduce temperature for coherence
    if (suggestedConfig.temperature > 0.4) { // Only if not already very low
        oldTempValue = suggestedConfig.temperature;
        suggestedConfig.temperature -= 0.1;
        addRationale("Temperature", oldTempValue, suggestedConfig.temperature, "Long prompt, slightly reducing temperature for coherence");
    }
  }


  // 4. Final Clamping and Formatting
  suggestedConfig.temperature = parseFloat(Math.max(0.0, Math.min(2.0, suggestedConfig.temperature)).toFixed(2));
  suggestedConfig.topP = parseFloat(Math.max(0.0, Math.min(1.0, suggestedConfig.topP)).toFixed(2));
  suggestedConfig.topK = parseInt(Math.max(1, Math.min(100, suggestedConfig.topK)).toString(), 10);
  
  if (rationales.length === 1) { // Only base rationale present
    rationales.push("Prompt analysis did not trigger significant parameter adjustments beyond mode defaults and light length considerations.");
  }

  return { config: suggestedConfig, rationales };
};


export const getModelParameterGuidance = (config: ModelConfig): ModelParameterGuidance => {
  const warnings: string[] = [];
  const advice: ParameterAdvice = {};

  // Temperature Advice
  if (config.temperature === 0) {
    advice.temperature = "Deterministic output; usually used with Top-K=1 for greedy decoding.";
  } else if (config.temperature < 0.3) {
    advice.temperature = "Very focused and less random output. Good for precision tasks, factual recall.";
  } else if (config.temperature < 0.7) {
    advice.temperature = "Balanced output. Good for factual responses or controlled creativity.";
  } else if (config.temperature <= 1.0) {
    advice.temperature = "More creative and diverse output. Good for brainstorming or varied responses.";
  } else if (config.temperature <= 1.5) {
    advice.temperature = "Highly creative; may start to introduce more randomness or less coherence.";
  } else {
    advice.temperature = "Extremely creative/random; high chance of unexpected or less coherent output.";
    warnings.push("Very high temperature ( > 1.5) might lead to highly random or incoherent output.");
  }

  // Top-P Advice
  if (config.topP < 0.3) {
    advice.topP = "Very restrictive selection of tokens. Output may be limited. Useful for high precision.";
  } else if (config.topP < 0.7) {
    advice.topP = "Moderately selective. Balances focus with some diversity.";
  } else if (config.topP < 0.9) {
    advice.topP = "Less restrictive, allowing for more diverse token choices.";
  } else if (config.topP < 1.0) {
    advice.topP = "Allows a wider range of tokens, increasing diversity. Default is often around 0.95.";
  } else { // topP === 1.0
    advice.topP = "Considers all tokens (no nucleus sampling). Diversity depends more on Temperature and Top-K.";
  }
  
  // Top-K Advice
  if (config.topK === 1) {
    advice.topK = "Greedy decoding. Always picks the single most likely next token.";
  } else if (config.topK < 10) {
    advice.topK = "Very limited token choices. Output may be repetitive or simplistic. Good for specific answers.";
  } else if (config.topK < 40) {
    advice.topK = "Moderately limited token choices. Good for focused output with some variety.";
  } else if (config.topK < 80) {
    advice.topK = "Broader token selection, allowing for more diverse output. Common for creative tasks.";
  } else { // topK >= 80
    advice.topK = "Very broad token selection. Relies more on Temperature and Top-P for filtering.";
  }

  // Warnings for combinations
  if (config.temperature > 1.0 && config.topK < 10 && config.topK > 1) {
    warnings.push("High temperature with very low Top-K (< 10, not 1) can be unpredictable and may produce low-quality results.");
  }
  if (config.topP < 0.5 && config.temperature > 0.5) {
    warnings.push("Low Top-P (< 0.5) with moderate/high temperature can be restrictive and may cause erratic behavior by cutting off too many good options early.");
  }
  if (config.topP === 1.0 && config.topK === 1 && config.temperature > 0) {
    warnings.push("Using Top-P=1 and Top-K=1 simultaneously with temperature > 0 is unusual. Top-K=1 implies greedy decoding (if temp=0), making Top-P less relevant.");
  }
   if (config.topK < 5 && config.topK > 1) { 
    warnings.push("Very low Top-K (< 5, not 1) might overly restrict word choice, leading to repetitive or simplistic output, especially if temperature is also low.");
  }
  if (config.temperature == 0.0 && config.topK > 1) {
    warnings.push("Temperature of 0.0 typically implies greedy decoding (Top-K=1). Using Top-K > 1 with Temp=0.0 might yield inconsistent behavior depending on implementation, usually Top-K=1 is preferred here.");
  }


  return { warnings, advice };
};

// Helper function to construct the user prompt parts
const getUserPromptComponents = (
    originalPrompt: string,
    processingMode: ProcessingMode,
    iterationNumber: number,
    maxIterations: number,
): { systemInstruction: string; coreUserInstructions: string } => {
    let systemInstruction: string;
    let coreUserInstructions: string;

    if (processingMode === 'expansive') {
        systemInstruction = `You are an AI process engine in 'EXPANSIVE' mode. Your goal is to iteratively evolve a "product" by significantly expanding its core concepts and adding new, related information based on an original user input. In each iteration, focus on adding one or two distinct, substantial new sections or elaborating deeply on specific existing points, rather than attempting to rewrite or expand the entire product at once. This mode is non-convergent; aim for continuous, meaningful semantic expansion. Ensure your additions are well-contained and complete. Only if no further meaningful semantic expansion is possible without becoming trivial or redundant, prefix your response with "CONVERGED:". If your response is truncated due to length, you will be prompted to continue.`;
        coreUserInstructions = `
1.  **Identify Key Area(s) for Focused Expansion**: Analyze the "Current State of Product". Identify *one or two specific, high-priority concepts* for substantial new elaboration, or determine a *single, logical next section* to add. Always relate this back to the "Original User Input".
2.  **Provide Focused Elaboration / New Section**: For the identified concept(s) or new section, provide a *detailed and focused* elaboration or the new section content. Aim for depth and completeness in *this specific addition*.
3.  **Integrate Expansions**: Weave these expansions into a new, coherent version of the product, enriching its detail.
4.  **Output Format**: Provide ONLY the new, expanded product. Do NOT include preambles.`;
    } else { // convergent mode
        systemInstruction = `You are an AI process engine in 'CONVERGENT' mode. Your goal is to iteratively distill a "product" based on an original user input down to its most essential, minimal, core representation. Focus on identifying the absolute fundamental concepts and removing elaborations, examples, or redundant information. Simplify phrasing. If the product is maximally distilled and no further meaningful reduction is possible without losing its core identity, you MUST prefix your response with "CONVERGED:". If your response is truncated due to length, you will be prompted to continue.`;
        coreUserInstructions = `
1.  **Identify Core Essence**: Analyze the "Current State of Product" for its fundamental concepts in relation to the "Original User Input."
2.  **Distill and Reduce**: Remove elaborations, simplify phrasing, and consolidate ideas to their most direct form.
3.  **Integrate into Minimal Form**: Formulate a new, significantly more concise product representing this distilled essence.
4.  **Output Format**: Provide ONLY the new, distilled product. If converged, prefix with "CONVERGED:". Do NOT include other preambles.`;
    }
    return { systemInstruction, coreUserInstructions };
};


const buildFullUserPrompt = (
    originalPrompt: string,
    productToProcess: string, // This is `previousProduct` for initial call, or `fullGeneratedTextSoFar` for continuations
    iterationNumber: number,
    maxIterations: number,
    processingMode: ProcessingMode,
    coreUserInstructions: string,
    isContinuation: boolean
): string => {
    return `
Original User Input:
"${originalPrompt}"

${isContinuation ? `PARTIAL PRODUCT CONTENT (GENERATED SO FAR FOR THIS ITERATION ${iterationNumber}):` : `Current State of Product (after Iteration ${iterationNumber - 1}):`}
\`\`\`
${productToProcess}
\`\`\`

This is Iteration ${iterationNumber} of a maximum of ${maxIterations} iterations in ${processingMode.toUpperCase()} mode.
${isContinuation ? `\nIMPORTANT: YOU ARE CONTINUING A PREVIOUSLY TRUNCATED RESPONSE FOR THIS ITERATION. Your previous output was cut short.` : ''}

Instructions for this iteration ${isContinuation ? '(CONTINUING PREVIOUS RESPONSE)' : ''}:
${coreUserInstructions}

${isContinuation ?
`Please continue generating the product text EXACTLY where you left off from the "PARTIAL PRODUCT CONTENT" shown above.
DO NOT repeat any part of the "PARTIAL PRODUCT CONTENT".
DO NOT add any preambles, apologies, or explanations for continuing.
DO NOT restart the whole product.
Simply provide the NEXT CHUNK of the product text.
If you believe the product is complete or converged (and you would have prefixed with "CONVERGED:"), ensure that prefix is at the very start of THIS CHUNK if it's the final part.`
: `Provide the next version of the product (or the converged product with the prefix):`}
`;
};


export const iterateProduct = async (
  previousProduct: string,
  iterationNumber: number,
  maxIterations: number,
  originalPrompt: string,
  processingMode: ProcessingMode,
  modelConfig: ModelConfig,
): Promise<string> => {
  if (!ai) {
    throw new Error("Gemini API client not initialized. API Key might be missing or client setup failed.");
  }

  const { systemInstruction, coreUserInstructions } = getUserPromptComponents(originalPrompt, processingMode, iterationNumber, maxIterations);

  let fullGeneratedText = "";
  let productContentForNextPrompt = previousProduct; // For the first call, this is indeed the previous iteration's full product
  let currentCallIsContinuation = false;
  let callCount = 0;
  const MAX_CONTINUATION_CALLS = 5; // Limit continuation attempts to prevent infinite loops or excessive cost

  while (callCount < MAX_CONTINUATION_CALLS) {
    callCount++;

    const userPromptForThisCall = buildFullUserPrompt(
      originalPrompt,
      productContentForNextPrompt,
      iterationNumber,
      maxIterations,
      processingMode,
      coreUserInstructions,
      currentCallIsContinuation
    );

    console.log(`Gemini API Call #${callCount} for Iteration ${iterationNumber}. Mode: ${processingMode}. Continuation: ${currentCallIsContinuation}`);
    // For very deep debugging, you might uncomment the next line, but it can be very verbose.
    // if (callCount > 1 || currentCallIsContinuation) console.log("User prompt for this continuation call:", userPromptForThisCall.substring(0, 500) + "...");


    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
          model: MODEL_NAME,
          // The userPromptForThisCall now contains the full context including previous product / partial product
          contents: [{ role: 'user', parts: [{ text: userPromptForThisCall }] }],
          config: {
              systemInstruction: systemInstruction,
              temperature: modelConfig.temperature,
              topP: modelConfig.topP,
              topK: modelConfig.topK,
              // No maxOutputTokens explicitly set, relies on model's default (8192 for gemini-2.5-flash-preview-04-17)
          }
      });

      // --- DIAGNOSTIC LOGGING START ---
      console.log(`Gemini API Response Details for Iteration ${iterationNumber}, Call ${callCount} (Mode: ${processingMode}):`);
      if (response.candidates && response.candidates.length > 0) {
        response.candidates.forEach((candidate, index) => {
          console.log(`  Candidate ${index}:`);
          console.log(`    Finish Reason: ${candidate.finishReason}`);
          if (candidate.finishMessage) {
              console.log(`    Finish Message: ${candidate.finishMessage}`);
          }
          console.log(`    Safety Ratings:`, candidate.safetyRatings);
          console.log(`    Content Parts Count: ${candidate.content?.parts?.length || 0}`);
           if (candidate.content?.parts) {
             candidate.content.parts.forEach((part, partIndex) => {
               if (part.text) {
                 console.log(`    Part ${partIndex} (text): ${part.text.substring(0,100)}... (length: ${part.text.length})`);
               } else {
                 console.log(`    Part ${partIndex} (non-text):`, part);
               }
             });
           }
          if (candidate.citationMetadata) {
              console.log(`    Citation Metadata:`, candidate.citationMetadata);
          }
           if (candidate.tokenCount) {
              console.log(`    Token Count: ${candidate.tokenCount}`);
          }
        });
      } else {
        console.log("  No candidates found in the response for this chunk.");
      }
      if (response.usageMetadata) {
          console.log(`  Usage Metadata for this chunk:`, response.usageMetadata);
      }
      console.log(`  Extracted text (response.text) for this chunk, first 100 chars: ${response.text?.substring(0,100)}... (chunk length: ${response.text?.length})`);
      // --- DIAGNOSTIC LOGGING END ---

      const chunkText = response.text;
      if (typeof chunkText !== 'string') {
          console.error("Gemini API response.text is not a string for this chunk:", chunkText);
          throw new Error(`Received invalid response chunk from AI (not text) on iteration ${iterationNumber}, call ${callCount}.`);
      }

      fullGeneratedText += chunkText; // Append the new chunk to the total for this iteration

      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        console.log(`Iteration ${iterationNumber}, Call ${callCount}: Output truncated (MAX_TOKENS). Will attempt continuation.`);
        productContentForNextPrompt = fullGeneratedText; // The next prompt will use all text generated *so far in this iteration*
        currentCallIsContinuation = true;
        // Optional: Add a small delay if making rapid calls to avoid rate limits or model overload, though likely not needed here.
        // await new Promise(resolve => setTimeout(resolve, 200)); 
      } else {
        // Not MAX_TOKENS, so this is the end of generation for this iteration (STOP, SAFETY, ERROR, etc.)
        if (candidate?.finishReason !== 'STOP' && candidate?.finishReason !== undefined) { // Log if not a clean stop
            console.warn(`Iteration ${iterationNumber}, Call ${callCount}: Finished with reason: ${candidate.finishReason}${candidate.finishMessage ? ' - ' + candidate.finishMessage : ''}.`);
        } else if (candidate?.finishReason === 'STOP') {
            console.log(`Iteration ${iterationNumber}, Call ${callCount}: Finished with reason: STOP.`);
        } else {
             console.log(`Iteration ${iterationNumber}, Call ${callCount}: Finished (no specific reason provided, or candidate undefined).`);
        }
        break; // Exit the while loop, generation for this iteration is complete.
      }
    } catch (error) {
        // Log the error along with context
        console.error(`Gemini API error in iterateProduct (iteration: ${iterationNumber}, call: ${callCount}, mode: ${processingMode}):`, error);
        const partialText = fullGeneratedText ? ` (Partial text generated before error: "${fullGeneratedText.substring(0,150)}...")` : "";
        if (error instanceof Error) {
            throw new Error(`Gemini API request failed on iteration ${iterationNumber}, call ${callCount}: ${error.message}${partialText}`);
        }
        throw new Error(`Gemini API request failed with an unknown error on iteration ${iterationNumber}, call ${callCount}.${partialText}`);
    }
  } // End of while loop for continuations

  if (callCount >= MAX_CONTINUATION_CALLS && currentCallIsContinuation) { 
    // This means the last call in the loop was a continuation attempt that hit the MAX_CONTINUATION_CALLS limit.
    const warningMessage = `\n\n[SYSTEM_NOTE: Reached maximum continuation calls (${MAX_CONTINUATION_CALLS}) for iteration ${iterationNumber}. The output for this iteration might be incomplete.]`;
    console.warn(warningMessage.trim());
    fullGeneratedText += warningMessage;
  }

  // The fullGeneratedText should naturally include "CONVERGED:" if the AI intended it at the end of its generation.
  // No special handling for "CONVERGED:" needed here, as it's part of the text content.
  return fullGeneratedText;
};

/*
export const generateOverallEvolutionSummary = async (
  // ... (Commented out code remains unchanged) ...
*/
