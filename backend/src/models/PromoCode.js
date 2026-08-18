const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code:                { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:                { type: String, enum: ['percentage', 'fixed'], required: true },
  value:               { type: Number, required: true },      // % or $ amount
  validFrom:           { type: Date, required: true },
  validTo:             { type: Date, required: true },
  maxTotalUses:        { type: Number, required: true },
  maxUsesPerCustomer:  { type: Number, required: true },
  minimumSpend:        { type: Number, default: 0 },          // 0 = no minimum
  currentTotalUses:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
