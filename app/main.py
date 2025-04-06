# app/main.py
import os
import pickle
import joblib
from datetime import datetime, timedelta
import numpy as np
import logging
from typing import Dict, Any, Union

# FastAPI
from fastapi import FastAPI, HTTPException, Depends, status, Request, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, validator

# TensorFlow
import tensorflow as tf
from tensorflow.keras.models import load_model

# SQLAlchemy
from app.database import get_db
from app.models import VibrationData
from app.crud import (
    create_vibration_data, get_vibration_data, get_sensors,
    create_alert, update_sensor_last_status
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

# ---------------------------------------------------------
# CONFIGURACIÓN DE RUTAS Y VARIABLES GLOBALES
# ---------------------------------------------------------

# Rutas para modelos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Variables globales para modelo y escalador
# IMPORTANTE: Estas variables se inicializan en None y se cargan mediante la función load_ml_models
model = None
scaler = None

# ---------------------------------------------------------
# CONFIGURACIÓN DE LOGGING
# ---------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("pdm_manager")

# ---------------------------------------------------------
# FUNCIONES AUXILIARES
# ---------------------------------------------------------

def load_ml_models():
    """
    Carga el modelo y el escalador utilizados para la detección de anomalías.
    
    Esta función intenta cargar:
    1. El modelo de red neuronal (.h5) para clasificación
    2. El escalador (.pkl o .joblib) para normalización de datos
    
    Retorna True si la carga fue exitosa, False en caso contrario.
    
    IMPORTANTE: Si esta función falla, el endpoint de health mostrará un error
    y la clasificación de severidad no será posible.
    """
    global model, scaler
    
    try:
        # Obtener las rutas de los archivos desde variables de entorno o usar valores predeterminados
        model_path = os.path.join(MODELO_DIR, "anomaly_detection_model.h5")
        scaler_path = os.path.join(SCALER_DIR, "scaler.pkl")
        
        # Cargar el modelo desde el archivo .h5
        logger.info(f"Cargando modelo desde: {model_path}")
        model = load_model(model_path)
        logger.info(f"Modelo cargado correctamente: {type(model)}")
        
        # Cargar el escalador desde el archivo pickle
        logger.info(f"Cargando escalador desde: {scaler_path}")
        
        # Intentar cargar con joblib primero (más robusto)
        try:
            scaler_joblib_path = scaler_path.replace('.pkl', '.joblib') if scaler_path.endswith('.pkl') else scaler_path
            scaler = joblib.load(scaler_joblib_path)
        except Exception as e:
            logger.warning(f"No se pudo cargar el escalador con joblib: {str(e)}. Intentando con pickle.")
            with open(scaler_path, 'rb') as f:
                scaler = pickle.load(f)
                
        logger.info(f"Escalador cargado correctamente: {type(scaler)}")
        
        return True
    except Exception as e:
        logger.error(f"Error al cargar los modelos de ML: {str(e)}")
        return False

# ---------------------------------------------------------
# ESQUEMAS DE VALIDACIÓN DE DATOS
# ---------------------------------------------------------

class SensorData(BaseModel):
    """
    Esquema para validar datos de sensores en formato completo.
    
    Este formato es el estándar para sensores triaxiales que envían
    aceleraciones en los tres ejes.
    """
    sensor_id: int = Field(..., gt=0, description="ID del sensor (debe ser mayor que 0)")
    acceleration_x: float = Field(..., description="Aceleración en eje X")
    acceleration_y: float = Field(..., description="Aceleración en eje Y")
    acceleration_z: float = Field(..., description="Aceleración en eje Z")
    timestamp: str = Field(..., description="Timestamp en formato ISO8601")
    
    @validator('timestamp')
    def validate_timestamp(cls, v):
        """Valida que el timestamp esté en formato ISO8601 correcto"""
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError('timestamp debe estar en formato ISO8601')

class SimpleSensorData(BaseModel):
    """
    Esquema para validar datos de sensores en formato simplificado.
    
    Este formato es útil para sensores que solo reportan
    un valor para un eje específico.
    """
    sensor_id: int = Field(..., gt=0, description="ID del sensor (debe ser mayor que 0)")
    value: float = Field(..., description="Valor de la medición")
    axis: str = Field(..., description="Eje de la medición (X, Y, Z)")
    timestamp: str = Field(..., description="Timestamp en formato ISO8601")
    
    @validator('timestamp')
    def validate_timestamp(cls, v):
        """Valida que el timestamp esté en formato ISO8601 correcto"""
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError('timestamp debe estar en formato ISO8601')
    
    @validator('axis')
    def validate_axis(cls, v):
        """Valida que el eje sea X, Y o Z"""
        if v not in ['X', 'Y', 'Z']:
            raise ValueError('axis debe ser X, Y o Z')
        return v

# ---------------------------------------------------------
# CONFIGURACIÓN DE LA APLICACIÓN FASTAPI
# ---------------------------------------------------------

# Crear la aplicación FastAPI
app = FastAPI(
    title="PdM Manager API",
    description="API para gestión de mantenimiento predictivo",
    version="1.0.0"
)

# Configurar CORS para permitir peticiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar archivos estáticos para servir el frontend
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    logger.info(f"Archivos estáticos montados desde: {STATIC_DIR}")
else:
    logger.warning(f"Directorio de archivos estáticos no encontrado en: {STATIC_DIR}")

# Configurar templates para renderizar HTML
templates = Jinja2Templates(directory=STATIC_DIR)

# ---------------------------------------------------------
# DEFINICIÓN DE ENDPOINTS
# ---------------------------------------------------------

@app.get("/")
async def root(request: Request):
    """
    Renderiza la página principal con el dashboard.
    """
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Endpoint para verificar el estado de salud de la aplicación.
    Comprueba la conectividad con la base de datos y la disponibilidad de los modelos.
    """
    health_status = {
        "status": "ok",
        "database": "connected",
        "models": "loaded" if model is not None and scaler is not None else "not_loaded",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "environment": "production"
    }
    
    # Verificar conexión a la base de datos
    try:
        # Intentar una consulta simple a la base de datos
        db.execute("SELECT 1").fetchall()
    except SQLAlchemyError as e:
        health_status["status"] = "error"
        health_status["database"] = "error"
        health_status["error_details"] = str(e)
    
    # Verificar que los modelos estén cargados
    if model is None or scaler is None:
        health_status["status"] = "error"
        health_status["models"] = "not_loaded"
        health_status["error_details"] = "Los modelos no están cargados correctamente"
        
        # Intentar cargar los modelos
        if load_ml_models():
            health_status["status"] = "ok"
            health_status["models"] = "loaded"
            health_status.pop("error_details", None)
    
    # Si hay error, devolver un código 500
    if health_status["status"] == "error":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=health_status
        )
    
    return health_status

# ---------------------------------------------------------
# ENDPOINT PRINCIPAL PARA DATOS DE SENSORES
# ---------------------------------------------------------

@app.post("/sensor-data", status_code=status.HTTP_201_CREATED)
async def receive_sensor_data(
    data: Union[SensorData, SimpleSensorData] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Endpoint para recibir datos de sensores.
    
    Acepta tanto el formato completo (SensorData) como el simplificado (SimpleSensorData).
    Procesa los datos, calcula la severidad si es posible, y almacena en la base de datos.
    """
    logger.info(f"Datos recibidos del sensor {data.sensor_id}")
    
    # Validar que el sensor existe en la base de datos
    sensor = get_sensors(db=db, sensor_id=data.sensor_id)
    if not sensor:
        logger.warning(f"Sensor {data.sensor_id} no registrado en la base de datos")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "status": "error",
                "message": f"Sensor con ID {data.sensor_id} no encontrado"
            }
        )
    
    # Creación de datos según el tipo recibido
    if isinstance(data, SensorData):
        # Para datos completos, calculamos severidad si hay modelo disponible
        severidad = 0
        anomalia = False
        
        if model is not None and scaler is not None:
            try:
                # Crear vector de características
                features = np.array([
                    data.acceleration_x,
                    data.acceleration_y,
                    data.acceleration_z
                ]).reshape(1, -1)
                
                # Normalizar datos
                normalized_features = scaler.transform(features)
                
                # Predecir anomalía
                prediction = model.predict(normalized_features)
                
                # Clasificar severidad (0: normal, 1: leve, 2: grave)
                pred_value = float(prediction[0][0])
                anomalia = pred_value > 0.5
                
                # Asignar niveles de severidad (0, 1, 2)
                if pred_value < 0.5:
                    severidad = 0  # Normal
                elif pred_value < 0.8:
                    severidad = 1  # Leve
                else:
                    severidad = 2  # Grave
                
                logger.info(f"Predicción para sensor {data.sensor_id}: " 
                            f"anomalía={anomalia}, severidad={severidad}")
                
            except Exception as e:
                logger.error(f"Error al procesar datos con ML: {str(e)}")
        
        # Guardar los datos en la base de datos incluyendo predicción de severidad
        try:
            db_data = create_vibration_data(
                db=db,
                sensor_id=data.sensor_id,
                acceleration_x=data.acceleration_x,
                acceleration_y=data.acceleration_y,
                acceleration_z=data.acceleration_z,
                date=datetime.fromisoformat(data.timestamp.replace('Z', '+00:00')),
                severity=severidad,
                is_anomaly=1 if anomalia else 0
            )
            
            # Crear alerta si la severidad es alta (2)
            if severidad >= 2:
                create_alert(
                    db=db,
                    sensor_id=data.sensor_id,
                    error_type=severidad,
                    data_id=db_data.data_id,
                    timestamp=datetime.fromisoformat(data.timestamp.replace('Z', '+00:00'))
                )
                logger.warning(f"Alerta creada para sensor {data.sensor_id} con severidad {severidad}")
            
            # Actualizar el último estado del sensor
            update_sensor_last_status(
                db=db,
                sensor_id=data.sensor_id,
                is_anomaly=anomalia,
                severity=severidad,
                timestamp=datetime.fromisoformat(data.timestamp.replace('Z', '+00:00'))
            )
            
            return {
                "status": "success",
                "id": db_data.data_id,
                "message": "Datos recibidos y almacenados correctamente",
                "severity": severidad,
                "anomaly": anomalia
            }
        except Exception as e:
            logger.error(f"Error al guardar datos en la base de datos: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": f"Error al guardar datos: {str(e)}"
                }
            )
        
    else:  # SimpleSensorData
        # Para datos simplificados, registramos pero no calculamos severidad
        # Estas entradas se utilizan para visualización de tendencias
        timestamp = datetime.fromisoformat(data.timestamp.replace('Z', '+00:00'))
        
        # Dependiendo del eje, guardamos el valor en la columna correspondiente
        acc_x = data.value if data.axis == 'X' else None
        acc_y = data.value if data.axis == 'Y' else None
        acc_z = data.value if data.axis == 'Z' else None
        
        try:
            db_data = create_vibration_data(
                db=db,
                sensor_id=data.sensor_id,
                acceleration_x=acc_x,
                acceleration_y=acc_y,
                acceleration_z=acc_z,
                date=timestamp,
                severity=0,
                is_anomaly=0
            )
            
            return {
                "status": "success",
                "id": db_data.data_id,
                "message": "Datos simplificados recibidos y almacenados correctamente"
            }
        except Exception as e:
            logger.error(f"Error al guardar datos simplificados: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": f"Error al guardar datos: {str(e)}"
                }
            )

# ---------------------------------------------------------
# ENDPOINT PARA OBTENER DATOS DE VIBRACIÓN
# ---------------------------------------------------------

@app.get("/vibration-data")
async def get_vibration_data_endpoint(
    sensor_id: int = Query(..., description="ID del sensor"),
    limit: int = Query(100, description="Número máximo de registros a devolver"),
    start_date: str = Query(None, description="Fecha de inicio (ISO format)"),
    end_date: str = Query(None, description="Fecha de fin (ISO format)"),
    db: Session = Depends(get_db)
):
    """
    Endpoint para obtener datos históricos de vibración.
    """
    logger.info(f"Solicitando datos de vibración para sensor {sensor_id}")
    
    # Convertir fechas si fueron proporcionadas
    start_datetime = None
    end_datetime = None
    
    if start_date:
        try:
            start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Formato de fecha de inicio inválido"}
            )
    
    if end_date:
        try:
            end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Formato de fecha de fin inválido"}
            )
    
    # Obtener datos de vibración de la base de datos
    vibration_data = get_vibration_data(
        db, 
        sensor_id=sensor_id, 
        limit=limit,
        start_date=start_datetime,
        end_date=end_datetime
    )
    
    # Convertir a formato de respuesta
    result = []
    for data in vibration_data:
        result.append({
            "id": data.id,
            "sensor_id": data.sensor_id,
            "acceleration_x": data.acc_x,
            "acceleration_y": data.acc_y,
            "acceleration_z": data.acc_z,
            "timestamp": data.timestamp.isoformat(),
            "is_anomaly": data.is_anomaly,
            "severity": data.severity
        })
    
    return {"data": result}

# ---------------------------------------------------------
# ENDPOINT PARA OBTENER INFORMACIÓN DE SENSORES
# ---------------------------------------------------------

@app.get("/sensors")
async def get_sensors_endpoint(
    sensor_id: int = None,
    model_id: int = None,
    limit: int = 100,
    skip: int = 0,
    db=Depends(get_db)
):
    """
    Obtiene sensores con opciones de filtrado.
    
    Parámetros opcionales:
    - sensor_id: Filtrar por ID específico
    - model_id: Filtrar por modelo específico
    - limit: Número máximo de sensores a devolver
    - skip: Número de sensores a omitir (para paginación)
    
    Retorna:
    - Lista de sensores si no se especifica sensor_id
    - Un único sensor si se especifica sensor_id
    - 404 si no se encuentra ningún sensor
    """
    try:
        sensors = get_sensors(
            db=db,
            sensor_id=sensor_id,
            model_id=model_id,
            limit=limit,
            skip=skip
        )
        return sensors
    except Exception as e:
        error_msg = f"Error al obtener sensores: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": error_msg}
        )

# ---------------------------------------------------------
# PUNTO DE ENTRADA PRINCIPAL
# ---------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    print("Iniciando aplicación PdM Manager...")
    load_ml_models()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)