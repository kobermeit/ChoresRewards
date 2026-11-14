@echo off
node "%~dp0scripts\start_app.js" %*
if %ERRORLEVEL% neq 0 (
  pause
)
