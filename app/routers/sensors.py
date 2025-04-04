# app/routers/sensors.py

from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app import crud, models
from app.serializers import create_response
from app.logger import log_error, log_info
from app.config import pydantic_config

router = APIRouter(prefix="/api/sensors", tags=["sensors"])

class SensorBase(BaseModel):
    name: str
    description: Optional[str] = None
    model_id: Optional[int] = None
    
    model_config = pydantic_config

@router.get("/")
def get_sensors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los sensores con información asociada
    """
    try:
        sensors = crud.get_sensors(db, skip=skip, limit=limit)
        
        # Enriquecer los datos del sensor con información del modelo
        for sensor in sensors:
            if sensor.get("model_id"):
                model = crud.get_model_by_id(db, sensor["model_id"])
                if model:
                    sensor["model_name"] = model.name
                else:
                    sensor["model_name"] = "Modelo no encontrado"
            else:
                sensor["model_name"] = "Sin modelo"
        
        return create_response(
            data=sensors,
            message="Sensores obtenidos correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al obtener sensores")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{sensor_id}")
def get_sensor_info(sensor_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de un sensor específico
    """
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    
    return create_response(
        data=sensor,
        message="Sensor obtenido correctamente",
        success=True
    )

@router.post("/")
async def create_sensor_endpoint(
    name: str = Form(...),
    description: str = Form(None),
    model_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo sensor
    """
    try:
        # Verificar si el modelo existe
        model = crud.get_model_by_id(db, model_id)
        if not model:
            return create_response(
                data=None,
                message=f"El modelo con ID {model_id} no existe",
                success=False
            )
        
        # Crear el sensor
        sensor = models.Sensor(
            name=name,
            description=description,
            model_id=model_id
        )
        
        result = crud.create_sensor(db, sensor)
        
        return create_response(
            data=result,
            message="Sensor creado correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al crear sensor")
        return create_response(
            data=None,
            message=f"Error al crear sensor: {str(e)}",
            success=False
        )

@router.put("/{sensor_id}")
async def update_sensor_endpoint(
    sensor_id: int,
    name: str = Form(None),
    description: str = Form(None),
    model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza un sensor existente
    """
    try:
        # Obtener el sensor a actualizar
        sensor = crud.get_sensor_by_id(db, sensor_id)
        if not sensor:
            return create_response(
                data=None,
                message=f"El sensor con ID {sensor_id} no existe",
                success=False
            )
        
        # Actualizar solo los campos proporcionados
        if name is not None:
            sensor.name = name
        
        if description is not None:
            sensor.description = description
        
        if model_id is not None:
            # Verificar si el modelo existe
            model = crud.get_model_by_id(db, model_id)
            if not model:
                return create_response(
                    data=None,
                    message=f"El modelo con ID {model_id} no existe",
                    success=False
                )
            sensor.model_id = model_id
        
        # Guardar los cambios
        result = crud.update_sensor(db, sensor)
        
        return create_response(
            data=result,
            message="Sensor actualizado correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al actualizar sensor")
        return create_response(
            data=None,
            message=f"Error al actualizar sensor: {str(e)}",
            success=False
        )

@router.delete("/{sensor_id}")
async def delete_sensor_endpoint(sensor_id: int, db: Session = Depends(get_db)):
    """
    Elimina un sensor existente
    """
    try:
        # Verificar si hay máquinas asociadas a este sensor
        machines = crud.get_machines_by_sensor(db, sensor_id)
        if machines:
            return create_response(
                data={"machines": machines},
                message="No se puede eliminar el sensor porque tiene máquinas asociadas",
                success=False
            )
        
        # Eliminar el sensor
        result = crud.delete_sensor(db, sensor_id)
        if result:
            return create_response(
                data=None,
                message="Sensor eliminado correctamente",
                success=True
            )
        else:
            return create_response(
                data=None,
                message=f"El sensor con ID {sensor_id} no existe",
                success=False
            )
    except Exception as e:
        log_error(e, "Error al eliminar sensor")
        return create_response(
            data=None,
            message=f"Error al eliminar sensor: {str(e)}",
            success=False
        ) 