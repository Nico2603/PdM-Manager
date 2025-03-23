# app/database.py

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

"""
Módulo de configuración de la base de datos.

Lee la variable de entorno 'DATABASE_URL' para obtener la URL de conexión a PostgreSQL.
Si no está presente, usa un valor por defecto (útil para pruebas locales).
"""

# URL de conexión a PostgreSQL (ejemplo: "postgresql://usuario:contraseña@host:puerto/nombre_bd")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://root:VRVuGa8Acji8WwOKOC98NDEZ1vFfElIA@dpg-cv2dlsd2ng1s738p1ncg-a/servomonitor_xglp"
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