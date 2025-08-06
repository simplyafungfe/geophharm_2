const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getUserById } = require('./database');

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Get user from database
    const user = await getUserById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Specific role middlewares
const requireClient = authorizeRole(['client']);
const requirePharmacist = authorizeRole(['pharmacist']);
const requireAdmin = authorizeRole(['admin']);
const requirePharmacistOrAdmin = authorizeRole(['pharmacist', 'admin']);

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  verifyToken,
  authenticateToken,
  authorizeRole,
  requireClient,
  requirePharmacist,
  requireAdmin,
  requirePharmacistOrAdmin
}; 