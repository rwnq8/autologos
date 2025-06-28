// services/toolDefinitions.ts
import { Type, type FunctionDeclaration } from "@google/genai";

/**
 * Defines the schema for the `url_browse` tool that can be provided to the Gemini model.
 * This allows the model to request the content of a specific URL.
 */
export const urlBrowseTool: FunctionDeclaration = {
  name: "url_browse",
  description: "Fetches the textual content of a given public URL. Use this to get information from specific web pages when a URL is provided or referenced in the context. Do not use for general searches; use Google Search for that.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full, valid URL to browse (including http:// or https://).",
      },
    },
    required: ["url"],
  },
};
