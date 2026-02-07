# Initialize Liquibase for QA and PROD databases
# This script creates the DATABASECHANGELOG table by running Liquibase update

param(
    [Parameter(Mandatory=$false)]
    [string]$LiquibasePath = "C:\Program Files\liquibase\liquibase.bat"
)

$liquibaseDir = Join-Path $PSScriptRoot "liquibase"

if (-not (Test-Path $LiquibasePath)) {
    Write-Host "Error: Liquibase not found at $LiquibasePath" -ForegroundColor Red
    Write-Host "Please install Liquibase or update the path." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Initializing Liquibase for QA and PROD databases ===" -ForegroundColor Cyan
Write-Host ""

# Initialize QA database
Write-Host "Initializing QA database..." -ForegroundColor Yellow
Push-Location $liquibaseDir
try {
    & $LiquibasePath --defaults-file=liquibase.qa.properties update
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ QA database initialized successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to initialize QA database" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error initializing QA: $_" -ForegroundColor Red
}
Pop-Location

Write-Host ""

# Initialize PROD database
Write-Host "Initializing PROD database..." -ForegroundColor Yellow
Push-Location $liquibaseDir
try {
    & $LiquibasePath --defaults-file=liquibase.prod.properties update
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PROD database initialized successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to initialize PROD database" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error initializing PROD: $_" -ForegroundColor Red
}
Pop-Location

Write-Host "`n=== Initialization Complete ===" -ForegroundColor Cyan
Write-Host "The DATABASECHANGELOG table should now exist in both QA and PROD databases." -ForegroundColor Green


