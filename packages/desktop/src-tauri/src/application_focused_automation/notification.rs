//! Notification Service for Application-Focused Automation
//! 
//! This module provides notification functionality for focus changes and automation events.
//! It handles displaying notifications to users when automation is paused due to focus loss,
//! and provides mechanisms for user interaction with notifications.

use crate::application_focused_automation::{
    types::{FocusEvent, RegisteredApplication},
    error::PlaybackError,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use uuid::Uuid;

/// Represents different types of notifications that can be displayed
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationType {
    /// Automation paused due to focus loss
    AutomationPaused,
    /// Automation resumed after focus regained
    AutomationResumed,
    /// Application error occurred
    ApplicationError,
    /// Focus state changed
    FocusChanged,
}

/// Represents the urgency level of a notification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationUrgency {
    Low,
    Normal,
    High,
    Critical,
}

/// Represents a notification to be displayed to the user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub notification_type: NotificationType,
    pub title: String,
    pub message: String,
    pub target_app_name: Option<String>,
    pub target_app_id: Option<String>,
    pub urgency: NotificationUrgency,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_clickable: bool,
    pub action_data: Option<NotificationActionData>,
}

/// Data associated with notification actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationActionData {
    pub action_type: NotificationActionType,
    pub target_app_id: Option<String>,
    pub additional_data: HashMap<String, String>,
}

/// Types of actions that can be performed when a notification is clicked
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationActionType {
    /// Bring the target application to focus
    BringAppToFocus,
    /// Resume automation
    ResumeAutomation,
    /// Dismiss notification
    Dismiss,
    /// Show error details
    ShowErrorDetails,
}

/// Events emitted by the notification service
#[derive(Debug, Clone)]
pub enum NotificationEvent {
    /// A notification was displayed
    NotificationDisplayed {
        notification_id: String,
        notification_type: NotificationType,
    },
    /// A notification was clicked
    NotificationClicked {
        notification_id: String,
        action_type: NotificationActionType,
    },
    /// A notification expired
    NotificationExpired {
        notification_id: String,
    },
    /// A notification was dismissed
    NotificationDismissed {
        notification_id: String,
    },
}

/// Configuration for the notification service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    /// Default timeout for notifications in milliseconds
    pub default_timeout_ms: u64,
    /// Maximum number of active notifications
    pub max_active_notifications: usize,
    /// Whether to show system notifications
    pub enable_system_notifications: bool,
    /// Whether to show in-app notifications
    pub enable_in_app_notifications: bool,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            default_timeout_ms: 5000, // 5 seconds
            max_active_notifications: 10,
            enable_system_notifications: true,
            enable_in_app_notifications: true,
        }
    }
}

/// Service for managing notifications related to application focus and automation
pub struct NotificationService {
    config: NotificationConfig,
    active_notifications: Arc<Mutex<HashMap<String, Notification>>>,
    event_sender: mpsc::UnboundedSender<NotificationEvent>,
    event_receiver: Arc<Mutex<Option<mpsc::UnboundedReceiver<NotificationEvent>>>>,
    is_running: Arc<Mutex<bool>>,
}

impl NotificationService {
    /// Creates a new notification service with the given configuration
    pub fn new(config: NotificationConfig) -> Self {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        
        Self {
            config,
            active_notifications: Arc::new(Mutex::new(HashMap::new())),
            event_sender,
            event_receiver: Arc::new(Mutex::new(Some(event_receiver))),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Creates a new notification service with default configuration
    pub fn with_default_config() -> Self {
        Self::new(NotificationConfig::default())
    }

    /// Start the notification service
    pub fn start(&mut self) -> Result<(), PlaybackError> {
        let mut running = self.is_running.lock().unwrap();
        if *running {
            return Ok(()); // Already running
        }
        *running = true;
        log::info!("[NotificationService] Started notification service");
        Ok(())
    }

    /// Stop the notification service
    pub fn stop(&mut self) -> Result<(), PlaybackError> {
        let mut running = self.is_running.lock().unwrap();
        if !*running {
            return Ok(()); // Already stopped
        }
        *running = false;
        log::info!("[NotificationService] Stopped notification service");
        Ok(())
    }

    /// Check if the notification service is running
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }

    /// Displays a notification for automation being paused due to focus loss
    pub async fn notify_automation_paused(
        &self,
        target_app: &RegisteredApplication,
        focus_event: &FocusEvent,
    ) -> Result<String, PlaybackError> {
        let notification_id = Uuid::new_v4().to_string();
        
        let (title, message) = match focus_event {
            FocusEvent::TargetProcessLostFocus { new_focused_app, .. } => {
                let focused_app_info = new_focused_app
                    .as_ref()
                    .map(|app| format!(" (switched to {})", app))
                    .unwrap_or_default();
                
                (
                    "Automation Paused".to_string(),
                    format!(
                        "Automation paused because {} lost focus{}. Click to refocus the application.",
                        target_app.name,
                        focused_app_info
                    )
                )
            }
            _ => (
                "Automation Paused".to_string(),
                format!(
                    "Automation paused due to focus change. Click to refocus {}.",
                    target_app.name
                )
            )
        };

        let notification = Notification {
            id: notification_id.clone(),
            notification_type: NotificationType::AutomationPaused,
            title,
            message,
            target_app_name: Some(target_app.name.clone()),
            target_app_id: Some(target_app.id.clone()),
            urgency: NotificationUrgency::Normal,
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::milliseconds(self.config.default_timeout_ms as i64)),
            is_clickable: true,
            action_data: Some(NotificationActionData {
                action_type: NotificationActionType::BringAppToFocus,
                target_app_id: Some(target_app.id.clone()),
                additional_data: HashMap::new(),
            }),
        };

        self.display_notification(notification).await?;
        Ok(notification_id)
    }

    /// Displays a notification for automation being resumed
    pub async fn notify_automation_resumed(
        &self,
        target_app: &RegisteredApplication,
    ) -> Result<String, PlaybackError> {
        let notification_id = Uuid::new_v4().to_string();
        
        let notification = Notification {
            id: notification_id.clone(),
            notification_type: NotificationType::AutomationResumed,
            title: "Automation Resumed".to_string(),
            message: format!("Automation resumed for {}.", target_app.name),
            target_app_name: Some(target_app.name.clone()),
            target_app_id: Some(target_app.id.clone()),
            urgency: NotificationUrgency::Low,
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::milliseconds(2000)), // Shorter timeout for resume notifications
            is_clickable: false,
            action_data: None,
        };

        self.display_notification(notification).await?;
        Ok(notification_id)
    }

    /// Displays a notification for application errors
    pub async fn notify_application_error(
        &self,
        target_app: &RegisteredApplication,
        error_message: &str,
    ) -> Result<String, PlaybackError> {
        let notification_id = Uuid::new_v4().to_string();
        
        let notification = Notification {
            id: notification_id.clone(),
            notification_type: NotificationType::ApplicationError,
            title: "Application Error".to_string(),
            message: format!("Error with {}: {}", target_app.name, error_message),
            target_app_name: Some(target_app.name.clone()),
            target_app_id: Some(target_app.id.clone()),
            urgency: NotificationUrgency::High,
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::milliseconds(self.config.default_timeout_ms as i64 * 2)), // Longer timeout for errors
            is_clickable: true,
            action_data: Some(NotificationActionData {
                action_type: NotificationActionType::ShowErrorDetails,
                target_app_id: Some(target_app.id.clone()),
                additional_data: {
                    let mut data = HashMap::new();
                    data.insert("error_message".to_string(), error_message.to_string());
                    data
                },
            }),
        };

        self.display_notification(notification).await?;
        Ok(notification_id)
    }

    /// Displays a notification for focus state changes
    pub async fn notify_focus_changed(
        &self,
        target_app: &RegisteredApplication,
        gained_focus: bool,
    ) -> Result<String, PlaybackError> {
        let notification_id = Uuid::new_v4().to_string();
        
        let (title, message) = if gained_focus {
            (
                "Focus Gained".to_string(),
                format!("{} is now in focus.", target_app.name)
            )
        } else {
            (
                "Focus Lost".to_string(),
                format!("{} lost focus.", target_app.name)
            )
        };

        let notification = Notification {
            id: notification_id.clone(),
            notification_type: NotificationType::FocusChanged,
            title,
            message,
            target_app_name: Some(target_app.name.clone()),
            target_app_id: Some(target_app.id.clone()),
            urgency: NotificationUrgency::Low,
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::milliseconds(1500)), // Short timeout for focus changes
            is_clickable: false,
            action_data: None,
        };

        self.display_notification(notification).await?;
        Ok(notification_id)
    }

    /// Displays a notification
    async fn display_notification(&self, notification: Notification) -> Result<(), PlaybackError> {
        // Check if we've reached the maximum number of active notifications
        {
            let mut active = self.active_notifications.lock().unwrap();
            if active.len() >= self.config.max_active_notifications {
                // Remove the oldest notification
                if let Some((oldest_id, _)) = active.iter().min_by_key(|(_, n)| n.created_at).map(|(id, n)| (id.clone(), n.clone())) {
                    active.remove(&oldest_id);
                    let _ = self.event_sender.send(NotificationEvent::NotificationExpired {
                        notification_id: oldest_id,
                    });
                }
            }
            
            active.insert(notification.id.clone(), notification.clone());
        }

        // Send notification displayed event
        self.event_sender.send(NotificationEvent::NotificationDisplayed {
            notification_id: notification.id.clone(),
            notification_type: notification.notification_type.clone(),
        }).map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to send notification event: {}", e)))?;

        // Schedule notification expiration if it has an expiration time
        if let Some(expires_at) = notification.expires_at {
            let notification_id = notification.id.clone();
            let active_notifications = Arc::clone(&self.active_notifications);
            let event_sender = self.event_sender.clone();
            
            tokio::spawn(async move {
                let now = Utc::now();
                if expires_at > now {
                    let duration = (expires_at - now).to_std().unwrap_or(std::time::Duration::from_secs(0));
                    tokio::time::sleep(duration).await;
                }
                
                // Remove the notification and send expiration event
                {
                    let mut active = active_notifications.lock().unwrap();
                    if active.remove(&notification_id).is_some() {
                        let _ = event_sender.send(NotificationEvent::NotificationExpired {
                            notification_id: notification_id.clone(),
                        });
                    }
                }
            });
        }

        Ok(())
    }

    /// Handles a notification click event
    pub async fn handle_notification_click(&self, notification_id: &str) -> Result<NotificationActionType, PlaybackError> {
        let notification = {
            let active = self.active_notifications.lock().unwrap();
            active.get(notification_id).cloned()
        };

        let notification = notification.ok_or_else(|| {
            PlaybackError::AutomationEngineError(format!("Notification {} not found", notification_id))
        })?;

        let action_type = notification.action_data
            .as_ref()
            .map(|data| data.action_type.clone())
            .unwrap_or(NotificationActionType::Dismiss);

        // Send notification clicked event
        self.event_sender.send(NotificationEvent::NotificationClicked {
            notification_id: notification_id.to_string(),
            action_type: action_type.clone(),
        }).map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to send click event: {}", e)))?;

        // Remove the notification after click (unless it's a dismiss action)
        if action_type != NotificationActionType::Dismiss {
            self.dismiss_notification(notification_id).await?;
        }

        Ok(action_type)
    }

    /// Dismisses a notification
    pub async fn dismiss_notification(&self, notification_id: &str) -> Result<(), PlaybackError> {
        let removed = {
            let mut active = self.active_notifications.lock().unwrap();
            active.remove(notification_id).is_some()
        };

        if removed {
            self.event_sender.send(NotificationEvent::NotificationDismissed {
                notification_id: notification_id.to_string(),
            }).map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to send dismiss event: {}", e)))?;
        }

        Ok(())
    }

    /// Gets all active notifications
    pub fn get_active_notifications(&self) -> Vec<Notification> {
        let active = self.active_notifications.lock().unwrap();
        active.values().cloned().collect()
    }

    /// Gets a specific notification by ID
    pub fn get_notification(&self, notification_id: &str) -> Option<Notification> {
        let active = self.active_notifications.lock().unwrap();
        active.get(notification_id).cloned()
    }

    /// Clears all active notifications
    pub async fn clear_all_notifications(&self) -> Result<(), PlaybackError> {
        let notification_ids: Vec<String> = {
            let active = self.active_notifications.lock().unwrap();
            active.keys().cloned().collect()
        };

        for notification_id in notification_ids {
            self.dismiss_notification(&notification_id).await?;
        }

        Ok(())
    }

    /// Gets the event receiver for listening to notification events
    pub fn take_event_receiver(&self) -> Option<mpsc::UnboundedReceiver<NotificationEvent>> {
        let mut receiver = self.event_receiver.lock().unwrap();
        receiver.take()
    }

    /// Updates the notification configuration
    pub fn update_config(&mut self, config: NotificationConfig) {
        self.config = config;
    }

    /// Gets the current notification configuration
    pub fn get_config(&self) -> &NotificationConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application_focused_automation::types::{ApplicationStatus, FocusLossStrategy};

    fn create_test_app() -> RegisteredApplication {
        RegisteredApplication {
            id: "test-app-1".to_string(),
            name: "Test Application".to_string(),
            executable_path: "/path/to/test.exe".to_string(),
            process_name: "test.exe".to_string(),
            bundle_id: Some("com.test.app".to_string()),
            process_id: Some(1234),
            window_handle: None,
            status: ApplicationStatus::Active,
            registered_at: Utc::now(),
            last_seen: Some(Utc::now()),
            default_focus_strategy: FocusLossStrategy::AutoPause,
        }
    }

    #[tokio::test]
    async fn test_notification_service_creation() {
        let service = NotificationService::with_default_config();
        assert_eq!(service.get_active_notifications().len(), 0);
    }

    #[tokio::test]
    async fn test_automation_paused_notification() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();
        let focus_event = FocusEvent::TargetProcessLostFocus {
            app_id: app.id.clone(),
            process_id: 1234,
            new_focused_app: Some("Other App".to_string()),
            timestamp: Utc::now(),
        };

        let notification_id = service.notify_automation_paused(&app, &focus_event).await.unwrap();
        
        let notifications = service.get_active_notifications();
        assert_eq!(notifications.len(), 1);
        
        let notification = service.get_notification(&notification_id).unwrap();
        assert_eq!(notification.notification_type, NotificationType::AutomationPaused);
        assert_eq!(notification.target_app_name, Some(app.name.clone()));
        assert!(notification.is_clickable);
        assert!(notification.message.contains(&app.name));
        assert!(notification.message.contains("Other App"));
    }

    #[tokio::test]
    async fn test_automation_resumed_notification() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();

        let notification_id = service.notify_automation_resumed(&app).await.unwrap();
        
        let notification = service.get_notification(&notification_id).unwrap();
        assert_eq!(notification.notification_type, NotificationType::AutomationResumed);
        assert_eq!(notification.target_app_name, Some(app.name.clone()));
        assert!(!notification.is_clickable);
        assert!(notification.message.contains(&app.name));
    }

    #[tokio::test]
    async fn test_application_error_notification() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();
        let error_message = "Application crashed";

        let notification_id = service.notify_application_error(&app, error_message).await.unwrap();
        
        let notification = service.get_notification(&notification_id).unwrap();
        assert_eq!(notification.notification_type, NotificationType::ApplicationError);
        assert_eq!(notification.urgency, NotificationUrgency::High);
        assert!(notification.is_clickable);
        assert!(notification.message.contains(&app.name));
        assert!(notification.message.contains(error_message));
    }

    #[tokio::test]
    async fn test_focus_changed_notification() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();

        // Test focus gained
        let notification_id = service.notify_focus_changed(&app, true).await.unwrap();
        let notification = service.get_notification(&notification_id).unwrap();
        assert_eq!(notification.notification_type, NotificationType::FocusChanged);
        assert!(notification.message.contains("now in focus"));

        // Test focus lost
        let notification_id = service.notify_focus_changed(&app, false).await.unwrap();
        let notification = service.get_notification(&notification_id).unwrap();
        assert!(notification.message.contains("lost focus"));
    }

    #[tokio::test]
    async fn test_notification_click_handling() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();
        let focus_event = FocusEvent::TargetProcessLostFocus {
            app_id: app.id.clone(),
            process_id: 1234,
            new_focused_app: None,
            timestamp: Utc::now(),
        };

        let notification_id = service.notify_automation_paused(&app, &focus_event).await.unwrap();
        
        let action_type = service.handle_notification_click(&notification_id).await.unwrap();
        assert_eq!(action_type, NotificationActionType::BringAppToFocus);
        
        // Notification should be dismissed after click
        assert!(service.get_notification(&notification_id).is_none());
    }

    #[tokio::test]
    async fn test_notification_dismissal() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();

        let notification_id = service.notify_automation_resumed(&app).await.unwrap();
        assert!(service.get_notification(&notification_id).is_some());
        
        service.dismiss_notification(&notification_id).await.unwrap();
        assert!(service.get_notification(&notification_id).is_none());
    }

    #[tokio::test]
    async fn test_max_notifications_limit() {
        let config = NotificationConfig {
            max_active_notifications: 2,
            ..Default::default()
        };
        let service = NotificationService::new(config);
        let app = create_test_app();

        // Add 3 notifications (should only keep 2)
        service.notify_automation_resumed(&app).await.unwrap();
        service.notify_automation_resumed(&app).await.unwrap();
        service.notify_automation_resumed(&app).await.unwrap();

        assert_eq!(service.get_active_notifications().len(), 2);
    }

    #[tokio::test]
    async fn test_clear_all_notifications() {
        let service = NotificationService::with_default_config();
        let app = create_test_app();

        service.notify_automation_resumed(&app).await.unwrap();
        service.notify_focus_changed(&app, true).await.unwrap();
        
        assert_eq!(service.get_active_notifications().len(), 2);
        
        service.clear_all_notifications().await.unwrap();
        assert_eq!(service.get_active_notifications().len(), 0);
    }
}
