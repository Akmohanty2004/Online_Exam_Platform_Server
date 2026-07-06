const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Document expires 10 minutes (600 seconds) after creation
  },
});

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
