# app/schemas.py

from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field

from app.config import pydantic_config

# Esquemas para Modelos ML
class ModelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    
    model_config = pydantic_config

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    
    model_config = pydantic_config

class ModelFile(BaseModel):
    model_h5: Optional[str] = None
    model_pkl: Optional[str] = None
    
    model_config = pydantic_config

# Esquemas para Sensores
class SensorBase(BaseModel):
    name: str
    description: Optional[str] = None
    model_id: Optional[int] = None
    
    model_config = pydantic_config

class SensorCreate(SensorBase):
    pass

class SensorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[int] = None
    
    model_config = pydantic_config

class SensorResponse(SensorBase):
    sensor_id: int
    
    model_config = pydantic_config

# Esquemas para Datos de Sensores
class SensorData(BaseModel):
    sensor_id: int
    acceleration_x: float
    acceleration_y: float
    acceleration_z: float
    
    model_config = pydantic_config

class ESP32SensorData(BaseModel):
    sensor_id: str
    timestamp: int
    acceleration_x: float
    acceleration_y: float
    acceleration_z: float
    
    model_config = pydantic_config

class SensorDataBatch(BaseModel):
    registros: List[SensorData]
    
    model_config = pydantic_config

# Esquemas para Máquinas
class MachineBase(BaseModel):
    name: str
    description: Optional[str] = None
    sensor_id: Optional[int] = None
    
    model_config = pydantic_config

class MachineCreate(MachineBase):
    pass

class MachineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sensor_id: Optional[int] = None
    
    model_config = pydantic_config

class MachineResponse(MachineBase):
    machine_id: int
    
    model_config = pydantic_config

# Esquemas para Alertas
class AlertResponse(BaseModel):
    log_id: int
    sensor_id: int
    sensor_name: Optional[str] = None
    timestamp: datetime
    error_type: int
    error_description: str
    data_id: Optional[int] = None
    acceleration_data: Optional[Dict[str, float]] = None
    machine_name: Optional[str] = None
    
    model_config = pydantic_config 