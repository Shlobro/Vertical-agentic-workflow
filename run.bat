@echo off
setlocal EnableDelayedExpansion

:: Add MSVC and Cargo to PATH for this session
set "MSVC_BASE=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
if exist "%MSVC_BASE%" (
    for /f "delims=" %%d in ('dir /b /ad "%MSVC_BASE%" 2^>nul') do set "MSVC_VER=%%d"
    if defined MSVC_VER set "PATH=%MSVC_BASE%\!MSVC_VER!\bin\Hostx64\x64;%PATH%"
)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

cd /d "%~dp0"

:: Ensure node_modules are present
if not exist "node_modules" (
    echo [INFO] node_modules not found, running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Vertical...
call npx tauri dev
endlocal
