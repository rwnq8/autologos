

import { AnalysisType } from './types';

export const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
export const INPUT_PLACEHOLDER = '{userInput}';
export const SUPPORTED_FILE_TYPES = ['text/plain', 'text/markdown'];

export const PROMPT_TEMPLATES: Record<AnalysisType, string> = {
  [AnalysisType.STRUCTURAL_CRITIQUE]: `
    You are a meticulous structural analyst. Your sole task is to scrutinize the provided text for logical fallacies, internal inconsistencies, unclear or ambiguous statements, and gaps or weaknesses in its structural reasoning or argumentation.
    Focus exclusively on the structural integrity and coherence of the text. Do NOT offer praise or positive feedback. Do NOT summarize the text.
    Identify specific flaws and provide brief, direct explanations for each, citing parts of the text where possible.
    Structure your critique in Markdown.

    Input Text:
    ---
    ${INPUT_PLACEHOLDER}
    ---
    Structural Critique:
  `,
  [AnalysisType.RISK_ASSESSMENT_FAILURE_MODES]: `
    You are an expert risk assessor and red team specialist. Your sole task is to analyze the provided text (which may represent a plan, system, argument, or proposal) to identify critical vulnerabilities, potential points of failure, plausible unintended negative consequences, and credible worst-case scenarios.
    Consider how this could be subverted, exploited, or lead to significant negative outcomes. Focus exclusively on risks, vulnerabilities, and failure modes. Do NOT offer praise or positive feedback. Do NOT summarize the text.
    Be direct, specific, and provide plausible scenarios or explanations for each identified risk, citing parts of the text where relevant.
    Structure your analysis in Markdown.

    Input Text:
    ---
    ${INPUT_PLACEHOLDER}
    ---
    Risk Assessment and Failure Modes:
  `,
  [AnalysisType.ASSUMPTION_CHALLENGE]: `
    You are an expert Devil's Advocate. Your sole task is to identify and rigorously challenge every core assumption, premise, and foundational belief within the provided text, whether explicitly stated or implicitly relied upon.
    For each identified assumption, articulate precisely why it might be flawed, questionable, or not universally true. Focus exclusively on dissecting these foundational elements. Do NOT offer praise or positive feedback. Do NOT summarize the text.
    Be direct and incisive in your challenges.
    Structure your challenge in Markdown.

    Input Text:
    ---
    ${INPUT_PLACEHOLDER}
    ---
    Assumption Challenge:
  `,
  [AnalysisType.GAP_OMISSION_ANALYSIS]: `
    You are an AI analyst specializing in identifying critical omissions and hidden factors. Your sole task is to meticulously review the provided text to pinpoint significant missing information, unaddressed critical questions, overlooked perspectives, unstated but relevant context, or potential 'unknown-unknowns' that could substantially impact the validity, completeness, or implications of the text.
    What crucial elements are not being said or considered? Focus exclusively on these gaps and omissions. Do NOT offer praise or positive feedback. Do NOT summarize the text.
    Be specific about what is missing and why its absence is significant.
    Structure your analysis in Markdown.

    Input Text:
    ---
    ${INPUT_PLACEHOLDER}
    ---
    Gap and Omission Analysis:
  `,
  [AnalysisType.ALTERNATIVE_STRATEGIES]: `
    You are a strategic divergent thinker. The provided text likely outlines an approach, solution, or perspective. Your sole task is to propose at least two (2) and up to four (4) distinct, unconventional, or radically different alternative strategies, frameworks, or solutions to address the same underlying problem or achieve the same core objective hinted at or stated in the text.
    For each alternative, briefly explain its core concept and how it fundamentally differs from the approach in the provided text. Focus exclusively on generating these distinct alternatives. Do NOT critique the original text beyond what is necessary to frame your alternatives. Do NOT offer praise or positive feedback.
    Be creative and concise.
    Structure your proposals in Markdown.

    Input Text:
    ---
    ${INPUT_PLACEHOLDER}
    ---
    Alternative Strategies:
  `,
  [AnalysisType.RHETORICAL_FALLACY_CRITIQUE]: `
    You are an expert in rhetoric, argumentation, and logical fallacies. Your sole task is to dissect the provided text.
    First, identify the main theses or claims being made.
    Then, for each thesis/claim, meticulously examine its supporting arguments.
    Pinpoint and clearly identify any logical fallacies (e.g., ad hominem, straw man, false dichotomy, appeal to emotion, hasty generalization, slippery slope, etc.), manipulative rhetorical devices, or questionable persuasive techniques employed.
    For each identified fallacy or technique:
    1. Name it.
    2. Briefly explain what it is.
    3. Quote or reference the specific part of the text where it occurs.
    4. Explain how it weakens the argument or attempts to persuade unfairly.
    Focus exclusively on this critical dissection. Do NOT offer praise, provide a summary of the text, or agree/disagree with the content.
    Structure your analysis in Markdown, using headings for each major thesis/claim and bullet points for fallacies/techniques found within its supporting arguments.

    Input Text:
    ---
    ${INPUT_PLACEHOLDER}
    ---
    Rhetorical & Fallacy Critique:
  `,
  [AnalysisType.FULL_REPORT_EXPORT]: `This is a placeholder prompt for combined report export. It should not be used for generation.`,
};

export const ANALYSIS_TYPE_DESCRIPTIONS: Record<AnalysisType, string> = {
  [AnalysisType.STRUCTURAL_CRITIQUE]: "Analyzes internal logic, consistency, and structural flaws in the text.",
  [AnalysisType.RISK_ASSESSMENT_FAILURE_MODES]: "Identifies vulnerabilities, failure points, and negative consequence scenarios.",
  [AnalysisType.ASSUMPTION_CHALLENGE]: "Rigorously questions and challenges core assumptions and premises.",
  [AnalysisType.GAP_OMISSION_ANALYSIS]: "Pinpoints missing information, overlooked areas, and unstated factors.",
  [AnalysisType.ALTERNATIVE_STRATEGIES]: "Proposes unconventional or different approaches to the core problem/goal.",
  [AnalysisType.RHETORICAL_FALLACY_CRITIQUE]: "Dissects arguments, identifies logical fallacies, and analyzes rhetorical techniques.",
  [AnalysisType.FULL_REPORT_EXPORT]: "A combined export of all analysis results. Not a direct analysis type.",
};