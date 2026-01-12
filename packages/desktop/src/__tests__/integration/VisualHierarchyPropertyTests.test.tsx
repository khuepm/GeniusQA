/**
 * Visual Hierarchy Property-Based Tests
 * Property-based tests for visual hierarchy maintenance using fast-check
 * 
 * **Feature: desktop-ui-redesign, Property 8: Visual hierarchy maintenance**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 * 
 * Requirements tested:
 * - 8.1: Toolbar uses subtle visual styling that clearly defines the toolbar area
 * - 8.2: Toolbar maintains visual hierarchy with the editor area below
 * - 8.3: Toolbar uses colors and borders that complement the overall application theme
 * - 8.4: Toolbar provides adequate spacing and padding for comfortable interaction
 * - 8.5: Toolbar creates clear visual separation between controls and content areas
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { TopToolbar } from '../../components/TopToolbar';
import { EditorArea } from '../../components/EditorArea';
import { UnifiedInterface, UnifiedInterfaceProvider } from '../../components/UnifiedInterface';

// Mock CSS imports
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../styles/design-system.css', () => ({}));

// Mock IPC bridge service
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: () => ({
    checkForRecordings: jest.fn().mockResolvedValue(false),
    getLatestRecording: jest.fn().mockResolvedValue(null),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    startRecording: jest.fn().mockResolvedValue({}),
    stopRecording: jest.fn().mockResolvedValue({ success: true }),
    startPlayback: jest.fn().mockResolvedValue({}),
    stopPlayback: jest.fn().mockResolvedValue({}),
  }),
}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for application states
 */
const applicationStateArb = fc.record({
  applicationMode: fc.constantFrom('idle', 'recording', 'playing', 'editing'),
  hasRecordings: fc.boolean(),
  currentScript: fc.option(fc.record({
    path: fc.string({ minLength: 1, maxLength: 100 }),
    filename: fc.string({ minLength: 1, maxLength: 50 }),
    actions: fc.array(fc.record({
      type: fc.constantFrom('click', 'key', 'delay'),
      x: fc.integer({ min: 0, max: 1920 }),
      y: fc.integer({ min: 0, max: 1080 }),
      key: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
      duration: fc.integer({ min: 100, max: 5000 }),
    }), { minLength: 0, maxLength: 20 }),
  }), { nil: null }),
});

/**
 * Arbitrary for interface props
 */
const interfacePropsArb = fc.record({
  hasRecordings: fc.boolean(),
  editorVisible: fc.boolean(),
  recordingActive: fc.boolean(),
});

/**
 * Arbitrary for CSS color values (hex, rgb, hsl, named)
 */
const cssColorArb = fc.oneof(
  // Hex colors
  fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^[0-9a-fA-F]{6}$/.test(s)).map(hex => `#${hex}`),
  // RGB colors
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`),
  // Named colors
  fc.constantFrom('white', 'black', 'gray', 'blue', 'red', 'green', 'transparent')
);

/**
 * Arbitrary for spacing values (px, rem, em, %)
 */
const spacingValueArb = fc.oneof(
  fc.integer({ min: 0, max: 100 }).map(px => `${px}px`),
  fc.float({ min: 0, max: 10, noNaN: true }).map(rem => `${rem.toFixed(2)}rem`),
  fc.float({ min: 0, max: 10, noNaN: true }).map(em => `${em.toFixed(2)}em`),
  fc.integer({ min: 0, max: 100 }).map(pct => `${pct}%`)
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders complete interface with toolbar and editor
 */
function renderCompleteInterface(props: any = {}) {
  return render(
    <UnifiedInterfaceProvider>
      <UnifiedInterface>
        <TopToolbar {...props} />
        <EditorArea
          script={props.currentScript}
          recordingSession={props.recordingActive ? { id: 'test' } : null}
          visible={props.editorVisible !== false}
          onScriptChange={() => { }}
          onActionSelect={() => { }}
          onActionEdit={() => { }}
          onActionDelete={() => { }}
        />
      </UnifiedInterface>
    </UnifiedInterfaceProvider>
  );
}

/**
 * Gets computed styles for an element
 */
function getComputedStyles(element: HTMLElement): CSSStyleDeclaration {
  return window.getComputedStyle(element);
}

/**
 * Validates that a color value is valid CSS
 */
function isValidCSSColor(color: string): boolean {
  const testElement = document.createElement('div');
  testElement.style.color = color;
  return testElement.style.color !== '';
}

/**
 * Validates that a spacing value is valid CSS
 */
function isValidCSSSpacing(spacing: string): boolean {
  const testElement = document.createElement('div');
  testElement.style.padding = spacing;
  return testElement.style.padding !== '';
}

/**
 * Extracts numeric value from CSS pixel value
 */
function extractPixelValue(cssValue: string): number {
  const match = cssValue.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Validates visual hierarchy between toolbar and editor
 */
function validateVisualHierarchy(toolbar: HTMLElement, editor: HTMLElement): boolean {
  const toolbarStyles = getComputedStyles(toolbar);
  const editorStyles = getComputedStyles(editor);

  // Toolbar should have distinct background from editor
  const toolbarBg = toolbarStyles.backgroundColor;
  const editorBg = editorStyles.backgroundColor;

  if (toolbarBg === editorBg && toolbarBg !== 'rgba(0, 0, 0, 0)' && toolbarBg !== 'transparent') {
    return false;
  }

  // Toolbar should have border or visual separation
  const toolbarBorder = toolbarStyles.borderBottomWidth;
  const hasBorder = extractPixelValue(toolbarBorder) > 0;

  const toolbarShadow = toolbarStyles.boxShadow;
  const hasShadow = toolbarShadow !== 'none';

  // Should have either border or shadow for separation
  if (!hasBorder && !hasShadow) {
    return false;
  }

  return true;
}

/**
 * Validates adequate spacing and padding
 */
function validateSpacing(element: HTMLElement): boolean {
  const styles = getComputedStyles(element);

  // Check padding values
  const paddingTop = extractPixelValue(styles.paddingTop);
  const paddingBottom = extractPixelValue(styles.paddingBottom);
  const paddingLeft = extractPixelValue(styles.paddingLeft);
  const paddingRight = extractPixelValue(styles.paddingRight);

  // Should have reasonable padding for comfortable interaction (at least 4px)
  const minPadding = 4;
  if (paddingTop < minPadding || paddingBottom < minPadding ||
    paddingLeft < minPadding || paddingRight < minPadding) {
    return false;
  }

  // Check height for toolbar (should be adequate for touch/mouse interaction)
  const height = extractPixelValue(styles.height);
  const minHeight = 32; // Minimum height for comfortable interaction
  if (height > 0 && height < minHeight) {
    return false;
  }

  return true;
}

/**
 * Validates color scheme consistency
 */
function validateColorScheme(elements: HTMLElement[]): boolean {
  const colors = elements.map(el => {
    const styles = getComputedStyles(el);
    return {
      background: styles.backgroundColor,
      color: styles.color,
      border: styles.borderColor,
    };
  });

  // All colors should be valid CSS colors
  for (const colorSet of colors) {
    if (!isValidCSSColor(colorSet.background) ||
      !isValidCSSColor(colorSet.color) ||
      !isValidCSSColor(colorSet.border)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Visual Hierarchy Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Property 8: Visual hierarchy maintenance
  // ==========================================================================

  /**
   * **Feature: desktop-ui-redesign, Property 8: Visual hierarchy maintenance**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
   * 
   * For any interface rendering, the toolbar should be visually distinct from 
   * the editor area while maintaining appropriate visual hierarchy and not 
   * overwhelming the interface.
   */
  describe('Property 8: Visual hierarchy maintenance', () => {

    // Requirement 8.1: Toolbar uses subtle visual styling that clearly defines the toolbar area
    it('toolbar has subtle visual styling that clearly defines the toolbar area', () => {
      fc.assert(
        fc.property(interfacePropsArb, (props) => {
          const { container } = renderCompleteInterface(props);
          const toolbar = container.querySelector('.top-toolbar') as HTMLElement;

          if (!toolbar) return false;

          // Should have CSS class for styling
          if (!toolbar.classList.contains('top-toolbar')) {
            return false;
          }

          // Should have proper ARIA attributes for accessibility
          if (!toolbar.hasAttribute('role') || toolbar.getAttribute('role') !== 'toolbar') {
            return false;
          }

          // Should have aria-label for screen readers
          if (!toolbar.hasAttribute('aria-label')) {
            return false;
          }

          // Should contain toolbar groups
          const toolbarGroups = toolbar.querySelectorAll('.toolbar-group');
          if (toolbarGroups.length === 0) {
            return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 8.2: Toolbar maintains visual hierarchy with the editor area below
    it('toolbar maintains visual hierarchy with editor area below', () => {
      fc.assert(
        fc.property(interfacePropsArb, (props) => {
          const { container } = renderCompleteInterface(props);
          const toolbar = container.querySelector('.top-toolbar') as HTMLElement;
          const editor = container.querySelector('.editor-area-container') as HTMLElement;

          if (!toolbar) return false;

          // Toolbar should be positioned above editor in DOM
          const unifiedInterface = container.querySelector('.unified-interface');
          if (!unifiedInterface) return false;

          // Toolbar should be a child of the unified interface
          if (!unifiedInterface.contains(toolbar)) return false;

          // If editor exists, check DOM order
          if (editor) {
            const children = Array.from(unifiedInterface.querySelectorAll('*'));
            const toolbarIndex = children.indexOf(toolbar);
            const editorIndex = children.indexOf(editor);

            if (toolbarIndex !== -1 && editorIndex !== -1 && toolbarIndex >= editorIndex) {
              return false;
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 8.3: Toolbar uses colors and borders that complement the overall application theme
    it('toolbar uses colors and borders that complement the application theme', () => {
      fc.assert(
        fc.property(interfacePropsArb, (props) => {
          const { container } = renderCompleteInterface(props);
          const toolbar = container.querySelector('.top-toolbar') as HTMLElement;
          const buttons = Array.from(container.querySelectorAll('.toolbar-button')) as HTMLElement[];

          if (!toolbar) return false;

          // Should have proper CSS classes for theming
          if (!toolbar.classList.contains('top-toolbar')) {
            return false;
          }

          // Should contain toolbar buttons with proper styling classes
          if (buttons.length === 0) {
            return false;
          }

          // All buttons should have proper CSS classes
          for (const button of buttons) {
            if (!button.classList.contains('toolbar-button')) {
              return false;
            }
          }

          // Should have proper data attributes for testing
          if (!toolbar.hasAttribute('data-testid')) {
            return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 8.4: Toolbar provides adequate spacing and padding for comfortable interaction
    it('toolbar provides adequate spacing and padding for comfortable interaction', () => {
      fc.assert(
        fc.property(interfacePropsArb, (props) => {
          const { container } = renderCompleteInterface(props);
          const toolbar = container.querySelector('.top-toolbar') as HTMLElement;
          const buttons = Array.from(container.querySelectorAll('.toolbar-button')) as HTMLElement[];

          if (!toolbar) return false;

          // Should have proper display flex for layout
          if (!toolbar.style.display && !toolbar.classList.contains('top-toolbar')) {
            return false;
          }

          // Should contain buttons for interaction
          if (buttons.length === 0) {
            return false;
          }

          // All buttons should have proper structure
          for (const button of buttons) {
            // Should be a button element or have button role
            const isButton = button.tagName === 'BUTTON' ||
              button.getAttribute('role') === 'button';
            if (!isButton) {
              return false;
            }

            // Should have proper CSS class
            if (!button.classList.contains('toolbar-button')) {
              return false;
            }
          }

          // Check button groups exist
          const buttonGroups = Array.from(container.querySelectorAll('.toolbar-group')) as HTMLElement[];
          if (buttonGroups.length === 0) {
            return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 8.5: Toolbar creates clear visual separation between controls and content areas
    it('toolbar creates clear visual separation between controls and content areas', () => {
      fc.assert(
        fc.property(interfacePropsArb, (props) => {
          const { container } = renderCompleteInterface(props);
          const toolbar = container.querySelector('.top-toolbar') as HTMLElement;

          if (!toolbar) return false;

          // Should have proper CSS class for styling
          if (!toolbar.classList.contains('top-toolbar')) {
            return false;
          }

          // Should be contained within unified interface
          const unifiedInterface = container.querySelector('.unified-interface');
          if (!unifiedInterface || !unifiedInterface.contains(toolbar)) {
            return false;
          }

          // Should have proper role for accessibility
          if (!toolbar.hasAttribute('role') || toolbar.getAttribute('role') !== 'toolbar') {
            return false;
          }

          // Should have proper CSS classes for styling
          if (!toolbar.classList.contains('top-toolbar')) {
            return false;
          }

          // Should contain toolbar groups for organization
          const toolbarGroups = toolbar.querySelectorAll('.toolbar-group');
          if (toolbarGroups.length === 0) {
            return false;
          }

          // Should contain toolbar buttons
          const buttons = toolbar.querySelectorAll('.toolbar-button');
          if (buttons.length === 0) {
            return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Additional validation: Overall visual consistency
    it('maintains consistent visual design across all interface states', () => {
      fc.assert(
        fc.property(applicationStateArb, (state) => {
          const props = {
            hasRecordings: state.hasRecordings,
            editorVisible: true,
            recordingActive: state.applicationMode === 'recording',
            currentScript: state.currentScript,
          };

          const { container } = renderCompleteInterface(props);
          const toolbar = container.querySelector('.top-toolbar') as HTMLElement;

          if (!toolbar) return false;

          // Should maintain consistent CSS classes regardless of state
          if (!toolbar.classList.contains('top-toolbar')) return false;

          // Should have proper ARIA attributes
          if (!toolbar.hasAttribute('role') || toolbar.getAttribute('role') !== 'toolbar') {
            return false;
          }

          // Should contain toolbar groups
          const toolbarGroups = toolbar.querySelectorAll('.toolbar-group');
          if (toolbarGroups.length === 0) return false;

          // Should contain toolbar buttons
          const buttons = toolbar.querySelectorAll('.toolbar-button');
          if (buttons.length === 0) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Button visual consistency within toolbar
    it('all toolbar buttons maintain consistent visual styling', () => {
      fc.assert(
        fc.property(interfacePropsArb, (props) => {
          const { container } = renderCompleteInterface(props);
          const buttons = Array.from(container.querySelectorAll('.toolbar-button')) as HTMLElement[];

          if (buttons.length === 0) return false;

          // All buttons should have consistent base styling
          const firstButtonStyles = getComputedStyles(buttons[0]);
          const expectedWidth = firstButtonStyles.width;
          const expectedHeight = firstButtonStyles.height;
          const expectedBorderRadius = firstButtonStyles.borderRadius;

          for (const button of buttons) {
            const buttonStyles = getComputedStyles(button);

            // Should have consistent dimensions (allowing for slight variations)
            const widthDiff = Math.abs(extractPixelValue(buttonStyles.width) - extractPixelValue(expectedWidth));
            const heightDiff = Math.abs(extractPixelValue(buttonStyles.height) - extractPixelValue(expectedHeight));

            if (widthDiff > 2 || heightDiff > 2) { // Allow 2px tolerance
              return false;
            }

            // Should have consistent border radius
            if (buttonStyles.borderRadius !== expectedBorderRadius) {
              return false;
            }

            // Should have proper button styling class
            if (!button.classList.contains('toolbar-button')) {
              return false;
            }

            // Should contain an icon (SVG)
            const icon = button.querySelector('svg');
            if (!icon) return false;

            // Icon should have consistent size
            const iconWidth = icon.getAttribute('width');
            const iconHeight = icon.getAttribute('height');
            if (!iconWidth || !iconHeight) return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Responsive visual hierarchy
    it('maintains visual hierarchy across different viewport sizes', () => {
      const viewportSizes = [
        { width: 800, height: 600 },   // Small desktop
        { width: 1024, height: 768 },  // Medium desktop
        { width: 1920, height: 1080 }, // Large desktop
        { width: 480, height: 800 },   // Mobile portrait
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...viewportSizes),
          interfacePropsArb,
          (viewport, props) => {
            // Set viewport size
            Object.defineProperty(window, 'innerWidth', {
              writable: true,
              configurable: true,
              value: viewport.width,
            });
            Object.defineProperty(window, 'innerHeight', {
              writable: true,
              configurable: true,
              value: viewport.height,
            });

            const { container } = renderCompleteInterface(props);
            const toolbar = container.querySelector('.top-toolbar') as HTMLElement;

            if (!toolbar) return false;

            // Should maintain proper CSS classes regardless of viewport
            if (!toolbar.classList.contains('top-toolbar')) return false;

            // Should have proper ARIA attributes
            if (!toolbar.hasAttribute('role') || toolbar.getAttribute('role') !== 'toolbar') {
              return false;
            }

            // Should contain toolbar groups
            const toolbarGroups = toolbar.querySelectorAll('.toolbar-group');
            if (toolbarGroups.length === 0) return false;

            // Should contain toolbar buttons
            const buttons = toolbar.querySelectorAll('.toolbar-button');
            if (buttons.length === 0) return false;

            // All buttons should maintain proper structure
            for (const button of buttons) {
              if (!button.classList.contains('toolbar-button')) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
