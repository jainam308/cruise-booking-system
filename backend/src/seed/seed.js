require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Cruise = require('../models/Cruise');
const PromoCode = require('../models/PromoCode');
const Settings = require('../models/Settings');
const PricingRules = require('../models/PricingRules');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cruise_booking';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Seeding...');

  // Clear existing
  await Promise.all([
    Cruise.deleteMany({}),
    PromoCode.deleteMany({}),
    Settings.deleteMany({}),
    PricingRules.deleteMany({}),
  ]);

  // ── Cruises ──────────────────────────────────────────────────────────────
  await Cruise.insertMany([
    { cruiseLine: 'Royal Caribbean',         ship: 'Wonder of the Seas', destination: 'Caribbean',       nights: 7,  adultFare: 1200, capacityLeft: 12 },
    { cruiseLine: 'Celebrity Cruises',       ship: 'Celebrity Beyond',   destination: 'Mediterranean',   nights: 10, adultFare: 1850, capacityLeft: 4  },
    { cruiseLine: 'Norwegian Cruise Line',   ship: 'Norwegian Prima',    destination: 'Alaska',          nights: 5,  adultFare: 950,  capacityLeft: 20 },
    { cruiseLine: 'Princess Cruises',        ship: 'Sky Princess',       destination: 'Northern Europe', nights: 12, adultFare: 2100, capacityLeft: 2  },
    { cruiseLine: 'MSC Cruises',             ship: 'MSC Seascape',       destination: 'Bahamas',         nights: 4,  adultFare: 700,  capacityLeft: 0  },
  ]);
  console.log('✓ Cruises seeded');

  // ── Promo Codes ───────────────────────────────────────────────────────────
  await PromoCode.insertMany([
    {
      code: 'SUMMER10', type: 'percentage', value: 10,
      validFrom: new Date('2026-06-01'), validTo: new Date('2026-08-31'),
      maxTotalUses: 100, maxUsesPerCustomer: 1, minimumSpend: 1000, currentTotalUses: 0,
    },
    {
      code: 'FIRST150', type: 'fixed', value: 150,
      validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'),
      maxTotalUses: 500, maxUsesPerCustomer: 1, minimumSpend: 2000, currentTotalUses: 0,
    },
    {
      code: 'CREW25', type: 'percentage', value: 25,
      validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'),
      maxTotalUses: 3, maxUsesPerCustomer: 3, minimumSpend: 0, currentTotalUses: 0,
    },
    {
      // Intentionally expired — always rejected. Required test case.
      code: 'WINTER5', type: 'percentage', value: 5,
      validFrom: new Date('2025-01-01'), validTo: new Date('2025-03-31'),
      maxTotalUses: 1000, maxUsesPerCustomer: 5, minimumSpend: 0, currentTotalUses: 0,
    },
  ]);
  console.log('✓ Promo codes seeded');

  // ── Settings (tax rate) ───────────────────────────────────────────────────
  await Settings.create({ key: 'taxRate', value: 0.12 });
  console.log('✓ Settings seeded (taxRate = 12%)');

  // ── Pricing Rules ─────────────────────────────────────────────────────────
  await PricingRules.insertMany([
    {
      type: 'childFareBands',
      data: {
        bands: [
          { minAge: 0,  maxAge: 4,  multiplier: 0    },  // free
          { minAge: 5,  maxAge: 11, multiplier: 0.5  },  // 50%
          { minAge: 12, maxAge: 17, multiplier: 0.75 },  // 75%
          // 18+ is treated as an adult — not a child — validated at input
        ],
      },
    },
    {
      type: 'groupDiscountTiers',
      data: {
        // Source table ambiguity resolved: 1–2 → 0%, 3–4 → 0%, 5–6 → 5%.
        // The "10%" in the source was dropped as a typo/unused entry.
        // See BusinessRequirements.md for verbatim note.
        tiers: [
          { minPassengers: 1, maxPassengers: 2, discountRate: 0    },
          { minPassengers: 3, maxPassengers: 4, discountRate: 0    },
          { minPassengers: 5, maxPassengers: 6, discountRate: 0.05 },
        ],
      },
    },
    {
      type: 'optionalServices',
      data: {
        // Optional services are full price per passenger regardless of age.
        // See BusinessRequirements.md assumption A8.
        services: [
          { key: 'insurance',  label: 'Travel Insurance',  pricePerPassenger: 80,  perNight: false },
          { key: 'wifi',       label: 'Wi-Fi',             pricePerPassenger: 15,  perNight: true  },
          { key: 'excursion',  label: 'Shore Excursion',   pricePerPassenger: 120, perNight: false },
        ],
      },
    },
  ]);
  console.log('✓ Pricing rules seeded');

  await mongoose.disconnect();
  console.log('Seed complete.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
