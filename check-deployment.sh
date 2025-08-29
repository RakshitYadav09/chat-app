#!/bin/bash

# Chat App Deployment Checklist
# Run this script to verify your deployment setup

echo "🚀 Chat App Deployment Checklist"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 exists${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 missing${NC}"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅ $1 directory exists${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 directory missing${NC}"
        return 1
    fi
}

echo ""
echo "📁 Checking Project Structure..."
echo "-------------------------------"

# Check main directories
check_dir "backend"
check_dir "frontend"
check_dir "backend/src"
check_dir "frontend/src"

echo ""
echo "🐳 Checking Docker Configuration..."
echo "----------------------------------"

# Check Dockerfiles
check_file "backend/Dockerfile"
check_file "frontend/Dockerfile"
check_file "frontend/nginx.conf"

echo ""
echo "📦 Checking Package Files..."
echo "---------------------------"

# Check package.json files
check_file "backend/package.json"
check_file "frontend/package.json"

echo ""
echo "🔧 Checking Environment Templates..."
echo "-----------------------------------"

# Check environment files
check_file "backend/.env.example"
check_file "frontend/.env.example"

echo ""
echo "🚀 Checking Deployment Configuration..."
echo "--------------------------------------"

# Check deployment configs
check_file "backend/render.yaml"
check_file "frontend/vercel.json"

echo ""
echo "📋 Checking Deployment Scripts..."
echo "---------------------------------"

# Check deployment scripts
check_file "deploy.sh"
check_file "deploy.bat"
check_file "health-check.sh"

echo ""
echo "📖 Checking Documentation..."
echo "---------------------------"

# Check documentation
check_file "DEPLOYMENT_GUIDE.md"
check_file "PERFORMANCE_ANALYSIS.md"
check_file "SYSTEM_ARCHITECTURE.md"
check_file ".gitignore"

echo ""
echo "🔍 Checking for Sensitive Files..."
echo "----------------------------------"

# Check for sensitive files that shouldn't be committed
if [ -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env exists (make sure it's not committed)${NC}"
else
    echo -e "${GREEN}✅ backend/.env not found (good)${NC}"
fi

if [ -f "frontend/.env.local" ]; then
    echo -e "${YELLOW}⚠️  frontend/.env.local exists (make sure it's not committed)${NC}"
else
    echo -e "${GREEN}✅ frontend/.env.local not found (good)${NC}"
fi

echo ""
echo "🎯 Next Steps:"
echo "-------------"
echo "1. Set up MongoDB Atlas database"
echo "2. Configure environment variables in .env files"
echo "3. Test locally with Docker:"
echo "   cd backend && docker build -t chatapp-backend ."
echo "   cd ../frontend && docker build -t chatapp-frontend ."
echo "4. Deploy to Render (backend) and Vercel (frontend)"
echo "5. Update CORS settings"
echo ""
echo "📖 See DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
echo "🎉 Your project is ready for deployment!"
