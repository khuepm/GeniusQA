/**
 * UnifiedInterface Component Tests
 * Tests for the core layout structure and state management
 * Requirements: 1.1, 1.3, 1.4
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../UnifiedInterface';

// Test component that uses the context
const TestComponent: React.FC = () => {
  const { state, setMode, setEditorVisible } = useUnifiedInterface();

  return (
    <div>
      <div data-testid="mode">{state.applicationMode}</div>
      <div data-testid="editor-visible">{state.editorVisible ? 'visible' : 'hidden'}</div>
      <button data-testid="set-recording" onClick={() => setMode('recording')}>
        Set Recording
      </button>
      <button data-testid="toggle-editor" onClick={() => setEditorVisible(!state.editorVisible)}>
        Toggle Editor
      </button>
    </div>
  );
};

describe('UnifiedInterface', () => {
  const renderWithProvider = (children: React.ReactNode) => {
    return render(
      <UnifiedInterfaceProvider>
        {children}
      </UnifiedInterfaceProvider>
    );
  };

  test('provides initial state correctly', () => {
    renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('mode')).toHaveTextContent('idle');
    expect(screen.getByTestId('editor-visible')).toHaveTextContent('visible');
  });

  test('updates application mode correctly', () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('set-recording'));
    expect(screen.getByTestId('mode')).toHaveTextContent('recording');
  });

  test('toggles editor visibility correctly', () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('toggle-editor'));
    expect(screen.getByTestId('editor-visible')).toHaveTextContent('hidden');

    fireEvent.click(screen.getByTestId('toggle-editor'));
    expect(screen.getByTestId('editor-visible')).toHaveTextContent('visible');
  });

  test('renders unified interface layout', () => {
    renderWithProvider(
      <UnifiedInterface>
        <div data-testid="test-child">Test Content</div>
      </UnifiedInterface>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(document.querySelector('.unified-interface')).toBeInTheDocument();
    expect(document.querySelector('.toolbar-area')).toBeInTheDocument();
    expect(document.querySelector('.editor-area')).toBeInTheDocument();
  });

  test('applies correct CSS classes based on state', () => {
    renderWithProvider(
      <UnifiedInterface>
        <TestComponent />
      </UnifiedInterface>
    );

    const unifiedInterface = document.querySelector('.unified-interface');
    expect(unifiedInterface).not.toHaveClass('toolbar-collapsed');

    const editorArea = document.querySelector('.editor-area');
    expect(editorArea).toHaveClass('visible');

    // Toggle editor visibility
    fireEvent.click(screen.getByTestId('toggle-editor'));
    expect(editorArea).toHaveClass('hidden');
  });

  test('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useUnifiedInterface must be used within a UnifiedInterfaceProvider');

    consoleSpy.mockRestore();
  });
});
