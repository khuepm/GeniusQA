import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuestModeProvider, useGuestMode } from '../contexts/GuestModeContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test component
const TestComponent: React.FC = () => {
  const {
    storageError,
    clearStorageError,
    getStorageInfo,
    isStorageNearFull,
    addScript,
    scriptCount
  } = useGuestMode();

  const storageInfo = getStorageInfo();

  return (
    <div>
      <div data-testid="storage-error">{storageError || 'none'}</div>
      <div data-testid="is-storage-near-full">{isStorageNearFull.toString()}</div>
      <div data-testid="storage-usage-percent">{storageInfo.usagePercent}</div>
      <div data-testid="script-count">{scriptCount}</div>
      <button onClick={() => clearStorageError()} data-testid="clear-error">
        Clear Error
      </button>
      <button
        onClick={() => addScript({ name: 'Test Script', content: 'test content' })}
        data-testid="add-script"
      >
        Add Script
      </button>
    </div>
  );
};

describe('Guest Mode Storage Quota Handling', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should provide storage information', async () => {
    render(
      <GuestModeProvider>
        <TestComponent />
      </GuestModeProvider>
    );

    const storageUsageElement = screen.getByTestId('storage-usage-percent');
    const isNearFullElement = screen.getByTestId('is-storage-near-full');

    expect(storageUsageElement).toBeInTheDocument();
    expect(isNearFullElement).toHaveTextContent('false');
  });

  it('should allow clearing storage errors', async () => {
    // Mock localStorage to throw an error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    render(
      <GuestModeProvider>
        <TestComponent />
      </GuestModeProvider>
    );

    const addButton = screen.getByTestId('add-script');
    const clearErrorButton = screen.getByTestId('clear-error');
    const storageErrorElement = screen.getByTestId('storage-error');

    // Try to add a script to trigger error
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(storageErrorElement).toHaveTextContent('Storage quota exceeded');
    });

    // Clear the error
    fireEvent.click(clearErrorButton);

    await waitFor(() => {
      expect(storageErrorElement).toHaveTextContent('none');
    });

    consoleErrorSpy.mockRestore();
  });

  it('should handle localStorage errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    render(
      <GuestModeProvider>
        <TestComponent />
      </GuestModeProvider>
    );

    const addButton = screen.getByTestId('add-script');
    const storageErrorElement = screen.getByTestId('storage-error');

    // Try to add a script
    fireEvent.click(addButton);

    // Should show graceful error message
    await waitFor(() => {
      expect(storageErrorElement).toHaveTextContent('Storage quota exceeded');
    });

    // Should log error but not crash
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
