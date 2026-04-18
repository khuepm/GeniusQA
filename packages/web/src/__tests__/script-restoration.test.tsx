import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GuestModeProvider>{children}</GuestModeProvider>
);

describe('Script Restoration Functionality', () => {
  beforeEach(() => {
    localStorageMock.clear();
    alertMock.mockClear();
  });

  it('should restore scripts from localStorage on mount', () => {
    // Pre-populate localStorage with scripts
    const existingScripts = [
      {
        id: 'script1',
        name: 'Test Script 1',
        content: 'test content 1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'script2',
        name: 'Test Script 2',
        content: 'test content 2',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
    ];

    localStorageMock.setItem('geniusqa_web_guest_scripts', JSON.stringify(existingScripts));

    // Render the hook
    const { result } = renderHook(() => useGuestMode(), { wrapper });

    // Should restore the scripts from localStorage
    expect(result.current.scripts).toHaveLength(2);
    expect(result.current.scriptCount).toBe(2);
    expect(result.current.scripts[0].name).toBe('Test Script 1');
    expect(result.current.scripts[1].name).toBe('Test Script 2');
  });

  it('should save scripts to localStorage when new scripts are added', () => {
    const { result } = renderHook(() => useGuestMode(), { wrapper });

    act(() => {
      result.current.addScript({
        name: 'New Script',
        content: 'new script content'
      });
    });

    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'geniusqa_web_guest_scripts',
      expect.stringContaining('New Script')
    );

    // Should update the scripts state
    expect(result.current.scripts).toHaveLength(1);
    expect(result.current.scripts[0].name).toBe('New Script');
  });

  it('should persist scripts between component unmount and remount', () => {
    // First render - add a script
    const { result: firstResult, unmount } = renderHook(() => useGuestMode(), { wrapper });

    act(() => {
      firstResult.current.addScript({
        name: 'Persistent Script',
        content: 'persistent content'
      });
    });

    expect(firstResult.current.scripts).toHaveLength(1);

    // Unmount the component
    unmount();

    // Second render - should restore the script
    const { result: secondResult } = renderHook(() => useGuestMode(), { wrapper });

    expect(secondResult.current.scripts).toHaveLength(1);
    expect(secondResult.current.scripts[0].name).toBe('Persistent Script');
  });
});
