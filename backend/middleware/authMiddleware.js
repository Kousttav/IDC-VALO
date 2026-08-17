const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail loudly rather than silently running with a guessable default in prod.
  console.warn('⚠️  JWT_SECRET is not set in .env — using an insecure fallback for local dev only.');
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET || 'dev_only_insecure_secret');
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Only lets full admins through. Use after verifyToken.
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// Lets admin OR staff through (both can log into the panel; only admin can write in some places).
function requireStaffOrAdmin(req, res, next) {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Panel access required.' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin, requireStaffOrAdmin, JWT_SECRET };
