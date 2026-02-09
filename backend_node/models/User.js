const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'staff'],
        default: 'staff'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    businessName: { type: String, default: '' },
    location: { type: String, default: '' },
    plainPasswordForAdmin: { type: String, default: '' },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLatitude: {
        type: Number
    },
    lastLongitude: {
        type: Number
    },
    lastLocationTime: {
        type: Date
    }
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
        throw new Error(err);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
