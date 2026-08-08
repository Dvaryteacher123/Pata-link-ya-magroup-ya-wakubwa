// ==========================================
// PRODUCT MODEL
// ==========================================

const { db, collections } = require('../config/firebase');
const { 
  isValidPrice,
  isValidWhatsAppLink,
  sanitizeString
} = require('../utils/validators');

class Product {
  constructor(data) {
    this.id = data.id || null;
    this.title = data.title || null;
    this.description = data.description || null;
    this.category = data.category || 'Other';
    this.price = data.price || 0;
    this.offerPrice = data.offerPrice || null;
    this.whatsappLink = data.whatsappLink || null;
    this.imageUrl = data.imageUrl || null;
    this.isFree = data.isFree || false;
    this.isPremium = data.isPremium || false;
    this.isFeatured = data.isFeatured || false;
    this.isTrending = data.isTrending || false;
    this.isVisible = data.isVisible !== undefined ? data.isVisible : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.title) errors.push('Product title is required');
    else if (this.title.length < 3 || this.title.length > 100) errors.push('Title must be between 3 and 100 characters');
    if (!this.description) errors.push('Product description is required');
    else if (this.description.length < 10 || this.description.length > 500) errors.push('Description must be between 10 and 500 characters');
    if (!this.category) errors.push('Category is required');
    if (!this.whatsappLink) errors.push('WhatsApp link is required');
    else if (!isValidWhatsAppLink(this.whatsappLink)) errors.push('Invalid WhatsApp link format');
    if (!isValidPrice(this.price)) errors.push('Invalid price');
    if (this.offerPrice !== null && this.offerPrice !== undefined) {
      if (!isValidPrice(this.offerPrice)) errors.push('Invalid offer price');
      if (this.offerPrice >= this.price) errors.push('Offer price must be less than regular price');
    }
    return { isValid: errors.length === 0, errors };
  }

  sanitize() {
    if (this.title) this.title = sanitizeString(this.title);
    if (this.description) this.description = sanitizeString(this.description);
    if (this.category) this.category = sanitizeString(this.category);
    if (this.whatsappLink) this.whatsappLink = this.whatsappLink.trim();
    return this;
  }

  toFirestore() {
    return {
      title: this.title,
      description: this.description,
      category: this.category,
      price: this.price,
      offerPrice: this.offerPrice || null,
      whatsappLink: this.whatsappLink,
      imageUrl: this.imageUrl || null,
      isFree: this.isFree,
      isPremium: this.isPremium,
      isFeatured: this.isFeatured,
      isTrending: this.isTrending,
      isVisible: this.isVisible,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString()
    };
  }

  static fromFirestore(id, data) {
    return new Product({
      id: id,
      title: data.title || null,
      description: data.description || null,
      category: data.category || 'Other',
      price: data.price || 0,
      offerPrice: data.offerPrice || null,
      whatsappLink: data.whatsappLink || null,
      imageUrl: data.imageUrl || null,
      isFree: data.isFree || false,
      isPremium: data.isPremium || false,
      isFeatured: data.isFeatured || false,
      isTrending: data.isTrending || false,
      isVisible: data.isVisible !== undefined ? data.isVisible : true,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    });
  }

  static async create(productData) {
    try {
      const product = new Product(productData);
      product.sanitize();
      const validation = product.validate();
      if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      const productRef = db.collection(collections.PRODUCTS).doc();
      const id = productRef.id;
      product.id = id;
      await productRef.set(product.toFirestore());
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      if (!id) throw new Error('Product ID is required');
      const productRef = db.collection(collections.PRODUCTS).doc(id);
      const doc = await productRef.get();
      if (!doc.exists) return null;
      return Product.fromFirestore(doc.id, doc.data());
    } catch (error) {
      console.error('Error getting product:', error);
      throw error;
    }
  }

  static async getAll(filters = {}, limit = 50) {
    try {
      let query = db.collection(collections.PRODUCTS);
      if (filters.category) query = query.where('category', '==', filters.category);
      if (filters.isFree !== undefined) query = query.where('isFree', '==', filters.isFree);
      if (filters.isPremium !== undefined) query = query.where('isPremium', '==', filters.isPremium);
      if (filters.isFeatured !== undefined) query = query.where('isFeatured', '==', filters.isFeatured);
      if (filters.isTrending !== undefined) query = query.where('isTrending', '==', filters.isTrending);
      if (filters.isVisible !== undefined) query = query.where('isVisible', '==', filters.isVisible);
      query = query.orderBy('createdAt', 'desc').limit(limit);
      const snapshot = await query.get();
      const products = [];
      snapshot.forEach(doc => products.push(Product.fromFirestore(doc.id, doc.data())));
      return products;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      if (!id) throw new Error('Product ID is required');
      const existingProduct = await Product.getById(id);
      if (!existingProduct) throw new Error('Product not found');
      const updatedData = { ...existingProduct, ...updateData, id };
      const product = new Product(updatedData);
      product.sanitize();
      const validation = product.validate();
      if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      const productRef = db.collection(collections.PRODUCTS).doc(id);
      await productRef.update(product.toFirestore());
      return product;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      if (!id) throw new Error('Product ID is required');
      const productRef = db.collection(collections.PRODUCTS).doc(id);
      await productRef.delete();
      return { id, deleted: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  static async toggleVisibility(id) {
    try {
      const product = await Product.getById(id);
      if (!product) throw new Error('Product not found');
      const newVisibility = !product.isVisible;
      await Product.update(id, { isVisible: newVisibility });
      return { id, isVisible: newVisibility };
    } catch (error) {
      console.error('Error toggling product visibility:', error);
      throw error;
    }
  }
}

module.exports = Product;
