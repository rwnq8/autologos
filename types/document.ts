// types/document.ts
export interface DocumentChunk {
  id: string; // Unique identifier (UUID)
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6' | 'paragraph' | 'list' | 'code_block' | 'blockquote' | 'thematic_break';
  content: string; // The raw markdown content of the chunk
  lang?: string; // Language for code blocks
  sourceFileNames?: string[]; // Files this chunk was derived from
  changeRationale?: string; // AI's reason for the last change to this chunk
  lastOperation?: 'added' | 'modified'; // For UI feedback on the last iteration
}

export interface OutlineNode {
  wbs: string; // Work Breakdown Structure ID, e.g., "1.0", "1.1", "1.1.1"
  content: string; // The text of the outline item
  sourceFileNames: string[]; // Files this node was derived from
  children: OutlineNode[]; // Nested outline items
}

export interface ReconstructedProductResult {
  product: string;
  error?: string;
}