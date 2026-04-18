#!/bin/bash

# Navigate to the project root
cd "$(dirname "$0")/.."

echo "Building GeniusQA Desktop..."

# Navigate to the desktop package
cd packages/desktop

# Install dependencies if needed (optional, but good practice)
pnpm install

# Build the application
pnpm tauri build

echo "Build complete! Check packages/desktop/src-tauri/target/release/bundle/"
