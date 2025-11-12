# Firebase Deployment Script for Audience Builder
# WARNING: This creates a STATIC export without database connectivity
# For full functionality, use Vercel instead (see FIREBASE_DEPLOYMENT_GUIDE.md)

Write-Host "🔥 Audience Builder - Firebase Static Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  WARNING: This deploys a STATIC version without database!" -ForegroundColor Red
Write-Host "   API routes will NOT work." -ForegroundColor Yellow
Write-Host "   For full functionality, use Vercel - see FIREBASE_DEPLOYMENT_GUIDE.md" -ForegroundColor Yellow
Write-Host ""

$continue = Read-Host "Continue with static deployment? y/n"

if ($continue -ne "y") {
    Write-Host "Deployment cancelled. Consider using Vercel instead!" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "📝 Enabling static export in next.config.js..." -ForegroundColor Cyan

# Read the config file
$configPath = "next.config.js"
$configContent = Get-Content $configPath -Raw

# Uncomment the static export lines using backtick escaping
$configContent = $configContent -replace "// output: `'export`',", "output: `'export`',"
$configContent = $configContent -replace "// distDir: `'out`',", "distDir: `'out`',"

# Write back
Set-Content $configPath $configContent

Write-Host "✅ Static export enabled" -ForegroundColor Green
Write-Host ""

Write-Host "🏗️  Building static export..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Reverting config..." -ForegroundColor Red
    
    # Revert the config changes
    $configContent = Get-Content $configPath -Raw
    $configContent = $configContent -replace "output: `'export`',", "// output: `'export`',"
    $configContent = $configContent -replace "distDir: `'out`',", "// distDir: `'out`',"
    Set-Content $configPath $configContent
    
    exit 1
}

Write-Host "✅ Build completed!" -ForegroundColor Green
Write-Host ""

Write-Host "🔑 Logging into Firebase..." -ForegroundColor Cyan
firebase login

Write-Host ""
Write-Host "🚀 Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Reverting next.config.js to development mode..." -ForegroundColor Cyan

# Revert the config changes for development
$configContent = Get-Content $configPath -Raw
$configContent = $configContent -replace "output: `'export`',", "// output: `'export`',"
$configContent = $configContent -replace "distDir: `'out`',", "// distDir: `'out`',"
Set-Content $configPath $configContent

Write-Host "✅ Config reverted for development" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Your app should now be live on Firebase!" -ForegroundColor Cyan
Write-Host "⚠️  Remember: Database features will not work" -ForegroundColor Yellow
