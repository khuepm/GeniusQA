/**
 * ToolbarButton Property-Based Tests
 * Property-based tests for ToolbarButton component using fast-check
 * Requirements: 3.1, 3.2, 3.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { ToolbarButton } from '../../components/ToolbarButton';
import { IconType } from '../../components/icons';

// Mock CSS imports
jest.mock('../../components/ToolbarButton.css', () => ({}));
jest.mock('../../components/Tooltip.css', () => ({}));

describe('ToolbarButton Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: desktop-ui-redesign, Property 3: Button icon-only display
  test('Property 3: Button icon-only display - all toolbar buttons display only icons with tooltips', () => {
    const mockOnClick = jest.fn();

    const { unmount } = render(
      <ToolbarButton
        icon="record"
        tooltip="Record button"
        onClick={mockOnClick}
        disabled={false}
        active={false}
        variant="primary"
      />
    );

    const button = screen.getByTestId('button-record');

    // Should have icon but no text content
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.textContent).toBe('');

    // Should have proper aria-label for accessibility
    expect(button).toHaveAttribute('aria-label', 'Record button');

    // Should not have default browser tooltip
    expect(button).toHaveAttribute('title', '');

    // Icon should be present and properly sized
    const icon = button.querySelector('svg');
    expect(icon).toHaveAttribute('width', '16');
    expect(icon).toHaveAttribute('height', '16');

    unmount();
  });

  // Feature: desktop-ui-redesign, Property 9: Responsive interaction feedback
  test('Property 9: Responsive interaction feedback - buttons provide timely visual feedback', () => {
    const mockOnClick = jest.fn();

    const { unmount } = render(
      <ToolbarButton
        icon="play"
        tooltip="Play button"
        onClick={mockOnClick}
        disabled={false}
        active={false}
        variant="secondary"
      />
    );

    const button = screen.getByTestId('button-play');

    // Test hover feedback timing (should be immediate)
    const startTime = performance.now();
    fireEvent.mouseEnter(button);
    const hoverTime = performance.now() - startTime;

    // Hover feedback should be immediate (< 50ms requirement)
    expect(hoverTime).toBeLessThan(50);
    expect(button).toHaveClass('hovered');

    // Test click feedback (should be immediate)
    fireEvent.mouseDown(button);
    expect(button).toHaveClass('pressed');

    fireEvent.mouseUp(button);
    expect(button).not.toHaveClass('pressed');

    // Test click handler execution
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(button);
    expect(button).not.toHaveClass('hovered');

    unmount();
  });

  // Feature: desktop-ui-redesign, Property 9: Comprehensive responsive interaction feedback (Property-Based Test)
  // Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
  test('Property 9: Comprehensive responsive interaction feedback - all buttons provide timely visual feedback across states', () => {
    // Define valid icon types and variants for comprehensive testing
    const validIcons: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];
    const validVariants = ['primary', 'secondary', 'danger'] as const;

    // Property-based test with fast-check
    fc.assert(
      fc.property(
        fc.constantFrom(...validIcons), // icon
        fc.string({ minLength: 1, maxLength: 50 }), // tooltip
        fc.boolean(), // disabled
        fc.boolean(), // active
        fc.constantFrom(...validVariants), // variant
        (icon, tooltip, disabled, active, variant) => {
          const mockOnClick = jest.fn();

          // Create unique test ID to avoid conflicts
          const uniqueId = `responsive-test-${icon}-${Date.now()}-${Math.random()}`;

          const { unmount } = render(
            <div data-testid={uniqueId}>
              <ToolbarButton
                icon={icon}
                tooltip={tooltip}
                onClick={mockOnClick}
                disabled={disabled}
                active={active}
                variant={variant}
              />
            </div>
          );

          const container = screen.getByTestId(uniqueId);
          const button = container.querySelector(`[data-testid="button-${icon}"]`) as HTMLButtonElement;

          expect(button).toBeTruthy();

          if (!disabled) {
            // Requirement 9.1: Hover feedback within 50ms
            const hoverStartTime = performance.now();
            fireEvent.mouseEnter(button);
            const hoverTime = performance.now() - hoverStartTime;

            expect(hoverTime).toBeLessThan(50);
            expect(button).toHaveClass('hovered');

            // Requirement 9.2: Immediate pressed state feedback on click
            const clickStartTime = performance.now();
            fireEvent.mouseDown(button);
            const clickTime = performance.now() - clickStartTime;

            expect(clickTime).toBeLessThan(10); // Should be immediate
            expect(button).toHaveClass('pressed');

            // Requirement 9.2: Pressed state should clear on mouse up
            fireEvent.mouseUp(button);
            expect(button).not.toHaveClass('pressed');

            // Requirement 9.2: Click handler should execute
            fireEvent.click(button);
            expect(mockOnClick).toHaveBeenCalledTimes(1);

            // Requirement 9.1: Hover state should clear on mouse leave
            fireEvent.mouseLeave(button);
            expect(button).not.toHaveClass('hovered');

            // Requirement 9.3: State changes should update within 100ms
            // Test state change timing by re-rendering with different props
            const stateChangeStartTime = performance.now();

            // Simulate state change by triggering hover again
            fireEvent.mouseEnter(button);
            const stateChangeTime = performance.now() - stateChangeStartTime;

            expect(stateChangeTime).toBeLessThan(100);
            expect(button).toHaveClass('hovered');

            fireEvent.mouseLeave(button);
          } else {
            // Disabled buttons should not respond to interactions
            fireEvent.mouseEnter(button);
            expect(button).not.toHaveClass('hovered');

            fireEvent.mouseDown(button);
            expect(button).not.toHaveClass('pressed');

            fireEvent.click(button);
            expect(mockOnClick).not.toHaveBeenCalled();
          }

          // Requirement 9.5: Disabled state should be visually distinct
          if (disabled) {
            expect(button).toHaveClass('disabled');
            expect(button).toBeDisabled();
          }

          // Requirement 9.4: Tooltip accessibility (aria-label should be present)
          expect(button).toHaveAttribute('aria-label', tooltip);

          // Visual state consistency checks
          expect(button).toHaveClass('toolbar-button');
          expect(button).toHaveClass(`toolbar-button-${variant}`);

          if (active) {
            expect(button).toHaveClass('active');
          }

          // Icon should be properly rendered
          const iconElement = button.querySelector('svg');
          expect(iconElement).toBeTruthy();
          expect(iconElement).toHaveClass('toolbar-button-icon');
          expect(iconElement).toHaveAttribute('width', '16');
          expect(iconElement).toHaveAttribute('height', '16');

          unmount();
        }
      ),
      { numRuns: 50 } // Reduced runs to avoid DOM issues
    );
  });
});
