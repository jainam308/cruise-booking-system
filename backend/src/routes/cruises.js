const express = require('express');
const Cruise = require('../models/Cruise');
const router = express.Router();

// GET /api/cruises — list all cruises with soldOut flag
router.get('/', async (_req, res) => {
  try {
    const cruises = await Cruise.find({}).lean();
    const result = cruises.map(c => ({
      ...c,
      soldOut: c.capacityLeft === 0,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cruises.' });
  }
});

// GET /api/cruises/:id — fetch single cruise by ID with soldOut flag
router.get('/:id', async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.id).lean();
    if (!cruise) return res.status(404).json({ error: 'Cruise not found.' });
    res.json({
      ...cruise,
      soldOut: cruise.capacityLeft === 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cruise.' });
  }
});

module.exports = router;
