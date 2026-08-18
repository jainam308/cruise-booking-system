/**
 * automationReport.test.js
 *
 * Tests the deterministic business metrics aggregation and alert rules
 * corresponding to Nodes 05 & 06 of the n8n Daily Business Health automation.
 */

describe('n8n Business Health Automation — Deterministic Logic', () => {

  const sampleOrders = [
    {
      grandTotal: 3583.44,
      preTaxSubtotal: 3555.00,
      passengers: [{ type: 'adult' }, { type: 'adult' }, { type: 'child', age: 10 }],
      cruiseNameSnapshot: 'Royal Caribbean — Wonder of the Seas'
    },
    {
      grandTotal: 2688.00,
      preTaxSubtotal: 2400.00,
      passengers: [{ type: 'adult' }, { type: 'adult' }],
      cruiseNameSnapshot: 'Royal Caribbean — Wonder of the Seas'
    },
    {
      grandTotal: 1064.00,
      preTaxSubtotal: 950.00,
      passengers: [{ type: 'adult' }],
      cruiseNameSnapshot: 'Norwegian Cruise Line — Norwegian Prima'
    }
  ];

  const sampleCruises = [
    { cruiseLine: 'Royal Caribbean', ship: 'Wonder of the Seas', capacityLeft: 12 },
    { cruiseLine: 'Celebrity Cruises', ship: 'Celebrity Beyond', capacityLeft: 4 },
    { cruiseLine: 'Princess Cruises', ship: 'Sky Princess', capacityLeft: 2 },
    { cruiseLine: 'MSC Cruises', ship: 'MSC Seascape', capacityLeft: 0 }
  ];

  const samplePromos = [
    { code: 'SUMMER10', currentTotalUses: 91, maxTotalUses: 100, validTo: new Date('2026-08-31') },
    { code: 'FIRST150', currentTotalUses: 120, maxTotalUses: 500, validTo: new Date('2026-12-31') },
    { code: 'WINTER5',  currentTotalUses: 50,  maxTotalUses: 1000, validTo: new Date('2025-03-31') }
  ];

  function aggregateMetrics(orders, cruises, promos) {
    const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalBookings = orders.length;
    const totalPassengers = orders.reduce((sum, o) => sum + o.passengers.length, 0);
    const aov = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const countMap = {};
    for (const o of orders) {
      countMap[o.cruiseNameSnapshot] = (countMap[o.cruiseNameSnapshot] || 0) + 1;
    }
    let topCruise = 'None';
    let max = 0;
    for (const [k, v] of Object.entries(countMap)) {
      if (v > max) { topCruise = k; max = v; }
    }

    return {
      totalRevenue: Math.round((totalRevenue + Number.EPSILON) * 100) / 100,
      totalBookings,
      totalPassengers,
      averageOrderValue: Math.round((aov + Number.EPSILON) * 100) / 100,
      topCruise
    };
  }

  function evaluateAlerts(cruises, promos, now = new Date('2026-08-18')) {
    const capacityAlerts = cruises
      .filter(c => c.capacityLeft <= 2)
      .map(c => ({
        cruise: `${c.cruiseLine} — ${c.ship}`,
        capacityLeft: c.capacityLeft,
        status: c.capacityLeft === 0 ? 'SOLD_OUT' : 'CRITICAL_LOW'
      }));

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const promoAlerts = promos
      .filter(p => {
        const usage = (p.currentTotalUses / p.maxTotalUses) * 100;
        const diff = new Date(p.validTo) - now;
        return usage >= 80 || (diff > 0 && diff <= SEVEN_DAYS_MS);
      })
      .map(p => ({
        code: p.code,
        usagePercentage: Math.round((p.currentTotalUses / p.maxTotalUses) * 100),
        status: (p.currentTotalUses / p.maxTotalUses) >= 0.8 ? 'NEAR_LIMIT' : 'EXPIRING_SOON'
      }));

    return { capacityAlerts, promoAlerts };
  }

  test('aggregates revenue, bookings, passenger count and top cruise correctly', () => {
    const result = aggregateMetrics(sampleOrders, sampleCruises, samplePromos);
    expect(result.totalRevenue).toBe(7335.44); // 3583.44 + 2688 + 1064
    expect(result.totalBookings).toBe(3);
    expect(result.totalPassengers).toBe(6); // 3 + 2 + 1
    expect(result.topCruise).toBe('Royal Caribbean — Wonder of the Seas');
  });

  test('flags capacity alert for capacity <= 2 (Sky Princess and MSC Seascape)', () => {
    const { capacityAlerts } = evaluateAlerts(sampleCruises, samplePromos);
    expect(capacityAlerts).toHaveLength(2);
    expect(capacityAlerts.find(c => c.cruise.includes('Sky Princess')).status).toBe('CRITICAL_LOW');
    expect(capacityAlerts.find(c => c.cruise.includes('MSC Seascape')).status).toBe('SOLD_OUT');
  });

  test('flags promo alert for SUMMER10 (91% burn rate)', () => {
    const { promoAlerts } = evaluateAlerts(sampleCruises, samplePromos);
    const summer = promoAlerts.find(p => p.code === 'SUMMER10');
    expect(summer).toBeDefined();
    expect(summer.usagePercentage).toBe(91);
    expect(summer.status).toBe('NEAR_LIMIT');
  });

});
