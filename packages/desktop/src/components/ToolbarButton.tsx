/**
 * ToolbarButton Component
 * Reusable button component with icon, tooltip, and state management
 * Requirements: 3.1, 3.2, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { IconType, ICON_COMPONENTS } from './icons';
import { Tooltip } from './Tooltip';
import './ToolbarButton.css';

// ToolbarButton props
export interface ToolbarButtonProps {
  icon: IconType;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// ToolbarButton state
interface ToolbarButtonState {
  isHovered: boolean;
  isPressed: boolean;
  tooltipVisible: boolean;
}

/**
 * ToolbarButton Component
 * Requirements: 3.1, 3.2, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */
export const ToolbarButton: React.FC<ToolbarButtonProps> = React.memo(({
  icon,
  tooltip,
  onClick,
  disabled = false,
  active = false,
  variant = 'secondary'
}) => {
  const [state, setState] = useState<ToolbarButtonState>({
    isHovered: false,
    isPressed: false,
    tooltipVisible: false
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout>();
  const [targetRect, setTargetRect] = useState<DOMRect>();

  // Get icon component
  const IconComponent = ICON_COMPONENTS[icon];

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleClick();
        break;
      case 'Escape':
        // Hide tooltip on escape
        setState(prev => ({ ...prev, tooltipVisible: false }));
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
        }
        break;
    }
  };

  // Handle focus events for accessibility
  const handleFocus = () => {
    if (disabled) return;

    // Show tooltip on focus for keyboard users
    tooltipTimeoutRef.current = setTimeout(() => {
      if (buttonRef.current) {
        setTargetRect(buttonRef.current.getBoundingClientRect());
        setState(prev => ({ ...prev, tooltipVisible: true }));
      }
    }, 100); // Shorter delay for keyboard focus
  };

  const handleBlur = () => {
    setState(prev => ({ ...prev, tooltipVisible: false }));
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  // Handle mouse enter - Requirements: 9.1, 9.4
  const handleMouseEnter = () => {
    if (disabled) return;

    setState(prev => ({ ...prev, isHovered: true }));

    // Show tooltip after 500ms delay - Requirements: 9.4
    tooltipTimeoutRef.current = setTimeout(() => {
      if (buttonRef.current) {
        setTargetRect(buttonRef.current.getBoundingClientRect());
        setState(prev => ({ ...prev, tooltipVisible: true }));
      }
    }, 500);
  };

  // Handle mouse leave - Requirements: 9.1
  const handleMouseLeave = () => {
    setState(prev => ({
      ...prev,
      isHovered: false,
      tooltipVisible: false
    }));

    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  // Handle mouse down - Requirements: 9.2
  const handleMouseDown = () => {
    if (disabled) return;
    setState(prev => ({ ...prev, isPressed: true }));
  };

  // Handle mouse up - Requirements: 9.2
  const handleMouseUp = () => {
    setState(prev => ({ ...prev, isPressed: false }));
  };

  // Handle click - Requirements: 9.2
  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Build CSS classes
  const buttonClasses = [
    'toolbar-button',
    `toolbar-button-${variant}`,
    state.isHovered && !disabled ? 'hovered' : '',
    state.isPressed && !disabled ? 'pressed' : '',
    active ? 'active' : '',
    disabled ? 'disabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <>
      <button
        ref={buttonRef}
        className={buttonClasses}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        aria-label={tooltip}
        aria-pressed={active}
        aria-describedby={state.tooltipVisible ? `tooltip-${icon}` : undefined}
        title="" // Prevent default browser tooltip
        data-testid={`button-${icon}`}
        tabIndex={disabled ? -1 : 0}
      >
        <IconComponent
          size={16}
          className="toolbar-button-icon"
          aria-hidden="true"
        />
      </button>

      {/* Tooltip */}
      <Tooltip
        text={tooltip}
        position="bottom"
        visible={state.tooltipVisible}
        targetRect={targetRect}
        id={`tooltip-${icon}`}
      />
    </>
  );
});

export default ToolbarButton;
