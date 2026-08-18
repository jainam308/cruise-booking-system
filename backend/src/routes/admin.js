const express = require('express');
const router = express.Router();
const Cruise = require('../models/Cruise');
const PromoCode = require('../models/PromoCode');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes here require valid authentication
router.use(authenticateToken);

// ═════════════════════════════════════════════════════════════════════════════
// 1. OVERVIEW & METRICS (Admin & Agent)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/metrics', requireRole(['admin', 'agent']), async (_req, res) => {
  try {
    const [orders, cruises, promos] = await Promise.all([
      Order.find({}).lean(),
      Cruise.find({}).lean(),
      PromoCode.find({}).lean()
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const totalBookings = orders.length;
    const totalPassengers = orders.reduce((sum, o) => sum + (o.passengers ? o.passengers.length : 0), 0);
    const totalFleetCapacityLeft = cruises.reduce((sum, c) => sum + (c.capacityLeft || 0), 0);
    const soldOutCruisesCount = cruises.filter(c => c.capacityLeft === 0).length;

    res.json({
      totalRevenue: Math.round((totalRevenue + Number.EPSILON) * 100) / 100,
      totalBookings,
      totalPassengers,
      totalFleetCapacityLeft,
      soldOutCruisesCount,
      activePromosCount: promos.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate metrics.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. BOOKINGS AUDIT TRAIL (Admin & Agent)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/bookings', requireRole(['admin', 'agent']), async (req, res) => {
  try {
    let query = {};
    // If agent, they can optionally filter or view all bookings
    const bookings = await Order.find(query).sort({ createdAt: -1 }).lean();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings audit trail.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. CRUISES CRUD (Admin only)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/cruises', requireRole('admin'), async (_req, res) => {
  try {
    const cruises = await Cruise.find({}).sort({ createdAt: -1 }).lean();
    res.json(cruises);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cruises.' });
  }
});

router.post('/cruises', requireRole('admin'), async (req, res) => {
  try {
    const { cruiseLine, ship, destination, nights, adultFare, capacityLeft } = req.body;
    if (!cruiseLine || !ship || !destination || !nights || !adultFare || capacityLeft === undefined) {
      return res.status(400).json({ error: 'All cruise fields (cruiseLine, ship, destination, nights, adultFare, capacityLeft) are required.' });
    }

    const cruise = await Cruise.create({
      cruiseLine: cruiseLine.trim(),
      ship: ship.trim(),
      destination: destination.trim(),
      nights: Number(nights),
      adultFare: Number(adultFare),
      capacityLeft: Number(capacityLeft)
    });

    res.status(201).json({ message: 'Cruise created successfully.', cruise });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create cruise.' });
  }
});

router.put('/cruises/:id', requireRole('admin'), async (req, res) => {
  try {
    const { cruiseLine, ship, destination, nights, adultFare, capacityLeft } = req.body;
    const cruise = await Cruise.findByIdAndUpdate(
      req.params.id,
      {
        ...(cruiseLine && { cruiseLine: cruiseLine.trim() }),
        ...(ship && { ship: ship.trim() }),
        ...(destination && { destination: destination.trim() }),
        ...(nights !== undefined && { nights: Number(nights) }),
        ...(adultFare !== undefined && { adultFare: Number(adultFare) }),
        ...(capacityLeft !== undefined && { capacityLeft: Number(capacityLeft) })
      },
      { new: true }
    );

    if (!cruise) return res.status(404).json({ error: 'Cruise not found.' });
    res.json({ message: 'Cruise updated successfully.', cruise });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update cruise.' });
  }
});

router.delete('/cruises/:id', requireRole('admin'), async (req, res) => {
  try {
    const cruise = await Cruise.findByIdAndDelete(req.params.id);
    if (!cruise) return res.status(404).json({ error: 'Cruise not found.' });
    res.json({ message: 'Cruise deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete cruise.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. PROMO CODES CRUD (Admin only)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/promos', requireRole('admin'), async (_req, res) => {
  try {
    const promos = await PromoCode.find({}).sort({ createdAt: -1 }).lean();
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch promo codes.' });
  }
});

router.post('/promos', requireRole('admin'), async (req, res) => {
  try {
    const { code, type, value, validFrom, validTo, maxTotalUses, maxUsesPerCustomer, minimumSpend = 0 } = req.body;

    if (!code || !type || !value || !validFrom || !validTo || maxTotalUses === undefined || maxUsesPerCustomer === undefined) {
      return res.status(400).json({ error: 'Code, type, value, validFrom, validTo, maxTotalUses, and maxUsesPerCustomer are required.' });
    }

    const existing = await PromoCode.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'A promo code with this code already exists.' });
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase().trim(),
      type,
      value: Number(value),
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      maxTotalUses: Number(maxTotalUses),
      maxUsesPerCustomer: Number(maxUsesPerCustomer),
      minimumSpend: Number(minimumSpend),
      currentTotalUses: 0
    });

    res.status(201).json({ message: 'Promo code created successfully.', promo });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create promo code.' });
  }
});

router.put('/promos/:id', requireRole('admin'), async (req, res) => {
  try {
    const { type, value, validFrom, validTo, maxTotalUses, maxUsesPerCustomer, minimumSpend } = req.body;
    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      {
        ...(type && { type }),
        ...(value !== undefined && { value: Number(value) }),
        ...(validFrom && { validFrom: new Date(validFrom) }),
        ...(validTo && { validTo: new Date(validTo) }),
        ...(maxTotalUses !== undefined && { maxTotalUses: Number(maxTotalUses) }),
        ...(maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: Number(maxUsesPerCustomer) }),
        ...(minimumSpend !== undefined && { minimumSpend: Number(minimumSpend) })
      },
      { new: true }
    );

    if (!promo) return res.status(404).json({ error: 'Promo code not found.' });
    res.json({ message: 'Promo code updated successfully.', promo });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update promo code.' });
  }
});

router.delete('/promos/:id', requireRole('admin'), async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promo code not found.' });
    res.json({ message: 'Promo code deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete promo code.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. DYNAMIC TAX SETTINGS (Admin only)
// ═════════════════════════════════════════════════════════════════════════════
router.put('/settings/tax', requireRole('admin'), async (req, res) => {
  try {
    const { taxRate } = req.body;
    if (taxRate === undefined || isNaN(Number(taxRate)) || Number(taxRate) < 0) {
      return res.status(400).json({ error: 'Valid positive taxRate (e.g. 0.12 for 12%) is required.' });
    }

    const setting = await Settings.findOneAndUpdate(
      { key: 'taxRate' },
      { value: Number(taxRate) },
      { new: true, upsert: true }
    );

    res.json({ message: 'Tax rate updated successfully.', setting });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tax setting.' });
  }
});

module.exports = router;
