# app/config.py
from fastapi import APIRouter, Depends, HTTPException, Body, status, Query, Path
from sqlalchemy.orm import Session
from app.database import get_db
from app.crud_config import (
    get_full_config,
    update_full_config,
    get_system_config,
    update_system_config,
    get_latest_limit_config,
    create_or_update_limit_config,
    get_or_create_model,
    get_or_create_sensor,
    get_or_create_machine,
    get_all_models, get_model_by_id, create_new_model, update_existing_model, delete_model,
    get_all_sensors, get_sensor_by_id, create_new_sensor, update_existing_sensor, delete_sensor,
    get_all_machines, get_machine_by_id, create_new_machine, update_existing_machine, delete_machine,
    get_all_limits, get_limit_by_id, delete_limit
)
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List, ClassVar
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
import logging

router = APIRouter(tags=["configuración"])

# ---------------------------------------------------------
# ESQUEMAS DE VALIDACIÓN DE DATOS
# ---------------------------------------------------------

class ConfigModel(BaseModel):
    """Esquema para el modelo en la configuración"""
    model_id: Optional[int] = None
    route_h5: Optional[str] = None
    route_pkl: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    
    model_config = {'protected_namespaces': ()}

class ConfigSensor(BaseModel):
    """Esquema para el sensor en la configuración"""
    sensor_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    
    model_config = {'protected_namespaces': ()}

class ConfigMachine(BaseModel):
    """Esquema para la máquina en la configuración"""
    machine_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sensor_id: Optional[int] = None
    
    model_config = {'protected_namespaces': ()}

class LimitConfigData(BaseModel):
    """Esquema para la configuración de límites"""
    x_2inf: Optional[float] = Field(None, description="Límite inferior nivel 2 para el eje X")
    x_2sup: Optional[float] = Field(None, description="Límite superior nivel 2 para el eje X")
    x_3inf: Optional[float] = Field(None, description="Límite inferior nivel 3 para el eje X")
    x_3sup: Optional[float] = Field(None, description="Límite superior nivel 3 para el eje X")
    y_2inf: Optional[float] = Field(None, description="Límite inferior nivel 2 para el eje Y")
    y_2sup: Optional[float] = Field(None, description="Límite superior nivel 2 para el eje Y")
    y_3inf: Optional[float] = Field(None, description="Límite inferior nivel 3 para el eje Y")
    y_3sup: Optional[float] = Field(None, description="Límite superior nivel 3 para el eje Y")
    z_2inf: Optional[float] = Field(None, description="Límite inferior nivel 2 para el eje Z")
    z_2sup: Optional[float] = Field(None, description="Límite superior nivel 2 para el eje Z")
    z_3inf: Optional[float] = Field(None, description="Límite inferior nivel 3 para el eje Z")
    z_3sup: Optional[float] = Field(None, description="Límite superior nivel 3 para el eje Z")
    
    model_config = {'protected_namespaces': ()}
    
    # Valores por defecto para cada eje
    DEFAULT_VALUES: ClassVar[Dict[str, Dict[str, Dict[str, float]]]] = {
        'x': {
            'warning': {'inf': -2.36, 'sup': 2.18},
            'critical': {'inf': -3.5, 'sup': 3.32}
        },
        'y': {
            'warning': {'inf': 7.18, 'sup': 12.09},
            'critical': {'inf': 5.95, 'sup': 13.32}
        },
        'z': {
            'warning': {'inf': -2.39, 'sup': 1.11},
            'critical': {'inf': -3.26, 'sup': 1.98}
        }
    }
    
    @validator('x_2sup')
    def validate_x_2sup(cls, v, values):
        if v is not None and 'x_2inf' in values and values['x_2inf'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['x_2inf'] - cls.DEFAULT_VALUES['x']['warning']['inf']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['x']['warning']['sup']) < 0.01):
                return v
                
            if v <= values['x_2inf']:
                raise ValueError("x_2sup debe ser mayor que x_2inf")
        return v
    
    @validator('x_3inf')
    def validate_x_3inf(cls, v, values):
        if v is not None and 'x_2inf' in values and values['x_2inf'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['x_2inf'] - cls.DEFAULT_VALUES['x']['warning']['inf']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['x']['critical']['inf']) < 0.01):
                return v
                
            if v >= values['x_2inf']:
                raise ValueError("x_3inf debe ser menor que x_2inf")
        return v
    
    @validator('x_3sup')
    def validate_x_3sup(cls, v, values):
        if v is not None and 'x_2sup' in values and values['x_2sup'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['x_2sup'] - cls.DEFAULT_VALUES['x']['warning']['sup']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['x']['critical']['sup']) < 0.01):
                return v
                
            if v <= values['x_2sup']:
                raise ValueError("x_3sup debe ser mayor que x_2sup")
        return v
    
    @validator('y_2sup')
    def validate_y_2sup(cls, v, values):
        if v is not None and 'y_2inf' in values and values['y_2inf'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['y_2inf'] - cls.DEFAULT_VALUES['y']['warning']['inf']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['y']['warning']['sup']) < 0.01):
                return v
                
            if v <= values['y_2inf']:
                raise ValueError("y_2sup debe ser mayor que y_2inf")
        return v
    
    @validator('y_3inf')
    def validate_y_3inf(cls, v, values):
        if v is not None and 'y_2inf' in values and values['y_2inf'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['y_2inf'] - cls.DEFAULT_VALUES['y']['warning']['inf']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['y']['critical']['inf']) < 0.01):
                return v
                
            if v >= values['y_2inf']:
                raise ValueError("y_3inf debe ser menor que y_2inf")
        return v
    
    @validator('y_3sup')
    def validate_y_3sup(cls, v, values):
        if v is not None and 'y_2sup' in values and values['y_2sup'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['y_2sup'] - cls.DEFAULT_VALUES['y']['warning']['sup']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['y']['critical']['sup']) < 0.01):
                return v
                
            if v <= values['y_2sup']:
                raise ValueError("y_3sup debe ser mayor que y_2sup")
        return v
    
    @validator('z_2sup')
    def validate_z_2sup(cls, v, values):
        if v is not None and 'z_2inf' in values and values['z_2inf'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['z_2inf'] - cls.DEFAULT_VALUES['z']['warning']['inf']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['z']['warning']['sup']) < 0.01):
                return v
                
            if v <= values['z_2inf']:
                raise ValueError("z_2sup debe ser mayor que z_2inf")
        return v
    
    @validator('z_3inf')
    def validate_z_3inf(cls, v, values):
        if v is not None and 'z_2inf' in values and values['z_2inf'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['z_2inf'] - cls.DEFAULT_VALUES['z']['warning']['inf']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['z']['critical']['inf']) < 0.01):
                return v
                
            if v >= values['z_2inf']:
                raise ValueError("z_3inf debe ser menor que z_2inf")
        return v
    
    @validator('z_3sup')
    def validate_z_3sup(cls, v, values):
        if v is not None and 'z_2sup' in values and values['z_2sup'] is not None:
            # Si los valores corresponden a los valores por defecto, permitirlos
            if (abs(values['z_2sup'] - cls.DEFAULT_VALUES['z']['warning']['sup']) < 0.01 and 
                abs(v - cls.DEFAULT_VALUES['z']['critical']['sup']) < 0.01):
                return v
                
            if v <= values['z_2sup']:
                raise ValueError("z_3sup debe ser mayor que z_2sup")
        return v

class ConfigUpdateData(BaseModel):
    """
    Esquema para validar datos de actualización de configuración.
    """
    route_h5: Optional[str] = Field(None, description="Ruta al archivo del modelo (.h5)")
    route_pkl: Optional[str] = Field(None, description="Ruta al archivo del escalador (.pkl)")
    model_name: Optional[str] = Field(None, description="Nombre del modelo")
    model_description: Optional[str] = Field(None, description="Descripción del modelo")
    
    # Información del sensor
    sensor_name: Optional[str] = Field(None, description="Nombre del sensor")
    sensor_description: Optional[str] = Field(None, description="Descripción del sensor")
    
    # Información de la máquina
    machine_name: Optional[str] = Field(None, description="Nombre de la máquina")
    machine_description: Optional[str] = Field(None, description="Descripción de la máquina")
    
    # Límites de vibración
    x_2inf: Optional[float] = Field(None, description="Límite inferior nivel 2 para el eje X")
    x_2sup: Optional[float] = Field(None, description="Límite superior nivel 2 para el eje X")
    x_3inf: Optional[float] = Field(None, description="Límite inferior nivel 3 para el eje X")
    x_3sup: Optional[float] = Field(None, description="Límite superior nivel 3 para el eje X")
    y_2inf: Optional[float] = Field(None, description="Límite inferior nivel 2 para el eje Y")
    y_2sup: Optional[float] = Field(None, description="Límite superior nivel 2 para el eje Y")
    y_3inf: Optional[float] = Field(None, description="Límite inferior nivel 3 para el eje Y")
    y_3sup: Optional[float] = Field(None, description="Límite superior nivel 3 para el eje Y")
    z_2inf: Optional[float] = Field(None, description="Límite inferior nivel 2 para el eje Z")
    z_2sup: Optional[float] = Field(None, description="Límite superior nivel 2 para el eje Z")
    z_3inf: Optional[float] = Field(None, description="Límite inferior nivel 3 para el eje Z")
    z_3sup: Optional[float] = Field(None, description="Límite superior nivel 3 para el eje Z")
    
    model_config = {'protected_namespaces': ()}

class ModelCreate(BaseModel):
    """Esquema para crear un nuevo modelo"""
    name: str = Field(..., description="Nombre del modelo")
    description: Optional[str] = Field(None, description="Descripción del modelo")
    route_h5: Optional[str] = Field(None, description="Ruta al archivo del modelo (.h5)")
    route_pkl: Optional[str] = Field(None, description="Ruta al archivo del escalador (.pkl)")
    
    class Config:
        protected_namespaces = ()

class ModelUpdate(BaseModel):
    """Esquema para actualizar un modelo existente"""
    name: Optional[str] = Field(None, description="Nombre del modelo")
    description: Optional[str] = Field(None, description="Descripción del modelo")
    route_h5: Optional[str] = Field(None, description="Ruta al archivo del modelo (.h5)")
    route_pkl: Optional[str] = Field(None, description="Ruta al archivo del escalador (.pkl)")
    
    class Config:
        protected_namespaces = ()

class SensorCreate(BaseModel):
    """Esquema para crear un nuevo sensor"""
    name: str = Field(..., description="Nombre del sensor")
    description: Optional[str] = Field(None, description="Descripción del sensor")
    model_id: Optional[int] = Field(None, description="ID del modelo asociado")
    
    class Config:
        protected_namespaces = ()

class SensorUpdate(BaseModel):
    """Esquema para actualizar un sensor existente"""
    name: Optional[str] = Field(None, description="Nombre del sensor")
    description: Optional[str] = Field(None, description="Descripción del sensor")
    model_id: Optional[int] = Field(None, description="ID del modelo asociado")
    
    class Config:
        protected_namespaces = ()

class MachineCreate(BaseModel):
    """Esquema para crear una nueva máquina"""
    name: str = Field(..., description="Nombre de la máquina")
    description: Optional[str] = Field(None, description="Descripción de la máquina")
    sensor_id: Optional[int] = Field(None, description="ID del sensor asociado")
    
    class Config:
        protected_namespaces = ()

class MachineUpdate(BaseModel):
    """Esquema para actualizar una máquina existente"""
    name: Optional[str] = Field(None, description="Nombre de la máquina")
    description: Optional[str] = Field(None, description="Descripción de la máquina")
    sensor_id: Optional[int] = Field(None, description="ID del sensor asociado")
    
    class Config:
        protected_namespaces = ()

class LimitCreate(BaseModel):
    """Esquema para crear una nueva configuración de límites"""
    x_2inf: float = Field(..., description="Límite inferior nivel 2 para el eje X")
    x_2sup: float = Field(..., description="Límite superior nivel 2 para el eje X")
    x_3inf: float = Field(..., description="Límite inferior nivel 3 para el eje X")
    x_3sup: float = Field(..., description="Límite superior nivel 3 para el eje X")
    y_2inf: float = Field(..., description="Límite inferior nivel 2 para el eje Y")
    y_2sup: float = Field(..., description="Límite superior nivel 2 para el eje Y")
    y_3inf: float = Field(..., description="Límite inferior nivel 3 para el eje Y")
    y_3sup: float = Field(..., description="Límite superior nivel 3 para el eje Y")
    z_2inf: float = Field(..., description="Límite inferior nivel 2 para el eje Z")
    z_2sup: float = Field(..., description="Límite superior nivel 2 para el eje Z")
    z_3inf: float = Field(..., description="Límite inferior nivel 3 para el eje Z")
    z_3sup: float = Field(..., description="Límite superior nivel 3 para el eje Z")
    
    class Config:
        protected_namespaces = ()

# ---------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------

@router.get("/config")
async def get_config(db: Session = Depends(get_db)):
    """
    Obtiene la configuración global del sistema, incluyendo:
    - Estado de configuración del sistema (is_configured)
    - ID del modelo activo (active_model_id)
    - Fecha de última actualización (last_update)
    - Límites de vibración (x_2inf, x_2sup, etc.)
    - Rutas del modelo y escalador (opcional)
    
    Utiliza la función get_full_config() del módulo crud_config.py para obtener toda
    la información de configuración de las tablas system_config, limit_config y model.
    
    Retorna:
    - Un objeto JSON con la configuración
    - 500 si ocurre un error al obtener la configuración
    """
    try:
        try:
            # Obtener configuración usando la función de crud_config.py
            config_response = get_full_config(db)
            return config_response
        except SQLAlchemyError as sql_e:
            # Si hay un error SQL, puede ser por esquema incorrecto
            logger.warning(f"Error SQL al obtener configuración: {str(sql_e)}")
            return {
                "is_configured": False,
                "message": "Error de schema en la base de datos. Ejecute el script init_db.py"
            }
    except Exception as e:
        error_msg = f"Error al obtener la configuración: {str(e)}"
        logger.warning(error_msg)
        return {
            "is_configured": False,
            "message": "Error de configuración. Por favor, contacte al administrador."
        }

@router.put("/config")
async def update_config(
    config_data: ConfigUpdateData = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza la configuración del sistema.
    
    Recibe:
    - model: Datos del modelo (route_h5, route_pkl, name, description)
    - limit_config: Límites de alerta para cada eje
    - sensor_name/description: Información del sensor
    - machine_name/description: Información de la máquina
    
    Actualiza las tablas:
    - system_config
    - limit_config
    - model
    - sensor
    - machine
    
    Retorna la configuración actualizada.
    """
    try:
        # Validar campos obligatorios
        if not config_data.route_h5 or not config_data.route_pkl:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Las rutas de los archivos del modelo (route_h5) y del escalador (route_pkl) son obligatorias"
            )
        
        # Convertir el modelo Pydantic a diccionario para la función de actualización
        config_dict = config_data.dict(exclude_unset=True)
        
        # Actualizar configuración
        updated_config = update_full_config(db, config_dict)
        
        # Retornar la configuración actualizada
        return {
            "status": "success",
            "message": "Configuración actualizada correctamente",
            "config": updated_config
        }
    
    except ValueError as ve:
        # Error de validación (límites inválidos, etc.)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    
    except Exception as e:
        # Otros errores
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar la configuración: {str(e)}"
        )

# ---------------------------------------------------------
# ENDPOINTS PARA MODELOS
# ---------------------------------------------------------

@router.get("/models", summary="Obtener todos los modelos")
async def get_models(db: Session = Depends(get_db)):
    """
    Obtiene todos los modelos registrados en la base de datos.
    """
    models = get_all_models(db)
    return {"models": models}

@router.get("/models/{model_id}", summary="Obtener un modelo por ID")
async def get_model(model_id: int = Path(..., description="ID del modelo a obtener"), 
                   db: Session = Depends(get_db)):
    """
    Obtiene un modelo específico por su ID.
    """
    model = get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    return model

@router.post("/models", status_code=status.HTTP_201_CREATED, summary="Crear un nuevo modelo")
async def create_model(model_data: ModelCreate = Body(...), db: Session = Depends(get_db)):
    """
    Crea un nuevo modelo en la base de datos.
    """
    try:
        model = create_new_model(db, model_data.dict())
        return {"model": model, "message": "Modelo creado correctamente"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el modelo: {str(e)}"
        )

@router.put("/models/{model_id}", summary="Actualizar un modelo existente")
async def update_model(model_id: int = Path(..., description="ID del modelo a actualizar"),
                      model_data: ModelUpdate = Body(...),
                      db: Session = Depends(get_db)):
    """
    Actualiza un modelo existente por su ID.
    """
    try:
        model = update_existing_model(db, model_id, model_data.dict(exclude_unset=True))
        if not model:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        return {"model": model, "message": "Modelo actualizado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar el modelo: {str(e)}"
        )

@router.delete("/models/{model_id}", summary="Eliminar un modelo")
async def remove_model(model_id: int = Path(..., description="ID del modelo a eliminar"),
                      db: Session = Depends(get_db)):
    """
    Elimina un modelo de la base de datos por su ID.
    """
    try:
        result = delete_model(db, model_id)
        if not result:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        return {"message": "Modelo eliminado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar el modelo: {str(e)}"
        )

# ---------------------------------------------------------
# ENDPOINTS PARA SENSORES
# ---------------------------------------------------------

@router.get("/sensors", summary="Obtener todos los sensores")
async def get_all_sensors_endpoint(
    sensor_id: Optional[int] = Query(None, description="Filtrar por ID de sensor"),
    model_id: Optional[int] = Query(None, description="Filtrar por ID de modelo"),
    db: Session = Depends(get_db)
):
    """
    Obtiene todos los sensores registrados en la base de datos,
    con opciones de filtrado por sensor_id o model_id.
    """
    # Si se proporciona un sensor_id específico, filtrar por él
    if sensor_id:
        sensor = get_sensor_by_id(db, sensor_id)
        sensors = [sensor] if sensor else []
    else:
        sensors = get_all_sensors(db)
    
    # Si se proporciona model_id, filtrar los resultados
    if model_id:
        sensors = [s for s in sensors if s.model_id == model_id]
        
    return {"sensors": sensors}

@router.get("/sensors/{sensor_id}", summary="Obtener un sensor por ID")
async def get_sensor_endpoint(
    sensor_id: int = Path(..., description="ID del sensor a obtener"),
    db: Session = Depends(get_db)
):
    """
    Obtiene un sensor específico por su ID.
    """
    sensor = get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    return sensor

@router.post("/sensors", status_code=status.HTTP_201_CREATED, summary="Crear un nuevo sensor")
async def create_sensor_endpoint(
    sensor_data: SensorCreate = Body(...),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo sensor en la base de datos.
    """
    try:
        sensor = create_new_sensor(db, sensor_data.dict())
        return {"sensor": sensor, "message": "Sensor creado correctamente"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el sensor: {str(e)}"
        )

@router.put("/sensors/{sensor_id}", summary="Actualizar un sensor existente")
async def update_sensor_endpoint(
    sensor_id: int = Path(..., description="ID del sensor a actualizar"),
    sensor_data: SensorUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza un sensor existente por su ID.
    """
    try:
        sensor = update_existing_sensor(db, sensor_id, sensor_data.dict(exclude_unset=True))
        if not sensor:
            raise HTTPException(status_code=404, detail="Sensor no encontrado")
        return {"sensor": sensor, "message": "Sensor actualizado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar el sensor: {str(e)}"
        )

@router.delete("/sensors/{sensor_id}", summary="Eliminar un sensor")
async def remove_sensor_endpoint(
    sensor_id: int = Path(..., description="ID del sensor a eliminar"),
    db: Session = Depends(get_db)
):
    """
    Elimina un sensor de la base de datos por su ID.
    """
    try:
        result = delete_sensor(db, sensor_id)
        if not result:
            raise HTTPException(status_code=404, detail="Sensor no encontrado")
        return {"message": "Sensor eliminado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar el sensor: {str(e)}"
        )

# ---------------------------------------------------------
# ENDPOINTS PARA MÁQUINAS
# ---------------------------------------------------------

@router.get("/machines", summary="Obtener todas las máquinas")
async def get_all_machines_endpoint(
    machine_id: Optional[int] = Query(None, description="Filtrar por ID de máquina"),
    sensor_id: Optional[int] = Query(None, description="Filtrar por ID de sensor"),
    db: Session = Depends(get_db)
):
    """
    Obtiene todas las máquinas registradas en la base de datos,
    con opciones de filtrado por machine_id o sensor_id.
    """
    # Si se proporciona una machine_id específica, filtrar por ella
    if machine_id:
        machine = get_machine_by_id(db, machine_id)
        machines = [machine] if machine else []
    else:
        machines = get_all_machines(db)
    
    # Si se proporciona sensor_id, filtrar los resultados
    if sensor_id:
        machines = [m for m in machines if m.sensor_id == sensor_id]
        
    return {"machines": machines}

@router.get("/machines/{machine_id}", summary="Obtener una máquina por ID")
async def get_machine_endpoint(
    machine_id: int = Path(..., description="ID de la máquina a obtener"),
    db: Session = Depends(get_db)
):
    """
    Obtiene una máquina específica por su ID.
    """
    machine = get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    return machine

@router.post("/machines", status_code=status.HTTP_201_CREATED, summary="Crear una nueva máquina")
async def create_machine_endpoint(
    machine_data: MachineCreate = Body(...),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva máquina en la base de datos.
    """
    try:
        machine = create_new_machine(db, machine_data.dict())
        return {"machine": machine, "message": "Máquina creada correctamente"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear la máquina: {str(e)}"
        )

@router.put("/machines/{machine_id}", summary="Actualizar una máquina existente")
async def update_machine_endpoint(
    machine_id: int = Path(..., description="ID de la máquina a actualizar"),
    machine_data: MachineUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza una máquina existente por su ID.
    """
    try:
        machine = update_existing_machine(db, machine_id, machine_data.dict(exclude_unset=True))
        if not machine:
            raise HTTPException(status_code=404, detail="Máquina no encontrada")
        return {"machine": machine, "message": "Máquina actualizada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar la máquina: {str(e)}"
        )

@router.delete("/machines/{machine_id}", summary="Eliminar una máquina")
async def remove_machine_endpoint(
    machine_id: int = Path(..., description="ID de la máquina a eliminar"),
    db: Session = Depends(get_db)
):
    """
    Elimina una máquina de la base de datos por su ID.
    """
    try:
        result = delete_machine(db, machine_id)
        if not result:
            raise HTTPException(status_code=404, detail="Máquina no encontrada")
        return {"message": "Máquina eliminada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar la máquina: {str(e)}"
        )

# ---------------------------------------------------------
# ENDPOINTS PARA CONFIGURACIÓN DE LÍMITES
# ---------------------------------------------------------

@router.get("/limits", summary="Obtener todas las configuraciones de límites")
async def get_all_limits_endpoint(db: Session = Depends(get_db)):
    """
    Obtiene todas las configuraciones de límites.
    
    Marca el límite con ID=1 como no eliminable, ya que es el límite por defecto.
    """
    try:
        limits = get_all_limits(db)
        
        # Convertir a diccionarios y añadir campo is_default
        result = []
        for limit in limits:
            limit_dict = {
                "limit_id": limit.limit_config_id,
                "x_2inf": limit.x_2inf,
                "x_2sup": limit.x_2sup,
                "x_3inf": limit.x_3inf,
                "x_3sup": limit.x_3sup,
                "y_2inf": limit.y_2inf,
                "y_2sup": limit.y_2sup,
                "y_3inf": limit.y_3inf,
                "y_3sup": limit.y_3sup,
                "z_2inf": limit.z_2inf,
                "z_2sup": limit.z_2sup,
                "z_3inf": limit.z_3inf,
                "z_3sup": limit.z_3sup,
                "update_limits": limit.update_limits,
                "is_default": limit.limit_config_id == 1  # Marcar límite por defecto
            }
            result.append(limit_dict)
            
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener límites: {str(e)}"
        )

@router.get("/limits/{limit_id}", summary="Obtener una configuración de límites por ID")
async def get_limit_endpoint(
    limit_id: int = Path(..., description="ID de la configuración de límites a obtener"),
    db: Session = Depends(get_db)
):
    """
    Obtiene una configuración de límites específica por su ID.
    """
    limit = get_limit_by_id(db, limit_id)
    if not limit:
        raise HTTPException(status_code=404, detail="Configuración de límites no encontrada")
    return limit

@router.post("/limits", status_code=status.HTTP_201_CREATED, summary="Crear una nueva configuración de límites")
async def create_limit_endpoint(
    limit_data: LimitCreate = Body(...),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva configuración de límites en la base de datos.
    """
    try:
        limit = create_or_update_limit_config(db, limit_data.dict())
        return {"limit": limit, "message": "Configuración de límites creada correctamente"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear la configuración de límites: {str(e)}"
        )

@router.delete("/limits/{limit_id}", summary="Eliminar una configuración de límites")
async def remove_limit_endpoint(
    limit_id: int = Path(..., description="ID de la configuración de límites a eliminar"),
    db: Session = Depends(get_db)
):
    """
    Elimina una configuración de límites.
    
    No permite eliminar el límite con ID=1, ya que es el límite por defecto.
    """
    # No permitir eliminar el límite con ID=1 (límite por defecto)
    if limit_id == 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se puede eliminar el límite por defecto"
        )
        
    try:
        # Verificar que el límite existe
        limit = get_limit_by_id(db, limit_id)
        if not limit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Límite con ID {limit_id} no encontrado"
            )
            
        # Eliminar el límite
        success = delete_limit(db, limit_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al eliminar la configuración de límites"
            )
            
        return {"message": "Configuración de límites eliminada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar límites: {str(e)}"
        ) 