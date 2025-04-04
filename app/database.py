# app/database.py

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
from functools import wraps
from datetime import datetime, timedelta
import time

"""
Módulo de configuración de la base de datos.

Lee la variable de entorno 'DATABASE_URL' para obtener la URL de conexión a PostgreSQL.
Si no está presente, usa un valor por defecto (útil para pruebas locales).
"""

# Usuario y contraseña seguros para la conexión
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "pdm123")
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

# Sistema de caché para consultas frecuentes
class QueryCache:
    """
    Sistema de caché simple para consultas a la base de datos.
    Implementa un TTL (time-to-live) para las entradas y limpieza automática.
    """
    def __init__(self, max_size=100, default_ttl=60):  # TTL en segundos
        self.cache = {}
        self.expiry = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.hits = 0
        self.misses = 0
    
    def get(self, key):
        """Obtiene un valor de la caché, si existe y no ha expirado"""
        self._clean_expired()
        
        if key in self.cache and time.time() < self.expiry[key]:
            self.hits += 1
            return self.cache[key]
        
        self.misses += 1
        return None
    
    def set(self, key, value, ttl=None):
        """Establece un valor en la caché con un TTL específico o el predeterminado"""
        if ttl is None:
            ttl = self.default_ttl
        
        # Si la caché está llena, eliminar el elemento más antiguo
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.expiry, key=self.expiry.get)
            self.cache.pop(oldest_key, None)
            self.expiry.pop(oldest_key, None)
        
        self.cache[key] = value
        self.expiry[key] = time.time() + ttl
    
    def invalidate(self, key_prefix):
        """Invalida todas las entradas de caché que comienzan con un prefijo específico"""
        keys_to_remove = [k for k in self.cache.keys() if k.startswith(key_prefix)]
        for key in keys_to_remove:
            self.cache.pop(key, None)
            self.expiry.pop(key, None)
    
    def clear(self):
        """Limpia toda la caché"""
        self.cache.clear()
        self.expiry.clear()
    
    def _clean_expired(self):
        """Elimina las entradas expiradas de la caché"""
        current_time = time.time()
        expired_keys = [k for k, exp in self.expiry.items() if current_time > exp]
        for key in expired_keys:
            self.cache.pop(key, None)
            self.expiry.pop(key, None)
    
    def get_stats(self):
        """Devuelve estadísticas de uso de la caché"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total) * 100 if total > 0 else 0
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "entries": len(self.cache)
        }

# Instancia global de caché
query_cache = QueryCache()

def cached_query(ttl=None, prefix=None):
    """
    Decorador para cachear los resultados de funciones de consulta.
    
    Argumentos:
    - ttl: Tiempo de vida en segundos para la entrada de caché
    - prefix: Prefijo para la clave de caché, útil para invalidaciones agrupadas
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Construir una clave de caché basada en la función y sus argumentos
            cache_key = prefix or func.__name__
            arg_str = "_".join(str(arg) for arg in args if not hasattr(arg, '__dict__'))
            kwarg_str = "_".join(f"{k}:{v}" for k, v in sorted(kwargs.items()) 
                              if k != 'db' and not hasattr(v, '__dict__'))
            
            if arg_str:
                cache_key += f"_{arg_str}"
            if kwarg_str:
                cache_key += f"_{kwarg_str}"
            
            # Intentar obtener el resultado de la caché
            cached_result = query_cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Ejecutar la función y almacenar el resultado en caché
            result = func(*args, **kwargs)
            query_cache.set(cache_key, result, ttl)
            return result
        
        return wrapper
    
    return decorator

# Funciones para administrar la caché
def invalidate_cache(prefix):
    """Invalida todas las entradas de caché con un prefijo específico"""
    query_cache.invalidate(prefix)

def clear_cache():
    """Limpia toda la caché de consultas"""
    query_cache.clear()
    return {"status": "ok", "message": "Caché limpiada correctamente"}

def get_cache_stats():
    """Obtiene estadísticas de uso de la caché"""
    return query_cache.get_stats()

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