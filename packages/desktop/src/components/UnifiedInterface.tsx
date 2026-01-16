/**
 * UnifiedInterface Component
 * Main container component that manages the overall layout and state coordination
 * Requirements: 1.1, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4
 */

import React, { createContext, useContext, useReducer, ReactNode, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { TabType, isValidTabType } from '../types/tabSystem.types';
import { TabBar } from './TabBar';
import { RecordingTabContent } from './tabs/RecordingTabContent';
import { ScriptListTabContent } from './tabs/ScriptListTabContent';
import { AIBuilderTabContent } from './tabs/AIBuilderTabContent';
import { EditorTabContent } from './tabs/EditorTabContent';
import { TargetOS } from './OSSelector';
import { ActionData } from '../types/recorder.types';
import { StoredScriptInfo, ScriptFilter as ScriptFilterType } from '../services/scriptStorageService';
import { ScriptData as AIScriptData } from '../types/aiScriptBuilder.types';
import './UnifiedInterface.css';

// Application state types
export type ApplicationMode = 'idle' | 'recording' | 'playing' | 'editing';
export type InternalScriptFilter = 'all' | 'recorded' | 'ai_generated';
export { TargetOS };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ScriptData {
  name: string;
  description?: string;
  actions: any[];
  metadata?: {
    createdAt?: number;
    updatedAt?: number;
    source?: 'recorded' | 'ai-generated';
  };
}

// Tab state interfaces
export interface RecordingTabState {
  actions: any[];
  isRecording: boolean;
}

export interface ScriptListTabState {
  filter: InternalScriptFilter;
  searchQuery: string;
  selectedScriptPath: string | null;
}

export interface AIBuilderTabState {
  chatHistory: ChatMessage[];
  generatedScript: ScriptData | null;
  targetOS: TargetOS;
}

export interface EditorTabState {
  scriptData: ScriptData | null;
  editMode: boolean;
  textEditMode: boolean;
  unsavedChanges: boolean;
}

export interface TabStates {
  recording: RecordingTabState;
  list: ScriptListTabState;
  builder: AIBuilderTabState;
  editor: EditorTabState;
}

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
  activeTab: TabType;
  tabStates: TabStates;
}

export type UnifiedInterfaceAction =
  | { type: 'SET_MODE'; payload: ApplicationMode }
  | { type: 'SET_CURRENT_SCRIPT'; payload: ScriptFile | null }
  | { type: 'SET_RECORDING_SESSION'; payload: RecordingSession | null }
  | { type: 'SET_PLAYBACK_SESSION'; payload: PlaybackSession | null }
  | { type: 'SET_EDITOR_VISIBLE'; payload: boolean }
  | { type: 'SET_TOOLBAR_COLLAPSED'; payload: boolean }
  | { type: 'RESET_STATE' }
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'UPDATE_TAB_STATE'; payload: { tab: TabType; state: Partial<RecordingTabState | ScriptListTabState | AIBuilderTabState | EditorTabState> } }
  | { type: 'LOAD_SCRIPT_IN_EDITOR'; payload: { scriptPath: string; data: ScriptData } }
  | { type: 'REFRESH_SCRIPT_LIST' };

const initialTabStates: TabStates = {
  recording: { actions: [], isRecording: false },
  list: { filter: 'all', searchQuery: '', selectedScriptPath: null },
  builder: { chatHistory: [], generatedScript: null, targetOS: 'universal' },
  editor: { scriptData: null, editMode: false, textEditMode: false, unsavedChanges: false },
};

const initialState: UnifiedInterfaceState = {
  applicationMode: 'idle',
  currentScript: null,
  recordingSession: null,
  playbackSession: null,
  editorVisible: true,
  toolbarCollapsed: false,
  activeTab: 'recording',
  tabStates: initialTabStates,
};

// Validation functions
const validateApplicationMode = (mode: ApplicationMode): boolean => ['idle', 'recording', 'playing', 'editing'].includes(mode);
const validateScriptFile = (script: ScriptFile | null): boolean => script === null || (typeof script.path === 'string' && typeof script.filename === 'string');
const validateRecordingSession = (session: RecordingSession | null): boolean => session === null || (typeof session.isActive === 'boolean' && Array.isArray(session.actions));
const validatePlaybackSession = (session: PlaybackSession | null): boolean => session === null || (typeof session.isActive === 'boolean' && typeof session.currentActionIndex === 'number' && typeof session.totalActions === 'number' && typeof session.isPaused === 'boolean');
const validateActiveTab = (tab: TabType): boolean => isValidTabType(tab);

const validateTabStates = (tabStates: TabStates): boolean => {
  return (
    Array.isArray(tabStates.recording.actions) &&
    typeof tabStates.recording.isRecording === 'boolean' &&
    ['all', 'recorded', 'ai_generated'].includes(tabStates.list.filter) &&
    typeof tabStates.list.searchQuery === 'string' &&
    Array.isArray(tabStates.builder.chatHistory) &&
    ['windows', 'macos', 'universal'].includes(tabStates.builder.targetOS) &&
    typeof tabStates.editor.editMode === 'boolean'
  );
};

const validateState = (state: UnifiedInterfaceState): boolean => {
  return (
    validateApplicationMode(state.applicationMode) &&
    validateScriptFile(state.currentScript) &&
    validateRecordingSession(state.recordingSession) &&
    validatePlaybackSession(state.playbackSession) &&
    typeof state.editorVisible === 'boolean' &&
    typeof state.toolbarCollapsed === 'boolean' &&
    validateActiveTab(state.activeTab) &&
    validateTabStates(state.tabStates)
  );
};

const recoverFromInvalidState = (currentState: UnifiedInterfaceState, action: UnifiedInterfaceAction): UnifiedInterfaceState => {
  console.warn('Invalid state detected, attempting recovery:', { currentState, action });
  return {
    ...initialState,
    currentScript: validateScriptFile(currentState.currentScript) ? currentState.currentScript : null,
    activeTab: validateActiveTab(currentState.activeTab) ? currentState.activeTab : 'recording',
  };
};

const unifiedInterfaceReducer = (state: UnifiedInterfaceState, action: UnifiedInterfaceAction): UnifiedInterfaceState => {
  let newState: UnifiedInterfaceState;

  try {
    switch (action.type) {
      case 'SET_MODE':
        if (!validateApplicationMode(action.payload)) return state;
        newState = { ...state, applicationMode: action.payload };
        break;
      case 'SET_CURRENT_SCRIPT':
        if (!validateScriptFile(action.payload)) return state;
        newState = { ...state, currentScript: action.payload };
        break;
      case 'SET_RECORDING_SESSION':
        if (!validateRecordingSession(action.payload)) return state;
        newState = { ...state, recordingSession: action.payload };
        break;
      case 'SET_PLAYBACK_SESSION':
        if (!validatePlaybackSession(action.payload)) return state;
        newState = { ...state, playbackSession: action.payload };
        break;
      case 'SET_EDITOR_VISIBLE':
        if (typeof action.payload !== 'boolean') return state;
        newState = { ...state, editorVisible: action.payload };
        break;
      case 'SET_TOOLBAR_COLLAPSED':
        if (typeof action.payload !== 'boolean') return state;
        newState = { ...state, toolbarCollapsed: action.payload };
        break;
      case 'SET_ACTIVE_TAB':
        if (!validateActiveTab(action.payload)) return state;
        if (state.playbackSession?.isActive) {
          console.warn('Cannot switch tabs during playback');
          return state;
        }
        newState = { ...state, activeTab: action.payload };
        break;
      case 'UPDATE_TAB_STATE': {
        const { tab, state: tabState } = action.payload;
        if (!validateActiveTab(tab)) return state;
        newState = {
          ...state,
          tabStates: { ...state.tabStates, [tab]: { ...state.tabStates[tab], ...tabState } },
        };
        break;
      }
      case 'LOAD_SCRIPT_IN_EDITOR': {
        const { scriptPath, data } = action.payload;
        if (state.playbackSession?.isActive) return state;
        newState = {
          ...state,
          activeTab: 'editor',
          tabStates: {
            ...state.tabStates,
            list: { ...state.tabStates.list, selectedScriptPath: scriptPath },
            editor: { ...state.tabStates.editor, scriptData: data, editMode: false, textEditMode: false, unsavedChanges: false },
          },
        };
        break;
      }
      case 'REFRESH_SCRIPT_LIST':
        newState = { ...state };
        break;
      case 'RESET_STATE':
        newState = initialState;
        break;
      default:
        return state;
    }

    if (!validateState(newState)) return recoverFromInvalidState(state, action);
    return newState;
  } catch (error) {
    console.error('Error in state reducer:', error);
    return recoverFromInvalidState(state, action);
  }
};

export interface UnifiedInterfaceContextType {
  state: UnifiedInterfaceState;
  dispatch: React.Dispatch<UnifiedInterfaceAction>;
  setMode: (mode: ApplicationMode) => void;
  setCurrentScript: (script: ScriptFile | null) => void;
  setRecordingSession: (session: RecordingSession | null) => void;
  setPlaybackSession: (session: PlaybackSession | null) => void;
  setEditorVisible: (visible: boolean) => void;
  setToolbarCollapsed: (collapsed: boolean) => void;
  resetState: () => void;
  setActiveTab: (tab: TabType) => void;
  updateTabState: (tab: TabType, state: Partial<RecordingTabState | ScriptListTabState | AIBuilderTabState | EditorTabState>) => void;
  loadScriptInEditor: (scriptPath: string, data: ScriptData) => void;
  refreshScriptList: () => void;
}

const UnifiedInterfaceContext = createContext<UnifiedInterfaceContextType | undefined>(undefined);

export const UnifiedInterfaceProvider: React.FC<{ children: ReactNode }> = React.memo(({ children }) => {
  const [state, dispatch] = useReducer(unifiedInterfaceReducer, initialState);

  const setMode = useCallback((mode: ApplicationMode) => dispatch({ type: 'SET_MODE', payload: mode }), []);
  const setCurrentScript = useCallback((script: ScriptFile | null) => dispatch({ type: 'SET_CURRENT_SCRIPT', payload: script }), []);
  const setRecordingSession = useCallback((session: RecordingSession | null) => dispatch({ type: 'SET_RECORDING_SESSION', payload: session }), []);
  const setPlaybackSession = useCallback((session: PlaybackSession | null) => dispatch({ type: 'SET_PLAYBACK_SESSION', payload: session }), []);
  const setEditorVisible = useCallback((visible: boolean) => dispatch({ type: 'SET_EDITOR_VISIBLE', payload: visible }), []);
  const setToolbarCollapsed = useCallback((collapsed: boolean) => dispatch({ type: 'SET_TOOLBAR_COLLAPSED', payload: collapsed }), []);
  const resetState = useCallback(() => dispatch({ type: 'RESET_STATE' }), []);
  const setActiveTab = useCallback((tab: TabType) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }), []);
  const updateTabState = useCallback((tab: TabType, tabState: Partial<RecordingTabState | ScriptListTabState | AIBuilderTabState | EditorTabState>) => dispatch({ type: 'UPDATE_TAB_STATE', payload: { tab, state: tabState } }), []);
  const loadScriptInEditor = useCallback((scriptPath: string, data: ScriptData) => dispatch({ type: 'LOAD_SCRIPT_IN_EDITOR', payload: { scriptPath, data } }), []);
  const refreshScriptList = useCallback(() => dispatch({ type: 'REFRESH_SCRIPT_LIST' }), []);

  const contextValue = useMemo(() => ({
    state, dispatch, setMode, setCurrentScript, setRecordingSession, setPlaybackSession,
    setEditorVisible, setToolbarCollapsed, resetState, setActiveTab, updateTabState, loadScriptInEditor, refreshScriptList,
  }), [state, setMode, setCurrentScript, setRecordingSession, setPlaybackSession, setEditorVisible, setToolbarCollapsed, resetState, setActiveTab, updateTabState, loadScriptInEditor, refreshScriptList]);

  return <UnifiedInterfaceContext.Provider value={contextValue}>{children}</UnifiedInterfaceContext.Provider>;
});

export const useUnifiedInterface = (): UnifiedInterfaceContextType => {
  const context = useContext(UnifiedInterfaceContext);
  if (!context) throw new Error('useUnifiedInterface must be used within a UnifiedInterfaceProvider');
  return context;
};

interface UnifiedInterfaceProps {
  children?: ReactNode;
  scripts?: StoredScriptInfo[];
  onScriptSelect?: (script: StoredScriptInfo) => void;
  onScriptDelete?: (script: StoredScriptInfo) => void;
  onScriptReveal?: (script: StoredScriptInfo) => void;
  scriptsLoading?: boolean;
  apiKeyConfigured?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onScriptSave?: () => void;
  onActionUpdate?: (index: number, field: string, value: unknown) => void;
  onActionDelete?: (index: number) => void;
  onScriptGenerated?: (script: AIScriptData) => void;
  onScriptSaved?: () => void;
}

/**
 * UnifiedInterface Component - Requirements: 1.1, 1.3, 1.4, 5.1, 5.2, 5.3
 */
export const UnifiedInterface: React.FC<UnifiedInterfaceProps> = React.memo(({
  children, scripts = [], onScriptSelect, onScriptDelete, onScriptReveal, scriptsLoading = false,
  apiKeyConfigured = false, onStartRecording, onStopRecording, onScriptSave, onActionUpdate, onActionDelete,
  onScriptGenerated, onScriptSaved,
}) => {
  const { state, setActiveTab, updateTabState, loadScriptInEditor, refreshScriptList } = useUnifiedInterface();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousMode, setPreviousMode] = useState<ApplicationMode>('idle');
  const editorScrollPositionRef = useRef<number>(0);

  const handleComponentError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('UnifiedInterface error:', error, errorInfo);
  }, []);

  useEffect(() => {
    if (previousMode !== state.applicationMode) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPreviousMode(state.applicationMode);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [state.applicationMode, previousMode]);

  const handleTabChange = useCallback((tab: TabType) => setActiveTab(tab), [setActiveTab]);

  const handleScriptSelect = useCallback((script: StoredScriptInfo) => {
    const scriptData: ScriptData = {
      name: script.scriptName || script.filename,
      actions: [],
      metadata: { createdAt: script.createdAt ? new Date(script.createdAt).getTime() : Date.now(), source: script.source === 'ai_generated' ? 'ai-generated' : 'recorded' },
    };
    loadScriptInEditor(script.path, scriptData);
    onScriptSelect?.(script);
  }, [loadScriptInEditor, onScriptSelect]);

  const handleFilterChange = useCallback((filter: ScriptFilterType) => {
    const mappedFilter: InternalScriptFilter = filter.source === 'all' ? 'all' : filter.source === 'recorded' ? 'recorded' : filter.source === 'ai_generated' ? 'ai_generated' : 'all';
    updateTabState('list', { filter: mappedFilter, searchQuery: filter.searchQuery || '' });
  }, [updateTabState]);

  const handleOSChange = useCallback((os: TargetOS) => updateTabState('builder', { targetOS: os }), [updateTabState]);

  const handleScriptGenerated = useCallback((script: AIScriptData) => {
    updateTabState('builder', { generatedScript: script as unknown as ScriptData });
    onScriptGenerated?.(script);
  }, [updateTabState, onScriptGenerated]);

  const handleScriptSaved = useCallback(() => {
    refreshScriptList();
    onScriptSaved?.();
  }, [refreshScriptList, onScriptSaved]);

  const handleEditModeChange = useCallback((mode: boolean) => updateTabState('editor', { editMode: mode }), [updateTabState]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (isTransitioning) return;
    if (event.key === 'Escape' && (state.applicationMode === 'recording' || state.applicationMode === 'playing')) {
      window.dispatchEvent(new CustomEvent('keyboard-stop-action'));
    }
  }, [state.applicationMode, isTransitioning]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderTabContent = useCallback(() => {
    switch (state.activeTab) {
      case 'recording':
        return <RecordingTabContent recordingSession={state.recordingSession} actions={state.tabStates.recording.actions as ActionData[]} onStartRecording={onStartRecording || (() => { })} onStopRecording={onStopRecording || (() => { })} />;
      case 'list':
        return <ScriptListTabContent scripts={scripts} filter={{ source: state.tabStates.list.filter === 'all' ? 'all' : state.tabStates.list.filter === 'recorded' ? 'recorded' : 'ai_generated', searchQuery: state.tabStates.list.searchQuery }} onFilterChange={handleFilterChange} onScriptSelect={handleScriptSelect} onScriptDelete={onScriptDelete || (() => { })} onScriptReveal={onScriptReveal} loading={scriptsLoading} selectedScriptPath={state.tabStates.list.selectedScriptPath} />;
      case 'builder':
        return <AIBuilderTabContent targetOS={state.tabStates.builder.targetOS} onOSChange={handleOSChange} onScriptGenerated={handleScriptGenerated} onScriptSaved={handleScriptSaved} apiKeyConfigured={apiKeyConfigured} />;
      case 'editor':
        return <EditorTabContent script={state.tabStates.editor.scriptData as AIScriptData | null} selectedScript={scripts.find(s => s.path === state.tabStates.list.selectedScriptPath) || null} editMode={state.tabStates.editor.editMode} onEditModeChange={handleEditModeChange} onScriptSave={onScriptSave || (() => { })} onActionUpdate={onActionUpdate || (() => { })} onActionDelete={onActionDelete || (() => { })} />;
      default:
        return null;
    }
  }, [state.activeTab, state.recordingSession, state.tabStates, scripts, scriptsLoading, apiKeyConfigured, onStartRecording, onStopRecording, onScriptDelete, onScriptReveal, onScriptSave, onActionUpdate, onActionDelete, handleFilterChange, handleScriptSelect, handleOSChange, handleScriptGenerated, handleScriptSaved, handleEditModeChange]);

  const tabsDisabled = state.playbackSession?.isActive ?? false;

  return (
    <ErrorBoundary onError={handleComponentError} resetKeys={[state.applicationMode]} resetOnPropsChange={true}>
      <div className={`unified-interface ${state.toolbarCollapsed ? 'toolbar-collapsed' : ''} ${isTransitioning ? 'transitioning' : ''} mode-${state.applicationMode}`} data-testid="unified-interface" role="main" aria-label="GeniusQA Desktop Application">
        {children}
        <div className="data-area" data-testid="data-area">{renderTabContent()}</div>
        <TabBar activeTab={state.activeTab} onTabChange={handleTabChange} disabled={tabsDisabled} applicationMode={state.applicationMode} />
      </div>
    </ErrorBoundary>
  );
});
