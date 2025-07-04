import type { LoadedFile, PlanStage, OutputFormat, OutputLength, OutputComplexity, NudgeStrategy, RetryContext, OutlineGenerationResult, Version } from '../types/index.ts';
import { formatVersion } from './versionUtils.ts';

export const MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT = 250000;

const JSON_RESPONSE_SCHEMA = `
Your response MUST be a single, valid JSON object that adheres to the following TypeScript interface.
Do NOT add any conversational filler, markdown fences, or other text outside of the JSON object itself.

interface Response {
  // Your concise rationale for the changes made in this version compared to the previous one. Focus on the 'why' and what was improved.
  versionRationale: string;

  // The complete, new, and refined text of the product. This is the main output.
  newProductContent: string;

  // A brief, honest critique of the 'newProductContent' you just generated. What are its remaining weaknesses or areas for future improvement?
  selfCritique: string;

  // Based on your self-critique, what is the best next step for the overall process?
  // 'refine_further': If the product is good but can still be substantially improved.
  // 'expand_section': If a specific part of the product needs more detail.
  // 'declare_convergence': If the product is complete, well-supported, and further changes would be trivial or detrimental.
  suggestedNextStep: 'refine_further' | 'expand_section' | 'declare_convergence';
}`;


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
  isJsonMode: boolean, // New parameter to control output format
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
    
  if (isJsonMode) {
    systemInstructionParts.push(`GENERAL RULES & OUTPUT FORMAT:
- **Output Structure**: ${JSON_RESPONSE_SCHEMA}
- **Coherence and Substantiation**: Each version MUST become more logically coherent and well-supported. Strengthen arguments, ensure claims are substantiated (using your internal knowledge or provided context), and improve the logical flow. The goal is a final product that is a robust, defensible, and well-reasoned case.
- **Avoid Disclaimers & Hedging**: As part of building a coherent case, you MUST NOT include weak disclaimers in the 'newProductContent' about the content being "conceptual," "for illustrative purposes," or "requiring further refinement/legal review." The iterative process IS that refinement.
- **Substantial Improvement Required**: Each new version MUST represent a significant and substantive improvement over the last. Do not make trivial, stylistic-only changes (mere "wordsmithing"). This includes swapping synonyms without changing meaning. Focus on adding clarity, depth, new information, or improving the logical structure. If you cannot make a substantial improvement, you MUST declare convergence by setting 'suggestedNextStep' to 'declare_convergence'.
- **Heed Meta-Instructions**: When a specific meta-instruction is given (e.g., to break stagnation), you MUST prioritize it and make a conceptually different response.`
    );
  } else {
    // Text-only instructions for when tools are used
    systemInstructionParts.push(`GENERAL RULES & OUTPUT FORMAT:
- **Output Structure**: Your response should be ONLY the new, modified textual product. Do NOT include conversational filler, apologies, self-references, or any other text outside of the product itself.
- **Coherence and Substantiation**: Each version MUST become more logically coherent and well-supported. Strengthen arguments, ensure claims are substantiated (using your internal knowledge or provided context), and improve the logical flow. The goal is a final product that is a robust, defensible, and well-reasoned case.
- **Avoid Disclaimers & Hedging**: As part of building a coherent case, you MUST NOT include weak disclaimers in the product about it being "conceptual," "for illustrative purposes," or "requiring further refinement/legal review." The iterative process IS that refinement.
- **Substantial Improvement Required**: Each new version MUST represent a significant and substantive improvement over the last. Do not make trivial, stylistic-only changes (mere "wordsmithing"). This includes swapping synonyms without changing meaning. Focus on adding clarity, depth, new information, or improving the logical structure. If you cannot make a substantial improvement, you should aim to return the product as-is with minimal changes.
- **Heed Meta-Instructions**: When a specific meta-instruction is given (e.g., to break stagnation), you MUST prioritize it and make a conceptually different response.`
    );
  }
  
  if (isInitialProductEmptyAndFilesLoaded && majorVersion === 1) {
      systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Version 1 from Files): The 'Current State of Product' is empty, and one or more files have been provided. Your IMMEDIATE and PRIMARY task for this first version is NOT to simply list or concatenate content. You MUST:
1. Analyze ALL provided original file data.
2. Identify common themes, chapters, sections, and any versioning patterns.
3. AGGRESSIVELY de-duplicate and consolidate information, BUT prioritize capturing the full breadth and depth of unique content from the source files.
4. Produce a SINGLE, COHERENT, WELL-STRUCTURED initial document that synthetically represents the core, essential information from ALL files.
Your output for this version MUST be a de-duplicated synthesis, placed in the 'newProductContent' field of the JSON response (if JSON mode is active) or as the direct text output.`
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
  } else if (isTargetedRefinementMode && targetedSelectionText && instructionsForTargetedSelection) {
      coreUserInstructions += `Task: Targeted Refinement.\nBased ON THE FULL 'CURRENT STATE OF PRODUCT' for context, your SOLE objective is to rewrite ONLY the following specific text selection based on the provided instructions. You MUST output the entire new product, with only the selected part changed.\n\n---TEXT SELECTION TO REFINE---\n${targetedSelectionText}\n-----------------------------\n\n---INSTRUCTIONS FOR THIS SELECTION---\n${instructionsForTargetedSelection}\n----------------------------------`;
  } else {
      coreUserInstructions += `Your task is to refine the "Current State of Product". Analyze it and implement the most impactful improvements to produce the next version.`;
      if (isJsonMode) {
          coreUserInstructions += ` Follow the JSON response schema.`;
      }
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

    const prevVersion = { ...currentVersion, major: currentVersion.major, minor: currentVersion.minor > 0 ? currentVersion.minor - 1 : 0 };
    if (currentVersion.minor === 0 && currentVersion.major > 0) {
        prevVersion.major = currentVersion.major - 1;
    }

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
   
    // The following lines were removed to prevent prompt leakage.
    // The core instructions and system prompt are sufficient.

    return promptParts.join('\n');
};