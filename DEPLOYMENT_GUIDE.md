# 🚀 Chat App Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying your chat application with semantic search and performance monitoring to production.

## 📋 Prerequisites

- Node.js 18+ installed
- Docker installed (for local testing)
- MongoDB Atlas account
- Vercel account (frontend)
- Render account (backend)
- GitHub repository

## 🏗️ Step 1: Local Testing with Docker

### 1.1 Build and Test Backend Locally

```bash
# Navigate to backend directory
cd backend

# Build Docker image
docker build -t chatapp-backend .

# Run backend container
docker run -p 3000:3000 -e NODE_ENV=development chatapp-backend

# Test health endpoint
curl http://localhost:3000/health
```

### 1.2 Build and Test Frontend Locally

```bash
# Navigate to frontend directory
cd ../frontend

# Build Docker image
docker build -t chatapp-frontend .

# Run frontend container
docker run -p 5173:5173 -e VITE_API_BASE_URL=http://localhost:3000 chatapp-frontend

# Open browser to http://localhost:5173
```

### 1.3 Test Full Application

1. Open http://localhost:5173 in your browser
2. Register a new user
3. Send test messages
4. Test semantic search functionality
5. Check performance monitoring at http://localhost:3000/dashboard

## 🗄️ Step 2: Set Up MongoDB Atlas

### 2.1 Create MongoDB Atlas Cluster

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a new project
3. Create a free M0 cluster
4. Create a database user with read/write permissions
5. Whitelist IP addresses (0.0.0.0/0 for cloud deployment)

### 2.2 Get Connection String

1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string
4. Replace `<username>` and `<password>` with your database user credentials

**Example Connection String:**
```
mongodb+srv://chatapp_user:mySecurePassword@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority
```

## 🔧 Step 3: Configure Environment Variables

### 3.1 Backend Environment Setup

```bash
# Copy environment template
cd backend
cp .env.example .env

# Edit .env with your values
```

**Required Backend Environment Variables:**
```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
CORS_ORIGIN=https://your-frontend-url.vercel.app
ENABLE_PERFORMANCE_MONITORING=true
```

### 3.2 Frontend Environment Setup

```bash
# Copy environment template
cd ../frontend
cp .env.example .env.local

# Edit .env.local with your values
```

**Required Frontend Environment Variables:**
```bash
VITE_API_BASE_URL=https://your-backend-url.onrender.com
VITE_SOCKET_URL=https://your-backend-url.onrender.com
```

## 📦 Step 4: Deploy Backend to Render

### 4.1 Connect Repository

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `backend` folder as the root directory

### 4.2 Configure Service

**Basic Settings:**
- **Name:** `chatapp-backend`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Environment Variables:**
```
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_super_secret_jwt_key
CORS_ORIGIN=https://your-frontend-url.vercel.app
ENABLE_PERFORMANCE_MONITORING=true
```

### 4.3 Advanced Settings

- **Plan:** Starter (free tier)
- **Region:** Oregon (or closest to your users)
- **Health Check Path:** `/health`
- **Auto-Deploy:** Enable for main branch

### 4.4 Deploy

1. Click "Create Web Service"
2. Wait for deployment to complete (5-10 minutes)
3. Note the service URL (e.g., `https://chatapp-backend.onrender.com`)

## 🌐 Step 5: Deploy Frontend to Vercel

### 5.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 5.2 Environment Variables

```
VITE_API_BASE_URL=https://your-backend-url.onrender.com
VITE_SOCKET_URL=https://your-backend-url.onrender.com
```

### 5.3 Deploy

1. Click "Deploy"
2. Wait for deployment to complete (2-5 minutes)
3. Note the deployment URL (e.g., `https://chatapp-frontend.vercel.app`)

## 🔄 Step 6: Update CORS Configuration

### 6.1 Update Backend CORS

1. Go to Render dashboard
2. Select your backend service
3. Go to Environment → Environment Variables
4. Update `CORS_ORIGIN` with your Vercel frontend URL
5. Redeploy the backend service

## ✅ Step 7: Testing Deployment

### 7.1 Health Check

```bash
# Test backend health
curl https://your-backend-url.onrender.com/health

# Test frontend accessibility
curl https://your-frontend-url.vercel.app
```

### 7.2 Functional Testing

1. Visit your frontend URL
2. Register a new user account
3. Send test messages between users
4. Test real-time messaging
5. Test semantic search functionality
6. Check performance dashboard at `/dashboard`

### 7.3 Performance Monitoring

- Visit `https://your-backend-url.onrender.com/dashboard`
- Monitor connection counts
- Check message throughput
- Review system health metrics

## 🛠️ Step 8: Troubleshooting

### Common Issues

**Backend Deployment Issues:**
- **Build fails:** Check that all dependencies are in `package.json`
- **MongoDB connection:** Verify connection string and IP whitelist
- **CORS errors:** Ensure `CORS_ORIGIN` matches frontend URL exactly

**Frontend Deployment Issues:**
- **Build fails:** Check that environment variables are set correctly
- **API calls fail:** Verify `VITE_API_BASE_URL` points to correct backend
- **Socket connection:** Ensure `VITE_SOCKET_URL` matches backend

**Database Issues:**
- **Connection timeout:** Check MongoDB Atlas IP whitelist
- **Authentication failed:** Verify username/password in connection string

### Logs and Debugging

**Render Logs:**
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. Check for error messages

**Vercel Logs:**
1. Go to Vercel dashboard
2. Select your project
3. Click "Functions" or "Deployments"
4. Check build and runtime logs

## 📊 Step 9: Monitoring and Maintenance

### Performance Monitoring

Your application includes built-in performance monitoring:
- **Dashboard:** `https://your-backend-url.onrender.com/dashboard`
- **Metrics:** Connection counts, message throughput, system health
- **Real-time:** Updates every 5 seconds

### Regular Maintenance

1. **Monitor usage:** Check Render/Vercel dashboards for usage limits
2. **Update dependencies:** Keep Node.js packages updated
3. **Backup data:** MongoDB Atlas provides automatic backups
4. **Security:** Regularly rotate JWT secrets and database passwords

## 🚀 Step 10: Going Live

### Final Checklist

- ✅ MongoDB Atlas cluster created and configured
- ✅ Backend deployed to Render successfully
- ✅ Frontend deployed to Vercel successfully
- ✅ Environment variables configured correctly
- ✅ CORS settings updated
- ✅ Health checks passing
- ✅ User registration and login working
- ✅ Real-time messaging functional
- ✅ Semantic search working
- ✅ Performance monitoring accessible

### Production URLs

After successful deployment, you should have:
- **Frontend:** `https://your-app-name.vercel.app`
- **Backend:** `https://your-backend-name.onrender.com`
- **Dashboard:** `https://your-backend-name.onrender.com/dashboard`

## 💡 Pro Tips

1. **Custom Domain:** Add custom domains to both Vercel and Render for professional URLs
2. **SSL Certificates:** Both platforms provide free SSL certificates automatically
3. **Scaling:** Monitor usage and upgrade plans as needed
4. **Backup:** Enable MongoDB Atlas automated backups
5. **CDN:** Vercel provides global CDN for fast content delivery

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review deployment logs on Render/Vercel
3. Verify environment variables are set correctly
4. Test with the health check script included in the repository

---

**🎉 Congratulations!** Your chat application with semantic search is now live and ready for users!
