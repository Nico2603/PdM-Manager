# app/main.py

import os
from datetime import datetime, timedelta
import numpy as np
import pickle
import joblib
import shutil

from fastapi import FastAPI, Depends, HTTPException, Body, File, UploadFile, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
import csv
import json

# Importar la configuración de la BD y el modelo de datos
from app.database import engine, Base, get_db, is_using_database
from app import crud, models

# Importar CRUD en memoria para cuando no hay BD
from app import memory_crud

# Importar funciones de simulación
from app.simulator import (
    start_simulation,
    stop_simulation,
    get_simulation_status,
    upload_csv,
    list_csv_files,
    validate_csv_format,
    check_level3_condition,
    # Importar funciones para gestión en memoria
    get_machines,
    get_machine,
    create_machine,
    update_machine,
    delete_machine,
    get_sensors,
    get_sensor,
    get_sensors_by_machine,
    create_sensor,
    update_sensor,
    delete_sensor,
    get_models,
    get_model,
    create_model,
    update_model,
    delete_model,
    # Importar funciones para límites estadísticos
    get_statistical_limits,
    update_statistical_limits
)

# Cargar modelo entrenado (Keras/TensorFlow) desde la carpeta "Modelo"
from tensorflow.keras.models import load_model

# Ruta al modelo .h5
model_path = os.path.join("Modelo", "modeloRNN_multiclase_v3_finetuned.h5")
model = load_model(model_path)

# Ruta al escalador (se cargará cuando exista)
scaler_path = os.path.join("Modelo", "scaler_RNN.pkl")
scaler = None
try:
    # Intentar cargar el escalador si existe
    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)
        print("Escalador cargado correctamente")
except Exception as e:
    print(f"Error al cargar el escalador: {str(e)}")

# Ruta al archivo CSV predeterminado
default_csv_path = os.path.join("data", "filtered_dataf.csv")

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

# Solo crear las tablas si estamos usando una base de datos real
try:
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas o verificadas en la base de datos.")
except Exception as e:
    print(f"No se pudieron crear las tablas: {e}")
    print("La aplicación continuará en modo memoria.")

# Montar la carpeta estática (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

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
    id_sensor: int
    id_locacion: int = Field(default=1, description="ID de localización del sensor (opcional)")
    eje_x: float
    eje_y: float
    eje_z: float

class SensorDataBatch(BaseModel):
    registros: List[SensorData]

class SimulationParams(BaseModel):
    file_path: str
    interval: Optional[int] = 5


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
    pred = model.predict(arr)
    predicted_class = int(np.argmax(pred, axis=1)[0])
    severity_text = SEVERITY_MAPPING.get(predicted_class, "Desconocido")
    confidence = float(np.max(pred)) * 100  # Confianza en porcentaje

    return {
        "sensor_id": sensor_id,
        "start_date": start_date,
        "end_date": end_date,
        "severity": predicted_class,
        "severity_text": severity_text,
        "confidence": confidence,
        "prediction_raw": pred.tolist()
    }


@app.post("/api/sensor_data")
def receive_sensor_data(sensor_data: SensorData, db: Session = Depends(get_db)):
    """
    Recibe datos de un sensor Arduino, procesa con el modelo y guarda en la BD.
    
    Flujo:
    1. Recibe datos de aceleración (X, Y, Z)
    2. Escala los datos con el scaler.pkl
    3. Clasifica con el modelo RNN (.h5)
    4. Verifica si aplica condición de Nivel 3
    5. Guarda en la base de datos
    """
    # Verificar la disponibilidad del modelo
    if model is None:
        raise HTTPException(status_code=500, detail="Modelo no cargado")
    
    # Preparar datos para la predicción
    data_array = np.array([[
        sensor_data.eje_x,
        sensor_data.eje_y,
        sensor_data.eje_z
    ]], dtype=np.float32)
    
    # Escalar datos si el escalador está disponible
    if scaler:
        data_array = scaler.transform(data_array)
    
    # Ajustar forma para el modelo RNN (1, timesteps, features)
    rnn_input = data_array.reshape(1, 1, 3)
    
    # Hacer predicción
    prediction = model.predict(rnn_input, verbose=0)
    severity = int(np.argmax(prediction[0]))
    confidence = float(np.max(prediction)) * 100  # Confianza en porcentaje
    
    # Verificar condición de Nivel 3
    level3 = False
    if severity == 2:  # Si es nivel 2, verificar si aplica nivel 3
        level3 = check_level3_condition(db, sensor_data.id_sensor)
        if level3:
            severity = 3  # Elevar a Nivel 3
    
    # Guardar en la base de datos
    db_record = crud.create_vibration_data(
        db=db,
        sensor_id=sensor_data.id_sensor,
        acceleration_x=sensor_data.eje_x,
        acceleration_y=sensor_data.eje_y,
        acceleration_z=sensor_data.eje_z,
        severity=severity
    )
    
    # Si hay severidad > 0, crear alerta
    if severity > 0:
        alert = models.Alert(
            sensor_id=sensor_data.id_sensor,
            timestamp=datetime.now(),
            vibration_data_id=db_record.data_id,
            severity=severity,
            error_type=SEVERITY_MAPPING.get(severity, "Desconocido"),
            acknowledged=False
        )
        db.add(alert)
        db.commit()
    
    # Devolver resultado
    return {
        "data_id": db_record.data_id,
        "sensor_id": db_record.sensor_id,
        "severity": severity,
        "severity_text": SEVERITY_MAPPING.get(severity, "Desconocido"),
        "confidence": confidence,
        "date": db_record.date.isoformat(),
        "elevated_to_level3": level3
    }


@app.post("/api/sensor_data_batch")
def receive_sensor_data_batch(batch_data: SensorDataBatch, db: Session = Depends(get_db)):
    """
    Recibe un lote de datos de sensores, procesa cada uno y guarda en la BD.
    Útil para envíos periódicos desde Arduino (cada X segundos).
    """
    results = []
    
    for sensor_data in batch_data.registros:
        # Preparar datos para la predicción
        data_array = np.array([[
            sensor_data.eje_x,
            sensor_data.eje_y,
            sensor_data.eje_z
        ]], dtype=np.float32)
        
        # Escalar datos si el escalador está disponible
        if scaler:
            data_array = scaler.transform(data_array)
        
        # Ajustar forma para el modelo RNN
        rnn_input = data_array.reshape(1, 1, 3)
        
        # Hacer predicción
        prediction = model.predict(rnn_input, verbose=0)
        severity = int(np.argmax(prediction[0]))
        confidence = float(np.max(prediction)) * 100
        
        # Verificar condición de Nivel 3
        level3 = False
        if severity == 2:  # Si es nivel 2, verificar si aplica nivel 3
            level3 = check_level3_condition(db, sensor_data.id_sensor)
            if level3:
                severity = 3  # Elevar a Nivel 3
        
        # Guardar en la base de datos
        db_record = crud.create_vibration_data(
            db=db,
            sensor_id=sensor_data.id_sensor,
            acceleration_x=sensor_data.eje_x,
            acceleration_y=sensor_data.eje_y,
            acceleration_z=sensor_data.eje_z,
            severity=severity
        )
        
        # Si hay severidad > 0, crear alerta
        if severity > 0:
            alert = models.Alert(
                sensor_id=sensor_data.id_sensor,
                timestamp=datetime.now(),
                vibration_data_id=db_record.data_id,
                severity=severity,
                error_type=SEVERITY_MAPPING.get(severity, "Desconocido"),
                acknowledged=False
            )
            db.add(alert)
            db.commit()
        
        results.append({
            "data_id": db_record.data_id,
            "sensor_id": db_record.sensor_id,
            "severity": severity,
            "severity_text": SEVERITY_MAPPING.get(severity, "Desconocido"),
            "confidence": confidence,
            "elevated_to_level3": level3
        })
    
    return {"processed": len(results), "results": results}


@app.get("/reload_model")
def reload_model():
    """
    Recarga el modelo y el escalador desde los archivos.
    Útil cuando se actualiza el modelo o el escalador sin reiniciar la aplicación.
    """
    global model, scaler
    
    try:
        # Recargar modelo
        model = load_model(model_path)
        
        # Recargar escalador si existe
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
            scaler_status = "cargado correctamente"
        else:
            scaler = None
            scaler_status = "no encontrado"
            
        return {
            "status": "ok",
            "model": "cargado correctamente",
            "scaler": scaler_status
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


# --- Endpoints para Simulación CSV --- #

@app.get("/api/simulation/files")
def list_csv_files_endpoint():
    """Lista los archivos CSV disponibles para simulación"""
    return list_csv_files()


@app.post("/api/simulation/upload")
async def upload_simulation_file(file: UploadFile = File(...)):
    """Sube un archivo CSV para simulación"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos CSV")
    
    # Leer contenido del archivo
    content = await file.read()
    
    # Subir archivo
    result = upload_csv(content, file.filename)
    return result


@app.post("/api/simulation/start")
def start_simulation_endpoint(
    file: str = Query(..., description="Nombre del archivo CSV para la simulación"),
    interval: int = Query(5, description="Intervalo entre registros en segundos"),
    db: Session = Depends(get_db)
):
    """Inicia la simulación en tiempo real utilizando el archivo CSV especificado"""
    # Construir ruta al archivo
    file_path = os.path.join("data", file)
    
    # Verificar que el archivo existe
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {file}")
    
    # Iniciar simulación
    result = start_simulation(db, file_path, interval)
    
    return result


@app.post("/api/simulation/start-default")
def start_default_simulation(
    interval: int = Query(5, description="Intervalo entre registros en segundos"),
    db: Session = Depends(get_db)
):
    """Inicia una simulación usando el archivo CSV predeterminado (filtered_dataf.csv)"""
    try:
        # Verificar que el archivo predeterminado existe
        if not os.path.exists(default_csv_path):
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": f"Archivo predeterminado no encontrado: {os.path.basename(default_csv_path)}"}
            )
        
        # Validar formato del CSV
        if not validate_csv_format(default_csv_path):
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "El archivo CSV no tiene el formato correcto. Debe contener columnas: timestamp, sensor_id, x, y, z"}
            )
        
        # Iniciar simulación con archivo predeterminado
        result = start_simulation(
            db=db,
            file_path=default_csv_path,
            interval_seconds=interval
        )
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": "Simulación iniciada con archivo predeterminado", "details": result}
        )
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error al iniciar simulación: {str(e)}"}
        )


@app.post("/api/simulation/stop")
def stop_simulation_endpoint():
    """Detiene la simulación en curso"""
    return stop_simulation()


@app.get("/api/simulation/status")
def simulation_status():
    """Obtiene el estado actual de la simulación"""
    return get_simulation_status()


# --- Endpoints para Sensores --- #

@app.get("/api/sensors", response_model=List[Dict[str, Any]])
def get_sensors_endpoint(db: Session = Depends(get_db)):
    """Obtiene la lista de todos los sensores"""
    try:
        # Usar el CRUD apropiado según si estamos con BD o en memoria
        crud_module = get_crud()
        
        if is_using_database():
            sensors = crud_module.get_sensors(db)
        else:
            sensors = crud_module.get_sensors()
            
        return sensors
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener sensores: {str(e)}")

@app.post("/api/sensors", response_model=Dict[str, Any])
def create_sensor_endpoint(sensor_data: Dict[str, Any], db: Session = Depends(get_db)):
    """Crea un nuevo sensor"""
    try:
        # Usar el CRUD apropiado según si estamos con BD o en memoria
        crud_module = get_crud()
        
        if is_using_database():
            # Para la BD necesitamos crear un objeto Sensor
            sensor = models.Sensor(**sensor_data)
            result = crud_module.create_sensor(db, sensor)
        else:
            # Para memoria simplemente pasamos los datos
            result = crud_module.create_sensor(sensor_data)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al crear sensor: {str(e)}")

@app.get("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def get_sensor_endpoint(sensor_id: int, db: Session = Depends(get_db)):
    """Obtiene un sensor por su ID"""
    try:
        # Usar el CRUD apropiado según si estamos con BD o en memoria
        crud_module = get_crud()
        
        if is_using_database():
            sensor = crud_module.get_sensor(db, sensor_id)
        else:
            sensor = crud_module.get_sensor(sensor_id)
            
        if sensor is None:
            raise HTTPException(status_code=404, detail="Sensor no encontrado")
            
        return sensor
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener sensor: {str(e)}")

@app.put("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def update_sensor_endpoint(
    sensor_id: int,
    sensor_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Actualiza un sensor existente"""
    try:
        # Usar el CRUD apropiado según si estamos con BD o en memoria
        crud_module = get_crud()
        
        if is_using_database():
            # Para la BD necesitamos obtener el objeto y actualizarlo
            sensor = crud_module.get_sensor_by_id(db, sensor_id)
            if sensor is None:
                raise HTTPException(status_code=404, detail="Sensor no encontrado")
                
            for key, value in sensor_data.items():
                setattr(sensor, key, value)
                
            result = crud_module.update_sensor(db, sensor)
        else:
            # Para memoria actualizamos directamente
            result = crud_module.update_sensor(sensor_id, sensor_data)
            if result is None:
                raise HTTPException(status_code=404, detail="Sensor no encontrado")
                
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar sensor: {str(e)}")

@app.delete("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def delete_sensor_endpoint(sensor_id: int, db: Session = Depends(get_db)):
    """Elimina un sensor"""
    try:
        # Usar el CRUD apropiado según si estamos con BD o en memoria
        crud_module = get_crud()
        
        if is_using_database():
            success = crud_module.delete_sensor(db, sensor_id)
        else:
            success = crud_module.delete_sensor(sensor_id)
            
        if not success:
            raise HTTPException(status_code=404, detail="Sensor no encontrado")
            
        return {"message": f"Sensor {sensor_id} eliminado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar sensor: {str(e)}")

# --- API: Datos de Vibración ---

@app.get("/api/vibration-data", response_model=List[Dict[str, Any]])
def get_vibration_data(
    sensor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Obtiene datos de vibración, opcionalmente filtrados por sensor_id"""
    if sensor_id:
        data = crud.get_vibration_data_by_sensor(db, sensor_id, limit)
    else:
        data = crud.get_vibration_data(db, limit)
    return data

@app.get("/api/vibration-data/{data_id}", response_model=Dict[str, Any])
def get_vibration_data_by_id(data_id: int, db: Session = Depends(get_db)):
    """Obtiene un registro de vibración por su ID"""
    data = crud.get_vibration_data_by_id(db, data_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Datos no encontrados")
    return data

# --- API: Alertas ---

@app.get("/api/alerts", response_model=List[Dict[str, Any]])
def get_alerts(
    sensor_id: Optional[int] = None,
    acknowledged: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Obtiene alertas, opcionalmente filtradas por sensor_id y/o estado"""
    alerts = crud.get_alerts(db, sensor_id=sensor_id, acknowledged=acknowledged, limit=limit)
    return alerts

@app.put("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """Marca una alerta como reconocida"""
    alert = crud.get_alert_by_id(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    
    crud.acknowledge_alert(db, alert_id)
    return {"message": f"Alerta {alert_id} reconocida"}

# --- API: Dashboard Unificado ---

@app.get("/api/dashboard")
async def get_dashboard_data(sensor_id: Optional[int] = None):
    """Recupera los datos para el dashboard desde la simulación en curso"""
    try:
        # Obtener estado de simulación
        sim_status = get_simulation_status()
        
        # Preparar datos de vibración para el gráfico
        vibration_data = {
            "timestamps": [],
            "x": [],
            "y": [],
            "z": [],
            "status": []
        }
        
        # Recuperar datos recientes de la simulación
        recent_data = sim_status.get("recent_records", [])
        
        # Convertir a formato para el gráfico
        for record in recent_data:
            vibration_data["timestamps"].append(record.get("timestamp", ""))
            vibration_data["x"].append(record.get("x", 0))
            vibration_data["y"].append(record.get("y", 0))
            vibration_data["z"].append(record.get("z", 0))
            vibration_data["status"].append(record.get("severity", 0))
        
        # Calcular estadísticas para límites
        if len(vibration_data["x"]) > 0:
            mean_x = sum(vibration_data["x"]) / len(vibration_data["x"])
            mean_y = sum(vibration_data["y"]) / len(vibration_data["y"])
            mean_z = sum(vibration_data["z"]) / len(vibration_data["z"])
            
            # Desviación estándar
            std_x = np.std(vibration_data["x"]) if len(vibration_data["x"]) > 1 else 1
            std_y = np.std(vibration_data["y"]) if len(vibration_data["y"]) > 1 else 1
            std_z = np.std(vibration_data["z"]) if len(vibration_data["z"]) > 1 else 1
            
            stats = {
                "mean": {"x": mean_x, "y": mean_y, "z": mean_z},
                "std_dev": {"x": std_x, "y": std_y, "z": std_z}
            }
        else:
            stats = {
                "mean": {"x": 0, "y": 0, "z": 0},
                "std_dev": {"x": 1, "y": 1, "z": 1}
            }
        
        # Recuperar alertas recientes
        alerts_count = {
            "level1": sim_status.get("alerts_level1", 0),
            "level2": sim_status.get("alerts_level2", 0),
            "level3": sim_status.get("alerts_level3", 0),
            "total": sim_status.get("alerts_total", 0)
        }
        
        # Obtener límites estadísticos predefinidos
        limits = get_statistical_limits()
        
        # Construir respuesta
        response = {
            "vibration_data": vibration_data,
            "recent_data": recent_data,
            "alerts_count": alerts_count,
            "recent_alerts": sim_status.get("recent_alerts", []),
            "stats": stats,
            "statistical_limits": limits,
            "simulation_status": {
                "running": sim_status.get("running", False),
                "progress": sim_status.get("progress", 0),
                "current_record": sim_status.get("processed_records", 0),
                "total_records": sim_status.get("total_records", 0)
            }
        }
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# --- API: Configuración Unificada ---

@app.get("/api/config/machines")
def get_machines(db: Session = Depends(get_db)):
    """Obtiene la lista de máquinas disponibles"""
    return crud.get_machines(db)

@app.get("/api/config/machine/{machine_id}")
def get_machine_config(machine_id: int, db: Session = Depends(get_db)):
    """Obtiene la configuración de una máquina con sus sensores y modelo asignado"""
    machine = crud.get_machine(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    
    # Obtener sensores asociados
    sensors = crud.get_sensors_by_machine(db, machine_id)
    
    # Obtener modelo asociado
    model_info = crud.get_model(db, machine.model_id) if machine.model_id else None
    
    return {
        "machine": machine,
        "sensors": sensors,
        "model": model_info
    }

@app.get("/api/machines")
async def api_get_machines():
    """Obtiene todas las máquinas almacenadas en memoria"""
    return get_machines()

@app.get("/api/machines/{machine_id}")
async def api_get_machine(machine_id: int):
    """Obtiene una máquina específica por su ID"""
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    return machine

@app.post("/api/machines")
async def api_create_machine(machine_data: Dict[str, Any]):
    """Crea una nueva máquina en memoria"""
    required_fields = ["name", "type", "location"]
    for field in required_fields:
        if field not in machine_data:
            raise HTTPException(status_code=400, detail=f"Campo requerido: {field}")
    
    return create_machine(machine_data)

@app.put("/api/machines/{machine_id}")
async def api_update_machine(machine_id: int, machine_data: Dict[str, Any]):
    """Actualiza una máquina existente"""
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    
    updated_machine = update_machine(machine_id, machine_data)
    return updated_machine

@app.delete("/api/machines/{machine_id}")
async def api_delete_machine(machine_id: int):
    """Elimina una máquina de la memoria"""
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    
    success = delete_machine(machine_id)
    if success:
        return {"message": f"Máquina {machine_id} eliminada correctamente"}
    else:
        raise HTTPException(status_code=500, detail="Error al eliminar la máquina")

@app.get("/api/sensors")
async def api_get_sensors(machine_id: Optional[int] = None):
    """Obtiene todos los sensores o los asociados a una máquina específica"""
    if machine_id:
        return get_sensors_by_machine(machine_id)
    return get_sensors()

@app.get("/api/sensors/{sensor_id}")
async def api_get_sensor(sensor_id: int):
    """Obtiene un sensor específico por su ID"""
    sensor = get_sensor(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    return sensor

@app.post("/api/sensors")
async def api_create_sensor(sensor_data: Dict[str, Any]):
    """Crea un nuevo sensor en memoria"""
    required_fields = ["name", "machine_id", "type", "location"]
    for field in required_fields:
        if field not in sensor_data:
            raise HTTPException(status_code=400, detail=f"Campo requerido: {field}")
    
    # Verificar que la máquina existe
    machine_id = sensor_data.get("machine_id")
    if not get_machine(machine_id):
        raise HTTPException(status_code=400, detail=f"La máquina con ID {machine_id} no existe")
    
    return create_sensor(sensor_data)

@app.put("/api/sensors/{sensor_id}")
async def api_update_sensor(sensor_id: int, sensor_data: Dict[str, Any]):
    """Actualiza un sensor existente"""
    sensor = get_sensor(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    
    # Si se cambió la máquina, verificar que existe
    machine_id = sensor_data.get("machine_id")
    if machine_id and not get_machine(machine_id):
        raise HTTPException(status_code=400, detail=f"La máquina con ID {machine_id} no existe")
    
    updated_sensor = update_sensor(sensor_id, sensor_data)
    return updated_sensor

@app.delete("/api/sensors/{sensor_id}")
async def api_delete_sensor(sensor_id: int):
    """Elimina un sensor de la memoria"""
    sensor = get_sensor(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor no encontrado")
    
    success = delete_sensor(sensor_id)
    if success:
        return {"message": f"Sensor {sensor_id} eliminado correctamente"}
    else:
        raise HTTPException(status_code=500, detail="Error al eliminar el sensor")

@app.get("/api/models")
async def api_get_models():
    """Obtiene todos los modelos almacenados en memoria"""
    return get_models()

@app.get("/api/models/{model_id}")
async def api_get_model(model_id: int):
    """Obtiene un modelo específico por su ID"""
    model = get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    return model

@app.post("/api/models")
async def api_create_model(model_data: Dict[str, Any]):
    """Crea un nuevo modelo en memoria"""
    required_fields = ["name", "route_h5"]
    for field in required_fields:
        if field not in model_data:
            raise HTTPException(status_code=400, detail=f"Campo requerido: {field}")
    
    return create_model(model_data)

@app.put("/api/models/{model_id}")
async def api_update_model(model_id: int, model_data: Dict[str, Any]):
    """Actualiza un modelo existente"""
    model = get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    
    updated_model = update_model(model_id, model_data)
    return updated_model

@app.delete("/api/models/{model_id}")
async def api_delete_model(model_id: int):
    """Elimina un modelo de la memoria"""
    model = get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    
    success = delete_model(model_id)
    if success:
        return {"message": f"Modelo {model_id} eliminado correctamente"}
    else:
        raise HTTPException(status_code=500, detail="Error al eliminar el modelo")

@app.get("/api/alerts/count")
async def get_alert_counts(sensor_id: Optional[int] = None):
    """Recupera el conteo de alertas por nivel de severidad"""
    try:
        # Obtener estado de simulación para contar alertas
        sim_status = get_simulation_status()
        
        # Contar alertas simuladas por nivel
        counts = {
            "level1": sim_status.get("alerts_level1", 0),
            "level2": sim_status.get("alerts_level2", 0),
            "level3": sim_status.get("alerts_level3", 0),
            "total": sim_status.get("alerts_total", 0)
        }
        
        return counts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/api/alerts/recent")
async def get_recent_alerts(limit: int = 5, sensor_id: Optional[int] = None):
    """Recupera las alertas más recientes generadas durante la simulación"""
    try:
        # Obtener estado de simulación para las alertas recientes
        sim_status = get_simulation_status()
        
        # Recuperar alertas recientes de la simulación
        recent_alerts = sim_status.get("recent_alerts", [])
        
        # Limitar a la cantidad solicitada
        recent_alerts = recent_alerts[:limit]
        
        return recent_alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int):
    """Marca una alerta como reconocida"""
    try:
        # En la simulación, simplemente devolvemos éxito
        return {"success": True, "message": "Alerta reconocida correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/api/simulation/csv-files")
async def get_csv_files():
    """Recupera la lista de archivos CSV disponibles para simulación"""
    try:
        # Obtener lista de archivos CSV
        files = list_csv_files()
        
        # Si el archivo predeterminado existe pero no está en la lista, añadirlo
        default_filename = os.path.basename(default_csv_path)
        if os.path.exists(default_csv_path):
            default_file_listed = any(file["name"] == default_filename for file in files)
            if not default_file_listed:
                # Contar registros en el archivo
                record_count = 0
                try:
                    with open(default_csv_path, 'r') as f:
                        record_count = sum(1 for _ in f) - 1  # Restar 1 por la cabecera
                except:
                    record_count = 0
                
                files.append({
                    "name": default_filename,
                    "path": default_csv_path,
                    "size": os.path.getsize(default_csv_path),
                    "modified": datetime.fromtimestamp(os.path.getmtime(default_csv_path)).isoformat(),
                    "records": record_count
                })
        
        return {"success": True, "files": files}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}", "files": []}

@app.post("/api/simulation/start")
async def start_simulation_endpoint(data: Dict[str, Any]):
    """Inicia la simulación con un archivo CSV específico"""
    try:
        # Si se recibe solo el nombre del archivo, construir la ruta completa
        file = data.get("file", "")
        if file and not os.path.isabs(file):
            file_path = os.path.join("data", file)
        else:
            file_path = file
        
        # Si no se proporciona un archivo, usar el predeterminado
        if not file_path:
            file_path = default_csv_path
        
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            return {"success": False, "message": f"Archivo no encontrado: {file_path}"}
        
        # Iniciar simulación
        db = next(get_db())
        result = start_simulation(
            db=db,
            file_path=file_path,
            interval_seconds=data.get("interval", 5)
        )
        
        return {"success": True, "message": "Simulación iniciada correctamente", "details": result}
    except Exception as e:
        return {"success": False, "message": f"Error al iniciar simulación: {str(e)}"}

@app.post("/api/simulation/stop")
async def stop_simulation_endpoint():
    """Detiene la simulación actual"""
    try:
        result = stop_simulation()
        return {"success": True, "message": "Simulación detenida correctamente", "details": result}
    except Exception as e:
        return {"success": False, "message": f"Error al detener simulación: {str(e)}"}

@app.get("/api/dashboard")
async def get_dashboard_data(sensor_id: Optional[int] = None):
    """Recupera los datos para el dashboard desde la simulación en curso"""
    try:
        # Obtener estado de simulación
        sim_status = get_simulation_status()
        
        # Preparar datos de vibración para el gráfico
        vibration_data = {
            "timestamps": [],
            "x": [],
            "y": [],
            "z": [],
            "status": []
        }
        
        # Recuperar datos recientes de la simulación
        recent_data = sim_status.get("recent_records", [])
        
        # Convertir a formato para el gráfico
        for record in recent_data:
            vibration_data["timestamps"].append(record.get("timestamp", ""))
            vibration_data["x"].append(record.get("x", 0))
            vibration_data["y"].append(record.get("y", 0))
            vibration_data["z"].append(record.get("z", 0))
            vibration_data["status"].append(record.get("severity", 0))
        
        # Calcular estadísticas para límites
        if len(vibration_data["x"]) > 0:
            mean_x = sum(vibration_data["x"]) / len(vibration_data["x"])
            mean_y = sum(vibration_data["y"]) / len(vibration_data["y"])
            mean_z = sum(vibration_data["z"]) / len(vibration_data["z"])
            
            # Desviación estándar
            std_x = np.std(vibration_data["x"]) if len(vibration_data["x"]) > 1 else 1
            std_y = np.std(vibration_data["y"]) if len(vibration_data["y"]) > 1 else 1
            std_z = np.std(vibration_data["z"]) if len(vibration_data["z"]) > 1 else 1
            
            stats = {
                "mean": {"x": mean_x, "y": mean_y, "z": mean_z},
                "std_dev": {"x": std_x, "y": std_y, "z": std_z}
            }
        else:
            stats = {
                "mean": {"x": 0, "y": 0, "z": 0},
                "std_dev": {"x": 1, "y": 1, "z": 1}
            }
        
        # Recuperar alertas recientes
        alerts_count = {
            "level1": sim_status.get("alerts_level1", 0),
            "level2": sim_status.get("alerts_level2", 0),
            "level3": sim_status.get("alerts_level3", 0),
            "total": sim_status.get("alerts_total", 0)
        }
        
        # Obtener límites estadísticos predefinidos
        limits = get_statistical_limits()
        
        # Construir respuesta
        response = {
            "vibration_data": vibration_data,
            "recent_data": recent_data,
            "alerts_count": alerts_count,
            "recent_alerts": sim_status.get("recent_alerts", []),
            "stats": stats,
            "statistical_limits": limits,
            "simulation_status": {
                "running": sim_status.get("running", False),
                "progress": sim_status.get("progress", 0),
                "current_record": sim_status.get("processed_records", 0),
                "total_records": sim_status.get("total_records", 0)
            }
        }
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# --- Endpoints para límites estadísticos ---

@app.get("/api/statistical-limits")
async def api_get_statistical_limits():
    """Obtiene los límites estadísticos para las gráficas"""
    return get_statistical_limits()

@app.put("/api/statistical-limits/{axis}/{sigma_level}/{limit_type}")
async def api_update_statistical_limit(
    axis: str,
    sigma_level: str,
    limit_type: str,
    value: float
):
    """Actualiza un límite estadístico específico"""
    result = update_statistical_limits(axis, sigma_level, limit_type, value)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# Función auxiliar para operaciones CRUD
def get_crud():
    """
    Retorna el módulo CRUD apropiado según si estamos usando base de datos o memoria.
    """
    if is_using_database():
        return crud
    else:
        return memory_crud