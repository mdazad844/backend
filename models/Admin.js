const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    passwordHash: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    role: { 
        type: String, 
        default: 'admin',
        enum: ['admin', 'superadmin']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: { 
        type: Date 
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (this.isModified('passwordHash')) {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
    this.updatedAt = new Date();
    next();
});

// Method to check password
adminSchema.methods.checkPassword = async function(password) {
    return await bcrypt.compare(password, this.passwordHash);
};

// Method to check if account is locked
adminSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
adminSchema.methods.incrementLoginAttempts = function() {
    // Reset if lock has expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = undefined;
        return this.save();
    }
    
    this.loginAttempts += 1;
    
    // Lock account after 5 failed attempts for 15 minutes
    if (this.loginAttempts >= 5 && !this.isLocked()) {
        this.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
    }
    
    return this.save();
};

// Reset login attempts on successful login
adminSchema.methods.resetLoginAttempts = function() {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    this.lastLogin = new Date();
    return this.save();
};

module.exports = mongoose.model('Admin', adminSchema);
