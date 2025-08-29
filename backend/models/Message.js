const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  embedding: {
    type: [Number],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Text index for word search
messageSchema.index({ message: 'text' });

// Index for efficient querying
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

// Virtual for timestamp (for backward compatibility)
messageSchema.virtual('timestamp').get(function() {
  return this.createdAt;
});

module.exports = mongoose.model('Message', messageSchema);
