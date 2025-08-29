#!/bin/bash

# Chat App Deployment Script
# This script helps with local testing before deployment

echo "🚀 Chat App Deployment Helper"
echo "============================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Build and test backend
echo ""
echo "🔧 Building backend..."
cd backend

if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your actual values before deployment"
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t chatapp-backend .

echo "✅ Backend build complete"

# Build and test frontend
echo ""
echo "🔧 Building frontend..."
cd ../frontend

if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local file not found. Copying from .env.example..."
    cp .env.example .env.local
    echo "📝 Please edit .env.local file with your actual values"
fi

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Build for production
echo "🏗️  Building frontend for production..."
npm run build

echo "✅ Frontend build complete"

echo ""
echo "🎉 Local build complete!"
echo ""
echo "Next steps:"
echo "1. Set up MongoDB Atlas database"
echo "2. Update environment variables in .env files"
echo "3. Deploy backend to Render"
echo "4. Deploy frontend to Vercel"
echo "5. Update CORS settings"
echo ""
echo "📖 See DEPLOYMENT_GUIDE.md for detailed instructions"
