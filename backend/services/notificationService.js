// ==========================================
// NOTIFICATION SERVICE
// ==========================================

const { db, collections } = require('../config/firebase');
const { getCurrentTimestamp } = require('../utils/helpers');

class NotificationService {
  
  // ==========================================
  // CREATE NOTIFICATION
  // ==========================================

  static async createNotification(notificationData) {
    try {
      const {
        userId,
        title,
        message,
        type = 'info',
        target = 'specific',
        link = null,
        metadata = {}
      } = notificationData;

      if (!title) throw new Error('Notification title is required');
      if (!message) throw new Error('Notification message is required');

      const notification = {
        userId: userId || null,
        title: title,
        message: message,
        type: type,
        target: target,
        link: link || null,
        metadata: metadata || {},
        isRead: false,
        createdAt: getCurrentTimestamp()
      };

      const notificationRef = db.collection(collections.NOTIFICATIONS).doc();
      await notificationRef.set(notification);

      return {
        success: true,
        notificationId: notificationRef.id,
        data: notification
      };

    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // ==========================================
  // GET USER NOTIFICATIONS
  // ==========================================

  static async getUserNotifications(userId, options = {}) {
    try {
      if (!userId) throw new Error('User ID is required');

      const { limit = 50, unreadOnly = false } = options;

      let query = db.collection(collections.NOTIFICATIONS)
        .where('userId', '==', userId);

      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const notifications = [];
      snapshot.forEach(doc => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        notifications: notifications,
        total: notifications.length
      };

    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // ==========================================
  // MARK NOTIFICATION AS READ
  // ==========================================

  static async markAsRead(notificationId, userId = null) {
    try {
      if (!notificationId) throw new Error('Notification ID is required');

      const notificationRef = db.collection(collections.NOTIFICATIONS).doc(notificationId);
      
      const doc = await notificationRef.get();
      if (!doc.exists) throw new Error('Notification not found');
      
      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) {
        throw new Error('You do not have permission to mark this notification as read');
      }

      await notificationRef.update({
        isRead: true,
        readAt: getCurrentTimestamp()
      });

      return { success: true, message: 'Notification marked as read' };

    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // ==========================================
  // MARK ALL NOTIFICATIONS AS READ
  // ==========================================

  static async markAllAsRead(userId) {
    try {
      if (!userId) throw new Error('User ID is required');

      const snapshot = await db.collection(collections.NOTIFICATIONS)
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      const batch = db.batch();
      
      snapshot.forEach(doc => {
        const ref = db.collection(collections.NOTIFICATIONS).doc(doc.id);
        batch.update(ref, {
          isRead: true,
          readAt: getCurrentTimestamp()
        });
      });

      await batch.commit();

      return {
        success: true,
        message: `Marked ${snapshot.size} notifications as read`
      };

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // ==========================================
  // DELETE NOTIFICATION
  // ==========================================

  static async deleteNotification(notificationId, userId = null) {
    try {
      if (!notificationId) throw new Error('Notification ID is required');

      const notificationRef = db.collection(collections.NOTIFICATIONS).doc(notificationId);
      
      const doc = await notificationRef.get();
      if (!doc.exists) throw new Error('Notification not found');
      
      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) {
        throw new Error('You do not have permission to delete this notification');
      }

      await notificationRef.delete();

      return { success: true, message: 'Notification deleted successfully' };

    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // ==========================================
  // GET UNREAD COUNT
  // ==========================================

  static async getUnreadCount(userId) {
    try {
      if (!userId) throw new Error('User ID is required');

      const snapshot = await db.collection(collections.NOTIFICATIONS)
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      return { unreadCount: snapshot.size };

    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  // ==========================================
  // SEND PAYMENT NOTIFICATION
  // ==========================================

  static async sendPaymentNotification(userId, orderId, productTitle, amount, status) {
    try {
      const statusMessages = {
        'pending': 'Your payment is being processed',
        'completed': 'Your payment has been confirmed',
        'failed': 'Your payment has failed'
      };

      const statusColors = {
        'pending': 'warning',
        'completed': 'success',
        'failed': 'error'
      };

      const message = statusMessages[status] || 'Payment update';

      const notification = await this.createNotification({
        userId: userId,
        title: `Payment ${status}`,
        message: `${message} for "${productTitle}" (${amount} TSh)`,
        type: statusColors[status] || 'info',
        target: 'specific',
        link: `/orders/${orderId}`,
        metadata: {
          orderId: orderId,
          productTitle: productTitle,
          amount: amount,
          status: status
        }
      });

      return notification;

    } catch (error) {
      console.error('Error sending payment notification:', error);
      throw error;
    }
  }

  // ==========================================
  // SEND TO MANY USERS (Admin)
  // ==========================================

  static async sendToManyUsers(userIds, notificationData) {
    try {
      if (!userIds || userIds.length === 0) {
        throw new Error('At least one user ID is required');
      }

      const results = [];
      const errors = [];

      for (const userId of userIds) {
        try {
          const result = await this.createNotification({
            ...notificationData,
            userId: userId,
            target: 'specific'
          });
          results.push(result);
        } catch (error) {
          errors.push({
            userId: userId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results: results,
        errors: errors,
        totalSent: results.length,
        totalFailed: errors.length
      };

    } catch (error) {
      console.error('Error sending notifications to multiple users:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
