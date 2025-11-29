/**
 * RecorderScreen Component
 * Main UI for Desktop Recorder MVP
 * Requirements: 1.2, 1.5, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthButton } from '../components/AuthButton';
import { getIPCBridge } from '../services/ipcBridgeService';
import {
  RecorderStatus,
  IPCEvent,
} from '../types/recorder.types';
import { calculateButtonStates } from '../utils/buttonStates';
import { RootStackParamList } from '../navigation/AppNavigator';

type RecorderNavigationProp = StackNavigationProp<RootStackParamList, 'Recorder'>;

interface ScriptInfo {
  path: string;
  filename: string;
  created_at: string;
  duration: number;
  action_count: number;
}

const RecorderScreen: React.FC = () => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const [hasRecordings, setHasRecordings] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showScriptSelector, setShowScriptSelector] = useState<boolean>(false);
  const [availableScripts, setAvailableScripts] = useState<ScriptInfo[]>([]);
  const [selectedScriptPath, setSelectedScriptPath] = useState<string | null>(null);

  const navigation = useNavigation<RecorderNavigationProp>();
  const ipcBridge = getIPCBridge();

  // Calculate button states
  const buttonStates = calculateButtonStates(status, hasRecordings);

  /**
   * Initialize component - check for existing recordings
   * Requirements: 2.5, 6.4
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check for existing recordings
        const recordings = await ipcBridge.checkForRecordings();
        setHasRecordings(recordings);

        if (recordings) {
          // Get the latest recording path
          const latestPath = await ipcBridge.getLatestRecording();
          setLastRecordingPath(latestPath);
          setSelectedScriptPath(latestPath);

          // Load list of available scripts
          await loadAvailableScripts();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize recorder';
        setError(errorMessage);
        console.error('Initialization error:', err);
      }
    };

    initialize();

    // Set up event listeners for playback progress
    const handleProgressEvent = (event: IPCEvent) => {
      console.log('Playback progress:', event.data);
    };

    const handleCompleteEvent = (event: IPCEvent) => {
      console.log('Playback complete:', event.data);
      setStatus('idle');
      setLoading(false);
    };

    const handleErrorEvent = (event: IPCEvent) => {
      console.error('Playback error:', event.data);
      setError(event.data?.message || 'Playback error occurred');
      setStatus('idle');
      setLoading(false);
    };

    ipcBridge.addEventListener('progress', handleProgressEvent);
    ipcBridge.addEventListener('complete', handleCompleteEvent);
    ipcBridge.addEventListener('error', handleErrorEvent);

    // Cleanup
    return () => {
      ipcBridge.removeEventListener('progress', handleProgressEvent);
      ipcBridge.removeEventListener('complete', handleCompleteEvent);
      ipcBridge.removeEventListener('error', handleErrorEvent);
    };
  }, []);

  /**
   * Load available scripts for selection
   */
  const loadAvailableScripts = async () => {
    try {
      const scripts = await ipcBridge.listScripts();
      setAvailableScripts(scripts);
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
  };

  /**
   * Handle Record button click
   * Requirements: 1.1, 1.3
   */
  const handleRecordClick = async () => {
    try {
      setError(null);
      setLoading(true);
      await ipcBridge.startRecording();
      setStatus('recording');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Recording error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Start button click (playback)
   * Requirements: 2.1, 2.3
   */
  const handleStartClick = async () => {
    try {
      setError(null);
      setLoading(true);
      // Use selected script path, or fall back to last recording
      const scriptPath = selectedScriptPath || lastRecordingPath || undefined;
      await ipcBridge.startPlayback(scriptPath);
      setStatus('playing');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start playback';
      setError(errorMessage);
      console.error('Playback error:', err);
      setLoading(false);
    }
  };

  /**
   * Handle script selection from modal
   */
  const handleScriptSelect = (script: ScriptInfo) => {
    setSelectedScriptPath(script.path);
    setShowScriptSelector(false);
  };

  /**
   * Open script selector modal
   */
  const openScriptSelector = async () => {
    try {
      setLoading(true);
      await loadAvailableScripts();
      setShowScriptSelector(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scripts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Stop button click
   * Requirements: 1.3, 2.4
   */
  const handleStopClick = async () => {
    try {
      setError(null);
      setLoading(true);

      if (status === 'recording') {
        // Stop recording
        const result = await ipcBridge.stopRecording();

        if (result.success) {
          setLastRecordingPath(result.scriptPath || null);
          setSelectedScriptPath(result.scriptPath || null);
          setHasRecordings(true);
          setStatus('idle');
          // Reload available scripts to include the new recording
          await loadAvailableScripts();
        } else {
          setError(result.error || 'Failed to stop recording');
        }
      } else if (status === 'playing') {
        // Stop playback
        await ipcBridge.stopPlayback();
        setStatus('idle');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop';
      setError(errorMessage);
      console.error('Stop error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get selected script display name
   */
  const getSelectedScriptName = (): string => {
    if (!selectedScriptPath) return 'Latest recording';

    const script = availableScripts.find(s => s.path === selectedScriptPath);
    return script ? script.filename : 'Latest recording';
  };

  /**
   * Get status display text
   */
  const getStatusText = (): string => {
    switch (status) {
      case 'idle':
        return 'Idle';
      case 'recording':
        return 'Recording';
      case 'playing':
        return 'Playing';
      default:
        return 'Unknown';
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (): string => {
    switch (status) {
      case 'idle':
        return '#5f6368';
      case 'recording':
        return '#d93025';
      case 'playing':
        return '#1a73e8';
      default:
        return '#5f6368';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back to Dashboard</Text>
      </TouchableOpacity>

      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.logo}>GeniusQA Recorder</Text>
        <Text style={styles.subtitle}>Record and replay desktop interactions</Text>
      </View>

      {/* Status Display */}
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsCard}>
        <Text style={styles.controlsTitle}>Controls</Text>

        {/* Record Button */}
        <AuthButton
          title="Record"
          onPress={handleRecordClick}
          loading={loading && status === 'idle'}
          disabled={!buttonStates.recordEnabled || loading}
          variant="primary"
        />

        {/* Script Selection */}
        {hasRecordings && (
          <View style={styles.scriptSelectionContainer}>
            <Text style={styles.scriptSelectionLabel}>Selected Script:</Text>
            <TouchableOpacity
              style={styles.scriptSelectionButton}
              onPress={openScriptSelector}
              disabled={loading || status !== 'idle'}
            >
              <Text style={styles.scriptSelectionText} numberOfLines={1}>
                {getSelectedScriptName()}
              </Text>
              <Text style={styles.scriptSelectionIcon}>▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Start Button */}
        <AuthButton
          title="Start Playback"
          onPress={handleStartClick}
          loading={loading && status === 'idle'}
          disabled={!buttonStates.startEnabled || loading}
          variant="primary"
        />

        {/* Stop Button */}
        <AuthButton
          title="Stop"
          onPress={handleStopClick}
          loading={loading && (status === 'recording' || status === 'playing')}
          disabled={!buttonStates.stopEnabled || loading}
          variant="secondary"
        />
      </View>

      {/* Script Selector Modal */}
      <Modal
        visible={showScriptSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowScriptSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Script to Play</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowScriptSelector(false)}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableScripts}
              keyExtractor={(item) => item.path}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.scriptItem,
                    selectedScriptPath === item.path && styles.scriptItemSelected,
                  ]}
                  onPress={() => handleScriptSelect(item)}
                >
                  <Text style={styles.scriptFilename}>{item.filename}</Text>
                  <Text style={styles.scriptInfo}>
                    Created: {new Date(item.created_at).toLocaleString()}
                  </Text>
                  <Text style={styles.scriptInfo}>
                    Duration: {item.duration.toFixed(2)}s | Actions: {item.action_count}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No scripts available</Text>
              }
              style={styles.scriptList}
            />
          </View>
        </View>
      </Modal>

      {/* Info Section */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Information</Text>
        <Text style={styles.infoText}>
          • Click Record to capture your interactions{'\n'}
          • Click Stop to end recording{'\n'}
          • Click Start Playback to replay the last recording{'\n'}
          • Recordings are saved automatically
        </Text>
        {lastRecordingPath && (
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingLabel}>Last Recording:</Text>
            <Text style={styles.recordingPath} numberOfLines={2}>
              {lastRecordingPath}
            </Text>
          </View>
        )}
      </View>

      {/* Script Editor Link */}
      <View style={styles.editorLinkCard}>
        <Text style={styles.editorLinkTitle}>Manage Scripts</Text>
        <Text style={styles.editorLinkText}>
          View, edit, and manage all your recorded scripts
        </Text>
        <AuthButton
          title="Open Script Editor"
          onPress={() => navigation.navigate('ScriptEditor' as any)}
          loading={false}
          disabled={false}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#1a73e8',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5f6368',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 24,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fce8e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#d93025',
    fontSize: 14,
    textAlign: 'center',
  },
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#5f6368',
    lineHeight: 22,
  },
  recordingInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dadce0',
  },
  recordingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  recordingPath: {
    fontSize: 12,
    color: '#5f6368',
    fontFamily: 'monospace',
  },
  editorLinkCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editorLinkTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  editorLinkText: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 16,
  },
  scriptSelectionContainer: {
    marginVertical: 12,
  },
  scriptSelectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  scriptSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    padding: 12,
  },
  scriptSelectionText: {
    fontSize: 14,
    color: '#202124',
    flex: 1,
    marginRight: 8,
  },
  scriptSelectionIcon: {
    fontSize: 12,
    color: '#5f6368',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '80%',
    maxWidth: 600,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#dadce0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#5f6368',
    fontWeight: 'bold',
  },
  scriptList: {
    padding: 16,
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
  scriptFilename: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  scriptInfo: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
    marginTop: 32,
  },
});

export default RecorderScreen;
