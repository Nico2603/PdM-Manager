# app/main.py

import os
from datetime import datetime, timedelta
import numpy as np
import pickle
import joblib
import shutil
import hashlib
import pandas as pd

from fastapi import FastAPI, Depends, HTTPException, Body, File, UploadFile, Form, Query, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
import json
from werkzeug.utils import secure_filename

# Importar TensorFlow para cargar el modelo
from tensorflow.keras.models import load_model

# Importar componentes para manejo de errores y logs
from app.error_handlers import configure_error_handlers
from app.logger import logger, log_error, log_info, log_db_error, log_warning
from app.serializers import serialize_model, serialize_list, remove_sa_instance, create_response

# Importar la configuración de Pydantic
from app.config import pydantic_config

# Importar la configuración de la BD y el modelo de datos
from app.database import engine, Base, get_db
from app import crud, models

# Modelos Pydantic adicionales para creación/actualización de modelos ML
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

# Definir rutas base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")

# Configurar variable de entorno para evitar diferencias numéricas
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# Función para cargar el modelo y el escalador
def load_model_and_scaler():
    """
    Carga el modelo y el escalador desde las ubicaciones predeterminadas.
    Retorna un diccionario con el estado de la carga y mensajes informativos.
    """
    global modelo, scaler
    
    model_path = os.path.join(MODELO_DIR, "modeloRNN_multiclase_v3_finetuned.h5")
    scaler_path = os.path.join(SCALER_DIR, "scaler_RNN.pkl")
    
    result = {
        "status": "error",
        "message": "",
        "model_loaded": False,
        "scaler_loaded": False
    }
    
    # Verificar existencia de directorios
    if not os.path.exists(MODELO_DIR):
        os.makedirs(MODELO_DIR, exist_ok=True)
        result["message"] = f"Se creó el directorio de modelos en: {MODELO_DIR}"
    
    if not os.path.exists(SCALER_DIR):
        os.makedirs(SCALER_DIR, exist_ok=True)
        result["message"] += f". Se creó el directorio de escaladores en: {SCALER_DIR}"
    
    # Intentar cargar el modelo
    try:
        if os.path.exists(model_path):
            modelo = load_model(model_path)
            result["model_loaded"] = True
            log_info(f"Modelo cargado correctamente desde: {model_path}")
        else:
            log_warning(f"Archivo de modelo no encontrado en: {model_path}")
            modelo = None
    except Exception as e:
        error_msg = f"Error al cargar el modelo: {str(e)}"
        log_error(e, error_msg)
        modelo = None
        result["message"] = error_msg
    
    # Intentar cargar el escalador
    try:
        if os.path.exists(scaler_path):
            with open(scaler_path, 'rb') as f:
                scaler = pickle.load(f)
            result["scaler_loaded"] = True
            log_info(f"Escalador cargado correctamente desde: {scaler_path}")
        else:
            log_warning(f"Archivo de escalador no encontrado en: {scaler_path}")
            scaler = None
    except Exception as e:
        error_msg = f"Error al cargar el escalador: {str(e)}"
        log_error(e, error_msg)
        scaler = None
        if result["message"]:
            result["message"] += f". {error_msg}"
        else:
            result["message"] = error_msg
    
    # Establecer estado general
    if result["model_loaded"] and result["scaler_loaded"]:
        result["status"] = "ok"
        if not result["message"]:
            result["message"] = "Modelo y escalador cargados correctamente"
    elif result["model_loaded"]:
        result["status"] = "partial"
        if not result["message"]:
            result["message"] = "Modelo cargado correctamente, pero no se pudo cargar el escalador"
    elif result["scaler_loaded"]:
        result["status"] = "partial"
        if not result["message"]:
            result["message"] = "Escalador cargado correctamente, pero no se pudo cargar el modelo"
    
    return result

# Funciones auxiliares para cargar modelos y escaladores específicos
def load_model_safely(model_path):
    """Carga un modelo desde una ruta específica de forma segura"""
    try:
        if os.path.exists(model_path):
            model = load_model(model_path)
            log_info(f"Modelo cargado correctamente desde: {model_path}")
            return model
        else:
            log_warning(f"Archivo de modelo no encontrado en: {model_path}")
            return None
    except Exception as e:
        error_msg = f"Error al cargar el modelo desde {model_path}: {str(e)}"
        log_error(e, error_msg)
        return None

def load_scaler_safely(scaler_path):
    """Carga un escalador desde una ruta específica de forma segura"""
    try:
        if os.path.exists(scaler_path):
            with open(scaler_path, 'rb') as f:
                scaler_obj = pickle.load(f)
            log_info(f"Escalador cargado correctamente desde: {scaler_path}")
            return scaler_obj
        else:
            log_warning(f"Archivo de escalador no encontrado en: {scaler_path}")
            return None
    except Exception as e:
        error_msg = f"Error al cargar el escalador desde {scaler_path}: {str(e)}"
        log_error(e, error_msg)
        return None

# Cargar el modelo y el scaler
load_result = load_model_and_scaler()
print(f"Resultado de carga inicial: {load_result['status']} - {load_result['message']}")

# Diccionario para mapear severidad a texto legible
SEVERITY_MAPPING = {
    0: "Normal",
    1: "Nivel 1",
    2: "Nivel 2",
    3: "Nivel 3 (Crítico)"
}

# Crear la aplicación FastAPI
app = FastAPI(
    title="PdM-Manager API",
    description="API para el sistema de mantenimiento predictivo",
    version="1.0.0"
)

# Configuración global para modelos Pydantic utilizados por FastAPI
from fastapi.applications import FastAPI
from pydantic import __version__ as pydantic_version
from packaging import version

# Para versiones recientes de Pydantic (v2+)
if version.parse(pydantic_version) >= version.parse("2.0.0"):
    app.openapi_config = {"model_config": pydantic_config}
# Para versiones antiguas de Pydantic (v1.x)
else:
    from pydantic import BaseConfig
    BaseConfig.orm_mode = True
    BaseConfig.protected_namespaces = ()

# Crear las tablas en la BD (solo si no existen)
Base.metadata.create_all(bind=engine)

# Configurar los manejadores de errores
configure_error_handlers(app)

# Configurar middleware
from app.middleware import configure_middleware
configure_middleware(app)

# Registrar inicio de la aplicación
log_info("Iniciando aplicación PdM-Manager API")

# Montar la carpeta estática (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configuración para favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(BASE_DIR, "static", "img", "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    else:
        return JSONResponse(content={"message": "Favicon not found"}, status_code=404)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos Pydantic para validación de datos
class SensorData(BaseModel):
    sensor_id: int
    acceleration_x: float
    acceleration_y: float
    acceleration_z: float
    
    model_config = pydantic_config

class SensorDataBatch(BaseModel):
    registros: List[SensorData]
    
    model_config = pydantic_config

@app.get("/")
def root():
    """Devuelve la página principal (index.html)"""
    return FileResponse("static/index.html")

@app.get("/check_db")
def check_db(db: Session = Depends(get_db)):
    """
    Comprueba la conexión a la base de datos.
    """
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        log_info("Verificación de conexión a base de datos exitosa")
        return create_response(
            success=True,
            message="Conexión a la base de datos establecida correctamente",
            data={"status": "conectado"}
        )
    except Exception as e:
        error_msg = log_error(e, "Error al verificar la conexión a la base de datos")
        raise HTTPException(
            status_code=500, 
            detail=f"Error de conexión a la base de datos: {error_msg}"
        )

@app.get("/get_vibration_data")
def get_vibration_data(
    sensor_id: int,
    start_date: str,
    end_date: str,
    limit: Optional[int] = None,
    sample_method: Optional[str] = "adaptive",  # 'adaptive', 'uniform', 'none'
    db: Session = Depends(get_db)
):
    """
    Obtiene datos de vibración para un sensor específico en un rango de fechas.
    Implementa muestreo adaptativo para grandes conjuntos de datos.
    """
    try:
        # Convertir fechas a objetos datetime
        try:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha incorrecto. Use ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)")
        
        # Crear consulta base que aprovecha el índice compuesto sensor_id + date
        query = db.query(models.VibrationData).filter(
            models.VibrationData.sensor_id == sensor_id,
            models.VibrationData.date >= start_dt,
            models.VibrationData.date <= end_dt
        ).order_by(models.VibrationData.date)
        
        # Primero determinamos el tamaño del conjunto de datos (solo contamos, no traemos datos)
        total_count = query.count()
        
        # Si no hay datos, devolver respuesta vacía
        if total_count == 0:
            return {
                "sensor_id": sensor_id,
                "fechas": [],
                "acceleration_x": [],
                "acceleration_y": [],
                "acceleration_z": [],
                "severities": [],
                "severity_texts": []
            }
        
        # Determinar si necesitamos aplicar muestreo
        sampling_rate = None
        
        # Aplicar muestreo basado en el método seleccionado y tamaño de datos
        if sample_method != "none" and limit and total_count > limit:
            if sample_method == "uniform":
                # Muestreo uniforme: tomar datos a intervalos regulares
                sampling_rate = total_count // limit
                
                # Utilizar window function para seleccionar puntos uniformemente distribuidos
                # Esta optimización reduce la cantidad de consultas a la base de datos
                sample_query = db.execute(text(f"""
                    SELECT data_id, sensor_id, date, acceleration_x, acceleration_y, acceleration_z, severity
                    FROM (
                        SELECT *, ROW_NUMBER() OVER (ORDER BY date) as row_num
                        FROM vibration_data
                        WHERE sensor_id = :sensor_id 
                        AND date BETWEEN :start_date AND :end_date
                    ) AS numbered
                    WHERE row_num % :sampling_rate = 0
                    ORDER BY date
                    LIMIT :limit
                """), {
                    "sensor_id": sensor_id,
                    "start_date": start_dt,
                    "end_date": end_dt,
                    "sampling_rate": sampling_rate,
                    "limit": limit
                })
                
                # Convertir a lista de diccionarios
                data_list = [dict(row) for row in sample_query]
                
            elif sample_method == "adaptive":
                # Muestreo adaptativo: mayor densidad en zonas de cambio de severidad
                
                # 1. Obtener primero todos los puntos donde hay cambio de severidad
                severity_changes = db.execute(text("""
                    SELECT v1.*
                    FROM vibration_data v1
                    JOIN (
                        SELECT date, LAG(severity) OVER (ORDER BY date) as prev_severity, severity
                        FROM vibration_data
                        WHERE sensor_id = :sensor_id 
                        AND date BETWEEN :start_date AND :end_date
                    ) v2 ON v1.date = v2.date
                    WHERE v1.sensor_id = :sensor_id
                    AND v1.date BETWEEN :start_date AND :end_date
                    AND (v2.prev_severity IS NULL OR v2.prev_severity != v2.severity)
                    ORDER BY v1.date
                """), {
                    "sensor_id": sensor_id,
                    "start_date": start_dt,
                    "end_date": end_dt
                })
                
                # Convertir a lista de diccionarios para los puntos de cambio
                key_points = [dict(row) for row in severity_changes]
                
                # 2. Si tenemos pocos puntos de cambio, añadir puntos adicionales
                remaining_points = limit - len(key_points)
                
                if remaining_points > 0 and len(key_points) < limit:
                    # Muestreo uniforme para los puntos restantes
                    remaining_rate = total_count // remaining_points
                    
                    # Obtener IDs de puntos clave para excluirlos
                    key_ids = [p['data_id'] for p in key_points]
                    key_ids_str = ','.join(str(id) for id in key_ids) if key_ids else '0'
                    
                    # Obtener puntos adicionales uniformemente distribuidos, excluyendo los puntos clave
                    additional_query = db.execute(text(f"""
                        SELECT data_id, sensor_id, date, acceleration_x, acceleration_y, acceleration_z, severity
                        FROM (
                            SELECT *, ROW_NUMBER() OVER (ORDER BY date) as row_num
                            FROM vibration_data
                            WHERE sensor_id = :sensor_id 
                            AND date BETWEEN :start_date AND :end_date
                            AND data_id NOT IN ({key_ids_str})
                        ) AS numbered
                        WHERE row_num % :sampling_rate = 0
                        ORDER BY date
                        LIMIT :limit
                    """), {
                        "sensor_id": sensor_id,
                        "start_date": start_dt,
                        "end_date": end_dt,
                        "sampling_rate": remaining_rate,
                        "limit": remaining_points
                    })
                    
                    # Añadir a la lista de puntos
                    additional_points = [dict(row) for row in additional_query]
                    data_list = key_points + additional_points
                    
                    # Ordenar por fecha
                    data_list.sort(key=lambda x: x['date'])
                else:
                    data_list = key_points
        else:
            # Sin muestreo, obtener todos los datos o el límite especificado
            if limit and limit < total_count:
                data_list = query.limit(limit).all()
            else:
                data_list = query.all()
        
        # Preparar el resultado final con formato optimizado
        result = {
            "sensor_id": sensor_id,
            "fechas": [],
            "acceleration_x": [],
            "acceleration_y": [],
            "acceleration_z": [],
            "severities": [],
            "severity_texts": []
        }
        
        # Extraer datos en listas separadas para JSON optimizado
        for d in data_list:
            # Si es un objeto SQLAlchemy ORM o un diccionario
            if hasattr(d, 'date'):
                # Es un objeto ORM
                result["fechas"].append(d.date.isoformat())
                result["acceleration_x"].append(float(d.acceleration_x) if d.acceleration_x is not None else None)
                result["acceleration_y"].append(float(d.acceleration_y) if d.acceleration_y is not None else None)
                result["acceleration_z"].append(float(d.acceleration_z) if d.acceleration_z is not None else None)
                severity = d.severity
                result["severities"].append(severity)
                result["severity_texts"].append(SEVERITY_MAPPING.get(severity, "Desconocido") if severity is not None else None)
            else:
                # Es un diccionario
                result["fechas"].append(d['date'].isoformat())
                result["acceleration_x"].append(float(d['acceleration_x']) if d['acceleration_x'] is not None else None)
                result["acceleration_y"].append(float(d['acceleration_y']) if d['acceleration_y'] is not None else None)
                result["acceleration_z"].append(float(d['acceleration_z']) if d['acceleration_z'] is not None else None)
                severity = d['severity']
                result["severities"].append(severity)
                result["severity_texts"].append(SEVERITY_MAPPING.get(severity, "Desconocido") if severity is not None else None)
        
        # Agregar información de muestreo si se aplicó
        if sampling_rate:
            result["sampling_info"] = {
                "original_count": total_count,
                "sampled_count": len(data_list),
                "sampling_rate": sampling_rate,
                "method": sample_method
            }
        
        return result
    except Exception as e:
        print(f"Error al obtener datos de vibración: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/predict_condition")
def predict_condition(
    sensor_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    1) Consulta datos de vibración en la BD (sensor + rango de fechas).
    2) Ajusta la forma del array según requiera tu RNN.
    3) Devuelve la predicción (0, 1, 2).
    """
    # Convertir fechas
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )

    # Obtener datos
    data_list = crud.get_vibration_data_by_sensor_and_dates(db, sensor_id, start_dt, end_dt)
    if not data_list:
        raise HTTPException(
            status_code=404,
            detail="No hay datos para ese sensor y rango de fechas."
        )

    # Construir array numpy con los datos de aceleración
    arr = []
    for d in data_list:
        arr.append([
            float(d.acceleration_x or 0),
            float(d.acceleration_y or 0),
            float(d.acceleration_z or 0)
        ])

    arr = np.array(arr, dtype=np.float32)
    
    # Aplicar escalado si el escalador está disponible
    if scaler:
        # Ajustamos el formato para el escalador (2D: [n_samples, n_features])
        arr_2d = arr.reshape(-1, 3)
        arr_scaled = scaler.transform(arr_2d)
        # Volver a la forma 3D para la RNN
        arr = arr_scaled.reshape((1, len(data_list), 3))
    else:
        # Si no hay escalador, solo ajustamos la forma
        arr = arr.reshape((1, arr.shape[0], 3))

    # Hacer la predicción
    pred = modelo.predict(arr)
    predicted_class = int(np.argmax(pred, axis=1)[0])
    severity_text = SEVERITY_MAPPING.get(predicted_class, "Desconocido")
    confidence = float(np.max(pred)) * 100  # Confianza en porcentaje

    return {
        "sensor_id": sensor_id,
        "prediction": {
            "class": predicted_class,
            "severity": severity_text,
            "confidence": confidence
        }
    }

@app.post("/api/sensor_data")
def receive_sensor_data(sensor_data: SensorData, db: Session = Depends(get_db)):
    """
    Recibe datos del sensor y procesa:
    1. Validación
    2. Predicción con modelo
    3. Registro en base de datos
    4. Generación de alertas si severity >= 1
    """
    # Obtener sensor
    sensor = crud.get_sensor(db, sensor_id=sensor_data.sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor {sensor_data.sensor_id} no encontrado")
    
    # Verificar si hay un modelo asociado al sensor
    model_to_use = modelo  # Usar modelo global por defecto
    scaler_to_use = scaler  # Usar escalador global por defecto
    
    if sensor.model_id:
        model = crud.get_model(db, model_id=sensor.model_id)
        if model and model.route_h5:
            # Intentar cargar el modelo específico
            custom_model = load_model_safely(model.route_h5)
            if custom_model:
                model_to_use = custom_model
                log_info(f"Usando modelo personalizado para sensor {sensor_data.sensor_id}: {model.name}")
            
            # Intentar cargar el escalador específico si existe
            if model.route_pkl:
                custom_scaler = load_scaler_safely(model.route_pkl)
                if custom_scaler:
                    scaler_to_use = custom_scaler
                    log_info(f"Usando escalador personalizado para sensor {sensor_data.sensor_id}")
    
    # Buscar si este sensor está asociado a una máquina
    machine = None
    if sensor.sensor_id:
        machines = crud.get_machines_by_sensor(db, sensor.sensor_id)
        if machines and len(machines) > 0:
            # Usar la primera máquina asociada
            machine = machines[0]
    
    # Preparar los datos para el modelo (triaxial)
    data_array = np.array([[
        sensor_data.acceleration_x,
        sensor_data.acceleration_y,
        sensor_data.acceleration_z
    ]], dtype=np.float32)
    
    # Escalar datos si el escalador está disponible
    if scaler_to_use:
        data_array = scaler_to_use.transform(data_array)
    
    # Ajustar forma para el modelo RNN (1, timesteps, features)
    rnn_input = data_array.reshape(1, 1, 3)
    
    # Hacer predicción con el modelo
    if model_to_use:
        prediction = model_to_use.predict(rnn_input, verbose=0)
        severity = int(np.argmax(prediction[0]))
        confidence = float(np.max(prediction)) * 100
    else:
        # Si no hay modelo disponible, poner severidad neutral
        log_warning(f"No hay modelo disponible para el sensor {sensor_data.sensor_id}. Usando severidad neutral.")
        severity = 0
        confidence = 0
    
    # Calcular magnitud (para referencia)
    magnitude = np.sqrt(
        sensor_data.acceleration_x**2 + 
        sensor_data.acceleration_y**2 + 
        sensor_data.acceleration_z**2
    )
    
    # Guardar registro en la base de datos
    vibration_data = crud.create_vibration_data(
        db=db,
        sensor_id=sensor_data.sensor_id,
        acceleration_x=sensor_data.acceleration_x,
        acceleration_y=sensor_data.acceleration_y,
        acceleration_z=sensor_data.acceleration_z,
        severity=severity
    )
    
    # Crear alerta si es nivel 1 o superior
    if severity >= 1:
        alert = models.Alert(
            sensor_id=sensor_data.sensor_id,
            error_type=severity,
            data_id=vibration_data.data_id
        )
        crud.create_alert(db, alert)
    
    return {
        "status": "success",
        "data_id": vibration_data.data_id,
        "severity": severity,
        "severity_text": SEVERITY_MAPPING.get(severity, "Desconocido"),
        "confidence": confidence,
        "magnitude": magnitude
    }

@app.post("/api/sensor_data_batch")
def receive_sensor_data_batch(batch_data: SensorDataBatch, db: Session = Depends(get_db)):
    """
    Recibe un lote de datos del sensor, clasifica y guarda en la base de datos
    """
    results = []
    
    for record in batch_data.registros:
        # Verificar que el sensor existe
        sensor = crud.get_sensor_by_id(db, record.sensor_id)
        if not sensor:
            results.append({
                "sensor_id": record.sensor_id,
                "status": "error",
                "error": f"Sensor con ID {record.sensor_id} no encontrado"
            })
            continue
        
        # Si no hay modelo asociado al sensor, usar el modelo por defecto
        model_to_use = modelo  # Usar modelo global por defecto
        scaler_to_use = scaler  # Usar escalador global por defecto
        
        if sensor.model_id:
            # Cargar el modelo y escalador específicos del sensor
            model_info = crud.get_model_by_id(db, sensor.model_id)
            if model_info:
                # Intentar cargar el modelo específico
                if model_info.route_h5:
                    custom_model_path = model_info.route_h5
                    if not os.path.isabs(custom_model_path):
                        custom_model_path = os.path.join(BASE_DIR, custom_model_path)
                    
                    custom_model = load_model_safely(custom_model_path)
                    if custom_model:
                        model_to_use = custom_model
                        log_info(f"Usando modelo personalizado {model_info.name} para sensor {record.sensor_id}")
                
                # Intentar cargar el escalador específico
                if model_info.route_pkl:
                    custom_scaler_path = model_info.route_pkl
                    if not os.path.isabs(custom_scaler_path):
                        custom_scaler_path = os.path.join(BASE_DIR, custom_scaler_path)
                    
                    custom_scaler = load_scaler_safely(custom_scaler_path)
                    if custom_scaler:
                        scaler_to_use = custom_scaler
                        log_info(f"Usando escalador personalizado para sensor {record.sensor_id}")
        
        # Buscar la máquina asociada al sensor para límites configurados
        machine = None
        if sensor.sensor_id:
            machines = crud.get_machines_by_sensor(db, sensor.sensor_id)
            if machines and len(machines) > 0:
                # Usar la primera máquina asociada
                machine = machines[0]
        
        # Preparar los datos para el modelo (triaxial)
        data_array = np.array([[
            record.acceleration_x,
            record.acceleration_y,
            record.acceleration_z
        ]], dtype=np.float32)
        
        # Escalar datos si el escalador está disponible
        if scaler_to_use:
            data_array = scaler_to_use.transform(data_array)
        
        # Ajustar forma para el modelo RNN (1, timesteps, features)
        rnn_input = data_array.reshape(1, 1, 3)
        
        # Hacer predicción con el modelo
        if model_to_use:
            prediction = model_to_use.predict(rnn_input, verbose=0)
            severity = int(np.argmax(prediction[0]))
            confidence = float(np.max(prediction)) * 100
        else:
            # Si no hay modelo disponible, poner severidad neutral
            log_warning(f"No hay modelo disponible para el sensor {record.sensor_id}. Usando severidad neutral.")
            severity = 0
            confidence = 0
        
        # Guardar registro en la base de datos
        vibration_data = crud.create_vibration_data(
            db=db,
            sensor_id=record.sensor_id,
            acceleration_x=record.acceleration_x,
            acceleration_y=record.acceleration_y,
            acceleration_z=record.acceleration_z,
            severity=severity
        )
        
        # Crear alerta si es nivel 1 o superior
        if severity >= 1:
            alert = models.Alert(
                sensor_id=record.sensor_id,
                error_type=severity,
                data_id=vibration_data.data_id
            )
            crud.create_alert(db, alert)
        
        # Agregar resultado
        results.append({
            "sensor_id": record.sensor_id,
            "status": "success",
            "data_id": vibration_data.data_id,
            "severity": severity,
            "severity_text": SEVERITY_MAPPING.get(severity, "Desconocido"),
            "confidence": confidence
        })
    
    return {
        "status": "success",
        "procesados": len(results),
        "resultados": results
    }

@app.get("/reload_model")
def reload_model(db: Session = Depends(get_db)):
    """
    Recarga el modelo y el escalador desde la base de datos o desde las ubicaciones predeterminadas
    """
    global modelo, scaler
    
    try:
        # Primero intentamos buscar un sensor con modelo asignado
        sensor_with_model = db.query(models.Sensor).filter(
            models.Sensor.model_id.isnot(None)
        ).first()
        
        # Si no hay ningún sensor con modelo asignado, cargar el predeterminado
        if not sensor_with_model:
            log_info("No hay sensores con modelos asignados. Cargando modelo predeterminado.")
            result = load_model_and_scaler()
            return {
                "status": result["status"],
                "message": result["message"],
                "model_loaded": result["model_loaded"],
                "scaler_loaded": result["scaler_loaded"]
            }
        
        # Obtener el modelo de la base de datos
        model = crud.get_model_by_id(db, sensor_with_model.model_id)
        if not model:
            log_warning(f"Modelo ID {sensor_with_model.model_id} no encontrado en la base de datos. Cargando modelo predeterminado.")
            result = load_model_and_scaler()
            return {
                "status": result["status"],
                "message": result["message"],
                "model_loaded": result["model_loaded"],
                "scaler_loaded": result["scaler_loaded"]
            }
        
        # Resultados
        result = {
            "status": "error",
            "message": "",
            "model_loaded": False,
            "scaler_loaded": False,
            "model_name": model.name
        }
        
        # Cargar el modelo
        try:
            if model.route_h5 and os.path.exists(model.route_h5):
                modelo = load_model(model.route_h5)
                result["model_loaded"] = True
                log_info(f"Modelo '{model.name}' cargado correctamente desde: {model.route_h5}")
            else:
                log_warning(f"Ruta de modelo no válida para '{model.name}': {model.route_h5}")
                # Intentar cargar el modelo predeterminado como respaldo
                default_model_path = os.path.join(MODELO_DIR, "modeloRNN_multiclase_v3_finetuned.h5")
                if os.path.exists(default_model_path):
                    modelo = load_model(default_model_path)
                    result["model_loaded"] = True
                    result["message"] = f"Se cargó el modelo predeterminado porque la ruta del modelo '{model.name}' no es válida"
                    log_info(f"Modelo predeterminado cargado como respaldo desde: {default_model_path}")
        except Exception as e:
            error_msg = f"Error al cargar el modelo '{model.name}': {str(e)}"
            log_error(e, error_msg)
            result["message"] = error_msg
        
        # Intentar cargar el escalador asociado al modelo
        try:
            if model.route_pkl and os.path.exists(model.route_pkl):
                with open(model.route_pkl, 'rb') as f:
                    scaler = pickle.load(f)
                result["scaler_loaded"] = True
                log_info(f"Escalador para el modelo '{model.name}' cargado correctamente desde: {model.route_pkl}")
            else:
                log_warning(f"Ruta de escalador no válida para '{model.name}': {model.route_pkl}")
                # Intentar cargar el escalador predeterminado como respaldo
                default_scaler_path = os.path.join(SCALER_DIR, "scaler_RNN.pkl")
                if os.path.exists(default_scaler_path):
                    with open(default_scaler_path, 'rb') as f:
                        scaler = pickle.load(f)
                    result["scaler_loaded"] = True
                    if result["message"]:
                        result["message"] += ". "
                    result["message"] += f"Se cargó el escalador predeterminado porque la ruta del escalador para '{model.name}' no es válida"
                    log_info(f"Escalador predeterminado cargado como respaldo desde: {default_scaler_path}")
        except Exception as e:
            error_msg = f"Error al cargar el escalador para '{model.name}': {str(e)}"
            log_error(e, error_msg)
            if result["message"]:
                result["message"] += f". {error_msg}"
            else:
                result["message"] = error_msg
        
        # Establecer estado general
        if result["model_loaded"] and result["scaler_loaded"]:
            result["status"] = "ok"
            if not result["message"]:
                result["message"] = f"Modelo '{model.name}' y su escalador cargados correctamente"
        elif result["model_loaded"]:
            result["status"] = "partial"
            if not result["message"]:
                result["message"] = f"Modelo '{model.name}' cargado correctamente, pero no se pudo cargar el escalador"
        elif result["scaler_loaded"]:
            result["status"] = "partial"
            if not result["message"]:
                result["message"] = f"Escalador para '{model.name}' cargado correctamente, pero no se pudo cargar el modelo"
        
        return result
    
    except Exception as e:
        error_msg = f"Error recargando el modelo: {str(e)}"
        log_error(e, error_msg)
        return {"status": "error", "message": error_msg}

@app.get("/api/sensors")
def get_sensors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los sensores con paginación opcional
    """
    try:
        log_info(f"Obteniendo lista de sensores: skip={skip}, limit={limit}")
        sensors = crud.get_sensors(db, skip, limit)
        return create_response(
            success=True,
            data=sensors,
            message=f"Se encontraron {len(sensors)} sensores"
        )
    except Exception as e:
        error_msg = log_error(e, f"Error al obtener lista de sensores (skip={skip}, limit={limit})")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener lista de sensores: {error_msg}"
        )

@app.get("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def get_sensor_info(sensor_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de un sensor por su ID
    """
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    return sensor

@app.post("/api/sensors")
async def create_sensor_endpoint(
    name: str = Form(...),
    description: str = Form(None),
    model_id: int = Form(...),
    machine_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Crear un nuevo sensor"""
    try:
        # Crear nuevo sensor
        sensor = Sensor(
            name=name,
            description=description,
            model_id=model_id
        )
        
        # Crear sensor en la base de datos
        new_sensor = crud.create_sensor(db, sensor)
        
        # Si se especificó una máquina, actualizar la referencia
        if machine_id:
            machine = crud.get_machine_by_id(db, machine_id)
            if machine:
                machine.sensor_id = new_sensor["sensor_id"]
                crud.update_machine(db, machine)
                
                # Notificar actualización de máquinas
                await ws_manager.broadcast_update("machine_update")
        
        # Notificar a todos los clientes conectados sobre el nuevo sensor
        await ws_manager.broadcast_update("sensor_update")
        
        return create_response(
            data=new_sensor,
            message="Sensor creado con éxito"
        )
    except Exception as e:
        log_error(e, "Error al crear sensor")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/sensors/{sensor_id}")
async def update_sensor_endpoint(
    sensor_id: int,
    name: str = Form(None),
    description: str = Form(None),
    model_id: Optional[int] = Form(None),
    machine_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Actualizar un sensor existente"""
    # Verificar que el sensor existe
    sensor = crud.get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    
    # Actualizar campos si se proporcionaron
    if name is not None:
        sensor.name = name
    if description is not None:
        sensor.description = description
    if model_id is not None:
        # Verificar que el modelo existe
        model = crud.get_model_by_id(db, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        sensor.model_id = model_id
    
    # Actualizar el sensor
    updated_sensor = crud.update_sensor(db, sensor)
    
    # Manejar la asociación con máquina si se especificó
    if machine_id is not None:
        machine = crud.get_machine_by_id(db, machine_id)
        if not machine:
            raise HTTPException(status_code=404, detail="Máquina no encontrada")
        
        # Establecer este sensor en la máquina especificada
        machine.sensor_id = sensor_id
        crud.update_machine(db, machine)
        
        # Notificar actualización de máquinas
        await ws_manager.broadcast_update("machine_update")
    
    # Notificar a todos los clientes conectados sobre la actualización del sensor
    await ws_manager.broadcast_update("sensor_update")
    
    return create_response(
        data=updated_sensor,
        message="Sensor actualizado con éxito"
    )

@app.delete("/api/sensors/{sensor_id}")
async def delete_sensor_endpoint(sensor_id: int, db: Session = Depends(get_db)):
    """Eliminar un sensor"""
    # Buscar máquinas que usan este sensor
    machines_with_sensor = crud.get_machines_by_sensor(db, sensor_id)
    
    # Eliminar referencias en máquinas
    for machine_dict in machines_with_sensor:
        machine = crud.get_machine_by_id(db, machine_dict["machine_id"])
        if machine:
            machine.sensor_id = None
            crud.update_machine(db, machine)
    
    # Eliminar el sensor
    result = crud.delete_sensor(db, sensor_id)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    
    # Notificar a todos los clientes conectados
    await ws_manager.broadcast_update("sensor_update")
    
    # Si se modificaron máquinas, notificar también
    if machines_with_sensor:
        await ws_manager.broadcast_update("machine_update")
    
    return create_response(
        message="Sensor eliminado con éxito"
    )

@app.get("/api/models")
def get_models(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene todos los modelos disponibles.
    """
    try:
        # Consultar modelos
        models_db = db.query(models.Model).offset(skip).limit(limit).all()
        
        # Formatear respuesta
        result = []
        for model in models_db:
            result.append({
                "model_id": model.model_id,
                "name": model.name,
                "description": model.description,
                "route_h5": model.route_h5,
                "route_pkl": model.route_pkl,
                "created_at": datetime.now().isoformat()
            })
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener modelos: {str(e)}"
        )

@app.get("/api/models/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información de un modelo específico.
    """
    try:
        # Buscar el modelo en la BD
        model = db.query(models.Model).filter(models.Model.model_id == model_id).first()
        if not model:
            raise HTTPException(
                status_code=404,
                detail=f"Modelo con ID {model_id} no encontrado"
            )
        
        # Formatear respuesta
        return {
            "model_id": model.model_id,
            "name": model.name,
            "description": model.description,
            "route_h5": model.route_h5,
            "route_pkl": model.route_pkl,
            "created_at": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener el modelo: {str(e)}"
        )

@app.post("/api/models")
async def create_model_endpoint(
    name: str = Form(...),
    description: str = Form(None),
    model_h5_file: UploadFile = File(None),
    scaler_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """Crear un nuevo modelo"""
    try:
        # Validar archivos
        if not model_h5_file:
            raise HTTPException(status_code=400, detail="Se requiere el archivo del modelo H5")
        
        # Crear directorios si no existen
        os.makedirs(MODELO_DIR, exist_ok=True)
        os.makedirs(SCALER_DIR, exist_ok=True)
        
        # Generar nombres de archivo seguros
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_h5_filename = f"{secure_filename(name)}_{timestamp}.h5"
        model_h5_path = os.path.join(MODELO_DIR, model_h5_filename)
        
        # Guardar archivo del modelo
        with open(model_h5_path, "wb") as f:
            f.write(await model_h5_file.read())
        
        # Guardar escalador si se proporcionó
        scaler_path = None
        if scaler_file:
            scaler_filename = f"{secure_filename(name)}_{timestamp}_scaler.pkl"
            scaler_path = os.path.join(SCALER_DIR, scaler_filename)
            with open(scaler_path, "wb") as f:
                f.write(await scaler_file.read())
        
        # Crear el modelo en la base de datos
        model = Model(
            name=name,
            description=description,
            route_h5=model_h5_path.replace('\\', '/'),
            route_pkl=scaler_path.replace('\\', '/') if scaler_path else None
        )
        
        new_model = crud.create_model(db, model)
        
        # Notificar a todos los clientes conectados sobre el nuevo modelo
        await ws_manager.broadcast_update("model_update")
        
        return create_response(
            data=new_model,
            message="Modelo creado con éxito"
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        log_error(e, "Error al crear modelo")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/models/{model_id}")
async def update_model_endpoint(
    model_id: int,
    name: str = Form(None),
    description: str = Form(None),
    model_h5_file: UploadFile = File(None),
    scaler_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """Actualizar un modelo existente"""
    # Verificar que el modelo existe
    model = crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    
    # Actualizar campos básicos si se proporcionaron
    if name is not None:
        model.name = name
    if description is not None:
        model.description = description
    
    # Registrar rutas originales para posible limpieza
    old_h5_path = model.route_h5
    old_pkl_path = model.route_pkl
    
    # Actualizar archivo del modelo si se proporcionó
    if model_h5_file:
        # Generar nombre de archivo seguro
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name = name if name else model.name
        model_h5_filename = f"{secure_filename(model_name)}_{timestamp}.h5"
        model_h5_path = os.path.join(MODELO_DIR, model_h5_filename)
        
        # Guardar nuevo archivo
        with open(model_h5_path, "wb") as f:
            f.write(await model_h5_file.read())
        
        # Actualizar ruta en modelo
        model.route_h5 = model_h5_path.replace('\\', '/')
        
        # Eliminar archivo anterior si existe
        if old_h5_path and os.path.exists(old_h5_path):
            try:
                os.remove(old_h5_path)
            except Exception as e:
                log_warning(f"No se pudo eliminar el archivo anterior del modelo: {str(e)}")
    
    # Actualizar archivo del escalador si se proporcionó
    if scaler_file:
        # Generar nombre de archivo seguro
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name = name if name else model.name
        scaler_filename = f"{secure_filename(model_name)}_{timestamp}_scaler.pkl"
        scaler_path = os.path.join(SCALER_DIR, scaler_filename)
        
        # Guardar nuevo archivo
        with open(scaler_path, "wb") as f:
            f.write(await scaler_file.read())
        
        # Actualizar ruta en modelo
        model.route_pkl = scaler_path.replace('\\', '/')
        
        # Eliminar archivo anterior si existe
        if old_pkl_path and os.path.exists(old_pkl_path):
            try:
                os.remove(old_pkl_path)
            except Exception as e:
                log_warning(f"No se pudo eliminar el archivo anterior del escalador: {str(e)}")
    
    # Guardar cambios en la base de datos
    updated_model = crud.update_model(db, model)
    
    # Notificar a todos los clientes conectados sobre la actualización del modelo
    await ws_manager.broadcast_update("model_update")
    
    return create_response(
        data=updated_model,
        message="Modelo actualizado con éxito"
    )

@app.delete("/api/models/{model_id}")
async def delete_model_endpoint(model_id: int, db: Session = Depends(get_db)):
    """Eliminar un modelo"""
    # Verificar si hay sensores que usan este modelo
    sensors = db.query(Sensor).filter(Sensor.model_id == model_id).all()
    if sensors:
        sensor_names = ", ".join([sensor.name for sensor in sensors])
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el modelo porque está siendo utilizado por los siguientes sensores: {sensor_names}"
        )
    
    # Obtener el modelo para acceder a sus rutas de archivo
    model = crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    
    # Almacenar rutas de archivos para eliminarlos después
    model_h5_path = model.route_h5
    model_pkl_path = model.route_pkl
    
    # Eliminar el modelo de la base de datos
    result = crud.delete_model(db, model_id)
    if not result:
        raise HTTPException(status_code=404, detail="Error al eliminar el modelo")
    
    # Eliminar los archivos asociados
    if model_h5_path and os.path.exists(model_h5_path):
        try:
            os.remove(model_h5_path)
        except Exception as e:
            log_warning(f"No se pudo eliminar el archivo del modelo: {str(e)}")
    
    if model_pkl_path and os.path.exists(model_pkl_path):
        try:
            os.remove(model_pkl_path)
        except Exception as e:
            log_warning(f"No se pudo eliminar el archivo del escalador: {str(e)}")
    
    # Notificar a todos los clientes conectados sobre la eliminación del modelo
    await ws_manager.broadcast_update("model_update")
    
    return create_response(
        message="Modelo eliminado con éxito"
    )

@app.get("/api/dashboard-data/stats")
def get_dashboard_stats(
    time_range: str = "day",
    data_type: Optional[str] = None,
    sensor_id: Optional[int] = None,
    machine_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtiene estadísticas para el dashboard
    
    - time_range: Rango de tiempo ('day', 'week', 'month', 'year')
    - data_type: Tipo de datos a obtener (opcional)
    - sensor_id: ID del sensor para filtrar datos (opcional)
    - machine_id: ID de la máquina para filtrar datos (opcional)
    """
    try:
        # Si se proporciona machine_id pero no sensor_id, obtener el sensor asociado
        if machine_id is not None and sensor_id is None:
            machine = crud.get_machine_by_id(db, machine_id)
            if machine and machine.sensor_id:
                sensor_id = machine.sensor_id
        
        # Calcular fechas según time_range
        now = datetime.now()
        start_date = None
        
        if time_range == "day":
            start_date = now - timedelta(days=1)
        elif time_range == "week":
            start_date = now - timedelta(weeks=1)
        elif time_range == "month":
            start_date = now - timedelta(days=30)
        elif time_range == "year":
            start_date = now - timedelta(days=365)
        else:
            # Por defecto, usar un día si time_range no es válido
            start_date = now - timedelta(days=1)
        
        # Obtener conteo de alertas por nivel en el rango de tiempo
        alert_query = db.query(
            models.Alert.error_type,
            func.count(models.Alert.log_id).label("count")
        )
        
        if sensor_id:
            alert_query = alert_query.filter(models.Alert.sensor_id == sensor_id)
        
        alert_query = alert_query.filter(
            models.Alert.timestamp >= start_date,
            models.Alert.timestamp <= now
        ).group_by(models.Alert.error_type)
        
        alert_counts = {1: 0, 2: 0, 3: 0}
        for error_type, count in alert_query.all():
            if error_type in alert_counts:
                alert_counts[error_type] = count
        
        # Obtener datos de sensores
        vibration_query = db.query(models.VibrationData)
        if sensor_id:
            vibration_query = vibration_query.filter(models.VibrationData.sensor_id == sensor_id)
        
        vibration_query = vibration_query.filter(
            models.VibrationData.date >= start_date,
            models.VibrationData.date <= now
        )
        
        total_records = vibration_query.count()
        
        # Obtener severidad media
        avg_severity_query = db.query(func.avg(models.VibrationData.severity).label("avg_severity"))
        if sensor_id:
            avg_severity_query = avg_severity_query.filter(models.VibrationData.sensor_id == sensor_id)
        
        avg_severity_query = avg_severity_query.filter(
            models.VibrationData.date >= start_date,
            models.VibrationData.date <= now
        )
        
        avg_severity_result = avg_severity_query.first()
        avg_severity = float(avg_severity_result.avg_severity) if avg_severity_result.avg_severity is not None else 0
        
        # Obtener máximos de aceleración
        max_values_query = db.query(
            func.max(models.VibrationData.acceleration_x).label("max_x"),
            func.max(models.VibrationData.acceleration_y).label("max_y"),
            func.max(models.VibrationData.acceleration_z).label("max_z")
        )
        
        if sensor_id:
            max_values_query = max_values_query.filter(models.VibrationData.sensor_id == sensor_id)
        
        max_values_query = max_values_query.filter(
            models.VibrationData.date >= start_date,
            models.VibrationData.date <= now
        )
        
        max_values = max_values_query.first()
        
        return {
            "alert_stats": {
                "level1": alert_counts[1],
                "level2": alert_counts[2],
                "level3": alert_counts[3],
                "total": sum(alert_counts.values())
            },
            "vibration_stats": {
                "total_records": total_records,
                "avg_severity": round(avg_severity, 2),
                "max_values": {
                    "x": float(max_values.max_x) if max_values.max_x is not None else 0,
                    "y": float(max_values.max_y) if max_values.max_y is not None else 0,
                    "z": float(max_values.max_z) if max_values.max_z is not None else 0
                }
            },
            "time_range": time_range
        }
    except Exception as e:
        print(f"Error al obtener estadísticas del dashboard: {str(e)}")
        return {
            "alert_stats": {"level1": 0, "level2": 0, "level3": 0, "total": 0},
            "vibration_stats": {
                "total_records": 0,
                "avg_severity": 0,
                "max_values": {"x": 0, "y": 0, "z": 0}
            },
            "time_range": time_range
        }

@app.get("/api/dashboard-data/vibration")
def get_dashboard_vibration(
    time_range: str = "day",
    data_type: Optional[str] = None,
    sensor_id: Optional[int] = None,
    machine_id: Optional[int] = None,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """
    Obtiene datos de vibración para el dashboard
    
    - time_range: Rango de tiempo ('day', 'week', 'month', 'year')
    - data_type: Tipo de datos ('raw', 'aggregated', default: 'raw')
    - sensor_id: ID del sensor para filtrar datos (opcional)
    - machine_id: ID de la máquina para filtrar datos (opcional)
    - limit: Límite de registros a retornar
    """
    try:
        # Si se proporciona machine_id pero no sensor_id, obtener el sensor asociado
        if machine_id is not None and sensor_id is None:
            machine = crud.get_machine_by_id(db, machine_id)
            if machine and machine.sensor_id:
                sensor_id = machine.sensor_id
        
        # Calcular fechas según time_range
        now = datetime.now()
        start_date = None
        
        if time_range == "day":
            start_date = now - timedelta(days=1)
        elif time_range == "week":
            start_date = now - timedelta(weeks=1)
        elif time_range == "month":
            start_date = now - timedelta(days=30)
        elif time_range == "year":
            start_date = now - timedelta(days=365)
        else:
            # Por defecto, usar un día si time_range no es válido
            start_date = now - timedelta(days=1)
        
        # Determinar si se requiere agregación
        use_aggregation = data_type == "aggregated" or (time_range in ["month", "year"])
        
        if use_aggregation:
            # Definir el intervalo de tiempo para la agregación
            if time_range == "year":
                # Agrupar por día
                interval = func.date_trunc('day', models.VibrationData.date)
            elif time_range == "month":
                # Agrupar por hora
                interval = func.date_trunc('hour', models.VibrationData.date)
            else:
                # Para semana o día, agrupar por hora
                interval = func.date_trunc('hour', models.VibrationData.date)
            
            # Consulta con agregación
            query = db.query(
                interval.label("timestamp"),
                func.avg(models.VibrationData.acceleration_x).label("avg_x"),
                func.avg(models.VibrationData.acceleration_y).label("avg_y"),
                func.avg(models.VibrationData.acceleration_z).label("avg_z"),
                func.max(models.VibrationData.acceleration_x).label("max_x"),
                func.max(models.VibrationData.acceleration_y).label("max_y"),
                func.max(models.VibrationData.acceleration_z).label("max_z"),
                func.avg(models.VibrationData.severity).label("avg_severity")
            )
            
            if sensor_id:
                query = query.filter(models.VibrationData.sensor_id == sensor_id)
            
            query = query.filter(
                models.VibrationData.date >= start_date,
                models.VibrationData.date <= now
            ).group_by(interval).order_by(interval).limit(limit)
            
            result = query.all()
            
            # Formatear resultados
            return {
                "timestamps": [r.timestamp.isoformat() for r in result],
                "data": {
                    "x": {
                        "avg": [float(r.avg_x) if r.avg_x is not None else None for r in result],
                        "max": [float(r.max_x) if r.max_x is not None else None for r in result]
                    },
                    "y": {
                        "avg": [float(r.avg_y) if r.avg_y is not None else None for r in result],
                        "max": [float(r.max_y) if r.max_y is not None else None for r in result]
                    },
                    "z": {
                        "avg": [float(r.avg_z) if r.avg_z is not None else None for r in result],
                        "max": [float(r.max_z) if r.max_z is not None else None for r in result]
                    }
                },
                "severities": [float(r.avg_severity) if r.avg_severity is not None else 0 for r in result],
                "aggregated": True,
                "time_range": time_range
            }
        else:
            # Consulta de datos sin agregación
            query = db.query(models.VibrationData)
            
            if sensor_id:
                query = query.filter(models.VibrationData.sensor_id == sensor_id)
            
            query = query.filter(
                models.VibrationData.date >= start_date,
                models.VibrationData.date <= now
            ).order_by(models.VibrationData.date).limit(limit)
            
            result = query.all()
            
            # Formatear resultados
            return {
                "timestamps": [r.date.isoformat() for r in result],
                "data": {
                    "x": [float(r.acceleration_x) if r.acceleration_x is not None else None for r in result],
                    "y": [float(r.acceleration_y) if r.acceleration_y is not None else None for r in result],
                    "z": [float(r.acceleration_z) if r.acceleration_z is not None else None for r in result]
                },
                "severities": [r.severity for r in result],
                "aggregated": False,
                "time_range": time_range
            }
    except Exception as e:
        print(f"Error al obtener datos de vibración para el dashboard: {str(e)}")
        return {
            "timestamps": [],
            "data": {"x": [], "y": [], "z": []},
            "severities": [],
            "aggregated": False,
            "time_range": time_range
        }

@app.get("/api/dashboard-data/alerts")
def get_dashboard_alerts(
    time_range: str = "day",
    data_type: Optional[str] = None,
    sensor_id: Optional[int] = None,
    machine_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene alertas para el dashboard
    
    - time_range: Rango de tiempo ('day', 'week', 'month', 'year')
    - data_type: Tipo de alerta ('1', '2', '3', o cualquier combinación '1,2', todos si es nulo)
    - sensor_id: ID del sensor para filtrar datos (opcional)
    - machine_id: ID de la máquina para filtrar datos (opcional)
    - limit: Límite de alertas a retornar
    """
    try:
        # Si se proporciona machine_id pero no sensor_id, obtener el sensor asociado
        if machine_id is not None and sensor_id is None:
            machine = crud.get_machine_by_id(db, machine_id)
            if machine and machine.sensor_id:
                sensor_id = machine.sensor_id
        
        # Calcular fechas según time_range
        now = datetime.now()
        start_date = None
        
        if time_range == "day":
            start_date = now - timedelta(days=1)
        elif time_range == "week":
            start_date = now - timedelta(weeks=1)
        elif time_range == "month":
            start_date = now - timedelta(days=30)
        elif time_range == "year":
            start_date = now - timedelta(days=365)
        else:
            # Por defecto, usar un día si time_range no es válido
            start_date = now - timedelta(days=1)
        
        # Crear consulta base con JOIN para obtener información del sensor
        query = db.query(
            models.Alert,
            models.Sensor.name.label("sensor_name")
        ).join(
            models.Sensor,
            models.Alert.sensor_id == models.Sensor.sensor_id,
            isouter=True
        )
        
        # Filtrar por sensor_id si está especificado
        if sensor_id:
            query = query.filter(models.Alert.sensor_id == sensor_id)
        
        # Filtrar por rango de tiempo
        query = query.filter(
            models.Alert.timestamp >= start_date,
            models.Alert.timestamp <= now
        )
        
        # Filtrar por tipo de alerta si data_type está especificado
        if data_type:
            error_types = [int(t) for t in data_type.split(',') if t.isdigit() and int(t) in [1, 2, 3]]
            if error_types:
                query = query.filter(models.Alert.error_type.in_(error_types))
        
        # Ordenar por timestamp descendente y limitar resultados
        query = query.order_by(models.Alert.timestamp.desc()).limit(limit)
        
        alerts_with_sensor = query.all()
        
        # Formatear resultados
        result = []
        for alert, sensor_name in alerts_with_sensor:
            # Obtener datos de vibración asociados si están disponibles
            vibration_data = None
            if alert.data_id:
                vib_data = crud.get_vibration_data_by_id(db, alert.data_id)
                if vib_data:
                    vibration_data = {
                        "acceleration_x": float(vib_data["acceleration_x"]) if vib_data["acceleration_x"] is not None else None,
                        "acceleration_y": float(vib_data["acceleration_y"]) if vib_data["acceleration_y"] is not None else None,
                        "acceleration_z": float(vib_data["acceleration_z"]) if vib_data["acceleration_z"] is not None else None,
                        "severity": vib_data["severity"]
                    }
            
            # Crear objeto de alerta
            alert_dict = {
                "alert_id": alert.log_id,
                "timestamp": alert.timestamp.isoformat(),
                "sensor_id": alert.sensor_id,
                "sensor_name": sensor_name or f"Sensor {alert.sensor_id}",
                "error_type": alert.error_type,
                "data_id": alert.data_id,
                "vibration_data": vibration_data
            }
            
            result.append(alert_dict)
        
        return {
            "alerts": result,
            "time_range": time_range,
            "count": len(result)
        }
    except Exception as e:
        print(f"Error al obtener alertas para el dashboard: {str(e)}")
        return {
            "alerts": [],
            "time_range": time_range,
            "count": 0
        }

@app.get("/api/system-status")
def system_status(lines: int = 50):
    """
    Devuelve información sobre el estado del sistema y los logs más recientes
    
    Args:
        lines: Número de líneas de logs a mostrar (máximo 200)
    """
    from pathlib import Path
    import os
    
    try:
        # Limitar número de líneas por seguridad
        if lines > 200:
            lines = 200
            
        # Información del sistema
        system_info = {
            "application": "PdM-Manager API",
            "version": "1.0.0",
            "status": "online",
            "database": "connected" if is_db_connected() else "error",
            "models_loaded": modelo is not None and scaler is not None,
            "model_dir": MODELO_DIR,
            "scaler_dir": SCALER_DIR
        }
        
        # Obtener logs recientes
        logs_dir = Path("logs")
        recent_logs = []
        
        if logs_dir.exists():
            # Obtener el archivo de log más reciente
            log_files = sorted(list(logs_dir.glob("pdm_manager_*.log")), reverse=True)
            
            if log_files:
                latest_log = log_files[0]
                
                # Leer las últimas líneas del archivo
                with open(latest_log, "r", encoding="utf-8") as f:
                    # Leer todas las líneas y quedarse con las últimas 'lines'
                    all_lines = f.readlines()
                    recent_logs = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        # Crear respuesta
        return create_response(
            success=True,
            data={
                "system": system_info,
                "recent_logs": recent_logs
            },
            message="Información del estado del sistema"
        )
    except Exception as e:
        error_msg = log_error(e, "Error al obtener estado del sistema")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener información del sistema: {error_msg}"
        )

def is_db_connected():
    """
    Verifica si la conexión a la base de datos está activa
    
    Returns:
        bool: True si está conectado, False en caso contrario
    """
    try:
        db = next(get_db())
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

# Gestor de conexiones WebSocket
class WebSocketConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        log_info(f"Nueva conexión WebSocket. Total conexiones: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            log_info(f"Conexión WebSocket cerrada. Total conexiones restantes: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        disconnected_websockets = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                disconnected_websockets.append(connection)
            except Exception as e:
                disconnected_websockets.append(connection)
                log_error(e, f"Error al enviar mensaje WebSocket: {str(e)}")
        
        # Eliminar conexiones desconectadas
        for disconnected in disconnected_websockets:
            self.disconnect(disconnected)

    async def broadcast_update(self, update_type: str, data: Dict[str, Any] = None):
        """
        Envía una actualización a todos los clientes conectados.
        
        Args:
            update_type: Tipo de actualización (machine_update, sensor_update, model_update, etc.)
            data: Datos adicionales para enviar (opcional)
        """
        message = {
            "type": update_type,
            "data": data or {},
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(json.dumps(message))

# Crear instancia de gestor de conexiones
ws_manager = WebSocketConnectionManager()

# Ruta para conexiones WebSocket
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    
    # Enviar estado inicial al cliente
    try:
        initial_state = {
            "type": "connection_established",
            "data": {
                "status": "connected",
                "timestamp": datetime.now().isoformat()
            }
        }
        await websocket.send_text(json.dumps(initial_state))
    except Exception as e:
        log_error(e, f"Error al enviar estado inicial por WebSocket: {str(e)}")
    
    try:
        while True:
            # Recibir mensaje del cliente
            try:
                data = await websocket.receive_text()
                
                # Procesar mensaje del cliente
                try:
                    message = json.loads(data)
                    
                    # Manejar solicitudes específicas del cliente
                    if message.get("type") == "request_data":
                        # Cliente solicita actualización de datos
                        requested_tables = message.get("data", {}).get("tables", [])
                        
                        if "machines" in requested_tables:
                            # Actualizar tabla de máquinas
                            await ws_manager.broadcast_update("machine_update")
                        
                        if "sensors" in requested_tables:
                            # Actualizar tabla de sensores
                            await ws_manager.broadcast_update("sensor_update")
                        
                        if "models" in requested_tables:
                            # Actualizar tabla de modelos
                            await ws_manager.broadcast_update("model_update")
                    
                    elif message.get("type") == "ping":
                        # Cliente envía ping para mantener la conexión
                        await websocket.send_text(json.dumps({
                            "type": "pong", 
                            "timestamp": datetime.now().isoformat()
                        }))
                    
                except json.JSONDecodeError:
                    log_warning(f"Mensaje WebSocket recibido no es JSON válido: {data}")
                except Exception as e:
                    log_error(e, f"Error al procesar mensaje WebSocket: {str(e)}")
                
            except WebSocketDisconnect:
                ws_manager.disconnect(websocket)
                break
            except Exception as e:
                log_error(e, f"Error en la conexión WebSocket: {str(e)}")
                ws_manager.disconnect(websocket)
                break
                
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

@app.post("/api/machines")
async def create_machine_endpoint(
    name: str = Form(...),
    description: str = Form(None),
    sensor_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Crear una nueva máquina"""
    try:
        # Crear nueva máquina
        machine = Machine(
            name=name,
            description=description,
            sensor_id=sensor_id
        )
        
        new_machine = crud.create_machine(db, machine)
        
        # Notificar a todos los clientes conectados
        await ws_manager.broadcast_update("machine_update")
        
        return create_response(
            data=new_machine,
            message="Máquina creada con éxito"
        )
    except Exception as e:
        log_error(e, "Error al crear máquina")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/machines/{machine_id}")
async def update_machine_endpoint(
    machine_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    sensor_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Actualizar una máquina existente"""
    # Verificar que la máquina existe
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    
    # Actualizar campos si se proporcionaron
    if name is not None:
        machine.name = name
    if description is not None:
        machine.description = description
        
    # Manejar sensor_id (puede ser None para desasociar)
    machine.sensor_id = sensor_id
    
    updated_machine = crud.update_machine(db, machine)
    
    # Notificar a todos los clientes conectados
    await ws_manager.broadcast_update("machine_update")
    
    # Si se modificó la asociación con sensor, también notificar update de sensores
    if sensor_id is not None:
        await ws_manager.broadcast_update("sensor_update")
    
    return create_response(
        data=updated_machine,
        message="Máquina actualizada con éxito"
    )

@app.delete("/api/machines/{machine_id}")
async def delete_machine_endpoint(machine_id: int, db: Session = Depends(get_db)):
    """Eliminar una máquina"""
    result = crud.delete_machine(db, machine_id)
    if not result:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    
    # Notificar a todos los clientes conectados
    await ws_manager.broadcast_update("machine_update")
    
    return create_response(
        message="Máquina eliminada con éxito"
    )