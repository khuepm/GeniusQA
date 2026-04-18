/**
 * Property-Based Tests for Markdown Rendering Fidelity
 * 
 * Tests correctness properties for markdown rendering in AI Test Case Generator,
 * ensuring all markdown formatting is rendered correctly and consistently.
 * 
 * **Feature: ai-test-case-generator, Property 13: Markdown Rendering Fidelity**
 * **Validates: Requirements 6.5**
 */

import * as fc from 'fast-check';
import {
  detectMarkdownFormatting,
  renderMarkdownToHtml,
  analyzeMarkdownContent,
  validateMarkdownRendering,
  extractPlainText
} from '../markdownRenderer';
import { MarkdownContent, MarkdownFormattingType } from '../../types/aiTestCaseGenerator.types';

// ============================================================================
// Arbitraries (Generators) for Markdown Content
// ============================================================================

/**
 * Generate plain text without markdown formatting
 */
const plainTextArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(text => 
    text.trim().length > 0 && 
    !text.includes('*') && 
    !text.includes('_') && 
    !text.includes('`') && 
    !text.includes('#') && 
    !text.includes('[') && 
    !text.includes(']') &&
    !text.includes('(') &&
    !text.includes(')')
  );

/**
 * Generate bold markdown text
 */
const boldTextArbitrary = fc.tuple(
  plainTextArbitrary,
  fc.constantFrom('**', '__')
).map(([text, marker]) => `${marker}${text}${marker}`);

/**
 * Generate italic markdown text
 */
const italicTextArbitrary = fc.tuple(
  plainTextArbitrary,
  fc.constantFrom('*', '_')
).map(([text, marker]) => `${marker}${text}${marker}`);

/**
 * Generate inline code markdown
 */
const inlineCodeArbitrary = plainTextArbitrary.map(text => `\`${text}\``);

/**
 * Generate code block markdown
 */
const codeBlockArbitrary = plainTextArbitrary
  .filter(text => text.trim().length > 0)
  .map(text => `\`\`\`\n${text}\n\`\`\``);

/**
 * Generate header markdown
 */
const headerArbitrary = fc.tuple(
  fc.integer({ min: 1, max: 3 }),
  plainTextArbitrary
).map(([level, text]) => `${'#'.repeat(level)} ${text}`);

/**
 * Generate link markdown
 */
const linkArbitrary = fc.tuple(
  plainTextArbitrary.filter(text => text.trim().length > 0),
  fc.webUrl()
).map(([text, url]) => `[${text}](${url})`);

/**
 * Generate list item markdown
 */
const listItemArbitrary = fc.tuple(
  fc.constantFrom('- ', '* ', '1. ', '2. '),
  plainTextArbitrary
).map(([marker, text]) => `${marker}${text}`);

/**
 * Generate markdown with specific formatting type
 */
const formattedMarkdownArbitrary = fc.oneof(
  boldTextArbitrary,
  italicTextArbitrary,
  inlineCodeArbitrary,
  codeBlockArbitrary,
  headerArbitrary,
  linkArbitrary,
  listItemArbitrary
);

/**
 * Generate complex markdown with multiple formatting types
 */
const complexMarkdownArbitrary = fc.array(
  fc.oneof(plainTextArbitrary, formattedMarkdownArbitrary),
  { minLength: 1, maxLength: 5 }
).map(parts => parts.join('\n\n'));

/**
 * Generate markdown content with known formatting
 */
const knownFormattingArbitrary = fc.record({
  bold: fc.option(boldTextArbitrary),
  italic: fc.option(italicTextArbitrary),
  code: fc.option(inlineCodeArbitrary),
  codeBlock: fc.option(codeBlockArbitrary),
  header: fc.option(headerArbitrary),
  link: fc.option(linkArbitrary),
  list: fc.option(listItemArbitrary)
}).map(formats => {
  const parts = Object.values(formats).filter(Boolean) as string[];
  return parts.join('\n\n');
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Markdown Rendering Fidelity Property Tests', () => {
  /**
   * **Feature: ai-test-case-generator, Property 13: Markdown Rendering Fidelity**
   * **Validates: Requirements 6.5**
   * 
   * For any markdown content containing formatting (bold, code blocks, lists),
   * the UI should render all formatting correctly and consistently.
   */
  describe('Property 13: Markdown Rendering Fidelity', () => {
    it('detects all formatting types present in markdown text', () => {
      fc.assert(
        fc.property(knownFormattingArbitrary, (markdown: string) => {
          const detectedTypes = detectMarkdownFormatting(markdown);
          
          // If markdown contains bold formatting, it should be detected
          if (/\*\*[^*]+\*\*|__[^_]+__/.test(markdown)) {
            return detectedTypes.includes('bold');
          }
          
          // If markdown contains italic formatting, it should be detected
          if (/\*[^*]+\*|_[^_]+_/.test(markdown)) {
            return detectedTypes.includes('italic');
          }
          
          // If markdown contains inline code, it should be detected
          if (/`[^`]+`/.test(markdown)) {
            return detectedTypes.includes('code');
          }
          
          // If markdown contains code blocks, it should be detected
          if (/```[\s\S]*?```/.test(markdown)) {
            return detectedTypes.includes('code_block');
          }
          
          // If markdown contains headers, it should be detected
          if (/^#+\s+.+$/m.test(markdown)) {
            return detectedTypes.includes('header');
          }
          
          // If markdown contains links, it should be detected
          if (/\[([^\]]+)\]\(([^)]+)\)/.test(markdown)) {
            return detectedTypes.includes('link');
          }
          
          // If markdown contains lists, it should be detected
          if (/^\s*[-*]\s+.+$/m.test(markdown) || /^\s*\d+\.\s+.+$/m.test(markdown)) {
            return detectedTypes.includes('list');
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('renders bold formatting to HTML strong tags', () => {
      fc.assert(
        fc.property(boldTextArbitrary, (boldMarkdown: string) => {
          const rendered = renderMarkdownToHtml(boldMarkdown);
          
          // Should contain strong tags
          return rendered.includes('<strong>') && rendered.includes('</strong>');
        }),
        { numRuns: 100 }
      );
    });

    it('renders italic formatting to HTML em tags', () => {
      fc.assert(
        fc.property(italicTextArbitrary, (italicMarkdown: string) => {
          const rendered = renderMarkdownToHtml(italicMarkdown);
          
          // Should contain em tags
          return rendered.includes('<em>') && rendered.includes('</em>');
        }),
        { numRuns: 100 }
      );
    });

    it('renders inline code to HTML code tags', () => {
      fc.assert(
        fc.property(inlineCodeArbitrary, (codeMarkdown: string) => {
          const rendered = renderMarkdownToHtml(codeMarkdown);
          
          // Should contain code tags
          return rendered.includes('<code>') && rendered.includes('</code>');
        }),
        { numRuns: 100 }
      );
    });

    it('renders code blocks to HTML pre and code tags', () => {
      fc.assert(
        fc.property(codeBlockArbitrary, (codeBlockMarkdown: string) => {
          const rendered = renderMarkdownToHtml(codeBlockMarkdown);
          
          // Should contain pre and code tags
          return rendered.includes('<pre><code>') && rendered.includes('</code></pre>');
        }),
        { numRuns: 100 }
      );
    });

    it('renders headers to HTML header tags', () => {
      fc.assert(
        fc.property(headerArbitrary, (headerMarkdown: string) => {
          const rendered = renderMarkdownToHtml(headerMarkdown);
          
          // Should contain header tags (h1, h2, or h3)
          return /h[1-3]>/.test(rendered);
        }),
        { numRuns: 100 }
      );
    });

    it('renders links to HTML anchor tags', () => {
      fc.assert(
        fc.property(linkArbitrary, (linkMarkdown: string) => {
          const rendered = renderMarkdownToHtml(linkMarkdown);
          
          // Should contain anchor tags with href
          return rendered.includes('<a href=') && rendered.includes('</a>');
        }),
        { numRuns: 100 }
      );
    });

    it('renders list items to HTML list tags', () => {
      fc.assert(
        fc.property(listItemArbitrary, (listMarkdown: string) => {
          const rendered = renderMarkdownToHtml(listMarkdown);
          
          // Should contain list item tags
          return rendered.includes('<li>') && rendered.includes('</li>');
        }),
        { numRuns: 100 }
      );
    });

    it('analyzeMarkdownContent correctly identifies formatting presence', () => {
      fc.assert(
        fc.property(
          fc.oneof(plainTextArbitrary, formattedMarkdownArbitrary),
          (markdown: string) => {
            const content = analyzeMarkdownContent(markdown);
            
            // has_formatting should match whether formatting_types is non-empty
            return content.has_formatting === (content.formatting_types.length > 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validateMarkdownRendering confirms all detected formatting is rendered', () => {
      fc.assert(
        fc.property(complexMarkdownArbitrary, (markdown: string) => {
          const content = analyzeMarkdownContent(markdown);
          const isValid = validateMarkdownRendering(content);
          
          // If validation passes, all formatting types should be present in rendered HTML
          if (isValid) {
            for (const formatType of content.formatting_types) {
              switch (formatType) {
                case 'bold':
                  if (!content.rendered.includes('<strong>')) return false;
                  break;
                case 'italic':
                  if (!content.rendered.includes('<em>')) return false;
                  break;
                case 'code':
                  if (!content.rendered.includes('<code>')) return false;
                  break;
                case 'code_block':
                  if (!content.rendered.includes('<pre><code>')) return false;
                  break;
                case 'list':
                  if (!content.rendered.includes('<li>')) return false;
                  break;
                case 'link':
                  if (!content.rendered.includes('<a href=')) return false;
                  break;
                case 'header':
                  if (!/h[1-6]>/.test(content.rendered)) return false;
                  break;
              }
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('extractPlainText removes all markdown formatting', () => {
      fc.assert(
        fc.property(formattedMarkdownArbitrary, (markdown: string) => {
          const plainText = extractPlainText(markdown);
          
          // Plain text should not contain markdown formatting characters
          const hasMarkdownChars = /[*_`#\[\]]/.test(plainText);
          
          // Should not contain markdown formatting
          return !hasMarkdownChars;
        }),
        { numRuns: 100 }
      );
    });

    it('rendering is deterministic for identical input', () => {
      fc.assert(
        fc.property(complexMarkdownArbitrary, (markdown: string) => {
          const rendered1 = renderMarkdownToHtml(markdown);
          const rendered2 = renderMarkdownToHtml(markdown);
          
          // Same input should always produce same output
          return rendered1 === rendered2;
        }),
        { numRuns: 100 }
      );
    });

    it('content analysis is consistent with rendering', () => {
      fc.assert(
        fc.property(complexMarkdownArbitrary, (markdown: string) => {
          const content = analyzeMarkdownContent(markdown);
          const manualRendered = renderMarkdownToHtml(markdown);
          
          // Analyzed content should match manual rendering
          return content.rendered === manualRendered && content.raw === markdown;
        }),
        { numRuns: 100 }
      );
    });

    it('preserves text content through formatting transformations', () => {
      fc.assert(
        fc.property(
          fc.tuple(plainTextArbitrary, fc.constantFrom('**', '__')),
          ([text, marker]: [string, string]) => {
            const markdown = `${marker}${text}${marker}`;
            const plainExtracted = extractPlainText(markdown);
            
            // Original text should be preserved (allowing for whitespace normalization)
            // Compare normalized versions since extractPlainText normalizes whitespace
            const normalizedOriginal = text.replace(/\s+/g, ' ').trim();
            const normalizedExtracted = plainExtracted.replace(/\s+/g, ' ').trim();
            
            return normalizedExtracted === normalizedOriginal;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles empty and whitespace-only content gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\n\n', '\t'),
          (emptyContent: string) => {
            const content = analyzeMarkdownContent(emptyContent);
            const rendered = renderMarkdownToHtml(emptyContent);
            
            // Should not crash and should handle empty content
            return typeof content.rendered === 'string' && 
                   typeof rendered === 'string' &&
                   content.formatting_types.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
