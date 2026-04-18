@echo off
set "MSVC_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64"
set "PATH=%MSVC_PATH%;%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0"
npm run tauri dev
