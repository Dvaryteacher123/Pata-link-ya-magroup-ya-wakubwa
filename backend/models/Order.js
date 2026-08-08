// ==========================================
// ORDER MODEL
// ==========================================

const { db, collections } = require('../config/firebase');
const { generateOrderId } = require('../utils/helpers');

class Order {
  constructor(data) {
    this.id = data.id || null;
    this.orderId = data.orderId || generateOrderId();
    this.userId = data.userId || null;
    this.productId = data.productId || null;
    this.productTitle = data.productTitle || null;
    this.amount = data.amount || 0;
    this.phone = data.phone || null;
    this.paymentStatus = data.paymentStatus || 'pending';
    this.paymentId = data.paymentId || null;
    this.transactionId = data.transactionId || null;
    this.whatsappLink = data.whatsappLink || null;
    this.isFree = data.isFree || false;
    this.isPremium = data.isPremium || false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.completedAt = data.completedAt || null;
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toFirestore() {
    return {
      orderId: this.orderId,
      userId: this.userId,
      productId: this.productId,
      productTitle: this.productTitle,
      amount: this.amount,
      phone: this.phone,
      paymentStatus: this.paymentStatus,
      paymentId: this.paymentId,
      transactionId: this.transactionId,
      whatsappLink: this.whatsappLink,
      isFree: this.isFree,
      isPremium: this.isPremium,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      updatedAt: new Date().toISOString()
    };
  }

  static fromFirestore(id, data) {
    return new Order({
      id: id,
      orderId: data.orderId || null,
      userId: data.userId || null,
      productId: data.productId || null,
      productTitle: data.productTitle || null,
      amount: data.amount || 0,
      phone: data.phone || null,
      paymentStatus: data.paymentStatus || 'pending',
      paymentId: data.paymentId || null,
      transactionId: data.transactionId || null,
      whatsappLink: data.whatsappLink || null,
      isFree: data.isFree || false,
      isPremium: data.isPremium || false,
      createdAt: data.createdAt || new Date().toISOString(),
      completedAt: data.completedAt || null,
      updatedAt: data.updatedAt || new Date().toISOString()
    });
  }

  static async create(orderData) {
    try {
      const order = new Order(orderData);
      const orderRef = db.collection(collections.ORDERS).doc();
      const id = orderRef.id;
      order.id = id;
      await orderRef.set(order.toFirestore());
      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      if (!id) throw new Error('Order ID is required');
      const orderRef = db.collection(collections.ORDERS).doc(id);
      const doc = await orderRef.get();
      if (!doc.exists) return null;
      return Order.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  }

  static async getByOrderId(orderId) {
    try {
      if (!orderId) throw new Error('Order ID is required');
      const snapshot = await db.collection(collections.ORDERS)
        .where('orderId', '==', orderId)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return Order.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting order by orderId:', error);
      throw error;
    }
  }

  static async getByUserId(userId, limit = 50) {
    try {
      if (!userId) throw new Error('User ID is required');
      const snapshot = await db.collection(collections.ORDERS)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      const orders = [];
      snapshot.forEach(doc => orders.push(Order.fromFirestore(doc.id, doc.data())));
      return orders;
    } catch (error) {
      console.error('Error getting orders by user:', error);
      throw error;
    }
  }

  static async getAll(filters = {}, limit = 50) {
    try {
      let query = db.collection(collections.ORDERS);
      if (filters.paymentStatus) query = query.where('paymentStatus', '==', filters.paymentStatus);
      if (filters.userId) query = query.where('userId', '==', filters.userId);
      if (filters.productId) query = query.where('productId', '==', filters.productId);
      query = query.orderBy('createdAt', 'desc').limit(limit);
      const snapshot = await query.get();
      const orders = [];
      snapshot.forEach(doc => orders.push(Order.fromFirestore(doc.id, doc.data())));
      return orders;
    } catch (error) {
      console.error('Error getting orders:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      if (!id) throw new Error('Order ID is required');
      const existingOrder = await Order.getById(id);
      if (!existingOrder) throw new Error('Order not found');
      const updatedData = { ...existingOrder, ...updateData, id };
      const order = new Order(updatedData);
      const orderRef = db.collection(collections.ORDERS).doc(id);
      await orderRef.update(order.toFirestore());
      return order;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  static async updatePaymentStatus(id, paymentStatus, paymentData = {}) {
    try {
      const updateData = { paymentStatus: paymentStatus, ...paymentData };
      if (paymentStatus === 'completed') updateData.completedAt = new Date().toISOString();
      return await Order.update(id, updateData);
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      if (!id) throw new Error('Order ID is required');
      const orderRef = db.collection(collections.ORDERS).doc(id);
      await orderRef.delete();
      return { id, deleted: true };
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }
}

module.exports = Order;
