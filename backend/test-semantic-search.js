#!/usr/bin/env node

/**
 * Semantic Search Test Script
 * Tests the new OpenAI-based semantic search functionality
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';

async function testSemanticSearch() {
  console.log('🧪 Testing Semantic Search with OpenAI Embeddings\n');

  try {
    // Test 1: Check API health
    console.log('1️⃣ Testing API connectivity...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API is healthy\n');

    // Test 2: Test semantic search specifically
    console.log('2️⃣ Testing semantic search...');
    try {
      const semanticResponse = await axios.get(`${API_BASE_URL}/messages/semantic-search`, {
        params: {
          userId: '68b17954db2b59544173872d',
          q: 'hello there',
          limit: 5
        }
      });

      console.log('✅ Semantic search working!');
      console.log(`   - Query: "${semanticResponse.data.query}"`);
      console.log(`   - Results: ${semanticResponse.data.results.length}`);
      console.log(`   - Search time: ${semanticResponse.data.metadata.searchTime}ms`);
      console.log(`   - Embedding service: ${semanticResponse.data.metadata.embeddingService || 'unknown'}`);

      if (semanticResponse.data.results.length > 0) {
        console.log('\n🎯 Top Results:');
        semanticResponse.data.results.forEach((result, index) => {
          console.log(`   ${index + 1}. "${result.message.substring(0, 60)}..."`);
          console.log(`      Score: ${result.score}, Similarity: ${result.similarity}`);
        });
      }

    } catch (error) {
      console.log('❌ Semantic search failed:');
      console.log(`   Error: ${error.response?.data?.error || error.message}`);

      if (error.response?.data?.details) {
        console.log(`   Details: ${error.response.data.details}`);
      }
    }
    console.log('');

    // Test 3: Test combined search
    console.log('3️⃣ Testing combined search (word + semantic)...');
    try {
      const combinedResponse = await axios.get(`${API_BASE_URL}/messages/search`, {
        params: {
          userId: '68b17954db2b59544173872d',
          q: 'hello',
          limit: 5
        }
      });

      console.log('✅ Combined search working!');
      console.log(`   - Results: ${combinedResponse.data.results.length}`);
      console.log(`   - Search time: ${combinedResponse.data.metadata.searchTime}ms`);

      if (combinedResponse.data.results.length > 0) {
        console.log('\n📊 Combined Results:');
        combinedResponse.data.results.forEach((result, index) => {
          const sources = result.sources.join(', ');
          console.log(`   ${index + 1}. "${result.message.substring(0, 50)}..."`);
          console.log(`      Score: ${result.finalScore}, Sources: ${sources}`);
        });
      }

    } catch (error) {
      console.log('❌ Combined search failed:');
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure backend is running: npm start');
    console.log('2. Check OpenAI API key in .env file');
    console.log('3. Verify Qdrant collection dimensions (1536)');
    console.log('4. Check MongoDB connection');
  }
}

// Run the test
testSemanticSearch();
