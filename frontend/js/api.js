// ShopSecure API Helper
// Handles all communication with the Flask backend

const API_BASE_URL = 'http://localhost:5000/api'; // We'll update this when we deploy

class ShopSecureAPI {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = localStorage.getItem('shopsecure_token');
        this.user = JSON.parse(localStorage.getItem('shopsecure_user') || 'null');
    }

    // Helper method for making requests
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // Add auth token if available
        if (this.token) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication Methods
    async register(userData) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (response.token) {
            this.setAuth(response.token, response.user);
        }
        return response;
    }

    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (response.token) {
            this.setAuth(response.token, response.user);
        }
        return response;
    }

    logout() {
        localStorage.removeItem('shopsecure_token');
        localStorage.removeItem('shopsecure_user');
        this.token = null;
        this.user = null;
        window.location.href = '/index.html';
    }

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('shopsecure_token', token);
        localStorage.setItem('shopsecure_user', JSON.stringify(user));
    }

    isAuthenticated() {
        return !!this.token;
    }

    getUserRole() {
        return this.user ? this.user.role : null;
    }

    // Product Methods
    async getProducts(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        const endpoint = queryParams ? `/products?${queryParams}` : '/products';
        return await this.request(endpoint);
    }

    async getProduct(id) {
        return await this.request(`/products/${id}`);
    }

    // Cart Methods (stored locally until checkout)
    getCart() {
        return JSON.parse(localStorage.getItem('shopsecure_cart') || '[]');
    }

    addToCart(product) {
        const cart = this.getCart();
        const existingItem = cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        
        localStorage.setItem('shopsecure_cart', JSON.stringify(cart));
        this.updateCartUI();
        return cart;
    }

    removeFromCart(productId) {
        let cart = this.getCart();
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('shopsecure_cart', JSON.stringify(cart));
        this.updateCartUI();
        return cart;
    }

    updateCartQuantity(productId, quantity) {
        const cart = this.getCart();
        const item = cart.find(item => item.id === productId);
        if (item) {
            item.quantity = quantity;
            if (quantity <= 0) {
                return this.removeFromCart(productId);
            }
        }
        localStorage.setItem('shopsecure_cart', JSON.stringify(cart));
        this.updateCartUI();
        return cart;
    }

    clearCart() {
        localStorage.removeItem('shopsecure_cart');
        this.updateCartUI();
    }

    getCartTotal() {
        const cart = this.getCart();
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getCartCount() {
        const cart = this.getCart();
        return cart.reduce((count, item) => count + item.quantity, 0);
    }

    updateCartUI() {
        // Update cart badge in navbar
        const cartBadges = document.querySelectorAll('.cart-count');
        const count = this.getCartCount();
        cartBadges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        });
    }

    // Order Methods
    async createOrder(orderData) {
        return await this.request('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async getOrders() {
        return await this.request('/orders');
    }

    async getOrder(id) {
        return await this.request(`/orders/${id}`);
    }

    // Payment Methods
    async initiateMPesaPayment(phone, amount) {
        return await this.request('/payments/mpesa', {
            method: 'POST',
            body: JSON.stringify({ phone, amount })
        });
    }

    async initiateCardPayment(paymentData) {
        return await this.request('/payments/card', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    // Admin Methods
    async getAdminStats() {
        return await this.request('/admin/stats');
    }

    async getAllUsers() {
        return await this.request('/admin/users');
    }

    async getAuditLogs() {
        return await this.request('/admin/audit-logs');
    }

    // Privacy & Consent
    async recordConsent(consentData) {
        return await this.request('/consent', {
            method: 'POST',
            body: JSON.stringify(consentData)
        });
    }

    async getPrivacyPolicy() {
        return await this.request('/privacy-policy');
    }
}

// Initialize API instance
const api = new ShopSecureAPI();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopSecureAPI;
}