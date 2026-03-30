/**
 * ShopSecure - Shop/Marketplace JavaScript
 * Deployment-ready version
 */

const CONFIGURED_API_BASE =
    window.SHOPSECURE_API_BASE ||
    localStorage.getItem('shopsecure_api_base') ||
    '';

const API_BASE_CANDIDATES = [
    ...(CONFIGURED_API_BASE ? [CONFIGURED_API_BASE] : []),
    'http://127.0.0.1:5000/api',
    'http://localhost:5000/api'
];

let API_BASE_URL = API_BASE_CANDIDATES[0] || 'http://127.0.0.1:5000/api';

// State management
let products = [];
let cart = [];
let currentCategory = 'all';
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 ShopSecure Marketplace Loaded');

    checkAuth();
    await resolveApiBaseUrl();
    await loadProductsFromAPI();
    loadCart();
    syncCartWithProducts();
    updateCartUI();
    updateUserDisplay();
    setupSearch();
});

/**
 * Check if user is authenticated
 */
function checkAuth() {
    const session = localStorage.getItem('shopsecure_session') ||
                   sessionStorage.getItem('shopsecure_session');

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const sessionData = JSON.parse(session);
        currentUser = sessionData.user;

        if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
            logout();
            return;
        }

        logAudit('page_view', 'shop');
    } catch (e) {
        logout();
    }
}

/**
 * Get access token from session
 */
function getAccessToken() {
    const session = localStorage.getItem('shopsecure_session') ||
                   sessionStorage.getItem('shopsecure_session');

    if (!session) {
        return null;
    }

    try {
        const sessionData = JSON.parse(session);
        return sessionData.access_token || null;
    } catch (e) {
        return null;
    }
}

/**
 * Resolve which API base URL is reachable
 */
async function resolveApiBaseUrl() {
    for (const candidate of API_BASE_CANDIDATES) {
        try {
            const response = await fetch(`${candidate}/health`, {
                method: 'GET'
            });

            if (response.ok) {
                API_BASE_URL = candidate;
                localStorage.setItem('shopsecure_api_base', API_BASE_URL);
                console.log(`✅ Using API base URL: ${API_BASE_URL}`);
                return;
            }
        } catch (error) {
            console.warn(`API candidate not reachable: ${candidate}`);
        }
    }

    console.warn('⚠️ No backend health endpoint reachable.');
}

/**
 * Make API request with fallback
 */
async function apiRequest(path, options = {}) {
    const candidates = [API_BASE_URL, ...API_BASE_CANDIDATES.filter(url => url !== API_BASE_URL)];

    let lastError = null;

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${path}`, options);
            API_BASE_URL = baseUrl;
            localStorage.setItem('shopsecure_api_base', API_BASE_URL);
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Request failed for ${baseUrl}${path}:`, error);
        }
    }

    throw lastError || new Error('Unable to connect to backend server');
}

/**
 * Update user display in navbar
 */
function updateUserDisplay() {
    if (currentUser) {
        const displayName =
            currentUser.first_name ||
            currentUser.firstName ||
            currentUser.email.split('@')[0];

        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = `👤 ${displayName}`;
        }
    }
}

/**
 * Load real products from backend API
 */
async function loadProductsFromAPI() {
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.innerHTML = '<div class="spinner"></div>';
    }

    try {
        const response = await apiRequest('/products', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to load products');
        }

        products = Array.isArray(data.products) ? data.products : [];

        if (!products.length) {
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--gray-color);">
                        <div style="font-size: 4rem; margin-bottom: 20px;">📦</div>
                        <h3>No products available</h3>
                        <p>Please add products in the backend/admin first.</p>
                    </div>
                `;
            }
            return;
        }

        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);

        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--gray-color);">
                    <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
                    <h3>Failed to load products</h3>
                    <p>${error.message || 'Could not connect to the backend API.'}</p>
                </div>
            `;
        }

        showNotification('Failed to load products from backend', 'error');
    }
}

/**
 * Render products
 */
function renderProducts(category = currentCategory, searchTerm = '') {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    let filtered = [...products];

    if (category !== 'all') {
        filtered = filtered.filter(product => {
            const productCategory = (product.category || '').toLowerCase();
            return productCategory === category.toLowerCase();
        });
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(product =>
            (product.name || '').toLowerCase().includes(term) ||
            (product.description || '').toLowerCase().includes(term) ||
            (product.category || '').toLowerCase().includes(term)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--gray-color);">
                <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                <h3>No products found</h3>
                <p>Try adjusting your search or category filter</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const productId = product.id;
        const productName = product.name || 'Unnamed Product';
        const productDescription = product.description || 'No description available';
        const productCategory = product.category || 'General';
        const price = Number(product.price || 0);
        const stockQuantity = Number(product.stock_quantity || 0);
        const emoji = getProductEmoji(productCategory);

        return `
            <div class="product-card" data-id="${productId}">
                <div class="product-image">${emoji}</div>
                <div class="product-info">
                    <h3 class="product-title">${productName}</h3>
                    <p class="product-vendor">Category: ${productCategory}</p>
                    <p style="font-size: 0.9rem; color: var(--gray-color); margin-bottom: 10px;">
                        ${productDescription}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--gray-color); margin-bottom: 10px;">
                        Stock: ${stockQuantity}
                    </p>
                    <div class="product-price">KES ${price.toLocaleString()}</div>
                    <button class="btn-add-cart" onclick="addToCart(${productId})" ${stockQuantity < 1 ? 'disabled' : ''}>
                        ${stockQuantity < 1 ? 'Out of Stock' : '🛒 Add to Cart'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Guess emoji from category
 */
function getProductEmoji(category) {
    const cat = (category || '').toLowerCase();

    if (cat.includes('electronic')) return '🎧';
    if (cat.includes('sport')) return '👟';
    if (cat.includes('book')) return '📚';
    if (cat.includes('fashion')) return '👔';
    if (cat.includes('home')) return '🏠';
    if (cat.includes('food')) return '🍽️';
    if (cat.includes('beauty')) return '💄';
    return '📦';
}

/**
 * Filter by category
 */
function filterCategory(category) {
    currentCategory = category;

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    }

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value : '';
    renderProducts(category, searchTerm);

    logAudit('category_filter', category);
}

/**
 * Setup search functionality
 */
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            renderProducts(currentCategory, this.value);
        }, 300);
    });
}

function searchProducts() {
    const searchInput = document.getElementById('searchInput');
    const term = searchInput ? searchInput.value : '';
    renderProducts(currentCategory, term);
    logAudit('search', term);
}

/**
 * Cart Management
 */
function addToCart(productId) {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product) {
        showNotification('Product not found', 'error');
        return;
    }

    const stockQuantity = Number(product.stock_quantity || 0);
    const existingItem = cart.find(item => String(item.id) === String(productId));

    if (existingItem) {
        if (existingItem.quantity >= stockQuantity) {
            showNotification('Cannot add more than available stock', 'warning');
            return;
        }
        existingItem.quantity++;
    } else {
        if (stockQuantity < 1) {
            showNotification('This product is out of stock', 'warning');
            return;
        }

        cart.push({
            id: product.id,
            name: product.name,
            description: product.description || '',
            category: product.category || 'General',
            price: Number(product.price || 0),
            stock_quantity: stockQuantity,
            emoji: getProductEmoji(product.category),
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();
    showNotification(`Added ${product.name} to cart`);
    logAudit('add_to_cart', `product_id:${productId}`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => String(item.id) !== String(productId));
    saveCart();
    updateCartUI();
}

function updateQuantity(productId, change) {
    const item = cart.find(item => String(item.id) === String(productId));
    if (!item) return;

    const product = products.find(p => String(p.id) === String(productId));
    const maxStock = Number(product?.stock_quantity || item.stock_quantity || 0);

    if (change > 0 && item.quantity >= maxStock) {
        showNotification('Cannot add more than available stock', 'warning');
        return;
    }

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        saveCart();
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem('shopsecure_cart', JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem('shopsecure_cart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
        } catch (e) {
            cart = [];
        }
    }
}

/**
 * Remove cart items whose products no longer exist in backend
 */
function syncCartWithProducts() {
    if (!Array.isArray(products) || !products.length) {
        cart = [];
        saveCart();
        return;
    }

    cart = cart.filter(cartItem =>
        products.some(product => String(product.id) === String(cartItem.id))
    );

    cart = cart.map(cartItem => {
        const product = products.find(p => String(p.id) === String(cartItem.id));
        return {
            ...cartItem,
            name: product.name,
            description: product.description || '',
            category: product.category || 'General',
            price: Number(product.price || 0),
            stock_quantity: Number(product.stock_quantity || 0),
            emoji: getProductEmoji(product.category)
        };
    });

    saveCart();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }

    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (!cartItems || !cartTotal) return;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <p style="text-align:center;color:var(--gray-color);padding:40px 0;">
                Your cart is empty.<br>
                Start shopping securely!
            </p>
        `;
        cartTotal.textContent = 'KES 0.00';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-image">${item.emoji}</div>
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">KES ${Number(item.price).toLocaleString()}</div>
                <div class="quantity-control">
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
            <button onclick="removeFromCart(${item.id})" style="background:none;border:none;cursor:pointer;font-size:1.2rem;">🗑️</button>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    cartTotal.textContent = `KES ${total.toLocaleString()}`;
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');

    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
}

/**
 * Checkout Process
 */
function proceedToCheckout() {
    if (cart.length === 0) {
        showNotification('Your cart is empty!', 'error');
        return;
    }

    const summary = document.getElementById('checkoutSummary');
    const total = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

    if (summary) {
        summary.innerHTML = `
            ${cart.map(item => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>${item.emoji} ${item.name} x${item.quantity}</span>
                    <span>KES ${(Number(item.price) * item.quantity).toLocaleString()}</span>
                </div>
            `).join('')}
            <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                <span>Total:</span>
                <span>KES ${total.toLocaleString()}</span>
            </div>
        `;
    }

    const checkoutModal = document.getElementById('checkoutModal');
    const step1 = document.getElementById('checkoutStep1');
    const step2 = document.getElementById('checkoutStep2');
    const step3 = document.getElementById('checkoutStep3');

    if (checkoutModal) checkoutModal.classList.remove('hidden');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (step3) step3.classList.add('hidden');

    logAudit('checkout_initiated', `items:${cart.length},total:${total}`);
}

function closeCheckout() {
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.classList.add('hidden');
    }
}

async function processPayment() {
    const selectedPayment = document.querySelector('input[name="payment"]:checked');

    if (!selectedPayment) {
        showNotification('Please select a payment method', 'error');
        return;
    }

    if (cart.length === 0) {
        showNotification('Your cart is empty!', 'error');
        return;
    }

    const token = getAccessToken();

    if (!token) {
        showNotification('Your session has expired. Please log in again.', 'error');
        logout();
        return;
    }

    const paymentMethod = selectedPayment.value;

    const step1 = document.getElementById('checkoutStep1');
    const step2 = document.getElementById('checkoutStep2');
    const step3 = document.getElementById('checkoutStep3');
    const orderNumberEl = document.getElementById('orderNumber');

    if (step1) step1.classList.add('hidden');
    if (step2) step2.classList.remove('hidden');

    try {
        const healthResponse = await apiRequest('/health', {
            method: 'GET'
        });

        if (!healthResponse.ok) {
            throw new Error('Backend server is not healthy');
        }

        const orderItems = cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity
        }));

        const orderResponse = await apiRequest('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: orderItems,
                payment_method: paymentMethod,
                shipping_address: 'Nairobi, Kenya'
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            throw new Error(orderData.error || orderData.message || 'Failed to create order');
        }

        if (!orderData.order || !orderData.order.order_number) {
            throw new Error('Order created but order number missing');
        }

        const orderNumber = orderData.order.order_number;

        const paymentResponse = await apiRequest(`/orders/${orderNumber}/pay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const paymentData = await paymentResponse.json();

        if (!paymentResponse.ok) {
            throw new Error(paymentData.error || paymentData.message || 'Payment failed');
        }

        if (orderNumberEl) {
            orderNumberEl.textContent = orderNumber;
        }

        cart = [];
        saveCart();
        updateCartUI();

        if (step2) step2.classList.add('hidden');
        if (step3) step3.classList.remove('hidden');

        logAudit('order_completed', `order:${orderNumber},method:${paymentMethod}`);
        showNotification('Payment completed successfully');

    } catch (error) {
        console.error('Checkout error:', error);

        if (step2) step2.classList.add('hidden');
        if (step1) step1.classList.remove('hidden');

        let message = 'Checkout failed. Please try again.';

        if (error instanceof TypeError && String(error.message).toLowerCase().includes('fetch')) {
            message = 'Cannot reach backend server.';
        } else if (error.message) {
            message = error.message;
        }

        showNotification(message, 'error');
    }
}

/**
 * Privacy Settings & Data Control
 */
function showPrivacySettings() {
    const consents = JSON.parse(localStorage.getItem('shopsecure_consents') || '[]');
    const historyDiv = document.getElementById('consentHistory');

    if (!historyDiv) return;

    if (consents.length === 0) {
        historyDiv.innerHTML = '<p>No consent records found.</p>';
    } else {
        historyDiv.innerHTML = consents.slice(-5).map(c => `
            <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
                <div style="font-size: 0.8rem; color: var(--gray-color);">
                    ${new Date(c.timestamp).toLocaleString()}
                </div>
                <div>${c.action.replace(/_/g, ' ').toUpperCase()}</div>
            </div>
        `).join('');
    }

    const modal = document.getElementById('privacySettingsModal');
    if (modal) {
        modal.classList.remove('hidden');
    }

    logAudit('privacy_settings_viewed', '');
}

function closePrivacySettings() {
    const modal = document.getElementById('privacySettingsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function downloadMyData() {
    const userData = {
        profile: currentUser,
        orders: [],
        consents: JSON.parse(localStorage.getItem('shopsecure_consents') || '[]'),
        cart: cart,
        auditLogs: JSON.parse(localStorage.getItem('shopsecure_audit') || '[]'),
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(userData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `shopsecure-my-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Your data export has been downloaded');
    logAudit('data_export_requested', '');
}

function deleteAccount() {
    if (!confirm('WARNING: This will permanently delete your account and all data. This action cannot be undone. Are you sure?')) {
        return;
    }

    if (!confirm('FINAL CONFIRMATION: Type DELETE to confirm account deletion')) {
        return;
    }

    localStorage.removeItem('shopsecure_session');
    localStorage.removeItem('shopsecure_cart');
    localStorage.removeItem('shopsecure_orders');
    localStorage.removeItem('shopsecure_consents');
    localStorage.removeItem('shopsecure_audit');
    sessionStorage.removeItem('shopsecure_session');

    showNotification('Account deletion requested. You will be logged out.', 'warning');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 3000);

    logAudit('account_deletion_requested', '');
}

function logAudit(action, details) {
    const logs = JSON.parse(localStorage.getItem('shopsecure_audit') || '[]');
    logs.push({
        timestamp: new Date().toISOString(),
        user: currentUser ? currentUser.email : 'anonymous',
        action: action,
        details: details,
        ip: 'client-side',
        userAgent: navigator.userAgent
    });

    if (logs.length > 100) {
        logs.shift();
    }

    localStorage.setItem('shopsecure_audit', JSON.stringify(logs));
    console.log(`Audit: ${action} - ${details}`);
}

function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745'};
        color: ${type === 'warning' ? '#000' : '#fff'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notif.textContent = message;

    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function becomeVendor() {
    showNotification('Vendor registration coming soon! Contact support@shopsecure.co.ke', 'warning');
}

function logout() {
    localStorage.removeItem('shopsecure_session');
    sessionStorage.removeItem('shopsecure_session');
    window.location.href = 'index.html';
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.filterCategory = filterCategory;
window.searchProducts = searchProducts;
window.proceedToCheckout = proceedToCheckout;
window.closeCheckout = closeCheckout;
window.processPayment = processPayment;
window.showPrivacySettings = showPrivacySettings;
window.closePrivacySettings = closePrivacySettings;
window.downloadMyData = downloadMyData;
window.deleteAccount = deleteAccount;
window.becomeVendor = becomeVendor;
window.logout = logout;