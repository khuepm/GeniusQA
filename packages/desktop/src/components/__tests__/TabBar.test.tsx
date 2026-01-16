/**
 * TabBar Unit Tests
 * Tests for the TabBar component
 * Requirements: 1.2, 7.1
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TabBar } from '../TabBar';
import { TAB_CONFIGS } from '../../types/tabSystem.types';

// Mock CSS imports
jest.mock('../TabBar.css', () => ({}));

describe('TabBar Component', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render 4 tabs correctly', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      // Check all 4 tabs are rendered
      expect(screen.getByTestId('tab-recording')).toBeInTheDocument();
      expect(screen.getByTestId('tab-list')).toBeInTheDocument();
      expect(screen.getByTestId('tab-builder')).toBeInTheDocument();
      expect(screen.getByTestId('tab-editor')).toBeInTheDocument();
    });

    it('should render tabs with correct labels', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      expect(screen.getByText('Recording')).toBeInTheDocument();
      expect(screen.getByText('Script List')).toBeInTheDocument();
      expect(screen.getByText('AI Builder')).toBeInTheDocument();
      expect(screen.getByText('Editor')).toBeInTheDocument();
    });

    it('should render tabs with correct icons', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      expect(screen.getByText('🎬')).toBeInTheDocument();
      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
      expect(screen.getByText('✏️')).toBeInTheDocument();
    });

    it('should render tab bar with correct role', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      const tabBar = screen.getByRole('tablist');
      expect(tabBar).toBeInTheDocument();
      expect(tabBar).toHaveAttribute('aria-label', 'Main navigation tabs');
    });
  });

  describe('Active Tab Styling', () => {
    it('should apply active class to the selected tab', () => {
      render(
        <TabBar
          activeTab="list"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      const listTab = screen.getByTestId('tab-list');
      const recordingTab = screen.getByTestId('tab-recording');

      expect(listTab).toHaveClass('active');
      expect(recordingTab).not.toHaveClass('active');
    });

    it('should set aria-selected correctly for active tab', () => {
      render(
        <TabBar
          activeTab="builder"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      const builderTab = screen.getByTestId('tab-builder');
      const editorTab = screen.getByTestId('tab-editor');

      expect(builderTab).toHaveAttribute('aria-selected', 'true');
      expect(editorTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should update active tab when activeTab prop changes', () => {
      const { rerender } = render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      expect(screen.getByTestId('tab-recording')).toHaveClass('active');

      rerender(
        <TabBar
          activeTab="editor"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      expect(screen.getByTestId('tab-recording')).not.toHaveClass('active');
      expect(screen.getByTestId('tab-editor')).toHaveClass('active');
    });
  });

  describe('Click Handlers', () => {
    it('should call onTabChange when clicking a tab', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      fireEvent.click(screen.getByTestId('tab-list'));
      expect(mockOnTabChange).toHaveBeenCalledWith('list');
    });

    it('should not call onTabChange when clicking the active tab', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      fireEvent.click(screen.getByTestId('tab-recording'));
      expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('should call onTabChange with correct tab id for each tab', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      fireEvent.click(screen.getByTestId('tab-list'));
      expect(mockOnTabChange).toHaveBeenCalledWith('list');

      fireEvent.click(screen.getByTestId('tab-builder'));
      expect(mockOnTabChange).toHaveBeenCalledWith('builder');

      fireEvent.click(screen.getByTestId('tab-editor'));
      expect(mockOnTabChange).toHaveBeenCalledWith('editor');
    });
  });

  describe('Disabled State', () => {
    it('should disable all tabs when disabled prop is true', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
          disabled={true}
        />
      );

      TAB_CONFIGS.forEach((tab) => {
        const tabButton = screen.getByTestId(`tab-${tab.id}`);
        expect(tabButton).toBeDisabled();
        expect(tabButton).toHaveClass('disabled');
      });
    });

    it('should not call onTabChange when tabs are disabled', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
          disabled={true}
        />
      );

      fireEvent.click(screen.getByTestId('tab-list'));
      expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('should set aria-disabled correctly when disabled', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
          disabled={true}
        />
      );

      TAB_CONFIGS.forEach((tab) => {
        const tabButton = screen.getByTestId(`tab-${tab.id}`);
        expect(tabButton).toHaveAttribute('aria-disabled', 'true');
      });
    });
  });

  describe('Application Mode Styling', () => {
    it('should apply mode class to tab bar', () => {
      const { rerender } = render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      expect(screen.getByTestId('tab-bar')).toHaveClass('mode-idle');

      rerender(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="recording"
        />
      );

      expect(screen.getByTestId('tab-bar')).toHaveClass('mode-recording');

      rerender(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="playing"
        />
      );

      expect(screen.getByTestId('tab-bar')).toHaveClass('mode-playing');
    });
  });

  describe('Mode Indicators - Requirements: 6.5', () => {
    it('should not show mode indicator in idle mode', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      expect(screen.queryByTestId('mode-indicator')).not.toBeInTheDocument();
    });

    it('should show recording indicator with correct label', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="recording"
        />
      );

      const indicator = screen.getByTestId('mode-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('recording');
      // Query within the mode indicator to avoid matching the tab label
      expect(indicator).toHaveTextContent('Recording');
    });

    it('should show playing indicator with correct label', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="playing"
        />
      );

      const indicator = screen.getByTestId('mode-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('playing');
      expect(screen.getByText('Playing')).toBeInTheDocument();
    });

    it('should show editing indicator with correct label', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="editing"
        />
      );

      const indicator = screen.getByTestId('mode-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('editing');
      expect(screen.getByText('Editing')).toBeInTheDocument();
    });

    it('should have accessible aria attributes on mode indicator', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="recording"
        />
      );

      const indicator = screen.getByTestId('mode-indicator');
      expect(indicator).toHaveAttribute('role', 'status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
      expect(indicator).toHaveAttribute('aria-label', 'Current mode: Recording');
    });

    it('should update mode indicator when mode changes', () => {
      const { rerender } = render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="recording"
        />
      );

      const indicator = screen.getByTestId('mode-indicator');
      expect(indicator).toHaveClass('recording');
      // Query within the mode indicator to avoid matching the tab label
      expect(indicator).toHaveTextContent('Recording');

      rerender(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="playing"
        />
      );

      const updatedIndicator = screen.getByTestId('mode-indicator');
      expect(updatedIndicator).toHaveClass('playing');
      expect(updatedIndicator).toHaveTextContent('Playing');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle Enter key press on tab', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      const listTab = screen.getByTestId('tab-list');
      fireEvent.keyDown(listTab, { key: 'Enter' });
      expect(mockOnTabChange).toHaveBeenCalledWith('list');
    });

    it('should handle Space key press on tab', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      const builderTab = screen.getByTestId('tab-builder');
      fireEvent.keyDown(builderTab, { key: ' ' });
      expect(mockOnTabChange).toHaveBeenCalledWith('builder');
    });

    it('should not trigger on other keys', () => {
      render(
        <TabBar
          activeTab="recording"
          onTabChange={mockOnTabChange}
          applicationMode="idle"
        />
      );

      const listTab = screen.getByTestId('tab-list');
      fireEvent.keyDown(listTab, { key: 'Tab' });
      expect(mockOnTabChange).not.toHaveBeenCalled();
    });
  });
});
