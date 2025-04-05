# app/routers/vibration_data.py

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database import get_db
from app import crud, models
from app.serializers import create_response, remove_sa_instance
from app.logger import log_error, log_info, log_warning, log_scaling
from app.schemas import SensorData, ESP32SensorData, SensorDataBatch, AlertResponse
from app.utils.model_loader import MODELO_DIR, SCALER_DIR, load_model_safely, load_scaler_safely
from app.utils.data_analysis import sample_data_adaptive, sample_data_uniform, process_vibration_data, detect_severity_pattern
from app.utils.notifications import notify_alert

router = APIRouter(tags=["vibration_data"])

# Endpoint unificado para obtener datos de vibración (combina /get_vibration_data y /api/vibration-data)
@router.get("/api/vibration-data")
def get_vibration_data(
    sensor_id: Optional[int] = Query(None, description="ID del sensor"),
    machine_id: Optional[int] = Query(None, description="ID de la máquina"),
    start_date: Optional[str] = Query(None, description="Fecha de inicio (YYYY-MM-DDTHH:MM:SS)"),
    end_date: Optional[str] = Query(None, description="Fecha de fin (YYYY-MM-DDTHH:MM:SS)"),
    time_range: Optional[str] = Query("day", description="Rango de tiempo predefinido: hour, day, week, month"),
    sample_method: Optional[str] = Query("adaptive", description="Método de muestreo: adaptive, uniform, none"),
    limit: int = Query(1000, description="Número máximo de registros a devolver"),
    db: Session = Depends(get_db)
):
    """
    Obtiene los datos de vibración para un sensor en un rango de fechas.
    Soporta dos modos de operación:
    1. Con start_date y end_date específicos
    2. Con time_range predefinido
    """
    try:
        # Si se proporciona machine_id pero no sensor_id, obtener el sensor asociado
        if machine_id is not None and sensor_id is None:
            machine = crud.get_machine_by_id(db, machine_id)
            if machine and machine.sensor_id:
                sensor_id = machine.sensor_id
            else:
                return create_response(
                    data=[],
                    message=f"La máquina con ID {machine_id} no tiene un sensor asociado",
                    success=True
                )
        
        # Validar que tenemos un sensor_id
        if sensor_id is None:
            return create_response(
                data=None,
                message="Se requiere sensor_id o machine_id con sensor asociado",
                success=False
            )
            
        # Si no se proporcionan fechas específicas, usar time_range
        if not start_date or not end_date:
            end_date_obj = datetime.now()
            
            if time_range == "hour":
                start_date_obj = end_date_obj - timedelta(hours=1)
            elif time_range == "week":
                start_date_obj = end_date_obj - timedelta(weeks=1)
            elif time_range == "month":
                start_date_obj = end_date_obj - timedelta(days=30)
            else:  # default: day
                start_date_obj = end_date_obj - timedelta(days=1)
        else:
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
                data_list = sample_data_uniform(data_list, limit)
            elif sample_method == "adaptive":
                data_list = sample_data_adaptive(data_list, limit)
        
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

# Endpoint unificado para recibir datos de sensores (combina /api/sensor_data y /api/vibration-data POST)
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
            # Obtener rutas de modelo y escalador
            ml_model = crud.get_model_by_id(db, sensor.model_id)
            if ml_model and ml_model.route_h5 and ml_model.route_pkl:
                # Cargar modelo y escalador
                modelo = load_model_safely(ml_model.route_h5)
                scaler = load_scaler_safely(ml_model.route_pkl)
        
        # Si no hay modelo específico para el sensor, usar modelos por defecto
        if modelo is None or scaler is None:
            # Aquí va la lógica para cargar modelos por defecto
            model_path = os.path.join(MODELO_DIR, "modeloRNN_multiclase_v3_finetuned.h5")
            scaler_path = os.path.join(SCALER_DIR, "scaler_RNN.pkl")
            scaler_joblib_path = os.path.join(SCALER_DIR, "scaler_RNN_joblib.pkl")
            
            if modelo is None:
                modelo = load_model_safely(model_path)
            
            if scaler is None:
                # Intentar primero con joblib
                scaler = load_scaler_safely(scaler_joblib_path)
                if scaler is None:
                    scaler = load_scaler_safely(scaler_path)
        
        # Obtener los límites de alerta
        limit_config = crud.get_limit_config(db)
        
        # Evaluar condición basada en límites
        severity, error_type = process_vibration_data(accel_x, accel_y, accel_z, limit_config)
            
        # Guardar los datos de vibración con la severidad calculada
        vibration_data = crud.create_vibration_data(
            db, 
            sensor_id=sensor_id, 
            acceleration_x=accel_x, 
            acceleration_y=accel_y, 
            acceleration_z=accel_z,
            severity=severity
        )
        
        # Crear alerta si es necesario
        alert_created = False
        alert_id = None
        if error_type:
            alert = models.Alert(
                sensor_id=sensor_id,
                error_type=error_type,
                data_id=vibration_data.data_id
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            alert_id = alert.log_id
            alert_created = True
            
            # Notificar sobre la alerta generada
            notify_alert(db, alert_id, error_type, str(sensor_id))
            
        return create_response(
            data={
                "sensor_id": sensor_id,
                "data_id": vibration_data.data_id,
                "severity": severity,
                "alert_generated": alert_created
            },
            message="Datos de vibración recibidos y procesados correctamente",
            success=True
        )
        
    except Exception as e:
        log_error(e, "Error al recibir datos del sensor")
        return create_response(
            data=None,
            message=f"Error al procesar los datos: {str(e)}",
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

@router.post("/api/vibration-data")
def receive_esp32_data(sensor_data: ESP32SensorData, db: Session = Depends(get_db)):
    """
    Recibe y procesa datos de un sensor ESP32, con formato específico que incluye sensor_id como string
    y timestamp como Unix timestamp.
    """
    try:
        # Extraer datos del payload
        sensor_id_str = sensor_data.sensor_id
        timestamp = sensor_data.timestamp
        accel_x = sensor_data.acceleration_x
        accel_y = sensor_data.acceleration_y
        accel_z = sensor_data.acceleration_z
        
        # Logging de la recepción para auditoría
        log_info(f"Recibidos datos del sensor {sensor_id_str}. Timestamp: {timestamp}, Aceleraciones: [{accel_x}, {accel_y}, {accel_z}]")
        
        # Buscar el sensor por nombre o identificador
        sensor = crud.get_sensor_by_name(db, sensor_id_str)
        
        # Si no se encuentra, intentar convertir a ID numérico
        if not sensor:
            try:
                # Verificar si el sensor_id contiene un número al final
                import re
                numeric_part = re.search(r'\d+$', sensor_id_str)
                if numeric_part:
                    sensor_id_int = int(numeric_part.group())
                    sensor = crud.get_sensor_by_id(db, sensor_id_int)
            except (ValueError, TypeError):
                pass
                
        if not sensor:
            log_warning(f"El sensor con ID {sensor_id_str} no existe en la base de datos")
            return create_response(
                data=None,
                message=f"El sensor {sensor_id_str} no está registrado en el sistema",
                success=False,
                status_code=404
            )
            
        # Ahora tenemos el ID numérico del sensor
        numeric_sensor_id = sensor.sensor_id
        
        # Cargar el modelo y escalador según la configuración del sensor
        model_to_use = None  
        scaler_to_use = None
        scaler_path = "No disponible"
        
        # Verificar si hay un modelo asociado al sensor
        if sensor.model_id:
            model_record = crud.get_model_by_id(db, sensor.model_id)
            if model_record:
                # Intentar cargar el modelo si está disponible
                if model_record.route_h5:
                    model_to_use = load_model_safely(model_record.route_h5)
                    if model_to_use:
                        log_info(f"Modelo cargado correctamente para sensor {sensor_id_str}: {model_record.route_h5}")
                
                # Intentar cargar el escalador si está disponible
                if model_record.route_pkl:
                    scaler_path = model_record.route_pkl
                    scaler_to_use = load_scaler_safely(model_record.route_pkl)
                    if scaler_to_use:
                        log_info(f"Escalador cargado correctamente para sensor {sensor_id_str}: {model_record.route_pkl}")
        
        # Preparar los datos para el modelo (triaxial)
        original_data = [accel_x, accel_y, accel_z]
        data_array = np.array([original_data], dtype=np.float32)
        
        # Inicializar variables para resultados de predicción
        severity = 0
        error_type = None
        confidence = 0
        
        # Si tenemos escalador, aplicarlo
        if scaler_to_use:
            try:
                data_array_scaled = scaler_to_use.transform(data_array)
                
                # Registrar valores escalados usando la función especializada
                scaled_data = data_array_scaled[0].tolist()
                log_scaling(
                    original_values=original_data,
                    scaled_values=scaled_data,
                    scaler_info=scaler_path,
                    sensor_id=sensor_id_str,
                    success=True
                )
                
                # Si tenemos modelo, realizar predicción con datos escalados
                if model_to_use:
                    # Ajustar forma para el modelo (1, timesteps, features) - para RNN/LSTM
                    rnn_input = data_array_scaled.reshape(1, 1, 3)
                    
                    try:
                        prediction = model_to_use.predict(rnn_input, verbose=0)
                        severity = int(np.argmax(prediction[0]))
                        confidence = float(np.max(prediction)) * 100
                        error_type = severity if severity > 0 else None
                        
                        log_info(f"[PREDICCIÓN] Resultado: clase={severity}, "
                                 f"confianza={confidence:.2f}%, probabilidades={prediction[0]}")
                    except Exception as e:
                        log_error(e, f"Error al realizar la predicción para sensor {sensor_id_str}")
            except Exception as e:
                log_error(e, f"Error al aplicar el escalador para sensor {sensor_id_str}")
                log_scaling(
                    original_values=original_data,
                    scaler_info=scaler_path,
                    sensor_id=sensor_id_str,
                    success=False
                )
                log_warning(f"Usando datos sin escalar debido a error con el escalador")
        else:
            log_warning(f"No hay escalador disponible para el sensor {sensor_id_str}")
        
        # Si no se realizó predicción con el modelo, evaluar con límites estáticos
        if severity == 0 and not error_type:
            # Obtener los límites de alerta
            limit_config = crud.get_limit_config(db)
            if limit_config:
                # Usar la función de procesamiento de datos para evaluar los límites
                severity, error_type = process_vibration_data(accel_x, accel_y, accel_z, limit_config)
        
        # Convertir timestamp Unix a datetime si está disponible
        date = datetime.fromtimestamp(timestamp) if timestamp else None
        
        # Guardar datos de vibración
        db_data = crud.create_vibration_data_with_date(
            db=db,
            sensor_id=numeric_sensor_id,
            acceleration_x=accel_x,
            acceleration_y=accel_y,
            acceleration_z=accel_z,
            severity=severity,
            date=date
        )
        
        # Crear alerta si es necesario
        alert_created = False
        alert_id = None
        if error_type:
            alert = models.Alert(
                sensor_id=numeric_sensor_id,
                error_type=error_type,
                data_id=db_data.data_id,
                timestamp=date
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            alert_id = alert.log_id
            alert_created = True
            log_info(f"Alerta generada para sensor {sensor_id_str} con severidad {error_type}")
            
            # Notificar sobre la alerta generada
            notify_alert(db, alert_id, error_type, sensor_id_str)
        
        # Detectar patrones de severidad 2 en el tiempo
        if severity == 2 and not alert_created:
            # Verificar si hay un patrón de alertas de nivel 2 que justifique una alerta de nivel 3
            alert_level3 = detect_severity_pattern(db, numeric_sensor_id, date)
            if alert_level3:
                # Crear una alerta de nivel 3 basada en el patrón
                pattern_alert = models.Alert(
                    sensor_id=numeric_sensor_id,
                    error_type=3,  # Nivel 3 (crítico)
                    data_id=db_data.data_id,
                    timestamp=date
                )
                db.add(pattern_alert)
                db.commit()
                db.refresh(pattern_alert)
                alert_id = pattern_alert.log_id
                alert_created = True
                log_info(f"ALERTA CRÍTICA (NIVEL 3) generada para sensor {sensor_id_str} basada en patrón de severidad")
                
                # Notificar sobre la alerta crítica generada
                notify_alert(db, alert_id, 3, sensor_id_str)
        
        # Obtener máquina asociada con este sensor para información adicional
        machine = None
        try:
            machine = crud.get_machine_by_sensor_id(db, numeric_sensor_id)
        except Exception as e:
            log_warning(f"No se pudo obtener la máquina asociada al sensor {numeric_sensor_id}: {str(e)}")
        
        # Crear respuesta con información completa
        return create_response(
            data={
                "data_id": db_data.data_id,
                "sensor_id": numeric_sensor_id,
                "sensor_id_str": sensor_id_str,
                "machine_id": machine.machine_id if machine else None,
                "machine_name": machine.name if machine else None,
                "severity": severity,
                "confidence": confidence if confidence > 0 else None,
                "alert_generated": alert_created,
                "timestamp": timestamp,
                "processed_datetime": datetime.now().isoformat(),
                "preprocessing": {
                    "scaler_applied": scaler_to_use is not None,
                    "model_applied": model_to_use is not None,
                    "scaler_path": scaler_path if scaler_to_use else None
                }
            },
            message="Datos del ESP32 recibidos y procesados correctamente",
            success=True,
            status_code=201
        )
    
    except Exception as e:
        log_error(e, f"Error al procesar datos del sensor ESP32 {sensor_data.sensor_id}")
        return create_response(
            data=None,
            message=f"Error al procesar datos del sensor: {str(e)}",
            success=False,
            status_code=500
        )

@router.get("/api/alerts")
def get_alerts(
    sensor_id: Optional[int] = None,
    machine_id: Optional[int] = None,
    error_type: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene alertas filtradas por diferentes criterios
    
    Args:
        sensor_id: ID del sensor para filtrar
        machine_id: ID de la máquina para filtrar (se obtiene el sensor asociado)
        error_type: Tipo de error/severidad (1, 2 o 3)
        start_date: Fecha de inicio (formato ISO: YYYY-MM-DDTHH:MM:SS)
        end_date: Fecha de fin (formato ISO: YYYY-MM-DDTHH:MM:SS)
        limit: Número máximo de alertas a devolver
    """
    try:
        # Si se proporciona machine_id pero no sensor_id, obtener el sensor asociado
        if machine_id is not None and sensor_id is None:
            machine = crud.get_machine_by_id(db, machine_id)
            if machine and machine.sensor_id:
                sensor_id = machine.sensor_id
            else:
                return create_response(
                    data=[],
                    message=f"La máquina con ID {machine_id} no tiene un sensor asociado",
                    success=True
                )
        
        # Convertir fechas si se proporcionan
        start_datetime = None
        end_datetime = None
        
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                return create_response(
                    data=None,
                    message="Formato de fecha de inicio inválido. Use formato ISO (YYYY-MM-DDTHH:MM:SS)",
                    success=False,
                    status_code=400
                )
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                return create_response(
                    data=None,
                    message="Formato de fecha de fin inválido. Use formato ISO (YYYY-MM-DDTHH:MM:SS)",
                    success=False,
                    status_code=400
                )
        
        # Construir la consulta base
        query = db.query(models.Alert)
        
        # Aplicar filtros según los parámetros recibidos
        if sensor_id is not None:
            query = query.filter(models.Alert.sensor_id == sensor_id)
        
        if error_type is not None:
            query = query.filter(models.Alert.error_type == error_type)
            
        if start_datetime:
            query = query.filter(models.Alert.timestamp >= start_datetime)
            
        if end_datetime:
            query = query.filter(models.Alert.timestamp <= end_datetime)
        
        # Ordenar por timestamp descendente y limitar resultados
        alerts = query.order_by(models.Alert.timestamp.desc()).limit(limit).all()
        
        # Si no hay resultados, devolver lista vacía
        if not alerts:
            return create_response(
                data=[],
                message="No se encontraron alertas con los criterios especificados",
                success=True
            )
        
        # Procesar resultados para incluir información adicional
        result_alerts = []
        for alert in alerts:
            # Obtener información del sensor
            sensor = crud.get_sensor_by_id(db, alert.sensor_id)
            sensor_name = sensor.name if sensor else f"Sensor {alert.sensor_id}"
            
            # Obtener información de la máquina
            machine = None
            if sensor:
                machine = crud.get_machine_by_sensor_id(db, sensor.sensor_id)
            
            # Obtener datos de aceleración relacionados
            accel_data = None
            if alert.data_id:
                vibration_data = crud.get_vibration_data_by_id(db, alert.data_id)
                if vibration_data:
                    accel_data = {
                        "x": vibration_data.get("acceleration_x"),
                        "y": vibration_data.get("acceleration_y"),
                        "z": vibration_data.get("acceleration_z"),
                        "date": vibration_data.get("date")
                    }
            
            # Mapear tipo de error a descripción
            error_descriptions = {
                1: "Anomalía leve",
                2: "Anomalía moderada",
                3: "Anomalía crítica"
            }
            error_description = error_descriptions.get(alert.error_type, "Desconocido")
            
            # Crear objeto de respuesta
            alert_response = {
                "log_id": alert.log_id,
                "sensor_id": alert.sensor_id,
                "sensor_name": sensor_name,
                "timestamp": alert.timestamp.isoformat(),
                "error_type": alert.error_type,
                "error_description": error_description,
                "data_id": alert.data_id,
                "acceleration_data": accel_data,
                "machine_name": machine.name if machine else None
            }
            
            result_alerts.append(alert_response)
        
        return create_response(
            data=result_alerts,
            message=f"Se encontraron {len(result_alerts)} alertas",
            success=True
        )
    
    except Exception as e:
        log_error(e, "Error al obtener alertas")
        return create_response(
            data=None,
            message=f"Error al obtener alertas: {str(e)}",
            success=False,
            status_code=500
        ) 