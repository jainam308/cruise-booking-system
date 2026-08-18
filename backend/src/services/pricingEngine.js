/**
 * pricingEngine.js — pure pricing functions, no DB access.
 *
 * All functions here are deterministic given their inputs.
 * Called identically from /quote and /confirm — guaranteeing price shown = price charged.
 * Rules (bands, tiers, rates) are passed in as parameters, fetched from DB by the caller.
 */

/**
 * Find the child fare multiplier for a given age using the data-driven bands.
 * @param {number} age
 * @param {Array<{minAge, maxAge, multiplier}>} bands
 * @returns {number} multiplier
 * @throws if age < 0 or age > 17 (caller must validate 18+ as adult)
 */
function getChildMultiplier(age, bands) {
  if (typeof age !== 'number' || isNaN(age) || !Number.isInteger(age) || age < 1) {
    throw new Error('Invalid child age: must be an integer between 1 and 17.');
  }
  if (age > 17) {
    throw new Error('Child age must be between 1 and 17. Passengers aged 18+ must be entered as adults.');
  }

  const band = bands.find(b => age >= b.minAge && age <= b.maxAge);
  if (!band) throw new Error(`No fare band found for age ${age}.`);
  return band.multiplier;
}

/**
 * Compute the cruise fare for a single passenger.
 * Adults always use multiplier 1.0.
 * @param {{ type: 'adult'|'child', age?: number }} passenger
 * @param {number} adultFare
 * @param {Array} childFareBands
 * @returns {{ fareMultiplier: number, computedFare: number }}
 */
function computePassengerFare(passenger, adultFare, childFareBands) {
  if (passenger.type === 'adult') {
    return { fareMultiplier: 1.0, computedFare: adultFare };
  }
  const multiplier = getChildMultiplier(passenger.age, childFareBands);
  return {
    fareMultiplier: multiplier,
    computedFare: round2(adultFare * multiplier),
  };
}

/**
 * Find the applicable group discount rate for a given passenger count.
 * @param {number} totalPassengers
 * @param {Array<{minPassengers, maxPassengers, discountRate}>} tiers
 * @returns {number} discount rate (e.g. 0.05 for 5%)
 */
function getGroupDiscountRate(totalPassengers, tiers) {
  const tier = tiers.find(t => totalPassengers >= t.minPassengers && totalPassengers <= t.maxPassengers);
  return tier ? tier.discountRate : 0;
}

/**
 * Compute optional services total.
 * Wi-Fi is per passenger per night; others are per passenger only.
 * Children pay full price (see BusinessRequirements.md assumption A8).
 *
 * @param {string[]} selectedKeys - e.g. ['insurance', 'wifi']
 * @param {number} passengerCount - total passengers (adults + children)
 * @param {number} nights - cruise duration
 * @param {Array<{key, label, pricePerPassenger, perNight}>} services
 * @returns {{ extrasBreakdown: Array, optionalServicesTotal: number }}
 */
function computeOptionalServices(selectedKeys, passengerCount, nights, services) {
  const extrasBreakdown = [];
  let optionalServicesTotal = 0;

  for (const key of selectedKeys) {
    const svc = services.find(s => s.key === key);
    if (!svc) throw new Error(`Unknown optional service: "${key}".`);

    const totalCost = svc.perNight
      ? round2(svc.pricePerPassenger * passengerCount * nights)
      : round2(svc.pricePerPassenger * passengerCount);

    extrasBreakdown.push({
      key:            svc.key,
      label:          svc.label,
      pricePerUnit:   svc.pricePerPassenger,
      perNight:       svc.perNight,
      nights:         svc.perNight ? nights : undefined,
      passengerCount,
      totalCost,
    });

    optionalServicesTotal = round2(optionalServicesTotal + totalCost);
  }

  return { extrasBreakdown, optionalServicesTotal };
}

/**
 * Validate a promo code against the current context.
 * Returns { valid: true, discountAmount } or { valid: false, reason }.
 *
 * @param {object} promo - PromoCode document from DB (or null)
 * @param {number} preTaxSubtotal
 * @param {Date} now
 * @param {number} customerUseCount - how many times this customer has used this code
 */
function validatePromoCode(promo, preTaxSubtotal, now, customerUseCount) {
  if (!promo) {
    return { valid: false, reason: 'Promo code not found.' };
  }

  if (now < promo.validFrom || now > promo.validTo) {
    return { valid: false, reason: 'Promo code has expired or is not yet active.' };
  }

  if (promo.currentTotalUses >= promo.maxTotalUses) {
    return { valid: false, reason: 'Promo code has reached its maximum uses.' };
  }

  if (customerUseCount >= promo.maxUsesPerCustomer) {
    return { valid: false, reason: 'You have reached the maximum uses for this code.' };
  }

  if (preTaxSubtotal < promo.minimumSpend) {
    return {
      valid: false,
      reason: `Minimum spend of $${promo.minimumSpend.toFixed(2)} not met (your subtotal is $${preTaxSubtotal.toFixed(2)}).`,
    };
  }

  const discountAmount = promo.type === 'percentage'
    ? round2(preTaxSubtotal * (promo.value / 100))
    : round2(Math.min(promo.value, preTaxSubtotal)); // fixed discount can't exceed subtotal

  return { valid: true, discountAmount };
}

/**
 * Build a full price breakdown from all inputs.
 * This is the single source of truth — called identically by /quote and /confirm.
 *
 * @param {object} cruise - Cruise document
 * @param {Array<{type, age?}>} passengers
 * @param {string[]} selectedExtras - extra keys
 * @param {object|null} promo - PromoCode document or null
 * @param {number} customerPromoUseCount
 * @param {object} rules - { childFareBands, groupDiscountTiers, optionalServices, taxRate }
 * @param {Date} now
 * @returns {object} full breakdown
 */
function buildPriceBreakdown(cruise, passengers, selectedExtras, promo, customerPromoUseCount, rules, now) {
  // ── Step 1–2: Per-passenger fares and cruise fare subtotal ────────────────
  const passengerFares = passengers.map(p => {
    const { fareMultiplier, computedFare } = computePassengerFare(p, cruise.adultFare, rules.childFareBands);
    return { ...p, fareMultiplier, computedFare };
  });

  const cruiseFareSubtotal = round2(passengerFares.reduce((sum, p) => sum + p.computedFare, 0));

  // ── Step 3–4: Group discount on cruise fare only ──────────────────────────
  const groupDiscountRate = getGroupDiscountRate(passengers.length, rules.groupDiscountTiers);
  const groupDiscountAmount = round2(cruiseFareSubtotal * groupDiscountRate);
  const discountedCruiseFare = round2(cruiseFareSubtotal - groupDiscountAmount);

  // ── Step 5: Optional services ─────────────────────────────────────────────
  const { extrasBreakdown, optionalServicesTotal } = computeOptionalServices(
    selectedExtras,
    passengers.length,
    cruise.nights,
    rules.optionalServices
  );

  // ── Step 6: Pre-tax subtotal ──────────────────────────────────────────────
  const preTaxSubtotal = round2(discountedCruiseFare + optionalServicesTotal);

  // ── Step 7: Promo code ────────────────────────────────────────────────────
  let promoResult = null;
  let promoDiscount = 0;

  if (promo) {
    const validation = validatePromoCode(promo, preTaxSubtotal, now, customerPromoUseCount);
    if (!validation.valid) {
      // Surface the error to the caller — they decide how to handle it
      return { error: validation.reason };
    }
    promoDiscount = validation.discountAmount;
    promoResult = {
      code:           promo.code,
      type:           promo.type,
      value:          promo.value,
      discountAmount: promoDiscount,
    };
  }

  // ── Step 8–10: Tax and grand total ────────────────────────────────────────
  // Tax comes after promo: the promo reduces the base on which tax is levied.
  const taxableAmount = round2(preTaxSubtotal - promoDiscount);
  const taxAmount     = round2(taxableAmount * rules.taxRate);
  const grandTotal    = round2(taxableAmount + taxAmount);

  return {
    // Passenger detail
    passengers: passengerFares,
    cruiseFareSubtotal,

    // Group discount
    groupDiscountPercent: groupDiscountRate * 100,
    groupDiscountAmount,
    discountedCruiseFare,

    // Extras
    extras: extrasBreakdown,
    optionalServicesTotal,

    // Promo
    preTaxSubtotal,
    promoApplied: promoResult,
    promoDiscount,

    // Tax + total
    taxableAmount,
    taxRatePercent: rules.taxRate * 100,
    taxAmount,
    grandTotal,
  };
}

/** Round to 2 decimal places (financial rounding). */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = {
  getChildMultiplier,
  computePassengerFare,
  getGroupDiscountRate,
  computeOptionalServices,
  validatePromoCode,
  buildPriceBreakdown,
  round2,
};
