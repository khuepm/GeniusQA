"""Main entry point for Python Core IPC communication."""

import sys
from ipc.handler import IPCHandler


def main():
    """Start the IPC handler loop."""
    handler = IPCHandler()
    handler.run()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.stderr.write("Python Core terminated by user\n")
        sys.exit(0)
    except Exception as e:
        sys.stderr.write(f"Fatal error: {str(e)}\n")
        sys.exit(1)
