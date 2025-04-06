# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
import logging
import os
import psycopg2

# Configuración del logger
logger = logging.getLogger("pdm_manager.database")

# Configuración de la base de datos PostgreSQL
# Codificar la contraseña para evitar problemas con caracteres especiales
PASSWORD = "postgres"
ENCODED_PASSWORD = quote_plus(PASSWORD)

# Opciones de conexión para corregir problemas de codificación
connection_options = {
    "client_encoding": "utf8",
    "connect_timeout": 10,
}

# Cadena de conexión
DATABASE_URL = f"postgresql://postgres:{ENCODED_PASSWORD}@localhost:5432/pdm_db"

try:
    # Antes de crear el motor, verificar la conexión directamente con psycopg2
    conn = psycopg2.connect(
        host="localhost",
        port="5432",
        database="pdm_db",
        user="postgres",
        password=PASSWORD,
        client_encoding="utf8"
    )
    conn.close()
    logger.info("Prueba de conexión directa a PostgreSQL exitosa")
    
    # Crear motor de conexión con opciones adicionales
    engine = create_engine(
        DATABASE_URL,
        connect_args=connection_options,
        pool_pre_ping=True,  # Verifica conexiones antes de usarlas
        pool_recycle=300  # Recicla conexiones después de 5 minutos
    )
    logger.info("Conexión a la base de datos establecida correctamente")
except Exception as e:
    logger.error(f"Error al conectar con la base de datos: {str(e)}")
    # Si hay un error, intentamos con una configuración de respaldo
    try:
        DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/pdm_db"
        engine = create_engine(
            DATABASE_URL,
            connect_args=connection_options,
            pool_pre_ping=True,
            pool_recycle=300
        )
        logger.warning("Conexión establecida con configuración de respaldo")
    except Exception as e2:
        logger.critical(f"Error crítico al conectar con la base de datos de respaldo: {str(e2)}")
        raise

# Crear clase base para declaración de modelos
Base = declarative_base()

# Crear fábrica de sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependencia para obtener una conexión a BD en los endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
