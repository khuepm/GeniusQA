//! Application registry for managing registered applications

use crate::application_focused_automation::{
    error::RegistryError,
    types::{ApplicationInfo, ApplicationStatus, RegisteredApplication},
};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

/// Manages the registry of applications available for focused automation
pub struct ApplicationRegistry {
    applications: HashMap<String, RegisteredApplication>,
}

impl ApplicationRegistry {
    /// Create a new application registry
    pub fn new() -> Self {
        Self {
            applications: HashMap::new(),
        }
    }

    /// Register a new application for focused automation
    pub fn register_application(&mut self, app_info: ApplicationInfo) -> Result<String, RegistryError> {
        // Check if application is already registered by process name or bundle ID
        let existing = self.applications.values().find(|app| {
            app.process_name == app_info.process_name ||
            (app.bundle_id.is_some() && app.bundle_id == app_info.bundle_id)
        });

        if existing.is_some() {
            return Err(RegistryError::ApplicationAlreadyRegistered(app_info.name));
        }

        let app_id = Uuid::new_v4().to_string();
        let registered_app = RegisteredApplication {
            id: app_id.clone(),
            name: app_info.name,
            executable_path: app_info.executable_path,
            process_name: app_info.process_name,
            bundle_id: app_info.bundle_id,
            process_id: Some(app_info.process_id),
            window_handle: app_info.window_handle,
            status: ApplicationStatus::Active,
            registered_at: Utc::now(),
            last_seen: Some(Utc::now()),
            default_focus_strategy: Default::default(),
        };

        self.applications.insert(app_id.clone(), registered_app);
        Ok(app_id)
    }

    /// Unregister an application
    pub fn unregister_application(&mut self, app_id: &str) -> Result<(), RegistryError> {
        self.applications
            .remove(app_id)
            .ok_or_else(|| RegistryError::ApplicationNotFound(app_id.to_string()))?;
        Ok(())
    }

    /// Get all registered applications
    pub fn get_registered_applications(&self) -> Vec<RegisteredApplication> {
        self.applications.values().cloned().collect()
    }

    /// Get a specific registered application by ID
    pub fn get_application(&self, app_id: &str) -> Option<&RegisteredApplication> {
        self.applications.get(app_id)
    }

    /// Update the status of a registered application
    pub fn update_application_status(&mut self, app_id: &str, status: ApplicationStatus) -> Result<(), RegistryError> {
        let app = self.applications
            .get_mut(app_id)
            .ok_or_else(|| RegistryError::ApplicationNotFound(app_id.to_string()))?;
        
        app.status = status;
        if matches!(app.status, ApplicationStatus::Active) {
            app.last_seen = Some(Utc::now());
        }
        
        Ok(())
    }

    /// Update the process ID of a registered application
    pub fn update_process_id(&mut self, app_id: &str, process_id: u32) -> Result<(), RegistryError> {
        let app = self.applications
            .get_mut(app_id)
            .ok_or_else(|| RegistryError::ApplicationNotFound(app_id.to_string()))?;
        
        app.process_id = Some(process_id);
        Ok(())
    }

    /// Update a registered application
    pub fn update_application(&mut self, updated_app: RegisteredApplication) -> Result<(), RegistryError> {
        let app_id = updated_app.id.clone();
        if !self.applications.contains_key(&app_id) {
            return Err(RegistryError::ApplicationNotFound(app_id));
        }
        
        self.applications.insert(app_id, updated_app);
        Ok(())
    }

    /// Validate if an application is ready for automation
    pub fn validate_application_for_automation(&self, app_id: &str) -> Result<bool, RegistryError> {
        let app = self.applications
            .get(app_id)
            .ok_or_else(|| RegistryError::ApplicationNotFound(app_id.to_string()))?;
        
        match app.status {
            ApplicationStatus::Active => Ok(true),
            ApplicationStatus::Inactive => Ok(false),
            ApplicationStatus::NotFound => Ok(false),
            ApplicationStatus::Error(_) => Ok(false),
            ApplicationStatus::PermissionDenied => Ok(false),
            ApplicationStatus::SecureInputBlocked => Ok(false),
        }
    }

    /// Get the count of registered applications
    pub fn count(&self) -> usize {
        self.applications.len()
    }

    /// Check if an application is registered by ID
    pub fn is_application_registered(&self, app_id: &str) -> bool {
        self.applications.contains_key(app_id)
    }

    /// Find application by bundle ID (macOS)
    pub fn find_by_bundle_id(&self, bundle_id: &str) -> Option<&RegisteredApplication> {
        self.applications.values().find(|app| {
            app.bundle_id.as_ref().map_or(false, |id| id == bundle_id)
        })
    }
}
