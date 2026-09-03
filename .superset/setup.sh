#!/usr/bin/env bash
# Superset workspace setup for the blicks WordPress plugin.
# Runs on every new workspace: installs deps, builds assets, boots the wp-env dev stack.
set -euo pipefail

echo "==> Installing JS dependencies (pnpm)"
pnpm install --frozen-lockfile

if [ -f composer.json ]; then
  if command -v composer >/dev/null 2>&1; then
    echo "==> Installing PHP dependencies (composer)"
    composer install --no-interaction --prefer-dist
  else
    echo "!! composer not found on PATH — skipping PHP deps (needed for phpunit/phpcs)"
  fi
fi

echo "==> Building plugin assets (vite)"
pnpm build

# wp-env spins up the WordPress Docker containers. Requires Docker to be running.
# Kept here so the dev environment is ready the moment the workspace opens;
# `pnpm dev` (the Run command) only watches/rebuilds JS.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Starting WordPress dev environment (wp-env start)"
  pnpm run env:start
else
  echo "!! Docker not running — skipping wp-env start. Run 'pnpm run env:start' once Docker is up."
fi

echo "==> Setup complete"
