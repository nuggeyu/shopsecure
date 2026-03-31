/**
 * ShopSecure - API Configuration
 * Production config
 */

(function () {
    const API_BASE = 'https://shopsecure-backend.onrender.com/api';

    window.SHOPSECURE_API_BASE = API_BASE;
    localStorage.setItem('shopsecure_api_base', API_BASE);

    const API_CONFIG = {
        BASE_URL: API_BASE,

        ENDPOINTS: {
            REGISTER: '/auth/register',
            LOGIN: '/auth/login',
            REFRESH: '/auth/refresh',
            LOGOUT: '/auth/logout',
            ME: '/auth/me',

            PRODUCTS: '/products',
            PRODUCT: (id) => `/products/${id}`,
            CATEGORIES: '/products/categories',

            ORDERS: '/orders',
            ORDER: (num) => `/orders/${num}`,
            TRACK: (num) => `/orders/${num}/track`,

            DASHBOARD: '/admin/dashboard',
            USERS: '/admin/users',
            AUDIT_LOGS: '/admin/audit-logs'
        }
    };

    window.API_CONFIG = API_CONFIG;

    window.apiCall = async function apiCall(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;

        const session = localStorage.getItem('shopsecure_session') || sessionStorage.getItem('shopsecure_session');
        let token = null;

        if (session) {
            try {
                const sessionData = JSON.parse(session);
                token = sessionData.access_token;
            } catch (e) {
                token = null;
            }
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });

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
    };
})();