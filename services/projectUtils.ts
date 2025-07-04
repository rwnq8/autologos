

import type { LoadedFile } from '../types/index.ts';

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "he", "she", "it", "they", "them", "their", "theirs", "his", "hers", "its",
  "have", "has", "had", "do", "does", "did", "will", "would", "should", "can", "could", "may", "might", "must", "and", "but", "or", "nor", "for", "so", "yet",
  "in", "on", "at", "by", "from", "to", "with", "about", "above", "after", "again", "against", "all", "am", "as", "such", "than", "that", "this", "these", "those",
  "through", "under", "until", "up", "very", "what", "when", "where", "which", "while", "who", "whom", "why", "how", "if", "not", "no", "of", "out", "then", "once",
  "com", "org", "net", "www", "http", "https", "file", "index", "readme", "doc", "docs", "document", "page", "section", "chapter", "article", "example",
  "also", "however", "therefore", "thus", "hence", "furthermore", "moreover", "indeed", "just", "really", "quite", "rather", "some", "any", "other", "another",
  "each", "every", "many", "much", "few", "less", "more", "most", "only", "own", "same", "several", "too", "use", "uses", "using", "used", "get", "gets", "got",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "abstract", "introduction", "conclusion", "references", "appendix", "figure", "table",
  "e.g.", "i.e.", "etc", "vs", "et", "al", "fig", "inc", "ltd", "corp", "co"
]);

const cleanTextForNaming = (text: string): string => {
  if (!text) return "";
  let cleaned = text
    .replace(/[\`*_[\]()#+\-.!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = cleaned.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
  return cleaned;
};

const isMeaningfulName = (name: string, minLength = 3, maxWords = 7): boolean => {
    if (!name || name.trim().length < minLength) return false;
    const words = name.split(/\s+/);
    if (words.length > maxWords) return false;
    const significantWords = words.filter(w => !STOP_WORDS.has(w.toLowerCase()) && w.length > 2);
    return significantWords.length > 0;
};

export const extractTitleOrThemeFromContent = (content: string, numKeywordsForFallback = 3, minWordLengthForFallback = 4): string | null => {
  if (!content || !content.trim()) return null;

  const lines = content.split('\n');
  const potentialTitles: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const match = trimmedLine.match(/^#{1,4}\s+(.+)/); // Markdown headings
    if (match && match[1]) {
      const cleanedTitle = cleanTextForNaming(match[1]);
      if (isMeaningfulName(cleanedTitle)) {
        potentialTitles.push(cleanedTitle);
      }
    }
  }
  if (potentialTitles.length > 0) {
    potentialTitles.sort((a,b) => a.length - b.length); // Prefer shorter headings
    const bestTitle = potentialTitles[0];
    return bestTitle.length > 70 ? bestTitle.substring(0, 70).trim() + "..." : bestTitle;
  }

  // Try to find Title Case lines
  for (const line of lines) {
    const cleanedLine = cleanTextForNaming(line);
    const words = cleanedLine.split(/\s+/);
    if (words.length > 1 && words.length <= 8) { // Reasonable length for a title-like phrase
      const titleCaseWords = words.filter(w => w.length > 0 && w[0] === w[0].toUpperCase());
      if (titleCaseWords.length / words.length >= 0.7) { // Majority words are title-cased
          if (isMeaningfulName(cleanedLine)) potentialTitles.push(cleanedLine);
      }
    }
  }
   if (potentialTitles.length > 0) {
    potentialTitles.sort((a,b) => a.length - b.length);
    const bestTitle = potentialTitles[0];
    return bestTitle.length > 70 ? bestTitle.substring(0, 70).trim() + "..." : bestTitle;
  }

  // Fallback to keyword extraction from the whole manifest/content
  const textToAnalyzeForKeywords = content;
  const words = textToAnalyzeForKeywords
    .toLowerCase()
    .replace(/[^\w\s-]/gi, '') // Remove punctuation except hyphens
    .replace(/\d+/g, '')       // Remove numbers
    .split(/\s+/)
    .map(word => word.replace(/^-+|-+$/g, '')) // Remove leading/trailing hyphens
    .filter(word => word.length >= minWordLengthForFallback && !STOP_WORDS.has(word) && isNaN(Number(word)));

  if (words.length === 0) return null;

  const frequencyMap: { [key: string]: number } = {};
  words.forEach(word => {
    frequencyMap[word] = (frequencyMap[word] || 0) + 1;
  });

  const sortedKeywords = Object.entries(frequencyMap)
    .sort(([, aCount], [, bCount]) => bCount - aCount) // Sort by frequency
    .slice(0, numKeywordsForFallback)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1)); // Capitalize

  if (sortedKeywords.length === 0) return null;

  let potentialName = sortedKeywords.join(" ");
  if (potentialName.length > 70) {
      potentialName = potentialName.substring(0, 70).trim();
      // Try to break at a word boundary if truncated
      const lastSpace = potentialName.lastIndexOf(' ');
      if (lastSpace > 0 && potentialName.length - lastSpace < 15) { // Avoid very short last word
          potentialName = potentialName.substring(0, lastSpace);
      }
      potentialName += "...";
  }
  return potentialName.trim() || null;
};


export const inferProjectNameFromInput = (initialPromptText: string, currentLoadedFiles: LoadedFile[]): string | null => {
    // Case 1: Files are loaded. Their content and names are the primary source for the project name.
    if (currentLoadedFiles.length > 0) {
        // If there's only one file, derive the name from its filename first, then its content.
        if (currentLoadedFiles.length === 1) {
            const file = currentLoadedFiles[0];
            // Clean up the filename to make it a suitable project name.
            let inferredFromName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
            // Apply title case for better readability.
            inferredFromName = inferredFromName.split(' ').map(word => word.toUpperCase() === word || word.toLowerCase() === word ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            
            if (isMeaningfulName(inferredFromName)) {
                return inferredFromName.length > 70 ? inferredFromName.substring(0, 70).trim() : inferredFromName;
            }
            
            // If the filename isn't meaningful, try to extract a title from the file's content.
            const nameFromContent = extractTitleOrThemeFromContent(file.content);
            if (nameFromContent) {
                return nameFromContent;
            }
            
            // As a fallback, use the cleaned filename even if it wasn't deemed "meaningful".
            return inferredFromName || null;
        }

        // If multiple files are loaded, analyzing their combined content is the best approach.
        const combinedContent = currentLoadedFiles.map(f => `--- From file: ${f.name} ---\n${f.content}`).join('\n\n');
        const nameFromCombinedContent = extractTitleOrThemeFromContent(combinedContent);
        if (nameFromCombinedContent) {
            return nameFromCombinedContent;
        }

        // Fallback for multiple files: find a common prefix in their filenames.
        const fileNames = currentLoadedFiles.map(f => f.name.replace(/\.[^/.]+$/, ""));
        if (fileNames.length > 0) {
            let commonPrefix = fileNames[0];
            for (let i = 1; i < fileNames.length; i++) {
                while (fileNames[i].indexOf(commonPrefix) !== 0) {
                    commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
                    if (commonPrefix === "") break;
                }
            }
            commonPrefix = commonPrefix.replace(/[_-]$/, "").trim(); // Clean trailing separators.
            if (isMeaningfulName(commonPrefix, 4)) { // Require a slightly longer common prefix to be meaningful.
                return commonPrefix;
            }
        }
        
        // Final fallback for multiple files: use the first filename that is meaningful on its own.
        const firstMeaningfulFileName = currentLoadedFiles
            .map(f => f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim())
            .find(name => isMeaningfulName(name));
        if (firstMeaningfulFileName) {
            return firstMeaningfulFileName;
        }
    }

    // Case 2: No files are loaded. Use the initial prompt text provided by the user.
    if (currentLoadedFiles.length === 0 && initialPromptText.trim()) {
        const nameFromPrompt = extractTitleOrThemeFromContent(initialPromptText, 5);
        if (nameFromPrompt) {
            return nameFromPrompt;
        }
        
        // Fallback for prompts: use the first non-empty line.
        const firstNonEmptyLine = initialPromptText.trim().split('\n').find(line => line.trim() !== "");
        if (firstNonEmptyLine) {
            let inferred = cleanTextForNaming(firstNonEmptyLine).split(/\s+/).slice(0, 7).join(" "); // Take first few words.
            if (isMeaningfulName(inferred)) {
                 if (inferred.length > 70) {
                     inferred = inferred.substring(0, 70).trim() + "...";
                 }
                return inferred.charAt(0).toUpperCase() + inferred.slice(1); // Capitalize first letter.
            }
        }
    }
    
    // If no suitable name can be inferred.
    return null;
  };