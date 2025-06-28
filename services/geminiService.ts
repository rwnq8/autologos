
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part, Content, GenerateContentParameters } from "@google/genai";
import type { ModelConfig, StaticAiModelDetails, IterateProductResult, ApiStreamCallDetail, LoadedFile, PlanStage, SuggestedParamsResponse, RetryContext, OutlineGenerationResult, NudgeStrategy, SelectableModelName, StrategistAdvice, IterationLogEntry, AiResponseValidationInfo, StagnationInfo } from "../types.ts";
import { getUserPromptComponents, buildTextualPromptPart, CONVERGED_PREFIX, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT, getOutlineGenerationPromptComponents } from './promptBuilderService';
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
      console.warn("Could not access process.env. This is expected in some environments (like browsers). Gemini API calls will be disabled if a key is not found by other means.");
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

    if(isGlobalMode && config.temperature > 0.7 && config.maxIterations && config.maxIterations > 20) { // Max iterations check might be less relevant with faster sweep
        warnings.push("High starting temperature in Global Mode. Parameters will sweep towards deterministic more rapidly now; initial output may be diverse but will quickly focus.");
    }
    if(config.thinkingConfig?.thinkingBudget === 0 && config.modelName === 'gemini-2.5-flash-preview-04-17') {
        advice.thinkingConfig = "Thinking Budget is 0: Flash model will respond faster but may have lower quality for complex tasks.";
    }

    return { warnings, advice };
};

const selectableModelsListString = SELECTABLE_MODELS.map(m => `'${m.name}' ('${m.description.split('.')[0]}')`).join(', ');
const strategistSystemPrompt = `You are an AI Process Strategist. Your task is to analyze the current state of an iterative content generation process and suggest the optimal Gemini model, its thinking configuration (if applicable for 'gemini-2.5-flash-preview-04-17'), optionally minor adjustments to temperature/TopP/TopK, and optionally a meta-instruction for the *next* iteration of the main content generation AI.
    Provide your response strictly in JSON format with the following fields: "suggestedModelName" (optional string from valid list), "suggestedThinkingBudget" (optional, 0 or 1 for 'gemini-2.5-flash-preview-04-17' only), "suggestedTemperature" (optional number 0.0-2.0), "suggestedTopP" (optional number 0.0-1.0), "suggestedTopK" (optional integer >=1), "suggestedMetaInstruction" (optional string, 1-2 concise sentences for the main AI if it's highly stagnant or needs a new approach), and a mandatory "rationale" (1-3 sentences explaining your overall advice).
    Valid models for 'suggestedModelName': ${selectableModelsListString}.
    Temperature range: 0.0 to 2.0. TopP range: 0.0 to 1.0. TopK integer >= 1.
    
    Value is not just refinement; for underdeveloped products, value lies in substantial conceptual expansion, addition of new details, examples, or arguments. Distinguish between a product needing polish and one needing growth.

    PRIORITIZE EXPANSION FOR UNDERDEVELOPED KERNELS / WORDSMITHING:
    - "Wordsmithing" refers to minor, repetitive, or purely stylistic changes without adding significant conceptual value or new information.
    - If 'Current Goal' or 'Content Stage Assessment' implies a need for more detailed output, but recent iteration summaries (and product length, if provided) show a very short product OR a product with consistently minor changes (wordsmithing), this strongly indicates an underdeveloped kernel.
    - In such cases:
        1. Your **primary goal** is to suggest a 'suggestedMetaInstruction' that explicitly directs the main AI to **substantially expand** the content (e.g., "The current product is a good starting point but is stuck in minor edits and needs significant expansion. Elaborate on [strategist-identified key concept], provide concrete examples, and explore related arguments to substantially increase its depth and breadth." or "Elaborate on the core thesis, add 2-3 supporting examples for key points, and explore counter-arguments or future implications to significantly increase depth and breadth. Move beyond surface-level edits.").
        2. If \`strategistInfluenceLevel\` allows parameter overrides AND the main AI's *effective* parameters (from 'Last Config Used' and considering the rapid Global Mode sweep) are already very low (e.g., Temperature <= 0.2), **strongly consider suggesting a temporary, controlled increase in 'suggestedTemperature' (e.g., to 0.3-0.6) for 1-2 iterations** to facilitate this expansion. Clearly state this is a temporary measure for expansion. This is critical to avoid premature convergence on shallow content.

    COST-BENEFIT OF ITERATION & POTENTIAL CONVERGENCE: Analyze 'Recent Iteration Summaries' and 'Stagnation Status (especially consecutiveLowValueIterations provided in user prompt)'.
    - If 'consecutiveLowValueIterations' is 2 or more:
        - If the product is still short or the 'Current Goal' implies underdevelopment (see "UNDERDEVELOPED KERNELS" above), prioritize expansionary meta-instructions and possibly a temporary temperature increase first.
        - Only if the product is genuinely substantial and well-developed should you then recommend convergence (meta-instruction like '${CONVERGED_PREFIX} Product is mature...' and deterministic params if influence allows).
    - If 'consecutiveLowValueIterations' is 1 AND parameters are already highly deterministic (e.g., Temp <= 0.1 from 'Last Config Used'), also lean towards convergence, UNLESS the product is clearly underdeveloped (then prioritize expansion).
    - Only suggest continued creative exploration or substantial refinement if there's a clear, high-value path for conceptual development or expansion, AND 'consecutiveLowValueIterations' is 0.
    - Avoid suggesting changes that are merely stylistic if the conceptual core is sound and previous iterations have yielded little substantive change on that core, UNLESS the 'Current Refinement Focus Hint' is explicitly 'Polish'.
    
    GLOBAL MODE PARAMETER SWEEP AWARENESS:
    - In Global Mode, core generation parameters (Temperature, Top-P, Top-K) generally sweep from more creative values towards more deterministic values over the course of total iterations. The system's code heuristics manage this sweep.
    - Only suggest a specific 'suggestedTemperature', 'suggestedTopP', or 'suggestedTopK' IF:
      a) You have a VERY STRONG, EXPLICIT RATIONALE to temporarily deviate from the default sweep (e.g., a brief, controlled increase in temperature to break severe 'wordsmithing' on an underdeveloped product, or accelerating the move to deterministic values if convergence is crystal clear and the product is mature).
      b) OR if 'strategistInfluenceLevel' is 'OVERRIDE_FULL' and you assess that the current heuristically determined parameters (visible in 'Last Config Used' if available for the *next* iteration's calculation, or inferred from sweep stage) are genuinely suboptimal for the *immediate next step*.
    - If suggesting a temporary parameter increase, clearly state it is temporary.
    - In most Global Mode cases, if you don't have a compelling reason to override core generation parameters, OMIT 'suggestedTemperature', 'suggestedTopP', and 'suggestedTopK' from your JSON response. This allows the system's default sweep and code-based nudges to control them.
    - Focus your advice more on 'suggestedModelName', 'suggestedThinkingBudget' (for Flash), and 'suggestedMetaInstruction' as these are primary levers for strategic shifts.

    CRITICAL ASSESSMENT (General):
    - If stagnation is high (e.g., system nudge strategy is 'meta_instruct') or last validation failed critically, strongly consider suggesting a 'suggestedMetaInstruction' to guide the main AI's refinement approach.
    - Consider the 'Current Refinement Focus Hint' provided in the user prompt. Align your suggestions or explicitly state why you deviate.
    
    If you suggest a 'suggestedMetaInstruction', make it actionable. Examples: "Focus on improving logical flow between sections X and Y." or "Simplify complex terminology in the discussion of Z." or "Re-evaluate argument A for consistency with source data." or "Substantially expand on topic X, adding specific examples and detailed explanations."
    Suggest parameter changes sparingly. Any suggested parameter change should be a specific value.
    Ensure your 'rationale' is comprehensive yet concise (2-4 sentences) and clearly justifies ALL your suggestions.
    Ensure any suggested parameters are within valid ranges: Temperature (0.0-2.0), TopP (0.0-1.0), TopK (integer >=1).`;


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
    currentProductLengthChars?: number,
    currentRefinementFocusHint?: string
): Promise<StrategistAdvice | null> => {
    if (!ai || !apiKeyAvailable) {
        console.warn("Strategist LLM call skipped: API key or client not available.");
        return null;
    }

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

    const strategistUserPrompt = `
    Process State for Next Iteration (${currentIteration + 1}/${maxIterations}):
    - Current Iteration: ${currentIteration} (completed)
    - Max Iterations for current run: ${maxIterations}
    - Input Complexity: ${inputComplexity}
    - Current Product Length: ${currentProductLengthChars || 'N/A'} chars.
    - Last Model Used: ${lastUsedModel || "N/A (First iteration)"}
    - Last Config Used: ${lastConfigSummary}
    - Stagnation Status: ${stagnationInfo.isStagnant ? `Stagnant for ${stagnationInfo.consecutiveStagnantIterations} iterations.` : "Not stagnant."} (Similarity with prev: ${(stagnationInfo.similarityWithPrevious || 0).toFixed(3)}) (Consecutive Low Value Iterations: ${stagnationInfo.consecutiveLowValueIterations}) (System Nudge Strategy applied: ${stagnationInfo.nudgeStrategyApplied})
    - Current Refinement Focus Hint: ${currentRefinementFocusHint || 'General Refinement'}
    - Last Iteration Validation: ${lastValidationInfo ? `${lastValidationInfo.passed ? 'Passed.' : 'Failed.'} Reason: ${lastValidationInfo.reason || 'N/A'}` : 'N/A'}
    - Current Goal: ${currentGoal}
    - Content Stage Assessment: Is the current product a nascent idea needing expansion (wordsmithing small details), a developed draft needing refinement, or a near-final piece needing polish? Is stagnation due to minor repetitive edits on an idea that actually needs to grow rather than just be polished?
    - Expansion Potential & Value Assessment: Given the product length, current goal, and recent iteration summaries (paying attention to the magnitude and nature of changes, and 'Consecutive Low Value Iterations'), is substantial expansion the highest value action for the *next* iteration? Or would focused refinement, consolidation, or even preparing for convergence be more appropriate? If expansion, what specific areas offer the most value and why? If refinement, what specific aspect should be targeted?
    ${iterationSummariesText}

    Suggest 'suggestedModelName', 'suggestedThinkingBudget', optionally 'suggestedTemperature'/'suggestedTopP'/'suggestedTopK', and optionally a 'suggestedMetaInstruction'. Provide a 'rationale'.
    If 'stagnationInfo.nudgeStrategyApplied' is 'meta_instruct', this is a strong signal to provide a 'suggestedMetaInstruction'.
    If 'Consecutive Low Value Iterations' is high (e.g., 2+), carefully consider if convergence is appropriate or if expansion is still needed based on product maturity.
    Prioritize 'gemini-2.5-flash-preview-04-17' or 'gemini-2.5-pro' for most tasks.
    `;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17', 
                contents: [{ role: "user", parts: [{text: strategistUserPrompt}] }],
                config: {
                    responseMimeType: "application/json",
                    temperature: 0.2, 
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
            } else if (error.name === 'GoogleGenerativeAIError' || (error.name && error.name.includes("GoogleGenerativeAIError"))) {
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
    // For outline generation, all files are sent as context.
    loadedFiles.forEach(file => {
        apiParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64Data } });
    });
    apiParts.push({ text: outlineCoreUserInstructions }); // Core instructions follow file data

    const generationConfigForApi: any = {
        temperature: modelConfig.temperature, // Use a moderate temperature for outlining
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
        // Outline generation is usually not a very long response, so a non-streaming call is okay.
        const response: GenerateContentResponse = await ai.models.generateContent(requestPayload); 
        accumulatedText = response.text;
        let outline = "";
        let identifiedRedundancies = "";
        
        // More robust parsing for "Outline:" and "Redundancies:" sections
        const outlineRegex = /Outline:\s*([\s\S]*?)(?=\nRedundancies:|\n\n\n|$)/i;
        const redundanciesRegex = /Redundancies:\s*([\s\S]*)/i;

        const outlineMatch = accumulatedText.match(outlineRegex);
        if (outlineMatch && outlineMatch[1]) {
            outline = outlineMatch[1].trim();
        } else {
            // Fallback if "Redundancies:" is missing or format is slightly off
            const redIndex = accumulatedText.toLowerCase().indexOf("redundancies:");
            if (redIndex !== -1) {
                outline = accumulatedText.substring(0, redIndex).replace(/^outline:/i, "").trim();
            } else {
                outline = accumulatedText.replace(/^outline:/i, "").trim(); // Assume whole output is outline if no Redundancies marker
            }
        }

        const redundanciesMatch = accumulatedText.match(redundanciesRegex);
        if (redundanciesMatch && redundanciesMatch[1]) {
            identifiedRedundancies = redundanciesMatch[1].trim();
        }
        
        apiStreamDetails.push({
            callCount: 1,
            promptForThisCall: outlineCoreUserInstructions, // Log the core instructions part
            finishReason: response.candidates?.[0]?.finishReason || "UNKNOWN",
            safetyRatings: response.candidates?.[0]?.safetyRatings || null,
            textLengthThisCall: accumulatedText.length,
            isContinuation: false
        });
        return { outline, identifiedRedundancies, apiDetails: apiStreamDetails };

    } catch (error: any) {
        console.error(`Error during Gemini API call for outline generation:`, error);
        let errorMessage = `An unknown API error occurred during outline generation. Name: ${error.name || 'N/A'}, Message: ${error.message || 'No message'}.`;
        // Add more specific error handling if possible based on error structure
        if (error.error && error.error.message) errorMessage += ` API Detail: ${error.error.message}`;
        return { outline: "", identifiedRedundancies: "", errorMessage, apiDetails: apiStreamDetails };
    }
};

// IterateProductParams interface to define parameters for iterateProduct
export interface IterateProductParams {
    currentProduct: string;
    currentIterationOverall: number; // True overall iteration. For segment synthesis sub-calls, this will be 0.
    maxIterationsOverall: number;
    fileManifest: string;
    loadedFiles: LoadedFile[];
    activePlanStage: PlanStage | null;
    outputParagraphShowHeadings: boolean;
    outputParagraphMaxHeadingDepth: number;
    outputParagraphNumberedHeadings: boolean;
    modelConfigToUse: ModelConfig; // This is strictly temp, topP, topK, thinkingConfig
    isGlobalMode: boolean;
    modelToUse: SelectableModelName;
    onStreamChunk: (chunkText: string) => void;
    isHaltSignalled: () => boolean;
    retryContext?: RetryContext;
    stagnationNudgeStrategy?: NudgeStrategy;
    initialOutlineForIter1?: OutlineGenerationResult; // For single-pass Iter 1 or full outline context for segment mode
    activeMetaInstruction?: string;
    devLogContextString?: string; 
    // New parameters for segmented synthesis
    operationType?: "full" | "segment_synthesis"; // Default to "full" if not provided
    currentSegmentOutlineText?: string; // Text of the current segment being synthesized
    fullOutlineForContext?: string; // The entire original outline for context
    // New parameters for targeted refinement
    isTargetedRefinementMode?: boolean;
    targetedSelectionText?: string;
    targetedRefinementInstructions?: string;
}


export const iterateProduct = async ({
  currentProduct,
  currentIterationOverall, // If 0, it's a segment synthesis sub-call
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
  initialOutlineForIter1, // Full outline if in segment mode, or outline for Iter 1 single-pass
  activeMetaInstruction,
  devLogContextString, 
  operationType = "full", // Default to "full" operation
  currentSegmentOutlineText, // For segment synthesis
  fullOutlineForContext, // For segment synthesis
  isTargetedRefinementMode, // For targeted refinement
  targetedSelectionText, // For targeted refinement
  targetedRefinementInstructions // For targeted refinement
}: IterateProductParams): Promise<IterateProductResult> => {
  if (!ai || !apiKeyAvailable) {
    return { product: currentProduct, status: 'ERROR', errorMessage: "Gemini API client not initialized or API key missing." };
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
    targetedRefinementInstructions
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
        streamCallCount++;
        if (isHaltSignalled()) {
          return { product: accumulatedTextFromAllSegments || currentProduct, status: 'HALTED', errorMessage: "Process halted by user during API call preparation.", promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails };
        }

        if (streamCallCount > 1) { 
            const continuationInstructionText = `---PREVIOUSLY_GENERATED_PARTIAL_RESPONSE_THIS_ITERATION---\n${accumulatedTextFromAllSegments}\n---CONTINUATION_REQUEST---\nContinue generating the response from where you left off. Ensure you complete the thought or task. Adhere to all original instructions provided at the start of this iteration, especially regarding output format and not including conversational filler.`;
            currentConversationHistoryForApi.push({ role: "user", parts: [{ text: continuationInstructionText }] });
            promptTextForThisApiSegmentCall = continuationInstructionText; 
        }
        
        const generationConfigForAPI: any = {
            temperature: modelConfigToUse.temperature,
            topP: modelConfigToUse.topP,
            topK: modelConfigToUse.topK,
            systemInstruction: finalSystemInstruction, 
        };
        if (activePlanStage && activePlanStage.format === 'json' && !isTargetedRefinementMode && !isSegmentedCall) { 
            generationConfigForAPI.responseMimeType = "application/json";
        }
        if (modelConfigToUse.thinkingConfig && modelToUse === 'gemini-2.5-flash-preview-04-17') {
            generationConfigForAPI.thinkingConfig = modelConfigToUse.thinkingConfig;
        }

        const requestPayloadForStream: GenerateContentParameters = {
            model: modelToUse,
            contents: [...currentConversationHistoryForApi], 
            config: generationConfigForAPI
        };
        
        const streamResult = await ai.models.generateContentStream(requestPayloadForStream);
        let textFromThisApiSegment = "";
        let finalChunkFromStreamInSegment: GenerateContentResponse | null = null;

        for await (const chunk of streamResult) { 
            finalChunkFromStreamInSegment = chunk; 
            const chunkText = chunk.text;
            onStreamChunk(chunkText); 
            textFromThisApiSegment += chunkText;
            if (isHaltSignalled()) break;
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

        if (isHaltSignalled()) {
             return { product: accumulatedTextFromAllSegments, status: 'HALTED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails };
        }

        const MIN_CHARS_FOR_UNKNOWN_FINISH_AS_SUCCESS = 200; 
        if (currentFinishReason === "MAX_TOKENS") {
            continueGenerationViaApi = true; 
        } else if (currentFinishReason === null || ["UNKNOWN", "OTHER", "FINISH_REASON_UNSPECIFIED"].includes(currentFinishReason)) {
            if (accumulatedTextFromAllSegments.trim().length < MIN_CHARS_FOR_UNKNOWN_FINISH_AS_SUCCESS) {
                 return { 
                    product: accumulatedTextFromAllSegments, 
                    status: 'ERROR', 
                    errorMessage: `API stream finished inconclusively (Reason: ${currentFinishReason || 'No Reason Provided'}) with minimal output (${accumulatedTextFromAllSegments.trim().length} chars, expected >${MIN_CHARS_FOR_UNKNOWN_FINISH_AS_SUCCESS}). This often indicates an API-side processing issue for the given prompt segment.`, 
                    promptSystemInstructionSent: finalSystemInstruction, 
                    promptCoreUserInstructionsSent: coreUserInstructions, 
                    promptFullUserPromptSent: promptTextForFullIterationLogged, 
                    apiStreamDetails 
                };
            }
            console.warn(`API stream finished with reason '${currentFinishReason}' but provided substantial text (${accumulatedTextFromAllSegments.trim().length} chars). Proceeding, but this might indicate an issue.`);
            continueGenerationViaApi = false; 
        } else { 
            continueGenerationViaApi = false; 
        }
    } 

    if (accumulatedTextFromAllSegments.startsWith(CONVERGED_PREFIX)) {
        return { product: accumulatedTextFromAllSegments, status: 'CONVERGED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails };
     }
    return { product: accumulatedTextFromAllSegments, status: 'COMPLETED', promptSystemInstructionSent: finalSystemInstruction, promptCoreUserInstructionsSent: coreUserInstructions, promptFullUserPromptSent: promptTextForFullIterationLogged, apiStreamDetails };

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
        isRateLimitError: isRateLimitErrorFlag 
    };
  }
};