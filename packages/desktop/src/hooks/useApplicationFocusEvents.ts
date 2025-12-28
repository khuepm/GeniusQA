import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { FocusState, PlaybackSession, NotificationData } from '../types/applicationFocusedAutomation.types';

interface FocusEventData {
  type: string;
  data: any;
  timestamp: string;
}

interface PlaybackEventData {
  type: string;
  data: any;
  timestamp: string;
}

export const useApplicationFocusEvents = (appId?: string) => {
  const [focusState, setFocusState] = useState<FocusState | null>(null);
  const [playbackSession, setPlaybackSession] = useState<PlaybackSession | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let focusUnlisten: UnlistenFn | null = null;
    let playbackUnlisten: UnlistenFn | null = null;
    let eventUnlisten: UnlistenFn | null = null;

    const setupEventListeners = async () => {
      try {
        // Listen for focus state updates
        focusUnlisten = await listen<FocusEventData>('focus_state_update', (event) => {
          console.log('Focus state update:', event.payload);
          if (event.payload.data) {
            setFocusState({
              is_target_process_focused: event.payload.data.is_target_process_focused,
              focused_process_id: event.payload.data.focused_process_id,
              focused_window_title: event.payload.data.focused_window_title,
              last_change: event.payload.data.last_change,
            });
          }
        });

        // Listen for playback status updates
        playbackUnlisten = await listen<PlaybackEventData>('playback_status_update', (event) => {
          console.log('Playback status update:', event.payload);
          if (event.payload.data) {
            const sessionData = event.payload.data;
            setPlaybackSession({
              id: sessionData.id,
              target_app_id: sessionData.target_app_id,
              target_process_id: sessionData.target_process_id,
              state: sessionData.state,
              focus_strategy: sessionData.focus_strategy,
              current_step: sessionData.current_step,
              started_at: sessionData.started_at,
              paused_at: sessionData.paused_at,
              resumed_at: sessionData.resumed_at,
              total_pause_duration: sessionData.total_pause_duration
            });
          }
        });

        // Listen for general focus events (for notifications)
        eventUnlisten = await listen<FocusEventData>('focus_event', (event) => {
          console.log('Focus event:', event.payload);
          
          // Convert focus events to notifications
          const eventType = event.payload.type;
          if (eventType === 'focus_lost' || eventType === 'focus_gained') {
            const notification: NotificationData = {
              id: `${Date.now()}-${Math.random()}`,
              type: eventType as 'focus_lost' | 'focus_gained',
              title: eventType === 'focus_lost' ? 'Focus Lost' : 'Focus Gained',
              message: eventType === 'focus_lost' 
                ? 'Target application lost focus - automation paused'
                : 'Target application gained focus - automation resumed',
              timestamp: event.payload.timestamp || new Date().toISOString(),
              application_name: event.payload.data?.application_name
            };
            
            setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
          }
        });

        // Subscribe to focus updates if we have an app ID
        if (appId) {
          await invoke('subscribe_to_focus_updates', { appId });
        }

        // Subscribe to playback updates
        await invoke('subscribe_to_playback_updates');

        setIsConnected(true);
        console.log('Event listeners setup complete');
      } catch (error) {
        console.error('Failed to setup event listeners:', error);
        setIsConnected(false);
      }
    };

    setupEventListeners();

    // Cleanup function
    return () => {
      const cleanup = async () => {
        try {
          if (focusUnlisten) await focusUnlisten();
          if (playbackUnlisten) await playbackUnlisten();
          if (eventUnlisten) await eventUnlisten();

          // Unsubscribe from backend events
          await invoke('unsubscribe_from_focus_updates').catch(console.error);
          await invoke('unsubscribe_from_playback_updates').catch(console.error);
        } catch (error) {
          console.error('Error during event cleanup:', error);
        }
      };
      cleanup();
    };
  }, [appId]);

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return {
    focusState,
    playbackSession,
    notifications,
    isConnected,
    dismissNotification,
    clearAllNotifications
  };
};
