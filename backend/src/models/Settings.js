const mongoose = require('mongoose');

// Stores the tax rate and any other runtime-configurable scalar settings.
// Fetch by key, e.g. Settings.findOne({ key: 'taxRate' })
const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
