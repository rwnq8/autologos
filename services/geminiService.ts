

import { GoogleGenAI, type GenerateContentResponse, type Part, type Content, type FunctionDeclaration } from "@google/genai";
import { SELECTABLE_MODELS, type ModelConfig, type StaticAiModelDetails, type IterateProductResult, type ApiStreamCallDetail, type LoadedFile, type PlanStage, type SuggestedParamsResponse, type RetryContext, type OutlineGenerationResult, type NudgeStrategy, type SelectableModelName, type Version, StructuredIterationResponse, DocumentChunk, OutlineNode } from "../types/index.ts";
import { getUserPromptComponents, buildTextualPromptPart, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT, getOutlineGenerationPromptComponents } from './promptBuilderService.ts';
import { urlBrowseTool } from './toolDefinitions.ts';
import { formatVersion } from './versionUtils.ts';
import { classifyChunkType, reconstructFromChunks } from './chunkingService.ts';

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

  const systemInstruction = `Function: Analyze the input text. Generate a unique, memorable, 2-3 word project codename.
Output Requirements:
1. The codename MUST be in lower-kebab-case (e.g., 'cosmic-whale-odyssey', 'apollo-archive-retrieval').
2. The response MUST contain ONLY the codename, with no other text, explanation, or markdown.
3. Do not use generic words like 'project', 'file', 'document'. Be creative and thematic based on the content.`;

  // Use the actual file content for analysis, not the manifest string from initialPrompt.
  let contentForAnalysis = "";
  if (loadedFiles.length > 0) {
      contentForAnalysis = loadedFiles
          .map(f => f.content.substring(0, 20000)) // Truncate individual file contents for safety
          .join('\n\n');
  } else {
      contentForAnalysis = initialPrompt;
  }
  
  const promptForCodename = `Analyze the following content and generate a codename as per the system instructions.`;
  
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', // Fast and cheap for this task
      contents: promptForCodename + '\n\n' + contentForAnalysis,
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


export const generateInitialOutline = async (fileManifest: string, loadedFiles: LoadedFile[], modelConfig: ModelConfig, modelToUse: SelectableModelName, isOutlineMode: boolean, devLogContextString?: string): Promise<OutlineGenerationResult> => {
  if (!ai) return { outline: "", outlineNodes: [], identifiedRedundancies: "", errorMessage: "Gemini API client not initialized." };
  
  try {
    const { systemInstruction, coreUserInstructions } = getOutlineGenerationPromptComponents(fileManifest, isOutlineMode, loadedFiles);
    
    const requestParts: Part[] = loadedFiles.map(file => ({
      inlineData: { mimeType: getSanitizedMimeType(file.mimeType || 'text/plain'), data: toBase64(file.content) }
    }));
    requestParts.push({ text: coreUserInstructions });

    const { ...apiConfig } = modelConfig;
    
    const configForRequest: any = {
        ...apiConfig,
        systemInstruction,
    };
    if (isOutlineMode) {
        configForRequest.responseMimeType = "application/json";
    }

    const result: GenerateContentResponse = await ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: "user", parts: requestParts }],
        config: configForRequest
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

    if (isOutlineMode) {
        try {
            let jsonStr = responseText.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            const parsedResponse = JSON.parse(jsonStr);
            return {
                outline: JSON.stringify(parsedResponse.outline, null, 2), // Stringified for text view
                outlineNodes: parsedResponse.outline,
                identifiedRedundancies: "N/A in Outline Mode",
                apiDetails: apiStreamDetails
            };
        } catch (e: any) {
            const errorMessage = `CRITICAL: AI returned malformed JSON for outline, preventing processing. Error: ${e.message}. Raw output head: ${responseText.substring(0, 300)}`;
            console.error(errorMessage, {rawOutput: responseText});
            return { outline: "", outlineNodes: [], identifiedRedundancies: "", errorMessage, apiDetails: [] };
        }
    } else {
        // Text-based outline parsing
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
    }
  } catch (error: any) {
      console.error('Error during Gemini API call for outline generation:', error);
      let errorMessage = `An unknown API error occurred during outline generation. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
      return { outline: "", identifiedRedundancies: "", errorMessage, apiDetails: [] };
  }
};


export const iterateProduct = async ({
    currentProduct, documentChunks, currentOutline, currentFocusChunkIndex, currentVersion, maxIterationsOverall, fileManifest, loadedFiles,
    activePlanStage, outputParagraphShowHeadings, outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings,
    modelConfigToUse, isGlobalMode, isSearchGroundingEnabled, isUrlBrowsingEnabled, modelToUse, onStreamChunk, isHaltSignalled,
    retryContext, stagnationNudgeStrategy, initialOutlineForIter1, activeMetaInstruction,
    ensembleSubProducts, devLogContextString, isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
    isRadicalRefinementKickstart, isOutlineMode
}: {
    currentProduct: string; documentChunks: DocumentChunk[] | null; currentOutline: OutlineNode[] | null; currentFocusChunkIndex: number | null; currentVersion: Version; maxIterationsOverall: number; fileManifest: string;
    loadedFiles: LoadedFile[]; activePlanStage: PlanStage | null; outputParagraphShowHeadings: boolean;
    outputParagraphMaxHeadingDepth: number; outputParagraphNumberedHeadings: boolean;
    modelConfigToUse: ModelConfig; isGlobalMode: boolean; isSearchGroundingEnabled: boolean; isUrlBrowsingEnabled: boolean; modelToUse: SelectableModelName;
    onStreamChunk: (chunkText: string) => void; isHaltSignalled: () => boolean;
    retryContext?: RetryContext; stagnationNudgeStrategy?: NudgeStrategy;
    initialOutlineForIter1?: OutlineGenerationResult; activeMetaInstruction?: string;
    ensembleSubProducts?: string[] | null;
    devLogContextString?: string;
    isTargetedRefinementMode?: boolean; targetedSelectionText?: string; targetedRefinementInstructions?: string;
    isRadicalRefinementKickstart?: boolean; isOutlineMode: boolean;
}): Promise<IterateProductResult> => {
     if (!ai) return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized." };
    
    const modelData = SELECTABLE_MODELS.find(m => m.name === modelToUse);
    const isUsingTools = isSearchGroundingEnabled || (isUrlBrowsingEnabled && !!modelData?.supportsFunctionCalling);
    
    const isInitialProductEmptyAndFilesLoaded = (currentProduct === null || currentProduct.trim() === "") && loadedFiles.length > 0;
    const isSegmentedSynthesisMode = false;
    
    try {
        const { systemInstruction, coreUserInstructions } = getUserPromptComponents(
            currentVersion, maxIterationsOverall, activePlanStage, outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings, isGlobalMode,
            isInitialProductEmptyAndFilesLoaded,
            !isUsingTools, // isJsonMode: only true if NOT using tools
            isOutlineMode,
            retryContext, stagnationNudgeStrategy, initialOutlineForIter1, loadedFiles, activeMetaInstruction,
            isSegmentedSynthesisMode, undefined, undefined,
            isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
            isRadicalRefinementKickstart,
            devLogContextString,
            ensembleSubProducts
        );

        const { ...apiConfig } = modelConfigToUse;
        
        const fullUserPromptText = buildTextualPromptPart(
            isOutlineMode ? currentOutline : documentChunks,
            currentFocusChunkIndex ?? 0,
            loadedFiles,
            coreUserInstructions,
            currentVersion,
            initialOutlineForIter1,
            fileManifest, // Pass the summary manifest string here
            isOutlineMode,
            isTargetedRefinementMode,
            ensembleSubProducts
        );

        const initialUserParts: Part[] = [];
        const isStandardInitialSynthesis = isInitialProductEmptyAndFilesLoaded &&
                                           currentVersion.major === 1 &&
                                           currentVersion.minor === 0 &&
                                           (!ensembleSubProducts || ensembleSubProducts.length === 0);

        if (isStandardInitialSynthesis) {
            loadedFiles.forEach(file => {
                initialUserParts.push({ inlineData: { mimeType: getSanitizedMimeType(file.mimeType || 'text/plain'), data: toBase64(file.content) }});
            });
        }
        initialUserParts.push({ text: fullUserPromptText });

        const conversationHistory: Content[] = [{ role: 'user', parts: initialUserParts }];
        
        const tools: any[] = [];
        if (isSearchGroundingEnabled) {
            tools.push({ googleSearch: {} });
        }
        if (isUrlBrowsingEnabled && modelData?.supportsFunctionCalling) {
            tools.push({ functionDeclarations: [urlBrowseTool] });
        }

        const configForRequest: any = {
            ...apiConfig,
            systemInstruction,
            ...(tools.length > 0 && { tools }),
        };

        if (!isUsingTools) {
            configForRequest.responseMimeType = "application/json";
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
                            if (browseContent.length > 50000) {
                              browseContent = browseContent.substring(0, 50000) + "\n\n[Content truncated by system]";
                            }
                        } else {
                             browseSuccess = false;
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
        
        if (isUsingTools) {
            const lastDetailWithMetadata = [...apiStreamDetails].reverse().find(d => d.groundingMetadata);
            return {
                product: accumulatedText,
                status: 'COMPLETED',
                versionRationale: "(Not available when using tools like Google Search, as the API does not support structured JSON output in this mode.)",
                selfCritique: "(Not available when using tools, as the API does not support structured JSON output in this mode.)",
                suggestedNextStep: 'refine_further', // Default assumption in text mode
                apiStreamDetails,
                isStuckOnMaxTokensContinuation: apiStreamDetails[apiStreamDetails.length - 1]?.finishReason === 'MAX_TOKENS',
                promptSystemInstructionSent: systemInstruction,
                promptCoreUserInstructionsSent: coreUserInstructions,
                promptFullUserPromptSent: fullUserPromptText,
                groundingMetadata: lastDetailWithMetadata?.groundingMetadata
            };
        } else {
            let parsedResponse: StructuredIterationResponse;
            try {
                let jsonStr = accumulatedText.trim();
                const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
                const match = jsonStr.match(fenceRegex);
                if (match && match[2]) {
                  jsonStr = match[2].trim();
                }
                parsedResponse = JSON.parse(jsonStr);
            } catch (e) {
                const errorMessage = `CRITICAL: AI returned malformed JSON, preventing further processing. Error: ${(e as Error).message}. Raw output head: ${accumulatedText.substring(0, 300)}`;
                console.error(errorMessage, {rawOutput: accumulatedText});
                return { product: currentProduct, status: 'ERROR', errorMessage, apiStreamDetails, };
            }
            
            const isConverged = parsedResponse.suggestedNextStep === 'declare_convergence';
            const status = isConverged ? 'CONVERGED' : 'COMPLETED';
            const lastDetailWithMetadata = [...apiStreamDetails].reverse().find(d => d.groundingMetadata);

            if (isOutlineMode) {
                const newOutline = parsedResponse.outline || null;
                return {
                    product: newOutline ? JSON.stringify(newOutline, null, 2) : "[]",
                    outline: newOutline,
                    versionRationale: parsedResponse.versionRationale,
                    selfCritique: parsedResponse.selfCritique,
                    suggestedNextStep: parsedResponse.suggestedNextStep,
                    status, apiStreamDetails, isStuckOnMaxTokensContinuation: apiStreamDetails[apiStreamDetails.length - 1]?.finishReason === 'MAX_TOKENS',
                    promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptText,
                    groundingMetadata: lastDetailWithMetadata?.groundingMetadata
                };
            } else {
                let finalProduct = currentProduct;
                let updatedChunks = documentChunks;

                if (Array.isArray(parsedResponse.windowChunks) && parsedResponse.windowChunks.length > 0) {
                    const modificationsMap = new Map(parsedResponse.windowChunks.map(m => [m.chunkId, m.content]));
                    updatedChunks = (documentChunks || []).map(originalChunk => {
                        const newContent = modificationsMap.get(originalChunk.id);
                        if (newContent !== undefined) {
                            const newType = classifyChunkType(newContent);
                            return { ...originalChunk, content: newContent, type: newType };
                        } else {
                            return originalChunk;
                        }
                    });
                    finalProduct = reconstructFromChunks(updatedChunks);
                } else {
                    finalProduct = currentProduct;
                    updatedChunks = documentChunks;
                }
                return {
                    product: finalProduct, updatedChunks: updatedChunks, versionRationale: parsedResponse.versionRationale,
                    selfCritique: parsedResponse.selfCritique, suggestedNextStep: parsedResponse.suggestedNextStep, status,
                    apiStreamDetails, isStuckOnMaxTokensContinuation: apiStreamDetails[apiStreamDetails.length - 1]?.finishReason === 'MAX_TOKENS',
                    promptSystemInstructionSent: systemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: fullUserPromptText,
                    groundingMetadata: lastDetailWithMetadata?.groundingMetadata
                };
            }
        }
    } catch (error: any) {
        console.error(`Error during Gemini API call for Iteration ${formatVersion(currentVersion)}`, error);
        let errorMessage = `An unknown API error occurred. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
        let isRateLimitErrorFlag = false;

        const errorStr = String(error.message || error.toString() || '').toUpperCase();
        if (error.message && error.message.includes("is unsupported")) { // Catch the specific error
            errorMessage = `API Configuration Error: ${error.message}. This often happens when tools (like Search) are used with incompatible settings (like JSON output). The system tried to handle this, but an error still occurred.`;
        } else if (errorStr.includes("429") || errorStr.includes("QUOTA") || errorStr.includes("RATE LIMIT") || errorStr.includes("RESOURCE_EXHAUSTED")) {
            errorMessage = `API Quota Exceeded or Rate Limit Hit after multiple retries. Original: "${error.message}".`;
            isRateLimitErrorFlag = true;
        } else if (errorStr.includes("FUNCTION CALLING IS UNSUPPORTED")) {
            errorMessage = `The selected model (${modelToUse}) does not support function calling (URL Browsing tool). Please disable the tool or select a different model.`;
        }

        return { product: currentProduct, status: 'ERROR', errorMessage, isRateLimitError: isRateLimitErrorFlag };
    }
}
