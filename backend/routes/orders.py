"""
ShopSecure - Order Routes
Order creation, management, and tracking
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Order, OrderItem, Product, User, Payment, AuditLog
from datetime import datetime
import random
import string
from . import orders_bp


def generate_order_number():
    """Generate unique order number"""
    prefix = 'SS-'
    suffix = ''.join(random.choices(string.digits, k=6))
    return f"{prefix}{suffix}"


def get_authenticated_user():
    """
    Safely resolve the authenticated user from JWT identity.
    Handles both numeric IDs and string IDs.
    """
    identity = get_jwt_identity()

    if identity is None:
        return None

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        user_id = identity

    return User.query.get(user_id)


@orders_bp.route('', methods=['GET'])
@orders_bp.route('/', methods=['GET'])
@jwt_required()
def get_orders():
    """
    Get orders for the currently authenticated user.

    Rules:
    - Admins can see all orders
    - Customers can only see their own orders
    - New customers with no orders should receive an empty list
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        if user.user_type == 'admin':
            orders = (
                Order.query
                .order_by(Order.created_at.desc())
                .all()
            )
        else:
            orders = (
                Order.query
                .filter(Order.customer_id == user.id)
                .order_by(Order.created_at.desc())
                .all()
            )

        return jsonify({
            'orders': [order.to_dict(include_items=True) for order in orders]
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch orders',
            'details': str(e)
        }), 500


@orders_bp.route('', methods=['POST'])
@orders_bp.route('/', methods=['POST'])
@jwt_required()
def create_order():
    """
    Create new order
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        data = request.get_json() or {}

        # Validate items
        items = data.get('items', [])
        if not items or not isinstance(items, list):
            return jsonify({'error': 'Order items required'}), 400

        # Validate payment method
        payment_method = data.get('payment_method')
        if payment_method not in ['mpesa', 'card', 'bank']:
            return jsonify({'error': 'Invalid payment method'}), 400

        # Calculate total and validate products
        total_amount = 0
        order_items = []

        for item in items:
            product_id = item.get('product_id')
            quantity = item.get('quantity', 1)

            try:
                quantity = int(quantity)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid quantity supplied'}), 400

            if not product_id or quantity < 1:
                return jsonify({'error': 'Invalid order item'}), 400

            product = Product.query.get(product_id)
            if not product or not product.is_active:
                return jsonify({'error': f'Product {product_id} not found'}), 404

            if product.stock_quantity < quantity:
                return jsonify({'error': f'Insufficient stock for {product.name}'}), 400

            item_total = float(product.price) * quantity
            total_amount += item_total

            order_items.append({
                'product': product,
                'quantity': quantity,
                'unit_price': product.price
            })

        # Create order
        order = Order(
            order_number=generate_order_number(),
            customer_id=user.id,
            total_amount=total_amount,
            status='pending',
            payment_method=payment_method,
            payment_status='pending',
            shipping_address=data.get('shipping_address', '')
        )

        db.session.add(order)
        db.session.flush()

        # Create order items and update stock
        for item_data in order_items:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data['product'].id,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price']
            )
            db.session.add(order_item)

            item_data['product'].stock_quantity -= item_data['quantity']

        # Create payment record
        payment = Payment(
            order_id=order.id,
            amount=total_amount,
            payment_method=payment_method,
            status='pending'
        )
        db.session.add(payment)

        # Log action
        audit = AuditLog(
            user_id=user.id,
            action='order_created',
            details=f"order:{order.order_number},amount:{total_amount}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)

        db.session.commit()

        return jsonify({
            'message': 'Order created successfully',
            'order': order.to_dict(include_items=True),
            'payment': payment.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to create order',
            'details': str(e)
        }), 500


@orders_bp.route('/<string:order_number>', methods=['GET'])
@jwt_required()
def get_order(order_number):
    """
    Get single order details
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        order = Order.query.filter_by(order_number=order_number).first_or_404()

        if user.user_type != 'admin' and order.customer_id != user.id:
            return jsonify({'error': 'Unauthorized to view this order'}), 403

        return jsonify({
            'order': order.to_dict(include_items=True)
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch order',
            'details': str(e)
        }), 500


@orders_bp.route('/<string:order_number>/pay', methods=['POST'])
@jwt_required()
def process_payment(order_number):
    """
    Process payment for order (simulation)
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        order = Order.query.filter_by(order_number=order_number).first_or_404()

        if order.customer_id != user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        if order.payment_status == 'completed':
            return jsonify({'error': 'Payment already completed'}), 400

        payment = Payment.query.filter_by(order_id=order.id).first()
        if not payment:
            return jsonify({'error': 'Payment record not found'}), 404

        if random.random() < 0.95:
            payment.status = 'completed'
            payment.completed_at = datetime.utcnow()
            payment.transaction_id = f"TXN{random.randint(100000, 999999)}"

            if payment.payment_method == 'mpesa':
                payment.mpesa_receipt = f"MPESA{random.randint(100000, 999999)}"

            order.payment_status = 'completed'
            order.status = 'processing'

            audit = AuditLog(
                user_id=user.id,
                action='payment_completed',
                details=f"order:{order_number},method:{payment.payment_method}",
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent', '')[:255]
            )
            db.session.add(audit)

            message = 'Payment successful'
            status_code = 200
        else:
            payment.status = 'failed'
            order.payment_status = 'failed'

            message = 'Payment failed. Please try again.'
            status_code = 400

        db.session.commit()

        return jsonify({
            'message': message,
            'order': order.to_dict(include_items=True),
            'payment': payment.to_dict()
        }), status_code

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Payment processing failed',
            'details': str(e)
        }), 500


@orders_bp.route('/<string:order_number>/track', methods=['GET'])
@jwt_required()
def track_order(order_number):
    """
    Get order tracking information
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        order = Order.query.filter_by(order_number=order_number).first_or_404()

        if user.user_type != 'admin' and order.customer_id != user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        timeline = [
            {
                'status': 'Order Placed',
                'date': order.created_at.isoformat() if order.created_at else None,
                'completed': True
            }
        ]

        if order.payment_status == 'completed':
            timeline.append({
                'status': 'Payment Confirmed',
                'date': order.updated_at.isoformat() if order.updated_at else None,
                'completed': True
            })

        if order.status in ['processing', 'shipped', 'delivered']:
            timeline.append({
                'status': 'Processing',
                'date': order.updated_at.isoformat() if order.updated_at else None,
                'completed': True
            })

        if order.status in ['shipped', 'delivered']:
            timeline.append({
                'status': 'Shipped',
                'date': order.updated_at.isoformat() if order.updated_at else None,
                'completed': True
            })
            timeline.append({
                'status': 'Out for Delivery',
                'date': None,
                'completed': order.status == 'delivered'
            })

        if order.status == 'delivered':
            timeline.append({
                'status': 'Delivered',
                'date': order.updated_at.isoformat() if order.updated_at else None,
                'completed': True
            })

        return jsonify({
            'order_number': order_number,
            'status': order.status,
            'timeline': timeline
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch tracking',
            'details': str(e)
        }), 500