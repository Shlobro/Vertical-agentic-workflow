@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  Vertical - Full Environment Setup
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Please run this script as Administrator.
    pause
    exit /b 1
)

goto :main

:: ------------------------------------------------------------
:: Subroutine: sets %FOUND% to 1 if command in %1 exists
:: ------------------------------------------------------------
:check_cmd
set "FOUND=0"
where %1 >nul 2>&1
if %errorlevel% equ 0 set "FOUND=1"
exit /b 0

:: ============================================================
:main
:: ============================================================

:: ------------------------------------------------------------
:: 1. Node.js (LTS)
:: ------------------------------------------------------------
call :check_cmd node
if "!FOUND!"=="1" (
    echo [SKIP] Node.js already installed.
    goto :node_done
)
echo [INSTALL] Installing Node.js LTS via winget...
winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements -e
if !errorlevel! neq 0 (
    echo ERROR: Failed to install Node.js.
    pause
    exit /b 1
)
echo [OK] Node.js installed.
:node_done

:: ------------------------------------------------------------
:: 2. Rust (rustup)
:: ------------------------------------------------------------
call :check_cmd rustup
if "!FOUND!"=="1" (
    echo [SKIP] Rust already installed.
    goto :rust_done
)
echo [INSTALL] Installing Rust via winget...
winget install --id Rustlang.Rustup --accept-package-agreements --accept-source-agreements -e
if !errorlevel! neq 0 (
    echo ERROR: Failed to install Rust.
    pause
    exit /b 1
)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
echo [OK] Rust installed.
:rust_done

:: ------------------------------------------------------------
:: 3. MSVC Build Tools
:: ------------------------------------------------------------
set "CL_FOUND=0"
where cl >nul 2>&1
if %errorlevel% equ 0 set "CL_FOUND=1"
if "!CL_FOUND!"=="0" (
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" set "CL_FOUND=1"
)
if "!CL_FOUND!"=="0" (
    if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" set "CL_FOUND=1"
)
if "!CL_FOUND!"=="1" (
    echo [SKIP] MSVC Build Tools already present.
    goto :msvc_done
)

echo [INSTALL] Downloading MSVC Build Tools installer...
if exist "%TEMP%\vsbt" rmdir /s /q "%TEMP%\vsbt"
winget download --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements -e --download-directory "%TEMP%\vsbt" >nul 2>&1

set "VS_INSTALLER="
for /f "delims=" %%f in ('dir /b /s "%TEMP%\vsbt\*.exe" 2^>nul') do set "VS_INSTALLER=%%f"

if not defined VS_INSTALLER (
    echo ERROR: Could not find downloaded MSVC installer in %TEMP%\vsbt
    pause
    exit /b 1
)

echo [INSTALL] Running MSVC Build Tools installer (this may take several minutes)...
"!VS_INSTALLER!" --quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended
if !errorlevel! neq 0 (
    echo ERROR: MSVC Build Tools installation failed.
    pause
    exit /b 1
)
echo [OK] MSVC Build Tools installed.
:msvc_done

:: ------------------------------------------------------------
:: 4. WebView2 Runtime
:: ------------------------------------------------------------
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>&1
if %errorlevel% equ 0 (
    echo [SKIP] WebView2 Runtime already installed.
    goto :webview2_done
)
reg query "HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>&1
if %errorlevel% equ 0 (
    echo [SKIP] WebView2 Runtime already installed.
    goto :webview2_done
)
echo [INSTALL] Installing Microsoft WebView2 Runtime via winget...
winget install --id Microsoft.EdgeWebView2Runtime --accept-package-agreements --accept-source-agreements -e
if !errorlevel! neq 0 (
    echo ERROR: Failed to install WebView2 Runtime.
    pause
    exit /b 1
)
echo [OK] WebView2 Runtime installed.
:webview2_done

:: ------------------------------------------------------------
:: 5. Claude Code CLI
:: ------------------------------------------------------------
call :check_cmd claude
if "!FOUND!"=="1" (
    echo [SKIP] Claude CLI already installed.
    goto :claude_done
)
echo [INSTALL] Installing Claude Code CLI via npm...
call npm install -g @anthropic-ai/claude-code
if !errorlevel! neq 0 (
    echo ERROR: Failed to install Claude CLI.
    pause
    exit /b 1
)
echo [OK] Claude CLI installed.
:claude_done

:: ------------------------------------------------------------
:: 6. OpenAI Codex CLI
:: ------------------------------------------------------------
call :check_cmd codex
if "!FOUND!"=="1" (
    echo [SKIP] Codex CLI already installed.
    goto :codex_done
)
echo [INSTALL] Installing OpenAI Codex CLI via npm...
call npm install -g @openai/codex
if !errorlevel! neq 0 (
    echo ERROR: Failed to install Codex CLI.
    pause
    exit /b 1
)
echo [OK] Codex CLI installed.
:codex_done

:: ------------------------------------------------------------
:: 7. Gemini CLI
:: ------------------------------------------------------------
call :check_cmd gemini
if "!FOUND!"=="1" (
    echo [SKIP] Gemini CLI already installed.
    goto :gemini_done
)
echo [INSTALL] Installing Gemini CLI via npm...
call npm install -g @google/gemini-cli
if !errorlevel! neq 0 (
    echo ERROR: Failed to install Gemini CLI.
    pause
    exit /b 1
)
echo [OK] Gemini CLI installed.
:gemini_done

:: ------------------------------------------------------------
:: 8. Project npm dependencies
:: ------------------------------------------------------------
echo.
echo [INSTALL] Installing project npm dependencies...
cd /d "%~dp0"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)
echo [OK] npm dependencies installed.

echo.
echo ============================================================
echo  Setup complete! Close this window, then run run.bat.
echo  (PATH changes from new installs need a fresh terminal.)
echo ============================================================
echo.
pause
endlocal
