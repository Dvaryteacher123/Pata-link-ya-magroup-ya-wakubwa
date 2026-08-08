// ==========================================
// HARAKAPAY PAYMENT SERVICE
// ==========================================

const axios = require('axios');
const crypto = require('crypto');
const { generateTransactionId } = require('../utils/helpers');

const HARAKAPAY_CONFIG = {
  baseURL: process.env.HARAKAPAY_BASE_URL || 'https://api.harakapay.com',
  apiKey: process.env.HARAKAPAY_API_KEY,
  webhookSecret: process.env.HARAKAPAY_WEBHOOK_SECRET,
  timeout: 30000
};

class HarakaPayService {
  
  static async initiatePayment(orderData) {
    try {
      const { orderId, amount, phone, userId, productId, productTitle } = orderData;

      const paymentData = {
        orderId: orderId,
        amount: Number(amount),
        phone: this.formatPhoneNumber(phone),
        userId: userId,
        productId: productId,
        productTitle: productTitle,
        transactionId: generateTransactionId(),
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(
        `${HARAKAPAY_CONFIG.baseURL}/api/v1/collect`,
        {
          amount: paymentData.amount,
          phone: paymentData.phone,
          reference: paymentData.orderId,
          description: `Payment for ${paymentData.productTitle}`,
          metadata: {
            orderId: paymentData.orderId,
            userId: paymentData.userId,
            productId: paymentData.productId,
            transactionId: paymentData.transactionId
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${HARAKAPAY_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'X-Webhook-Secret': HARAKAPAY_CONFIG.webhookSecret
          },
          timeout: HARAKAPAY_CONFIG.timeout
        }
      );

      if (response.data && response.data.success) {
        return {
          success: true,
          paymentId: response.data.paymentId || response.data.id,
          transactionId: response.data.transactionId || paymentData.transactionId,
          status: response.data.status || 'pending',
          message: response.data.message || 'Payment initiated successfully',
          data: response.data
        };
      } else {
        throw new Error(response.data.message || 'Payment initiation failed');
      }

    } catch (error) {
      console.error('HarakaPay initiation error:', error);
      
      if (error.response) {
        return {
          success: false,
          error: error.response.data.message || 'Payment service error',
          statusCode: error.response.status,
          data: error.response.data
        };
      } else if (error.request) {
        return {
          success: false,
          error: 'Payment service timeout. Please try again.',
          statusCode: 504
        };
      } else {
        return {
          success: false,
          error: error.message || 'Payment initiation failed',
          statusCode: 500
        };
      }
    }
  }

  static async checkPaymentStatus(paymentId) {
    try {
      const response = await axios.get(
        `${HARAKAPAY_CONFIG.baseURL}/api/v1/status/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${HARAKAPAY_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: HARAKAPAY_CONFIG.timeout
        }
      );

      if (response.data) {
        return {
          success: true,
          status: response.data.status || 'pending',
          data: response.data
        };
      } else {
        throw new Error('Failed to check payment status');
      }

    } catch (error) {
      console.error('HarakaPay status check error:', error);
      
      if (error.response) {
        return {
          success: false,
          error: error.response.data.message || 'Failed to check payment status',
          statusCode: error.response.status
        };
      } else {
        return {
          success: false,
          error: error.message || 'Payment status check failed',
          statusCode: 500
        };
      }
    }
  }

  static verifyWebhookSignature(payload, signature) {
    try {
      if (!signature) {
        return { isValid: false, error: 'No signature provided' };
      }

      const expectedSignature = crypto
        .createHmac('sha256', HARAKAPAY_CONFIG.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      return {
        isValid: isValid,
        error: isValid ? null : 'Invalid webhook signature'
      };

    } catch (error) {
      console.error('Webhook verification error:', error);
      return {
        isValid: false,
        error: error.message || 'Webhook verification failed'
      };
    }
  }

  static async processWebhook(payload) {
    try {
      const { 
        paymentId, 
        status, 
        orderId, 
        transactionId, 
        reference,
        amount,
        phone,
        metadata 
      } = payload;

      if (!paymentId) throw new Error('Payment ID is required');
      if (!status) throw new Error('Payment status is required');

      const result = {
        paymentId: paymentId,
        status: status,
        orderId: orderId || null,
        transactionId: transactionId || null,
        reference: reference || null,
        completed: status === 'completed' || status === 'success',
        failed: status === 'failed' || status === 'cancelled',
        pending: status === 'pending' || status === 'processing',
        data: payload,
        timestamp: new Date().toISOString()
      };

      if (result.completed) {
        result.completedAt = new Date().toISOString();
        result.amount = amount || null;
        result.phone = phone || null;
        result.metadata = metadata || {};
      }

      return result;

    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  static formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '255' + cleaned.substring(1);
    } else if (!cleaned.startsWith('255')) {
      if (cleaned.length === 9) {
        cleaned = '255' + cleaned;
      } else {
        cleaned = '255' + cleaned;
      }
    }
    return cleaned;
  }

  static generatePaymentId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `PAY-${timestamp}-${random}`.toUpperCase();
  }
}

module.exports = HarakaPayService;
