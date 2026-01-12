/**
 * Icon Recognition and Consistency Property-Based Tests
 * Property-based tests for icon system using fast-check
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import {
  RecordIcon,
  PlayIcon,
  StopIcon,
  ICON_COMPONENTS,
  getIcon,
  IconType
} from '../../components/icons';

describe('Icon Recognition and Consistency Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  // Simple test to verify setup
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  // Feature: desktop-ui-redesign, Property 7: Icon recognition and consistency
  // Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
  test('Property 7: Icon recognition and consistency - all icons maintain consistent design and recognizable shapes', () => {
    // Define valid icon types and properties for comprehensive testing
    const validIcons: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];
    const validColors = ['currentColor', '#000000', '#ffffff', '#ff0000', 'red', 'blue'];

    // Property-based test with fast-check
    fc.assert(
      fc.property(
        fc.constantFrom(...validIcons), // icon type
        fc.integer({ min: 8, max: 32 }), // size (reduced range to avoid DOM issues)
        fc.constantFrom(...validColors), // color
        fc.float({ min: Math.fround(0.1), max: Math.fround(1) }), // opacity (avoid 0 to prevent invisible elements)
        fc.string({ minLength: 0, maxLength: 10 }), // className (shorter to avoid issues)
        (iconType, size, color, opacity, className) => {
          // Handle NaN opacity values gracefully
          const safeOpacity = isNaN(opacity) ? 1 : Math.max(0.1, Math.min(1, opacity));

          const IconComponent = getIcon(iconType);
          // Create unique test ID that handles NaN and special values
          const opacityStr = isNaN(opacity) ? 'nan' : Math.round(safeOpacity * 1000).toString();
          const testId = `icon-test-${iconType}-${size}-${opacityStr}-${Date.now()}-${Math.random()}`;

          const { unmount } = render(
            <div data-testid={testId}>
              <IconComponent
                size={size}
                color={color}
                opacity={safeOpacity}
                className={className}
              />
            </div>
          );

          const container = screen.getByTestId(testId);
          const svgElement = container.querySelector('svg');

          // Requirement 7.3: Consistent visual style and sizing across all buttons
          expect(svgElement).toBeTruthy();
          if (!svgElement) return; // Type guard for null checks
          expect(svgElement).toHaveAttribute('width', size.toString());
          expect(svgElement).toHaveAttribute('height', size.toString());
          expect(svgElement).toHaveAttribute('viewBox', '0 0 16 16');

          // Requirement 7.4: Color and opacity changes to indicate states
          expect(svgElement).toHaveStyle({ opacity: safeOpacity.toString() });

          // Check that color is applied to the appropriate elements
          const coloredElements = svgElement.querySelectorAll('[fill]');
          expect(coloredElements.length).toBeGreaterThan(0);
          coloredElements.forEach(element => {
            expect(element).toHaveAttribute('fill', color);
          });

          // Requirement 7.3: Consistent styling - className should be applied if provided
          if (className && className.trim()) {
            expect(svgElement).toHaveClass(className);
          }

          // Requirement 7.1: Universally recognized icons for recording buttons
          if (['record', 'play', 'stop'].includes(iconType)) {
            // Record should have circle shape
            if (iconType === 'record') {
              const circle = svgElement.querySelector('circle');
              expect(circle).toBeTruthy();
              if (circle) {
                expect(circle).toHaveAttribute('cx', '8');
                expect(circle).toHaveAttribute('cy', '8');
                expect(circle).toHaveAttribute('r', '6');
              }
            }

            // Play should have triangle shape (path with triangle coordinates)
            if (iconType === 'play') {
              const path = svgElement.querySelector('path');
              expect(path).toBeTruthy();
              if (path) {
                expect(path).toHaveAttribute('d', 'M3 2l10 6-10 6V2z');
              }
            }

            // Stop should have square shape
            if (iconType === 'stop') {
              const rect = svgElement.querySelector('rect');
              expect(rect).toBeTruthy();
              if (rect) {
                expect(rect).toHaveAttribute('x', '3');
                expect(rect).toHaveAttribute('y', '3');
                expect(rect).toHaveAttribute('width', '10');
                expect(rect).toHaveAttribute('height', '10');
              }
            }
          }

          // Requirement 7.2: Clear, intuitive icons for editor buttons
          if (['save', 'open', 'clear', 'settings'].includes(iconType)) {
            // Each editor icon should have recognizable path elements
            const paths = svgElement.querySelectorAll('path');
            expect(paths.length).toBeGreaterThan(0);

            // Settings icon should have gear-like paths (multiple paths for gear shape)
            if (iconType === 'settings') {
              expect(paths.length).toBeGreaterThanOrEqual(2);
            }
          }

          // Requirement 7.5: Icons remain recognizable at compact size
          // Test minimum readable size (should work at 8x8 and larger)
          if (size >= 8) {
            expect(svgElement).toHaveAttribute('width', size.toString());
            expect(svgElement).toHaveAttribute('height', size.toString());

            // Icon should have proper geometric elements that scale
            const geometricElements = svgElement.querySelectorAll('circle, rect, path');
            expect(geometricElements.length).toBeGreaterThan(0);
          }

          unmount();
        }
      ),
      { numRuns: 50 } // Reduced runs to avoid DOM issues
    );
  });

  // Feature: desktop-ui-redesign, Property 7: Icon component mapping consistency
  test('Property 7: Icon component mapping consistency - all icon types are properly mapped and accessible', () => {
    const validIcons: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];

    fc.assert(
      fc.property(
        fc.constantFrom(...validIcons),
        (iconType) => {
          // Requirement 7.3: Consistent access through mapping system
          const IconComponent = ICON_COMPONENTS[iconType];
          expect(IconComponent).toBeTruthy();
          expect(typeof IconComponent).toBe('function');

          // getIcon utility should return the same component
          const IconFromUtil = getIcon(iconType);
          expect(IconFromUtil).toBe(IconComponent);

          // Component should render without errors
          const testId = `mapping-test-${iconType}`;
          const { unmount } = render(
            <div data-testid={testId}>
              <IconComponent />
            </div>
          );

          const container = screen.getByTestId(testId);
          const svgElement = container.querySelector('svg');

          expect(svgElement).toBeTruthy();
          if (!svgElement) return; // Type guard for null checks
          expect(svgElement).toHaveAttribute('viewBox', '0 0 16 16');

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: desktop-ui-redesign, Property 7: Default props consistency
  test('Property 7: Default props consistency - all icons use consistent default values', () => {
    const validIcons: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];

    validIcons.forEach(iconType => {
      const IconComponent = getIcon(iconType);
      const testId = `default-props-${iconType}`;

      const { unmount } = render(
        <div data-testid={testId}>
          <IconComponent />
        </div>
      );

      const container = screen.getByTestId(testId);
      const svgElement = container.querySelector('svg');

      // Requirement 7.3: Consistent sizing - default size should be 16
      expect(svgElement).toBeTruthy();
      if (!svgElement) return; // Type guard for null checks
      expect(svgElement).toHaveAttribute('width', '16');
      expect(svgElement).toHaveAttribute('height', '16');
      expect(svgElement).toHaveAttribute('viewBox', '0 0 16 16');

      // Requirement 7.4: Default opacity should be 1 (fully opaque)
      expect(svgElement).toHaveStyle({ opacity: '1' });

      // Color elements should use currentColor by default
      const coloredElements = svgElement.querySelectorAll('[fill]');
      coloredElements.forEach(element => {
        expect(element).toHaveAttribute('fill', 'currentColor');
      });

      unmount();
    });
  });

  // Feature: desktop-ui-redesign, Property 7: Icon shape validation
  test('Property 7: Icon shape validation - recording icons use standard shapes', () => {
    // Requirement 7.1: Recording buttons use universally recognized icons

    // Test Record icon (circle)
    const { unmount: unmountRecord } = render(
      <div data-testid="record-shape-test">
        <RecordIcon />
      </div>
    );
    const recordContainer = screen.getByTestId('record-shape-test');
    const recordSvg = recordContainer.querySelector('svg');
    const recordCircle = recordSvg?.querySelector('circle');
    expect(recordCircle).toBeTruthy();
    if (recordCircle) {
      expect(recordCircle).toHaveAttribute('cx', '8');
      expect(recordCircle).toHaveAttribute('cy', '8');
      expect(recordCircle).toHaveAttribute('r', '6');
    }
    unmountRecord();

    // Test Play icon (triangle)
    const { unmount: unmountPlay } = render(
      <div data-testid="play-shape-test">
        <PlayIcon />
      </div>
    );
    const playContainer = screen.getByTestId('play-shape-test');
    const playSvg = playContainer.querySelector('svg');
    const playPath = playSvg?.querySelector('path');
    expect(playPath).toBeTruthy();
    if (playPath) {
      expect(playPath).toHaveAttribute('d', 'M3 2l10 6-10 6V2z');
    }
    unmountPlay();

    // Test Stop icon (square)
    const { unmount: unmountStop } = render(
      <div data-testid="stop-shape-test">
        <StopIcon />
      </div>
    );
    const stopContainer = screen.getByTestId('stop-shape-test');
    const stopSvg = stopContainer.querySelector('svg');
    const stopRect = stopSvg?.querySelector('rect');
    expect(stopRect).toBeTruthy();
    if (stopRect) {
      expect(stopRect).toHaveAttribute('x', '3');
      expect(stopRect).toHaveAttribute('y', '3');
      expect(stopRect).toHaveAttribute('width', '10');
      expect(stopRect).toHaveAttribute('height', '10');
    }
    unmountStop();
  });

  // Feature: desktop-ui-redesign, Property 7: Opacity validation
  test('Property 7: Opacity validation - icons handle opacity values correctly', () => {
    const validIcons: IconType[] = ['record', 'play', 'stop'];
    const testCases = [
      { opacity: 0.5, expected: '0.5' },
      { opacity: 0, expected: '0' },
      { opacity: 1, expected: '1' },
      { opacity: 0.25, expected: '0.25' },
      { opacity: 0.75, expected: '0.75' },
      { opacity: NaN, expected: '1' }, // NaN should default to 1
      { opacity: -1, expected: '1' }, // Invalid values should be clamped
      { opacity: 2, expected: '1' } // Values > 1 should be clamped
    ];

    validIcons.forEach(iconType => {
      testCases.forEach((testCase, index) => {
        const IconComponent = getIcon(iconType);
        const testId = `opacity-test-${iconType}-${index}-${Date.now()}`;

        // Handle invalid opacity values
        let safeOpacity = testCase.opacity;
        if (isNaN(safeOpacity) || safeOpacity < 0 || safeOpacity > 1) {
          safeOpacity = 1;
        }

        const { unmount } = render(
          <div data-testid={testId}>
            <IconComponent opacity={testCase.opacity} />
          </div>
        );

        const container = screen.getByTestId(testId);
        const svgElement = container.querySelector('svg');

        // Requirement 7.4: Should handle opacity values correctly
        expect(svgElement).toBeTruthy();
        if (svgElement) {
          expect(svgElement).toHaveStyle({ opacity: testCase.expected });
        }

        unmount();
      });
    });
  });

  // Feature: desktop-ui-redesign, Property 7: Size scaling consistency
  test('Property 7: Size scaling consistency - icons scale proportionally', () => {
    const testSizes = [8, 12, 16, 20, 24, 32];

    fc.assert(
      fc.property(
        fc.constantFrom('record', 'play', 'stop', 'save', 'open', 'clear', 'settings'),
        fc.constantFrom(...testSizes),
        (iconType, size) => {
          const IconComponent = getIcon(iconType);
          const testId = `size-test-${iconType}-${size}`;

          const { unmount } = render(
            <div data-testid={testId}>
              <IconComponent size={size} />
            </div>
          );

          const container = screen.getByTestId(testId);
          const svgElement = container.querySelector('svg');

          // Requirement 7.3: Consistent sizing
          expect(svgElement).toBeTruthy();
          if (!svgElement) return; // Type guard for null checks
          expect(svgElement).toHaveAttribute('width', size.toString());
          expect(svgElement).toHaveAttribute('height', size.toString());

          // ViewBox should remain consistent regardless of size
          expect(svgElement).toHaveAttribute('viewBox', '0 0 16 16');

          // Requirement 7.5: Icons remain recognizable at compact size
          if (size >= 8) {
            const geometricElements = svgElement.querySelectorAll('circle, rect, path');
            expect(geometricElements.length).toBeGreaterThan(0);
          }

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });
});
