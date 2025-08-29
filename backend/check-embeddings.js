const mongoose = require('mongoose');
const Message = require('./models/Message');
require('dotenv').config();

async function checkEmbeddings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const totalMessages = await Message.countDocuments();
    const messagesWithEmbeddings = await Message.countDocuments({
      embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
    });

    console.log(`📊 Database Status:`);
    console.log(`   Total messages: ${totalMessages}`);
    console.log(`   Messages with embeddings: ${messagesWithEmbeddings}`);
    console.log(`   Embedding coverage: ${totalMessages > 0 ? ((messagesWithEmbeddings / totalMessages) * 100).toFixed(2) : 0}%`);

    if (messagesWithEmbeddings > 0) {
      const sampleMessage = await Message.findOne({
        embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
      });
      console.log(`\n🔍 Sample embedding dimensions: ${sampleMessage.embedding.length}`);
      console.log(`📝 Sample message: "${sampleMessage.message.substring(0, 50)}..."`);
    } else {
      console.log(`\n⚠️  No messages have embeddings yet`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEmbeddings();
