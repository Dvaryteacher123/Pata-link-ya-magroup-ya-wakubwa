// ==========================================
// PAYMENT MODEL
// ==========================================

const { db, collections } = require('../config/firebase');
const { generatePaymentId } = require('../utils/helpers');

class Payment {
  constructor(data) {
    this.id = data.id || null;
    this.paymentId = data.paymentId || generatePaymentId();
    this.orderId = data.orderId || null;
    this.userId = data.userId || null;
    this.productId = data.productId || null;
    this.amount = data.amount || 0;
    this.phone = data.phone || null;
    this.status = data.status || 'pending';
    this.transactionId = data.transactionId || null;
    this.reference = data.reference || null;
    this.webhookData = data.webhookData || null;
    this.webhookReceived = data.webhookReceived || false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.completedAt = data.completedAt || null;
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toFirestore() {
    return {
      paymentId: this.paymentId,
      orderId: this.orderId,
      userId: this.userId,
      productId: this.productId,
      amount: this.amount,
      phone: this.phone,
      status: this.status,
      transactionId: this.transactionId,
      reference: this.reference,
      webhookData: this.webhookData,
      webhookReceived: this.webhookReceived,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      updatedAt: new Date().toISOString()
    };
  }

  static fromFirestore(id, data) {
    return new Payment({
      id: id,
      paymentId: data.paymentId || null,
      orderId: data.orderId || null,
      userId: data.userId || null,
      productId: data.productId || null,
      amount: data.amount || 0,
      phone: data.phone || null,
      status: data.status || 'pending',
      transactionId: data.transactionId || null,
      reference: data.reference || null,
      webhookData: data.webhookData || null,
      webhookReceived: data.webhookReceived || false,
      createdAt: data.createdAt || new Date().toISOString(),
      completedAt: data.completedAt || null,
      updatedAt: data.updatedAt || new Date().toISOString()
    });
  }

  static async create(paymentData) {
    try {
      const payment = new Payment(paymentData);
      const paymentRef = db.collection(collections.PAYMENTS).doc();
      const id = paymentRef.id;
      payment.id = id;
      await paymentRef.set(payment.toFirestore());
      return payment;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      if (!id) throw new Error('Payment ID is required');
      const paymentRef = db.collection(collections.PAYMENTS).doc(id);
      const doc = await paymentRef.get();
      if (!doc.exists) return null;
      return Payment.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting payment:', error);
      throw error;
    }
  }

  static async getByPaymentId(paymentId) {
    try {
      if (!paymentId) throw new Error('Payment ID is required');
      const snapshot = await db.collection(collections.PAYMENTS)
        .where('paymentId', '==', paymentId)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return Payment.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting payment by paymentId:', error);
      throw error;
    }
  }

  static async getByOrderId(orderId) {
    try {
      if (!orderId) throw new Error('Order ID is required');
      const snapshot = await db.collection(collections.PAYMENTS)
        .where('orderId', '==', orderId)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return Payment.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting payment by orderId:', error);
      throw error;
    }
  }

  static async getByUserId(userId, limit = 50) {
    try {
      if (!userId) throw new Error('User ID is required');
      const snapshot = await db.collection(collections.PAYMENTS)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      const payments = [];
      snapshot.forEach(doc => payments.push(Payment.fromFirestore(doc.id, doc.data())));
      return payments;
    } catch (error) {
      console.error('Error getting payments by user:', error);
      throw error;
    }
  }

  static async getAll(filters = {}, limit = 50) {
    try {
      let query = db.collection(collections.PAYMENTS);
      if (filters.status) query = query.where('status', '==', filters.status);
      if (filters.userId) query = query.where('userId', '==', filters.userId);
      if (filters.productId) query = query.where('productId', '==', filters.productId);
      query = query.orderBy('createdAt', 'desc').limit(limit);
      const snapshot = await query.get();
      const payments = [];
      snapshot.forEach(doc => payments.push(Payment.fromFirestore(doc.id, doc.data())));
      return payments;
    } catch (error) {
      console.error('Error getting payments:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      if (!id) throw new Error('Payment ID is required');
      const existingPayment = await Payment.getById(id);
      if (!existingPayment) throw new Error('Payment not found');
      const updatedData = { ...existingPayment, ...updateData, id };
      const payment = new Payment(updatedData);
      const paymentRef = db.collection(collections.PAYMENTS).doc(id);
      await paymentRef.update(payment.toFirestore());
      return payment;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }

  static async updateStatus(id, status, data = {}) {
    try {
      const updateData = { status: status, ...data };
      if (status === 'completed') updateData.completedAt = new Date().toISOString();
      return await Payment.update(id, updateData);
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  static async handleWebhook(paymentId, webhookData) {
    try {
      const payment = await Payment.getByPaymentId(paymentId);
      if (!payment) throw new Error('Payment not found');
      const updateData = { webhookData: webhookData, webhookReceived: true };
      if (webhookData.status === 'completed' || webhookData.status === 'success') {
        updateData.status = 'completed';
        updateData.completedAt = new Date().toISOString();
        if (webhookData.transactionId) updateData.transactionId = webhookData.transactionId;
        if (webhookData.reference) updateData.reference = webhookData.reference;
      } else if (webhookData.status === 'failed') {
        updateData.status = 'failed';
      }
      return await Payment.update(payment.id, updateData);
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      if (!id) throw new Error('Payment ID is required');
      const paymentRef = db.collection(collections.PAYMENTS).doc(id);
      await paymentRef.delete();
      return { id, deleted: true };
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  }
}

module.exports = Payment;
