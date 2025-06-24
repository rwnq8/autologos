

import type { LoadedFile } from '../types.ts';

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

const extractTitleOrThemeFromContent = (content: string, numKeywordsForFallback = 3, minWordLengthForFallback = 4): string | null => {
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


export const inferProjectNameFromInput = (fileManifest: string, currentLoadedFiles: LoadedFile[]): string | null => {
    if (currentLoadedFiles.length === 1) {
        const fileName = currentLoadedFiles[0].name;
        // Basic cleaning: remove extension, replace underscores/hyphens with spaces, title case
        let inferredFromName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
        // Simple title case (doesn't handle all edge cases but good enough for a suggestion)
        inferredFromName = inferredFromName.split(' ').map(word => word.toUpperCase() === word || word.toLowerCase() === word ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        if (isMeaningfulName(inferredFromName)) return inferredFromName.length > 70 ? inferredFromName.substring(0, 70).trim() + "..." : inferredFromName;
    }
    // If multiple files, or single file name not meaningful, try to extract from manifest content
    if (currentLoadedFiles.length > 0) { // Or always try manifest if available
      const contentName = extractTitleOrThemeFromContent(fileManifest);
      if (contentName && isMeaningfulName(contentName, 5)) return contentName; // Higher minLength for content-derived names
      // Fallback to first file name if content analysis fails for multiple files
      const firstFileName = currentLoadedFiles[0].name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
      if (isMeaningfulName(firstFileName)) return firstFileName.length > 70 ? firstFileName.substring(0, 70).trim() + "..." : firstFileName;
    }
    // If no files but there is initialPrompt text (e.g., typed in)
    if (currentLoadedFiles.length === 0 && fileManifest.trim()) {
        const lines = fileManifest.trim().split('\n');
        const firstNonEmptyLine = lines.find(line => line.trim() !== "");
        if (firstNonEmptyLine) {
            let inferred = cleanTextForNaming(firstNonEmptyLine).split(/\s+/).slice(0, 7).join(" "); // Take first few words
            if (isMeaningfulName(inferred)) {
                 if (inferred.length > 70) inferred = inferred.substring(0, 70).trim() + "...";
                return inferred.charAt(0).toUpperCase() + inferred.slice(1); // Capitalize first letter
            }
        }
    }
    return null;
  };
