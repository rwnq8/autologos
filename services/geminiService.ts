import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_NAME } from '../constants';

// API key MUST be handled by the environment. The application code must not manage it.
// process.env.API_KEY is assumed to be available in the execution context.
const apiKey = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
let apiKeyInitializationError: string | null = null;

if (!apiKey) {
  apiKeyInitializationError = "API_KEY environment variable not set. Gemini API calls will fail.";
  console.error(apiKeyInitializationError);
} else {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (e) {
    apiKeyInitializationError = `Failed to initialize GoogleGenAI client: ${e instanceof Error ? e.message : String(e)}`;
    console.error(apiKeyInitializationError);
    ai = null; // Ensure ai is null if initialization fails
  }
}

export async function runAnalysisStream(
  prompt: string,
  onChunk: (textChunk: string) => void,
  onError: (errorMsg: string) => void, // Changed to pass string message for consistency
  onComplete: () => void
): Promise<void> {
  if (apiKeyInitializationError || !ai) {
    onError(apiKeyInitializationError || "Gemini API client not initialized.");
    onComplete();
    return;
  }

  try {
    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // As per requirements: "Thinking config should default to enabled (omit thinkingConfig or set thinkingBudget > 0) for higher quality."
      // We omit thinkingConfig here, which means it defaults to enabled.
    });

    for await (const chunk of stream) {
      // Check if chunk and its text property exist
      const text = chunk.text;
      if (typeof text === 'string') {
        onChunk(text);
      }
    }
    onComplete();
  } catch (error) {
    console.error('Error calling Gemini API (runAnalysisStream):', error);
    let errorMessage = 'An unknown error occurred while streaming analysis.';
    if (error instanceof Error) {
      errorMessage = `Gemini API Error: ${error.message}`;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = `Gemini API Error: ${String((error as {message: string}).message)}`;
    }
    
    // Check for common API key related errors (heuristic)
    if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("permission denied")) {
        errorMessage = "Gemini API Key is invalid or has insufficient permissions. Please check your API key configuration.";
    }

    onError(errorMessage);
    onComplete(); // Ensure completion is called on error
  }
}
