//! Property tests for FocusLossStrategy enum serialization

use proptest::prelude::*;
use crate::application_focused_automation::types::FocusLossStrategy;

/// Property tests for FocusLossStrategy
#[cfg(test)]
pub mod focus_strategy_property_tests {
    use super::*;

    proptest! {
        /// Property 1: Focus strategy serialization round trip
        /// 
        /// This property test validates that:
        /// 1. All FocusLossStrategy enum variants can be serialized to JSON
        /// 2. Serialized JSON can be deserialized back to the original enum
        /// 3. The round trip preserves the exact enum variant
        /// 4. Serialization is consistent across multiple calls
        /// 
        /// Requirements validated: 1.6, 4.1
        #[test]
        fn property_focus_strategy_serialization_round_trip(
            strategy in prop_oneof![
                Just(FocusLossStrategy::AutoPause),
                Just(FocusLossStrategy::StrictError),
                Just(FocusLossStrategy::Ignore),
            ]
        ) {
            // Test serialization
            let serialized = serde_json::to_string(&strategy);
            prop_assert!(serialized.is_ok(), "FocusLossStrategy should serialize successfully: {:?}", strategy);
            
            let json_str = serialized.unwrap();
            prop_assert!(!json_str.is_empty(), "Serialized JSON should not be empty");
            
            // Test deserialization
            let deserialized: Result<FocusLossStrategy, _> = serde_json::from_str(&json_str);
            prop_assert!(deserialized.is_ok(), "Serialized JSON should deserialize successfully: {}", json_str);
            
            let recovered_strategy = deserialized.unwrap();
            prop_assert_eq!(recovered_strategy, strategy, "Round trip should preserve the exact enum variant");
            
            // Test consistency - multiple serializations should produce the same result
            let serialized2 = serde_json::to_string(&strategy).unwrap();
            prop_assert_eq!(json_str.clone(), serialized2, "Multiple serializations should be consistent");
            
            // Test that deserialization is also consistent
            let deserialized2: FocusLossStrategy = serde_json::from_str(&json_str).unwrap();
            prop_assert_eq!(recovered_strategy, deserialized2, "Multiple deserializations should be consistent");
        }
    }
}
