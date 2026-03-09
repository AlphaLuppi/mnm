#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Installing dependencies..."
npm install

echo "Building MnM..."
npm run build

echo "Initializing database..."
npm run db:push

echo ""
echo "Setup complete! Run 'npm start' or './scripts/start-mnm.sh' to launch MnM."
