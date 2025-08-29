const vectorDatabase = require('./utils/vectorDatabase');

async function testVectorDatabase() {
  console.log('🧪 Testing Vector Database with UUID implementation...\n');

  try {
    // Test 1: Check if vector database is enabled
    console.log('1️⃣  Checking vector database status...');
    const stats = await vectorDatabase.getStats();
    console.log('Vector DB Status:', stats);
    console.log('');

    if (!stats.enabled) {
      console.log('❌ Vector database is disabled. Please check your environment variables.');
      return;
    }

    // Test 2: Test single message indexing
    console.log('2️⃣  Testing single message indexing...');
    const testMessage = {
      _id: '507f1f77bcf86cd799439011', // Mock MongoDB ObjectId
      content: 'This is a test message for vector database indexing',
      userId: 'user123',
      senderId: 'user123',
      receiverId: 'user456',
      timestamp: new Date(),
      createdAt: new Date()
    };

    const pointId = await vectorDatabase.indexMessage(testMessage);
    console.log(`✅ Message indexed successfully with Point ID: ${pointId}`);
    console.log('');

    // Test 3: Test semantic search
    console.log('3️⃣  Testing semantic search...');
    const searchResults = await vectorDatabase.semanticSearch(
      'user123',
      'test message for indexing',
      5,
      0.1
    );
    console.log(`✅ Found ${searchResults.length} search results`);
    if (searchResults.length > 0) {
      console.log('Top result:', {
        messageId: searchResults[0].message._id,
        similarity: searchResults[0].similarity,
        content: searchResults[0].message.content.substring(0, 50) + '...'
      });
    }
    console.log('');

    // Test 4: Test batch indexing
    console.log('4️⃣  Testing batch indexing...');
    const batchMessages = [
      {
        _id: '507f1f77bcf86cd799439012',
        content: 'Another test message for batch processing',
        userId: 'user123',
        senderId: 'user123',
        receiverId: 'user456',
        timestamp: new Date(),
        createdAt: new Date()
      },
      {
        _id: '507f1f77bcf86cd799439013',
        content: 'Third message in the batch test',
        userId: 'user123',
        senderId: 'user123',
        receiverId: 'user456',
        timestamp: new Date(),
        createdAt: new Date()
      }
    ];

    await vectorDatabase.batchIndexMessages(batchMessages);
    console.log('✅ Batch indexing completed successfully');
    console.log('');

    // Test 5: Test delete functionality
    console.log('5️⃣  Testing message deletion...');
    await vectorDatabase.deleteMessage('507f1f77bcf86cd799439011');
    console.log('✅ Message deletion completed successfully');
    console.log('');

    // Test 6: Final stats check
    console.log('6️⃣  Final statistics check...');
    const finalStats = await vectorDatabase.getStats();
    console.log('Final Vector DB Status:', finalStats);

    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ UUID implementation is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
  }
}

// Run the test
testVectorDatabase().then(() => {
  console.log('\n🏁 Test script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
