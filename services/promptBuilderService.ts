
import type { LoadedFile, PlanStage, OutputFormat, OutputLength, OutputComplexity } from '../types.ts';

export const CONVERGED_PREFIX = "CONVERGED:";

export const getUserPromptComponents = (
  currentIterationOverall: number,
  maxIterationsOverall: number,
  activePlanStage: PlanStage | null,
  outputParagraphShowHeadings: boolean,
  outputParagraphMaxHeadingDepth: number,
  outputParagraphNumberedHeadings: boolean,
  isGlobalMode: boolean,
  isInitialProductEmptyAndFilesLoaded: boolean
): { systemInstruction: string, coreUserInstructions: string } => {

  let systemInstruction = `You are an AI assistant specialized in iterative content refinement. Your goal is to progressively improve a given "Current State of Product" based on the user's instructions and provided file context. Adhere strictly to the iteration number and refinement goals.

CRITICAL CONTEXT OF ORIGINAL FILES: The complete data of all original input files was provided to you in the very first API call of this entire multi-iteration process. Your primary knowledge base for all subsequent refinements is this full original file data. The 'File Manifest' is only a summary; refer to the complete file data provided initially for all tasks. Synthesize information from ALL provided files. Cross-reference details across files if relevant. Your product should reflect the combined knowledge and themes within these files. If the "Current State of Product" you receive is empty, your first task is to generate a comprehensive initial product based *solely* on the initially provided file data and the user's refinement instructions for this iteration.

GENERAL RULES:
1.  **Output Structure:** Produce ONLY the new, modified textual product. Do NOT include conversational filler, apologies, or self-references like "Here's the updated product:".
2.  **Convergence:** If you determine that the product cannot be meaningfully improved further according to the current iteration's goals, OR if your generated product is identical to the 'Current State of Product' you received, prefix your ENTIRE response with "${CONVERGED_PREFIX}". Do this sparingly and only when truly converged. Premature convergence is undesirable. Unless the product is identical or the goal is unachievable, attempt refinement. A 'meaningful improvement' involves addressing specific aspects like clarity, coherence, depth, or structure as per the iteration's goal. If the task requires significant content generation or transformation, ensure this is substantially completed before considering convergence. Do not converge if simply unsure how to proceed; instead, attempt an alternative refinement strategy if the current one seems to stall.
3.  **File Usage:** Base all refinements on the full content of the originally provided input files. The 'File Manifest' in the prompt is a reminder of these files.
4.  **Error Handling:** If you cannot fulfill a request due to ambiguity or impossibility, explain briefly and then output "CONVERGED:" followed by the original unchanged product. Do not attempt to guess if instructions are critically unclear.
5.  **Content Integrity:** Preserve the core information and approximate length of the 'Current State of Product' unless specific instructions for summarization (e.g., 'shorter' length, 'key_points' format) or significant restructuring are provided for the current iteration. Avoid extreme, unrequested deletions.
`;

  let coreUserInstructions = "";

  if (isGlobalMode) {
    systemInstruction += `\nGLOBAL MODE DYNAMIC PARAMS: You are in Global Mode. AI operates with high autonomy. Parameters will dynamically adjust from creative/exploratory to focused/deterministic over ${maxIterationsOverall} iterations. Adapt your refinement strategy accordingly. If refinement appears to stall, the system might subtly adjust parameters or its analysis approach to encourage breaking out of local optima; your continued diverse and substantial refinement attempts, potentially exploring different facets of improvement (like structure, clarity, depth, or even alternative phrasings for key sections), are valuable.`;

    if(isInitialProductEmptyAndFilesLoaded) {
      systemInstruction += ` Since the product is currently empty and files were loaded, your immediate task is to generate the initial content based on those files, guided by the dynamic parameters for this iteration.`;
    }

    coreUserInstructions = `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.
    1.  **Analyze & Refine:** Review the 'Current State of Product'. Autonomously identify areas for significant improvement related to clarity, coherence, depth, or structure.
    2.  **Substantial Change:** Implement meaningful and **discernibly significant** changes. This means more than minor wording adjustments; aim for improvements in structure, depth of information, clarity of explanation, or introduction of new relevant insights based on the original file content. The choice of format (e.g., paragraphs, key points, JSON) is yours unless implicitly guided by the product's current structure or a very strong emerging pattern from the file content. Ensure changes are substantial and demonstrably move the product towards a well-refined output.
    3.  **Content Consistency:** All refinements MUST be based on the initially provided complete file data.
    4.  **Output:** Provide ONLY the new, modified textual product. If converged (see system instructions), prefix with "${CONVERGED_PREFIX}".`;
  } else if (activePlanStage) {
    systemInstruction += `\nITERATIVE PLAN MODE: You are executing a predefined plan stage. Focus strictly on the goals of the current stage. Model parameters are fixed for this stage.`;

    if(isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1) { // Specifically for the first processing iteration of a plan if product is empty.
      systemInstruction += ` Since the product is currently empty and files were loaded, your immediate task is to generate the initial content based on those files, adhering to this stage's goals.`;
    }

    coreUserInstructions = `Executing Iterative Plan Stage (Overall Iteration ${currentIterationOverall}).
    Current Stage Goal: Refine the 'Current State of Product' according to the following parameters:
    - Target Output Format: ${activePlanStage.format}
    - Target Output Length: ${activePlanStage.length} (relative to current product)
    - Target Output Complexity: ${activePlanStage.complexity}
    ${activePlanStage.customInstruction ? `- Custom Instruction for this Stage: ${activePlanStage.customInstruction}` : ''}

    Specific Instructions for Stage:
    1.  **Adhere to Stage Goals:** Strictly apply the format, length, complexity, and any custom instructions for this stage.
    2.  **Formatting Details (if 'paragraph' format):**
        - Headings: ${activePlanStage.outputParagraphShowHeadings ?? outputParagraphShowHeadings ? 'Include appropriate headings.' : 'Do not include headings.'}
        - Max Heading Depth (if headings included): ${activePlanStage.outputParagraphMaxHeadingDepth ?? outputParagraphMaxHeadingDepth}
        - Numbered Headings (if headings included): ${activePlanStage.outputParagraphNumberedHeadings ?? outputParagraphNumberedHeadings ? 'Use APA-style numbered headings.' : 'Use unnumbered headings.'}
    3.  **JSON Output (if 'json' format):** Ensure the output is a single, valid JSON object or array. Do not wrap in markdown backticks.
    4.  **Content Consistency:** All refinements MUST be based on the initially provided complete file data.
    5.  **Output:** Provide ONLY the new, modified textual product. If converged for this stage, prefix with "${CONVERGED_PREFIX}".`;
  }
  return { systemInstruction, coreUserInstructions };
};

export const buildTextualPromptPart = (
    currentProduct: string,
    fileManifest: string,
    coreUserInstructions: string,
    currentIterationOverall: number
): string => {
    let prompt = `${coreUserInstructions}\n\n`;

    if (fileManifest) {
        prompt += `---FILE MANIFEST (Original Input Summary)---\n${fileManifest}\n------------------------------------------\n\n`;
    }
    prompt += `---CURRENT STATE OF PRODUCT (to be refined in Iteration ${currentIterationOverall})---\n`;
    if (currentProduct.trim() === "" && fileManifest && currentIterationOverall === 1) { // Emphasize using files for the very first actual product generation
        prompt += `(Product is currently empty. Your task is to generate the initial refined product based on the full content of the files listed in the manifest (data provided in first API call) and the iteration instructions. Synthesize information from ALL provided files. Cross-reference details. Your product should reflect the combined knowledge and themes.)\n`;
    } else if (currentProduct.trim() === "" && fileManifest) { // For subsequent iterations if product becomes empty somehow, or if it's iter 1 but no manifest (less likely)
        prompt += `(Product is currently empty. Refer to the original full file data and iteration instructions to generate content. Synthesize information from ALL provided files.)\n`;
    } else if (currentProduct.trim() === "") {
        prompt += `(Product is currently empty. Generate content based on the iteration instructions.)\n`;
    } else {
        prompt += `${currentProduct}\n`;
    }
    prompt += `------------------------------------------\n\n`;
    prompt += `REMINDER: Your response should be ONLY the new, modified textual product. If converged, prefix the ENTIRE response with "${CONVERGED_PREFIX}". Base all refinements on the complete original file data, synthesizing and cross-referencing information as needed to reflect combined knowledge. If the 'Current State of Product' was empty, your entire output is the newly generated product based on this principle.\n\nNEW MODIFIED PRODUCT (Iteration ${currentIterationOverall}):`;
    return prompt;
};
