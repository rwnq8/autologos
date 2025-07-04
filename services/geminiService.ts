import { GoogleGenAI, type GenerateContentResponse, type Part, type Content, type FunctionDeclaration } from "@google/genai";
import { SELECTABLE_MODELS, type ModelConfig, type StaticAiModelDetails, type IterateProductResult, type ApiStreamCallDetail, type LoadedFile, type PlanStage, type SuggestedParamsResponse, type RetryContext, type OutlineGenerationResult, type NudgeStrategy, type SelectableModelName, type Version } from "../types/index.ts";
import { getUserPromptComponents, buildTextualPromptPart, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT, getOutlineGenerationPromptComponents, CONVERGED_PREFIX } from './promptBuilderService.ts';
import { urlBrowseTool } from './toolDefinitions.ts';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null;

if (!API_KEY) {
  console.warn("API_KEY was not found or is not configured. GoogleGenAI client not initialized. Gemini API calls will be disabled.");
  ai = null;
} else {
  // Per guidelines, initialize directly. The `ai` null check in each function will handle cases where this might fail.
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

const getSanitizedMimeType = (mimeType: string): string => {
    // The Gemini API does not support 'application/octet-stream' for inline text content.
    // As this application treats all files as text, we can safely default it to 'text/plain'.
    if (mimeType === 'application/octet-stream') {
        return 'text/plain';
    }
    return mimeType;
};


export const DEFAULT_MODEL_NAME: SelectableModelName = 'gemini-2.5-flash-preview-04-17';
export const CREATIVE_DEFAULTS: ModelConfig = { temperature: 0.75, topP: 0.95, topK: 60 };
export const FOCUSED_END_DEFAULTS: ModelConfig = { temperature: 0.0, topP: 1.0, topK: 1 };
export const GENERAL_BALANCED_DEFAULTS: ModelConfig = { temperature: 0.6, topP: 0.9, topK: 40 };

export const getAiModelDetails = (currentModelName: string): StaticAiModelDetails => {
  const model = SELECTABLE_MODELS.find(m => m.name === currentModelName);
  return { modelName: model ? model.displayName : currentModelName, tools: model ? model.description : "Details unavailable" };
};
export const isApiKeyAvailable = (): boolean => !!ai;

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

export const generateProjectCodename = async (initialPrompt: string, loadedFiles: LoadedFile[]): Promise<string> => {
  if (!ai) return `fallback-${Math.random().toString(36).substring(2, 8)}`;

  const systemInstruction = `You are a creative naming specialist. Your task is to analyze the provided text content and generate a unique, memorable, 2-3 word project codename. The codename MUST be in lower-kebab-case (e.g., 'cosmic-whale-odyssey', 'apollo-archive-retrieval'). Do not use generic words like 'project', 'file', 'document'. Be creative and thematic based on the content. Respond with ONLY the codename and nothing else.`;

  let fullContent = `--- PROMPT ---\n${initialPrompt}\n\n`;
  if (loadedFiles.length > 0) {
    const filesContent = loadedFiles
      .map(file => `--- FILE: ${file.name} ---\n${file.content.substring(0, 20000)}`) // Truncate individual file contents for safety
      .join('\n\n');
    fullContent += filesContent;
  }

  const promptForCodename = `Analyze the following content and generate a codename as per the system instructions.`;
  
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', // Fast and cheap for this task
      contents: promptForCodename + '\n\n' + fullContent,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8, // Be creative
        topP: 0.95,
        topK: 50,
        thinkingConfig: { thinkingBudget: 0 } // Low latency
      }
    });
    
    const codename = result.text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (codename) {
      return codename;
    }
    // Fallback if AI returns empty string
    throw new Error("AI returned an empty codename.");
  } catch (error) {
    console.error("Error generating project codename:", error);
    return `fallback-${Math.random().toString(36).substring(2, 8)}`; // Fallback
  }
};


export const generateInitialOutline = async (fileManifest: string, loadedFiles: LoadedFile[], modelConfig: ModelConfig, modelToUse: SelectableModelName, devLogContextString?: string): Promise<OutlineGenerationResult> => {
  if (!ai) return { outline: "", identifiedRedundancies: "", errorMessage: "Gemini API client not initialized." };
  
  try {
    const { systemInstruction, coreUserInstructions } = getOutlineGenerationPromptComponents(fileManifest);
    
    const requestParts: Part[] = loadedFiles.map(file => ({
      inlineData: { mimeType: getSanitizedMimeType(file.mimeType || 'text/plain'), data: toBase64(file.content) }
    }));
    requestParts.push({ text: coreUserInstructions });

    const { ...apiConfig } = modelConfig;

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
    ensembleSubProducts, devLogContextString, isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
    isRadicalRefinementKickstart
}: {
    currentProduct: string; currentIterationOverall: number; maxIterationsOverall: number; fileManifest: string;
    loadedFiles: LoadedFile[]; activePlanStage: PlanStage | null; outputParagraphShowHeadings: boolean;
    outputParagraphMaxHeadingDepth: number; outputParagraphNumberedHeadings: boolean;
    modelConfigToUse: ModelConfig; isGlobalMode: boolean; isSearchGroundingEnabled: boolean; isUrlBrowsingEnabled: boolean; modelToUse: SelectableModelName;
    onStreamChunk: (chunkText: string) => void; isHaltSignalled: () => boolean;
    retryContext?: RetryContext; stagnationNudgeStrategy?: NudgeStrategy;
    initialOutlineForIter1?: OutlineGenerationResult; activeMetaInstruction?: string;
    ensembleSubProducts?: string[] | null;
    devLogContextString?: string;
    isTargetedRefinementMode?: boolean; targetedSelectionText?: string; targetedRefinementInstructions?: string;
    isRadicalRefinementKickstart?: boolean;
}): Promise<IterateProductResult> => {
     if (!ai) return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized." };
    
    const isInitialProductEmptyAndFilesLoaded = (currentProduct === null || currentProduct.trim() === "") && loadedFiles.length > 0;
    const isSegmentedSynthesisMode = false;
    const currentVersion: Version = { major: currentIterationOverall, minor: 0 }; // Assume minor is 0 for this context

    try {
        const { systemInstruction, coreUserInstructions } = getUserPromptComponents(
            currentVersion, maxIterationsOverall, activePlanStage, outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings, isGlobalMode,
            isInitialProductEmptyAndFilesLoaded,
            retryContext, stagnationNudgeStrategy, initialOutlineForIter1, loadedFiles, activeMetaInstruction,
            isSegmentedSynthesisMode, undefined, undefined,
            isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
            isRadicalRefinementKickstart,
            devLogContextString,
            ensembleSubProducts
        );

        const { ...apiConfig } = modelConfigToUse;
        
        const fullUserPromptText = buildTextualPromptPart(
            currentProduct,
            loadedFiles,
            coreUserInstructions,
            currentVersion,
            initialOutlineForIter1,
            fileManifest, // Pass the summary manifest string here
            isSegmentedSynthesisMode,
            isTargetedRefinementMode,
            ensembleSubProducts
        );

        const initialUserParts: Part[] = [];
        if (isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1) {
            loadedFiles.forEach(file => {
                initialUserParts.push({ inlineData: { mimeType: getSanitizedMimeType(file.mimeType || 'text/plain'), data: toBase64(file.content) }});
            });
        }
        initialUserParts.push({ text: fullUserPromptText });

        const conversationHistory: Content[] = [{ role: 'user', parts: initialUserParts }];
        
        const modelData = SELECTABLE_MODELS.find(m => m.name === modelToUse);
        let configForRequest: any;

        if (isSearchGroundingEnabled) {
            const tools: any[] = [{ googleSearch: {} }];
            configForRequest = { tools };
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

        let accumulatedText = "";
        const apiStreamDetails: ApiStreamCallDetail[] = [];
        let callCount = 0;
        let continueStreaming = true;

        while (continueStreaming) {
            callCount++;
            if (isHaltSignalled()) {
                return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: 'Process halted by user during preparation for API call.' };
            }
            
            const requestPayload: any = {
                model: modelToUse,
                contents: conversationHistory,
                config: configForRequest,
            };
            
            const MAX_RETRIES = 3;
            const INITIAL_DELAY_MS = 2000;
            let attempt = 0;
            let streamResult;

            while (attempt < MAX_RETRIES) {
                if (isHaltSignalled()) {
                    return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: 'Process halted by user during API retry loop.' };
                }
                try {
                    streamResult = await ai.models.generateContentStream(requestPayload);
                    break; // Success
                } catch (error: any) {
                    const errorStr = String(error.message || error.toString() || '').toUpperCase();
                    const isRateLimitError = error.toString().includes("429") || errorStr.includes("QUOTA") || errorStr.includes("RATE LIMIT") || errorStr.includes("RESOURCE_EXHAUSTED");

                    if (isRateLimitError && attempt < MAX_RETRIES - 1) {
                        attempt++;
                        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                        console.warn(`Rate limit hit on API call ${callCount}. Retrying attempt ${attempt}/${MAX_RETRIES} after ${delay}ms...`, error);
                        onStreamChunk(`\n[SYSTEM: API rate limit hit. Retrying in ${delay / 1000}s...]\n`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        onStreamChunk(`\n[SYSTEM: Retrying API call, attempt ${attempt + 1}...]\n`);
                    } else {
                        // Not a rate limit error, or max retries reached. Re-throw to be caught by the main function's catch block.
                        throw error;
                    }
                }
            }
            
            if (!streamResult) {
                 throw new Error("API call failed to produce a result after multiple retries.");
            }

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

            const functionCalls = finalResponse?.candidates?.[0]?.content?.parts?.filter(part => !!part.functionCall);

            if (functionCalls && functionCalls.length > 0 && finalFinishReason === "TOOL_CALL") {
                if(finalResponse?.candidates?.[0]?.content) {
                    conversationHistory.push(finalResponse.candidates[0].content);
                }

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

                if (call.name === 'url_browse') {
                    const browseUrl = call.args.url;
                    let browseContent = '';
                    let browseSuccess = false;
                
                    try {
                        const proxyResponse = await fetch(`/browse-proxy/${encodeURIComponent(String(browseUrl))}`);
                        browseContent = await proxyResponse.text();
                        if (proxyResponse.ok) {
                            browseSuccess = true;
                            // Truncate for safety to prevent huge context windows
                            if (browseContent.length > 50000) {
                              browseContent = browseContent.substring(0, 50000) + "\n\n[Content truncated by system]";
                            }
                        } else {
                             browseSuccess = false;
                             // The body of the error response from the SW is the error message
                        }
                    } catch (e: any) {
                        browseSuccess = false;
                        browseContent = `Failed to fetch URL via proxy. Error: ${e.message}`;
                    }
                
                    conversationHistory.push({
                        role: 'tool',
                        parts: [{ functionResponse: { name: 'url_browse', response: { content: browseContent, success: browseSuccess }}}]
                    });
                
                    toolDetail.functionResponse = { name: 'url_browse', response: { success: browseSuccess, detail: `Fetched ${browseContent.length} chars. Success: ${browseSuccess}` } };
                }
                apiStreamDetails.push(toolDetail);
                continue; // Continue the while loop to get the next response from the model
            } else {
                const lastMessage = conversationHistory[conversationHistory.length - 1];
                if (lastMessage?.role === 'model') {
                    lastMessage.parts[0].text += responseTextThisStream;
                } else {
                    conversationHistory.push({ role: 'model', parts: [{ text: responseTextThisStream }] });
                }
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
                if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'model') {
                    conversationHistory.push({ role: 'user', parts: [{ text: "Please continue generating the response from exactly where you left off. Do not repeat any part of the previous response or add conversational filler." }] });
                }
            } else {
                continueStreaming = false;
            }
        }
        
        let trimmedProduct = accumulatedText.trim();
        // Clean the CONVERGED prefix from the final product before returning
        if (trimmedProduct.startsWith(CONVERGED_PREFIX)) {
            trimmedProduct = trimmedProduct.substring(CONVERGED_PREFIX.length).trim();
        }
        const isConverged = accumulatedText.trim().startsWith(CONVERGED_PREFIX);
        const finalProduct = trimmedProduct;
        const status = isConverged ? 'CONVERGED' : 'COMPLETED';

        const lastDetailWithMetadata = [...apiStreamDetails].reverse().find(d => d.groundingMetadata);

        return {
            product: finalProduct,
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
            errorMessage = `API Quota Exceeded or Rate Limit Hit after multiple retries. Original: "${error.message}".`;
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