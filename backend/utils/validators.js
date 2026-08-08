// ==========================================
// CUSTOM VALIDATORS
// ==========================================

// ==========================================
// WHATSAPP LINK VALIDATOR
// ==========================================

const isValidWhatsAppLink = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  const whatsappPatterns = [
    /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}$/,
    /^https:\/\/wa\.me\/[0-9]{10,}$/,
    /^https:\/\/api\.whatsapp\.com\/send\?phone=[0-9]{10,}/,
    /^https:\/\/wa\.link\/[A-Za-z0-9]+$/
  ];
  
  return whatsappPatterns.some(pattern => pattern.test(url));
};

// ==========================================
// TANZANIAN PHONE VALIDATOR
// ==========================================

const isValidTZPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  
  const patterns = [
    /^255[67][0-9]{7,8}$/,
    /^0[67][0-9]{7,8}$/,
    /^[67][0-9]{7,8}$/
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
};

// ==========================================
// STRONG PASSWORD VALIDATOR
// ==========================================

const isStrongPassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
};

// ==========================================
// EMAIL VALIDATOR
// ==========================================

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// ==========================================
// PRICE VALIDATOR
// ==========================================

const isValidPrice = (price) => {
  if (price === undefined || price === null) return false;
  const numPrice = Number(price);
  if (isNaN(numPrice)) return false;
  if (numPrice < 0) return false;
  if (!Number.isFinite(numPrice)) return false;
  if (numPrice > 1000000) return false;
  return true;
};

// ==========================================
// SANITIZERS
// ==========================================

const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('255')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      cleaned = '+255' + cleaned.substring(1);
    } else if (cleaned.length >= 9) {
      cleaned = '+255' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
};

const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
};

module.exports = {
  isValidWhatsAppLink,
  isValidTZPhone,
  isStrongPassword,
  isValidEmail,
  isValidPrice,
  sanitizePhone,
  sanitizeEmail,
  sanitizeString
};
