// ==========================================
// ADMIN JAVASCRIPT
// ==========================================

// ==========================================
// DOM ELEMENTS
// ==========================================

const adminLoginForm = document.getElementById('adminLoginForm');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLoginBtnText = document.getElementById('adminLoginBtnText');
const adminLoginSpinner = document.getElementById('adminLoginSpinner');
const adminLoginError = document.getElementById('adminLoginError');
const toggleAdminPassword = document.getElementById('toggleAdminPassword');

const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminSidebarLinks = document.querySelectorAll('.admin-sidebar-link');
const adminTabs = document.querySelectorAll('.admin-tab-content');

const statUsers = document.getElementById('statUsers');
const statProducts = document.getElementById('statProducts');
const statOrders = document.getElementById('statOrders');
const statRevenue = document.getElementById('statRevenue');

const adminUsersTable = document.getElementById('adminUsersTable');
const adminProductsTable = document.getElementById('adminProductsTable');
const adminOrdersTable = document.getElementById('adminOrdersTable');
const adminPaymentsTable = document.getElementById('adminPaymentsTable');
const adminCategoriesTable = document.getElementById('adminCategoriesTable');

const addProductBtn = document.getElementById('addProductBtn');

const adminCategoryForm = document.getElementById('adminCategoryForm');
const categoryName = document.getElementById('categoryName');

const adminSettingsForm = document.getElementById('adminSettingsForm');
const settingsWebsiteName = document.getElementById('settingsWebsiteName');
const settingsSupportEmail = document.getElementById('settingsSupportEmail');

const adminNotificationForm = document.getElementById('adminNotificationForm');
const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');

// ==========================================
// API BASE URL
// ==========================================

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : 'https://pata-link-whatsapp-backend.onrender.com/api';

// ==========================================
// TOGGLE PASSWORD
// ==========================================

if (toggleAdminPassword) {
  toggleAdminPassword.addEventListener('click', function() {
    const input = document.getElementById('adminPassword');
    const icon = this.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
}

// ==========================================
// ADMIN LOGIN
// ==========================================

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = adminEmail.value.trim();
    const password = adminPassword.value;
    
    adminLoginError.style.display = 'none';
    adminLoginError.textContent = '';
    
    if (!email || !password) {
      adminLoginError.textContent = 'Please fill in all fields';
      adminLoginError.style.display = 'block';
      return;
    }
    
    adminLoginBtn.disabled = true;
    adminLoginBtnText.style.display = 'none';
    adminLoginSpinner.style.display = 'inline-block';
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.data.user.email !== 'dullamanyama0@gmail.com') {
          adminLoginError.textContent = 'Access denied. Admin only.';
          adminLoginError.style.display = 'block';
          adminLoginBtn.disabled = false;
          adminLoginBtnText.style.display = 'inline';
          adminLoginSpinner.style.display = 'none';
          return;
        }
        
        localStorage.setItem('adminToken', data.data.token);
        localStorage.setItem('adminData', JSON.stringify(data.data.user));
        window.location.href = 'admin-dashboard.html';
      } else {
        adminLoginError.textContent = data.message || 'Login failed';
        adminLoginError.style.display = 'block';
        adminLoginBtn.disabled = false;
        adminLoginBtnText.style.display = 'inline';
        adminLoginSpinner.style.display = 'none';
      }
    } catch (error) {
      console.error('Admin login error:', error);
      adminLoginError.textContent = 'Network error. Please try again.';
      adminLoginError.style.display = 'block';
      adminLoginBtn.disabled = false;
      adminLoginBtnText.style.display = 'inline';
      adminLoginSpinner.style.display = 'none';
    }
  });
}

// ==========================================
// CHECK ADMIN AUTH
// ==========================================

function checkAdminAuth() {
  const token = localStorage.getItem('adminToken');
  const adminData = localStorage.getItem('adminData');
  
  if (!token || !adminData) {
    window.location.href = 'admin.html';
    return false;
  }
  
  try {
    const user = JSON.parse(adminData);
    if (user.email !== 'dullamanyama0@gmail.com') {
      window.location.href = 'admin.html';
      return false;
    }
  } catch {
    window.location.href = 'admin.html';
    return false;
  }
  
  return true;
}

function getAdminToken() {
  return localStorage.getItem('adminToken');
}

function adminLogout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminData');
  window.location.href = 'admin.html';
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', adminLogout);
}

// ==========================================
// LOAD ADMIN DASHBOARD
// ==========================================

async function loadAdminDashboard() {
  const token = getAdminToken();
  if (!token) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      const stats = data.data;
      if (statUsers) statUsers.textContent = stats.users?.total || 0;
      if (statProducts) statProducts.textContent = stats.products?.total || 0;
      if (statOrders) statOrders.textContent = stats.orders?.total || 0;
      if (statRevenue) statRevenue.textContent = `TSh ${(stats.revenue?.total || 0).toLocaleString()}`;
    }
    
    await loadAdminUsers();
    await loadAdminProducts();
    await loadAdminOrders();
    await loadAdminPayments();
    await loadAdminCategories();
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
  }
}

// ==========================================
// LOAD ADMIN USERS
// ==========================================

async function loadAdminUsers() {
  const token = getAdminToken();
  if (!token || !adminUsersTable) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.users && data.data.users.length > 0) {
      adminUsersTable.innerHTML = data.data.users.map(user => `
        <tr>
          <td>${user.fullName || 'N/A'}</td>
          <td>${user.email || 'N/A'}</td>
          <td>${user.phone || '-'}</td>
          <td><span class="status-badge ${user.status}">${user.status || 'active'}</span></td>
          <td>
            <button class="admin-btn small warning" onclick="toggleUserStatus('${user.uid}')">
              <i class="fas ${user.status === 'suspended' ? 'fa-play' : 'fa-pause'}"></i>
            </button>
          </td>
        </tr>
      `).join('');
    } else {
      adminUsersTable.innerHTML = `<tr><td colspan="5" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// ==========================================
// LOAD ADMIN PRODUCTS
// ==========================================

async function loadAdminProducts() {
  const token = getAdminToken();
  if (!token || !adminProductsTable) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.products && data.data.products.length > 0) {
      adminProductsTable.innerHTML = data.data.products.map(product => `
        <tr>
          <td>${product.title || 'N/A'}</td>
          <td>${product.category || 'Other'}</td>
          <td>TSh ${(product.price || 0).toLocaleString()}</td>
          <td>${product.isFree ? 'FREE' : product.isPremium ? 'PREMIUM' : ''}</td>
          <td><span class="status-badge ${product.isVisible ? 'active' : 'suspended'}">${product.isVisible ? 'Visible' : 'Hidden'}</span></td>
          <td>
            <button class="admin-btn small primary" onclick="editProduct('${product.id}')"><i class="fas fa-edit"></i></button>
            <button class="admin-btn small warning" onclick="toggleProduct('${product.id}')"><i class="fas ${product.isVisible ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
            <button class="admin-btn small danger" onclick="deleteProduct('${product.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } else {
      adminProductsTable.innerHTML = `<tr><td colspan="6" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

// ==========================================
// LOAD ADMIN ORDERS
// ==========================================

async function loadAdminOrders() {
  const token = getAdminToken();
  if (!token || !adminOrdersTable) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.orders && data.data.orders.length > 0) {
      adminOrdersTable.innerHTML = data.data.orders.map(order => `
        <tr>
          <td>${order.orderId || 'N/A'}</td>
          <td>${order.productTitle || 'N/A'}</td>
          <td>TSh ${(order.amount || 0).toLocaleString()}</td>
          <td><span class="status-badge ${order.paymentStatus}">${order.paymentStatus || 'pending'}</span></td>
          <td>${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      adminOrdersTable.innerHTML = `<tr><td colspan="5" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading orders:', error);
  }
}

// ==========================================
// LOAD ADMIN PAYMENTS
// ==========================================

async function loadAdminPayments() {
  const token = getAdminToken();
  if (!token || !adminPaymentsTable) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/payments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.payments && data.data.payments.length > 0) {
      adminPaymentsTable.innerHTML = data.data.payments.map(payment => `
        <tr>
          <td>${payment.paymentId || 'N/A'}</td>
          <td>${payment.productTitle || 'N/A'}</td>
          <td>TSh ${(payment.amount || 0).toLocaleString()}</td>
          <td><span class="status-badge ${payment.status}">${payment.status || 'pending'}</span></td>
          <td>${payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      adminPaymentsTable.innerHTML = `<tr><td colspan="5" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading payments:', error);
  }
}

// ==========================================
// LOAD ADMIN CATEGORIES
// ==========================================

async function loadAdminCategories() {
  const token = getAdminToken();
  if (!token || !adminCategoriesTable) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/categories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      adminCategoriesTable.innerHTML = data.data.map(cat => `
        <tr>
          <td>${cat.name}</td>
          <td>
            <button class="admin-btn small danger" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } else {
      adminCategoriesTable.innerHTML = `<tr><td colspan="2" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

adminSidebarLinks.forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    adminSidebarLinks.forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    adminTabs.forEach(tab => tab.classList.remove('active'));
    const section = this.dataset.section;
    const targetTab = document.getElementById(`tab-${section}`);
    if (targetTab) targetTab.classList.add('active');
  });
});

// ==========================================
// CATEGORY FORM
// ==========================================

if (adminCategoryForm) {
  adminCategoryForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;
    
    const name = categoryName.value.trim();
    if (!name) {
      showError('Category name is required');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      
      const result = await response.json();
      
      if (result.success) {
        categoryName.value = '';
        showSuccess('Category added successfully');
        loadAdminCategories();
      } else {
        showError(result.message || 'Failed to add category');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      showError('Network error. Please try again.');
    }
  });
}

// ==========================================
// SETTINGS FORM
// ==========================================

if (adminSettingsForm) {
  adminSettingsForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;
    
    const settingsData = {
      websiteName: settingsWebsiteName.value.trim(),
      supportEmail: settingsSupportEmail.value.trim()
    };
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        showSuccess('Settings updated successfully');
      } else {
        showError(result.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showError('Network error. Please try again.');
    }
  });
}

// ==========================================
// NOTIFICATION FORM
// ==========================================

if (adminNotificationForm) {
  adminNotificationForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;
    
    const notificationData = {
      title: notificationTitle.value.trim(),
      message: notificationMessage.value.trim(),
      target: 'all'
    };
    
    if (!notificationData.title || !notificationData.message) {
      showError('Please fill in all fields');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notificationData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        notificationTitle.value = '';
        notificationMessage.value = '';
        showSuccess(`Notification sent to ${result.data.totalSent || 0} users`);
      } else {
        showError(result.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      showError('Network error. Please try again.');
    }
  });
}

// ==========================================
// USER ACTIONS
// ==========================================

window.toggleUserStatus = async function(userId) {
  const token = getAdminToken();
  if (!token) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('User status updated');
      loadAdminUsers();
    }
  } catch (error) {
    console.error('Error toggling user:', error);
    showError('Failed to update user');
  }
};

// ==========================================
// PRODUCT ACTIONS
// ==========================================

window.toggleProduct = async function(productId) {
  const token = getAdminToken();
  if (!token) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/products/${productId}/toggle`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Product visibility toggled');
      loadAdminProducts();
    }
  } catch (error) {
    console.error('Error toggling product:', error);
    showError('Failed to toggle product');
  }
};

window.deleteProduct = async function(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  const token = getAdminToken();
  if (!token) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Product deleted successfully');
      loadAdminProducts();
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    showError('Failed to delete product');
  }
};

window.deleteCategory = async function(categoryId) {
  if (!confirm('Delete this category?')) return;
  
  const token = getAdminToken();
  if (!token) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Category deleted');
      loadAdminCategories();
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    showError('Failed to delete category');
  }
};

// ==========================================
// SHOW SUCCESS / ERROR
// ==========================================

function showSuccess(message) {
  const modal = document.getElementById('successModal');
  const title = document.getElementById('successTitle');
  const desc = document.getElementById('successMessage');
  if (modal && title && desc) {
    title.textContent = 'Success!';
    desc.textContent = message;
    modal.classList.add('active');
    setTimeout(() => modal.classList.remove('active'), 3000);
  } else {
    alert('✅ ' + message);
  }
}

function showError(message) {
  const modal = document.getElementById('errorModal');
  const title = document.getElementById('errorTitle');
  const desc = document.getElementById('errorMessage');
  if (modal && title && desc) {
    title.textContent = 'Error!';
    desc.textContent = message;
    modal.classList.add('active');
  } else {
    alert('❌ ' + message);
  }
}

// ==========================================
// MODAL CLOSE
// ==========================================

document.querySelectorAll('.modal-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const modal = this.closest('.modal');
    if (modal) modal.classList.remove('active');
  });
});

// ==========================================
// INITIALIZE
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('admin-dashboard.html')) {
    if (!checkAdminAuth()) return;
    const adminData = localStorage.getItem('adminData');
    if (adminData && document.getElementById('adminName')) {
      try {
        const user = JSON.parse(adminData);
        document.getElementById('adminName').textContent = user.fullName || 'Admin';
      } catch {}
    }
    loadAdminDashboard();
  }
});

console.log('🛠️ Admin module loaded successfully');
