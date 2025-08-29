#!/usr/bin/env node
const mongoose = require('mongoose');
const Message = require('../models/Message');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const results = await Message.aggregate([
    { $group: { _id: '$senderId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  console.log('Top senderId counts:');
  results.forEach(r => console.log(`${r._id} -> ${r.count}`));

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
