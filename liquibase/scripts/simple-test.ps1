# Simple Monitoring Test - No fancy formatting
# Save as: C:\LIQUIBASE_CICD\simple-test.ps1

$baseUrl = "http://localhost:3000"

Write-Host ""
Write-Host "Testing Monitoring Endpoints..."
Write-Host ""

# Test 1
Write-Host "[1/6] Health Check"
try {
    $r = Invoke-WebRequest "$baseUrl/health" -UseBasicParsing
    Write-Host "PASS - Server is running" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Server not running" -ForegroundColor Red
    Write-Host "Start backend: cd dashboard\backend; npm start"
    exit
}

# Test 2
Write-Host "[2/6] Execution Times"
try {
    $r = Invoke-WebRequest "$baseUrl/api/monitoring/execution-times?env=dev" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    Write-Host "PASS - Found $($d.count) changesets" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Endpoint not working" -ForegroundColor Red
}

# Test 3
Write-Host "[3/6] Author Stats"
try {
    $r = Invoke-WebRequest "$baseUrl/api/monitoring/author-stats?env=all" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    Write-Host "PASS - Found $($d.count) authors" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Endpoint not working" -ForegroundColor Red
}

# Test 4
Write-Host "[4/6] Deployment Frequency"
try {
    $r = Invoke-WebRequest "$baseUrl/api/monitoring/deployment-frequency?days=30" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    Write-Host "PASS - $($d.totalDeployments) deployments" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Endpoint not working" -ForegroundColor Red
}

# Test 5
Write-Host "[5/6] Success Rate"
try {
    $r = Invoke-WebRequest "$baseUrl/api/monitoring/success-rate?env=all" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    Write-Host "PASS - Success rate: $($d.successRate)%" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Endpoint not working" -ForegroundColor Red
}

# Test 6
Write-Host "[6/6] Audit Trail"
try {
    $r = Invoke-WebRequest "$baseUrl/api/monitoring/audit-trail?env=all&limit=10" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    Write-Host "PASS - Found $($d.count) records" -ForegroundColor Green
} catch {
    Write-Host "FAIL - Endpoint not working" -ForegroundColor Red
}

Write-Host ""
Write-Host "DONE! Open monitoring.html in browser"
Write-Host ""