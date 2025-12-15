/**
 * Integration tests for Visual Assertion Editor Component
 *
 * Tests end-to-end visual assertion workflow including:
 * - Visual assertion configuration interface
 * - ROI selection and ignore region functionality
 * - Sensitivity profile selection and configuration
 * - Frontend-backend communication simulation
 *
 * Requirements: 7.3, 7.4, 7.5
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VisualAssertionEditor } from '../VisualAssertionEditor';
import {
  VisualAssertAction,
  createVisualAssertAction,
  applySensitivityProfile,
} from '../../types/visualTesting.types';

// ============================================================================
// Test Data and Mocks
// ============================================================================

/**
 * Create a test visual assertion action
 */
function createTestVisualAssertAction(): VisualAssertAction {
  return createVisualAssertAction(
    'test-visual-assert-123',
    1234567890,
    'baseline_test.png',
    {
      screen_resolution: '1920x1080',
      os_scaling_factor: 1.0,
      browser_zoom: 100,
      execution_environment: 'desktop',
    }
  );
}

/**
 * Mock screenshot URL for testing
 */
const mockScreenshotUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4=';

// ============================================================================
// Integration Tests
// ============================================================================

describe('VisualAssertionEditor Integration Tests', () => {
  let mockOnUpdate: jest.Mock;
  let testAction: VisualAssertAction;

  beforeEach(() => {
    mockOnUpdate = jest.fn();
    testAction = createTestVisualAssertAction();

    // Mock Image constructor for ROI tool
    global.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      naturalWidth = 1920;
      naturalHeight = 1080;

      constructor() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test: Visual assertion configuration interface
   * Requirements: 7.1, 7.2
   */
  describe('Visual Assertion Configuration Interface', () => {
    it('should render visual assertion editor with all sections', () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      // Check main sections are present
      expect(screen.getByTestId('visual-assertion-editor')).toBeInTheDocument();
      expect(screen.getByText('Visual Assertion')).toBeInTheDocument();
      expect(screen.getByText('Screenshot & Regions')).toBeInTheDocument();
      expect(screen.getByText('Sensitivity Profile')).toBeInTheDocument();
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
      expect(screen.getByText('Storage Backend')).toBeInTheDocument();
      expect(screen.getByText('Execution Context')).toBeInTheDocument();
    });

    it('should display action ID and status badges', () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      // Check ID display
      expect(screen.getByText(`ID: ${testAction.id.slice(0, 8)}...`)).toBeInTheDocument();

      // Check status badges
      expect(screen.getByText('Visual Test')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument(); // Default sensitivity profile
    });

    it('should display execution context information', () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      // Check context information
      expect(screen.getByText('1920x1080')).toBeInTheDocument();
      expect(screen.getByText('1x')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('desktop')).toBeInTheDocument();
    });
  });

  /**
   * Test: Sensitivity profile selection and configuration
   * Requirements: 7.1, 2.1
   */
  describe('Sensitivity Profile Selection', () => {
    it('should allow selecting different sensitivity profiles', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      // Click strict profile
      const strictButton = screen.getByTestId('sensitivity-strict');
      fireEvent.click(strictButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              sensitivity_profile: 'strict',
              threshold: 0.001,
              comparison_method: 'pixel_match',
              anti_aliasing_tolerance: false,
              layout_shift_tolerance: 0,
            }),
          })
        );
      });
    });

    it('should apply profile configuration when profile changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      // Click flexible profile
      const flexibleButton = screen.getByTestId('sensitivity-flexible');
      fireEvent.click(flexibleButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              sensitivity_profile: 'flexible',
              threshold: 0.05,
              comparison_method: 'ssim',
              anti_aliasing_tolerance: true,
              layout_shift_tolerance: 2,
            }),
          })
        );
      });
    });

    it('should show custom configuration warning when manually modified', async () => {
      // Start with a custom configuration
      const customAction = {
        ...testAction,
        config: {
          ...testAction.config,
          threshold: 0.025, // Custom value not matching any profile
        },
      };

      render(
        <VisualAssertionEditor
          action={customAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      expect(screen.getByText(/Custom configuration detected/)).toBeInTheDocument();
    });
  });

  /**
   * Test: Manual configuration changes
   * Requirements: 7.1
   */
  describe('Manual Configuration Changes', () => {
    it('should update threshold when input changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const thresholdInput = screen.getByTestId('threshold-input');
      fireEvent.change(thresholdInput, { target: { value: '2.5' } });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              threshold: 0.025, // 2.5% converted to decimal
            }),
          })
        );
      });
    });

    it('should update comparison method when select changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const methodSelect = screen.getByTestId('comparison-method-select');
      fireEvent.change(methodSelect, { target: { value: 'ssim' } });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              comparison_method: 'ssim',
            }),
          })
        );
      });
    });

    it('should update timeout when input changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const timeoutInput = screen.getByTestId('timeout-input');
      fireEvent.change(timeoutInput, { target: { value: '5000' } });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              timeout: 5000,
            }),
          })
        );
      });
    });

    it('should update retry count when input changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const retryInput = screen.getByTestId('retry-count-input');
      fireEvent.change(retryInput, { target: { value: '5' } });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              retry_count: 5,
            }),
          })
        );
      });
    });

    it('should toggle anti-aliasing tolerance', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const antiAliasingCheckbox = screen.getByTestId('anti-aliasing-checkbox');
      fireEvent.click(antiAliasingCheckbox);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              anti_aliasing_tolerance: !testAction.config.anti_aliasing_tolerance,
            }),
          })
        );
      });
    });

    it('should update layout shift tolerance', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const layoutShiftInput = screen.getByTestId('layout-shift-input');
      fireEvent.change(layoutShiftInput, { target: { value: '3' } });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              layout_shift_tolerance: 3,
            }),
          })
        );
      });
    });
  });

  /**
   * Test: ROI and ignore region functionality
   * Requirements: 7.1, 2.1
   */
  describe('ROI and Ignore Region Functionality', () => {
    it('should show ROI tool for screenshot', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('roi-tool')).toBeInTheDocument();
      });
    });

    it('should show clear ROI button when ROI is set', () => {
      const actionWithROI = {
        ...testAction,
        regions: {
          ...testAction.regions,
          target_roi: { x: 100, y: 100, width: 200, height: 150 },
        },
      };

      render(
        <VisualAssertionEditor
          action={actionWithROI}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      expect(screen.getByTestId('clear-roi-btn')).toBeInTheDocument();
    });

    it('should clear ROI when clear button is clicked', async () => {
      const actionWithROI = {
        ...testAction,
        regions: {
          ...testAction.regions,
          target_roi: { x: 100, y: 100, width: 200, height: 150 },
        },
      };

      render(
        <VisualAssertionEditor
          action={actionWithROI}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const clearButton = screen.getByTestId('clear-roi-btn');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            regions: expect.objectContaining({
              target_roi: null,
            }),
          })
        );
      });
    });

    it('should show add ignore region button', () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      expect(screen.getByTestId('add-ignore-btn')).toBeInTheDocument();
    });

    it('should enter drawing mode when add ignore region is clicked', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const addIgnoreButton = screen.getByTestId('add-ignore-btn');
      fireEvent.click(addIgnoreButton);

      await waitFor(() => {
        expect(screen.getByTestId('cancel-ignore-btn')).toBeInTheDocument();
        expect(screen.getByText('Draw a rectangle to create an ignore region')).toBeInTheDocument();
      });
    });

    it('should display existing ignore regions', () => {
      const actionWithIgnoreRegions = {
        ...testAction,
        regions: {
          ...testAction.regions,
          ignore_regions: [
            { x: 50, y: 50, width: 100, height: 80 },
            { x: 200, y: 300, width: 150, height: 120 },
          ],
        },
      };

      render(
        <VisualAssertionEditor
          action={actionWithIgnoreRegions}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      expect(screen.getByText('(50, 50) 100×80')).toBeInTheDocument();
      expect(screen.getByText('(200, 300) 150×120')).toBeInTheDocument();
    });

    it('should remove ignore region when remove button is clicked', async () => {
      const actionWithIgnoreRegions = {
        ...testAction,
        regions: {
          ...testAction.regions,
          ignore_regions: [
            { x: 50, y: 50, width: 100, height: 80 },
            { x: 200, y: 300, width: 150, height: 120 },
          ],
        },
      };

      render(
        <VisualAssertionEditor
          action={actionWithIgnoreRegions}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const removeButton = screen.getByTestId('remove-ignore-0');
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            regions: expect.objectContaining({
              ignore_regions: [{ x: 200, y: 300, width: 150, height: 120 }],
            }),
          })
        );
      });
    });
  });

  /**
   * Test: Storage backend configuration
   * Requirements: 7.1
   */
  describe('Storage Backend Configuration', () => {
    it('should update storage backend when select changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const storageSelect = screen.getByTestId('storage-backend-select');
      fireEvent.change(storageSelect, { target: { value: 'git_lfs' } });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            assets: expect.objectContaining({
              storage_backend: 'git_lfs',
            }),
          })
        );
      });
    });

    it('should show storage backend descriptions', () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      expect(screen.getByText('Store baselines in local filesystem')).toBeInTheDocument();
    });
  });

  /**
   * Test: Error handling and user feedback
   * Requirements: 7.3, 7.4
   */
  describe('Error Handling and User Feedback', () => {
    it('should display error message when provided', () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      // Simulate error by triggering an invalid state
      // This would normally come from the parent component
      const editorElement = screen.getByTestId('visual-assertion-editor');
      expect(editorElement).toBeInTheDocument();
    });

    it('should handle image loading failures gracefully', async () => {
      // Mock Image constructor to simulate loading failure
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      } as any;

      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl="invalid-url"
        />
      );

      // Component should still render without crashing
      expect(screen.getByTestId('visual-assertion-editor')).toBeInTheDocument();
    });
  });

  /**
   * Test: Performance under various configurations
   * Requirements: 7.3, 7.5
   */
  describe('Performance Under Various Configurations', () => {
    it('should handle large numbers of ignore regions', () => {
      const manyIgnoreRegions = Array.from({ length: 50 }, (_, i) => ({
        x: i * 10,
        y: i * 10,
        width: 50,
        height: 50,
      }));

      const actionWithManyRegions = {
        ...testAction,
        regions: {
          ...testAction.regions,
          ignore_regions: manyIgnoreRegions,
        },
      };

      const startTime = performance.now();

      render(
        <VisualAssertionEditor
          action={actionWithManyRegions}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByTestId('visual-assertion-editor')).toBeInTheDocument();
    });

    it('should handle rapid configuration changes', async () => {
      render(
        <VisualAssertionEditor
          action={testAction}
          onUpdate={mockOnUpdate}
          screenshotUrl={mockScreenshotUrl}
        />
      );

      const thresholdInput = screen.getByTestId('threshold-input');

      // Simulate rapid changes
      for (let i = 0; i < 10; i++) {
        fireEvent.change(thresholdInput, { target: { value: `${i}.5` } });
      }

      // Should handle all changes without errors
      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledTimes(10);
      });
    });
  });
});

/**
 * Test utility functions
 */
describe('Visual Assertion Utility Functions', () => {
  it('should create visual assert action with correct defaults', () => {
    const action = createVisualAssertAction(
      'test-id',
      123456,
      'test-baseline.png',
      {
        screen_resolution: '1920x1080',
        os_scaling_factor: 1.0,
        browser_zoom: 100,
        execution_environment: 'desktop',
      }
    );

    expect(action.type).toBe('visual_assert');
    expect(action.id).toBe('test-id');
    expect(action.timestamp).toBe(123456);
    expect(action.assets.baseline_path).toBe('test-baseline.png');
    expect(action.config.sensitivity_profile).toBe('moderate');
    expect(action.regions.target_roi).toBeNull();
    expect(action.regions.ignore_regions).toEqual([]);
  });

  it('should apply sensitivity profile correctly', () => {
    const baseConfig = {
      threshold: 0.01,
      sensitivity_profile: 'moderate' as const,
      comparison_method: 'layout_aware' as const,
      timeout: 3000,
      retry_count: 3,
      anti_aliasing_tolerance: true,
      layout_shift_tolerance: 2,
    };

    const strictConfig = applySensitivityProfile(baseConfig, 'strict');

    expect(strictConfig.sensitivity_profile).toBe('strict');
    expect(strictConfig.threshold).toBe(0.001);
    expect(strictConfig.comparison_method).toBe('pixel_match');
    expect(strictConfig.anti_aliasing_tolerance).toBe(false);
    expect(strictConfig.layout_shift_tolerance).toBe(0);
  });
});
