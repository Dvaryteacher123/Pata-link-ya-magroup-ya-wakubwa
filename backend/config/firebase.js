// ==========================================
// FIREBASE ADMIN SDK CONFIGURATION
// ==========================================

const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {
  try {
    if (process.env.NODE_ENV === 'production') {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      console.log('✅ Firebase Admin SDK initialized in PRODUCTION mode');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      console.log('✅ Firebase Admin SDK initialized in DEVELOPMENT mode');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

db.settings({
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true
});

const collections = {
  USERS: 'users',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  CATEGORIES: 'categories',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  BANNER: 'banner',
  SLIDER: 'slider',
  STATISTICS: 'statistics',
  SOCIAL_LINKS: 'socialLinks',
  FOOTER: 'footer',
  CONTACT: 'contact'
};

module.exports = {
  admin,
  db,
  auth,
  collections
};
