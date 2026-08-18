/**
 * Structured request logging middleware.
 * Formats access logs as structured JSON containing timestamp, method, URL, status, and latency.
 */
function structuredLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method:    req.method,
      path:      req.originalUrl || req.url,
      status:    res.statusCode,
      durationMs: duration,
      ip:        req.ip || req.socket.remoteAddress,
      userRole:  req.user ? req.user.role : 'anonymous'
    };

    // In test environment, keep stdout clean unless specifically debugging
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}

module.exports = { structuredLogger };
