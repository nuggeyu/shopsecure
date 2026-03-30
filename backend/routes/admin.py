"""
ShopSecure - Admin Routes
Administrative functions, user management, compliance
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Order, AuditLog, DataRequest, ConsentRecord
from utils.security import security
from . import admin_bp
from datetime import datetime, timedelta
import json


def admin_required(fn):
    """Decorator to check if user is admin"""
    from functools import wraps
    
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.user_type != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@admin_required
def dashboard_stats():
    """
    Get admin dashboard statistics
    """
    try:
        # User stats
        total_users = User.query.count()
        total_customers = User.query.filter_by(user_type='customer').count()
        total_vendors = User.query.filter_by(user_type='vendor').count()
        new_users_today = User.query.filter(
            User.created_at >= datetime.utcnow().date()
        ).count()
        
        # Order stats
        total_orders = Order.query.count()
        orders_today = Order.query.filter(
            Order.created_at >= datetime.utcnow().date()
        ).count()
        total_revenue = db.session.query(db.func.sum(Order.total_amount)).filter(
            Order.payment_status == 'completed'
        ).scalar() or 0
        
        # Privacy stats
        pending_data_requests = DataRequest.query.filter_by(status='pending').count()
        total_consents = ConsentRecord.query.count()
        
        # Recent audit logs
        recent_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(10).all()
        
        return jsonify({
            'users': {
                'total': total_users,
                'customers': total_customers,
                'vendors': total_vendors,
                'new_today': new_users_today
            },
            'orders': {
                'total': total_orders,
                'today': orders_today,
                'total_revenue': float(total_revenue)
            },
            'privacy': {
                'pending_data_requests': pending_data_requests,
                'total_consents': total_consents
            },
            'recent_activity': [log.to_dict() for log in recent_logs]
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch dashboard stats', 'details': str(e)}), 500


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@admin_required
def get_all_users():
    """
    Get all users (admin only)
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        user_type = request.args.get('type')
        
        query = User.query
        
        if user_type:
            query = query.filter_by(user_type=user_type)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        users = pagination.items
        
        return jsonify({
            'users': [u.to_dict(include_sensitive=True) for u in users],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch users', 'details': str(e)}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_user(user_id):
    """
    Update user (admin only)
    """
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if 'is_active' in data:
            user.is_active = bool(data['is_active'])
        if 'user_type' in data and data['user_type'] in ['customer', 'vendor', 'admin']:
            user.user_type = data['user_type']
        
        # Log action
        audit = AuditLog(
            user_id=get_jwt_identity(),
            action='admin_user_updated',
            details=f"target_user:{user_id}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user', 'details': str(e)}), 500


@admin_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
@admin_required
def get_audit_logs():
    """
    Get audit logs (admin only)
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        action_filter = request.args.get('action')
        
        query = AuditLog.query.order_by(AuditLog.created_at.desc())
        
        if action_filter:
            query = query.filter(AuditLog.action.like(f'%{action_filter}%'))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        logs = pagination.items
        
        return jsonify({
            'logs': [log.to_dict() for log in logs],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch audit logs', 'details': str(e)}), 500


@admin_bp.route('/data-requests', methods=['GET'])
@jwt_required()
@admin_required
def get_data_requests():
    """
    Get data subject requests (GDPR/Kenya DPA compliance)
    """
    try:
        status = request.args.get('status', 'pending')
        requests = DataRequest.query.filter_by(status=status).all()
        
        return jsonify({
            'requests': [r.to_dict() for r in requests]
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to fetch data requests', 'details': str(e)}), 500


@admin_bp.route('/data-requests/<string:request_id>/process', methods=['POST'])
@jwt_required()
@admin_required
def process_data_request(request_id):
    """
    Process a data subject request
    """
    try:
        data_req = DataRequest.query.filter_by(request_id=request_id).first_or_404()
        
        if data_req.status != 'pending':
            return jsonify({'error': 'Request already processed'}), 400
        
        data_req.status = 'processing'
        db.session.commit()
        
        # Simulate processing delay
        import time
        time.sleep(2)
        
        # In production, actually export/delete data here
        
        data_req.status = 'completed'
        data_req.completed_at = datetime.utcnow()
        
        # Log action
        audit = AuditLog(
            user_id=get_jwt_identity(),
            action='data_request_processed',
            details=f"request:{request_id},type:{data_req.request_type}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            'message': 'Data request processed successfully',
            'request': data_req.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to process request', 'details': str(e)}), 500


@admin_bp.route('/export-data/<int:user_id>', methods=['GET'])
@jwt_required()
@admin_required
def export_user_data(user_id):
    """
    Export all data for a user (GDPR data portability)
    """
    try:
        user = User.query.get_or_404(user_id)
        
        # Compile all user data
        export_data = {
            'user_profile': user.to_dict(include_sensitive=True),
            'orders': [o.to_dict(include_items=True) for o in user.orders],
            'audit_logs': [a.to_dict() for a in user.audit_logs],
            'consent_records': [c.to_dict() for c in user.consent_records],
            'export_date': datetime.utcnow().isoformat(),
            'exported_by': 'admin'
        }
        
        # Log export
        audit = AuditLog(
            user_id=get_jwt_identity(),
            action='admin_data_export',
            details=f"target_user:{user_id}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:255]
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            'message': 'Data export generated',
            'data': export_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to export data', 'details': str(e)}), 500