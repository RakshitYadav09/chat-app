#!/usr/bin/env node

/**
 * Reindex embeddings for all messages (force regenerate and upsert to Qdrant)
 * - Generates embeddings using the active embedding service (Claude preferred)
 * - Updates MongoDB message.embedding to the new vector
 * - Upserts point into Qdrant via vectorDatabase
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Message = require('./models/Message');
const embeddingService = require('./utils/embeddings');
const vectorDatabase = require('./utils/vectorDatabase');

async function reindexAll() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const messages = await Message.find({}).limit(10000);
    console.log(`📝 Found ${messages.length} messages`);

    let processed = 0;

    for (const msg of messages) {
      try {
        const text = msg.message || msg.content || '';
        const embedding = await embeddingService.generateEmbedding(text);
        await Message.findByIdAndUpdate(msg._id, { embedding });

        // Upsert to Qdrant
        if (vectorDatabase && vectorDatabase.isEnabled) {
          await vectorDatabase.batchIndexMessages([{
            _id: msg._id,
            content: text,
            userId: msg.senderId ? msg.senderId.toString() : (msg.userId || ''),
            timestamp: msg.timestamp || msg.createdAt,
            senderId: msg.senderId,
            receiverId: msg.receiverId
          }]);
        }

        processed++;
        if (processed % 20 === 0) console.log(`Processed ${processed}/${messages.length}`);
      } catch (err) {
        console.warn('⚠️ Failed to reindex message', msg._id, err.message);
      }
    }

    console.log(`✅ Reindex complete. Processed ${processed} messages`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Reindex failed:', error.message || error);
    process.exit(1);
  }
}

reindexAll();
