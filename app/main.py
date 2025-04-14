# app/main.py
import os
import pickle
import joblib
from datetime import datetime, timedelta
import numpy as np
import logging
from typing import Dict, Any, Union, Optional, List
import shutil

# FastAPI
from fastapi import FastAPI, HTTPException, Depends, status, Request, Query, Body, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, validator, root_validator

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
    get_all_limits, get_limit_by_id, delete_limit,
    ensure_default_limits_exist
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

# Rutas por defecto para el modelo y el escalador
DEFAULT_MODEL_PATH = r"C:\Users\nicol\Documentos\GitHub\PdM-Manager\Modelo\anomaly_detection_model.h5"
DEFAULT_SCALER_PATH = r"C:\Users\nicol\Documentos\GitHub\PdM-Manager\Scaler\scaler.pkl"

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
    """
    global model, scaler
    
    try:
        # Definir rutas predeterminadas
        model_path = DEFAULT_MODEL_PATH
        scaler_path = DEFAULT_SCALER_PATH
        
        # Intentar obtener configuración de la base de datos si es posible
        try:
            db = SessionLocal()
            try:
                system_config = get_system_config(db)
                if system_config.active_model_id:
                    db_model = get_model_by_id(db, system_config.active_model_id)
                    if db_model and db_model.route_h5 and db_model.route_pkl:
                        model_path = db_model.route_h5
                        scaler_path = db_model.route_pkl
                        logger.info(f"Usando modelo configurado: {model_path}")
            finally:
                db.close()
        except Exception as db_err:
            logger.warning(f"No se pudo obtener configuración de la BD: {str(db_err)}. Usando valores predeterminados.")
        
        # Verificar si las rutas son absolutas
        if not os.path.isabs(model_path):
            model_path = os.path.join(BASE_DIR, model_path)
        if not os.path.isabs(scaler_path):
            scaler_path = os.path.join(BASE_DIR, scaler_path)
        
        # Verificar si los archivos existen
        if not os.path.exists(model_path):
            logger.info(f"El archivo del modelo no existe: {model_path}")
            # Volver a la ruta predeterminada si el archivo no existe
            model_path = DEFAULT_MODEL_PATH
            if not os.path.exists(model_path):
                logger.info(f"El archivo del modelo predeterminado no existe: {model_path}")
                return False
        
        if not os.path.exists(scaler_path):
            logger.info(f"El archivo del escalador no existe: {scaler_path}")
            # Volver a la ruta predeterminada si el archivo no existe
            scaler_path = DEFAULT_SCALER_PATH
            if not os.path.exists(scaler_path):
                logger.info(f"El archivo del escalador predeterminado no existe: {scaler_path}")
                return False
        
        # Cargar modelo
        try:
            model = load_model(model_path, compile=False)
            logger.info(f"Modelo cargado correctamente: {type(model)}")
        except Exception as model_err:
            logger.warning(f"Error al cargar el modelo: {str(model_err)}")
            return False
        
        # Cargar escalador
        try:
            # Intentar primero con joblib
            scaler = joblib.load(scaler_path)
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
                
                # Crear modelo con las rutas predeterminadas
                default_model = create_new_model(
                    db,
                    name="Modelo por defecto",
                    description="Modelo de detección de anomalías por defecto",
                    route_h5=DEFAULT_MODEL_PATH,
                    route_pkl=DEFAULT_SCALER_PATH
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
    
    Este evento realiza las siguientes tareas:
    1. Intenta cargar los modelos de ML
    2. Configura la base de datos si es necesario
    3. Verifica y crea los límites por defecto si no existen (usando la función de crud_config)
    4. Verifica y crea el modelo por defecto si no existe
    """
    global model, scaler
    
    try:
        logger.info("Iniciando aplicación PdM-Manager")
        
        logger.info("Iniciando carga de modelos ML y configuración...")
        if not load_ml_models():
            logger.info("Modelos de ML no cargados. Configure el sistema en la sección 'Configuración'.") # Mensaje informativo único
        
        # Crear una sesión de base de datos para la inicialización
        db = SessionLocal()
        try:
            logger.info("Verificando configuración de límites por defecto...")
            ensure_default_limits_exist(db) # Llamar a la función importada
            
            # Verificar y crear modelo por defecto si es necesario
            # ensure_default_model_exists() # Comentar o eliminar si no se necesita más
            
            # Verificar si la base de datos está configurada
            system_config = get_system_config(db)
            
            if not system_config.is_configured:
                logger.info("Sistema no configurado. Se mostrará la página de configuración al acceder.")
            else:
                logger.info("Sistema configurado correctamente.")
        except Exception as e:
            logger.warning(f"Error durante la inicialización de la BD: {str(e)}")
        finally:
            db.close()
            
    except Exception as e:
        logger.warning(f"Error durante la inicialización general: {str(e)}")

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
                # Obtener el modelo activo desde la base de datos
                db_model = get_model_by_id(db, active_model_id)
                
                if not db_model or not db_model.route_h5 or not db_model.route_pkl:
                    logger.warning(f"Modelo activo ID {active_model_id} sin rutas configuradas. Omitiendo predicción.")
                    # No retornamos error, solo omitimos la predicción
                else:
                    # Usar rutas configuradas en la base de datos
                    model_path = db_model.route_h5
                    scaler_path = db_model.route_pkl
                    
                    # Verificar si las rutas son absolutas, si no, convertirlas
                    if not os.path.isabs(model_path):
                        model_path = os.path.join(BASE_DIR, model_path)
                    if not os.path.isabs(scaler_path):
                        scaler_path = os.path.join(BASE_DIR, scaler_path)
                    
                    # Verificar si los archivos existen
                    if not os.path.exists(model_path):
                        logger.warning(f"El archivo del modelo no existe: {model_path}. Omitiendo predicción.")
                    elif not os.path.exists(scaler_path):
                         logger.warning(f"El archivo del escalador no existe: {scaler_path}. Omitiendo predicción.")
                    else:
                        # Cargar el modelo desde el archivo .h5 utilizando tensorflow
                        model_local = load_model(model_path, compile=False) # Añadido compile=False por si acaso
                        
                        # Cargar el escalador
                        scaler_local = None
                        try:
                            scaler_local = joblib.load(scaler_path)
                            logger.info(f"Escalador cargado con joblib: {type(scaler_local)}")
                        except Exception as joblib_err:
                            logger.warning(f"Error con joblib: {joblib_err}. Intentando con pickle.")
                            try:
                                with open(scaler_path, 'rb') as f:
                                    scaler_local = pickle.load(f)
                                logger.info(f"Escalador cargado con pickle: {type(scaler_local)}")
                            except Exception as pickle_err:
                                logger.warning(f"Error al cargar el escalador: {pickle_err}. Omitiendo predicción.")
                                scaler_local = None # Asegurar que es None
                        
                        # Proceder con la predicción solo si modelo y escalador se cargaron
                        if model_local and scaler_local:
                            features = np.array([
                                data.acceleration_x,
                                data.acceleration_y,
                                data.acceleration_z
                            ]).reshape(1, -1)
                            normalized_features = scaler_local.transform(features)
                            
                            # *** AJUSTAR SHAPE PARA EL MODELO KERAS ***
                            # El modelo espera (None, 1, 3), añadimos la dimensión de paso de tiempo
                            input_for_model = np.expand_dims(normalized_features, axis=1)
                            # *** FIN AJUSTE SHAPE ***
                            
                            prediction = model_local.predict(input_for_model)
                            pred_value = float(prediction[0][0])
                            anomalia = pred_value > 0.5
                            if pred_value < 0.5: severidad = 0
                            elif pred_value < 0.8: severidad = 1
                            else: severidad = 2
                            logger.info(f"Predicción para sensor {data.sensor_id}: anomalía={anomalia}, severidad={severidad}")
                        else:
                            logger.warning("No se pudo cargar modelo o escalador. Omitiendo predicción.")

            except Exception as e:
                logger.error(f"Error inesperado durante el procesamiento ML para sensor {data.sensor_id}: {str(e)}", exc_info=True)
                # No devolver error 500, solo registrar y usar valores por defecto
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
# ... (código existente) ...