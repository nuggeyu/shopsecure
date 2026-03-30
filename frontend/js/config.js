/**
 * ShopSecure - API Configuration
 */

const API_CONFIG = {
    // Change this if your backend runs on different port
    BASE_URL: 'http://127.0.0.1:5000/api',
    
    // Endpoints
    ENDPOINTS: {
        // Auth
        REGISTER: '/auth/register',
        LOGIN: '/auth/login',
        REFRESH: '/auth/refresh',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',
        
        // Products
        PRODUCTS: '/products',
        PRODUCT: (id) => `/products/${id}`,
        CATEGORIES: '/products/categories',
        
        // Orders
        ORDERS: '/orders',
        ORDER: (num) => `/orders/${num}`,
        TRACK: (num) => `/orders/${num}/track`,
        
        // Admin
        DASHBOARD: '/admin/dashboard',
        USERS: '/admin/users',
        AUDIT_LOGS: '/admin/audit-logs'
    }
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    // Get token from storage
    const session = localStorage.getItem('shopsecure_session') || sessionStorage.getItem('shopsecure_session');
    let token = null;
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            token = sessionData.access_token;
        } catch (e) {}
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Handle token expiration
    if (response.status === 401) {
        localStorage.removeItem('shopsecure_session');
        sessionStorage.removeItem('shopsecure_session');
        window.location.href = 'index.html';
        return;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || data.message || 'API request failed');
    }
    
    return data;
}