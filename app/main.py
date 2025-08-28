# app/main.py
import os
from pathlib import Path
import pickle
import joblib
from datetime import datetime, timedelta
import numpy as np
import logging
from typing import Dict, Any, Union, Optional, List
import shutil

# FastAPI
from fastapi import FastAPI, HTTPException, Depends, status, Request, Query, Body, UploadFile, Form, File, Cookie, Response as FastAPIResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator, root_validator, ConfigDict

# TensorFlow
import tensorflow as tf
from tensorflow.keras.models import load_model

# SQLAlchemy
from app.database import get_db, SessionLocal
from app.models import VibrationData, Model, Sensor, Machine, LimitConfig, SystemConfig, User # Añadido User
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
    get_all_limits, get_limit_by_id, delete_limit,
    ensure_default_limits_exist
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

# Importar el módulo de configuración
from app.config import router as config_router
from app.auth import get_current_user, create_access_token, authenticate_user,ACCESS_TOKEN_EXPIRE_MINUTES,verify_password, decode_token, get_password_hash # Asegurar que decode_token también se importe si es necesario aquí, o solo get_current_user

# ---------------------------------------------------------
# CONFIGURACIÓN DE RUTAS Y VARIABLES GLOBALES
# ---------------------------------------------------------

# Rutas para modelos (normalizadas a minúsculas para entornos Linux)
BASE_DIR = Path(__file__).resolve().parent.parent
MODELO_DIR = BASE_DIR / "modelo"
SCALER_DIR = BASE_DIR / "scaler"
STATIC_DIR = BASE_DIR / "static"

# Rutas por defecto para el modelo y el escalador (relativas al proyecto)
DEFAULT_MODEL_PATH = MODELO_DIR / "anomaly_detection_model.h5"
DEFAULT_SCALER_PATH = SCALER_DIR / "scaler.pkl"

# Variables globales para modelo y escalador
# IMPORTANTE: Estas variables se inicializan en None y se cargan mediante la función load_ml_models
model = None
scaler = None
active_model_loaded_id = None

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
    """
    global model, scaler, active_model_loaded_id
    
    try:
        # Definir rutas predeterminadas
        model_path = Path(DEFAULT_MODEL_PATH)
        scaler_path = Path(DEFAULT_SCALER_PATH)
        
        # Intentar obtener configuración de la base de datos si es posible
        try:
            db = SessionLocal()
            try:
                system_config = get_system_config(db)
                if system_config.active_model_id:
                    db_model = get_model_by_id(db, system_config.active_model_id)
                    if db_model and db_model.route_h5 and db_model.route_pkl:
                        mp = Path(db_model.route_h5)
                        sp = Path(db_model.route_pkl)
                        model_path = mp if mp.is_absolute() else BASE_DIR / mp
                        scaler_path = sp if sp.is_absolute() else BASE_DIR / sp
                        logger.info(f"Usando modelo configurado: {model_path}")
                        active_model_loaded_id = system_config.active_model_id
            finally:
                db.close()
        except Exception as db_err:
            logger.warning(f"No se pudo obtener configuración de la BD: {str(db_err)}. Usando valores predeterminados.")
        
        # Verificar si los archivos existen
        if not Path(model_path).exists():
            logger.info(f"El archivo del modelo no existe: {model_path}")
            # Volver a la ruta predeterminada si el archivo no existe
            model_path = Path(DEFAULT_MODEL_PATH)
            if not model_path.exists():
                logger.info(f"El archivo del modelo predeterminado no existe: {model_path}")
                return False
        
        if not Path(scaler_path).exists():
            logger.info(f"El archivo del escalador no existe: {scaler_path}")
            # Volver a la ruta predeterminada si el archivo no existe
            scaler_path = Path(DEFAULT_SCALER_PATH)
            if not scaler_path.exists():
                logger.info(f"El archivo del escalador predeterminado no existe: {scaler_path}")
                return False
        
        # Cargar modelo
        try:
            model = load_model(str(model_path), compile=False)
            logger.info(f"Modelo cargado correctamente: {type(model)}")
        except Exception as model_err:
            logger.warning(f"Error al cargar el modelo: {str(model_err)}")
            return False
        
        # Cargar escalador
        try:
            # Intentar primero con joblib
            scaler = joblib.load(str(scaler_path))
            logger.info(f"Escalador cargado correctamente con joblib: {type(scaler)}")
        except Exception as joblib_err:
            logger.warning(f"Error al cargar con joblib: {str(joblib_err)}. Intentando con pickle.")
            try:
                # Si falla joblib, intentar con pickle
                with open(scaler_path, 'rb') as f:
                    scaler = pickle.load(f)
                logger.info(f"Escalador cargado correctamente con pickle: {type(scaler)}")
            except Exception as pickle_err:
                logger.warning(f"Error al cargar el escalador: {str(pickle_err)}")
                return False
        
        return model is not None and scaler is not None
    except Exception as e:
        logger.warning(f"Error al cargar los modelos de ML: {str(e)}")
        return False

def ensure_models_loaded(db: Session) -> tuple[Any | None, Any | None]:
    """
    Garantiza que el modelo/escalador estén cargados y corresponden al modelo activo.
    Reutiliza los globales y solo recarga si cambió el active_model_id.
    """
    global model, scaler, active_model_loaded_id
    try:
        system_config = get_system_config(db)
        if model is not None and scaler is not None and active_model_loaded_id == system_config.active_model_id:
            return model, scaler
    except Exception:
        # Si falla obtener system_config, intentar una carga estándar
        pass
    # Forzar carga (respetará configuración en BD si existe)
    load_ml_models()
    return model, scaler

def ensure_default_model_exists():
    """
    Verifica si existe un modelo por defecto en la base de datos.
    Si no existe, crea un registro con los valores por defecto.
    
    Esta función debe ser llamada durante el inicio de la aplicación.
    """
    try:
        db = SessionLocal()
        try:
            # Verificar si existe algún modelo
            models = get_all_models(db)
            if not models:
                logger.info("Creando modelo por defecto")
                
                # Crear modelo con rutas relativas para portabilidad
                default_model = create_new_model(
                    db,
                    {
                        "name": "Modelo por defecto",
                        "description": "Modelo de detección de anomalías por defecto",
                        "route_h5": os.path.join("modelo", "anomaly_detection_model.h5").replace("\\", "/"),
                        "route_pkl": os.path.join("scaler", "scaler.pkl").replace("\\", "/"),
                    }
                )
                
                # Actualizar configuración del sistema para usar este modelo
                system_config = get_system_config(db)
                update_system_config(db, active_model_id=default_model.model_id)
                
                logger.info(f"Modelo por defecto creado con ID: {default_model.model_id}")
                
        except Exception as e:
            logger.warning(f"Error al verificar/crear modelo por defecto: {str(e)}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Error al conectar con la base de datos para verificar modelo por defecto: {str(e)}")

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
            
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace

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
        
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace

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
    
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace

class ModelConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de modelo.
    """
    model_id: int = Field(None, description="ID del modelo")
    route_h5: str = Field(None, description="Ruta al archivo del modelo (.h5)")
    route_pkl: str = Field(None, description="Ruta al archivo del escalador (.pkl)")
    name: str = Field(None, description="Nombre del modelo")
    description: str = Field(None, description="Descripción del modelo")
    
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace model_

class SensorConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de sensores.
    """
    sensor_id: int = Field(None, description="ID del sensor")
    name: str = Field(None, description="Nombre del sensor")
    description: str = Field(None, description="Descripción del sensor")
    model_id: int = Field(None, description="ID del modelo asignado al sensor")
    
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace

class MachineConfigData(BaseModel):
    """
    Esquema para validar datos de configuración de máquinas.
    """
    machine_id: int = Field(None, description="ID de la máquina")
    name: str = Field(None, description="Nombre de la máquina")
    description: str = Field(None, description="Descripción de la máquina")
    sensor_id: int = Field(None, description="ID del sensor asignado a la máquina")
    
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace

class ConfigurationData(BaseModel):
    """
    Esquema para validar datos de configuración completa del sistema.
    """
    model: ModelConfigData = Field(None, description="Configuración del modelo")
    limit_config: LimitConfigData = Field(None, description="Configuración de límites")
    sensors: list[SensorConfigData] = Field(None, description="Configuración de sensores")
    machines: list[MachineConfigData] = Field(None, description="Configuración de máquinas")
    is_configured: bool = Field(False, description="Indica si el sistema ha sido configurado")
    
    model_config = ConfigDict(protected_namespaces=())  # Eliminar advertencias de namespace

# ---------------------------------------------------------
# CONFIGURACIÓN DE LA APLICACIÓN FASTAPI
# ---------------------------------------------------------

app = FastAPI(
    title="PdM-Manager API",
    description="API para gestión de mantenimiento predictivo",
    version="1.0.0"
)

# Configurar CORS para uso local simple pero compatible con cookies
origins = os.getenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de plantillas Jinja2
# STATIC_DIR está definido globalmente en la sección de CONFIGURACIÓN DE RUTAS Y VARIABLES GLOBALES
templates = Jinja2Templates(directory=STATIC_DIR)
try:
    # Pydantic v2: suprime warnings por 'orm_mode'
    from pydantic.v1.config import BaseConfig  # type: ignore
except Exception:
    pass

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Incluir el router de configuración
app.include_router(config_router)

# ---------------------------------------------------------
# DEFINICIÓN DE RUTAS Y LÓGICA DE LA APLICACIÓN
# ---------------------------------------------------------

@app.get("/")
async def root(request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    return RedirectResponse(url="/panel", status_code=status.HTTP_302_FOUND)

 

@app.get("/panel")
def dashboard(request: Request, user: User = Depends(get_current_user)):
    
    return templates.TemplateResponse("index.html", {"request": request, "user": user})

@app.get("/logout")
def logout(response: Response):
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("access_token", path="/", httponly=True, samesite="Lax")
    return response

# ---------------------------------------------------------
# RUTAS DE LA API (JSON)
# ---------------------------------------------------------

 

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
        from sqlalchemy.sql import text
        db.execute(text("SELECT 1")).fetchall()
        
        try:
            # Verificar estado de configuración del sistema
            try:
                system_config = get_system_config(db)
                health_status["system_configured"] = system_config.is_configured == 1
                
                # Si el sistema no está configurado, actualizar el estado
                if not health_status["system_configured"]:
                    health_status["status"] = "warning"
                    health_status["warning_details"] = "El sistema no ha sido configurado completamente"
            except SQLAlchemyError as sql_e:
                # Si hay un error de SQLAlchemy, puede ser porque faltan tablas o columnas
                logger.warning(f"Error SQL al verificar configuración: {str(sql_e)}")
                health_status["status"] = "warning"
                health_status["warning_details"] = "Error de schema en la base de datos. Ejecute el script init_db.py"
        except Exception as e:
            logger.warning(f"Error al verificar la configuración del sistema: {str(e)}")
            health_status["status"] = "warning"
            health_status["warning_details"] = "No se pudo verificar la configuración del sistema"
    except Exception as e:
        health_status["status"] = "warning"  # Degradamos a warning en lugar de error
        health_status["database"] = "error"
        health_status["warning_details"] = f"Error de conexión a la base de datos: {str(e)}"
    
    # Verificar que los modelos estén cargados
    if model is None or scaler is None:
        # No cambiamos el status si ya hay un warning
        if health_status["status"] == "ok":
            health_status["status"] = "warning"
        health_status["models"] = "not_loaded"
        
        # Agregar warning_details solo si no existe
        if "warning_details" not in health_status:
            health_status["warning_details"] = "Los modelos no están cargados correctamente"
        elif not "Los modelos no están cargados correctamente" in health_status["warning_details"]:
            health_status["warning_details"] += ". Los modelos no están cargados correctamente"
        
        # Intentar cargar los modelos
        if load_ml_models():
            health_status["models"] = "loaded"
            
            # Actualizar mensaje de warning si es necesario
            if "warning_details" in health_status:
                if health_status["warning_details"] == "Los modelos no están cargados correctamente":
                    health_status.pop("warning_details", None)
                    if health_status["database"] != "error":
                        health_status["status"] = "ok"
                elif "Los modelos no están cargados correctamente" in health_status["warning_details"]:
                    health_status["warning_details"] = health_status["warning_details"].replace(". Los modelos no están cargados correctamente", "")
                    health_status["warning_details"] = health_status["warning_details"].replace("Los modelos no están cargados correctamente. ", "")
                    health_status["warning_details"] = health_status["warning_details"].replace("Los modelos no están cargados correctamente", "")
                    if not health_status["warning_details"]:
                        health_status.pop("warning_details", None)
                        if health_status["database"] != "error":
                            health_status["status"] = "ok"
    
    # Siempre devolver código 200, incluso con warnings, para no romper la app
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
    Procesa los datos, calcula la severidad si es posible (si está configurado),
    y almacena en la base de datos.
    """
    logger.info(f"Datos recibidos del sensor {data.sensor_id}")
    
    # Obtener configuración del sistema
    system_config = get_system_config(db)
    is_sys_configured = system_config.is_configured == 1
    active_model_id = system_config.active_model_id
    
    # --- Eliminamos el bloqueo si no está configurado --- 
    # if not is_sys_configured:
    #     logger.warning("Sistema no configurado. Se rechazó la solicitud.")
    #     return JSONResponse(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         content={
    #             "status": "error",
    #             "message": "Configuración incompleta. Por favor, configure el sistema antes de iniciar el monitoreo."
    #         }
    #     )
    # -----------------------------------------------------
    
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
        # Valores por defecto para severidad/anomalía
        severidad = 0
        anomalia = False
        
        # --- Intentar predicción SOLO si está configurado y hay modelo activo ---
        if is_sys_configured and active_model_id:
            logger.info(f"Sistema configurado con modelo activo ID {active_model_id}. Intentando predicción.")
            try:
                model_local, scaler_local = ensure_models_loaded(db)
                if model_local and scaler_local:
                    features = np.array([
                        data.acceleration_x,
                        data.acceleration_y,
                        data.acceleration_z
                    ]).reshape(1, -1)
                    normalized_features = scaler_local.transform(features)
                    # Ajustar shape para el modelo Keras (batch, timesteps, features)
                    input_for_model = np.expand_dims(normalized_features, axis=1)
                    prediction = model_local.predict(input_for_model)
                    pred_value = float(prediction[0][0])
                    anomalia = pred_value > 0.5
                    if pred_value < 0.5:
                        severidad = 0
                    elif pred_value < 0.8:
                        severidad = 1
                    else:
                        severidad = 2
                    logger.info(f"Predicción para sensor {data.sensor_id}: anomalía={anomalia}, severidad={severidad}")
                else:
                    logger.warning("Modelo/escalador no disponibles. Omitiendo predicción.")
            except Exception as e:
                logger.error(f"Error inesperado durante el procesamiento ML para sensor {data.sensor_id}: {str(e)}", exc_info=True)
                severidad = 0
                anomalia = False
        else:
             logger.info(f"Sistema no configurado o sin modelo activo. Guardando datos crudos para sensor {data.sensor_id}.")
        # ---------------------------------------------------------------------
        
        # Guardar los datos en la base de datos (siempre se guardan)
        try:
            db_data = create_vibration_data(
                db=db,
                sensor_id=data.sensor_id,
                acceleration_x=data.acceleration_x,
                acceleration_y=data.acceleration_y,
                acceleration_z=data.acceleration_z,
                date=datetime.fromisoformat(data.timestamp.replace('Z', '+00:00')),
                severity=severidad, # Se usa el valor calculado o el default
                is_anomaly=1 if anomalia else 0 # Se usa el valor calculado o el default
            )
            
            # Crear alerta si la severidad (calculada o default) es alta
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
            
            logger.info(f"Datos guardados para sensor {data.sensor_id}. Severidad registrada: {severidad}")
            return {
                "status": "ok",
                "message": f"Datos recibidos para sensor {data.sensor_id}",
                "calculated_severity": severidad # Devolver la severidad (calculada o default)
            }
        except Exception as e:
            logger.error(f"Error al guardar datos en la base de datos para sensor {data.sensor_id}: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": f"Error al guardar los datos: {str(e)}"
                }
            )
        
    elif isinstance(data, SimpleSensorData):
        # Para datos simplificados, se rechaza la solicitud (mantenemos esto)
        logger.warning(f"Formato SimpleSensorData recibido para sensor {data.sensor_id}, no soportado por este endpoint.")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": "error",
                "message": "Este endpoint requiere datos completos del sensor (acceleration_x, acceleration_y, acceleration_z)"
            }
        )
    else:
        # Caso inesperado
        logger.error(f"Tipo de dato inesperado recibido: {type(data)}")
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "message": "Tipo de dato inválido"})

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
    for data_dict in vibration_data: # Iterar sobre los diccionarios devueltos por CRUD
        result.append({
            "id": data_dict.get("data_id"), # Usar .get() para acceder a claves del dict
            "sensor_id": data_dict.get("sensor_id"),
            "acceleration_x": data_dict.get("acceleration_x"), # Usar claves del dict
            "acceleration_y": data_dict.get("acceleration_y"),
            "acceleration_z": data_dict.get("acceleration_z"),
            "timestamp": data_dict.get("timestamp"), # Ya debería estar en formato ISO
            "is_anomaly": data_dict.get("is_anomaly", 0), # Usar get con default
            "severity": data_dict.get("severity", 0)
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
            try:
                # Obtener todos los sensores
                sensors = get_all_sensors(db)
            except SQLAlchemyError as e:
                # Si hay un error de SQLAlchemy, puede ser porque faltan columnas
                # en lugar de fallar, devolver una lista vacía
                logger.warning(f"Error al consultar sensores: {str(e)}")
                return []
            
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
            sensor_data = {
                "sensor_id": sensor.sensor_id,
                "name": sensor.name if sensor.name else "",
                "description": sensor.description if sensor.description else "",
                "model_id": sensor.model_id
            }
            
            # Verificar si las columnas adicionales existen
            if hasattr(sensor, 'last_reading_time'):
                sensor_data["last_reading_time"] = sensor.last_reading_time.isoformat() if sensor.last_reading_time else None
            if hasattr(sensor, 'last_status'):
                sensor_data["last_status"] = sensor.last_status
            if hasattr(sensor, 'last_severity'):
                sensor_data["last_severity"] = sensor.last_severity
                
            result.append(sensor_data)
            
        return result
            
    except Exception as e:
        error_msg = f"Error al obtener sensores: {str(e)}"
        logger.warning(error_msg)
        # Si hay un error, retornar un array vacío en lugar de error
        return []

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
        logger.warning(error_msg)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": error_msg}
        )

# ---------------------------------------------------------
# ENDPOINT PARA SUBIR ARCHIVOS DE MODELO
# ---------------------------------------------------------
@app.on_event("startup")
def on_startup():
    try:
        db = SessionLocal()
        try:
            # Asegurar límites por defecto (ID=1)
            ensure_default_limits_exist(db)
            # Asegurar modelo por defecto en BD
            ensure_default_model_exists()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Startup warnings: {e}")
    # Cargar modelos ML al inicio (si existen)
    load_ml_models()

# Montar archivos estáticos (CSS, JS, imágenes)
# Asegúrate de que la ruta "static" sea correcta y contenga tus archivos.
# Esta línea ya existe en tu código original, la pongo aquí para contexto.
# app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Incluir el router de configuración
# Esta línea ya existe en tu código original.
# app.include_router(config_router, prefix="/config", tags=["Configuración"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 401:
        # Redirige a la página de login con un mensaje de error específico para no autorizado
        return RedirectResponse(url="/login?error=Acceso no autorizado. Por favor, inicie sesión.", status_code=status.HTTP_302_FOUND)
    # Para otras excepciones HTTP, puedes decidir si quieres un comportamiento por defecto
    # o alguna otra lógica. Aquí se mantiene una respuesta JSON genérica para otros errores HTTP.
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.get("/login", response_class=HTMLResponse)
async def login_get(request: Request, error: Optional[str] = None, success: Optional[str] = None):
    # Asegúrate de que el contexto para la plantilla incluya 'request', 'error' y 'success'
    # Ya no necesitamos pasar 'error' y 'success' al contexto de la plantilla directamente si se manejan por JS desde la URL
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
async def login_post(request: Request, response: FastAPIResponse, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        # Redirige a login con parámetro de error para ser capturado por JS
        return RedirectResponse(url="/login?error=Usuario o contraseña incorrectos", status_code=status.HTTP_302_FOUND)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Establecer la cookie y luego redirigir
    redirect_response = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    # Es importante usar FastAPIResponse para poder manipular las cookies directamente en la respuesta de redirección.
    # Sin embargo, set_cookie es un método del objeto Response de Starlette/FastAPI, no de RedirectResponse directamente en algunas versiones.
    # La forma más robusta es crear la RedirectResponse y luego llamar a set_cookie sobre ella.
    response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True, max_age=int(access_token_expires.total_seconds()), samesite="Lax")
    # Para que la cookie se establezca correctamente ANTES de la redirección, 
    # es mejor devolver la redirect_response y aplicar la cookie a esa respuesta.
    # O, si se usa el parámetro 'response: FastAPIResponse', se puede modificar esa respuesta y retornarla.
    # Aquí, para simplificar y asegurar que la cookie se envíe con la redirección:
    final_response = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    final_response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True, max_age=int(access_token_expires.total_seconds()), samesite="Lax")
    return final_response

@app.get("/register", response_class=HTMLResponse)
async def register_get(request: Request, error: Optional[str] = None, success: Optional[str] = None):
    # Ya no necesitamos pasar 'error' y 'success' al contexto de la plantilla directamente
    return templates.TemplateResponse("register.html", {"request": request})

@app.post("/register")
async def register_post(request: Request, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == username).first()
    if db_user:
        # Redirige a register con parámetro de error
        return RedirectResponse(url="/register?error=El nombre de usuario ya existe", status_code=status.HTTP_302_FOUND)
    
    hashed_password = get_password_hash(password)
    new_user = User(username=username, hashed_password=hashed_password)
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
        # Redirige a la página de login con un mensaje de éxito después de un registro correcto
        return RedirectResponse(url="/login?success=Usuario registrado correctamente. Por favor, inicie sesión.", status_code=status.HTTP_302_FOUND)
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al registrar usuario: {e}")
        # Redirige a register con parámetro de error
        return RedirectResponse(url="/register?error=Ocurrió un error durante el registro. Inténtelo de nuevo.", status_code=status.HTTP_302_FOUND)