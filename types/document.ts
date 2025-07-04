// types/document.ts
export interface DocumentChunk {
  id: string; // Unique identifier (UUID)
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6' | 'paragraph' | 'list' | 'code_block' | 'blockquote' | 'thematic_break';
  content: string; // The raw markdown content of the chunk
  lang?: string; // Language for code blocks
}

export interface OutlineNode {
  id: string; // Unique ID for the node
  content: string; // The text of the outline item
  sourceFileNames: string[]; // Files this node was derived from
  children: OutlineNode[]; // Nested outline items
}
