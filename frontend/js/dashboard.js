// ==========================================
// DASHBOARD JAVASCRIPT
// ==========================================

// ==========================================
// DOM ELEMENTS
// ==========================================

const sidebar = document.getElementById('dashboardSidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarClose = document.getElementById('sidebarClose');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const welcomeName = document.getElementById('welcomeName');
const profileAvatar = document.getElementById('profileAvatar');

const statOrders = document.getElementById('statOrders');
const statCompleted = document.getElementById('statCompleted');
const statSpent = document.getElementById('statSpent');
const statLinks = document.getElementById('statLinks');

const profileForm = document.getElementById('profileForm');
const profileFullName = document.getElementById('profileFullName');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileBio = document.getElementById('profileBio');

const ordersBody = document.getElementById('ordersBody');
const recentOrdersBody = document.getElementById('recentOrdersBody');
const paymentsBody = document.getElementById('paymentsBody');
const linksGrid = document.getElementById('linksGrid');

const notificationsList = document.getElementById('notificationsList');
const notificationDot = document.getElementById('notificationDot');
const markAllRead = document.getElementById('markAllRead');

const changePasswordForm = document.getElementById('changePasswordForm');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const supportForm = document.getElementById('supportForm');

// ==========================================
// API BASE URL
// ==========================================

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : 'https://pata-link-whatsapp-backend.onrender.com/api';

// ==========================================
// SIDEBAR TOGGLE
// ==========================================

if (menuToggle) {
  menuToggle.addEventListener('click', function() {
    sidebar.classList.add('open');
    if (!document.querySelector('.sidebar-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay active';
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('open');
        this.remove();
      });
      document.body.appendChild(overlay);
    }
  });
}

if (sidebarClose) {
  sidebarClose.addEventListener('click', function() {
    sidebar.classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.remove();
  });
}

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    const section = this.getAttribute('data-section');
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) targetSection.classList.add('active');
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      const overlay = document.querySelector('.sidebar-overlay');
      if (overlay) overlay.remove();
    }
  });
});

// ==========================================
// LOAD DASHBOARD DATA
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  if (!window.auth || !window.auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  loadUserData();
  loadDashboardStats();
  loadRecentOrders();
  loadOrders();
  loadPayments();
  loadPurchasedLinks();
  loadNotifications();
});

// ==========================================
// LOAD USER DATA
// ==========================================

function loadUserData() {
  const userData = window.auth.getUserData();
  if (!userData) return;
  
  if (userName) userName.textContent = userData.fullName || userData.displayName || 'User';
  if (welcomeName) welcomeName.textContent = userData.fullName || userData.displayName || 'User';
  if (profileFullName) profileFullName.value = userData.fullName || '';
  if (profileDisplayName) profileDisplayName.value = userData.displayName || '';
  if (profileEmail) profileEmail.value = userData.email || '';
  if (profilePhone) profilePhone.value = userData.phone || '';
  if (profileBio) profileBio.value = userData.bio || '';
  if (userData.photoURL) {
    if (userAvatar) userAvatar.src = userData.photoURL;
    if (profileAvatar) profileAvatar.src = userData.photoURL;
  }
}

// ==========================================
// LOAD DASHBOARD STATS
// ==========================================

async function loadDashboardStats() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      const stats = data.data;
      if (statOrders) statOrders.textContent = stats.totalOrders || 0;
      if (statCompleted) statCompleted.textContent = stats.completedOrders || 0;
      if (statSpent) statSpent.textContent = `TSh ${(stats.totalSpent || 0).toLocaleString()}`;
      if (statLinks) statLinks.textContent = stats.totalPurchases || 0;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ==========================================
// LOAD RECENT ORDERS
// ==========================================

async function loadRecentOrders() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/orders?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.orders && data.data.orders.length > 0) {
      const orders = data.data.orders.slice(0, 5);
      recentOrdersBody.innerHTML = orders.map(order => `
        <tr>
          <td>${order.orderId || 'N/A'}</td>
          <td>${order.productTitle || 'Unknown'}</td>
          <td>TSh ${(order.amount || 0).toLocaleString()}</td>
          <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
          <td>${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      recentOrdersBody.innerHTML = `<tr><td colspan="5" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading recent orders:', error);
  }
}

// ==========================================
// LOAD ORDERS
// ==========================================

async function loadOrders() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.orders && data.data.orders.length > 0) {
      ordersBody.innerHTML = data.data.orders.map(order => `
        <tr>
          <td>${order.orderId || 'N/A'}</td>
          <td>${order.productTitle || 'Unknown'}</td>
          <td>TSh ${(order.amount || 0).toLocaleString()}</td>
          <td><span class="status-badge ${order.status}">${order.status || 'pending'}</span></td>
          <td>${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      ordersBody.innerHTML = `<tr><td colspan="5" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading orders:', error);
  }
}

// ==========================================
// LOAD PAYMENTS
// ==========================================

async function loadPayments() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/payments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.payments && data.data.payments.length > 0) {
      paymentsBody.innerHTML = data.data.payments.map(payment => `
        <tr>
          <td>${payment.paymentId || 'N/A'}</td>
          <td>${payment.productTitle || 'Unknown'}</td>
          <td>TSh ${(payment.amount || 0).toLocaleString()}</td>
          <td><span class="status-badge ${payment.status}">${payment.status || 'pending'}</span></td>
          <td>${payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      paymentsBody.innerHTML = `<tr><td colspan="5" class="text-center">Hakuna taarifa kwa sasa.</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading payments:', error);
  }
}

// ==========================================
// LOAD PURCHASED LINKS
// ==========================================

async function loadPurchasedLinks() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/links`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.links && data.data.links.length > 0) {
      linksGrid.innerHTML = data.data.links.map(link => `
        <div class="link-card">
          <h3 class="link-card-title">${link.productTitle}</h3>
          <div class="link-card-meta">
            <span>Purchased: ${link.purchasedAt ? new Date(link.purchasedAt).toLocaleDateString() : 'N/A'}</span>
            ${link.amount > 0 ? `<span> | TSh ${link.amount.toLocaleString()}</span>` : ''}
          </div>
          <a href="${link.whatsappLink}" target="_blank" class="link-card-btn">
            <i class="fab fa-whatsapp"></i> Join Group
          </a>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading purchased links:', error);
  }
}

// ==========================================
// LOAD NOTIFICATIONS
// ==========================================

async function loadNotifications() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.notifications && data.data.notifications.length > 0) {
      const notifications = data.data.notifications;
      let unreadCount = 0;
      
      notificationsList.innerHTML = notifications.map(notif => {
        if (!notif.isRead) unreadCount++;
        return `
          <div class="notification-item ${!notif.isRead ? 'unread' : ''}" data-id="${notif.id}">
            <div class="notification-icon ${notif.type || 'info'}">
              <i class="fas ${getNotificationIcon(notif.type)}"></i>
            </div>
            <div class="notification-content">
              <h4>${notif.title}</h4>
              <p>${notif.message}</p>
              <span class="notification-time">${notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        `;
      }).join('');
      
      if (notificationDot) {
        notificationDot.classList.toggle('active', unreadCount > 0);
      }
      
      document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          markNotificationRead(id);
        });
      });
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

// ==========================================
// MARK NOTIFICATION READ
// ==========================================

async function markNotificationRead(id) {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    await fetch(`${API_BASE_URL}/users/notifications/${id}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    loadNotifications();
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
}

// ==========================================
// MARK ALL READ
// ==========================================

if (markAllRead) {
  markAllRead.addEventListener('click', async function() {
    try {
      const token = window.auth.getAuthToken();
      if (!token) return;
      
      await fetch(`${API_BASE_URL}/users/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      loadNotifications();
      showSuccess('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  });
}

// ==========================================
// PROFILE UPDATE
// ==========================================

if (profileForm) {
  profileForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const data = {
      fullName: profileFullName.value.trim(),
      displayName: profileDisplayName.value.trim(),
      phone: profilePhone.value.trim(),
      bio: profileBio.value.trim()
    };
    
    try {
      const token = window.auth.getAuthToken();
      if (!token) return;
      
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        const userData = window.auth.getUserData();
        if (userData) {
          const updatedUser = { ...userData, ...data };
          localStorage.setItem('userData', JSON.stringify(updatedUser));
        }
        showSuccess('Profile updated successfully');
        loadUserData();
      } else {
        showError('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Network error. Please try again.');
    }
  });
}

// ==========================================
// CHANGE PASSWORD
// ==========================================

if (changePasswordForm) {
  changePasswordForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword !== confirmNewPassword) {
      showError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      showError('New password must be at least 8 characters');
      return;
    }
    
    try {
      const token = window.auth.getAuthToken();
      if (!token) return;
      
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showSuccess('Password changed successfully');
        changePasswordForm.reset();
      } else {
        showError('Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showError('Network error. Please try again.');
    }
  });
}

// ==========================================
// DELETE ACCOUNT
// ==========================================

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      if (confirm('All your data will be permanently deleted. Are you absolutely sure?')) {
        deleteAccount();
      }
    }
  });
}

async function deleteAccount() {
  try {
    const token = window.auth.getAuthToken();
    if (!token) return;
    
    const response = await fetch(`${API_BASE_URL}/users/account`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      window.auth.logout();
      window.location.href = 'index.html';
    } else {
      showError('Failed to delete account');
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    showError('Network error. Please try again.');
  }
}

// ==========================================
// SUPPORT FORM
// ==========================================

if (supportForm) {
  supportForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const subject = document.getElementById('supportSubject').value.trim();
    const message = document.getElementById('supportMessage').value.trim();
    
    if (!subject || !message) {
      showError('Please fill in all fields');
      return;
    }
    
    try {
      const token = window.auth.getAuthToken();
      if (!token) return;
      
      const response = await fetch(`${API_BASE_URL}/users/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subject, message })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showSuccess('Support request sent successfully');
        supportForm.reset();
      } else {
        showError('Failed to send support request');
      }
    } catch (error) {
      console.error('Error sending support request:', error);
      showError('Network error. Please try again.');
    }
  });
}

// ==========================================
// LOGOUT
// ==========================================

if (logoutBtn) {
  logoutBtn.addEventListener('click', function() {
    window.auth.logout();
  });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getNotificationIcon(type) {
  const icons = {
    info: 'fa-info-circle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    error: 'fa-times-circle'
  };
  return icons[type] || 'fa-bell';
}

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

document.querySelectorAll('.modal-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const modal = this.closest('.modal');
    if (modal) modal.classList.remove('active');
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
  });
});

console.log('📊 Dashboard module loaded successfully');
