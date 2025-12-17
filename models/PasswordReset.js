// backend/models/PasswordReset.js
const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    expires: 3600 // Auto delete after 1 hour (3600 seconds)
  },
  used: {
    type: Boolean,
    default: false
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Index for faster queries
passwordResetSchema.index({ email: 1, used: 1 });
passwordResetSchema.index({ token: 1, used: 1 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
