/**
 * Task 18 Implementation Tests
 * Tests for the enhanced EditorArea with timeline and code views
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorArea } from '../EditorArea';

// Mock the UnifiedInterface context
const mockUnifiedInterface = {
  state: {
    applicationMode: 'idle' as const,
    editorVisible: true,
    recordingSession: null,
    currentScript: null
  },
  dispatch: jest.fn()
};

jest.mock('../UnifiedInterface', () => ({
  useUnifiedInterface: () => mockUnifiedInterface
}));

describe('EditorArea - Task 18 Implementation', () => {
  const mockActions = [
    {
      id: 'action_1',
      type: 'mouse_click',
      timestamp: 1000,
      data: { x: 100, y: 200 }
    },
    {
      id: 'action_2',
      type: 'key_press',
      timestamp: 2000,
      data: { key: 'Enter' }
    }
  ];

  const mockScript = {
    id: 'test-script',
    filename: 'test-script.json',
    path: '/test/path',
    actions: mockActions,
    lastModified: Date.now(),
    content: JSON.stringify(mockActions)
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 18.1 - Timeline and Code View Modes', () => {
    it('should render view mode selector with all three modes', () => {
      render(<EditorArea script={mockScript} />);

      expect(screen.getByRole('tab', { name: /list/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /timeline/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /code/i })).toBeInTheDocument();
    });

    it('should switch to timeline view when timeline button is clicked', () => {
      render(<EditorArea script={mockScript} />);

      const timelineButton = screen.getByRole('tab', { name: /timeline/i });
      fireEvent.click(timelineButton);

      expect(timelineButton).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('region', { name: /timeline view/i })).toBeInTheDocument();
    });

    it('should switch to code view when code button is clicked', () => {
      render(<EditorArea script={mockScript} />);

      const codeButton = screen.getByRole('tab', { name: /code/i });
      fireEvent.click(codeButton);

      expect(codeButton).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('region', { name: /code view/i })).toBeInTheDocument();
    });

    it('should display timeline with actions when in timeline mode', () => {
      render(<EditorArea script={mockScript} />);

      const timelineButton = screen.getByRole('tab', { name: /timeline/i });
      fireEvent.click(timelineButton);

      // Should show timeline info
      expect(screen.getByText(/duration:/i)).toBeInTheDocument();
      expect(screen.getByText(/2 actions/i)).toBeInTheDocument();
    });

    it('should display generated code when in code mode', () => {
      render(<EditorArea script={mockScript} />);

      const codeButton = screen.getByRole('tab', { name: /code/i });
      fireEvent.click(codeButton);

      // Should show code header
      expect(screen.getByText(/generated code/i)).toBeInTheDocument();
      expect(screen.getByText(/python/i)).toBeInTheDocument();

      // Should show copy button
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('should show empty state for timeline when no actions', () => {
      render(<EditorArea script={{ ...mockScript, actions: [] }} />);

      const timelineButton = screen.getByRole('tab', { name: /timeline/i });
      fireEvent.click(timelineButton);

      expect(screen.getByText(/no timeline data/i)).toBeInTheDocument();
    });

    it('should show empty state for code when no actions', () => {
      render(<EditorArea script={{ ...mockScript, actions: [] }} />);

      const codeButton = screen.getByRole('tab', { name: /code/i });
      fireEvent.click(codeButton);

      expect(screen.getByText(/no code generated/i)).toBeInTheDocument();
    });
  });

  describe('Task 18.2 - Enhanced Error Recovery', () => {
    it('should render without crashing when error boundary is triggered', () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      // Component should render even with potential errors
      const { container } = render(<EditorArea script={mockScript} />);
      expect(container).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should handle script prop changes gracefully', () => {
      const { rerender } = render(<EditorArea script={mockScript} />);

      // Change script
      const newScript = { ...mockScript, id: 'new-script', actions: [] };
      rerender(<EditorArea script={newScript} />);

      // Should still render without errors
      expect(screen.getByText(/script editor/i)).toBeInTheDocument();
    });

    it('should handle missing script gracefully', () => {
      render(<EditorArea script={null} />);

      // Should show empty state
      expect(screen.getByText(/no actions yet/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for view mode tabs', () => {
      render(<EditorArea script={mockScript} />);

      const listTab = screen.getByRole('tab', { name: /list/i });
      const timelineTab = screen.getByRole('tab', { name: /timeline/i });
      const codeTab = screen.getByRole('tab', { name: /code/i });

      expect(listTab).toHaveAttribute('aria-controls', 'editor-content');
      expect(timelineTab).toHaveAttribute('aria-controls', 'editor-content');
      expect(codeTab).toHaveAttribute('aria-controls', 'editor-content');
    });

    it('should have proper tabindex for active tab', () => {
      render(<EditorArea script={mockScript} />);

      const listTab = screen.getByRole('tab', { name: /list/i });
      const timelineTab = screen.getByRole('tab', { name: /timeline/i });

      expect(listTab).toHaveAttribute('tabIndex', '0');
      expect(timelineTab).toHaveAttribute('tabIndex', '-1');
    });
  });
});
