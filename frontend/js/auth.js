/**
 * ShopSecure - Authentication JavaScript
 * Handles login, registration, form interactions, and API communication
 */

// API Configuration
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// DOM Elements
const loginBox = document.getElementById('loginBox');
const registerBox = document.getElementById('registerBox');
const privacyModal = document.getElementById('privacyModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔒 ShopSecure Auth System Loaded');
    
    // Check if user is already logged in
    checkExistingSession();
    
    // Setup password strength checker
    setupPasswordStrength();
    
    // Setup form submissions
    setupFormHandlers();
});

/**
 * Toggle between Login and Register forms
 */
function showRegister() {
    loginBox.classList.add('hidden');
    registerBox.classList.remove('hidden');
    clearAlerts();
}

function showLogin() {
    registerBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
    clearAlerts();
}

/**
 * Password visibility toggle
 */
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
}

/**
 * Password strength checker
 */
function setupPasswordStrength() {
    const passwordInput = document.getElementById('regPassword');
    const strengthIndicator = document.getElementById('passwordStrength');
    
    if (!passwordInput || !strengthIndicator) return;
    
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;
        
        strengthIndicator.className = 'password-strength';
        
        if (password.length === 0) {
            strengthIndicator.style.width = '0';
        } else if (strength <= 1) {
            strengthIndicator.classList.add('weak');
        } else if (strength === 2 || strength === 3) {
            strengthIndicator.classList.add('medium');
        } else {
            strengthIndicator.classList.add('strong');
        }
    });
}

/**
 * Privacy Policy Modal
 */
function showPrivacyPolicy() {
    privacyModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePrivacyPolicy() {
    privacyModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
if (privacyModal) {
    privacyModal.addEventListener('click', function(e) {
        if (e.target === privacyModal) {
            closePrivacyPolicy();
        }
    });
}

/**
 * Setup form submission handlers
 */
function setupFormHandlers() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

/**
 * Handle Login Submission - REAL API
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!email || !password) {
        showAlert('Please fill in all fields', 'error');
        return;
    }
    
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Signing in...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Store session with tokens
        const sessionData = {
            user: data.user,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            timestamp: new Date().toISOString(),
            expiresAt: rememberMe ? null : Date.now() + (24 * 60 * 60 * 1000)
        };
        
        if (rememberMe) {
            localStorage.setItem('shopsecure_session', JSON.stringify(sessionData));
        } else {
            sessionStorage.setItem('shopsecure_session', JSON.stringify(sessionData));
        }
        
        showAlert('Login successful! Redirecting...', 'success');
        
        // Smart redirect
        setTimeout(() => {
            if (data.user.user_type === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'shop.html';
            }
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showAlert(error.message || 'Login failed. Please check your credentials.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Handle Registration Submission - REAL API
 */
async function handleRegister(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const userType = document.querySelector('input[name="userType"]:checked').value;
    const privacyConsent = document.getElementById('privacyConsent').checked;
    
    if (!firstName || !lastName || !email || !phone || !password) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 8) {
        showAlert('Password must be at least 8 characters', 'error');
        return;
    }
    
    if (!privacyConsent) {
        showAlert('You must agree to the Privacy Policy to continue', 'error');
        return;
    }
    
    if (!isValidKenyanPhone(phone)) {
        showAlert('Please enter a valid Kenyan phone number (e.g., 254712345678)', 'error');
        return;
    }
    
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                first_name: firstName,
                last_name: lastName,
                phone,
                user_type: userType
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        showAlert('Account created successfully! Please log in.', 'success');
        
        setTimeout(() => {
            showLogin();
            document.getElementById('loginEmail').value = email;
        }, 2000);
        
    } catch (error) {
        console.error('Registration error:', error);
        showAlert(error.message || 'Registration failed. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Validate Kenyan phone number
 */
function isValidKenyanPhone(phone) {
    const cleanPhone = phone.replace(/[\s-]/g, '');
    const kenyanRegex = /^(254|0)[17]\d{8}$/;
    return kenyanRegex.test(cleanPhone);
}

/**
 * Store user session
 */
function storeSession(user, rememberMe) {
    const sessionData = {
        user: user,
        timestamp: new Date().toISOString(),
        expiresAt: rememberMe ? null : Date.now() + (24 * 60 * 60 * 1000)
    };
    
    if (rememberMe) {
        localStorage.setItem('shopsecure_session', JSON.stringify(sessionData));
    } else {
        sessionStorage.setItem('shopsecure_session', JSON.stringify(sessionData));
    }
}

/**
 * Check for existing session
 */
function checkExistingSession() {
    const session = localStorage.getItem('shopsecure_session') || 
                   sessionStorage.getItem('shopsecure_session');
    
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            
            if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
                clearSession();
                return;
            }
            
            if (window.location.pathname.includes('index.html') || 
                window.location.pathname === '/' ||
                window.location.pathname.endsWith('/frontend/')) {
                console.log('Existing session found, redirecting...');
                setTimeout(() => {
                    if (sessionData.user.user_type === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'shop.html';
                    }
                }, 100);
            }
        } catch (e) {
            clearSession();
        }
    }
}

/**
 * Clear user session
 */
function clearSession() {
    localStorage.removeItem('shopsecure_session');
    sessionStorage.removeItem('shopsecure_session');
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    clearAlerts();
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    
    const formBox = document.querySelector('.form-box:not(.hidden)');
    if (formBox) {
        formBox.insertBefore(alert, formBox.querySelector('h2').nextSibling);
    }
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

/**
 * Clear all alerts
 */
function clearAlerts() {
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
}

// Export functions for global access
window.showRegister = showRegister;
window.showLogin = showLogin;
window.togglePassword = togglePassword;
window.showPrivacyPolicy = showPrivacyPolicy;
window.closePrivacyPolicy = closePrivacyPolicy;