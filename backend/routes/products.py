"""
ShopSecure - Product Routes
Product catalog, search, and management
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Product, User, AuditLog
from utils.validators import Validator
from . import products_bp


def get_authenticated_user():
    """
    Safely resolve authenticated user from JWT identity.
    """
    identity = get_jwt_identity()

    if identity is None:
        return None

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        user_id = identity

    return User.query.get(user_id)


def seed_default_products():
    """
    Seed sample products if database has no products.
    This helps the shop page work immediately for demos/testing.
    """
    existing_count = Product.query.count()
    if existing_count > 0:
        return

    admin_user = User.query.filter_by(user_type='admin').first()
    if not admin_user:
        return

    sample_products = [
        Product(
            name="Wireless Bluetooth Headphones",
            description="Premium sound quality with 20hr battery life",
            price=2499,
            stock_quantity=15,
            category="electronics",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Running Shoes - Sports Edition",
            description="Comfortable running shoes with air cushioning",
            price=3899,
            stock_quantity=10,
            category="sports",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Organic Coffee Beans (500g)",
            description="Single origin from Nyeri region",
            price=850,
            stock_quantity=25,
            category="home",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Smartphone Stand & Holder",
            description="Adjustable aluminum stand for all phones",
            price=599,
            stock_quantity=30,
            category="electronics",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Men's Casual Shirt",
            description="100% cotton, available in multiple colors",
            price=1299,
            stock_quantity=20,
            category="fashion",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Python Programming Book",
            description="Learn Python from scratch - 2024 Edition",
            price=1800,
            stock_quantity=12,
            category="books",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Yoga Mat - Non Slip",
            description="Eco-friendly TPE material, 6mm thick",
            price=1200,
            stock_quantity=18,
            category="sports",
            vendor_id=admin_user.id,
            is_active=True
        ),
        Product(
            name="Stainless Steel Water Bottle",
            description="BPA-free, keeps drinks cold for 24hrs",
            price=750,
            stock_quantity=40,
            category="home",
            vendor_id=admin_user.id,
            is_active=True
        )
    ]

    db.session.add_all(sample_products)
    db.session.commit()


@products_bp.route('', methods=['GET'])
@products_bp.route('/', methods=['GET'])
def get_products():
    """
    Get all products with filtering and search
    """
    try:
        # Auto-seed demo products if database is empty
        seed_default_products()

        category = request.args.get('category', 'all').strip()
        search = request.args.get('search', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        query = Product.query.filter_by(is_active=True)

        if category and category.lower() != 'all':
            query = query.filter(Product.category.ilike(category))

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    Product.name.ilike(search_term),
                    Product.description.ilike(search_term),
                    Product.category.ilike(search_term)
                )
            )

        pagination = query.order_by(Product.id.asc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        products = pagination.items

        return jsonify({
            'products': [product.to_dict() for product in products],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch products',
            'details': str(e)
        }), 500


@products_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """
    Get single product details
    """
    try:
        product = Product.query.get_or_404(product_id)

        if not product.is_active:
            return jsonify({'error': 'Product not available'}), 404

        return jsonify({'product': product.to_dict()}), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch product',
            'details': str(e)
        }), 500


@products_bp.route('/categories', methods=['GET'])
def get_categories():
    """
    Get all product categories
    """
    try:
        seed_default_products()

        categories = (
            db.session.query(Product.category)
            .filter(Product.is_active == True)
            .distinct()
            .all()
        )

        return jsonify({
            'categories': [c[0] for c in categories if c[0]]
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch categories',
            'details': str(e)
        }), 500


@products_bp.route('', methods=['POST'])
@products_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    """
    Create new product (vendors/admin only)
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        if user.user_type not in ['vendor', 'admin']:
            return jsonify({'error': 'Only vendors can create products'}), 403

        data = request.get_json() or {}

        required = ['name', 'price', 'category']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        try:
            price = float(data['price'])
            if price <= 0:
                return jsonify({'error': 'Price must be greater than 0'}), 400
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid price format'}), 400

        try:
            stock_quantity = int(data.get('stock_quantity', 0))
            if stock_quantity < 0:
                return jsonify({'error': 'Stock quantity cannot be negative'}), 400
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid stock quantity'}), 400

        product = Product(
            name=Validator.sanitize_string(data['name'], 100),
            description=Validator.sanitize_string(data.get('description', ''), 500),
            price=price,
            stock_quantity=stock_quantity,
            category=Validator.sanitize_string(data['category'], 50),
            vendor_id=user.id,
            is_active=True
        )

        db.session.add(product)

        audit = AuditLog(
            user_id=user.id,
            action='product_created',
            details=f"product:{product.name}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({
            'message': 'Product created successfully',
            'product': product.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to create product',
            'details': str(e)
        }), 500


@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    """
    Update product (vendor owner or admin only)
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        product = Product.query.get_or_404(product_id)

        if product.vendor_id != user.id and user.user_type != 'admin':
            return jsonify({'error': 'Unauthorized to update this product'}), 403

        data = request.get_json() or {}

        if 'name' in data:
            product.name = Validator.sanitize_string(data['name'], 100)

        if 'description' in data:
            product.description = Validator.sanitize_string(data['description'], 500)

        if 'price' in data:
            try:
                price = float(data['price'])
                if price <= 0:
                    return jsonify({'error': 'Price must be greater than 0'}), 400
                product.price = price
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid price format'}), 400

        if 'stock_quantity' in data:
            try:
                stock_quantity = int(data['stock_quantity'])
                if stock_quantity < 0:
                    return jsonify({'error': 'Stock quantity cannot be negative'}), 400
                product.stock_quantity = stock_quantity
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid stock quantity'}), 400

        if 'category' in data:
            product.category = Validator.sanitize_string(data['category'], 50)

        if 'is_active' in data and user.user_type == 'admin':
            product.is_active = bool(data['is_active'])

        audit = AuditLog(
            user_id=user.id,
            action='product_updated',
            details=f"product_id:{product_id}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({
            'message': 'Product updated successfully',
            'product': product.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to update product',
            'details': str(e)
        }), 500


@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    """
    Delete product (soft delete - vendor owner or admin only)
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        product = Product.query.get_or_404(product_id)

        if product.vendor_id != user.id and user.user_type != 'admin':
            return jsonify({'error': 'Unauthorized to delete this product'}), 403

        product.is_active = False

        audit = AuditLog(
            user_id=user.id,
            action='product_deleted',
            details=f"product_id:{product_id}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({'message': 'Product deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to delete product',
            'details': str(e)
        }), 500


@products_bp.route('/my-products', methods=['GET'])
@jwt_required()
def get_vendor_products():
    """
    Get current vendor/admin products
    """
    try:
        user = get_authenticated_user()

        if not user:
            return jsonify({'error': 'Authenticated user not found'}), 404

        if user.user_type not in ['vendor', 'admin']:
            return jsonify({'error': 'Only vendors can access this endpoint'}), 403

        products = Product.query.filter_by(vendor_id=user.id).order_by(Product.id.desc()).all()

        return jsonify({
            'products': [product.to_dict() for product in products]
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch products',
            'details': str(e)
        }), 500