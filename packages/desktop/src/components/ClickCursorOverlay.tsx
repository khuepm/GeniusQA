/**
 * ClickCursorOverlay Component
 * Displays a cursor image at click positions during recording
 * 
 * This component manages a fullscreen transparent overlay window that shows
 * a cursor icon at each click position with a fade-out animation.
 * 
 * It listens to:
 * 1. IPC 'action_recorded' events from the Rust recorder
 * 2. Tauri 'recording_click' events as a direct channel
 * 
 * And forwards click events to a fullscreen overlay window.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getIPCBridge } from '../services/ipcBridgeService';
import { IPCEvent } from '../types/recorder.types';

interface ClickCursorOverlayProps {
  /** Whether recording is active */
  isRecording: boolean;
}

/**
 * ClickCursorOverlay manages fullscreen cursor overlay during recording
 */
export const ClickCursorOverlay: React.FC<ClickCursorOverlayProps> = ({
  isRecording,
}) => {
  const ipcBridge = getIPCBridge();
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Show cursor at position via Tauri command
  const showCursor = useCallback(async (x: number, y: number, button: string = 'left') => {
    try {
      await invoke('show_click_cursor', { x, y, button });
    } catch (error) {
      console.warn('[ClickCursorOverlay] Failed to show cursor:', error);
    }
  }, []);

  // Handle action recorded events from the recorder
  const handleActionRecorded = useCallback((event: IPCEvent) => {
    const action = event.data?.action;
    if (action?.type === 'mouse_click' && action.x !== undefined && action.y !== undefined) {
      showCursor(action.x, action.y, action.button || 'left');
    }
  }, [showCursor]);

  // Create/close overlay window based on recording state
  useEffect(() => {
    const manageOverlay = async () => {
      if (isRecording) {
        try {
          console.log('[ClickCursorOverlay] Creating fullscreen overlay...');
          await invoke('create_click_overlay');
          console.log('[ClickCursorOverlay] Overlay created');
        } catch (error) {
          console.warn('[ClickCursorOverlay] Failed to create overlay:', error);
        }
      } else {
        try {
          console.log('[ClickCursorOverlay] Closing overlay...');
          await invoke('close_click_overlay');
          console.log('[ClickCursorOverlay] Overlay closed');
        } catch (error) {
          console.warn('[ClickCursorOverlay] Failed to close overlay:', error);
        }
      }
    };

    manageOverlay();
  }, [isRecording]);

  // Subscribe to recording events from IPC
  useEffect(() => {
    if (!isRecording) return;

    ipcBridge.addEventListener('action_recorded', handleActionRecorded);
    return () => {
      ipcBridge.removeEventListener('action_recorded', handleActionRecorded);
    };
  }, [isRecording, handleActionRecorded, ipcBridge]);

  // Listen for Tauri recording click events
  useEffect(() => {
    if (!isRecording) {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      return;
    }

    const setupListener = async () => {
      try {
        console.log('[ClickCursorOverlay] Setting up recording_click listener...');
        unlistenRef.current = await listen<{ x: number; y: number; button: string }>(
          'recording_click',
          (event) => {
            console.log('[ClickCursorOverlay] Received recording_click:', event.payload);
            if (event.payload?.x !== undefined && event.payload?.y !== undefined) {
              showCursor(event.payload.x, event.payload.y, event.payload.button || 'left');
            }
          }
        );
        console.log('[ClickCursorOverlay] Listener ready');
      } catch (error) {
        console.warn('[ClickCursorOverlay] Failed to setup listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [isRecording, showCursor]);

  // This component doesn't render anything - overlay is a separate window
  return null;
};

export default ClickCursorOverlay;
