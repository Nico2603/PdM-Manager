# app/models.py
from sqlalchemy import Column, Integer, Float, TIMESTAMP, String, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Sensor(Base):
    __tablename__ = 'sensor'
    sensor_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    type = Column(String, nullable=True)
    machine_id = Column(Integer, ForeignKey("machine.machine_id"), nullable=True)

class Model(Base):
    __tablename__ = 'model'
    model_id = Column(Integer, primary_key=True, index=True)
    route_h5 = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    last_update = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    accuracy = Column(Float, nullable=True)
    config_params = Column(Text, nullable=True)  # JSON con parámetros como límites sigma, etc.

class Machine(Base):
    __tablename__ = 'machine'
    machine_id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("model.model_id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, nullable=True)  # estado actual: operativo, mantenimiento, etc.

class VibrationData(Base):
    __tablename__ = 'vibration_data'
    data_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensor.sensor_id"), nullable=False)
    date = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    acceleration_x = Column(Float, nullable=True)
    acceleration_y = Column(Float, nullable=True)
    acceleration_z = Column(Float, nullable=True)
    severity = Column(Integer, nullable=True)  # 0=normal, 1=nivel1, 2=nivel2, 3=nivel3
    magnitude = Column(Float, nullable=True)  # Magnitud calculada de la vibración

class Alert(Base):
    __tablename__ = 'alert'
    log_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensor.sensor_id"), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    error_type = Column(String, nullable=False)
    vibration_data_id = Column(Integer, ForeignKey("vibration_data.data_id"), nullable=True)
    severity = Column(Integer, nullable=True)  # 1=nivel1, 2=nivel2, 3=nivel3
    message = Column(Text, nullable=True)  # Mensaje descriptivo de la alerta
    acknowledged = Column(Boolean, default=False)  # Si la alerta ha sido reconocida

class UserConfig(Base):
    __tablename__ = 'user_config'
    config_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, default=1)  # Para uso futuro con sistema de usuarios
    name = Column(String, nullable=False)
    value = Column(Text, nullable=True)  # JSON con configuración usuario
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
