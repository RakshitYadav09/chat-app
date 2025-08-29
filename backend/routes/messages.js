const express = require('express');
const Message = require('../models/Message');
const embeddingService = require('../utils/embeddings');
const semanticSearch = require('../utils/semanticSearch');
const enhancedSearch = require('../utils/enhancedSearch');
const vectorDatabase = require('../utils/vectorDatabase');
const router = express.Router();

// Import performance monitor (will be initialized in main app)
let performanceMonitor = null;
try {
  const PerformanceMonitor = require('../utils/performanceMonitor');
  // This will be set by the main app if needed
  router.setPerformanceMonitor = (monitor) => {
    performanceMonitor = monitor;
  };
} catch (err) {
  console.log('Performance monitor not available in routes');
}

/**
 * Get a human-readable description of similarity score
 * @param {number} score - Similarity score (0-1)
 * @returns {string} Description of the score
 */
function getScoreDescription(score) {
  if (score >= 0.9) return 'Nearly Identical';
  if (score >= 0.8) return 'Very High Match';
  if (score >= 0.7) return 'High Match';
  if (score >= 0.6) return 'Good Match';
  if (score >= 0.5) return 'Moderate Match';
  if (score >= 0.3) return 'Weak Match';
  if (score >= 0.1) return 'Low Match';
  return 'Very Low Match';
}

// Send a message
router.post('/', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    
    if (!senderId || !receiverId || !message) {
      return res.status(400).json({ 
        error: 'SenderId, receiverId, and message are required' 
      });
    }

    // EMBEDDING STORAGE: Generate embedding for the message using free fallback
    let embedding = null;
    try {
      console.log(`📝 Generating embedding for message: "${message.substring(0, 50)}..."`);
      embedding = await embeddingService.generateEmbedding(message);
      console.log(`✅ Embedding generated using ${embeddingService.getActiveService()} service (${embedding.length} dimensions)`);
    } catch (embeddingError) {
      console.error('❌ Failed to generate embedding:', embeddingError);
      // Continue without embedding - we'll handle this gracefully in search
    }

    // MONGODB STORAGE: Save message with embedding to MongoDB
    const newMessage = new Message({
      senderId,
      receiverId,
      message,
      embedding, // Store embedding array with metadata (userId, text, timestamp implicit)
      createdAt: new Date()
    });

    await newMessage.save();
    console.log(`💾 Message saved to MongoDB with embedding: ${!!embedding}`);

    // Populate sender and receiver info
    await newMessage.populate('senderId', 'name email');
    await newMessage.populate('receiverId', 'name email');

    // QDRANT STORAGE: index new message asynchronously
    if (vectorDatabase && vectorDatabase.isEnabled) {
      vectorDatabase.indexMessage({
        _id: newMessage._id,
        content: newMessage.message,
        userId: newMessage.senderId.toString(),
        timestamp: newMessage.createdAt,
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId
      }).catch(err => console.warn('⚠️ Failed to index message in vector DB:', err.message));
    }

    res.status(201).json({ 
      message: 'Message sent successfully',
      data: newMessage,
      debug: {
        embeddingGenerated: !!embedding,
        embeddingService: embeddingService.getActiveService(),
        embeddingDimensions: embedding ? embedding.length : 0
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get messages for a user
router.get('/', async (req, res) => {
  try {
    const { userId, limit = 99 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'UserId is required' 
      });
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    })
    .populate('senderId', 'name email')
    .populate('receiverId', 'name email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json({ 
      messages: messages.reverse() // Reverse to show oldest first in chat
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get conversation between two users
router.get('/conversation', async (req, res) => {
  try {
    const { userId1, userId2, limit = 99 } = req.query;
    
    if (!userId1 || !userId2) {
      return res.status(400).json({ 
        error: 'Both userId1 and userId2 are required' 
      });
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 }
      ]
    })
    .populate('senderId', 'name email')
    .populate('receiverId', 'name email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json({ 
      messages: messages.reverse() // Reverse to show oldest first in chat
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Combined word and semantic search endpoint
router.get('/search', async (req, res) => {
  const searchStart = Date.now();

  try {
    const {
      userId,
      q: query,
      limit = 10,
      minSimilarity = 0.1,
      wordWeight = 0.4,
      semanticWeight = 0.6,
      combineResults = 'true'
    } = req.query;

    if (!userId || !query) {
      return res.status(400).json({
        error: 'userId and q (query) parameters are required'
      });
    }

    console.log(`🔍 Combined search API: userId=${userId}, query="${query}", limit=${limit}`);

    // Use the enhanced search service
    const searchResult = await enhancedSearch.combinedSearch(
      userId,
      query,
      parseInt(limit),
      {
        minSimilarity: parseFloat(minSimilarity),
        combineResults: combineResults === 'true',
        wordWeight: parseFloat(wordWeight),
        semanticWeight: parseFloat(semanticWeight)
      }
    );

    const searchTime = Date.now() - searchStart;

    // Log performance metrics
    if (performanceMonitor) {
      performanceMonitor.recordDbOperation('combined_search', searchTime);
    }

    console.log(`🎯 Combined search completed in ${searchTime}ms`);

    // Format results for API response
    const formattedResults = searchResult.results.map(result => ({
      rank: result.rank,
      _id: result.message._id,
      senderId: result.message.senderId,
      receiverId: result.message.receiverId,
      message: result.message.content,
      timestamp: result.message.timestamp,
      similarity: result.similarity,
      wordScore: result.wordScore,
      finalScore: result.finalScore,
      sources: result.sources,
      searchType: result.searchType,
      scoreDescription: getScoreDescription(result.finalScore || result.score),
      preview: result.message.content.length > 100
        ? result.message.content.substring(0, 100) + '...'
        : result.message.content
    }));

    // Enhanced response with comprehensive metadata
  const response = {
      query,
      results: formattedResults,
      metadata: {
    ...searchResult.metadata,
        searchTime,
        total: formattedResults.length,
        searchParams: {
          userId,
          limit: parseInt(limit),
          minSimilarity: parseFloat(minSimilarity),
          wordWeight: parseFloat(wordWeight),
          semanticWeight: parseFloat(semanticWeight),
          combineResults: combineResults === 'true'
        },
        topResult: formattedResults.length > 0 ? {
          score: formattedResults[0].finalScore || formattedResults[0].score,
          description: formattedResults[0].scoreDescription,
          message: formattedResults[0].preview,
          sources: formattedResults[0].sources
        } : null
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Combined search API error:', error);
    res.status(500).json({
      error: 'Failed to perform combined search',
      details: error.message
    });
  }
});

// Semantic search endpoint using local transformers
router.get('/semantic-search', async (req, res) => {
  const searchStart = Date.now();
  
  try {
    const { userId, q: query, limit = 10, minSimilarity = 0.1 } = req.query;
    
    if (!userId || !query) {
      return res.status(400).json({
        error: 'userId and q (query) parameters are required'
      });
    }

    console.log(`🔍 Semantic search API: userId=${userId}, query="${query}", limit=${limit}`);

    // Use the enhanced search service for semantic search
    const results = await enhancedSearch.semanticSearch(
      userId, 
      query, 
      parseInt(limit), 
      parseFloat(minSimilarity)
    );

    const searchTime = Date.now() - searchStart;
    
    // Log performance metrics
    if (performanceMonitor) {
      performanceMonitor.recordDbOperation('semantic_search', searchTime);
    }
    
    console.log(`🎯 Semantic search completed in ${searchTime}ms, found ${results.length} results`);

    // Format results for API response with enhanced information
    const formattedResults = results.map((result, index) => ({
      rank: index + 1,
      _id: result.message._id,
      senderId: result.message.senderId,
      receiverId: result.message.receiverId,
      message: result.message.content,
      timestamp: result.message.timestamp,
      similarity: result.similarity,
      score: result.score,
      scoreDescription: getScoreDescription(result.score),
      preview: result.message.content.length > 100 
        ? result.message.content.substring(0, 100) + '...' 
        : result.message.content
    }));

    // Enhanced response with search metadata
    const response = {
      query,
      results: formattedResults,
      metadata: {
        total: results.length,
      searchType: vectorDatabase && vectorDatabase.isEnabled ? 'qdrant_vector_search' : 'mongo_semantic',
      model: embeddingService.getActiveService(),
      dimensions: embeddingService.getEmbeddingDimension(),
        searchParams: {
          userId,
          limit: parseInt(limit),
          minSimilarity: parseFloat(minSimilarity)
        },
        topResult: formattedResults.length > 0 ? {
          score: formattedResults[0].score,
          description: formattedResults[0].scoreDescription,
          message: formattedResults[0].preview
        } : null
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Semantic search API error:', error);
    res.status(500).json({
      error: 'Failed to perform semantic search',
      details: error.message
    });
  }
});

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Search statistics endpoint
router.get('/search-stats', async (req, res) => {
  try {
    const { userId } = req.query;
    const stats = await enhancedSearch.getSearchStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('❌ Search stats error:', error);
    res.status(500).json({
      error: 'Failed to get search statistics',
      details: error.message
    });
  }
});

// Batch generate embeddings for messages without them
router.post('/generate-embeddings', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(`🔄 Batch generating embeddings for user: ${userId || 'all users'}`);
    
    const processedCount = await enhancedSearch.generateMissingEmbeddings(userId);
    
    res.json({
      message: 'Embeddings generated successfully',
      processedCount,
      userId: userId || 'all users'
    });
  } catch (error) {
    console.error('❌ Batch embedding generation error:', error);
    res.status(500).json({
      error: 'Failed to generate embeddings',
      details: error.message
    });
  }
});

module.exports = router;
