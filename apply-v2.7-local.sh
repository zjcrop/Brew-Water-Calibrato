#!/usr/bin/env bash
set -euo pipefail
python3 scripts/patch_brew_water_v2_7.py --root . --check
python3 scripts/patch_brew_water_v2_7.py --root . --in-place --backup
