import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock alert
const alertMock = vi.fn();
Object.defineProperty(window, 'alert', {
  value: alertMock,
});

// Test component to interact with GuestModeContext
const TestComponent: React.FC = () => {
  const {
    scripts,
    addScript,
    scriptCount,
    canRecordMore,
    storageError,
    clearStorageError,
    getStorageInfo,
    isStorageNearFull
  } = useGuestMode();

  const handleAddScript = () => {
    addScript({
      name: `Test Script ${scripts.length + 1}`,
      content: 'test content',
    });
  };

  const handleClearError = () => {
    clearStorageError();
  };

  const storageInfo = getStorageInfo();

  return (
    <div>
      <div data-testid="script-count">{scriptCount}</div>
      <div data-testid="can-record-more">{canRecordMore.toString()}</div>
      <div data-testid="storage-error">{storageError || 'none'}</div>
      <div data-testid="is-storage-near-full">{isStorageNearFull.toString()}</div>
      <div data-testid="storage-usage-percent">{storageInfo.usagePercent}</div>
      <button onClick={handleAddScript} data-testid="add-script">
        Add Script
      </button>
      <button onClick={handleClearError} data-testid="clear-error">
        Clear Error
      </button>
      <div data-testid="scripts-list">
        {scripts.map((script) => (
          <div key={script.id} data-testid={`script-${script.id}`}>
            {script.name}
          </div>
        ))}
      </div>
    </div>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GuestModeProvider>
    {children}
  </GuestModeProvider>
);

describe('Guest Mode Script Limit', () => {
  beforeEach(() => {
    localStorageMock.clear();
    alertMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow creating scripts up to the 50-script limit', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const addButton = screen.getByTestId('add-script');
    const scriptCountElement = screen.getByTestId('script-count');
    const canRecordMoreElement = screen.getByTestId('can-record-more');

    // Initially should be able to record more
    expect(scriptCountElement).toHaveTextContent('0');
    expect(canRecordMoreElement).toHaveTextContent('true');

    // Add 49 scripts (should all succeed)
    for (let i = 0; i < 49; i++) {
      fireEvent.click(addButton);
      await waitFor(() => {
        expect(scriptCountElement).toHaveTextContent((i + 1).toString());
      });
    }

    // Should still be able to record more (49 < 50)
    expect(canRecordMoreElement).toHaveTextContent('true');
    expect(alertMock).not.toHaveBeenCalled();

    // Add the 50th script (should succeed)
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(scriptCountElement).toHaveTextContent('50');
    });

    // Should no longer be able to record more
    expect(canRecordMoreElement).toHaveTextContent('false');
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('should prevent creating more than 50 scripts and show alert', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const addButton = screen.getByTestId('add-script');
    const scriptCountElement = screen.getByTestId('script-count');

    // Add 50 scripts
    for (let i = 0; i < 50; i++) {
      fireEvent.click(addButton);
    }

    await waitFor(() => {
      expect(scriptCountElement).toHaveTextContent('50');
    });

    // Try to add the 51st script (should fail)
    fireEvent.click(addButton);

    // Should show alert and not increase count
    expect(alertMock).toHaveBeenCalledWith(
      'Guest mode is limited to 50 scripts. Please create an account to save more scripts.'
    );
    expect(scriptCountElement).toHaveTextContent('50');
  });

  it('should persist script count across page reloads', async () => {
    // First render - add some scripts
    const { unmount } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const addButton = screen.getByTestId('add-script');

    // Add 5 scripts
    for (let i = 0; i < 5; i++) {
      fireEvent.click(addButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId('script-count')).toHaveTextContent('5');
    });

    // Unmount component (simulate page reload)
    unmount();

    // Re-render component
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Should restore the script count
    await waitFor(() => {
      expect(screen.getByTestId('script-count')).toHaveTextContent('5');
    });
  });

  it('should correctly calculate canRecordMore based on current script count', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const addButton = screen.getByTestId('add-script');
    const canRecordMoreElement = screen.getByTestId('can-record-more');

    // Initially should be able to record more
    expect(canRecordMoreElement).toHaveTextContent('true');

    // Add scripts up to 49
    for (let i = 0; i < 49; i++) {
      fireEvent.click(addButton);
    }

    await waitFor(() => {
      expect(canRecordMoreElement).toHaveTextContent('true');
    });

    // Add the 50th script
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(canRecordMoreElement).toHaveTextContent('false');
    });
  });

  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage to throw an error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const addButton = screen.getByTestId('add-script');
    const storageErrorElement = screen.getByTestId('storage-error');

    // Try to add a script
    fireEvent.click(addButton);

    // Should show graceful error message
    await waitFor(() => {
      expect(storageErrorElement).toHaveTextContent('Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.');
    });

    // Should log error but not crash
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save guest scripts:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should provide storage information and near-full warnings', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const storageUsageElement = screen.getByTestId('storage-usage-percent');
    const isNearFullElement = screen.getByTestId('is-storage-near-full');

    // Initially should show storage usage
    expect(storageUsageElement).toBeInTheDocument();
    expect(isNearFullElement).toHaveTextContent('false');
  });

  it('should allow clearing storage errors', async () => {
    // Mock localStorage to throw an error initially
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
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

  it('should prevent adding scripts when storage is nearly full', async () => {
    // Mock getStorageInfo to return high usage
    const mockGetStorageInfo = vi.fn().mockReturnValue({
      used: 4800000, // ~4.8MB
      available: 200000, // ~200KB
      total: 5000000, // 5MB
      usagePercent: 96
    });

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    const addButton = screen.getByTestId('add-script');
    const storageErrorElement = screen.getByTestId('storage-error');

    // Try to add a script when storage is nearly full
    fireEvent.click(addButton);

    // Should show storage full warning
    await waitFor(() => {
      expect(storageErrorElement).toHaveTextContent('Storage is nearly full');
    });
  });
});
