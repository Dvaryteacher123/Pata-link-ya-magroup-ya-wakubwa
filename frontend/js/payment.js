// ==========================================
// PAYMENT JAVASCRIPT
// ==========================================

// ==========================================
// DOM ELEMENTS
// ==========================================

const paymentForm = document.getElementById('paymentForm');
const paymentBtn = document.getElementById('paymentBtn');
const paymentBtnText = document.getElementById('paymentBtnText');
const paymentSpinner = document.getElementById('paymentSpinner');
const paymentError = document.getElementById('paymentError');
const paymentPhone = document.getElementById('paymentPhone');
const paymentEmail = document.getElementById('paymentEmail');

const productTitle = document.getElementById('productTitle');
const productDescription = document.getElementById('productDescription');
const productPrice = document.getElementById('productPrice');
const productImage = document.getElementById('productImage');

const subtotal = document.getElementById('subtotal');
const fee = document.getElementById('fee');
const totalAmount = document.getElementById('totalAmount');

const paymentModal = document.getElementById('paymentModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalIcon = document.getElementById('modalIcon');
const modalBtn = document.getElementById('modalBtn');
const progressBar = document.getElementById('progressBar');

// ==========================================
// API BASE URL
// ==========================================

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : 'https://pata-link-whatsapp-backend.onrender.com/api';

// ==========================================
// GET PRODUCT ID FROM URL
// ==========================================

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('product');

// ==========================================
// LOAD PRODUCT DATA
// ==========================================

async function loadProductData() {
    if (!productId) {
        showPaymentError('No product selected. Please go back and choose a product.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        const data = await response.json();

        if (data.success) {
            const product = data.data;
            if (productTitle) productTitle.textContent = product.title || 'Product';
            if (productDescription) productDescription.textContent = product.description || 'No description available';
            if (productPrice) {
                const price = product.price || 0;
                productPrice.textContent = `TSh ${price.toLocaleString()}`;
            }
            if (subtotal) subtotal.textContent = `TSh ${(product.price || 0).toLocaleString()}`;
            if (totalAmount) totalAmount.textContent = `TSh ${(product.price || 0).toLocaleString()}`;
            if (product.imageUrl && productImage) {
                productImage.innerHTML = `<img src="${product.imageUrl}" alt="${product.title}" style="width:100%;height:100%;object-fit:cover;">`;
            }
        } else {
            showPaymentError('Product not found.');
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showPaymentError('Failed to load product details.');
    }
}

// ==========================================
// PAYMENT FORM SUBMIT
// ==========================================

if (paymentForm) {
    paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        paymentError.style.display = 'none';
        paymentError.textContent = '';
        
        const phone = paymentPhone.value.trim();
        const email = paymentEmail.value.trim();
        
        let isValid = true;
        
        if (!phone) {
            document.getElementById('phoneError').textContent = 'Phone number is required';
            document.getElementById('phoneError').classList.add('visible');
            isValid = false;
        } else {
            document.getElementById('phoneError').textContent = '';
            document.getElementById('phoneError').classList.remove('visible');
        }
        
        if (!email) {
            document.getElementById('emailError').textContent = 'Email is required';
            document.getElementById('emailError').classList.add('visible');
            isValid = false;
        } else {
            document.getElementById('emailError').textContent = '';
            document.getElementById('emailError').classList.remove('visible');
        }
        
        if (!isValid) return;
        
        await processPayment(phone, email);
    });
}

// ==========================================
// PROCESS PAYMENT
// ==========================================

async function processPayment(phone, email) {
    paymentBtn.disabled = true;
    paymentBtnText.style.display = 'none';
    paymentSpinner.style.display = 'inline-block';
    
    showModal('processing', 'Processing Payment', 'Please wait while we process your payment...');
    
    try {
        const token = window.auth.getAuthToken();
        if (!token) {
            throw new Error('You must be logged in to make a payment');
        }
        
        // Initiate payment
        const response = await fetch(`${API_BASE_URL}/payments/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId, phone })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Payment initiation failed');
        }
        
        const paymentData = data.data;
        const orderId = paymentData.orderId;
        
        updateModal('processing', 'Payment Initiated', `Order ID: ${orderId}. Waiting for confirmation...`);
        
        // Poll for payment status
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts && !completed) {
            attempts++;
            const progress = (attempts / maxAttempts) * 100;
            if (progressBar) progressBar.style.width = `${Math.min(progress, 95)}%`;
            await sleep(2000);
            
            const statusResponse = await fetch(`${API_BASE_URL}/payments/status/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const statusData = await statusResponse.json();
            
            if (statusData.success) {
                if (statusData.data.status === 'completed') {
                    completed = true;
                    break;
                } else if (statusData.data.status === 'failed') {
                    throw new Error('Payment failed. Please try again.');
                }
            }
        }
        
        if (!completed) {
            const finalResponse = await fetch(`${API_BASE_URL}/payments/status/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const finalData = await finalResponse.json();
            
            if (finalData.success && finalData.data.status === 'completed') {
                completed = true;
            } else {
                throw new Error('Payment timeout. Please check your payment status later.');
            }
        }
        
        if (completed) {
            if (progressBar) progressBar.style.width = '100%';
            setTimeout(() => {
                window.location.href = `success.html?order=${orderId}`;
            }, 1000);
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        showModal('error', 'Payment Failed', error.message || 'Payment failed. Please try again.');
        showPaymentError(error.message || 'Payment failed. Please try again.');
        paymentBtn.disabled = false;
        paymentBtnText.style.display = 'inline';
        paymentSpinner.style.display = 'none';
    }
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showModal(type, title, message) {
    if (!paymentModal) return;
    paymentModal.style.display = 'flex';
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
    if (modalBtn) modalBtn.style.display = 'none';
    if (modalIcon) {
        const iconMap = {
            'processing': '<i class="fas fa-spinner fa-spin"></i>',
            'success': '<i class="fas fa-check-circle"></i>',
            'error': '<i class="fas fa-times-circle"></i>'
        };
        modalIcon.innerHTML = iconMap[type] || iconMap['processing'];
        modalIcon.className = `payment-modal-icon ${type}`;
    }
    if (progressBar) progressBar.style.width = '0%';
}

function updateModal(type, title, message) {
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
}

function closeModal() {
    if (paymentModal) paymentModal.style.display = 'none';
}

if (modalBtn) {
    modalBtn.addEventListener('click', function() {
        closeModal();
        paymentBtn.disabled = false;
        paymentBtnText.style.display = 'inline';
        paymentSpinner.style.display = 'none';
    });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showPaymentError(message) {
    if (paymentError) {
        paymentError.textContent = message;
        paymentError.style.display = 'block';
    }
}

// ==========================================
// INITIALIZE
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    if (!window.auth || !window.auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    loadProductData();
    const userData = window.auth.getUserData();
    if (userData) {
        if (paymentEmail) paymentEmail.value = userData.email || '';
        if (paymentPhone) paymentPhone.value = userData.phone || '';
    }
});

console.log('💳 Payment module loaded successfully');
