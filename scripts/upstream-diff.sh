#!/usr/bin/env bash
# Enseña qué ficheros de la zona espejo difieren de MCM App (`upstream/main`).
# Uso: scripts/upstream-diff.sh [--stat]   (docs/DIVERGENCIAS.md §4)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git remote get-url upstream >/dev/null 2>&1 ||
  git remote add upstream https://github.com/mcmespana/mcmapp
git fetch -q upstream main
grep -v '^#' scripts/upstream/zona-espejo.txt | sed '/^$/d' | while read -r ruta; do
  if ! git cat-file -e "upstream/main:mcm-app/${ruta%/}" 2>/dev/null; then
    echo "solo aquí: $ruta"
    continue
  fi
  if [ "${1:-}" = "--stat" ]; then
    git diff --stat "upstream/main:mcm-app/${ruta%/}" "HEAD:${ruta%/}" 2>/dev/null || true
  elif ! git diff --quiet "upstream/main:mcm-app/${ruta%/}" "HEAD:${ruta%/}" 2>/dev/null; then
    echo "difiere:   $ruta"
  fi
done
