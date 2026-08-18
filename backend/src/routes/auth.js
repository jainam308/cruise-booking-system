const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, authenticateToken } = require('../middleware/auth');

// POST /api/auth/register — register a new account (default: customer)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'customer', agencyName = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Restrict self-registration of 'admin' to prevent unauthorized escalation
    const assignedRole = role === 'admin' ? 'customer' : role;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole,
      agencyName: assignedRole === 'agent' ? agencyName.trim() : ''
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agencyName: user.agencyName
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// POST /api/auth/login — authenticate user with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agencyName: user.agencyName
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// GET /api/auth/me — get current authenticated user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// GET /api/auth/roles — describe permissions matrix across the 3 roles
router.get('/roles', (_req, res) => {
  res.json({
    roles: [
      {
        role: 'admin',
        title: 'System Administrator',
        permissions: [
          'Full CRUD over cruises, routes, and capacities',
          'Create, edit, and revoke promotional codes',
          'Dynamically modify pricing rules (tax rates, child multipliers)',
          'Access complete booking audit trail and revenue intelligence'
        ]
      },
      {
        role: 'agent',
        title: 'Travel Agency Partner',
        permissions: [
          'Book on behalf of multiple client accounts',
          'Access agency booking history',
          'Apply exclusive agency promotional codes',
          'Manage client manifests'
        ]
      },
      {
        role: 'customer',
        title: 'Direct Retail Customer',
        permissions: [
          'Browse available cruises and live availability',
          'Obtain instant transparent price quotes',
          'Book personal holiday packages',
          'Retrieve personal booking confirmations'
        ]
      }
    ]
  });
});

module.exports = router;
