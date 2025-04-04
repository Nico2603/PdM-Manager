# app/routers/vibration_data.py

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app import crud, models
from app.serializers import create_response, remove_sa_instance
from app.logger import log_error, log_info, log_warning
from app.config import pydantic_config

# Definir rutas base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")

router = APIRouter(tags=["vibration_data"])

class SensorData(BaseModel):
    sensor_id: int
    acceleration_x: float
    acceleration_y: float
    acceleration_z: float
    
    model_config = pydantic_config

class SensorDataBatch(BaseModel):
    registros: List[SensorData]
    
    model_config = pydantic_config

@router.get("/get_vibration_data")
def get_vibration_data(
    sensor_id: int,
    start_date: str,
    end_date: str,
    limit: Optional[int] = None,
    sample_method: Optional[str] = "adaptive",  # 'adaptive', 'uniform', 'none'
    db: Session = Depends(get_db)
):
    """
    Obtiene los datos de vibración para un sensor en un rango de fechas, 
    con diferentes métodos de muestreo para optimización de visualización.
    """
    try:
        # Convertir fechas de strings a objetos datetime
        try:
            start_date_obj = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            return create_response(
                data=None,
                message="Formato de fecha inválido. Use ISO format (YYYY-MM-DDTHH:MM:SS)",
                success=False
            )
        
        # Obtener datos de vibración sin procesar
        vibration_data = crud.get_vibration_data_by_sensor_and_dates(
            db, sensor_id, start_date_obj, end_date_obj
        )
        
        if not vibration_data:
            return create_response(
                data=[],
                message="No se encontraron datos para el rango de fechas especificado",
                success=True
            )
        
        # Convertir a lista de diccionarios
        data_list = [remove_sa_instance(item.__dict__) for item in vibration_data]
        
        # Aplicar muestreo si es necesario
        if sample_method != "none" and limit and len(data_list) > limit:
            if sample_method == "uniform":
                # Muestreo uniforme
                indices = np.linspace(0, len(data_list) - 1, limit, dtype=int)
                data_list = [data_list[i] for i in indices]
            elif sample_method == "adaptive":
                # Muestreo adaptativo que conserva extremos
                # Convertir a DataFrame para facilitar el procesamiento
                df = pd.DataFrame(data_list)
                
                # Calcular el "interés" de cada punto basado en la severidad y valores extremos
                df['interest'] = df['severity']
                
                for col in ['acceleration_x', 'acceleration_y', 'acceleration_z']:
                    if col in df.columns:
                        # Normalizar al rango [0,1]
                        min_val = df[col].min()
                        max_val = df[col].max()
                        range_val = max_val - min_val
                        
                        if range_val > 0:
                            normalized = (df[col] - min_val) / range_val
                            # Aumentar interés para valores extremos (cerca de 0 o 1)
                            df['interest'] += abs(normalized - 0.5) * 2
                
                # Ordenar por interés descendente
                df = df.sort_values('interest', ascending=False)
                
                # Tomar los top_n puntos más interesantes
                top_n = min(limit // 3, len(df))
                if top_n > 0:
                    most_interesting = df.head(top_n)
                    remaining = df.iloc[top_n:].copy()
                else:
                    most_interesting = pd.DataFrame()
                    remaining = df.copy()
                
                # Para los puntos restantes, hacer un muestreo uniforme
                remaining_samples = limit - len(most_interesting)
                if remaining_samples > 0 and len(remaining) > remaining_samples:
                    # Reordenar por fecha
                    remaining = remaining.sort_values('date')
                    indices = np.linspace(0, len(remaining) - 1, remaining_samples, dtype=int)
                    uniform_samples = remaining.iloc[indices]
                else:
                    uniform_samples = remaining
                
                # Combinar los puntos interesantes con el muestreo uniforme
                combined = pd.concat([most_interesting, uniform_samples])
                # Reordenar por fecha
                combined = combined.sort_values('date')
                
                # Eliminar la columna de interés y convertir de nuevo a lista de diccionarios
                if 'interest' in combined.columns:
                    combined = combined.drop('interest', axis=1)
                
                data_list = combined.to_dict(orient='records')
        
        # Ordenar por fecha
        data_list.sort(key=lambda x: x['date'])
        
        return create_response(
            data=data_list,
            message=f"Se encontraron {len(data_list)} registros",
            success=True
        )
    
    except Exception as e:
        log_error(e, "Error al obtener datos de vibración")
        return create_response(
            data=None,
            message=f"Error al obtener datos de vibración: {str(e)}",
            success=False
        )

@router.post("/api/sensor_data")
def receive_sensor_data(sensor_data: SensorData, db: Session = Depends(get_db)):
    """
    Recibe y procesa datos de un sensor, prediciendo la condición y generando alertas si es necesario
    """
    try:
        sensor_id = sensor_data.sensor_id
        accel_x = sensor_data.acceleration_x
        accel_y = sensor_data.acceleration_y
        accel_z = sensor_data.acceleration_z
        
        # Verificar si el sensor existe
        sensor = crud.get_sensor_by_id(db, sensor_id)
        if not sensor:
            return create_response(
                data=None,
                message=f"El sensor con ID {sensor_id} no existe",
                success=False
            )
        
        # Obtener el modelo asociado al sensor
        modelo = None
        scaler = None
        
        if sensor.model_id:
            model_record = crud.get_model_by_id(db, sensor.model_id)
            if model_record and model_record.route_h5 and model_record.route_pkl:
                # Intentar cargar el modelo y el escalador
                try:
                    from app.main import load_model_safely, load_scaler_safely
                    modelo = load_model_safely(model_record.route_h5)
                    scaler = load_scaler_safely(model_record.route_pkl)
                except ImportError:
                    log_warning("No se pudo importar las funciones de carga de modelos")
        
        # Predicción inicial (por defecto: normal)
        severity = 0
        
        # Obtener los límites de alerta
        try:
            limit_config = crud.get_limit_config(db)
            if not limit_config:
                # Crear configuración por defecto si no existe
                from app.main import init_default_limits
                limit_config = init_default_limits()
        except Exception as e:
            log_error(e, "Error al obtener límites de alerta")
            # Usar valores por defecto
            limit_config = None
        
        # Evaluar condición básica basada en límites (sin modelo ML)
        error_type = None
        
        if limit_config:
            # Verificar eje X
            if accel_x < limit_config.x_3inf or accel_x > limit_config.x_3sup:
                severity = 3
                error_type = 3
            elif accel_x < limit_config.x_2inf or accel_x > limit_config.x_2sup:
                severity = max(severity, 2)
                error_type = 2 if severity == 2 else error_type
            
            # Verificar eje Y
            if accel_y < limit_config.y_3inf or accel_y > limit_config.y_3sup:
                severity = 3
                error_type = 3
            elif accel_y < limit_config.y_2inf or accel_y > limit_config.y_2sup:
                severity = max(severity, 2)
                error_type = 2 if severity == 2 else error_type
            
            # Verificar eje Z
            if accel_z < limit_config.z_3inf or accel_z > limit_config.z_3sup:
                severity = 3
                error_type = 3
            elif accel_z < limit_config.z_2inf or accel_z > limit_config.z_2sup:
                severity = max(severity, 2)
                error_type = 2 if severity == 2 else error_type
        
        # Guardar datos de vibración
        db_data = crud.create_vibration_data(
            db=db,
            sensor_id=sensor_id,
            acceleration_x=accel_x,
            acceleration_y=accel_y,
            acceleration_z=accel_z,
            severity=severity
        )
        
        # Crear alerta si es necesario
        if error_type:
            alert = models.Alert(
                sensor_id=sensor_id,
                error_type=error_type,
                data_id=db_data.data_id
            )
            crud.create_alert(db, alert)
        
        return create_response(
            data={
                "data_id": db_data.data_id,
                "severity": severity,
                "alert_generated": error_type is not None
            },
            message="Datos recibidos y procesados correctamente",
            success=True
        )
    
    except Exception as e:
        log_error(e, "Error al procesar datos del sensor")
        return create_response(
            data=None,
            message=f"Error al procesar datos del sensor: {str(e)}",
            success=False
        )

@router.post("/api/sensor_data_batch")
def receive_sensor_data_batch(batch_data: SensorDataBatch, db: Session = Depends(get_db)):
    """
    Recibe y procesa un lote de datos de sensores
    """
    try:
        results = []
        
        for sensor_data in batch_data.registros:
            # Reutilizar la función existente para procesar cada registro
            result = receive_sensor_data(sensor_data, db)
            
            # Extraer información relevante
            if result and hasattr(result, "body"):
                import json
                result_dict = json.loads(result.body.decode())
                results.append({
                    "sensor_id": sensor_data.sensor_id,
                    "result": result_dict
                })
            else:
                results.append({
                    "sensor_id": sensor_data.sensor_id,
                    "result": {"success": False, "message": "Error desconocido"}
                })
        
        return create_response(
            data=results,
            message=f"Procesados {len(results)} registros",
            success=True
        )
    
    except Exception as e:
        log_error(e, "Error al procesar lote de datos")
        return create_response(
            data=None,
            message=f"Error al procesar lote de datos: {str(e)}",
            success=False
        )

@router.get("/api/vibration-data")
def get_vibration_data_redirect(
    time_range: str = "day",
    data_type: Optional[str] = None,
    sensor_id: Optional[int] = Query(None),
    machine_id: Optional[int] = Query(None),
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """
    Redirige a la API adecuada para obtener datos de vibración según los parámetros
    """
    # Calcular fechas basadas en time_range
    end_date = datetime.now()
    
    if time_range == "hour":
        start_date = end_date - timedelta(hours=1)
    elif time_range == "day":
        start_date = end_date - timedelta(days=1)
    elif time_range == "week":
        start_date = end_date - timedelta(weeks=1)
    elif time_range == "month":
        start_date = end_date - timedelta(days=30)
    else:
        return create_response(
            data=None,
            message=f"Rango de tiempo no válido: {time_range}",
            success=False
        )
    
    # Si se proporciona machine_id pero no sensor_id, obtener el sensor asociado
    if machine_id is not None and sensor_id is None:
        machine = crud.get_machine_by_id(db, machine_id)
        if machine and machine.sensor_id:
            sensor_id = machine.sensor_id
    
    # Validar que tenemos un sensor_id
    if sensor_id is None:
        return create_response(
            data=None,
            message="Se requiere sensor_id o machine_id con sensor asociado",
            success=False
        )
    
    # Llamar a la función existente con los parámetros adecuados
    return get_vibration_data(
        sensor_id=sensor_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        limit=limit,
        db=db
    ) 