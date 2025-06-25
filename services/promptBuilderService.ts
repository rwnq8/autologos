
import type { LoadedFile, PlanStage, OutputFormat, OutputLength, OutputComplexity, NudgeStrategy, RetryContext, OutlineGenerationResult } from '../types.ts';
import { DETERMINISTIC_TARGET_ITERATION } from '../services/ModelStrategyService'; // Import for dynamic use

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
<Your detailed outline here. Use markdown for structure, e.g., # Main Topic, ## Sub-topic, 1. Point a, 2. Point b. Aim for a comprehensive outline covering all key aspects of the input files. The outline should be detailed enough to guide the synthesis of a full document but should NOT contain the full prose of the document itself. Focus on structure and key informational points for each section.>

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
  activeMetaInstruction?: string,
  // Segmented synthesis params
  isSegmentedSynthesisMode: boolean = false,
  currentSegmentOutlineText?: string,
  fullOutlineForContext?: string,
  // Targeted refinement params
  isTargetedRefinementMode: boolean = false,
  targetedSelectionText?: string,
  instructionsForTargetedSelection?: string
): { systemInstruction: string, coreUserInstructions: string } => {
  let systemInstructionParts: string[] = [];

  if (isTargetedRefinementMode) {
    systemInstructionParts.push(
`You are an AI assistant specialized in targeted text refinement. You will be given a full document ('Current State of Product'), a specific 'Text Selection to Refine' from that document, and 'User Instructions for Refining Selection'.
Your CRITICAL TASK:
1. Carefully analyze the 'User Instructions for Refining Selection'.
2. Rewrite or modify ONLY the 'Text Selection to Refine' according to these instructions.
3. Seamlessly integrate your refined version of the selection back into the full document context. The parts of the document outside the 'Text Selection to Refine' MUST remain identical, unless minor adjustments are absolutely essential for coherence with the changed selection.
4. Output the ENTIRE, new document with only the specified selection modified.
Preserve the original tone and style of the document unless the user instructions for the selection specify otherwise.
Your output MUST be the complete, new textual product. Do NOT include conversational filler, apologies, or self-references.`
    );
  } else if (isSegmentedSynthesisMode && currentIterationOverall === 0) { // This signals a segment synthesis call
    systemInstructionParts.push(
`You are an AI assistant specialized in synthesizing ONE PART of a larger document. You will be given:
1.  The specific outline segment you need to generate content for.
2.  The full original outline of the entire document (for context).
3.  Access to ALL original source files.

Your CRITICAL TASK for THIS SEGMENT:
-   Focus exclusively on the current outline segment provided in the user instructions.
-   Thoroughly scan ALL provided original source files to locate EVERY relevant passage, paragraph, specific detail, data point, and argument that pertains to THIS outline segment.
-   Integrate this information with MAXIMUM DETAIL AND COMPREHENSIVENESS into a well-written narrative for the current segment.
-   If multiple files cover this segment, merge their details comprehensively, prioritizing the most complete or recent versions while ensuring no unique substantive information is lost.
-   De-duplicate information effectively *within this segment*.
-   The conciseness of the outline segment text itself does NOT mean your synthesized content for that segment should be brief. The outline is a structural guide; the detail comes from the files.
-   Your output MUST be ONLY the synthesized text for the current outline segment. Do NOT include the segment heading itself unless it's naturally part of the flow. Do NOT output the entire document.
-   Value added in this task is defined by: 1. Comprehensive inclusion of all relevant detailed information from source files for this segment. 2. Coherent organization of this detailed information. 3. Effective de-duplication of overlapping detailed content for this segment.
-   Information loss by over-summarizing rich file content for this segment is a failure. Your generated text for this segment should be as detailed as the source files allow.
-   Do NOT include conversational filler, apologies, or self-references.
`);
  } else {
    // Original system instructions for non-segmented/non-targeted calls
    systemInstructionParts.push(
      `You are an AI assistant specialized in iterative content refinement. Your goal is to progressively improve a given "Current State of Product" based on the user's instructions and provided file context. Adhere strictly to the iteration number and refinement goals.`
    );
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
Content Integrity: Preserve core information and aim for comprehensive coverage of the source material's intent, especially during initial synthesis. Aggressively identify and consolidate duplicative content from multiple files into a single, synthesized representation. **Unless specific instructions for summarization (e.g., 'shorter' length, 'key_points' format) or significant restructuring are provided for the current iteration, avoid unrequested deletions of unique information or excessive summarization that leads to loss of detail from the source material. Your primary goal is to REFINE, STRUCTURE, and ENRICH the existing information, not to arbitrarily shorten it unless explicitly instructed.** While merging and pruning redundant information is critical, if in doubt about whether content is merely redundant vs. a nuanced variation or supporting detail, err on theside of preserving it, particularly in earlier iterations. Subsequent iterations or specific plan stages can focus on more aggressive condensation if the product becomes too verbose or if explicitly instructed.`
    );

    if (currentIterationOverall === 1 && initialOutlineForIter1 && !isSegmentedSynthesisMode && !isTargetedRefinementMode) {
      systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files using Pre-Generated Outline - Single Pass):
The 'Current State of Product' (provided below the main instructions) is an AI-generated outline and a list of identified redundancies. You also have access to the FULL ORIGINAL FILE DATA from the input files (provided in this API call). Your task for this FIRST iteration is to synthesize a COMPLETE and **SUBSTANTIVE** DOCUMENT by meticulously populating the outline with detailed content.
**Core Objective: Transform the Outline into a COMPREHENSIVE Document by POPULATING IT with DETAILED CONTENT from the ORIGINAL FILES.**
Operational Procedure for EACH Outline Item:
1.  **Understand the Outline Item's Scope:** Read the current outline item.
2.  **Scan ALL Original Files:** Actively search through ALL provided original files to find ALL passages, paragraphs, and sections that correspond to this specific outline item.
3.  **Extract Relevant Detailed Text:** Identify and extract the most detailed and informative text segments from the files related to the outline item. **Do not summarize these segments at this extraction stage.**
4.  **Synthesize and Integrate (Without Loss of Detail):** Combine the extracted detailed text segments. If there's overlapping information or different versions of the same point, synthesize them into a coherent narrative for that outline section. **The goal is to PRESERVE and COMBINE existing detail, not to replace it with a shorter summary.** If multiple versions exist, prioritize the most complete or recent version as the base, integrating unique, substantive details from other versions.
5.  **Ensure Substantiveness:** The content generated for each outline section should reflect the **maximum level of detail available in the source files for that topic**. If an outline point is brief, but the files contain extensive relevant text, your output for that point MUST be detailed and incorporate that extensive text.
6.  **Address Redundancies:** Use the "Identified Redundancies" list to guide your synthesis, ensuring that duplicative information is merged rather than repeated.
**CRITICAL DIRECTIVES:**
-   **The Outline is for STRUCTURE, NOT a Target for Brevity:** Do NOT treat the outline's conciseness as an instruction to produce brief content. Your output must be as detailed as the source material allows for each point. The expectation is that the synthesized document will be SUBSTANTIALLY LONGER than the outline itself.
-   **VALUE ADD IS PRESERVING AND ORGANIZING EXISTING DETAIL:** You are adding value by structuring and coherently presenting the *existing richness* found in the files. Discarding detailed written content in favor of brief summaries, or generating new, less detailed content where rich source material exists, is a failure of this task.
-   **Output a SINGLE, Coherent Document:** This synthesized, detailed document is your ONLY output.
Failure to incorporate the available detail from source files, resulting in an output that is merely a slightly expanded outline, will be considered a failure of the primary task.`
      );
    } else if (isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1 && !isSegmentedSynthesisMode && !isTargetedRefinementMode) {
      systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files - Single Pass): The 'Current State of Product' is empty, and multiple files have been provided (summarized in File Manifest). Your IMMEDIATE and PRIMARY task for this first iteration is NOT to simply list or concatenate content. You MUST:
1. Analyze ALL provided original file data (provided in this API call).
2. Identify common themes, chapters, sections, and any versioning patterns.
3. AGGRESSIVELY de-duplicate and consolidate information, BUT prioritize capturing the full breadth and depth of unique content from the source files. **Do not over-summarize or lose important details at this stage.**
4. Produce a SINGLE, COHERENT, WELL-STRUCTURED initial document that synthetically represents the core, essential information from ALL files.
Your output for this iteration MUST be a de-duplicated synthesis. DO NOT output raw concatenated content or a simple list of all information from the files. Severe redundancy in your output will be considered a failure to meet the primary task.
The primary metric of success for this specific iteration is the quality of synthesis and de-duplication, aiming for comprehensive initial coverage that PRESERVES DETAIL. This synthesized document is your ONLY output for this iteration. It should be a high-quality, consolidated first draft, likely quite substantial in length if the source files are detailed.`
      );
    }
  }

  let coreUserInstructions = "";

  if (isTargetedRefinementMode) {
    coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall}. Task: Targeted Section Refinement.\n`;
    if (retryContext) {
        coreUserInstructions += `SYSTEM NOTICE: Your previous attempt for this iteration had an issue: "${retryContext.previousErrorReason}". Please try again, carefully re-evaluating the 'Current State of Product' and adhering to the original instructions for this iteration (including the targeted refinement task below):\n${retryContext.originalCoreInstructions}\n---\n`;
    }
    coreUserInstructions += `---TARGETED REFINEMENT TASK---\n`;
    coreUserInstructions += `Text Selection to Refine:\n"${targetedSelectionText || "(Error: Targeted selection text not provided)"}"\n\n`;
    coreUserInstructions += `User Instructions for Refining Selection:\n"${instructionsForTargetedSelection || "(Error: Instructions for selection not provided)"}"\n`;
    coreUserInstructions += `---END TARGETED REFINEMENT TASK---\n`;
    coreUserInstructions += `Reminder: Return the ENTIRE document with ONLY the above selection modified and seamlessly integrated. Refer to System Instructions for critical details on this task.`;

  } else if (isSegmentedSynthesisMode && currentIterationOverall === 0) {
    coreUserInstructions += `This is a SEGMENTED SYNTHESIS task.
    You are to generate detailed content ONLY for the following outline segment:
    ---CURRENT OUTLINE SEGMENT TO SYNTHESIZE---
    ${currentSegmentOutlineText || "(Error: Current segment outline text not provided)"}
    -------------------------------------------
    For context, here is the FULL ORIGINAL OUTLINE of the entire document:
    ---FULL ORIGINAL DOCUMENT OUTLINE---
    ${fullOutlineForContext || "(Error: Full original outline not provided)"}
    ------------------------------------
    INSTRUCTIONS FOR THIS SEGMENT:
    1.  Referencing the full original file data (provided to you in this API call via file inputs), extract and integrate detailed textual content from these files to comprehensively flesh out ONLY the "CURRENT OUTLINE SEGMENT TO SYNTHESIZE" specified above.
    2.  Ensure your output reflects the richness and depth of the original files for this segment, not just the brevity of its outline text. The outline is for organization; the content detail comes from the files.
    3.  Output: Provide ONLY the new, synthesized textual content for THIS SEGMENT. Do not include headings unless they are part of the natural flow of the content for this segment.`;
  } else if (isGlobalMode) {
    systemInstructionParts.push(
      `GLOBAL MODE DYNAMIC PARAMS: Parameters will dynamically adjust from creative/exploratory to focused/deterministic. The primary sweep towards deterministic values (e.g., Temperature near 0.0) aims to complete around iteration ${DETERMINISTIC_TARGET_ITERATION} (out of a total ${maxIterationsOverall} iterations for this run). Adapt your refinement strategy accordingly. If refinement appears to stall, the system might subtly adjust parameters or its analysis approach to encourage breaking out of local optima; your continued diverse and substantial refinement attempts, potentially exploring different facets of improvement (like structure, clarity, depth, or even alternative phrasings for key sections), are valuable.`
    );
    if (retryContext) {
        coreUserInstructions += `SYSTEM NOTICE: Your previous attempt for this iteration had an issue: "${retryContext.previousErrorReason}". Please try again, carefully re-evaluating the 'Current State of Product' and adhering to the original instructions for this iteration:\n${retryContext.originalCoreInstructions}\n---\n`;
    } else if (stagnationNudgeStrategy === 'meta_instruct' && activeMetaInstruction) {
        coreUserInstructions += `SYSTEM GUIDANCE (Meta-Instruction): "${activeMetaInstruction}"\n---\n`;
    } else if (stagnationNudgeStrategy === 'meta_instruct' && !activeMetaInstruction) { 
        coreUserInstructions += `SYSTEM GUIDANCE (Meta-Instruction): "Refinement seems to be stalling. Please attempt a significantly different approach. Consider focusing on one of these: radically restructuring a section, rephrasing key arguments for clarity, substantially expanding a underdeveloped point, or critically re-evaluating the overall coherence."\n---\n`;
    }

    if (isInitialProductEmptyAndFilesLoaded && currentIterationOverall === 1 && !initialOutlineForIter1 && !isSegmentedSynthesisMode) {
      coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.\nTask: Initial Document Synthesis from Files.\nBased on the full content of all provided files (sent in this API call), your SOLE objective is to create a single, comprehensive, coherent, and de-duplicated initial document. Follow the 'CRITICAL INITIAL SYNTHESIS (Iteration 1 from Files - Single Pass)' system instruction. This synthesized document will be the 'Current State of Product' for Iteration 2.\nOutput: Provide ONLY this new, synthesized document.`;
    } else if (currentIterationOverall === 1 && initialOutlineForIter1 && !isSegmentedSynthesisMode) {
        coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.\nTask: Initial Document Synthesis from Outline.\nThe 'Current State of Product' (below) contains an AI-generated outline and a list of identified redundancies.\nYour task is to:\n1. Use this outline and redundancy list as a strong guide for STRUCTURE and to RESOLVE REDUNDANCIES.\n2. Referencing the full original file data (provided to you in this API call), **extract and integrate detailed textual content from these files to comprehensively flesh out EACH section of the outline.**\n3. **Ensure your output reflects the richness and depth of the original files, not just the brevity of the outline. The outline is for organization; the content detail comes from the files.**\n4. Produce a single, well-structured, and detailed document.\nThis synthesized document will be the 'Current State of Product' for Iteration 2.\nOutput: Provide ONLY this new, synthesized document.`;
    }
     else if (!isSegmentedSynthesisMode) { 
      const CONVERGENCE_PHASE_START_PERCENT = 0.7; // Start convergence-focused instructions around 70% of max iterations
      const convergencePhaseStartIteration = Math.floor(maxIterationsOverall * CONVERGENCE_PHASE_START_PERCENT);

      coreUserInstructions += `This is Iteration ${currentIterationOverall} of ${maxIterationsOverall} in Global Autonomous Mode.\n`;

      if (currentIterationOverall < convergencePhaseStartIteration && currentIterationOverall > 1) {
        coreUserInstructions += `Your primary goal is to **creatively and substantially evolve** the 'Current State of Product'.
Focus on identifying and implementing the most impactful improvements possible. This may include:
-   **Conceptual Development & Expansion:** If the product is underdeveloped in key areas, significantly expand on core ideas. Add substantial details, concrete examples, and explore related arguments or nuances. Prioritize increasing depth and breadth of content. Be bold in introducing new relevant concepts if supported by source material.
-   **Structural Re-evaluation & Improvement:** Improve overall organization and logical flow. Do not be afraid to restructure significantly if it enhances clarity or presents a stronger narrative. Ensure smooth transitions and a well-reasoned progression of ideas.
-   **Addressing Redundancy & Enhancing Clarity:** While expanding or restructuring, identify and resolve significant redundancies if they were not handled in initial synthesis or if new ones arise. Refine prose for clarity, impact, and engagement.
Preserve the richness of detail from the original source material unless condensation is clearly beneficial for overall quality and depth. Avoid uninstructed summarization that loses detail.
Output: Provide ONLY the new, modified textual product.`;
      } else { // Late Global Mode (Convergence Phase) or Iter 1 from text prompt
        coreUserInstructions += `1. Analyze & Refine: Review the 'Current State of Product'. Autonomously identify areas for significant improvement.
2. Substantial Change & Refinement: Implement meaningful and discernible changes. The primary goal is to enhance clarity, coherence, structure, and depth, or to finalize the document for convergence.
    -   **If the 'Current State of Product' appears to have significant *verifiable* redundancies not addressed previously, or structural issues hindering clarity:** Focus on resolving these. Condensation should target *specific, identifiable repetitions or demonstrably superfluous content* rather than general summarization of detailed information.
    -   **If the 'Current State of Product' is structurally sound but could be improved:** Focus on enhancing logical flow, strengthening arguments, improving prose, or adding further nuance or examples *if genuinely supported by the source material's depth and not yet fully explored*.
    -   **If the product seems underdeveloped in specific areas (and not addressed by meta-instructions for expansion):** Consider if this indicates a natural conclusion or if a final focused expansion is needed.
    -   **Avoid aggressive uninstructed length reduction, especially if the document is not yet mature:** Preserve the richness of detail from the source material. However, if the product is mature and refinement implies condensation for clarity/impact, this is acceptable.
   Output: Provide ONLY the new, modified textual product.`;
      }
      
      if (loadedFilesForContext && loadedFilesForContext.length > 1) {
          coreUserInstructions += `\n   Reminder: If multiple files were originally provided, ensure your refinement consolidates information and removes redundancy, reflecting a synthesized understanding. Prioritize information from more recent or complete versions if versioning is apparent.\n`;
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
    initialOutlineForIter1?: OutlineGenerationResult, 
    isSegmentedSynthesisMode?: boolean, 
    isTargetedRefinementMode?: boolean 
): string => {
    let productForPrompt = currentProduct || "";

    if (currentProduct && currentProduct.length > MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT && !isSegmentedSynthesisMode) {
        productForPrompt = `${currentProduct.substring(0, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}...\n...(Product content truncated in this prompt view. Full length: ${currentProduct.length} chars)...\n...${currentProduct.substring(currentProduct.length - MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}`;
    }

    const promptParts: string[] = [];

    if (fileManifest && fileManifest.trim()) {
        promptParts.push(`---FILE MANIFEST (Original Input Summary. Note: Full file data is provided separately to the API for your reference during generation.)---`);
        promptParts.push(fileManifest.trim());
    }

    let productContextTitle: string;

    if (isSegmentedSynthesisMode && currentIterationOverall === 0) { 
        productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration 1 - Segmented Synthesis Note)---`;
        productForPrompt = "(You are generating a segment from scratch based on original files, guided by an outline segment and full outline provided in instructions above. The 'Current State of Product' for this API call is effectively empty for the segment being generated, or it refers to the full outline provided for context.)";
    } else if (isTargetedRefinementMode) {
        productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall}) (AI NOTE: You will refine a specific selection from this product based on instructions below)---`;
    } else if (currentIterationOverall === 1 && initialOutlineForIter1 && !isSegmentedSynthesisMode) {
        productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall}) (AI NOTE: You are using the below AI-generated outline and redundancy list to guide your synthesis of the full document from the ORIGINAL files. The 'Current State of Product' effectively starts empty, to be built by you.)---`;
    } else if (currentIterationOverall === 1 && !initialOutlineForIter1 && (!currentProduct || currentProduct.trim() === "") && !isSegmentedSynthesisMode) {
         productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall}) (Effectively empty, to be generated from original files)---`;
    } else {
         productContextTitle = `---CURRENT STATE OF PRODUCT (Iteration ${currentIterationOverall})---`;
    }
    
    promptParts.push(productContextTitle);

    if (initialOutlineForIter1 && currentIterationOverall === 1 && !isSegmentedSynthesisMode && !isTargetedRefinementMode) {
        promptParts.push(`---INTERNAL ANALYSIS OUTLINE (Generated by AI based on original files)---\n${initialOutlineForIter1.outline.trim()}`);
        if (initialOutlineForIter1.identifiedRedundancies.trim()) {
            promptParts.push(`---IDENTIFIED REDUNDANCIES/VERSIONING (from AI analysis of original files)---\n${initialOutlineForIter1.identifiedRedundancies.trim()}`);
        }
    } else if (productForPrompt.trim()) { 
         promptParts.push(productForPrompt.trim());
    } else if (!isSegmentedSynthesisMode) { 
        promptParts.push("(empty or not applicable for this iteration)");
    }


    promptParts.push("------------------------------------------");
    promptParts.push(coreUserInstructions); 
    promptParts.push("------------------------------------------");
    
    if (isSegmentedSynthesisMode && currentIterationOverall === 0) {
        promptParts.push("REMINDER: Your response should be ONLY the synthesized text for the CURRENT outline segment provided in the user instructions. Do NOT include headings unless part of the natural flow. Adhere to all system instructions regarding detail and file usage.");
        promptParts.push(`NEW MODIFIED TEXT FOR THIS SEGMENT:`);
    } else if (isTargetedRefinementMode) {
        promptParts.push("REMINDER: Your response should be ONLY the new, complete textual product with the specified selection modified and integrated. Adhere to all system instructions. If converged on the selection, prefix with \"" + CONVERGED_PREFIX + "\".");
        promptParts.push(`NEW MODIFIED PRODUCT (Iteration ${currentIterationOverall + 1}):`);
    } else {
        promptParts.push("REMINDER: Your response should be ONLY the new, modified textual product. Do NOT include conversational filler, apologies, or self-references. If converged, prefix your ENTIRE response with \"" + CONVERGED_PREFIX + "\".");
        promptParts.push(`NEW MODIFIED PRODUCT (Iteration ${currentIterationOverall + 1}):`);
    }

    return promptParts.join('\n');
};
