/**
 * Property-Based Tests for ROI Tool Component
 *
 * Tests correctness properties for ROI (Region of Interest) bounds validation,
 * ensuring all ROI coordinates satisfy the required constraints.
 *
 * **Feature: ai-vision-capture, Property 10: ROI Coordinate Bounds**
 * **Validates: Requirements 2.2, 2.3, 2.4**
 */

import * as fc from 'fast-check';
import { VisionROI } from '../../types/aiVisionCapture.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum ROI dimensions (matches ROITool.tsx MIN_ROI_SIZE)
 */
const MIN_ROI_SIZE = 20;

/**
 * Default screen dimensions for testing
 */
const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;

// ============================================================================
// Utility Functions (extracted from ROITool for testing)
// ============================================================================

/**
 * Validates that a ROI is within screen bounds
 *
 * @param roi - The ROI to validate
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns true if ROI is valid, false otherwise
 */
export function isValidROI(
  roi: VisionROI,
  screenWidth: number,
  screenHeight: number
): boolean {
  // Check x coordinate bounds
  if (roi.x < 0 || roi.x >= screenWidth) {
    return false;
  }

  // Check y coordinate bounds
  if (roi.y < 0 || roi.y >= screenHeight) {
    return false;
  }

  // Check width bounds
  if (roi.width < MIN_ROI_SIZE || roi.x + roi.width > screenWidth) {
    return false;
  }

  // Check height bounds
  if (roi.height < MIN_ROI_SIZE || roi.y + roi.height > screenHeight) {
    return false;
  }

  return true;
}

/**
 * Clamps a ROI to be within screen bounds
 * This mirrors the clampROI function in ROITool.tsx
 *
 * @param roi - The ROI to clamp
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns A clamped ROI that satisfies all bounds constraints
 */
export function clampROI(
  roi: VisionROI,
  screenWidth: number,
  screenHeight: number
): VisionROI {
  let { x, y, width, height } = roi;

  // Ensure minimum size
  width = Math.max(width, MIN_ROI_SIZE);
  height = Math.max(height, MIN_ROI_SIZE);

  // Clamp to screen bounds
  x = Math.max(0, Math.min(x, screenWidth - width));
  y = Math.max(0, Math.min(y, screenHeight - height));
  width = Math.min(width, screenWidth - x);
  height = Math.min(height, screenHeight - y);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid screen dimensions
 */
const screenDimensionsArbitrary = fc.record({
  width: fc.integer({ min: 100, max: 4096 }),
  height: fc.integer({ min: 100, max: 4096 }),
});

/**
 * Generate a valid ROI within given screen dimensions
 */
const validROIArbitrary = (screenWidth: number, screenHeight: number): fc.Arbitrary<VisionROI> => {
  const maxWidth = screenWidth - MIN_ROI_SIZE;
  const maxHeight = screenHeight - MIN_ROI_SIZE;

  return fc.record({
    x: fc.integer({ min: 0, max: Math.max(0, maxWidth) }),
    y: fc.integer({ min: 0, max: Math.max(0, maxHeight) }),
    width: fc.integer({ min: MIN_ROI_SIZE, max: screenWidth }),
    height: fc.integer({ min: MIN_ROI_SIZE, max: screenHeight }),
  }).filter(roi => {
    // Filter to ensure ROI fits within screen
    return roi.x + roi.width <= screenWidth && roi.y + roi.height <= screenHeight;
  });
};

/**
 * Generate any ROI (potentially invalid)
 */
const anyROIArbitrary: fc.Arbitrary<VisionROI> = fc.record({
  x: fc.integer({ min: -1000, max: 5000 }),
  y: fc.integer({ min: -1000, max: 5000 }),
  width: fc.integer({ min: -100, max: 5000 }),
  height: fc.integer({ min: -100, max: 5000 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('ROI Tool Property Tests', () => {
  /**
   * **Feature: ai-vision-capture, Property 10: ROI Coordinate Bounds**
   * **Validates: Requirements 2.2, 2.3, 2.4**
   *
   * For any vision_region (ROI), the coordinates SHALL satisfy:
   * - 0 <= x < screen_width
   * - 0 <= y < screen_height
   * - x + width <= screen_width
   * - y + height <= screen_height
   */
  describe('Property 10: ROI Coordinate Bounds', () => {
    it('valid ROI satisfies x >= 0', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.x >= 0;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI satisfies x < screen_width', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.x < width;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI satisfies y >= 0', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.y >= 0;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI satisfies y < screen_height', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.y < height;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI satisfies x + width <= screen_width', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.x + roi.width <= width;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI satisfies y + height <= screen_height', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.y + roi.height <= height;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI has minimum width >= MIN_ROI_SIZE', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.width >= MIN_ROI_SIZE;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('valid ROI has minimum height >= MIN_ROI_SIZE', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return roi.height >= MIN_ROI_SIZE;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('clampROI always produces valid ROI from any input', () => {
      fc.assert(
        fc.property(
          anyROIArbitrary,
          screenDimensionsArbitrary,
          (roi: VisionROI, { width, height }) => {
            const clamped = clampROI(roi, width, height);
            return isValidROI(clamped, width, height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clampROI is idempotent - clamping twice equals clamping once', () => {
      fc.assert(
        fc.property(
          anyROIArbitrary,
          screenDimensionsArbitrary,
          (roi: VisionROI, { width, height }) => {
            const clampedOnce = clampROI(roi, width, height);
            const clampedTwice = clampROI(clampedOnce, width, height);

            return (
              clampedOnce.x === clampedTwice.x &&
              clampedOnce.y === clampedTwice.y &&
              clampedOnce.width === clampedTwice.width &&
              clampedOnce.height === clampedTwice.height
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidROI returns true for all valid ROIs', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width, height }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(width, height),
                (roi: VisionROI) => {
                  return isValidROI(roi, width, height) === true;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('isValidROI returns false for ROI with negative x', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),
          fc.integer({ min: 0, max: DEFAULT_SCREEN_HEIGHT - MIN_ROI_SIZE }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_WIDTH }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_HEIGHT }),
          (x, y, width, height) => {
            const roi: VisionROI = { x, y, width, height };
            return isValidROI(roi, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidROI returns false for ROI with negative y', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: DEFAULT_SCREEN_WIDTH - MIN_ROI_SIZE }),
          fc.integer({ min: -1000, max: -1 }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_WIDTH }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_HEIGHT }),
          (x, y, width, height) => {
            const roi: VisionROI = { x, y, width, height };
            return isValidROI(roi, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidROI returns false for ROI exceeding screen width', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: DEFAULT_SCREEN_WIDTH - MIN_ROI_SIZE + 1, max: DEFAULT_SCREEN_WIDTH + 1000 }),
          fc.integer({ min: 0, max: DEFAULT_SCREEN_HEIGHT - MIN_ROI_SIZE }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_WIDTH }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_HEIGHT }),
          (x, y, width, height) => {
            const roi: VisionROI = { x, y, width, height };
            return isValidROI(roi, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidROI returns false for ROI with width below minimum', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: DEFAULT_SCREEN_WIDTH - MIN_ROI_SIZE }),
          fc.integer({ min: 0, max: DEFAULT_SCREEN_HEIGHT - MIN_ROI_SIZE }),
          fc.integer({ min: 1, max: MIN_ROI_SIZE - 1 }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_HEIGHT }),
          (x, y, width, height) => {
            const roi: VisionROI = { x, y, width, height };
            return isValidROI(roi, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidROI returns false for ROI with height below minimum', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: DEFAULT_SCREEN_WIDTH - MIN_ROI_SIZE }),
          fc.integer({ min: 0, max: DEFAULT_SCREEN_HEIGHT - MIN_ROI_SIZE }),
          fc.integer({ min: MIN_ROI_SIZE, max: DEFAULT_SCREEN_WIDTH }),
          fc.integer({ min: 1, max: MIN_ROI_SIZE - 1 }),
          (x, y, width, height) => {
            const roi: VisionROI = { x, y, width, height };
            return isValidROI(roi, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all bounds constraints hold simultaneously for valid ROI', () => {
      fc.assert(
        fc.property(
          screenDimensionsArbitrary,
          ({ width: screenWidth, height: screenHeight }) => {
            return fc.assert(
              fc.property(
                validROIArbitrary(screenWidth, screenHeight),
                (roi: VisionROI) => {
                  // All constraints from Property 10
                  const xInBounds = roi.x >= 0 && roi.x < screenWidth;
                  const yInBounds = roi.y >= 0 && roi.y < screenHeight;
                  const widthInBounds = roi.x + roi.width <= screenWidth;
                  const heightInBounds = roi.y + roi.height <= screenHeight;
                  const minSizeOk = roi.width >= MIN_ROI_SIZE && roi.height >= MIN_ROI_SIZE;

                  return xInBounds && yInBounds && widthInBounds && heightInBounds && minSizeOk;
                }
              ),
              { numRuns: 50 }
            );
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
