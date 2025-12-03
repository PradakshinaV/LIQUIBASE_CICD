@echo off
REM ============================================
REM Manual Rollback Script for Windows
REM ============================================
REM Usage: rollback.bat [dev|qa|prod] [count]
REM Example: rollback.bat dev 1
REM ============================================

SETLOCAL EnableDelayedExpansion

SET ENVIRONMENT=%1
SET ROLLBACK_COUNT=%2

REM Default to 1 if count not specified
IF "%ROLLBACK_COUNT%"=="" SET ROLLBACK_COUNT=1

REM Check if environment is provided
IF "%ENVIRONMENT%"=="" (
    echo.
    echo ERROR: Environment not specified!
    echo.
    echo Usage: rollback.bat [dev^|qa^|prod] [count]
    echo.
    echo Examples:
    echo   rollback.bat dev 1        - Rollback last changeset in DEV
    echo   rollback.bat qa 2         - Rollback last 2 changesets in QA
    echo   rollback.bat prod 1       - Rollback last changeset in PROD
    echo.
    exit /b 1
)

REM Set properties file based on environment
IF /I "%ENVIRONMENT%"=="dev" (
    SET PROPS_FILE=liquibase.properties
    SET ENV_NAME=DEVELOPMENT
) ELSE IF /I "%ENVIRONMENT%"=="qa" (
    SET PROPS_FILE=liquibase.qa.properties
    SET ENV_NAME=QA
) ELSE IF /I "%ENVIRONMENT%"=="prod" (
    SET PROPS_FILE=liquibase.prod.properties
    SET ENV_NAME=PRODUCTION
) ELSE (
    echo.
    echo ERROR: Invalid environment '%ENVIRONMENT%'
    echo Valid options: dev, qa, prod
    echo.
    exit /b 1
)

REM Save current directory
SET SCRIPT_DIR=%CD%

REM Change to liquibase directory (parent of scripts)
cd ..

REM Check if properties file exists
IF NOT EXIST "%PROPS_FILE%" (
    echo.
    echo ERROR: Properties file not found: %PROPS_FILE%
    echo Please ensure you're running this script from the scripts folder.
    echo.
    cd "%SCRIPT_DIR%"
    exit /b 1
)

echo.
echo ============================================
echo     DATABASE ROLLBACK WARNING
echo ============================================
echo Environment: %ENV_NAME%
echo Changesets to rollback: %ROLLBACK_COUNT%
echo Properties file: %PROPS_FILE%
echo.
echo This will UNDO the last %ROLLBACK_COUNT% database change(s).
echo.

REM Extra confirmation for PRODUCTION
IF /I "%ENVIRONMENT%"=="prod" (
    echo *** PRODUCTION ENVIRONMENT ***
    echo.
    SET /P CONFIRM1="Type 'ROLLBACK' to confirm (case-sensitive): "
    IF NOT "!CONFIRM1!"=="ROLLBACK" (
        echo.
        echo Rollback cancelled.
        cd "%SCRIPT_DIR%"
        exit /b 0
    )
)

SET /P CONFIRM="Are you sure you want to continue? (Y/N): "
IF /I NOT "%CONFIRM%"=="Y" (
    echo.
    echo Rollback cancelled.
    cd "%SCRIPT_DIR%"
    exit /b 0
)

echo.
echo ============================================
echo Starting rollback...
echo ============================================
echo.

REM Show current status before rollback
echo Current database status:
liquibase --defaults-file=%PROPS_FILE% status
echo.

REM Perform rollback
echo Rolling back %ROLLBACK_COUNT% changeset(s)...
liquibase --defaults-file=%PROPS_FILE% rollback-count %ROLLBACK_COUNT%

IF %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo SUCCESS: Rollback completed successfully!
    echo ============================================
    echo.
    echo New database status:
    liquibase --defaults-file=%PROPS_FILE% status
    echo.
) ELSE (
    echo.
    echo ============================================
    echo ERROR: Rollback failed!
    echo ============================================
    echo Check the error messages above.
    echo.
    cd "%SCRIPT_DIR%"
    exit /b 1
)

REM Return to script directory
cd "%SCRIPT_DIR%"

ENDLOCAL
exit /b 0