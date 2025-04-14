# app/config.py
from fastapi import APIRouter, Depends, HTTPException, Body, status, Query, Path, File, UploadFile, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.crud_config import (
    get_full_config,
    update_full_config,
    get_system_config,
    update_system_config,
    get_latest_limit_config,
    create_or_update_limit_config,
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
from app.models import Model, Sensor, Machine
# Imports necesarios para manejo de archivos
import os
import shutil

router = APIRouter(tags=["configuración"])
logger = logging.getLogger("pdm_manager.config_router") # Logger para este módulo

# Directorios base (asegúrate que coincidan con los de main.py si los usas allí)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")

# Asegurar que los directorios existan
os.makedirs(MODELO_DIR, exist_ok=True)
os.makedirs(SCALER_DIR, exist_ok=True)

# ---------------------------------------------------------
# ESQUEMAS DE VALIDACIÓN Y RESPUESTA Pydantic
# (Definir ANTES de usarlos en los endpoints)
# ---------------------------------------------------------

class ModelCreate(BaseModel):
    """Esquema para crear un nuevo modelo"""
    name: str = Field(..., description="Nombre del modelo")
    description: str = Field(..., description="Descripción del modelo")
    route_h5: str = Field(..., description="Ruta al archivo del modelo (.h5)")
    route_pkl: str = Field(..., description="Ruta al archivo del escalador (.pkl)")

    class Config:
        protected_namespaces = ()

class ModelUpdate(BaseModel):
    """Esquema para actualizar un modelo existente"""
    name: Optional[str] = None
    description: Optional[str] = None
    route_h5: Optional[str] = None
    route_pkl: Optional[str] = None

    class Config:
        protected_namespaces = ()

class ModelResponse(BaseModel):
    """Esquema para la respuesta de un modelo"""
    model_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    route_h5: Optional[str] = None
    route_pkl: Optional[str] = None

    class Config:
        orm_mode = True
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
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[int] = None

    class Config:
        protected_namespaces = ()

class SensorResponse(BaseModel):
    """Esquema para la respuesta de un sensor"""
    sensor_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[int] = None

    class Config:
        orm_mode = True
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

class MachineResponse(BaseModel):
    """Esquema para la respuesta de una máquina"""
    machine_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    sensor_id: Optional[int] = None

    class Config:
        orm_mode = True
        protected_namespaces = ()

class LimitResponse(BaseModel):
    """Esquema para la respuesta de límites"""
    limit_config_id: int
    x_2inf: Optional[float] = None
    x_2sup: Optional[float] = None
    x_3inf: Optional[float] = None
    x_3sup: Optional[float] = None
    y_2inf: Optional[float] = None
    y_2sup: Optional[float] = None
    y_3inf: Optional[float] = None
    y_3sup: Optional[float] = None
    z_2inf: Optional[float] = None
    z_2sup: Optional[float] = None
    z_3inf: Optional[float] = None
    z_3sup: Optional[float] = None
    update_limits: Optional[datetime] = None

    class Config:
        orm_mode = True
        protected_namespaces = ()

class SystemConfigResponse(BaseModel):
    """Esquema para la respuesta de la configuración del sistema"""
    config_id: int
    is_configured: int
    last_update: Optional[datetime] = None
    active_model_id: Optional[int] = None

    class Config:
        orm_mode = True
        protected_namespaces = ()

# ---------------------------------------------------------
# ENDPOINTS CRUD
# ---------------------------------------------------------

# Eliminar rutas /config GET y PUT duplicadas
# @router.get("/config")
# ... (código eliminado)
# @router.put("/config")
# ... (código eliminado)

# --- CRUD para Modelos ---
@router.get("/models", response_model=List[ModelResponse], summary="Obtener todos los modelos")
async def get_models(db: Session = Depends(get_db)):
    try:
        models = get_all_models(db)
        return models
    except Exception as e:
        logger.error(f"Error al obtener modelos: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al obtener modelos")

@router.get("/models/{model_id}", response_model=ModelResponse, summary="Obtener un modelo por ID")
async def get_model(model_id: int = Path(..., description="ID del modelo a obtener"), 
                   db: Session = Depends(get_db)):
    try:
        model = get_model_by_id(db, model_id)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Modelo con ID {model_id} no encontrado")
        return model
    except Exception as e:
        logger.error(f"Error al obtener modelo ID {model_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al obtener modelo {model_id}")

@router.post("/models", response_model=ModelResponse, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo modelo con archivos")
async def create_model_with_files(
    name: str = Form(...),
    description: str = Form(...),
    file_h5: UploadFile = File(..., description="Archivo del modelo .h5"),
    file_pkl: UploadFile = File(..., description="Archivo del escalador .pkl"),
    db: Session = Depends(get_db)
):
    """Crea un nuevo modelo, guardando los archivos .h5 y .pkl en el servidor."""
    logger.info(f"Recibida solicitud para crear modelo: {name}")
    
    # --- Validación básica de nombres de archivo ---
    if not file_h5.filename.endswith('.h5'):
        raise HTTPException(status_code=400, detail="El archivo de modelo debe tener extensión .h5")
    if not file_pkl.filename.endswith('.pkl'):
        raise HTTPException(status_code=400, detail="El archivo escalador debe tener extensión .pkl")
        
    # --- Guardar archivos --- 
    try:
        # Construir rutas de destino relativas y absolutas
        h5_filename = file_h5.filename
        pkl_filename = file_pkl.filename
        
        h5_relative_path = os.path.join("Modelo", h5_filename).replace("\\", "/") # Ruta relativa para BD
        pkl_relative_path = os.path.join("Scaler", pkl_filename).replace("\\", "/") # Ruta relativa para BD
        
        h5_save_path = os.path.join(MODELO_DIR, h5_filename) # Ruta absoluta para guardar
        pkl_save_path = os.path.join(SCALER_DIR, pkl_filename) # Ruta absoluta para guardar
        
        logger.info(f"Guardando archivo H5 en: {h5_save_path}")
        with open(h5_save_path, "wb") as buffer:
            shutil.copyfileobj(file_h5.file, buffer)
            
        logger.info(f"Guardando archivo PKL en: {pkl_save_path}")
        with open(pkl_save_path, "wb") as buffer:
            shutil.copyfileobj(file_pkl.file, buffer)
            
    except Exception as e:
        logger.error(f"Error al guardar archivos para el modelo '{name}': {e}", exc_info=True)
        # Intentar eliminar archivos si uno falló (opcional)
        if os.path.exists(h5_save_path): os.remove(h5_save_path)
        if os.path.exists(pkl_save_path): os.remove(pkl_save_path)
        raise HTTPException(status_code=500, detail=f"Error interno al guardar los archivos del modelo: {str(e)}")
    finally:
        # Siempre cerrar los archivos
        await file_h5.close()
        await file_pkl.close()
        
    # --- Crear entrada en BD --- 
    try:
        # Verificar si ya existe un modelo con ese nombre
        existing_model = db.query(Model).filter(Model.name == name).first()
        if existing_model:
            # Eliminar archivos guardados si el modelo ya existe
            if os.path.exists(h5_save_path): os.remove(h5_save_path)
            if os.path.exists(pkl_save_path): os.remove(pkl_save_path)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un modelo con el nombre '{name}'"
            )
        
        model_data_dict = {
            "name": name,
            "description": description,
            "route_h5": h5_relative_path, # Guardar ruta relativa
            "route_pkl": pkl_relative_path # Guardar ruta relativa
        }
        new_model = create_new_model(db, model_data_dict)
        logger.info(f"Modelo '{name}' creado en BD con ID {new_model.model_id}")
        
        # *** Establecer como modelo activo ***
        try:
            update_system_config(db, active_model_id=new_model.model_id)
            logger.info(f"Modelo ID {new_model.model_id} establecido como activo.")
        except Exception as sys_err:
            # Loguear error pero no fallar la creación del modelo
            logger.error(f"Error al establecer modelo {new_model.model_id} como activo: {sys_err}")
        # *** Fin establecer activo ***
            
        return new_model
    except HTTPException as http_exc: 
        # Eliminar archivos si la creación en BD falló por conflicto o error HTTP
        if os.path.exists(h5_save_path): os.remove(h5_save_path)
        if os.path.exists(pkl_save_path): os.remove(pkl_save_path)
        raise http_exc
    except Exception as e:
        logger.error(f"Error al crear el modelo '{name}' en la BD: {e}", exc_info=True)
        # Eliminar archivos guardados si hay error de BD
        if os.path.exists(h5_save_path): os.remove(h5_save_path)
        if os.path.exists(pkl_save_path): os.remove(pkl_save_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al crear modelo en BD: {str(e)}")

@router.put("/models/{model_id}", response_model=ModelResponse, summary="Actualizar un modelo existente (con opción de nuevos archivos)")
async def update_model_with_files(
    model_id: int = Path(..., description="ID del modelo a actualizar"),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file_h5: Optional[UploadFile] = File(None, description="Nuevo archivo .h5 (opcional)"),
    file_pkl: Optional[UploadFile] = File(None, description="Nuevo archivo .pkl (opcional)"),
    db: Session = Depends(get_db)
):
    logger.info(f"Recibida solicitud para actualizar modelo ID: {model_id}")
    update_data = {}
    h5_save_path = None
    pkl_save_path = None
    old_h5_path = None
    old_pkl_path = None

    # Obtener modelo existente
    db_model = get_model_by_id(db, model_id)
    if not db_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Modelo con ID {model_id} no encontrado")
    
    # Guardar rutas antiguas por si necesitamos revertir o eliminar
    if db_model.route_h5: old_h5_path = os.path.join(BASE_DIR, db_model.route_h5)
    if db_model.route_pkl: old_pkl_path = os.path.join(BASE_DIR, db_model.route_pkl)

    # Validar y preparar actualización de nombre y descripción
    if name is not None:
        if name != db_model.name:
            existing_model_with_name = db.query(Model).filter(Model.name == name, Model.model_id != model_id).first()
            if existing_model_with_name:
                 raise HTTPException(
                     status_code=status.HTTP_409_CONFLICT,
                     detail=f"El nombre '{name}' ya está en uso por otro modelo."
                 )
            update_data["name"] = name
            
    if description is not None and description != db_model.description:
        update_data["description"] = description
        
    # --- Procesar y guardar archivo H5 si se proporcionó --- 
    if file_h5:
        if not file_h5.filename.endswith('.h5'):
            raise HTTPException(status_code=400, detail="El archivo de modelo debe tener extensión .h5")
        try:
            h5_filename = file_h5.filename
            h5_relative_path = os.path.join("Modelo", h5_filename).replace("\\", "/")
            h5_save_path = os.path.join(MODELO_DIR, h5_filename)
            
            logger.info(f"Guardando nuevo archivo H5 en: {h5_save_path}")
            with open(h5_save_path, "wb") as buffer:
                shutil.copyfileobj(file_h5.file, buffer)
            update_data["route_h5"] = h5_relative_path # Actualizar ruta en BD
        except Exception as e:
             logger.error(f"Error al guardar nuevo archivo H5 para modelo ID {model_id}: {e}", exc_info=True)
             raise HTTPException(status_code=500, detail=f"Error interno al guardar el nuevo archivo .h5: {str(e)}")
        finally:
            await file_h5.close()

    # --- Procesar y guardar archivo PKL si se proporcionó --- 
    if file_pkl:
        if not file_pkl.filename.endswith('.pkl'):
             raise HTTPException(status_code=400, detail="El archivo escalador debe tener extensión .pkl")
        try:
            pkl_filename = file_pkl.filename
            pkl_relative_path = os.path.join("Scaler", pkl_filename).replace("\\", "/")
            pkl_save_path = os.path.join(SCALER_DIR, pkl_filename)
            
            logger.info(f"Guardando nuevo archivo PKL en: {pkl_save_path}")
            with open(pkl_save_path, "wb") as buffer:
                shutil.copyfileobj(file_pkl.file, buffer)
            update_data["route_pkl"] = pkl_relative_path # Actualizar ruta en BD
        except Exception as e:
             logger.error(f"Error al guardar nuevo archivo PKL para modelo ID {model_id}: {e}", exc_info=True)
             # Si H5 se guardó pero PKL falló, eliminar H5 guardado
             if h5_save_path and os.path.exists(h5_save_path): os.remove(h5_save_path)
             raise HTTPException(status_code=500, detail=f"Error interno al guardar el nuevo archivo .pkl: {str(e)}")
        finally:
             await file_pkl.close()
             
    # --- Actualizar BD si hay cambios --- 
    if not update_data:
        logger.info(f"No se proporcionaron datos nuevos para actualizar el modelo ID {model_id}")
        # Devolver el modelo existente si no hubo cambios
        return db_model
        
    try:
        logger.info(f"Actualizando modelo ID {model_id} en BD con datos: {update_data}")
        updated_model = update_existing_model(db, model_id, update_data)
        if not updated_model:
            # Esto no debería pasar ya que verificamos antes, pero por si acaso
            raise HTTPException(status_code=404, detail=f"Modelo con ID {model_id} no encontrado después de intentar actualizar")
            
        # *** Establecer como modelo activo ***
        try:
            update_system_config(db, active_model_id=updated_model.model_id)
            logger.info(f"Modelo ID {updated_model.model_id} establecido como activo.")
        except Exception as sys_err:
            # Loguear error pero no fallar la actualización del modelo
            logger.error(f"Error al establecer modelo {updated_model.model_id} como activo: {sys_err}")
        # *** Fin establecer activo ***
            
        # --- Eliminar archivos antiguos si fueron reemplazados --- 
        if "route_h5" in update_data and old_h5_path and os.path.exists(old_h5_path) and old_h5_path != h5_save_path:
            logger.info(f"Eliminando archivo H5 antiguo: {old_h5_path}")
            try:
                os.remove(old_h5_path)
            except OSError as rm_err:
                logger.warning(f"No se pudo eliminar el archivo H5 antiguo {old_h5_path}: {rm_err}")
                
        if "route_pkl" in update_data and old_pkl_path and os.path.exists(old_pkl_path) and old_pkl_path != pkl_save_path:
            logger.info(f"Eliminando archivo PKL antiguo: {old_pkl_path}")
            try:
                os.remove(old_pkl_path)
            except OSError as rm_err:
                 logger.warning(f"No se pudo eliminar el archivo PKL antiguo {old_pkl_path}: {rm_err}")
                 
        logger.info(f"Modelo ID {model_id} actualizado correctamente.")
        return updated_model
        
    except HTTPException as http_exc:
        # Si falla la actualización de BD, revertir guardado de archivos nuevos
        if h5_save_path and os.path.exists(h5_save_path): os.remove(h5_save_path)
        if pkl_save_path and os.path.exists(pkl_save_path): os.remove(pkl_save_path)
        raise http_exc
    except Exception as e:
        logger.error(f"Error al actualizar modelo ID {model_id} en BD: {e}", exc_info=True)
        # Revertir guardado de archivos nuevos
        if h5_save_path and os.path.exists(h5_save_path): os.remove(h5_save_path)
        if pkl_save_path and os.path.exists(pkl_save_path): os.remove(pkl_save_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al actualizar modelo en BD: {str(e)}")

@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un modelo")
async def remove_model(model_id: int = Path(..., description="ID del modelo a eliminar"),
                      db: Session = Depends(get_db)):
    # ... (código de eliminar modelo existente)
    # Añadir lógica para eliminar archivos asociados
    db_model = get_model_by_id(db, model_id) # Obtener modelo ANTES de eliminar
    if not db_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Modelo con ID {model_id} no encontrado para eliminar")
    
    old_h5_path = None
    old_pkl_path = None
    if db_model.route_h5: old_h5_path = os.path.join(BASE_DIR, db_model.route_h5)
    if db_model.route_pkl: old_pkl_path = os.path.join(BASE_DIR, db_model.route_pkl)
    
    try:
        # Verificar si el modelo está activo
        system_config = get_system_config(db)
        if system_config.active_model_id == model_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar el modelo activo. Configure otro modelo como activo primero."
            )
        
        # Verificar si algún sensor usa este modelo
        sensors_using_model = db.query(Sensor).filter(Sensor.model_id == model_id).count()
        if sensors_using_model > 0:
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail=f"No se puede eliminar el modelo porque está siendo usado por {sensors_using_model} sensor(es)."
             )
             
        # Eliminar de la BD
        deleted = delete_model(db, model_id)
        if not deleted:
            # Esto no debería ocurrir si la verificación anterior pasó
            raise HTTPException(status_code=404, detail=f"Modelo con ID {model_id} no encontrado al intentar eliminar de BD")

        # Eliminar archivos asociados DESPUÉS de eliminar de la BD
        if old_h5_path and os.path.exists(old_h5_path):
            logger.info(f"Eliminando archivo H5 asociado: {old_h5_path}")
            try: os.remove(old_h5_path)
            except OSError as rm_err: logger.warning(f"No se pudo eliminar archivo H5 {old_h5_path}: {rm_err}")
        if old_pkl_path and os.path.exists(old_pkl_path):
            logger.info(f"Eliminando archivo PKL asociado: {old_pkl_path}")
            try: os.remove(old_pkl_path)
            except OSError as rm_err: logger.warning(f"No se pudo eliminar archivo PKL {old_pkl_path}: {rm_err}")
            
        return # Retornar 204 No Content
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error al eliminar modelo ID {model_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al eliminar modelo: {str(e)}")

# --- CRUD para Sensores ---
@router.get("/sensors", response_model=List[SensorResponse], summary="Obtener todos los sensores")
async def get_all_sensors_endpoint(
    sensor_id: Optional[int] = Query(None, description="Filtrar por ID de sensor"),
    model_id: Optional[int] = Query(None, description="Filtrar por ID de modelo"),
    db: Session = Depends(get_db)
):
    try:
        sensors = []
        if sensor_id:
             sensor = get_sensor_by_id(db, sensor_id)
             sensors = [sensor] if sensor else []
        elif model_id:
             sensors = db.query(Sensor).filter(Sensor.model_id == model_id).all()
        else:
             sensors = get_all_sensors(db)
             
        return sensors
    except Exception as e:
        logger.error(f"Error al obtener sensores: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al obtener sensores")

@router.get("/sensors/{sensor_id}", response_model=SensorResponse, summary="Obtener un sensor por ID")
async def get_sensor_endpoint(
    sensor_id: int = Path(..., description="ID del sensor a obtener"),
    db: Session = Depends(get_db)
):
    try:
        sensor = get_sensor_by_id(db, sensor_id)
        if not sensor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sensor con ID {sensor_id} no encontrado")
        return sensor
    except Exception as e:
        logger.error(f"Error al obtener sensor ID {sensor_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al obtener sensor {sensor_id}")

@router.post("/sensors", response_model=SensorResponse, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo sensor")
async def create_sensor_endpoint(
    sensor_data: SensorCreate = Body(...),
    db: Session = Depends(get_db)
):
    try:
        # Verificar si ya existe sensor con ese nombre
        existing_sensor = db.query(Sensor).filter(Sensor.name == sensor_data.name).first()
        if existing_sensor:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un sensor con el nombre '{sensor_data.name}'"
            )
            
        # Verificar si el model_id existe (si se proporciona)
        if sensor_data.model_id:
            model = get_model_by_id(db, sensor_data.model_id)
            if not model:
                 raise HTTPException(
                     status_code=status.HTTP_400_BAD_REQUEST,
                     detail=f"El modelo con ID {sensor_data.model_id} no existe."
                 )
        
        new_sensor = create_new_sensor(db, sensor_data.dict())
        return new_sensor
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error al crear sensor '{sensor_data.name}': {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al crear sensor: {str(e)}")

@router.put("/sensors/{sensor_id}", response_model=SensorResponse, summary="Actualizar un sensor existente")
async def update_sensor_endpoint(
    sensor_id: int = Path(..., description="ID del sensor a actualizar"),
    sensor_data: SensorUpdate = Body(...),
    db: Session = Depends(get_db)
):
    try:
        # Verificar si el nombre ya está en uso por otro sensor
        if sensor_data.name:
            existing_sensor_with_name = db.query(Sensor).filter(Sensor.name == sensor_data.name, Sensor.sensor_id != sensor_id).first()
            if existing_sensor_with_name:
                 raise HTTPException(
                     status_code=status.HTTP_409_CONFLICT,
                     detail=f"El nombre '{sensor_data.name}' ya está en uso por otro sensor."
                 )
                 
        # Verificar si el model_id existe (si se proporciona)
        if sensor_data.model_id is not None: # Permite asignar a None
            if sensor_data.model_id != 0: # Si no es 0 (para desasignar)
                 model = get_model_by_id(db, sensor_data.model_id)
                 if not model:
                      raise HTTPException(
                          status_code=status.HTTP_400_BAD_REQUEST,
                          detail=f"El modelo con ID {sensor_data.model_id} no existe."
                      )
            else: # Permitir desasignar modelo
                sensor_data.model_id = None
        
        updated_sensor = update_existing_sensor(db, sensor_id, sensor_data.dict(exclude_unset=True))
        if not updated_sensor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sensor con ID {sensor_id} no encontrado para actualizar")
        return updated_sensor
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error al actualizar sensor ID {sensor_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al actualizar sensor: {str(e)}")

@router.delete("/sensors/{sensor_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un sensor")
async def remove_sensor_endpoint(
    sensor_id: int = Path(..., description="ID del sensor a eliminar"),
    db: Session = Depends(get_db)
):
    try:
        # Verificar si alguna máquina usa este sensor
        machines_using_sensor = db.query(Machine).filter(Machine.sensor_id == sensor_id).count()
        if machines_using_sensor > 0:
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail=f"No se puede eliminar el sensor porque está siendo usado por {machines_using_sensor} máquina(s)."
             )
             
        deleted = delete_sensor(db, sensor_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sensor con ID {sensor_id} no encontrado para eliminar")
        return
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error al eliminar sensor ID {sensor_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al eliminar sensor: {str(e)}")

# --- CRUD para Máquinas ---
@router.get("/machines", response_model=List[MachineResponse], summary="Obtener todas las máquinas")
async def get_all_machines_endpoint(
    machine_id: Optional[int] = Query(None, description="Filtrar por ID de máquina"),
    sensor_id: Optional[int] = Query(None, description="Filtrar por ID de sensor"),
    db: Session = Depends(get_db)
):
    try:
        machines = []
        if machine_id:
             machine = get_machine_by_id(db, machine_id)
             machines = [machine] if machine else []
        elif sensor_id:
             machines = db.query(Machine).filter(Machine.sensor_id == sensor_id).all()
        else:
             machines = get_all_machines(db)
             
        return machines
    except Exception as e:
        logger.error(f"Error al obtener máquinas: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al obtener máquinas")

@router.get("/machines/{machine_id}", response_model=MachineResponse, summary="Obtener una máquina por ID")
async def get_machine_endpoint(
    machine_id: int = Path(..., description="ID de la máquina a obtener"),
    db: Session = Depends(get_db)
):
    try:
        machine = get_machine_by_id(db, machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Máquina con ID {machine_id} no encontrada")
        return machine
    except Exception as e:
        logger.error(f"Error al obtener máquina ID {machine_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al obtener máquina {machine_id}")

@router.post("/machines", response_model=MachineResponse, status_code=status.HTTP_201_CREATED, summary="Crear una nueva máquina")
async def create_machine_endpoint(
    machine_data: MachineCreate = Body(...),
    db: Session = Depends(get_db)
):
    try:
        # Verificar si ya existe máquina con ese nombre
        existing_machine = db.query(Machine).filter(Machine.name == machine_data.name).first()
        if existing_machine:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una máquina con el nombre '{machine_data.name}'"
            )
            
        # Verificar si el sensor_id existe (si se proporciona)
        if machine_data.sensor_id:
            sensor = get_sensor_by_id(db, machine_data.sensor_id)
            if not sensor:
                 raise HTTPException(
                     status_code=status.HTTP_400_BAD_REQUEST,
                     detail=f"El sensor con ID {machine_data.sensor_id} no existe."
                 )
        
        new_machine = create_new_machine(db, machine_data.dict())
        return new_machine
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error al crear máquina '{machine_data.name}': {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al crear máquina: {str(e)}")

@router.put("/machines/{machine_id}", response_model=MachineResponse, summary="Actualizar una máquina existente")
async def update_machine_endpoint(
    machine_id: int = Path(..., description="ID de la máquina a actualizar"),
    machine_data: MachineUpdate = Body(...),
    db: Session = Depends(get_db)
):
    try:
        # Verificar si el nombre ya está en uso por otra máquina
        if machine_data.name:
            existing_machine_with_name = db.query(Machine).filter(Machine.name == machine_data.name, Machine.machine_id != machine_id).first()
            if existing_machine_with_name:
                 raise HTTPException(
                     status_code=status.HTTP_409_CONFLICT,
                     detail=f"El nombre '{machine_data.name}' ya está en uso por otra máquina."
                 )
                 
        # Verificar si el sensor_id existe (si se proporciona)
        if machine_data.sensor_id is not None: # Permite asignar a None
            if machine_data.sensor_id != 0: # Si no es 0 (para desasignar)
                 sensor = get_sensor_by_id(db, machine_data.sensor_id)
                 if not sensor:
                      raise HTTPException(
                          status_code=status.HTTP_400_BAD_REQUEST,
                          detail=f"El sensor con ID {machine_data.sensor_id} no existe."
                      )
            else: # Permitir desasignar sensor
                machine_data.sensor_id = None
                
        updated_machine = update_existing_machine(db, machine_id, machine_data.dict(exclude_unset=True))
        if not updated_machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Máquina con ID {machine_id} no encontrada para actualizar")
        return updated_machine
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error al actualizar máquina ID {machine_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al actualizar máquina: {str(e)}")

@router.delete("/machines/{machine_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una máquina")
async def remove_machine_endpoint(
    machine_id: int = Path(..., description="ID de la máquina a eliminar"),
    db: Session = Depends(get_db)
):
    try:
        deleted = delete_machine(db, machine_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Máquina con ID {machine_id} no encontrada para eliminar")
        return
    except Exception as e:
        logger.error(f"Error al eliminar máquina ID {machine_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al eliminar máquina: {str(e)}")

# --- CRUD para Límites ---
@router.get("/limits", response_model=List[LimitResponse], summary="Obtener todas las configuraciones de límites")
async def get_all_limits_endpoint(db: Session = Depends(get_db)):
    """
    Obtiene todas las configuraciones de límites. 
    Nota: Normalmente solo existirá una o se usará la más reciente.
    """
    try:
        limits = get_all_limits(db)
        return limits
    except Exception as e:
        logger.error(f"Error al obtener límites: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al obtener límites")

@router.get("/limits/latest", response_model=LimitResponse, summary="Obtener la última configuración de límites (activa)")
async def get_latest_limit_endpoint(db: Session = Depends(get_db)):
    """
    Obtiene la configuración de límites más reciente (asumida como la activa).
    Utiliza la función `get_latest_limit_config` que busca ID=1 o la más reciente.
    """
    try:
        limit_config = get_latest_limit_config(db)
        if not limit_config:
             # Esto podría pasar si ensure_default_limits_exist falló o no se ejecutó
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró configuración de límites activa.")
        return limit_config
    except Exception as e:
        logger.error(f"Error al obtener la última configuración de límites: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno al obtener límites")

@router.get("/limits/{limit_id}", response_model=LimitResponse, summary="Obtener una configuración de límites por ID")
async def get_limit_endpoint(
    limit_id: int = Path(..., description="ID de la configuración de límites a obtener"),
    db: Session = Depends(get_db)
):
    try:
        limit_config = get_limit_by_id(db, limit_id)
        if not limit_config:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Configuración de límites con ID {limit_id} no encontrada")
        return limit_config
    except Exception as e:
        logger.error(f"Error al obtener límite ID {limit_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al obtener límite {limit_id}")

# Nota: La creación/actualización de límites se maneja centralizadamente vía PUT /config
# No se expone un POST /limits directo para evitar inconsistencias.
# @router.post("/limits", ...)
# ...

@router.delete("/limits/{limit_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una configuración de límites")
async def remove_limit_endpoint(
    limit_id: int = Path(..., description="ID de la configuración de límites a eliminar"),
    db: Session = Depends(get_db)
):
    """
    Elimina una configuración de límites específica. 
    Precaución: Eliminar la configuración activa podría causar problemas.
    Normalmente, solo se debería modificar la configuración existente vía PUT /config.
    """
    try:
        # Añadir precaución extra: no permitir eliminar el ID 1 si es el único?
        # O verificar si es la configuración usada por `get_latest_limit_config`?
        # Por simplicidad, se permite eliminar, pero con advertencia en la doc.
        deleted = delete_limit(db, limit_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Configuración de límites con ID {limit_id} no encontrada para eliminar")
        return
    except Exception as e:
        logger.error(f"Error al eliminar límite ID {limit_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al eliminar límite: {str(e)}")

# --- Endpoint PUT para actualizar límites (usando ID 1) ---
class LimitUpdateData(BaseModel):
    """ Esquema específico para la actualización de límites. """
    x_2inf: Optional[float] = None
    x_2sup: Optional[float] = None
    x_3inf: Optional[float] = None
    x_3sup: Optional[float] = None
    y_2inf: Optional[float] = None
    y_2sup: Optional[float] = None
    y_3inf: Optional[float] = None
    y_3sup: Optional[float] = None
    z_2inf: Optional[float] = None
    z_2sup: Optional[float] = None
    z_3inf: Optional[float] = None
    z_3sup: Optional[float] = None

    class Config:
        protected_namespaces = ()

@router.put("/limits/1", response_model=LimitResponse, summary="Actualizar la configuración de límites activa (ID=1)")
async def update_active_limit_endpoint(limit_data: LimitUpdateData, db: Session = Depends(get_db)):
    """
    Actualiza la configuración de límites activa, que se asume tiene ID=1.
    Utiliza la función `create_or_update_limit_config`.
    """
    try:
        # Convertir Pydantic a dict, excluyendo los no establecidos para no sobrescribir con None
        update_dict = limit_data.dict(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se proporcionaron datos para actualizar.")

        # Llamar a la función CRUD que actualiza o crea la entrada ID=1
        updated_limit = create_or_update_limit_config(db, update_dict)
        return updated_limit
    except HTTPException as he:
        raise he # Re-lanzar excepciones HTTP de la función CRUD (e.g., 500 si ID=1 no existe)
    except ValueError as ve: # Errores de validación (aunque Pydantic debería atrapar la mayoría)
        logger.warning(f"Error de validación al actualizar límites: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error inesperado al actualizar límites (ID=1): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno al actualizar límites: {str(e)}") 