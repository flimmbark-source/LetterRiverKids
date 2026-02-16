#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${1:-"../LetterRiverKids"}
REPO_NAME=${2:-"LetterRiverKids"}
VISIBILITY=${3:-"public"} # public or private

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install from https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not authenticated in gh. Run: gh auth login"
  exit 1
fi

pushd "$OUT_DIR" >/dev/null

if [ ! -d .git ]; then
  git init
fi

git add .
git commit -m "Initialize Letter River Kids from extracted letter-learning mode" || true

gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push

echo "Created and pushed: $REPO_NAME"
popd >/dev/null
