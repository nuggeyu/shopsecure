/**
 * ShopSecure - Orders JavaScript
 * Deployment-ready version
 */

let currentUser = null;

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

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📦 ShopSecure Orders System Loaded');

    checkAuth();
    await resolveApiBaseUrl();
    loadOrdersFromAPI();
    updateCartCount();
    updateUserDisplay();
});

function getSessionData() {
    const localSession = localStorage.getItem('shopsecure_session');
    const sessionSession = sessionStorage.getItem('shopsecure_session');
    const rawSession = localSession || sessionSession;

    if (!rawSession) return null;

    try {
        return JSON.parse(rawSession);
    } catch (error) {
        return null;
    }
}

async function resolveApiBaseUrl() {
    for (const candidate of API_BASE_CANDIDATES) {
        try {
            const response = await fetch(`${candidate}/health`, { method: 'GET' });
            if (response.ok) {
                API_BASE_URL = candidate;
                localStorage.setItem('shopsecure_api_base', API_BASE_URL);
                return;
            }
        } catch (error) {
            console.warn(`Orders API candidate not reachable: ${candidate}`);
        }
    }
}

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
 * Check if user is authenticated
 */
function checkAuth() {
    const sessionData = getSessionData();

    if (!sessionData) {
        window.location.href = 'index.html';
        return;
    }

    try {
        currentUser = sessionData.user;

        if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
            logout();
            return;
        }

        logAudit('page_view', 'orders');
    } catch (e) {
        logout();
    }
}

/**
 * Update user display in navbar
 */
function updateUserDisplay() {
    if (currentUser) {
        const displayName = currentUser.first_name || currentUser.email.split('@')[0];
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = `👤 ${displayName}`;
        }
    }
}

/**
 * Update cart count in navbar
 */
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('shopsecure_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = count;
    }
}

/**
 * Load orders from backend API
 */
async function loadOrdersFromAPI() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;

    ordersList.innerHTML = '<div class="spinner"></div>';

    try {
        const sessionData = getSessionData();
        const token = sessionData?.access_token;

        const response = await apiRequest('/orders', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }

        const data = await response.json();
        const orders = data.orders || [];
        displayOrders(orders);

    } catch (error) {
        console.error('Error loading orders:', error);
        displayOrders([]);
    }
}

/**
 * Display orders
 */
function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-orders" style="
                text-align: center;
                padding: 80px 20px;
                color: var(--gray-color);
            ">
                <div style="font-size: 5rem; margin-bottom: 20px;">📦</div>
                <h2 style="color: var(--dark-color); margin-bottom: 10px;">No Orders Yet</h2>
                <p style="margin-bottom: 25px;">Welcome! You haven't placed any orders yet.<br>Start shopping to see your orders here.</p>
                <a href="shop.html" class="btn btn-primary" style="
                    display: inline-block;
                    padding: 12px 30px;
                    background: var(--primary-color);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                ">
                    🛒 Start Shopping
                </a>
            </div>
        `;
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const statusClass = `status-${order.status}`;
        const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);

        const paymentIcon = order.payment_method === 'mpesa' ? '📱 M-Pesa' :
                           order.payment_method === 'card' ? '💳 Card' : '🏦 Bank Transfer';

        const items = order.items || [];

        return `
            <div class="order-card" style="
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                overflow: hidden;
            ">
                <div class="order-header" style="
                    background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
                    color: white;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 15px;
                ">
                    <div>
                        <div style="font-size: 1.2rem; font-weight: bold;">Order ${order.order_number}</div>
                        <div style="opacity: 0.9; font-size: 0.9rem;">${formattedDate} • ${paymentIcon}</div>
                    </div>
                    <span class="${statusClass}" style="
                        padding: 6px 15px;
                        border-radius: 20px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        text-transform: uppercase;
                    ">${statusText}</span>
                </div>

                <div style="padding: 20px;">
                    <div style="margin-bottom: 20px;">
                        ${items.map(item => `
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 15px;
                                padding: 15px;
                                border-bottom: 1px solid #eee;
                            ">
                                <div style="
                                    width: 60px;
                                    height: 60px;
                                    background: linear-gradient(135deg, var(--primary-light), var(--secondary-color));
                                    border-radius: 8px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 1.5rem;
                                ">${item.product_name ? item.product_name.charAt(0) : '📦'}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 5px;">${item.product_name || 'Product'}</div>
                                    <div style="font-size: 0.9rem; color: var(--gray-color);">
                                        Qty: ${item.quantity}
                                    </div>
                                </div>
                                <div style="font-weight: bold; color: var(--primary-color);">
                                    KES ${(item.unit_price * item.quantity).toLocaleString()}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="
                    background: #f8f9fa;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 15px;
                ">
                    <div style="font-size: 1.2rem;">
                        <span style="color: var(--gray-color);">Total:</span>
                        <strong>KES ${order.total_amount.toLocaleString()}</strong>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="trackOrder('${order.order_number}')" style="
                            padding: 8px 20px;
                            background: transparent;
                            border: 2px solid var(--primary-color);
                            color: var(--primary-color);
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 600;
                        ">
                            📍 Track
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Track order
 */
async function trackOrder(orderNumber) {
    try {
        const sessionData = getSessionData();
        const token = sessionData?.access_token;

        const response = await apiRequest(`/orders/${orderNumber}/track`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tracking');
        }

        const data = await response.json();

        const trackOrderNumber = document.getElementById('trackOrderNumber');
        if (trackOrderNumber) {
            trackOrderNumber.textContent = `Tracking: ${orderNumber}`;
        }

        const timeline = document.getElementById('trackingTimeline');
        if (!timeline) return;

        if (!data.timeline || data.timeline.length === 0) {
            timeline.innerHTML = '<p style="text-align: center; color: var(--gray-color);">Tracking information not available yet.</p>';
        } else {
            timeline.innerHTML = data.timeline.map((step, index) => {
                const stepDate = step.date ? new Date(step.date).toLocaleString('en-KE', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Pending';

                const dotClass = step.completed ?
                    'completed' :
                    (index === data.timeline.findIndex(s => !s.completed)) ? 'active' : '';

                const icon = step.completed ? '✓' :
                    (dotClass === 'active') ? '⟳' : '○';

                return `
                    <div class="timeline-item" style="
                        display: flex;
                        gap: 15px;
                        margin-bottom: 20px;
                        position: relative;
                    ">
                        <div class="${dotClass}" style="
                            width: 30px;
                            height: 30px;
                            border-radius: 50%;
                            background: ${step.completed ? 'var(--success-color)' : dotClass === 'active' ? 'var(--primary-color)' : '#ddd'};
                            color: ${step.completed || dotClass === 'active' ? 'white' : '#666'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 0.9rem;
                            z-index: 1;
                        ">${icon}</div>
                        <div>
                            <h4 style="margin-bottom: 5px;">${step.status}</h4>
                            <p style="font-size: 0.85rem; color: var(--gray-color);">${stepDate}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('trackModal')?.classList.remove('hidden');
        logAudit('track_order', orderNumber);

    } catch (error) {
        console.error('Tracking error:', error);
        showNotification('Failed to load tracking information', 'error');
    }
}

function closeTrackModal() {
    document.getElementById('trackModal')?.classList.add('hidden');
}

function showPrivacySettings() {
    document.getElementById('privacySettingsModal')?.classList.remove('hidden');
    logAudit('privacy_settings_viewed', 'from_orders');
}

function closePrivacySettings() {
    document.getElementById('privacySettingsModal')?.classList.add('hidden');
}

function downloadMyData() {
    const userData = {
        profile: currentUser,
        orders: [],
        consents: JSON.parse(localStorage.getItem('shopsecure_consents') || '[]'),
        cart: JSON.parse(localStorage.getItem('shopsecure_cart') || '[]'),
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
    logAudit('data_export_requested', 'from_orders');
}

function deleteAccount() {
    if (!confirm('WARNING: This will permanently delete your account and all data. This action cannot be undone. Are you sure?')) {
        return;
    }

    if (!confirm('FINAL CONFIRMATION: This is irreversible. Click OK to proceed.')) {
        return;
    }

    localStorage.removeItem('shopsecure_session');
    localStorage.removeItem('shopsecure_cart');
    localStorage.removeItem('shopsecure_consents');
    sessionStorage.removeItem('shopsecure_session');

    showNotification('Account deletion requested. Logging out...', 'warning');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 3000);

    logAudit('account_deletion_requested', 'from_orders');
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

window.trackOrder = trackOrder;
window.closeTrackModal = closeTrackModal;
window.showPrivacySettings = showPrivacySettings;
window.closePrivacySettings = closePrivacySettings;
window.downloadMyData = downloadMyData;
window.deleteAccount = deleteAccount;
window.becomeVendor = becomeVendor;
window.logout = logout;