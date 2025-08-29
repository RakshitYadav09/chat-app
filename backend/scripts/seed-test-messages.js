#!/usr/bin/env node

/**
 * Seed script to create custom messages for testing semantic and word search
 * Run: node scripts/seed-test-messages.js
 */

const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const embeddingService = require('../utils/embeddings');
const enhancedSearch = require('../utils/enhancedSearch');
require('dotenv').config();

const TEST_USER_ID = '68b17954db2b59544173872d';

const testMessages = [
  { text: 'Hi, can you send me the homework answers for math 7B?', sender: TEST_USER_ID },
  { text: 'Hey — the homework answers are in my notes, I sent them last week.', sender: TEST_USER_ID },
  { text: 'My phone number is 555-1234, save it please.', sender: TEST_USER_ID },
  { text: 'Call me at five five five one two three four', sender: TEST_USER_ID },
  { text: 'Did you get the chemistry lab report? I can forward the PDF.', sender: TEST_USER_ID },
  { text: 'Homework: Chapter 5 problems 1-10. I solved them yesterday.', sender: TEST_USER_ID },
  { text: 'hello there', sender: TEST_USER_ID },
  { text: 'greetings, how are you?', sender: TEST_USER_ID },
  { text: 'please help me with question 3 from assignment', sender: TEST_USER_ID },
  { text: 'the answer to Q3 is 42', sender: TEST_USER_ID }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔌 Connected to MongoDB');

    // Ensure user exists (create lightweight placeholder if not)
    let user = await User.findById(TEST_USER_ID).catch(() => null);
    if (!user) {
      user = new User({ _id: TEST_USER_ID, name: 'Test User', email: 'test@example.com' });
      await user.save();
      console.log('👤 Created test user');
    }

    for (const m of testMessages) {
      const msg = new Message({
        senderId: m.sender,
        receiverId: TEST_USER_ID, // self chat for test
        message: m.text,
        createdAt: new Date()
      });
      await msg.save();

      // Generate and store embedding
      const embedding = await embeddingService.generateEmbedding(m.text);
      await Message.findByIdAndUpdate(msg._id, { embedding });

      // Index in vector DB
      await enhancedSearch.indexMessage({
        _id: msg._id,
        content: m.text,
        userId: m.sender,
        timestamp: msg.createdAt,
        senderId: m.sender,
        receiverId: TEST_USER_ID
      });

      console.log(`📨 Seeded message: "${m.text.substring(0, 60)}..."`);
    }

    console.log('✅ Seeding complete');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();
