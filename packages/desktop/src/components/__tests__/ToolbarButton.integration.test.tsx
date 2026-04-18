/**
 * ToolbarButton Integration Tests
 * Tests the integration between ToolbarButton and Icon System
 * Requirements: 3.1, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { ToolbarButton } from '../ToolbarButton';
import { IconType } from '../icons';

// Mock CSS imports
jest.mock('../ToolbarButton.css', () => ({}));

describe('ToolbarButton Integration Tests', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with all icon types successfully', () => {
    const iconTypes: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];

    iconTypes.forEach((iconType) => {
      const { unmount } = render(
        <ToolbarButton
          icon={iconType}
          tooltip={`${iconType} button`}
          onClick={mockOnClick}
        />
      );

      // Should render button with correct test id
      const button = screen.getByTestId(`button-${iconType}`);
      expect(button).toBeInTheDocument();

      // Should have correct aria-label
      expect(button).toHaveAttribute('aria-label', `${iconType} button`);

      // Should contain SVG icon
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');

      // Should have correct CSS classes
      expect(button).toHaveClass('toolbar-button');
      expect(button).toHaveClass('toolbar-button-secondary'); // default variant

      unmount();
    });
  });

  it('should handle icon props correctly', () => {
    const { container } = render(
      <ToolbarButton
        icon="record"
        tooltip="Record button"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('[data-testid="button-record"]');
    const svg = button?.querySelector('svg');
    const icon = svg?.querySelector('circle'); // RecordIcon uses a circle

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('fill', 'currentColor');
  });

  it('should support all button variants with icons', () => {
    const variants = ['primary', 'secondary', 'danger'] as const;

    variants.forEach((variant) => {
      const { unmount } = render(
        <ToolbarButton
          icon="save"
          tooltip="Save button"
          onClick={mockOnClick}
          variant={variant}
        />
      );

      const button = screen.getByTestId('button-save');
      expect(button).toHaveClass(`toolbar-button-${variant}`);

      // Icon should still render correctly
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();

      unmount();
    });
  });

  it('should handle button states with icon rendering', () => {
    const { rerender } = render(
      <ToolbarButton
        icon="play"
        tooltip="Play button"
        onClick={mockOnClick}
        disabled={false}
        active={false}
      />
    );

    let button = screen.getByTestId('button-play');
    let svg = button.querySelector('svg');

    // Normal state
    expect(button).not.toHaveClass('disabled');
    expect(button).not.toHaveClass('active');
    expect(svg).toBeInTheDocument();

    // Active state
    rerender(
      <ToolbarButton
        icon="play"
        tooltip="Play button"
        onClick={mockOnClick}
        disabled={false}
        active={true}
      />
    );

    button = screen.getByTestId('button-play');
    svg = button.querySelector('svg');
    expect(button).toHaveClass('active');
    expect(svg).toBeInTheDocument();

    // Disabled state
    rerender(
      <ToolbarButton
        icon="play"
        tooltip="Play button"
        onClick={mockOnClick}
        disabled={true}
        active={false}
      />
    );

    button = screen.getByTestId('button-play');
    svg = button.querySelector('svg');
    expect(button).toHaveClass('disabled');
    expect(button).toBeDisabled();
    expect(svg).toBeInTheDocument();
  });

  it('should handle click events correctly', () => {
    render(
      <ToolbarButton
        icon="stop"
        tooltip="Stop button"
        onClick={mockOnClick}
      />
    );

    const button = screen.getByTestId('button-stop');

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should show tooltip on hover', async () => {
    render(
      <ToolbarButton
        icon="settings"
        tooltip="Settings button"
        onClick={mockOnClick}
      />
    );

    const button = screen.getByTestId('button-settings');

    // Hover should trigger tooltip (though we can't easily test the 500ms delay in this test)
    fireEvent.mouseEnter(button);
    expect(button).toHaveClass('hovered');

    fireEvent.mouseLeave(button);
    expect(button).not.toHaveClass('hovered');
  });
});
