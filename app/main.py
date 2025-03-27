# app/main.py

import os
from datetime import datetime, timedelta
import numpy as np
import pickle
import joblib

from fastapi import FastAPI, Depends, HTTPException, Body, File, UploadFile, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
import json

# Importar la configuración de la BD y el modelo de datos
from app.database import engine, Base, get_db
from app import crud, models

# Cargar modelo entrenado (Keras/TensorFlow) desde la carpeta "Modelo"
from tensorflow.keras.models import load_model

# Definir rutas base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")

# Cargar el modelo y el scaler
try:
    modelo = load_model(os.path.join(MODELO_DIR, "modelo_pdm.h5"))
    scaler = joblib.load(os.path.join(SCALER_DIR, "scaler_pdm.pkl"))
except Exception as e:
    print(f"Error al cargar el modelo o scaler: {str(e)}")
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

class SensorDataBatch(BaseModel):
    registros: List[SensorData]

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
        db.execute("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/get_vibration_data")
def get_vibration_data(
    sensor_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    Devuelve datos de vibración para un sensor y rango de fechas.
    """
    # Convertir fechas a datetime
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )

    # Obtener registros de la BD
    data_list = crud.get_vibration_data_by_sensor_and_dates(db, sensor_id, start_dt, end_dt)

    # Extraer datos en listas para JSON
    acceleration_x = []
    acceleration_y = []
    acceleration_z = []
    fechas = []
    severities = []
    severity_texts = []

    for d in data_list:
        acceleration_x.append(float(d.acceleration_x) if d.acceleration_x is not None else None)
        acceleration_y.append(float(d.acceleration_y) if d.acceleration_y is not None else None)
        acceleration_z.append(float(d.acceleration_z) if d.acceleration_z is not None else None)
        fechas.append(d.date.isoformat())
        
        # Añadir severidad y texto correspondiente
        severity = d.severity
        severities.append(severity)
        severity_texts.append(SEVERITY_MAPPING.get(severity, "Desconocido") if severity is not None else None)

    return {
        "sensor_id": sensor_id,
        "fechas": fechas,
        "acceleration_x": acceleration_x,
        "acceleration_y": acceleration_y,
        "acceleration_z": acceleration_z,
        "severities": severities,
        "severity_texts": severity_texts
    }

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
            models.Alert.severity == 2,  # Nivel 2
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
    
    # Buscar la máquina asociada al sensor
    machine = None
    if sensor.machine_id:
        machine = crud.get_machine_by_id(db, sensor.machine_id)
    
    if not machine:
        # Buscar la máquina que tenga este sensor configurado
        machines = db.query(models.Machine).filter(models.Machine.sensor_id == sensor.sensor_id).all()
        if machines:
            machine = machines[0]  # Tomar la primera máquina que usa este sensor
    
    # Si no encontramos máquina o la máquina no tiene modelo asociado, usar el modelo por defecto
    modelo_to_use = modelo
    scaler_to_use = scaler
    
    if machine and machine.model_id:
        # Cargar el modelo y escalador específicos de la máquina
        model_info = crud.get_model_by_id(db, machine.model_id)
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
    
    # Calcular magnitud
    magnitude = np.sqrt(
        sensor_data.acceleration_x**2 + 
        sensor_data.acceleration_y**2 + 
        sensor_data.acceleration_z**2
    )
    
    # Verificar límites configurados para este sensor
    if machine:
        # Obtener límites configurados para este sensor
        config_name = f"limits_sensor_{sensor_data.sensor_id}"
        config = crud.get_config_by_name(db, config_name)
        
        if config:
            try:
                limits = json.loads(config.value)
                # Verificar si los valores exceden los límites configurados
                if severity < 3:  # Solo elevar si no es ya nivel 3
                    # Verificar límites configurados
                    if 'sigma3_factor' in limits:
                        # Calcular límites basados en datos históricos
                        recent_data = db.query(models.VibrationData).filter(
                            models.VibrationData.sensor_id == sensor_data.sensor_id
                        ).order_by(models.VibrationData.date.desc()).limit(100).all()
                        
                        if recent_data:
                            # Extraer valores x, y, z
                            values_x = [float(d.acceleration_x) for d in recent_data if d.acceleration_x is not None]
                            values_y = [float(d.acceleration_y) for d in recent_data if d.acceleration_y is not None]
                            values_z = [float(d.acceleration_z) for d in recent_data if d.acceleration_z is not None]
                            
                            # Calcular medias y desviaciones
                            if values_x and values_y and values_z:
                                mean_x = np.mean(values_x)
                                mean_y = np.mean(values_y)
                                mean_z = np.mean(values_z)
                                std_x = np.std(values_x)
                                std_y = np.std(values_y)
                                std_z = np.std(values_z)
                                
                                # Calcular límites
                                sigma3_factor = float(limits.get('sigma3_factor', 3))
                                
                                # Verificar si los valores actuales exceden los límites de 3-sigma
                                if (abs(sensor_data.acceleration_x - mean_x) > sigma3_factor * std_x or
                                    abs(sensor_data.acceleration_y - mean_y) > sigma3_factor * std_y or
                                    abs(sensor_data.acceleration_z - mean_z) > sigma3_factor * std_z):
                                    # Elevar a nivel 3 si excede límites configurados
                                    severity = 3
            except Exception as e:
                print(f"Error al procesar límites: {str(e)}")
    
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
        severity=severity,
        magnitude=magnitude
    )
    
    # Crear alerta si es nivel 1 o superior
    if severity >= 1:
        message = f"Alerta de nivel {severity}: {SEVERITY_MAPPING.get(severity, 'Desconocido')}"
        if severity == 3:
            message += " - ¡REQUIERE ATENCIÓN INMEDIATA!"
            
        alert = models.Alert(
            sensor_id=sensor_data.sensor_id,
            error_type=f"Nivel {severity}",
            vibration_data_id=vibration_data.data_id,
            severity=severity,
            message=message
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
        
        # Buscar la máquina asociada al sensor
        machine = None
        if sensor.machine_id:
            machine = crud.get_machine_by_id(db, sensor.machine_id)
        
        if not machine:
            # Buscar la máquina que tenga este sensor configurado
            machines = db.query(models.Machine).filter(models.Machine.sensor_id == sensor.sensor_id).all()
            if machines:
                machine = machines[0]  # Tomar la primera máquina que usa este sensor
        
        # Si no encontramos máquina o la máquina no tiene modelo asociado, usar el modelo por defecto
        modelo_to_use = modelo
        scaler_to_use = scaler
        
        if machine and machine.model_id:
            # Cargar el modelo y escalador específicos de la máquina
            model_info = crud.get_model_by_id(db, machine.model_id)
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
        
        # Calcular magnitud
        magnitude = np.sqrt(
            record.acceleration_x**2 + 
            record.acceleration_y**2 + 
            record.acceleration_z**2
        )
        
        # Verificar límites configurados para este sensor
        if machine:
            # Obtener límites configurados para este sensor
            config_name = f"limits_sensor_{record.sensor_id}"
            config = crud.get_config_by_name(db, config_name)
            
            if config:
                try:
                    limits = json.loads(config.value)
                    # Verificar si los valores exceden los límites configurados
                    if severity < 3:  # Solo elevar si no es ya nivel 3
                        # Verificar límites configurados
                        if 'sigma3_factor' in limits:
                            # Calcular límites basados en datos históricos
                            recent_data = db.query(models.VibrationData).filter(
                                models.VibrationData.sensor_id == record.sensor_id
                            ).order_by(models.VibrationData.date.desc()).limit(100).all()
                            
                            if recent_data:
                                # Extraer valores x, y, z
                                values_x = [float(d.acceleration_x) for d in recent_data if d.acceleration_x is not None]
                                values_y = [float(d.acceleration_y) for d in recent_data if d.acceleration_y is not None]
                                values_z = [float(d.acceleration_z) for d in recent_data if d.acceleration_z is not None]
                                
                                # Calcular medias y desviaciones
                                if values_x and values_y and values_z:
                                    mean_x = np.mean(values_x)
                                    mean_y = np.mean(values_y)
                                    mean_z = np.mean(values_z)
                                    std_x = np.std(values_x)
                                    std_y = np.std(values_y)
                                    std_z = np.std(values_z)
                                    
                                    # Calcular límites
                                    sigma3_factor = float(limits.get('sigma3_factor', 3))
                                    
                                    # Verificar si los valores actuales exceden los límites de 3-sigma
                                    if (abs(record.acceleration_x - mean_x) > sigma3_factor * std_x or
                                        abs(record.acceleration_y - mean_y) > sigma3_factor * std_y or
                                        abs(record.acceleration_z - mean_z) > sigma3_factor * std_z):
                                        # Elevar a nivel 3 si excede límites configurados
                                        severity = 3
                except Exception as e:
                    print(f"Error al procesar límites: {str(e)}")
        
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
            severity=severity,
            magnitude=magnitude
        )
        
        # Crear alerta si es nivel 1 o superior
        if severity >= 1:
            message = f"Alerta de nivel {severity}: {SEVERITY_MAPPING.get(severity, 'Desconocido')}"
            if severity == 3:
                message += " - ¡REQUIERE ATENCIÓN INMEDIATA!"
                
            alert = models.Alert(
                sensor_id=record.sensor_id,
                error_type=f"Nivel {severity}",
                vibration_data_id=vibration_data.data_id,
                severity=severity,
                message=message
            )
            crud.create_alert(db, alert)
        
        # Agregar resultado
        results.append({
            "sensor_id": record.sensor_id,
            "status": "success",
            "data_id": vibration_data.data_id,
            "severity": severity,
            "severity_text": SEVERITY_MAPPING.get(severity, "Desconocido"),
            "confidence": confidence,
            "magnitude": magnitude
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
        # Buscar una máquina con modelo asignado
        machine_with_model = db.query(models.Machine).filter(
            models.Machine.model_id.isnot(None)
        ).first()
        
        # Si no hay ninguna máquina con modelo asignado, intentar cargar el predeterminado
        if not machine_with_model:
            modelo = load_model(os.path.join(MODELO_DIR, "modelo_pdm.h5"))
            
            # Intentar cargar el escalador predeterminado
            try:
                scaler_path = os.path.join(SCALER_DIR, "scaler.pkl")
                with open(scaler_path, 'rb') as f:
                    scaler = pickle.load(f)
                return {"status": "ok", "message": "Modelo y escalador predeterminados cargados correctamente"}
            except:
                return {
                    "status": "partial", 
                    "message": "Modelo predeterminado cargado correctamente, pero no se encontró el escalador"
                }
        
        # Obtener el modelo de la base de datos
        model = crud.get_model_by_id(db, machine_with_model.model_id)
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
                scaler_path = os.path.join(SCALER_DIR, "scaler.pkl")
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

@app.get("/api/sensors", response_model=List[Dict[str, Any]])
def get_all_sensors(db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los sensores
    """
    return crud.get_sensors(db)

@app.get("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def get_sensor_info(sensor_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de un sensor por su ID
    """
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    return sensor

@app.post("/api/sensors", response_model=Dict[str, Any])
def create_new_sensor(
    name: str = Form(...),
    description: str = Form(None),
    location: str = Form(None),
    type: str = Form(None),
    machine_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo sensor
    """
    sensor = models.Sensor(
        name=name,
        description=description,
        location=location,
        type=type,
        machine_id=machine_id
    )
    return crud.create_sensor(db, sensor)

@app.put("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def update_sensor(
    sensor_id: int,
    name: str = Form(...),
    description: str = Form(None),
    location: str = Form(None),
    type: str = Form(None),
    machine_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza la información de un sensor existente
    """
    # Verificar que el sensor existe
    sensor = crud.get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    
    # Actualizar los datos del sensor
    sensor.name = name
    sensor.description = description
    if location is not None:
        sensor.location = location
    if type is not None:
        sensor.type = type
    if machine_id is not None:
        sensor.machine_id = machine_id
    
    return crud.update_sensor(db, sensor)

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
    
    # Obtener las máquinas que utilizan este sensor
    machines = db.query(models.Machine).filter(models.Machine.sensor_id == sensor_id).all()
    
    # Convertir a diccionarios
    result = []
    for machine in machines:
        machine_dict = machine.__dict__.copy()
        # Eliminar atributos internos de SQLAlchemy
        if '_sa_instance_state' in machine_dict:
            machine_dict.pop('_sa_instance_state')
        result.append(machine_dict)
    
    return result

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
    acknowledged: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene alertas, opcionalmente filtradas por sensor_id y/o estado
    """
    return crud.get_alerts(db, sensor_id, acknowledged, limit)

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
    
    # Contar alertas no reconocidas
    query = db.query(models.Alert).filter(models.Alert.acknowledged == False)
    if sensor_id:
        query = query.filter(models.Alert.sensor_id == sensor_id)
    
    alerts = query.order_by(models.Alert.timestamp.desc()).all()
    
    # Contar por nivel
    for alert in alerts:
        if alert.severity == 1:
            result["alert_counts"]["level1"] += 1
        elif alert.severity == 2:
            result["alert_counts"]["level2"] += 1
        elif alert.severity == 3:
            result["alert_counts"]["level3"] += 1
    
    result["alert_counts"]["total"] = (
        result["alert_counts"]["level1"] +
        result["alert_counts"]["level2"] +
        result["alert_counts"]["level3"]
    )
    
    # Obtener alertas recientes (máximo 10)
    recent_alerts = alerts[:10]
    for alert in recent_alerts:
        sensor = crud.get_sensor_by_id(db, alert.sensor_id)
        sensor_name = sensor.name if sensor else f"Sensor {alert.sensor_id}"
        
        result["recent_alerts"].append({
            "id": alert.log_id,
            "timestamp": alert.timestamp.isoformat(),
            "sensor_id": alert.sensor_id,
            "sensor_name": sensor_name,
            "severity": alert.severity,
            "severity_text": SEVERITY_MAPPING.get(alert.severity, "Desconocido"),
            "message": alert.message
        })
    
    # Obtener datos recientes de vibración (máximo 50)
    query = db.query(models.VibrationData)
    if sensor_id:
        query = query.filter(models.VibrationData.sensor_id == sensor_id)
    
    recent_data = query.order_by(models.VibrationData.date.desc()).limit(50).all()
    
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
        machine_dict = machine.__dict__.copy()
        
        # Obtener información del sensor si existe
        if machine.sensor_id:
            sensor = crud.get_sensor_by_id(db, machine.sensor_id)
            if sensor:
                machine_dict["sensor_name"] = sensor.name
        
        # Obtener información del modelo si existe
        if machine.model_id:
            model = crud.get_model_by_id(db, machine.model_id)
            if model:
                machine_dict["model_name"] = model.name
        
        result.append(machine_dict)
    
    return result

@app.get("/api/machines/{machine_id}")
def get_machine_info(machine_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de una máquina por su ID, incluyendo nombres de sensor y modelo
    """
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    
    result = machine.__dict__.copy()
    
    # Obtener información del sensor si existe
    if machine.sensor_id:
        sensor = crud.get_sensor_by_id(db, machine.sensor_id)
        if sensor:
            result["sensor_name"] = sensor.name
    
    # Obtener información del modelo si existe
    if machine.model_id:
        model = crud.get_model_by_id(db, machine.model_id)
        if model:
            result["model_name"] = model.name
    
    return result

@app.post("/api/machines")
def create_new_machine(
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva máquina
    """
    machine = models.Machine(
        name=data.get("name"),
        description=data.get("description"),
        location=data.get("location"),
        status=data.get("status"),
        model_id=data.get("model_id"),
        sensor_id=data.get("sensor_id"),
        route=data.get("route")
    )
    return crud.create_machine(db, machine).__dict__

@app.put("/api/machines/{machine_id}")
def update_machine_info(
    machine_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza información de una máquina existente
    """
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    
    machine.name = data.get("name", machine.name)
    machine.description = data.get("description", machine.description)
    machine.location = data.get("location", machine.location)
    machine.status = data.get("status", machine.status)
    machine.model_id = data.get("model_id", machine.model_id)
    machine.sensor_id = data.get("sensor_id", machine.sensor_id)
    machine.route = data.get("route", machine.route)
    
    return crud.update_machine(db, machine).__dict__

@app.delete("/api/machines/{machine_id}")
def delete_machine_info(machine_id: int, db: Session = Depends(get_db)):
    """
    Elimina una máquina
    """
    success = crud.delete_machine(db, machine_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    
    return {"status": "ok", "message": f"Máquina {machine_id} eliminada correctamente"}

@app.get("/api/models")
def get_all_models(db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los modelos
    """
    models_list = crud.get_models(db)
    return [model.__dict__ for model in models_list]

@app.get("/api/models/{model_id}")
def get_model_info(model_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información de un modelo por su ID
    """
    model = crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    return model.__dict__

@app.post("/api/models")
async def create_model(
    model_file: UploadFile = File(...),
    scaler_file: UploadFile = None,
    name: str = Form(...),
    description: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo modelo con un archivo .h5 y opcionalmente un archivo .pkl
    """
    try:
        # Validar tipo de archivo
        if not model_file.filename.endswith('.h5'):
            raise HTTPException(
                status_code=400, 
                detail="El archivo del modelo debe ser de tipo .h5"
            )
        
        if scaler_file and not scaler_file.filename.endswith('.pkl'):
            raise HTTPException(
                status_code=400, 
                detail="El archivo del escalador debe ser de tipo .pkl"
            )
        
        # Crear directorios si no existen
        os.makedirs(MODELO_DIR, exist_ok=True)
        
        # Generar nombres únicos para los archivos
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        model_filename = f"{timestamp}_{model_file.filename}"
        model_path = os.path.join(MODELO_DIR, model_filename)
        
        # Guardar archivo del modelo
        with open(model_path, "wb") as f:
            f.write(await model_file.read())
        
        # Guardar archivo del escalador si se proporciona
        scaler_path = None
        if scaler_file:
            scaler_filename = f"{timestamp}_{scaler_file.filename}"
            scaler_path = os.path.join(MODELO_DIR, scaler_filename)
            with open(scaler_path, "wb") as f:
                f.write(await scaler_file.read())
        
        # Crear registro en la base de datos
        new_model = models.Model(
            route_h5=model_path,
            route_pkl=scaler_path,
            name=name,
            description=description
        )
        
        created_model = crud.create_model(db, new_model)
        
        return {
            "status": "success",
            "message": "Modelo creado correctamente",
            "model": created_model.__dict__
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear el modelo: {str(e)}")

@app.put("/api/models/{model_id}")
async def update_model(
    model_id: int,
    model_file: UploadFile = None,
    scaler_file: UploadFile = None,
    name: str = Form(None),
    description: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza un modelo existente
    """
    try:
        # Verificar si el modelo existe
        existing_model = crud.get_model_by_id(db, model_id)
        if not existing_model:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        
        # Actualizar campos si se proporcionan
        if name:
            existing_model.name = name
        
        if description is not None:
            existing_model.description = description
        
        # Manejar archivo del modelo si se proporciona
        if model_file:
            if not model_file.filename.endswith('.h5'):
                raise HTTPException(
                    status_code=400, 
                    detail="El archivo del modelo debe ser de tipo .h5"
                )
            
            # Eliminar archivo anterior si existe y no es el predeterminado
            old_model_path = existing_model.route_h5
            if os.path.exists(old_model_path) and os.path.basename(old_model_path) != "modelo_pdm.h5":
                try:
                    os.remove(old_model_path)
                except:
                    pass  # Si falla al eliminar, continuar de todos modos
            
            # Guardar nuevo archivo
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            model_filename = f"{timestamp}_{model_file.filename}"
            model_path = os.path.join(MODELO_DIR, model_filename)
            
            with open(model_path, "wb") as f:
                f.write(await model_file.read())
            
            existing_model.route_h5 = model_path
        
        # Manejar archivo del escalador si se proporciona
        if scaler_file:
            if not scaler_file.filename.endswith('.pkl'):
                raise HTTPException(
                    status_code=400, 
                    detail="El archivo del escalador debe ser de tipo .pkl"
                )
            
            # Eliminar archivo anterior si existe
            old_scaler_path = existing_model.route_pkl
            if old_scaler_path and os.path.exists(old_scaler_path):
                try:
                    os.remove(old_scaler_path)
                except:
                    pass  # Si falla al eliminar, continuar de todos modos
            
            # Guardar nuevo archivo
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            scaler_filename = f"{timestamp}_{scaler_file.filename}"
            scaler_path = os.path.join(MODELO_DIR, scaler_filename)
            
            with open(scaler_path, "wb") as f:
                f.write(await scaler_file.read())
            
            existing_model.route_pkl = scaler_path
        
        # Actualizar timestamp
        existing_model.last_update = datetime.now()
        
        # Guardar cambios
        updated_model = crud.update_model(db, existing_model)
        
        return {
            "status": "success",
            "message": "Modelo actualizado correctamente",
            "model": updated_model.__dict__
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar el modelo: {str(e)}")

@app.delete("/api/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    """
    Elimina un modelo existente
    """
    try:
        # Verificar si el modelo existe
        model = crud.get_model_by_id(db, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        
        # Verificar si el modelo está siendo utilizado por alguna máquina
        machines_using_model = db.query(models.Machine).filter(
            models.Machine.model_id == model_id
        ).count()
        
        if machines_using_model > 0:
            raise HTTPException(
                status_code=400, 
                detail="No se puede eliminar el modelo porque está siendo utilizado por una o más máquinas"
            )
        
        # Eliminar archivos asociados
        if model.route_h5 and os.path.exists(model.route_h5):
            try:
                os.remove(model.route_h5)
            except:
                pass  # Si falla al eliminar, continuar de todos modos
        
        if model.route_pkl and os.path.exists(model.route_pkl):
            try:
                os.remove(model.route_pkl)
            except:
                pass  # Si falla al eliminar, continuar de todos modos
        
        # Eliminar registro de la base de datos
        crud.delete_model(db, model_id)
        
        return {
            "status": "success",
            "message": "Modelo eliminado correctamente"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar el modelo: {str(e)}")

# ==========================================================================
# RUTAS API PARA LÍMITES DE ACELERACIÓN
# ==========================================================================

@app.get("/api/limits/default")
def get_default_limits():
    """
    Devuelve los límites por defecto para los ejes X, Y, Z
    """
    # Valores por defecto (se pueden ajustar según necesidades)
    default_limits = {
        "x": {
            "sigma2": {
                "lower": -2.36,
                "upper": 2.18
            },
            "sigma3": {
                "lower": -3.50,
                "upper": 3.32
            }
        },
        "y": {
            "sigma2": {
                "lower": 7.18,
                "upper": 12.09
            },
            "sigma3": {
                "lower": 5.95,
                "upper": 13.32
            }
        },
        "z": {
            "sigma2": {
                "lower": -2.39,
                "upper": 1.11
            },
            "sigma3": {
                "lower": -3.26,
                "upper": 1.98
            }
        }
    }
    
    return default_limits

@app.get("/api/limits")
def get_limits(db: Session = Depends(get_db)):
    """
    Obtiene los límites actuales de la tabla LimitConfig
    Si no existen, devuelve los límites por defecto
    """
    try:
        # Obtener la configuración existente o crear una con valores por defecto
        config = crud.get_or_create_limit_config(db)
        
        # Convertir a formato esperado por el frontend
        limits = {
            "x": {
                "sigma2": {
                    "lower": config.acc_x_2inf,
                    "upper": config.acc_x_2sup
                },
                "sigma3": {
                    "lower": config.acc_x_3inf,
                    "upper": config.acc_x_3sup
                }
            },
            "y": {
                "sigma2": {
                    "lower": config.acc_y_2inf,
                    "upper": config.acc_y_2sup
                },
                "sigma3": {
                    "lower": config.acc_y_3inf,
                    "upper": config.acc_y_3sup
                }
            },
            "z": {
                "sigma2": {
                    "lower": config.acc_z_2inf,
                    "upper": config.acc_z_2sup
                },
                "sigma3": {
                    "lower": config.acc_z_3inf,
                    "upper": config.acc_z_3sup
                }
            }
        }
        
        return limits
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener límites: {str(e)}")

@app.post("/api/limits/save")
def save_limits(
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Guarda los límites personalizados en la tabla LimitConfig
    """
    try:
        # Extraer límites de la petición
        limits = data.get("limits")
        
        if not limits:
            raise HTTPException(status_code=400, detail="Datos incompletos")
        
        # Obtener la configuración existente o crear una nueva
        config = crud.get_or_create_limit_config(db)
        
        # Actualizar los valores
        config.acc_x_2inf = limits["x"]["sigma2"]["lower"]
        config.acc_x_2sup = limits["x"]["sigma2"]["upper"]
        config.acc_x_3inf = limits["x"]["sigma3"]["lower"]
        config.acc_x_3sup = limits["x"]["sigma3"]["upper"]
        
        config.acc_y_2inf = limits["y"]["sigma2"]["lower"]
        config.acc_y_2sup = limits["y"]["sigma2"]["upper"]
        config.acc_y_3inf = limits["y"]["sigma3"]["lower"]
        config.acc_y_3sup = limits["y"]["sigma3"]["upper"]
        
        config.acc_z_2inf = limits["z"]["sigma2"]["lower"]
        config.acc_z_2sup = limits["z"]["sigma2"]["upper"]
        config.acc_z_3inf = limits["z"]["sigma3"]["lower"]
        config.acc_z_3sup = limits["z"]["sigma3"]["upper"]
        
        # Guardar cambios
        crud.update_limit_config(db, config)
        
        return {"status": "success", "limits": limits}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar límites: {str(e)}")

@app.post("/api/limits/reset")
def reset_limits(db: Session = Depends(get_db)):
    """
    Restablece los límites a los valores por defecto
    """
    try:
        # Eliminar la configuración existente para forzar el uso de valores por defecto
        crud.delete_limit_config(db)
        
        # Crear una nueva configuración con valores por defecto
        config = crud.get_or_create_limit_config(db)
        
        # Convertir a formato esperado por el frontend
        limits = {
            "x": {
                "sigma2": {
                    "lower": config.acc_x_2inf,
                    "upper": config.acc_x_2sup
                },
                "sigma3": {
                    "lower": config.acc_x_3inf,
                    "upper": config.acc_x_3sup
                }
            },
            "y": {
                "sigma2": {
                    "lower": config.acc_y_2inf,
                    "upper": config.acc_y_2sup
                },
                "sigma3": {
                    "lower": config.acc_y_3inf,
                    "upper": config.acc_y_3sup
                }
            },
            "z": {
                "sigma2": {
                    "lower": config.acc_z_2inf,
                    "upper": config.acc_z_2sup
                },
                "sigma3": {
                    "lower": config.acc_z_3inf,
                    "upper": config.acc_z_3sup
                }
            }
        }
        
        return {"status": "success", "limits": limits}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al restablecer límites: {str(e)}")
        
# Sistema heredado - mantener para compatibilidad
@app.post("/api/limits/save_legacy")
def save_limits_legacy(
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Guarda los límites personalizados para un sensor (método heredado)
    """
    try:
        # Extraer datos de la petición
        sensor_id = data.get("sensor_id")
        limits = data.get("limits")
        
        if not sensor_id or not limits:
            raise HTTPException(status_code=400, detail="Datos incompletos")
        
        # Nombre de la configuración
        config_name = f"limits_sensor_{sensor_id}"
        
        # Convertir límites a JSON
        limits_json = json.dumps(limits)
        
        # Verificar si ya existe una configuración
        existing_config = crud.get_config_by_name(db, config_name)
        
        if existing_config:
            # Actualizar configuración existente
            existing_config.value = limits_json
            crud.update_config(db, existing_config)
        else:
            # Crear nueva configuración
            new_config = models.UserConfig(
                name=config_name,
                value=limits_json
            )
            crud.create_config(db, new_config)
        
        # También actualizar la tabla LimitConfig global
        # Obtener la configuración existente o crear una nueva
        limit_config = crud.get_or_create_limit_config(db)
        
        # Actualizar los valores
        limit_config.acc_x_2inf = limits["x"]["sigma2"]["lower"]
        limit_config.acc_x_2sup = limits["x"]["sigma2"]["upper"]
        limit_config.acc_x_3inf = limits["x"]["sigma3"]["lower"]
        limit_config.acc_x_3sup = limits["x"]["sigma3"]["upper"]
        
        limit_config.acc_y_2inf = limits["y"]["sigma2"]["lower"]
        limit_config.acc_y_2sup = limits["y"]["sigma2"]["upper"]
        limit_config.acc_y_3inf = limits["y"]["sigma3"]["lower"]
        limit_config.acc_y_3sup = limits["y"]["sigma3"]["upper"]
        
        limit_config.acc_z_2inf = limits["z"]["sigma2"]["lower"]
        limit_config.acc_z_2sup = limits["z"]["sigma2"]["upper"]
        limit_config.acc_z_3inf = limits["z"]["sigma3"]["lower"]
        limit_config.acc_z_3sup = limits["z"]["sigma3"]["upper"]
        
        # Guardar cambios
        crud.update_limit_config(db, limit_config)
        
        return {"status": "success", "limits": limits}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar límites: {str(e)}")

# Función auxiliar para verificar si hay configuración
def check_configuration_exists(db: Session) -> bool:
    """Verifica si existe al menos una configuración básica para el funcionamiento del dashboard"""
    # Verificar si hay al menos una máquina configurada
    machines_count = db.query(models.Machine).count()
    if machines_count == 0:
        return False
    
    # Verificar si hay al menos un sensor configurado
    sensors_count = db.query(models.Sensor).count()
    if sensors_count == 0:
        return False
    
    # Verificar si hay al menos un modelo configurado
    models_count = db.query(models.Model).count()
    if models_count == 0:
        return False
    
    return True

@app.get("/api/data")
def get_data_for_dashboard(
    machine: int,
    sensor: int,
    timeRange: str = "day",
    db: Session = Depends(get_db)
):
    """
    Endpoint principal para obtener datos para el dashboard.
    Verifica configuración y carga datos específicos de la máquina y sensor seleccionados.
    """
    # Verificar que existe configuración
    if not check_configuration_exists(db):
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": "No existe configuración. Por favor, configure al menos una máquina, sensor y modelo en la sección de Configuración."
            }
        )
    
    # Obtener la máquina seleccionada
    machine_obj = crud.get_machine_by_id(db, machine)
    if not machine_obj:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": f"Máquina con ID {machine} no encontrada"
            }
        )
    
    # Verificar que la máquina tiene un modelo asociado
    if not machine_obj.model_id:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": f"La máquina {machine_obj.name} no tiene un modelo de predicción asociado. Configure uno en la sección de Configuración."
            }
        )
    
    # Obtener el sensor seleccionado
    sensor_obj = crud.get_sensor_by_id(db, sensor)
    if not sensor_obj:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": f"Sensor con ID {sensor} no encontrado"
            }
        )
    
    # Obtener el modelo asociado a la máquina
    model_obj = crud.get_model_by_id(db, machine_obj.model_id)
    if not model_obj:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": f"Modelo con ID {machine_obj.model_id} no encontrado"
            }
        )
    
    # Determinar el rango de fechas según el parámetro timeRange
    now = datetime.now()
    if timeRange == "hour":
        start_date = now - timedelta(hours=1)
    elif timeRange == "day":
        start_date = now - timedelta(days=1)
    elif timeRange == "week":
        start_date = now - timedelta(days=7)
    elif timeRange == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=1)  # Default: 1 día
    
    # Obtener datos de vibración
    vibration_data = crud.get_vibration_data_by_sensor_and_dates(db, sensor, start_date, now)
    
    # Obtener límites configurados para este sensor
    limits = get_limits(db)
    
    # Formatear datos para el dashboard
    timestamps = []
    values_x = []
    values_y = []
    values_z = []
    status = []
    
    for data in vibration_data:
        timestamps.append(data.date.isoformat())
        values_x.append(float(data.acceleration_x) if data.acceleration_x is not None else None)
        values_y.append(float(data.acceleration_y) if data.acceleration_y is not None else None)
        values_z.append(float(data.acceleration_z) if data.acceleration_z is not None else None)
        status.append(data.severity)
    
    # Calcular estadísticas
    stats = {
        "x": calculate_statistics(values_x, limits),
        "y": calculate_statistics(values_y, limits),
        "z": calculate_statistics(values_z, limits)
    }
    
    # Obtener alertas
    alerts = crud.get_alert_counts(db, sensor)
    
    return {
        "status": "success",
        "chartData": {
            "timestamps": timestamps,
            "x": values_x,
            "y": values_y,
            "z": values_z,
            "status": status
        },
        "stats": stats,
        "alerts": alerts,
        "machine": {
            "id": machine_obj.machine_id,
            "name": machine_obj.name,
            "model": {
                "id": model_obj.model_id,
                "name": model_obj.name,
                "route_h5": model_obj.route_h5,
                "route_pkl": model_obj.route_pkl
            }
        }
    }

def calculate_statistics(values, limits):
    """Calcula estadísticas para los valores de aceleración"""
    if not values:
        return {
            "mean": 0,
            "std": 0,
            "min": 0,
            "max": 0,
            "sigma2": {"upper": 0, "lower": 0},
            "sigma3": {"upper": 0, "lower": 0}
        }
    
    # Calcular estadísticas básicas
    mean = np.mean(values)
    std = np.std(values)
    min_val = np.min(values)
    max_val = np.max(values)
    
    # Límites sigma personalizados o calculados
    sigma2_factor = limits.get("sigma2_factor", 2)
    sigma3_factor = limits.get("sigma3_factor", 3)
    
    sigma2_upper = mean + (sigma2_factor * std)
    sigma2_lower = mean - (sigma2_factor * std)
    sigma3_upper = mean + (sigma3_factor * std)
    sigma3_lower = mean - (sigma3_factor * std)
    
    return {
        "mean": float(mean),
        "std": float(std),
        "min": float(min_val),
        "max": float(max_val),
        "sigma2": {"upper": float(sigma2_upper), "lower": float(sigma2_lower)},
        "sigma3": {"upper": float(sigma3_upper), "lower": float(sigma3_lower)}
    }

def get_default_limits():
    """Devuelve configuración de límites por defecto"""
    return {
        "sigma2_factor": 2,
        "sigma3_factor": 3,
        "use_dynamic_limits": True
    }

@app.get("/api/machine/{machine_id}/sensors")
def get_machine_sensors(machine_id: int, db: Session = Depends(get_db)):
    """
    Obtiene los sensores asociados a una máquina
    """
    # Verificar que la máquina existe
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": f"Máquina con ID {machine_id} no encontrada"
            }
        )
    
    # Obtener sensores asociados a la máquina
    sensors = crud.get_sensors_by_machine(db, machine_id)
    
    # Si la máquina tiene un sensor_id configurado pero no está en la lista, añadirlo
    if machine.sensor_id and not any(s.get('sensor_id') == machine.sensor_id for s in sensors):
        sensor = crud.get_sensor_by_id(db, machine.sensor_id)
        if sensor:
            sensors.append(sensor.__dict__)
    
    return {
        "status": "success",
        "machine_id": machine_id,
        "machine_name": machine.name,
        "sensors": [{
            "id": sensor.get('sensor_id'),
            "name": sensor.get('name'),
            "description": sensor.get('description'),
            "location": sensor.get('location'),
            "type": sensor.get('type')
        } for sensor in sensors]
    }