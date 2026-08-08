// ==========================================
// HELPER FUNCTIONS
// ==========================================

const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ==========================================
// DATE & TIME HELPERS
// ==========================================

const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

const formatDate = (date, format = 'DD/MM/YYYY HH:mm:ss') => {
  if (!date) return 'N/A';
  return moment(date).format(format);
};

const getTimeAgo = (date) => {
  if (!date) return 'N/A';
  return moment(date).fromNow();
};

// ==========================================
// ID GENERATORS
// ==========================================

const generateOrderId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
};

const generatePaymentId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PAY-${timestamp}-${random}`.toUpperCase();
};

const generateTransactionId = () => {
  return uuidv4().replace(/-/g, '').substring(0, 16);
};

const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// ==========================================
// NUMBER FORMATTING
// ==========================================

const formatCurrency = (amount, currency = 'TSh') => {
  if (!amount) amount = 0;
  return `${currency} ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
};

const calculatePercentage = (part, total) => {
  if (total === 0) return 0;
  return (part / total) * 100;
};

// ==========================================
// STRING HELPERS
// ==========================================

const truncateText = (text, length = 100) => {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

const slugify = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

// ==========================================
// PHONE HELPERS
// ==========================================

const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+255' + cleaned.substring(1);
    } else if (cleaned.startsWith('255')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+255' + cleaned;
    }
  }
  return cleaned;
};

// ==========================================
// RESPONSE HELPERS
// ==========================================

const successResponse = (data, message = 'Success', statusCode = 200) => {
  return {
    success: true,
    message,
    data,
    timestamp: getCurrentTimestamp()
  };
};

const errorResponse = (message = 'An error occurred', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: getCurrentTimestamp()
  };
  if (errors) response.errors = errors;
  return response;
};

// ==========================================
// PAGINATION HELPERS
// ==========================================

const paginateData = (data, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginated = {
    data: data.slice(startIndex, endIndex),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: data.length,
      pages: Math.ceil(data.length / limit)
    }
  };
  
  if (endIndex < data.length) paginated.pagination.next = page + 1;
  if (startIndex > 0) paginated.pagination.prev = page - 1;
  
  return paginated;
};

module.exports = {
  getCurrentTimestamp,
  formatDate,
  getTimeAgo,
  generateOrderId,
  generatePaymentId,
  generateTransactionId,
  generateToken,
  formatCurrency,
  calculatePercentage,
  truncateText,
  slugify,
  formatPhoneNumber,
  successResponse,
  errorResponse,
  paginateData
};
