#!/usr/bin/env bash
set -euo pipefail

MIN_NODE_VERSION=20

# Check Node.js version
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js >= $MIN_NODE_VERSION."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt "$MIN_NODE_VERSION" ]; then
  echo "Error: Node.js >= $MIN_NODE_VERSION required (found v$(node -v))."
  exit 1
fi

# Navigate to script directory
cd "$(dirname "$0")/.."

# Ensure .mnm directory exists
mkdir -p .mnm/logs

echo "Starting MnM..."
npm start
