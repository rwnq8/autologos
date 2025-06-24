

import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part, Content, GenerateContentParameters } from "@google/genai";
import type { ModelConfig, StaticAiModelDetails, IterateProductResult, ApiStreamCallDetail, LoadedFile, PlanStage, SuggestedParamsResponse, RetryContext, OutlineGenerationResult, NudgeStrategy, SelectableModelName, StrategistAdvice, IterationLogEntry, AiResponseValidationInfo, StagnationInfo } from "../types.ts";
import { getUserPromptComponents, buildTextualPromptPart, CONVERGED_PREFIX, getOutlineGenerationPromptComponents } from './promptBuilderService';
import { SELECTABLE_MODELS } from '../types.ts';

const API_KEY: string | undefined = (() => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const key = process.env.API_KEY;
      if (typeof key === 'string' && key.length > 0) {
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
    } catch (error) {
        console.error("Error during GoogleGenAI client initialization. Gemini API calls will be disabled.", error);
        ai = null;
        apiKeyAvailable = false;
    }
} else {
    console.warn("API_KEY was not found or is not configured. GoogleGenAI client not initialized. Gemini API calls will be disabled.");
    apiKeyAvailable = false;
}

export const DEFAULT_MODEL_NAME: SelectableModelName = 'gemini-2.5-flash-preview-04-17';
export const CREATIVE_DEFAULTS: ModelConfig = { temperature: 0.75, topP: 0.95, topK: 60 };
export const FOCUSED_END_DEFAULTS: ModelConfig = { temperature: 0.0, topP: 1.0, topK: 1 };
export const GENERAL_BALANCED_DEFAULTS: ModelConfig = { temperature: 0.6, topP: 0.9, topK: 40 };


export const getAiModelDetails = (currentModelName: string): StaticAiModelDetails => {
  const model = SELECTABLE_MODELS.find(m => m.name === currentModelName);
  return { modelName: model ? model.displayName : currentModelName, tools: model ? model.description : "Details unavailable" };
};
export const isApiKeyAvailable = (): boolean => apiKeyAvailable;

export const suggestModelParameters = (textForAnalysis: string): SuggestedParamsResponse => {
    // This is a simplified placeholder. Real implementation would analyze text.
    if (textForAnalysis.length < 100) {
        return { config: { ...CREATIVE_DEFAULTS, temperature: 0.8 }, rationales: ["Input is short, suggesting higher creativity for initial expansion."] };
    } else if (textForAnalysis.length < 1000) {
        return { config: { ...GENERAL_BALANCED_DEFAULTS }, rationales: ["Input is of moderate length, suggesting balanced parameters."] };
    } else {
        return { config: { ...FOCUSED_END_DEFAULTS, temperature: 0.3 }, rationales: ["Input is very long, suggesting more focused parameters for coherence."] };
    }
};

export const getModelParameterGuidance = (config: ModelConfig, isGlobalMode: boolean = false): any => {
    const warnings: string[] = [];
    const advice: any = {};

    if (config.temperature >= 0.9) advice.temperature = "High temperature: Expect more creative, less predictable output.";
    else if (config.temperature <= 0.2) advice.temperature = "Low temperature: Output will be more focused and deterministic.";
    if (config.topP < 0.9 && config.topP !== 1.0) advice.topP = "Lower Top-P: May restrict creativity. Consider raising if output is too repetitive.";
    if (config.topK < 10 && config.topK !== 1) advice.topK = "Low Top-K: Limits token choices significantly. Can be good for factual recall.";

    if(isGlobalMode && config.temperature > 0.7 && config.maxIterations && config.maxIterations > 20) {
        warnings.push("High starting temperature in Global Mode with many iterations. Parameters will sweep towards deterministic; initial output may be very diverse.");
    }
    if(config.thinkingConfig?.thinkingBudget === 0 && config.modelName === 'gemini-2.5-flash-preview-04-17') {
        advice.thinkingConfig = "Thinking Budget is 0: Flash model will respond faster but may have lower quality for complex tasks.";
    }

    return { warnings, advice };
};


export const getStrategicAdviceFromLLM = async (
    currentIteration: number,
    maxIterations: number,
    inputComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX',
    lastUsedModel: SelectableModelName | undefined,
    lastUsedConfig: ModelConfig | null | undefined,
    stagnationInfo: StagnationInfo,
    lastValidationInfo: AiResponseValidationInfo | undefined,
    currentGoal: string,
    recentIterationSummaries: string[],
    currentProductLengthChars?: number
): Promise<StrategistAdvice | null> => {
    if (!ai || !apiKeyAvailable) {
        console.warn("Strategist LLM call skipped: API key or client not available.");
        return null;
    }

    const maxRetries = 1;
    const retryDelayMs = 1000;

    const validModelsString = SELECTABLE_MODELS.map(m => `'${m.name}' ('${m.description.split('.')[0]}')`).join(', ');

    const strategistSystemPrompt = `You are an AI Process Strategist. Your task is to analyze the current state of an iterative content generation process and suggest the optimal Gemini model, its thinking configuration (if applicable for 'gemini-2.5-flash-preview-04-17'), optionally minor adjustments to temperature/TopP/TopK, and optionally a meta-instruction for the *next* iteration of the main content generation AI.
    Provide your response strictly in JSON format with the following fields: "suggestedModelName" (optional string from valid list), "suggestedThinkingBudget" (optional, 0 or 1 for 'gemini-2.5-flash-preview-04-17' only), "suggestedTemperature" (optional number 0.0-2.0), "suggestedTopP" (optional number 0.0-1.0), "suggestedTopK" (optional integer >=1), "suggestedMetaInstruction" (optional string, 1-2 concise sentences for the main AI if it's highly stagnant or needs a new approach), and a mandatory "rationale" (1-3 sentences explaining your overall advice).
    Valid models for 'suggestedModelName': ${validModelsString}.
    
    Value is not just refinement; for underdeveloped products, value lies in substantial conceptual expansion, addition of new details, examples, or arguments. Distinguish between a product needing polish and one needing growth.

    PRIORITIZE EXPANSION FOR UNDERDEVELOPED KERNELS: If the 'Current Goal' or 'Content Stage Assessment' implies a need for more detailed output, but recent iteration summaries (and product length, if provided) show a very short product with consistently minor changes (wordsmithing), this strongly indicates an underdeveloped kernel. In such cases:
    1. Your **primary goal** is to suggest a 'suggestedMetaInstruction' that explicitly directs the main AI to **substantially expand** the content (e.g., "The current product is a good starting point but needs significant expansion. Elaborate on [key concept identified by strategist], provide concrete examples, and explore related arguments to substantially increase its depth and breadth." or "Elaborate on the core thesis, add 2-3 supporting examples for key points, and explore counter-arguments or future implications to significantly increase depth and breadth.").
    2. If ` + "`strategistInfluenceLevel`" + ` allows parameter overrides (assume 'OVERRIDE_FULL' is a possibility), and the main AI is in a hyper-deterministic state (e.g., Temperature near 0), **strongly consider suggesting a temporary, controlled increase in 'suggestedTemperature' (e.g., to 0.3-0.6) for 1-2 iterations** to facilitate this expansion, even if late in the overall iteration count. Clearly state this is a temporary measure for expansion and should revert to the global sweep or plan settings afterward.

    CRITICAL ASSESSMENT (General):
    - If stagnation is high (e.g., system nudge strategy is 'meta_instruct') or last validation failed critically, strongly consider suggesting a 'suggestedMetaInstruction' to guide the main AI's refinement approach.
    - Critically assess if the current product, despite surface polish, is conceptually shallow or requires significant expansion versus minor refinement. If stagnation appears to be due to hyper-focus on minor edits of an underdeveloped idea (especially if the content is short or the 'Current Goal' implies more depth is needed), prioritize suggesting:
        1. A **specific and actionable** EXPANSIONARY 'suggestedMetaInstruction'.
        2. If influence level permits parameter overrides AND the main AI is in a hyper-deterministic state (e.g., low temperature), and parameters are very deterministic, **recommend** a TEMPORARY, CONTROLLED increase in 'suggestedTemperature' (e.g., to 0.3-0.5) to foster more diverse output for expansion.
    
    If you suggest a 'suggestedMetaInstruction', make it actionable for the main content AI. Examples: "Focus on improving the logical flow and transitions between paragraphs." or "Try to simplify the complex terminology used in the last section." or "Re-evaluate the document's main argument for consistency with the original file data." or "Substantially expand on the topic of X, adding more detail and examples."
    Suggest parameter changes sparingly and only if there's a strong reason based on stagnation, specific validation failures, or a clear need for expansion from an overly deterministic state. Any suggested parameter change should be a specific value, not a general direction.
    Ensure any suggested parameters are within these valid ranges: Temperature (0.0-2.0), TopP (0.0-1.0), TopK (integer >=1).`;


    let lastConfigSummary = "N/A";
    if (lastUsedConfig) {
        lastConfigSummary = `Temp: ${lastUsedConfig.temperature.toFixed(2)}, TopP: ${lastUsedConfig.topP.toFixed(2)}, TopK: ${lastUsedConfig.topK}`;
        if (lastUsedConfig.thinkingConfig && lastUsedModel === 'gemini-2.5-flash-preview-04-17') {
            lastConfigSummary += `, ThinkingBudget: ${lastUsedConfig.thinkingConfig.thinkingBudget}`;
        }
    }

    const iterationSummariesText = recentIterationSummaries.length > 0
        ? `\nRecent Iteration Summaries (last ${recentIterationSummaries.length}):\n${recentIterationSummaries.map(s => `- ${s}`).join('\n')}`
        : "\nNo recent iteration summaries available (or first few iterations).";

    const strategistUserPrompt = `
    Process State for Next Iteration (${currentIteration + 1}/${maxIterations}):
    - Current Iteration: ${currentIteration} (completed)
    - Max Iterations for current run: ${maxIterations}
    - Input Complexity: ${inputComplexity}
    - Current Product Length: ${currentProductLengthChars || 'N/A'} chars.
    - Last Model Used: ${lastUsedModel || "N/A (First iteration)"}
    - Last Config Used: ${lastConfigSummary}
    - Stagnation Status: ${stagnationInfo.isStagnant ? `Stagnant for ${stagnationInfo.consecutiveStagnantIterations} iterations.` : "Not stagnant."} (Similarity with prev: ${(stagnationInfo.similarityWithPrevious || 0).toFixed(3)}) (System Nudge Strategy applied by system for this turn: ${stagnationInfo.nudgeStrategyApplied})
    - Last Iteration Validation: ${lastValidationInfo ? `${lastValidationInfo.passed ? 'Passed.' : 'Failed.'} Reason: ${lastValidationInfo.reason || 'N/A'}` : 'N/A'}
    - Current Goal: ${currentGoal}
    - Content Stage Assessment: Is the current product a nascent idea needing expansion, a developed draft needing refinement, or a near-final piece needing polish? Is stagnation due to minor repetitive edits on an idea that actually needs to grow rather than just be polished?
    - Expansion Potential: Given the product length and recent changes (see summaries), does this appear to be an underdeveloped kernel that needs expansion more than polish? If so, what specific aspects should be expanded?
    ${iterationSummariesText}

    Suggest 'suggestedModelName', 'suggestedThinkingBudget', optionally 'suggestedTemperature'/'suggestedTopP'/'suggestedTopK', and optionally a 'suggestedMetaInstruction'. Provide a 'rationale'.
    If 'stagnationInfo.nudgeStrategyApplied' is 'meta_instruct', this is a strong signal to provide a 'suggestedMetaInstruction'.
    If 'Content Stage Assessment' or 'Expansion Potential' indicates an underdeveloped kernel, strongly consider expansionary tactics (expansionary meta-instruction, potentially temporary parameter adjustment for creativity if applicable and allowed).
    Prioritize 'gemini-2.5-flash-preview-04-17' or 'gemini-2.5-pro' for most tasks.
    `;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17', // Strategist itself uses Flash for efficiency
                contents: [{ role: "user", parts: [{text: strategistUserPrompt}] }],
                config: {
                    responseMimeType: "application/json",
                    temperature: 0.2, // Low temp for consistent JSON
                    systemInstruction: strategistSystemPrompt
                }
            });

            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            const advice = JSON.parse(jsonStr) as Partial<StrategistAdvice>;

            if (typeof advice.rationale !== 'string' || advice.rationale.trim() === "") {
                console.warn(`Strategist LLM advice (Attempt ${attempt + 1}) missing or empty rationale. Advice:`, advice);
                if (attempt === maxRetries) return null;
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                continue;
            }
            if (advice.suggestedModelName && !SELECTABLE_MODELS.find(m => m.name === advice.suggestedModelName)) {
                console.warn(`Strategist LLM (Attempt ${attempt + 1}) suggested an invalid model name: ${advice.suggestedModelName}. Ignoring suggestion.`);
                advice.suggestedModelName = undefined;
            }
            if (advice.suggestedThinkingBudget !== undefined && ![0, 1].includes(advice.suggestedThinkingBudget)) {
                console.warn(`Strategist LLM (Attempt ${attempt + 1}) suggested an invalid thinking budget: ${advice.suggestedThinkingBudget}. Ignoring suggestion.`);
                advice.suggestedThinkingBudget = undefined;
            }
            if (advice.suggestedMetaInstruction && typeof advice.suggestedMetaInstruction !== 'string') {
                console.warn(`Strategist LLM (Attempt ${attempt + 1}) suggested an invalid meta instruction type: ${typeof advice.suggestedMetaInstruction}. Ignoring suggestion.`);
                advice.suggestedMetaInstruction = undefined;
            }

            // Validate and clamp suggested parameters
            if (advice.suggestedTemperature !== undefined) {
                if (typeof advice.suggestedTemperature !== 'number' || advice.suggestedTemperature < 0.0 || advice.suggestedTemperature > 2.0) {
                    console.warn(`Strategist LLM (Attempt ${attempt + 1}) suggested invalid temperature: ${advice.suggestedTemperature}. Ignoring suggestion.`);
                    advice.suggestedTemperature = undefined;
                } else {
                    advice.suggestedTemperature = parseFloat(advice.suggestedTemperature.toFixed(2));
                }
            }
            if (advice.suggestedTopP !== undefined) {
                if (typeof advice.suggestedTopP !== 'number' || advice.suggestedTopP < 0.0 || advice.suggestedTopP > 1.0) {
                    console.warn(`Strategist LLM (Attempt ${attempt + 1}) suggested invalid TopP: ${advice.suggestedTopP}. Ignoring suggestion.`);
                    advice.suggestedTopP = undefined;
                } else {
                     advice.suggestedTopP = parseFloat(advice.suggestedTopP.toFixed(2));
                }
            }
            if (advice.suggestedTopK !== undefined) {
                 if (typeof advice.suggestedTopK !== 'number' || advice.suggestedTopK < 1 || !Number.isInteger(advice.suggestedTopK)) {
                    console.warn(`Strategist LLM (Attempt ${attempt + 1}) suggested invalid TopK: ${advice.suggestedTopK}. Ignoring suggestion.`);
                    advice.suggestedTopK = undefined;
                } else {
                    advice.suggestedTopK = Math.round(advice.suggestedTopK);
                }
            }

            return advice as StrategistAdvice;

        } catch (error: any) {
            console.error(`Strategist LLM call (Attempt ${attempt + 1}/${maxRetries + 1}) failed:`, error.message, error);
            const apiError = error.error || error; // Adjust based on actual error structure from SDK
            const statusCode = apiError.status || apiError.code;

            let isRetriable = false;
            if (statusCode) {
                const numericStatusCode = Number(statusCode);
                if ([500, 503, 504].includes(numericStatusCode)) isRetriable = true; // Standard retriable server errors
                else if (numericStatusCode === 429) { isRetriable = false; }
                else if (String(statusCode).startsWith('4')) isRetriable = false; // Most client errors are not retriable
                else isRetriable = true; // Default to retriable for unknown errors unless specifically non-retriable
            } else if (error.message && (error.message.toLowerCase().includes('network error') || error.message.toLowerCase().includes('failed to fetch'))) {
                isRetriable = true;
            } else if (error.name === 'GoogleGenerativeAIError' || (error.name && error.name.includes("GoogleGenerativeAIError"))) {
                // Assume GoogleGenerativeAIError might be retriable unless a specific non-retriable code/status is present
                 isRetriable = !(apiError && apiError.status && String(apiError.status).startsWith('4') && apiError.status !== 429);
            }


            if (isRetriable && attempt < maxRetries) {
                console.warn(`Retrying Strategist LLM call (Attempt ${attempt + 2}) in ${retryDelayMs}ms due to ${error.name || 'Error'}: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            } else {
                console.error(`Strategist LLM call failed after all ${maxRetries + 1} attempts or due to non-retriable error. Falling back to code heuristics. Final Error: ${error.message}`);
                return null;
            }
        }
    }
    return null;
};


export const generateInitialOutline = async (
    fileManifest: string,
    loadedFiles: LoadedFile[],
    modelConfig: ModelConfig,
    modelToUse: SelectableModelName
): Promise<OutlineGenerationResult> => {
    if (!ai || !apiKeyAvailable) {
        return { outline: "", identifiedRedundancies: "", errorMessage: "Gemini API client not initialized or API key missing." };
    }
    const { systemInstruction: outlineSystemInstruction, coreUserInstructions: outlineCoreUserInstructions } = getOutlineGenerationPromptComponents(fileManifest);
    const apiParts: Part[] = [];
    loadedFiles.forEach(file => { apiParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } }); });
    apiParts.push({ text: outlineCoreUserInstructions });

    const generationConfigForApi: any = {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
    };
    if (modelConfig.thinkingConfig && modelToUse === 'gemini-2.5-flash-preview-04-17') {
        generationConfigForApi.thinkingConfig = modelConfig.thinkingConfig;
    }

    const requestPayload: GenerateContentParameters = {
        model: modelToUse,
        contents: [{ role: "user", parts: apiParts }],
        config: {
            ...generationConfigForApi,
            systemInstruction: outlineSystemInstruction
        },
    };

    const apiStreamDetails: ApiStreamCallDetail[] = [];
    let accumulatedText = "";
    try {
        const response: GenerateContentResponse = await ai.models.generateContent(requestPayload); // Non-streaming for outline
        accumulatedText = response.text;
        let outline = "";
        let identifiedRedundancies = "";
        const outlineMatch = accumulatedText.match(/Outline:\s*([\s\S]*?)Redundancies:/i);
        const redundanciesMatch = accumulatedText.match(/Redundancies:\s*([\s\S]*)/i);

        if (outlineMatch && outlineMatch[1]) {
            outline = outlineMatch[1].trim();
        } else {
            const redIndex = accumulatedText.toLowerCase().indexOf("redundancies:");
            if (redIndex !== -1) {
                outline = accumulatedText.substring(0, redIndex).replace(/^outline:/i, "").trim();
            } else {
                outline = accumulatedText.replace(/^outline:/i, "").trim();
            }
        }
        if (redundanciesMatch && redundanciesMatch[1]) {
            identifiedRedundancies = redundanciesMatch[1].trim();
        }

        apiStreamDetails.push({
            callCount: 1,
            promptForThisCall: outlineCoreUserInstructions,
            finishReason: response.candidates?.[0]?.finishReason || "UNKNOWN",
            safetyRatings: response.candidates?.[0]?.safetyRatings || null,
            textLengthThisCall: accumulatedText.length,
            isContinuation: false
        });
        return { outline, identifiedRedundancies, apiDetails: apiStreamDetails };
    } catch (error: any) {
        console.error(`Error during Gemini API call for outline generation:`, error);
        let errorMessage = `An unknown API error occurred during outline generation. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
        return { outline: "", identifiedRedundancies: "", errorMessage, apiDetails: apiStreamDetails };
    }
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
  modelConfigToUse: ModelConfig,
  isGlobalMode: boolean,
  modelToUse: SelectableModelName,
  onStreamChunk: (chunkText: string) => void,
  isHaltSignalled: () => boolean,
  retryContext?: RetryContext,
  stagnationNudgeStrategy?: NudgeStrategy,
  initialOutlineForIter1?: OutlineGenerationResult,
  activeMetaInstruction?: string
): Promise<IterateProductResult> => {
  if (!ai || !apiKeyAvailable) {
    return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized or API key missing." };
  }

  const isInitialProductActuallyEmptyAndFilesLoaded = currentIterationOverall === 1 && loadedFiles.length > 0 && !initialOutlineForIter1;
  const { systemInstruction, coreUserInstructions } = getUserPromptComponents(
    currentIterationOverall, maxIterationsOverall,
    activePlanStage,
    outputParagraphShowHeadings, outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings,
    isGlobalMode,
    isInitialProductActuallyEmptyAndFilesLoaded,
    retryContext,
    stagnationNudgeStrategy,
    initialOutlineForIter1,
    loadedFiles, 
    activeMetaInstruction
  );

  const initialTextPromptPartForIteration = buildTextualPromptPart(
      currentProduct,
      fileManifest,
      coreUserInstructions,
      currentIterationOverall,
      initialOutlineForIter1
  );

  let accumulatedText = "";
  const apiStreamDetails: ApiStreamCallDetail[] = [];
  let streamCallCount = 0;
  let isContinuationCall = false;

  try {
    let continueStreaming = true;
    let finalChunkFromStream: GenerateContentResponse | null = null;

    while(continueStreaming) {
        streamCallCount++;
        if (isHaltSignalled()) {
          return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: "Process halted by user during API call preparation.", promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: initialTextPromptPartForIteration, apiStreamDetails };
        }

        let promptTextForThisApiCall: string;
        let partsForThisApiCall: Part[];

        if (isContinuationCall) {
          const continuationInstruction = `---PREVIOUSLY_GENERATED_PARTIAL_RESPONSE_THIS_ITERATION---\n${accumulatedText}\n---CONTINUATION_REQUEST---\nContinue generating the response from where you left off. Ensure you complete the thought or task. Adhere to all original instructions provided at the start of this iteration, especially regarding output format and not including conversational filler.`;
          partsForThisApiCall = [{ text: continuationInstruction }];
          promptTextForThisApiCall = continuationInstruction;
        } else {
            partsForThisApiCall = [];
            if (currentIterationOverall === 1 && loadedFiles.length > 0 && !initialOutlineForIter1) {
                loadedFiles.forEach(file => {
                    partsForThisApiCall.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } });
                });
            }
            partsForThisApiCall.push({ text: initialTextPromptPartForIteration });
            promptTextForThisApiCall = initialTextPromptPartForIteration;
        }

        const generationConfigForAPI: any = {
            temperature: modelConfigToUse.temperature,
            topP: modelConfigToUse.topP,
            topK: modelConfigToUse.topK,
        };
        if (systemInstruction && !isContinuationCall) {
            generationConfigForAPI.systemInstruction = systemInstruction;
        }
        if (activePlanStage && activePlanStage.format === 'json') {
            generationConfigForAPI.responseMimeType = "application/json";
        }
        if (modelConfigToUse.thinkingConfig && modelToUse === 'gemini-2.5-flash-preview-04-17') {
            generationConfigForAPI.thinkingConfig = modelConfigToUse.thinkingConfig;
        }

        const requestPayloadForStream: GenerateContentParameters = {
            model: modelToUse,
            contents: [{ role: "user", parts: partsForThisApiCall }],
            config: generationConfigForAPI
        };
        
        const streamResult = await ai.models.generateContentStream(requestPayloadForStream);

        let textFromThisStreamCall = "";
        finalChunkFromStream = null; // Reset for each stream call continuation
        for await (const chunk of streamResult) { 
            finalChunkFromStream = chunk; // Capture the latest chunk
            const chunkText = chunk.text;
            onStreamChunk(chunkText);
            textFromThisStreamCall += chunkText;
            if (isHaltSignalled()) break;
         }
        
        const currentFinishReason = finalChunkFromStream?.candidates?.[0]?.finishReason || "UNKNOWN";
        const currentSafetyRatings = finalChunkFromStream?.candidates?.[0]?.safetyRatings || null;
        
        accumulatedText += textFromThisStreamCall;

        apiStreamDetails.push({ callCount: streamCallCount, promptForThisCall: promptTextForThisApiCall, finishReason: currentFinishReason, safetyRatings: currentSafetyRatings, textLengthThisCall: textFromThisStreamCall.length, isContinuation: isContinuationCall });

        if (isHaltSignalled()) {
             return { product: accumulatedText, status: 'HALTED', promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: initialTextPromptPartForIteration, apiStreamDetails };
        }

        if (currentFinishReason === "MAX_TOKENS") {
            isContinuationCall = true; 
        } else if (currentFinishReason === null || currentFinishReason === "FINISH_REASON_UNSPECIFIED" || currentFinishReason === "OTHER" || currentFinishReason === "UNKNOWN") {
             if (accumulatedText.trim().length < 10 && currentFinishReason !== "STOP") { 
                 return { product: accumulatedText, status: 'ERROR', errorMessage: `API stream finished inconclusively: ${currentFinishReason || 'No Reason'} with minimal output.`, promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: initialTextPromptPartForIteration, apiStreamDetails };
             }
             continueStreaming = false;
        } else { 
            continueStreaming = false;
        }
    }

    if (accumulatedText.startsWith(CONVERGED_PREFIX)) {
        return { product: accumulatedText, status: 'CONVERGED', promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: initialTextPromptPartForIteration, apiStreamDetails };
     }
    return { product: accumulatedText, status: 'COMPLETED', promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: initialTextPromptPartForIteration, apiStreamDetails };

  } catch (error: any) {
    console.error(`Error during Gemini API call for Iteration ${currentIterationOverall}, Call ${streamCallCount}:`, error);
    let errorMessage = `An unknown API error occurred. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}. Check console for details.`;
    let isRateLimitErrorFlag = false;

    const detailedError = error.error || error; 
    const code = detailedError.code;
    const status = detailedError.status;
    let originalApiMessage = detailedError.message || error.message;

    if (typeof originalApiMessage === 'string') {
        const errorPrefix = `API Error (Code: ${code || 'N/A'}, Status: ${status || 'N/A'}, Name: ${error.name || 'N/A'}): `;
        if ( status === "RESOURCE_EXHAUSTED" || String(code).includes("429") || originalApiMessage.toUpperCase().includes("RESOURCE_EXHAUSTED") || originalApiMessage.toUpperCase().includes("RATE LIMIT") || originalApiMessage.includes("429") || originalApiMessage.toUpperCase().includes("QUOTA") ) {
            errorMessage = `${errorPrefix}API Quota Exceeded or Rate Limit Hit. Original: "${originalApiMessage}". For more info: https://ai.google.dev/gemini-api/docs/rate-limits.`;
            isRateLimitErrorFlag = true;
        } else { errorMessage = `${errorPrefix}${originalApiMessage}`; }
    } else if (error.toString) { 
        errorMessage = `API Call General Failure: ${error.toString()}`;
    }

    const currentPromptForErrorLog = apiStreamDetails.length > 0 ? apiStreamDetails[apiStreamDetails.length-1].promptForThisCall : (initialTextPromptPartForIteration || "N/A (Error before/during stream start or prompt capture)");
    if (apiStreamDetails.length === 0 || apiStreamDetails[apiStreamDetails.length-1].callCount !== (streamCallCount > 0 ? streamCallCount : 1)) {
      apiStreamDetails.push({ callCount: streamCallCount > 0 ? streamCallCount : 1, promptForThisCall: currentPromptForErrorLog, finishReason: error.name || "API_CALL_ERROR", safetyRatings: null, textLengthThisCall: accumulatedText.length, isContinuation: isContinuationCall });
    }
    return { product: accumulatedText || currentProduct, status: 'ERROR', errorMessage, promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: initialTextPromptPartForIteration, apiStreamDetails, isRateLimitError: isRateLimitErrorFlag };
  }
};