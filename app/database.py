# app/database.py

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus

"""
Módulo de configuración de la base de datos.

Lee la variable de entorno 'DATABASE_URL' para obtener la URL de conexión a PostgreSQL.
Si no está presente, usa un valor por defecto (útil para pruebas locales).
"""

# Usuario y contraseña seguros para la conexión
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "PdM")

# Codificar con quote_plus para evitar problemas con caracteres especiales
ENCODED_PASSWORD = quote_plus(DB_PASSWORD)

# URL de conexión a PostgreSQL (ejemplo: "postgresql://usuario:contraseña@host:puerto/nombre_bd")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{DB_USER}:{ENCODED_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Crear el engine con la URL de conexión
engine = create_engine(DATABASE_URL)

# Crear una factoría de sesiones (SessionLocal) para las operaciones con la BD
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para los modelos de SQLAlchemy
Base = declarative_base()

def get_db():
    """
    Dependencia para obtener una sesión de base de datos en cada petición (FastAPI).
    Asegura que la sesión se cierre automáticamente al terminar.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()