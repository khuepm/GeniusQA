"""
Integration tests for variable substitution feature.

This module tests the complete variable substitution workflow from
script creation with variables through playback with variable overrides.
"""

import pytest
import tempfile
import json
from pathlib import Path
from datetime import datetime

from storage.models import Action, ScriptMetadata, ScriptFile
from storage.storage import Storage
from player.player import Player
from ipc.handler import IPCHandler


class TestVariableSubstitutionIntegration:
    """Integration tests for variable substitution."""
    
    def test_script_with_variables_save_and_load(self):
        """Test saving and loading a script with variables."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create actions with variable placeholders
            actions = [
                Action(type='key_press', timestamp=0.0, key='{{username}}'),
                Action(type='key_release', timestamp=0.1, key='{{username}}'),
                Action(type='key_press', timestamp=0.2, key='{{password}}'),
                Action(type='key_release', timestamp=0.3, key='{{password}}'),
            ]
            
            # Create script with variables
            metadata = ScriptMetadata(
                created_at=datetime.now(),
                duration=0.3,
                action_count=4,
                platform='darwin'
            )
            script = ScriptFile(
                metadata=metadata,
                actions=actions,
                variables={'username': 'admin', 'password': 'default123'}
            )
            
            # Save to file
            script_path = Path(tmpdir) / 'test_script.json'
            with open(script_path, 'w') as f:
                json.dump(script.model_dump(mode='json'), f, default=str)
            
            # Load back
            loaded_script = storage.load_script(script_path)
            
            # Verify variables are preserved
            assert loaded_script.variables == {'username': 'admin', 'password': 'default123'}
            assert loaded_script.actions[0].key == '{{username}}'
            assert loaded_script.actions[2].key == '{{password}}'
    
    def test_player_with_default_variables(self):
        """Test player uses default variables from script."""
        actions = [
            Action(type='key_press', timestamp=0.0, key='{{username}}'),
            Action(type='key_release', timestamp=0.1, key='{{username}}'),
        ]
        
        variables = {'username': 'testuser'}
        player = Player(actions, variables=variables)
        
        # Verify substitution works
        assert player._substitute_variables('{{username}}') == 'testuser'
        assert player._substitute_variables('Hello {{username}}!') == 'Hello testuser!'
    
    def test_player_with_variable_overrides(self):
        """Test player can override default variables."""
        actions = [
            Action(type='key_press', timestamp=0.0, key='{{username}}'),
            Action(type='key_release', timestamp=0.1, key='{{username}}'),
        ]
        
        # Default variables
        default_variables = {'username': 'default_user', 'password': 'default_pass'}
        
        # Override variables
        override_variables = {'username': 'override_user'}
        
        # Merge (override takes precedence)
        merged_variables = {**default_variables, **override_variables}
        
        player = Player(actions, variables=merged_variables)
        
        # Verify override is used
        assert player._substitute_variables('{{username}}') == 'override_user'
        assert player._substitute_variables('{{password}}') == 'default_pass'
    
    def test_ipc_handler_passes_variables_to_player(self):
        """Test that IPC handler correctly passes variables to player."""
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = IPCHandler()
            handler.storage = Storage(base_dir=Path(tmpdir))
            
            # Create a script with variables
            actions = [
                Action(type='key_press', timestamp=0.0, key='{{username}}'),
                Action(type='key_release', timestamp=0.1, key='{{username}}'),
            ]
            
            metadata = ScriptMetadata(
                created_at=datetime.now(),
                duration=0.1,
                action_count=2,
                platform='darwin'
            )
            
            script = ScriptFile(
                metadata=metadata,
                actions=actions,
                variables={'username': 'default_user', 'password': 'default_pass'}
            )
            
            # Save script
            script_path = Path(tmpdir) / 'test_script.json'
            with open(script_path, 'w') as f:
                json.dump(script.model_dump(mode='json'), f, default=str)
            
            # Test playback with variable overrides
            params = {
                'scriptPath': str(script_path),
                'variables': {'username': 'override_user'}
            }
            
            response = handler._handle_start_playback(params)
            
            # Verify response includes merged variables
            assert response['success'] is True
            assert 'variables' in response['data']
            assert response['data']['variables']['username'] == 'override_user'
            assert response['data']['variables']['password'] == 'default_pass'
            
            # Stop playback
            handler._handle_stop_playback({})
    
    def test_complete_variable_workflow(self):
        """Test complete workflow: create script with variables, save, load, play with overrides."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Step 1: Create script with variables
            actions = [
                Action(type='key_press', timestamp=0.0, key='{{username}}'),
                Action(type='key_release', timestamp=0.1, key='{{username}}'),
                Action(type='key_press', timestamp=0.2, key='{{password}}'),
                Action(type='key_release', timestamp=0.3, key='{{password}}'),
            ]
            
            metadata = ScriptMetadata(
                created_at=datetime.now(),
                duration=0.3,
                action_count=4,
                platform='darwin'
            )
            
            script = ScriptFile(
                metadata=metadata,
                actions=actions,
                variables={'username': 'admin', 'password': 'secret123'}
            )
            
            # Step 2: Save script
            script_path = Path(tmpdir) / 'workflow_test.json'
            with open(script_path, 'w') as f:
                json.dump(script.model_dump(mode='json'), f, default=str)
            
            # Step 3: Load script
            loaded_script = storage.load_script(script_path)
            assert loaded_script.variables == {'username': 'admin', 'password': 'secret123'}
            
            # Step 4: Create player with default variables
            player_default = Player(loaded_script.actions, variables=loaded_script.variables)
            assert player_default._substitute_variables('{{username}}') == 'admin'
            assert player_default._substitute_variables('{{password}}') == 'secret123'
            
            # Step 5: Create player with override variables
            override_vars = {**loaded_script.variables, 'username': 'superadmin'}
            player_override = Player(loaded_script.actions, variables=override_vars)
            assert player_override._substitute_variables('{{username}}') == 'superadmin'
            assert player_override._substitute_variables('{{password}}') == 'secret123'
    
    def test_variables_with_special_characters(self):
        """Test that variables can contain special characters."""
        actions = [
            Action(type='key_press', timestamp=0.0, key='{{email}}'),
        ]
        
        variables = {
            'email': 'user@example.com',
            'url': 'https://example.com/path?query=value',
            'special': 'Hello! @#$%^&*()'
        }
        
        player = Player(actions, variables=variables)
        
        assert player._substitute_variables('{{email}}') == 'user@example.com'
        assert player._substitute_variables('{{url}}') == 'https://example.com/path?query=value'
        assert player._substitute_variables('{{special}}') == 'Hello! @#$%^&*()'
    
    def test_undefined_variables_remain_as_placeholders(self):
        """Test that undefined variables are not substituted."""
        actions = [
            Action(type='key_press', timestamp=0.0, key='{{defined}}'),
            Action(type='key_release', timestamp=0.1, key='{{undefined}}'),
        ]
        
        variables = {'defined': 'value'}
        player = Player(actions, variables=variables)
        
        assert player._substitute_variables('{{defined}}') == 'value'
        assert player._substitute_variables('{{undefined}}') == '{{undefined}}'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
