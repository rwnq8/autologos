
import { GoogleGenAI } from "@google/genai";
import type { DevLogEntry, SelectableModelName } from '../types';

const API_KEY: string | undefined = (() => {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0) {
      return process.env.API_KEY;
    }
    return undefined;
  } catch {
    return undefined;
  }
})();

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Error initializing GoogleGenAI for DevLogContextualizerService:", error);
    ai = null;
  }
} else {
  console.warn("API_KEY not found for DevLogContextualizerService. Contextualization will be disabled.");
}

const CONTEXTUALIZER_MODEL_NAME: SelectableModelName = 'gemini-2.5-flash-preview-04-17';

const formatDevLogForPrompt = (devLog: DevLogEntry[]): string => {
  if (!devLog || devLog.length === 0) {
    return "No development log entries available.";
  }
  return devLog.map(entry => 
    `Entry ID: ${entry.id.substring(0,8)} (Type: ${entry.type}, Status: ${entry.status}, Created: ${new Date(entry.timestamp).toLocaleDateString()})\nSummary: ${entry.summary}\nDetails: ${entry.details || 'N/A'}\nResolution: ${entry.resolution || 'N/A'}\nTags: ${(entry.tags || []).join(', ') || 'None'}\nRelated Iteration: ${entry.relatedIteration ?? 'N/A'}`
  ).join("\n---\n");
};

const devLogContextualizerSystemPrompt = `You are an AI assistant acting as a pre-processor for a primary AI developer.
Your task is to analyze a user's current request for code changes (or an AI's internal refinement task) and a development log.
Identify up to 3-4 entries from the development log that are MOST RELEVANT to the current request/task.
Relevance means the log entry might help the primary AI developer:
- Avoid repeating a past mistake described in an 'issue' or 'fix' entry.
- Recall a key 'decision' that impacts the current request (e.g., a chosen architectural pattern, a decision about handling a specific edge case).
- Incorporate or be aware of a related 'feature' request.
- Understand context from a relevant 'note', especially if that note describes previous quality issues (like truncation, unhelpful tangents, problematic AI behaviors) that might be pertinent to the current refinement task.

Focus on direct relevance. If an issue was 'resolved' or 'closed', it's relevant if the current request touches the same area, to ensure the fix/decision is upheld or to understand the history.
Prioritize entries that offer actionable insights or warnings for the current task.

OUTPUT FORMAT:
Your response MUST strictly be ONLY one of the following:
1. If relevant entries are found:
Relevant DevLog Context (for primary AI awareness):
- Entry [ID (first 8 chars)]: [Summary of entry] - (Why it's relevant for the current task in a few words)
- Entry [ID (first 8 chars)]: [Summary of entry] - (Why it's relevant for the current task in a few words)

2. If NO specific, highly relevant entries are found:
No specific, highly relevant DevLog entries found for the current task.

Do NOT be conversational. Do NOT explain your reasoning beyond the brief "why it's relevant" parenthetical note for each identified entry.
Do NOT list more than 4 entries. Prioritize critical issues/fixes and key decisions or notes about past problematic AI behavior relevant to current refinement.
`;

export const getRelevantDevLogContext = async (
  devLog: DevLogEntry[],
  currentUserPrompt: string
): Promise<string> => {
  if (!ai || !API_KEY) {
    return "DevLog Contextualizer Inactive (No API Key).";
  }
  if (!devLog || devLog.length === 0) {
    return "No DevLog entries to analyze.";
  }

  const formattedDevLog = formatDevLogForPrompt(devLog);
  const maxDevLogChars = 20000;
  const truncatedDevLog = formattedDevLog.length > maxDevLogChars ?
    `${formattedDevLog.substring(0, maxDevLogChars)}...\n[Development Log Truncated]` :
    formattedDevLog;

  const promptToContextualizer = `
User's Current Request to Primary AI Developer (or AI's current internal task):
---
${currentUserPrompt.substring(0, 2000)} 
---
(Note: Above is the user's raw request or the AI's current internal task. Analyze it against the DevLog below.)

Development Log:
---
${truncatedDevLog}
---

Based on the system prompt, identify relevant DevLog entries for the current request/task.
  `;

  try {
    const result = await ai.models.generateContent({
      model: CONTEXTUALIZER_MODEL_NAME,
      contents: promptToContextualizer,
      config: {
        systemInstruction: devLogContextualizerSystemPrompt,
      }
    });

    return result.text.trim();

  } catch (error: any) {
    console.error("DevLogContextualizerService: Error calling Gemini API:", error);
    return "Error retrieving contextual DevLog information.";
  }
};
