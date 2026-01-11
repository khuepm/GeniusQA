/**
 * Tooltip Component
 * Standalone tooltip component with positioning logic and smooth animations
 * Requirements: 3.2, 3.5, 9.4
 */

import React, { useEffect, useState, useRef } from 'react';
import './Tooltip.css';

export interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  visible: boolean;
  targetRect?: DOMRect;
  className?: string;
}

/**
 * Tooltip Component
 * Provides positioned tooltips with smooth animations and intelligent positioning
 * Requirements: 3.2, 3.5, 9.4
 */
export const Tooltip: React.FC<TooltipProps> = ({
  text,
  position = 'bottom',
  delay = 500,
  visible,
  targetRect,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Handle visibility with delay - Requirements: 9.4
  useEffect(() => {
    if (visible && targetRect) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, targetRect, delay]);

  // Calculate optimal position based on viewport constraints
  useEffect(() => {
    if (!isVisible || !targetRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let optimalPosition = position;

    // Check if tooltip fits in preferred position
    switch (position) {
      case 'top':
        if (targetRect.top - tooltipRect.height - 8 < 0) {
          optimalPosition = 'bottom';
        }
        break;
      case 'bottom':
        if (targetRect.bottom + tooltipRect.height + 8 > viewport.height) {
          optimalPosition = 'top';
        }
        break;
      case 'left':
        if (targetRect.left - tooltipRect.width - 8 < 0) {
          optimalPosition = 'right';
        }
        break;
      case 'right':
        if (targetRect.right + tooltipRect.width + 8 > viewport.width) {
          optimalPosition = 'left';
        }
        break;
    }

    setActualPosition(optimalPosition);
  }, [isVisible, targetRect, position]);

  // Don't render if not visible or no target
  if (!isVisible || !targetRect) {
    return null;
  }

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 1000,
      pointerEvents: 'none',
    };

    const offset = 8; // Distance from target element

    switch (actualPosition) {
      case 'top':
        style.bottom = window.innerHeight - targetRect.top + offset;
        style.left = targetRect.left + (targetRect.width / 2);
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        style.top = targetRect.bottom + offset;
        style.left = targetRect.left + (targetRect.width / 2);
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.top = targetRect.top + (targetRect.height / 2);
        style.right = window.innerWidth - targetRect.left + offset;
        style.transform = 'translateY(-50%)';
        break;
      case 'right':
        style.top = targetRect.top + (targetRect.height / 2);
        style.left = targetRect.right + offset;
        style.transform = 'translateY(-50%)';
        break;
    }

    return style;
  };

  const tooltipClasses = [
    'tooltip',
    `tooltip-${actualPosition}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={tooltipRef}
      className={tooltipClasses}
      style={getTooltipStyle()}
      role="tooltip"
      aria-hidden={!isVisible}
      data-testid="tooltip"
    >
      {text}
    </div>
  );
};

export default Tooltip;
