# PowerShell script to start Next.js with OneDrive compatibility
Write-Host "Starting Next.js development server with OneDrive compatibility..."

# Set environment variables
$env:SKIP_ENV_VALIDATION = "true"
$env:WATCHPACK_POLLING = "true"

# Remove .next directory if it exists
if (Test-Path ".next") {
    Write-Host "Removing .next directory..."
    Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
}

# Start the development server
Write-Host "Starting server on port 3001..."
npm run dev
