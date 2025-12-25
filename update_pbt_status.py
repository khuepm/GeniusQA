#!/usr/bin/env python3
"""
Tool to update PBT (Property-Based Test) status in tasks.md file
"""

import sys
import re
from pathlib import Path

def update_pbt_status(task_file_path, property_name, status, details=None):
    """
    Update the status of a property-based test in the tasks.md file
    
    Args:
        task_file_path: Path to the tasks.md file
        property_name: Name of the property test (e.g., "Property 9")
        status: New status ("PASSED", "FAILED", "IN_PROGRESS", etc.)
        details: Optional details about the test result
    """
    
    # Read the file
    with open(task_file_path, 'r') as f:
        content = f.read()
    
    # Pattern to match the property test line
    pattern = rf'(\*\*{re.escape(property_name)}:.*?\*\*)'
    
    # Find the property test line
    match = re.search(pattern, content)
    if not match:
        print(f"Property test '{property_name}' not found in {task_file_path}")
        return False
    
    # Look for existing status pattern
    status_pattern = rf'(\*\*Status: [A-Z_]+\*\*)'
    
    # Check if there's already a status after the property line
    property_line = match.group(1)
    property_end = match.end()
    
    # Look for status in the next few lines after the property
    next_section = content[property_end:property_end + 200]  # Look ahead 200 chars
    status_match = re.search(status_pattern, next_section)
    
    if status_match:
        # Replace existing status
        old_status = status_match.group(1)
        new_status = f"**Status: {status}**"
        if details:
            new_status += f" - {details}"
        
        content = content.replace(old_status, new_status)
    else:
        # Add new status after the property line
        new_status = f"\n    - **Status: {status}**"
        if details:
            new_status += f" - {details}"
        
        # Insert after the property line
        content = content[:property_end] + new_status + content[property_end:]
    
    # Write back to file
    with open(task_file_path, 'w') as f:
        f.write(content)
    
    print(f"Updated {property_name} status to {status}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python update_pbt_status.py <task_file> <property_name> <status> [details]")
        print("Example: python update_pbt_status.py tasks.md 'Property 9' 'PASSED' 'All assertions passed'")
        sys.exit(1)
    
    task_file = sys.argv[1]
    property_name = sys.argv[2]
    status = sys.argv[3]
    details = sys.argv[4] if len(sys.argv) > 4 else None
    
    if not Path(task_file).exists():
        print(f"Task file {task_file} does not exist")
        sys.exit(1)
    
    success = update_pbt_status(task_file, property_name, status, details)
    sys.exit(0 if success else 1)
