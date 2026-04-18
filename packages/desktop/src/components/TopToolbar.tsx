/**
 * TopToolbar Component
 * Horizontal toolbar containing all action buttons with icons and tooltips
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useMemo, useCallback } from 'react';
import { useUnifiedInterface } from './UnifiedInterface';
import { ToolbarButton } from './ToolbarButton';
import { IconType } from './icons';
import { ErrorBoundary } from './ErrorBoundary';
import './TopToolbar.css';

// Button configuration interface
export interface ButtonConfig {
  id: string;
  icon: IconType;
  tooltip: string;
  group: 'recording' | 'playback' | 'editor' | 'settings';
  action: string;
  enabledWhen: (state: any) => boolean;
  activeWhen?: (state: any) => boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// Props interface
export interface TopToolbarProps {
  hasRecordings?: boolean;
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  onPlayStart?: () => void;
  onPlayStop?: () => void;
  onSave?: () => void;
  onOpen?: () => void;
  onClear?: () => void;
  onSettings?: () => void;
}

/**
 * TopToolbar Component
 * Renders the main toolbar with grouped action buttons
 */
export const TopToolbar: React.FC<TopToolbarProps> = React.memo(({
  hasRecordings = false,
  onRecordStart,
  onRecordStop,
  onPlayStart,
  onPlayStop,
  onSave,
  onOpen,
  onClear,
  onSettings
}) => {
  const { state } = useUnifiedInterface();

  // Memoize action handlers to prevent recreation on every render
  const actionHandlers: Record<string, () => void> = useMemo(() => ({
    START_RECORDING: () => {
      // Only allow recording if in idle mode
      if (state.applicationMode === 'idle') {
        onRecordStart?.();
      } else {
        console.warn('Cannot start recording: application not in idle mode');
      }
    },
    START_PLAYBACK: () => {
      // Only allow playback if in idle mode and has script
      if (state.applicationMode === 'idle' && state.currentScript) {
        onPlayStart?.();
      } else {
        console.warn('Cannot start playback: application not ready');
      }
    },
    STOP_ACTION: () => {
      if (state.applicationMode === 'recording') {
        onRecordStop?.();
      } else if (state.applicationMode === 'playing') {
        onPlayStop?.();
      } else {
        console.warn('No active action to stop');
      }
    },
    SAVE_SCRIPT: () => {
      // Only allow save if has script and not recording
      if (state.currentScript && state.applicationMode !== 'recording') {
        onSave?.();
      } else {
        console.warn('Cannot save: no script or recording in progress');
      }
    },
    OPEN_SCRIPT: () => {
      // Only allow open if in idle mode
      if (state.applicationMode === 'idle') {
        onOpen?.();
      } else {
        console.warn('Cannot open script: application not in idle mode');
      }
    },
    CLEAR_EDITOR: () => {
      // Only allow clear if has script and in idle mode
      if (state.currentScript && state.applicationMode === 'idle') {
        onClear?.();
      } else {
        console.warn('Cannot clear editor: no script or application not idle');
      }
    },
    OPEN_SETTINGS: () => {
      // Settings can always be opened
      onSettings?.();
    }
  }), [state.applicationMode, state.currentScript, onRecordStart, onRecordStop, onPlayStart, onPlayStop, onSave, onOpen, onClear, onSettings]);

  // Memoize keyboard event handlers to prevent recreation
  const handleKeyboardStartRecording = useCallback(() => actionHandlers.START_RECORDING(), [actionHandlers]);
  const handleKeyboardStartPlayback = useCallback(() => actionHandlers.START_PLAYBACK(), [actionHandlers]);
  const handleKeyboardStopAction = useCallback(() => actionHandlers.STOP_ACTION(), [actionHandlers]);
  const handleKeyboardSaveScript = useCallback(() => actionHandlers.SAVE_SCRIPT(), [actionHandlers]);
  const handleKeyboardOpenScript = useCallback(() => actionHandlers.OPEN_SCRIPT(), [actionHandlers]);

  // Handle keyboard shortcuts from UnifiedInterface
  React.useEffect(() => {
    window.addEventListener('keyboard-start-recording', handleKeyboardStartRecording);
    window.addEventListener('keyboard-start-playback', handleKeyboardStartPlayback);
    window.addEventListener('keyboard-stop-action', handleKeyboardStopAction);
    window.addEventListener('keyboard-save-script', handleKeyboardSaveScript);
    window.addEventListener('keyboard-open-script', handleKeyboardOpenScript);

    return () => {
      window.removeEventListener('keyboard-start-recording', handleKeyboardStartRecording);
      window.removeEventListener('keyboard-start-playback', handleKeyboardStartPlayback);
      window.removeEventListener('keyboard-stop-action', handleKeyboardStopAction);
      window.removeEventListener('keyboard-save-script', handleKeyboardSaveScript);
      window.removeEventListener('keyboard-open-script', handleKeyboardOpenScript);
    };
  }, [handleKeyboardStartRecording, handleKeyboardStartPlayback, handleKeyboardStopAction, handleKeyboardSaveScript, handleKeyboardOpenScript]);
  // Memoize button configurations to prevent recreation on every render
  const buttonConfigs = useMemo((): ButtonConfig[] => [
    // Recording Group
    {
      id: 'record',
      icon: 'record',
      tooltip: 'Start Recording (Ctrl+R)',
      group: 'recording',
      action: 'START_RECORDING',
      enabledWhen: (appState) => appState.applicationMode === 'idle',
      activeWhen: (appState) => appState.applicationMode === 'recording',
      variant: 'primary'
    },

    // Playback Group
    {
      id: 'play',
      icon: 'play',
      tooltip: 'Start Playback (Ctrl+P)',
      group: 'playback',
      action: 'START_PLAYBACK',
      enabledWhen: (appState) =>
        appState.applicationMode === 'idle' &&
        (appState.currentScript !== null || hasRecordings),
      activeWhen: (appState) => appState.applicationMode === 'playing'
    },
    {
      id: 'stop',
      icon: 'stop',
      tooltip: 'Stop Current Action (Ctrl+S)',
      group: 'playback',
      action: 'STOP_ACTION',
      enabledWhen: (appState) =>
        appState.applicationMode === 'recording' ||
        appState.applicationMode === 'playing',
      variant: 'danger'
    },

    // Editor Group
    {
      id: 'save',
      icon: 'save',
      tooltip: 'Save Script (Ctrl+S)',
      group: 'editor',
      action: 'SAVE_SCRIPT',
      enabledWhen: (appState) =>
        appState.currentScript !== null &&
        appState.applicationMode !== 'recording'
    },
    {
      id: 'open',
      icon: 'open',
      tooltip: 'Open Script (Ctrl+O)',
      group: 'editor',
      action: 'OPEN_SCRIPT',
      enabledWhen: (appState) => appState.applicationMode === 'idle'
    },
    {
      id: 'clear',
      icon: 'clear',
      tooltip: 'Clear Editor',
      group: 'editor',
      action: 'CLEAR_EDITOR',
      enabledWhen: (appState) =>
        appState.currentScript !== null &&
        appState.applicationMode === 'idle'
    },

    // Settings Group
    {
      id: 'settings',
      icon: 'settings',
      tooltip: 'Settings',
      group: 'settings',
      action: 'OPEN_SETTINGS',
      enabledWhen: () => true
    }
  ], [hasRecordings]);

  // Memoize grouped buttons to prevent recalculation
  const groupedButtons = useMemo(() => {
    return buttonConfigs.reduce((groups, button) => {
      if (!groups[button.group]) {
        groups[button.group] = [];
      }
      groups[button.group].push(button);
      return groups;
    }, {} as Record<string, ButtonConfig[]>);
  }, [buttonConfigs]);

  // Memoize render button group function
  const renderButtonGroup = useCallback((groupName: string, buttons: ButtonConfig[]) => (
    <ErrorBoundary
      key={groupName}
      fallback={
        <div className={`toolbar-group toolbar-group-${groupName} error`}>
          <div className="toolbar-error">⚠️</div>
        </div>
      }
    >
      <div className={`toolbar-group toolbar-group-${groupName}`}>
        {buttons.map((button) => {
          const appState = {
            ...state,
            hasRecordings
          };

          const isEnabled = button.enabledWhen(appState);
          const isActive = button.activeWhen?.(appState) || false;

          return (
            <ToolbarButton
              key={button.id}
              icon={button.icon}
              tooltip={button.tooltip}
              onClick={actionHandlers[button.action]}
              disabled={!isEnabled}
              active={isActive}
              variant={button.variant}
            />
          );
        })}
      </div>
    </ErrorBoundary>
  ), [state, hasRecordings, actionHandlers]);

  return (
    <ErrorBoundary
      fallback={
        <div className="top-toolbar error" data-testid="top-toolbar">
          <div className="toolbar-error-message">
            <span>⚠️ Toolbar temporarily unavailable</span>
            <button onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
      }
    >
      <div
        className="top-toolbar"
        data-testid="top-toolbar"
        role="toolbar"
        aria-label="Main application toolbar"
      >
        {/* Recording Group */}
        {groupedButtons.recording && renderButtonGroup('recording', groupedButtons.recording)}

        {/* Playback Group */}
        {groupedButtons.playback && renderButtonGroup('playback', groupedButtons.playback)}

        {/* Editor Group */}
        {groupedButtons.editor && renderButtonGroup('editor', groupedButtons.editor)}

        {/* Spacer to push settings to the right */}
        <div className="toolbar-spacer" />

        {/* Settings Group */}
        {groupedButtons.settings && renderButtonGroup('settings', groupedButtons.settings)}
      </div>
    </ErrorBoundary>
  );
});

export default TopToolbar;
