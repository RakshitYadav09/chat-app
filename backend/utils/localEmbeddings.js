class LocalEmbeddingService {
  constructor() {
    this.model = null;
    this.modelName = 'sentence-transformers/all-MiniLM-L6-v2';
    this.isLoading = false;
    this.loadPromise = null;
    this.transformers = null;
    
    console.log('🤖 LocalEmbeddingService initialized');
  }

  /**
   * Load transformers.js dynamically (ESM compatibility)
   * @returns {Promise<Object>} Transformers module
   */
  async loadTransformers() {
    if (this.transformers) {
      return this.transformers;
    }
    
    console.log('📦 Loading @xenova/transformers module...');
    this.transformers = await import('@xenova/transformers');
    console.log('✅ Transformers module loaded');
    return this.transformers;
  }

  /**
   * Lazy load the transformer model (loads once, reuses thereafter)
   * @returns {Promise<Object>} The loaded model pipeline
   */
  async loadModel() {
    if (this.model) {
      return this.model;
    }

    if (this.isLoading) {
      return this.loadPromise;
    }

    console.log(`🔄 Loading local transformer model: ${this.modelName}`);
    this.isLoading = true;

    this.loadPromise = (async () => {
      try {
        // Load transformers.js module
        const { pipeline } = await this.loadTransformers();
        
        // Load the feature extraction pipeline with the sentence transformer model
        this.model = await pipeline('feature-extraction', this.modelName, {
          quantized: false, // Use full precision for better quality
        });
        
        console.log(`✅ Model ${this.modelName} loaded successfully`);
        return this.model;
      } catch (error) {
        console.error('❌ Failed to load transformer model:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Generate embedding for text using local transformer model
   * @param {string} text - Text to embed
   * @returns {Promise<Float32Array>} 384-dimensional embedding vector
   */
  async embedText(text) {
    try {
      console.log(`🧠 Generating local embedding for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // Ensure model is loaded with timeout
      const model = await Promise.race([
        this.loadModel(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Model loading timeout')), 30000)
        )
      ]);
      
      // Generate embeddings with timeout
      const output = await Promise.race([
        model(text, { pooling: 'mean', normalize: true }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Embedding generation timeout')), 10000)
        )
      ]);
      
      // Extract the embedding array
      let embedding;
      if (output.data) {
        // Convert to regular array for easier handling
        embedding = Array.from(output.data);
      } else if (Array.isArray(output)) {
        embedding = Array.from(output);
      } else {
        throw new Error('Unexpected output format from transformer model');
      }
      
      // Validate dimensions (should be 384 for all-MiniLM-L6-v2)
      if (embedding.length !== 384) {
        console.warn(`⚠️  Expected 384 dimensions, got ${embedding.length}`);
      }
      
      console.log(`✅ Local embedding generated (${embedding.length} dimensions)`);
      return embedding;
      
    } catch (error) {
      console.error('❌ Error generating local embedding:', error.message);
      // Return zero vector to prevent crashes
      console.log('🚨 Returning zero vector to prevent crash');
      return new Array(384).fill(0);
    }
  }

  /**
   * Compute cosine similarity between two embedding vectors
   * @param {Array|Float32Array} embedding1 - First embedding vector
   * @param {Array|Float32Array} embedding2 - Second embedding vector
   * @returns {number} Cosine similarity score (0-1)
   */
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error(`Embedding dimensions don't match: ${embedding1.length} vs ${embedding2.length}`);
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude1 = Math.sqrt(norm1);
    const magnitude2 = Math.sqrt(norm2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Get model information
   * @returns {Object} Model metadata
   */
  getModelInfo() {
    return {
      name: this.modelName,
      dimensions: 384,
      loaded: !!this.model,
      loading: this.isLoading
    };
  }
}

module.exports = new LocalEmbeddingService();
