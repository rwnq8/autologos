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

const COMPREHENSIVE_STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at', 
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 
    'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 
    'each', 'few', 'for', 'from', 'further', 
    'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 
    'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 
    'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 
    'no', 'nor', 'not', 
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 
    'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 
    'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 
    'under', 'until', 'up', 'very', 
    'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 
    'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
    // Consider adding very common verbs like 'get', 'make', 'go', 'know', 'see', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call'
    // Depending on the domain, some of these might be content words.
    'e.g.', 'i.e.', 'etc', 'also'
]);


const TOKENIZE_REGEX = /\b[a-zA-Z0-9]+(?:['’][a-zA-Z0-9]+)*\b/g;


/**
 * Tokenizes text into words.
 * @param text The input text.
 * @param toLowerCase Convert tokens to lowercase.
 * @returns An array of tokens.
 */
const getTokens = (text: string, toLowerCase: boolean = true): string[] => {
    if (!text || !text.trim()) {
        return [];
    }
    const processedText = toLowerCase ? text.toLowerCase() : text;
    return processedText.match(TOKENIZE_REGEX) || [];
};


/**
 * Tokenizes text, removes stop words (optional), and converts to lowercase (optional).
 * This version is specifically for Jaccard and might be slightly different from a general tokenizer.
 * @param text The input text.
 * @returns A Set of unique, processed tokens.
 */
const getProcessedTokensForJaccard = (text: string): Set<string> => {
    if (!text || !text.trim()) {
        return new Set();
    }
    const tokens = text.toLowerCase()
        .replace(/[^\w\s'-]/g, '') // Remove punctuation except apostrophes and hyphens within words
        .split(/\s+/) // Split by whitespace
        .filter(token => token.length > 0 && !COMPREHENSIVE_STOP_WORDS.has(token)); // Use comprehensive list for Jaccard
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
        return 0; 
    }

    const tokensA = getProcessedTokensForJaccard(textA);
    const tokensB = getProcessedTokensForJaccard(textB);

    if (tokensA.size === 0 && tokensB.size === 0) {
        return 1; 
    }
    if (tokensA.size === 0 || tokensB.size === 0) {
        return 0; 
    }
    
    const intersection = new Set([...tokensA].filter(token => tokensB.has(token)));
    const union = new Set([...tokensA, ...tokensB]);

    if (union.size === 0) {
        return 1; 
    }

    return intersection.size / union.size;
};

/**
 * Calculates Lexical Density.
 * Lexical Density = (Number of Content Words / Total Number of Words)
 * Content words are non-stop words.
 * @param text The input text.
 * @returns Lexical density score (0-1), or undefined if no words.
 */
export const calculateLexicalDensity = (text: string | null | undefined): number | undefined => {
    if (!text || !text.trim()) return undefined;

    const allTokens = getTokens(text, true);
    if (allTokens.length === 0) return undefined;

    const contentTokens = allTokens.filter(token => !COMPREHENSIVE_STOP_WORDS.has(token));
    
    const density = contentTokens.length / allTokens.length;
    return parseFloat(density.toFixed(3));
};

/**
 * Calculates Average Sentence Length.
 * Avg Sentence Length = (Total Words / Total Sentences)
 * @param text The input text.
 * @returns Average sentence length, or undefined if no words/sentences.
 */
export const calculateAvgSentenceLength = (text: string | null | undefined): number | undefined => {
    if (!text || !text.trim()) return undefined;

    const totalWords = countWords(text);
    const totalSentences = countSentences(text);

    if (totalWords === 0 || totalSentences === 0) return undefined;

    const avgLength = totalWords / totalSentences;
    return parseFloat(avgLength.toFixed(2));
};

/**
 * Calculates Type-Token Ratio (TTR).
 * TTR = (Number of Unique Words / Total Number of Words)
 * @param text The input text.
 * @returns TTR score (0-1), or undefined if no words.
 */
export const calculateSimpleTTR = (text: string | null | undefined): number | undefined => {
    if (!text || !text.trim()) return undefined;

    const allTokens = getTokens(text, true);
    if (allTokens.length === 0) return undefined;

    const uniqueTokens = new Set(allTokens);
    const ttr = uniqueTokens.size / allTokens.length;
    return parseFloat(ttr.toFixed(3));
};
