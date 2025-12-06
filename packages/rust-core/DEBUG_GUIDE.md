# Playback Debug and Diagnostic Guide

This guide explains how to use the debugging and diagnostic tools for playback functionality in the Rust automation core.

## Debug Mode

Debug mode provides verbose logging, action-by-action confirmation, and timing diagnostics during playback.

### Enabling Debug Mode

```rust
use rust_automation_core::config::{AutomationConfig, DebugConfig};

let mut config = AutomationConfig::default();
config.debug_config = DebugConfig {
    enabled: true,
    action_confirmation: false,  // Set to true for manual confirmation
    pause_between_actions_ms: 500,  // Pause 500ms between actions
    log_level: "debug".to_string(),
    timing_diagnostics: true,
    platform_diagnostics: true,
    system_info_logging: true,
};
```

### Debug Features

1. **Verbose Logging**: Detailed logs for every action and operation
2. **Action Confirmation**: Pause before each action for manual review
3. **Pause Between Actions**: Add delays between actions for observation
4. **Timing Diagnostics**: Track timing accuracy and drift
5. **Platform Diagnostics**: Detect platform capabilities
6. **System Info Logging**: Log system information

## Script Verification

Verify a script before playback to catch potential issues.

```rust
use rust_automation_core::debug::ScriptVerifier;
use rust_automation_core::ScriptData;

// Load your script
let script = ScriptData::load_from_file("path/to/script.json")?;

// Verify the script
let verification = ScriptVerifier::verify_script(&script)?;

if verification.is_valid {
    println!("Script is valid!");
    println!("Total actions: {}", verification.total_actions);
    println!("Supported actions: {}", verification.supported_actions);
    println!("Estimated duration: {:.2}s", verification.estimated_duration_seconds);
} else {
    println!("Script has errors:");
    for error in &verification.errors {
        println!("  - {}", error);
    }
}

if !verification.warnings.is_empty() {
    println!("Warnings:");
    for warning in &verification.warnings {
        println!("  - {}", warning);
    }
}
```

## Dry-Run Mode

Simulate playback without executing actions to preview what would happen.

```rust
use rust_automation_core::debug::ScriptVerifier;

// Perform a dry-run
let dry_run = ScriptVerifier::dry_run(&script)?;

println!("Dry-run simulation:");
println!("Total actions: {}", dry_run.total_actions);
println!("Estimated duration: {:.2}s", dry_run.estimated_duration_seconds);

for action in &dry_run.simulated_actions {
    if action.would_execute {
        println!("  ✓ Action {}: {} at {:.2}s", 
            action.index, action.action_type, action.timestamp);
    } else {
        println!("  ✗ Action {}: {} - {}", 
            action.index, action.action_type, 
            action.reason.as_ref().unwrap_or(&"Unknown".to_string()));
    }
}

if !dry_run.potential_issues.is_empty() {
    println!("\nPotential issues:");
    for issue in &dry_run.potential_issues {
        println!("  - {}", issue);
    }
}
```

## Script Analysis

Analyze a script for potential problems.

```rust
use rust_automation_core::debug::ScriptVerifier;

let issues = ScriptVerifier::analyze_script(&script);

if issues.is_empty() {
    println!("No issues found!");
} else {
    println!("Found {} potential issues:", issues.len());
    for issue in &issues {
        println!("  - {}", issue);
    }
}
```

## Platform Diagnostics

Detect platform capabilities and collect system information.

```rust
use rust_automation_core::debug::PlatformDiagnostics;

// Detect platform capabilities
let capabilities = PlatformDiagnostics::detect_capabilities();

println!("Platform: {}", capabilities.platform);
println!("Mouse control: {}", capabilities.mouse_control);
println!("Keyboard control: {}", capabilities.keyboard_control);
println!("Screen capture: {}", capabilities.screen_capture);
println!("Permissions granted: {}", capabilities.permissions_granted);

if let Some(display_server) = &capabilities.display_server {
    println!("Display server: {}", display_server);
}

// Collect system information
let system_info = PlatformDiagnostics::collect_system_info();

println!("\nSystem Information:");
println!("OS: {} {}", system_info.os, system_info.os_version);
println!("Architecture: {}", system_info.architecture);
println!("Hostname: {}", system_info.hostname);
println!("Rust version: {}", system_info.rust_version);
println!("Core version: {}", system_info.core_version);
```

## Diagnostic Report

Generate a comprehensive diagnostic report.

```rust
use rust_automation_core::debug::PlatformDiagnostics;

// Generate diagnostic report
let report = PlatformDiagnostics::generate_diagnostic_report(
    Some(&script),
    vec![], // timing diagnostics (collected during playback)
)?;

// Log the report
PlatformDiagnostics::log_diagnostic_report(&report);

// Or serialize to JSON
let json = serde_json::to_string_pretty(&report)?;
println!("{}", json);
```

## Debug Controller

Use the debug controller during playback for advanced debugging.

```rust
use rust_automation_core::debug::DebugController;
use rust_automation_core::config::DebugConfig;

let debug_config = DebugConfig {
    enabled: true,
    timing_diagnostics: true,
    ..Default::default()
};

let mut debug_controller = DebugController::new(debug_config);

// During playback, record timing diagnostics
debug_controller.record_timing_diagnostic(
    0,  // action index
    100.0,  // expected delay ms
    105.0,  // actual delay ms
    50.0,  // execution time ms
);

// Get timing diagnostics
let diagnostics = debug_controller.get_timing_diagnostics();
for diag in diagnostics {
    println!("Action {}: drift={:.2}ms ({:.1}%)", 
        diag.action_index, 
        diag.timing_drift_ms, 
        diag.drift_percentage);
}
```

## Complete Example

Here's a complete example that uses all the debugging features:

```rust
use rust_automation_core::{
    AutomationCore,
    config::{AutomationConfig, DebugConfig},
    debug::{ScriptVerifier, PlatformDiagnostics, DebugController},
    ScriptData,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configure debug mode
    let mut config = AutomationConfig::default();
    config.debug_config = DebugConfig {
        enabled: true,
        action_confirmation: false,
        pause_between_actions_ms: 500,
        log_level: "debug".to_string(),
        timing_diagnostics: true,
        platform_diagnostics: true,
        system_info_logging: true,
    };

    // Load script
    let script = ScriptData::load_from_file("test_script.json")?;

    // Step 1: Verify script
    println!("=== Script Verification ===");
    let verification = ScriptVerifier::verify_script(&script)?;
    if !verification.is_valid {
        println!("Script validation failed!");
        for error in &verification.errors {
            println!("  Error: {}", error);
        }
        return Ok(());
    }
    println!("✓ Script is valid");

    // Step 2: Analyze script
    println!("\n=== Script Analysis ===");
    let issues = ScriptVerifier::analyze_script(&script);
    if !issues.is_empty() {
        println!("Found {} potential issues:", issues.len());
        for issue in &issues {
            println!("  - {}", issue);
        }
    } else {
        println!("✓ No issues found");
    }

    // Step 3: Dry-run
    println!("\n=== Dry-Run Simulation ===");
    let dry_run = ScriptVerifier::dry_run(&script)?;
    println!("Would execute {} actions in {:.2}s", 
        dry_run.simulated_actions.iter().filter(|a| a.would_execute).count(),
        dry_run.estimated_duration_seconds);

    // Step 4: Platform diagnostics
    println!("\n=== Platform Diagnostics ===");
    let capabilities = PlatformDiagnostics::detect_capabilities();
    println!("Platform: {}", capabilities.platform);
    println!("Mouse control: {}", capabilities.mouse_control);
    println!("Keyboard control: {}", capabilities.keyboard_control);

    // Step 5: Generate diagnostic report
    println!("\n=== Diagnostic Report ===");
    let report = PlatformDiagnostics::generate_diagnostic_report(
        Some(&script),
        vec![],
    )?;
    PlatformDiagnostics::log_diagnostic_report(&report);

    // Step 6: Execute playback with debug mode
    println!("\n=== Starting Playback ===");
    let core = AutomationCore::new(config)?;
    // ... execute playback ...

    Ok(())
}
```

## Troubleshooting

### Common Issues

1. **Script validation fails**: Check that all required fields are present and timestamps are in order
2. **Timing drift warnings**: System may be under load, consider adjusting playback speed
3. **Permission errors**: Ensure accessibility permissions are granted on macOS/Linux
4. **Display server not detected**: Set DISPLAY or WAYLAND_DISPLAY environment variables on Linux

### Debug Log Levels

- `trace`: Most verbose, logs every operation
- `debug`: Detailed debugging information
- `info`: General information about playback progress
- `warn`: Warnings about potential issues
- `error`: Errors that occurred during playback

### Performance Impact

Debug mode adds overhead to playback:
- Verbose logging: ~5-10% slower
- Action confirmation: Pauses playback for user input
- Timing diagnostics: ~1-2% slower
- Platform diagnostics: One-time cost at startup

For production use, disable debug mode to maximize performance.
