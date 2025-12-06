@echo off
SETLOCAL

SET ENVIRONMENT=%1

IF "%ENVIRONMENT%"=="" (
    echo Usage: health-check-simple.bat [dev^|qa^|prod]
    exit /b 1
)

IF /I "%ENVIRONMENT%"=="dev" (
    SET PROPS_FILE=liquibase.properties
) ELSE IF /I "%ENVIRONMENT%"=="qa" (
    SET PROPS_FILE=liquibase.qa.properties
) ELSE IF /I "%ENVIRONMENT%"=="prod" (
    SET PROPS_FILE=liquibase.prod.properties
) ELSE (
    echo Invalid environment
    exit /b 1
)

echo.
echo ============================================
echo DATABASE HEALTH CHECK - %ENVIRONMENT%
echo ============================================
echo.

cd ..

echo [1/3] Testing database connection...
liquibase --defaults-file=%PROPS_FILE% status
IF %ERRORLEVEL% NEQ 0 (
    echo FAILED: Cannot connect
    exit /b 1
)
echo.

echo [2/3] Validating changelog...
liquibase --defaults-file=%PROPS_FILE% validate
IF %ERRORLEVEL% NEQ 0 (
    echo FAILED: Changelog invalid
    exit /b 1
)
echo.

echo [3/3] Health check complete!
echo ============================================
echo.

cd scripts
exit /b 0

