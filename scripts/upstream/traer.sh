#!/usr/bin/env bash
# Trae un commit de MCM App al fork: quita el prefijo mcm-app/ y deja fuera lo
# que no es de la app. Uso: scripts/upstream/traer.sh <sha>
set -euo pipefail
[ $# -eq 1 ] || { echo "uso: $0 <sha de mcmapp>" >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"
git remote get-url upstream >/dev/null 2>&1 ||
  git remote add upstream https://github.com/mcmespana/mcmapp
git fetch -q upstream
git format-patch -1 "$1" --relative=mcm-app --stdout | git am -3
