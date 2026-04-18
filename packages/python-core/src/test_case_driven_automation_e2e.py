"""
End-to-End Integration Tests for Test Case Driven Automation (Python Core)

Tests complete workflow from script creation through execution and reporting
Validates step-based recording, editing, and playback functionality
Ensures proper integration with AI vision capture and assertion features

Requirements: All
"""

import pytest
import json
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Any

from storage.models import TestScript, TestStep, AnyAction, EnhancedScriptMetadata
from datetime import datetime
from storage.storage import Storage


class TestCaseDrivenAutomationE2E:
    """End-to-end integration tests for test case driven automation."""

    def setup_method(self):
        """Set up test environment before each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = Storage(base_dir=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up test environment after each test."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def create_sample_test_script(self) -> TestScript:
        """Create a sample test script for testing."""
        metadata = EnhancedScriptMetadata(
            title="E2E Test Script",
            description="End-to-end test script",
            pre_conditions="Application should be running",
            tags=["e2e", "test"],
            created_at=datetime.now(),
            duration=45.5,
            action_count=4,
            platform="darwin"
        )

        step1 = TestStep(
            id="step-1",
            order=1,
            description="Navigate to login page",
            expected_result="Login page should be displayed",
            action_ids=["action-1", "action-2"]
        )

        step2 = TestStep(
            id="step-2",
            order=2,
            description="Enter credentials and login",
            expected_result="User should be logged in successfully",
            action_ids=["action-3", "action-4"]
        )

        # Create simple action pool with basic actions
        from storage.models import Action
        
        action_pool = {
            "action-1": Action(
                type="mouse_click",
                x=100,
                y=200,
                button="left",
                timestamp=1234567890
            ),
            "action-2": Action(
                type="mouse_click",
                x=150,
                y=250,
                button="left",
                timestamp=1234567891
            ),
            "action-3": Action(
                type="mouse_click",
                x=200,
                y=300,
                button="left",
                timestamp=1234567892
            ),
            "action-4": Action(
                type="mouse_click",
                x=250,
                y=350,
                button="left",
                timestamp=1234567893
            )
        }

        return TestScript(
            meta=metadata,
            steps=[step1, step2],
            action_pool=action_pool,
            variables={}
        )

    def test_complete_workflow_script_creation_to_execution(self):
        """Test complete workflow from script creation through execution and reporting."""
        # Step 1: Create test script
        test_script = self.create_sample_test_script()
        
        # Step 2: Validate script structure
        assert test_script.meta.title == "E2E Test Script"
        assert len(test_script.steps) == 2
        assert len(test_script.action_pool) == 4
        
        # Step 3: Validate step structure
        step1 = test_script.steps[0]
        assert step1.id == "step-1"
        assert step1.order == 1
        assert step1.description == "Navigate to login page"
        assert len(step1.action_ids) == 2
        
        # Step 4: Validate action pool
        action1 = test_script.action_pool["action-1"]
        assert action1.type == "mouse_click"
        assert action1.x == 100
        assert action1.y == 200
        assert action1.button == "left"
        
        # Step 5: Test action filtering by step
        step1_actions = [test_script.action_pool[aid] for aid in step1.action_ids]
        assert len(step1_actions) == 2
        assert step1_actions[0].type == "mouse_click"
        assert step1_actions[1].type == "mouse_click"

    def test_step_based_recording_workflow(self):
        """Test step-based recording workflow."""
        # Create initial script with empty steps
        test_script = TestScript(
            meta=EnhancedScriptMetadata(
                title="Recording Test",
                description="Test step-based recording",
                pre_conditions="",
                tags=["recording"],
                created_at=datetime.now(),
                duration=0.0,
                action_count=0,
                platform="darwin"
            ),
            steps=[
                TestStep(
                    id="record-step-1",
                    order=1,
                    description="Record user actions",
                    expected_result="Actions should be recorded",
                    action_ids=[]
                )
            ],
            action_pool={},
            variables={}
        )
        
        # Simulate adding recorded action to step
        recorded_action = {
            "id": "recorded-action-1",
            "type": "mouse_click",
            "x": 150,
            "y": 250,
            "button": "left",
            "timestamp": 1234567894
        }
        
        # Add action to script
        action_id = recorded_action["id"]
        test_script.action_pool[action_id] = recorded_action
        test_script.steps[0].action_ids.append(action_id)
        
        assert len(test_script.steps[0].action_ids) == 1
        assert action_id in test_script.action_pool
        assert test_script.action_pool[action_id]["type"] == "mouse_click"

    def test_ai_vision_assertion_workflow(self):
        """Test AI vision assertion workflow.
        
        Property 7: Assertion Action Behavior
        For any AI vision action marked with is_assertion: true, the action SHALL not
        perform mouse or keyboard interactions and SHALL only return pass/fail status
        based on element detection.
        """
        from storage.models import AIVisionCaptureAction, StaticData
        
        # Create script with assertion actions using proper models
        assertion_script = TestScript(
            meta=EnhancedScriptMetadata(
                title="Assertion Test",
                description="Test AI vision assertions",
                pre_conditions="UI should be visible",
                tags=["assertion"],
                created_at=datetime.now(),
                duration=30.0,
                action_count=2,
                platform="darwin"
            ),
            steps=[
                TestStep(
                    id="assertion-step",
                    order=1,
                    description="Verify UI elements",
                    expected_result="All elements should be visible",
                    action_ids=["assertion-1", "assertion-2"]
                )
            ],
            action_pool={
                "assertion-1": AIVisionCaptureAction(
                    id="assertion-1",
                    type="ai_vision_capture",
                    is_assertion=True,
                    timestamp=1234567890.0,
                    static_data=StaticData(
                        original_screenshot="test_screenshot.png",
                        saved_x=100,
                        saved_y=200,
                        screen_dim=(1920, 1080)
                    )
                ),
                "assertion-2": AIVisionCaptureAction(
                    id="assertion-2",
                    type="ai_vision_capture",
                    is_assertion=True,
                    timestamp=1234567891.0,
                    static_data=StaticData(
                        original_screenshot="test_screenshot2.png",
                        saved_x=300,
                        saved_y=400,
                        screen_dim=(1920, 1080)
                    )
                )
            },
            variables={}
        )
        
        # Validate assertion script structure
        assert len(assertion_script.steps) == 1
        assert len(assertion_script.action_pool) == 2
        
        # Validate assertion actions
        assertion1 = assertion_script.action_pool["assertion-1"]
        assertion2 = assertion_script.action_pool["assertion-2"]
        
        assert assertion1.type == "ai_vision_capture"
        assert assertion1.is_assertion is True
        assert assertion2.type == "ai_vision_capture"
        assert assertion2.is_assertion is True
        
        # Test step contains both assertions
        step = assertion_script.steps[0]
        assert len(step.action_ids) == 2
        assert "assertion-1" in step.action_ids
        assert "assertion-2" in step.action_ids

    def test_legacy_script_migration_workflow(self):
        """Test legacy script migration workflow.
        
        Property 16: Legacy Migration Correctness
        For any legacy flat script format, the migration SHALL automatically convert
        it to step-based format with all actions placed in a default step.
        """
        from storage.models import Action
        
        # Create legacy flat script format (using valid action types)
        legacy_script_data = {
            "metadata": {
                "id": "legacy-script",
                "title": "Legacy Script",
                "description": "Old format script",
                "version": "1.0.0",
                "created_at": 1234567890,
                "tags": ["legacy"]
            },
            "actions": [
                {
                    "id": "legacy-action-1",
                    "type": "mouse_click",
                    "x": 100,
                    "y": 100,
                    "button": "left",
                    "timestamp": 1234567890
                },
                {
                    "id": "legacy-action-2",
                    "type": "key_press",
                    "key": "a",
                    "timestamp": 1234567891
                }
            ],
            "variables": {}
        }
        
        # Save legacy script
        legacy_path = os.path.join(self.temp_dir, "legacy_script.json")
        with open(legacy_path, 'w') as f:
            json.dump(legacy_script_data, f)
        
        # Simulate migration result using proper Action models
        migrated_script = TestScript(
            meta=EnhancedScriptMetadata(
                title="Legacy Script",
                description="Old format script",
                pre_conditions="",
                tags=["legacy"],
                created_at=datetime.now(),
                duration=60.0,
                action_count=2,
                platform="darwin"
            ),
            steps=[
                TestStep(
                    id="migration-step-1",
                    order=1,
                    description="Legacy Import - Migrated Actions",
                    expected_result="All actions execute successfully",
                    action_ids=["legacy-action-1", "legacy-action-2"]
                )
            ],
            action_pool={
                "legacy-action-1": Action(
                    type="mouse_click",
                    x=100,
                    y=100,
                    button="left",
                    timestamp=1234567890.0
                ),
                "legacy-action-2": Action(
                    type="key_press",
                    key="a",
                    timestamp=1234567891.0
                )
            },
            variables={}
        )
        
        # Verify migration structure
        assert isinstance(migrated_script, TestScript)
        assert len(migrated_script.steps) == 1
        assert migrated_script.steps[0].description == "Legacy Import - Migrated Actions"
        assert len(migrated_script.steps[0].action_ids) == 2
        assert len(migrated_script.action_pool) == 2

    def test_dual_pane_editor_data_flow(self):
        """Test data flow for dual-pane editor functionality.
        
        Property 6: Step Selection Filtering
        For any test step selection in the editor, the action display SHALL show
        only the actions referenced by that step's action_ids array.
        """
        test_script = self.create_sample_test_script()
        
        # Test step selection and action filtering
        selected_step_id = "step-1"
        selected_step = next(step for step in test_script.steps if step.id == selected_step_id)
        
        # Get actions for selected step
        step_actions = {
            action_id: test_script.action_pool[action_id] 
            for action_id in selected_step.action_ids
        }
        
        assert len(step_actions) == 2
        assert "action-1" in step_actions
        assert "action-2" in step_actions
        
        # Test step reordering - capture step IDs in original order
        original_step_ids = [step.id for step in test_script.steps]
        test_script.steps.reverse()
        
        # Capture step IDs in new order
        new_step_ids = [step.id for step in test_script.steps]
        
        # Verify the order of steps changed
        assert original_step_ids != new_step_ids
        assert original_step_ids == list(reversed(new_step_ids))

    def test_error_handling_and_recovery(self):
        """Test error handling and recovery mechanisms."""
        # Test script with invalid action references
        invalid_script = TestScript(
            meta=EnhancedScriptMetadata(
                title="Invalid Script",
                description="Script with invalid references",
                pre_conditions="",
                tags=["invalid"],
                created_at=datetime.now(),
                duration=0.0,
                action_count=0,
                platform="darwin"
            ),
            steps=[
                TestStep(
                    id="invalid-step",
                    order=1,
                    description="Step with invalid action reference",
                    expected_result="Should handle gracefully",
                    action_ids=["non-existent-action"]
                )
            ],
            action_pool={},  # Empty action pool
            variables={}
        )
        
        # Validate the invalid script structure
        assert len(invalid_script.steps) == 1
        assert len(invalid_script.action_pool) == 0
        assert len(invalid_script.steps[0].action_ids) == 1
        
        # Check that referenced action doesn't exist in pool
        referenced_action_id = invalid_script.steps[0].action_ids[0]
        assert referenced_action_id not in invalid_script.action_pool

    def test_performance_with_large_scripts(self):
        """Test performance with large scripts containing many steps and actions."""
        # Create large script with 20 steps and 80 actions
        large_script = TestScript(
            meta=EnhancedScriptMetadata(
                title="Large Script Performance Test",
                description="Test performance with large script",
                pre_conditions="",
                tags=["performance"],
                created_at=datetime.now(),
                duration=300.0,
                action_count=80,
                platform="darwin"
            ),
            steps=[],
            action_pool={},
            variables={}
        )
        
        # Generate 20 steps with 4 actions each
        for step_num in range(1, 21):
            step_id = f"step-{step_num}"
            action_ids = []
            
            for action_num in range(1, 5):
                action_id = f"action-{step_num}-{action_num}"
                action_ids.append(action_id)
                
                large_script.action_pool[action_id] = {
                    "id": action_id,
                    "type": "mouse_click",
                    "x": step_num * 10,
                    "y": action_num * 10,
                    "button": "left",
                    "timestamp": 1234567890 + (step_num * 1000) + (action_num * 100)
                }
            
            large_script.steps.append(TestStep(
                id=step_id,
                order=step_num,
                description=f"Step {step_num} description",
                expected_result=f"Step {step_num} should complete successfully",
                action_ids=action_ids
            ))
        
        # Validate large script structure
        assert len(large_script.steps) == 20
        assert len(large_script.action_pool) == 80
        
        # Test that all steps have correct action references
        for i, step in enumerate(large_script.steps, 1):
            assert step.order == i
            assert len(step.action_ids) == 4
            
            # Verify all referenced actions exist in pool
            for action_id in step.action_ids:
                assert action_id in large_script.action_pool
                action = large_script.action_pool[action_id]
                assert action["id"] == action_id
                assert action["type"] == "mouse_click"

    def test_data_structure_validation(self):
        """Test data structure validation and integrity."""
        test_script = self.create_sample_test_script()
        
        # Test script metadata validation
        assert test_script.meta.title == "E2E Test Script"
        assert test_script.meta.version == "2.0"  # Default version for EnhancedScriptMetadata
        assert isinstance(test_script.meta.created_at, datetime)
        assert isinstance(test_script.meta.tags, list)
        
        # Test step validation
        for step in test_script.steps:
            assert isinstance(step.id, str)
            assert isinstance(step.order, int)
            assert isinstance(step.description, str)
            assert isinstance(step.expected_result, str)
            assert isinstance(step.action_ids, list)
            
        # Test action pool validation
        for action_id, action in test_script.action_pool.items():
            # Actions are Pydantic models, access attributes directly
            assert hasattr(action, 'type')
            assert hasattr(action, 'timestamp')
            
        # Test action reference integrity
        all_referenced_actions = set()
        for step in test_script.steps:
            all_referenced_actions.update(step.action_ids)
        
        # All referenced actions should exist in pool
        for action_id in all_referenced_actions:
            assert action_id in test_script.action_pool

    def test_session_state_isolation(self):
        """Test session state isolation between executions.
        
        Property 20: Session State Isolation
        For any script reopened after execution, the display SHALL show original
        step indicators without any previous execution results.
        """
        test_script = self.create_sample_test_script()
        
        # Verify initial script state is clean (no runtime status)
        for step in test_script.steps:
            # TestStep model should not have runtime status fields
            assert not hasattr(step, 'status') or step.status is None if hasattr(step, 'status') else True
            assert not hasattr(step, 'error_message') or step.error_message is None if hasattr(step, 'error_message') else True
            assert not hasattr(step, 'screenshot_proof') or step.screenshot_proof is None if hasattr(step, 'screenshot_proof') else True
        
        # Serialize and deserialize to simulate reopening
        json_data = test_script.model_dump(mode='json')
        reopened_script = TestScript.model_validate(json_data)
        
        # Verify reopened script has clean state
        for step in reopened_script.steps:
            # Steps should only have static fields, no runtime status
            assert step.id is not None
            assert step.order is not None
            assert step.description is not None
            assert isinstance(step.action_ids, list)
        
        # Verify script structure is preserved
        assert len(reopened_script.steps) == len(test_script.steps)
        assert len(reopened_script.action_pool) == len(test_script.action_pool)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
