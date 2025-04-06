# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Configuración de la base de datos PostgreSQL
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/pdm_db"

# Crear motor de conexión
engine = create_engine(DATABASE_URL)

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
