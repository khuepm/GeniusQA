/**
 * ToolbarButton Component
 * Reusable button component with icon, tooltip, and state management
 * Requirements: 3.1, 3.2, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useState, useRef, useEffect } from 'react';
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
export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
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
        disabled={disabled}
        aria-label={tooltip}
        title="" // Prevent default browser tooltip
        data-testid={`button-${icon}`}
      >
        <IconComponent
          size={16}
          className="toolbar-button-icon"
        />
      </button>

      {/* Tooltip */}
      <Tooltip
        text={tooltip}
        position="bottom"
        visible={state.tooltipVisible}
        targetRect={targetRect}
      />
    </>
  );
};

export default ToolbarButton;
