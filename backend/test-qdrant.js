const { QdrantClient } = require('@qdrant/qdrant-js');
require('dotenv').config();

async function testQdrantConnection() {
  console.log('🧪 Testing Qdrant Connection...\n');

  try {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY
    });

    console.log('1️⃣ Testing basic connection...');
    const collections = await client.getCollections();
    console.log('✅ Connected to Qdrant successfully!');
    console.log(`📊 Existing collections: ${collections.collections.length}`);

    console.log('\n2️⃣ Checking for messages collection...');
    const collectionName = process.env.QDRANT_COLLECTION || 'messages';
    const exists = collections.collections.some(col => col.name === collectionName);

    if (exists) {
      console.log(`✅ Collection '${collectionName}' already exists`);

      // Get collection info
      const info = await client.getCollection(collectionName);
      console.log(`📊 Collection info:`);
      console.log(`   - Vectors count: ${info.points_count}`);
      console.log(`   - Dimensions: ${info.config.params.vectors.size}`);
      console.log(`   - Distance: ${info.config.params.vectors.distance}`);
    } else {
      console.log(`📝 Collection '${collectionName}' doesn't exist, creating...`);

      await client.createCollection(collectionName, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });

      // Create payload indexes for efficient filtering
      await client.createPayloadIndex(collectionName, {
        field_name: 'userId',
        field_schema: 'keyword'
      });

      await client.createPayloadIndex(collectionName, {
        field_name: 'timestamp',
        field_schema: 'datetime'
      });

      console.log(`✅ Collection '${collectionName}' created successfully!`);
    }

    console.log('\n3️⃣ Testing vector operations...');

    // Test inserting a sample vector
    const testPoint = {
      id: 'test-message-123',
      vector: Array.from({length: 384}, () => Math.random() - 0.5), // Random 384-dim vector
      payload: {
        messageId: 'test-message-123',
        content: 'Hello, this is a test message!',
        userId: 'test-user',
        timestamp: new Date().toISOString(),
        senderId: 'test-user',
        receiverId: 'test-user-2'
      }
    };

    await client.upsert(collectionName, {
      points: [testPoint]
    });
    console.log('✅ Test vector inserted successfully');

    // Test searching
    const searchResult = await client.search(collectionName, {
      vector: testPoint.vector,
      limit: 5,
      with_payload: true
    });

    console.log(`✅ Search test successful! Found ${searchResult.length} results`);
    if (searchResult.length > 0) {
      console.log(`   - Top result score: ${searchResult[0].score.toFixed(4)}`);
      console.log(`   - Content: "${searchResult[0].payload.content}"`);
    }

    // Clean up test data
    await client.delete(collectionName, {
      points: ['test-message-123']
    });
    console.log('🧹 Test data cleaned up');

    console.log('\n🎉 Qdrant is working perfectly!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Connection: Successful');
    console.log('- ✅ Collection: Ready');
    console.log('- ✅ Vector operations: Working');
    console.log('- ✅ Search functionality: Operational');

  } catch (error) {
    console.error('❌ Qdrant test failed:', error.message);

    if (error.message.includes('fetch failed')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check your internet connection');
      console.log('2. Verify QDRANT_URL is correct');
      console.log('3. Ensure QDRANT_API_KEY has proper permissions');
      console.log('4. Check if Qdrant instance is running');
    }

    if (error.message.includes('unauthorized')) {
      console.log('\n🔧 API Key Issues:');
      console.log('1. Verify the API key is correct');
      console.log('2. Check if the key has write permissions');
      console.log('3. Ensure the key hasn\'t expired');
    }
  }
}

testQdrantConnection();
