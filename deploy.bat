@echo off
REM Chat App Deployment Script for Windows
REM This script helps with local testing before deployment

echo 🚀 Chat App Deployment Helper
echo =============================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Build and test backend
echo.
echo 🔧 Building backend...
cd backend

if not exist ".env" (
    echo ⚠️  .env file not found. Copying from .env.example...
    copy .env.example .env
    echo 📝 Please edit .env file with your actual values before deployment
)

REM Install dependencies
echo 📦 Installing backend dependencies...
call npm install

REM Build Docker image
echo 🐳 Building Docker image...
docker build -t chatapp-backend .

echo ✅ Backend build complete

REM Build and test frontend
echo.
echo 🔧 Building frontend...
cd ../frontend

if not exist ".env.local" (
    echo ⚠️  .env.local file not found. Copying from .env.example...
    copy .env.example .env.local
    echo 📝 Please edit .env.local file with your actual values
)

REM Install dependencies
echo 📦 Installing frontend dependencies...
call npm install

REM Build for production
echo 🏗️  Building frontend for production...
call npm run build

echo ✅ Frontend build complete

echo.
echo 🎉 Local build complete!
echo.
echo Next steps:
echo 1. Set up MongoDB Atlas database
echo 2. Update environment variables in .env files
echo 3. Deploy backend to Render
echo 4. Deploy frontend to Vercel
echo 5. Update CORS settings
echo.
echo 📖 See DEPLOYMENT_GUIDE.md for detailed instructions

pause
