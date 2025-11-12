# Vercel Deployment Script for Audience Builder
# This script helps you deploy to Vercel quickly

Write-Host "🚀 Audience Builder - Vercel Deployment Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
Write-Host "Checking for Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing globally..." -ForegroundColor Red
    npm install -g vercel
    Write-Host "✅ Vercel CLI installed!" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel CLI found!" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Before deploying, make sure you have:" -ForegroundColor Yellow
Write-Host "   1. A Vercel account (https://vercel.com)" -ForegroundColor White
Write-Host "   2. Your database credentials ready" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Ready to deploy? (y/n)"

if ($continue -ne "y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "🔑 Logging into Vercel..." -ForegroundColor Cyan
vercel login

Write-Host ""
Write-Host "🏗️  Building and deploying to Vercel..." -ForegroundColor Cyan
Write-Host "   (Follow the prompts - accept defaults for first deployment)" -ForegroundColor Gray
Write-Host ""

vercel

Write-Host ""
Write-Host "✅ Deployment initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Go to https://vercel.com/dashboard" -ForegroundColor White
Write-Host "   2. Click on your 'audience-builder-dashboard' project" -ForegroundColor White
Write-Host "   3. Go to Settings → Environment Variables" -ForegroundColor White
Write-Host "   4. Add these variables from your env.example:" -ForegroundColor White
Write-Host "      • DB_SERVER" -ForegroundColor Gray
Write-Host "      • DB_DATABASE" -ForegroundColor Gray
Write-Host "      • DB_USER" -ForegroundColor Gray
Write-Host "      • DB_PASSWORD" -ForegroundColor Gray
Write-Host "      • DB_PORT" -ForegroundColor Gray
Write-Host "      • NEXT_PUBLIC_APP_NAME" -ForegroundColor Gray
Write-Host "   5. Run this script again to deploy with environment variables" -ForegroundColor White
Write-Host ""
Write-Host "📚 For more details, see FIREBASE_DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan

