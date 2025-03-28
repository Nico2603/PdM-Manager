# app/main.py

import os
from datetime import datetime, timedelta
import numpy as np
import pickle
import joblib
import shutil
import hashlib
import pandas as pd

from fastapi import FastAPI, Depends, HTTPException, Body, File, UploadFile, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
import json

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

# Cargar modelo entrenado (Keras/TensorFlow) desde la carpeta "Modelo"
from tensorflow.keras.models import load_model

# Definir rutas base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")

# Configurar variable de entorno para evitar diferencias numéricas
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# Cargar el modelo y el scaler
try:
    modelo = load_model(os.path.join(MODELO_DIR, "modeloRNN_multiclase_v3_finetuned.h5"))
    scaler = joblib.load(os.path.join(SCALER_DIR, "scaler_RNN.pkl"))
    print(f"Modelo cargado correctamente desde: {os.path.join(MODELO_DIR, 'modeloRNN_multiclase_v3_finetuned.h5')}")
    print(f"Escalador cargado correctamente desde: {os.path.join(SCALER_DIR, 'scaler_RNN.pkl')}")
except Exception as e:
    print(f"Error al cargar el modelo o scaler: {str(e)}")
    print(f"Ruta del modelo: {os.path.join(MODELO_DIR, 'modeloRNN_multiclase_v3_finetuned.h5')}")
    print(f"Ruta del scaler: {os.path.join(SCALER_DIR, 'scaler_RNN.pkl')}")
    modelo = None
    scaler = None

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

# Montar la carpeta estática (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configuración para favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("static/favicon.ico")

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
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/get_vibration_data")
def get_vibration_data(
    sensor_id: int,
    start_date: str,
    end_date: str,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Devuelve datos de vibración para un sensor y rango de fechas.
    Incluye opción de limitar resultados para mejor rendimiento.
    """
    # Convertir fechas a datetime
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # Incluir todo el día final
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )
    
    # Optimización: Consultar solo campos necesarios y aplicar filtros directamente
    query = db.query(
        models.VibrationData.date,
        models.VibrationData.acceleration_x,
        models.VibrationData.acceleration_y,
        models.VibrationData.acceleration_z,
        models.VibrationData.severity
    ).filter(
        models.VibrationData.sensor_id == sensor_id,
        models.VibrationData.date >= start_dt,
        models.VibrationData.date <= end_dt
    ).order_by(models.VibrationData.date.asc())
    
    # Aplicar muestreo solo si el rango de tiempo es grande y hay límite establecido
    if limit and (end_dt - start_dt).days > 7:
        # Contar registros totales
        total_count = db.query(func.count(models.VibrationData.data_id)).filter(
            models.VibrationData.sensor_id == sensor_id,
            models.VibrationData.date >= start_dt,
            models.VibrationData.date <= end_dt
        ).scalar()
        
        # Si hay muchos registros, aplicar muestreo
        if total_count > limit:
            # Calculamos frecuencia de muestreo
            sampling_rate = total_count // limit
            
            # Obtener datos muestreados
            data_list = []
            for offset in range(0, total_count, sampling_rate):
                sample = query.offset(offset).limit(1).first()
                if sample:
                    data_list.append(sample)
        else:
            data_list = query.limit(limit).all()
    else:
        # Si no hay límite o el rango es pequeño, obtener todos los datos
        data_list = query.all()

    # Extraer datos en listas para JSON (formato optimizado)
    result = {
        "sensor_id": sensor_id,
        "fechas": [],
        "acceleration_x": [],
        "acceleration_y": [],
        "acceleration_z": [],
        "severities": [],
        "severity_texts": []
    }

    for d in data_list:
        result["fechas"].append(d.date.isoformat())
        result["acceleration_x"].append(float(d.acceleration_x) if d.acceleration_x is not None else None)
        result["acceleration_y"].append(float(d.acceleration_y) if d.acceleration_y is not None else None)
        result["acceleration_z"].append(float(d.acceleration_z) if d.acceleration_z is not None else None)
        
        # Añadir severidad y texto correspondiente
        severity = d.severity
        result["severities"].append(severity)
        result["severity_texts"].append(SEVERITY_MAPPING.get(severity, "Desconocido") if severity is not None else None)

    # Agregar información de muestreo si se aplicó
    if limit and 'sampling_rate' in locals():
        result["sampling_info"] = {
            "original_count": total_count,
            "sampled_count": len(data_list),
            "sampling_rate": sampling_rate
        }

    return result

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

def check_level3_condition(db, sensor_id: int, time_window_minutes: int = 15, threshold: int = 3) -> bool:
    """
    Determina si un sensor ha entrado en condición de Nivel 3.
    Se considera Nivel 3 cuando hay un número de alertas de Nivel 2 mayor al umbral
    en una ventana de tiempo determinada.
    
    Args:
        db: Sesión de base de datos
        sensor_id: ID del sensor a verificar
        time_window_minutes: Ventana de tiempo en minutos para considerar alertas recientes
        threshold: Umbral de alertas de Nivel 2 para considerar como Nivel 3
        
    Returns:
        bool: True si se cumple la condición de Nivel 3, False en caso contrario
    """
    try:
        # Calcular el límite de tiempo para la ventana
        time_limit = datetime.now() - timedelta(minutes=time_window_minutes)
        
        # Consultar alertas recientes de Nivel 2 para este sensor
        query = db.query(models.Alert).filter(
            models.Alert.sensor_id == sensor_id,
            models.Alert.error_type == 2,  # Nivel 2
            models.Alert.timestamp >= time_limit
        ).count()
        
        # Determinar si supera el umbral
        return query >= threshold
    
    except Exception as e:
        print(f"Error al verificar condición de Nivel 3: {e}")
        return False

@app.post("/api/sensor_data")
def receive_sensor_data(sensor_data: SensorData, db: Session = Depends(get_db)):
    """
    Recibe datos del sensor triaxial, clasifica y guarda en la base de datos
    """
    # Verificar que el sensor existe
    sensor = crud.get_sensor_by_id(db, sensor_data.sensor_id)
    if not sensor:
        raise HTTPException(
            status_code=404,
            detail=f"Sensor con ID {sensor_data.sensor_id} no encontrado"
        )
    
    # Si no hay modelo asociado al sensor, usar el modelo por defecto
    modelo_to_use = modelo
    scaler_to_use = scaler
    
    if sensor.model_id:
        # Cargar el modelo y escalador específicos del sensor
        model_info = crud.get_model_by_id(db, sensor.model_id)
        if model_info:
            try:
                # Cargar modelo desde la ruta especificada
                custom_model_path = model_info.route_h5
                if not os.path.isabs(custom_model_path):
                    custom_model_path = os.path.join(BASE_DIR, custom_model_path)
                
                # Cargar modelo
                if os.path.exists(custom_model_path):
                    modelo_to_use = load_model(custom_model_path)
                    
                    # Cargar escalador si existe
                    if model_info.route_pkl:
                        custom_scaler_path = model_info.route_pkl
                        if not os.path.isabs(custom_scaler_path):
                            custom_scaler_path = os.path.join(BASE_DIR, custom_scaler_path)
                        
                        if os.path.exists(custom_scaler_path):
                            scaler_to_use = joblib.load(custom_scaler_path)
            except Exception as e:
                print(f"Error al cargar modelo personalizado: {str(e)}. Usando modelo por defecto.")
    
    # Buscar la máquina asociada al sensor para límites configurados
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
    if modelo_to_use:
        prediction = modelo_to_use.predict(rnn_input, verbose=0)
        severity = int(np.argmax(prediction[0]))
        confidence = float(np.max(prediction)) * 100
    else:
        # Si no hay modelo disponible, poner severidad neutral
        severity = 0
        confidence = 0
    
    # Verificar si aplica condición de Nivel 3 basada en histórico
    elevated_to_level3 = False
    if severity == 2:  # Si ya es nivel 2, verificar si pasa a nivel 3
        elevated_to_level3 = check_level3_condition(db, sensor_data.sensor_id)
        if elevated_to_level3:
            severity = 3  # Elevar a Nivel 3
    
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
            error_type=severity,  # Ahora es un valor entero
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
        modelo_to_use = modelo
        scaler_to_use = scaler
        
        if sensor.model_id:
            # Cargar el modelo y escalador específicos del sensor
            model_info = crud.get_model_by_id(db, sensor.model_id)
            if model_info:
                try:
                    # Cargar modelo desde la ruta especificada
                    custom_model_path = model_info.route_h5
                    if not os.path.isabs(custom_model_path):
                        custom_model_path = os.path.join(BASE_DIR, custom_model_path)
                    
                    # Cargar modelo
                    if os.path.exists(custom_model_path):
                        modelo_to_use = load_model(custom_model_path)
                        
                        # Cargar escalador si existe
                        if model_info.route_pkl:
                            custom_scaler_path = model_info.route_pkl
                            if not os.path.isabs(custom_scaler_path):
                                custom_scaler_path = os.path.join(BASE_DIR, custom_scaler_path)
                            
                            if os.path.exists(custom_scaler_path):
                                scaler_to_use = joblib.load(custom_scaler_path)
                except Exception as e:
                    print(f"Error al cargar modelo personalizado: {str(e)}. Usando modelo por defecto.")
        
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
        
        # Ajustar forma para el modelo RNN
        rnn_input = data_array.reshape(1, 1, 3)
        
        # Hacer predicción con el modelo
        if modelo_to_use:
            prediction = modelo_to_use.predict(rnn_input, verbose=0)
            severity = int(np.argmax(prediction[0]))
            confidence = float(np.max(prediction)) * 100
        else:
            # Si no hay modelo disponible, poner severidad neutral
            severity = 0
            confidence = 0
        
        # Verificar si aplica condición de Nivel 3
        elevated_to_level3 = False
        if severity == 2:  # Si ya es nivel 2, verificar si pasa a nivel 3
            elevated_to_level3 = check_level3_condition(db, record.sensor_id)
            if elevated_to_level3:
                severity = 3  # Elevar a Nivel 3
        
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
                error_type=severity,  # Ahora es un valor entero
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
    Recarga el modelo y el escalador desde la base de datos
    """
    global modelo, scaler
    
    try:
        # Buscar un sensor con modelo asignado
        sensor_with_model = db.query(models.Sensor).filter(
            models.Sensor.model_id.isnot(None)
        ).first()
        
        # Si no hay ningún sensor con modelo asignado, intentar cargar el predeterminado
        if not sensor_with_model:
            modelo = load_model(os.path.join(MODELO_DIR, "modeloRNN_multiclase_v3_finetuned.h5"))
            
            # Intentar cargar el escalador predeterminado
            try:
                scaler_path = os.path.join(SCALER_DIR, "scaler_RNN.pkl")
                with open(scaler_path, 'rb') as f:
                    scaler = pickle.load(f)
                return {"status": "ok", "message": "Modelo y escalador predeterminados cargados correctamente"}
            except:
                return {
                    "status": "partial", 
                    "message": "Modelo predeterminado cargado correctamente, pero no se encontró el escalador"
                }
        
        # Obtener el modelo de la base de datos
        model = crud.get_model_by_id(db, sensor_with_model.model_id)
        if not model:
            raise Exception("Modelo no encontrado en la base de datos")
        
        # Cargar el modelo
        modelo = load_model(model.route_h5)
        
        # Intentar cargar el escalador si existe
        if model.route_pkl and os.path.exists(model.route_pkl):
            with open(model.route_pkl, 'rb') as f:
                scaler = pickle.load(f)
            return {
                "status": "ok", 
                "message": f"Modelo '{model.name}' y su escalador cargados correctamente"
            }
        else:
            # Si no hay escalador específico, intentar cargar el predeterminado
            try:
                scaler_path = os.path.join(SCALER_DIR, "scaler_RNN.pkl")
                with open(scaler_path, 'rb') as f:
                    scaler = pickle.load(f)
                return {
                    "status": "ok", 
                    "message": f"Modelo '{model.name}' cargado correctamente con escalador predeterminado"
                }
            except:
                return {
                    "status": "partial", 
                    "message": f"Modelo '{model.name}' cargado correctamente, pero no se encontró ningún escalador"
                }
    
    except Exception as e:
        return {"status": "error", "message": f"Error recargando el modelo: {str(e)}"}

@app.get("/api/sensors")
def get_sensors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los sensores
    """
    sensors = crud.get_sensors(db, skip, limit)
    
    # Agregar información de máquina y modelo asociados
    for sensor in sensors:
        # Información de máquina
        if sensor.get("machine_id"):
            machine = crud.get_machine_by_id(db, sensor["machine_id"])
            if machine:
                sensor["machine_name"] = machine.name
        else:
            sensor["machine_name"] = None
        
        # Información de modelo
        if sensor.get("model_id"):
            model = crud.get_model_by_id(db, sensor["model_id"])
            if model:
                sensor["model_name"] = model.name
        else:
            sensor["model_name"] = None
    
    return sensors

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
async def create_sensor(
    name: str = Form(...),
    description: str = Form(None),
    model_id: int = Form(...),  # Ahora es obligatorio
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo sensor
    """
    try:
        # Validar campos
        if not name:
            raise HTTPException(status_code=400, detail="El nombre del sensor es obligatorio")
        
        # Verificar si el modelo existe
        model = crud.get_model_by_id(db, model_id)
        if not model:
            raise HTTPException(status_code=404, detail=f"Modelo con ID {model_id} no encontrado")
        
        # Crear sensor
        new_sensor = models.Sensor(
            name=name,
            description=description,
            model_id=model_id
        )
        
        # Guardar en la BD
        created_sensor = crud.create_sensor(db, new_sensor)
        
        return created_sensor
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear el sensor: {str(e)}")

@app.put("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def update_sensor_info(
    sensor_id: int,
    name: str = Form(None),
    description: str = Form(None),
    model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza un sensor existente
    """
    # Verificar que el sensor existe
    sensor = crud.get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    
    # Actualizar los campos proporcionados
    if name:
        sensor.name = name
    if description is not None:
        sensor.description = description
    
    # Actualizar model_id si se proporciona
    if model_id is not None:
        # Si es un valor vacío, establecer como NULL
        if model_id == "" or model_id == 0:
            sensor.model_id = None
        else:
            # Verificar que el modelo existe
            model = crud.get_model_by_id(db, model_id)
            if not model:
                raise HTTPException(status_code=404, detail=f"Modelo con ID {model_id} no encontrado")
            sensor.model_id = model_id
    
    # Guardar cambios
    updated_sensor = crud.update_sensor(db, sensor)
    
    return updated_sensor

@app.delete("/api/sensors/{sensor_id}")
def delete_sensor_info(sensor_id: int, db: Session = Depends(get_db)):
    """
    Elimina un sensor
    """
    success = crud.delete_sensor(db, sensor_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    
    return {"status": "ok", "message": f"Sensor {sensor_id} eliminado correctamente"}

@app.get("/api/sensors/{sensor_id}/machines", response_model=List[Dict[str, Any]])
def get_machines_by_sensor(sensor_id: int, db: Session = Depends(get_db)):
    """
    Obtiene la lista de máquinas asociadas a un sensor específico
    """
    # Verificar que el sensor existe
    sensor = crud.get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    
    # Obtener máquinas que usan este sensor
    machines = crud.get_machines_by_sensor(db, sensor_id)
    
    return machines

@app.get("/api/vibration-data", response_model=List[Dict[str, Any]])
def get_all_vibration_data(
    sensor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene datos de vibración, opcionalmente filtrados por sensor
    """
    if sensor_id:
        return crud.get_vibration_data_by_sensor(db, sensor_id, limit)
    else:
        return crud.get_vibration_data(db, limit)

@app.get("/api/vibration-data/{data_id}", response_model=Dict[str, Any])
def get_vibration_data_by_id(data_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un registro específico de datos de vibración por su ID
    """
    data = crud.get_vibration_data_by_id(db, data_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Datos de vibración con ID {data_id} no encontrados")
    return data

@app.get("/api/alerts", response_model=List[Dict[str, Any]])
def get_all_alerts(
    sensor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene alertas, opcionalmente filtradas por sensor_id
    """
    return crud.get_alerts(db, sensor_id, limit)

@app.put("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Marca una alerta como reconocida
    """
    success = crud.acknowledge_alert(db, alert_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Alerta con ID {alert_id} no encontrada")
    
    return {"status": "ok", "message": f"Alerta {alert_id} reconocida correctamente"}

@app.get("/api/dashboard")
def get_dashboard_data(sensor_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Obtiene datos para el dashboard
    """
    result = {
        "alert_counts": {
            "level1": 0,
            "level2": 0,
            "level3": 0,
            "total": 0
        },
        "recent_alerts": [],
        "recent_data": []
    }
    
    # Obtener conteo de alertas utilizando la función auxiliar
    alert_counts = crud.get_alert_counts(db, sensor_id)
    result["alert_counts"] = alert_counts
    
    # Optimización: Obtener alertas recientes con join para incluir información del sensor
    alert_query = db.query(
        models.Alert,
        models.Sensor.name.label("sensor_name")
    ).join(
        models.Sensor,
        models.Alert.sensor_id == models.Sensor.sensor_id,
        isouter=True
    )
    
    if sensor_id:
        alert_query = alert_query.filter(models.Alert.sensor_id == sensor_id)
    
    # Obtener solo las 10 alertas más recientes (optimización)
    recent_alerts_data = alert_query.order_by(models.Alert.timestamp.desc()).limit(10).all()
    
    # Procesar alertas recientes
    for alert, sensor_name in recent_alerts_data:
        # Aplicar remove_sa_instance para serialización segura
        alert_dict = remove_sa_instance(alert.__dict__.copy())
        
        result["recent_alerts"].append({
            "id": alert.log_id,
            "timestamp": alert.timestamp.isoformat(),
            "sensor_id": alert.sensor_id,
            "sensor_name": sensor_name or f"Sensor {alert.sensor_id}",
            "error_type": alert.error_type,
            "error_text": f"Nivel {alert.error_type}" if alert.error_type in [1, 2, 3] else "Desconocido"
        })
    
    # Optimización: Obtener datos recientes de vibración (máximo 50)
    vib_query = db.query(models.VibrationData)
    if sensor_id:
        vib_query = vib_query.filter(models.VibrationData.sensor_id == sensor_id)
    
    # Limitar a los 50 más recientes y seleccionar solo las columnas necesarias
    recent_data = vib_query.order_by(models.VibrationData.date.desc()).limit(50).all()
    
    # Extraer datos en listas para JSON
    timestamps = []
    values_x = []
    values_y = []
    values_z = []
    severities = []
    
    for data in recent_data:
        timestamps.append(data.date.isoformat())
        values_x.append(float(data.acceleration_x) if data.acceleration_x is not None else None)
        values_y.append(float(data.acceleration_y) if data.acceleration_y is not None else None)
        values_z.append(float(data.acceleration_z) if data.acceleration_z is not None else None)
        severities.append(data.severity)
    
    result["recent_data"] = {
        "timestamps": timestamps,
        "values_x": values_x,
        "values_y": values_y,
        "values_z": values_z,
        "severities": severities
    }
    
    return result

@app.get("/api/machines")
def get_all_machines(db: Session = Depends(get_db)):
    """
    Obtiene la lista de todas las máquinas con información de sensores y modelos
    """
    machines = crud.get_machines(db)
    result = []
    
    for machine in machines:
        machine_dict = machine.copy()
        
        # Buscar el sensor asociado a esta máquina
        if machine.get("sensor_id"):
            sensor = crud.get_sensor_by_id(db, machine["sensor_id"])
            if sensor:
                # Obtener información del sensor
                machine_dict["sensor"] = {
                    "sensor_id": sensor.sensor_id,
                    "name": sensor.name,
                    "model_id": sensor.model_id
                }
                
                # Obtener modelo si existe
                if sensor.model_id:
                    model = crud.get_model_by_id(db, sensor.model_id)
                    if model:
                        machine_dict["sensor"]["model"] = {
                            "model_id": model.model_id,
                            "name": model.name
                        }
        
        result.append(machine_dict)
    
    return result

@app.get("/api/machines/{machine_id}")
def get_machine_info(machine_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de una máquina por su ID, incluyendo nombres de sensor
    """
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    
    result = machine.__dict__.copy()
    if '_sa_instance_state' in result:
        result.pop('_sa_instance_state')
    
    # Obtener el sensor asociado a esta máquina
    if machine.sensor_id:
        sensor = crud.get_sensor_by_id(db, machine.sensor_id)
        if sensor:
            result["sensor"] = {
                "sensor_id": sensor.sensor_id,
                "name": sensor.name,
                "model_id": sensor.model_id
            }
            
            # Obtener modelo si existe
            if sensor.model_id:
                model = crud.get_model_by_id(db, sensor.model_id)
                if model:
                    result["sensor"]["model"] = {
                        "model_id": model.model_id,
                        "name": model.name
                    }
    
    return result

def remove_sa_instance(obj_dict):
    """
    Helper function to remove '_sa_instance_state' from a dictionary
    """
    if '_sa_instance_state' in obj_dict:
        obj_dict.pop('_sa_instance_state')
    return obj_dict

@app.post("/api/limits/save")
def save_limits(
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza los límites personalizados en la tabla LimitConfig
    y retorna los límites actualizados para actualizar el dashboard en tiempo real
    """
    try:
        # Extraer límites de la petición
        limits = data
        
        if not limits:
            raise HTTPException(status_code=400, detail="Datos incompletos")
        
        # Obtener la configuración existente o crear una nueva
        config = crud.get_or_create_limit_config(db)
        
        # Actualizar los valores
        config.x_2inf = limits["x"]["sigma2"]["lower"]
        config.x_2sup = limits["x"]["sigma2"]["upper"]
        config.x_3inf = limits["x"]["sigma3"]["lower"]
        config.x_3sup = limits["x"]["sigma3"]["upper"]
        
        config.y_2inf = limits["y"]["sigma2"]["lower"]
        config.y_2sup = limits["y"]["sigma2"]["upper"]
        config.y_3inf = limits["y"]["sigma3"]["lower"]
        config.y_3sup = limits["y"]["sigma3"]["upper"]
        
        config.z_2inf = limits["z"]["sigma2"]["lower"]
        config.z_2sup = limits["z"]["sigma2"]["upper"]
        config.z_3inf = limits["z"]["sigma3"]["lower"]
        config.z_3sup = limits["z"]["sigma3"]["upper"]
        
        # Guardar cambios
        crud.update_limit_config(db, config)
        
        # Devolver los límites actualizados
        return limits
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar límites: {str(e)}")