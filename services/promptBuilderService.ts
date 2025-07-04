


import type { LoadedFile, PlanStage, OutputFormat, OutputLength, OutputComplexity, NudgeStrategy, RetryContext, OutlineGenerationResult, Version } from '../types/index.ts';
import { formatVersion } from './versionUtils.ts';

export const CONVERGED_PREFIX = "CONVERGED:";
export const MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT = 250000;

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

Do NOT generate the full document content. Only the outline and a redundancy list.`;

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
  currentVersion: Version,
  maxMajorVersions: number,
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
  isSegmentedSynthesisMode: boolean = false,
  currentSegmentOutlineText?: string,
  fullOutlineForContext?: string,
  isTargetedRefinementMode: boolean = false,
  targetedSelectionText?: string,
  instructionsForTargetedSelection?: string,
  isRadicalRefinementKickstart: boolean = false,
  devLogContextString?: string,
  ensembleSubProducts?: string[] | null
): { systemInstruction: string, coreUserInstructions: string } => {
  let systemInstructionParts: string[] = [];
  const { major: majorVersion } = currentVersion;

  if (devLogContextString && !devLogContextString.includes("No specific, highly relevant DevLog entries found") && !devLogContextString.includes("DevLog Contextualizer Inactive") && !devLogContextString.includes("No DevLog entries to analyze")) {
    systemInstructionParts.push(
      `CRITICAL AWARENESS FROM DEVELOPMENT LOG:\nThe following entries from the project's development log have been identified as highly relevant to your current task. Take them into account during your refinement process to avoid past issues, adhere to decisions, or understand key context.\n---\n${devLogContextString}\n---`
    );
  }

  if (ensembleSubProducts && ensembleSubProducts.length > 0 && majorVersion <= 2) {
    systemInstructionParts.push(
      `CRITICAL CONTEXT - ENSEMBLE VARIATIONS: You are refining a product that was synthesized via an ensemble method. Several variations of sub-products were generated and are provided below in the prompt for context. Your task in these early refinement versions is to explicitly synthesize a new version by selecting and combining the best elements, phrasings, and structures from EACH of the provided variations. Your goal is to create a new, superior version that represents the best of all of them, not just improve one.`
    );
  }
  
   systemInstructionParts.push(
      `You are an AI assistant specialized in iterative content refinement. Your goal is to progressively improve a given "Current State of Product" based on the user's instructions and provided file context. Adhere strictly to the version number and refinement goals.`
    );
    systemInstructionParts.push(
      `CRITICAL CONTEXT OF ORIGINAL FILES: The complete data of all original input files was provided to you in the very first API call of this entire multi-version process (or for the outline generation stage if applicable). Your primary knowledge base for all subsequent refinements is this full original file data. The 'File Manifest' is only a summary; refer to the complete file data provided initially for all tasks. Synthesize information from ALL provided files. Cross-reference details across files if relevant. Your product should reflect the combined knowledge and themes within these files.`
    );
    
   systemInstructionParts.push(`GENERAL RULES:
- Output Structure: Produce ONLY the new, modified textual product. Do NOT include conversational filler, apologies, or self-references like "Here's the updated product:".
- Convergence: If you determine that the product cannot be meaningfully improved further according to the current iteration's goals, OR if your generated product is identical to the 'Current State of Product' you received, prefix your ENTIRE response with "${CONVERGED_PREFIX}". Do this sparingly and only when truly converged.
- CRITICAL - AVOID WORDSMITHING: If a meta-instruction to break stagnation or wordsmithing is active, you MUST make a *substantively different* response than the previous version. Do not just change a few words or reorder phrases slightly. Focus on *conceptual changes*, adding *net new information*, or significantly restructuring.`
    );
  
  if (isInitialProductEmptyAndFilesLoaded && majorVersion === 1) {
      systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Version 1 from Files): The 'Current State of Product' is empty, and one or more files have been provided. Your IMMEDIATE and PRIMARY task for this first version is NOT to simply list or concatenate content. You MUST:
1. Analyze ALL provided original file data.
2. Identify common themes, chapters, sections, and any versioning patterns.
3. AGGRESSIVELY de-duplicate and consolidate information, BUT prioritize capturing the full breadth and depth of unique content from the source files.
4. Produce a SINGLE, COHERENT, WELL-STRUCTURED initial document that synthetically represents the core, essential information from ALL files.
Your output for this version MUST be a de-duplicated synthesis. This synthesized document will be the 'Current State of Product' for Version 2.`
      );
    }
  
  
  let coreUserInstructions = "";
  const versionString = formatVersion(currentVersion);

  if (isGlobalMode) {
      coreUserInstructions = `This is Version ${versionString} of v${maxMajorVersions} in Global Autonomous Mode.\n`;
  } else if (activePlanStage) {
      coreUserInstructions = `Executing Iterative Plan Stage (Overall Version ${versionString}).\n`;
      //... plan details
  } else {
       coreUserInstructions = `This is Version ${versionString} of v${maxMajorVersions}.\n`;
  }

  if (activeMetaInstruction) {
    coreUserInstructions += `SYSTEM GUIDANCE (Meta-Instruction): "${activeMetaInstruction}"\n---\n`;
  }
  
  if (isInitialProductEmptyAndFilesLoaded && majorVersion === 1) {
     coreUserInstructions += `Task: Initial Document Synthesis from Files.\nBased on the full content of all provided files, your SOLE objective is to create a single, comprehensive, coherent, and de-duplicated initial document.`;
  } else {
      coreUserInstructions += `Your task is to refine the "Current State of Product". Analyze it and implement the most impactful improvements to produce the next version.`;
  }


  return { systemInstruction: systemInstructionParts.join('\n\n'), coreUserInstructions };
};

export const buildTextualPromptPart = (
    currentProduct: string | null,
    loadedFiles: LoadedFile[],
    coreUserInstructions: string,
    currentVersion: Version,
    initialOutlineForIter1: OutlineGenerationResult | undefined,
    fileManifestForPrompt: string,
    isSegmentedSynthesisMode: boolean = false,
    isTargetedRefinementMode: boolean = false,
    ensembleSubProducts?: string[] | null
): string => {
    let productForPrompt = currentProduct || "";

    if (currentProduct && currentProduct.length > MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT && !isSegmentedSynthesisMode) {
        productForPrompt = `${currentProduct.substring(0, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}...\n...(Product content truncated in this prompt view. Full length: ${currentProduct.length} chars)...\n...${currentProduct.substring(currentProduct.length - MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT / 2)}`;
    }
    
    let fileManifestContentForPrompt = "";
    if (loadedFiles.length > 0) {
        fileManifestContentForPrompt = `---FILE MANIFEST (Original Input Summary)---\n${fileManifestForPrompt.trim()}\n---------------------------\n`;
    }

    const promptParts: string[] = [];

    if (fileManifestContentForPrompt.trim()) {
        promptParts.push(fileManifestContentForPrompt);
    }

    const prevVersion = { ...currentVersion, major: currentVersion.major - 1, minor: 0 };
    const productContextTitle = `---CURRENT STATE OF PRODUCT (${formatVersion(prevVersion)})---`;
   
    promptParts.push(productContextTitle);
    
    if (productForPrompt.trim()) {
         promptParts.push(productForPrompt.trim());
    } else {
        promptParts.push("(empty or not applicable for this version)");
    }
    
    promptParts.push("------------------------------------------");
    
    if (ensembleSubProducts && ensembleSubProducts.length > 0 && currentVersion.major <= 2) {
        promptParts.push("---ENSEMBLE SUB-PRODUCT VARIATIONS FOR CONTEXT---");
        ensembleSubProducts.forEach((subProduct, index) => {
            const truncatedSubProduct = subProduct.length > 20000 ? subProduct.substring(0, 10000) + "\n...[TRUNCATED]...\n" + subProduct.substring(subProduct.length - 10000) : subProduct;
            promptParts.push(`\n--- VARIATION ${index + 1} ---\n`);
            promptParts.push(truncatedSubProduct.trim());
        });
        promptParts.push("------------------------------------------");
    }
    
    promptParts.push(coreUserInstructions);
    promptParts.push("------------------------------------------");
   
    promptParts.push("REMINDER: Your response should be ONLY the new, modified textual product. Do NOT include conversational filler, apologies, or self-references. If converged, prefix your ENTIRE response with \"" + CONVERGED_PREFIX + "\".");
    promptParts.push(`NEW MODIFIED PRODUCT (${formatVersion(currentVersion)}):`);

    return promptParts.join('\n');
};
