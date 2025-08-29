const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const Message = require('./models/Message');
const embeddingService = require('./utils/embeddings');
const PerformanceMonitor = require('./utils/performanceMonitor');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = process.env.CORS_ORIGIN ? 
        process.env.CORS_ORIGIN.split(',').map(url => url.trim()) : 
        ["http://localhost:5173"];
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize Performance Monitor
const performanceMonitor = new PerformanceMonitor();
console.log('📊 Performance monitoring initialized');

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',').map(url => url.trim()) : 
      ["http://localhost:5173"];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Serve static files (dashboard)
app.use(express.static('public'));

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (req.path.includes('/messages')) {
      performanceMonitor.recordDbOperation('api_request', duration);
    }
  });
  
  next();
});

// Routes
app.use('/users', userRoutes);

// Set up performance monitor for message routes
if (messageRoutes.setPerformanceMonitor) {
  messageRoutes.setPerformanceMonitor(performanceMonitor);
}
app.use('/messages', messageRoutes);

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = performanceMonitor.getSimpleMetrics();
  res.json({
    timestamp: new Date().toISOString(),
    server: 'chat-app-backend',
    metrics
  });
});

// Dashboard redirect
app.get('/dashboard', (req, res) => {
  res.redirect('/dashboard.html');
});

// Health check with performance data
app.get('/health', (req, res) => {
  const health = performanceMonitor.getSystemHealth();
  const metrics = performanceMonitor.getSimpleMetrics();
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    health: health.status,
    activeConnections: metrics.connections.active,
    messagesPerSecond: metrics.messages.perSecond,
    memoryUsageMB: metrics.resources.memoryMB
  });
});

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Chat App Backend API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      dashboard: '/dashboard',
      users: '/users',
      messages: '/messages'
    },
    websocket: 'Available on same port',
    docs: 'API endpoints available for chat functionality'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const connectionStart = Date.now();
  performanceMonitor.recordConnection('connect');
  console.log(`User connected: ${socket.id} (Active: ${performanceMonitor.metrics.activeConnections})`);

  // Join user to their room
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  // Handle sending messages
  socket.on('sendMessage', async (data) => {
    const messageStart = Date.now();
    
    try {
      const { senderId, receiverId, message } = data;
      
      // REALTIME EMBEDDING: Generate embedding using free fallback for realtime messages
      let embedding = null;
      let embeddingTime = 0;
      
      try {
        console.log(`🚀 Generating realtime embedding for: "${message.substring(0, 50)}..."`);
        const embeddingStart = Date.now();
        embedding = await embeddingService.generateEmbedding(message);
        embeddingTime = Date.now() - embeddingStart;
        console.log(`✅ Realtime embedding generated using ${embeddingService.getActiveService()} service (${embeddingTime}ms)`);
      } catch (embeddingError) {
        console.error('❌ Failed to generate embedding for realtime message:', embeddingError);
        performanceMonitor.recordError('embedding');
        // Continue without embedding - message still gets sent
      }

      // REALTIME STORAGE: Save message with embedding to MongoDB
      const dbStart = Date.now();
      const newMessage = new Message({
        senderId,
        receiverId,
        message,
        embedding, // Store embedding with metadata (userId, text, timestamp)
        createdAt: new Date()
      });

      await newMessage.save();
      const dbTime = Date.now() - dbStart;
      performanceMonitor.recordDbOperation('message_save', dbTime);
      
      await newMessage.populate('senderId', 'name email');
      await newMessage.populate('receiverId', 'name email');

      // Record message processing metrics
      const totalTime = Date.now() - messageStart;
      performanceMonitor.recordMessage(totalTime, !!embedding);
      
      // REALTIME BROADCAST: Emit to both sender and receiver with embedding status
      const messageWithMeta = {
        ...newMessage.toObject(),
        _meta: {
          embeddingGenerated: !!embedding,
          embeddingService: embeddingService.getActiveService(),
          processingTime: totalTime,
          embeddingTime: embeddingTime
        }
      };

      io.to(senderId).emit('messageReceived', messageWithMeta);
      io.to(receiverId).emit('messageReceived', messageWithMeta);
      
      console.log(`💬 Realtime message sent from ${senderId} to ${receiverId} (embedding: ${!!embedding}, ${totalTime}ms total)`);
    } catch (error) {
      console.error('❌ Error handling socket message:', error);
      performanceMonitor.recordError('socket');
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    const connectionTime = Date.now() - connectionStart;
    performanceMonitor.recordConnection('disconnect');
    console.log(`User disconnected: ${socket.id} (Active: ${performanceMonitor.metrics.activeConnections}, Duration: ${Math.round(connectionTime/1000)}s)`);
  });
});

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log(`Performance metrics available at http://localhost:${PORT}/metrics`);
    console.log('📊 Performance monitoring active - metrics logged every 30s');
    
    // Log initial system state
    setTimeout(() => {
      console.log('\n🚀 INITIAL SYSTEM STATE:');
      const metrics = performanceMonitor.getSimpleMetrics();
      console.log(`Memory Usage: ${metrics.resources.memoryMB} MB`);
      console.log(`Active Connections: ${metrics.connections.active}`);
      console.log('System ready for monitoring!\n');
    }, 2000);
  });
});

module.exports = { app, server, io };
