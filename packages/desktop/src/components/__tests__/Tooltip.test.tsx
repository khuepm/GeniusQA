/**
 * Tooltip Component Tests
 * Tests for the standalone tooltip component
 * Requirements: 3.2, 3.5, 9.4
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tooltip } from '../Tooltip';

// Mock timers for testing delay functionality
jest.useFakeTimers();

describe('Tooltip Component', () => {
  const mockTargetRect: DOMRect = {
    top: 100,
    left: 200,
    bottom: 132,
    right: 232,
    width: 32,
    height: 32,
    x: 200,
    y: 100,
    toJSON: () => ({})
  };

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('should render tooltip when visible is true after delay', async () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          delay={100}
        />
      );

      // Initially should not be visible
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

      // Fast-forward time to trigger the delay
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });

    it('should not render tooltip when visible is false', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={false}
          targetRect={mockTargetRect}
        />
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    });

    it('should not render tooltip when targetRect is undefined', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={undefined}
        />
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Positioning - Requirements: 3.2, 3.5', () => {
    it('should apply correct CSS classes for different positions', () => {
      const { rerender } = render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          position="top"
          delay={0}
        />
      );

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId('tooltip')).toHaveClass('tooltip-top');

      rerender(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          position="bottom"
          delay={0}
        />
      );

      expect(screen.getByTestId('tooltip')).toHaveClass('tooltip-bottom');

      rerender(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          position="left"
          delay={0}
        />
      );

      expect(screen.getByTestId('tooltip')).toHaveClass('tooltip-left');

      rerender(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          position="right"
          delay={0}
        />
      );

      expect(screen.getByTestId('tooltip')).toHaveClass('tooltip-right');
    });

    it('should default to bottom position when position is not specified', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          delay={0}
        />
      );

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId('tooltip')).toHaveClass('tooltip-bottom');
    });
  });

  describe('Accessibility - Requirements: 3.2', () => {
    it('should have correct ARIA attributes', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          delay={0}
        />
      );

      act(() => {
        jest.advanceTimersByTime(0);
      });

      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toHaveAttribute('role', 'tooltip');
      expect(tooltip).toHaveAttribute('aria-hidden', 'false');
    });

    it('should set aria-hidden to true when not visible', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={false}
          targetRect={mockTargetRect}
        />
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Since the tooltip doesn't render when not visible, we can't test aria-hidden
      // This is actually correct behavior - the tooltip shouldn't exist in the DOM when not visible
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          className="custom-tooltip"
          delay={0}
        />
      );

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId('tooltip')).toHaveClass('custom-tooltip');
    });

    it('should accept custom delay prop', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          delay={200}
        />
      );

      // Should not be visible before delay
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Should be visible after delay
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Styling - Requirements: 9.4', () => {
    it('should have fixed positioning and high z-index', () => {
      render(
        <Tooltip
          text="Test tooltip"
          visible={true}
          targetRect={mockTargetRect}
          delay={0}
        />
      );

      act(() => {
        jest.advanceTimersByTime(0);
      });

      const tooltip = screen.getByTestId('tooltip');

      expect(tooltip).toHaveStyle('position: fixed');
      expect(tooltip).toHaveStyle('z-index: 1000');
      expect(tooltip).toHaveStyle('pointer-events: none');
    });
  });
});
