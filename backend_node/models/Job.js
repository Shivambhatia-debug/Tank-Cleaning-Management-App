const mongoose = require('mongoose');

/**
 * Job = ek actual cleaning visit.
 *
 * Isme CRM + payment + reminder + tracking sab fields rakhe gaye hain
 * taaki future me reports / repeat cleaning / incentives easily nikale ja saken.
 */
const jobSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },

    // --- CRM Fields ---
    tankSize: {
        type: String, // 500L, 1000L, etc.
        default: ''
    },
    tankCount: {
        type: Number, // number of tanks (e.g. 2) for incentive = tankCount * perTankIncentive + perJobIncentive
        default: 1
    },
    serviceType: {
        type: String, // Water Tank, Septic, etc.
        default: ''
    },
    leadSource: {
        type: String, // Facebook, Instagram, WhatsApp, Direct Call, etc.
        default: 'Direct Call'
    },
    mobileNumber: {
        type: String,
        trim: true
    },

    // --- Service Schedule (for reminders) ---
    // Admin jab job banata hai, us din/waqt ko yahan store kar sakta hai
    scheduledAt: {
        type: Date // "Job Reminder" (2 ghanta pehle) isi pe based hoga
    },

    // --- Payment Fields ---
    serviceCharge: {
        type: Number,
        default: 0
    },
    // Cash / UPI / Online / Pending
    paymentMode: {
        type: String,
        enum: ['cash', 'upi', 'online', 'pending'],
        default: 'pending'
    },
    // Payment Pending / Paid
    paymentStatus: {
        type: String,
        enum: ['paid', 'pending'],
        default: 'pending'
    },
    staffRemark: {
        type: String,
        trim: true
    },

    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },

    // Assigned staff (ek ya zyada log)
    assignedStaff: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Job Status (service ki journey)
    // pending → on_the_way → in_progress → completed
    status: {
        type: String,
        enum: ['pending', 'on_the_way', 'in_progress', 'completed'],
        default: 'pending'
    },
    notes: {
        type: String,
        trim: true
    },

    photos: {
        before: [String],
        after: [String]
    },

    // Proximity / Target Tracking
    targetLatitude: Number,
    targetLongitude: Number,
    trackingEnabled: { type: Boolean, default: true },

    // Before photo (taken when staff starts the job)
    beforePhotoAt: { type: Date },
    beforePhotoLatitude: Number,
    beforePhotoLongitude: Number,

    // Completion / After photo (taken when staff finishes work)
    completionPhoto: String,
    completionPhotoAt: { type: Date },
    completionLatitude: Number,
    completionLongitude: Number,

    // --- Incentives (Staff performance) ---
    // Per job / per tank incentive amount, e.g. ₹20 / ₹25 / custom
    incentivePerJob: {
        type: Number,
        default: 0
    },

    // Auto-filled when job completes (repeat cleaning reminder)
    nextServiceAt: {
        type: Date // completedAt + 6 months
    },

    timeline: {
        createdAt: { type: Date, default: Date.now },
        startedAt: Date,        // when staff taps "Start Job" (on_the_way)
        arrivedAt: Date,        // when staff uploads first before photo (in_progress)
        completedAt: Date       // when job marked complete
    }
});

module.exports = mongoose.model('Job', jobSchema);
