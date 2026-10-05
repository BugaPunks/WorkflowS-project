@echo off
setlocal enabledelayedexpansion

REM Wrapper de Windows para scripts/switch-db.sh
REM Necesario porque npm en Windows ejecuta los scripts con cmd.exe, que no
REM sabe ejecutar archivos .sh. Ademas invoca Git Bash de forma explicita:
REM el "bash" del PATH de Windows es el stub de WSL (WindowsApps\bash.exe),
REM desde donde PostgreSQL no es alcanzable.

REM Ir a la raiz del proyecto
cd /d "%~dp0.."

set "BASH="

REM Si el usuario ya definio BASH (o BASH_GIT), se respeta esa ruta
if not "%BASH_GIT%"=="" set "BASH=%BASH_GIT%"

if not defined BASH if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined BASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined BASH if exist "%ProgramW6432%\Git\bin\bash.exe" set "BASH=%ProgramW6432%\Git\bin\bash.exe"

if not defined BASH (
    echo [X] No se encontro Git Bash.
    echo.
    echo     Instala Git for Windows desde https://git-scm.com/download/win
    echo     o defines la variable BASH_GIT con la ruta a bash.exe:
    echo.
    echo         set BASH_GIT=C:\ruta\a\Git\bin\bash.exe
    echo.
    echo     Alternativa en WSL: npm run switch-db:sh
    exit /b 1
)

REM Comprobar que no sea el stub de WSL
echo "!BASH!" | find /i "WindowsApps" >nul 2>&1
if not errorlevel 1 (
    echo [X] BASH apunta al stub de WSL: !BASH!
    echo     Configurame Git Bash en su lugar:
    echo         set BASH_GIT=C:\Program Files\Git\bin\bash.exe
    exit /b 1
)

"!BASH!" ./scripts/switch-db.sh %*
exit /b %ERRORLEVEL%