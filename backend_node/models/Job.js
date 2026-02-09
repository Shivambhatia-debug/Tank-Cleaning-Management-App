const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    // CRM Fields
    tankSize: String, // 500L, 1000L, etc.
    serviceType: String, // Water Tank, Septic, etc.
    leadSource: String, // Facebook, Google, etc.
    mobileNumber: String,

    // Payment Fields
    serviceCharge: Number,
    paymentMode: { type: String, enum: ['cash', 'upi', 'pending'], default: 'pending' },
    paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'pending' },

    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    assignedStaff: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
    },
    notes: String,
    photos: {
        before: [String],
        after: [String]
    },
    // Proximity / Target Tracking
    targetLatitude: Number,
    targetLongitude: Number,
    trackingEnabled: { type: Boolean, default: true },

    // Completion Verification (photo + time, date, location from staff device)
    completionPhoto: String,
    completionPhotoAt: { type: Date },
    completionLatitude: Number,
    completionLongitude: Number,

    timeline: {
        createdAt: { type: Date, default: Date.now },
        startedAt: Date,
        completedAt: Date
    }
});

module.exports = mongoose.model('Job', jobSchema);
