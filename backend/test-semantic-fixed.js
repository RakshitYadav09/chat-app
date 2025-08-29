const axios = require('axios');

async function testSemanticSearch() {
  try {
    console.log('🔍 Testing semantic search after fixes...');

    // Test search stats first
    const statsResponse = await axios.get('http://localhost:10000/messages/search-stats');
    console.log('📊 Search Stats:');
    console.log('Vector DB enabled:', statsResponse.data.vectorDatabase.enabled);
    console.log('Vector search enabled:', statsResponse.data.searchEnabled.vectorSearch);

    // Test semantic search
    console.log('\n🔍 Testing semantic search...');
    const semanticResponse = await axios.get('http://localhost:10000/messages/semantic-search', {
      params: {
        userId: '68b17954db2b59544173872d',
        q: 'hello',
        limit: 5
      }
    });

    console.log('✅ Semantic search results:', semanticResponse.data.results.length);
    console.log('Metadata:', JSON.stringify(semanticResponse.data.metadata, null, 2));

    if (semanticResponse.data.results.length > 0) {
      console.log('\n🎯 Top Results:');
      semanticResponse.data.results.forEach((result, index) => {
        console.log(`   ${index + 1}. "${result.message.substring(0, 50)}..."`);
        console.log(`      Score: ${result.score}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testSemanticSearch();
