const { QdrantClient } = require('@qdrant/js-client-rest');
const embeddingService = require('./embeddings');

class VectorDatabaseService {
  constructor() {
    this.client = null;
    this.collectionName = process.env.QDRANT_COLLECTION || 'messages';
    this.dimensions = parseInt(process.env.VECTOR_DIMENSIONS) || 1536;
    this.isEnabled = process.env.ENABLE_VECTOR_SEARCH === 'true';

    if (this.isEnabled) {
      this.initializeClient();
    }
  }

  /**
   * Initialize Qdrant client and collection
   */
  async initializeClient() {
    try {
      const qdrantUrl = process.env.QDRANT_URL;
      const qdrantApiKey = process.env.QDRANT_API_KEY;

      if (!qdrantUrl) {
        console.log('⚠️  Qdrant URL not configured, vector search disabled');
        this.isEnabled = false;
        return;
      }

      this.client = new QdrantClient({
        url: qdrantUrl,
        apiKey: qdrantApiKey || undefined
      });

      // Test connection and create collection if needed
      await this.ensureCollection();
      console.log('✅ Vector database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize vector database:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * Ensure collection exists with proper configuration
   */
  async ensureCollection() {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(col => col.name === this.collectionName);

      if (!exists) {
        console.log(`📝 Creating collection: ${this.collectionName}`);

        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.dimensions,
            distance: 'Cosine' // Best for semantic similarity
          }
        });

        console.log(`✅ Collection ${this.collectionName} created successfully`);
      } else {
        console.log(`✅ Collection ${this.collectionName} already exists`);
      }

      // Always ensure payload indexes exist (for both new and existing collections)
      await this.ensurePayloadIndexes();

    } catch (error) {
      console.error('❌ Failed to create/verify collection:', error.message);
      throw error;
    }
  }

  /**
   * Ensure payload indexes exist for efficient filtering
   */
  async ensurePayloadIndexes() {
    try {
      const requiredIndexes = [
        { field_name: 'userId', field_schema: 'keyword' },
        { field_name: 'timestamp', field_schema: 'datetime' },
        { field_name: 'messageId', field_schema: 'keyword' }
      ];

      for (const indexConfig of requiredIndexes) {
        try {
          await this.client.createPayloadIndex(this.collectionName, indexConfig);
          console.log(`✅ Created payload index for ${indexConfig.field_name}`);
        } catch (indexError) {
          // Index might already exist, which is fine
          if (indexError.message.includes('already exists') || indexError.status === 409) {
            console.log(`ℹ️  Payload index for ${indexConfig.field_name} already exists`);
          } else {
            console.warn(`⚠️  Failed to create index for ${indexConfig.field_name}:`, indexError.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to ensure payload indexes:', error.message);
    }
  }

  /**
   * Index a message in the vector database
   * @param {Object} message - Message object with _id, content, userId, timestamp
   */
  async indexMessage(message) {
    if (!this.isEnabled) return;

    try {
      // Generate embedding for the message
      const embedding = await embeddingService.generateEmbedding(message.content);

      // Generate UUID for the point ID (Qdrant requirement)
      const pointId = this.generateUUID();

      // Prepare point for indexing
      const point = {
        id: pointId,
        vector: embedding,
        payload: {
          messageId: message._id.toString(),
          content: message.content,
          userId: message.userId || message.senderId?.toString(),
          timestamp: message.timestamp || message.createdAt,
          senderId: message.senderId?.toString(),
          receiverId: message.receiverId?.toString()
        }
      };

      // Upsert point (insert or update)
      await this.client.upsert(this.collectionName, {
        points: [point]
      });

      console.log(`✅ Indexed message: ${message._id} (Point ID: ${pointId})`);
      return pointId; // Return the point ID for potential future use
    } catch (error) {
      console.error(`❌ Failed to index message ${message._id}:`, error.message);
    }
  }

  /**
   * Search for semantically similar messages
   * @param {string} userId - User ID to search for
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @param {number} minSimilarity - Minimum similarity threshold
   */
  async semanticSearch(userId, query, limit = 10, minSimilarity = 0.1) {
    if (!this.isEnabled) {
      throw new Error('Vector search is not enabled');
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Perform vector search with user filter
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit * 2, // Get more results for filtering
        filter: {
          must: [
            {
              key: 'userId',
              match: {
                value: userId
              }
            }
          ]
        },
        with_payload: true,
        with_vector: false
      });

      // Filter and format results
      const results = searchResult
        .filter(result => result.score >= minSimilarity)
        .slice(0, limit)
        .map(result => ({
          message: {
            _id: result.payload.messageId,
            content: result.payload.content,
            timestamp: result.payload.timestamp,
            senderId: result.payload.senderId,
            receiverId: result.payload.receiverId
          },
          similarity: result.score,
          score: Math.round(result.score * 10000) / 10000
        }));

      return results;
    } catch (error) {
      console.error('❌ Vector search failed:', error.message);
      throw error;
    }
  }

  /**
   * Delete a message from the vector database
   * @param {string} messageId - Message ID to delete
   */
  async deleteMessage(messageId) {
    if (!this.isEnabled) return;

    try {
      // First, find the point ID by searching for the messageId in payload
      const searchResult = await this.client.search(this.collectionName, {
        vector: new Array(this.dimensions).fill(0), // Dummy vector for payload search
        limit: 1,
        filter: {
          must: [
            {
              key: 'messageId',
              match: {
                value: messageId
              }
            }
          ]
        },
        with_payload: false,
        with_vector: false
      });

      if (searchResult.length === 0) {
        console.log(`⚠️  No vector found for message: ${messageId}`);
        return;
      }

      const pointId = searchResult[0].id;

      // Delete the point by its UUID
      await this.client.delete(this.collectionName, {
        points: [pointId]
      });

      console.log(`🗑️  Deleted message from vector DB: ${messageId} (Point ID: ${pointId})`);
    } catch (error) {
      console.error(`❌ Failed to delete message ${messageId}:`, error.message);
    }
  }

  /**
   * Get collection statistics
   */
  async getStats() {
    console.log('🔍 VectorDatabase.getStats() called');
    console.log('   isEnabled:', this.isEnabled);
    console.log('   client exists:', !!this.client);

    if (!this.isEnabled) {
      console.log('   ❌ Vector search is disabled');
      return { enabled: false, message: 'Vector search is disabled' };
    }

    // Check if client is initialized
    if (!this.client) {
      console.log('   ❌ Vector database client not initialized');
      return { enabled: false, message: 'Vector database not initialized' };
    }

    try {
      console.log('   🔄 Getting collection info...');
      const info = await this.client.getCollection(this.collectionName);
      console.log('   ✅ Collection info retrieved:', info.points_count, 'vectors');

      return {
        enabled: true,
        collection: this.collectionName,
        vectors_count: info.points_count,
        dimensions: this.dimensions,
        distance: 'Cosine'
      };
    } catch (error) {
      console.error('   ❌ Failed to get collection info:', error.message);
      return {
        enabled: false,
        error: error.message
      };
    }
  }

  /**
   * Batch index multiple messages
   * @param {Array} messages - Array of message objects
   */
  async batchIndexMessages(messages) {
    if (!this.isEnabled || messages.length === 0) return;

    try {
      const points = [];

      for (const message of messages) {
        const embedding = await embeddingService.generateEmbedding(message.content);

        points.push({
          id: this.generateUUID(), // Use UUID instead of message ID
          vector: embedding,
          payload: {
            messageId: message._id.toString(),
            content: message.content,
            userId: message.userId || message.senderId?.toString(),
            timestamp: message.timestamp || message.createdAt,
            senderId: message.senderId?.toString(),
            receiverId: message.receiverId?.toString()
          }
        });
      }

      // Batch upsert
      await this.client.upsert(this.collectionName, {
        points: points
      });

      console.log(`✅ Batch indexed ${points.length} messages`);
    } catch (error) {
      console.error('❌ Batch indexing failed:', error.message);
    }
  }

  /**
   * Generate a UUID v4 for Qdrant point IDs
   * @returns {string} UUID v4 string
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

module.exports = new VectorDatabaseService();
