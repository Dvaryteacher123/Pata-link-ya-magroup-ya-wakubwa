const { db, collections } = require('../config/firebase');

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const snapshot = await db.collection(collections.PRODUCTS || 'products').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(collections.PRODUCTS || 'products').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create product
const createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdAt: new Date().toISOString()
    };
    const docRef = await db.collection(collections.PRODUCTS || 'products').add(productData);
    res.status(201).json({ success: true, message: 'Product created successfully', data: { id: docRef.id, ...productData } });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    await db.collection(collections.PRODUCTS || 'products').doc(id).update(updateData);
    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection(collections.PRODUCTS || 'products').doc(id).delete();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle product visibility
const toggleVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(collections.PRODUCTS || 'products').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const currentVisibility = doc.data().isVisible ?? true;
    await docRef.update({ isVisible: !currentVisibility });
    res.json({ success: true, message: 'Visibility toggled successfully' });
  } catch (error) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleVisibility
};

