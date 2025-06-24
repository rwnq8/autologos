

// Basic word count based on splitting by space.
export const countWords = (text: string): number => {
  if (!text || !text.trim()) {
    return 0;
  }
  return text.trim().split(/\s+/).length;
};

// Basic sentence count based on common delimiters.
const countSentences = (text: string): number => {
  if (!text || !text.trim()) {
    return 0;
  }
  // Matches periods, question marks, or exclamation points, possibly followed by whitespace,
  // but not if they are part of a decimal number or abbreviation (e.g., Mr. Smith).
  const sentenceEnders = text.match(/[^.!?\s][.!?](?!\d)/g);
  return sentenceEnders ? sentenceEnders.length : (text.trim() ? 1 : 0); // Ensure at least 1 sentence if text exists
};

// Heuristic for counting syllables in a single word.
const countSyllablesInWord = (word: string): number => {
  if (!word) return 0;
  word = word.toLowerCase();

  // Handle some common short words.
  if (word.length <= 3) return 1;

  // Remove common suffixes that often don't add a syllable or are part of one.
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  
  // Remove y at the beginning if it makes a consonant sound (simple heuristic).
  word = word.replace(/^y/, '');

  // Count vowel groups (sequences of one or more vowels).
  const vowelGroups = word.match(/[aeiouy]{1,2}/g); // Match one or two vowels together.
  
  let syllableCount = vowelGroups ? vowelGroups.length : 0;

  // Specific case for "le" endings if preceded by a consonant (e.g., "able", "table").
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word.charAt(word.length - 3))) {
    // Check if the 'e' in 'le' was already counted as part of a vowel group.
    // This is tricky; the regex for vowelGroups might handle it.
    // If the 'e' wasn't part of a previous group and "l" is a consonant, it might form a syllable.
    // If word is like 'circle' -> 'circl', vowel group is 'i', need to add one for 'cl'.
    // This heuristic is imperfect. Simpler vowel group count is more stable.
  }

  return Math.max(1, syllableCount); // Ensure every word has at least 1 syllable.
};

// Count total syllables in a text by summing syllables of each word.
const countSyllables = (text: string): number => {
  if (!text || !text.trim()) {
    return 0;
  }
  const words = text.trim().replace(/[^\w\s'-]/g, '').split(/\s+/); // Clean and split
  return words.reduce((total, word) => total + countSyllablesInWord(word), 0);
};

/**
 * Calculates the Flesch Reading Ease score for a given text.
 * Score indicates readability: higher scores mean easier to read.
 * 90-100: Very Easy (5th grader)
 * 60-70: Plain English (8th-9th grader)
 * 0-30: Very Confusing (college graduate)
 * Formula: 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
 * @param text The input text.
 * @returns The Flesch Reading Ease score, or undefined if text is too short or stats are zero.
 */
export const calculateFleschReadingEase = (text: string | null | undefined): number | undefined => {
  if (!text || !text.trim()) {
    return undefined;
  }

  const words = countWords(text);
  const sentences = countSentences(text);
  const syllables = countSyllables(text);

  if (words === 0 || sentences === 0 || syllables === 0) {
    return undefined; // Not enough data for a meaningful score
  }
  
  // Prevent division by zero if somehow sentences or words are zero despite text existing.
  const wordsPerSentence = words / sentences;
  const syllablesPerWord = syllables / words;

  const score = 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord);
  
  // Score can range, but typically presented as 0-100.
  // We'll return the raw score as it can be negative or above 100.
  return parseFloat(score.toFixed(2)); 
};

// Basic list of English stop words for Jaccard similarity
const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'i', 'you', 'your', 'me', 'my', 'mine', 'they', 'them', 'their', 
    'we', 'us', 'our', 'ours', 'she', 'her', 'hers', 'him', 'his', 'this', 'these',
    'those', 'am', 'been', 'being', 'have', 'had', 'do', 'does', 'did', 'but',
    'if', 'or', 'because', 'while', 'through', 'nor', 'not', 'so', 'just', 'can',
    'could', 'should', 'would', 'may', 'might', 'must', 'about', 'above', 'after',
    'again', 'against', 'all', 'any', 'both', 'each', 'few', 'further', 'here',
    'how', 'into', 'more', 'most', 'no', 'once', 'only', 'other', 'out', 'over',
    'own', 'same', 'some', 'such', 'than', 'then', 'too', 'under', 'until', 'up',
    'very', 'what', 'when', 'where', 'which', 'who', 'why', 's', 't'
]);

/**
 * Tokenizes text, removes stop words, and converts to lowercase.
 * @param text The input text.
 * @returns A Set of unique, processed tokens.
 */
const getProcessedTokens = (text: string): Set<string> => {
    if (!text || !text.trim()) {
        return new Set();
    }
    const tokens = text.toLowerCase()
        .replace(/[^\w\s'-]/g, '') // Remove punctuation except apostrophes and hyphens within words
        .split(/\s+/) // Split by whitespace
        .filter(token => token.length > 0 && !STOP_WORDS.has(token));
    return new Set(tokens);
};

/**
 * Calculates the Jaccard similarity between two texts.
 * Jaccard Index = |Intersection(A, B)| / |Union(A, B)|
 * Score is between 0 (no similarity) and 1 (identical sets of words).
 * @param textA The first text.
 * @param textB The second text.
 * @returns The Jaccard similarity score, or 0 if either text is empty.
 */
export const calculateJaccardSimilarity = (textA: string | null | undefined, textB: string | null | undefined): number => {
    if (!textA || !textB || !textA.trim() || !textB.trim()) {
        return 0; // Or 1 if both are empty/null and considered "similar" in that sense
    }

    const tokensA = getProcessedTokens(textA);
    const tokensB = getProcessedTokens(textB);

    if (tokensA.size === 0 && tokensB.size === 0) {
        return 1; // Both effectively empty after processing, so identical in terms of content words
    }
    if (tokensA.size === 0 || tokensB.size === 0) {
        return 0; // One is empty, the other is not
    }
    
    const intersection = new Set([...tokensA].filter(token => tokensB.has(token)));
    const union = new Set([...tokensA, ...tokensB]);

    if (union.size === 0) {
        return 1; // Should not happen if tokensA/B sizes were > 0, but defensive.
    }

    return intersection.size / union.size;
};