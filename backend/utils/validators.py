"""
ShopSecure - Input Validators
Validates user input for security and data integrity
"""

import re
from typing import Tuple, Optional

class Validator:
    """Input validation utilities"""
    
    # Regex patterns
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    PHONE_PATTERN = re.compile(r'^(254|0)[17]\d{8}$')
    PASSWORD_PATTERN = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$')
    
    @staticmethod
    def validate_email(email: str) -> Tuple[bool, Optional[str]]:
        """
        Validate email format
        Returns: (is_valid, error_message)
        """
        if not email:
            return False, "Email is required"
        
        if len(email) > 254:
            return False, "Email too long"
        
        if not Validator.EMAIL_PATTERN.match(email):
            return False, "Invalid email format"
        
        return True, None
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, Optional[str]]:
        """
        Validate password strength
        Requirements: 8+ chars, uppercase, lowercase, number, special char
        """
        if not password:
            return False, "Password is required"
        
        if len(password) < 8:
            return False, "Password must be at least 8 characters"
        
        if len(password) > 128:
            return False, "Password too long"
        
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain uppercase letter"
        
        if not re.search(r'[a-z]', password):
            return False, "Password must contain lowercase letter"
        
        if not re.search(r'\d', password):
            return False, "Password must contain number"
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False, "Password must contain special character"
        
        return True, None
    
    @staticmethod
    def validate_kenyan_phone(phone: str) -> Tuple[bool, Optional[str]]:
        """
        Validate Kenyan phone number
        Formats: 254712345678 or 0712345678 or 0112345678
        """
        if not phone:
            return False, "Phone number is required"
        
        # Remove spaces and dashes
        clean_phone = phone.replace(' ', '').replace('-', '')
        
        if not Validator.PHONE_PATTERN.match(clean_phone):
            return False, "Invalid Kenyan phone number. Use format: 254712345678"
        
        return True, None
    
    @staticmethod
    def validate_name(name: str, field_name: str = "Name") -> Tuple[bool, Optional[str]]:
        """
        Validate name fields
        """
        if not name:
            return False, f"{field_name} is required"
        
        if len(name) < 2:
            return False, f"{field_name} too short"
        
        if len(name) > 50:
            return False, f"{field_name} too long (max 50 characters)"
        
        # Check for only letters, spaces, and hyphens
        if not re.match(r'^[a-zA-Z\s\-]+$', name):
            return False, f"{field_name} contains invalid characters"
        
        return True, None
    
    @staticmethod
    def sanitize_string(data: str, max_length: int = 255) -> str:
        """
        Sanitize string input
        """
        if not data:
            return ""
        
        # Trim whitespace
        data = data.strip()
        
        # Limit length
        data = data[:max_length]
        
        return data

class AuditLogger:
    """
    Logs security and privacy events for compliance
    """
    
    @staticmethod
    def log_event(db, user_id: int, action: str, details: str = None, 
                  ip_address: str = None, user_agent: str = None):
        """
        Log audit event to database
        """
        from models import AuditLog
        
        log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        db.session.commit()
        
        return log