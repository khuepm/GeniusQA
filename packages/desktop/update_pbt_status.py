#!/usr/bin/env python3
"""
Property-Based Test Status Updater

Updates the status of property-based tests in the task specification.
"""

import sys
import re
from pathlib import Path

def update_pbt_status(subtask_id, status, details=""):
    """Update PBT status for a specific subtask"""
    
    # Find the tasks.md file
    tasks_file = Path("../../.kiro/specs/desktop-ui-redesign/tasks.md")
    if not tasks_file.exists():
        print(f"Tasks file not found: {tasks_file}")
        return False
    
    # Read the current content
    content = tasks_file.read_text()
    
    # Create status update message
    timestamp = "2026-01-12"
    status_msg = f"**Status: {status.upper()}** - {details}" if details else f"**Status: {status.upper()}**"
    
    # Update the content based on subtask
    if subtask_id == "17.1":
        # Update subtask 17.1 status
        pattern = r'(<task title="17\.1 Resolve multiple component rendering in test environment">\s*Status: )[^<]+'
        replacement = f'\\g<1>{status}'
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
        
    elif subtask_id == "17.2":
        # Update subtask 17.2 status  
        pattern = r'(<task title="17\.2 Improve property-based test reliability">\s*Status: )[^<]+'
        replacement = f'\\g<1>{status}'
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
        
    elif subtask_id == "17.3":
        # Update subtask 17.3 status
        pattern = r'(<task title="17\.3 Add missing test coverage for edge cases">\s*Status: )[^<]+'
        replacement = f'\\g<1>{status}'
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    # Write back the updated content
    tasks_file.write_text(content)
    print(f"Updated subtask {subtask_id} status to: {status}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_pbt_status.py <subtask_id> <status> [details]")
        print("Example: python update_pbt_status.py 17.1 'in-progress' 'Fixed component isolation'")
        sys.exit(1)
    
    subtask_id = sys.argv[1]
    status = sys.argv[2]
    details = sys.argv[3] if len(sys.argv) > 3 else ""
    
    success = update_pbt_status(subtask_id, status, details)
    sys.exit(0 if success else 1)
