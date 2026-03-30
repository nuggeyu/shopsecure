"""
ShopSecure - Main Flask Application
Privacy-focused e-commerce platform backend
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from models import db, create_default_admin
from routes import auth_bp, products_bp, orders_bp, admin_bp
import os
from datetime import datetime


def create_app(config_name='default'):
    """
    Application factory pattern
    """
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)

    # CORS setup
    cors_origins = app.config.get('CORS_ORIGINS', '*')

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": cors_origins,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"]
            }
        }
    )

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(admin_bp)

    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': 'Token has expired',
            'message': 'Please log in again'
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'error': 'Invalid token',
            'message': 'Token signature verification failed'
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            'error': 'Authorization required',
            'message': 'Request does not contain an access token'
        }), 401

    # Global error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Bad request',
            'message': str(error)
        }), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'Not found',
            'message': 'Resource not found'
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({
            'error': 'Internal server error',
            'message': str(error)
        }), 500

    # Root
    @app.route('/')
    def index():
        return jsonify({
            'message': '🔒 ShopSecure API',
            'version': '1.0.0',
            'status': 'operational',
            'timestamp': datetime.utcnow().isoformat(),
            'environment': config_name,
            'endpoints': {
                'auth': '/api/auth',
                'products': '/api/products',
                'orders': '/api/orders',
                'admin': '/api/admin',
                'health': '/api/health'
            }
        }), 200

    # Health check
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'timestamp': datetime.utcnow().isoformat(),
            'environment': config_name
        }), 200

    # Initialize database
    with app.app_context():
        db.create_all()
        print("✅ Database tables created successfully")
        create_default_admin()

    return app


# Use production config automatically when FLASK_ENV=production
app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    print("🔒 Starting ShopSecure Backend...")
    print("📡 API available locally at: http://127.0.0.1:5000")
    print("📖 API Documentation:")
    print("   GET  /              - API info")
    print("   GET  /api/health    - Health check")
    print("   POST /api/auth/register - Register user")
    print("   POST /api/auth/login    - Login user")
    print("   GET  /api/products      - List products")
    print("   POST /api/orders        - Create order")
    print("   GET  /api/orders        - Get user orders")
    print("   GET  /api/admin/dashboard - Admin stats (admin only)")

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=app.config.get('DEBUG', True)
    )