@echo off
echo.
echo [��Ϣ] ʹ�� Vue CLI �������� Web ���̡�
echo.

%~d0
cd %~dp0

cd ..
call pnpm run dev

pause