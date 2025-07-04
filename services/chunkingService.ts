import { v4 as uuidv4 } from 'uuid';
import type { DocumentChunk } from '../types/index.ts';

export const classifyChunkType = (content: string): DocumentChunk['type'] => {
    const trimmed = content.trim();
    if (trimmed.startsWith('# ')) return 'heading_1';
    if (trimmed.startsWith('## ')) return 'heading_2';
    if (trimmed.startsWith('### ')) return 'heading_3';
    if (trimmed.startsWith('#### ')) return 'heading_4';
    if (trimmed.startsWith('##### ')) return 'heading_5';
    if (trimmed.startsWith('###### ')) return 'heading_6';
    if (trimmed.startsWith('```')) return 'code_block';
    if (trimmed.startsWith('>')) return 'blockquote';
    if (trimmed.match(/^(\*|\-|\+)\s/)) return 'list';
    if (trimmed.match(/^\d+\.\s/)) return 'list';
    if (trimmed.match(/^(---|___|\*\*\*)$/)) return 'thematic_break';
    return 'paragraph';
};

/**
 * Creates a new DocumentChunk object with a unique ID.
 * @param content The markdown content for the new chunk.
 * @param sourceFileNames Optional array of source file names.
 * @param changeRationale Optional rationale for the chunk's creation.
 * @returns A new DocumentChunk object.
 */
export const createChunk = (content: string, sourceFileNames: string[] = [], changeRationale?: string): DocumentChunk => {
    const type = classifyChunkType(content);
    const langMatch = type === 'code_block' ? content.match(/^```(\w*)/) : null;
    return {
        id: uuidv4(),
        type,
        content: content.trim(),
        ...(langMatch && langMatch[1] && { lang: langMatch[1] }),
        sourceFileNames,
        changeRationale,
        lastOperation: 'added' // Mark it as new
    };
};


/**
 * Splits a markdown string into an array of uniquely identified DocumentChunk objects.
 * This function uses a simple strategy of splitting by double newlines, which is a common
 * paragraph separator in markdown.
 * @param markdownText The full markdown string to process.
 * @returns An array of DocumentChunk objects.
 */
export const splitToChunks = (markdownText: string | null | undefined): DocumentChunk[] => {
    if (!markdownText || !markdownText.trim()) {
        return [];
    }

    // Replace CRLF with LF for consistency
    const normalizedText = markdownText.replace(/\r\n/g, '\n');
    
    // Split by one or more blank lines. This is a robust way to separate markdown blocks.
    const chunksFromSplit = normalizedText.split(/\n\s*\n/);
    
    return chunksFromSplit.filter(c => c.trim()).map(content => {
        const type = classifyChunkType(content);
        const langMatch = type === 'code_block' ? content.match(/^```(\w*)/) : null;
        return {
            id: uuidv4(),
            type,
            content: content.trim(), // Store trimmed content
            ...(langMatch && langMatch[1] && { lang: langMatch[1] })
        };
    });
};

/**
 * Reconstructs the full markdown document from an array of DocumentChunk objects.
 * @param chunks The array of DocumentChunk objects.
 * @returns The full markdown string, with blocks separated by double newlines.
 */
export const reconstructFromChunks = (chunks: DocumentChunk[] | null | undefined): string => {
    if (!chunks || chunks.length === 0) {
        return "";
    }
    return chunks.map(chunk => chunk.content).join('\n\n');
};