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

describe('ToolbarButton Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: desktop-ui-redesign, Property 3: Button icon-only display
  // Validates: Requirements 3.1, 3.2, 3.5
  test('Property 3: Button icon-only display - all toolbar buttons display only icons with tooltips', () => {
    // Define valid icon types for property-based testing
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

          const { unmount } = render(
            <div data-testid="test-container">
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

          const container = screen.getByTestId('test-container');
          const button = container.querySelector(`[data-testid="button-${icon}"]`) as HTMLButtonElement;

          // Requirement 3.1: Buttons SHALL show only icons without text labels
          expect(button).toBeTruthy();
          expect(button.querySelector('svg')).toBeTruthy(); // Icon present
          expect(button.textContent).toBe(''); // No text content

          // Requirement 3.2: Tooltips SHALL display on hover explaining button function
          expect(button).toHaveAttribute('aria-label', tooltip);
          expect(button).toHaveAttribute('title', ''); // No default browser tooltip

          // Requirement 3.5: Tooltips SHALL show descriptive text explaining button purpose
          // Test tooltip functionality
          fireEvent.mouseEnter(button);
          // Note: Tooltip visibility is tested through aria-label accessibility

          // Icon should be properly sized and styled
          const icon_element = button.querySelector('svg');
          expect(icon_element).toHaveAttribute('width', '16');
          expect(icon_element).toHaveAttribute('height', '16');
          expect(icon_element).toHaveClass('toolbar-button-icon');

          // Button should have proper test identifier
          expect(button).toHaveAttribute('data-testid', `button-${icon}`);

          // Button should have proper CSS classes for styling
          expect(button).toHaveClass('toolbar-button');
          expect(button).toHaveClass(`toolbar-button-${variant}`);

          // State-specific classes should be applied correctly
          if (disabled) {
            expect(button).toHaveClass('disabled');
            expect(button).toBeDisabled();
          }

          if (active) {
            expect(button).toHaveClass('active');
          }

          fireEvent.mouseLeave(button);
          unmount();
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as required
    );
  });
});
