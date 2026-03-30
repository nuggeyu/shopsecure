"""
ShopSecure - Configuration Module
Loads settings from environment variables
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def normalize_database_url(db_url: str | None) -> str:
    """
    Normalize database URLs for SQLAlchemy.

    Render/Postgres and some platforms may provide DATABASE_URL in different formats.
    """
    if not db_url:
        return 'sqlite:///shopsecure.db'

    # Older hosted providers sometimes return postgres://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    return db_url


def parse_cors_origins(raw_value: str | None):
    """
    Parse CORS origins from environment variable.

    Examples:
    CORS_ORIGINS=*
    CORS_ORIGINS=https://site1.com,https://site2.com
    """
    if not raw_value or raw_value.strip() == "":
        return "*"

    raw_value = raw_value.strip()

    if raw_value == "*":
        return "*"

    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


class Config:
    """Base configuration"""

    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Database
    SQLALCHEMY_DATABASE_URI = normalize_database_url(os.environ.get('DATABASE_URL'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Security
    BCRYPT_LOG_ROUNDS = 12
    MAX_LOGIN_ATTEMPTS = 5
    LOGIN_COOLDOWN_MINUTES = 15

    # CORS
    CORS_ORIGINS = parse_cors_origins(os.environ.get('CORS_ORIGINS', '*'))

    # M-Pesa Configuration
    MPESA_ENVIRONMENT = os.environ.get('MPESA_ENVIRONMENT', 'sandbox')
    MPESA_SHORTCODE = os.environ.get('MPESA_SHORTCODE', '174379')
    MPESA_CONSUMER_KEY = os.environ.get('MPESA_CONSUMER_KEY', '')
    MPESA_CONSUMER_SECRET = os.environ.get('MPESA_CONSUMER_SECRET', '')
    MPESA_PASSKEY = os.environ.get('MPESA_PASSKEY', '')

    # Pesapal Configuration
    PESAPAL_CONSUMER_KEY = os.environ.get('PESAPAL_CONSUMER_KEY', '')
    PESAPAL_CONSUMER_SECRET = os.environ.get('PESAPAL_CONSUMER_SECRET', '')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    BCRYPT_LOG_ROUNDS = 13


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///test_shopsecure.db'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}