@echo off
echo.
echo [��Ϣ] ���Web���̣�����dist�ļ���
echo.

%~d0
cd %~dp0

cd ..
call pnpm build:prod

pause