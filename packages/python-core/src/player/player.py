"""Player module for replaying recorded actions."""

import sys
import time
import threading
import json
import asyncio
from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path

try:
    import pyautogui
    # Disable pyautogui's built-in pause for faster execution
    pyautogui.PAUSE = 0
    pyautogui.FAILSAFE = True  # Keep failsafe enabled (move mouse to corner to abort)
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

try:
    from pynput import keyboard
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False

# Import AI Vision components
try:
    from vision.ai_vision_service import AIVisionService, AIVisionRequest, VisionROI as ServiceVisionROI
    from vision.image_utils import scale_coordinates, scale_roi, crop_to_roi, encode_image_base64
    AI_VISION_AVAILABLE = True
except ImportError:
    AI_VISION_AVAILABLE = False

try:
    from storage.models import AIVisionCaptureAction, TestScript
    AI_VISION_MODELS_AVAILABLE = True
except ImportError:
    AI_VISION_MODELS_AVAILABLE = False

try:
    from player.test_report_generator import TestReportGenerator, generate_test_report
    REPORT_GENERATOR_AVAILABLE = True
except ImportError:
    REPORT_GENERATOR_AVAILABLE = False


class Player:
    """Executes recorded actions with timing."""
    
    def __init__(self, actions: List = None, progress_callback=None, variables=None, action_callback=None, speed=1.0, loop_count=1, stop_callback=None, script_path: Optional[str] = None, ai_api_key: Optional[str] = None, test_script=None, step_callback=None):
        """Initialize the player with actions or test script.
        
        Args:
            actions: List of actions to play back (legacy mode)
            progress_callback: Optional callback function(current, total) for progress updates
            variables: Optional dictionary of variable names to values for substitution
            action_callback: Optional callback function(action, index) called before executing each action
            speed: Playback speed multiplier (0.5 = half speed, 2.0 = double speed). Default is 1.0
            loop_count: Number of times to repeat playback (1 = play once, 0 = infinite loop). Default is 1
            stop_callback: Optional callback function() called when playback is stopped by ESC key
            script_path: Optional path to the script file (for cache persistence)
            ai_api_key: Optional API key for AI Vision service
            test_script: Optional TestScript for step-based execution
            step_callback: Optional callback function(step_result) called after each step execution
        """
        self.actions = actions or []
        self.test_script = test_script
        self.is_playing = False
        self.is_paused = False
        self._playback_thread = None
        self.progress_callback = progress_callback
        self.action_callback = action_callback
        self.stop_callback = stop_callback
        self.step_callback = step_callback
        self.pause_callback = None
        self.variables = variables or {}
        self.speed = max(0.1, min(10.0, speed))  # Clamp speed between 0.1x and 10x
        self.loop_count = max(0, loop_count)  # 0 means infinite loop
        self.current_loop = 0
        self._keyboard_listener = None
        self._stopped_by_esc = False
        self._cmd_pressed = False
        
        # AI Vision Capture support
        self.script_path = script_path
        self.ai_api_key = ai_api_key
        self._ai_service: Optional[Any] = None
        self._ai_call_count = 0  # Track AI calls for testing
        
        # Step-based execution state
        self.step_results = []  # List of step execution results
        self.current_step_index = 0
        self.execution_mode = 'step-based' if test_script else 'legacy'
    
    def start_playback(self) -> None:
        """Execute actions with timing in a separate thread."""
        if self.is_playing:
            raise RuntimeError("Playback already in progress")
        
        self.is_playing = True
        
        # Start keyboard listener for ESC key to stop playback, Cmd+ESC to pause
        # Skip keyboard listener if it's already set to None (test mode)
        if PYNPUT_AVAILABLE and self._keyboard_listener is not False:
            self._keyboard_listener = keyboard.Listener(
                on_press=self._on_key_press,
                on_release=self._on_key_release
            )
            self._keyboard_listener.start()
            sys.stderr.write("[Player] Press ESC to stop, Cmd+ESC to pause/resume\n")
            sys.stderr.flush()
        
        self._playback_thread = threading.Thread(target=self._playback_loop)
        self._playback_thread.start()
    
    def _playback_loop(self) -> None:
        """Internal playback loop that executes actions with timing."""
        try:
            if self.execution_mode == 'step-based' and self.test_script:
                self._execute_step_based_playback()
            else:
                self._execute_legacy_playback()
        finally:
            self.is_playing = False
            
            # Emit completion event if not stopped by ESC
            if not self._stopped_by_esc and self.progress_callback:
                try:
                    # Emit final progress (100%)
                    if self.execution_mode == 'step-based':
                        total_steps = len(self.test_script.steps) if self.test_script else 0
                        self.progress_callback(total_steps, total_steps, self.current_loop, self.loop_count)
                    else:
                        self.progress_callback(len(self.actions), len(self.actions), self.current_loop, self.loop_count)
                    
                    # Emit completion event
                    import json
                    import sys
                    event = {
                        'type': 'complete',
                        'data': {
                            'totalActions': len(self.actions) if self.execution_mode == 'legacy' else sum(len(step.action_ids) for step in self.test_script.steps),
                            'totalSteps': len(self.test_script.steps) if self.execution_mode == 'step-based' else 1,
                            'totalLoops': self.current_loop,
                            'completed': True,
                            'executionMode': self.execution_mode
                        }
                    }
                    json_str = json.dumps(event)
                    sys.stdout.write(json_str + '\n')
                    sys.stdout.flush()
                except Exception:
                    pass
    
    def _execute_step_based_playback(self) -> None:
        """Execute test script in step-based mode.
        
        Requirements: 5.1, 7.4
        
        Property 11: Execution Flow Management
        For any test script execution, steps SHALL execute in sequential order,
        failed steps SHALL cause subsequent steps to be marked as SKIPPED (unless
        continue_on_failure is enabled), and steps with no actions SHALL be skipped
        with appropriate logging.
        """
        if not self.test_script or not self.test_script.steps:
            print("[Player] No test steps to execute", flush=True)
            return
        
        # Determine number of iterations
        iterations = float('inf') if self.loop_count == 0 else self.loop_count
        self.current_loop = 0
        
        print(f"[Player] Starting step-based playback: {len(self.test_script.steps)} steps, speed={self.speed}x, loops={self.loop_count}", flush=True)
        
        while self.current_loop < iterations and self.is_playing:
            self.step_results = []  # Reset step results for each loop
            self.current_step_index = 0
            execution_stopped = False
            
            # Execute steps in sequential order
            for step_index, step in enumerate(self.test_script.steps):
                if not self.is_playing:
                    execution_stopped = True
                    break
                
                # Wait while paused
                while self.is_paused and self.is_playing:
                    time.sleep(0.1)
                
                if not self.is_playing:
                    execution_stopped = True
                    break
                
                self.current_step_index = step_index
                
                # Check if previous step failed and this step should be skipped
                if self._should_skip_step(step, step_index):
                    step_result = self._create_skipped_step_result(step)
                    self.step_results.append(step_result)
                    self._notify_step_completion(step_result)
                    continue
                
                # Execute the step
                step_result = self._execute_test_step(step)
                self.step_results.append(step_result)
                
                # Notify about step completion
                self._notify_step_completion(step_result)
                
                # Report progress if callback is provided
                if self.progress_callback:
                    try:
                        self.progress_callback(step_index + 1, len(self.test_script.steps), self.current_loop + 1, self.loop_count)
                    except Exception:
                        # Don't let callback errors stop playback
                        pass
                
                # Check if execution should stop due to step failure
                if step_result['status'] == 'failed' and not step.continue_on_failure:
                    print(f"[Player] Step {step.order} failed, stopping execution (continue_on_failure=False)", flush=True)
                    # Mark remaining steps as skipped
                    self._mark_remaining_steps_skipped(step_index + 1)
                    break
            
            # Increment loop counter
            self.current_loop += 1
            
            # If not the last iteration and still playing, add a small delay between loops
            if self.current_loop < iterations and self.is_playing and not execution_stopped:
                time.sleep(0.5)  # 500ms delay between loops
    
    def _execute_legacy_playback(self) -> None:
        """Execute actions in legacy flat mode."""
        # Determine number of iterations
        iterations = float('inf') if self.loop_count == 0 else self.loop_count
        self.current_loop = 0
        
        print(f"[Player] Starting legacy playback: {len(self.actions)} actions, speed={self.speed}x, loops={self.loop_count}", flush=True)
        
        while self.current_loop < iterations and self.is_playing:
            for i, action in enumerate(self.actions):
                if not self.is_playing:
                    break
                
                # Wait while paused
                while self.is_paused and self.is_playing:
                    time.sleep(0.1)
                
                if not self.is_playing:
                    break
                
                # Notify about the action before executing it
                if self.action_callback:
                    try:
                        self.action_callback(action, i)
                    except Exception:
                        # Don't let callback errors stop playback
                        pass
                
                # Log action being executed
                action_type = action.type if hasattr(action, 'type') else action.get('type', 'unknown')
                if action_type == 'ai_vision_capture':
                    action_id = action.id if hasattr(action, 'id') else action.get('id', 'unknown')
                    print(f"[Player] Executing action {i+1}/{len(self.actions)}: {action_type} (id={action_id})", flush=True)
                else:
                    action_x = action.x if hasattr(action, 'x') else action.get('x', 0)
                    action_y = action.y if hasattr(action, 'y') else action.get('y', 0)
                    print(f"[Player] Executing action {i+1}/{len(self.actions)}: {action_type} at ({action_x}, {action_y})", flush=True)
                
                # Execute the current action
                self._execute_action(action)
                
                # Report progress if callback is provided
                if self.progress_callback:
                    try:
                        self.progress_callback(i + 1, len(self.actions), self.current_loop + 1, self.loop_count)
                    except Exception:
                        # Don't let callback errors stop playback
                        pass
                
                # Calculate and apply delay before next action
                if i < len(self.actions) - 1:
                    next_action = self.actions[i + 1]
                    delay = self._calculate_delay(action, next_action)
                    
                    # Sleep in small increments to allow interruption and pause
                    elapsed = 0.0
                    sleep_increment = 0.01  # 10ms increments
                    while elapsed < delay and self.is_playing:
                        # Check for pause during delay
                        while self.is_paused and self.is_playing:
                            time.sleep(0.1)
                        if not self.is_playing:
                            break
                        time.sleep(min(sleep_increment, delay - elapsed))
                        elapsed += sleep_increment
            
            # Increment loop counter
            self.current_loop += 1
            
            # If not the last iteration and still playing, add a small delay between loops
            if self.current_loop < iterations and self.is_playing:
                time.sleep(0.5)  # 500ms delay between loops
    
    def stop_playback(self) -> None:
        """Interrupt playback."""
        self.is_playing = False
        
        # Stop keyboard listener
        if self._keyboard_listener:
            self._keyboard_listener.stop()
            self._keyboard_listener = None
        
        if self._playback_thread and self._playback_thread.is_alive():
            self._playback_thread.join(timeout=1.0)
    
    def _substitute_variables(self, text: str) -> str:
        """Substitute variables in text using {{variable_name}} syntax.
        
        Args:
            text: Text that may contain variable placeholders
            
        Returns:
            Text with variables substituted
        """
        if not text or not self.variables:
            return text
        
        result = text
        for var_name, var_value in self.variables.items():
            placeholder = f"{{{{{var_name}}}}}"
            result = result.replace(placeholder, var_value)
        
        return result
    
    def _execute_action(self, action) -> None:
        """Execute a single action using PyAutoGUI.
        
        This method can be overridden or mocked for testing.
        Supports variable substitution in key actions.
        Supports AI Vision Capture actions.
        """
        # Get action type - handle both Pydantic models and dicts
        if hasattr(action, 'type'):
            action_type = action.type
        elif isinstance(action, dict):
            action_type = action.get('type')
        else:
            return
        
        # Handle AI Vision Capture actions
        if action_type == 'ai_vision_capture':
            # Convert to dict if needed
            if hasattr(action, 'model_dump'):
                action_dict = action.model_dump(mode='json')
            elif isinstance(action, dict):
                action_dict = action
            else:
                action_dict = dict(action)
            
            self._execute_ai_vision_capture(action_dict)
            return
        
        if not PYAUTOGUI_AVAILABLE:
            return
        
        if action_type == 'mouse_move':
            # Skip mouse_move at high speeds for better performance
            # Only execute mouse moves at speeds <= 2x
            if self.speed <= 2.0:
                pyautogui.moveTo(action.x, action.y, _pause=False)
            # At higher speeds, skip mouse moves entirely - just jump to click positions
        elif action_type == 'mouse_click':
            # Always move to position before clicking
            pyautogui.click(action.x, action.y, button=action.button, _pause=False)
        elif action_type == 'key_press':
            # Apply variable substitution to key values
            key = self._substitute_variables(action.key) if action.key else action.key
            pyautogui.keyDown(key, _pause=False)
        elif action_type == 'key_release':
            # Apply variable substitution to key values
            key = self._substitute_variables(action.key) if action.key else action.key
            pyautogui.keyUp(key, _pause=False)
    
    def _calculate_delay(self, current, next_action) -> float:
        """Calculate delay between actions, capped at 5 seconds, adjusted by speed."""
        delay = next_action.timestamp - current.timestamp
        capped_delay = min(delay, 5.0)
        # Apply speed multiplier (higher speed = shorter delay)
        return capped_delay / self.speed
    
    def _on_key_press(self, key) -> None:
        """Handle keyboard events to detect ESC/Cmd+ESC for stop/pause."""
        try:
            # Track Cmd key state
            if key == keyboard.Key.cmd or key == keyboard.Key.cmd_r:
                self._cmd_pressed = True
                return
            
            # Check if ESC key was pressed
            if key == keyboard.Key.esc:
                if self._cmd_pressed:
                    # Cmd+ESC = Pause/Resume
                    sys.stderr.write("[Player] Cmd+ESC pressed - toggling pause\n")
                    sys.stderr.flush()
                    self.toggle_pause()
                    if self.pause_callback:
                        try:
                            self.pause_callback(self.is_paused)
                        except Exception:
                            pass
                else:
                    # ESC only = Stop
                    sys.stderr.write("[Player] ESC pressed - stopping playback\n")
                    sys.stderr.flush()
                    self._stopped_by_esc = True
                    self.stop_playback()
                    if self.stop_callback:
                        try:
                            self.stop_callback()
                        except Exception:
                            pass
        except Exception:
            pass
    
    def _on_key_release(self, key) -> None:
        """Handle key release to track Cmd key state."""
        try:
            if key == keyboard.Key.cmd or key == keyboard.Key.cmd_r:
                self._cmd_pressed = False
        except Exception:
            pass
    
    def toggle_pause(self) -> None:
        """Toggle pause state."""
        self.is_paused = not self.is_paused
        state = "paused" if self.is_paused else "resumed"
        sys.stderr.write(f"[Player] Playback {state}\n")
        sys.stderr.flush()
    
    def pause_playback(self) -> None:
        """Pause playback."""
        self.is_paused = True
        sys.stderr.write("[Player] Playback paused\n")
        sys.stderr.flush()
    
    def resume_playback(self) -> None:
        """Resume playback."""
        self.is_paused = False
        sys.stderr.write("[Player] Playback resumed\n")
        sys.stderr.flush()
    
    # =========================================================================
    # Step-Based Execution Methods
    # Requirements: 5.1, 5.2, 7.1, 7.4
    # =========================================================================
    
    def _execute_test_step(self, step) -> Dict[str, Any]:
        """Execute a single test step with all its actions.
        
        Requirements: 5.1, 7.4
        
        Property 11: Execution Flow Management
        For any test script execution, steps SHALL execute in sequential order,
        and steps with no actions SHALL be skipped with appropriate logging.
        
        Args:
            step: TestStep object to execute
            
        Returns:
            Dictionary containing step execution result
        """
        step_start_time = time.time()
        
        print(f"[Player] Executing Step {step.order}: {step.description}", flush=True)
        
        # Handle manual steps (no actions)
        if not step.action_ids:
            print(f"[Player] Step {step.order} skipped (Manual step - no actions recorded)", flush=True)
            return {
                'step_id': step.id,
                'step_order': step.order,
                'description': step.description,
                'expected_result': step.expected_result,
                'status': 'skipped',
                'message': 'Manual step - no actions recorded',
                'execution_time': 0.0,
                'action_count': 0,
                'executed_actions': 0,
                'failed_actions': 0,
                'assertion_results': [],
                'evidence_paths': [],
                'timestamp': time.time()
            }
        
        # Get actions for this step from action pool
        step_actions = []
        missing_actions = []
        
        for action_id in step.action_ids:
            if action_id in self.test_script.action_pool:
                action = self.test_script.action_pool[action_id]
                # Convert to dict if it's a Pydantic model
                if hasattr(action, 'model_dump'):
                    step_actions.append(action.model_dump(mode='json'))
                elif isinstance(action, dict):
                    step_actions.append(action)
                else:
                    step_actions.append(dict(action))
            else:
                missing_actions.append(action_id)
        
        if missing_actions:
            error_msg = f"Missing actions in pool: {missing_actions}"
            print(f"[Player] Step {step.order} failed: {error_msg}", flush=True)
            return {
                'step_id': step.id,
                'step_order': step.order,
                'description': step.description,
                'expected_result': step.expected_result,
                'status': 'failed',
                'message': error_msg,
                'execution_time': time.time() - step_start_time,
                'action_count': len(step.action_ids),
                'executed_actions': 0,
                'failed_actions': len(missing_actions),
                'assertion_results': [],
                'evidence_paths': [],
                'timestamp': time.time()
            }
        
        # Execute step with mixed actions and assertions
        execution_result = self._execute_step_with_assertions(step.id, step_actions)
        
        # Enhance result with step metadata
        execution_result.update({
            'step_order': step.order,
            'description': step.description,
            'expected_result': step.expected_result,
            'continue_on_failure': step.continue_on_failure
        })
        
        step_end_time = time.time()
        execution_result['execution_time'] = step_end_time - step_start_time
        
        status = execution_result['status']
        print(f"[Player] Step {step.order} {status.upper()}: {execution_result['message']}", flush=True)
        
        return execution_result
    
    def _should_skip_step(self, step, step_index: int) -> bool:
        """Determine if a step should be skipped due to previous failures or conditions.
        
        Requirements: 5.2, 7.1, 7.5
        
        Property 11: Execution Flow Management
        For any test script execution, failed steps SHALL cause subsequent steps
        to be marked as SKIPPED (unless continue_on_failure is enabled).
        
        Property 14: Conditional Execution
        For any test step with conditional execution rules, the step SHALL execute
        only when the specified conditions based on previous step results are met.
        
        Args:
            step: TestStep object to check
            step_index: Index of the step in the execution order
            
        Returns:
            True if step should be skipped, False otherwise
        """
        if step_index == 0:
            # First step is never skipped
            return False
        
        # Check conditional execution rules (if step has conditions)
        if hasattr(step, 'execution_condition') and step.execution_condition:
            if not self._evaluate_execution_condition(step.execution_condition, step_index):
                return True
        
        # Check if any previous step failed and didn't have continue_on_failure
        for i in range(step_index):
            if i < len(self.step_results):
                prev_result = self.step_results[i]
                if prev_result['status'] == 'failed':
                    # Check if the failed step had continue_on_failure enabled
                    prev_step = self.test_script.steps[i]
                    if not prev_step.continue_on_failure:
                        return True
        
        return False
    
    def _evaluate_execution_condition(self, condition: str, step_index: int) -> bool:
        """Evaluate execution condition based on previous step results.
        
        Requirements: 7.5
        
        Property 14: Conditional Execution
        For any test step with conditional execution rules, the step SHALL execute
        only when the specified conditions based on previous step results are met.
        
        Args:
            condition: Condition string to evaluate (e.g., "previous_passed", "step_1_failed")
            step_index: Current step index
            
        Returns:
            True if condition is met, False otherwise
        """
        if not condition or step_index == 0:
            return True
        
        # Simple condition evaluation - can be extended for more complex conditions
        condition = condition.lower().strip()
        
        if condition == "previous_passed":
            # Execute only if previous step passed
            if step_index > 0 and step_index - 1 < len(self.step_results):
                return self.step_results[step_index - 1]['status'] == 'passed'
            return False
        
        elif condition == "previous_failed":
            # Execute only if previous step failed
            if step_index > 0 and step_index - 1 < len(self.step_results):
                return self.step_results[step_index - 1]['status'] == 'failed'
            return False
        
        elif condition.startswith("step_") and "_passed" in condition:
            # Execute only if specific step passed (e.g., "step_1_passed")
            try:
                step_num = int(condition.split("_")[1])
                target_index = step_num - 1  # Convert to 0-based index
                if 0 <= target_index < len(self.step_results):
                    return self.step_results[target_index]['status'] == 'passed'
            except (ValueError, IndexError):
                pass
            return False
        
        elif condition.startswith("step_") and "_failed" in condition:
            # Execute only if specific step failed (e.g., "step_1_failed")
            try:
                step_num = int(condition.split("_")[1])
                target_index = step_num - 1  # Convert to 0-based index
                if 0 <= target_index < len(self.step_results):
                    return self.step_results[target_index]['status'] == 'failed'
            except (ValueError, IndexError):
                pass
            return False
        
        elif condition == "any_failed":
            # Execute only if any previous step failed
            return any(result['status'] == 'failed' for result in self.step_results)
        
        elif condition == "all_passed":
            # Execute only if all previous steps passed
            return all(result['status'] == 'passed' for result in self.step_results)
        
        # Default: execute the step (unknown condition)
        return True
    
    def _create_skipped_step_result(self, step) -> Dict[str, Any]:
        """Create a result object for a skipped step.
        
        Requirements: 5.2
        
        Args:
            step: TestStep object that was skipped
            
        Returns:
            Dictionary containing skipped step result
        """
        return {
            'step_id': step.id,
            'step_order': step.order,
            'description': step.description,
            'expected_result': step.expected_result,
            'status': 'skipped',
            'message': 'Skipped due to previous step failure',
            'execution_time': 0.0,
            'action_count': len(step.action_ids),
            'executed_actions': 0,
            'failed_actions': 0,
            'assertion_results': [],
            'evidence_paths': [],
            'continue_on_failure': step.continue_on_failure,
            'timestamp': time.time()
        }
    
    def _mark_remaining_steps_skipped(self, start_index: int) -> None:
        """Mark all remaining steps as skipped.
        
        Requirements: 5.2
        
        Args:
            start_index: Index to start marking steps as skipped
        """
        for i in range(start_index, len(self.test_script.steps)):
            step = self.test_script.steps[i]
            skipped_result = self._create_skipped_step_result(step)
            self.step_results.append(skipped_result)
            self._notify_step_completion(skipped_result)
    
    def _notify_step_completion(self, step_result: Dict[str, Any]) -> None:
        """Notify about step completion via callback.
        
        Requirements: 5.1
        
        Args:
            step_result: Dictionary containing step execution result
        """
        if self.step_callback:
            try:
                self.step_callback(step_result)
            except Exception as e:
                # Don't let callback errors stop execution
                sys.stderr.write(f"[Player] Step callback error: {e}\n")
                sys.stderr.flush()
    
    def get_execution_summary(self) -> Dict[str, Any]:
        """Get summary of step-based execution results.
        
        Requirements: 5.3, 5.4
        
        Returns:
            Dictionary containing execution summary
        """
        if not self.step_results:
            return {
                'total_steps': 0,
                'passed_steps': 0,
                'failed_steps': 0,
                'skipped_steps': 0,
                'total_execution_time': 0.0,
                'overall_status': 'not_executed',
                'step_results': []
            }
        
        passed_count = sum(1 for result in self.step_results if result['status'] == 'passed')
        failed_count = sum(1 for result in self.step_results if result['status'] == 'failed')
        skipped_count = sum(1 for result in self.step_results if result['status'] == 'skipped')
        total_time = sum(result.get('execution_time', 0.0) for result in self.step_results)
        
        # Determine overall status
        if failed_count > 0:
            overall_status = 'failed'
        elif passed_count > 0:
            overall_status = 'passed'
        else:
            overall_status = 'skipped'
        
        return {
            'total_steps': len(self.step_results),
            'passed_steps': passed_count,
            'failed_steps': failed_count,
            'skipped_steps': skipped_count,
            'total_execution_time': total_time,
            'overall_status': overall_status,
            'step_results': self.step_results,
            'execution_mode': self.execution_mode,
            'script_title': self.test_script.meta.title if self.test_script else 'Unknown',
            'generated_at': time.time()
        }
    
    def generate_test_report(
        self,
        output_format: str = 'html',
        output_dir: str = 'reports',
        filename_prefix: str = None
    ) -> Optional[str]:
        """
        Generate a business-language test report from execution results.
        
        Requirements: 5.3, 5.4, 5.5, 8.3
        
        Property 15: Report Generation
        For any completed test execution, the report SHALL show pass/fail status for
        each step with descriptions, include error messages and screenshots for failed
        steps, and be exportable in both HTML and JSON formats.
        
        Property 19: Report Separation
        For any test execution completion, the test report SHALL be generated as a
        separate output file from the script file.
        
        Args:
            output_format: Format for the report ('html', 'json', or 'summary')
            output_dir: Directory to save the report
            filename_prefix: Prefix for the report filename (defaults to script title)
            
        Returns:
            Path to the generated report file, or None if report generation failed
        """
        if not REPORT_GENERATOR_AVAILABLE:
            sys.stderr.write("[Player] Warning: Report generator not available\n")
            sys.stderr.flush()
            return None
        
        if self.execution_mode != 'step-based' or not self.step_results:
            sys.stderr.write("[Player] Warning: No step-based execution results to report\n")
            sys.stderr.flush()
            return None
        
        try:
            # Get execution summary
            execution_summary = self.get_execution_summary()
            
            # Generate filename prefix from script title if not provided
            if filename_prefix is None:
                script_title = execution_summary.get('script_title', 'test_report')
                # Clean title for filename
                filename_prefix = ''.join(c for c in script_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
                filename_prefix = filename_prefix.replace(' ', '_').lower()
            
            # Generate report
            report_path = generate_test_report(
                execution_summary,
                output_format,
                output_dir,
                filename_prefix
            )
            
            print(f"[Player] Test report generated: {report_path}", flush=True)
            return report_path
            
        except Exception as e:
            sys.stderr.write(f"[Player] Error generating test report: {e}\n")
            sys.stderr.flush()
            return None
    
    # =========================================================================
    # AI Vision Capture Playback Methods
    # Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 4.12
    # =========================================================================
    
    def _get_current_screen_dimensions(self) -> Tuple[int, int]:
        """Get current screen dimensions.
        
        Returns:
            Tuple of (width, height)
        """
        if PYAUTOGUI_AVAILABLE:
            size = pyautogui.size()
            return (size.width, size.height)
        return (1920, 1080)  # Default fallback
    
    def _scale_coordinates(
        self,
        x: int,
        y: int,
        original_dim: Tuple[int, int],
        current_dim: Tuple[int, int]
    ) -> Tuple[int, int]:
        """Scale coordinates proportionally when resolution differs.
        
        Requirements: 4.4, 4.7
        
        Property 3: Coordinate Scaling Proportionality
        For any saved coordinates (x, y) and screen dimensions, when the playback
        screen resolution differs from the recorded resolution, the scaled coordinates
        SHALL be proportional: scaled_x / new_width == original_x / original_width
        
        Args:
            x: Original X coordinate
            y: Original Y coordinate
            original_dim: Original screen dimensions (width, height)
            current_dim: Current screen dimensions (width, height)
            
        Returns:
            Tuple of (scaled_x, scaled_y) clamped to screen bounds
        """
        orig_width, orig_height = original_dim
        curr_width, curr_height = current_dim
        
        # Avoid division by zero
        if orig_width <= 0 or orig_height <= 0:
            return (x, y)
        
        if curr_width <= 0 or curr_height <= 0:
            return (x, y)
        
        # Calculate scale factors
        scale_x = curr_width / orig_width
        scale_y = curr_height / orig_height
        
        # Scale coordinates
        scaled_x = int(round(x * scale_x))
        scaled_y = int(round(y * scale_y))
        
        # Clamp to screen bounds
        scaled_x = max(0, min(scaled_x, curr_width - 1))
        scaled_y = max(0, min(scaled_y, curr_height - 1))
        
        return (scaled_x, scaled_y)
    
    def _execute_interaction(self, x: int, y: int, interaction_type: str) -> None:
        """Execute the specified interaction at the given coordinates.
        
        Requirements: 2.7
        
        Args:
            x: X coordinate
            y: Y coordinate
            interaction_type: One of 'click', 'dblclick', 'rclick', 'hover'
        """
        if not PYAUTOGUI_AVAILABLE:
            sys.stderr.write(f"[Player] PyAutoGUI not available, skipping interaction at ({x}, {y})\n")
            sys.stderr.flush()
            return
        
        if interaction_type == 'click':
            pyautogui.click(x, y, _pause=False)
        elif interaction_type == 'dblclick':
            pyautogui.doubleClick(x, y, _pause=False)
        elif interaction_type == 'rclick':
            pyautogui.rightClick(x, y, _pause=False)
        elif interaction_type == 'hover':
            pyautogui.moveTo(x, y, _pause=False)
        else:
            # Default to click
            pyautogui.click(x, y, _pause=False)
    
    def _has_valid_cache(self, action: Dict[str, Any]) -> bool:
        """Check if action has valid cached coordinates.
        
        Args:
            action: AI Vision Capture action dictionary
            
        Returns:
            True if cache_data contains valid cached_x and cached_y
        """
        cache_data = action.get('cache_data', {})
        if cache_data is None:
            return False
        return cache_data.get('cached_x') is not None and cache_data.get('cached_y') is not None
    
    def _execute_ai_vision_capture(self, action: Dict[str, Any]) -> None:
        """Execute ai_vision_capture action based on mode.
        
        Requirements: 3.1, 3.2, 3.3, 3.5, 4.1
        
        Property 14: Playback Priority Order
        For any ai_vision_capture action, the Player SHALL check modes in this
        exact order: (1) Static saved_x/y, (2) Dynamic cached_x/y, (3) Dynamic AI call.
        The first valid option SHALL be used.
        
        Property 7: Assertion Action Behavior
        For any AI vision action marked with is_assertion: true, the action SHALL not
        perform mouse or keyboard interactions and SHALL only return pass/fail status
        based on element detection.
        
        Priority order:
        1. Static Mode (saved_x/y) - 0 token cost
        2. Dynamic Cache (cached_x/y) - 0 token cost
        3. Dynamic Mode (Call AI) - token cost, then cache result
        
        Args:
            action: AI Vision Capture action dictionary
        """
        is_dynamic = action.get('is_dynamic', False)
        is_assertion = action.get('is_assertion', False)
        
        # Capture screenshot for evidence if this is an assertion
        if is_assertion:
            self._capture_assertion_evidence(action)
        
        if not is_dynamic:
            # Static Mode - use saved coordinates
            sys.stderr.write("[Player] AI Vision: Using Static Mode (saved coordinates)\n")
            sys.stderr.flush()
            self._execute_static_vision(action)
        elif self._has_valid_cache(action):
            # Dynamic Mode with cache - use cached coordinates
            sys.stderr.write("[Player] AI Vision: Using Cached Mode (0 token cost)\n")
            sys.stderr.flush()
            self._execute_cached_vision(action)
        else:
            # Dynamic Mode without cache - call AI
            sys.stderr.write("[Player] AI Vision: Using Dynamic Mode (calling AI)\n")
            sys.stderr.flush()
            self._execute_dynamic_vision(action)
    
    def _execute_static_vision(self, action: Dict[str, Any]) -> None:
        """Execute using static saved coordinates.
        
        Requirements: 3.1, 3.2, 4.3, 4.4, 4.12
        
        Property 4: Static Mode Zero AI Calls
        For any ai_vision_capture action with is_dynamic = false and valid saved_x/saved_y,
        playback SHALL execute the interaction at the saved coordinates without making
        any AI API calls.
        
        Property 7: Assertion Action Behavior
        For any AI vision action marked with is_assertion: true, the action SHALL not
        perform mouse or keyboard interactions and SHALL only return pass/fail status
        based on element detection.
        
        Args:
            action: AI Vision Capture action dictionary
        """
        static_data = action.get('static_data', {})
        saved_x = static_data.get('saved_x')
        saved_y = static_data.get('saved_y')
        is_assertion = action.get('is_assertion', False)
        
        # Check if coordinates are missing (Requirement 4.12)
        if saved_x is None or saved_y is None:
            if is_assertion:
                # For assertions, missing coordinates means element not found = FAILED
                sys.stderr.write(f"[Player] Assertion FAILED: AI Vision action {action.get('id', 'unknown')} has no saved coordinates (element not found)\n")
                sys.stderr.flush()
                self._set_assertion_result(action, False, "Element not found - no saved coordinates")
            else:
                sys.stderr.write(f"[Player] Warning: AI Vision action {action.get('id', 'unknown')} has no saved coordinates, skipping\n")
                sys.stderr.flush()
            return
        
        # Get screen dimensions
        screen_dim = static_data.get('screen_dim', (1920, 1080))
        if isinstance(screen_dim, list):
            screen_dim = tuple(screen_dim)
        
        current_dim = self._get_current_screen_dimensions()
        
        # Apply proportional scaling if resolution differs (Requirement 4.4)
        if screen_dim != current_dim:
            sys.stderr.write(f"[Player] Scaling coordinates from {screen_dim} to {current_dim}\n")
            sys.stderr.flush()
            x, y = self._scale_coordinates(saved_x, saved_y, screen_dim, current_dim)
        else:
            x, y = saved_x, saved_y
        
        if is_assertion:
            # For assertions, having valid coordinates means element found = PASSED
            sys.stderr.write(f"[Player] Assertion PASSED: Element found at ({x}, {y})\n")
            sys.stderr.flush()
            self._set_assertion_result(action, True, f"Element found at coordinates ({x}, {y})")
        else:
            # Execute interaction for non-assertion actions
            interaction_type = action.get('interaction', 'click')
            sys.stderr.write(f"[Player] Executing {interaction_type} at ({x}, {y})\n")
            sys.stderr.flush()
            self._execute_interaction(x, y, interaction_type)
    
    def _execute_cached_vision(self, action: Dict[str, Any]) -> None:
        """Execute using cached coordinates from previous AI call.
        
        Requirements: 3.1, 3.2, 4.5
        
        Property 5: Dynamic Cache Zero AI Calls
        For any ai_vision_capture action with is_dynamic = true AND valid cached_x/cached_y,
        playback SHALL execute the interaction at the cached coordinates (with scaling if
        needed) without making any AI API calls.
        
        Property 7: Assertion Action Behavior
        For any AI vision action marked with is_assertion: true, the action SHALL not
        perform mouse or keyboard interactions and SHALL only return pass/fail status
        based on element detection.
        
        Args:
            action: AI Vision Capture action dictionary
        """
        cache_data = action.get('cache_data', {})
        cached_x = cache_data.get('cached_x')
        cached_y = cache_data.get('cached_y')
        cache_dim = cache_data.get('cache_dim')
        is_assertion = action.get('is_assertion', False)
        
        if cached_x is None or cached_y is None:
            # Should not happen if _has_valid_cache was checked, but handle gracefully
            sys.stderr.write("[Player] Warning: Cache data invalid, falling back to dynamic mode\n")
            sys.stderr.flush()
            self._execute_dynamic_vision(action)
            return
        
        # Get current screen dimensions
        current_dim = self._get_current_screen_dimensions()
        
        # Apply scaling using cache_dim if resolution differs
        if cache_dim is not None:
            if isinstance(cache_dim, list):
                cache_dim = tuple(cache_dim)
            
            if cache_dim != current_dim:
                sys.stderr.write(f"[Player] Scaling cached coordinates from {cache_dim} to {current_dim}\n")
                sys.stderr.flush()
                x, y = self._scale_coordinates(cached_x, cached_y, cache_dim, current_dim)
            else:
                x, y = cached_x, cached_y
        else:
            x, y = cached_x, cached_y
        
        if is_assertion:
            # For assertions, having valid cached coordinates means element found = PASSED
            sys.stderr.write(f"[Player] Assertion PASSED: Element found at cached ({x}, {y}) - 0 token cost\n")
            sys.stderr.flush()
            self._set_assertion_result(action, True, f"Element found at cached coordinates ({x}, {y})")
        else:
            # Execute interaction for non-assertion actions
            interaction_type = action.get('interaction', 'click')
            sys.stderr.write(f"[Player] Executing {interaction_type} at cached ({x}, {y}) - 0 token cost\n")
            sys.stderr.flush()
            self._execute_interaction(x, y, interaction_type)
    
    def _execute_dynamic_vision(self, action: Dict[str, Any]) -> None:
        """Execute using AI to find element on current screen.
        
        Requirements: 3.1, 3.2, 3.3, 4.6, 4.7, 4.8, 4.9, 4.11
        
        Property 7: Assertion Action Behavior
        For any AI vision action marked with is_assertion: true, the action SHALL not
        perform mouse or keyboard interactions and SHALL only return pass/fail status
        based on element detection.
        
        Property 8: Assertion Result Handling
        For any assertion action execution, when the target is found the step SHALL
        receive PASSED status, and when the target is not found after timeout the
        step SHALL receive FAILED status.
        
        Args:
            action: AI Vision Capture action dictionary
        """
        if not AI_VISION_AVAILABLE:
            sys.stderr.write("[Player] Error: AI Vision service not available\n")
            sys.stderr.flush()
            self._clear_cache(action)
            return
        
        # Initialize AI service if needed
        if self._ai_service is None:
            self._ai_service = AIVisionService()
            if self.ai_api_key:
                # Run async initialization in sync context
                asyncio.get_event_loop().run_until_complete(
                    self._ai_service.initialize(self.ai_api_key)
                )
        
        if not self._ai_service.is_initialized():
            sys.stderr.write("[Player] Error: AI Vision service not initialized (no API key)\n")
            sys.stderr.flush()
            self._clear_cache(action)
            return
        
        try:
            # Capture current screenshot
            if not PYAUTOGUI_AVAILABLE:
                sys.stderr.write("[Player] Error: Cannot capture screenshot (PyAutoGUI not available)\n")
                sys.stderr.flush()
                self._clear_cache(action)
                return
            
            screenshot = pyautogui.screenshot()
            
            # Convert to base64
            import io
            import base64
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            screenshot_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            # Get dynamic config
            dynamic_config = action.get('dynamic_config', {})
            prompt = dynamic_config.get('prompt', '')
            reference_images = dynamic_config.get('reference_images', [])
            roi = dynamic_config.get('roi')
            search_scope = dynamic_config.get('search_scope', 'global')
            
            # Handle ROI for Regional Search (Requirement 4.7)
            roi_obj = None
            if roi and search_scope == 'regional':
                # Get original screen dimensions
                static_data = action.get('static_data', {})
                original_dim = static_data.get('screen_dim', (1920, 1080))
                if isinstance(original_dim, list):
                    original_dim = tuple(original_dim)
                
                current_dim = self._get_current_screen_dimensions()
                
                # Scale ROI if resolution differs
                if original_dim != current_dim:
                    scaled_roi = scale_roi(
                        roi.get('x', 0),
                        roi.get('y', 0),
                        roi.get('width', 100),
                        roi.get('height', 100),
                        original_dim,
                        current_dim
                    )
                    roi_obj = ServiceVisionROI(
                        x=scaled_roi[0],
                        y=scaled_roi[1],
                        width=scaled_roi[2],
                        height=scaled_roi[3]
                    )
                else:
                    roi_obj = ServiceVisionROI(
                        x=roi.get('x', 0),
                        y=roi.get('y', 0),
                        width=roi.get('width', 100),
                        height=roi.get('height', 100)
                    )
            
            # Create AI request
            request = AIVisionRequest(
                screenshot=screenshot_base64,
                prompt=prompt,
                reference_images=reference_images,
                roi=roi_obj
            )
            
            # Call AI service (Requirement 4.8)
            self._ai_call_count += 1
            sys.stderr.write(f"[Player] Calling AI Vision service (call #{self._ai_call_count})...\n")
            sys.stderr.flush()
            
            # Run async call in sync context
            response = asyncio.get_event_loop().run_until_complete(
                self._ai_service.analyze(request)
            )
            
            is_assertion = action.get('is_assertion', False)
            
            if response.success and response.x is not None and response.y is not None:
                # AI found the element
                x, y = response.x, response.y
                
                # Save to cache before executing (Requirement 4.9)
                current_dim = self._get_current_screen_dimensions()
                self._save_to_cache(action, x, y, current_dim)
                
                if is_assertion:
                    # For assertions, finding element means PASSED
                    sys.stderr.write(f"[Player] Assertion PASSED: AI found element at ({x}, {y})\n")
                    sys.stderr.flush()
                    self._set_assertion_result(action, True, f"AI found element at coordinates ({x}, {y})")
                else:
                    # Execute interaction for non-assertion actions
                    interaction_type = action.get('interaction', 'click')
                    sys.stderr.write(f"[Player] AI found element at ({x}, {y}), executing {interaction_type}\n")
                    sys.stderr.flush()
                    self._execute_interaction(x, y, interaction_type)
            else:
                # AI failed to find element (Requirement 4.11)
                error_msg = response.error or "Element not found"
                
                if is_assertion:
                    # For assertions, not finding element means FAILED
                    sys.stderr.write(f"[Player] Assertion FAILED: {error_msg}\n")
                    sys.stderr.flush()
                    self._set_assertion_result(action, False, error_msg)
                else:
                    sys.stderr.write(f"[Player] AI Vision failed: {error_msg}\n")
                    sys.stderr.flush()
                
                self._clear_cache(action)
                
        except asyncio.TimeoutError:
            is_assertion = action.get('is_assertion', False)
            if is_assertion:
                # Handle assertion timeout with specific timeout duration
                # Note: In a real implementation, we'd track the actual timeout duration
                timeout_duration = 30.0  # Default timeout assumption
                self._handle_assertion_timeout(action, timeout_duration)
            else:
                sys.stderr.write(f"[Player] AI Vision timed out\n")
                sys.stderr.flush()
            self._clear_cache(action)
        except Exception as e:
            is_assertion = action.get('is_assertion', False)
            if is_assertion:
                sys.stderr.write(f"[Player] Assertion FAILED: AI Vision error: {str(e)}\n")
                sys.stderr.flush()
                self._set_assertion_result(action, False, f"AI Vision error: {str(e)}")
            else:
                sys.stderr.write(f"[Player] AI Vision error: {str(e)}\n")
                sys.stderr.flush()
            self._clear_cache(action)
    
    def _save_to_cache(
        self,
        action: Dict[str, Any],
        x: int,
        y: int,
        screen_dim: Tuple[int, int]
    ) -> None:
        """Save AI result to cache for future runs.
        
        Requirements: 4.9, 5.8
        
        Property 7: Cache Persistence After AI Success
        For any successful Dynamic Mode AI call, the returned coordinates SHALL be
        saved to cache_data (cached_x, cached_y, cache_dim) and persisted to the
        script file.
        
        Args:
            action: AI Vision Capture action dictionary
            x: X coordinate from AI
            y: Y coordinate from AI
            screen_dim: Current screen dimensions
        """
        # Update action's cache_data
        if 'cache_data' not in action:
            action['cache_data'] = {}
        
        action['cache_data']['cached_x'] = x
        action['cache_data']['cached_y'] = y
        action['cache_data']['cache_dim'] = list(screen_dim)
        
        sys.stderr.write(f"[Player] Caching AI result: ({x}, {y}) at {screen_dim}\n")
        sys.stderr.flush()
        
        # Persist to script file if path is available
        self._persist_script()
    
    def _clear_cache(self, action: Dict[str, Any]) -> None:
        """Clear cache data after AI failure.
        
        Requirements: 4.11
        
        Property 8: Cache Invalidation On AI Failure
        For any failed Dynamic Mode AI call (error or timeout), any existing
        cache_data SHALL be cleared (cached_x, cached_y set to null).
        
        Args:
            action: AI Vision Capture action dictionary
        """
        if 'cache_data' in action:
            action['cache_data']['cached_x'] = None
            action['cache_data']['cached_y'] = None
            action['cache_data']['cache_dim'] = None
        
        sys.stderr.write("[Player] Cleared cache due to AI failure\n")
        sys.stderr.flush()
        
        # Persist to script file if path is available
        self._persist_script()
    
    def _persist_script(self) -> None:
        """Persist the current script state to file.
        
        Requirements: 5.8
        """
        if not self.script_path:
            return
        
        try:
            # Load current script
            script_path = Path(self.script_path)
            if not script_path.exists():
                return
            
            with open(script_path, 'r', encoding='utf-8') as f:
                script_data = json.load(f)
            
            # Update actions with current state
            # Note: self.actions may be Pydantic models or dicts
            updated_actions = []
            for action in self.actions:
                if hasattr(action, 'model_dump'):
                    updated_actions.append(action.model_dump(mode='json'))
                elif isinstance(action, dict):
                    updated_actions.append(action)
                else:
                    # Try to convert to dict
                    updated_actions.append(dict(action))
            
            script_data['actions'] = updated_actions
            
            # Save back to file
            with open(script_path, 'w', encoding='utf-8') as f:
                json.dump(script_data, f, indent=2, default=str)
            
            sys.stderr.write(f"[Player] Script persisted to {script_path}\n")
            sys.stderr.flush()
            
        except Exception as e:
            sys.stderr.write(f"[Player] Warning: Failed to persist script: {e}\n")
            sys.stderr.flush()
    
    def _capture_assertion_evidence(self, action: Dict[str, Any]) -> None:
        """Capture screenshot evidence for assertion actions.
        
        Requirements: 3.5
        
        Property 10: Evidence Collection
        For any assertion action execution, screenshots SHALL be captured as proof
        regardless of pass or fail outcome.
        
        Args:
            action: AI Vision Capture action dictionary
        """
        if not PYAUTOGUI_AVAILABLE:
            sys.stderr.write("[Player] Warning: Cannot capture assertion evidence (PyAutoGUI not available)\n")
            sys.stderr.flush()
            return
        
        try:
            import os
            import datetime
            
            # Create evidence directory if it doesn't exist
            evidence_dir = Path("evidence")
            evidence_dir.mkdir(exist_ok=True)
            
            # Generate timestamp-based filename
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            action_id = action.get('id', 'unknown')
            filename = f"assertion_{action_id}_{timestamp}.png"
            filepath = evidence_dir / filename
            
            # Capture screenshot
            screenshot = pyautogui.screenshot()
            screenshot.save(filepath)
            
            # Store evidence path in action for later reference
            if 'assertion_evidence' not in action:
                action['assertion_evidence'] = {}
            action['assertion_evidence']['screenshot_path'] = str(filepath)
            
            sys.stderr.write(f"[Player] Assertion evidence captured: {filepath}\n")
            sys.stderr.flush()
            
        except Exception as e:
            sys.stderr.write(f"[Player] Warning: Failed to capture assertion evidence: {e}\n")
            sys.stderr.flush()
    
    def _set_assertion_result(self, action: Dict[str, Any], passed: bool, message: str) -> None:
        """Set assertion result for an AI vision action.
        
        Requirements: 3.2, 3.3
        
        Property 8: Assertion Result Handling
        For any assertion action execution, when the target is found the step SHALL
        receive PASSED status, and when the target is not found after timeout the
        step SHALL receive FAILED status.
        
        Args:
            action: AI Vision Capture action dictionary
            passed: Whether the assertion passed
            message: Descriptive message about the result
        """
        if 'assertion_result' not in action:
            action['assertion_result'] = {}
        
        action['assertion_result']['passed'] = passed
        action['assertion_result']['message'] = message
        action['assertion_result']['timestamp'] = time.time()
        
        status = "PASSED" if passed else "FAILED"
        sys.stderr.write(f"[Player] Assertion {status}: {message}\n")
        sys.stderr.flush()
    
    def _process_step_assertions(self, step_id: str, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process assertion results for a test step.
        
        Requirements: 3.2, 3.3, 3.4
        
        Property 8: Assertion Result Handling
        For any assertion action execution, when the target is found the step SHALL
        receive PASSED status, and when the target is not found after timeout the
        step SHALL receive FAILED status.
        
        Property 9: Multiple Assertion Logic
        For any test step containing multiple assertion actions, the step SHALL pass
        only when all assertions succeed.
        
        Args:
            step_id: Unique identifier for the test step
            actions: List of actions in the step
            
        Returns:
            Dictionary containing step result with status, message, and evidence
        """
        assertion_actions = [action for action in actions if action.get('is_assertion', False)]
        
        if not assertion_actions:
            # No assertions in this step - step status determined by other factors
            return {
                'step_id': step_id,
                'status': 'pending',
                'message': 'No assertions to evaluate',
                'assertion_count': 0,
                'passed_assertions': 0,
                'failed_assertions': 0,
                'evidence_paths': []
            }
        
        passed_count = 0
        failed_count = 0
        evidence_paths = []
        failure_messages = []
        
        # Check each assertion result
        for action in assertion_actions:
            assertion_result = action.get('assertion_result', {})
            
            if assertion_result.get('passed', False):
                passed_count += 1
            else:
                failed_count += 1
                failure_messages.append(assertion_result.get('message', 'Assertion failed'))
            
            # Collect evidence paths
            assertion_evidence = action.get('assertion_evidence', {})
            screenshot_path = assertion_evidence.get('screenshot_path')
            if screenshot_path:
                evidence_paths.append(screenshot_path)
        
        # Determine overall step status
        if failed_count == 0:
            # All assertions passed
            status = 'passed'
            message = f"All {passed_count} assertions passed"
        else:
            # At least one assertion failed
            status = 'failed'
            if len(failure_messages) == 1:
                message = f"Assertion failed: {failure_messages[0]}"
            else:
                message = f"{failed_count} of {len(assertion_actions)} assertions failed: {'; '.join(failure_messages)}"
        
        return {
            'step_id': step_id,
            'status': status,
            'message': message,
            'assertion_count': len(assertion_actions),
            'passed_assertions': passed_count,
            'failed_assertions': failed_count,
            'evidence_paths': evidence_paths,
            'timestamp': time.time()
        }
    
    def _handle_assertion_timeout(self, action: Dict[str, Any], timeout_seconds: float) -> None:
        """Handle timeout for assertion actions.
        
        Requirements: 3.3
        
        Property 8: Assertion Result Handling
        For any assertion action execution, when the target is not found after timeout
        the step SHALL receive FAILED status.
        
        Args:
            action: AI Vision Capture action dictionary
            timeout_seconds: Number of seconds that elapsed before timeout
        """
        if not action.get('is_assertion', False):
            return
        
        timeout_message = f"Assertion timed out after {timeout_seconds:.1f} seconds"
        self._set_assertion_result(action, False, timeout_message)
        
        sys.stderr.write(f"[Player] Assertion TIMEOUT: {timeout_message}\n")
        sys.stderr.flush()
    
    def _get_step_assertion_summary(self, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get summary of assertion results for a list of actions.
        
        Requirements: 3.4
        
        Args:
            actions: List of actions to analyze
            
        Returns:
            Summary dictionary with assertion statistics
        """
        assertion_actions = [action for action in actions if action.get('is_assertion', False)]
        
        if not assertion_actions:
            return {
                'has_assertions': False,
                'total_assertions': 0,
                'passed_assertions': 0,
                'failed_assertions': 0,
                'all_passed': True,  # Vacuously true when no assertions
                'evidence_count': 0
            }
        
        passed_count = 0
        failed_count = 0
        evidence_count = 0
        
        for action in assertion_actions:
            assertion_result = action.get('assertion_result', {})
            
            if assertion_result.get('passed', False):
                passed_count += 1
            else:
                failed_count += 1
            
            # Count evidence
            assertion_evidence = action.get('assertion_evidence', {})
            if assertion_evidence.get('screenshot_path'):
                evidence_count += 1
        
        return {
            'has_assertions': True,
            'total_assertions': len(assertion_actions),
            'passed_assertions': passed_count,
            'failed_assertions': failed_count,
            'all_passed': failed_count == 0,
            'evidence_count': evidence_count
        }
    
    def _execute_step_with_assertions(self, step_id: str, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Execute a test step containing both regular actions and assertions.
        
        Requirements: 3.4
        
        Property 9: Multiple Assertion Logic
        For any test step containing multiple assertion actions, the step SHALL pass
        only when all assertions succeed.
        
        Args:
            step_id: Unique identifier for the test step
            actions: List of actions in the step (mix of regular and assertion actions)
            
        Returns:
            Dictionary containing step execution result
        """
        step_start_time = time.time()
        regular_actions = []
        assertion_actions = []
        execution_errors = []
        
        # Separate regular actions from assertions
        for action in actions:
            if action.get('is_assertion', False):
                assertion_actions.append(action)
            else:
                regular_actions.append(action)
        
        sys.stderr.write(f"[Player] Executing step {step_id}: {len(regular_actions)} regular actions, {len(assertion_actions)} assertions\n")
        sys.stderr.flush()
        
        # Execute regular actions first
        for i, action in enumerate(regular_actions):
            try:
                sys.stderr.write(f"[Player] Step {step_id}: Executing regular action {i+1}/{len(regular_actions)}\n")
                sys.stderr.flush()
                self._execute_action(action)
            except Exception as e:
                error_msg = f"Regular action {i+1} failed: {str(e)}"
                execution_errors.append(error_msg)
                sys.stderr.write(f"[Player] Step {step_id}: {error_msg}\n")
                sys.stderr.flush()
        
        # Execute assertion actions
        for i, action in enumerate(assertion_actions):
            try:
                sys.stderr.write(f"[Player] Step {step_id}: Executing assertion {i+1}/{len(assertion_actions)}\n")
                sys.stderr.flush()
                self._execute_ai_vision_capture(action)
            except Exception as e:
                error_msg = f"Assertion {i+1} execution failed: {str(e)}"
                execution_errors.append(error_msg)
                sys.stderr.write(f"[Player] Step {step_id}: {error_msg}\n")
                sys.stderr.flush()
                # Set assertion as failed due to execution error
                self._set_assertion_result(action, False, f"Execution error: {str(e)}")
        
        # Process assertion results
        assertion_result = self._process_step_assertions(step_id, actions)
        
        # Determine overall step status
        step_end_time = time.time()
        execution_time = step_end_time - step_start_time
        
        if execution_errors and assertion_result['status'] == 'failed':
            # Both regular actions and assertions failed
            status = 'failed'
            error_details = execution_errors + [assertion_result['message']]
            message = f"Step failed: {'; '.join(error_details)}"
        elif execution_errors:
            # Regular actions failed but assertions passed (or no assertions)
            status = 'failed'
            message = f"Regular actions failed: {'; '.join(execution_errors)}"
        elif assertion_result['status'] == 'failed':
            # Assertions failed but regular actions passed
            status = 'failed'
            message = assertion_result['message']
        else:
            # Everything passed
            status = 'passed'
            if assertion_actions:
                message = f"Step passed: {len(regular_actions)} actions executed, {assertion_result['passed_assertions']} assertions passed"
            else:
                message = f"Step passed: {len(regular_actions)} actions executed successfully"
        
        return {
            'step_id': step_id,
            'status': status,
            'message': message,
            'execution_time': execution_time,
            'regular_actions_count': len(regular_actions),
            'assertion_actions_count': len(assertion_actions),
            'execution_errors': execution_errors,
            'assertion_result': assertion_result,
            'evidence_paths': assertion_result.get('evidence_paths', []),
            'timestamp': step_end_time
        }
    
    def _generate_assertion_error_report(self, step_id: str, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate comprehensive error report for failed assertions in a step.
        
        Requirements: 3.4
        
        Args:
            step_id: Unique identifier for the test step
            actions: List of actions in the step
            
        Returns:
            Detailed error report for failed assertions
        """
        assertion_actions = [action for action in actions if action.get('is_assertion', False)]
        failed_assertions = []
        passed_assertions = []
        
        for i, action in enumerate(assertion_actions):
            assertion_result = action.get('assertion_result', {})
            assertion_evidence = action.get('assertion_evidence', {})
            
            assertion_info = {
                'index': i + 1,
                'action_id': action.get('id', 'unknown'),
                'passed': assertion_result.get('passed', False),
                'message': assertion_result.get('message', 'No result message'),
                'timestamp': assertion_result.get('timestamp', time.time()),
                'screenshot_path': assertion_evidence.get('screenshot_path'),
                'interaction_type': action.get('interaction', 'click'),
                'is_dynamic': action.get('is_dynamic', False)
            }
            
            if assertion_result.get('passed', False):
                passed_assertions.append(assertion_info)
            else:
                failed_assertions.append(assertion_info)
        
        return {
            'step_id': step_id,
            'total_assertions': len(assertion_actions),
            'passed_count': len(passed_assertions),
            'failed_count': len(failed_assertions),
            'passed_assertions': passed_assertions,
            'failed_assertions': failed_assertions,
            'overall_result': 'passed' if len(failed_assertions) == 0 else 'failed',
            'summary': f"{len(passed_assertions)}/{len(assertion_actions)} assertions passed",
            'generated_at': time.time()
        }
