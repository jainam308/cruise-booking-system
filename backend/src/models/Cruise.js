const mongoose = require('mongoose');

const cruiseSchema = new mongoose.Schema({
  cruiseLine:    { type: String, required: true },
  ship:          { type: String, required: true },
  destination:   { type: String, required: true },
  nights:        { type: Number, required: true },
  adultFare:     { type: Number, required: true },
  capacityLeft:  { type: Number, required: true, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Cruise', cruiseSchema);
