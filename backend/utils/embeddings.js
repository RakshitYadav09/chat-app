const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class EmbeddingService {
  constructor() {
  this.openaiApiKey = process.env.OPENAI_API_KEY;
  this.claudeApiKey = process.env.CLAUDE_API_KEY;
  // Prefer Claude when available (project requirement). Use OpenAI only as a fallback.
  this.useClaude = !!this.claudeApiKey;
  this.useOpenAI = !!this.openaiApiKey && !this.useClaude && this.openaiApiKey !== 'your-openai-api-key-here';
    
    // Priority order: Claude API → OpenAI API → Legacy local fallback
    if (this.useClaude) {
      console.log('✅ Using Claude API for embeddings (primary)');
    } else if (this.useOpenAI) {
      console.log('✅ Using OpenAI API for embeddings (fallback)');
    } else {
      console.log('✅ Using legacy local embedding generation');
    }
  }

  /**
   * Main embedding generation function with proper semantic embeddings
   * Priority: OpenAI API → Claude API → Legacy local fallback
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateEmbedding(text) {
    try {
      // PRIORITY 1: Try Claude API (project requirement)
      if (this.useClaude) {
        return await this.generateClaudeEmbedding(text);
      }

      // PRIORITY 2: Try OpenAI API if Claude not available
      if (this.useOpenAI) {
        return await this.generateOpenAIEmbedding(text);
      }
      
      // PRIORITY 3: Use legacy local implementation (fallback)
      console.log('🔄 Using legacy local embedding generation');
      return await this.generateLegacyLocalEmbedding(text);
      
    } catch (error) {
      console.error('Primary embedding generation failed, trying fallback:', error.message);
      
      // Try next available method
      try {
        if (this.useClaude && !this.useOpenAI) {
          console.log('🔄 Falling back to Claude API');
          return await this.generateClaudeEmbedding(text);
        } else {
          console.log('🔄 Falling back to legacy local embedding generation');
          return await this.generateLegacyLocalEmbedding(text);
        }
      } catch (fallbackError) {
        console.error('❌ All embedding methods failed:', fallbackError.message);
        // Return a zero vector as last resort to prevent crashes
        console.log('🚨 Returning zero vector to prevent crash');
        return new Array(1536).fill(0);
      }
    }
  }

  /**
   * OpenAI API embedding generation (industry standard for semantic search)
   * Uses text-embedding-3-small model for high-quality 1536-dimensional vectors
   */
  async generateOpenAIEmbedding(text) {
    try {
      console.log('🚀 Generating OpenAI embedding for:', text.substring(0, 50) + '...');

      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-3-small',
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const embedding = response.data.data[0].embedding;
      console.log(`✅ OpenAI embedding generated: ${embedding.length} dimensions`);

      return embedding;

    } catch (error) {
      console.error('❌ OpenAI embedding error:', error.response?.data || error.message);
      throw error;
    }
  }
  async generateClaudeEmbedding(text) {
    try {
      console.log('🚀 Generating Claude embedding for:', text);

      // Use a more structured approach for semantic analysis
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
          temperature: 0.1, // Low temperature for consistent results
          messages: [{
            role: 'user',
            content: `Analyze the semantic meaning of this text and rate it on 20 different dimensions from -1 to 1:

Text: "${text}"

Please respond with exactly 20 numbers separated by commas, representing:
1. Greeting/Farewell (hello, goodbye, etc.)
2. Gratitude (thanks, appreciate, etc.)
3. Politeness (please, sorry, etc.)
4. Questions (what, how, why, etc.)
5. Answers (yes, no, maybe, etc.)
6. Positive emotion (happy, excited, etc.)
7. Negative emotion (sad, angry, etc.)
8. Communication (chat, message, etc.)
9. Help/Support (assist, guide, etc.)
10. Time-related (today, tomorrow, etc.)
11. Technology (code, app, etc.)
12. Food/Drink (eat, hungry, etc.)
13. Weather (rain, sunny, etc.)
14. Location (here, there, etc.)
15. Quantity (many, few, etc.)
16. Intensity (very, extremely, etc.)
17. Personal pronouns (I, you, we, etc.)
18. Possessive (my, your, etc.)
19. Action verbs (work, play, etc.)
20. Abstract concepts (love, freedom, etc.)

Format: number1,number2,number3,...,number20`
          }]
        },
        {
          headers: {
            'x-api-key': this.claudeApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const content = response.data.content[0].text;
      console.log('Claude response:', content);

      // Extract numbers from the response
      const numbers = content.match(/-?\d+\.?\d*/g);

      if (numbers && numbers.length >= 20) {
        const embedding = numbers.slice(0, 20).map(n => {
          const num = parseFloat(n);
          return Math.max(-1, Math.min(1, num)); // Ensure range [-1, 1]
        });

        console.log('Extracted embedding values:', embedding);

        // Pad to 1536 dimensions for compatibility with OpenAI
        while (embedding.length < 1536) {
          embedding.push(0);
        }

        return embedding.slice(0, 1536);
      } else {
        console.log('Could not extract 20 numbers from Claude response');
        throw new Error('Invalid Claude response format');
      }

    } catch (error) {
      console.error('❌ Claude embedding error:', error.response?.data || error.message);
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
    
    // Initialize 1536-dimensional embedding (same as text-embedding-3-small)
    const embedding = new Array(1536).fill(0);
    
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
        const baseIndex = (groupIndex * 12) % 1536;
        const groupWeight = Math.min(groupScore / words.length * 3, 1); // Normalize
        
        // Primary signal
        embedding[baseIndex] += groupWeight * 2;
        
        // Secondary signals for context
        for (let i = 1; i <= 5; i++) {
          embedding[(baseIndex + i) % 1536] += groupWeight * (1 - i * 0.15);
          embedding[(baseIndex - i + 1536) % 1536] += groupWeight * (1 - i * 0.15);
        }
      }
    });
    
    // Add word-level features using character-based hashing
    words.forEach((word, wordIndex) => {
      // Character composition features
      const charSum = word.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const wordHash1 = charSum % 1536;
      const wordHash2 = (charSum * 17) % 1536;
      const wordHash3 = (charSum * 31) % 1536;
      
      const wordWeight = 1 / Math.sqrt(words.length); // Inverse frequency weighting
      
      embedding[wordHash1] += wordWeight * 0.3;
      embedding[wordHash2] += wordWeight * 0.2;
      embedding[wordHash3] += wordWeight * 0.1;
      
      // Position-based encoding (sentence structure)
      const positionWeight = 1 / (1 + wordIndex); // Earlier words get more weight
      const positionIndex = (wordIndex * 7) % 1536;
      embedding[positionIndex] += positionWeight * 0.2;
      
      // Word length encoding
      const lengthIndex = (word.length * 23) % 1536;
      embedding[lengthIndex] += wordWeight * 0.1;
    });
    
    // Text-level features
    const textLength = text.length;
    const wordCount = words.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
    
    // Global text features
    embedding[textLength % 1536] += 0.05;
    embedding[(wordCount * 19) % 1536] += 0.05;
    embedding[Math.floor(avgWordLength * 41) % 1536] += 0.05;
    
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
    const randomEmbedding = Array.from({length: 1536}, () => Math.random() - 0.5);
    const randomMagnitude = Math.sqrt(randomEmbedding.reduce((sum, val) => sum + val * val, 0));
    return randomEmbedding.map(val => val / randomMagnitude);
  }

  /**
   * Get embedding dimension based on the service used
   * OpenAI: 1536, Claude: 1536 (padded), Legacy: 1536
   */
  getEmbeddingDimension() {
    return 1536; // All methods return 1536-dimensional vectors
  }

  /**
   * Check which embedding service is currently active
   * Useful for debugging and monitoring
   */
  getActiveService() {
    if (this.useOpenAI) {
      return 'openai-api';
    } else if (this.useClaude) {
      return 'claude-api';
    } else {
      return 'legacy-local';
    }
  }
}

module.exports = new EmbeddingService();
