# app/main.py
import os
import pickle
import joblib
from datetime import datetime, timedelta
import numpy as np
import logging
from typing import Dict, Any, Union, Optional

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
from app.database import get_db, SessionLocal
from app.models import VibrationData, Model, Sensor, Machine, LimitConfig, SystemConfig
from app.crud import (
    create_vibration_data, get_vibration_data, get_sensors,
    create_alert, update_sensor_last_status
)
from app.crud_config import (
    get_system_config, update_system_config,
    get_latest_limit_config, create_or_update_limit_config,
    get_full_config, update_full_config,
    get_all_models, get_model_by_id, create_new_model, update_existing_model, delete_model,
    get_all_sensors, get_sensor_by_id, create_new_sensor, update_existing_sensor, delete_sensor,
    get_all_machines, get_machine_by_id, create_new_machine, update_existing_machine, delete_machine,
    get_all_limits, get_limit_by_id, delete_limit
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

# Importar el módulo de configuración
from app.config import router as config_router

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
        # Crear una sesión de base de datos
        db = SessionLocal()
        
        try:
            # Obtener la configuración del sistema usando crud_config
            system_config = get_system_config(db)
            
            # Si no hay modelo activo, usar rutas predeterminadas
            if not system_config.active_model_id:
                model_path = os.path.join(MODELO_DIR, "anomaly_detection_model.h5")
                scaler_path = os.path.join(SCALER_DIR, "scaler.pkl")
                logger.info(f"No hay modelo activo configurado, usando rutas predeterminadas")
            else:
                # Obtener el modelo activo desde la base de datos
                db_model = get_model_by_id(db, system_config.active_model_id)
                
                if not db_model or not db_model.route_h5 or not db_model.route_pkl:
                    # Si no hay rutas configuradas, usar rutas predeterminadas
                    model_path = os.path.join(MODELO_DIR, "anomaly_detection_model.h5")
                    scaler_path = os.path.join(SCALER_DIR, "scaler.pkl")
                    logger.warning(f"No hay rutas configuradas en el modelo, usando rutas predeterminadas")
                else:
                    # Usar rutas configuradas en la base de datos
                    model_path = db_model.route_h5
                    scaler_path = db_model.route_pkl
                    logger.info(f"Usando rutas configuradas en la base de datos: Modelo={model_path}, Escalador={scaler_path}")
        finally:
            db.close()
        
        # Verificar si las rutas son absolutas, si no, convertirlas
        if not os.path.isabs(model_path):
            model_path = os.path.join(BASE_DIR, model_path)
        if not os.path.isabs(scaler_path):
            scaler_path = os.path.join(BASE_DIR, scaler_path)
        
        # Cargar el modelo desde el archivo .h5
        logger.info(f"Cargando modelo desde: {model_path}")
        
        # Verificar si el archivo existe
        if not os.path.exists(model_path):
            logger.error(f"El archivo del modelo no existe: {model_path}")
            return False
            
        model = load_model(model_path)
        logger.info(f"Modelo cargado correctamente: {type(model)}")
        
        # Cargar el escalador
        logger.info(f"Cargando escalador desde: {scaler_path}")
        
        # Verificar si el archivo existe
        if not os.path.exists(scaler_path):
            logger.error(f"El archivo del escalador no existe: {scaler_path}")
            return False
            
        # Intentar primero con joblib
        try:
            # Primero intentamos con joblib que es más robusto
            scaler = joblib.load(scaler_path)
            logger.info(f"Escalador cargado correctamente con joblib: {type(scaler)}")
        except Exception as joblib_err:
            logger.warning(f"Error al cargar con joblib: {str(joblib_err)}. Intentando con pickle.")
            try:
                # Como respaldo, intentar con pickle en modo binario
                with open(scaler_path, 'rb') as f:
                    scaler = pickle.load(f)
                logger.info(f"Escalador cargado correctamente con pickle: {type(scaler)}")
            except Exception as pickle_err:
                logger.error(f"Error al cargar el escalador con pickle: {str(pickle_err)}")
                return False
        
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
            
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

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
        
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

class LimitConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de límites.
    """
    x_2inf: float = Field(None, description="Límite inferior nivel 2 para el eje X")
    x_2sup: float = Field(None, description="Límite superior nivel 2 para el eje X")
    x_3inf: float = Field(None, description="Límite inferior nivel 3 para el eje X")
    x_3sup: float = Field(None, description="Límite superior nivel 3 para el eje X")
    y_2inf: float = Field(None, description="Límite inferior nivel 2 para el eje Y")
    y_2sup: float = Field(None, description="Límite superior nivel 2 para el eje Y")
    y_3inf: float = Field(None, description="Límite inferior nivel 3 para el eje Y")
    y_3sup: float = Field(None, description="Límite superior nivel 3 para el eje Y")
    z_2inf: float = Field(None, description="Límite inferior nivel 2 para el eje Z")
    z_2sup: float = Field(None, description="Límite superior nivel 2 para el eje Z")
    z_3inf: float = Field(None, description="Límite inferior nivel 3 para el eje Z")
    z_3sup: float = Field(None, description="Límite superior nivel 3 para el eje Z")
    
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

class ModelConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de modelo.
    """
    model_id: int = Field(None, description="ID del modelo")
    route_h5: str = Field(None, description="Ruta al archivo del modelo (.h5)")
    route_pkl: str = Field(None, description="Ruta al archivo del escalador (.pkl)")
    name: str = Field(None, description="Nombre del modelo")
    description: str = Field(None, description="Descripción del modelo")
    
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace model_

class SensorConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de sensores.
    """
    sensor_id: int = Field(None, description="ID del sensor")
    name: str = Field(None, description="Nombre del sensor")
    description: str = Field(None, description="Descripción del sensor")
    model_id: int = Field(None, description="ID del modelo asignado al sensor")
    
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

class MachineConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de máquinas.
    """
    machine_id: int = Field(None, description="ID de la máquina")
    name: str = Field(None, description="Nombre de la máquina")
    description: str = Field(None, description="Descripción de la máquina")
    sensor_id: int = Field(None, description="ID del sensor asignado a la máquina")
    
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

class ConfigurationData(BaseModel):
    """
    Esquema para validar datos de configuración completa del sistema.
    """
    model: ModelConfigData = Field(None, description="Configuración del modelo")
    limit_config: LimitConfigData = Field(None, description="Configuración de límites")
    sensors: list[SensorConfigData] = Field(None, description="Configuración de sensores")
    machines: list[MachineConfigData] = Field(None, description="Configuración de máquinas")
    is_configured: bool = Field(False, description="Indica si el sistema ha sido configurado")
    
    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

# ---------------------------------------------------------
# CONFIGURACIÓN DE LA APLICACIÓN FASTAPI
# ---------------------------------------------------------

app = FastAPI(
    title="PdM-Manager API",
    description="API para gestión de mantenimiento predictivo",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, restringe a dominios específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")

# Incluir el router de configuración
app.include_router(config_router)

# Configurar templates para renderizar HTML
templates = Jinja2Templates(directory=STATIC_DIR)

# ---------------------------------------------------------
# EVENTOS DE INICIO Y CIERRE
# ---------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    """
    Evento que se ejecuta al iniciar la aplicación.
    Inicializa los modelos de ML y realiza otras configuraciones necesarias.
    """
    try:
        # Intentar cargar los modelos de ML
        if not load_ml_models():
            logger.warning("No se pudieron cargar los modelos de ML. La clasificación de anomalías no estará disponible.")
    except Exception as e:
        logger.error(f"Error durante la inicialización: {str(e)}")

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
        "environment": "production",
        "system_configured": False
    }
    
    # Verificar conexión a la base de datos
    try:
        # Intentar una consulta simple a la base de datos
        db.execute("SELECT 1").fetchall()
        
        # Verificar estado de configuración del sistema
        system_config = get_system_config(db)
        health_status["system_configured"] = system_config.is_configured == 1
        
        # Si el sistema no está configurado, actualizar el estado
        if not health_status["system_configured"]:
            health_status["status"] = "warning"
            health_status["warning_details"] = "El sistema no ha sido configurado completamente"
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
            health_status["status"] = health_status.get("status") == "error" and "error" or "ok"
            health_status["models"] = "loaded"
            health_status.pop("error_details", None)
    
    # Si hay error, devolver un código 500
    if health_status["status"] == "error":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=health_status
        )
    
    # Si hay warning, devolver un código 200 pero con el warning
    if health_status["status"] == "warning":
        return JSONResponse(
            status_code=status.HTTP_200_OK,
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
    
    # Verificar que el sistema esté configurado
    system_config = get_system_config(db)
    if not system_config.is_configured:
        logger.warning("Sistema no configurado. Se rechazó la solicitud.")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": "error",
                "message": "Configuración incompleta. Por favor, configure el sistema antes de iniciar el monitoreo."
            }
        )
    
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
        
        # Obtener la configuración del sistema
        system_config = get_system_config(db)
        
        # Si el sistema no tiene modelo activo configurado, retornar error
        if not system_config.active_model_id:
            logger.error("No hay modelo activo configurado")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": "No hay modelo activo configurado"
                }
            )
        
        try:
            # Obtener el modelo activo desde la base de datos
            db_model = get_model_by_id(db, system_config.active_model_id)
            
            if not db_model or not db_model.route_h5 or not db_model.route_pkl:
                logger.error("Modelo activo sin rutas configuradas")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "status": "error",
                        "message": "Modelo activo sin rutas configuradas"
                    }
                )
            
            # Usar rutas configuradas en la base de datos
            model_path = db_model.route_h5
            scaler_path = db_model.route_pkl
            
            # Verificar si las rutas son absolutas, si no, convertirlas
            if not os.path.isabs(model_path):
                model_path = os.path.join(BASE_DIR, model_path)
            if not os.path.isabs(scaler_path):
                scaler_path = os.path.join(BASE_DIR, scaler_path)
            
            # Cargar el modelo desde el archivo .h5 utilizando tensorflow
            model_local = load_model(model_path)
            
            # Cargar el escalador desde el archivo pickle usando modo binario
            scaler_local = None
            
            # Verificar si el archivo existe
            if not os.path.exists(scaler_path):
                logger.error(f"El archivo del escalador no existe: {scaler_path}")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "status": "error",
                        "message": f"El archivo del escalador no existe: {scaler_path}"
                    }
                )
                
            # Intentar primero con joblib
            try:
                # Primero intentamos con joblib que es más robusto
                scaler_local = joblib.load(scaler_path)
                logger.info(f"Escalador cargado correctamente con joblib: {type(scaler_local)}")
            except Exception as joblib_err:
                logger.warning(f"Error al cargar con joblib: {str(joblib_err)}. Intentando con pickle.")
                try:
                    # Como respaldo, intentar con pickle en modo binario
                    with open(scaler_path, 'rb') as f:
                        scaler_local = pickle.load(f)
                    logger.info(f"Escalador cargado correctamente con pickle: {type(scaler_local)}")
                except Exception as pickle_err:
                    error_msg = f"Error al cargar el escalador: {str(pickle_err)}"
                    logger.error(error_msg)
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content={
                            "status": "error",
                            "message": error_msg
                        }
                    )
            
            # Crear vector de características
            features = np.array([
                data.acceleration_x,
                data.acceleration_y,
                data.acceleration_z
            ]).reshape(1, -1)
            
            # Normalizar datos mediante el escalador cargado
            normalized_features = scaler_local.transform(features)
            
            # Predecir anomalía usando el modelo cargado
            prediction = model_local.predict(normalized_features)
            
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
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": f"Error al procesar datos con el modelo: {str(e)}"
                }
            )
        
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
            # (Las alertas de nivel 3 se generarán por el trigger en la base de datos)
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
                "status": "ok",
                "severity": severidad
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
        # Para datos simplificados, se rechaza la solicitud ya que el endpoint requiere datos completos
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": "error",
                "message": "Este endpoint requiere datos completos del sensor (acceleration_x, acceleration_y, acceleration_z)"
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
    sensor_id: Optional[int] = Query(None, description="ID del sensor específico"),
    model_id: Optional[int] = Query(None, description="Filtrar por modelo"),
    skip: int = Query(0, ge=0, description="Número de registros a saltar (paginación)"),
    limit: int = Query(100, ge=1, le=100, description="Número máximo de registros a devolver"),
    db: Session = Depends(get_db)
):
    """
    Obtiene la lista de sensores disponibles.
    
    Permite filtrar por:
    - sensor_id: Un sensor específico
    - model_id: Todos los sensores asociados a un modelo específico
    
    También soporta paginación con skip y limit.
    """
    try:
        sensors = []
        
        # Si se proporciona un sensor_id específico, buscar por ID
        if sensor_id:
            sensor = get_sensor_by_id(db, sensor_id)
            sensors = [sensor] if sensor else []
        else:
            # Obtener todos los sensores
            sensors = get_all_sensors(db)
            
            # Aplicar filtro por modelo si se especifica
            if model_id is not None:
                sensors = [s for s in sensors if s.model_id == model_id]
        
        # Si no hay sensores, devolver una lista vacía
        if not sensors:
            return []
            
        # Aplicar paginación manual
        start_idx = min(skip, len(sensors))
        end_idx = min(skip + limit, len(sensors))
        paginated_sensors = sensors[start_idx:end_idx]
        
        # Serializar los sensores a formato JSON
        result = []
        for sensor in paginated_sensors:
            result.append({
                "sensor_id": sensor.sensor_id,
                "name": sensor.name if sensor.name else "",
                "description": sensor.description if sensor.description else "",
                "model_id": sensor.model_id,
                "last_reading_time": sensor.last_reading_time.isoformat() if sensor.last_reading_time else None,
                "last_status": sensor.last_status if hasattr(sensor, 'last_status') else None,
                "last_severity": sensor.last_severity if hasattr(sensor, 'last_severity') else None
            })
            
        return result
            
    except Exception as e:
        error_msg = f"Error al obtener sensores: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": error_msg}
        )

@app.get("/configuration")
async def get_configuration_endpoint(db: Session = Depends(get_db)):
    """
    Obtiene la configuración actual del sistema, incluyendo:
    - Rutas de archivos del modelo y escalador
    - Límites de vibración
    - Configuración de sensores y máquinas
    - Estado de configuración del sistema
    
    Retorna:
    - Un objeto JSON con toda la configuración
    - 500 si ocurre un error al obtener la configuración
    """
    try:
        configuration = get_system_config(db)
        return configuration
    except Exception as e:
        error_msg = f"Error al obtener la configuración: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": error_msg}
        )

@app.put("/configuration")
async def update_configuration_endpoint(
    config_data: ConfigurationData = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza la configuración del sistema.
    
    El cuerpo de la solicitud debe contener un objeto JSON con:
    - model: Configuración del modelo (rutas de archivos)
    - limit_config: Configuración de límites de vibración
    - sensors: Lista de sensores a configurar
    - machines: Lista de máquinas a configurar
    
    Retorna:
    - La configuración actualizada
    - 500 si ocurre un error al actualizar la configuración
    """
    try:
        # Convertir el modelo Pydantic a diccionario
        config_dict = config_data.dict(exclude_unset=True)
        
        # Actualizar la configuración
        updated_config = update_system_config(db, config_dict)
        
        # Recargar el modelo ML si se actualizaron las rutas
        if "model" in config_dict and config_dict["model"]:
            model_data = config_dict["model"]
            if "route_h5" in model_data or "route_pkl" in model_data:
                load_ml_models()
        
        return updated_config
    except Exception as e:
        error_msg = f"Error al actualizar la configuración: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": error_msg}
        )

# ---------------------------------------------------------
# ENDPOINTS PARA CONFIGURACIÓN (/config)
# ---------------------------------------------------------

@app.get("/config")
async def get_config_endpoint(db: Session = Depends(get_db)):
    """
    Obtiene la configuración global del sistema, incluyendo:
    - Estado de configuración del sistema (is_configured)
    - ID del modelo activo (active_model_id)
    - Fecha de última actualización (last_update)
    - Límites de vibración (x_2inf, x_2sup, etc.)
    - Rutas del modelo y escalador (opcional)
    
    Utiliza la función get_full_config() del módulo crud_config.py para obtener toda
    la información de configuración de las tablas system_config, limit_config y model.
    
    Retorna:
    - Un objeto JSON con la configuración
    - 500 si ocurre un error al obtener la configuración
    """
    try:
        # Obtener configuración usando la función de crud_config.py
        config_response = get_full_config(db)
        return config_response
    except Exception as e:
        error_msg = f"Error al obtener la configuración: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": error_msg}
        )

class ConfigUpdateData(BaseModel):
    """
    Esquema para validar datos de actualización de configuración.
    """
    route_h5: str = Field(None, description="Ruta al archivo del modelo (.h5)")
    route_pkl: str = Field(None, description="Ruta al archivo del escalador (.pkl)")
    model_name: str = Field(None, description="Nombre del modelo")
    model_description: str = Field(None, description="Descripción del modelo")
    
    # Límites de vibración
    x_2inf: float = Field(None, description="Límite inferior nivel 2 para el eje X")
    x_2sup: float = Field(None, description="Límite superior nivel 2 para el eje X")
    x_3inf: float = Field(None, description="Límite inferior nivel 3 para el eje X")
    x_3sup: float = Field(None, description="Límite superior nivel 3 para el eje X")
    y_2inf: float = Field(None, description="Límite inferior nivel 2 para el eje Y")
    y_2sup: float = Field(None, description="Límite superior nivel 2 para el eje Y")
    y_3inf: float = Field(None, description="Límite inferior nivel 3 para el eje Y")
    y_3sup: float = Field(None, description="Límite superior nivel 3 para el eje Y")
    z_2inf: float = Field(None, description="Límite inferior nivel 2 para el eje Z")
    z_2sup: float = Field(None, description="Límite superior nivel 2 para el eje Z")
    z_3inf: float = Field(None, description="Límite inferior nivel 3 para el eje Z")
    z_3sup: float = Field(None, description="Límite superior nivel 3 para el eje Z")
    
    # Información del sensor y máquina (opcional para actualizar en orden)
    sensor_info: dict = Field(None, description="Información para actualizar o crear un sensor")
    machine_info: dict = Field(None, description="Información para actualizar o crear una máquina")
    
    @validator('x_2sup')
    def validate_x_2sup(cls, v, values):
        if 'x_2inf' in values and v is not None and values['x_2inf'] is not None:
            # Verificar si son los valores por defecto (-2.36, 2.18)
            if abs(values['x_2inf'] - (-2.36)) < 0.001 and abs(v - 2.18) < 0.001:
                return v
            if v <= values['x_2inf']:
                raise ValueError('x_2sup debe ser mayor que x_2inf')
        return v
    
    @validator('x_3sup')
    def validate_x_3sup(cls, v, values):
        if 'x_3inf' in values and v is not None and values['x_3inf'] is not None:
            # Verificar si son los valores por defecto (-3.5, 3.32)
            if abs(values['x_3inf'] - (-3.5)) < 0.001 and abs(v - 3.32) < 0.001:
                return v
            if v <= values['x_3inf']:
                raise ValueError('x_3sup debe ser mayor que x_3inf')
        return v
    
    @validator('y_2sup')
    def validate_y_2sup(cls, v, values):
        if 'y_2inf' in values and v is not None and values['y_2inf'] is not None:
            if v <= values['y_2inf']:
                raise ValueError('y_2sup debe ser mayor que y_2inf')
        return v
    
    @validator('y_3sup')
    def validate_y_3sup(cls, v, values):
        if 'y_3inf' in values and v is not None and values['y_3inf'] is not None:
            if v <= values['y_3inf']:
                raise ValueError('y_3sup debe ser mayor que y_3inf')
        return v
    
    @validator('z_2sup')
    def validate_z_2sup(cls, v, values):
        if 'z_2inf' in values and v is not None and values['z_2inf'] is not None:
            if v <= values['z_2inf']:
                raise ValueError('z_2sup debe ser mayor que z_2inf')
        return v
    
    @validator('z_3sup')
    def validate_z_3sup(cls, v, values):
        if 'z_3inf' in values and v is not None and values['z_3inf'] is not None:
            if v <= values['z_3inf']:
                raise ValueError('z_3sup debe ser mayor que z_3inf')
        return v

    class Config:
        protected_namespaces = ()  # Eliminar advertencias de namespace

@app.put("/config")
async def update_config_endpoint(
    config_data: ConfigUpdateData = Body(...),
    db: Session = Depends(get_db)
):
    """
    Actualiza la configuración global del sistema en el siguiente orden:
    1. Actualiza o crea un modelo con las rutas proporcionadas
    2. Actualiza los límites de vibración
    3. Actualiza o crea un sensor (opcional)
    4. Actualiza o crea una máquina (opcional)
    
    Utiliza la función update_full_config() del módulo crud_config.py para manejar toda
    la lógica de actualización, incluyendo transacciones y validación de datos.
    
    Valida que los límites sean coherentes (inferiores < superiores)
    
    Retorna:
    - La configuración actualizada
    - 400 si hay un error de validación
    - 500 si hay un error interno
    """
    try:
        # Convertir el modelo Pydantic a diccionario
        config_dict = config_data.dict(exclude_unset=True)
        
        # Actualizar la configuración utilizando la función de crud_config.py
        updated_config = update_full_config(db, config_dict)
        
        # Recargar modelos si se actualizaron las rutas
        if "route_h5" in config_dict or "route_pkl" in config_dict:
            load_ml_models()
        
        return updated_config
    except ValueError as ve:
        error_msg = f"Error de validación: {str(ve)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": error_msg}
        )
    except Exception as e:
        error_msg = f"Error al actualizar la configuración: {str(e)}"
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