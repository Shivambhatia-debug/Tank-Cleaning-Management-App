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

