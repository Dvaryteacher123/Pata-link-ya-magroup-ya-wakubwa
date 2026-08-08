// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

const jwt = require('jsonwebtoken');
const { admin, db, collections } = require('../config/firebase');

// ==========================================
// VERIFY JWT TOKEN
// ==========================================

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login first.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userRecord = await admin.auth().getUser(decoded.uid);
    const userDoc = await db.collection(collections.USERS).doc(decoded.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }

    const userData = userDoc.data();
    if (userData.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    req.user = {
      uid: decoded.uid,
      email: userRecord.email,
      ...userData
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.'
    });
  }
};

// ==========================================
// GENERATE JWT TOKEN
// ==========================================

const generateToken = (uid, email) => {
  return jwt.sign(
    { uid, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// ==========================================
// OPTIONAL AUTH
// ==========================================

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userDoc = await db.collection(collections.USERS).doc(decoded.uid).get();
      
      if (userDoc.exists) {
        req.user = {
          uid: decoded.uid,
          ...userDoc.data()
        };
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  verifyToken,
  generateToken,
  optionalAuth
};
