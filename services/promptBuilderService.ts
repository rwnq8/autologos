
import type { LoadedFile, PlanStage, OutputFormat, OutputLength, OutputComplexity, NudgeStrategy, RetryContext, OutlineGenerationResult, Version, DocumentChunk, OutlineNode } from '../types/index.ts';
import { formatVersion } from './versionUtils.ts';
import { reconstructFromChunks } from './chunkingService.ts';

export const MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT = 25000;
const CONTEXT_WINDOW_SIZE = 20; // Number of chunks in the active window
const CONTEXT_WINDOW_OVERLAP = 5; // Number of chunks to overlap between windows

const JSON_TEXT_RESPONSE_SCHEMA = `
Your response MUST be a single, valid JSON object that adheres to the following TypeScript interface.
Do NOT add any conversational filler, markdown fences (like \`\`\`json\`), or other text outside of the JSON object itself.

interface ChunkModification {
  chunkId: string; // The ID of the chunk from the input prompt.
  content: string; // The new (or original, if unchanged) content of the chunk.
  
  // An array of source file names that informed this chunk's content.
  // This should be maintained and updated if you synthesize information from multiple sources.
  // If the chunk is unchanged or its sources are unknown, this can be an empty array.
  sourceFileNames: string[];
  
  // If you modified this chunk, provide a brief, one-sentence rationale for the change.
  // Example: "Corrected a factual inaccuracy." or "Rephrased for better flow."
  // If the chunk is unchanged, this field MUST be null.
  changeRationale: string | null;
}

interface Response {
  // Your concise rationale for the overall changes made in this version compared to the previous one. Focus on the 'why' and what was improved.
  versionRationale: string;

  // An array of all the chunks that were in the ACTIVE CONTEXT WINDOW. You MUST return an object for every chunk from the window.
  // For chunks you refined, provide the new content and a 'changeRationale'. For unchanged chunks, return them with their original content and a null 'changeRationale'.
  // Preserve the original order and chunkIds.
  windowChunks: ChunkModification[];

  // A brief, honest critique of the changes you just made. What are its remaining weaknesses or areas for future improvement?
  selfCritique: string;

  // Based on your self-critique, what is the best next step for the overall process?
  // 'refine_further': If the product is good but can still be substantially improved.
  // 'expand_section': If a specific part of the product needs more detail.
  // 'declare_convergence': If the product is complete, well-supported, and further changes would be trivial or detrimental.
  suggestedNextStep: 'refine_further' | 'expand_section' | 'declare_convergence';
}`;

const JSON_INITIAL_SYNTHESIS_SCHEMA = `
Your response MUST be a single, valid JSON object that adheres to the following TypeScript interface.
Do NOT add any conversational filler, markdown fences (like \`\`\`json\`), or other text outside of the JSON object itself.

interface Response {
  // The full, synthesized text content of the new document.
  newProductContent: string;

  // Your concise rationale for how you structured and created this initial document from the source materials.
  versionRationale: string;

  // A brief, honest critique of the initial document you just created. What are its weaknesses or areas for improvement?
  selfCritique: string;

  // Based on your critique, what is the best next step for the overall process?
  suggestedNextStep: 'refine_further' | 'expand_section' | 'declare_convergence';
}`;


const JSON_OUTLINE_RESPONSE_SCHEMA = `
Your response MUST be a single, valid JSON object that adheres to the following TypeScript interface.
Do NOT add any conversational filler, markdown fences (like \`\`\`json\`), or other text outside of the JSON object itself.

interface OutlineNode {
  // Hierarchical Work Breakdown Structure ID. MUST be dot-separated.
  // Top-level nodes are "1.0", "2.0". Children of "1.1" are "1.1.1", "1.1.2", etc. The '.0' suffix is for parent topics.
  wbs: string;
  
  // The detailed content of the outline item. Must be substantive enough for reconstruction.
  content: string;
  
  // An array of source file names that contributed to this node. Be accurate.
  sourceFileNames: string[];
  
  // An array of nested child nodes.
  children: OutlineNode[];
}

interface Response {
  // A unique, 6-character, lowercase, alphanumeric identifier for this entire outline.
  outlineId: string;

  // The entire synthesized outline structure as an array of root nodes.
  outline: OutlineNode[];

  // Your concise rationale for the structure and content of this outline.
  versionRationale: string;

  // A brief, honest critique of the outline you just made. What are its remaining weaknesses?
  selfCritique: string;

  // Based on your self-critique, what is the best next step?
  suggestedNextStep: 'refine_further' | 'expand_section' | 'declare_convergence';
}`;


export const getOutlineGenerationPromptComponents = (
  fileManifest: string,
  isOutlineMode: boolean,
  loadedFiles?: LoadedFile[]
): { systemInstruction: string, coreUserInstructions: string } => {
  if (isOutlineMode) {
    const systemInstruction = `System Function: Act as a knowledge analyst.
Task: Process multiple source files and synthesize a hierarchical outline as a structured JSON object.

CRITICAL TASK REQUIREMENTS:
1.  **Outline ID (outlineId)**: Generate a unique 6-character, lowercase, alphanumeric string for the entire outline document.
2.  **Hierarchical Structure & WBS Numbering (wbs)**: The outline must be deeply hierarchical. Each node MUST have a 'wbs' (Work Breakdown Structure) number that reflects its exact position. Top-level nodes are "1.0", "2.0". Children of node "1.1" are "1.1.1", "1.1.2", etc. This numbering must strictly follow the JSON nesting.
3.  **Traceability (sourceFileNames)**: For each and every node, you MUST accurately populate the \`sourceFileNames\` array with the names of the source files that provided the information for that specific node.
4.  **Detailed Extraction, Not Vague Summarization**: Your primary goal is to extract the detailed substance. The outline must be granular enough that the original document's key arguments could be substantially reconstructed from it. For example, a point like "Definition of Ontological Closure" is INSUFFICIENT. A good point would be "Ontological Closure: Defined as a system where all internal relations and transformations can be described without reference to external elements." Each node should capture a specific argument, definition, finding, or piece of evidence.
5.  **JSON Output**: The output MUST be a single JSON object matching the provided schema. No markdown fences or other text.

OUTPUT FORMAT:
${JSON_OUTLINE_RESPONSE_SCHEMA}`;

    const coreUserInstructions = `Based on the complete content of ALL provided source files, generate a comprehensive, structured JSON outline.
The file manifest is: ${fileManifest.trim()}
The filenames available for the 'sourceFileNames' attribute are: ${loadedFiles?.map(f => `'${f.name}'`).join(', ')}.
Ensure every outline node correctly attributes its source material and contains sufficient detail for reconstruction.`;
    return { systemInstruction, coreUserInstructions };

  } else {
    // Original text-based outline generation
    const systemInstruction = `System Function: Analyze textual content from multiple information sources.
Task: Produce a structured outline for a synthesized document and identify key redundancies.

CRITICAL CONTEXT FROM PROVIDED INFORMATION: The complete data of all original information sources is provided. Base your analysis on this full data.

OUTPUT FORMAT:
Your response MUST strictly follow this format:
Outline:
<Your detailed outline here. Use markdown for structure, e.g., # Main Topic, ## Sub-topic, 1. Point a, 2. Point b. Aim for a comprehensive outline covering all key aspects of the provided information. The outline should be detailed enough to guide the synthesis of a full document but should NOT contain the full prose of the document itself. Focus on structure and key informational points for each section.>

Redundancies:
<List key areas of significant redundancy or versioning identified across sources. Be specific, e.g., "Paragraphs about 'Project X Results' appear in multiple sources with minor wording changes." or "Chapter 3 content from one source is nearly identical to another.">

Do NOT generate the full document content. Only the outline and a redundancy list.`;

    const coreUserInstructions = `Based on ALL provided information, generate a detailed hierarchical outline for a single, coherent, synthesized document that would integrate the content from all sources.
Additionally, list any significant redundancies, duplications, or versioning conflicts you identify across these sources that would need to be resolved in a final synthesized document.
${fileManifest && fileManifest.trim() ? `\nFor context, the input is summarized as: ${fileManifest.trim()}` : ''}
REMINDER: Provide ONLY the "Outline:" section and the "Redundancies:" section as per the System Instruction's specified format.
`;
    return { systemInstruction, coreUserInstructions };
  }
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
  isOutlineMode: boolean, // To select the correct JSON schema and instructions
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
  const isEnsembleIntegration = !!ensembleSubProducts && ensembleSubProducts.length > 0;

  if (devLogContextString && !devLogContextString.includes("No specific, highly relevant DevLog entries found") && !devLogContextString.includes("DevLog Contextualizer Inactive") && !devLogContextString.includes("No DevLog entries to analyze")) {
    systemInstructionParts.push(
      `CRITICAL AWARENESS FROM DEVELOPMENT LOG:\nThe following entries from the project's development log have been identified as highly relevant to your current task. Take them into account during your refinement process to avoid past issues, adhere to decisions, or understand key context.\n---\n${devLogContextString}\n---`
    );
  }

  if (isEnsembleIntegration && majorVersion <= 2) {
    systemInstructionParts.push(
      `CRITICAL CONTEXT - ENSEMBLE VARIATIONS: This is a refinement of a product synthesized via an ensemble method. Several variations of sub-products are provided below in the prompt for context. The task in these early refinement versions is to explicitly synthesize a new version by selecting and combining the best elements, phrasings, and structures from EACH of the provided variations. The goal is to create a new, superior version that represents the best of all of them, not just improve one.`
    );
  }
  
  if (isOutlineMode) {
      systemInstructionParts.push(
        `System Function: Act as a knowledge analyst.
Core Task: Iteratively refine the provided JSON outline structure based on the user instructions.
Prohibited Output: Meta-references to the content (e.g., "the product," "the document," "the file") are forbidden. Operate only on the substance of the outline itself.`
      );
  } else {
      systemInstructionParts.push(
        `Function: This is a text-processing system. Its function is to iteratively refine a given text based on a set of instructions.
Core Task: Modify the input text to produce an improved version.
Prohibited Output: Meta-references to the content (e.g., "the product," "the document," "the file") are forbidden. Operate only on the text's substance.`
      );
  }
    
    systemInstructionParts.push(
      `CRITICAL CONTEXT FROM PROVIDED INFORMATION: All source information for this task was provided in the initial API call. This full body of information is the definitive knowledge base for all subsequent refinements. Synthesize information from all provided sources, cross-referencing details as needed. The final product must reflect the combined knowledge and themes from this comprehensive information set.`
    );
    
    if (isJsonMode) {
        const isInitialSynthesis = isInitialProductEmptyAndFilesLoaded && majorVersion === 1;

        if (isOutlineMode) {
            systemInstructionParts.push(`GENERAL RULES & OUTPUT FORMAT (JSON OUTLINE MODE):
- **Output Structure**: ${JSON_OUTLINE_RESPONSE_SCHEMA}
- **WBS Numbering**: You MUST maintain the integrity of the 'wbs' numbering. When adding nodes, assign correct new 'wbs' numbers. When deleting, the remaining numbers should still form a valid hierarchy.
- **Traceability**: You MUST maintain and update the \`sourceFileNames\` for each node accurately.
- **Detailed Extraction, Not Vague Summarization**: Your primary goal is to extract the detailed substance. The outline must be granular enough that the original document's key arguments could be substantially reconstructed from it. Each node should capture a specific argument, definition, finding, or piece of evidence, not just a topic heading.
- **Substantial Improvement Required**: Each new version MUST represent a significant and substantive improvement in the outline's structure, clarity, or completeness.
- **CRITICAL FORMATTING RULE**: Your entire response MUST be the JSON object itself. Absolutely NO markdown fences (like \`\`\`json\`), conversational text, or other characters are allowed outside the JSON structure.`);
        } else if (isInitialSynthesis) {
             systemInstructionParts.push(`GENERAL RULES & OUTPUT FORMAT (JSON INITIAL SYNTHESIS MODE):
- **Output Structure**: ${JSON_INITIAL_SYNTHESIS_SCHEMA}
- **CRITICAL FORMATTING RULE**: Your entire response MUST be the JSON object itself. Absolutely NO markdown fences (like \`\`\`json\`), conversational text, or other characters are allowed outside the JSON structure.`);
        } else {
            // JSON Text refinement mode
            systemInstructionParts.push(
                `CONTEXT WINDOWING (JSON TEXT MODE): For large documents, you will be provided with a "Context Window". This includes a high-level 'DOCUMENT OVERVIEW' of all structural chunks, and the full text for chunks within the 'ACTIVE CONTEXT WINDOW'. Your task is to refine the content within this active window, maintaining coherence with the full document structure. Your primary output is the \`windowChunks\` array in the JSON response.
- This array MUST contain an object for EVERY chunk that was provided in the \`ACTIVE CONTEXT WINDOW\` of the prompt.
- For chunks you have refined, provide the new content, updated \`sourceFileNames\`, and a new \`changeRationale\`.
- For chunks you have not changed, you MUST return them with their original content and sourceFileNames, and a null \`changeRationale\`.
- Preserve the original order and chunkIds. Do not add or remove chunks from the window. The host application will merge these changes.`
            );
            systemInstructionParts.push(`GENERAL RULES & OUTPUT FORMAT (JSON TEXT MODE):
- **Output Structure**: ${JSON_TEXT_RESPONSE_SCHEMA}
- **CRITICAL FORMATTING RULE**: Your entire response MUST be the JSON object itself. Absolutely NO markdown fences (like \`\`\`json\`), conversational text, or other characters are allowed outside the JSON structure.
- **Coherence and Substantiation**: Each version MUST become more logically coherent and well-supported.
- **Substantial Improvement Required**: Each new version MUST represent a significant and substantive improvement over the last. Do not make trivial, stylistic-only changes (mere "wordsmithing").`);
        }
    } else { // Text-only mode (e.g., with Google Search)
        systemInstructionParts.push(
          `CONTEXT WINDOWING (TEXT MODE): For large documents, you may be provided with a "Context Window", showing an overview and an active window for focused editing. Even when focusing on the window, you MUST return the ENTIRE, FULLY RECONSTRUCTED document with your changes integrated. Do NOT return only the changed parts.`
        );
        systemInstructionParts.push(`GENERAL RULES & OUTPUT FORMAT (TEXT MODE):
- **Output Structure**: Your response must be ONLY the new, modified textual document.
- **Coherence and Substantiation**: Each version MUST become more logically coherent and well-supported.
- **Substantial Improvement Required**: Each new version MUST represent a significant and substantive improvement over the last.`);
    }
  
  if (isInitialProductEmptyAndFilesLoaded && majorVersion === 1 && !isEnsembleIntegration) {
      systemInstructionParts.push(
`CRITICAL INITIAL SYNTHESIS (Version 1 from Provided Information): The provided text/outline to refine is empty, and one or more information sources have been provided. The IMMEDIATE and PRIMARY task for this first version is NOT to simply list or concatenate content. The required process is:
1. Analyze ALL provided original source data.
2. Identify common themes, chapters, sections, and any versioning patterns.
3. AGGRESSIVELY de-duplicate and consolidate information, BUT prioritize capturing the full breadth and depth of unique content from the source information.
4. Produce a SINGLE, COHERENT, WELL-STRUCTURED initial document/outline that synthetically represents the core, essential information from ALL provided sources.
The output for this version MUST be the synthesized content.`
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
  
  if (isInitialProductEmptyAndFilesLoaded && majorVersion === 1 && isEnsembleIntegration) {
      coreUserInstructions += `Task: Ensemble Integration.\nBased ONLY on the 'ENSEMBLE SUB-PRODUCT VARIATIONS' provided in the prompt context, the SOLE objective is to synthesize a single, superior, coherent, and de-duplicated final ${isOutlineMode ? 'JSON outline' : 'document'} that represents the best aspects of ALL variations. Do not use any other context for this task.`;
  } else if (isInitialProductEmptyAndFilesLoaded && majorVersion === 1) {
     coreUserInstructions += `Task: Initial Document Synthesis from Provided Information.\nBased on the full content of all provided sources, the SOLE objective is to create a single, comprehensive, coherent, and de-duplicated initial ${isOutlineMode ? 'JSON outline' : 'document'}.`;
  } else if (isTargetedRefinementMode && targetedSelectionText && instructionsForTargetedSelection) {
      coreUserInstructions += `Task: Targeted Refinement.\nBased ON THE FULL 'DOCUMENT FOR REFINEMENT' for context, the SOLE objective is to rewrite ONLY the following specific text selection based on the provided instructions. The output must be the entire new document, with only the selected part changed.\n\n---TEXT SELECTION TO REFINE---\n${targetedSelectionText}\n-----------------------------\n\n---INSTRUCTIONS FOR THIS SELECTION---\n${instructionsForTargetedSelection}\n----------------------------------`;
  } else {
    if (isOutlineMode) {
        coreUserInstructions += `Task: Refine the provided "OUTLINE FOR REFINEMENT". Your goal is to make it more detailed, granular, and comprehensive. Expand on high-level points, break down complex ideas into more specific sub-nodes, and ensure that the key arguments and evidence from the source material are fully represented. Implement the most impactful improvements to produce the next version that is closer to a complete knowledge graph.`;
    } else {
        coreUserInstructions += `Task: Refine the provided "DOCUMENT FOR REFINEMENT". Analyze it and implement the most impactful improvements to produce the next version.`;
    }

    if (isJsonMode) {
        coreUserInstructions += ` Follow the JSON response schema.`;
    }
  }


  return { systemInstruction: systemInstructionParts.join('\n\n'), coreUserInstructions };
};

export const buildTextualPromptPart = (
    documentOrOutline: DocumentChunk[] | OutlineNode[] | null,
    focusIndex: number,
    loadedFiles: LoadedFile[],
    coreUserInstructions: string,
    currentVersion: Version,
    initialOutlineForIter1: OutlineGenerationResult | undefined,
    fileManifestForPrompt: string,
    isOutlineMode: boolean,
    isTargetedRefinementMode: boolean = false,
    ensembleSubProducts?: string[] | null
): string => {
    
    let contentForPrompt: string;
    let promptHeader: string;
    let fullProductForSizeCheck: string;

    if (isOutlineMode) {
        promptHeader = `\n---OUTLINE FOR REFINEMENT---`;
        const outline = documentOrOutline as OutlineNode[] | null;
        contentForPrompt = outline && outline.length > 0 ? JSON.stringify(outline, null, 2) : '(The outline is currently empty)';
        fullProductForSizeCheck = contentForPrompt;
    } else {
        const documentChunks = documentOrOutline as DocumentChunk[] | null;
        fullProductForSizeCheck = reconstructFromChunks(documentChunks);
        promptHeader = `\n---DOCUMENT FOR REFINEMENT---`;
        // Document context windowing logic
        if (documentChunks && documentChunks.length > 0) {
            const documentOverview = `---DOCUMENT OVERVIEW (Total Chunks: ${documentChunks.length})---\n` +
                documentChunks.map((chunk, index) => {
                    const isActive = index >= focusIndex && index < focusIndex + CONTEXT_WINDOW_SIZE;
                    return `${isActive ? '>>' : '  '} [${chunk.id.substring(0,8)}] ${chunk.type}: ${chunk.content.substring(0, 80).replace(/\n/g, ' ')}...`;
                }).join('\n');

            const activeWindowChunks = documentChunks.slice(focusIndex, focusIndex + CONTEXT_WINDOW_SIZE);

            const activeWindowContent = `---ACTIVE CONTEXT WINDOW (Focus Index: ${focusIndex}, Chunks ${focusIndex + 1} to ${focusIndex + activeWindowChunks.length})---\n` +
                activeWindowChunks.map(chunk => `// --- Chunk ID: ${chunk.id} ---\n${chunk.content}`).join('\n\n');
            
            contentForPrompt = `${documentOverview}\n\n${activeWindowContent}`;
        } else {
            contentForPrompt = "(The document is currently empty)";
        }
    }
    
    let fileManifestContentForPrompt = "";
    const isEnsembleRun = !!ensembleSubProducts && ensembleSubProducts.length > 0;
    if (!isEnsembleRun && fileManifestForPrompt && fileManifestForPrompt.trim()) {
        fileManifestContentForPrompt = `${fileManifestForPrompt.trim()}\n`;
    }

    const promptParts: string[] = [];

    if (fileManifestContentForPrompt.trim()) {
        promptParts.push(fileManifestContentForPrompt);
    }

    if (initialOutlineForIter1 && initialOutlineForIter1.outline && currentVersion.major === 1 && !isOutlineMode) {
        promptParts.push(`---INITIAL OUTLINE (for context)---\n${initialOutlineForIter1.outline}`);
    }

    if (isEnsembleRun && currentVersion.major <= 2) {
        promptParts.push(`---ENSEMBLE SUB-PRODUCT VARIATIONS (for synthesis context)---`);
        
        const MAX_ENSEMBLE_CHARS = 150000; // A large but safe limit for the ensemble context
        let currentEnsembleChars = 0;
        let truncated = false;
        
        for (let i = 0; i < ensembleSubProducts!.length; i++) {
            const p = ensembleSubProducts![i];
            const variationHeader = `---Variation ${i + 1}---\n`;
            
            if (currentEnsembleChars + variationHeader.length + p.length > MAX_ENSEMBLE_CHARS) {
                const remainingChars = MAX_ENSEMBLE_CHARS - currentEnsembleChars - variationHeader.length - 20; // 20 for truncation message
                if (remainingChars > 0) {
                    promptParts.push(`${variationHeader}${p.substring(0, remainingChars)}... [TRUNCATED]`);
                }
                truncated = true;
                break; // Stop adding more variations
            }
            
            promptParts.push(`${variationHeader}${p}`);
            currentEnsembleChars += variationHeader.length + p.length;
        }

        if (truncated) {
            promptParts.push(`---[NOTE: Further variations were omitted to fit context limit.]---`);
        }

        promptParts.push(`---END ENSEMBLE SUB-PRODUCTS---`);
    }

    promptParts.push(coreUserInstructions);

    // This is the special case for the very first step AFTER ensemble sub-runs.
    // The task is to synthesize from the variations, not to refine an existing (and empty) document.
    // By excluding the "document for refinement" section, we give the AI a clear, unambiguous task.
    const isEnsembleIntegrationStep = !!ensembleSubProducts && ensembleSubProducts.length > 0 && currentVersion.major === 1 && currentVersion.minor === 0;

    if (!isEnsembleIntegrationStep) {
        const productContentForPrompt = fullProductForSizeCheck.length > MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT && !isOutlineMode
        ? `${fullProductForSizeCheck.substring(0, MAX_PRODUCT_CONTEXT_CHARS_IN_PROMPT)}... [TRUNCATED]`
        : contentForPrompt;

        promptParts.push(promptHeader);
        promptParts.push(productContentForPrompt);
    }
    
    return promptParts.join('\n\n');
};
