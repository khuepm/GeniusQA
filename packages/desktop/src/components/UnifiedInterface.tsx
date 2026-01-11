/**
 * UnifiedInterface Component
 * Main container component that manages the overall layout and state coordination
 * Requirements: 1.1, 1.3, 1.4
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
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
      case 'SET_MODE':
        if (!validateApplicationMode(action.payload)) {
          console.error('Invalid application mode:', action.payload);
          return state;
        }
        newState = { ...state, applicationMode: action.payload };
        break;
      case 'SET_CURRENT_SCRIPT':
        if (!validateScriptFile(action.payload)) {
          console.error('Invalid script file:', action.payload);
          return state;
        }
        newState = { ...state, currentScript: action.payload };
        break;
      case 'SET_RECORDING_SESSION':
        if (!validateRecordingSession(action.payload)) {
          console.error('Invalid recording session:', action.payload);
          return state;
        }
        newState = { ...state, recordingSession: action.payload };
        break;
      case 'SET_PLAYBACK_SESSION':
        if (!validatePlaybackSession(action.payload)) {
          console.error('Invalid playback session:', action.payload);
          return state;
        }
        newState = { ...state, playbackSession: action.payload };
        break;
      case 'SET_EDITOR_VISIBLE':
        if (typeof action.payload !== 'boolean') {
          console.error('Invalid editor visible value:', action.payload);
          return state;
        }
        newState = { ...state, editorVisible: action.payload };
        break;
      case 'SET_TOOLBAR_COLLAPSED':
        if (typeof action.payload !== 'boolean') {
          console.error('Invalid toolbar collapsed value:', action.payload);
          return state;
        }
        newState = { ...state, toolbarCollapsed: action.payload };
        break;
      case 'RESET_STATE':
        newState = initialState;
        break;
      default:
        console.warn('Unknown action type:', action);
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
export const UnifiedInterfaceProvider: React.FC<UnifiedInterfaceProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(unifiedInterfaceReducer, initialState);

  // Action helpers with validation
  const setMode = (mode: ApplicationMode) => {
    if (!validateApplicationMode(mode)) {
      console.error('Invalid mode provided to setMode:', mode);
      return;
    }
    dispatch({ type: 'SET_MODE', payload: mode });
  };

  const setCurrentScript = (script: ScriptFile | null) => {
    if (!validateScriptFile(script)) {
      console.error('Invalid script provided to setCurrentScript:', script);
      return;
    }
    dispatch({ type: 'SET_CURRENT_SCRIPT', payload: script });
  };

  const setRecordingSession = (session: RecordingSession | null) => {
    if (!validateRecordingSession(session)) {
      console.error('Invalid recording session provided to setRecordingSession:', session);
      return;
    }
    dispatch({ type: 'SET_RECORDING_SESSION', payload: session });
  };

  const setPlaybackSession = (session: PlaybackSession | null) => {
    if (!validatePlaybackSession(session)) {
      console.error('Invalid playback session provided to setPlaybackSession:', session);
      return;
    }
    dispatch({ type: 'SET_PLAYBACK_SESSION', payload: session });
  };

  const setEditorVisible = (visible: boolean) => {
    if (typeof visible !== 'boolean') {
      console.error('Invalid visible value provided to setEditorVisible:', visible);
      return;
    }
    dispatch({ type: 'SET_EDITOR_VISIBLE', payload: visible });
  };

  const setToolbarCollapsed = (collapsed: boolean) => {
    if (typeof collapsed !== 'boolean') {
      console.error('Invalid collapsed value provided to setToolbarCollapsed:', collapsed);
      return;
    }
    dispatch({ type: 'SET_TOOLBAR_COLLAPSED', payload: collapsed });
  };

  const resetState = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  // Validate state on every render in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (!validateState(state)) {
        console.error('Invalid state detected in UnifiedInterfaceProvider:', state);
      }
    }
  }, [state]);

  const contextValue: UnifiedInterfaceContextType = {
    state,
    dispatch,
    setMode,
    setCurrentScript,
    setRecordingSession,
    setPlaybackSession,
    setEditorVisible,
    setToolbarCollapsed,
    resetState,
  };

  return (
    <UnifiedInterfaceContext.Provider value={contextValue}>
      {children}
    </UnifiedInterfaceContext.Provider>
  );
};

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
 * Requirements: 1.1, 1.3, 1.4
 */
export const UnifiedInterface: React.FC<UnifiedInterfaceProps> = ({ children }) => {
  const { state, setMode } = useUnifiedInterface();

  // Handle keyboard shortcuts - preserve existing functionality
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
            } else if (state.currentScript && state.applicationMode !== 'recording') {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.applicationMode, state.currentScript]);

  return (
    <div className={`unified-interface ${state.toolbarCollapsed ? 'toolbar-collapsed' : ''}`}>
      {/* Top Toolbar Area */}
      <div className="toolbar-area">
        {/* Toolbar component will be rendered here by children */}
      </div>

      {/* Editor Area */}
      <div className={`editor-area ${state.editorVisible ? 'visible' : 'hidden'}`} data-testid="editor-area">
        {/* Editor component will be rendered here by children */}
      </div>

      {/* Render children components */}
      {children}
    </div>
  );
};

export default UnifiedInterface;
