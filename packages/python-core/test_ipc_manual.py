#!/usr/bin/env python3
"""Manual test script for IPC handler.

This script demonstrates how to interact with the IPC handler
by sending commands via stdin and receiving responses via stdout.
"""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from ipc.handler import IPCHandler


def test_command_routing():
    """Test that commands are properly routed."""
    handler = IPCHandler()
    
    print("Testing command routing...")
    
    # Test unknown command
    response = handler._route_command({'command': 'unknown'})
    assert response['success'] is False
    assert 'Unknown command' in response['error']
    print("✓ Unknown command handling works")
    
    # Test check_recordings
    response = handler._route_command({'command': 'check_recordings'})
    assert response['success'] is True
    assert 'hasRecordings' in response['data']
    print("✓ check_recordings command works")
    
    # Test get_latest
    response = handler._route_command({'command': 'get_latest'})
    assert response['success'] is True
    print("✓ get_latest command works")
    
    print("\nAll command routing tests passed!")


def test_error_handling():
    """Test error handling."""
    handler = IPCHandler()
    
    print("\nTesting error handling...")
    
    # Try to stop recording when none is in progress
    response = handler._handle_stop_recording({})
    assert response['success'] is False
    assert 'error' in response
    print("✓ Error handling for stop_recording works")
    
    # Try to stop playback when none is in progress
    response = handler._handle_stop_playback({})
    assert response['success'] is False
    assert 'error' in response
    print("✓ Error handling for stop_playback works")
    
    # Try to start playback with no recordings
    from unittest.mock import patch
    with patch.object(handler.storage, 'get_latest_script', return_value=None):
        response = handler._handle_start_playback({})
        assert response['success'] is False
        assert 'No recordings found' in response['error']
    print("✓ Error handling for missing recordings works")
    
    print("\nAll error handling tests passed!")


def test_response_format():
    """Test response formatting."""
    handler = IPCHandler()
    
    print("\nTesting response format...")
    
    # Test successful response
    response = {'success': True, 'data': {'test': 'value'}}
    from io import StringIO
    from unittest.mock import patch
    
    with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
        handler._send_response(response)
        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed == response
    print("✓ Response formatting works")
    
    # Test error response
    with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
        handler._send_error("Test error")
        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed['success'] is False
        assert parsed['error'] == "Test error"
    print("✓ Error response formatting works")
    
    print("\nAll response format tests passed!")


if __name__ == '__main__':
    try:
        test_command_routing()
        test_error_handling()
        test_response_format()
        print("\n" + "="*50)
        print("ALL TESTS PASSED!")
        print("="*50)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
