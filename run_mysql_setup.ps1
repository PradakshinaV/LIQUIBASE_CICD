# MySQL Setup Script
# Usage: .\run_mysql_setup.ps1 -Password "your_mysql_root_password"

param(
    [Parameter(Mandatory=$false)]
    [string]$Password = ""
)

$sqlFile = "setup_databases.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "Error: $sqlFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Executing MySQL setup script..." -ForegroundColor Green

if ($Password -eq "") {
    # Prompt for password
    $securePassword = Read-Host "Enter MySQL root password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Execute SQL file
$env:MYSQL_PWD = $Password
Get-Content $sqlFile | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root --password=$Password 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMySQL setup completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nMySQL setup completed with errors. Check output above." -ForegroundColor Yellow
}

# Clear password from environment
Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue


