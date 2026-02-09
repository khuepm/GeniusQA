/**
 * ResizableDivider Component
 * 
 * A draggable horizontal divider that allows users to resize panels above and below it.
 * Provides visual feedback during hover and drag states.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import './ResizableDivider.css';

export interface ResizableDividerProps {
  /** Callback when resize occurs, provides the new Y position */
  onResize: (newY: number) => void;
  /** Current Y position of the divider */
  currentY?: number;
  /** Minimum Y position (top boundary) */
  minY?: number;
  /** Maximum Y position (bottom boundary) */
  maxY?: number;
  /** Whether the divider is disabled */
  disabled?: boolean;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  onResize,
  currentY,
  minY = 200,
  maxY = window.innerHeight - 100,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startPositionRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;

    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startPositionRef.current = currentY || e.clientY;
  }, [disabled, currentY]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    const deltaY = e.clientY - startYRef.current;
    const newY = startPositionRef.current + deltaY;

    // Apply constraints
    const constrainedY = Math.max(minY, Math.min(maxY, newY));

    onResize(constrainedY);
  }, [isDragging, minY, maxY, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={dividerRef}
      className={`resizable-divider ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize panels"
      data-testid="resizable-divider"
    >
      <div className="divider-handle" aria-hidden="true">
        <div className="divider-grip" />
      </div>
    </div>
  );
};

export default ResizableDivider;
