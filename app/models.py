from sqlalchemy import Column, Integer, Numeric, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base

class DataSensor(Base):
    __tablename__ = 'data_sensor'
    id_dato = Column(Integer, primary_key=True, index=True)
    id_sensor = Column(Integer, nullable=False)
    id_locacion = Column(Integer, nullable=False)
    fecha = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    eje_x = Column(Numeric, nullable=True)
    eje_y = Column(Numeric, nullable=True)
    eje_z = Column(Numeric, nullable=True)
