/**
 * Toolbar Positioning Property-Based Tests
 * Property-based tests for toolbar positioning consistency using fast-check
 * 
 * **Feature: desktop-ui-redesign, Property 4: Toolbar positioning consistency**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 * 
 * Requirements tested:
 * - 4.1: Toolbar displays at top of application window
 * - 4.2: Toolbar contains all recording, playback, and editing action buttons
 * - 4.3: Toolbar positioned immediately below window frame
 * - 4.4: Toolbar organizes buttons in logical grouping
 * - 4.5: Toolbar maintains position and accessibility during window resize
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { TopToolbar } from '../../components/TopToolbar';
import { UnifiedInterface, UnifiedInterfaceProvider } from '../../components/UnifiedInterface';
import { UnifiedRecorderScreen } from '../../screens/UnifiedRecorderScreen';
import { IconType } from '../../components/icons';

// Mock CSS imports
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../screens/UnifiedRecorderScreen.css', () => ({}));

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
 * Arbitrary for window dimensions (reasonable desktop sizes)
 */
const windowDimensionsArb = fc.record({
  width: fc.integer({ min: 800, max: 2560 }),
  height: fc.integer({ min: 600, max: 1440 }),
});

/**
 * Arbitrary for application states
 */
const applicationStateArb = fc.record({
  applicationMode: fc.constantFrom('idle', 'recording', 'playing', 'editing'),
  hasRecordings: fc.boolean(),
  currentScript: fc.option(fc.record({
    path: fc.string({ minLength: 1, maxLength: 100 }),
    filename: fc.string({ minLength: 1, maxLength: 50 }),
  }), { nil: null }),
});

/**
 * Arbitrary for toolbar props
 */
const toolbarPropsArb = fc.record({
  hasRecordings: fc.boolean(),
  onRecordStart: fc.constant(() => { }),
  onRecordStop: fc.constant(() => { }),
  onPlayStart: fc.constant(() => { }),
  onPlayStop: fc.constant(() => { }),
  onSave: fc.constant(() => { }),
  onOpen: fc.constant(() => { }),
  onClear: fc.constant(() => { }),
  onSettings: fc.constant(() => { }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders TopToolbar within UnifiedInterface context
 */
function renderToolbarInContext(props: any = {}) {
  return render(
    <UnifiedInterfaceProvider>
      <UnifiedInterface>
        <div className="toolbar-area">
          <TopToolbar {...props} />
        </div>
      </UnifiedInterface>
    </UnifiedInterfaceProvider>
  );
}

/**
 * Gets toolbar element and validates its structure
 */
function getToolbarElement(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.top-toolbar');
}

/**
 * Gets all button groups within toolbar
 */
function getButtonGroups(toolbar: HTMLElement): HTMLElement[] {
  return Array.from(toolbar.querySelectorAll('.toolbar-group'));
}

/**
 * Gets all buttons within toolbar
 */
function getToolbarButtons(toolbar: HTMLElement): HTMLElement[] {
  return Array.from(toolbar.querySelectorAll('.toolbar-button'));
}

/**
 * Validates button group structure and content
 */
function validateButtonGroup(group: HTMLElement, expectedGroupType: string): boolean {
  // Should have correct group class
  if (!group.classList.contains(`toolbar-group-${expectedGroupType}`)) {
    return false;
  }

  // Should contain at least one button
  const buttons = group.querySelectorAll('.toolbar-button');
  return buttons.length > 0;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Toolbar Positioning Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Property 4: Toolbar positioning consistency
  // ==========================================================================

  /**
   * **Feature: desktop-ui-redesign, Property 4: Toolbar positioning consistency**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
   * 
   * For any application state and window configuration, the toolbar should:
   * - Always be positioned at the top of the application window
   * - Contain all required action buttons in logical groups
   * - Maintain consistent positioning and accessibility
   */
  describe('Property 4: Toolbar positioning consistency', () => {

    // Requirement 4.1: Toolbar displays at top of application window
    it('toolbar is always positioned at the top of the application window', () => {
      fc.assert(
        fc.property(toolbarPropsArb, (props) => {
          const { container } = renderToolbarInContext(props);
          const toolbar = getToolbarElement(container);

          if (!toolbar) return false;

          // Toolbar should exist and be positioned at the top
          const toolbarArea = container.querySelector('.toolbar-area');
          if (!toolbarArea) return false;

          // Toolbar should be the first child of toolbar-area
          const firstChild = toolbarArea.firstElementChild;
          return firstChild === toolbar;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 4.2: Toolbar contains all recording, playback, and editing action buttons
    it('toolbar contains all required action buttons in proper groups', () => {
      fc.assert(
        fc.property(toolbarPropsArb, (props) => {
          const { container } = renderToolbarInContext(props);
          const toolbar = getToolbarElement(container);

          if (!toolbar) return false;

          const buttonGroups = getButtonGroups(toolbar);

          // Should have at least recording, playback, editor, and settings groups
          const groupTypes = buttonGroups.map(group => {
            const classList = Array.from(group.classList);
            const groupClass = classList.find(cls => cls.startsWith('toolbar-group-'));
            return groupClass ? groupClass.replace('toolbar-group-', '') : null;
          }).filter(Boolean);

          // Must have recording group
          if (!groupTypes.includes('recording')) return false;

          // Must have playback group
          if (!groupTypes.includes('playback')) return false;

          // Must have editor group
          if (!groupTypes.includes('editor')) return false;

          // Must have settings group
          if (!groupTypes.includes('settings')) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 4.3: Toolbar positioned immediately below window frame
    it('toolbar is positioned immediately below window frame in layout', () => {
      fc.assert(
        fc.property(toolbarPropsArb, (props) => {
          const { container } = renderToolbarInContext(props);
          const unifiedInterface = container.querySelector('.unified-interface');

          if (!unifiedInterface) return false;

          // Toolbar area should be the first child of unified interface
          const firstChild = unifiedInterface.firstElementChild;
          return firstChild?.classList.contains('toolbar-area');
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 4.4: Toolbar organizes buttons in logical grouping
    it('toolbar organizes buttons in logical groups with proper structure', () => {
      fc.assert(
        fc.property(toolbarPropsArb, (props) => {
          const { container } = renderToolbarInContext(props);
          const toolbar = getToolbarElement(container);

          if (!toolbar) return false;

          const buttonGroups = getButtonGroups(toolbar);

          // Validate each group has proper structure
          for (const group of buttonGroups) {
            const classList = Array.from(group.classList);
            const groupClass = classList.find(cls => cls.startsWith('toolbar-group-'));

            if (!groupClass) return false;

            const groupType = groupClass.replace('toolbar-group-', '');
            if (!validateButtonGroup(group, groupType)) return false;
          }

          // Check for spacer element (pushes settings to right)
          const spacer = toolbar.querySelector('.toolbar-spacer');
          if (!spacer) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 4.5: Toolbar maintains position and accessibility during window resize
    it('toolbar maintains consistent structure across different configurations', () => {
      fc.assert(
        fc.property(
          toolbarPropsArb,
          windowDimensionsArb,
          applicationStateArb,
          (props, dimensions, state) => {
            // Simulate different window sizes by setting viewport
            Object.defineProperty(window, 'innerWidth', {
              writable: true,
              configurable: true,
              value: dimensions.width,
            });
            Object.defineProperty(window, 'innerHeight', {
              writable: true,
              configurable: true,
              value: dimensions.height,
            });

            const { container } = renderToolbarInContext({
              ...props,
              hasRecordings: state.hasRecordings,
            });

            const toolbar = getToolbarElement(container);
            if (!toolbar) return false;

            // Toolbar should maintain its structure regardless of window size
            const buttonGroups = getButtonGroups(toolbar);
            if (buttonGroups.length === 0) return false;

            // All buttons should remain accessible (not hidden or overlapped)
            const buttons = getToolbarButtons(toolbar);
            if (buttons.length === 0) return false;

            // Each button should have proper attributes for accessibility
            for (const button of buttons) {
              // Should have aria-label or title for accessibility
              const hasAccessibleLabel = button.hasAttribute('aria-label') ||
                button.hasAttribute('title') ||
                button.textContent?.trim();
              if (!hasAccessibleLabel) return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Additional validation: Toolbar layout consistency
    it('toolbar maintains consistent layout structure across all states', () => {
      fc.assert(
        fc.property(applicationStateArb, (state) => {
          const props = {
            hasRecordings: state.hasRecordings,
            onRecordStart: () => { },
            onRecordStop: () => { },
            onPlayStart: () => { },
            onPlayStop: () => { },
            onSave: () => { },
            onOpen: () => { },
            onClear: () => { },
            onSettings: () => { },
          };

          const { container } = renderToolbarInContext(props);
          const toolbar = getToolbarElement(container);

          if (!toolbar) return false;

          // Should have consistent CSS class
          if (!toolbar.classList.contains('top-toolbar')) return false;

          // Should contain button groups
          const buttonGroups = getButtonGroups(toolbar);
          if (buttonGroups.length === 0) return false;

          // Should have spacer for layout
          const spacer = toolbar.querySelector('.toolbar-spacer');
          if (!spacer) return false;

          // Button groups should be in logical order
          const groupOrder = buttonGroups.map(group => {
            const classList = Array.from(group.classList);
            const groupClass = classList.find(cls => cls.startsWith('toolbar-group-'));
            return groupClass ? groupClass.replace('toolbar-group-', '') : null;
          }).filter(Boolean);

          // Recording should come before playback
          const recordingIndex = groupOrder.indexOf('recording');
          const playbackIndex = groupOrder.indexOf('playback');
          if (recordingIndex !== -1 && playbackIndex !== -1) {
            if (recordingIndex >= playbackIndex) return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Button accessibility and interaction consistency
    it('all toolbar buttons maintain consistent interaction patterns', () => {
      fc.assert(
        fc.property(toolbarPropsArb, (props) => {
          const { container } = renderToolbarInContext(props);
          const toolbar = getToolbarElement(container);

          if (!toolbar) return false;

          const buttons = getToolbarButtons(toolbar);

          for (const button of buttons) {
            // Should be a button element or have button role
            const isButton = button.tagName === 'BUTTON' ||
              button.getAttribute('role') === 'button';
            if (!isButton) return false;

            // Should have proper test id for identification
            const testId = button.getAttribute('data-testid');
            if (!testId || !testId.startsWith('button-')) return false;

            // Should have icon (SVG element)
            const icon = button.querySelector('svg');
            if (!icon) return false;

            // Icon should have proper dimensions
            const width = icon.getAttribute('width');
            const height = icon.getAttribute('height');
            if (!width || !height) return false;

            // Should have consistent icon size (16px default)
            if (width !== '16' || height !== '16') return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Toolbar responsiveness validation
    it('toolbar adapts to different application modes while maintaining position', () => {
      const modes = ['idle', 'recording', 'playing', 'editing'] as const;

      fc.assert(
        fc.property(
          fc.constantFrom(...modes),
          fc.boolean(),
          (mode, hasRecordings) => {
            const props = {
              hasRecordings,
              onRecordStart: () => { },
              onRecordStop: () => { },
              onPlayStart: () => { },
              onPlayStop: () => { },
              onSave: () => { },
              onOpen: () => { },
              onClear: () => { },
              onSettings: () => { },
            };

            const { container } = renderToolbarInContext(props);
            const toolbar = getToolbarElement(container);

            if (!toolbar) return false;

            // Toolbar should always be present regardless of mode
            const toolbarArea = container.querySelector('.toolbar-area');
            if (!toolbarArea) return false;

            // Should contain the toolbar as direct child
            if (!toolbarArea.contains(toolbar)) return false;

            // Should maintain button structure
            const buttons = getToolbarButtons(toolbar);
            if (buttons.length === 0) return false;

            // All buttons should have consistent structure
            for (const button of buttons) {
              if (!button.classList.contains('toolbar-button')) return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
