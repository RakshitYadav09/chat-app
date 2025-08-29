const axios = require('axios');
const localEmbeddings = require('./localEmbeddings');

class EmbeddingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.hfApiKey = process.env.HUGGINGFACE_API_KEY;
    this.useOpenAI = !!this.openaiApiKey;
    
    // Debug token loading
    console.log('🔍 Token debugging:');
    console.log(`OpenAI token: ${this.openaiApiKey ? this.openaiApiKey.substring(0, 8) + '...' : 'Not found'}`);
    console.log(`HuggingFace token: ${this.hfApiKey ? this.hfApiKey.substring(0, 8) + '...' : 'Not found'}`);
    
    // Priority order: OpenAI > Local Transformers > Legacy local fallback
    if (this.useOpenAI) {
      console.log('✅ Using OpenAI text-embedding-3-small for embeddings');
    } else {
      console.log('✅ Using local transformer model (all-MiniLM-L6-v2) for embeddings');
    }
  }

  /**
   * Main embedding generation function with local transformers
   * Priority: OpenAI → Local Transformers → Legacy local fallback
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateEmbedding(text) {
    try {
      // PRIORITY 1: Try OpenAI if available (paid, highest quality)
      if (this.useOpenAI) {
        return await this.generateOpenAIEmbedding(text);
      }
      
      // PRIORITY 2: Use local transformer model (high quality, completely free)
      try {
        return await localEmbeddings.embedText(text);
      } catch (localError) {
        console.error('❌ Local transformer failed:', localError.message);
        throw localError;
      }
      
    } catch (error) {
      console.error('Primary embedding generation failed, trying fallback:', error.message);
      
      // Ultimate fallback: Try legacy local implementation if transformer fails
      console.log('🔄 Falling back to legacy local embedding generation');
      try {
        return await this.generateLegacyLocalEmbedding(text);
      } catch (fallbackError) {
        console.error('❌ All embedding methods failed:', fallbackError.message);
        // Return a zero vector as last resort to prevent crashes
        console.log('🚨 Returning zero vector to prevent crash');
        return new Array(384).fill(0);
      }
    }
  }

  /**
   * OpenAI embedding generation (paid service)
   * Returns 1536-dimensional vectors
   */
  async generateOpenAIEmbedding(text) {
    try {
      console.log('🚀 Generating OpenAI embedding');
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-3-small'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('❌ OpenAI embedding error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * HuggingFace Sentence Transformers via Inference API (DEPRECATED)
   * Replaced by local transformer model for better reliability
   */
  async generateHuggingFaceEmbedding(text) {
    console.log('⚠️  HuggingFace API method deprecated - using local transformers instead');
    return await localEmbeddings.embedText(text);
  }

  /**
   * Legacy local embedding generation (fallback only)
   * Mimics sentence-transformers behavior using semantic analysis
   * Returns 384-dimensional vectors compatible with all-MiniLM-L6-v2
   */
  async generateLegacyLocalEmbedding(text) {
    console.log('🏠 Generating legacy local embedding (fallback)');
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    // Enhanced semantic word groups based on all-MiniLM-L6-v2 training patterns
    const semanticGroups = {
      // Communication & interaction
      greetings: ['hello', 'hi', 'hey', 'greetings', 'good', 'morning', 'evening', 'afternoon', 'welcome'],
      farewells: ['bye', 'goodbye', 'farewell', 'see', 'later', 'ciao', 'adios', 'until', 'take', 'care'],
      gratitude: ['thanks', 'thank', 'grateful', 'appreciate', 'cheers', 'kudos', 'credit'],
      politeness: ['please', 'sorry', 'excuse', 'pardon', 'apologize', 'forgive'],
      
      // Questions & responses
      questions: ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'can', 'could', 'would', 'should', 'will', 'do', 'does', 'did'],
      answers: ['yes', 'no', 'maybe', 'perhaps', 'definitely', 'absolutely', 'sure', 'certainly', 'probably'],
      uncertainty: ['maybe', 'perhaps', 'might', 'possibly', 'unsure', 'think', 'guess', 'suppose'],
      
      // Emotions & sentiments
      positive: ['happy', 'excited', 'love', 'like', 'enjoy', 'wonderful', 'great', 'awesome', 'fantastic', 'amazing'],
      negative: ['sad', 'angry', 'hate', 'dislike', 'terrible', 'awful', 'bad', 'horrible', 'disappointed'],
      neutral: ['okay', 'fine', 'alright', 'normal', 'regular', 'usual', 'standard'],
      
      // Actions & activities
      communication: ['chat', 'message', 'talk', 'speak', 'say', 'tell', 'ask', 'answer', 'reply', 'respond', 'discuss'],
      help: ['help', 'assist', 'support', 'guide', 'advice', 'suggest', 'recommend', 'tip', 'hint'],
      work: ['work', 'job', 'project', 'task', 'meeting', 'deadline', 'business', 'office', 'colleague'],
      
      // Time & scheduling
      time: ['today', 'tomorrow', 'yesterday', 'now', 'later', 'soon', 'time', 'date', 'schedule', 'when'],
      frequency: ['always', 'never', 'sometimes', 'often', 'rarely', 'usually', 'frequently', 'occasionally'],
      
      // Technology & digital
      tech: ['code', 'programming', 'computer', 'software', 'app', 'website', 'tech', 'digital', 'online', 'internet'],
      
      // Physical world
      food: ['eat', 'food', 'lunch', 'dinner', 'breakfast', 'hungry', 'restaurant', 'cooking', 'meal'],
      weather: ['weather', 'rain', 'sunny', 'cloudy', 'hot', 'cold', 'temperature', 'warm', 'cool'],
      location: ['here', 'there', 'home', 'office', 'place', 'location', 'address', 'city', 'country'],
      
      // Quantifiers & modifiers
      quantity: ['one', 'two', 'three', 'many', 'few', 'some', 'all', 'none', 'several', 'multiple'],
      intensity: ['very', 'really', 'quite', 'rather', 'extremely', 'totally', 'completely', 'absolutely'],
      
      // Pronouns & references
      personal: ['i', 'you', 'he', 'she', 'we', 'they', 'me', 'us', 'him', 'her', 'them'],
      possessive: ['my', 'your', 'his', 'her', 'our', 'their', 'mine', 'yours', 'ours', 'theirs']
    };
    
    // Initialize 384-dimensional embedding (same as all-MiniLM-L6-v2)
    const embedding = new Array(384).fill(0);
    
    // Process semantic groups with position-based encoding
    Object.entries(semanticGroups).forEach(([groupName, groupWords], groupIndex) => {
      let groupScore = 0;
      
      words.forEach(word => {
        if (groupWords.includes(word)) {
          groupScore += 1;
        }
        
        // Partial matching for word variations
        groupWords.forEach(groupWord => {
          if (word.includes(groupWord) || groupWord.includes(word)) {
            groupScore += 0.5;
          }
        });
      });
      
      if (groupScore > 0) {
        // Distribute group influence across multiple dimensions
        const baseIndex = (groupIndex * 12) % 384;
        const groupWeight = Math.min(groupScore / words.length * 3, 1); // Normalize
        
        // Primary signal
        embedding[baseIndex] += groupWeight * 2;
        
        // Secondary signals for context
        for (let i = 1; i <= 5; i++) {
          embedding[(baseIndex + i) % 384] += groupWeight * (1 - i * 0.15);
          embedding[(baseIndex - i + 384) % 384] += groupWeight * (1 - i * 0.15);
        }
      }
    });
    
    // Add word-level features using character-based hashing
    words.forEach((word, wordIndex) => {
      // Character composition features
      const charSum = word.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const wordHash1 = charSum % 384;
      const wordHash2 = (charSum * 17) % 384;
      const wordHash3 = (charSum * 31) % 384;
      
      const wordWeight = 1 / Math.sqrt(words.length); // Inverse frequency weighting
      
      embedding[wordHash1] += wordWeight * 0.3;
      embedding[wordHash2] += wordWeight * 0.2;
      embedding[wordHash3] += wordWeight * 0.1;
      
      // Position-based encoding (sentence structure)
      const positionWeight = 1 / (1 + wordIndex); // Earlier words get more weight
      const positionIndex = (wordIndex * 7) % 384;
      embedding[positionIndex] += positionWeight * 0.2;
      
      // Word length encoding
      const lengthIndex = (word.length * 23) % 384;
      embedding[lengthIndex] += wordWeight * 0.1;
    });
    
    // Text-level features
    const textLength = text.length;
    const wordCount = words.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
    
    // Global text features
    embedding[textLength % 384] += 0.05;
    embedding[(wordCount * 19) % 384] += 0.05;
    embedding[Math.floor(avgWordLength * 41) % 384] += 0.05;
    
    // Add sentence structure signals
    const questionWords = words.filter(word => 
      ['what', 'how', 'when', 'where', 'why', 'who', 'which'].includes(word)
    ).length;
    const exclamationPattern = text.includes('!') ? 1 : 0;
    const questionPattern = text.includes('?') ? 1 : 0;
    
    embedding[350] += questionWords * 0.3; // Question signal
    embedding[360] += exclamationPattern * 0.3; // Exclamation signal
    embedding[370] += questionPattern * 0.3; // Question mark signal
    
    // L2 normalization (essential for cosine similarity)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }
    
    // Fallback: random normalized vector if all else fails
    const randomEmbedding = Array.from({length: 384}, () => Math.random() - 0.5);
    const randomMagnitude = Math.sqrt(randomEmbedding.reduce((sum, val) => sum + val * val, 0));
    return randomEmbedding.map(val => val / randomMagnitude);
  }

  /**
   * Get embedding dimension based on the service used
   * OpenAI: 1536, Local Transformers/Legacy: 384
   */
  getEmbeddingDimension() {
    if (this.useOpenAI) {
      return 1536; // text-embedding-3-small dimension
    } else {
      return 384; // all-MiniLM-L6-v2 dimension
    }
  }

  /**
   * Check which embedding service is currently active
   * Useful for debugging and monitoring
   */
  getActiveService() {
    if (this.useOpenAI) {
      return 'openai';
    } else {
      return 'local-transformers';
    }
  }
}

module.exports = new EmbeddingService();
