@echo off
REM Manual Rollback Script
SETLOCAL EnableDelayedExpansion

SET ENVIRONMENT=%1
SET ROLLBACK_COUNT=%2

IF "%ROLLBACK_COUNT%"=="" SET ROLLBACK_COUNT=1

IF "%ENVIRONMENT%"=="" (
    echo ERROR: Environment not specified!
    echo Usage: rollback.bat [dev^|qa^|prod] [count]
    exit /b 1
)

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
    echo ERROR: Invalid environment
    exit /b 1
)

SET SCRIPT_DIR=%CD%
cd ..

IF NOT EXIST "%PROPS_FILE%" (
    echo ERROR: Properties file not found: %PROPS_FILE%
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

IF /I "%ENVIRONMENT%"=="prod" (
    echo *** PRODUCTION ENVIRONMENT ***
    echo.
    SET /P CONFIRM1="Type 'ROLLBACK' to confirm (case-sensitive): "
    IF NOT "!CONFIRM1!"=="ROLLBACK" (
        echo Rollback cancelled.
        cd "%SCRIPT_DIR%"
        exit /b 0
    )
)

SET /P CONFIRM="Are you sure you want to continue? (Y/N): "
IF /I NOT "%CONFIRM%"=="Y" (
    echo Rollback cancelled.
    cd "%SCRIPT_DIR%"
    exit /b 0
)

echo.
echo ============================================
echo Starting rollback...
echo ============================================
echo.

REM Show current status
echo [Step 1/3] Current database status:
call liquibase --defaults-file=%PROPS_FILE% status
echo.

REM Execute rollback
echo [Step 2/3] Executing rollback of %ROLLBACK_COUNT% changeset(s)...
echo.
call liquibase --defaults-file=%PROPS_FILE% rollback-count %ROLLBACK_COUNT%

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================
    echo ERROR: Rollback failed!
    echo ============================================
    cd "%SCRIPT_DIR%"
    exit /b 1
)

echo.
echo [Step 3/3] Verifying new database status:
call liquibase --defaults-file=%PROPS_FILE% status
echo.
echo ============================================
echo SUCCESS: Rollback completed!
echo ============================================
echo.

cd "%SCRIPT_DIR%"
ENDLOCAL
exit /b 0