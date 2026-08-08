// ==========================================
// DATABASE HELPER - FIRESTORE OPERATIONS
// ==========================================

const { db } = require('./firebase');

class Database {
  
  static async create(collection, data, id = null) {
    try {
      const docRef = id ? db.collection(collection).doc(id) : db.collection(collection).doc();
      const docData = {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await docRef.set(docData);
      return { id: docRef.id, ...docData };
    } catch (error) {
      console.error(`Error creating document in ${collection}:`, error);
      throw error;
    }
  }

  static async getById(collection, id) {
    try {
      if (!id) throw new Error('Document ID is required');
      const docRef = db.collection(collection).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`Error fetching document from ${collection}:`, error);
      throw error;
    }
  }

  static async getWhere(collection, filters = {}, orderBy = null, limit = null) {
    try {
      let query = db.collection(collection);
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.where(key, '==', value);
        }
      }
      if (orderBy) {
        const [field, direction] = orderBy.split(' ');
        query = query.orderBy(field, direction === 'desc' ? 'desc' : 'asc');
      }
      if (limit) query = query.limit(parseInt(limit));
      const snapshot = await query.get();
      const results = [];
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    } catch (error) {
      console.error(`Error fetching documents from ${collection}:`, error);
      throw error;
    }
  }

  static async getAll(collection, orderBy = null, limit = null) {
    try {
      let query = db.collection(collection);
      if (orderBy) {
        const [field, direction] = orderBy.split(' ');
        query = query.orderBy(field, direction === 'desc' ? 'desc' : 'asc');
      }
      if (limit) query = query.limit(parseInt(limit));
      const snapshot = await query.get();
      const results = [];
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    } catch (error) {
      console.error(`Error fetching all documents from ${collection}:`, error);
      throw error;
    }
  }

  static async update(collection, id, data) {
    try {
      if (!id) throw new Error('Document ID is required');
      const docRef = db.collection(collection).doc(id);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      await docRef.update(updateData);
      return { id: id, ...updateData };
    } catch (error) {
      console.error(`Error updating document in ${collection}:`, error);
      throw error;
    }
  }

  static async delete(collection, id) {
    try {
      if (!id) throw new Error('Document ID is required');
      const docRef = db.collection(collection).doc(id);
      await docRef.delete();
      return { id: id, deleted: true };
    } catch (error) {
      console.error(`Error deleting document from ${collection}:`, error);
      throw error;
    }
  }
}

module.exports = Database;
