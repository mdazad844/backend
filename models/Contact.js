const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // Ticket Information
  ticketId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  // Contact Information
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  phone: { 
    type: String, 
    required: true 
  },
  
  // Message Details
  subject: { 
    type: String, 
    required: true,
    enum: ['bulk-order', 'custom-printing', 'product-info', 'shipping', 'returns', 'business', 'other']
  },
  orderType: { 
    type: String,
    enum: ['personal', 'business', 'event', 'wholesale', '']
  },
  estimatedQuantity: { 
    type: Number,
    min: 0
  },
  message: { 
    type: String, 
    required: true 
  },
  
  // Status Tracking
  status: { 
    type: String, 
    enum: ['new', 'read', 'replied', 'closed'], 
    default: 'new' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'normal', 'high', 'urgent'], 
    default: 'normal' 
  },
  
  // Source Information
  source: { 
    type: String, 
    default: 'website' 
  },
  pageUrl: { type: String },
  userAgent: { type: String },
  ipAddress: { type: String },
  
  // Follow-up Information
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  lastRepliedAt: { type: Date },
  replyCount: { type: Number, default: 0 },
  
  // Metadata
  metadata: { type: Object },
  tags: [{ type: String }],
  
  // Verification (for spam protection)
  verificationToken: { type: String },
  isVerified: { type: Boolean, default: false },
  
  // Analytics
  readAt: { type: Date },
  firstResponseTime: { type: Number }, // in minutes
  
}, {
  timestamps: true
});

// Indexes for better query performance
contactSchema.index({ ticketId: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ priority: 1 });
contactSchema.index({ subject: 1 });
contactSchema.index({ 'metadata.source': 1 });

// ========== SINGLE, CORRECT PRE-SAVE HOOK ==========
contactSchema.pre('save', function(next) {
  console.log('🔍 Pre-save hook triggered');
  console.log('🔍 isNew?', this.isNew);
  console.log('🔍 current ticketId:', this.ticketId);
  
  // Only generate ticketId for NEW documents
  if (this.isNew && !this.ticketId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 random chars
    this.ticketId = `CT-${dateStr}-${randomStr}`;
    console.log(`✅ Generated Ticket ID: ${this.ticketId}`);
  }
  
  // Auto-assign priority based on subject (only for new docs)
  if (this.isNew) {
    if (this.subject === 'bulk-order' || this.subject === 'business') {
      this.priority = 'high';
      console.log(`🔔 Set priority to HIGH for subject: ${this.subject}`);
    }
    
    // Auto-add tags for new documents
    const tags = [];
    
    if (this.subject === 'bulk-order' && this.estimatedQuantity && this.estimatedQuantity >= 100) {
      tags.push('bulk-100-plus');
    }
    
    if (this.orderType === 'business' || this.orderType === 'wholesale') {
      tags.push('b2b');
    }
    
    if (tags.length > 0) {
      this.tags = [...(this.tags || []), ...tags];
      console.log(`🏷️ Added tags: ${tags.join(', ')}`);
    }
  }
  
  next();
});

// Static method to get statistics
contactSchema.statics.getStats = async function() {
  return {
    total: await this.countDocuments(),
    new: await this.countDocuments({ status: 'new' }),
    replied: await this.countDocuments({ status: 'replied' }),
    closed: await this.countDocuments({ status: 'closed' }),
    bySubject: await this.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]),
    byDay: await this.aggregate([
      { 
        $group: { 
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ])
  };
};

// Static method to generate monthly report
contactSchema.statics.getMonthlyReport = async function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { 
          day: { $dayOfMonth: '$createdAt' },
          subject: '$subject'
        },
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$firstResponseTime' }
      }
    },
    { $sort: { '_id.day': 1 } }
  ]);
};

// Instance method to mark as replied
contactSchema.methods.markAsReplied = function(responseTime) {
  this.status = 'replied';
  this.lastRepliedAt = new Date();
  this.replyCount += 1;
  
  if (responseTime && !this.firstResponseTime) {
    this.firstResponseTime = responseTime;
  }
  
  return this.save();
};

// Instance method to add internal note
contactSchema.methods.addInternalNote = function(note, userId) {
  this.metadata = this.metadata || {};
  this.metadata.internalNotes = this.metadata.internalNotes || [];
  this.metadata.internalNotes.push({
    note,
    userId,
    timestamp: new Date()
  });
  
  return this.save();
};

module.exports = mongoose.model('Contact', contactSchema);
