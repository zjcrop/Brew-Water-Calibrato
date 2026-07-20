@echo off
python scripts\patch_brew_water_v2_6_1.py --root . --check
if errorlevel 1 exit /b %errorlevel%
python scripts\patch_brew_water_v2_6_1.py --root . --in-place --backup
if errorlevel 1 exit /b %errorlevel%
echo v2.6.1 patch applied. Review index.html before commit.
