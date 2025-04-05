# app/routers/ml_models_routes.py

import os
import shutil
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from werkzeug.utils import secure_filename

from app.database import get_db
from app import crud, models
from app.serializers import create_response
from app.logger import log_error, log_info
from app.schemas import ModelCreate, ModelUpdate
from app.utils.model_loader import MODELO_DIR, SCALER_DIR

router = APIRouter(prefix="/api/models", tags=["models"])

def save_uploaded_file(upload_file: UploadFile, directory: str) -> str:
    """
    Guarda un archivo subido en el directorio especificado con un nombre seguro
    y retorna la ruta completa del archivo guardado.
    """
    if not upload_file:
        return None
    
    # Asegurar que el directorio existe
    os.makedirs(directory, exist_ok=True)
    
    # Generar un nombre de archivo seguro
    original_filename = upload_file.filename
    filename = secure_filename(original_filename)
    
    # Agregar un hash al nombre para evitar colisiones
    file_content = upload_file.file.read()
    upload_file.file.seek(0)  # Volver al inicio del archivo
    
    file_hash = hashlib.md5(file_content).hexdigest()[:8]
    name, ext = os.path.splitext(filename)
    safe_filename = f"{name}_{file_hash}{ext}"
    
    # Guardar el archivo
    file_path = os.path.join(directory, safe_filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    return file_path

@router.get("/")
def get_models(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los modelos con información asociada
    """
    try:
        models_list = crud.get_models(db, skip=skip, limit=limit)
        return create_response(
            data=models_list,
            message="Modelos obtenidos correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al obtener modelos")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de un modelo específico
    """
    model = crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    
    # Contar sensores asociados a este modelo
    sensors_count = db.query(models.Sensor).filter(
        models.Sensor.model_id == model_id
    ).count()
    
    return create_response(
        data={
            "model_id": model.model_id,
            "name": model.name,
            "description": model.description,
            "route_h5": model.route_h5,
            "route_pkl": model.route_pkl,
            "sensors_count": sensors_count
        },
        message="Modelo obtenido correctamente",
        success=True
    )

@router.post("/")
async def create_model_endpoint(
    name: str = Form(...),
    description: str = Form(None),
    model_h5_file: UploadFile = File(None),
    scaler_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo modelo con sus archivos asociados
    """
    try:
        # Procesar archivos si se proporcionan
        model_path = None
        scaler_path = None
        
        if model_h5_file:
            model_path = save_uploaded_file(model_h5_file, MODELO_DIR)
            log_info(f"Archivo de modelo guardado en: {model_path}")
        
        if scaler_file:
            scaler_path = save_uploaded_file(scaler_file, SCALER_DIR)
            log_info(f"Archivo de escalador guardado en: {scaler_path}")
        
        # Crear el modelo en la base de datos
        model = models.Model(
            name=name,
            description=description,
            route_h5=model_path,
            route_pkl=scaler_path
        )
        
        result = crud.create_model(db, model)
        
        return create_response(
            data=result,
            message="Modelo creado correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al crear modelo")
        return create_response(
            data=None,
            message=f"Error al crear modelo: {str(e)}",
            success=False
        )

@router.put("/{model_id}")
async def update_model_endpoint(
    model_id: int,
    name: str = Form(None),
    description: str = Form(None),
    model_h5_file: UploadFile = File(None),
    scaler_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza un modelo existente
    """
    try:
        # Obtener el modelo a actualizar
        model = crud.get_model_by_id(db, model_id)
        if not model:
            return create_response(
                data=None,
                message=f"El modelo con ID {model_id} no existe",
                success=False
            )
        
        # Actualizar solo los campos proporcionados
        if name is not None:
            model.name = name
        
        if description is not None:
            model.description = description
        
        # Procesar archivos si se proporcionan
        if model_h5_file:
            # Eliminar archivo anterior si existe
            if model.route_h5 and os.path.exists(model.route_h5):
                try:
                    os.remove(model.route_h5)
                    log_info(f"Archivo anterior de modelo eliminado: {model.route_h5}")
                except Exception as e:
                    log_error(e, f"No se pudo eliminar el archivo anterior de modelo: {model.route_h5}")
            
            # Guardar nuevo archivo
            model_path = save_uploaded_file(model_h5_file, MODELO_DIR)
            model.route_h5 = model_path
            log_info(f"Nuevo archivo de modelo guardado en: {model_path}")
        
        if scaler_file:
            # Eliminar archivo anterior si existe
            if model.route_pkl and os.path.exists(model.route_pkl):
                try:
                    os.remove(model.route_pkl)
                    log_info(f"Archivo anterior de escalador eliminado: {model.route_pkl}")
                except Exception as e:
                    log_error(e, f"No se pudo eliminar el archivo anterior de escalador: {model.route_pkl}")
            
            # Guardar nuevo archivo
            scaler_path = save_uploaded_file(scaler_file, SCALER_DIR)
            model.route_pkl = scaler_path
            log_info(f"Nuevo archivo de escalador guardado en: {scaler_path}")
        
        # Guardar los cambios
        result = crud.update_model(db, model)
        
        return create_response(
            data=result,
            message="Modelo actualizado correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al actualizar modelo")
        return create_response(
            data=None,
            message=f"Error al actualizar modelo: {str(e)}",
            success=False
        )

@router.delete("/{model_id}")
async def delete_model_endpoint(model_id: int, db: Session = Depends(get_db)):
    """
    Elimina un modelo existente
    """
    try:
        # Verificar si hay sensores usando este modelo
        sensors = db.query(models.Sensor).filter(models.Sensor.model_id == model_id).all()
        if sensors:
            sensor_ids = [sensor.sensor_id for sensor in sensors]
            return create_response(
                data={"sensor_ids": sensor_ids},
                message="No se puede eliminar el modelo porque está siendo utilizado por sensores",
                success=False
            )
        
        # Obtener información del modelo antes de eliminarlo
        model = crud.get_model_by_id(db, model_id)
        if not model:
            return create_response(
                data=None,
                message=f"El modelo con ID {model_id} no existe",
                success=False
            )
        
        # Eliminar archivos asociados
        if model.route_h5 and os.path.exists(model.route_h5):
            try:
                os.remove(model.route_h5)
                log_info(f"Archivo de modelo eliminado: {model.route_h5}")
            except Exception as e:
                log_error(e, f"No se pudo eliminar el archivo de modelo: {model.route_h5}")
        
        if model.route_pkl and os.path.exists(model.route_pkl):
            try:
                os.remove(model.route_pkl)
                log_info(f"Archivo de escalador eliminado: {model.route_pkl}")
            except Exception as e:
                log_error(e, f"No se pudo eliminar el archivo de escalador: {model.route_pkl}")
        
        # Eliminar el modelo de la base de datos
        success = crud.delete_model(db, model_id)
        
        if success:
            return create_response(
                data=None,
                message=f"Modelo con ID {model_id} eliminado correctamente",
                success=True
            )
        else:
            return create_response(
                data=None,
                message=f"No se pudo eliminar el modelo con ID {model_id}",
                success=False
            )
    except Exception as e:
        log_error(e, "Error al eliminar modelo")
        return create_response(
            data=None,
            message=f"Error al eliminar modelo: {str(e)}",
            success=False
        ) 