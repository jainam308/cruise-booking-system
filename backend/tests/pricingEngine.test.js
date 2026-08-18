const {
  getChildMultiplier,
  computePassengerFare,
  getGroupDiscountRate,
  computeOptionalServices,
  buildPriceBreakdown,
  round2,
} = require('../src/services/pricingEngine');

// ── Child fare band fixture ───────────────────────────────────────────────────
const childFareBands = [
  { minAge: 0,  maxAge: 4,  multiplier: 0    },
  { minAge: 5,  maxAge: 11, multiplier: 0.5  },
  { minAge: 12, maxAge: 17, multiplier: 0.75 },
];

const groupDiscountTiers = [
  { minPassengers: 1, maxPassengers: 2, discountRate: 0    },
  { minPassengers: 3, maxPassengers: 4, discountRate: 0    },
  { minPassengers: 5, maxPassengers: 6, discountRate: 0.05 },
];

const optionalServices = [
  { key: 'insurance',  label: 'Travel Insurance', pricePerPassenger: 80,  perNight: false },
  { key: 'wifi',       label: 'Wi-Fi',            pricePerPassenger: 15,  perNight: true  },
  { key: 'excursion',  label: 'Shore Excursion',  pricePerPassenger: 120, perNight: false },
];

const ADULT_FARE = 1200;

// ── CF: Child fare multiplier ─────────────────────────────────────────────────
describe('getChildMultiplier', () => {
  test('CF-01: age 1 → 0 (lower boundary of free band)', () => expect(getChildMultiplier(1, childFareBands)).toBe(0));
  test('CF-02: age 4 → 0 (upper boundary of free band)', () => expect(getChildMultiplier(4, childFareBands)).toBe(0));
  test('CF-03: age 5 → 0.5 (lower boundary of 50% band)', () => expect(getChildMultiplier(5, childFareBands)).toBe(0.5));
  test('CF-04: age 11 → 0.5 (upper boundary of 50% band)', () => expect(getChildMultiplier(11, childFareBands)).toBe(0.5));
  test('CF-05: age 12 → 0.75 (lower boundary of 75% band)', () => expect(getChildMultiplier(12, childFareBands)).toBe(0.75));
  test('CF-06: age 17 → 0.75 (upper boundary of 75% band)', () => expect(getChildMultiplier(17, childFareBands)).toBe(0.75));
  test('CF-07: age 18 throws (must be adult)', () => {
    expect(() => getChildMultiplier(18, childFareBands)).toThrow('Child age must be between 1 and 17');
  });
  test('CF-08: age 0 throws (must be between 1 and 17)', () => {
    expect(() => getChildMultiplier(0, childFareBands)).toThrow('Invalid child age');
  });
  test('CF-09: negative age throws', () => {
    expect(() => getChildMultiplier(-1, childFareBands)).toThrow('Invalid child age');
  });
  test('CF-10: non-integer age throws', () => {
    expect(() => getChildMultiplier(4.5, childFareBands)).toThrow('Invalid child age');
  });
});

// ── computePassengerFare ──────────────────────────────────────────────────────
describe('computePassengerFare', () => {
  test('adult pays full fare', () => {
    const r = computePassengerFare({ type: 'adult' }, ADULT_FARE, childFareBands);
    expect(r.fareMultiplier).toBe(1.0);
    expect(r.computedFare).toBe(1200);
  });
  test('child age 4 → free', () => {
    const r = computePassengerFare({ type: 'child', age: 4 }, ADULT_FARE, childFareBands);
    expect(r.computedFare).toBe(0);
  });
  test('child age 10 → $600 (50%)', () => {
    const r = computePassengerFare({ type: 'child', age: 10 }, ADULT_FARE, childFareBands);
    expect(r.computedFare).toBe(600);
  });
  test('child age 15 → $900 (75%)', () => {
    const r = computePassengerFare({ type: 'child', age: 15 }, ADULT_FARE, childFareBands);
    expect(r.computedFare).toBe(900);
  });
});

// ── GD: Group discount ────────────────────────────────────────────────────────
describe('getGroupDiscountRate', () => {
  test('GD-01: 1 passenger → 0%', () => expect(getGroupDiscountRate(1, groupDiscountTiers)).toBe(0));
  test('GD-02: 2 passengers → 0%', () => expect(getGroupDiscountRate(2, groupDiscountTiers)).toBe(0));
  test('GD-03: 3 passengers → 0%', () => expect(getGroupDiscountRate(3, groupDiscountTiers)).toBe(0));
  test('GD-04: 4 passengers → 0%', () => expect(getGroupDiscountRate(4, groupDiscountTiers)).toBe(0));
  test('GD-05: 5 passengers → 5%', () => expect(getGroupDiscountRate(5, groupDiscountTiers)).toBe(0.05));
  test('GD-06: 6 passengers → 5%', () => expect(getGroupDiscountRate(6, groupDiscountTiers)).toBe(0.05));
});

// ── Optional services ─────────────────────────────────────────────────────────
describe('computeOptionalServices', () => {
  test('OS-01: Wi-Fi 2 passengers 7 nights → $210', () => {
    const { optionalServicesTotal } = computeOptionalServices(['wifi'], 2, 7, optionalServices);
    expect(optionalServicesTotal).toBe(210);
  });
  test('OS-02: Shore excursion 3 passengers → $360', () => {
    const { optionalServicesTotal } = computeOptionalServices(['excursion'], 3, 7, optionalServices);
    expect(optionalServicesTotal).toBe(360);
  });
  test('OS-03: Insurance + excursion 1 passenger → $200', () => {
    const { optionalServicesTotal } = computeOptionalServices(['insurance', 'excursion'], 1, 7, optionalServices);
    expect(optionalServicesTotal).toBe(200);
  });
  test('unknown service key throws', () => {
    expect(() => computeOptionalServices(['spa'], 1, 7, optionalServices)).toThrow('Unknown optional service');
  });
});

// ── Full pricing walkthrough (UnitTestCases.md §6) ────────────────────────────
describe('buildPriceBreakdown — full walkthrough', () => {
  const cruise = { _id: 'test', adultFare: 1200, nights: 7, cruiseLine: 'Royal Caribbean', ship: 'Wonder of the Seas', destination: 'Caribbean' };
  const passengers = [
    { type: 'adult' },
    { type: 'adult' },
    { type: 'child', age: 10 },
  ];
  const promo = {
    code: 'SUMMER10', type: 'percentage', value: 10,
    validFrom: new Date('2026-06-01'), validTo: new Date('2026-08-31'),
    maxTotalUses: 100, maxUsesPerCustomer: 1, minimumSpend: 1000, currentTotalUses: 0,
  };
  const rules = { taxRate: 0.12, childFareBands, groupDiscountTiers, optionalServices };
  const now = new Date('2026-07-15');

  test('produces correct grand total $3583.44', () => {
    const bd = buildPriceBreakdown(cruise, passengers, ['insurance', 'wifi'], promo, 0, rules, now);
    expect(bd.cruiseFareSubtotal).toBe(3000);       // 1200+1200+600
    expect(bd.groupDiscountPercent).toBe(0);        // 3 pax → 0%
    expect(bd.discountedCruiseFare).toBe(3000);
    expect(bd.optionalServicesTotal).toBe(555);     // 3×80 + 3×15×7
    expect(bd.preTaxSubtotal).toBe(3555);
    expect(bd.promoDiscount).toBe(355.50);          // 10% of 3555
    expect(bd.taxableAmount).toBe(3199.50);
    expect(bd.taxAmount).toBe(383.94);
    expect(bd.grandTotal).toBe(3583.44);
  });

  test('5-passenger booking gets 5% group discount', () => {
    const fivePax = [
      { type: 'adult' }, { type: 'adult' }, { type: 'adult' },
      { type: 'child', age: 8 }, { type: 'child', age: 3 },
    ];
    const bd = buildPriceBreakdown(cruise, fivePax, [], null, 0, rules, now);
    // fareSubtotal: 3×1200 + 600 + 0 = 4200
    expect(bd.cruiseFareSubtotal).toBe(4200);
    expect(bd.groupDiscountPercent).toBe(5);
    expect(bd.groupDiscountAmount).toBe(210);
    expect(bd.discountedCruiseFare).toBe(3990);
  });
});

// ── Booking validation (tested via validateBookingInputs logic, exposed through route) ──
describe('round2', () => {
  test('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1.01); // floating-point edge case
    expect(round2(355.5)).toBe(355.5);
    expect(round2(383.94)).toBe(383.94);
  });
});
