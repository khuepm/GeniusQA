/**
 * ScriptEditorScreen Component
 * UI for viewing and editing recorded scripts
 * 
 * This screen allows users to:
 * - View a list of all recorded scripts
 * - Select a script to view/edit
 * - Edit script metadata and actions
 * - Save changes to the script file
 * - Delete scripts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthButton } from '../components/AuthButton';
import { getIPCBridge } from '../services/ipcBridgeService';
import { RootStackParamList } from '../navigation/AppNavigator';

type ScriptEditorNavigationProp = StackNavigationProp<RootStackParamList, 'ScriptEditor'>;

interface ScriptInfo {
  path: string;
  filename: string;
  created_at: string;
  duration: number;
  action_count: number;
}

interface Action {
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release';
  timestamp: number;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
}

interface ScriptData {
  metadata: {
    version: string;
    created_at: string;
    duration: number;
    action_count: number;
    platform: string;
  };
  actions: Action[];
}

const ScriptEditorScreen: React.FC = () => {
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);

  const navigation = useNavigation<ScriptEditorNavigationProp>();
  const ipcBridge = getIPCBridge();

  /**
   * Load list of scripts on mount
   */
  useEffect(() => {
    loadScripts();
  }, []);

  /**
   * Load all available scripts
   */
  const loadScripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const scriptList = await ipcBridge.listScripts();
      setScripts(scriptList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scripts';
      setError(errorMessage);
      console.error('Load scripts error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load a specific script for viewing/editing
   */
  const loadScript = async (script: ScriptInfo) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ipcBridge.loadScript(script.path);
      setScriptData(data);
      setSelectedScript(script);
      setEditMode(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load script';
      setError(errorMessage);
      console.error('Load script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save changes to the script
   */
  const saveScript = async () => {
    if (!selectedScript || !scriptData) return;

    try {
      setLoading(true);
      setError(null);
      await ipcBridge.saveScript(selectedScript.path, scriptData);
      setEditMode(false);
      Alert.alert('Success', 'Script saved successfully');
      await loadScripts(); // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save script';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      console.error('Save script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a script
   */
  const deleteScript = async (script: ScriptInfo) => {
    Alert.alert(
      'Delete Script',
      `Are you sure you want to delete ${script.filename}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              setError(null);
              await ipcBridge.deleteScript(script.path);
              if (selectedScript?.path === script.path) {
                setSelectedScript(null);
                setScriptData(null);
              }
              await loadScripts();
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : 'Failed to delete script';
              setError(errorMessage);
              Alert.alert('Error', errorMessage);
              console.error('Delete script error:', err);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Update action in the script
   */
  const updateAction = (index: number, field: string, value: any) => {
    if (!scriptData) return;

    const updatedActions = [...scriptData.actions];
    updatedActions[index] = {
      ...updatedActions[index],
      [field]: value,
    };

    setScriptData({
      ...scriptData,
      actions: updatedActions,
      metadata: {
        ...scriptData.metadata,
        action_count: updatedActions.length,
      },
    });
  };

  /**
   * Delete an action from the script
   */
  const deleteAction = (index: number) => {
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
  };

  /**
   * Render script list
   */
  const renderScriptList = () => (
    <View style={styles.scriptList}>
      <Text style={styles.sectionTitle}>Available Scripts</Text>
      {scripts.length === 0 ? (
        <Text style={styles.emptyText}>No scripts found. Record a session first.</Text>
      ) : (
        scripts.map((script, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.scriptItem,
              selectedScript?.path === script.path && styles.scriptItemSelected,
            ]}
            onPress={() => loadScript(script)}
          >
            <View style={styles.scriptItemHeader}>
              <Text style={styles.scriptFilename}>{script.filename}</Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteScript(script)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.scriptInfo}>
              Created: {new Date(script.created_at).toLocaleString()}
            </Text>
            <Text style={styles.scriptInfo}>
              Duration: {script.duration.toFixed(2)}s | Actions: {script.action_count}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  /**
   * Render script editor
   */
  const renderScriptEditor = () => {
    if (!selectedScript || !scriptData) {
      return (
        <View style={styles.editorPlaceholder}>
          <Text style={styles.placeholderText}>
            Select a script from the list to view or edit
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.editor}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>{selectedScript.filename}</Text>
          <View style={styles.editorActions}>
            {editMode ? (
              <>
                <View style={styles.actionButton}>
                  <AuthButton
                    title="Save"
                    onPress={saveScript}
                    loading={loading}
                    variant="primary"
                  />
                </View>
                <View style={styles.actionButton}>
                  <AuthButton
                    title="Cancel"
                    onPress={() => {
                      setEditMode(false);
                      loadScript(selectedScript);
                    }}
                    variant="secondary"
                  />
                </View>
              </>
            ) : (
              <View style={styles.actionButton}>
                <AuthButton
                  title="Edit"
                  onPress={() => setEditMode(true)}
                  variant="primary"
                />
              </View>
            )}
          </View>
        </View>

        <ScrollView style={styles.editorContent}>
          {/* Metadata Section */}
          <View style={styles.metadataSection}>
            <Text style={styles.subsectionTitle}>Metadata</Text>
            <View style={styles.metadataGrid}>
              <Text style={styles.metadataLabel}>Version:</Text>
              <Text style={styles.metadataValue}>{scriptData.metadata.version}</Text>

              <Text style={styles.metadataLabel}>Created:</Text>
              <Text style={styles.metadataValue}>
                {new Date(scriptData.metadata.created_at).toLocaleString()}
              </Text>

              <Text style={styles.metadataLabel}>Duration:</Text>
              <Text style={styles.metadataValue}>
                {scriptData.metadata.duration.toFixed(2)}s
              </Text>

              <Text style={styles.metadataLabel}>Actions:</Text>
              <Text style={styles.metadataValue}>{scriptData.metadata.action_count}</Text>

              <Text style={styles.metadataLabel}>Platform:</Text>
              <Text style={styles.metadataValue}>{scriptData.metadata.platform}</Text>
            </View>
          </View>

          {/* Actions Section */}
          <View style={styles.actionsSection}>
            <Text style={styles.subsectionTitle}>
              Actions ({scriptData.actions.length})
            </Text>
            {scriptData.actions.map((action, index) => (
              <View key={index} style={styles.actionItem}>
                <View style={styles.actionHeader}>
                  <Text style={styles.actionIndex}>#{index + 1}</Text>
                  <Text style={styles.actionType}>{action.type}</Text>
                  {editMode && (
                    <TouchableOpacity
                      style={styles.actionDeleteButton}
                      onPress={() => deleteAction(index)}
                    >
                      <Text style={styles.actionDeleteText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.actionDetails}>
                  <Text style={styles.actionDetail}>
                    Time: {action.timestamp.toFixed(3)}s
                  </Text>
                  {action.x !== undefined && (
                    <Text style={styles.actionDetail}>X: {action.x}</Text>
                  )}
                  {action.y !== undefined && (
                    <Text style={styles.actionDetail}>Y: {action.y}</Text>
                  )}
                  {action.button && (
                    <Text style={styles.actionDetail}>Button: {action.button}</Text>
                  )}
                  {action.key && (
                    <Text style={styles.actionDetail}>Key: {action.key}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Script Editor</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadScripts}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.leftPanel}>
          {renderScriptList()}
        </View>
        <View style={styles.rightPanel}>
          {renderScriptEditor()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dadce0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1a73e8',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  refreshButtonText: {
    fontSize: 16,
    color: '#1a73e8',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fce8e6',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#d93025',
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: '#dadce0',
    backgroundColor: '#ffffff',
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scriptList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
    marginTop: 32,
  },
  scriptItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  scriptItemSelected: {
    backgroundColor: '#e8f0fe',
    borderColor: '#1a73e8',
  },
  scriptItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scriptFilename: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    flex: 1,
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#d93025',
    borderRadius: 4,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  scriptInfo: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 2,
  },
  editorPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderText: {
    fontSize: 16,
    color: '#5f6368',
    textAlign: 'center',
  },
  editor: {
    flex: 1,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dadce0',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    flex: 1,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minWidth: 80,
  },
  editorContent: {
    flex: 1,
    padding: 16,
  },
  metadataSection: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 12,
  },
  metadataGrid: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5f6368',
    marginTop: 8,
  },
  metadataValue: {
    fontSize: 14,
    color: '#202124',
    marginTop: 4,
    marginBottom: 8,
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5f6368',
    marginRight: 8,
  },
  actionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a73e8',
    flex: 1,
  },
  actionDeleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d93025',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDeleteText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  actionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionDetail: {
    fontSize: 12,
    color: '#5f6368',
    fontFamily: 'monospace',
  },
});

export default ScriptEditorScreen;
