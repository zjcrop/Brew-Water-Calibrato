@echo off
python scripts\patch_brew_water_v2_7.py --root . --check
if errorlevel 1 exit /b %errorlevel%
python scripts\patch_brew_water_v2_7.py --root . --in-place --backup
