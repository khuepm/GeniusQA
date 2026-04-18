/**
 * Markdown rendering utilities for AI Test Case Generator
 * 
 * Provides utilities for rendering markdown content in test case descriptions
 * and detecting markdown formatting types for validation.
 * 
 * Requirements: 6.5
 */

import { MarkdownContent, MarkdownFormattingType } from '../types/aiTestCaseGenerator.types';

/**
 * Detects markdown formatting types in raw text
 */
export function detectMarkdownFormatting(text: string): MarkdownFormattingType[] {
  const formatTypes: MarkdownFormattingType[] = [];
  
  // Bold text (**text** or __text__)
  if (/\*\*[^*]+\*\*|__[^_]+__/.test(text)) {
    formatTypes.push('bold');
  }
  
  // Italic text (*text* or _text_)
  if (/\*[^*]+\*|_[^_]+_/.test(text)) {
    formatTypes.push('italic');
  }
  
  // Inline code (`code`)
  if (/`[^`]+`/.test(text)) {
    formatTypes.push('code');
  }
  
  // Code blocks (```code```)
  if (/```[\s\S]*?```/.test(text)) {
    formatTypes.push('code_block');
  }
  
  // Lists (- item or * item or 1. item)
  if (/^\s*[-*]\s+.+$/m.test(text) || /^\s*\d+\.\s+.+$/m.test(text)) {
    formatTypes.push('list');
  }
  
  // Links ([text](url))
  if (/\[([^\]]+)\]\(([^)]+)\)/.test(text)) {
    formatTypes.push('link');
  }
  
  // Headers (# Header)
  if (/^#+\s+.+$/m.test(text)) {
    formatTypes.push('header');
  }
  
  return formatTypes;
}

/**
 * Converts markdown text to HTML for rendering
 * This is a simple implementation for testing purposes
 */
export function renderMarkdownToHtml(text: string): string {
  let html = text;
  
  // Convert code blocks FIRST (before inline code to avoid conflicts)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Convert headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Convert bold text
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Convert italic text (avoid conflicts with bold)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
  
  // Convert inline code (after code blocks)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert links (more robust pattern)
  html = html.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text, url) => {
    // Only convert if text is not empty
    if (text.trim().length > 0) {
      return `<a href="${url}">${text}</a>`;
    }
    return match; // Return original if text is empty
  });
  
  // Convert unordered lists
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Convert ordered lists
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
  
  // Convert line breaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * Creates a MarkdownContent object with formatting analysis
 */
export function analyzeMarkdownContent(text: string): MarkdownContent {
  const formattingTypes = detectMarkdownFormatting(text);
  const rendered = renderMarkdownToHtml(text);
  
  return {
    raw: text,
    rendered,
    has_formatting: formattingTypes.length > 0,
    formatting_types: formattingTypes
  };
}

/**
 * Validates that rendered HTML contains expected formatting elements
 */
export function validateMarkdownRendering(content: MarkdownContent): boolean {
  const { raw, rendered, formatting_types } = content;
  
  // Check that each detected formatting type is present in rendered HTML
  for (const formatType of formatting_types) {
    switch (formatType) {
      case 'bold':
        if (!rendered.includes('<strong>')) return false;
        break;
      case 'italic':
        if (!rendered.includes('<em>')) return false;
        break;
      case 'code':
        if (!rendered.includes('<code>')) return false;
        break;
      case 'code_block':
        if (!rendered.includes('<pre><code>')) return false;
        break;
      case 'list':
        if (!rendered.includes('<li>')) return false;
        break;
      case 'link':
        if (!rendered.includes('<a href=')) return false;
        break;
      case 'header':
        if (!/h[1-6]>/.test(rendered)) return false;
        break;
    }
  }
  
  return true;
}

/**
 * Extracts plain text content from markdown, removing formatting
 */
export function extractPlainText(markdown: string): string {
  let text = markdown;
  
  // Remove code blocks first
  text = text.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code
  text = text.replace(/`[^`]+`/g, '');
  
  // Remove links but keep text (handle empty text)
  text = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
  
  // Remove bold and italic formatting
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  
  // Remove headers
  text = text.replace(/^#+\s*/gm, '');
  
  // Remove list markers
  text = text.replace(/^\s*[-*]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  
  // Remove remaining markdown characters that might be left over
  text = text.replace(/[*_`#\[\]]/g, '');
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}
