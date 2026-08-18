const { validatePromoCode } = require('../src/services/pricingEngine');

const NOW_VALID   = new Date('2026-07-15'); // within all 2026 codes
const NOW_EXPIRED = new Date('2026-08-18'); // still within SUMMER10 (Aug 31), but past WINTER5

// ── Promo fixtures ────────────────────────────────────────────────────────────
const SUMMER10 = {
  code: 'SUMMER10', type: 'percentage', value: 10,
  validFrom: new Date('2026-06-01'), validTo: new Date('2026-08-31'),
  maxTotalUses: 100, maxUsesPerCustomer: 1, minimumSpend: 1000, currentTotalUses: 0,
};
const FIRST150 = {
  code: 'FIRST150', type: 'fixed', value: 150,
  validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'),
  maxTotalUses: 500, maxUsesPerCustomer: 1, minimumSpend: 2000, currentTotalUses: 0,
};
const CREW25 = {
  code: 'CREW25', type: 'percentage', value: 25,
  validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'),
  maxTotalUses: 3, maxUsesPerCustomer: 3, minimumSpend: 0, currentTotalUses: 0,
};
const WINTER5 = {
  code: 'WINTER5', type: 'percentage', value: 5,
  validFrom: new Date('2025-01-01'), validTo: new Date('2025-03-31'),
  maxTotalUses: 1000, maxUsesPerCustomer: 5, minimumSpend: 0, currentTotalUses: 0,
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('validatePromoCode', () => {
  // PC-06: code not found
  test('returns "not found" when promo is null', () => {
    const r = validatePromoCode(null, 2000, NOW_VALID, 0);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/not found/i);
  });

  // PC-02: WINTER5 expired
  test('rejects expired code (WINTER5)', () => {
    const r = validatePromoCode(WINTER5, 500, NOW_EXPIRED, 0);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/expired/i);
  });

  // PC-08: SUMMER10 currently valid (today 2026-08-18 is within Jun–Aug 2026)
  test('accepts SUMMER10 on 2026-08-18 (within valid range)', () => {
    const r = validatePromoCode(SUMMER10, 2000, NOW_EXPIRED, 0); // NOW_EXPIRED = 2026-08-18
    expect(r.valid).toBe(true);
  });

  // PC-04: exhausted code
  test('rejects code that has hit max total uses', () => {
    const exhausted = { ...CREW25, currentTotalUses: 3, maxTotalUses: 3 };
    const r = validatePromoCode(exhausted, 500, NOW_VALID, 0);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/maximum uses/i);
  });

  // PC-05: per-customer limit
  test('rejects code when customer has hit per-customer limit', () => {
    const r = validatePromoCode(CREW25, 500, NOW_VALID, 3); // customerUseCount = maxUsesPerCustomer
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/maximum uses for this code/i);
  });

  // PC-03: below minimum spend for SUMMER10
  test('rejects SUMMER10 when below $1000 minimum spend', () => {
    const r = validatePromoCode(SUMMER10, 500, NOW_VALID, 0);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/minimum spend/i);
  });

  // PC-07: below minimum spend for FIRST150
  test('rejects FIRST150 when spend is $1500 (below $2000 minimum)', () => {
    const r = validatePromoCode(FIRST150, 1500, NOW_VALID, 0);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/minimum spend of \$2000/i);
  });

  // PC-01: SUMMER10 happy path
  test('accepts SUMMER10 and computes 10% discount correctly', () => {
    const r = validatePromoCode(SUMMER10, 3555, NOW_VALID, 0);
    expect(r.valid).toBe(true);
    expect(r.discountAmount).toBe(355.50);
  });

  // Fixed discount happy path
  test('FIRST150 applies fixed $150 discount', () => {
    const r = validatePromoCode(FIRST150, 3000, NOW_VALID, 0);
    expect(r.valid).toBe(true);
    expect(r.discountAmount).toBe(150);
  });

  // Fixed discount cannot exceed subtotal
  test('fixed discount is capped at subtotal', () => {
    const smallSubtotal = { ...FIRST150, minimumSpend: 0 };
    const r = validatePromoCode(smallSubtotal, 100, NOW_VALID, 0);
    expect(r.valid).toBe(true);
    expect(r.discountAmount).toBe(100); // capped, not 150
  });
});
