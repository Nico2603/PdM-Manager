# app/crud.py

from sqlalchemy.orm import Session
from datetime import datetime
from app.models import Sensor, VibrationData, Machine, Model, Alert, LimitConfig
from typing import List, Dict, Any, Optional, Type
from app.logger import log_warning
from app.serializers import remove_sa_instance as serializer_remove_sa_instance
from app.database import cached_query, invalidate_cache

def remove_sa_instance(obj_dict):
    """
    Elimina el atributo _sa_instance_state de un diccionario
    
    DEPRECATED: Usar app.serializers.remove_sa_instance en su lugar
    """
    log_warning("Función remove_sa_instance en crud.py está obsoleta. Usar app.serializers.remove_sa_instance")
    return serializer_remove_sa_instance(obj_dict)

# --- Funciones CRUD genéricas ---

@cached_query(ttl=30)
def get_items(db: Session, model_class: Type, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene una lista de elementos de un modelo específico"""
    items = db.query(model_class).offset(skip).limit(limit).all()
    return [serializer_remove_sa_instance(item.__dict__) for item in items]

def get_item_by_id(db: Session, model_class: Type, id_field, id_value: int) -> Optional[Any]:
    """Obtiene un elemento por su ID"""
    return db.query(model_class).filter(id_field == id_value).first()

@cached_query(ttl=30)
def get_item_dict(db: Session, model_class: Type, id_field, id_value: int) -> Optional[Dict[str, Any]]:
    """Obtiene un elemento por su ID (como diccionario)"""
    item = get_item_by_id(db, model_class, id_field, id_value)
    if item:
        return serializer_remove_sa_instance(item.__dict__)
    return None

def create_item(db: Session, item: Any) -> Dict[str, Any]:
    """Crea un nuevo elemento"""
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Invalidar caché relacionada con este tipo de elemento
    model_name = item.__class__.__name__.lower()
    invalidate_cache(f"get_items_{model_name}")
    invalidate_cache(f"get_item_dict_{model_name}")
    
    return serializer_remove_sa_instance(item.__dict__)

def update_item(db: Session, item: Any) -> Dict[str, Any]:
    """Actualiza un elemento existente"""
    db.commit()
    db.refresh(item)
    
    # Invalidar caché relacionada con este tipo de elemento
    model_name = item.__class__.__name__.lower()
    invalidate_cache(f"get_items_{model_name}")
    invalidate_cache(f"get_item_dict_{model_name}")
    
    return serializer_remove_sa_instance(item.__dict__)

def delete_item(db: Session, model_class: Type, id_field, id_value: int) -> bool:
    """Elimina un elemento"""
    item = get_item_by_id(db, model_class, id_field, id_value)
    if item:
        db.delete(item)
        db.commit()
        
        # Invalidar caché relacionada con este tipo de elemento
        model_name = model_class.__name__.lower()
        invalidate_cache(f"get_items_{model_name}")
        invalidate_cache(f"get_item_dict_{model_name}")
        
        return True
    return False

# --- Funciones CRUD para Sensores ---

def get_sensors(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todos los sensores"""
    return get_items(db, Sensor, skip, limit)

def get_sensor_by_id(db: Session, sensor_id: int) -> Optional[Sensor]:
    """Obtiene un sensor por su ID"""
    return get_item_by_id(db, Sensor, Sensor.sensor_id, sensor_id)

def get_sensor_by_name(db: Session, sensor_name: str) -> Optional[Sensor]:
    """Obtiene un sensor por su nombre"""
    return db.query(Sensor).filter(Sensor.name == sensor_name).first()

def get_sensor(db: Session, sensor_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un sensor por su ID (como diccionario)"""
    return get_item_dict(db, Sensor, Sensor.sensor_id, sensor_id)

def create_sensor(db: Session, sensor: Sensor) -> Dict[str, Any]:
    """Crea un nuevo sensor"""
    return create_item(db, sensor)

def update_sensor(db: Session, sensor: Sensor) -> Dict[str, Any]:
    """Actualiza un sensor existente"""
    return update_item(db, sensor)

def delete_sensor(db: Session, sensor_id: int) -> bool:
    """Elimina un sensor"""
    return delete_item(db, Sensor, Sensor.sensor_id, sensor_id)

def get_machines_by_sensor(db: Session, sensor_id: int) -> List[Dict[str, Any]]:
    """Obtiene todas las máquinas asociadas a un sensor"""
    machines = db.query(Machine).filter(Machine.sensor_id == sensor_id).all()
    return [serializer_remove_sa_instance(machine.__dict__) for machine in machines]

# --- Funciones CRUD para Datos de Vibración ---

def create_vibration_data(
    db: Session,
    sensor_id: int,
    acceleration_x: float,
    acceleration_y: float,
    acceleration_z: float,
    severity: int = 0,
    custom_date: datetime = None
) -> VibrationData:
    """Crea un nuevo registro de datos de vibración"""
    
    db_data = VibrationData(
        sensor_id=sensor_id,
        acceleration_x=acceleration_x,
        acceleration_y=acceleration_y,
        acceleration_z=acceleration_z,
        severity=severity
    )
    
    if custom_date:
        db_data.date = custom_date
    
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data

def create_vibration_data_with_date(
    db: Session,
    sensor_id: int,
    acceleration_x: float,
    acceleration_y: float,
    acceleration_z: float,
    severity: int = 0,
    date: datetime = None
) -> VibrationData:
    """
    Crea un nuevo registro de datos de vibración con fecha específica
    Si no se proporciona fecha, se usa la fecha actual
    """
    # Verificar si el sensor existe
    sensor = get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise ValueError(f"El sensor con ID {sensor_id} no existe")
    
    # Crear objeto de datos
    db_data = VibrationData(
        sensor_id=sensor_id,
        acceleration_x=acceleration_x,
        acceleration_y=acceleration_y,
        acceleration_z=acceleration_z,
        severity=severity
    )
    
    # Establecer fecha personalizada si se proporcionó
    if date:
        db_data.date = date
    
    # Guardar en la base de datos
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data

def get_vibration_data(db: Session, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene los últimos registros de datos de vibración"""
    data = db.query(VibrationData).order_by(VibrationData.date.desc()).limit(limit).all()
    return [serializer_remove_sa_instance(item.__dict__) for item in data]

def get_vibration_data_by_sensor(db: Session, sensor_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene los últimos registros de datos de vibración para un sensor específico"""
    data = db.query(VibrationData).filter(VibrationData.sensor_id == sensor_id).order_by(VibrationData.date.desc()).limit(limit).all()
    return [serializer_remove_sa_instance(item.__dict__) for item in data]

def get_vibration_data_by_id(db: Session, data_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un registro de datos de vibración por su ID"""
    data = db.query(VibrationData).filter(VibrationData.data_id == data_id).first()
    if data:
        return serializer_remove_sa_instance(data.__dict__)
    return None

def get_vibration_data_by_sensor_and_dates(
    db: Session,
    sensor_id: int,
    start_date: datetime,
    end_date: datetime
) -> List[VibrationData]:
    """Obtiene datos de vibración para un sensor y rango de fechas"""
    return db.query(VibrationData).filter(
        VibrationData.sensor_id == sensor_id,
        VibrationData.date >= start_date,
        VibrationData.date <= end_date
    ).order_by(VibrationData.date).all()

# --- Funciones CRUD para Alertas ---

def create_alert(db: Session, alert: Alert) -> Alert:
    """Crea una nueva alerta"""
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

def get_alerts(
    db: Session,
    sensor_id: Optional[int] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Obtiene alertas, opcionalmente filtradas por sensor_id"""
    query = db.query(Alert)
    
    if sensor_id is not None:
        query = query.filter(Alert.sensor_id == sensor_id)
    
    alerts = query.order_by(Alert.timestamp.desc()).limit(limit).all()
    return [serializer_remove_sa_instance(alert.__dict__) for alert in alerts]

def get_alert_by_id(db: Session, alert_id: int) -> Optional[Alert]:
    """Obtiene una alerta por su ID"""
    return db.query(Alert).filter(Alert.log_id == alert_id).first()

def get_alerts_by_sensor_and_dates(
    db: Session,
    sensor_id: int,
    start_date: datetime,
    end_date: datetime
) -> List[Alert]:
    """Obtiene alertas para un sensor y rango de fechas"""
    return db.query(Alert).filter(
        Alert.sensor_id == sensor_id,
        Alert.timestamp >= start_date,
        Alert.timestamp <= end_date
    ).order_by(Alert.timestamp).all()

# --- Funciones CRUD para Máquinas ---

def get_machines(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todas las máquinas"""
    return get_items(db, Machine, skip, limit)

def get_machine_by_id(db: Session, machine_id: int) -> Optional[Machine]:
    """Obtiene una máquina por su ID"""
    return get_item_by_id(db, Machine, Machine.machine_id, machine_id)

def get_machine_by_sensor_id(db: Session, sensor_id: int) -> Optional[Machine]:
    """Obtiene una máquina asociada a un sensor específico"""
    return db.query(Machine).filter(Machine.sensor_id == sensor_id).first()

def get_machines_with_status(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene las máquinas con información de estado"""
    machines = get_machines(db, skip, limit)
    result = []
    
    for machine in machines:
        # Obtener el sensor asociado a esta máquina
        sensor = db.query(Sensor).filter(Sensor.sensor_id == machine["sensor_id"]).first()
        
        # Inicializar contadores de alerta
        level1_count = 0
        level2_count = 0
        level3_count = 0
        
        if sensor:
            # Contar alertas por tipo de error
            level1_count = db.query(Alert).filter(
                Alert.sensor_id == sensor.sensor_id,
                Alert.error_type == 1
            ).count()
            
            level2_count = db.query(Alert).filter(
                Alert.sensor_id == sensor.sensor_id,
                Alert.error_type == 2
            ).count()
            
            level3_count = db.query(Alert).filter(
                Alert.sensor_id == sensor.sensor_id,
                Alert.error_type == 3
            ).count()
        
        # Crear diccionario con datos de la máquina y alertas
        machine_dict = machine.copy()
        machine_dict["alerts"] = {
            "level1": level1_count,
            "level2": level2_count,
            "level3": level3_count,
            "total": level1_count + level2_count + level3_count
        }
        
        result.append(machine_dict)
    
    return result

def create_machine(db: Session, machine: Machine) -> Dict[str, Any]:
    """Crea una nueva máquina"""
    return create_item(db, machine)

def update_machine(db: Session, machine: Machine) -> Dict[str, Any]:
    """Actualiza una máquina existente"""
    return update_item(db, machine)

def delete_machine(db: Session, machine_id: int) -> bool:
    """Elimina una máquina"""
    return delete_item(db, Machine, Machine.machine_id, machine_id)

# --- Funciones CRUD para Modelos ---

def get_models(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todos los modelos"""
    return get_items(db, Model, skip, limit)

def get_model_by_id(db: Session, model_id: int) -> Optional[Model]:
    """Obtiene un modelo por su ID"""
    return get_item_by_id(db, Model, Model.model_id, model_id)

def create_model(db: Session, model: Model) -> Dict[str, Any]:
    """Crea un nuevo modelo"""
    return create_item(db, model)

def update_model(db: Session, model: Model) -> Dict[str, Any]:
    """Actualiza un modelo existente"""
    return update_item(db, model)

def delete_model(db: Session, model_id: int) -> bool:
    """Elimina un modelo"""
    return delete_item(db, Model, Model.model_id, model_id)

# --- Funciones adicionales para la vista unificada ---

def get_alert(db: Session, alert_id: int) -> Optional[Alert]:
    """Obtiene una alerta por su ID"""
    return db.query(Alert).filter(Alert.log_id == alert_id).first()

def get_alert_counts(db: Session, sensor_id: Optional[int] = None) -> Dict[str, int]:
    """Obtiene el conteo de alertas por tipo de error"""
    query = db.query(Alert)
    
    if sensor_id is not None:
        query = query.filter(Alert.sensor_id == sensor_id)
    
    level1_count = query.filter(Alert.error_type == 1).count()
    level2_count = query.filter(Alert.error_type == 2).count()
    level3_count = query.filter(Alert.error_type == 3).count()
    
    return {
        "level1": level1_count,
        "level2": level2_count,
        "level3": level3_count,
        "total": level1_count + level2_count + level3_count
    }

# --- Funciones CRUD para Límites de Aceleración ---

def get_limit_config(db: Session) -> Optional[LimitConfig]:
    """Obtiene la configuración de límites o None si no existe"""
    return db.query(LimitConfig).first()

def create_limit_config(db: Session, limit_config: LimitConfig) -> LimitConfig:
    """Crea una nueva configuración de límites"""
    db.add(limit_config)
    db.commit()
    db.refresh(limit_config)
    return limit_config

def update_limit_config(db: Session, limit_config: LimitConfig) -> LimitConfig:
    """Actualiza una configuración de límites existente"""
    db.commit()
    db.refresh(limit_config)
    return limit_config

def get_or_create_limit_config(db: Session) -> LimitConfig:
    """Obtiene la configuración actual de límites o crea una con valores por defecto"""
    config = get_limit_config(db)
    if not config:
        # Crear configuración con valores por defecto
        config = LimitConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def delete_limit_config(db: Session) -> bool:
    """Elimina la configuración de límites"""
    config = get_limit_config(db)
    if config:
        db.delete(config)
        db.commit()
        return True
    return False
