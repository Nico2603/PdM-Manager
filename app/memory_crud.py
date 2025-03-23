# app/memory_crud.py

from datetime import datetime
from typing import List, Dict, Any, Optional
import copy

# Almacenamiento en memoria
memory_db = {
    "sensors": [],
    "vibration_data": [],
    "alerts": [],
    "machines": [],
    "models": []
}

# Contadores para IDs automáticos
id_counters = {
    "sensor_id": 1,
    "data_id": 1,
    "log_id": 1,
    "machine_id": 1,
    "model_id": 1
}

# Inicializar con algunos datos de ejemplo
def initialize_memory_db():
    # Crear modelo de ejemplo
    model = {
        "model_id": id_counters["model_id"],
        "route_h5": "Modelo/modeloRNN_multiclase_v3_finetuned.h5",
        "name": "Modelo RNN Multiclase",
        "description": "Modelo para detección de anomalías de vibración",
        "last_update": datetime.now().isoformat(),
        "accuracy": 0.97,
        "config_params": None
    }
    memory_db["models"].append(model)
    id_counters["model_id"] += 1
    
    # Crear máquina de ejemplo
    machine = {
        "machine_id": id_counters["machine_id"],
        "model_id": 1,
        "name": "Máquina 1",
        "description": "Máquina de prueba para simulación",
        "location": "Planta A",
        "status": "operational"
    }
    memory_db["machines"].append(machine)
    id_counters["machine_id"] += 1
    
    # Crear sensor de ejemplo
    sensor = {
        "sensor_id": id_counters["sensor_id"],
        "name": "Sensor 1",
        "description": "Sensor de vibración para simulación",
        "location": "Motor principal",
        "type": "vibration",
        "machine_id": 1
    }
    memory_db["sensors"].append(sensor)
    id_counters["sensor_id"] += 1

# --- Funciones CRUD para Sensores ---

def get_sensors(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todos los sensores"""
    return memory_db["sensors"][skip:skip+limit]

def get_sensor_by_id(sensor_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un sensor por su ID"""
    for sensor in memory_db["sensors"]:
        if sensor["sensor_id"] == sensor_id:
            return sensor
    return None

def get_sensor(sensor_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un sensor por su ID"""
    return get_sensor_by_id(sensor_id)

def create_sensor(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea un nuevo sensor"""
    sensor_data["sensor_id"] = id_counters["sensor_id"]
    id_counters["sensor_id"] += 1
    memory_db["sensors"].append(sensor_data)
    return copy.deepcopy(sensor_data)

def update_sensor(sensor_id: int, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un sensor existente"""
    for i, sensor in enumerate(memory_db["sensors"]):
        if sensor["sensor_id"] == sensor_id:
            sensor_data["sensor_id"] = sensor_id  # Asegurar que el ID no cambie
            memory_db["sensors"][i] = sensor_data
            return copy.deepcopy(sensor_data)
    return None

def delete_sensor(sensor_id: int) -> bool:
    """Elimina un sensor"""
    for i, sensor in enumerate(memory_db["sensors"]):
        if sensor["sensor_id"] == sensor_id:
            del memory_db["sensors"][i]
            return True
    return False

def get_sensors_by_machine(machine_id: int) -> List[Dict[str, Any]]:
    """Obtiene todos los sensores asociados a una máquina"""
    return [s for s in memory_db["sensors"] if s.get("machine_id") == machine_id]

# --- Funciones CRUD para Datos de Vibración ---

def create_vibration_data(
    sensor_id: int,
    acceleration_x: float,
    acceleration_y: float,
    acceleration_z: float,
    severity: int = 0,
    custom_date: datetime = None
) -> Dict[str, Any]:
    """Crea un nuevo registro de datos de vibración"""
    data = {
        "data_id": id_counters["data_id"],
        "sensor_id": sensor_id,
        "date": (custom_date or datetime.now()).isoformat(),
        "acceleration_x": acceleration_x,
        "acceleration_y": acceleration_y,
        "acceleration_z": acceleration_z,
        "severity": severity,
        "magnitude": (acceleration_x**2 + acceleration_y**2 + acceleration_z**2)**0.5
    }
    id_counters["data_id"] += 1
    memory_db["vibration_data"].append(data)
    return copy.deepcopy(data)

def get_vibration_data(limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene los últimos registros de datos de vibración"""
    # Ordenar por fecha descendente
    sorted_data = sorted(memory_db["vibration_data"], 
                          key=lambda x: x["date"], 
                          reverse=True)
    return sorted_data[:limit]

def get_vibration_data_by_sensor(sensor_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene los últimos registros de datos de vibración para un sensor específico"""
    sensor_data = [d for d in memory_db["vibration_data"] if d["sensor_id"] == sensor_id]
    # Ordenar por fecha descendente
    sorted_data = sorted(sensor_data, 
                         key=lambda x: x["date"], 
                         reverse=True)
    return sorted_data[:limit]

def get_vibration_data_by_id(data_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un registro de datos de vibración por su ID"""
    for data in memory_db["vibration_data"]:
        if data["data_id"] == data_id:
            return copy.deepcopy(data)
    return None

# --- Funciones CRUD para Alertas ---

def create_alert(alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva alerta"""
    if "log_id" not in alert_data:
        alert_data["log_id"] = id_counters["log_id"]
        id_counters["log_id"] += 1
    if "timestamp" not in alert_data:
        alert_data["timestamp"] = datetime.now().isoformat()
    if "acknowledged" not in alert_data:
        alert_data["acknowledged"] = False
    
    memory_db["alerts"].append(alert_data)
    return copy.deepcopy(alert_data)

def get_alerts(
    sensor_id: Optional[int] = None,
    acknowledged: Optional[bool] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Obtiene alertas, opcionalmente filtradas por sensor_id y/o estado"""
    # Filtrar por sensor_id si se proporciona
    filtered_alerts = memory_db["alerts"]
    if sensor_id is not None:
        filtered_alerts = [a for a in filtered_alerts if a["sensor_id"] == sensor_id]
    
    # Filtrar por acknowledged si se proporciona
    if acknowledged is not None:
        filtered_alerts = [a for a in filtered_alerts if a.get("acknowledged") == acknowledged]
    
    # Ordenar por timestamp descendente
    sorted_alerts = sorted(filtered_alerts, 
                           key=lambda x: x["timestamp"], 
                           reverse=True)
    
    return sorted_alerts[:limit]

def get_alert_by_id(alert_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una alerta por su ID"""
    for alert in memory_db["alerts"]:
        if alert["log_id"] == alert_id:
            return copy.deepcopy(alert)
    return None

def acknowledge_alert(alert_id: int) -> bool:
    """Marca una alerta como reconocida"""
    for i, alert in enumerate(memory_db["alerts"]):
        if alert["log_id"] == alert_id:
            memory_db["alerts"][i]["acknowledged"] = True
            return True
    return False

# --- Funciones CRUD para Máquinas ---

def get_machines(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todas las máquinas"""
    return memory_db["machines"][skip:skip+limit]

def get_machine_by_id(machine_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una máquina por su ID"""
    for machine in memory_db["machines"]:
        if machine["machine_id"] == machine_id:
            return copy.deepcopy(machine)
    return None

def create_machine(machine_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea una nueva máquina"""
    machine_data["machine_id"] = id_counters["machine_id"]
    id_counters["machine_id"] += 1
    memory_db["machines"].append(machine_data)
    return copy.deepcopy(machine_data)

def update_machine(machine_id: int, machine_data: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza una máquina existente"""
    for i, machine in enumerate(memory_db["machines"]):
        if machine["machine_id"] == machine_id:
            machine_data["machine_id"] = machine_id  # Asegurar que el ID no cambie
            memory_db["machines"][i] = machine_data
            return copy.deepcopy(machine_data)
    return None

def delete_machine(machine_id: int) -> bool:
    """Elimina una máquina"""
    for i, machine in enumerate(memory_db["machines"]):
        if machine["machine_id"] == machine_id:
            del memory_db["machines"][i]
            return True
    return False

# --- Funciones CRUD para Modelos ---

def get_models(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todos los modelos"""
    return memory_db["models"][skip:skip+limit]

def get_model_by_id(model_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un modelo por su ID"""
    for model in memory_db["models"]:
        if model["model_id"] == model_id:
            return copy.deepcopy(model)
    return None

def create_model(model_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea un nuevo modelo"""
    model_data["model_id"] = id_counters["model_id"]
    id_counters["model_id"] += 1
    if "last_update" not in model_data:
        model_data["last_update"] = datetime.now().isoformat()
    memory_db["models"].append(model_data)
    return copy.deepcopy(model_data)

def update_model(model_id: int, model_data: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza un modelo existente"""
    for i, model in enumerate(memory_db["models"]):
        if model["model_id"] == model_id:
            model_data["model_id"] = model_id  # Asegurar que el ID no cambie
            memory_db["models"][i] = model_data
            return copy.deepcopy(model_data)
    return None

def delete_model(model_id: int) -> bool:
    """Elimina un modelo"""
    for i, model in enumerate(memory_db["models"]):
        if model["model_id"] == model_id:
            del memory_db["models"][i]
            return True
    return False

# Inicializar la base de datos en memoria con datos de ejemplo
initialize_memory_db() 