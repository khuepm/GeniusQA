use super::*;
use proptest::prelude::*;
use chrono::Utc;

// Property test for FocusLossStrategy enum serialization round trip
proptest! {
    #[test]
    fn focus_strategy_serialization_round_trip(strategy in focus_loss_strategy_arb()) {
        // Serialize to JSON
        let serialized = serde_json::to_string(&strategy).expect("Failed to serialize FocusLossStrategy");
        
        // Deserialize back from JSON
        let deserialized: FocusLossStrategy = serde_json::from_str(&serialized)
            .expect("Failed to deserialize FocusLossStrategy");
        
        // Assert they are equal
        prop_assert_eq!(strategy, deserialized);
    }
}

// Arbitrary generator for FocusLossStrategy
fn focus_loss_strategy_arb() -> impl Strategy<Value = FocusLossStrategy> {
    prop_oneof![
        Just(FocusLossStrategy::AutoPause),
        Just(FocusLossStrategy::StrictError),
        Just(FocusLossStrategy::Ignore),
    ]
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn focus_loss_strategy_default() {
        assert_eq!(FocusLossStrategy::default(), FocusLossStrategy::AutoPause);
    }

    #[test]
    fn application_status_equality() {
        assert_eq!(ApplicationStatus::Active, ApplicationStatus::Active);
        assert_eq!(ApplicationStatus::Inactive, ApplicationStatus::Inactive);
        assert_ne!(ApplicationStatus::Active, ApplicationStatus::Inactive);
    }

    #[test]
    fn registered_application_creation() {
        let app = RegisteredApplication::new(
            "Test App".to_string(),
            "/path/to/app".to_string(),
            "testapp".to_string(),
            Some("com.test.app".to_string()),
        );

        assert_eq!(app.name, "Test App");
        assert_eq!(app.executable_path, "/path/to/app");
        assert_eq!(app.process_name, "testapp");
        assert_eq!(app.bundle_id, Some("com.test.app".to_string()));
        assert_eq!(app.status, ApplicationStatus::Inactive);
        assert_eq!(app.default_focus_strategy, FocusLossStrategy::AutoPause);
        assert!(app.process_id.is_none());
        assert!(app.last_seen.is_none());
    }

    #[test]
    fn registered_application_update_status() {
        let mut app = RegisteredApplication::new(
            "Test App".to_string(),
            "/path/to/app".to_string(),
            "testapp".to_string(),
            None,
        );

        app.update_status(ApplicationStatus::Active);
        assert_eq!(app.status, ApplicationStatus::Active);
        assert!(app.last_seen.is_some());

        app.update_status(ApplicationStatus::Inactive);
        assert_eq!(app.status, ApplicationStatus::Inactive);
        // last_seen should remain set from when it was Active
        assert!(app.last_seen.is_some());
    }

    #[test]
    fn focus_state_creation() {
        let state = FocusState::new(true, Some(1234), Some("Test Window".to_string()));
        assert!(state.is_target_process_focused);
        assert_eq!(state.focused_process_id, Some(1234));
        assert_eq!(state.focused_window_title, Some("Test Window".to_string()));

        let unfocused = FocusState::unfocused();
        assert!(!unfocused.is_target_process_focused);
        assert!(unfocused.focused_process_id.is_none());
        assert!(unfocused.focused_window_title.is_none());
    }

    #[test]
    fn focus_event_timestamp() {
        let now = Utc::now();
        let event = FocusEvent::TargetProcessGainedFocus {
            app_id: "test-app".to_string(),
            process_id: 1234,
            window_title: "Test Window".to_string(),
            timestamp: now,
        };

        assert_eq!(event.timestamp(), now);
        assert_eq!(event.app_id(), Some("test-app"));
    }
}
