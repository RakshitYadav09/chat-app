// Performance Monitoring Service
// Tracks key metrics: message throughput, active connections, resource usage

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      // Message throughput tracking
      totalMessages: 0,
      messagesPerSecond: 0,
      lastSecondMessages: 0,
      messageTimestamp: Date.now(),
      
      // Connection tracking
      activeConnections: 0,
      peakConnections: 0,
      totalConnections: 0,
      
      // Performance tracking
      embeddingTimes: [],
      dbWriteTimes: [],
      socketHandlingTimes: [],
      
      // System resources
      memoryUsage: {},
      cpuUsage: 0,
      
      // Error tracking
      embeddingErrors: 0,
      dbErrors: 0,
      socketErrors: 0
    };
    
    this.startTime = Date.now();
    this.lastResetTime = Date.now();
    
    // Start periodic monitoring
    this.startPeriodicLogging();
    this.startResourceMonitoring();
  }

  // Track new message processing
  recordMessage(processingTime = 0, hasEmbedding = false) {
    this.metrics.totalMessages++;
    this.metrics.lastSecondMessages++;
    
    if (hasEmbedding && processingTime > 0) {
      this.metrics.embeddingTimes.push(processingTime);
      // Keep only last 100 measurements
      if (this.metrics.embeddingTimes.length > 100) {
        this.metrics.embeddingTimes.shift();
      }
    }
  }

  // Track database operation times
  recordDbOperation(operationType, duration) {
    this.metrics.dbWriteTimes.push(duration);
    if (this.metrics.dbWriteTimes.length > 50) {
      this.metrics.dbWriteTimes.shift();
    }
  }

  // Track socket connection events
  recordConnection(action = 'connect') {
    switch (action) {
      case 'connect':
        this.metrics.activeConnections++;
        this.metrics.totalConnections++;
        this.metrics.peakConnections = Math.max(
          this.metrics.peakConnections, 
          this.metrics.activeConnections
        );
        break;
      case 'disconnect':
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        break;
    }
  }

  // Record various error types
  recordError(errorType) {
    switch (errorType) {
      case 'embedding':
        this.metrics.embeddingErrors++;
        break;
      case 'database':
        this.metrics.dbErrors++;
        break;
      case 'socket':
        this.metrics.socketErrors++;
        break;
    }
  }

  // Calculate messages per second
  calculateThroughput() {
    const now = Date.now();
    const timeDiff = (now - this.metrics.messageTimestamp) / 1000;
    
    if (timeDiff >= 1) {
      this.metrics.messagesPerSecond = this.metrics.lastSecondMessages / timeDiff;
      this.metrics.lastSecondMessages = 0;
      this.metrics.messageTimestamp = now;
    }
  }

  // Get embedding performance statistics
  getEmbeddingStats() {
    if (this.metrics.embeddingTimes.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0 };
    }

    const sorted = [...this.metrics.embeddingTimes].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || max;

    return { avg: Math.round(avg), min, max, p95 };
  }

  // Get current system resource usage
  getResourceUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      uptime: Math.round(process.uptime())
    };
  }

  // Check if system is under stress
  getSystemHealth() {
    const embeddingStats = this.getEmbeddingStats();
    const resources = this.getResourceUsage();
    
    const health = {
      status: 'healthy',
      warnings: [],
      critical: []
    };

    // Check embedding performance
    if (embeddingStats.avg > 500) {
      health.warnings.push('High embedding processing time');
    }
    if (embeddingStats.avg > 1000) {
      health.critical.push('Critical embedding processing delay');
      health.status = 'critical';
    }

    // Check memory usage
    if (resources.rss > 6000) { // 6GB
      health.warnings.push('High memory usage');
    }
    if (resources.rss > 7000) { // 7GB
      health.critical.push('Critical memory usage');
      health.status = 'critical';
    }

    // Check connection count
    if (this.metrics.activeConnections > 1000) {
      health.warnings.push('High connection count');
    }
    if (this.metrics.activeConnections > 1500) {
      health.critical.push('Critical connection count');
      health.status = 'critical';
    }

    // Check error rates
    const totalOps = this.metrics.totalMessages;
    const errorRate = totalOps > 0 ? 
      (this.metrics.embeddingErrors + this.metrics.dbErrors) / totalOps : 0;
    
    if (errorRate > 0.05) { // 5% error rate
      health.warnings.push('High error rate');
    }
    if (errorRate > 0.15) { // 15% error rate
      health.critical.push('Critical error rate');
      health.status = 'critical';
    }

    if (health.warnings.length > 0 && health.status === 'healthy') {
      health.status = 'warning';
    }

    return health;
  }

  // Log comprehensive metrics
  logMetrics() {
    this.calculateThroughput();
    const embeddingStats = this.getEmbeddingStats();
    const resources = this.getResourceUsage();
    const health = this.getSystemHealth();
    const uptime = Date.now() - this.startTime;

    console.log('\n📊 ═══════════════════════════════════════════════════');
    console.log('📊 PERFORMANCE METRICS REPORT');
    console.log('📊 ═══════════════════════════════════════════════════');
    
    // Connection metrics
    console.log('🔌 CONNECTION METRICS:');
    console.log(`   Active Connections: ${this.metrics.activeConnections}`);
    console.log(`   Peak Connections: ${this.metrics.peakConnections}`);
    console.log(`   Total Connections: ${this.metrics.totalConnections}`);
    
    // Message throughput
    console.log('\n💬 MESSAGE THROUGHPUT:');
    console.log(`   Messages/Second: ${this.metrics.messagesPerSecond.toFixed(2)}`);
    console.log(`   Total Messages: ${this.metrics.totalMessages}`);
    console.log(`   Uptime: ${Math.round(uptime / 1000 / 60)} minutes`);
    
    // Embedding performance
    console.log('\n🧠 EMBEDDING PERFORMANCE:');
    console.log(`   Average Time: ${embeddingStats.avg}ms`);
    console.log(`   Min/Max Time: ${embeddingStats.min}ms / ${embeddingStats.max}ms`);
    console.log(`   95th Percentile: ${embeddingStats.p95}ms`);
    console.log(`   Total Samples: ${this.metrics.embeddingTimes.length}`);
    
    // Resource usage
    console.log('\n💾 RESOURCE USAGE:');
    console.log(`   Memory (RSS): ${resources.rss} MB`);
    console.log(`   Heap Used: ${resources.heapUsed} MB`);
    console.log(`   Heap Total: ${resources.heapTotal} MB`);
    console.log(`   Process Uptime: ${resources.uptime} seconds`);
    
    // Error tracking
    console.log('\n❌ ERROR TRACKING:');
    console.log(`   Embedding Errors: ${this.metrics.embeddingErrors}`);
    console.log(`   Database Errors: ${this.metrics.dbErrors}`);
    console.log(`   Socket Errors: ${this.metrics.socketErrors}`);
    
    // System health
    console.log('\n🏥 SYSTEM HEALTH:');
    console.log(`   Status: ${this.getHealthEmoji(health.status)} ${health.status.toUpperCase()}`);
    if (health.warnings.length > 0) {
      console.log(`   Warnings: ${health.warnings.join(', ')}`);
    }
    if (health.critical.length > 0) {
      console.log(`   Critical: ${health.critical.join(', ')}`);
    }
    
    // Performance recommendations
    this.logRecommendations(health, embeddingStats, resources);
    
    console.log('📊 ═══════════════════════════════════════════════════\n');
  }

  getHealthEmoji(status) {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  }

  logRecommendations(health, embeddingStats, resources) {
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (embeddingStats.avg > 300) {
      console.log('   🎯 Consider implementing embedding queue for better throughput');
    }
    
    if (this.metrics.activeConnections > 500) {
      console.log('   🔄 Consider implementing connection pooling');
    }
    
    if (resources.rss > 4000) {
      console.log('   🧹 Consider implementing garbage collection optimization');
    }
    
    if (this.metrics.messagesPerSecond > 5) {
      console.log('   📈 High traffic detected - consider horizontal scaling');
    }
    
    if (health.status === 'critical') {
      console.log('   🚨 IMMEDIATE ACTION REQUIRED - System approaching limits');
    }
  }

  // Start periodic logging (every 30 seconds)
  startPeriodicLogging() {
    setInterval(() => {
      this.logMetrics();
    }, 30000); // 30 seconds
  }

  // Monitor system resources periodically
  startResourceMonitoring() {
    setInterval(() => {
      this.metrics.memoryUsage = this.getResourceUsage();
      
      // Check for critical conditions
      const health = this.getSystemHealth();
      if (health.status === 'critical') {
        console.log('\n🚨 CRITICAL ALERT 🚨');
        console.log('System is under severe stress!');
        console.log(`Critical issues: ${health.critical.join(', ')}`);
        console.log('Consider immediate action to prevent system failure.\n');
      }
    }, 5000); // 5 seconds
  }

  // Get simple metrics for API endpoints
  getSimpleMetrics() {
    const embeddingStats = this.getEmbeddingStats();
    const resources = this.getResourceUsage();
    const health = this.getSystemHealth();
    
    return {
      connections: {
        active: this.metrics.activeConnections,
        peak: this.metrics.peakConnections,
        total: this.metrics.totalConnections
      },
      messages: {
        perSecond: Math.round(this.metrics.messagesPerSecond * 100) / 100,
        total: this.metrics.totalMessages
      },
      embedding: {
        avgTime: embeddingStats.avg,
        p95Time: embeddingStats.p95
      },
      resources: {
        memoryMB: resources.rss,
        uptimeMinutes: Math.round((Date.now() - this.startTime) / 1000 / 60)
      },
      health: health.status,
      errors: {
        embedding: this.metrics.embeddingErrors,
        database: this.metrics.dbErrors,
        socket: this.metrics.socketErrors
      }
    };
  }
}

module.exports = PerformanceMonitor;
