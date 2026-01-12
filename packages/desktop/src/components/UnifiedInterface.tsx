/**
 * UnifiedInterface Component
 * Main container component that manages the overall layout and state coordination
 * Requirements: 1.1, 1.3, 1.4
 */

import React, { createContext, useContext, useReducer, ReactNode, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import './UnifiedInterface.css';

// Application state types
export type ApplicationMode = 'idle' | 'recording' | 'playing' | 'editing';

export interface ScriptFile {
  path: string;
  filename: string;
  content?: string;
  actions?: any[];
}

export interface RecordingSession {
  isActive: boolean;
  startTime?: number;
  actions: any[];
}

export interface PlaybackSession {
  isActive: boolean;
  currentActionIndex: number;
  totalActions: number;
  isPaused: boolean;
}

export interface UnifiedInterfaceState {
  applicationMode: ApplicationMode;
  currentScript: ScriptFile | null;
  recordingSession: RecordingSession | null;
  playbackSession: PlaybackSession | null;
  editorVisible: boolean;
  toolbarCollapsed: boolean;
}

// Action types for state management
export type UnifiedInterfaceAction =
  | { type: 'SET_MODE'; payload: ApplicationMode }
  | { type: 'SET_CURRENT_SCRIPT'; payload: ScriptFile | null }
  | { type: 'SET_RECORDING_SESSION'; payload: RecordingSession | null }
  | { type: 'SET_PLAYBACK_SESSION'; payload: PlaybackSession | null }
  | { type: 'SET_EDITOR_VISIBLE'; payload: boolean }
  | { type: 'SET_TOOLBAR_COLLAPSED'; payload: boolean }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: UnifiedInterfaceState = {
  applicationMode: 'idle',
  currentScript: null,
  recordingSession: null,
  playbackSession: null,
  editorVisible: true,
  toolbarCollapsed: false,
};

// State validation functions
const validateApplicationMode = (mode: ApplicationMode): boolean => {
  return ['idle', 'recording', 'playing', 'editing'].includes(mode);
};

const validateScriptFile = (script: ScriptFile | null): boolean => {
  if (script === null) return true;
  return typeof script.path === 'string' && typeof script.filename === 'string';
};

const validateRecordingSession = (session: RecordingSession | null): boolean => {
  if (session === null) return true;
  return typeof session.isActive === 'boolean' && Array.isArray(session.actions);
};

const validatePlaybackSession = (session: PlaybackSession | null): boolean => {
  if (session === null) return true;
  return (
    typeof session.isActive === 'boolean' &&
    typeof session.currentActionIndex === 'number' &&
    typeof session.totalActions === 'number' &&
    typeof session.isPaused === 'boolean'
  );
};

// State validation function
const validateState = (state: UnifiedInterfaceState): boolean => {
  return (
    validateApplicationMode(state.applicationMode) &&
    validateScriptFile(state.currentScript) &&
    validateRecordingSession(state.recordingSession) &&
    validatePlaybackSession(state.playbackSession) &&
    typeof state.editorVisible === 'boolean' &&
    typeof state.toolbarCollapsed === 'boolean'
  );
};

// Error recovery function
const recoverFromInvalidState = (
  currentState: UnifiedInterfaceState,
  action: UnifiedInterfaceAction
): UnifiedInterfaceState => {
  console.warn('Invalid state detected, attempting recovery:', { currentState, action });

  // Return to a safe state while preserving what we can
  return {
    applicationMode: 'idle',
    currentScript: validateScriptFile(currentState.currentScript) ? currentState.currentScript : null,
    recordingSession: null,
    playbackSession: null,
    editorVisible: typeof currentState.editorVisible === 'boolean' ? currentState.editorVisible : true,
    toolbarCollapsed: typeof currentState.toolbarCollapsed === 'boolean' ? currentState.toolbarCollapsed : false,
  };
};

// Enhanced state reducer with validation and error recovery
const unifiedInterfaceReducer = (
  state: UnifiedInterfaceState,
  action: UnifiedInterfaceAction
): UnifiedInterfaceState => {
  let newState: UnifiedInterfaceState;

  try {
    switch (action.type) {
      case 'SET_MODE': {
        const payload = (action as { type: 'SET_MODE'; payload: ApplicationMode }).payload;
        if (!validateApplicationMode(payload)) {
          console.error('Invalid application mode:', payload);
          return state;
        }
        newState = { ...state, applicationMode: payload };
        break;
      }
      case 'SET_CURRENT_SCRIPT': {
        const payload = (action as { type: 'SET_CURRENT_SCRIPT'; payload: ScriptFile | null }).payload;
        if (!validateScriptFile(payload)) {
          console.error('Invalid script file:', payload);
          return state;
        }
        newState = { ...state, currentScript: payload };
        break;
      }
      case 'SET_RECORDING_SESSION': {
        const payload = (action as { type: 'SET_RECORDING_SESSION'; payload: RecordingSession | null }).payload;
        if (!validateRecordingSession(payload)) {
          console.error('Invalid recording session:', payload);
          return state;
        }
        newState = { ...state, recordingSession: payload };
        break;
      }
      case 'SET_PLAYBACK_SESSION': {
        const payload = (action as { type: 'SET_PLAYBACK_SESSION'; payload: PlaybackSession | null }).payload;
        if (!validatePlaybackSession(payload)) {
          console.error('Invalid playback session:', payload);
          return state;
        }
        newState = { ...state, playbackSession: payload };
        break;
      }
      case 'SET_EDITOR_VISIBLE': {
        const payload = (action as { type: 'SET_EDITOR_VISIBLE'; payload: boolean }).payload;
        if (typeof payload !== 'boolean') {
          console.error('Invalid editor visible value:', payload);
          return state;
        }
        newState = { ...state, editorVisible: payload };
        break;
      }
      case 'SET_TOOLBAR_COLLAPSED': {
        const payload = (action as { type: 'SET_TOOLBAR_COLLAPSED'; payload: boolean }).payload;
        if (typeof payload !== 'boolean') {
          console.error('Invalid toolbar collapsed value:', payload);
          return state;
        }
        newState = { ...state, toolbarCollapsed: payload };
        break;
      }
      case 'RESET_STATE':
        newState = initialState;
        break;
      default:
        console.warn('Unknown action type:', (action as any).type);
        return state;
    }

    // Validate the new state
    if (!validateState(newState)) {
      console.error('State validation failed after action:', action);
      return recoverFromInvalidState(state, action);
    }

    return newState;
  } catch (error) {
    console.error('Error in state reducer:', error, { state, action });
    return recoverFromInvalidState(state, action);
  }
};

// Context type
export interface UnifiedInterfaceContextType {
  state: UnifiedInterfaceState;
  dispatch: React.Dispatch<UnifiedInterfaceAction>;
  // Action helpers
  setMode: (mode: ApplicationMode) => void;
  setCurrentScript: (script: ScriptFile | null) => void;
  setRecordingSession: (session: RecordingSession | null) => void;
  setPlaybackSession: (session: PlaybackSession | null) => void;
  setEditorVisible: (visible: boolean) => void;
  setToolbarCollapsed: (collapsed: boolean) => void;
  resetState: () => void;
}

// Create context
const UnifiedInterfaceContext = createContext<UnifiedInterfaceContextType | undefined>(undefined);

// Context provider props
interface UnifiedInterfaceProviderProps {
  children: ReactNode;
}

// Context provider component
export const UnifiedInterfaceProvider: React.FC<UnifiedInterfaceProviderProps> = React.memo(({ children }) => {
  const [state, dispatch] = useReducer(unifiedInterfaceReducer, initialState);

  // Memoize action helpers with validation to prevent unnecessary re-renders
  const setMode = useCallback((mode: ApplicationMode) => {
    if (!validateApplicationMode(mode)) {
      console.error('Invalid mode provided to setMode:', mode);
      return;
    }
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const setCurrentScript = useCallback((script: ScriptFile | null) => {
    if (!validateScriptFile(script)) {
      console.error('Invalid script provided to setCurrentScript:', script);
      return;
    }
    dispatch({ type: 'SET_CURRENT_SCRIPT', payload: script });
  }, []);

  const setRecordingSession = useCallback((session: RecordingSession | null) => {
    if (!validateRecordingSession(session)) {
      console.error('Invalid recording session provided to setRecordingSession:', session);
      return;
    }
    dispatch({ type: 'SET_RECORDING_SESSION', payload: session });
  }, []);

  const setPlaybackSession = useCallback((session: PlaybackSession | null) => {
    if (!validatePlaybackSession(session)) {
      console.error('Invalid playback session provided to setPlaybackSession:', session);
      return;
    }
    dispatch({ type: 'SET_PLAYBACK_SESSION', payload: session });
  }, []);

  const setEditorVisible = useCallback((visible: boolean) => {
    if (typeof visible !== 'boolean') {
      console.error('Invalid visible value provided to setEditorVisible:', visible);
      return;
    }
    dispatch({ type: 'SET_EDITOR_VISIBLE', payload: visible });
  }, []);

  const setToolbarCollapsed = useCallback((collapsed: boolean) => {
    if (typeof collapsed !== 'boolean') {
      console.error('Invalid collapsed value provided to setToolbarCollapsed:', collapsed);
      return;
    }
    dispatch({ type: 'SET_TOOLBAR_COLLAPSED', payload: collapsed });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  // Validate state on every render in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (!validateState(state)) {
        console.error('Invalid state detected in UnifiedInterfaceProvider:', state);
      }
    }
  }, [state]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: UnifiedInterfaceContextType = useMemo(() => ({
    state,
    dispatch,
    setMode,
    setCurrentScript,
    setRecordingSession,
    setPlaybackSession,
    setEditorVisible,
    setToolbarCollapsed,
    resetState,
  }), [state, setMode, setCurrentScript, setRecordingSession, setPlaybackSession, setEditorVisible, setToolbarCollapsed, resetState]);

  return (
    <UnifiedInterfaceContext.Provider value={contextValue}>
      {children}
    </UnifiedInterfaceContext.Provider>
  );
});

// Custom hook to use the context
export const useUnifiedInterface = (): UnifiedInterfaceContextType => {
  const context = useContext(UnifiedInterfaceContext);
  if (context === undefined) {
    throw new Error('useUnifiedInterface must be used within a UnifiedInterfaceProvider');
  }
  return context;
};

// Props for the main UnifiedInterface component
interface UnifiedInterfaceProps {
  children?: ReactNode;
}

/**
 * UnifiedInterface Component
 * Main container that provides the unified layout structure
 * Requirements: 1.1, 1.3, 1.4, 6.2, 6.3, 6.5
 */
export const UnifiedInterface: React.FC<UnifiedInterfaceProps> = React.memo(({ children }) => {
  const { state } = useUnifiedInterface();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousMode, setPreviousMode] = useState<ApplicationMode>('idle');
  const editorScrollPositionRef = useRef<number>(0);
  const editorContentRef = useRef<any>(null);

  // Debounce rapid state changes to prevent excessive re-renders
  const debouncedMode = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (mode: ApplicationMode) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setPreviousMode(mode);
      }, 50); // 50ms debounce
    };
  }, []);

  // Memoize transition styles to prevent recalculation
  const transitionStyles = useMemo(() => ({
    // Prevent layout changes during transitions
    transition: isTransitioning ? 'opacity 150ms ease-in-out, transform 150ms ease-in-out' : 'none',
    opacity: isTransitioning ? 0.8 : 1,
    transform: isTransitioning ? 'translateY(2px)' : 'translateY(0)'
  }), [isTransitioning]);

  // Error handling for component lifecycle
  const handleComponentError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('UnifiedInterface error:', error, errorInfo);

    // Attempt to recover by resetting to idle state
    try {
      // Reset to safe state if possible
      window.dispatchEvent(new CustomEvent('interface-error-recovery'));
    } catch (recoveryError) {
      console.error('Failed to recover from interface error:', recoveryError);
    }
  }, []);

  // Handle smooth mode transitions - Requirements: 6.2, 6.3, 6.5
  useEffect(() => {
    if (previousMode !== state.applicationMode) {
      setIsTransitioning(true);

      // Preserve editor scroll position during transitions
      const editorElement = document.querySelector('.editor-area .editor-content');
      if (editorElement) {
        editorScrollPositionRef.current = editorElement.scrollTop;
      }

      // Smooth transition timing
      const transitionTimer = setTimeout(() => {
        setIsTransitioning(false);

        // Restore editor scroll position after transition
        const editorElementAfter = document.querySelector('.editor-area .editor-content');
        if (editorElementAfter && editorScrollPositionRef.current > 0) {
          editorElementAfter.scrollTop = editorScrollPositionRef.current;
        }
      }, 150); // 150ms transition duration

      debouncedMode(state.applicationMode);

      return () => clearTimeout(transitionTimer);
    }
  }, [state.applicationMode, previousMode, debouncedMode]);

  // Preserve editor content during mode switches - Requirements: 6.2, 6.3
  useEffect(() => {
    // Store editor content reference to prevent loss during transitions
    const editorElement = document.querySelector('.editor-area');
    if (editorElement) {
      editorContentRef.current = {
        scrollTop: editorElement.scrollTop,
        selectedElements: document.querySelectorAll('.action-item.selected'),
        focusedElement: document.activeElement
      };
    }
  }, [state.applicationMode]);

  // Memoize keyboard event handler to prevent recreation on every render
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Prevent keyboard shortcuts during transitions to avoid conflicts
    if (isTransitioning) {
      return;
    }

    // Handle application-level keyboard shortcuts
    if (event.key === 'Escape') {
      // ESC key handling - stop current action if recording or playing
      if (state.applicationMode === 'recording' || state.applicationMode === 'playing') {
        // Dispatch custom event for toolbar to handle
        window.dispatchEvent(new CustomEvent('keyboard-stop-action'));
      }
      return;
    }

    // Additional shortcuts with Ctrl/Cmd key
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'r':
          event.preventDefault();
          if (state.applicationMode === 'idle') {
            window.dispatchEvent(new CustomEvent('keyboard-start-recording'));
          }
          break;
        case 'p':
          event.preventDefault();
          if (state.applicationMode === 'idle' && state.currentScript) {
            window.dispatchEvent(new CustomEvent('keyboard-start-playback'));
          }
          break;
        case 's':
          event.preventDefault();
          if (state.applicationMode === 'recording' || state.applicationMode === 'playing') {
            window.dispatchEvent(new CustomEvent('keyboard-stop-action'));
          } else if (state.currentScript && (state.applicationMode === 'idle' || state.applicationMode === 'editing')) {
            window.dispatchEvent(new CustomEvent('keyboard-save-script'));
          }
          break;
        case 'o':
          event.preventDefault();
          if (state.applicationMode === 'idle') {
            window.dispatchEvent(new CustomEvent('keyboard-open-script'));
          }
          break;
      }
    }
  }, [state.applicationMode, state.currentScript, isTransitioning]);

  // Handle keyboard shortcuts - preserve existing functionality
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ErrorBoundary
      onError={handleComponentError}
      resetKeys={[state.applicationMode]}
      resetOnPropsChange={true}
    >
      <div
        className={`unified-interface ${state.toolbarCollapsed ? 'toolbar-collapsed' : ''} ${isTransitioning ? 'transitioning' : ''} mode-${state.applicationMode}`}
        data-testid="unified-interface"
        role="main"
        aria-label="GeniusQA Desktop Application"
      >
        {/* Top Toolbar Area */}
        <div className="toolbar-area" role="toolbar" aria-label="Main toolbar">
          {/* Toolbar component will be rendered here by children */}
        </div>

        {/* Editor Area - Requirements: 6.2, 6.3, 6.5 */}
        <div
          className={`editor-area ${state.editorVisible ? 'visible' : 'hidden'} ${isTransitioning ? 'transitioning' : ''}`}
          data-testid="editor-area"
          role="region"
          aria-label="Script editor"
          aria-hidden={!state.editorVisible}
          style={transitionStyles}
        >
          {/* Editor component will be rendered here by children */}
        </div>

        {/* Render children components */}
        {children}
      </div>
    </ErrorBoundary>
  );
});

export default UnifiedInterface;
