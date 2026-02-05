#!/bin/bash
# Startup script for Render deployment
# This script figures out where it is and runs the app correctly

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# TypeScript output structure: dist/backend/src/index.js
# Try multiple possible locations
if [ -f "$SCRIPT_DIR/dist/backend/src/index.js" ]; then
    echo "Starting from backend directory (dist/backend/src structure)..."
    node "$SCRIPT_DIR/dist/backend/src/index.js"
elif [ -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo "Starting from backend directory (dist/index.js)..."
    node "$SCRIPT_DIR/dist/index.js"
elif [ -f "$SCRIPT_DIR/../backend/dist/backend/src/index.js" ]; then
    echo "Starting from project root..."
    cd "$SCRIPT_DIR/../backend" || exit 1
    node dist/backend/src/index.js
else
    echo "Error: Cannot find compiled index.js"
    echo "Script directory: $SCRIPT_DIR"
    echo "Current directory: $(pwd)"
    echo "Checking possible locations:"
    ls -la "$SCRIPT_DIR/dist/" 2>/dev/null || echo "No dist folder"
    find "$SCRIPT_DIR/dist" -name "index.js" 2>/dev/null || echo "No index.js found"
    exit 1
fi
