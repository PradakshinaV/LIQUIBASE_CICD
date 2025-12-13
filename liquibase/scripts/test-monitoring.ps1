# ============================================
# Liquibase Monitoring API Test Script
# Fixed PowerShell Version
# ============================================

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Liquibase Monitoring API Test" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# Test 1: Health Check
Write-Host "[1/6] Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$baseUrl/health" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.status -eq "ok") {
        Write-Host "  ✓ Health Check: PASSED" -ForegroundColor Green
        Write-Host "  Status: $($data.status)" -ForegroundColor Gray
        Write-Host "  Timestamp: $($data.timestamp)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Health Check: FAILED" -ForegroundColor Red
    Write-Host "  Error: Backend not running or not accessible" -ForegroundColor Red
    Write-Host "`nMake sure backend is running:" -ForegroundColor Yellow
    Write-Host "  cd C:\LIQUIBASE_CICD\dashboard\backend" -ForegroundColor White
    Write-Host "  npm start`n" -ForegroundColor White
    exit 1
}

# Test 2: Execution Times
Write-Host "`n[2/6] Testing Execution Times Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$baseUrl/api/monitoring/execution-times?env=dev" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "  ✓ Execution Times: PASSED" -ForegroundColor Green
        Write-Host "  Found: $($data.count) changesets" -ForegroundColor Gray
        if ($data.count -gt 0) {
            Write-Host "  Average Execution: $($data.avgExecutionTime) seconds" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ✗ Execution Times: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Author Statistics
Write-Host "`n[3/6] Testing Author Statistics..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$baseUrl/api/monitoring/author-stats?env=all" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "  ✓ Author Stats: PASSED" -ForegroundColor Green
        Write-Host "  Total Authors: $($data.count)" -ForegroundColor Gray
        
        if ($data.count -gt 0) {
            Write-Host "`n  Top Authors:" -ForegroundColor Cyan
            $data.authors | Select-Object -First 3 | ForEach-Object {
                Write-Host "    - $($_.author): $($_.changesetCount) changesets" -ForegroundColor White
            }
        }
    }
} catch {
    Write-Host "  ✗ Author Stats: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Deployment Frequency
Write-Host "`n[4/6] Testing Deployment Frequency..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$baseUrl/api/monitoring/deployment-frequency?days=30" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "  ✓ Deployment Frequency: PASSED" -ForegroundColor Green
        Write-Host "  Period: $($data.period)" -ForegroundColor Gray
        Write-Host "  Total Deployments: $($data.totalDeployments)" -ForegroundColor Gray
        Write-Host "  Avg per Day: $($data.avgPerDay)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Deployment Frequency: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Success Rate
Write-Host "`n[5/6] Testing Success Rate..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$baseUrl/api/monitoring/success-rate?env=all" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "  ✓ Success Rate: PASSED" -ForegroundColor Green
        Write-Host "  Success Rate: $($data.successRate)%" -ForegroundColor Gray
        Write-Host "  Total: $($data.total) | Success: $($data.successful) | Failed: $($data.failed)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Success Rate: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Audit Trail
Write-Host "`n[6/6] Testing Audit Trail..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest "$baseUrl/api/monitoring/audit-trail?env=all&limit=10" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success -and $data.auditTrail) {
        Write-Host "  ✓ Audit Trail: PASSED" -ForegroundColor Green
        Write-Host "  Records: $($data.count)" -ForegroundColor Gray
        
        if ($data.count -gt 0) {
            Write-Host "`n  Recent Changes:" -ForegroundColor Cyan
            $data.auditTrail | Select-Object -First 5 | ForEach-Object {
                Write-Host "    - [$($_.env)] $($_.id) by $($_.author)" -ForegroundColor White
            }
        }
    }
} catch {
    Write-Host "  ✗ Audit Trail: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "✅ TEST SUITE COMPLETED" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Open monitoring dashboard:" -ForegroundColor White
Write-Host "     C:\LIQUIBASE_CICD\dashboard\monitoring.html" -ForegroundColor Gray
Write-Host "`n  2. Verify all tabs load with data" -ForegroundColor White
Write-Host "`n  3. Take screenshots for documentation`n" -ForegroundColor White

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')