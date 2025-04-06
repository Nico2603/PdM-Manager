# app/models.py
from sqlalchemy import Column, Integer, Float, String, Text, ForeignKey, TIMESTAMP, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Model(Base):
    __tablename__ = 'model'
    __table_args__ = {'schema': 'public'}
    
    model_id = Column(Integer, primary_key=True, index=True)
    route_h5 = Column(String(255), nullable=True)
    route_pkl = Column(String(255), nullable=True)
    name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    sensors = relationship("Sensor", back_populates="model", cascade="all, delete-orphan")

class Sensor(Base):
    __tablename__ = 'sensor'
    __table_args__ = {'schema': 'public'}
    
    sensor_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    model_id = Column(Integer, ForeignKey('public.model.model_id', ondelete='CASCADE'), nullable=True)
    last_status = Column(Integer, default=0, nullable=True)  # 0: normal, 1: anomalía
    last_severity = Column(Integer, default=0, nullable=True)  # 0: normal, 1: leve, 2: grave, 3: crítico
    last_reading_time = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    model = relationship("Model", back_populates="sensors")
    machines = relationship("Machine", back_populates="sensor", cascade="all, delete-orphan")
    vibration_data = relationship("VibrationData", back_populates="sensor", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="sensor", cascade="all, delete-orphan")

class Machine(Base):
    __tablename__ = 'machine'
    __table_args__ = {'schema': 'public'}
    
    machine_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey('public.sensor.sensor_id', ondelete='CASCADE'), nullable=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Relationships
    sensor = relationship("Sensor", back_populates="machines")

class VibrationData(Base):
    __tablename__ = 'vibration_data'
    __table_args__ = (
        Index('idx_vibration_sensor_id', 'sensor_id'),
        Index('idx_vibration_date', 'date'),
        Index('idx_vibration_severity', 'severity'),
        {'schema': 'public'}
    )
    
    data_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey('public.sensor.sensor_id', ondelete='CASCADE'), nullable=False)
    date = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    acceleration_x = Column(Float, nullable=True)
    acceleration_y = Column(Float, nullable=True)
    acceleration_z = Column(Float, nullable=True)
    severity = Column(Integer, default=0, nullable=True)  # 0: normal, 1: leve, 2: grave
    is_anomaly = Column(Integer, default=0, nullable=True)  # 0: normal, 1: anomalía
    
    # Relationships
    sensor = relationship("Sensor", back_populates="vibration_data")
    alerts = relationship("Alert", back_populates="vibration_data", cascade="all, delete-orphan")

class Alert(Base):
    __tablename__ = 'alert'
    __table_args__ = (
        Index('idx_alert_sensor_id', 'sensor_id'),
        Index('idx_alert_timestamp', 'timestamp'),
        Index('idx_alert_error_type', 'error_type'),
        {'schema': 'public'}
    )
    
    log_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey('public.sensor.sensor_id', ondelete='CASCADE'), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    error_type = Column(Integer, nullable=True)  # 1: leve, 2: grave, 3: software
    data_id = Column(Integer, ForeignKey('public.vibration_data.data_id', ondelete='CASCADE'), nullable=True)
    
    # Relationships
    sensor = relationship("Sensor", back_populates="alerts")
    vibration_data = relationship("VibrationData", back_populates="alerts")

class LimitConfig(Base):
    __tablename__ = 'limit_config'
    __table_args__ = {'schema': 'public'}
    
    limit_config_id = Column(Integer, primary_key=True, index=True)
    x_2inf = Column(Float, nullable=False, default=-2.36)
    x_2sup = Column(Float, nullable=False, default=2.18)
    x_3inf = Column(Float, nullable=False, default=-3.50)
    x_3sup = Column(Float, nullable=False, default=3.32)
    y_2inf = Column(Float, nullable=False, default=7.18)
    y_2sup = Column(Float, nullable=False, default=12.09)
    y_3inf = Column(Float, nullable=False, default=5.95)
    y_3sup = Column(Float, nullable=False, default=13.32)
    z_2inf = Column(Float, nullable=False, default=-2.39)
    z_2sup = Column(Float, nullable=False, default=1.11)
    z_3inf = Column(Float, nullable=False, default=-3.26)
    z_3sup = Column(Float, nullable=False, default=1.98)
    update_limits = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=True)
