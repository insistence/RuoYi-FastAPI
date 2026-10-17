@echo off
cd /d "%~dp0.."
call pnpm build:prod
exit /b %errorlevel%
