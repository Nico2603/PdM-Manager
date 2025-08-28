# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base # Cambio aquí
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
import logging
import os

# Configuración del logger
logger = logging.getLogger("pdm_manager.database")

# Configuración de la base de datos PostgreSQL
PASSWORD = os.getenv("DB_PASSWORD", "pdm123")
ENCODED_PASSWORD = quote_plus(PASSWORD)
DB_USER = os.getenv("DB_USER", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "PdM")

# Opciones de conexión para asegurar la codificación correcta y manejo de timeouts
connection_options = {
    "client_encoding": "utf8",
    "connect_timeout": 10, # Timeout de conexión en segundos
}

DATABASE_URL = f"postgresql://{DB_USER}:{ENCODED_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

Base = declarative_base()

# Crear motor de conexión de SQLAlchemy con opciones robustas
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False
)
logger.info("Motor de SQLAlchemy creado.")

# Crear fábrica de sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
logger.info("Fábrica de sesiones (SessionLocal) creada.")


# Dependencia para obtener una conexión a BD en los endpoints
def get_db():
    if SessionLocal is None:
        logger.error("Intento de obtener sesion de BD (get_db) fallido porque SessionLocal no está inicializado.")
        # Considera lanzar una excepción HTTP aquí si es en un request context
        raise RuntimeError("La configuración de la base de datos no está disponible.")
    
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Error durante la sesion de base de datos: {e}")
        db.rollback() # Hacer rollback en caso de error durante la transacción
        raise # Re-lanzar la excepción para que FastAPI la maneje
    finally:
        db.close()
        # logger.debug("Sesión de base de datos cerrada.") # Log de debug opcional
