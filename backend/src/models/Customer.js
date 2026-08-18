const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
}, { timestamps: true });

// No uniqueness constraint on email — same email can appear on multiple bookings.
// Email is used as a key for per-customer promo tracking (counted via Order documents).
// See TechnicalApproach.md §5.

module.exports = mongoose.model('Customer', customerSchema);
