"""Tests for legacy script migration functionality."""

import pytest
from datetime import datetime
from .models import (
    ScriptFile, ScriptMetadata, Action,
    TestScript, TestStep, EnhancedScriptMetadata,
    migrate_legacy_script, is_legacy_format, load_script_with_migration
)


def test_migrate_simple_legacy_script():
    """Test migration of a simple legacy script."""
    # Create a legacy script
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=10.5,
        action_count=3,
        platform='darwin'
    )
    
    actions = [
        Action(type='mouse_move', timestamp=0.0, x=100, y=200),
        Action(type='mouse_click', timestamp=1.0, x=100, y=200, button='left'),
        Action(type='key_press', timestamp=2.0, key='a')
    ]
    
    legacy_script = ScriptFile(
        metadata=metadata,
        actions=actions,
        variables={'username': 'test'}
    )
    
    # Migrate to new format
    migrated_script, success = migrate_legacy_script(legacy_script)
    
    # Verify migration succeeded
    assert success is True
    
    # Verify metadata was enhanced
    assert migrated_script.meta.version == "2.0"
    assert migrated_script.meta.title == "Migrated Script"
    assert migrated_script.meta.description == "Automatically migrated from legacy format"
    assert migrated_script.meta.created_at == metadata.created_at
    assert migrated_script.meta.duration == metadata.duration
    assert migrated_script.meta.action_count == metadata.action_count
    assert migrated_script.meta.platform == metadata.platform
    assert "migrated" in migrated_script.meta.tags
    assert "legacy" in migrated_script.meta.tags
    
    # Verify single default step was created
    assert len(migrated_script.steps) == 1
    step = migrated_script.steps[0]
    assert step.order == 1
    assert step.description == "Legacy Import - Migrated Actions"
    assert step.expected_result == "All actions execute successfully"
    assert len(step.action_ids) == 3
    
    # Verify action pool contains all actions
    assert len(migrated_script.action_pool) == 3
    
    # Verify all actions are preserved
    migrated_actions = [migrated_script.action_pool[aid] for aid in step.action_ids]
    for original, migrated in zip(actions, migrated_actions):
        assert migrated.type == original.type
        assert migrated.timestamp == original.timestamp
        assert migrated.x == original.x
        assert migrated.y == original.y
        assert migrated.button == original.button
        assert migrated.key == original.key
    
    # Verify variables are preserved
    assert migrated_script.variables == legacy_script.variables


def test_migrate_empty_legacy_script():
    """Test migration of an empty legacy script."""
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=0.0,
        action_count=0,
        platform='darwin'
    )
    
    legacy_script = ScriptFile(
        metadata=metadata,
        actions=[],
        variables={}
    )
    
    migrated_script, success = migrate_legacy_script(legacy_script)
    
    assert success is True
    assert len(migrated_script.steps) == 1
    assert len(migrated_script.steps[0].action_ids) == 0
    assert len(migrated_script.action_pool) == 0


def test_is_legacy_format():
    """Test legacy format detection."""
    # Legacy format data
    legacy_data = {
        "metadata": {
            "version": "1.0",
            "created_at": "2024-01-01T12:00:00",
            "duration": 10.0,
            "action_count": 2,
            "platform": "darwin"
        },
        "actions": [
            {"type": "mouse_move", "timestamp": 0.0, "x": 100, "y": 200}
        ]
    }
    
    # New format data
    new_data = {
        "meta": {
            "version": "2.0",
            "created_at": "2024-01-01T12:00:00",
            "duration": 10.0,
            "action_count": 2,
            "platform": "darwin",
            "title": "Test Script"
        },
        "steps": [
            {
                "id": "step-001",
                "order": 1,
                "description": "Test step",
                "expected_result": "",
                "action_ids": ["action-001"]
            }
        ],
        "action_pool": {
            "action-001": {"type": "mouse_move", "timestamp": 0.0, "x": 100, "y": 200}
        }
    }
    
    assert is_legacy_format(legacy_data) is True
    assert is_legacy_format(new_data) is False


def test_load_script_with_migration_legacy():
    """Test loading legacy script with automatic migration."""
    legacy_data = {
        "metadata": {
            "version": "1.0",
            "created_at": "2024-01-01T12:00:00",
            "duration": 10.0,
            "action_count": 1,
            "platform": "darwin"
        },
        "actions": [
            {"type": "mouse_move", "timestamp": 0.0, "x": 100, "y": 200}
        ],
        "variables": {"test": "value"}
    }
    
    script, was_migrated, success = load_script_with_migration(legacy_data)
    
    assert success is True
    assert was_migrated is True
    assert script.meta.version == "2.0"
    assert len(script.steps) == 1
    assert len(script.action_pool) == 1
    assert script.variables == {"test": "value"}


def test_load_script_with_migration_new():
    """Test loading new format script without migration."""
    new_data = {
        "meta": {
            "version": "2.0",
            "created_at": "2024-01-01T12:00:00",
            "duration": 10.0,
            "action_count": 1,
            "platform": "darwin",
            "title": "Test Script"
        },
        "steps": [
            {
                "id": "step-001",
                "order": 1,
                "description": "Test step",
                "expected_result": "",
                "action_ids": ["action-001"]
            }
        ],
        "action_pool": {
            "action-001": {"type": "mouse_move", "timestamp": 0.0, "x": 100, "y": 200}
        },
        "variables": {}
    }
    
    script, was_migrated, success = load_script_with_migration(new_data)
    
    assert success is True
    assert was_migrated is False
    assert script.meta.version == "2.0"
    assert script.meta.title == "Test Script"
    assert len(script.steps) == 1
    assert len(script.action_pool) == 1


def test_migration_preserves_action_order():
    """Test that migration preserves the chronological order of actions."""
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=5.0,
        action_count=5,
        platform='darwin'
    )
    
    # Create actions with specific timestamps
    actions = [
        Action(type='mouse_move', timestamp=0.0, x=100, y=100),
        Action(type='mouse_click', timestamp=1.0, x=100, y=100, button='left'),
        Action(type='key_press', timestamp=2.0, key='h'),
        Action(type='key_press', timestamp=3.0, key='i'),
        Action(type='key_release', timestamp=4.0, key='i')
    ]
    
    legacy_script = ScriptFile(metadata=metadata, actions=actions)
    migrated_script, success = migrate_legacy_script(legacy_script)
    
    assert success is True
    
    # Verify actions are in the same order
    step = migrated_script.steps[0]
    migrated_actions = [migrated_script.action_pool[aid] for aid in step.action_ids]
    
    for i, (original, migrated) in enumerate(zip(actions, migrated_actions)):
        assert migrated.timestamp == original.timestamp, f"Action {i} timestamp mismatch"
        assert migrated.type == original.type, f"Action {i} type mismatch"
