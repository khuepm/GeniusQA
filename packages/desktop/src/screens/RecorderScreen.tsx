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

const RecorderScreen: React.FC = () => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const [hasRecordings, setHasRecordings] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

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
      await ipcBridge.startPlayback(lastRecordingPath || undefined);
      setStatus('playing');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start playback';
      setError(errorMessage);
      console.error('Playback error:', err);
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
          setHasRecordings(true);
          setStatus('idle');
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
});

export default RecorderScreen;
