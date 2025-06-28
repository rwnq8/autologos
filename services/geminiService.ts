


import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part, Content } from "@google/genai";
import type { ModelConfig, StaticAiModelDetails, IterateProductResult, ApiStreamCallDetail, LoadedFile, PlanStage, SuggestedParamsResponse, RetryContext, OutlineGenerationResult, NudgeStrategy, SelectableModelName, StrategistAdvice, IterationLogEntry, AiResponseValidationInfo, StagnationInfo, StrategistLLMContext } from "../types.ts"; // Added StrategistLLMContext
import { getUserPromptComponents, buildTextualPromptPart, CONVERGED_PREFIX, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT, getOutlineGenerationPromptComponents } from './promptBuilderService';
import { SELECTABLE_MODELS } from '../types.ts';

let apiKeyWarningLoggedOnce = false; // Log API key warnings only once

const API_KEY: string | undefined = (() => {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0) {
      return process.env.API_KEY;
    } else if (typeof process !== 'undefined' && process.env && process.env.API_KEY === undefined) {
      if (!apiKeyWarningLoggedOnce) {
          console.warn("process.env.API_KEY is undefined. Gemini API calls will be disabled if a key is not found by other means.");
          apiKeyWarningLoggedOnce = true;
      }
    } else if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      if (!apiKeyWarningLoggedOnce) {
          console.warn("process.env.API_KEY found but is not a non-empty string. Gemini API calls will be disabled if a key is not found by other means.");
          apiKeyWarningLoggedOnce = true;
      }
    } else {
        // This case is common in browser environments, so logging it as a general info or debug might be better if frequent.
        // console.info("Could not access process.env or API_KEY. This is expected in some environments. Checking other sources if applicable.");
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
    if (!apiKeyWarningLoggedOnce && (typeof process !== 'undefined' && process.env)) { // Only log if process.env was accessible but key wasn't there
        console.warn("API_KEY was not found or is not configured. GoogleGenAI client not initialized. Gemini API calls will be disabled.");
        apiKeyWarningLoggedOnce = true; // Prevent repeated warnings from this specific path
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

    if(isGlobalMode && config.temperature > 0.7 && config.maxIterations && config.maxIterations > 20) { // Max iterations check might be less relevant with faster sweep
        warnings.push("High starting temperature in Global Mode. Parameters will sweep towards deterministic more rapidly now; initial output may be diverse but will quickly focus.");
    }
    if (config.thinkingConfig?.thinkingBudget === 0 && config.modelName === 'gemini-2.5-flash-preview-04-17') {
        advice.thinkingConfig = "Thinking Budget is 0: Flash model will respond faster but may have lower quality for complex tasks.";
    }

    return { warnings, advice };
};

const selectableModelsListString = SELECTABLE_MODELS.map(m => `'${m.name}' ('${m.description.split('.')[0]}')`).join(', ');
const strategistSystemPrompt = `You are an AI Process Strategist. Your task is to analyze the current state of an iterative content generation process (provided as qualitative assessments) and suggest the optimal Gemini model, its thinking configuration (if applicable for 'gemini-2.5-flash-preview-04-17'), optionally minor adjustments to temperature/TopP/TopK, and optionally a meta-instruction for the *next* iteration of the main content generation AI.
    Provide your response strictly in JSON format with the following fields: "suggestedModelName" (optional string from valid list), "suggestedThinkingBudget" (optional, 0 or 1 for 'gemini-2.5-flash-preview-04-17' only), "suggestedTemperature" (optional number), "suggestedTopP" (optional number), "suggestedTopK" (optional integer), "suggestedMetaInstruction" (optional string, 1-2 concise sentences for the main AI if it's highly stagnant or needs a new approach), and a mandatory "rationale" (1-3 sentences explaining your overall advice).
    Valid models for 'suggestedModelName': ${selectableModelsListString}.

    Value is not just refinement; for underdeveloped products, value lies in substantial conceptual expansion, addition of new details, examples, or arguments. Distinguish between a product needing polish and one needing growth.

    INTERPRETATION OF STAGNATION:
    - If \`stagnationSeverity\` is 'MILD', 'MODERATE', 'SEVERE', or 'CRITICAL', OR if \`recentIterationPerformance\` is 'LOW_VALUE' or 'STALLED', then the process IS showing signs of stagnation. Your rationale and suggestions should reflect this understanding. Do NOT state 'no stagnation' if these indicators are present.

    PRIORITIZE EXPANSION FOR UNDERDEVELOPED KERNELS / AVOID WORDSMITHING / RADICAL REFINEMENT KICKSTART:
    - "Wordsmithing" or "minimal meaningful change" is indicated by a 'STALLED' or 'LOW_VALUE' \`recentIterationPerformance\` or high \`stagnationInfo.consecutiveLowValueIterations\`, \`stagnationInfo.consecutiveIdenticalProductIterations\`, or \`stagnationInfo.consecutiveWordsmithingIterations\` (e.g., >0). (Wordsmithing definition for AI: very high similarity like >0.98, very low character delta <30, minimal line changes, no new concepts introduced).
    - If \`stagnationSeverity\` is 'CRITICAL' (especially due to high \`consecutiveWordsmithingIterations\` or \`consecutiveLowValueIterations\`) and previous meta-instruction nudges have failed (indicated by high counts in \`stagnationInfo\` despite nudges), the client may trigger a "Radical Refinement Kickstart".
        In this "Radical Refinement Kickstart" scenario:
        - Your PRIMARY GOAL is to suggest a 'suggestedMetaInstruction' that guides a MAJOR RE-CONCEPTUALIZATION or REWRITE of the product or a key problematic section.
        - Example Kickstart Meta-Instructions: "RADICAL REFINEMENT: The current product/section on [Topic X] is severely wordsmithed. Re-evaluate original inputs and rewrite [Topic X] focusing on net new conceptual depth and fresh perspectives. Minor changes are forbidden." or "RADICAL REFINEMENT: Current output has stalled. Re-synthesize the document, prioritizing [core goal/theme from original prompt/outline], ensuring comprehensive detail from source files and avoiding superficial similarities to the previous stalled version."
        - Do NOT suggest minor parameter tweaks for a Kickstart. The client will handle temporary parameter boosts if needed for this mode. Your role is high-level guidance for the rewrite.
    - If NOT a Kickstart, but \`productDevelopmentState\` is 'UNDERDEVELOPED_KERNEL' or 'NEEDS_EXPANSION_STALLED', OR if (\`recentIterationPerformance\` is 'LOW_VALUE' or 'STALLED' due to wordsmithing) while \`productDevelopmentState\` is not 'MATURE_PRODUCT':
        This strongly indicates an underdeveloped kernel or unproductive wordsmithing. Your **ABSOLUTE PRIORITY** is to suggest a 'suggestedMetaInstruction' that explicitly directs the main AI to **substantially expand or conceptually alter** the content. Examples:
        - "The product is currently '\${productDevelopmentState}'. Substantially expand on [strategist-identified key concept or section from outline/summaries], provide concrete examples, and explore related arguments to significantly increase its depth and breadth."
        - "WORDSMITHING DETECTED (\`stagnationInfo.consecutiveWordsmithingIterations\` is \${stagnationInfo.consecutiveWordsmithingIterations}). Add a completely new paragraph discussing [specific, relevant concept from summaries/outline not yet elaborated]. Focus on net new information and conceptual change."
    - If \`stagnationInfo.consecutiveWordsmithingIterations\` is high (e.g., >= 2), this is a strong signal that previous strategies failed. Your 'suggestedMetaInstruction' MUST be significantly different and more forceful than previous ones, demanding specific, measurable additions or structural changes.
    - If the main AI's effective parameters appear overly restrictive hindering necessary expansion, **strongly consider suggesting a 'suggestedTemperature' that encourages more creative exploration (e.g., in the 0.3-0.6 range) for the next 1-2 iterations.**

    CRITICAL STAGNATION ON MATURE PRODUCTS:
    - If \`stagnationSeverity\` is 'SEVERE' or 'CRITICAL' AND \`productDevelopmentState\` is 'MATURE_PRODUCT' (and not a Kickstart scenario):
        Your 'suggestedMetaInstruction' should prompt the main AI to either:
        a) Declare '\${CONVERGED_PREFIX}' if truly complete.
        b) Undertake a *significant, novel expansion* on a specific, narrowly defined underdeveloped aspect.
        c) Attempt a *bold structural refactoring* of a major section.

    COST-BENEFIT & CONVERGENCE (Pay close attention to \`stagnationSeverity\`, \`recentIterationPerformance\`, and \`productDevelopmentState\`):
    - If \`stagnationSeverity\` is 'MODERATE', 'SEVERE' or 'CRITICAL':
        - If \`productDevelopmentState\` is 'UNDERDEVELOPED_KERNEL' or 'NEEDS_EXPANSION_STALLED', prioritize expansionary meta-instructions and possibly more exploratory parameters first.
        - Only if \`productDevelopmentState\` is 'MATURE_PRODUCT' and \`recentIterationPerformance\` is 'LOW_VALUE' or 'STALLED' should you then recommend convergence (meta-instruction like '\${CONVERGED_PREFIX} Product is mature and further iteration offers minimal value.' and deterministic params if appropriate).
    
    GLOBAL MODE PARAMETER SWEEP AWARENESS:
    - In Global Mode, core generation parameters (Temperature, Top-P, Top-K) generally sweep from more creative values towards more deterministic values.
    - Suggest specific core generation parameters ('suggestedTemperature', 'suggestedTopP', 'suggestedTopK') only when you have a strong strategic rationale for the main AI to deviate from its default parameter sweep for the *immediate next step*, UNLESS a "Radical Refinement Kickstart" is indicated (then focus on meta-instruction).

    RECENT VALIDATION HISTORY AWARENESS (Handling Truncation/Incompleteness):
    - If 'Last N Validation Summaries' show a pattern of non-critical warnings like 'max_tokens_with_incomplete_sentence' or 'unknown_finish_reason_abrupt_end', this might indicate the AI is struggling with output length or completeness.
    - In such cases, strongly consider suggesting a 'suggestedMetaInstruction' to the main AI like: "Focus on providing more concise but complete responses, ensuring final paragraphs/sections are fully concluded and all requested parts of the output are present."
    
    CRITICAL ASSESSMENT (General):
    - If \`stagnationSeverity\` is 'SEVERE' or 'CRITICAL', or system nudge strategy (\`stagnationInfo.nudgeStrategyApplied\`) is 'meta_instruct', or last validation failed critically, strongly consider suggesting a 'suggestedMetaInstruction'.

    Actionable Meta-Instructions: Examples: "Focus on improving logical flow between sections X and Y." or "Simplify complex terminology in the discussion of Z." or "Re-evaluate argument A for consistency with source data." or "Substantially expand on topic X, adding specific examples and detailed explanations."
    Ensure 'rationale' is comprehensive (2-4 sentences) and justifies ALL suggestions.`;


export const getStrategicAdviceFromLLM = async (
    context: StrategistLLMContext
): Promise<StrategistAdvice | null> => {
    if (!ai || !apiKeyAvailable) {
        return null;
    }

    const {
        currentIteration, maxIterations, inputComplexity, lastUsedModel, lastUsedConfig,
        stagnationInfo, stagnationNudgeAggressiveness, lastNValidationSummariesString,
        currentGoal, recentIterationSummaries, productDevelopmentState,
        stagnationSeverity, recentIterationPerformance, currentRefinementFocusHint
    } = context;

    const maxRetries = 1;
    const retryDelayMs = 1000;
   
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
   
    const stagnationDetails = `IsStagnant: ${stagnationInfo.isStagnant}, ConsecutiveStagnant: ${stagnationInfo.consecutiveStagnantIterations}, ConsecutiveIdentical: ${stagnationInfo.consecutiveIdenticalProductIterations}, ConsecutiveLowValue: ${stagnationInfo.consecutiveLowValueIterations}, ConsecutiveWordsmithing: ${stagnationInfo.consecutiveWordsmithingIterations || 0}, NudgeAppliedBySystem: ${stagnationInfo.nudgeStrategyApplied}, SimilarityWithPrevious: ${(stagnationInfo.similarityWithPrevious || 0).toFixed(3)}, LastMeaningfulChangeProductLength (Qualitative): ${productDevelopmentState}`;


    const strategistUserPrompt = `
    Process State for Next Iteration (${currentIteration + 1}/${maxIterations}):
    - Current Iteration: ${currentIteration} (completed)
    - Max Iterations for current run: ${maxIterations}
    - Input Complexity (Qualitative): ${inputComplexity}
    - StagnationNudgeAggressiveness (System Setting): ${stagnationNudgeAggressiveness}
    - Product Development State (Qualitative): ${productDevelopmentState}
    - Stagnation Severity (Qualitative): ${stagnationSeverity}
    - Recent Iteration Performance (Qualitative): ${recentIterationPerformance}
    - Last Model Used: ${lastUsedModel || "N/A (First iteration)"}
    - Last Config Used (effective params for this iteration if no override): ${lastConfigSummary}
    - Stagnation Status (Raw Data for Context): ${stagnationDetails}
    - Last N Validation Summaries: ${lastNValidationSummariesString || "N/A (No validation history or first iteration)"}
    - Current Refinement Focus Hint: ${currentRefinementFocusHint || 'General Refinement'}
    - Current Goal: ${currentGoal}
    - Content Stage Assessment: Based on 'Product Development State', 'Recent Iteration Performance', and 'Stagnation Severity', is the current product a nascent idea needing expansion, a developed draft needing refinement, or a near-final piece needing polish? Is stagnation due to minor repetitive edits (wordsmithing) on an idea that actually needs to grow?
    - Expansion Potential & Value Assessment: Given the qualitative assessments, current goal, and recent iteration summaries, is substantial expansion the highest value action for the *next* iteration? Or would focused refinement, consolidation, or even preparing for convergence be more appropriate? If expansion, what specific areas offer the most value and why? If refinement, what specific aspect should be targeted?
    ${iterationSummariesText}

    Suggest 'suggestedModelName', 'suggestedThinkingBudget', optionally 'suggestedTemperature'/'suggestedTopP'/'suggestedTopK', and optionally a 'suggestedMetaInstruction'. Provide a 'rationale'.
    If system nudge strategy (\`stagnationInfo.nudgeStrategyApplied\`) is 'meta_instruct' or if \`stagnationSeverity\` is 'SEVERE' or 'CRITICAL', this is a strong signal to provide a 'suggestedMetaInstruction'.
    If \`stagnationSeverity\` is high, carefully consider if convergence is appropriate or if expansion is still needed based on \`productDevelopmentState\` and \`StagnationNudgeAggressiveness\`.
    Prioritize 'gemini-2.5-flash-preview-04-17' or 'gemini-2.5-pro' for most tasks.
    `;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (!ai) {
                throw new Error("GoogleGenAI client not initialized.");
            }
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17',
                contents: [{ role: "user", parts: [{text: strategistUserPrompt}] }],
                config: {
                    systemInstruction: strategistSystemPrompt,
                    responseMimeType: "application/json",
                    temperature: 0.2,
                }
            });
            const response = result;
            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            const advice = JSON.parse(jsonStr) as Partial<StrategistAdvice>;

            if (typeof advice.rationale !== 'string' || advice.rationale.trim() === "") {
                if (attempt === maxRetries) return null;
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                continue;
            }
            if (advice.suggestedModelName && !SELECTABLE_MODELS.find(m => m.name === advice.suggestedModelName)) {
                advice.suggestedModelName = undefined;
            }
            if (advice.suggestedThinkingBudget !== undefined && ![0, 1].includes(advice.suggestedThinkingBudget)) {
                advice.suggestedThinkingBudget = undefined;
            }
            if (advice.suggestedMetaInstruction && typeof advice.suggestedMetaInstruction !== 'string') {
                advice.suggestedMetaInstruction = undefined;
            }

            if (advice.suggestedTemperature !== undefined) {
                if (typeof advice.suggestedTemperature !== 'number' || advice.suggestedTemperature < 0.0 || advice.suggestedTemperature > 2.0) {
                    advice.suggestedTemperature = undefined;
                } else {
                    advice.suggestedTemperature = parseFloat(advice.suggestedTemperature.toFixed(2));
                }
            }
            if (advice.suggestedTopP !== undefined) {
                if (typeof advice.suggestedTopP !== 'number' || advice.suggestedTopP < 0.0 || advice.suggestedTopP > 1.0) {
                    advice.suggestedTopP = undefined;
                } else {
                     advice.suggestedTopP = parseFloat(advice.suggestedTopP.toFixed(2));
                }
            }
            if (advice.suggestedTopK !== undefined) {
                 if (typeof advice.suggestedTopK !== 'number' || advice.suggestedTopK < 1 || !Number.isInteger(advice.suggestedTopK)) {
                    advice.suggestedTopK = undefined;
                } else {
                    advice.suggestedTopK = Math.round(advice.suggestedTopK);
                }
            }
            return advice as StrategistAdvice;
        } catch (error: any) {
            console.error(`Strategist LLM call (Attempt ${attempt + 1}/${maxRetries + 1}) failed:`, error.message, error);
            const apiError = error.error || error;
            const statusCode = apiError.status || apiError.code;
            let isRetriable = false;
            if (statusCode) {
                const numericStatusCode = Number(statusCode);
                if ([500, 503, 504].includes(numericStatusCode)) isRetriable = true;
                else if (numericStatusCode === 429) { isRetriable = false; }
                else if (String(statusCode).startsWith('4')) isRetriable = false;
                else isRetriable = true;
            } else if (error.message && (error.message.toLowerCase().includes('network error') || error.message.toLowerCase().includes('failed to fetch'))) {
                isRetriable = true;
            }

            if (isRetriable && attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            } else {
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
    modelToUse: SelectableModelName,
    devLogContextString?: string
): Promise<OutlineGenerationResult> => {
    if (!ai || !apiKeyAvailable) {
        return { outline: "", identifiedRedundancies: "", errorMessage: "Gemini API client not initialized or API key missing." };
    }
    const { systemInstruction: baseOutlineSystemInstruction, coreUserInstructions: outlineCoreUserInstructions } = getOutlineGenerationPromptComponents(fileManifest);
   
    let finalOutlineSystemInstruction = baseOutlineSystemInstruction;
    if (devLogContextString) {
      finalOutlineSystemInstruction = `SYSTEM_INTERNAL_CONTEXT (from DevLog analysis for your awareness):\n${devLogContextString}\n\n---\n\n${baseOutlineSystemInstruction}`;
    }

    const apiParts: Part[] = [];
    loadedFiles.forEach(file => {
        apiParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } });
    });
    apiParts.push({ text: outlineCoreUserInstructions });

    const generationConfigForApi: any = {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
    };
    if (modelConfig.thinkingConfig && modelToUse === 'gemini-2.5-flash-preview-04-17') {
        generationConfigForApi.thinkingConfig = modelConfig.thinkingConfig;
    }
    
    let accumulatedText = "";
    try {
        if (!ai) {
          throw new Error("GoogleGenAI client not initialized.");
        }

        const result = await ai.models.generateContent({
            model: modelToUse,
            contents: [{ role: "user", parts: apiParts }],
            config: {
                ...generationConfigForApi,
                systemInstruction: finalOutlineSystemInstruction,
            },
        });
        const response = result;
        accumulatedText = response.text;
        let outline = "";
        let identifiedRedundancies = "";
       
        const outlineRegex = /Outline:\s*([\s\S]*?)(?=\nRedundancies:|\n\n\n|$)/i;
        const redundanciesRegex = /Redundancies:\s*([\s\S]*)/i;

        const outlineMatch = accumulatedText.match(outlineRegex);
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

        const redundanciesMatch = accumulatedText.match(redundanciesRegex);
        if (redundanciesMatch && redundanciesMatch[1]) {
            identifiedRedundancies = redundanciesMatch[1].trim();
        }
       
        const apiStreamDetails: ApiStreamCallDetail[] = [{
            callCount: 1,
            promptForThisCall: outlineCoreUserInstructions,
            finishReason: response.candidates?.[0]?.finishReason || "UNKNOWN",
            safetyRatings: response.candidates?.[0]?.safetyRatings || null,
            textLengthThisCall: accumulatedText.length,
            isContinuation: false
        }];
        return { outline, identifiedRedundancies, apiDetails: apiStreamDetails };

    } catch (error: any) {
        console.error(`Error during Gemini API call for outline generation:`, error);
        let errorMessage = `An unknown API error occurred during outline generation. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
        if (error.error && error.error.message) errorMessage += ` API Detail: ${error.error.message}`;
        return { outline: "", identifiedRedundancies: "", errorMessage, apiDetails: [] };
    }
};

export interface IterateProductParams {
    currentProduct: string;
    currentIterationOverall: number;
    maxIterationsOverall: number;
    fileManifest: string;
    loadedFiles: LoadedFile[];
    activePlanStage: PlanStage | null;
    outputParagraphShowHeadings: boolean;
    outputParagraphMaxHeadingDepth: number;
    outputParagraphNumberedHeadings: boolean;
    modelConfigToUse: ModelConfig;
    isGlobalMode: boolean;
    modelToUse: SelectableModelName;
    onStreamChunk: (chunkText: string) => void;
    isHaltSignalled: () => boolean;
    retryContext?: RetryContext;
    stagnationNudgeStrategy?: NudgeStrategy;
    initialOutlineForIter1?: OutlineGenerationResult;
    activeMetaInstruction?: string;
    devLogContextString?: string;
    operationType?: "full" | "segment_synthesis";
    currentSegmentOutlineText?: string;
    fullOutlineForContext?: string;
    isTargetedRefinementMode?: boolean;
    targetedSelectionText?: string;
    targetedRefinementInstructions?: string;
    isRadicalRefinementKickstart?: boolean;
}

const MIN_CHARS_FOR_STUCK_CONTINUATION_CHECK = 50;

export const iterateProduct = async ({
  currentProduct,
  currentIterationOverall,
  maxIterationsOverall,
  fileManifest,
  loadedFiles,
  activePlanStage,
  outputParagraphShowHeadings,
  outputParagraphMaxHeadingDepth,
  outputParagraphNumberedHeadings,
  modelConfigToUse,
  isGlobalMode,
  modelToUse,
  onStreamChunk,
  isHaltSignalled,
  retryContext,
  stagnationNudgeStrategy,
  initialOutlineForIter1,
  activeMetaInstruction,
  devLogContextString,
  operationType = "full",
  currentSegmentOutlineText,
  fullOutlineForContext,
  isTargetedRefinementMode,
  targetedSelectionText,
  targetedRefinementInstructions,
  isRadicalRefinementKickstart = false,
}: IterateProductParams): Promise<IterateProductResult> => {
  if (!ai || !apiKeyAvailable) {
    return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized or API key missing." };
  }
  if (isHaltSignalled()) {
    return { product: currentProduct, status: 'HALTED', errorMessage: "Process halted by user before API call.", isStuckOnMaxTokensContinuation: false };
  }
 
  const isSegmentedCall = operationType === "segment_synthesis" && currentIterationOverall === 0;

  const { systemInstruction: baseSystemInstruction, coreUserInstructions } = getUserPromptComponents(
    currentIterationOverall,
    maxIterationsOverall,
    activePlanStage,
    outputParagraphShowHeadings, outputParagraphMaxHeadingDepth, outputParagraphNumberedHeadings,
    isGlobalMode,
    currentIterationOverall === 1 && loadedFiles.length > 0 && !initialOutlineForIter1 && !isSegmentedCall && !isTargetedRefinementMode,
    retryContext,
    stagnationNudgeStrategy,
    initialOutlineForIter1,
    loadedFiles,
    activeMetaInstruction,
    isSegmentedCall,
    currentSegmentOutlineText,
    fullOutlineForContext,
    isTargetedRefinementMode,
    targetedSelectionText,
    targetedRefinementInstructions,
    isRadicalRefinementKickstart
  );
 
  let finalSystemInstruction = baseSystemInstruction;
  if (devLogContextString) {
    finalSystemInstruction = `SYSTEM_INTERNAL_CONTEXT (from DevLog analysis for your awareness):\n${devLogContextString}\n\n---\n\n${baseSystemInstruction}`;
  }
 
  const promptTextForFullIterationLogged = buildTextualPromptPart(
      currentProduct,
      fileManifest,
      coreUserInstructions,
      currentIterationOverall,
      initialOutlineForIter1,
      isSegmentedCall,
      isTargetedRefinementMode
  );

  let accumulatedTextFromAllSegments = "";
  const apiStreamDetails: ApiStreamCallDetail[] = [];
  let streamCallCount = 0;
  let isStuckOnMaxTokensContinuationFlag = false;
 
  let currentConversationHistoryForApi: Content[] = [];
  let promptTextForThisApiSegmentCall: string = "";

  try {
     if (isSegmentedCall) {
        const segmentUserParts: Part[] = [];
        loadedFiles.forEach(file => { segmentUserParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } }); });
        segmentUserParts.push({ text: coreUserInstructions });
       
        currentConversationHistoryForApi.push({ role: "user", parts: segmentUserParts });
        promptTextForThisApiSegmentCall = coreUserInstructions;

    } else if (currentIterationOverall === 1 && loadedFiles.length > 0 && !initialOutlineForIter1 && !isSegmentedCall && !isTargetedRefinementMode) {
        const initialParts: Part[] = [];
        loadedFiles.forEach(file => { initialParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } }); });
        initialParts.push({ text: coreUserInstructions });
        currentConversationHistoryForApi.push({ role: "user", parts: initialParts });
        promptTextForThisApiSegmentCall = coreUserInstructions;
    } else {
        let firstUserTurnParts: Part[] = [{ text: coreUserInstructions }];
        if (currentIterationOverall === 1 && initialOutlineForIter1 && loadedFiles.length > 0 && !isSegmentedCall && !isTargetedRefinementMode) {
            const filePartsFromLoaded: Part[] = [];
            loadedFiles.forEach(file => { filePartsFromLoaded.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } }); });
            firstUserTurnParts = [...filePartsFromLoaded, ...firstUserTurnParts];
        }
        currentConversationHistoryForApi.push({ role: "user", parts: firstUserTurnParts });
        currentConversationHistoryForApi.push({ role: "model", parts: [{ text: "Instructions noted. I will apply them to the following content." }] });
       
        let productInputContent = currentProduct || "";
        if (currentIterationOverall === 1 && initialOutlineForIter1 && !isSegmentedCall && !isTargetedRefinementMode) {
            productInputContent = (initialOutlineForIter1.outline + (initialOutlineForIter1.identifiedRedundancies ? `\n\nIdentified Redundancies to address:\n${initialOutlineForIter1.identifiedRedundancies}` : ""));
        }
           
        const truncatedProductContent = productInputContent.length > MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT
            ? `${productInputContent.substring(0, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}...\n...(Product content truncated for prompt view)...\n...${productInputContent.substring(productInputContent.length - MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}`
            : productInputContent;
           
        currentConversationHistoryForApi.push({ role: "user", parts: [{ text: truncatedProductContent }] });
        promptTextForThisApiSegmentCall = truncatedProductContent;
    }

    let continueGenerationViaApi = true;

    while (continueGenerationViaApi) {
        if (isHaltSignalled()) {
          return { product: accumulatedTextFromAllSegments || currentProduct, status: 'HALTED', errorMessage: "Process halted by user during API call preparation.", promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag };
        }
        streamCallCount++;
       
        if (streamCallCount > 1) {
            const continuationInstructionText = `---PREVIOUSLY_GENERATED_PARTIAL_RESPONSE_THIS_ITERATION---\n${accumulatedTextFromAllSegments}\n---CONTINUATION_REQUEST---\nContinue generating the response from where you left off. Ensure you complete the thought or task. Adhere to all original instructions provided at the start of this iteration (including system instructions and any specific stage goals for format/length), and do not include conversational filler.`;
            currentConversationHistoryForApi.push({ role: "user", parts: [{ text: continuationInstructionText }] });
            promptTextForThisApiSegmentCall = continuationInstructionText;
        }
       
        const generationConfigForAPI: any = {
            temperature: modelConfigToUse.temperature,
            topP: modelConfigToUse.topP,
            topK: modelConfigToUse.topK,
        };
        if (activePlanStage && activePlanStage.format === 'json' && !isTargetedRefinementMode && !isSegmentedCall) {
            generationConfigForAPI.responseMimeType = "application/json";
        }
        if (modelConfigToUse.thinkingConfig && modelToUse === 'gemini-2.5-flash-preview-04-17') {
            generationConfigForAPI.thinkingConfig = modelConfigToUse.thinkingConfig;
        }

       
        if (!ai) {
          throw new Error("GoogleGenAI client not initialized.");
        }
        
        const streamResult = await ai.models.generateContentStream({
            model: modelToUse,
            contents: [...currentConversationHistoryForApi],
            config: {
                ...generationConfigForAPI,
                systemInstruction: finalSystemInstruction,
            },
        });

        let textFromThisApiSegment = "";
        let finalChunkFromStreamInSegment: GenerateContentResponse | null = null;

        for await (const chunk of streamResult) {
            if (isHaltSignalled()) break;
            finalChunkFromStreamInSegment = chunk;
            const chunkText = chunk.text;
            onStreamChunk(chunkText);
            textFromThisApiSegment += chunkText;
         }
       
        if (isHaltSignalled()) {
             return { product: accumulatedTextFromAllSegments + textFromThisApiSegment, status: 'HALTED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag };
        }
       
        accumulatedTextFromAllSegments += textFromThisApiSegment;
        currentConversationHistoryForApi.push({ role: "model", parts: [{ text: textFromThisApiSegment }] });
       
        const currentFinishReason = finalChunkFromStreamInSegment?.candidates?.[0]?.finishReason || "UNKNOWN";
        const currentSafetyRatings = finalChunkFromStreamInSegment?.candidates?.[0]?.safetyRatings || null;
       
        apiStreamDetails.push({
            callCount: streamCallCount,
            promptForThisCall: promptTextForThisApiSegmentCall,
            finishReason: currentFinishReason,
            safetyRatings: currentSafetyRatings,
            textLengthThisCall: textFromThisApiSegment.length,
            isContinuation: streamCallCount > 1,
            ...(isSegmentedCall && { segmentIndex: (apiStreamDetails[0]?.segmentIndex ?? -1), segmentTitle: (apiStreamDetails[0]?.segmentTitle ?? 'N/A') })
        });

        const MIN_CHARS_FOR_UNKNOWN_FINISH_AS_SUCCESS = 200;
        if (currentFinishReason === "MAX_TOKENS") {
            if (streamCallCount > 1 && textFromThisApiSegment.length < MIN_CHARS_FOR_STUCK_CONTINUATION_CHECK) {
                isStuckOnMaxTokensContinuationFlag = true;
                continueGenerationViaApi = false;
            } else {
                continueGenerationViaApi = true;
            }
        } else if (currentFinishReason === null || ["UNKNOWN", "OTHER", "FINISH_REASON_UNSPECIFIED"].includes(currentFinishReason)) {
            if (accumulatedTextFromAllSegments.trim().length < MIN_CHARS_FOR_UNKNOWN_FINISH_AS_SUCCESS) {
                 return { product: accumulatedTextFromAllSegments, status: 'ERROR', errorMessage: `API stream finished inconclusively (Reason: ${currentFinishReason || 'No Reason Provided'}) with minimal output (${accumulatedTextFromAllSegments.trim().length} chars).`, promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag};
            }
            continueGenerationViaApi = false;
        } else {
            continueGenerationViaApi = false;
        }
    }

    if (isHaltSignalled()) {
        return { product: accumulatedTextFromAllSegments, status: 'HALTED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag };
    }

    if (accumulatedTextFromAllSegments.startsWith(CONVERGED_PREFIX)) {
        return { product: accumulatedTextFromAllSegments, status: 'CONVERGED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag };
     }
    return { product: accumulatedTextFromAllSegments, status: 'COMPLETED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag };

  } catch (error: any) {
    if (isHaltSignalled()) {
        return { product: accumulatedTextFromAllSegments || currentProduct, status: 'HALTED', errorMessage: "Halted during error processing.", promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails, isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag };
    }
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

    const lastUserPromptInFailedSegment = currentConversationHistoryForApi.length > 0 ?
        currentConversationHistoryForApi.slice().reverse().find(c => c.role === 'user')?.parts.map(p => (p as any).text || "[non-text part]").join("\n") || "N/A (Error prompt capture issue)"
        : (promptTextForFullIterationLogged || "N/A (Error before/during stream start or prompt capture)");

    if (apiStreamDetails.length === 0 || apiStreamDetails[apiStreamDetails.length-1].callCount !== (streamCallCount > 0 ? streamCallCount : 1)) {
      apiStreamDetails.push({
          callCount: streamCallCount > 0 ? streamCallCount : 1,
          promptForThisCall: lastUserPromptInFailedSegment,
          finishReason: error.name || "API_CALL_ERROR",
          safetyRatings: null,
          textLengthThisCall: accumulatedTextFromAllSegments.length,
          isContinuation: streamCallCount > 1,
          ...(isSegmentedCall && { segmentIndex: (apiStreamDetails[0]?.segmentIndex ?? -1), segmentTitle: (apiStreamDetails[0]?.segmentTitle ?? 'N/A') })
      });
    }
    return {
        product: accumulatedTextFromAllSegments || currentProduct,
        status: 'ERROR',
        errorMessage,
        promptSystemInstructionSent: finalSystemInstruction,
        promptCoreUserInstructionsSent: coreUserInstructions,
        promptFullUserPromptSent: promptTextForFullIterationLogged,
        apiStreamDetails,
        isRateLimitError: isRateLimitErrorFlag,
        isStuckOnMaxTokensContinuation: isStuckOnMaxTokensContinuationFlag
    };
  }
};