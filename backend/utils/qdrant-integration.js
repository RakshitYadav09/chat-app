// Example Qdrant integration for production scaling
// Install: npm install @qdrant/js-client-rest

const { QdrantVectorStore } = require('@qdrant/js-client-rest');

class ProductionVectorService {
  constructor() {
    this.qdrantClient = new QdrantVectorStore({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY
    });
    
    this.collectionName = 'chat_messages';
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create collection if it doesn't exist
      await this.qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: 384, // MiniLM dimension (or 1536 for OpenAI)
          distance: 'Cosine'
        }
      });
      
      this.initialized = true;
      console.log('✅ Qdrant vector store initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Qdrant:', error);
      throw error;
    }
  }

  async indexMessage(messageId, text, userId, metadata = {}) {
    await this.initialize();
    
    try {
      // Generate embedding
      const embedding = await embeddingService.generateEmbedding(text);
      
      // Store in Qdrant with metadata
      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: messageId,
          vector: embedding,
          payload: {
            userId,
            text,
            timestamp: new Date().toISOString(),
            ...metadata
          }
        }]
      });
      
      console.log(`✅ Indexed message ${messageId} in Qdrant`);
    } catch (error) {
      console.error(`❌ Failed to index message ${messageId}:`, error);
      throw error;
    }
  }

  async searchMessages(query, userId, limit = 10) {
    await this.initialize();
    
    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      // Search in Qdrant
      const searchResults = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: userId }
            }
          ]
        },
        limit,
        with_payload: true,
        with_vector: false
      });

      // Format results
      return searchResults.map(result => ({
        id: result.id,
        score: result.score,
        message: result.payload.text,
        timestamp: result.payload.timestamp,
        metadata: result.payload
      }));
    } catch (error) {
      console.error('❌ Qdrant search failed:', error);
      throw error;
    }
  }

  async deleteMessage(messageId) {
    await this.initialize();
    
    try {
      await this.qdrantClient.delete(this.collectionName, {
        wait: true,
        points: [messageId]
      });
      console.log(`✅ Deleted message ${messageId} from Qdrant`);
    } catch (error) {
      console.error(`❌ Failed to delete message ${messageId}:`, error);
      throw error;
    }
  }

  async getCollectionInfo() {
    await this.initialize();
    
    try {
      const info = await this.qdrantClient.getCollection(this.collectionName);
      return {
        vectorsCount: info.vectors_count,
        indexedVectorsCount: info.indexed_vectors_count,
        pointsCount: info.points_count,
        status: info.status
      };
    } catch (error) {
      console.error('❌ Failed to get collection info:', error);
      return null;
    }
  }
}

// Usage example in routes/messages.js:
/*
const productionVectorService = new ProductionVectorService();

// When sending a message:
router.post('/', async (req, res) => {
  // ... save to MongoDB ...
  
  // Index in vector database (async)
  productionVectorService.indexMessage(
    newMessage._id.toString(),
    newMessage.message,
    newMessage.senderId.toString(),
    {
      receiverId: newMessage.receiverId.toString(),
      createdAt: newMessage.createdAt
    }
  ).catch(error => {
    console.error('Failed to index message:', error);
  });
  
  // ... return response ...
});

// For semantic search:
router.get('/semantic-search', async (req, res) => {
  try {
    const { userId, q, limit = 10 } = req.query;
    
    const results = await productionVectorService.searchMessages(q, userId, limit);
    
    res.json({
      results,
      searchType: 'qdrant_vector_search'
    });
  } catch (error) {
    // Fallback to current MongoDB implementation
    // ... existing fallback code ...
  }
});
*/

module.exports = ProductionVectorService;
