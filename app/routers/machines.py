# app/routers/machines.py

from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app import crud, models
from app.serializers import create_response
from app.logger import log_error, log_info
from app.config import pydantic_config

router = APIRouter(prefix="/api/machines", tags=["machines"])

class MachineBase(BaseModel):
    name: str
    description: Optional[str] = None
    sensor_id: Optional[int] = None
    
    model_config = pydantic_config

@router.get("/")
def get_machines_endpoint(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene la lista de todas las máquinas con información de estado
    """
    try:
        machines = crud.get_machines_with_status(db, skip=skip, limit=limit)
        return create_response(
            data=machines,
            message="Máquinas obtenidas correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al obtener máquinas")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{machine_id}")
def get_machine_info(machine_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de una máquina específica
    """
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    
    # Obtener información del sensor asociado
    sensor_info = None
    if machine.sensor_id:
        sensor = crud.get_sensor_by_id(db, machine.sensor_id)
        if sensor:
            sensor_info = {
                "sensor_id": sensor.sensor_id,
                "name": sensor.name,
                "description": sensor.description,
                "model_id": sensor.model_id
            }
    
    return create_response(
        data={
            "machine_id": machine.machine_id,
            "name": machine.name,
            "description": machine.description,
            "sensor_id": machine.sensor_id,
            "sensor": sensor_info
        },
        message="Máquina obtenida correctamente",
        success=True
    )

@router.post("/")
async def create_machine_endpoint(
    name: str = Form(...),
    description: str = Form(None),
    sensor_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva máquina
    """
    try:
        # Verificar si el sensor existe (si se proporciona)
        if sensor_id is not None:
            sensor = crud.get_sensor_by_id(db, sensor_id)
            if not sensor:
                return create_response(
                    data=None,
                    message=f"El sensor con ID {sensor_id} no existe",
                    success=False
                )
        
        # Crear la máquina
        machine = models.Machine(
            name=name,
            description=description,
            sensor_id=sensor_id
        )
        
        result = crud.create_machine(db, machine)
        
        return create_response(
            data=result,
            message="Máquina creada correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al crear máquina")
        return create_response(
            data=None,
            message=f"Error al crear máquina: {str(e)}",
            success=False
        )

@router.put("/{machine_id}")
async def update_machine_endpoint(
    machine_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    sensor_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza una máquina existente
    """
    try:
        # Obtener la máquina a actualizar
        machine = crud.get_machine_by_id(db, machine_id)
        if not machine:
            return create_response(
                data=None,
                message=f"La máquina con ID {machine_id} no existe",
                success=False
            )
        
        # Verificar si el sensor existe (si se proporciona)
        if sensor_id is not None:
            # Permitir establecer sensor_id como None
            if sensor_id > 0:
                sensor = crud.get_sensor_by_id(db, sensor_id)
                if not sensor:
                    return create_response(
                        data=None,
                        message=f"El sensor con ID {sensor_id} no existe",
                        success=False
                    )
        
        # Actualizar solo los campos proporcionados
        if name is not None:
            machine.name = name
        
        if description is not None:
            machine.description = description
        
        if sensor_id is not None:
            machine.sensor_id = sensor_id if sensor_id > 0 else None
        
        # Guardar los cambios
        result = crud.update_machine(db, machine)
        
        return create_response(
            data=result,
            message="Máquina actualizada correctamente",
            success=True
        )
    except Exception as e:
        log_error(e, "Error al actualizar máquina")
        return create_response(
            data=None,
            message=f"Error al actualizar máquina: {str(e)}",
            success=False
        )

@router.delete("/{machine_id}")
async def delete_machine_endpoint(machine_id: int, db: Session = Depends(get_db)):
    """
    Elimina una máquina existente
    """
    try:
        # Eliminar la máquina
        result = crud.delete_machine(db, machine_id)
        if result:
            return create_response(
                data=None,
                message="Máquina eliminada correctamente",
                success=True
            )
        else:
            return create_response(
                data=None,
                message=f"La máquina con ID {machine_id} no existe",
                success=False
            )
    except Exception as e:
        log_error(e, "Error al eliminar máquina")
        return create_response(
            data=None,
            message=f"Error al eliminar máquina: {str(e)}",
            success=False
        ) 