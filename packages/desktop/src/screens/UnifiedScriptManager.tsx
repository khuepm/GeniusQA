/**
 * Unified Script Manager Component
 * 
 * Provides a unified interface for managing all scripts with tabs for:
 * - Script List: View and filter all scripts (recorded and AI-generated)
 * - AI Builder: Create new scripts using AI chat interface
 * - Editor: Edit selected scripts with full editing capabilities
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Components
import { ScriptFilter } from '../components/ScriptFilter';
import { ScriptListItem } from '../components/ScriptListItem';
import { AIChatInterface } from '../components/AIChatInterface';
import { ScriptPreview } from '../components/ScriptPreview';
import { ScriptNameDialog } from '../components/ScriptNameDialog';
import { ProviderSettings } from '../components/ProviderSettings';
import { UsageStatistics } from '../components/UsageStatistics';
import { OSSelector } from '../components/OSSelector';

// Services
import { scriptStorageService, StoredScriptInfo, ScriptFilter as ScriptFilterType, TargetOS } from '../services/scriptStorageService';
import { unifiedAIService } from '../services/unifiedAIService';
import { providerManager } from '../services/providerManager';
import { validateScript } from '../services/scriptValidationService';
import { getIPCBridge } from '../services/ipcBridgeService';

// Types
import { ScriptData, ValidationResult, Action } from '../types/aiScriptBuilder.types';
import { AIProvider, ProviderInfo, ProviderModel, SessionStatistics } from '../types/providerAdapter.types';
import { save } from '@tauri-apps/api/dialog';

import './UnifiedScriptManager.css';

/**
 * Tab types for the unified interface
 * Requirements: 10.1
 */
export type TabType = 'list' | 'builder' | 'editor';

/**
 * Props for the UnifiedScriptManager component
 */
export interface UnifiedScriptManagerProps {
  /** Initial tab to display */
  initialTab?: TabType;
  /** Initial script path to load in editor */
  initialScriptPath?: string;
}

/**
 * Tab configuration
 */
interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'list', label: 'Script List', icon: '📋' },
  { id: 'builder', label: 'AI Builder', icon: '🤖' },
  { id: 'editor', label: 'Editor', icon: '✏️' },
];

/**
 * UnifiedScriptManager Component
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
const UnifiedScriptManager: React.FC<UnifiedScriptManagerProps> = ({
  initialTab = 'list',
  initialScriptPath,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const ipcBridge = getIPCBridge();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Script list state - Requirements: 10.2
  const [allScripts, setAllScripts] = useState<StoredScriptInfo[]>([]);
  const [filteredScripts, setFilteredScripts] = useState<StoredScriptInfo[]>([]);
  const [filter, setFilter] = useState<ScriptFilterType>({ source: 'all' });
  const [scriptsLoading, setScriptsLoading] = useState<boolean>(true);

  // Selected script state - Requirements: 10.3
  const [selectedScript, setSelectedScript] = useState<StoredScriptInfo | null>(null);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [textEditMode, setTextEditMode] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>('');
  const [jsonEditError, setJsonEditError] = useState<string | null>(null);

  // AI Builder state - Requirements: 10.4
  const [generatedScript, setGeneratedScript] = useState<ScriptData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    valid: true,
    errors: [],
    warnings: [],
  });
  const [targetOS, setTargetOS] = useState<TargetOS>('universal');

  // Provider state
  const [providersConfigured, setProvidersConfigured] = useState<boolean>(false);
  const [checkingProviders, setCheckingProviders] = useState<boolean>(true);
  const [showProviderSettings, setShowProviderSettings] = useState<boolean>(false);
  const [initialExpandedProvider, setInitialExpandedProvider] = useState<AIProvider | undefined>(undefined);
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);
  const [availableModels, setAvailableModels] = useState<ProviderModel[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState<boolean>(false);
  const [sessionStats, setSessionStats] = useState<SessionStatistics>({
    totalRequests: 0,
    requestsByProvider: new Map(),
    successRate: 0,
    averageResponseTime: 0,
  });

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [savingScript, setSavingScript] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  /**
   * Load scripts on mount
   * Requirements: 10.2
   */
  useEffect(() => {
    loadScripts();
  }, []);

  /**
   * Initialize AI service
   * Requirements: 10.4
   */
  useEffect(() => {
    const initializeService = async () => {
      if (!user?.uid) {
        setCheckingProviders(false);
        return;
      }

      try {
        await unifiedAIService.initialize(user.uid);
        const providers = unifiedAIService.getAvailableProviders();
        setAvailableProviders(providers);

        const configuredProviders = unifiedAIService.getConfiguredProviders();
        setProvidersConfigured(configuredProviders.length > 0);

        const currentProvider = unifiedAIService.getActiveProvider();
        setActiveProvider(currentProvider);

        if (currentProvider) {
          const models = unifiedAIService.getAvailableModels();
          setAvailableModels(models);
          setActiveModel(unifiedAIService.getActiveModel());
        }
      } catch (err) {
        console.error('Failed to initialize AI service:', err);
        setProvidersConfigured(false);
      } finally {
        setCheckingProviders(false);
      }
    };

    initializeService();
  }, [user?.uid]);

  /**
   * Handle initial script path from URL params
   */
  useEffect(() => {
    if (initialScriptPath) {
      loadScriptByPath(initialScriptPath);
    }
  }, [initialScriptPath]);

  /**
   * Load all scripts
   * Requirements: 10.2
   */
  const loadScripts = async () => {
    try {
      setScriptsLoading(true);
      setError(null);

      const enrichedScripts = await scriptStorageService.listScripts();
      setAllScripts(enrichedScripts);

      const filtered = await scriptStorageService.listScriptsBySource(filter);
      setFilteredScripts(filtered);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scripts';
      setError(errorMessage);
      console.error('Load scripts error:', err);
    } finally {
      setScriptsLoading(false);
    }
  };

  /**
   * Load a script by path
   */
  const loadScriptByPath = async (scriptPath: string) => {
    try {
      const data = await ipcBridge.loadScript(scriptPath);
      setScriptData(data as ScriptData);
      setActiveTab('editor');
    } catch (err) {
      console.error('Failed to load script by path:', err);
    }
  };

  /**
   * Handle filter change
   * Requirements: 10.2
   */
  const handleFilterChange = useCallback(async (newFilter: ScriptFilterType) => {
    setFilter(newFilter);
    try {
      const filtered = await scriptStorageService.listScriptsBySource(newFilter);
      setFilteredScripts(filtered);
    } catch (err) {
      console.error('Filter scripts error:', err);
    }
  }, []);

  /**
   * Handle script selection - opens in Editor tab
   * Requirements: 10.3
   */
  const handleScriptSelect = useCallback(async (script: StoredScriptInfo) => {
    try {
      setError(null);
      const data = await ipcBridge.loadScript(script.path);
      setSelectedScript(script);
      setScriptData(data as ScriptData);
      setEditMode(false);
      setActiveTab('editor');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load script';
      setError(errorMessage);
      console.error('Load script error:', err);
    }
  }, [ipcBridge]);

  /**
   * Handle script deletion
   */
  const handleScriptDelete = useCallback(async (script: StoredScriptInfo) => {
    if (!confirm(`Are you sure you want to delete ${script.filename}?`)) {
      return;
    }

    try {
      await ipcBridge.deleteScript(script.path);
      if (selectedScript?.path === script.path) {
        setSelectedScript(null);
        setScriptData(null);
      }
      await loadScripts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete script';
      setError(errorMessage);
      console.error('Delete script error:', err);
    }
  }, [ipcBridge, selectedScript]);

  /**
   * Handle tab change
   * Requirements: 10.1
   */
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  /**
   * Handle AI script generation
   * Requirements: 10.4
   */
  const handleScriptGenerated = useCallback((script: ScriptData) => {
    setGeneratedScript(script);
    const result = validateScript(script);
    setValidationResult(result);
    updateSessionStats();
  }, []);

  /**
   * Handle script edit in preview
   */
  const handleScriptEdit = useCallback((script: ScriptData) => {
    setGeneratedScript(script);
    const result = validateScript(script);
    setValidationResult(result);
  }, []);

  /**
   * Handle save button click - opens naming dialog
   */
  const handleScriptSave = useCallback(async (_script: ScriptData) => {
    setSaveError(null);
    setShowSaveDialog(true);
  }, []);

  /**
   * Handle actual script save with name
   * Requirements: 10.5
   */
  const handleSaveWithName = useCallback(async (scriptName: string) => {
    if (!generatedScript) {
      setSaveError('No script to save');
      return;
    }

    setSavingScript(true);
    setSaveError(null);

    try {
      const result = await scriptStorageService.saveScript(generatedScript, scriptName);

      if (result.success) {
        console.log('[UnifiedScriptManager] Script saved successfully:', result.scriptPath);
        setShowSaveDialog(false);

        // Refresh script list
        await loadScripts();

        // Transition to editor with the saved script
        // Requirements: 10.5
        if (result.scriptPath) {
          const savedScriptData = await ipcBridge.loadScript(result.scriptPath);
          setScriptData(savedScriptData as ScriptData);
          setSelectedScript({
            filename: scriptName,
            path: result.scriptPath,
            createdAt: new Date().toISOString(),
            duration: generatedScript.metadata.duration,
            actionCount: generatedScript.actions.length,
            source: 'ai_generated',
            targetOS: targetOS,
            scriptName: scriptName,
          });
          setGeneratedScript(null);
          setActiveTab('list');
        }
      } else {
        setSaveError(result.error || 'Failed to save script');
      }
    } catch (err) {
      console.error('[UnifiedScriptManager] Failed to save script:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save script');
    } finally {
      setSavingScript(false);
    }
  }, [generatedScript, targetOS, ipcBridge]);

  /**
   * Handle script discard
   */
  const handleScriptDiscard = useCallback(() => {
    setGeneratedScript(null);
    setValidationResult({
      valid: true,
      errors: [],
      warnings: [],
    });
  }, []);

  /**
   * Handle editor save
   * Requirements: 10.6
   */
  const handleEditorSave = useCallback(async () => {
    if (!selectedScript || !scriptData) return;

    try {
      await ipcBridge.saveScript(selectedScript.path, scriptData);
      setEditMode(false);
      await loadScripts();
      alert('Script saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save script';
      setError(errorMessage);
      console.error('Save script error:', err);
    }
  }, [selectedScript, scriptData, ipcBridge]);

  /**
   * Handle start of raw JSON edit mode
   */
  const handleTextEditStart = useCallback(() => {
    if (!scriptData) return;
    setJsonEditError(null);
    try {
      const formatted = JSON.stringify(scriptData, null, 2);
      setJsonText(formatted);
      setTextEditMode(true);
    } catch (err) {
      setJsonEditError('Không thể chuyển script hiện tại thành JSON.');
    }
  }, [scriptData]);

  /**
   * Handle saving raw JSON back to file
   */
  const handleJsonSave = useCallback(async () => {
    if (!selectedScript) return;

    try {
      setJsonEditError(null);
      const parsed = JSON.parse(jsonText) as ScriptData;
      setScriptData(parsed);
      await ipcBridge.saveScript(selectedScript.path, parsed);
      setEditMode(false);
      setTextEditMode(false);
      await loadScripts();
      alert('Script saved successfully');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonEditError('JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp.');
      } else {
        setJsonEditError(err instanceof Error ? err.message : 'Failed to save script');
      }
    }
  }, [jsonText, selectedScript, ipcBridge, loadScripts]);

  /**
   * Handle saving script text to a separate text file on disk
   */
  const handleSaveScriptTextToFile = useCallback(async () => {
    if (!scriptData && !textEditMode) return;

    try {
      let dataToSave: ScriptData;

      if (textEditMode) {
        try {
          const parsed = JSON.parse(jsonText) as ScriptData;
          dataToSave = parsed;
        } catch (err) {
          setJsonEditError('JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp.');
          return;
        }
      } else {
        if (!scriptData) return;
        dataToSave = scriptData;
      }

      const baseName = selectedScript?.filename || 'script';
      const defaultName = baseName.endsWith('.json')
        ? `${baseName.slice(0, -5)}.txt`
        : `${baseName}.txt`;

      const filePath = await save({
        title: 'Save script text',
        defaultPath: defaultName,
        filters: [
          {
            name: 'Text File',
            extensions: ['txt'],
          },
        ],
      });

      if (!filePath || Array.isArray(filePath)) {
        // User cancelled or multi-select not expected
        return;
      }

      // Use core (Python/Rust) save_script path to write JSON to the chosen location
      await ipcBridge.saveScript(filePath, dataToSave);
      alert('Script text saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save script text';
      setError(errorMessage);
      console.error('Save script text error:', err);
    }
  }, [scriptData, textEditMode, jsonText, selectedScript, ipcBridge]);

  /**
   * Handle action update in editor
   * Requirements: 10.6
   */
  const handleActionUpdate = useCallback((index: number, field: string, value: unknown) => {
    if (!scriptData) return;

    const updatedActions = [...scriptData.actions];
    updatedActions[index] = {
      ...updatedActions[index],
      [field]: value,
    } as Action;

    setScriptData({
      ...scriptData,
      actions: updatedActions,
      metadata: {
        ...scriptData.metadata,
        action_count: updatedActions.length,
      },
    });
  }, [scriptData]);

  /**
   * Handle action deletion in editor
   */
  const handleActionDelete = useCallback((index: number) => {
    if (!scriptData) return;

    const updatedActions = scriptData.actions.filter((_, i) => i !== index);
    setScriptData({
      ...scriptData,
      actions: updatedActions,
      metadata: {
        ...scriptData.metadata,
        action_count: updatedActions.length,
      },
    });
  }, [scriptData]);

  /**
   * Provider handlers
   */
  const handleProviderSelect = useCallback(async (providerId: AIProvider) => {
    setProviderLoading(true);
    try {
      await unifiedAIService.selectProvider(providerId);
      setActiveProvider(providerId);
      const models = unifiedAIService.getAvailableModels();
      setAvailableModels(models);
      setActiveModel(unifiedAIService.getActiveModel());
      setAvailableProviders(unifiedAIService.getAvailableProviders());
    } catch (err) {
      console.error('Failed to select provider:', err);
    } finally {
      setProviderLoading(false);
    }
  }, []);

  const handleModelSelect = useCallback((modelId: string) => {
    try {
      unifiedAIService.selectModel(modelId);
      setActiveModel(modelId);
    } catch (err) {
      console.error('Failed to select model:', err);
    }
  }, []);

  const handleConfigureProvider = useCallback((providerId?: AIProvider) => {
    setInitialExpandedProvider(providerId);
    setShowProviderSettings(true);
  }, []);

  const handleConfigurationChange = useCallback(async (configuredProviders: AIProvider[]) => {
    setProvidersConfigured(configuredProviders.length > 0);

    if (user?.uid) {
      try {
        await unifiedAIService.initialize(user.uid);
        setAvailableProviders(unifiedAIService.getAvailableProviders());

        const currentProvider = unifiedAIService.getActiveProvider();
        setActiveProvider(currentProvider);

        if (currentProvider) {
          setAvailableModels(unifiedAIService.getAvailableModels());
          setActiveModel(unifiedAIService.getActiveModel());
        }
      } catch (err) {
        console.error('Failed to re-initialize service:', err);
      }
    }
  }, [user?.uid]);

  const updateSessionStats = useCallback(() => {
    const stats = providerManager.getSessionStats();
    setSessionStats(stats);
  }, []);

  /**
   * Handle OS selection change
   * Requirements: 10.4
   */
  const handleOSChange = useCallback((os: TargetOS) => {
    setTargetOS(os);
  }, []);

  /**
   * Navigate back to dashboard
   */
  const handleBack = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  /**
   * Check if any AI-generated scripts exist
   */
  const hasAIScripts = useMemo(() => {
    return allScripts.some(s => s.source === 'ai_generated');
  }, [allScripts]);

  /**
   * Render Script List Tab
   * Requirements: 10.2
   */
  const renderScriptListTab = () => (
    <div className="unified-tab-content script-list-tab">
      <div className="script-list-header">
        <h2 className="tab-section-title">All Scripts</h2>
        <button className="refresh-button" onClick={loadScripts}>
          🔄 Refresh
        </button>
      </div>

      <ScriptFilter
        filter={filter}
        onFilterChange={handleFilterChange}
        totalCount={allScripts.length}
        filteredCount={filteredScripts.length}
        showOSFilter={hasAIScripts}
        showSearch={true}
      />

      <div className="script-list-content">
        {scriptsLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading scripts...</p>
          </div>
        ) : filteredScripts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-text">
              {allScripts.length === 0
                ? 'No scripts found. Record a session or create an AI script.'
                : 'No scripts match the current filter.'}
            </p>
            {allScripts.length === 0 && (
              <button
                className="create-script-button"
                onClick={() => setActiveTab('builder')}
              >
                🤖 Create AI Script
              </button>
            )}
          </div>
        ) : (
          <div className="script-list-items">
            {filteredScripts.map((script) => (
              <ScriptListItem
                key={script.path}
                script={script}
                selected={selectedScript?.path === script.path}
                onClick={handleScriptSelect}
                onDelete={handleScriptDelete}
                showDelete={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Render AI Builder Tab
   * Requirements: 10.4, 10.5
   */
  const renderAIBuilderTab = () => (
    <div className="unified-tab-content ai-builder-tab">
      <div className="ai-builder-layout">
        {/* Chat Panel */}
        <div className="ai-builder-chat-panel">
          <div className="ai-builder-chat-header">
            <OSSelector selectedOS={targetOS} onOSChange={handleOSChange} />
            <UsageStatistics statistics={sessionStats} variant="tooltip" />
          </div>

          <AIChatInterface
            onScriptGenerated={handleScriptGenerated}
            apiKeyConfigured={providersConfigured}
            targetOS={targetOS}
            providers={availableProviders}
            activeProvider={activeProvider}
            onProviderSelect={handleProviderSelect}
            onConfigureProvider={handleConfigureProvider}
            models={availableModels}
            activeModel={activeModel}
            onModelSelect={handleModelSelect}
            providerLoading={providerLoading}
          />
        </div>

        {/* Preview Panel */}
        <div className="ai-builder-preview-panel">
          <ScriptPreview
            script={generatedScript}
            onEdit={handleScriptEdit}
            onSave={handleScriptSave}
            onDiscard={handleScriptDiscard}
            validationResult={validationResult}
          />
        </div>
      </div>
    </div>
  );

  /**
   * Render Editor Tab
   * Requirements: 10.3, 10.6
   */
  const renderEditorTab = () => (
    <div className="unified-tab-content editor-tab">
      {!scriptData ? (
        <div className="editor-placeholder">
          <div className="placeholder-icon">📝</div>
          <p className="placeholder-text">
            Select a script from the Script List to edit
          </p>
          <button
            className="go-to-list-button"
            onClick={() => setActiveTab('list')}
          >
            📋 Go to Script List
          </button>
        </div>
      ) : (
        <div className="editor-content">
          <div className="editor-header">
            <div className="editor-title-section">
              <h2 className="editor-title">
                {selectedScript?.filename || 'Script Editor'}
              </h2>
              {selectedScript && (
                <div className="editor-badges">
                  <span className={`source-badge source-${selectedScript.source}`}>
                    {selectedScript.source === 'ai_generated' ? '🤖 AI Generated' : '🎬 Recorded'}
                  </span>
                  {selectedScript.targetOS && (
                    <span className={`os-badge os-${selectedScript.targetOS}`}>
                      {selectedScript.targetOS === 'macos' ? '🍎' : selectedScript.targetOS === 'windows' ? '🪟' : '🔄'} {selectedScript.targetOS}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="editor-actions">
              {editMode ? (
                <>
                  <button className="save-button" onClick={handleEditorSave}>
                    💾 Save
                  </button>
                  <button
                    className="cancel-button"
                    onClick={() => {
                      setEditMode(false);
                      if (selectedScript) {
                        handleScriptSelect(selectedScript);
                      }
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="edit-button" onClick={() => setEditMode(true)}>
                    ✏️ Edit
                  </button>
                  <button className="edit-button" onClick={handleTextEditStart}>
                    🧾 Edit text
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="metadata-section">
            <h3 className="section-title">Metadata</h3>
            <div className="metadata-grid">
              <span className="metadata-label">Version:</span>
              <span className="metadata-value">{scriptData.version}</span>

              <span className="metadata-label">Created:</span>
              <span className="metadata-value">
                {new Date(scriptData.metadata.created_at).toLocaleString()}
              </span>

              <span className="metadata-label">Duration:</span>
              <span className="metadata-value">
                {scriptData.metadata.duration.toFixed(2)}s
              </span>

              <span className="metadata-label">Actions:</span>
              <span className="metadata-value">{scriptData.metadata.action_count}</span>

              <span className="metadata-label">Platform:</span>
              <span className="metadata-value">{scriptData.metadata.platform}</span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="actions-section">
            <h3 className="section-title">
              Actions ({scriptData.actions.length})
            </h3>
            <div className="actions-list">
              {scriptData.actions.map((action, index) => (
                <div key={index} className="action-item">
                  <div className="action-header">
                    <span className="action-index">#{index + 1}</span>
                    <span className="action-type">{action.type}</span>
                    {editMode && (
                      <button
                        className="action-delete-button"
                        onClick={() => handleActionDelete(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="action-details">
                    <span className="action-detail">
                      Time: {action.timestamp.toFixed(3)}s
                    </span>
                    {action.x !== undefined && (
                      <span className="action-detail">X: {action.x}</span>
                    )}
                    {action.y !== undefined && (
                      <span className="action-detail">Y: {action.y}</span>
                    )}
                    {action.button && (
                      <span className="action-detail">Button: {action.button}</span>
                    )}
                    {action.key && (
                      <span className="action-detail">Key: {action.key}</span>
                    )}
                    {action.text && (
                      <span className="action-detail">Text: "{action.text}"</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Raw JSON Text Editor */}
          {textEditMode && (
            <div className="actions-section">
              <h3 className="section-title">Raw JSON</h3>
              {jsonEditError && (
                <div className="error-container">
                  <p className="error-text">{jsonEditError}</p>
                </div>
              )}
              <textarea
                className="json-editor-textarea"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={20}
              />
              <div className="editor-actions">
                <button className="save-button" onClick={handleJsonSave}>
                  💾 Save JSON
                </button>
                <button className="save-button" onClick={handleSaveScriptTextToFile}>
                  💾 Save script text
                </button>
                <button
                  className="cancel-button"
                  onClick={() => {
                    setTextEditMode(false);
                    setJsonEditError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="unified-script-manager" data-testid="unified-script-manager">
      {/* Header */}
      <header className="unified-header">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <h1 className="header-title">Script Manager</h1>
        <div className="header-spacer"></div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="tab-navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="tab-content-container">
        {activeTab === 'list' && renderScriptListTab()}
        {activeTab === 'builder' && renderAIBuilderTab()}
        {activeTab === 'editor' && renderEditorTab()}
      </main>

      {/* Provider Settings Modal */}
      {showProviderSettings && user?.uid && (
        <ProviderSettings
          userId={user.uid}
          onConfigurationChange={handleConfigurationChange}
          initialExpandedProvider={initialExpandedProvider}
          isModal={true}
          onClose={() => {
            setShowProviderSettings(false);
            setInitialExpandedProvider(undefined);
          }}
        />
      )}

      {/* Script Name Dialog */}
      <ScriptNameDialog
        isOpen={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          setSaveError(null);
        }}
        onSave={handleSaveWithName}
        isLoading={savingScript}
        error={saveError}
      />
    </div>
  );
};

export default UnifiedScriptManager;
