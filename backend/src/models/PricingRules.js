const mongoose = require('mongoose');

// Data-driven pricing rules — child fare bands, group discount tiers, optional service rates.
// Stored here so they can be changed without a code change or redeployment.
const pricingRulesSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true },
  // The actual rule payload. Structure depends on type:
  //   childFareBands:      { bands: [{ minAge, maxAge, multiplier }] }
  //   groupDiscountTiers:  { tiers: [{ minPassengers, maxPassengers, discountRate }] }
  //   optionalServices:    { services: [{ key, label, pricePerPassenger, perNight }] }
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PricingRules', pricingRulesSchema);
