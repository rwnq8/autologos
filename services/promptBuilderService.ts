
import type { LoadedFile, PlanStage, OutputFormat, OutputLength, OutputComplexity, NudgeStrategy, RetryContext, OutlineGenerationResult } from '../types.ts';

export const CONVERGED_PREFIX = "CONVERGED:";
export const MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT = 250000; // Max chars of current product to include in prompt

export const getOutlineGenerationPromptComponents = (
  fileManifest: string
): { systemInstruction: string, coreUserInstructions: string } => {
  const systemInstruction = `You are an AI assistant specialized in analyzing textual content from multiple files. Your task is to produce a structured outline for a synthesized document based on these files and identify key redundancies.

CRITICAL CONTEXT OF ORIGINAL FILES: The complete data of all original input files is provided. Base your analysis on this full data. The 'File Manifest' is a summary.

OUTPUT FORMAT:
Your response MUST strictly follow this format:
Outline:
<Your detailed outline here. Use markdown for structure, e.g., # Main Topic, ## Sub-topic, 1. Point a, 2. Point b. Aim for a comprehensive outline covering all key aspects of the input files.>

Redundancies:
<List key areas of significant redundancy or versioning identified across files. Be specific, e.g., "Paragraphs about 'Project X Results' appear in report_v1.txt and report_v2.txt with minor wording changes." or "Chapter 3 content from draft.md is nearly identical to final.md">

Do NOT generate the full document content. Only the outline and redundancy list.`;

  const coreUserInstructions = `Based on ALL provided files (summarized below in the File Manifest), generate a detailed hierarchical outline for a single, coherent, synthesized document that would integrate the information from all files.
Additionally, list any significant redundancies, duplications, or versioning conflicts you identify across these files that would need to be resolved in a final synthesized document.

---FILE MANIFEST (Original Input Summary)---
${fileManifest.trim()}
------------------------------------------

REMINDER: Provide ONLY the "Outline:" section and the "Redundancies:" section as per the System Instruction's specified format.
`;
  return { systemInstruction, coreUserInstructions };
};


export const getUserPromptComponents = (
  currentIterationOverall: number,
  maxIterationsOverall: number,
  activePlanStage: PlanStage | null,
  outputParagraphShowHeadingsGlobal: boolean,
  outputParagraphMaxHeadingDepthGlobal: number,
  outputParagraphNumberedHeadingsGlobal: boolean,
  isGlobalMode: boolean,
  isInitialProductEmptyAndFilesLoaded: boolean,
  retryContext?: RetryContext,
  stagnationNudgeStrategy?: NudgeStrategy,
  initialOutlineForIter1?: OutlineGenerationResult,
  loadedFilesForContext?: LoadedFile[], 
  activeMetaInstruction?: string
): { systemInstruction: string, coreUserInstructions: string } => {
  let systemInstructionParts: string[] = [
    `You are an AI assistant specialized in iterative content refinement. Your goal is to progressively improve a given "Current State of Product" based on the user's instructions and provided file context. Adhere strictly to the iteration number and refinement goals.`
  ];

  systemInstructionParts.push(
    `CRITICAL CONTEXT OF ORIGINAL FILES: The complete data of all original input files was provided to you in the very first API call of this entire multi-iteration process (or for the outline generation stage if applicable). Your primary knowledge base for all subsequent refinements is this full original file data. The 'File Manifest' is only a summary; refer to the complete file data provided initially for all tasks. Synthesize information from ALL provided files. Cross-reference details across files if relevant. Your product should reflect the combined knowledge and themes within these files.`
  );

  if (loadedFilesForContext && loadedFilesForContext.length > 0) {
    systemInstructionParts.push(
      `When multiple files are provided, pay close attention to file names (e.g., 'report_v1.txt', 'report_v2.txt', 'chapter1_draft.md', 'chapter1_final.md') and content (e.g., identical or very similar headings and paragraphs across files). If you detect duplicative content, versioned drafts, or highly overlapping information, your task is to intelligently synthesize these into a single, coherent, and de-duplicated product. Prune redundant sections. Consolidate information logically. If clear versioning is present, prioritize the most recent or complete version as the base, integrating unique information from other versions. If files represent different facets of a single topic, weave them together smoothly. Avoid simple concatenation. The goal is a singular, polished document.`
    );
  }

  systemInstructionParts.push(`GENERAL RULES:
Output Structure: Produce ONLY the new, modified textual product. Do NOT include conversational filler, apologies, or self-references like "Here's the updated product:".
Convergence: If you determine that the product cannot be meaningfully improved further according to the current iteration's goals, OR if your generated product is identical to the 'Current State of Product' you received, prefix your ENTIRE response with "${CONVERGED_PREFIX}". Do this sparingly and only when truly converged. This means the topic is **thoroughly explored, conceptually well-developed, and further iterations would genuinely add no significant conceptual value (i.e., only minor stylistic tweaks on an already mature document) or would likely degrade quality.** Premature convergence on underdeveloped ideas is undesirable. However, if the document is mature and multiple recent iterations have yielded only negligible changes where the 'cost' of further iteration outweighs the benefit, you SHOULD declare convergence. Unless the product is identical or the goal is unachievable, attempt refinement. A 'meaningful improvement' involves addressing specific aspects like clarity, coherence, depth, or structure as per the iteration's goal. If the task requires significant content generation or transformation, ensure this is substantially completed before considering convergence. Do not converge if simply unsure how to proceed; instead, attempt an alternative refinement strategy if the current one seems to stall.
File Usage: Base all refinements on the full content of the originally provided input files. The 'File Manifest' in the prompt is a reminder of these files.
Error Handling: If you cannot fulfill a request due to ambiguity or impossibility, explain briefly and then output "${CONVERGED_PREFIX}" followed by the original unchanged product. Do not attempt to guess if instructions are critically unclear.
Content Integrity: Preserve core information. Aggressively identify and consolidate duplicative content from multiple files into a single, synthesized representation. Unless specific instructions for summarization (e.g., 'shorter' length, 'key_points' format) or significant restructuring are provided for the current iteration, avoid unrequested deletions of unique information. However, merging and pruning redundant information is a critical part of maintaining integrity and producing a refined product.`
  );


  if (currentIterationOverall === 1 && initialOutlineForIter1) {
    systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files using Pre-Generated Outline): The 'Current State of Product' is an AI-generated outline and redundancy analysis. Your task for this first iteration is to:
1. Use this outline AND the "Identified Redundancies" list (both provided in the user prompt below) as a STRONG GUIDE.
2. Refer to the FULL ORIGINAL FILE DATA (provided in this API call) to flesh out this outline into a complete, coherent, and de-duplicated document.
3. Resolve the identified redundancies.
4. Produce a SINGLE, WELL-STRUCTURED document. This is your ONLY output for this iteration.
Your primary success metric is adherence to the outline structure while ensuring comprehensive coverage from original files and robust de-duplication.`
    );
  } else if (isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1) {
    systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files): The 'Current State of Product' is empty, and multiple files have been provided (summarized in File Manifest). Your IMMEDIATE and PRIMARY task for this first iteration is NOT to simply list or concatenate content. You MUST:
1. Analyze ALL provided original file data (provided in this API call).
2. Identify common themes, chapters, sections, and any versioning patterns.
3. AGGRESSIVELY de-duplicate and consolidate information.
4. Produce a SINGLE, COHERENT, WELL-STRUCTURED initial document that synthetically represents the core, essential information from ALL files.
Your output for this iteration MUST be a de-duplicated synthesis. DO NOT output raw concatenated content or a simple list of all information from the files. Severe redundancy in your output will be considered a failure to meet the primary task.
The primary metric of success for this specific iteration is the quality of synthesis and de-duplication, not just raw output length. This synthesized document is your ONLY output for this iteration. It should be a high-quality, consolidated first draft.`
    );
  }


  let coreUserInstructions = "";
  if (isGlobalMode) {
    systemInstructionParts.push(
      `GLOBAL MODE DYNAMIC PARAMS: You are in Global Mode. AI operates with high autonomy. Parameters will dynamically adjust from creative/exploratory to focused/deterministic over ${maxIterationsOverall} iterations. Adapt your refinement strategy accordingly. If refinement appears to stall, the system might subtly adjust parameters or its analysis approach to encourage breaking out of local optima; your continued diverse and substantial refinement attempts, potentially exploring different facets of improvement (like structure, clarity, depth, or even alternative phrasings for key sections), are valuable.`
    );
    if (retryContext) {
        coreUserInstructions += `SYSTEM NOTICE: Your previous attempt for this iteration had an issue: "${retryContext.previousErrorReason}". Please try again, carefully re-evaluating the 'Current State of Product' and adhering to the original instructions for this iteration:\n${retryContext.originalCoreInstructions}\n---\n`;
    } else if (stagnationNudgeStrategy === 'meta_instruct' && activeMetaInstruction) {
        coreUserInstructions += `SYSTEM GUIDANCE (Meta-Instruction): "${activeMetaInstruction}"\n---\n`;
    } else if (stagnationNudgeStrategy === 'meta_instruct' && !activeMetaInstruction) { // Fallback static meta-instruction
        coreUserInstructions += `SYSTEM GUIDANCE (Meta-Instruction): "Refinement seems to be stalling. Please attempt a significantly different approach. Consider focusing on one of these: radically restructuring a section, rephrasing key arguments for clarity, substantially expanding a underdeveloped point, or critically re-evaluating the overall coherence."\n---\n`;
    }


    if (isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1 && !initialOutlineForIter1) {
      coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.\nTask: Initial Document Synthesis from Files.\nBased on the full content of all provided files (sent in this API call), your SOLE objective is to create a single, comprehensive, coherent, and de-duplicated initial document. Follow the 'CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files)' system instruction. This synthesized document will be the 'Current State of Product' for Iteration 2.\nOutput: Provide ONLY this new, synthesized document.`;
    } else if (currentIterationOverall === 1 && initialOutlineForIter1) {
        coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.\nTask: Initial Document Synthesis from Outline.\nThe 'Current State of Product' (below) contains an AI-generated outline and a list of identified redundancies.\nYour task is to:\n1. Use this outline and redundancy list as a strong guide.\n2. Referencing the full original file data (provided to you in this API call), flesh out this outline into a complete, coherent, and de-duplicated document.\n3. Ensure all identified redundancies are resolved.\n4. Produce a single, well-structured document.\nThis synthesized document will be the 'Current State of Product' for Iteration 2.\nOutput: Provide ONLY this new, synthesized document.`;
    }
     else {
      coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.
1. Analyze & Refine: Review the 'Current State of Product'. Autonomously identify areas for significant improvement related to clarity, coherence, depth, or structure.
2. Substantial Change: Implement meaningful and **discernible** changes. Aim for a distinct evolution of the product. If the 'Current State of Product' is excessively long, contains significant repetition, or appears structurally unsound, 'substantial change' MUST involve addressing these large-scale issues. This could mean: restructuring the entire document, significantly condensing or removing redundant sections, or rewriting major portions for clarity and coherence. **Conversely, if the current product is concise but seems underdeveloped, lacks depth, or could benefit from exploring new facets, 'substantial change' should prioritize expanding on core ideas, adding supporting details, examples, or exploring new, relevant perspectives. Do not merely make minor stylistic edits if the conceptual core can be significantly enriched or broadened.** Do not simply make minor edits or append content if fundamental problems exist throughout the current product. Do not merely make minor stylistic edits on an already well-polished section if other areas demonstrably lack depth, require structural improvement, or if the conceptual core itself can be significantly enriched or broadened by exploring new facets.
   Output: Provide ONLY the new, modified textual product.
`;
      if (loadedFilesForContext && loadedFilesForContext.length > 1) {
          coreUserInstructions += `   Reminder: If multiple files were originally provided, ensure your refinement consolidates information and removes redundancy, reflecting a synthesized understanding. Prioritize information from more recent or complete versions if versioning is apparent.\n`;
      }
    }
  } else { // Plan Mode
    systemInstructionParts.push(
      `ITERATIVE PLAN MODE: You are executing a specific stage of a predefined iterative plan. Adhere strictly to the goals of the current stage.`
    );
    if (activePlanStage) {
      coreUserInstructions = `Executing Iterative Plan Stage (Overall Iteration ${currentIterationOverall}).
Stage Goal Summary:
- Target Format: ${activePlanStage.format}
- Target Length Relative to Current: ${activePlanStage.length}
- Target Complexity Change: ${activePlanStage.complexity}
- Iterations for this Stage: ${currentIterationOverall - (currentIterationOverall - activePlanStage.stageIterations)} of ${activePlanStage.stageIterations}
Adhere to Stage Goals: Transform the 'Current State of Product' to meet these specific targets.
`;
      if (activePlanStage.format === 'paragraph') {
        const showHeadings = activePlanStage.outputParagraphShowHeadings ?? outputParagraphShowHeadingsGlobal;
        const maxDepth = activePlanStage.outputParagraphMaxHeadingDepth ?? outputParagraphMaxHeadingDepthGlobal;
        const numbered = activePlanStage.outputParagraphNumberedHeadings ?? outputParagraphNumberedHeadingsGlobal;
        coreUserInstructions += `Formatting Details (if 'paragraph' format): Show Headings: ${showHeadings}, Max Depth: ${maxDepth}, Numbered: ${numbered}.\n`;
      }
      if (activePlanStage.format === 'json') {
        coreUserInstructions += `JSON Output (if 'json' format): Ensure your output is a single, valid JSON object or array. Do not include any explanatory text outside the JSON structure itself. If the task implies a specific schema, adhere to it. If not, derive a sensible schema.\n`;
      }
      if (activePlanStage.customInstruction) {
        coreUserInstructions += `Specific Instructions for Stage: ${activePlanStage.customInstruction}\n`;
      }
      coreUserInstructions += `Content Consistency: Unless the stage goals (length, complexity, format) explicitly require removal or significant summarization, maintain the core information and intent of the 'Current State of Product'.
Output: Provide ONLY the new, modified textual product based on these stage goals.`;
    } else {
      coreUserInstructions = "Error: Plan mode active, but no current plan stage found. Please output the current product unchanged.";
    }
  }
  return { systemInstruction: systemInstructionParts.join('\n\n'), coreUserInstructions };
};

export const buildTextualPromptPart = (
    currentProduct: string | null,
    fileManifest: string,
    coreUserInstructions: string,
    currentIterationOverall: number,
    initialOutlineForIter1?: OutlineGenerationResult
): string => {
    let productForPrompt = currentProduct || "";
    if (currentProduct && currentProduct.length > MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT) {
        productForPrompt = `${currentProduct.substring(0, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}...\n...(Product content truncated in this prompt view. Full length: ${currentProduct.length} chars)...\n...${currentProduct.substring(currentProduct.length - MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}`;
    }

    const promptParts: string[] = [];

    if (fileManifest && fileManifest.trim()) {
        promptParts.push(`---FILE MANIFEST (Original Input Summary)---\n${fileManifest.trim()}`);
    }

    let productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall})---`;
    if (currentIterationOverall === 1 && initialOutlineForIter1) {
        productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall}) (AI NOTE: You are using the below AI-generated outline and redundancy list to guide your synthesis of the full document from the ORIGINAL files. The 'Current State of Product' effectively starts empty, to be built by you.)---`;
    } else if (currentIterationOverall === 1 && !initialOutlineForIter1 && (!currentProduct || currentProduct.trim() === "")) {
         productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall}) (Effectively empty, to be generated from original files)---`;
    }

    promptParts.push(productContextTitle);
    if (initialOutlineForIter1 && currentIterationOverall === 1) {
        promptParts.push(`---INTERNAL ANALYSIS OUTLINE (Generated by AI based on original files)---\n${initialOutlineForIter1.outline.trim()}`);
        if (initialOutlineForIter1.identifiedRedundancies.trim()) {
            promptParts.push(`---IDENTIFIED REDUNDANCIES/VERSIONING (from AI analysis of original files)---\n${initialOutlineForIter1.identifiedRedundancies.trim()}`);
        }
    } else if (productForPrompt.trim()) {
         promptParts.push(productForPrompt.trim());
    } else {
        promptParts.push("(empty or not applicable for this iteration)");
    }


    promptParts.push("------------------------------------------");
    promptParts.push(coreUserInstructions);
    promptParts.push("------------------------------------------");
    promptParts.push("REMINDER: Your response should be ONLY the new, modified textual product. Do NOT include conversational filler, apologies, or self-references. If converged, prefix your ENTIRE response with \"" + CONVERGED_PREFIX + "\".");
    promptParts.push(`NEW MODIFIED PRODUCT (Iteration ${currentIterationOverall + 1}):`);

    return promptParts.join('\n');
};
