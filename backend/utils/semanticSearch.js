const Message = require('../models/Message');
const localEmbeddings = require('./localEmbeddings');

class SemanticSearchService {
  constructor() {
    console.log('🔍 SemanticSearchService initialized');
  }

  /**
   * Perform semantic search on user messages
   * @param {string} userId - User ID to search messages for
   * @param {string} query - Search query text
   * @param {number} limit - Maximum number of results (default: 10)
   * @param {number} minSimilarity - Minimum similarity threshold (default: 0.05)
   * @returns {Promise<Array>} Array of search results with similarity scores
   */
  async searchMessages(userId, query, limit = 10, minSimilarity = 0.05) {
    try {
      console.log(`🔍 Semantic search request: userId=${userId}, query="${query}", limit=${limit}`);
      
      // Generate embedding for the search query
      console.log('🎯 Generating query embedding...');
      const queryEmbedding = await localEmbeddings.embedText(query);
      
      // Fetch all messages for the user that have embeddings
      console.log('📚 Fetching user messages with embeddings...');
      const messages = await Message.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ],
        embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
      })
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .sort({ timestamp: -1 });

      console.log(`📊 Found ${messages.length} messages with embeddings for user ${userId}`);

      if (messages.length === 0) {
        return [];
      }

      // Calculate similarity scores for each message
      const results = [];
      const allScores = [];
      for (const message of messages) {
        try {
          const similarity = localEmbeddings.cosineSimilarity(queryEmbedding, message.embedding);
          allScores.push(similarity);
          
          // Debug: Log first few similarity scores
          if (allScores.length <= 5) {
            const preview = message.message.substring(0, 30) + (message.message.length > 30 ? '...' : '');
            console.log(`🔍 Debug similarity for "${preview}": ${similarity.toFixed(4)}`);
          }
          
          if (similarity >= minSimilarity) {
            results.push({
              message: {
                _id: message._id,
                content: message.message,
                timestamp: message.timestamp,
                senderId: message.senderId,
                receiverId: message.receiverId
              },
              similarity: similarity,
              score: Math.round(similarity * 10000) / 10000 // Round to 4 decimal places
            });
          }
        } catch (error) {
          console.warn(`⚠️  Skipping message ${message._id}: ${error.message}`);
        }
      }
      
      // Debug: Log similarity score statistics
      if (allScores.length > 0) {
        const maxScore = Math.max(...allScores);
        const minScore = Math.min(...allScores);
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        console.log(`📊 Similarity stats: Min=${minScore.toFixed(4)}, Max=${maxScore.toFixed(4)}, Avg=${avgScore.toFixed(4)}, Threshold=${minSimilarity}`);
      }

      // Sort by similarity score (highest first) and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, limit);

      console.log(`🎯 Returning ${limitedResults.length} results out of ${results.length} processed`);
      
      // Enhanced logging for top results
      console.log('');
      console.log('🏆 TOP SEMANTIC SEARCH RESULTS:');
      console.log('================================');
      limitedResults.slice(0, 5).forEach((result, index) => {
        const messageText = result.message.content;
        const score = result.score;
        const timestamp = new Date(result.message.timestamp).toLocaleString();
        
        console.log(`${index + 1}. 📝 "${messageText}"`);
        console.log(`   🎯 Similarity: ${score} (${getScoreDescription(score)})`);
        console.log(`   📅 Time: ${timestamp}`);
        console.log(`   🆔 ID: ${result.message._id}`);
        console.log('');
      });

      return limitedResults;

    } catch (error) {
      console.error('❌ Semantic search error:', error);
      throw error;
    }
  }

  /**
   * Generate and store embedding for a message
   * @param {Object} message - Message document
   * @returns {Promise<Array>} Generated embedding
   */
  async generateMessageEmbedding(message) {
    try {
      console.log(`🧠 Generating embedding for message: "${message.message.substring(0, 50)}..."`);
      
      const embedding = await localEmbeddings.embedText(message.message);
      
      // Update the message with the embedding
      await Message.findByIdAndUpdate(message._id, {
        embedding: embedding
      });
      
      console.log(`✅ Embedding generated and stored for message ${message._id}`);
      return embedding;
      
    } catch (error) {
      console.error(`❌ Failed to generate embedding for message ${message._id}:`, error);
      throw error;
    }
  }

  /**
   * Batch generate embeddings for messages without them
   * @param {string} userId - User ID to process messages for
   * @returns {Promise<number>} Number of messages processed
   */
  async generateMissingEmbeddings(userId = null) {
    try {
      console.log('🔄 Generating embeddings for messages without them...');
      
      const query = {
        $or: [
          { embedding: { $exists: false } },
          { embedding: null },
          { embedding: { $size: 0 } }
        ]
      };
      
      if (userId) {
        query.$and = [
          {
            $or: [
              { senderId: userId },
              { receiverId: userId }
            ]
          }
        ];
      }
      
      const messages = await Message.find(query);
      console.log(`📊 Found ${messages.length} messages without embeddings`);
      
      let processedCount = 0;
      for (const message of messages) {
        try {
          await this.generateMessageEmbedding(message);
          processedCount++;
        } catch (error) {
          console.warn(`⚠️  Failed to process message ${message._id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Generated embeddings for ${processedCount} messages`);
      return processedCount;
      
    } catch (error) {
      console.error('❌ Batch embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Get search statistics
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Search statistics
   */
  async getSearchStats(userId = null) {
    try {
      const totalQuery = userId ? {
        $or: [{ senderId: userId }, { receiverId: userId }]
      } : {};
      
      const embeddedQuery = {
        ...totalQuery,
        embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
      };
      
      const totalMessages = await Message.countDocuments(totalQuery);
      const embeddedMessages = await Message.countDocuments(embeddedQuery);
      
      return {
        totalMessages,
        embeddedMessages,
        embeddingCoverage: totalMessages > 0 ? embeddedMessages / totalMessages : 0,
        modelInfo: localEmbeddings.getModelInfo()
      };
    } catch (error) {
      console.error('❌ Failed to get search stats:', error);
      throw error;
    }
  }
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

module.exports = new SemanticSearchService();
