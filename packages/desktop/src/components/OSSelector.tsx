/**
 * OSSelector Component
 * 
 * Provides UI for selecting the target operating system for AI-generated scripts.
 * Displays macOS, Windows, and Universal options with appropriate icons.
 * 
 * Requirements: 8.1
 */

import React from 'react';
import './OSSelector.css';

/**
 * Target operating system type
 */
export type TargetOS = 'macos' | 'windows' | 'universal';

/**
 * OS option configuration
 */
interface OSOption {
  id: TargetOS;
  name: string;
  icon: string;
  description: string;
}

/**
 * Available OS options
 */
const OS_OPTIONS: OSOption[] = [
  {
    id: 'macos',
    name: 'macOS',
    icon: '🍎',
    description: 'Cmd-based shortcuts',
  },
  {
    id: 'windows',
    name: 'Windows',
    icon: '🪟',
    description: 'Ctrl-based shortcuts',
  },
  {
    id: 'universal',
    name: 'Universal',
    icon: '🌐',
    description: 'Cross-platform compatible',
  },
];

/**
 * Props for OSSelector component
 */
export interface OSSelectorProps {
  /** Currently selected OS */
  selectedOS: TargetOS;
  /** Callback when OS selection changes */
  onOSChange: (os: TargetOS) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional label to display above the selector */
  label?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * OSSelector Component
 * 
 * Renders a button group for selecting the target operating system.
 * Shows availability status and descriptions for each option.
 */
export const OSSelector: React.FC<OSSelectorProps> = ({
  selectedOS,
  onOSChange,
  disabled = false,
  label = 'Target OS',
  compact = false,
}) => {
  /**
   * Handle OS selection
   */
  const handleOSSelect = (os: TargetOS) => {
    if (disabled || os === selectedOS) {
      return;
    }
    onOSChange(os);
  };

  /**
   * Get the currently selected OS option
   */
  const getSelectedOption = (): OSOption | undefined => {
    return OS_OPTIONS.find(opt => opt.id === selectedOS);
  };

  const selectedOption = getSelectedOption();

  return (
    <div
      className={`os-selector-container ${compact ? 'compact' : ''} ${disabled ? 'disabled' : ''}`}
      data-testid="os-selector"
    >
      {label && (
        <div className="os-selector-header">
          <span className="os-selector-label">{label}</span>
          {selectedOption && (
            <span className="os-selector-current">
              {selectedOption.icon} {selectedOption.name}
            </span>
          )}
        </div>
      )}

      <div className="os-selector-options" role="group" aria-label="Target OS selection">
        {OS_OPTIONS.map((option) => {
          const isSelected = option.id === selectedOS;

          return (
            <button
              key={option.id}
              type="button"
              className={`os-option ${isSelected ? 'selected' : ''}`}
              onClick={() => handleOSSelect(option.id)}
              disabled={disabled}
              data-testid={`os-option-${option.id}`}
              aria-pressed={isSelected}
              aria-label={`${option.name}: ${option.description}`}
            >
              <span className="os-option-icon" aria-hidden="true">
                {option.icon}
              </span>
              <div className="os-option-content">
                <span className="os-option-name">{option.name}</span>
                {!compact && (
                  <span className="os-option-description">{option.description}</span>
                )}
              </div>
              {isSelected && (
                <span className="os-option-check" aria-hidden="true">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OSSelector;
