#!/bin/bash

# Install Python dependencies for GeniusQA Desktop Recorder
# This script installs all required Python packages

echo "🔧 Installing Python dependencies for GeniusQA Desktop Recorder..."
echo ""

# Check Python version
echo "📋 Checking Python version..."
python3 --version

if [ $? -ne 0 ]; then
    echo "❌ Error: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.9 or higher:"
    echo "  - macOS: brew install python@3.11"
    echo "  - Ubuntu: sudo apt-get install python3"
    echo "  - Windows: Download from python.org"
    exit 1
fi

# Check pip
echo ""
echo "📋 Checking pip..."
python3 -m pip --version

if [ $? -ne 0 ]; then
    echo "❌ Error: pip is not installed"
    echo "Installing pip..."
    python3 -m ensurepip --upgrade
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies from requirements-recorder.txt..."
python3 -m pip install -r requirements-recorder.txt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All dependencies installed successfully!"
    echo ""
    echo "📋 Verifying installation..."
    python3 -c "import pyautogui; import pynput; import pydantic; print('✅ pyautogui: OK'); print('✅ pynput: OK'); print('✅ pydantic: OK')"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Setup complete! You can now use the recorder."
    else
        echo ""
        echo "⚠️  Some dependencies may not have installed correctly."
        echo "Please check the error messages above."
    fi
else
    echo ""
    echo "❌ Failed to install dependencies"
    echo "Please check the error messages above and try again."
    exit 1
fi
