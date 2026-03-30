"""
ShopSecure - Database Models
SQLAlchemy models for all database tables
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
import json

db = SQLAlchemy()

class User(db.Model):
    """User model - customers, vendors, and admins"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(15), nullable=False)
    user_type = db.Column(db.Enum('customer', 'vendor', 'admin'), default='customer')
    is_active = db.Column(db.Boolean, default=True)
    email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    orders = db.relationship('Order', backref='customer', lazy='dynamic')
    products = db.relationship('Product', backref='vendor', lazy='dynamic')
    audit_logs = db.relationship('AuditLog', backref='user', lazy='dynamic')
    consent_records = db.relationship('ConsentRecord', backref='user', lazy='dynamic')
    
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary (privacy-aware)"""
        data = {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'user_type': self.user_type,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
        
        if include_sensitive:
            data['phone'] = self.phone
            data['email_verified'] = self.email_verified
        
        return data
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f'<User {self.email} ({self.user_type})>'


class Product(db.Model):
    """Product model - items for sale"""
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock_quantity = db.Column(db.Integer, default=0)
    category = db.Column(db.String(50), nullable=False)
    vendor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    order_items = db.relationship('OrderItem', backref='product', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': float(self.price),
            'stock_quantity': self.stock_quantity,
            'category': self.category,
            'vendor_id': self.vendor_id,
            'vendor_name': self.vendor.get_full_name() if self.vendor else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Product {self.name}>'


class Order(db.Model):
    """Order model - customer purchases"""
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.Enum('pending', 'processing', 'shipped', 'delivered', 'cancelled'), default='pending')
    payment_method = db.Column(db.Enum('mpesa', 'card', 'bank'), nullable=False)
    payment_status = db.Column(db.Enum('pending', 'completed', 'failed', 'refunded'), default='pending')
    shipping_address = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy='dynamic', cascade='all, delete-orphan')
    payment = db.relationship('Payment', backref='order', uselist=False)
    
    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'order_number': self.order_number,
            'customer_id': self.customer_id,
            'customer_name': self.customer.get_full_name() if self.customer else None,
            'total_amount': float(self.total_amount),
            'status': self.status,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_items:
            data['items'] = [item.to_dict() for item in self.items]
        
        return data
    
    def __repr__(self):
        return f'<Order {self.order_number}>'


class OrderItem(db.Model):
    """Order items - individual products in an order"""
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price),
            'total': float(self.unit_price * self.quantity)
        }


class Payment(db.Model):
    """Payment records"""
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    transaction_id = db.Column(db.String(100), unique=True, nullable=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.Enum('mpesa', 'card', 'bank'), nullable=False)
    status = db.Column(db.Enum('pending', 'completed', 'failed', 'refunded'), default='pending')
    mpesa_receipt = db.Column(db.String(50), nullable=True)
    card_token = db.Column(db.String(255), nullable=True)  # Encrypted token
    bank_reference = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'transaction_id': self.transaction_id,
            'amount': float(self.amount),
            'payment_method': self.payment_method,
            'status': self.status,
            'mpesa_receipt': self.mpesa_receipt,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AuditLog(db.Model):
    """Audit logs for compliance and security monitoring"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False, index=True)
    details = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)  # IPv6 compatible
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action': self.action,
            'details': self.details,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ConsentRecord(db.Model):
    """GDPR/Kenya DPA consent tracking"""
    __tablename__ = 'consent_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    consent_type = db.Column(db.String(50), nullable=False)  # 'privacy_policy', 'marketing', etc.
    version = db.Column(db.String(10), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'consent_type': self.consent_type,
            'version': self.version,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class DataRequest(db.Model):
    """Data subject requests (GDPR/Kenya DPA)"""
    __tablename__ = 'data_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(20), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    request_type = db.Column(db.Enum('export', 'deletion', 'correction', 'access'), nullable=False)
    status = db.Column(db.Enum('pending', 'processing', 'completed', 'rejected'), default='pending')
    description = db.Column(db.Text, nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    deadline = db.Column(db.DateTime, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'user_id': self.user_id,
            'request_type': self.request_type,
            'status': self.status,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# Event listeners for automatic audit logging
@event.listens_for(User, 'after_insert')
def log_user_creation(mapper, connection, target):
    """Log when new user is created"""
    # This would be handled by the application layer for full context
    pass


def create_default_admin():
    """Create default admin user if none exists"""
    from utils.security import security
    
    admin = User.query.filter_by(email='admin@shopsecure.co.ke').first()
    if not admin:
        admin = User(
            email='admin@shopsecure.co.ke',
            password_hash=security.hash_password('Admin123!'),
            first_name='System',
            last_name='Administrator',
            phone='254712345678',
            user_type='admin',
            is_active=True,
            email_verified=True
        )
        db.session.add(admin)
        db.session.commit()
        print("✅ Default admin created: admin@shopsecure.co.ke / Admin123!")