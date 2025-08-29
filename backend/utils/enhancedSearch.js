const Message = require('../models/Message');
const embeddingService = require('./embeddings');
const vectorDatabase = require('./vectorDatabase');

class EnhancedSearchService {
  constructor() {
    console.log('🔍 EnhancedSearchService initialized');
    this.useVectorDB = vectorDatabase.isEnabled;
  }

  /**
   * Perform combined word and semantic search
   * @param {string} userId - User ID to search messages for
   * @param {string} query - Search query text
   * @param {number} limit - Maximum number of results (default: 10)
   * @param {Object} options - Search options
   */
  async combinedSearch(userId, query, limit = 10, options = {}) {
    const {
      minSimilarity = 0.1,
      combineResults = true,
      wordWeight = 0.4,
      semanticWeight = 0.6
    } = options;

    try {
      console.log(`🔍 Combined search: userId=${userId}, query="${query}", limit=${limit}`);

      const [wordResults, semanticResults] = await Promise.all([
        this.wordSearch(userId, query, limit * 2),
        this.semanticSearch(userId, query, limit * 2, minSimilarity)
      ]);

      if (!combineResults) {
        return {
          wordResults,
          semanticResults,
          combined: false
        };
      }

      // Combine and deduplicate results
      const combinedResults = this.mergeResults(
        wordResults,
        semanticResults,
        wordWeight,
        semanticWeight,
        limit
      );

      return {
        results: combinedResults,
        wordResults: wordResults.slice(0, 5),
        semanticResults: semanticResults.slice(0, 5),
        combined: true,
        metadata: {
          wordCount: wordResults.length,
          semanticCount: semanticResults.length,
          combinedCount: combinedResults.length,
          searchType: this.useVectorDB ? 'vector_db' : 'mongodb',
          weights: { word: wordWeight, semantic: semanticWeight }
        }
      };

    } catch (error) {
      console.error('❌ Combined search error:', error);
      throw error;
    }
  }

  /**
   * Word-based search using MongoDB text search
   */
  async wordSearch(userId, query, limit = 20) {
    try {
      console.log('📝 Performing word search...');

      // Create text search query
      const searchQuery = {
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ],
        $text: { $search: query }
      };

      const messages = await Message.find(searchQuery, {
        score: { $meta: 'textScore' }
      })
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .sort({ score: { $meta: 'textScore' }, timestamp: -1 })
      .limit(limit);

      return messages.map(message => ({
        message: {
          _id: message._id,
          content: message.message,
          timestamp: message.timestamp || message.createdAt,
          senderId: message.senderId,
          receiverId: message.receiverId
        },
        wordScore: message.score || 0,
        score: message.score || 0,
        searchType: 'word'
      }));

    } catch (error) {
      console.error('❌ Word search error:', error);
      return [];
    }
  }

  /**
   * Semantic search using vector database or MongoDB
   */
  async semanticSearch(userId, query, limit = 10, minSimilarity = 0.1) {
    try {
      console.log('🎯 Performing semantic search...');

      // Check vector database status dynamically
      const vectorStats = await vectorDatabase.getStats();
      const useVectorDB = vectorStats.enabled;

      if (useVectorDB) {
        // Use vector database for better performance
        return await vectorDatabase.semanticSearch(userId, query, limit, minSimilarity);
      } else {
        // Fallback to MongoDB-based semantic search
        console.log('🔄 Falling back to MongoDB semantic search');
        return await this.mongoSemanticSearch(userId, query, limit, minSimilarity);
      }

    } catch (error) {
      console.error('❌ Semantic search error:', error);
      // Fallback to MongoDB search on error
      console.log('🔄 Error occurred, falling back to MongoDB semantic search');
      return await this.mongoSemanticSearch(userId, query, limit, minSimilarity);
    }
  }

  /**
   * MongoDB-based semantic search (fallback)
   */
  async mongoSemanticSearch(userId, query, limit = 10, minSimilarity = 0.1) {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Fetch messages with embeddings
      const messages = await Message.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ],
        embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
      })
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .sort({ timestamp: -1 })
      .limit(100); // Get more for similarity calculation

      const results = [];
      for (const message of messages) {
        try {
          const similarity = this.cosineSimilarity(queryEmbedding, message.embedding);

          if (similarity >= minSimilarity) {
            results.push({
              message: {
                _id: message._id,
                content: message.message,
                timestamp: message.timestamp || message.createdAt,
                senderId: message.senderId,
                receiverId: message.receiverId
              },
              similarity: similarity,
              score: similarity,
              searchType: 'semantic'
            });
          }
        } catch (error) {
          console.warn(`⚠️  Skipping message ${message._id}: ${error.message}`);
        }
      }

      // Sort by similarity and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);

    } catch (error) {
      console.error('❌ MongoDB semantic search error:', error);
      return [];
    }
  }

  /**
   * Merge word and semantic search results
   */
  mergeResults(wordResults, semanticResults, wordWeight, semanticWeight, limit) {
    const messageMap = new Map();

    // Add word search results
    wordResults.forEach(result => {
      const id = result.message._id.toString();
      messageMap.set(id, {
        ...result,
        combinedScore: result.wordScore * wordWeight,
        sources: ['word']
      });
    });

    // Add/merge semantic search results
    semanticResults.forEach(result => {
      const id = result.message._id.toString();
      const existing = messageMap.get(id);

      if (existing) {
        // Merge results
        existing.combinedScore = (existing.combinedScore || 0) + (result.similarity * semanticWeight);
        existing.sources.push('semantic');
        existing.similarity = result.similarity;
      } else {
        // New result
        messageMap.set(id, {
          ...result,
          combinedScore: result.similarity * semanticWeight,
          sources: ['semantic']
        });
      }
    });

    // Convert to array and sort by combined score
      // Apply a small boost to pure word-search hits so keyword matches stay on top
      const WORD_BOOST = 0.25; // tuned constant, adjust as needed for your UX

      // Convert to array and compute finalScore (with optional word boost)
      const combined = Array.from(messageMap.values()).map(r => {
        const hasWord = (r.sources || []).includes('word');
        const finalScore = (r.combinedScore || 0) + (hasWord ? WORD_BOOST : 0);
        return { ...r, finalScore };
      })
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, limit);

      // Add rank and normalize finalScore
      return combined.map((result, index) => ({
        ...result,
        rank: index + 1,
        finalScore: Math.round((result.finalScore || 0) * 10000) / 10000
      }));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
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

  /**
   * Index a new message in the vector database
   */
  async indexMessage(message) {
    try {
      // Check vector database status dynamically
      const vectorStats = await vectorDatabase.getStats();

      if (vectorStats.enabled) {
        await vectorDatabase.indexMessage(message);
      }
    } catch (error) {
      console.warn('⚠️  Failed to index message in vector database:', error.message);
    }

    // Also store embedding in MongoDB for fallback
    try {
      const embedding = await embeddingService.generateEmbedding(message.content);
      await Message.findByIdAndUpdate(message._id, { embedding });
    } catch (error) {
      console.warn('⚠️  Failed to store embedding in MongoDB:', error.message);
    }
  }

  /**
   * Get search statistics
   */
  async getSearchStats(userId = null) {
    try {
      let totalMessages = 0;
      let messagesWithEmbeddings = 0;

      if (userId) {
        totalMessages = await Message.countDocuments({
          $or: [{ senderId: userId }, { receiverId: userId }]
        });

        messagesWithEmbeddings = await Message.countDocuments({
          $or: [{ senderId: userId }, { receiverId: userId }],
          embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
        });
      } else {
        totalMessages = await Message.countDocuments();
        messagesWithEmbeddings = await Message.countDocuments({
          embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
        });
      }

      const vectorStats = await vectorDatabase.getStats();

      // Update vector database enabled status based on current stats
      this.useVectorDB = vectorStats.enabled;

      return {
        totalMessages,
        messagesWithEmbeddings,
        embeddingCoverage: totalMessages > 0 ? (messagesWithEmbeddings / totalMessages * 100).toFixed(2) : 0,
        vectorDatabase: vectorStats,
        searchEnabled: {
          wordSearch: true,
          semanticSearch: true,
          vectorSearch: this.useVectorDB
        }
      };
    } catch (error) {
      console.error('❌ Failed to get search stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate embeddings for messages that don't have them
   */
  async generateMissingEmbeddings(userId = null) {
    try {
      const query = userId ? {
        $or: [{ senderId: userId }, { receiverId: userId }],
        $or: [
          { embedding: { $exists: false } },
          { embedding: null },
          { embedding: { $size: 0 } }
        ]
      } : {
        $or: [
          { embedding: { $exists: false } },
          { embedding: null },
          { embedding: { $size: 0 } }
        ]
      };

      const messages = await Message.find(query).limit(100); // Process in batches
      console.log(`📝 Found ${messages.length} messages needing embeddings`);

      let processedCount = 0;

      for (const message of messages) {
        try {
          const embedding = await embeddingService.generateEmbedding(message.message);
          await Message.findByIdAndUpdate(message._id, { embedding });

          // Also index in vector database if enabled
          if (this.useVectorDB) {
            // Check vector database status dynamically
            const vectorStats = await vectorDatabase.getStats();
            if (vectorStats.enabled) {
              await vectorDatabase.indexMessage({
                _id: message._id,
                content: message.message,
                userId: message.senderId.toString(),
                timestamp: message.timestamp || message.createdAt,
                senderId: message.senderId,
                receiverId: message.receiverId
              });
            }
          }

          processedCount++;
        } catch (error) {
          console.warn(`⚠️  Failed to process message ${message._id}:`, error.message);
        }
      }

      console.log(`✅ Processed ${processedCount} messages`);
      return processedCount;
    } catch (error) {
      console.error('❌ Failed to generate missing embeddings:', error);
      throw error;
    }
  }
}

module.exports = new EnhancedSearchService();
