# app/database.py

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

"""
Módulo de configuración de la base de datos.

Lee la variable de entorno 'DATABASE_URL' para obtener la URL de conexión a PostgreSQL.
Si no está presente, o si hay problemas con PostgreSQL, usa SQLite en memoria.
"""

# URL de conexión a PostgreSQL (ejemplo: "postgresql://usuario:contraseña@host:puerto/nombre_bd")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://root:VRVuGa8Acji8WwOKOC98NDEZ1vFfElIA@dpg-cv2dlsd2ng1s738p1ncg-a/servomonitor_xglp"
)

# Variable para controlar si estamos en modo de base de datos o no
USE_DATABASE = True

# Si la variable de entorno "NO_DATABASE" existe, usar el modo sin BD
if os.getenv("NO_DATABASE") == "1":
    USE_DATABASE = False
    print("Modo sin base de datos activado. Usando SQLite en memoria.")

# Intentar crear el engine con PostgreSQL, si falla usar SQLite en memoria
try:
    if USE_DATABASE:
        engine = create_engine(DATABASE_URL)
        # Intentar una operación simple para verificar la conexión
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        print("Conexión a PostgreSQL exitosa.")
except Exception as e:
    print(f"Error al conectar a PostgreSQL: {e}")
    print("Usando SQLite en memoria como alternativa.")
    USE_DATABASE = False

# Si no se usa PostgreSQL, usar SQLite en memoria
if not USE_DATABASE:
    engine = create_engine("sqlite:///:memory:")
    print("SQLite en memoria inicializado. La aplicación funcionará en modo local sin persistencia.")

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

# Función para verificar si estamos usando la base de datos real
def is_using_database():
    """Retorna True si estamos usando PostgreSQL, False si estamos en modo memoria."""
    return USE_DATABASE