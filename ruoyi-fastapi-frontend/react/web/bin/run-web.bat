@echo off
cd /d "%~dp0.."
call pnpm dev
exit /b %errorlevel%
