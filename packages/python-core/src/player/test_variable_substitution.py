"""
Tests for variable substitution in Player module.

This module tests the variable substitution functionality that allows
scripts to use placeholders like {{variable_name}} that get replaced
with actual values during playback.
"""

import pytest
from hypothesis import given, strategies as st
from storage.models import Action
from player.player import Player


class TestVariableSubstitution:
    """Test variable substitution in Player."""
    
    def test_substitute_simple_variable(self):
        """Test substituting a single variable in text."""
        player = Player([], variables={'username': 'testuser'})
        result = player._substitute_variables('{{username}}')
        assert result == 'testuser'
    
    def test_substitute_multiple_variables(self):
        """Test substituting multiple variables in text."""
        player = Player([], variables={'first': 'John', 'last': 'Doe'})
        result = player._substitute_variables('{{first}} {{last}}')
        assert result == 'John Doe'
    
    def test_substitute_no_variables(self):
        """Test text without variables remains unchanged."""
        player = Player([], variables={'username': 'testuser'})
        result = player._substitute_variables('plain text')
        assert result == 'plain text'
    
    def test_substitute_empty_variables(self):
        """Test substitution with no variables defined."""
        player = Player([])
        result = player._substitute_variables('{{username}}')
        assert result == '{{username}}'
    
    def test_substitute_undefined_variable(self):
        """Test that undefined variables remain as placeholders."""
        player = Player([], variables={'username': 'testuser'})
        result = player._substitute_variables('{{username}} {{undefined}}')
        assert result == 'testuser {{undefined}}'
    
    def test_substitute_empty_string(self):
        """Test substitution with empty string."""
        player = Player([], variables={'username': 'testuser'})
        result = player._substitute_variables('')
        assert result == ''
    
    def test_substitute_none(self):
        """Test substitution with None."""
        player = Player([], variables={'username': 'testuser'})
        result = player._substitute_variables(None)
        assert result is None
    
    def test_key_action_substitution_logic(self):
        """Test that key actions would use variable substitution."""
        action = Action(type='key_press', timestamp=0.0, key='{{username}}')
        player = Player([action], variables={'username': 'testuser'})
        
        # Test the substitution logic directly
        substituted_key = player._substitute_variables(action.key)
        assert substituted_key == 'testuser'
    
    def test_key_release_substitution_logic(self):
        """Test that key release actions would use variable substitution."""
        action = Action(type='key_release', timestamp=0.0, key='{{password}}')
        player = Player([action], variables={'password': 'secret123'})
        
        # Test the substitution logic directly
        substituted_key = player._substitute_variables(action.key)
        assert substituted_key == 'secret123'
    
    def test_complex_key_sequence_with_variables(self):
        """Test a sequence of key actions with variables."""
        actions = [
            Action(type='key_press', timestamp=0.0, key='{{username}}'),
            Action(type='key_release', timestamp=0.1, key='{{username}}'),
            Action(type='key_press', timestamp=0.2, key='{{password}}'),
            Action(type='key_release', timestamp=0.3, key='{{password}}'),
        ]
        player = Player(actions, variables={'username': 'admin', 'password': 'pass123'})
        
        # Verify each action would be substituted correctly
        assert player._substitute_variables(actions[0].key) == 'admin'
        assert player._substitute_variables(actions[1].key) == 'admin'
        assert player._substitute_variables(actions[2].key) == 'pass123'
        assert player._substitute_variables(actions[3].key) == 'pass123'


class TestVariableSubstitutionProperties:
    """Property-based tests for variable substitution."""
    
    @given(
        var_name=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))),
        var_value=st.text(min_size=0, max_size=50)
    )
    def test_variable_substitution_roundtrip(self, var_name, var_value):
        """Property: Substituting a variable should replace the placeholder with the value."""
        player = Player([], variables={var_name: var_value})
        placeholder = f'{{{{{var_name}}}}}'
        result = player._substitute_variables(placeholder)
        assert result == var_value
    
    @given(
        text=st.text(min_size=0, max_size=100)
    )
    def test_no_variables_preserves_text(self, text):
        """Property: Text without variable placeholders should remain unchanged."""
        # Only test text that doesn't contain {{ or }}
        if '{{' not in text and '}}' not in text:
            player = Player([], variables={'test': 'value'})
            result = player._substitute_variables(text)
            assert result == text
    
    @given(
        var_name=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))),
        var_value=st.text(min_size=0, max_size=50),
        prefix=st.text(min_size=0, max_size=20),
        suffix=st.text(min_size=0, max_size=20)
    )
    def test_variable_substitution_with_surrounding_text(self, var_name, var_value, prefix, suffix):
        """Property: Variables should be substituted correctly even with surrounding text."""
        # Avoid conflicts with variable syntax
        if '{{' not in prefix and '}}' not in prefix and '{{' not in suffix and '}}' not in suffix:
            player = Player([], variables={var_name: var_value})
            text = f'{prefix}{{{{{var_name}}}}}{suffix}'
            result = player._substitute_variables(text)
            assert result == f'{prefix}{var_value}{suffix}'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
