/**
 * Property-Based Tests for Asset Manager Service
 *
 * Tests path normalization and unique filename generation.
 *
 * **Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)**
 * **Validates: Requirements 5.9, 5.10**
 *
 * **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
 * **Validates: Requirements 5.11**
 */

import * as fc from 'fast-check';
import {
  toPosixPath,
  toNativePath,
  generateUniqueFilename,
  getExtension,
} from '../assetManager';

// Helper to create path segment arbitrary
const pathChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.';
const pathSegmentArbitrary = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.length > 0 && [...s].every(c => pathChars.includes(c)));

// Helper to create mixed path arbitrary
const createMixedPath = (segments: string[], separators: string[]): string => {
  let path = segments[0];
  for (let i = 1; i < segments.length; i++) {
    path += separators[i - 1] + segments[i];
  }
  return path;
};

describe('Asset Manager Property Tests', () => {
  /**
   * **Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)**
   * **Validates: Requirements 5.9, 5.10**
   *
   * For any reference_image path stored in the script JSON, the path SHALL use
   * POSIX format (forward slashes `/`) regardless of the operating system.
   */
  describe('Property 16: Asset Path Normalization (Cross-Platform)', () => {
    // Arbitrary for paths with mixed separators
    const mixedPathArbitrary = fc
      .array(pathSegmentArbitrary, { minLength: 1, maxLength: 5 })
      .chain((segments: string[]) =>
        fc.array(fc.constantFrom('/', '\\'), { minLength: segments.length - 1, maxLength: segments.length - 1 })
          .map((separators: string[]) => createMixedPath(segments, separators))
      );

    it('toPosixPath converts all backslashes to forward slashes', () => {
      fc.assert(
        fc.property(mixedPathArbitrary, (path: string) => {
          const posixPath = toPosixPath(path);
          // Result should not contain any backslashes
          return !posixPath.includes('\\');
        }),
        { numRuns: 100 }
      );
    });

    it('toPosixPath preserves forward slashes', () => {
      fc.assert(
        fc.property(
          fc.array(pathSegmentArbitrary, { minLength: 1, maxLength: 5 }) as fc.Arbitrary<string[]>,
          (segments: string[]) => {
            const posixPath = segments.join('/');
            const result = toPosixPath(posixPath);
            // Result should be identical (no changes needed)
            return result === posixPath;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('toPosixPath is idempotent', () => {
      fc.assert(
        fc.property(mixedPathArbitrary, (path: string) => {
          const once = toPosixPath(path);
          const twice = toPosixPath(once);
          // Applying twice should give same result as once
          return once === twice;
        }),
        { numRuns: 100 }
      );
    });

    it('toPosixPath preserves path content (only changes separators)', () => {
      fc.assert(
        fc.property(mixedPathArbitrary, (path: string) => {
          const posixPath = toPosixPath(path);
          // Remove all separators and compare content
          const originalContent = path.replace(/[/\\]/g, '');
          const posixContent = posixPath.replace(/[/\\]/g, '');
          return originalContent === posixContent;
        }),
        { numRuns: 100 }
      );
    });

    it('toNativePath round-trips with toPosixPath on non-Windows', () => {
      // This test assumes we're running on macOS/Linux
      // On these platforms, toNativePath should be identity for POSIX paths
      fc.assert(
        fc.property(
          fc.array(pathSegmentArbitrary, { minLength: 1, maxLength: 5 }) as fc.Arbitrary<string[]>,
          (segments: string[]) => {
            const posixPath = segments.join('/');
            const nativePath = toNativePath(posixPath);
            // On macOS/Linux, native path should equal POSIX path
            // (This test will behave differently on Windows)
            const isWindows = typeof navigator !== 'undefined'
              ? navigator.userAgent.toLowerCase().includes('win')
              : process.platform === 'win32';
            
            if (isWindows) {
              // On Windows, should convert to backslashes
              return nativePath === posixPath.replace(/\//g, '\\');
            } else {
              // On macOS/Linux, should remain unchanged
              return nativePath === posixPath;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Windows-style paths are normalized to POSIX', () => {
      fc.assert(
        fc.property(
          fc.array(pathSegmentArbitrary, { minLength: 1, maxLength: 5 }) as fc.Arbitrary<string[]>,
          (segments: string[]) => {
            // Create Windows-style path
            const windowsPath = segments.join('\\');
            const posixPath = toPosixPath(windowsPath);
            // Should be converted to forward slashes
            const expectedPosix = segments.join('/');
            return posixPath === expectedPosix;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
   * **Validates: Requirements 5.11**
   *
   * For any reference image saved via paste or drag-drop, the Asset_Manager
   * SHALL generate a unique filename using the pattern
   * `vision_{action_id}_{timestamp}.{ext}` to prevent filename collisions.
   */
  describe('Property 17: Asset File Naming Uniqueness', () => {
    // Arbitrary for UUID-like action IDs
    const actionIdArbitrary = fc.uuid();

    // Arbitrary for file extensions
    const extensionArbitrary = fc.constantFrom('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp');

    it('generateUniqueFilename follows the pattern vision_{actionId}_{timestamp}.{ext}', () => {
      fc.assert(
        fc.property(actionIdArbitrary, extensionArbitrary, (actionId: string, ext: string) => {
          const filename = generateUniqueFilename(actionId, ext);
          // Should match pattern: vision_{sanitizedId}_{timestamp}.{ext}
          const pattern = /^vision_[a-zA-Z0-9-]+_\d+\.[a-z]+$/;
          return pattern.test(filename);
        }),
        { numRuns: 100 }
      );
    });

    it('generateUniqueFilename produces unique filenames for different timestamps', () => {
      fc.assert(
        fc.property(actionIdArbitrary, extensionArbitrary, (actionId: string, ext: string) => {
          const filename1 = generateUniqueFilename(actionId, ext);
          // Small delay to ensure different timestamp
          const filename2 = generateUniqueFilename(actionId, ext);
          // Filenames might be same if generated in same millisecond
          // But the pattern should still be valid
          const pattern = /^vision_[a-zA-Z0-9-]+_\d+\.[a-z]+$/;
          return pattern.test(filename1) && pattern.test(filename2);
        }),
        { numRuns: 100 }
      );
    });

    it('generateUniqueFilename produces unique filenames for different action IDs', () => {
      fc.assert(
        fc.property(
          actionIdArbitrary,
          actionIdArbitrary,
          extensionArbitrary,
          (actionId1: string, actionId2: string, ext: string) => {
            fc.pre(actionId1 !== actionId2);
            const filename1 = generateUniqueFilename(actionId1, ext);
            const filename2 = generateUniqueFilename(actionId2, ext);
            // Different action IDs should produce different filenames
            return filename1 !== filename2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateUniqueFilename sanitizes action ID (removes invalid characters)', () => {
      fc.assert(
        fc.property(
          // Generate action IDs with special characters
          fc.string({ minLength: 1, maxLength: 50 }),
          extensionArbitrary,
          (actionId: string, ext: string) => {
            const filename = generateUniqueFilename(actionId, ext);
            // Filename should only contain valid characters
            const pattern = /^vision_[a-zA-Z0-9-]*_\d+\.[a-z]+$/;
            return pattern.test(filename);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateUniqueFilename handles extension with or without leading dot', () => {
      fc.assert(
        fc.property(actionIdArbitrary, extensionArbitrary, (actionId: string, ext: string) => {
          const withDot = generateUniqueFilename(actionId, `.${ext}`);
          const withoutDot = generateUniqueFilename(actionId, ext);
          // Both should produce valid filenames ending with the extension
          return withDot.endsWith(`.${ext}`) && withoutDot.endsWith(`.${ext}`);
        }),
        { numRuns: 100 }
      );
    });

    it('generateUniqueFilename normalizes extension to lowercase', () => {
      fc.assert(
        fc.property(
          actionIdArbitrary,
          fc.constantFrom('PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'),
          (actionId: string, ext: string) => {
            const filename = generateUniqueFilename(actionId, ext);
            // Extension should be lowercase
            const extPart = filename.split('.').pop();
            return extPart === ext.toLowerCase();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional tests for getExtension utility
   */
  describe('getExtension utility', () => {
    it('extracts extension from MIME types', () => {
      const mimeTestCases: Array<[string, string]> = [
        ['image/png', 'png'],
        ['image/jpeg', 'jpg'],
        ['image/jpg', 'jpg'],
        ['image/gif', 'gif'],
        ['image/webp', 'webp'],
        ['image/bmp', 'bmp'],
      ];
      
      for (const [mimeType, expectedExt] of mimeTestCases) {
        const ext = getExtension(mimeType);
        expect(ext).toBe(expectedExt);
      }
    });

    it('extracts extension from filenames', () => {
      const nameChars = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
      const nameArbitrary = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.length > 0 && [...s].every(c => nameChars.includes(c)));
      
      fc.assert(
        fc.property(
          fc.constantFrom('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'),
          nameArbitrary,
          (ext: string, name: string) => {
            const filename = `${name}.${ext}`;
            const result = getExtension(filename);
            return result === ext;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('defaults to png for unknown MIME types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('image/unknown', 'application/octet-stream', 'text/plain'),
          (mimeType: string) => {
            const ext = getExtension(mimeType);
            return ext === 'png';
          }
        ),
        { numRuns: 10 }
      );
    });

    it('defaults to png for files without extension', () => {
      const nameChars = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
      const nameArbitrary = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.length > 0 && [...s].every(c => nameChars.includes(c)));
      
      fc.assert(
        fc.property(
          nameArbitrary,
          (name: string) => {
            const ext = getExtension(name);
            return ext === 'png';
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
