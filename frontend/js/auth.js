// ==========================================
// AUTHENTICATION JAVASCRIPT
// ==========================================

// ==========================================
// API BASE URL
// ==========================================

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : 'https://pata-link-whatsapp-backend.onrender.com/api';

// ==========================================
// DOM ELEMENTS
// ==========================================

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginSpinner = document.getElementById('loginSpinner');
const loginError = document.getElementById('loginError');
const togglePassword = document.getElementById('togglePassword');
const rememberMe = document.getElementById('rememberMe');

const signupForm = document.getElementById('signupForm');
const signupName = document.getElementById('signupName');
const signupEmail = document.getElementById('signupEmail');
const signupPhone = document.getElementById('signupPhone');
const signupPassword = document.getElementById('signupPassword');
const signupConfirmPassword = document.getElementById('signupConfirmPassword');
const signupBtn = document.getElementById('signupBtn');
const signupBtnText = document.getElementById('signupBtnText');
const signupSpinner = document.getElementById('signupSpinner');
const signupError = document.getElementById('signupError');
const termsCheckbox = document.getElementById('termsCheckbox');
const toggleSignupPassword = document.getElementById('toggleSignupPassword');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

// ==========================================
// TOGGLE PASSWORD VISIBILITY
// ==========================================

if (togglePassword) {
  togglePassword.addEventListener('click', function() {
    const input = document.getElementById('loginPassword');
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

if (toggleSignupPassword) {
  toggleSignupPassword.addEventListener('click', function() {
    const input = document.getElementById('signupPassword');
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

if (toggleConfirmPassword) {
  toggleConfirmPassword.addEventListener('click', function() {
    const input = document.getElementById('signupConfirmPassword');
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
// LOGIN FUNCTION
// ==========================================

if (loginForm) {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    
    loginError.style.display = 'none';
    loginError.textContent = '';
    
    if (!email || !password) {
      loginError.textContent = 'Please fill in all fields';
      loginError.style.display = 'block';
      return;
    }
    
    loginBtn.disabled = true;
    loginBtnText.style.display = 'none';
    loginSpinner.style.display = 'inline-block';
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('userData', JSON.stringify(data.data.user));
        
        if (rememberMe && rememberMe.checked) {
          localStorage.setItem('rememberMe', 'true');
        }
        
        if (data.data.user.email === 'dullamanyama0@gmail.com' && data.data.user.isAdmin) {
          window.location.href = 'admin-dashboard.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      } else {
        loginError.textContent = data.message || 'Login failed';
        loginError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtnText.style.display = 'inline';
        loginSpinner.style.display = 'none';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'Network error. Please try again.';
      loginError.style.display = 'block';
      loginBtn.disabled = false;
      loginBtnText.style.display = 'inline';
      loginSpinner.style.display = 'none';
    }
  });
}

// ==========================================
// SIGNUP FUNCTION
// ==========================================

if (signupForm) {
  signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = signupName.value.trim();
    const email = signupEmail.value.trim();
    const phone = signupPhone.value.trim();
    const password = signupPassword.value;
    const confirmPassword = signupConfirmPassword.value;
    
    signupError.style.display = 'none';
    signupError.textContent = '';
    
    if (!fullName || !email || !password || !confirmPassword) {
      signupError.textContent = 'Please fill in all required fields';
      signupError.style.display = 'block';
      return;
    }
    
    if (password !== confirmPassword) {
      signupError.textContent = 'Passwords do not match';
      signupError.style.display = 'block';
      return;
    }
    
    if (password.length < 8) {
      signupError.textContent = 'Password must be at least 8 characters';
      signupError.style.display = 'block';
      return;
    }
    
    if (termsCheckbox && !termsCheckbox.checked) {
      signupError.textContent = 'Please agree to the Terms of Service';
      signupError.style.display = 'block';
      return;
    }
    
    signupBtn.disabled = true;
    signupBtnText.style.display = 'none';
    signupSpinner.style.display = 'inline-block';
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone: phone || null, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('userData', JSON.stringify(data.data.user));
        window.location.href = 'dashboard.html';
      } else {
        signupError.textContent = data.message || 'Signup failed';
        signupError.style.display = 'block';
        signupBtn.disabled = false;
        signupBtnText.style.display = 'inline';
        signupSpinner.style.display = 'none';
      }
    } catch (error) {
      console.error('Signup error:', error);
      signupError.textContent = 'Network error. Please try again.';
      signupError.style.display = 'block';
      signupBtn.disabled = false;
      signupBtnText.style.display = 'inline';
      signupSpinner.style.display = 'none';
    }
  });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function isLoggedIn() {
  return !!localStorage.getItem('authToken');
}

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function getUserData() {
  const data = localStorage.getItem('userData');
  return data ? JSON.parse(data) : null;
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('rememberMe');
  window.location.href = 'index.html';
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    const user = getUserData();
    if (user && user.email === 'dullamanyama0@gmail.com' && user.isAdmin) {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  }
}

window.auth = {
  isLoggedIn,
  getAuthToken,
  getUserData,
  logout,
  requireAuth,
  redirectIfLoggedIn
};

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('login.html')) {
    if (isLoggedIn()) {
      const user = getUserData();
      if (user && user.email === 'dullamanyama0@gmail.com' && user.isAdmin) {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }
  }
  
  if (window.location.pathname.includes('signup.html')) {
    if (isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  }
  
  if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('admin-dashboard.html')) {
    requireAuth();
  }
});

console.log('🔐 Auth module loaded successfully');
