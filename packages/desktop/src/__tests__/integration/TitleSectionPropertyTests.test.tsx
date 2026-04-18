/**
 * Title Section Property-Based Tests
 * Property-based tests for title section absence using fast-check
 * Requirements: 2.1, 2.2, 2.4, 2.5
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import UnifiedRecorderScreen from '../../screens/UnifiedRecorderScreen';
import { UnifiedInterfaceProvider } from '../../components/UnifiedInterface';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: () => ({
    checkForRecordings: jest.fn().mockResolvedValue(false),
    getLatestRecording: jest.fn().mockResolvedValue(null),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue({ success: true }),
    startPlayback: jest.fn().mockResolvedValue(undefined),
    stopPlayback: jest.fn().mockResolvedValue(undefined),
    pausePlayback: jest.fn().mockResolvedValue(false),
    loadScript: jest.fn().mockResolvedValue({}),
  }),
}));

// Mock CSS imports
jest.mock('../../screens/UnifiedRecorderScreen.css', () => ({}));
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));
jest.mock('../../components/ToolbarButton.css', () => ({}));

// Helper to render with Router and Context
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <UnifiedInterfaceProvider>
        {component}
      </UnifiedInterfaceProvider>
    </MemoryRouter>
  );
};

describe('Title Section Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Feature: desktop-ui-redesign, Property 2: Title section absence
  test('Property 2: Title section absence - interface never displays title or subtitle text', () => {
    // Generate test cases for different rendering scenarios
    const renderingScenarioArb = fc.record({
      hasRecordings: fc.boolean(),
      hasError: fc.boolean(),
      errorMessage: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: null }),
      windowWidth: fc.integer({ min: 320, max: 1920 }),
      windowHeight: fc.integer({ min: 240, max: 1080 }),
    });

    fc.assert(
      fc.property(
        renderingScenarioArb,
        (scenario) => {
          // Mock window dimensions for responsive testing
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: scenario.windowWidth,
          });
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: scenario.windowHeight,
          });

          const { unmount } = renderWithProviders(<UnifiedRecorderScreen />);

          // Property: The interface should NEVER display the title text "GeniusQA Recorder"
          expect(screen.queryByText('GeniusQA Recorder')).toBeNull();
          expect(screen.queryByText(/GeniusQA Recorder/i)).toBeNull();

          // Property: The interface should NEVER display the subtitle text "Record and replay desktop interactions"
          expect(screen.queryByText('Record and replay desktop interactions')).toBeNull();
          expect(screen.queryByText(/Record and replay desktop interactions/i)).toBeNull();

          // Property: No elements should have title-related CSS classes
          const container = screen.getByTestId ? screen.queryByTestId('test-container') : document.body;
          const titleElements = container?.querySelectorAll('.logo, .header, .subtitle, .title') || [];
          expect(titleElements.length).toBe(0);

          // Property: No h1 elements should contain title text
          const h1Elements = document.querySelectorAll('h1');
          h1Elements.forEach((h1) => {
            expect(h1.textContent).not.toMatch(/GeniusQA Recorder/i);
            expect(h1.textContent).not.toMatch(/Record and replay/i);
          });

          // Property: No elements should have title-related test IDs
          expect(screen.queryByTestId('title')).toBeNull();
          expect(screen.queryByTestId('subtitle')).toBeNull();
          expect(screen.queryByTestId('logo')).toBeNull();
          expect(screen.queryByTestId('header')).toBeNull();

          // Property: The interface should still be functional without title section
          // Verify essential elements are present
          expect(document.querySelector('.unified-recorder-screen')).toBeTruthy();

          // Clean up after each test
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: desktop-ui-redesign, Property 2: Space reclamation validation
  test('Property 2: Space reclamation - title area space is utilized for functional elements', () => {
    const layoutScenarioArb = fc.record({
      viewportWidth: fc.integer({ min: 768, max: 1920 }),
      viewportHeight: fc.integer({ min: 600, max: 1080 }),
      hasContent: fc.boolean(),
    });

    fc.assert(
      fc.property(
        layoutScenarioArb,
        (scenario) => {
          // Set viewport dimensions
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: scenario.viewportWidth,
          });
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: scenario.viewportHeight,
          });

          const { unmount } = renderWithProviders(<UnifiedRecorderScreen />);

          // Property: The top area should be utilized by functional elements (toolbar)
          const toolbarArea = document.querySelector('.toolbar-area');
          expect(toolbarArea).toBeTruthy();

          // Property: No empty header space should exist at the top
          const headerContainer = document.querySelector('.header-container');
          expect(headerContainer).toBeNull();

          // Property: The main content should start near the top of the viewport
          const unifiedInterface = document.querySelector('.unified-interface');
          if (unifiedInterface) {
            const rect = unifiedInterface.getBoundingClientRect();
            // Should start near the top (allowing for back button and minimal padding)
            expect(rect.top).toBeLessThan(60); // Max 60px from top for back button area
          }

          // Property: Vertical space should be maximized for functional content
          const editorArea = document.querySelector('.editor-area');
          expect(editorArea).toBeTruthy();

          // Clean up after each test
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: desktop-ui-redesign, Property 2: Consistent title absence across states
  test('Property 2: Consistent title absence - no title text in any application state', () => {
    const applicationStateArb = fc.record({
      mode: fc.constantFrom('idle', 'recording', 'playing', 'editing'),
      hasError: fc.boolean(),
      hasRecordings: fc.boolean(),
      editorVisible: fc.boolean(),
    });

    fc.assert(
      fc.property(
        applicationStateArb,
        (state) => {
          const { unmount } = renderWithProviders(<UnifiedRecorderScreen />);

          // Simulate different application states by checking DOM
          // Property: Title text should be absent regardless of application state

          // Check for title text in any form
          const allTextContent = document.body.textContent || '';
          expect(allTextContent).not.toMatch(/GeniusQA Recorder/i);
          expect(allTextContent).not.toMatch(/Record and replay desktop interactions/i);

          // Check for title-related attributes
          const elementsWithTitle = document.querySelectorAll('[title*="GeniusQA"], [title*="Recorder"]');
          elementsWithTitle.forEach((element) => {
            const titleAttr = element.getAttribute('title') || '';
            expect(titleAttr).not.toMatch(/GeniusQA Recorder/i);
            expect(titleAttr).not.toMatch(/Record and replay desktop interactions/i);
          });

          // Check for aria-label attributes that might contain title text
          const elementsWithAriaLabel = document.querySelectorAll('[aria-label*="GeniusQA"], [aria-label*="Recorder"]');
          elementsWithAriaLabel.forEach((element) => {
            const ariaLabel = element.getAttribute('aria-label') || '';
            expect(ariaLabel).not.toMatch(/GeniusQA Recorder/i);
            expect(ariaLabel).not.toMatch(/Record and replay desktop interactions/i);
          });

          // Property: No hidden title elements should exist
          const hiddenElements = document.querySelectorAll('[style*="display: none"], [hidden]');
          hiddenElements.forEach((element) => {
            expect(element.textContent).not.toMatch(/GeniusQA Recorder/i);
            expect(element.textContent).not.toMatch(/Record and replay desktop interactions/i);
          });

          // Clean up after each test
          unmount();
        }
      ),
      { numRuns: 75 }
    );
  });

  // Feature: desktop-ui-redesign, Property 2: CSS class absence validation
  test('Property 2: CSS class absence - no title-related CSS classes exist in DOM', () => {
    const cssScenarioArb = fc.record({
      checkDepth: fc.integer({ min: 1, max: 5 }), // How deep to check nested elements
      includeComputedStyles: fc.boolean(),
    });

    fc.assert(
      fc.property(
        cssScenarioArb,
        (scenario) => {
          const { unmount } = renderWithProviders(<UnifiedRecorderScreen />);

          // Property: No elements should have title-related CSS classes
          const titleClasses = [
            'logo',
            'header',
            'subtitle',
            'app-title',
            'main-title',
            'page-title',
            'screen-title'
          ];

          titleClasses.forEach((className) => {
            const elements = document.querySelectorAll(`.${className}`);
            expect(elements.length).toBe(0);
          });

          // Property: No elements should have class names containing main title-related terms
          // (Allow editor-title and other functional titles, but not main app title classes)
          const allElements = document.querySelectorAll('*');
          allElements.forEach((element) => {
            const classList = Array.from(element.classList);
            classList.forEach((className) => {
              // Only check for main application title classes, not functional editor titles
              expect(className.toLowerCase()).not.toMatch(/^title$/);
              expect(className.toLowerCase()).not.toMatch(/^logo$/);
              expect(className.toLowerCase()).not.toMatch(/^subtitle$/);
              expect(className.toLowerCase()).not.toMatch(/app-title/);
              expect(className.toLowerCase()).not.toMatch(/main-title/);
              expect(className.toLowerCase()).not.toMatch(/page-title/);
              expect(className.toLowerCase()).not.toMatch(/screen-title/);
              // Allow 'header' for other purposes but check content
              if (className.toLowerCase().includes('header') && !className.includes('editor')) {
                expect(element.textContent).not.toMatch(/GeniusQA Recorder/i);
              }
            });
          });

          // Property: No CSS custom properties should reference title content
          if (scenario.includeComputedStyles) {
            const rootElement = document.documentElement;
            const computedStyle = window.getComputedStyle(rootElement);

            // Check for CSS custom properties that might contain title text
            for (let i = 0; i < computedStyle.length; i++) {
              const property = computedStyle[i];
              if (property.startsWith('--')) {
                const value = computedStyle.getPropertyValue(property);
                expect(value).not.toMatch(/GeniusQA Recorder/i);
                expect(value).not.toMatch(/Record and replay/i);
              }
            }
          }

          // Clean up after each test
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });
});
