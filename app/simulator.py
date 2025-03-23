# app/simulator.py

import os
import csv
import time
import threading
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Any, Optional
import joblib

from fastapi import HTTPException

from app.database import get_db, SessionLocal
from app.models import VibrationData, Sensor, Alert
from app.crud import create_vibration_data, get_sensor_by_id, create_sensor, create_alert
from tensorflow.keras.models import load_model

# Configuración de logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("simulator")

# Ruta para almacenar archivos CSV
CSV_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(CSV_DIR, exist_ok=True)

# Variables globales para controlar la simulación
simulation_running = False
simulation_thread = None
simulation_status = {
    "running": False,
    "file": "",
    "processed_records": 0,
    "total_records": 0,
    "progress": 0,
    "last_record": None,
    "next_in_seconds": None,
    "sensor_id": None,
    "interval": 5,
    "start_time": None,
    # Para almacenar datos recientes de vibración
    "recent_records": [],
    # Para almacenar alertas recientes
    "recent_alerts": [],
    # Contadores de alertas
    "alerts_level1": 0,
    "alerts_level2": 0,
    "alerts_level3": 0,
    "alerts_total": 0
}
interval = 5  # Segundos entre registros (predeterminado)

# Número máximo de registros recientes a mantener
MAX_RECENT_RECORDS = 50
# Número máximo de alertas recientes a mantener
MAX_RECENT_ALERTS = 20

# Diccionario para mapear severidad a texto legible
SEVERITY_MAPPING = {
    0: "Normal",
    1: "Nivel 1",
    2: "Nivel 2",
    3: "Nivel 3 (Crítico)"
}

# Estructura para almacenar datos en memoria (para modo simulación sin BD)
in_memory_db = {
    "machines": [
        {
            "id": 1,
            "name": "Máquina 1",
            "description": "Máquina predefinida para simulación",
            "type": "motor",
            "location": "Planta A",
            "status": "normal"
        }
    ],
    "sensors": [
        {
            "id": 1,
            "name": "Sensor 1",
            "description": "Sensor de vibración predefinido",
            "machine_id": 1,
            "type": "vibration",
            "location": "Motor principal"
        }
    ],
    "models": [
        {
            "id": 1,
            "name": "Modelo RNN Multiclase",
            "description": "Modelo predefinido para detección de anomalías",
            "route_h5": "Modelo/modeloRNN_multiclase_v3_finetuned.h5",
            "route_scaler": "Modelo/scaler_RNN.pkl"
        }
    ]
}

# Límites estadísticos iniciales para cada eje
statistical_limits = {
    "x": {
        "sigma2": {
            "lower": -2.364295,
            "upper": 2.180056
        },
        "sigma3": {
            "lower": -3.500383,
            "upper": 3.316144
        }
    },
    "y": {
        "sigma2": {
            "lower": 7.177221,
            "upper": 12.088666
        },
        "sigma3": {
            "lower": 5.949359,
            "upper": 13.316528
        }
    },
    "z": {
        "sigma2": {
            "lower": -2.389107,
            "upper": 1.106510
        },
        "sigma3": {
            "lower": -3.263011,
            "upper": 1.980414
        }
    }
}

def get_model_and_scaler():
    """Carga el modelo RNN y el escalador."""
    model_path = os.path.join("Modelo", "modeloRNN_multiclase_v3_finetuned.h5")
    scaler_path = os.path.join("Modelo", "scaler_RNN.pkl")
    
    model = None
    scaler = None
    
    try:
        model = load_model(model_path)
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
            logger.info("Modelo y escalador cargados correctamente")
        else:
            logger.warning("Escalador no encontrado. El modelo usará datos sin escalar.")
    except Exception as e:
        logger.error(f"Error cargando modelo o escalador: {str(e)}")
        
    return model, scaler

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
        query = db.query(Alert).filter(
            Alert.sensor_id == sensor_id,
            Alert.severity == 2,  # Nivel 2
            Alert.timestamp >= time_limit
        ).count()
        
        # Determinar si supera el umbral
        return query >= threshold
    
    except Exception as e:
        logger.error(f"Error al verificar condición de Nivel 3: {e}")
        return False

def predict_severity(x: float, y: float, z: float, verbose: bool = False, db=None, sensor_id=None) -> Dict[str, Any]:
    """
    Predice la severidad utilizando el modelo RNN entrenado
    """
    # Cargar modelo y escalador si no están ya cargados
    model, scaler = get_model_and_scaler()
    
    # Calcular magnitud de la vibración
    magnitude = np.sqrt(x**2 + y**2 + z**2)
    
    # Preparar datos para la predicción
    data_array = np.array([[x, y, z]], dtype=np.float32)
    
    # Escalar datos si el escalador está disponible
    if scaler:
        data_array = scaler.transform(data_array)
    
    # Ajustar forma para el modelo RNN (1, timesteps, features)
    rnn_input = data_array.reshape(1, 1, 3)
    
    if model:
        # Hacer predicción con el modelo
        prediction = model.predict(rnn_input, verbose=0)
        severity = int(np.argmax(prediction[0]))
        confidence = float(np.max(prediction)) * 100  # Confianza en porcentaje
    else:
        # Lógica de respaldo si el modelo no está disponible
        if magnitude < 0.8:
            severity = 0  # Normal
            confidence = 90 + np.random.randint(0, 10)
        elif magnitude < 1.2:
            severity = 1  # Nivel 1
            confidence = 75 + np.random.randint(0, 15)
        else:
            severity = 2  # Nivel 2
            confidence = 80 + np.random.randint(0, 20)
    
    # Verificar si aplica condición de Nivel 3 (solo si tenemos db y sensor_id)
    elevated_to_level3 = False
    if db and sensor_id and severity == 2:  # Si ya es nivel 2, verificar si pasa a nivel 3
        elevated_to_level3 = check_level3_condition(db, sensor_id)
        if elevated_to_level3:
            severity = 3  # Elevar a Nivel 3
    
    if verbose:
        if elevated_to_level3:
            logger.info(f"Predicción de vibración (mag={magnitude:.2f}): Elevado a Nivel 3 (Crítico), Confianza {confidence}%")
        else:
            logger.info(f"Predicción de vibración (mag={magnitude:.2f}): {SEVERITY_MAPPING[severity]}, Confianza {confidence}%")
    
    return {
        "severity": severity,
        "severity_text": SEVERITY_MAPPING[severity],
        "confidence": confidence,
        "magnitude": magnitude,
        "elevated_to_level3": elevated_to_level3
    }

def validate_csv_format(filename: str) -> bool:
    """Valida que el formato del CSV sea el esperado"""
    try:
        # Leer las primeras filas para validar
        df = pd.read_csv(filename, nrows=5)
        required_columns = ['timestamp', 'sensor_id', 'x', 'y', 'z']
        
        # Verificar que todas las columnas requeridas estén presentes
        if not all(col in df.columns for col in required_columns):
            logger.error(f"El archivo {filename} no tiene el formato esperado. Columnas esperadas: {required_columns}")
            return False
        
        return True
    except Exception as e:
        logger.error(f"Error al validar formato de CSV: {e}")
        return False

def process_record(db, record: Dict[str, Any], sensor_id: Optional[int] = None) -> Dict[str, Any]:
    """Procesa un registro de datos de vibración y lo guarda en la base de datos"""
    try:
        # Si no se proporciona sensor_id, verificar que el sensor exista o crearlo
        if not sensor_id:
            sensor_id = record.get("sensor_id", 1)
            sensor = get_sensor_by_id(db, sensor_id)
            if not sensor:
                # Crear sensor si no existe
                sensor = create_sensor(db, Sensor(id=sensor_id, name=f"Sensor {sensor_id}"))
                logger.info(f"Sensor creado con ID {sensor_id}")
        
        # Extraer datos de vibración
        x = float(record.get("x", 0))
        y = float(record.get("y", 0))
        z = float(record.get("z", 0))
        
        # Opcional: fecha personalizada o usar la actual
        custom_date = None
        timestamp_str = ""
        if "timestamp" in record and record["timestamp"]:
            try:
                custom_date = datetime.fromisoformat(record["timestamp"])
                timestamp_str = record["timestamp"]
            except (ValueError, TypeError):
                pass  # Si hay error al parsear, se usará la fecha actual
        
        if not custom_date:
            custom_date = datetime.now()
            timestamp_str = custom_date.isoformat()
        
        # Predecir severidad
        prediction_result = predict_severity(x, y, z, verbose=True, db=db, sensor_id=sensor_id)
        severity = prediction_result["severity"]
        confidence = prediction_result["confidence"]
        elevated_to_level3 = prediction_result.get("elevated_to_level3", False)
        
        # Calcular magnitud
        magnitude = np.sqrt(x**2 + y**2 + z**2)
        
        # Crear registro de datos de vibración
        try:
            db_data = create_vibration_data(
                db=db,
                sensor_id=sensor_id,
                acceleration_x=x,
                acceleration_y=y,
                acceleration_z=z,
                severity=severity,
                custom_date=custom_date
            )
            data_id = db_data.id
        except Exception as e:
            logger.warning(f"Error al guardar en DB, continuando en modo simulación: {e}")
            data_id = simulation_status["processed_records"] + 1
        
        # Si no normal (>0), crear alerta
        if severity > 0:
            message = f"Alerta de vibración {SEVERITY_MAPPING[severity]} - Magnitud: {magnitude:.2f}"
            if elevated_to_level3:
                message += " (Elevado a Nivel 3 por frecuencia alta de alertas Nivel 2)"
            
            try:
                alert = create_alert(
                    db,
                    Alert(
                        sensor_id=sensor_id,
                        message=message,
                        severity=severity,
                        acknowledged=False
                    )
                )
                alert_id = alert.id
            except Exception as e:
                logger.warning(f"Error al guardar alerta en DB, continuando en modo simulación: {e}")
                alert_id = len(simulation_status["recent_alerts"]) + 1
            
            logger.info(f"Alerta creada: {message}")
            
            # Incrementar contador de alertas
            if severity == 1:
                simulation_status["alerts_level1"] += 1
            elif severity == 2:
                simulation_status["alerts_level2"] += 1
            elif severity == 3:
                simulation_status["alerts_level3"] += 1
            simulation_status["alerts_total"] += 1
            
            # Añadir a alertas recientes
            alert_data = {
                "id": alert_id,
                "sensor_id": sensor_id,
                "sensor_name": f"Sensor {sensor_id}",
                "message": message,
                "severity": severity,
                "timestamp": timestamp_str,
                "acknowledged": False
            }
            
            # Añadir al inicio de la lista y mantener tamaño máximo
            simulation_status["recent_alerts"].insert(0, alert_data)
            if len(simulation_status["recent_alerts"]) > MAX_RECENT_ALERTS:
                simulation_status["recent_alerts"] = simulation_status["recent_alerts"][:MAX_RECENT_ALERTS]
        
        # Preparar respuesta con datos procesados
        response = {
            "data_id": data_id,
            "sensor_id": sensor_id,
            "x": x,
            "y": y,
            "z": z,
            "magnitude": magnitude,
            "timestamp": timestamp_str,
            "severity": severity,
            "severity_text": SEVERITY_MAPPING[severity],
            "confidence": confidence,
            "elevated_to_level3": elevated_to_level3
        }
        
        # Actualizar último registro procesado
        simulation_status["last_record"] = response
        
        # Añadir a registros recientes
        simulation_status["recent_records"].insert(0, response)
        if len(simulation_status["recent_records"]) > MAX_RECENT_RECORDS:
            simulation_status["recent_records"] = simulation_status["recent_records"][:MAX_RECENT_RECORDS]
        
        return response
    except Exception as e:
        logger.error(f"Error al procesar registro: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar registro: {str(e)}")

def simulation_worker(db, file_path: str, interval_seconds: int):
    """
    Función que ejecuta la simulación en un hilo separado.
    Lee registros del archivo CSV y los procesa a intervalos regulares.
    """
    global simulation_running, simulation_status
    
    try:
        df = pd.read_csv(file_path)
        total_records = len(df)
        
        simulation_status["total_records"] = total_records
        simulation_status["interval"] = interval_seconds
        simulation_status["start_time"] = datetime.now().isoformat()
        simulation_status["file"] = os.path.basename(file_path)
        
        logger.info(f"Iniciando simulación con {total_records} registros, intervalo: {interval_seconds}s")
        
        # Extraer ID del sensor del primer registro (o usar el predeterminado)
        sensor_id = df.iloc[0].get("sensor_id", 1) if "sensor_id" in df.columns else 1
        simulation_status["sensor_id"] = sensor_id
        
        processed = 0
        
        while simulation_running and processed < total_records:
            # Obtener registro actual
            record = df.iloc[processed].to_dict()
            
            # Procesar registro
            result = process_record(db, record, sensor_id=sensor_id)
            
            # Actualizar estadísticas
            processed += 1
            simulation_status["processed_records"] = processed
            simulation_status["progress"] = (processed / total_records) * 100
            
            logger.info(f"Procesado registro {processed}/{total_records} - Severidad: {result['severity_text']}")
            
            # Terminar si hemos procesado todos los registros
            if processed >= total_records:
                logger.info("Simulación completada. Todos los registros procesados.")
                break
            
            # Calcular próxima ejecución
            next_time = datetime.now() + timedelta(seconds=interval_seconds)
            simulation_status["next_in_seconds"] = interval_seconds
            
            # Esperar intervalo (comprobando periódicamente si la simulación debe detenerse)
            wait_start = time.time()
            while time.time() - wait_start < interval_seconds:
                if not simulation_running:
                    logger.info("Simulación detenida por el usuario.")
                    break
                time.sleep(0.1)  # Verificar cada 100 ms
                simulation_status["next_in_seconds"] = int(interval_seconds - (time.time() - wait_start))
        
        # Actualizar estado al finalizar
        if processed >= total_records:
            logger.info("Simulación completada exitosamente.")
        else:
            logger.info("Simulación detenida antes de completar todos los registros.")
        
    except Exception as e:
        logger.error(f"Error en simulación: {e}")
    finally:
        # Asegurarse de que el estado se actualice cuando el hilo termine
        simulation_running = False
        simulation_status["running"] = False
        simulation_status["next_in_seconds"] = None

def start_simulation(db, file_path: str, interval_seconds: int = 5) -> Dict[str, Any]:
    """
    Inicia la simulación con un archivo CSV.
    Si ya hay una simulación en curso, la detiene y comienza una nueva.
    
    Args:
        db: Sesión de base de datos
        file_path: Ruta al archivo CSV
        interval_seconds: Intervalo entre registros en segundos
        
    Returns:
        Dict con el estado de la operación
    """
    global simulation_running, simulation_thread, simulation_status
    
    try:
        # Si hay una simulación en curso, detenerla
        if simulation_running:
            stop_simulation()
        
        # Validar CSV
        if not validate_csv_format(file_path):
            return {
                "success": False,
                "message": "El archivo CSV no tiene el formato esperado (debe contener timestamp, sensor_id, x, y, z)"
            }
        
        # Configurar nueva simulación
        simulation_running = True
        simulation_status = {
            "running": True,
            "file": os.path.basename(file_path),
            "processed_records": 0,
            "total_records": 0,
            "progress": 0,
            "last_record": None,
            "next_in_seconds": interval_seconds,
            "interval": interval_seconds,
            "start_time": datetime.now().isoformat(),
            "sensor_id": None,
            # Listas para datos recientes
            "recent_records": [],
            "recent_alerts": [],
            # Contadores de alertas
            "alerts_level1": 0,
            "alerts_level2": 0,
            "alerts_level3": 0,
            "alerts_total": 0
        }
        
        # Iniciar hilo de simulación
        simulation_thread = threading.Thread(
            target=simulation_worker,
            args=(db, file_path, interval_seconds),
            daemon=True
        )
        simulation_thread.start()
        
        logger.info(f"Simulación iniciada con archivo {file_path}, intervalo: {interval_seconds}s")
        
        return {
            "success": True,
            "running": True,
            "file": os.path.basename(file_path),
            "interval": interval_seconds
        }
    except Exception as e:
        simulation_running = False
        simulation_status["running"] = False
        logger.error(f"Error al iniciar simulación: {e}")
        return {
            "success": False,
            "message": f"Error al iniciar simulación: {str(e)}"
        }

def stop_simulation() -> Dict[str, Any]:
    """
    Detiene la simulación en curso
    
    Returns:
        Dict con el estado de la operación
    """
    global simulation_running, simulation_thread, simulation_status
    
    try:
        if not simulation_running:
            return {
                "success": False,
                "message": "No hay simulación en curso"
            }
        
        # Detener simulación
        simulation_running = False
        simulation_status["running"] = False
        
        # Esperar a que el hilo termine (con timeout)
        if simulation_thread and simulation_thread.is_alive():
            simulation_thread.join(timeout=5.0)
        
        logger.info("Simulación detenida")
        
        # Registros procesados
        processed = simulation_status["processed_records"]
        total = simulation_status["total_records"]
        
        return {
            "success": True,
            "processed_records": processed,
            "total_records": total,
            "progress": (processed / total * 100) if total > 0 else 0
        }
    except Exception as e:
        logger.error(f"Error al detener simulación: {e}")
        return {
            "success": False,
            "message": f"Error al detener simulación: {str(e)}"
        }

def get_simulation_status() -> Dict[str, Any]:
    """
    Devuelve el estado actual de la simulación
    
    Returns:
        Dict con el estado actual
    """
    global simulation_status
    
    # Copiar estado actual
    status = dict(simulation_status)
    
    # Actualizar estado de ejecución (por si el hilo murió)
    status["running"] = simulation_running
    
    return status

def upload_csv(file_content, filename):
    """
    Guarda un archivo CSV cargado por el usuario.
    
    Args:
        file_content: Contenido del archivo
        filename: Nombre del archivo
    
    Returns:
        Dict con información del archivo guardado
    """
    # Asegurar que el archivo tenga extensión .csv
    if not filename.lower().endswith('.csv'):
        filename += '.csv'
    
    # Crear ruta completa
    file_path = os.path.join(CSV_DIR, filename)
    
    # Guardar archivo
    with open(file_path, 'wb') as f:
        f.write(file_content)
    
    # Validar formato
    valid = validate_csv_format(file_path)
    
    return {
        "filename": filename,
        "path": file_path,
        "size": len(file_content),
        "valid": valid,
        "message": "CSV válido" if valid else "Formato de CSV incorrecto"
    }

def list_csv_files():
    """
    Lista los archivos CSV disponibles para simulación.
    """
    files = []
    
    if os.path.exists(CSV_DIR):
        for filename in os.listdir(CSV_DIR):
            if filename.lower().endswith('.csv'):
                file_path = os.path.join(CSV_DIR, filename)
                
                # Contar registros en el archivo
                record_count = 0
                try:
                    with open(file_path, 'r') as f:
                        record_count = sum(1 for _ in f) - 1  # Restar 1 por la cabecera
                except:
                    record_count = 0
                
                file_info = {
                    "name": filename,  # Cambiado de "filename" a "name" para compatibilidad con frontend
                    "path": file_path,
                    "size": os.path.getsize(file_path),
                    "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
                    "records": record_count
                }
                
                # Verificar validez del CSV
                valid = validate_csv_format(file_path)
                file_info["valid"] = valid
                file_info["message"] = "CSV válido" if valid else "Formato de CSV incorrecto"
                
                files.append(file_info)
    
    return {"files": files}

# Funciones para manejar datos en memoria
def get_machines():
    """Obtiene la lista de todas las máquinas en memoria."""
    return in_memory_db["machines"]

def get_machine(machine_id):
    """Obtiene una máquina específica por su ID."""
    for machine in in_memory_db["machines"]:
        if machine["id"] == machine_id:
            return machine
    return None

def create_machine(machine_data):
    """Crea una nueva máquina en memoria."""
    # Asignar ID (siguiente disponible)
    max_id = max([m["id"] for m in in_memory_db["machines"]]) if in_memory_db["machines"] else 0
    machine_data["id"] = max_id + 1
    
    # Agregar la máquina
    in_memory_db["machines"].append(machine_data)
    return machine_data

def update_machine(machine_id, machine_data):
    """Actualiza una máquina existente en memoria."""
    for i, machine in enumerate(in_memory_db["machines"]):
        if machine["id"] == machine_id:
            # Actualizar manteniendo el ID original
            machine_data["id"] = machine_id
            in_memory_db["machines"][i] = machine_data
            return machine_data
    return None

def delete_machine(machine_id):
    """Elimina una máquina de la memoria."""
    for i, machine in enumerate(in_memory_db["machines"]):
        if machine["id"] == machine_id:
            del in_memory_db["machines"][i]
            return True
    return False

def get_sensors():
    """Obtiene la lista de todos los sensores en memoria."""
    return in_memory_db["sensors"]

def get_sensor(sensor_id):
    """Obtiene un sensor específico por su ID."""
    for sensor in in_memory_db["sensors"]:
        if sensor["id"] == sensor_id:
            return sensor
    return None

def get_sensors_by_machine(machine_id):
    """Obtiene los sensores asociados a una máquina específica."""
    return [s for s in in_memory_db["sensors"] if s["machine_id"] == machine_id]

def create_sensor(sensor_data):
    """Crea un nuevo sensor en memoria."""
    # Asignar ID (siguiente disponible)
    max_id = max([s["id"] for s in in_memory_db["sensors"]]) if in_memory_db["sensors"] else 0
    sensor_data["id"] = max_id + 1
    
    # Agregar el sensor
    in_memory_db["sensors"].append(sensor_data)
    return sensor_data

def update_sensor(sensor_id, sensor_data):
    """Actualiza un sensor existente en memoria."""
    for i, sensor in enumerate(in_memory_db["sensors"]):
        if sensor["id"] == sensor_id:
            # Actualizar manteniendo el ID original
            sensor_data["id"] = sensor_id
            in_memory_db["sensors"][i] = sensor_data
            return sensor_data
    return None

def delete_sensor(sensor_id):
    """Elimina un sensor de la memoria."""
    for i, sensor in enumerate(in_memory_db["sensors"]):
        if sensor["id"] == sensor_id:
            del in_memory_db["sensors"][i]
            return True
    return False

def get_models():
    """Obtiene la lista de todos los modelos en memoria."""
    return in_memory_db["models"]

def get_model(model_id):
    """Obtiene un modelo específico por su ID."""
    for model in in_memory_db["models"]:
        if model["id"] == model_id:
            return model
    return None

def create_model(model_data):
    """Crea un nuevo modelo en memoria."""
    # Asignar ID (siguiente disponible)
    max_id = max([m["id"] for m in in_memory_db["models"]]) if in_memory_db["models"] else 0
    model_data["id"] = max_id + 1
    
    # Agregar el modelo
    in_memory_db["models"].append(model_data)
    return model_data

def update_model(model_id, model_data):
    """Actualiza un modelo existente en memoria."""
    for i, model in enumerate(in_memory_db["models"]):
        if model["id"] == model_id:
            # Actualizar manteniendo el ID original
            model_data["id"] = model_id
            in_memory_db["models"][i] = model_data
            return model_data
    return None

def delete_model(model_id):
    """Elimina un modelo de la memoria."""
    for i, model in enumerate(in_memory_db["models"]):
        if model["id"] == model_id:
            del in_memory_db["models"][i]
            return True
    return False

def get_statistical_limits():
    """Obtiene los límites estadísticos actuales"""
    return statistical_limits

def update_statistical_limits(axis, sigma_level, limit_type, value):
    """
    Actualiza un límite estadístico específico
    
    Args:
        axis: Eje a actualizar ('x', 'y', 'z')
        sigma_level: Nivel de sigma ('sigma2' o 'sigma3')
        limit_type: Tipo de límite ('lower' o 'upper')
        value: Nuevo valor para el límite
    
    Returns:
        Dict con los límites actualizados
    """
    if axis not in statistical_limits:
        return {"error": f"Eje no válido: {axis}. Debe ser 'x', 'y' o 'z'."}
    
    if sigma_level not in ['sigma2', 'sigma3']:
        return {"error": f"Nivel de sigma no válido: {sigma_level}. Debe ser 'sigma2' o 'sigma3'."}
    
    if limit_type not in ['lower', 'upper']:
        return {"error": f"Tipo de límite no válido: {limit_type}. Debe ser 'lower' o 'upper'."}
    
    try:
        # Actualizar límite
        statistical_limits[axis][sigma_level][limit_type] = float(value)
        
        return {"success": True, "message": f"Límite {sigma_level} {limit_type} para el eje {axis} actualizado a {value}"}
    except ValueError:
        return {"error": "El valor debe ser un número."}
    except Exception as e:
        return {"error": f"Error al actualizar límite: {str(e)}"} 