import { GoogleGenAI, type GenerateContentResponse, type Part, type Content, type FunctionDeclaration } from "@google/genai";
import type { ModelConfig, StaticAiModelDetails, IterateProductResult, ApiStreamCallDetail, LoadedFile, PlanStage, SuggestedParamsResponse, RetryContext, OutlineGenerationResult, NudgeStrategy, SelectableModelName } from "../types.ts";
import { getUserPromptComponents, buildTextualPromptPart, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT, getOutlineGenerationPromptComponents, CONVERGED_PREFIX } from './promptBuilderService.ts';
import { SELECTABLE_MODELS } from '../types.ts';
import { urlBrowseTool } from './toolDefinitions.ts';

let apiKeyWarningLoggedOnce = false;

const API_KEY: string | undefined = (() => {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0) {
      return process.env.API_KEY;
    }
    return undefined;
  } catch (e) {
    if (!apiKeyWarningLoggedOnce) {
      console.error("Error accessing process.env.API_KEY. Gemini API calls will be disabled.", e);
      apiKeyWarningLoggedOnce = true;
    }
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
    if (!apiKeyWarningLoggedOnce) {
        console.warn("API_KEY was not found or is not configured. GoogleGenerativeAI client not initialized. Gemini API calls will be disabled.");
        apiKeyWarningLoggedOnce = true;
    }
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
    if (isGlobalMode && config.temperature > 0.7 && config.maxIterations && config.maxIterations > 20) {
        warnings.push("High starting temperature in Global Mode. Parameters will sweep towards deterministic more rapidly now; initial output may be diverse but will quickly focus.");
    }
    if (config.thinkingConfig?.thinkingBudget === 0 && config.modelName === 'gemini-2.5-flash-preview-04-17') {
        advice.thinkingConfig = "Thinking Budget is 0: Flash model will respond faster but may have lower quality for complex tasks.";
    }
    return { warnings, advice };
};

const toBase64 = (str: string): string => {
    try {
      // Use a robust method to handle UTF-8 strings for btoa by first percent-encoding.
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
          (match, p1) => String.fromCharCode(Number('0x' + p1))
      ));
    } catch (e) {
      console.error("Base64 encoding failed for a string. This should not happen in a browser context. Returning empty string.", e);
      return "";
    }
};

export const generateInitialOutline = async (fileManifest: string, loadedFiles: LoadedFile[], modelConfig: ModelConfig, modelToUse: SelectableModelName, devLogContextString?: string): Promise<OutlineGenerationResult> => {
  if (!ai) return { outline: "", identifiedRedundancies: "", errorMessage: "Gemini API client not initialized." };
  
  try {
    const { systemInstruction, coreUserInstructions } = getOutlineGenerationPromptComponents(fileManifest);
    
    const requestParts: Part[] = loadedFiles.map(file => ({
      inlineData: { mimeType: file.mimeType || 'text/plain', data: toBase64(file.content) }
    }));
    requestParts.push({ text: coreUserInstructions });

    const { modelName, maxIterations, ...apiConfig } = modelConfig;

    const result: GenerateContentResponse = await ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: "user", parts: requestParts }],
        config: {
            ...apiConfig,
            systemInstruction,
        }
    });

    const responseText = result.text;
    const finalResponse = result;

    const apiStreamDetails: ApiStreamCallDetail[] = [{
        callCount: 1,
        promptForThisCall: coreUserInstructions, // Simplified prompt log
        finishReason: finalResponse.candidates?.[0]?.finishReason || "UNKNOWN",
        safetyRatings: finalResponse.candidates?.[0]?.safetyRatings || null,
        textLengthThisCall: responseText.length,
        isContinuation: false
    }];

    let outline = "";
    let identifiedRedundancies = "";

    const outlineMatch = responseText.match(/Outline:([\s\S]*?)Redundancies:/i);
    const redundanciesMatch = responseText.match(/Redundancies:([\s\S]*)/i);

    if (outlineMatch && outlineMatch[1]) {
        outline = outlineMatch[1].trim();
    } else {
        const redIndex = responseText.toLowerCase().indexOf("redundancies:");
        if (redIndex !== -1) {
            outline = responseText.substring(0, redIndex).replace(/^outline:/i, "").trim();
        } else {
            outline = responseText.trim();
        }
    }

    if (redundanciesMatch && redundanciesMatch[1]) {
        identifiedRedundancies = redundanciesMatch[1].trim();
    }

    return { outline, identifiedRedundancies, apiDetails: apiStreamDetails };
  } catch (error: any) {
      console.error('Error during Gemini API call for outline generation:', error);
      let errorMessage = `An unknown API error occurred during outline generation. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
      return { outline: "", identifiedRedundancies: "", errorMessage, apiDetails: [] };
  }
};


export const iterateProduct = async ({
    currentProduct, currentIterationOverall, maxIterationsOverall, fileManifest, loadedFiles,
    activePlanStage, outputParagraphShowHeadings, outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings,
    modelConfigToUse, isGlobalMode, isSearchGroundingEnabled, isUrlBrowsingEnabled, modelToUse, onStreamChunk, isHaltSignalled,
    retryContext, stagnationNudgeStrategy, initialOutlineForIter1, activeMetaInstruction,
    devLogContextString, isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
    isRadicalRefinementKickstart
}: {
    currentProduct: string; currentIterationOverall: number; maxIterationsOverall: number; fileManifest: string;
    loadedFiles: LoadedFile[]; activePlanStage: PlanStage | null; outputParagraphShowHeadings: boolean;
    outputParagraphMaxHeadingDepth: number; outputParagraphNumberedHeadings: boolean;
    modelConfigToUse: ModelConfig; isGlobalMode: boolean; isSearchGroundingEnabled: boolean; isUrlBrowsingEnabled: boolean; modelToUse: SelectableModelName;
    onStreamChunk: (chunkText: string) => void; isHaltSignalled: () => boolean;
    retryContext?: RetryContext; stagnationNudgeStrategy?: NudgeStrategy;
    initialOutlineForIter1?: OutlineGenerationResult; activeMetaInstruction?: string;
    devLogContextString?: string;
    isTargetedRefinementMode?: boolean; targetedSelectionText?: string; targetedRefinementInstructions?: string;
    isRadicalRefinementKickstart?: boolean;
}): Promise<IterateProductResult> => {
     if (!ai) return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized." };
    
    const isInitialProductEmptyAndFilesLoaded = (currentProduct === null || currentProduct.trim() === "") && loadedFiles.length > 0;
    const isSegmentedSynthesisMode = false;

    try {
        const { systemInstruction, coreUserInstructions } = getUserPromptComponents(
            currentIterationOverall, maxIterationsOverall, activePlanStage, outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings, isGlobalMode,
            isInitialProductEmptyAndFilesLoaded,
            retryContext, stagnationNudgeStrategy, initialOutlineForIter1, loadedFiles, activeMetaInstruction,
            isSegmentedSynthesisMode, undefined, undefined,
            isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
            isRadicalRefinementKickstart
        );

        const { modelName, maxIterations, ...apiConfig } = modelConfigToUse;
        
        const fullUserPromptText = buildTextualPromptPart(
            currentProduct,
            loadedFiles,
            coreUserInstructions,
            currentIterationOverall,
            initialOutlineForIter1,
            fileManifest, // Pass the summary manifest string here
            isSegmentedSynthesisMode,
            isTargetedRefinementMode
        );

        const initialUserParts: Part[] = [];
        if (isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1) {
            loadedFiles.forEach(file => {
                initialUserParts.push({ inlineData: { mimeType: file.mimeType || 'text/plain', data: toBase64(file.content) }});
            });
        }
        initialUserParts.push({ text: fullUserPromptText });

        const conversationHistory: Content[] = [{ role: 'user', parts: initialUserParts }];

        let accumulatedText = "";
        const apiStreamDetails: ApiStreamCallDetail[] = [];
        let callCount = 0;
        let continueStreaming = true;

        const modelData = SELECTABLE_MODELS.find(m => m.name === modelToUse);

        while (continueStreaming) {
            callCount++;
            if (isHaltSignalled()) {
                return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: 'Process halted by user during preparation for API call.' };
            }

            let configForRequest: any;

            if (isSearchGroundingEnabled) {
                const tools: any[] = [{ googleSearch: {} }];
                if (isUrlBrowsingEnabled && modelData?.supportsFunctionCalling) {
                    tools.push({ functionDeclarations: [urlBrowseTool] });
                }
                // Per documentation, when using Google Search grounding, other parameters like temperature, topP, topK, and responseMimeType are omitted.
                configForRequest = { tools };
                // Note: systemInstruction is also omitted to strictly follow grounding guidelines.
            } else {
                const tools: any[] = [];
                if (isUrlBrowsingEnabled && modelData?.supportsFunctionCalling) {
                    tools.push({ functionDeclarations: [urlBrowseTool] });
                }
                configForRequest = {
                    ...apiConfig,
                    systemInstruction,
                    ...(tools.length > 0 && { tools }),
                };
            }
            
            const requestPayload: any = {
                model: modelToUse,
                contents: conversationHistory,
                config: configForRequest,
            };

            const streamResult = await ai.models.generateContentStream(requestPayload);

            let responseTextThisStream = "";
            let finalResponse: GenerateContentResponse | undefined;

            for await (const chunk of streamResult) {
                if (isHaltSignalled()) {
                    break;
                }
                const chunkText = chunk.text;
                onStreamChunk(chunkText);
                responseTextThisStream += chunkText;
                finalResponse = chunk;
            }
            
            let finalFinishReason = finalResponse?.candidates?.[0]?.finishReason || "UNKNOWN";
            let finalSafetyRatings = finalResponse?.candidates?.[0]?.safetyRatings || null;
            
            if (isHaltSignalled()) {
                 finalFinishReason = "HALTED";
            }

            // This logic is simplified. It assumes one tool call per turn maximum.
            // A more complex implementation would loop over multiple tool calls.
            const functionCalls = finalResponse?.candidates?.[0].content.parts.filter(part => !!part.functionCall);

            // Update the model's full response in the history for this turn
            // This logic correctly handles continuations by appending to the last model message
            const lastMessage = conversationHistory[conversationHistory.length - 1];
            if (lastMessage.role === 'model') {
                lastMessage.parts[0].text += responseTextThisStream;
            } else {
                conversationHistory.push({ role: 'model', parts: [{ text: responseTextThisStream }] });
            }

            if (functionCalls && functionCalls.length > 0 && finalFinishReason === "TOOL_CALL") {
                const call = functionCalls[0].functionCall!;
                const toolDetail: ApiStreamCallDetail = {
                  callCount,
                  promptForThisCall: "Tool Call Turn",
                  finishReason: finalFinishReason,
                  safetyRatings: finalSafetyRatings,
                  textLengthThisCall: 0,
                  isContinuation: callCount > 1,
                  functionCall: { name: call.name, args: call.args },
                };

                if(call.name === 'url_browse') {
                    const browseUrl = call.args.url;
                    // In a real app, you'd fetch the URL here. We simulate it.
                    const simulatedContent = `Simulated browsing of [${browseUrl}]: Content was analyzed. The key themes appear to be X, Y, and Z. This information will be used to improve the response.`;
                    
                    conversationHistory.push({
                      role: 'user', // This should be 'tool' but the SDK might use user role for function responses
                      parts: [{ functionResponse: { name: 'url_browse', response: { content: simulatedContent, success: true }}}]
                    });

                    toolDetail.functionResponse = { name: 'url_browse', response: { success: true, detail: simulatedContent } };
                }
                apiStreamDetails.push(toolDetail);
                // The loop continues to get the model's response after the tool call
                continue;
            }
            
            accumulatedText += responseTextThisStream;

            apiStreamDetails.push({
                callCount,
                promptForThisCall: callCount > 1 ? "Continue Request" : fullUserPromptText,
                finishReason: finalFinishReason,
                safetyRatings: finalSafetyRatings,
                textLengthThisCall: responseTextThisStream.length,
                isContinuation: callCount > 1,
                groundingMetadata: finalResponse?.candidates?.[0]?.groundingMetadata,
            });

            if (finalFinishReason === 'MAX_TOKENS') {
                continueStreaming = true;
                // Add a user message to prompt continuation, only if the last message was from the model
                if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'model') {
                    conversationHistory.push({ role: 'user', parts: [{ text: "Please continue generating the response from exactly where you left off. Do not repeat any part of the previous response or add conversational filler." }] });
                }
            } else {
                continueStreaming = false;
            }
        }
        
        const status = accumulatedText.startsWith(CONVERGED_PREFIX) ? 'CONVERGED' : 'COMPLETED';
        const lastDetailWithMetadata = [...apiStreamDetails].reverse().find(d => d.groundingMetadata);

        return {
            product: accumulatedText,
            status,
            apiStreamDetails,
            isStuckOnMaxTokensContinuation: apiStreamDetails[apiStreamDetails.length - 1]?.finishReason === 'MAX_TOKENS',
            promptSystemInstructionSent: systemInstruction,
            promptCoreUserInstructionsSent: coreUserInstructions,
            promptFullUserPromptSent: fullUserPromptText,
            groundingMetadata: lastDetailWithMetadata?.groundingMetadata
        };

    } catch (error: any) {
        console.error(`Error during Gemini API call for Iteration ${currentIterationOverall}`, error);
        let errorMessage = `An unknown API error occurred. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
        let isRateLimitErrorFlag = false;

        const errorStr = String(error.message || '').toUpperCase();
        if (errorStr.includes("429") || errorStr.includes("QUOTA") || errorStr.includes("RATE LIMIT") || errorStr.includes("RESOURCE_EXHAUSTED")) {
            errorMessage = `API Quota Exceeded or Rate Limit Hit. Original: "${error.message}".`;
            isRateLimitErrorFlag = true;
        } else if (errorStr.includes("FUNCTION CALLING IS UNSUPPORTED")) {
            errorMessage = `The selected model (${modelToUse}) does not support function calling (URL Browsing tool). Please disable the tool or select a different model.`;
        }

        return {
            product: currentProduct,
            status: 'ERROR',
            errorMessage,
            isRateLimitError: isRateLimitErrorFlag,
        };
    }
}