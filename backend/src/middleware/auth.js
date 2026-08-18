const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'odysseus-secret-key-2026';

/**
 * Generate a signed JWT for a user.
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      agencyName: user.agencyName || ''
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Middleware to authenticate requests using Bearer JWT.
 * Attaches decoded user payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    req.user = decodedUser;
    next();
  });
}

/**
 * Middleware to restrict access to specific roles.
 * @param {string|string[]} roles - allowed roles (e.g. 'admin' or ['admin', 'agent'])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of: [${allowed.join(', ')}]. Your role is: ${req.user.role}.`
      });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireRole,
};
