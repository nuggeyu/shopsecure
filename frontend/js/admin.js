/**
 * ShopSecure - Admin Dashboard JavaScript
 * Deployment-ready version
 */

let currentAdmin = null;
let currentTab = 'overview';

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

/**
 * Initialize
 */
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🔐 ShopSecure Admin Dashboard Loaded');

    checkAdminAuth();
    await resolveApiBaseUrl();

    loadUsers();
    loadAuditLogs();
    updateStats();
    setupFilters();
});

/**
 * Session helpers
 */
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

function getToken() {
    const sessionData = getSessionData();
    if (!sessionData) return null;
    return sessionData.access_token || null;
}

/**
 * Resolve working API base
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
                console.log(`✅ Admin using API base: ${API_BASE_URL}`);
                return;
            }
        } catch (error) {
            console.warn(`Admin API candidate not reachable: ${candidate}`);
        }
    }

    console.warn('⚠️ No admin API health endpoint reachable');
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
 * Check admin authentication
 */
function checkAdminAuth() {
    const sessionData = getSessionData();

    if (!sessionData) {
        window.location.href = 'index.html';
        return;
    }

    try {
        currentAdmin = sessionData.user;

        if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
            showNotification('Session expired. Please log in again.', 'error');
            logout();
            return;
        }

        if (!currentAdmin || currentAdmin.user_type !== 'admin') {
            alert('Unauthorized: Admin access only');
            window.location.href = 'shop.html';
            return;
        }

        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) {
            adminNameEl.textContent = `👤 ${currentAdmin.first_name || currentAdmin.email || 'Admin'}`;
        }

        console.log('Admin access granted:', currentAdmin.email);
    } catch (error) {
        console.error('Auth error:', error);
        logout();
    }
}

/**
 * Tab switching
 */
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    }

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    currentTab = tabName;

    if (tabName === 'users') loadUsers();
    if (tabName === 'audit') loadAuditLogs();
    if (tabName === 'products') loadProducts();

    logAudit('tab_switch', tabName);
}

/**
 * Load and display users
 */
function loadUsers(searchTerm = '', filterType = 'all') {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const mockUsers = [
        { id: 1, name: 'John Kamau', email: 'john@email.com', type: 'customer', status: 'active', joined: '2026-01-15' },
        { id: 2, name: 'Mary Wanjiku', email: 'mary@email.com', type: 'vendor', status: 'active', joined: '2026-02-03' },
        { id: 3, name: 'Peter Ochieng', email: 'peter@email.com', type: 'customer', status: 'suspended', joined: '2025-12-20' },
        { id: 4, name: 'Alice Njeri', email: 'alice@email.com', type: 'customer', status: 'active', joined: '2026-03-10' },
        { id: 5, name: 'TechHub Kenya', email: 'info@techhub.co.ke', type: 'vendor', status: 'active', joined: '2025-11-08' },
        { id: 6, name: 'Bob Otieno', email: 'bob@email.com', type: 'customer', status: 'pending', joined: '2026-03-25' }
    ];

    let filtered = mockUsers;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(user =>
            user.name.toLowerCase().includes(term) ||
            user.email.toLowerCase().includes(term)
        );
    }

    if (filterType !== 'all') {
        filtered = filtered.filter(user => user.type === filterType);
    }

    tbody.innerHTML = filtered.map(user => {
        const statusClass = `badge-${user.status}`;
        const typeIcon = user.type === 'admin' ? '👑' :
            user.type === 'vendor' ? '🏪' : '👤';

        return `
            <tr>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>${typeIcon} ${user.type.charAt(0).toUpperCase() + user.type.slice(1)}</td>
                <td><span class="status-badge ${statusClass}">${user.status}</span></td>
                <td>${new Date(user.joined).toLocaleDateString('en-KE')}</td>
                <td class="action-btns">
                    <button class="btn-icon btn-view" onclick="viewUser(${user.id})" title="View">👁</button>
                    <button class="btn-icon btn-edit" onclick="editUser(${user.id})" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete" onclick="deleteUser(${user.id})" title="Delete">🗑</button>
                </td>
            </tr>
        `;
    }).join('');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">No users found</td></tr>';
    }
}

/**
 * Load products from backend for restocking
 */
async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Loading products...</td></tr>';

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

        const products = Array.isArray(data.products) ? data.products : [];

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">No products found</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr>
                <td><strong>${product.name || 'Unnamed Product'}</strong></td>
                <td>${product.category || 'General'}</td>
                <td>KES ${Number(product.price || 0).toLocaleString()}</td>
                <td id="stock-${product.id}">${Number(product.stock_quantity || 0)}</td>
                <td>
                    <input
                        type="number"
                        min="1"
                        id="restock-${product.id}"
                        class="restock-input"
                        placeholder="Qty"
                    >
                </td>
                <td>
                    <button class="btn btn-primary" onclick="restockProduct(${product.id})">
                        Restock
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading products:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;">Failed to load products</td></tr>`;
        showNotification(error.message || 'Failed to load products', 'error');
    }
}

/**
 * Restock product through backend API
 */
async function restockProduct(productId) {
    const token = getToken();

    if (!token) {
        showNotification('You are not logged in. Please log in again.', 'error');
        logout();
        return;
    }

    const input = document.getElementById(`restock-${productId}`);
    const stockCell = document.getElementById(`stock-${productId}`);

    if (!input || !stockCell) {
        showNotification('Unable to find product stock fields', 'error');
        return;
    }

    const addQuantity = parseInt(input.value, 10);
    const currentStock = parseInt(stockCell.textContent, 10) || 0;

    if (!addQuantity || addQuantity <= 0) {
        showNotification('Enter a valid quantity to restock', 'warning');
        return;
    }

    const newStock = currentStock + addQuantity;

    try {
        const response = await apiRequest(`/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stock_quantity: newStock
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            showNotification('Invalid or expired session. Please log in again as admin.', 'error');
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to restock product');
        }

        stockCell.textContent = String(newStock);
        input.value = '';

        showNotification('Product restocked successfully', 'success');
        logAudit('product_restocked', `product_id:${productId},new_stock:${newStock}`);

    } catch (error) {
        console.error('Restock error:', error);
        showNotification(error.message || 'Failed to restock product', 'error');
    }
}

/**
 * Setup filters
 */
function setupFilters() {
    const userSearch = document.getElementById('userSearch');
    const userFilter = document.getElementById('userFilter');

    if (userSearch) {
        userSearch.addEventListener('input', function () {
            loadUsers(this.value, userFilter ? userFilter.value : 'all');
        });
    }

    if (userFilter) {
        userFilter.addEventListener('change', function () {
            loadUsers(userSearch ? userSearch.value : '', this.value);
        });
    }

    const auditFilter = document.getElementById('auditFilter');
    if (auditFilter) {
        auditFilter.addEventListener('change', function () {
            loadAuditLogs(this.value);
        });
    }
}

/**
 * User actions
 */
function viewUser(userId) {
    showNotification(`Viewing user ${userId} details`, 'info');
    logAudit('user_view', `user_id:${userId}`);
}

function editUser(userId) {
    showNotification(`Editing user ${userId}`, 'warning');
    logAudit('user_edit', `user_id:${userId}`);
}

function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }

    if (!confirm('This will permanently delete all user data. Confirm?')) {
        return;
    }

    showNotification(`User ${userId} deleted`, 'error');
    logAudit('user_delete', `user_id:${userId}`);

    setTimeout(() => loadUsers(), 500);
}

/**
 * Load and display audit logs
 */
function loadAuditLogs(filter = 'all') {
    const container = document.getElementById('auditLogContainer');
    if (!container) return;

    let logs = JSON.parse(localStorage.getItem('shopsecure_audit') || '[]');

    if (logs.length === 0) {
        logs = generateMockAuditLogs();
        localStorage.setItem('shopsecure_audit', JSON.stringify(logs));
    }

    if (filter !== 'all') {
        logs = logs.filter(log => String(log.action || '').includes(filter) || String(log.details || '').includes(filter));
    }

    const displayLogs = logs.slice(-50).reverse();

    container.innerHTML = displayLogs.map(log => {
        const time = new Date(log.timestamp).toLocaleString('en-KE');
        const actionColor = log.action.includes('delete') ? '#ff6b6b' :
            log.action.includes('login') ? '#4ecdc4' :
            log.action.includes('payment') ? '#ffe66d' : '#95e1d3';

        return `
            <div class="audit-entry">
                <span class="audit-time">[${time}]</span>
                <span class="audit-action" style="color: ${actionColor}">${String(log.action).toUpperCase()}</span>
                <span style="color: #aaa;">|</span>
                <span style="color: #fff;">${log.user}</span>
                <span style="color: #888;">→ ${log.details || 'N/A'}</span>
            </div>
        `;
    }).join('');

    if (displayLogs.length === 0) {
        container.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">No audit logs found</div>';
    }
}

function generateMockAuditLogs() {
    const actions = [
        { action: 'login', details: 'successful_auth', user: 'john@email.com' },
        { action: 'add_to_cart', details: 'product_id:1', user: 'mary@email.com' },
        { action: 'checkout_initiated', details: 'items:3,total:4500', user: 'peter@email.com' },
        { action: 'order_completed', details: 'order:SS-123456', user: 'alice@email.com' },
        { action: 'privacy_settings_viewed', details: '', user: 'bob@email.com' },
        { action: 'data_export_requested', details: '', user: 'carol@email.com' }
    ];

    const logs = [];
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        logs.push({
            timestamp: new Date(now - (i * 3600000)).toISOString(),
            user: randomAction.user,
            action: randomAction.action,
            details: randomAction.details,
            ip: '192.168.1.' + Math.floor(Math.random() * 255),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        });
    }

    return logs;
}

function processDataRequest(requestId) {
    showNotification(`Processing ${requestId}...`, 'info');

    setTimeout(() => {
        showNotification(`${requestId} completed successfully`, 'success');
        logAudit('data_request_processed', requestId);

        if (typeof event !== 'undefined' && event.target) {
            event.target.textContent = 'Completed';
            event.target.disabled = true;
            event.target.classList.remove('btn-primary');
            event.target.classList.add('btn-outline');
        }
    }, 2000);
}

function exportAuditLogs() {
    const logs = JSON.parse(localStorage.getItem('shopsecure_audit') || '[]');

    const csvContent = [
        ['Timestamp', 'User', 'Action', 'Details', 'IP', 'User Agent'].join(','),
        ...logs.map(log => [
            log.timestamp,
            `"${log.user}"`,
            log.action,
            `"${log.details}"`,
            log.ip,
            `"${log.userAgent}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `shopsecure-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Audit logs exported');
    logAudit('audit_export', `records:${logs.length}`);
}

function updateStats() {
    const stats = {
        users: 1247 + Math.floor(Math.random() * 10),
        orders: 3892 + Math.floor(Math.random() * 5),
        privacyRequests: 12,
        activeUsers: 37,
        ordersToday: 14
    };

    const totalUsers = document.getElementById('totalUsers');
    const totalOrders = document.getElementById('totalOrders');
    const privacyRequests = document.getElementById('privacyRequests');
    const activeUsers = document.getElementById('activeUsers');
    const ordersToday = document.getElementById('ordersToday');

    if (totalUsers) totalUsers.textContent = stats.users.toLocaleString();
    if (totalOrders) totalOrders.textContent = stats.orders.toLocaleString();
    if (privacyRequests) privacyRequests.textContent = stats.privacyRequests;
    if (activeUsers) activeUsers.textContent = stats.activeUsers.toLocaleString();
    if (ordersToday) ordersToday.textContent = stats.ordersToday.toLocaleString();
}

function logAudit(action, details) {
    const logs = JSON.parse(localStorage.getItem('shopsecure_audit') || '[]');
    logs.push({
        timestamp: new Date().toISOString(),
        user: currentAdmin ? currentAdmin.email : 'admin',
        action: action,
        details: details,
        ip: 'admin-console',
        userAgent: navigator.userAgent
    });

    if (logs.length > 100) logs.shift();
    localStorage.setItem('shopsecure_audit', JSON.stringify(logs));
}

function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${
            type === 'error' ? '#dc3545' :
            type === 'warning' ? '#ffc107' :
            type === 'info' ? '#17a2b8' : '#28a745'
        };
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

window.showTab = showTab;
window.viewUser = viewUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.processDataRequest = processDataRequest;
window.exportAuditLogs = exportAuditLogs;
window.restockProduct = restockProduct;
window.logout = logout;