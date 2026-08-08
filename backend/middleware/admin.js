// ==========================================
// ADMIN MIDDLEWARE
// ==========================================

const { db, collections } = require('../config/firebase');

// ==========================================
// CHECK IF USER IS ADMIN
// ==========================================

const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login first.'
      });
    }

    const userDoc = await db.collection(collections.USERS).doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const userData = userDoc.data();
    
    // WEWE ndiye admin pekee - dullamanyama0@gmail.com
    if (userData.email !== 'dullamanyama0@gmail.com' || userData.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    if (userData.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your admin account has been suspended.'
      });
    }

    req.admin = {
      uid: req.user.uid,
      email: req.user.email,
      ...userData
    };

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify admin privileges.'
    });
  }
};

// ==========================================
// CREATE INITIAL ADMIN
// ==========================================

const createInitialAdmin = async () => {
  try {
    const adminEmail = 'dullamanyama0@gmail.com';
    
    const adminSnapshot = await db.collection(collections.USERS)
      .where('email', '==', adminEmail)
      .limit(1)
      .get();
    
    if (!adminSnapshot.empty) {
      console.log('✅ Admin already exists in Firestore');
      return;
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(adminEmail);
    } catch (authError) {
      console.log('⚠️ Admin user not found in Firebase Auth. Please sign up first.');
      console.log(`📧 Email: ${adminEmail}`);
      return;
    }

    await db.collection(collections.USERS).doc(userRecord.uid).set({
      email: adminEmail,
      fullName: 'Super Admin',
      displayName: 'Admin',
      role: 'admin',
      isAdmin: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Admin created successfully in Firestore');
    console.log(`📧 Email: ${adminEmail}`);

  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
  }
};

module.exports = {
  isAdmin,
  createInitialAdmin
};
