import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Recuperamos la URL de conexión desde la variable de entorno "DATABASE_URL"
# Render te proporcionará esta cadena cuando crees tu base de datos PostgreSQL.
# Ejemplo de cadena: "postgresql://usuario:password@host:puerto/nombre_bd"
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://root:VRVuGa8Acji8WwOKOC98NDEZ1vFfElIA@dpg-cv2dlsd2ng1s738p1ncg-a/servomonitor_xglp")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
