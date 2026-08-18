const mongoose = require('mongoose');

// A fully frozen snapshot of the booking at confirmation time.
// Every field needed to reconstruct the grand total is stored here.
// No live references to pricing rules — see TechnicalApproach.md §1.

const passengerSnapshotSchema = new mongoose.Schema({
  type:               { type: String, enum: ['adult', 'child'], required: true },
  age:                { type: Number },                  // present for children
  fareMultiplier:     { type: Number, required: true },  // 1.0 for adults, 0/0.5/0.75 for children
  computedFare:       { type: Number, required: true },  // adultFare × multiplier
}, { _id: false });

const extraSnapshotSchema = new mongoose.Schema({
  key:            { type: String, required: true },   // e.g. 'insurance', 'wifi', 'excursion'
  label:          { type: String, required: true },
  pricePerUnit:   { type: Number, required: true },   // rate at time of booking
  perNight:       { type: Boolean, default: false },
  nights:         { type: Number },                   // present when perNight=true
  passengerCount: { type: Number, required: true },
  totalCost:      { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  bookingReference: { type: String, required: true, unique: true },

  // Customer info (stored directly — no FK, so it survives customer doc changes)
  customerName:  { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, default: '' },

  // Cruise snapshot
  cruiseId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Cruise' }, // lookup only
  cruiseNameSnapshot:  { type: String, required: true },  // "Royal Caribbean — Wonder of the Seas"
  destinationSnapshot: { type: String, required: true },
  nightsSnapshot:      { type: Number, required: true },
  adultFareSnapshot:   { type: Number, required: true },

  // Passengers
  passengers: { type: [passengerSnapshotSchema], required: true },
  cruiseFareSubtotal: { type: Number, required: true },

  // Group discount
  groupDiscountPercentApplied: { type: Number, required: true },  // e.g. 5 for 5%
  groupDiscountAmount:         { type: Number, required: true },
  discountedCruiseFare:        { type: Number, required: true },

  // Optional extras
  extras:                { type: [extraSnapshotSchema], default: [] },
  optionalServicesTotal: { type: Number, required: true },

  // Pre-tax subtotal
  preTaxSubtotal: { type: Number, required: true },

  // Promo code (null if none applied)
  promoCodeSnapshot: {
    type: {
      code:           String,
      type:           String,
      value:          Number,
      discountAmount: Number,
    },
    default: null,
  },
  promoDiscount: { type: Number, required: true, default: 0 },

  // Tax
  taxableAmount:   { type: Number, required: true },
  taxRateApplied:  { type: Number, required: true },  // e.g. 0.12
  taxAmount:       { type: Number, required: true },

  grandTotal: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
