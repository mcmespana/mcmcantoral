#!/usr/bin/env bash
# Lleva un commit del fork a un clon de MCM App: le vuelve a poner el prefijo
# mcm-app/. Uso: scripts/upstream/llevar.sh <sha> <ruta al clon de mcmapp>
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: $0 <sha> <ruta a mcmapp>" >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"
git format-patch -1 "$1" --stdout | git -C "$2" am -3 --directory=mcm-app
