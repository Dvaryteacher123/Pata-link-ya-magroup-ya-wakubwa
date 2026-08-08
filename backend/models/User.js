// ==========================================
// USER MODEL
// ==========================================

const { db, collections } = require('../config/firebase');
const { 
  isValidEmail, 
  isValidTZPhone, 
  sanitizeEmail,
  sanitizePhone,
  sanitizeString
} = require('../utils/validators');

class User {
  constructor(data) {
    this.uid = data.uid || null;
    this.email = data.email || null;
    this.fullName = data.fullName || null;
    this.displayName = data.displayName || data.fullName || null;
    this.phone = data.phone || null;
    this.role = data.role || 'user';
    this.isAdmin = data.isAdmin || false;
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLogin = data.lastLogin || null;
  }

  validate() {
    const errors = [];
    if (!this.email) errors.push('Email is required');
    else if (!isValidEmail(this.email)) errors.push('Invalid email format');
    if (this.phone && !isValidTZPhone(this.phone)) errors.push('Invalid Tanzanian phone number');
    if (!this.fullName) errors.push('Full name is required');
    else if (this.fullName.length < 2 || this.fullName.length > 50) errors.push('Full name must be between 2 and 50 characters');
    return { isValid: errors.length === 0, errors };
  }

  sanitize() {
    if (this.email) this.email = sanitizeEmail(this.email);
    if (this.phone) this.phone = sanitizePhone(this.phone);
    if (this.fullName) this.fullName = sanitizeString(this.fullName);
    if (this.displayName) this.displayName = sanitizeString(this.displayName);
    return this;
  }

  toFirestore() {
    return {
      email: this.email,
      fullName: this.fullName,
      displayName: this.displayName,
      phone: this.phone,
      role: this.role,
      isAdmin: this.isAdmin,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
      lastLogin: this.lastLogin
    };
  }

  static fromFirestore(id, data) {
    return new User({
      uid: id,
      email: data.email || null,
      fullName: data.fullName || null,
      displayName: data.displayName || data.fullName || null,
      phone: data.phone || null,
      role: data.role || 'user',
      isAdmin: data.isAdmin || false,
      status: data.status || 'active',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      lastLogin: data.lastLogin || null
    });
  }

  static async create(uid, userData) {
    try {
      const user = new User({ ...userData, uid });
      user.sanitize();
      const validation = user.validate();
      if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      const userRef = db.collection(collections.USERS).doc(uid);
      await userRef.set(user.toFirestore());
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async getById(uid) {
    try {
      if (!uid) throw new Error('User ID is required');
      const userRef = db.collection(collections.USERS).doc(uid);
      const doc = await userRef.get();
      if (!doc.exists) return null;
      return User.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  static async getByEmail(email) {
    try {
      if (!email) throw new Error('Email is required');
      const sanitizedEmail = sanitizeEmail(email);
      const snapshot = await db.collection(collections.USERS)
        .where('email', '==', sanitizedEmail)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return User.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  static async update(uid, updateData) {
    try {
      if (!uid) throw new Error('User ID is required');
      const existingUser = await User.getById(uid);
      if (!existingUser) throw new Error('User not found');
      const updatedData = { ...existingUser, ...updateData, uid };
      const user = new User(updatedData);
      user.sanitize();
      const validation = user.validate();
      if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      const userRef = db.collection(collections.USERS).doc(uid);
      await userRef.update(user.toFirestore());
      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  static async delete(uid) {
    try {
      if (!uid) throw new Error('User ID is required');
      const userRef = db.collection(collections.USERS).doc(uid);
      await userRef.delete();
      return { uid, deleted: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  static async getAll(filters = {}, limit = 50) {
    try {
      let query = db.collection(collections.USERS);
      if (filters.role) query = query.where('role', '==', filters.role);
      if (filters.status) query = query.where('status', '==', filters.status);
      if (filters.isAdmin !== undefined) query = query.where('isAdmin', '==', filters.isAdmin);
      query = query.orderBy('createdAt', 'desc').limit(limit);
      const snapshot = await query.get();
      const users = [];
      snapshot.forEach(doc => users.push(User.fromFirestore(doc.id, doc.data())));
      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  static async isAdminUser(uid) {
    try {
      const user = await User.getById(uid);
      if (!user) return false;
      return user.email === 'dullamanyama0@gmail.com' && user.isAdmin === true;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
}

module.exports = User;
