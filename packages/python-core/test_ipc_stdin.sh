#!/bin/bash
# Test IPC handler with stdin/stdout

cd "$(dirname "$0")/src"

# Send a check_recordings command
echo '{"command": "check_recordings"}' | python3 -c "
import sys
sys.path.insert(0, '.')
from ipc.handler import IPCHandler

handler = IPCHandler()
handler.run()
"
