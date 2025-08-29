#!/bin/bash

# Health Check Script for Chat App
# Run this after deployment to verify everything is working

BACKEND_URL=${1:-"http://localhost:3000"}
FRONTEND_URL=${2:-"http://localhost:5173"}

echo "🔍 Chat App Health Check"
echo "========================"
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Check backend health
echo "🏥 Checking backend health..."
if curl -s -f "$BACKEND_URL/health" > /dev/null; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

# Check backend API
echo "🔗 Checking backend API..."
if curl -s -f "$BACKEND_URL/api/messages" > /dev/null; then
    echo "✅ Backend API accessible"
else
    echo "❌ Backend API not accessible"
fi

# Check frontend
echo "🌐 Checking frontend..."
if curl -s -f "$FRONTEND_URL" > /dev/null; then
    echo "✅ Frontend accessible"
else
    echo "❌ Frontend not accessible"
fi

# Check MongoDB connection (via backend)
echo "🗄️  Checking database connection..."
if curl -s "$BACKEND_URL/health" | grep -q "database.*connected"; then
    echo "✅ Database connection OK"
else
    echo "⚠️  Database connection status unknown"
fi

# Check Socket.io
echo "🔌 Checking Socket.io connection..."
if curl -s -f "$BACKEND_URL/socket.io/?EIO=4&transport=polling" > /dev/null; then
    echo "✅ Socket.io accessible"
else
    echo "❌ Socket.io not accessible"
fi

echo ""
echo "🎯 Manual Testing Checklist:"
echo "□ Visit frontend URL and register a user"
echo "□ Login with the registered user"
echo "□ Send a test message"
echo "□ Test semantic search functionality"
echo "□ Check performance dashboard at /dashboard"
echo "□ Test real-time messaging between users"

echo ""
echo "📊 Performance Monitoring:"
echo "□ Visit $BACKEND_URL/dashboard for metrics"
echo "□ Check connection counts and message throughput"
echo "□ Monitor memory and CPU usage"

echo ""
echo "🔧 Troubleshooting:"
echo "□ Check browser console for JavaScript errors"
echo "□ Verify environment variables are set correctly"
echo "□ Check server logs for backend errors"
echo "□ Ensure MongoDB Atlas IP whitelist includes deployment IPs"
