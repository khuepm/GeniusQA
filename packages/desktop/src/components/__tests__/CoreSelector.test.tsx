/**
 * Unit tests for CoreSelector component
 * 
 * Tests core selection UI interactions, state management, visual feedback
 * during core switching operations, and performance metrics display.
 * 
 * Requirements: 6.1, 6.4, 10.2
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CoreSelector, CoreType, PerformanceMetrics } from '../CoreSelector';

describe('CoreSelector', () => {
  const mockOnCoreChange = jest.fn();

  const defaultProps = {
    currentCore: 'python' as CoreType,
    availableCores: ['python', 'rust'] as CoreType[],
    onCoreChange: mockOnCoreChange,
  };

  const mockPerformanceMetrics: PerformanceMetrics[] = [
    {
      coreType: 'python',
      lastOperationTime: 150.5,
      memoryUsage: 45.2,
      cpuUsage: 12.3,
      operationCount: 25,
      errorRate: 0.02,
    },
    {
      coreType: 'rust',
      lastOperationTime: 89.3,
      memoryUsage: 28.7,
      cpuUsage: 8.1,
      operationCount: 18,
      errorRate: 0.01,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with title and current core status', () => {
      render(<CoreSelector {...defaultProps} />);

      expect(screen.getByText('Automation Core')).toBeInTheDocument();
      expect(screen.getByText('Active:')).toBeInTheDocument();
      expect(screen.getByText('🐍 Python Core')).toBeInTheDocument();
    });

    it('should display both Python and Rust core options', () => {
      render(<CoreSelector {...defaultProps} />);

      expect(screen.getByText('Python Core')).toBeInTheDocument();
      expect(screen.getByText('Rust Core')).toBeInTheDocument();
      expect(screen.getByText('Stable automation using PyAutoGUI')).toBeInTheDocument();
      expect(screen.getByText('High-performance native automation')).toBeInTheDocument();
    });

    it('should show correct icons for each core type', () => {
      render(<CoreSelector {...defaultProps} />);

      // Check for Python and Rust icons in the options
      const pythonIcons = screen.getAllByText('🐍');
      const rustIcons = screen.getAllByText('🦀');

      expect(pythonIcons.length).toBeGreaterThan(0);
      expect(rustIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Core Selection Interactions', () => {
    it('should call onCoreChange when clicking available core', async () => {
      render(<CoreSelector {...defaultProps} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      fireEvent.click(rustOption!);

      await waitFor(() => {
        expect(mockOnCoreChange).toHaveBeenCalledWith('rust');
      });
    });

    it('should not call onCoreChange when clicking current active core', () => {
      render(<CoreSelector {...defaultProps} />);

      const pythonOption = screen.getByText('Python Core').closest('button');
      fireEvent.click(pythonOption!);

      expect(mockOnCoreChange).not.toHaveBeenCalled();
    });

    it('should not call onCoreChange when disabled', () => {
      render(<CoreSelector {...defaultProps} disabled={true} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      fireEvent.click(rustOption!);

      expect(mockOnCoreChange).not.toHaveBeenCalled();
    });

    it('should not call onCoreChange when loading', () => {
      render(<CoreSelector {...defaultProps} loading={true} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      fireEvent.click(rustOption!);

      expect(mockOnCoreChange).not.toHaveBeenCalled();
    });
  });

  describe('Core Status Display', () => {
    it('should show active status for current core', () => {
      render(<CoreSelector {...defaultProps} />);

      const pythonOption = screen.getByText('Python Core').closest('button');
      expect(pythonOption).toHaveClass('active');
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show available status for non-active cores', () => {
      render(<CoreSelector {...defaultProps} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      expect(rustOption).not.toHaveClass('active');
      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('should show unavailable status for missing cores', () => {
      const propsWithUnavailableCore = {
        ...defaultProps,
        availableCores: ['python'] as CoreType[],
      };

      render(<CoreSelector {...propsWithUnavailableCore} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      expect(rustOption).toHaveClass('unavailable');
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Rust core not installed or configured')).toBeInTheDocument();
    });
  });

  describe('Visual Feedback During Core Switching', () => {
    it('should show switching state when onCoreChange is called', async () => {
      // Mock onCoreChange to return a promise that we can control
      const mockAsyncOnCoreChange = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      render(<CoreSelector {...defaultProps} onCoreChange={mockAsyncOnCoreChange} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      fireEvent.click(rustOption!);

      // Should show switching state immediately
      await waitFor(() => {
        expect(screen.getByText('Switching...')).toBeInTheDocument();
        expect(rustOption).toHaveClass('switching');
      });

      // Wait for the promise to resolve
      await waitFor(() => {
        expect(screen.queryByText('Switching...')).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should show error message when core switching fails', async () => {
      const mockFailingOnCoreChange = jest.fn().mockRejectedValue(new Error('Core switch failed'));

      render(<CoreSelector {...defaultProps} onCoreChange={mockFailingOnCoreChange} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      fireEvent.click(rustOption!);

      await waitFor(() => {
        expect(screen.getByText('Core switch failed')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics Display', () => {
    it('should display performance metrics when provided', () => {
      render(<CoreSelector {...defaultProps} performanceMetrics={mockPerformanceMetrics} />);

      // Check for Python core metrics
      expect(screen.getByText('150.5ms')).toBeInTheDocument();
      expect(screen.getByText('45.2MB')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('2.0%')).toBeInTheDocument();

      // Check for Rust core metrics
      expect(screen.getByText('89.3ms')).toBeInTheDocument();
      expect(screen.getByText('28.7MB')).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('1.0%')).toBeInTheDocument();
    });

    it('should show performance comparison for non-active cores', () => {
      render(<CoreSelector {...defaultProps} performanceMetrics={mockPerformanceMetrics} />);

      // Rust should show as faster than Python
      expect(screen.getByText('Faster performance')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('should show performance summary when multiple metrics available', () => {
      render(<CoreSelector {...defaultProps} performanceMetrics={mockPerformanceMetrics} />);

      expect(screen.getByText('Performance Comparison')).toBeInTheDocument();
      expect(screen.getByText(/Choose the core that best fits your performance/)).toBeInTheDocument();
    });

    it('should handle missing performance metrics gracefully', () => {
      render(<CoreSelector {...defaultProps} performanceMetrics={[]} />);

      // Should not show performance metrics sections
      expect(screen.queryByText('Last Operation:')).not.toBeInTheDocument();
      expect(screen.queryByText('Performance Comparison')).not.toBeInTheDocument();
    });

    it('should format performance values correctly', () => {
      const metricsWithZeroValues: PerformanceMetrics[] = [
        {
          coreType: 'python',
          lastOperationTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          operationCount: 0,
          errorRate: 0,
        },
      ];

      render(<CoreSelector {...defaultProps} performanceMetrics={metricsWithZeroValues} />);

      // Should show N/A for zero values
      expect(screen.getAllByText('N/A')).toHaveLength(3); // lastOperationTime, memoryUsage, errorRate
      expect(screen.getByText('0')).toBeInTheDocument(); // operationCount should show 0
    });
  });

  describe('Accessibility and Interaction States', () => {
    it('should disable buttons when component is disabled', () => {
      render(<CoreSelector {...defaultProps} disabled={true} />);

      const pythonOption = screen.getByText('Python Core').closest('button');
      const rustOption = screen.getByText('Rust Core').closest('button');

      expect(pythonOption).toBeDisabled();
      expect(rustOption).toBeDisabled();
    });

    it('should disable buttons when component is loading', () => {
      render(<CoreSelector {...defaultProps} loading={true} />);

      const pythonOption = screen.getByText('Python Core').closest('button');
      const rustOption = screen.getByText('Rust Core').closest('button');

      expect(pythonOption).toBeDisabled();
      expect(rustOption).toBeDisabled();
    });

    it('should disable unavailable core options', () => {
      const propsWithUnavailableCore = {
        ...defaultProps,
        availableCores: ['python'] as CoreType[],
      };

      render(<CoreSelector {...propsWithUnavailableCore} />);

      const rustOption = screen.getByText('Rust Core').closest('button');
      expect(rustOption).toBeDisabled();
    });
  });

  describe('Core Type Utilities', () => {
    it('should handle different current core types', () => {
      const rustActiveProps = {
        ...defaultProps,
        currentCore: 'rust' as CoreType,
      };

      render(<CoreSelector {...rustActiveProps} />);

      expect(screen.getByText('🦀 Rust Core')).toBeInTheDocument();

      const rustOption = screen.getByText('Rust Core').closest('button');
      expect(rustOption).toHaveClass('active');
    });

    it('should handle empty available cores list', () => {
      const propsWithNoCores = {
        ...defaultProps,
        availableCores: [] as CoreType[],
      };

      render(<CoreSelector {...propsWithNoCores} />);

      const pythonOption = screen.getByText('Python Core').closest('button');
      const rustOption = screen.getByText('Rust Core').closest('button');

      expect(pythonOption).toHaveClass('unavailable');
      expect(rustOption).toHaveClass('unavailable');
    });
  });
});
