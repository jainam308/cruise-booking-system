require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connect } = require('./db');

const cruisesRouter = require('./routes/cruises');
const bookingsRouter = require('./routes/bookings');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const { structuredLogger } = require('./middleware/logger');
const { createRateLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(cors());
app.use(express.json());
app.use(structuredLogger);

// Global API rate limiter (120 req / min)
const globalLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });
// Sensitive auth rate limiter (30 req / min)
const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'Too many authentication attempts. Please wait 1 minute.' });

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/cruises', cruisesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;

// Only bind the port when this file is run directly (not imported by tests).
// When required by tests, supertest creates its own ephemeral server.
if (require.main === module) {
  connect().then(() => {
    app.listen(PORT, () => console.log(`Server running on :${PORT}`));
  }).catch(err => {
    console.error('DB connection failed', err);
    process.exit(1);
  });
}

module.exports = app; // exported for supertest
