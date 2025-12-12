/**
 * ScriptListItem Component
 * 
 * Displays a single script item in a list with:
 * - Source type badge (Recorded / AI Generated)
 * - Target OS badge (for AI-generated scripts)
 * - Script metadata (created date, duration, action count)
 * - Delete action
 * 
 * Requirements: 9.2, 9.5
 */

import React from 'react';
import { StoredScriptInfo, ScriptSource, TargetOS } from '../services/scriptStorageService';
import './ScriptListItem.css';

/**
 * Props for the ScriptListItem component
 */
export interface ScriptListItemProps {
  /** Script information to display */
  script: StoredScriptInfo;
  /** Whether this item is currently selected */
  selected?: boolean;
  /** Callback when the item is clicked */
  onClick?: (script: StoredScriptInfo) => void;
  /** Callback when delete is clicked */
  onDelete?: (script: StoredScriptInfo) => void;
  /** Whether to show the delete button */
  showDelete?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

/**
 * Configuration for source badges
 */
const SOURCE_BADGE_CONFIG: Record<ScriptSource, { label: string; icon: string }> = {
  recorded: { label: 'Recorded', icon: '🎬' },
  ai_generated: { label: 'AI Generated', icon: '🤖' },
  unknown: { label: 'Unknown', icon: '❓' },
};

/**
 * Configuration for OS badges
 */
const OS_BADGE_CONFIG: Record<TargetOS, { label: string; icon: string }> = {
  macos: { label: 'macOS', icon: '🍎' },
  windows: { label: 'Windows', icon: '🪟' },
  universal: { label: 'Universal', icon: '🔄' },
};

/**
 * Formats a date string for display
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}

/**
 * Formats duration in seconds for display
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * ScriptListItem Component
 * Displays a script item with source and OS badges
 */
export const ScriptListItem: React.FC<ScriptListItemProps> = ({
  script,
  selected = false,
  onClick,
  onDelete,
  showDelete = true,
  compact = false,
}) => {
  /**
   * Handle item click
   */
  const handleClick = () => {
    onClick?.(script);
  };

  /**
   * Handle delete click
   */
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(script);
  };

  // Get badge configurations
  const sourceBadge = SOURCE_BADGE_CONFIG[script.source];
  const osBadge = script.targetOS ? OS_BADGE_CONFIG[script.targetOS] : null;

  return (
    <div
      className={`script-list-item ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* Header with filename and delete button */}
      <div className="script-list-item-header">
        <div className="script-list-item-title">
          <span className="script-list-item-filename">{script.filename}</span>
          {script.scriptName && (
            <span className="script-list-item-name">{script.scriptName}</span>
          )}
        </div>
        {showDelete && onDelete && (
          <div className="script-list-item-actions">
            <button
              className="script-list-item-delete"
              onClick={handleDelete}
              type="button"
              aria-label={`Delete ${script.filename}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Source and OS Badges */}
      <div className="script-list-item-badges">
        {/* Source Badge */}
        <span className={`script-badge source-${script.source}`}>
          <span className="script-badge-icon">{sourceBadge.icon}</span>
          {sourceBadge.label}
        </span>

        {/* OS Badge (only for AI-generated scripts) */}
        {osBadge && (
          <span className={`script-badge os-${script.targetOS}`}>
            <span className="script-badge-icon">{osBadge.icon}</span>
            {osBadge.label}
          </span>
        )}
      </div>

      {/* Script Info */}
      <p className="script-list-item-info">
        Created: {formatDate(script.createdAt)}
      </p>
      <p className="script-list-item-info">
        Duration: {formatDuration(script.duration)} | Actions: {script.actionCount}
      </p>
    </div>
  );
};

export default ScriptListItem;
