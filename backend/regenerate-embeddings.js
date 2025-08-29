const axios = require('axios');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const embeddingService = require('./utils/embeddings');
const vectorDatabase = require('./utils/vectorDatabase');
require('dotenv').config();

async function forceRegenerateAllEmbeddings() {
  try {
    console.log('🔄 Force regenerating ALL embeddings (ignoring existing ones)...');

    await mongoose.connect(process.env.MONGODB_URI);

    // Get ALL messages regardless of embedding status
    const messages = await Message.find({}).limit(50); // Process in smaller batches
    console.log(`📝 Found ${messages.length} messages to process`);

    let processedCount = 0;
    let errorCount = 0;

    for (const message of messages) {
      try {
        console.log(`🔄 Processing message: "${message.message.substring(0, 30)}..."`);

        // Generate new embedding
        const embedding = await embeddingService.generateEmbedding(message.message);

        // Update MongoDB
        await Message.findByIdAndUpdate(message._id, {
          embedding,
          updatedAt: new Date()
        });

        // Index in vector database
        if (vectorDatabase.isEnabled) {
          await vectorDatabase.indexMessage({
            _id: message._id,
            content: message.message,
            userId: message.senderId.toString(),
            timestamp: message.timestamp || message.createdAt,
            senderId: message.senderId,
            receiverId: message.receiverId
          });
        }

        processedCount++;
        console.log(`✅ Processed ${processedCount}/${messages.length}`);

      } catch (error) {
        console.warn(`⚠️  Failed to process message ${message._id}:`, error.message);
        errorCount++;
      }
    }

    await mongoose.disconnect();

    console.log('✅ Embedding regeneration completed!');
    console.log(`📊 Results: ${processedCount} processed, ${errorCount} errors`);
    console.log(`🎯 Embedding service used: ${embeddingService.getActiveService()}`);
    console.log(`📏 Embedding dimensions: ${embeddingService.getEmbeddingDimension()}`);

  } catch (error) {
    console.error('❌ Failed to regenerate embeddings:', error.message);
  }
}

forceRegenerateAllEmbeddings();