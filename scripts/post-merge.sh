#!/bin/bash
set -e

# Install root dependencies (server + bot share these)
cd One-File-Rest
npm install --no-audit --no-fund --prefer-offline

# Install client dependencies if a separate package.json exists
if [ -f client/package.json ]; then
  cd client
  npm install --no-audit --no-fund --prefer-offline
  cd ..
fi

# Schema migrations are idempotent and run automatically on server start
# (server/db/migrate.ts via the bootstrap path), so no explicit migrate step here.

echo "✅ post-merge setup complete"
