# Arroyyan API Testing Script
# Test all endpoints of the deployed API

$baseUrl = "https://arroyyan.karnarupa.workers.dev"

Write-Host "🧪 Arroyyan API Testing" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Test Health Endpoint
Write-Host "📡 Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -TimeoutSec 30
    Write-Host "✅ Health Check: $($response.StatusCode) OK" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test Health Ready Endpoint
Write-Host "📡 Testing Health Ready Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health/ready" -Method Get -TimeoutSec 30
    Write-Host "✅ Health Ready: $($response.StatusCode) OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Health Ready Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test Health Live Endpoint
Write-Host "📡 Testing Health Live Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health/live" -Method Get -TimeoutSec 30
    Write-Host "✅ Health Live: $($response.StatusCode) OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Health Live Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 API Testing Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Base URL: $baseUrl" -ForegroundColor White
Write-Host ""
Write-Host "Available Endpoints:" -ForegroundColor White
Write-Host "  GET  /health          - Health status" -ForegroundColor Gray
Write-Host "  GET  /health/ready    - Readiness check" -ForegroundColor Gray
Write-Host "  GET  /health/live     - Liveness check" -ForegroundColor Gray
Write-Host "  POST /auth/signup     - Create account" -ForegroundColor Gray
Write-Host "  POST /auth/signin     - Sign in" -ForegroundColor Gray
Write-Host "  GET  /auth/session    - Get session" -ForegroundColor Gray
Write-Host "  POST /auth/signout    - Sign out" -ForegroundColor Gray
Write-Host "  GET  /todos           - List todos (protected)" -ForegroundColor Gray
Write-Host "  POST /todos           - Create todo (protected)" -ForegroundColor Gray
Write-Host "  GET  /todos/:id       - Get todo (protected)" -ForegroundColor Gray
Write-Host "  PATCH /todos/:id      - Update todo (protected)" -ForegroundColor Gray
Write-Host "  DELETE /todos/:id     - Delete todo (protected)" -ForegroundColor Gray
