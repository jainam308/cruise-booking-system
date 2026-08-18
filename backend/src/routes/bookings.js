const express = require('express');
const router = express.Router();
const Cruise = require('../models/Cruise');
const PromoCode = require('../models/PromoCode');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const PricingRules = require('../models/PricingRules');
const { buildPriceBreakdown } = require('../services/pricingEngine');
const { nanoid } = require('nanoid');

// ── Shared: load pricing rules from DB ────────────────────────────────────────
async function loadRules() {
  const [taxSetting, childBandsDoc, groupTiersDoc, optionalSvcDoc] = await Promise.all([
    Settings.findOne({ key: 'taxRate' }).lean(),
    PricingRules.findOne({ type: 'childFareBands' }).lean(),
    PricingRules.findOne({ type: 'groupDiscountTiers' }).lean(),
    PricingRules.findOne({ type: 'optionalServices' }).lean(),
  ]);

  if (!taxSetting || !childBandsDoc || !groupTiersDoc || !optionalSvcDoc) {
    throw new Error('Pricing configuration missing from database. Run the seed script.');
  }

  return {
    taxRate:            taxSetting.value,
    childFareBands:     childBandsDoc.data.bands,
    groupDiscountTiers: groupTiersDoc.data.tiers,
    optionalServices:   optionalSvcDoc.data.services,
  };
}

// ── Shared: validate booking inputs ───────────────────────────────────────────
function validateBookingInputs(passengers) {
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return 'At least one passenger is required.';
  }
  if (passengers.length > 6) {
    return 'A booking may have at most 6 passengers.';
  }
  const adultCount = passengers.filter(p => p.type === 'adult').length;
  if (adultCount === 0) {
    return 'At least 1 adult is required per booking.';
  }
  for (const p of passengers) {
    if (p.type === 'child') {
      if (p.age === undefined || p.age === null) return 'Child age is required.';
      if (p.age < 0 || p.age > 17) return 'Child age must be 0–17. Passengers aged 18+ must be entered as adults.';
    }
  }
  return null; // no error
}

// ── POST /api/bookings/quote ──────────────────────────────────────────────────
// Computes a full price breakdown. No writes to DB.
router.post('/quote', async (req, res) => {
  try {
    const { cruiseId, passengers, selectedExtras = [], promoCode, customerEmail } = req.body;

    const inputError = validateBookingInputs(passengers);
    if (inputError) return res.status(400).json({ error: inputError });

    const cruise = await Cruise.findById(cruiseId).lean();
    if (!cruise) return res.status(404).json({ error: 'Cruise not found.' });
    if (cruise.capacityLeft < passengers.length) {
      return res.status(400).json({
        error: cruise.capacityLeft === 0
          ? 'This cruise is sold out.'
          : `Not enough capacity. Only ${cruise.capacityLeft} place(s) remaining.`,
      });
    }

    const rules = await loadRules();

    // Fetch promo if provided
    let promo = null;
    let customerPromoUseCount = 0;
    if (promoCode) {
      promo = await PromoCode.findOne({ code: promoCode.toUpperCase() }).lean();
      // Fail fast if code string was given but not found — don't silently ignore it
      if (!promo) return res.status(400).json({ error: 'Promo code not found.' });
      if (customerEmail) {
        customerPromoUseCount = await Order.countDocuments({
          customerEmail: customerEmail.toLowerCase(),
          'promoCodeSnapshot.code': promo.code,
        });
      }
    }

    const breakdown = buildPriceBreakdown(
      cruise, passengers, selectedExtras, promo, customerPromoUseCount, rules, new Date()
    );

    if (breakdown.error) {
      return res.status(400).json({ error: breakdown.error });
    }

    res.json({ cruise, breakdown });
  } catch (err) {
    console.error('/quote error:', err);
    res.status(500).json({ error: err.message || 'Quote failed.' });
  }
});

// ── POST /api/bookings/confirm ────────────────────────────────────────────────
// Recomputes price (same function as /quote), then atomically:
//   1. Decrements cruise capacity
//   2. Increments promo usage (if applicable)
//   3. Saves the Order snapshot
router.post('/confirm', async (req, res) => {
  try {
    const {
      cruiseId, passengers, selectedExtras = [],
      promoCode, customerName, customerEmail, customerPhone = '',
    } = req.body;

    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: 'Customer name and email are required.' });
    }

    const inputError = validateBookingInputs(passengers);
    if (inputError) return res.status(400).json({ error: inputError });

    const cruise = await Cruise.findById(cruiseId).lean();
    if (!cruise) return res.status(404).json({ error: 'Cruise not found.' });

    // Early capacity check — gives a clear 400 before touching any writes.
    // The atomic update below is still the safety net for race conditions.
    if (cruise.capacityLeft < passengers.length) {
      return res.status(400).json({
        error: cruise.capacityLeft === 0
          ? 'This cruise is sold out.'
          : `Not enough capacity. Only ${cruise.capacityLeft} place(s) remaining.`,
      });
    }

    const rules = await loadRules();

    let promo = null;
    let customerPromoUseCount = 0;
    if (promoCode) {
      promo = await PromoCode.findOne({ code: promoCode.toUpperCase() }).lean();
      // Fail fast if code string was given but not found — don't silently ignore it
      if (!promo) return res.status(400).json({ error: 'Promo code not found.' });
      if (customerEmail) {
        customerPromoUseCount = await Order.countDocuments({
          customerEmail: customerEmail.toLowerCase(),
          'promoCodeSnapshot.code': promo.code,
        });
      }
    }

    // Recompute price — same function as /quote, ensuring price shown = price charged
    const breakdown = buildPriceBreakdown(
      cruise, passengers, selectedExtras, promo, customerPromoUseCount, rules, new Date()
    );

    if (breakdown.error) {
      return res.status(400).json({ error: breakdown.error });
    }

    // ── Atomic capacity decrement ─────────────────────────────────────────────
    // Uses $gte filter so it only succeeds if capacity is still sufficient.
    // If another booking filled the last spots between quote and confirm, this returns null.
    const updatedCruise = await Cruise.findOneAndUpdate(
      { _id: cruiseId, capacityLeft: { $gte: passengers.length } },
      { $inc: { capacityLeft: -passengers.length } },
      { new: true }
    );
    if (!updatedCruise) {
      return res.status(409).json({
        error: 'Booking failed: cruise is now sold out or capacity has changed. Please check availability and try again.',
      });
    }

    // ── Atomic promo usage increment ──────────────────────────────────────────
    if (promo) {
      const updatedPromo = await PromoCode.findOneAndUpdate(
        { _id: promo._id, currentTotalUses: { $lt: promo.maxTotalUses } },
        { $inc: { currentTotalUses: 1 } },
        { new: true }
      );
      if (!updatedPromo) {
        // Roll back capacity decrement (best-effort)
        await Cruise.findByIdAndUpdate(cruiseId, { $inc: { capacityLeft: passengers.length } });
        return res.status(409).json({
          error: 'Promo code was just exhausted by another booking. Please try without a promo code.',
        });
      }
    }

    // ── Save Order snapshot ───────────────────────────────────────────────────
    const bookingReference = 'CBS-' + nanoid(6).toUpperCase();

    const order = await Order.create({
      bookingReference,
      customerName,
      customerEmail:  customerEmail.toLowerCase(),
      customerPhone,
      cruiseId:       cruise._id,
      cruiseNameSnapshot:  `${cruise.cruiseLine} — ${cruise.ship}`,
      destinationSnapshot: cruise.destination,
      nightsSnapshot:      cruise.nights,
      adultFareSnapshot:   cruise.adultFare,

      passengers: breakdown.passengers.map(p => ({
        type:           p.type,
        age:            p.age,
        fareMultiplier: p.fareMultiplier,
        computedFare:   p.computedFare,
      })),
      cruiseFareSubtotal:          breakdown.cruiseFareSubtotal,
      groupDiscountPercentApplied: breakdown.groupDiscountPercent,
      groupDiscountAmount:         breakdown.groupDiscountAmount,
      discountedCruiseFare:        breakdown.discountedCruiseFare,
      extras:                      breakdown.extras,
      optionalServicesTotal:       breakdown.optionalServicesTotal,
      preTaxSubtotal:              breakdown.preTaxSubtotal,
      promoCodeSnapshot:           breakdown.promoApplied,
      promoDiscount:               breakdown.promoDiscount,
      taxableAmount:               breakdown.taxableAmount,
      taxRateApplied:              rules.taxRate,
      taxAmount:                   breakdown.taxAmount,
      grandTotal:                  breakdown.grandTotal,
    });

    res.status(201).json({
      bookingReference: order.bookingReference,
      grandTotal:       order.grandTotal,
      breakdown,
      message: 'Booking confirmed.',
    });
  } catch (err) {
    console.error('/confirm error:', err);
    res.status(500).json({ error: err.message || 'Booking failed.' });
  }
});

module.exports = router;
