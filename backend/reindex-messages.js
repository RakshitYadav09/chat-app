const mongoose = require('mongoose');
const Message = require('./models/Message');
const vectorDatabase = require('./utils/vectorDatabase');
require('dotenv').config();

async function reindexAllMessages() {
  try {
    console.log('🔄 Re-indexing all messages in Qdrant...');

    await mongoose.connect(process.env.MONGODB_URI);

    const messages = await Message.find({}).limit(50);
    console.log(`📝 Found ${messages.length} messages to re-index`);

    let successCount = 0;
    let errorCount = 0;

    for (const message of messages) {
      try {
        await vectorDatabase.indexMessage({
          _id: message._id,
          content: message.message,
          userId: message.senderId.toString(),
          timestamp: message.timestamp || message.createdAt,
          senderId: message.senderId,
          receiverId: message.receiverId
        });

        successCount++;
        console.log(`✅ Indexed ${successCount}/${messages.length}`);

      } catch (error) {
        console.warn(`⚠️  Failed to index message ${message._id}: ${error.message}`);
        errorCount++;
      }
    }

    await mongoose.disconnect();

    console.log('✅ Re-indexing completed!');
    console.log(`📊 Results: ${successCount} successful, ${errorCount} errors`);

  } catch (error) {
    console.error('❌ Failed to re-index messages:', error.message);
  }
}

reindexAllMessages();
