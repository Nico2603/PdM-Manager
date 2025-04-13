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
# Unificar la contraseña y codificarla para evitar problemas con caracteres especiales
PASSWORD = os.getenv("DB_PASSWORD", "pdm123") # Usar variable de entorno o valor por defecto
ENCODED_PASSWORD = quote_plus(PASSWORD)
DB_USER = os.getenv("DB_USER", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "pdm_db")

# Opciones de conexión para asegurar la codificación correcta y manejo de timeouts
connection_options = {
    "client_encoding": "utf8",
    "connect_timeout": 10, # Timeout de conexión en segundos
}

# Cadena de conexión unificada
DATABASE_URL = f"postgresql://{DB_USER}:{ENCODED_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Variable para mantener el motor de la base de datos
engine = None

try:
    # Verificar la conexión directamente con psycopg2 usando la configuración unificada
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=PASSWORD, # Usar la contraseña original aquí
        client_encoding="utf8",
        connect_timeout=connection_options["connect_timeout"]
    )
    conn.close()
    logger.info(f"Prueba de conexión directa a PostgreSQL ({DB_HOST}:{DB_PORT}/{DB_NAME}) exitosa.")

    # Crear motor de conexión de SQLAlchemy con opciones robustas
    engine = create_engine(
        DATABASE_URL,
        connect_args=connection_options,
        pool_pre_ping=True,  # Verifica conexiones antes de usarlas
        pool_recycle=300,  # Recicla conexiones inactivas después de 5 minutos (300s)
        echo=False # Desactivar echo para producción, activar para debug si es necesario
    )
    logger.info("Motor de SQLAlchemy creado y conexión a la base de datos establecida correctamente.")

except psycopg2.OperationalError as e:
    logger.critical(f"Error operacional al conectar con la base de datos (psycopg2): {e}. Verifica que el servidor esté corriendo y las credenciales sean correctas.")
    # Podrías decidir terminar la aplicación aquí si la BD es esencial
    # raise SystemExit(f"Error crítico de base de datos: {e}")
except Exception as e:
    logger.critical(f"Error inesperado al configurar la conexión a la base de datos: {e}")
    # Podrías decidir terminar la aplicación aquí
    # raise SystemExit(f"Error crítico inesperado de base de datos: {e}")

# Crear clase base para declaración de modelos si el engine se creó correctamente
if engine:
    Base = declarative_base()
else:
    logger.critical("No se pudo crear el motor de SQLAlchemy. La aplicación no puede continuar sin conexión a la base de datos.")
    # Considera terminar la aplicación si no se puede establecer la conexión inicial
    # raise SystemExit("Fallo al inicializar la conexión a la base de datos.")
    Base = None # O manejar de otra forma

# Crear fábrica de sesiones solo si el engine está disponible
SessionLocal = None
if engine:
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logger.info("Fábrica de sesiones (SessionLocal) creada.")
else:
    logger.error("No se pudo crear la fábrica de sesiones porque el motor (engine) no está disponible.")


# Dependencia para obtener una conexión a BD en los endpoints
def get_db():
    if SessionLocal is None:
        logger.error("Intento de obtener sesión de BD (get_db) fallido porque SessionLocal no está inicializado.")
        # Considera lanzar una excepción HTTP aquí si es en un request context
        raise RuntimeError("La configuración de la base de datos no está disponible.")
    
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Error durante la sesión de base de datos: {e}")
        db.rollback() # Hacer rollback en caso de error durante la transacción
        raise # Re-lanzar la excepción para que FastAPI la maneje
    finally:
        db.close()
        # logger.debug("Sesión de base de datos cerrada.") # Log de debug opcional
