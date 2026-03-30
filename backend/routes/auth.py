"""
ShopSecure - Authentication Routes
Login, register, token refresh, logout
"""

from flask import request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from models import db, User, ConsentRecord, AuditLog
from utils.security import security
from utils.validators import Validator
from . import auth_bp
from datetime import datetime


def get_authenticated_user():
    """
    Safely resolve the authenticated user from JWT identity.
    Handles both numeric and string identities.
    """
    identity = get_jwt_identity()

    if identity is None:
        return None

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        user_id = identity

    return User.query.get(user_id)


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register new user (customer or vendor)
    """
    try:
        data = request.get_json() or {}

        # Validate required fields
        required = ['email', 'password', 'first_name', 'last_name', 'phone', 'user_type']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        # Validate email
        is_valid, error = Validator.validate_email(data['email'])
        if not is_valid:
            return jsonify({'error': error}), 400

        email = data['email'].lower().strip()

        # Check if email exists
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409

        # Validate password
        is_valid, error = Validator.validate_password(data['password'])
        if not is_valid:
            return jsonify({'error': error}), 400

        # Validate phone
        is_valid, error = Validator.validate_kenyan_phone(data['phone'])
        if not is_valid:
            return jsonify({'error': error}), 400

        # Validate names
        is_valid, error = Validator.validate_name(data['first_name'], 'First name')
        if not is_valid:
            return jsonify({'error': error}), 400

        is_valid, error = Validator.validate_name(data['last_name'], 'Last name')
        if not is_valid:
            return jsonify({'error': error}), 400

        # Validate user type
        if data['user_type'] not in ['customer', 'vendor']:
            return jsonify({'error': 'Invalid user type'}), 400

        # Create user
        user = User(
            email=email,
            password_hash=security.hash_password(data['password']),
            first_name=Validator.sanitize_string(data['first_name']),
            last_name=Validator.sanitize_string(data['last_name']),
            phone=data['phone'].replace(' ', '').replace('-', ''),
            user_type=data['user_type'],
            is_active=True
        )

        db.session.add(user)
        db.session.flush()  # Get user.id without committing

        # Record privacy consent
        consent = ConsentRecord(
            user_id=user.id,
            consent_type='privacy_policy',
            version='2.1',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(consent)

        # Log registration
        audit = AuditLog(
            user_id=user.id,
            action='user_registered',
            details=f"type:{data['user_type']}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)

        db.session.commit()

        # Generate tokens
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Registration failed', 'details': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate user and return tokens
    """
    try:
        data = request.get_json() or {}

        email = data.get('email', '').lower().strip()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        # Find user
        user = User.query.filter_by(email=email).first()

        if not user or not security.verify_password(password, user.password_hash):
            # Log failed attempt
            audit = AuditLog(
                user_id=user.id if user else None,
                action='login_failed',
                details=f"email:{email}",
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent', '')[:255]
            )
            db.session.add(audit)
            db.session.commit()

            return jsonify({'error': 'Invalid credentials'}), 401

        if not user.is_active:
            return jsonify({'error': 'Account suspended. Contact support.'}), 403

        # Update last login
        user.last_login = datetime.utcnow()

        # Log successful login
        audit = AuditLog(
            user_id=user.id,
            action='login_success',
            details=f"user_type:{user.user_type}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()

        # Generate tokens
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200

    except Exception as e:
        return jsonify({'error': 'Login failed', 'details': str(e)}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token
    """
    current_user_id = get_jwt_identity()
    access_token = create_access_token(identity=str(current_user_id))

    return jsonify({'access_token': access_token}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user (client-side token removal, server-side logging)
    """
    user = get_authenticated_user()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Log logout
    audit = AuditLog(
        user_id=user.id,
        action='logout',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:255]
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get current user profile
    """
    user = get_authenticated_user()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': user.to_dict(include_sensitive=True)}), 200


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change user password
    """
    user = get_authenticated_user()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password required'}), 400

    # Verify current password
    if not security.verify_password(current_password, user.password_hash):
        return jsonify({'error': 'Current password incorrect'}), 401

    # Validate new password
    is_valid, error = Validator.validate_password(new_password)
    if not is_valid:
        return jsonify({'error': error}), 400

    # Update password
    user.password_hash = security.hash_password(new_password)

    # Log password change
    audit = AuditLog(
        user_id=user.id,
        action='password_changed',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:255]
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({'message': 'Password changed successfully'}), 200