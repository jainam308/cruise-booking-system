/**
 * In-memory sliding window rate limiter middleware.
 * Prevents endpoint brute-force and DDoS on sensitive routes.
 *
 * @param {object} options
 * @param {number} options.windowMs - time window in ms (e.g. 60,000 for 1 min)
 * @param {number} options.max - max allowed requests within windowMs
 * @param {string} options.message - custom error message on 429
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 100;
  const message = options.message || 'Too many requests, please try again later.';

  const ipHitMap = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!ipHitMap.has(ip)) {
      ipHitMap.set(ip, []);
    }

    const timestamps = ipHitMap.get(ip);
    // Filter timestamps inside the active window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

    if (validTimestamps.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }

    validTimestamps.push(now);
    ipHitMap.set(ip, validTimestamps);
    next();
  };
}

module.exports = { createRateLimiter };
