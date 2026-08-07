@echo off
cd /d "%~dp0"
echo Starting Tarot Desktop...
call pnpm --filter @tarot/desktop dev
pause
