const mongoose = require('mongoose');

const discussionLogSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
    },
    by: {
      type: String, // name / role of user (e.g. "Admin", "Staff")
      default: 'Admin',
    },
    notes: {
      type: String,
      required: true,
      trim: true,
    },
    nextFollowUpAt: {
      type: Date,
    },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    source: {
      type: String,
      enum: ['Facebook', 'Instagram', 'WhatsApp', 'Direct Call', 'Other'],
      default: 'Direct Call',
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },
    plusCode: {
      type: String,
      trim: true,
    },
    mapLink: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      trim: true,
    },
    tankSizeLtr: {
      type: Number,
    },
    numberOfTanks: {
      type: Number,
    },
    quotedPrice: {
      type: Number,
    },
    finalPrice: {
      type: Number,
    },
    bookingDate: {
      type: Date,
    },
    timeSlot: {
      type: String,
      trim: true,
    },
    assignedStaff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    jobStatus: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      trim: true,
    },
    paymentMode: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['New', 'Follow-up', 'Confirmed', 'Cancelled', 'Converted'],
      default: 'New',
    },
    // link to customer/job once converted
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    firstJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
    },
    discussionLogs: [discussionLogSchema],
    nextFollowUpAt: {
      type: Date,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Lead', leadSchema);

