/**
 * bookingFlow.test.js — Integration tests for all API endpoints.
 *
 * Uses mongodb-memory-server for full isolation — no real Atlas data is touched.
 * Seeds minimal test data before each suite, tears down after.
 *
 * Coverage:
 *   GET  /api/cruises
 *   POST /api/bookings/quote
 *   POST /api/bookings/confirm
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// Models
const Cruise = require('../src/models/Cruise');
const PromoCode = require('../src/models/PromoCode');
const Settings = require('../src/models/Settings');
const PricingRules = require('../src/models/PricingRules');
const Order = require('../src/models/Order');

let mongod;
let app;

// ── Test data fixtures ────────────────────────────────────────────────────────
const CRUISES = [
  { cruiseLine: 'Royal Caribbean',       ship: 'Wonder of the Seas', destination: 'Caribbean',       nights: 7,  adultFare: 1200, capacityLeft: 12 },
  { cruiseLine: 'Celebrity Cruises',     ship: 'Celebrity Beyond',   destination: 'Mediterranean',   nights: 10, adultFare: 1850, capacityLeft: 4  },
  { cruiseLine: 'Norwegian Cruise Line', ship: 'Norwegian Prima',    destination: 'Alaska',          nights: 5,  adultFare: 950,  capacityLeft: 20 },
  { cruiseLine: 'Princess Cruises',      ship: 'Sky Princess',       destination: 'Northern Europe', nights: 12, adultFare: 2100, capacityLeft: 2  },
  { cruiseLine: 'MSC Cruises',           ship: 'MSC Seascape',       destination: 'Bahamas',         nights: 4,  adultFare: 700,  capacityLeft: 0  },
];

const PROMO_CODES = [
  { code: 'SUMMER10', type: 'percentage', value: 10,  validFrom: new Date('2026-06-01'), validTo: new Date('2026-08-31'), maxTotalUses: 100, maxUsesPerCustomer: 1, minimumSpend: 1000, currentTotalUses: 0 },
  { code: 'FIRST150', type: 'fixed',      value: 150, validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'), maxTotalUses: 500, maxUsesPerCustomer: 1, minimumSpend: 2000, currentTotalUses: 0 },
  { code: 'CREW25',   type: 'percentage', value: 25,  validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'), maxTotalUses: 3,   maxUsesPerCustomer: 3, minimumSpend: 0,    currentTotalUses: 0 },
  { code: 'WINTER5',  type: 'percentage', value: 5,   validFrom: new Date('2025-01-01'), validTo: new Date('2025-03-31'), maxTotalUses: 1000, maxUsesPerCustomer: 5, minimumSpend: 0,   currentTotalUses: 0 },
];

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;

  // Connect mongoose manually — index.js no longer auto-connects when imported
  await mongoose.connect(uri);

  // Import app AFTER connecting so routes can use the live connection
  app = require('../src/index');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Seed fresh data before every test
  await Promise.all([
    Cruise.deleteMany({}),
    PromoCode.deleteMany({}),
    Settings.deleteMany({}),
    PricingRules.deleteMany({}),
    Order.deleteMany({}),
  ]);

  await Cruise.insertMany(CRUISES);
  await PromoCode.insertMany(PROMO_CODES);
  await Settings.create({ key: 'taxRate', value: 0.12 });
  await PricingRules.insertMany([
    { type: 'childFareBands',     data: { bands:    [{ minAge: 0,  maxAge: 4,  multiplier: 0 }, { minAge: 5, maxAge: 11, multiplier: 0.5 }, { minAge: 12, maxAge: 17, multiplier: 0.75 }] } },
    { type: 'groupDiscountTiers', data: { tiers:    [{ minPassengers: 1, maxPassengers: 2, discountRate: 0 }, { minPassengers: 3, maxPassengers: 4, discountRate: 0 }, { minPassengers: 5, maxPassengers: 6, discountRate: 0.05 }] } },
    { type: 'optionalServices',   data: { services: [{ key: 'insurance', label: 'Travel Insurance', pricePerPassenger: 80, perNight: false }, { key: 'wifi', label: 'Wi-Fi', pricePerPassenger: 15, perNight: true }, { key: 'excursion', label: 'Shore Excursion', pricePerPassenger: 120, perNight: false }] } },
  ]);
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/cruises
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/cruises', () => {

  test('returns all 5 cruises with 200', async () => {
    const res = await request(app).get('/api/cruises');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  test('MSC Seascape has soldOut: true (capacity 0)', async () => {
    const res = await request(app).get('/api/cruises');
    const msc = res.body.find(c => c.ship === 'MSC Seascape');
    expect(msc).toBeDefined();
    expect(msc.soldOut).toBe(true);
    expect(msc.capacityLeft).toBe(0);
  });

  test('Royal Caribbean has soldOut: false (capacity 12)', async () => {
    const res = await request(app).get('/api/cruises');
    const rc = res.body.find(c => c.ship === 'Wonder of the Seas');
    expect(rc.soldOut).toBe(false);
    expect(rc.capacityLeft).toBe(12);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/bookings/quote
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/bookings/quote', () => {

  let royalId;
  let celebrityId;
  let norwegianId;
  let mscId;

  beforeEach(async () => {
    const cruises = await Cruise.find({}).lean();
    royalId     = cruises.find(c => c.ship === 'Wonder of the Seas')._id.toString();
    celebrityId = cruises.find(c => c.ship === 'Celebrity Beyond')._id.toString();
    norwegianId = cruises.find(c => c.ship === 'Norwegian Prima')._id.toString();
    mscId       = cruises.find(c => c.ship === 'MSC Seascape')._id.toString();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  test('happy path — 2 adults returns correct grand total', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.breakdown.cruiseFareSubtotal).toBe(2400);
    expect(res.body.breakdown.grandTotal).toBe(2688); // 2400 * 1.12
  });

  test('full walkthrough — 2 adults + child age 10 + insurance + wifi → $3983.44', async () => {
    // TC-09 from UnitTestCases.md (no promo)
    // cruiseFareSubtotal: 1200+1200+600 = 3000
    // optionalServices: 3×80 + 3×15×7 = 240+315 = 555
    // preTaxSubtotal: 3555
    // tax: 3555 × 0.12 = 426.60
    // grandTotal: 3555 + 426.60 = 3981.60
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'adult' }, { type: 'child', age: 10 }],
      selectedExtras: ['insurance', 'wifi'],
    });
    expect(res.status).toBe(200);
    const bd = res.body.breakdown;
    expect(bd.cruiseFareSubtotal).toBe(3000);
    expect(bd.optionalServicesTotal).toBe(555);
    expect(bd.preTaxSubtotal).toBe(3555);
    expect(bd.taxAmount).toBe(426.60);
    expect(bd.grandTotal).toBe(3981.60);
  });

  // ── Child fare boundaries ───────────────────────────────────────────────────
  test('child age 1 is free (lower boundary)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'child', age: 1 }],
      selectedExtras: [],
    });
    expect(res.status).toBe(200);
    const child = res.body.breakdown.passengers.find(p => p.type === 'child');
    expect(child.computedFare).toBe(0);
  });

  test('child age 0 is rejected (invalid age)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'child', age: 0 }],
      selectedExtras: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/between 1 and 17/i);
  });

  test('child age 4 is free (upper boundary)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'child', age: 4 }],
      selectedExtras: [],
    });
    expect(res.status).toBe(200);
    const child = res.body.breakdown.passengers.find(p => p.type === 'child');
    expect(child.computedFare).toBe(0);
  });

  test('child age 5 pays 50% (lower boundary)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'child', age: 5 }],
      selectedExtras: [],
    });
    const child = res.body.breakdown.passengers.find(p => p.type === 'child');
    expect(child.computedFare).toBe(600);
  });

  test('child age 17 pays 75% (upper boundary)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'child', age: 17 }],
      selectedExtras: [],
    });
    const child = res.body.breakdown.passengers.find(p => p.type === 'child');
    expect(child.computedFare).toBe(900);
  });

  // ── Booking validation ──────────────────────────────────────────────────────
  test('rejects 0 adults', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'child', age: 5 }],
      selectedExtras: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 1 adult/i);
  });

  test('rejects more than 6 passengers', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [
        { type: 'adult' }, { type: 'adult' }, { type: 'adult' },
        { type: 'child', age: 5 }, { type: 'child', age: 6 }, { type: 'child', age: 7 },
        { type: 'child', age: 8 },
      ],
      selectedExtras: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 6 passengers/i);
  });

  test('rejects child age 18', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'child', age: 18 }],
      selectedExtras: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/between 1 and 17/i);
  });

  // ── Capacity ────────────────────────────────────────────────────────────────
  test('rejects booking on sold-out cruise (MSC capacity 0)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: mscId,
      passengers: [{ type: 'adult' }],
      selectedExtras: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sold out/i);
  });

  test('rejects when passengers exceed available capacity', async () => {
    // Celebrity Beyond has capacity 4, we request 5
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: celebrityId,
      passengers: [
        { type: 'adult' }, { type: 'adult' }, { type: 'adult' },
        { type: 'child', age: 5 }, { type: 'child', age: 6 },
      ],
      selectedExtras: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough capacity/i);
  });

  test('accepts booking exactly at capacity limit', async () => {
    // Celebrity Beyond capacity 4, exactly 4 passengers
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: celebrityId,
      passengers: [
        { type: 'adult' }, { type: 'adult' },
        { type: 'child', age: 5 }, { type: 'child', age: 6 },
      ],
      selectedExtras: [],
    });
    expect(res.status).toBe(200);
  });

  // ── Group discount ──────────────────────────────────────────────────────────
  test('5 passengers get 5% group discount', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [
        { type: 'adult' }, { type: 'adult' }, { type: 'adult' },
        { type: 'child', age: 8 }, { type: 'child', age: 3 },
      ],
      selectedExtras: [],
    });
    const bd = res.body.breakdown;
    expect(bd.groupDiscountPercent).toBe(5);
    expect(bd.groupDiscountAmount).toBe(210); // 5% of 4200
    expect(bd.discountedCruiseFare).toBe(3990);
  });

  test('3 passengers get 0% group discount', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
    });
    expect(res.body.breakdown.groupDiscountPercent).toBe(0);
    expect(res.body.breakdown.groupDiscountAmount).toBe(0);
  });

  // ── Promo codes ─────────────────────────────────────────────────────────────
  test('WINTER5 rejected as expired', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }],
      selectedExtras: [],
      promoCode: 'WINTER5',
      customerEmail: 'test@test.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  test('invalid promo code rejected with "not found"', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }],
      selectedExtras: [],
      promoCode: 'BOGUS999',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('SUMMER10 rejected below $1000 minimum spend', async () => {
    // Norwegian Prima $950 — below min spend
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: norwegianId,
      passengers: [{ type: 'adult' }],
      selectedExtras: [],
      promoCode: 'SUMMER10',
      customerEmail: 'test@test.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum spend/i);
  });

  test('SUMMER10 applied correctly — 10% off preTaxSubtotal', async () => {
    // Royal Caribbean 2 adults = $2400 preTaxSubtotal
    // 10% promo = $240 off → taxable = $2160 → tax = $259.20 → total = $2419.20
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      promoCode: 'SUMMER10',
      customerEmail: 'test@test.com',
    });
    expect(res.status).toBe(200);
    const bd = res.body.breakdown;
    expect(bd.promoDiscount).toBe(240);
    expect(bd.taxableAmount).toBe(2160);
    expect(bd.taxAmount).toBe(259.20);
    expect(bd.grandTotal).toBe(2419.20);
  });

  test('promo code is case-insensitive (summer10 = SUMMER10)', async () => {
    const res = await request(app).post('/api/bookings/quote').send({
      cruiseId: royalId,
      passengers: [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      promoCode: 'summer10',
      customerEmail: 'test@test.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.breakdown.promoDiscount).toBe(240);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/bookings/confirm
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/bookings/confirm', () => {

  let royalId;
  let mscId;
  let princessId;

  beforeEach(async () => {
    const cruises = await Cruise.find({}).lean();
    royalId    = cruises.find(c => c.ship === 'Wonder of the Seas')._id.toString();
    mscId      = cruises.find(c => c.ship === 'MSC Seascape')._id.toString();
    princessId = cruises.find(c => c.ship === 'Sky Princess')._id.toString();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  test('happy path — confirms booking and returns CBS- reference', async () => {
    const res = await request(app).post('/api/bookings/confirm').send({
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      customerName:  'John Doe',
      customerEmail: 'john@test.com',
    });
    expect(res.status).toBe(201);
    expect(res.body.bookingReference).toMatch(/^CBS-[A-Z0-9]{6}$/);
    expect(res.body.grandTotal).toBe(2688); // 2400 × 1.12
    expect(res.body.message).toBe('Booking confirmed.');
  });

  test('booking decrements cruise capacity atomically', async () => {
    // Royal Caribbean starts at 12, book 2 passengers
    await request(app).post('/api/bookings/confirm').send({
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      customerName:  'Jane Doe',
      customerEmail: 'jane@test.com',
    });
    const updated = await Cruise.findById(royalId).lean();
    expect(updated.capacityLeft).toBe(10); // 12 - 2
  });

  test('booking saves full snapshot to Order collection', async () => {
    const res = await request(app).post('/api/bookings/confirm').send({
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }],
      selectedExtras: [],
      customerName:  'Alice Smith',
      customerEmail: 'alice@test.com',
    });
    const order = await Order.findOne({ bookingReference: res.body.bookingReference }).lean();
    expect(order).not.toBeNull();
    expect(order.adultFareSnapshot).toBe(1200);
    expect(order.taxRateApplied).toBe(0.12);
    expect(order.grandTotal).toBe(1344); // 1200 × 1.12
    expect(order.cruiseNameSnapshot).toBe('Royal Caribbean — Wonder of the Seas');
  });

  test('booking increments promo currentTotalUses', async () => {
    await request(app).post('/api/bookings/confirm').send({
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      promoCode:     'SUMMER10',
      customerName:  'Bob Jones',
      customerEmail: 'bob@test.com',
    });
    const promo = await PromoCode.findOne({ code: 'SUMMER10' }).lean();
    expect(promo.currentTotalUses).toBe(1);
  });

  test('second booking by same customer with SUMMER10 rejected (per-customer limit = 1)', async () => {
    const payload = {
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      promoCode:     'SUMMER10',
      customerName:  'Bob Jones',
      customerEmail: 'bob@test.com',
    };
    await request(app).post('/api/bookings/confirm').send(payload); // first use
    const res = await request(app).post('/api/bookings/quote').send({
      ...payload,
      customerEmail: 'bob@test.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum uses for this code/i);
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  test('rejects confirm without customer name', async () => {
    const res = await request(app).post('/api/bookings/confirm').send({
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }],
      selectedExtras: [],
      customerEmail: 'test@test.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name and email/i);
  });

  test('rejects confirm without customer email', async () => {
    const res = await request(app).post('/api/bookings/confirm').send({
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }],
      selectedExtras: [],
      customerName:  'Test User',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name and email/i);
  });

  test('rejects confirm on sold-out cruise', async () => {
    const res = await request(app).post('/api/bookings/confirm').send({
      cruiseId:      mscId,
      passengers:    [{ type: 'adult' }],
      selectedExtras: [],
      customerName:  'Test User',
      customerEmail: 'test@test.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sold out/i);
  });

  test('price at confirm = price at quote (cannot differ)', async () => {
    const payload = {
      cruiseId:      royalId,
      passengers:    [{ type: 'adult' }, { type: 'child', age: 10 }],
      selectedExtras: ['insurance'],
    };
    const quoteRes = await request(app).post('/api/bookings/quote').send(payload);
    const confirmRes = await request(app).post('/api/bookings/confirm').send({
      ...payload,
      customerName:  'Price Test',
      customerEmail: 'pricetest@test.com',
    });
    expect(confirmRes.body.grandTotal).toBe(quoteRes.body.breakdown.grandTotal);
  });

  test('capacity 2 — first booking of 2 succeeds, second booking of 1 fails', async () => {
    // Princess Cruises has capacity 2
    await request(app).post('/api/bookings/confirm').send({
      cruiseId:      princessId,
      passengers:    [{ type: 'adult' }, { type: 'adult' }],
      selectedExtras: [],
      customerName:  'First Booker',
      customerEmail: 'first@test.com',
    });
    // capacity now 0 — second booking must fail
    const res = await request(app).post('/api/bookings/confirm').send({
      cruiseId:      princessId,
      passengers:    [{ type: 'adult' }],
      selectedExtras: [],
      customerName:  'Second Booker',
      customerEmail: 'second@test.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sold out|capacity/i);
  });

});
