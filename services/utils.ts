
import { extractTitleOrThemeFromContent } from './projectUtils.ts';

export const DEFAULT_PROJECT_NAME_FALLBACK = "Untitled Project";
export const INITIAL_PROJECT_NAME_STATE = "";


const createSlugFromText = (text: string | null | undefined, fallback: string | null | undefined): string => {
  let theme: string | null = null;
  if (text) {
    // get 2-3 keywords, min 3 chars long
    theme = extractTitleOrThemeFromContent(text, 3, 3);
  }

  const slugSource = theme || fallback || DEFAULT_PROJECT_NAME_FALLBACK;

  const slug = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars except space and hyphen
    .trim()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .substring(0, 40) // limit length
    .replace(/-$/, ''); // remove trailing hyphen
  
  return slug || 'content';
};


export const generateFileName = (
  suffix: string,
  extension: string,
  options: {
    projectCodename?: string | null;
    versionString?: string;
    contentForSlug?: string | null;
    projectName?: string | null;
    outlineId?: string | null;
  } = {}
): string => {
  const parts: string[] = [];

  // Use project codename as the base, or a fallback.
  parts.push(options.projectCodename || 'iteration');
  
  if (options.outlineId) {
    parts.push(options.outlineId);
  }

  parts.push(suffix);

  if (options.versionString) {
    parts.push(options.versionString.replace(/^v/, '')); // Add version string like '1.20'
  }

  const slug = createSlugFromText(options.contentForSlug, options.projectName);
  parts.push(slug);

  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const timestamp = `${month}${day}-${hours}${minutes}`;

  parts.push(timestamp);

  return `${parts.join('_')}.${extension}`;
};

/**
 * Safely converts a string into a YAML-compatible string literal.
 * It uses JSON.stringify for single-line strings to handle quotes and escapes correctly.
 * For multi-line strings, it uses the YAML literal block style for readability.
 * @param str The string to convert.
 * @returns A YAML-safe string.
 */
export const toYamlStringLiteral = (str: string): string => {
    if (typeof str !== 'string') return '""';
    
    const needsEscaping = /[:{}\[\]\-,&*\s#?|<>@%`!]/.test(str) || str.startsWith('"') || str.startsWith('\'');
    const hasNewlines = str.includes('\n');

    if (hasNewlines) {
        // Use literal block scalar for multi-line strings
        const indentedStr = str.replace(/\n/g, '\n  ');
        return `|\n  ${indentedStr}`;
    }

    // For single-line strings, JSON.stringify is the most robust way to handle
    // all special characters, quotes, and control characters correctly.
    return JSON.stringify(str);
};
