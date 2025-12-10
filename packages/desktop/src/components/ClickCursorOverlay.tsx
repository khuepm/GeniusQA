/**
 * ClickCursorOverlay Component
 * Displays a cursor image at click positions during recording
 * 
 * This component creates a transparent overlay window that shows
 * a cursor icon at each click position with a fade-out animation.
 * 
 * It listens to both:
 * 1. IPC 'action_recorded' events from the Rust recorder
 * 2. Tauri 'recording_click' events as a direct channel
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getIPCBridge } from '../services/ipcBridgeService';
import { IPCEvent } from '../types/recorder.types';
import './ClickCursorOverlay.css';

// Import cursor image
import cursorImage from '../../assets/cursor-48.png';

interface ClickPosition {
  id: string;
  x: number;
  y: number;
  timestamp: number;
}

interface ClickCursorOverlayProps {
  /** Whether recording is active */
  isRecording: boolean;
  /** Duration in ms for cursor to stay visible (default: 500ms) */
  displayDuration?: number;
  /** Duration in ms for fade out animation (default: 300ms) */
  fadeOutDuration?: number;
}

/**
 * ClickCursorOverlay displays cursor icons at click positions during recording
 */
export const ClickCursorOverlay: React.FC<ClickCursorOverlayProps> = ({
  isRecording,
  displayDuration = 500,
  fadeOutDuration = 300,
}) => {
  const [clicks, setClicks] = useState<ClickPosition[]>([]);
  const ipcBridge = getIPCBridge();
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Add a click to the display
  const addClick = useCallback((x: number, y: number) => {
    const newClick: ClickPosition = {
      id: `click-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      x,
      y,
      timestamp: Date.now(),
    };

    setClicks(prev => [...prev, newClick]);

    // Remove click after display duration + fade out
    setTimeout(() => {
      setClicks(prev => prev.filter(c => c.id !== newClick.id));
    }, displayDuration + fadeOutDuration);
  }, [displayDuration, fadeOutDuration]);

  // Handle action recorded events from the recorder
  const handleActionRecorded = useCallback((event: IPCEvent) => {
    const action = event.data?.action;

    // Only show cursor for mouse click events
    if (action?.type === 'mouse_click' && action.x !== undefined && action.y !== undefined) {
      addClick(action.x, action.y);
    }
  }, [addClick]);

  // Subscribe to recording events from IPC
  useEffect(() => {
    if (!isRecording) {
      // Clear all clicks when recording stops
      setClicks([]);
      return;
    }

    ipcBridge.addEventListener('action_recorded', handleActionRecorded);

    return () => {
      ipcBridge.removeEventListener('action_recorded', handleActionRecorded);
    };
  }, [isRecording, handleActionRecorded, ipcBridge]);

  // Listen for Tauri recording click events (emitted by Rust recorder)
  useEffect(() => {
    if (!isRecording) {
      // Cleanup listener when not recording
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      return;
    }

    // Listen for recording_click events from backend
    const setupListener = async () => {
      try {
        console.log('[ClickCursorOverlay] Setting up recording_click listener...');
        unlistenRef.current = await listen<{ x: number; y: number; button: string }>(
          'recording_click',
          (event) => {
            console.log('[ClickCursorOverlay] Received recording_click event:', event.payload);
            if (event.payload && typeof event.payload.x === 'number' && typeof event.payload.y === 'number') {
              addClick(event.payload.x, event.payload.y);
            }
          }
        );
        console.log('[ClickCursorOverlay] Listener setup complete');
      } catch (error) {
        console.warn('[ClickCursorOverlay] Failed to setup recording_click listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [isRecording, addClick]);

  // Don't render if not recording or no clicks
  if (!isRecording || clicks.length === 0) {
    return null;
  }

  return (
    <div className="click-cursor-overlay">
      {clicks.map(click => {
        const age = Date.now() - click.timestamp;
        const isFading = age > displayDuration;

        return (
          <div
            key={click.id}
            className={`click-cursor ${isFading ? 'fading' : ''}`}
            style={{
              left: click.x,
              top: click.y,
              animationDuration: `${fadeOutDuration}ms`,
            }}
          >
            <img
              src={cursorImage}
              alt="click"
              className="cursor-image"
            />
            {/* Ripple effect */}
            <div className="click-ripple" />
          </div>
        );
      })}
    </div>
  );
};

export default ClickCursorOverlay;
