

import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part, Content } from "@google/genai";
import type { ModelConfig, StaticAiModelDetails, IterateProductResult, ApiStreamCallDetail, LoadedFile, PlanStage, SuggestedParamsResponse, RetryContext, OutlineGenerationResult, NudgeStrategy, SelectableModelName } from "../types.ts";
import { getUserPromptComponents, buildTextualPromptPart, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT, getOutlineGenerationPromptComponents, CONVERGED_PREFIX } from './promptBuilderService';
import { SELECTABLE_MODELS } from '../types.ts';

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
        ai = new GoogleGenAI({apiKey: API_KEY});
        apiKeyAvailable = true;
    } catch (error) {
        console.error("Error during GoogleGenAI client initialization. Gemini API calls will be disabled.", error);
        ai = null;
        apiKeyAvailable = false;
    }
} else {
    if (!apiKeyWarningLoggedOnce) {
        console.warn("API_KEY was not found or is not configured. GoogleGenAI client not initialized. Gemini API calls will be disabled.");
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

export const generateInitialOutline = async (fileManifest: string, loadedFiles: LoadedFile[], modelConfig: ModelConfig, modelToUse: SelectableModelName, devLogContextString?: string): Promise<OutlineGenerationResult> => {
  if (!ai) return { outline: "", identifiedRedundancies: "", errorMessage: "Gemini API client not initialized." };
  
  try {
    const { systemInstruction, coreUserInstructions } = getOutlineGenerationPromptComponents(fileManifest);
    
    let fullPromptText = coreUserInstructions;
    if (loadedFiles.length > 0) {
        const fileContentsString = loadedFiles.map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n');
        fullPromptText += `\n\n--- FULL FILE CONTENTS ---\n${fileContentsString}`;
    }

    const response = await ai.models.generateContent({
        model: modelToUse,
        contents: fullPromptText,
        config: {
            ...modelConfig,
            systemInstruction: systemInstruction
        }
    });
    const apiStreamDetails: ApiStreamCallDetail[] = [{
        callCount: 1,
        promptForThisCall: fullPromptText,
        finishReason: response.candidates?.[0]?.finishReason || "UNKNOWN",
        safetyRatings: response.candidates?.[0]?.safetyRatings || null,
        textLengthThisCall: response.text.length,
        isContinuation: false
    }];

    const responseText = response.text;
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
    modelConfigToUse, isGlobalMode, modelToUse, onStreamChunk, isHaltSignalled,
    retryContext, stagnationNudgeStrategy, initialOutlineForIter1, activeMetaInstruction,
    devLogContextString, isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
    isRadicalRefinementKickstart
}: {
    currentProduct: string; currentIterationOverall: number; maxIterationsOverall: number; fileManifest: string;
    loadedFiles: LoadedFile[]; activePlanStage: PlanStage | null; outputParagraphShowHeadings: boolean;
    outputParagraphMaxHeadingDepth: number; outputParagraphNumberedHeadings: boolean;
    modelConfigToUse: ModelConfig; isGlobalMode: boolean; modelToUse: SelectableModelName;
    onStreamChunk: (chunkText: string) => void; isHaltSignalled: () => boolean;
    retryContext?: RetryContext; stagnationNudgeStrategy?: NudgeStrategy;
    initialOutlineForIter1?: OutlineGenerationResult; activeMetaInstruction?: string;
    devLogContextString?: string;
    isTargetedRefinementMode?: boolean; targetedSelectionText?: string; targetedRefinementInstructions?: string;
    isRadicalRefinementKickstart?: boolean;
}): Promise<IterateProductResult> => {
     if (!ai) return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized." };

    try {
        const { systemInstruction, coreUserInstructions } = getUserPromptComponents(
            currentIterationOverall, maxIterationsOverall, activePlanStage, outputParagraphShowHeadings,
            outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings, isGlobalMode,
            (currentProduct === null || currentProduct.trim() === "") && loadedFiles.length > 0,
            retryContext, stagnationNudgeStrategy, initialOutlineForIter1, loadedFiles, activeMetaInstruction,
            false, undefined, undefined,
            isTargetedRefinementMode, targetedSelectionText, targetedRefinementInstructions,
            isRadicalRefinementKickstart
        );

        const fullUserPromptText = buildTextualPromptPart(
            currentProduct, loadedFiles, coreUserInstructions, currentIterationOverall, initialOutlineForIter1, false, isTargetedRefinementMode
        );

        const generationConfig: any = { ...modelConfigToUse };
        if (activePlanStage?.format === 'json') {
            generationConfig.responseMimeType = "application/json";
        }

        if (systemInstruction) {
          generationConfig.systemInstruction = systemInstruction;
        }

        const streamGenerator = await ai.models.generateContentStream({
            model: modelToUse,
            contents: fullUserPromptText,
            config: generationConfig
        });
        
        let accumulatedText = "";
        const apiStreamDetails: ApiStreamCallDetail[] = [];
        let lastChunk: GenerateContentResponse | null = null;
        let callCount = 1;

        for await (const chunk of streamGenerator) {
            if (isHaltSignalled()) {
                return { product: accumulatedText || currentProduct, status: 'HALTED', errorMessage: 'Process halted by user during stream.' };
            }
            const chunkText = chunk.text;
            onStreamChunk(chunkText);
            accumulatedText += chunkText;
            lastChunk = chunk;
        }

        const finalFinishReason = lastChunk?.candidates?.[0]?.finishReason || "UNKNOWN";
        const safetyRatings = lastChunk?.candidates?.[0]?.safetyRatings || null;

        apiStreamDetails.push({
            callCount,
            promptForThisCall: fullUserPromptText,
            finishReason: finalFinishReason,
            safetyRatings,
            textLengthThisCall: accumulatedText.length,
            isContinuation: false,
        });
        
        const status = accumulatedText.startsWith(CONVERGED_PREFIX) ? 'CONVERGED' : 'COMPLETED';

        return {
            product: accumulatedText,
            status,
            apiStreamDetails,
            isStuckOnMaxTokensContinuation: finalFinishReason === 'MAX_TOKENS',
            promptSystemInstructionSent: systemInstruction,
            promptCoreUserInstructionsSent: coreUserInstructions,
            promptFullUserPromptSent: fullUserPromptText,
        };

    } catch (error: any) {
        console.error(`Error during Gemini API call for Iteration ${currentIterationOverall}`, error);
        let errorMessage = `An unknown API error occurred. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
        let isRateLimitErrorFlag = false;

        const errorStr = String(error.message || '').toUpperCase();
        if (errorStr.includes("429") || errorStr.includes("QUOTA") || errorStr.includes("RATE LIMIT") || errorStr.includes("RESOURCE_EXHAUSTED")) {
            errorMessage = `API Quota Exceeded or Rate Limit Hit. Original: "${error.message}".`;
            isRateLimitErrorFlag = true;
        }

        return {
            product: currentProduct,
            status: 'ERROR',
            errorMessage,
            isRateLimitError: isRateLimitErrorFlag,
        };
    }
}