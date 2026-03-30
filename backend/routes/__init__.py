"""
ShopSecure Routes Package
"""

from flask import Blueprint

# Create blueprints
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
products_bp = Blueprint('products', __name__, url_prefix='/api/products')
orders_bp = Blueprint('orders', __name__, url_prefix='/api/orders')
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Import routes (must be after blueprint creation to avoid circular imports)
from . import auth, products, orders, admin

__all__ = ['auth_bp', 'products_bp', 'orders_bp', 'admin_bp']