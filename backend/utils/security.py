"""
ShopSecure - Security Utilities
Handles encryption, password hashing, and secure data handling
"""

import bcrypt
import hashlib
import secrets
from cryptography.fernet import Fernet
import base64

class SecurityManager:
    """Handles all security-related operations"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash password using bcrypt with salt
        """
        # Generate salt and hash password
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """
        Verify password against hash
        """
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """
        Generate cryptographically secure random token
        """
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def hash_sensitive_data(data: str) -> str:
        """
        One-way hash for sensitive data (PII that doesn't need decryption)
        """
        return hashlib.sha256(data.encode()).hexdigest()
    
    @staticmethod
    def mask_email(email: str) -> str:
        """
        Mask email for display (privacy protection)
        e.g., j***@email.com
        """
        if '@' not in email:
            return email
        
        local, domain = email.split('@')
        if len(local) <= 2:
            masked_local = local[0] + '*' * (len(local) - 1)
        else:
            masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
        
        return f"{masked_local}@{domain}"
    
    @staticmethod
    def mask_phone(phone: str) -> str:
        """
        Mask phone number for display
        e.g., 2547****678
        """
        if len(phone) < 7:
            return phone
        
        return phone[:4] + '*' * (len(phone) - 7) + phone[-3:]
    
    @staticmethod
    def sanitize_input(data: str) -> str:
        """
        Sanitize user input to prevent XSS
        """
        if not data:
            return data
        
        # Basic XSS prevention
        replacements = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
        }
        
        for char, replacement in replacements.items():
            data = data.replace(char, replacement)
        
        return data.strip()

class EncryptionManager:
    """
    Handles encryption/decryption of sensitive data
    Uses Fernet symmetric encryption
    """
    
    def __init__(self, key: bytes = None):
        if key is None:
            # Generate key (in production, load from secure key management)
            key = Fernet.generate_key()
        self.cipher = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt string data"""
        if not data:
            return data
        encrypted = self.cipher.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt string data"""
        if not encrypted_data:
            return encrypted_data
        try:
            decoded = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = self.cipher.decrypt(decoded)
            return decrypted.decode()
        except Exception:
            return None

# Initialize security manager
security = SecurityManager()