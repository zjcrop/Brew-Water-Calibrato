#!/usr/bin/env bash
set -euo pipefail
python3 scripts/patch_brew_water_v2_6_1.py --root . --check
python3 scripts/patch_brew_water_v2_6_1.py --root . --in-place --backup
echo "v2.6.1 patch applied. Review index.html before commit."
