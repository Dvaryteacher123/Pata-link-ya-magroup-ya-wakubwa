// ==========================================
// PRODUCT CONTROLLER
// ==========================================

const Product = require('../models/Product');
const NotificationService = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/helpers');

// ==========================================
// GET ALL PRODUCTS (Public)
// ==========================================

exports.getAllProducts = async (req, res) => {
  try {
    const { category, isFree, isPremium, isFeatured, isTrending, limit = 50 } = req.query;

    const filters = { isVisible: true };
    if (category) filters.category = category;
    if (isFree !== undefined) filters.isFree = isFree === 'true';
    if (isPremium !== undefined) filters.isPremium = isPremium === 'true';
    if (isFeatured !== undefined) filters.isFeatured = isFeatured === 'true';
    if (isTrending !== undefined) filters.isTrending = isTrending === 'true';

    const products = await Product.getAll(filters, parseInt(limit));

    res.json(successResponse(products, 'Products retrieved successfully'));

  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get products'));
  }
};

// ==========================================
// GET PRODUCT BY ID (Public)
// ==========================================

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    res.json(successResponse(product, 'Product retrieved successfully'));

  } catch (error) {
    console.error('Get product by id error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get product'));
  }
};

// ==========================================
// CREATE PRODUCT (Admin only)
// ==========================================

exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    productData.ownerId = req.user.uid;

    const newProduct = await Product.create(productData);

    await NotificationService.createNotification({
      userId: null,
      title: 'New Product Added',
      message: `Product "${newProduct.title}" has been added`,
      type: 'info',
      target: 'all',
      link: `/admin/products/${newProduct.id}`
    });

    res.status(201).json(successResponse(newProduct, 'Product created successfully'));

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to create product'));
  }
};

// ==========================================
// UPDATE PRODUCT (Admin only)
// ==========================================

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingProduct = await Product.getById(id);
    if (!existingProduct) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    const updatedProduct = await Product.update(id, updateData);

    await NotificationService.createNotification({
      userId: null,
      title: 'Product Updated',
      message: `Product "${updatedProduct.title}" has been updated`,
      type: 'info',
      target: 'all',
      link: `/admin/products/${updatedProduct.id}`
    });

    res.json(successResponse(updatedProduct, 'Product updated successfully'));

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update product'));
  }
};

// ==========================================
// DELETE PRODUCT (Admin only)
// ==========================================

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await Product.getById(id);
    if (!existingProduct) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    await Product.delete(id);

    await NotificationService.createNotification({
      userId: null,
      title: 'Product Deleted',
      message: `Product "${existingProduct.title}" has been deleted`,
      type: 'warning',
      target: 'all'
    });

    res.json(successResponse({ id: id }, 'Product deleted successfully'));

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to delete product'));
  }
};

// ==========================================
// TOGGLE PRODUCT VISIBILITY (Admin only)
// ==========================================

exports.toggleVisibility = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await Product.getById(id);
    if (!existingProduct) {
      return res.status(404).json(errorResponse('Product not found'));
    }

    const result = await Product.toggleVisibility(id);

    res.json(successResponse(result, `Product ${result.isVisible ? 'published' : 'hidden'} successfully`));

  } catch (error) {
    console.error('Toggle visibility error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to toggle product visibility'));
  }
};
