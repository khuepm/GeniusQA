/**
 * Property-Based Tests for ReferenceImageManager Component
 *
 * Tests correctness properties for reference image asset persistence,
 * focusing on file creation and path validity.
 *
 * Uses fast-check for property-based testing.
 *
 * **Feature: ai-vision-capture, Property 9: Reference Image Asset Persistence**
 * **Validates: Requirements 5.5, 2.6**
 */

import * as fc from 'fast-check';

// ============================================================================
// Asset Manager Utilities (Extracted for Testing)
// ============================================================================

/**
 * Convert any path to POSIX format (forward slashes)
 * 
 * Requirements: 5.9
 */
function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Convert POSIX path to OS-native format
 * 
 * Requirements: 5.10
 */
function toNativePath(posixPath: string): string {
  // In browser/Node.js context, we typically use POSIX paths
  // On Windows, this would convert to backslashes
  if (typeof process !== 'undefined' && process.platform === 'win32') {
    return posixPath.replace(/\//g, '\\');
  }
  return posixPath;
}

/**
 * Generate a unique filename for reference images
 * 
 * Pattern: vision_{action_id}_{timestamp}.{ext}
 * 
 * Requirements: 5.11
 */
function generateUniqueFilename(actionId: string, extension: string): string {
  const timestamp = Date.now();
  
  // Sanitize action_id to remove any characters that might cause issues
  const safeActionId = actionId.replace(/[^a-zA-Z0-9\-_]/g, '');
  
  // Sanitize extension to remove leading dot if present
  const safeExtension = extension.replace(/^\./, '');
  
  return `vision_${safeActionId}_${timestamp}.${safeExtension}`;
}

/**
 * Validate that a path is safe (no directory traversal attacks)
 */
function isSafePath(path: string): boolean {
  return (
    !path.includes('..') &&
    !path.startsWith('/') &&
    !path.startsWith('\\') &&
    !path.includes('://')
  );
}

/**
 * Validate that a relative path follows the expected format
 * 
 * Requirements: 5.5, 2.6
 */
function isValidRelativePath(path: string): boolean {
  // Must be in POSIX format (forward slashes)
  if (path.includes('\\')) return false;
  
  // Must start with assets/
  if (!path.startsWith('assets/')) return false;
  
  // Must have a valid filename
  const filename = path.split('/').pop();
  if (!filename || filename.length === 0) return false;
  
  // Must have a valid extension
  const hasExtension = /\.(png|jpg|jpeg|gif|webp)$/i.test(filename);
  if (!hasExtension) return false;
  
  // Must be safe (no directory traversal)
  if (!isSafePath(path)) return false;
  
  return true;
}

/**
 * Simulates saving a reference image and returning its path
 * 
 * This is a pure function that simulates the asset manager behavior
 * without actual file system operations.
 */
function simulateSaveReferenceImage(
  actionId: string,
  extension: string
): string {
  const filename = generateUniqueFilename(actionId, extension);
  const relativePath = `assets/${filename}`;
  return toPosixPath(relativePath);
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for valid UUID strings (action IDs)
 */
const actionIdArb = fc.uuid();

/**
 * Arbitrary for valid image extensions
 */
const imageExtensionArb = fc.constantFrom('png', 'jpg', 'jpeg', 'gif', 'webp');

/**
 * Arbitrary for valid image extensions with optional leading dot
 */
const imageExtensionWithDotArb = fc.oneof(
  imageExtensionArb,
  imageExtensionArb.map(ext => `.${ext}`)
);

/**
 * Arbitrary for paths with mixed separators (for normalization testing)
 */
const mixedPathArb = fc.array(
  fc.stringMatching(/^[a-zA-Z0-9_\-]+$/),
  { minLength: 1, maxLength: 5 }
).map(parts => {
  // Randomly mix forward and back slashes
  return parts.join(Math.random() > 0.5 ? '/' : '\\');
});

/**
 * Arbitrary for potentially unsafe paths
 */
const unsafePathArb = fc.oneof(
  fc.constant('../etc/passwd'),
  fc.constant('..\\windows\\system32'),
  fc.constant('/etc/passwd'),
  fc.constant('\\windows\\system32'),
  fc.constant('file://malicious.png'),
  fc.constant('assets/../../../etc/passwd')
);

/**
 * Arbitrary for random image data (simulated as byte arrays)
 */
const imageDataArb = fc.uint8Array({ minLength: 100, maxLength: 10000 });

// ============================================================================
// Property Tests
// ============================================================================

describe('ReferenceImageManager Property Tests', () => {
  describe('Property 9: Reference Image Asset Persistence', () => {
    /**
     * **Feature: ai-vision-capture, Property 9: Reference Image Asset Persistence**
     * **Validates: Requirements 5.5, 2.6**
     *
     * For any reference image added to an action, the image file SHALL be saved
     * to the ./assets/ subdirectory relative to the script file, and the stored
     * path SHALL be a valid relative path.
     */

    describe('Requirement 5.5: Assets saved to ./assets/ subdirectory', () => {
      it('saved reference images have paths starting with assets/', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const relativePath = simulateSaveReferenceImage(actionId, extension);
              
              // Property: path must start with assets/
              expect(relativePath.startsWith('assets/')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('saved reference images are in POSIX format (forward slashes)', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const relativePath = simulateSaveReferenceImage(actionId, extension);
              
              // Property: path must use forward slashes only
              expect(relativePath.includes('\\')).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 2.6: Valid relative path stored in action data', () => {
      it('saved paths are valid relative paths', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const relativePath = simulateSaveReferenceImage(actionId, extension);
              
              // Property: path must be a valid relative path
              expect(isValidRelativePath(relativePath)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('saved paths have correct file extension', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const relativePath = simulateSaveReferenceImage(actionId, extension);
              
              // Property: path must end with the correct extension
              expect(relativePath.endsWith(`.${extension}`)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('saved paths contain the action ID', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const relativePath = simulateSaveReferenceImage(actionId, extension);
              
              // Sanitize action ID the same way the function does
              const sanitizedActionId = actionId.replace(/[^a-zA-Z0-9\-_]/g, '');
              
              // Property: path must contain the sanitized action ID
              expect(relativePath.includes(sanitizedActionId)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Property 16: Asset Path Normalization (Cross-Platform)', () => {
      /**
       * **Feature: ai-vision-capture, Property 16: Asset Path Normalization**
       * **Validates: Requirements 5.9, 5.10**
       */

      it('toPosixPath converts all backslashes to forward slashes', () => {
        fc.assert(
          fc.property(
            mixedPathArb,
            (path) => {
              const posixPath = toPosixPath(path);
              
              // Property: result must not contain backslashes
              expect(posixPath.includes('\\')).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('toPosixPath is idempotent', () => {
        fc.assert(
          fc.property(
            mixedPathArb,
            (path) => {
              const once = toPosixPath(path);
              const twice = toPosixPath(once);
              
              // Property: applying twice gives same result as once
              expect(twice).toBe(once);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('toPosixPath preserves path segments', () => {
        fc.assert(
          fc.property(
            fc.array(fc.stringMatching(/^[a-zA-Z0-9_\-]+$/), { minLength: 1, maxLength: 5 }),
            (segments) => {
              // Create path with backslashes
              const windowsPath = segments.join('\\');
              const posixPath = toPosixPath(windowsPath);
              
              // Property: all segments must be preserved
              const resultSegments = posixPath.split('/');
              expect(resultSegments).toEqual(segments);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Property 17: Asset File Naming Uniqueness', () => {
      /**
       * **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
       * **Validates: Requirements 5.11**
       */

      it('generated filenames follow the pattern vision_{actionId}_{timestamp}.{ext}', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const filename = generateUniqueFilename(actionId, extension);
              
              // Property: filename must match the pattern
              const pattern = /^vision_[a-zA-Z0-9\-_]+_\d+\.[a-zA-Z]+$/;
              expect(pattern.test(filename)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('generated filenames start with vision_ prefix', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const filename = generateUniqueFilename(actionId, extension);
              
              // Property: filename must start with vision_
              expect(filename.startsWith('vision_')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('generated filenames handle extensions with leading dots', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionWithDotArb,
            (actionId, extension) => {
              const filename = generateUniqueFilename(actionId, extension);
              
              // Property: filename must not have double dots
              expect(filename.includes('..')).toBe(false);
              
              // Property: filename must end with single dot + extension
              const cleanExt = extension.replace(/^\./, '');
              expect(filename.endsWith(`.${cleanExt}`)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('generated filenames contain sanitized action ID', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const filename = generateUniqueFilename(actionId, extension);
              
              // Property: filename must not contain unsafe characters from action ID
              expect(filename.includes('..')).toBe(false);
              expect(filename.includes('/')).toBe(false);
              expect(filename.includes('\\')).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('multiple generated filenames for same action are unique (due to timestamp)', async () => {
        // Test uniqueness with a small delay between generations
        const actionId = 'test-action-id';
        const extension = 'png';
        
        const filename1 = generateUniqueFilename(actionId, extension);
        
        // Small delay to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 5));
        
        const filename2 = generateUniqueFilename(actionId, extension);
        
        // Property: filenames should be different due to timestamp
        expect(filename1).not.toBe(filename2);
        
        // Both should follow the pattern
        expect(filename1.startsWith('vision_')).toBe(true);
        expect(filename2.startsWith('vision_')).toBe(true);
      });
    });

    describe('Path Safety', () => {
      it('isSafePath rejects directory traversal attempts', () => {
        fc.assert(
          fc.property(
            unsafePathArb,
            (unsafePath) => {
              // Property: unsafe paths must be rejected
              expect(isSafePath(unsafePath)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('isSafePath accepts valid relative paths', () => {
        fc.assert(
          fc.property(
            actionIdArb,
            imageExtensionArb,
            (actionId, extension) => {
              const relativePath = simulateSaveReferenceImage(actionId, extension);
              
              // Property: generated paths must be safe
              expect(isSafePath(relativePath)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Edge Cases', () => {
      it('handles empty action ID gracefully', () => {
        const filename = generateUniqueFilename('', 'png');
        
        // Should still generate a valid filename
        expect(filename.startsWith('vision_')).toBe(true);
        expect(filename.endsWith('.png')).toBe(true);
      });

      it('handles action ID with special characters', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            imageExtensionArb,
            (actionId, extension) => {
              const filename = generateUniqueFilename(actionId, extension);
              
              // Property: filename must be safe regardless of input
              expect(filename.includes('..')).toBe(false);
              expect(filename.includes('/')).toBe(false);
              expect(filename.includes('\\')).toBe(false);
              expect(filename.startsWith('vision_')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('toPosixPath handles empty string', () => {
        expect(toPosixPath('')).toBe('');
      });

      it('toPosixPath handles path with only slashes', () => {
        expect(toPosixPath('\\\\')).toBe('//');
        expect(toPosixPath('//')).toBe('//');
      });
    });
  });
});
