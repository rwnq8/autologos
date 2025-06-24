
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part, Content } from "@google/genai";
import type { ModelConfig, StaticAiModelDetails, IterateProductResult, ApiStreamCallDetail, ParameterAdvice, LoadedFile, PlanStage, ModelParameterGuidance, SuggestedParamsResponse } from "../types.ts";
import { getUserPromptComponents, buildTextualPromptPart, CONVERGED_PREFIX } from './promptBuilderService';

const API_KEY: string | undefined = (() => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const key = process.env.API_KEY;
      if (typeof key === 'string' && key.length > 0) {
        console.info("API_KEY loaded from process.env.");
        return key;
      } else if (key === undefined) {
        console.warn("process.env.API_KEY is undefined. Gemini API calls will be disabled if a key is not found by other means.");
        return undefined;
      } else {
        console.warn("process.env.API_KEY found but is not a non-empty string. Gemini API calls will be disabled if a key is not found by other means.");
        return undefined;
      }
    } else {
      console.warn("Could not access process.env. This is expected in some environments (like browsers). Gemini API calls will be disabled if a key is not found.");
      return undefined;
    }
  } catch (e) {
    console.error("Error accessing process.env.API_KEY. Gemini API calls will be disabled.", e);
    return undefined;
  }
})();

let ai: GoogleGenAI | null = null;
let apiKeyAvailable = false;

if (API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: API_KEY });
        apiKeyAvailable = true;
        console.info("GoogleGenAI client initialized successfully.");
    } catch (error) {
        console.error("Error during GoogleGenAI client initialization. Gemini API calls will be disabled.", error);
        ai = null;
        apiKeyAvailable = false;
    }
} else {
    console.warn("API_KEY was not found or is not configured. GoogleGenAI client not initialized. Gemini API calls will be disabled.");
    apiKeyAvailable = false;
}

export const DEFAULT_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

// Default starting point for global mode's dynamic parameter sweep & reset target
export const CREATIVE_DEFAULTS: ModelConfig = { temperature: 0.75, topP: 0.95, topK: 60 };
// Target for the end of global mode's dynamic parameter sweep - now sharply deterministic
export const FOCUSED_END_DEFAULTS: ModelConfig = { temperature: 0.0, topP: 1.0, topK: 1 };
// General defaults, used if no specific strategy applies (e.g., initial suggestion basis before dynamic takes over)
export const GENERAL_BALANCED_DEFAULTS: ModelConfig = { temperature: 0.6, topP: 0.9, topK: 40 };
// Legacy focused defaults, less used now with dynamic strategy.
export const LEGACY_FOCUSED_DEFAULTS: ModelConfig = { temperature: 0.3, topP: 0.85, topK: 20 };


const MIN_WORDS_FOR_ANALYSIS = 30; // Applied to text content if available, or manifest

interface TextStats {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  uniqueWordCount: number;
  lexicalDiversity: number;
}

function analyzeTextComplexity(text: string): TextStats {
  if (!text || !text.trim()) {
    return { wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, uniqueWordCount: 0, lexicalDiversity: 0 };
  }
  const words = text.toLowerCase().match(/\b[\w'-]+\b/g) || [];
  const wordCount = words.length;
  const sentences = text.split(/[.?!;]+(?=\s+|$)/g).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length > 0 ? sentences.length : (wordCount > 0 ? 1 : 0);
  const uniqueWords = new Set(words);
  const uniqueWordCount = uniqueWords.size;
  const lexicalDiversity = wordCount > 0 ? uniqueWordCount / wordCount : 0;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    uniqueWordCount,
    lexicalDiversity,
  };
}

export const getAiModelDetails = (currentModelName: string): StaticAiModelDetails => {
  return {
    modelName: currentModelName,
    tools: "Multi-modal File Input, Dynamic Parameters, Stagnation Nudge",
  };
};

export const isApiKeyAvailable = (): boolean => apiKeyAvailable;

export const suggestModelParameters = (
  textForAnalysis: string
): SuggestedParamsResponse => {
  const isTextProvided = textForAnalysis && textForAnalysis.trim().length > 0;
  let baseConfig: ModelConfig = { ...CREATIVE_DEFAULTS };
  const rationales: string[] = [];

  rationales.push(`Using creative default settings as a starting point, suitable for initial exploration.`);

  if (!isTextProvided) {
    rationales.push(`No textual context provided for analysis. Using creative default starting settings.`);
    return { config: baseConfig, rationales };
  }

  const stats = analyzeTextComplexity(textForAnalysis);

  if (stats.wordCount < MIN_WORDS_FOR_ANALYSIS) {
    rationales.push(`Provided textual context is short (${stats.wordCount} words). Advanced analysis for parameter tuning is less reliable; using creative default starting settings.`);
    return { config: baseConfig, rationales };
  }

  rationales.push(`Context analyzed. Recommending creative starting parameters for broad initial exploration. These will dynamically adjust towards focused settings in global mode.`);
  return { config: baseConfig, rationales };
};

export const getModelParameterGuidance = (config: ModelConfig, isGlobalMode: boolean = false): ModelParameterGuidance => {
  const warnings: string[] = [];
  const advice: ParameterAdvice = {};
  const tempDesc = isGlobalMode ? "Starting Temperature" : "Temperature";
  const topPDesc = isGlobalMode ? "Starting Top-P" : "Top-P";
  const topKDesc = isGlobalMode ? "Starting Top-K" : "Top-K";

  if (config.temperature === 0.0) {
    advice.temperature = `${tempDesc}: Deterministic output; usually used with Top-K=1 for greedy decoding.`;
  } else if (config.temperature > 0 && config.temperature < 0.3) {
    advice.temperature = `${tempDesc}: Very focused and less random output. Good for precision or maintaining strict coherence.`;
  } else if (config.temperature >= 0.3 && config.temperature < 0.7) {
    advice.temperature = `${tempDesc}: Balanced output. Good for factual responses or controlled creativity.`;
  } else if (config.temperature >= 0.7 && config.temperature <= 1.0) {
    advice.temperature = `${tempDesc}: More creative and diverse output. Good for brainstorming or nuanced generation. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
  } else if (config.temperature > 1.0 && config.temperature <= 1.5) {
    advice.temperature = `${tempDesc}: Highly creative; may start to introduce more randomness or less coherence. Higher risk of hallucination. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
  } else {
    advice.temperature = `${tempDesc}: Extremely creative/random; high chance of unexpected or less coherent output. Not recommended for most tasks. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
    warnings.push(`Very high ${tempDesc} ( > 1.5) might lead to highly random or incoherent output and increased hallucination risk.`);
  }

  if (config.topP === 0.0 && config.temperature === 0.0) {
     advice.topP = `${topPDesc}: Not typically used when temperature is 0 (greedy decoding is active).`;
  } else if (config.topP === 0.0 && config.temperature > 0) {
    advice.topP = `${topPDesc}: Top-P is 0 but temperature > 0. This is an unusual setting; typically topP > 0.8 for nucleus sampling. May result in no tokens being selected if not handled carefully by the model.`;
    warnings.push(`${topPDesc} = 0 with Temperature > 0 is an unusual setting and might lead to unexpected behavior or no output.`);
  } else if (config.topP > 0 && config.topP < 0.3) {
    advice.topP = `${topPDesc}: Very restrictive selection of tokens. Output may be limited. Useful for high precision if combined with low temperature.`;
  } else if (config.topP >= 0.3 && config.topP < 0.7) {
    advice.topP = `${topPDesc}: Moderately selective. Balances focus with some diversity.`;
  } else if (config.topP >= 0.7 && config.topP < 0.9) {
    advice.topP = `${topPDesc}: Less restrictive, allowing for more diverse token choices. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
  } else if (config.topP >= 0.9 && config.topP <= 1.0) {
    advice.topP = `${topPDesc}: Allows a wider range of tokens, increasing diversity. Values around 0.9-0.95 are common for balanced creative tasks. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
  }

  if (config.topK === 1) {
    advice.topK = `${topKDesc}: Greedy decoding. Always picks the single most likely next token. Best for factual, deterministic output.`;
  } else if (config.topK > 1 && config.topK < 10) {
    advice.topK = `${topKDesc}: Very limited token choices. Output may be repetitive. Good for specific answers when combined with low temperature.`;
  } else if (config.topK >= 10 && config.topK < 40) {
    advice.topK = `${topKDesc}: Moderately limited token choices. Good for focused output with some variety.`;
  } else if (config.topK >= 40 && config.topK < 80) {
    advice.topK = `${topKDesc}: Broader token selection. Good for creative exploration. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
  } else {
    advice.topK = `${topKDesc}: Very broad token selection. Relies more on Temperature and Top-P for filtering. Can increase randomness or lack of focus if not carefully managed. ${isGlobalMode ? '(Will decrease over iterations)' : ''}`;
  }

  if (config.temperature > 0.8 && config.topK < 20 && config.topK > 1) {
    warnings.push(`Higher ${tempDesc} with low ${topKDesc} may lead to unfocused or repetitive output. Consider increasing ${topKDesc} or decreasing ${tempDesc}.`);
  }
  return { warnings, advice };
};


export const iterateProduct = async (
  currentProduct: string,
  currentIterationOverall: number,
  maxIterationsOverall: number,
  fileManifest: string,
  loadedFiles: LoadedFile[],
  activePlanStage: PlanStage | null,
  outputParagraphShowHeadings: boolean,
  outputParagraphMaxHeadingDepth: number,
  outputParagraphNumberedHeadings: boolean,
  modelConfig: ModelConfig,
  isGlobalMode: boolean,
  modelToUse: string,
  onStreamChunk: (chunkText: string) => void,
  isHaltSignalled: () => boolean
): Promise<IterateProductResult> => {
  if (!ai || !apiKeyAvailable) {
    return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized or API key missing." };
  }

  const { systemInstruction, coreUserInstructions } = getUserPromptComponents(
    currentIterationOverall, maxIterationsOverall,
    activePlanStage,
    outputParagraphShowHeadings, outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings,
    isGlobalMode,
    currentProduct.length === 0 && loadedFiles.length > 0
  );

  const textPromptPart = buildTextualPromptPart(currentProduct, fileManifest, coreUserInstructions, currentIterationOverall);

  const parts: Part[] = [];
  if (currentIterationOverall === 1) { // Only send full file data on the first *actual processing* iteration
    loadedFiles.forEach(file => {
        parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } });
    });
  }
  parts.push({ text: textPromptPart });

  let accumulatedText = "";
  let fullUserPromptForLog = textPromptPart;
  const apiStreamDetails: ApiStreamCallDetail[] = [];
  let streamCallCount = 0;
  let isContinuationCall = false;

  try {
    let continueStreaming = true;

    while(continueStreaming) {
        streamCallCount++;
        if (isHaltSignalled()) {
            return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: "Process halted by user during API call preparation.", promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptForLog, apiStreamDetails };
        }

        const currentPromptForThisAPICall = parts.find(p => p.text !== undefined)?.text || "Error: Text part missing";

        const systemInstructionContent: Content | undefined = systemInstruction ? { role: "system", parts: [{text: systemInstruction}] } : undefined;
        
        const generationConfig: any = { 
            candidateCount: 1,
            temperature: modelConfig.temperature,
            topP: modelConfig.topP,
            topK: modelConfig.topK,
        };
        
        if (activePlanStage && activePlanStage.format === 'json') {
            generationConfig.responseMimeType = "application/json";
        }

        const requestPayload = {
            contents: [{ role: "user", parts }],
            ...(systemInstructionContent && { systemInstruction: systemInstructionContent }),
            generationConfig,
        };

        const stream = await ai.models.generateContentStream({
            model: modelToUse,
            ...requestPayload
        });


        let textFromThisStreamCall = "";
        let currentFinishReason: string | null = null;
        let currentSafetyRatings: any = null;

        for await (const chunk of stream) {
            if (isHaltSignalled()) {
                apiStreamDetails.push({ callCount: streamCallCount, promptForThisCall: currentPromptForThisAPICall, finishReason: "HALTED_BY_USER", safetyRatings: currentSafetyRatings, textLengthThisCall: textFromThisStreamCall.length, isContinuation: isContinuationCall });
                return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: "Process halted by user during streaming.", promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptForLog, apiStreamDetails };
            }
            const chunkText = chunk.text;
            if (chunkText) {
                accumulatedText += chunkText;
                textFromThisStreamCall += chunkText;
                onStreamChunk(chunkText);
            }
            currentFinishReason = chunk.candidates?.[0]?.finishReason || null;
            currentSafetyRatings = chunk.candidates?.[0]?.safetyRatings || null;
        }

        apiStreamDetails.push({ callCount: streamCallCount, promptForThisCall: currentPromptForThisAPICall, finishReason: currentFinishReason, safetyRatings: currentSafetyRatings, textLengthThisCall: textFromThisStreamCall.length, isContinuation: isContinuationCall });

        if (currentFinishReason === "MAX_TOKENS") {
            parts.pop(); // Remove the last text part
            parts.push({ text: "Continue generating the response from where you left off, ensuring completion." });
            fullUserPromptForLog += "\n\n---CONTINUATION---\nContinue generating the response from where you left off, ensuring completion.";
            isContinuationCall = true;
        } else {
            continueStreaming = false;
        }
    }

    if (accumulatedText.startsWith(CONVERGED_PREFIX)) {
      return { product: accumulatedText, status: 'CONVERGED', promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptForLog, apiStreamDetails };
    }
    return { product: accumulatedText, status: 'COMPLETED', promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptForLog, apiStreamDetails };

  } catch (error: any) {
    console.error(`Error during Gemini API call for Iteration ${currentIterationOverall}, Call ${streamCallCount}:`, error);
    
    let errorMessage = "An unknown API error occurred. Check console for details.";
    let isRateLimitErrorFlag = false;

    if (error.error && typeof error.error.message === 'string') { // Handles structure like { error: { code, message, status } }
        const apiErrorDetails = error.error;
        let originalApiMessage = apiErrorDetails.message;

        if (
            apiErrorDetails.status === "RESOURCE_EXHAUSTED" ||
            apiErrorDetails.code === 429 ||
            (typeof apiErrorDetails.code === 'string' && apiErrorDetails.code.includes("429")) ||
            // Fallback checks on the message content itself
            originalApiMessage.toUpperCase().includes("RESOURCE_EXHAUSTED") ||
            originalApiMessage.toUpperCase().includes("RATE LIMIT") ||
            originalApiMessage.includes("429") ||
            originalApiMessage.toUpperCase().includes("QUOTA")
        ) {
            errorMessage = `API Quota Exceeded or Rate Limit Hit. Please check your Gemini API plan, billing details, or try again later. For more info: https://ai.google.dev/gemini-api/docs/rate-limits. Original API message: "${originalApiMessage}"`;
            isRateLimitErrorFlag = true;
        } else {
            errorMessage = `API Error: ${originalApiMessage}`;
        }
    } else if (typeof error.message === 'string') { // Handles generic error with a top-level message
        let originalApiMessage = error.message;
        if (
            originalApiMessage.toUpperCase().includes("RESOURCE_EXHAUSTED") ||
            originalApiMessage.toUpperCase().includes("RATE LIMIT") ||
            originalApiMessage.includes("429") ||
            originalApiMessage.toUpperCase().includes("QUOTA")
        ) {
            const status = (error as any).status;
            const code = (error as any).code;
            let detailsPart = "";
            if (status || code) {
                detailsPart = ` (Status: ${status || 'N/A'}, Code: ${code || 'N/A'})`;
            }
            errorMessage = `API Quota Exceeded or Rate Limit Hit. Please check your Gemini API plan, billing details, or try again later. For more info: https://ai.google.dev/gemini-api/docs/rate-limits. Original API message: "${originalApiMessage}"${detailsPart}`;
            isRateLimitErrorFlag = true;
        } else {
             errorMessage = `API Error: ${originalApiMessage}`;
        }
    } else if (error.toString) { // Final fallback
        errorMessage = error.toString();
    }
    
    apiStreamDetails.push({ callCount: streamCallCount, promptForThisCall: "N/A (Error before/during stream start)", finishReason: "ERROR_BEFORE_STREAM", safetyRatings: null, textLengthThisCall: 0, isContinuation: isContinuationCall });
    return { product: accumulatedText || currentProduct, status: 'ERROR', errorMessage, promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptForLog, apiStreamDetails, isRateLimitError: isRateLimitErrorFlag };
  }
};
