/**
 * Script Name Dialog Component
 * 
 * Modal dialog for naming AI-generated scripts before saving.
 * Validates script names and generates appropriate file paths.
 * 
 * Requirements: 4.3, 6.5
 */

import React, { useState, useCallback, useEffect } from 'react';
import './ScriptNameDialog.css';

/**
 * Props for the ScriptNameDialog component
 */
export interface ScriptNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scriptName: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  defaultName?: string;
}

/**
 * Validates a script name
 * @param name - The script name to validate
 * @returns Error message if invalid, null if valid
 */
export function validateScriptName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Script name cannot be empty';
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 3) {
    return 'Script name must be at least 3 characters';
  }

  if (trimmedName.length > 100) {
    return 'Script name must be less than 100 characters';
  }

  // Check for invalid characters (only allow alphanumeric, spaces, hyphens, underscores)
  const invalidChars = /[^a-zA-Z0-9\s\-_]/;
  if (invalidChars.test(trimmedName)) {
    return 'Script name can only contain letters, numbers, spaces, hyphens, and underscores';
  }

  return null;
}

/**
 * Generates a filename from a script name
 * @param name - The user-provided script name
 * @returns A valid filename
 */
export function generateFilename(name: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sanitizedName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  return `ai_script_${sanitizedName}_${timestamp}.json`;
}

/**
 * Generates a default script name based on current timestamp
 */
export function generateDefaultName(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/:/g, '-');
  return `AI Script ${dateStr} ${timeStr}`;
}

/**
 * Script Name Dialog Component
 */
export const ScriptNameDialog: React.FC<ScriptNameDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  isLoading,
  error,
  defaultName,
}) => {
  const [scriptName, setScriptName] = useState(defaultName || generateDefaultName());
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setScriptName(defaultName || generateDefaultName());
      setValidationError(null);
    }
  }, [isOpen, defaultName]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setScriptName(newName);

    // Clear validation error when user types
    if (validationError) {
      setValidationError(null);
    }
  }, [validationError]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate the name
    const error = validateScriptName(scriptName);
    if (error) {
      setValidationError(error);
      return;
    }

    await onSave(scriptName.trim());
  }, [scriptName, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const displayError = validationError || error;

  return (
    <div
      className="script-name-dialog-overlay"
      data-testid="script-name-dialog"
      onKeyDown={handleKeyDown}
    >
      <div className="script-name-dialog">
        <div className="script-name-dialog-header">
          <h2>Save Script</h2>
          <button
            className="script-name-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="script-name-dialog-body">
          <p className="script-name-dialog-description">
            Enter a name for your AI-generated script. The script will be saved to your library.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="script-name-input-group">
              <label htmlFor="script-name-input">Script Name</label>
              <input
                id="script-name-input"
                type="text"
                value={scriptName}
                onChange={handleNameChange}
                placeholder="Enter script name..."
                className={`script-name-input ${displayError ? 'script-name-input-error' : ''}`}
                disabled={isLoading}
                autoFocus
                data-testid="script-name-input"
              />
              <span className="script-name-hint">
                Filename: {generateFilename(scriptName || 'untitled')}
              </span>
            </div>

            {displayError && (
              <div className="script-name-error" data-testid="script-name-error">
                {displayError}
              </div>
            )}

            <div className="script-name-dialog-actions">
              <button
                type="button"
                className="script-name-cancel-button"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="script-name-save-button"
                disabled={!scriptName.trim() || isLoading}
                data-testid="script-name-save-button"
              >
                {isLoading ? 'Saving...' : '💾 Save Script'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScriptNameDialog;
