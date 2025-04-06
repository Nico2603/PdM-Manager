# app/crud.py
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.models import VibrationData, Sensor, Model, Machine, Alert, LimitConfig
from datetime import datetime
from typing import List, Optional, Dict, Any, Union

# ---------------------------------------------------------
# PdM-Manager - Sistema de Mantenimiento Predictivo
# Módulo CRUD: Operaciones de acceso a la base de datos
# ---------------------------------------------------------

# ======== CRUD para VibrationData ========

def create_vibration_data(
    db: Session, 
    sensor_id: int, 
    acceleration_x: float = None, 
    acceleration_y: float = None, 
    acceleration_z: float = None, 
    date: Optional[datetime] = None, 
    severity: int = 0,
    is_anomaly: int = 0
) -> VibrationData:
    """
    Inserta un nuevo registro de datos de vibración en la base de datos.
    
    Parámetros:
    - db: Sesión de base de datos
    - sensor_id: ID del sensor que generó los datos
    - acceleration_x/y/z: Valores de aceleración en cada eje
    - date: Fecha y hora de la medición (default: now())
    - severity: Nivel de severidad asignado (0: normal, 1: leve, 2: grave)
    - is_anomaly: Indicador de anomalía (0: normal, 1: anomalía)
    
    Retorna:
    - Objeto VibrationData creado y guardado
    
    IMPORTANTE: Esta función debe ser transaccional; si ocurre un error,
    asegúrate de hacer rollback() en el bloque try/except que la llama.
    """
    db_vibration = VibrationData(
        sensor_id=sensor_id,
        acceleration_x=acceleration_x,
        acceleration_y=acceleration_y,
        acceleration_z=acceleration_z,
        date=date or datetime.now(),
        severity=severity,
        is_anomaly=is_anomaly
    )
    db.add(db_vibration)
    db.commit()
    db.refresh(db_vibration)
    return db_vibration

def get_vibration_data(db: Session, sensor_id: int = None, limit: int = 100, 
                       skip: int = 0, start_date: datetime = None, end_date: datetime = None):
    """
    Obtiene datos de vibración filtrados por sensor_id y fechas.
    
    Esta función es clave para la API y la visualización de datos.
    Permite filtrar por varios criterios y paginar resultados.
    
    Args:
        db (Session): Sesión de base de datos
        sensor_id (int, optional): ID del sensor para filtrar. Por defecto None.
        limit (int, optional): Cantidad máxima de registros a devolver. Por defecto 100.
        skip (int, optional): Cantidad de registros a omitir (para paginación). Por defecto 0.
        start_date (datetime, optional): Fecha de inicio para filtrar. Por defecto None.
        end_date (datetime, optional): Fecha de fin para filtrar. Por defecto None.
        
    Returns:
        list: Lista de diccionarios con datos de vibración serializados
        
    NOTA IMPORTANTE: Esta función es compatible con dos estructuras de datos diferentes:
    1. En producción: VibrationData con campos date, acceleration_x/y/z, severity
    2. En pruebas: VibrationData con campos timestamp, value, axis
    """
    query = db.query(VibrationData)
    
    if sensor_id:
        query = query.filter(VibrationData.sensor_id == sensor_id)
    
    # Determinar qué campo de fecha usar según el modelo (compatible con pruebas y producción)
    date_field = VibrationData.date if hasattr(VibrationData, 'date') else VibrationData.timestamp
    
    if start_date:
        query = query.filter(date_field >= start_date)
    
    if end_date:
        query = query.filter(date_field <= end_date)
        
    # Ordenar por fecha descendente (más reciente primero)
    query = query.order_by(date_field.desc())
    
    # Aplicar paginación
    data = query.offset(skip).limit(limit).all()
    
    # Convertir a diccionarios para la serialización
    result = []
    for item in data:
        # Determinar qué campos están disponibles y crear un diccionario adecuado
        item_dict = {
            "data_id": item.data_id,
            "sensor_id": item.sensor_id
        }
        
        # Manejar campos de fecha según el modelo
        if hasattr(item, 'date'):
            item_dict["timestamp"] = item.date.isoformat() if item.date else None
        elif hasattr(item, 'timestamp'):
            item_dict["timestamp"] = item.timestamp.isoformat() if item.timestamp else None
        
        # Manejar campo de valor/aceleración según el modelo
        if hasattr(item, 'value'):
            item_dict["value"] = item.value
            item_dict["axis"] = item.axis
        elif hasattr(item, 'acceleration_x'):
            # Si el modelo tiene acceleration_x/y/z, necesitamos determinar qué eje usar
            # Por ahora, simplemente incluimos los tres
            item_dict["acceleration_x"] = item.acceleration_x
            item_dict["acceleration_y"] = item.acceleration_y
            item_dict["acceleration_z"] = item.acceleration_z
        
        # Incluir la severidad si está disponible
        if hasattr(item, 'severity'):
            item_dict["severity"] = item.severity
        
        result.append(item_dict)
        
    return result

def update_vibration_data(
    db: Session,
    data_id: int,
    update_data: Dict[str, Any]
) -> Optional[VibrationData]:
    """
    Actualiza un registro de datos de vibración existente.
    """
    db_vibration = db.query(VibrationData).filter(VibrationData.data_id == data_id).first()
    if not db_vibration:
        return None
    
    for key, value in update_data.items():
        setattr(db_vibration, key, value)
    
    db.commit()
    db.refresh(db_vibration)
    return db_vibration

def delete_vibration_data(
    db: Session,
    data_id: int
) -> bool:
    """
    Elimina un registro de datos de vibración.
    Retorna True si se eliminó correctamente, False si no se encontró.
    """
    db_vibration = db.query(VibrationData).filter(VibrationData.data_id == data_id).first()
    if not db_vibration:
        return False
    
    db.delete(db_vibration)
    db.commit()
    return True

# ======== CRUD para Sensor ========

def create_sensor(
    db: Session,
    name: str,
    description: Optional[str] = None,
    model_id: Optional[int] = None
) -> Sensor:
    """
    Crea un nuevo sensor en la base de datos.
    """
    db_sensor = Sensor(
        name=name,
        description=description,
        model_id=model_id
    )
    db.add(db_sensor)
    db.commit()
    db.refresh(db_sensor)
    return db_sensor

def get_sensors(
    db: Session,
    sensor_id: Optional[int] = None,
    model_id: Optional[int] = None,
    limit: int = 100,
    skip: int = 0
) -> Union[List[Sensor], Sensor]:
    """
    Obtiene sensores con filtros opcionales.
    
    Esta función es utilizada tanto para listar todos los sensores
    como para verificar la existencia de un sensor específico.
    
    Parámetros:
    - db: Sesión de base de datos
    - sensor_id: Para obtener un sensor específico (opcional)
    - model_id: Para filtrar por modelo (opcional)
    - limit/skip: Para paginación
    
    Retorna:
    - Si sensor_id es proporcionado: Un único objeto Sensor o None
    - Si no: Lista de objetos Sensor según filtros
    
    IMPORTANTE: La API depende de esta función para verificar la validez
    de los datos enviados por los sensores.
    """
    if sensor_id is not None:
        return db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()
    
    query = db.query(Sensor)
    
    if model_id is not None:
        query = query.filter(Sensor.model_id == model_id)
    
    return query.offset(skip).limit(limit).all()

def update_sensor(
    db: Session,
    sensor_id: int,
    update_data: Dict[str, Any]
) -> Optional[Sensor]:
    """
    Actualiza un sensor existente.
    """
    db_sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()
    if not db_sensor:
        return None
    
    for key, value in update_data.items():
        setattr(db_sensor, key, value)
    
    db.commit()
    db.refresh(db_sensor)
    return db_sensor

def delete_sensor(
    db: Session,
    sensor_id: int
) -> bool:
    """
    Elimina un sensor.
    Retorna True si se eliminó correctamente, False si no se encontró.
    """
    db_sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()
    if not db_sensor:
        return False
    
    db.delete(db_sensor)
    db.commit()
    return True

def update_sensor_last_status(
    db: Session,
    sensor_id: int,
    is_anomaly: bool = False,
    severity: int = 0,
    timestamp: datetime = None
) -> bool:
    """
    Actualiza el último estado registrado de un sensor.
    
    Esta función actualiza los campos last_status, last_severity y last_reading_time
    del sensor para reflejar su estado más reciente. Esto es útil para mostrar alertas 
    y estados en el dashboard sin tener que consultar la tabla de datos completa.
    
    Parámetros:
    - db: Sesión de base de datos
    - sensor_id: ID del sensor a actualizar
    - is_anomaly: Si el último registro fue una anomalía
    - severity: Nivel de severidad de la anomalía (0-3)
    - timestamp: Timestamp de la última lectura
    
    Retorna:
    - True si la actualización fue exitosa, False si no se encontró el sensor
    """
    # Obtener el sensor a actualizar
    sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()
    if not sensor:
        return False
    
    # Actualizar los campos si el sensor tiene estos atributos
    # Verificar cada campo antes de intentar actualizarlo para evitar errores
    if hasattr(sensor, 'last_status'):
        sensor.last_status = is_anomaly
    
    if hasattr(sensor, 'last_severity'):
        sensor.last_severity = severity
    
    if hasattr(sensor, 'last_reading_time') and timestamp:
        sensor.last_reading_time = timestamp
    
    try:
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False

# ======== CRUD para Model ========

def create_model(
    db: Session,
    name: Optional[str] = None,
    description: Optional[str] = None,
    route_h5: Optional[str] = None,
    route_pkl: Optional[str] = None
) -> Model:
    """
    Crea un nuevo modelo en la base de datos.
    """
    db_model = Model(
        name=name,
        description=description,
        route_h5=route_h5,
        route_pkl=route_pkl
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

def get_models(
    db: Session,
    model_id: Optional[int] = None,
    limit: int = 100,
    skip: int = 0
) -> Union[List[Model], Model]:
    """
    Obtiene modelos con filtros opcionales.
    Si se proporciona model_id, devuelve un único modelo.
    """
    if model_id is not None:
        return db.query(Model).filter(Model.model_id == model_id).first()
    
    return db.query(Model).offset(skip).limit(limit).all()

def update_model(
    db: Session,
    model_id: int,
    update_data: Dict[str, Any]
) -> Optional[Model]:
    """
    Actualiza un modelo existente.
    """
    db_model = db.query(Model).filter(Model.model_id == model_id).first()
    if not db_model:
        return None
    
    for key, value in update_data.items():
        setattr(db_model, key, value)
    
    db.commit()
    db.refresh(db_model)
    return db_model

def delete_model(
    db: Session,
    model_id: int
) -> bool:
    """
    Elimina un modelo.
    Retorna True si se eliminó correctamente, False si no se encontró.
    """
    db_model = db.query(Model).filter(Model.model_id == model_id).first()
    if not db_model:
        return False
    
    db.delete(db_model)
    db.commit()
    return True

# ======== CRUD para Machine ========

def create_machine(
    db: Session,
    name: str,
    description: Optional[str] = None,
    sensor_id: Optional[int] = None
) -> Machine:
    """
    Crea una nueva máquina en la base de datos.
    """
    db_machine = Machine(
        name=name,
        description=description,
        sensor_id=sensor_id
    )
    db.add(db_machine)
    db.commit()
    db.refresh(db_machine)
    return db_machine

def get_machines(
    db: Session,
    machine_id: Optional[int] = None,
    sensor_id: Optional[int] = None,
    limit: int = 100,
    skip: int = 0
) -> Union[List[Machine], Machine]:
    """
    Obtiene máquinas con filtros opcionales.
    Si se proporciona machine_id, devuelve una única máquina.
    """
    if machine_id is not None:
        return db.query(Machine).filter(Machine.machine_id == machine_id).first()
    
    query = db.query(Machine)
    
    if sensor_id is not None:
        query = query.filter(Machine.sensor_id == sensor_id)
    
    return query.offset(skip).limit(limit).all()

def update_machine(
    db: Session,
    machine_id: int,
    update_data: Dict[str, Any]
) -> Optional[Machine]:
    """
    Actualiza una máquina existente.
    """
    db_machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not db_machine:
        return None
    
    for key, value in update_data.items():
        setattr(db_machine, key, value)
    
    db.commit()
    db.refresh(db_machine)
    return db_machine

def delete_machine(
    db: Session,
    machine_id: int
) -> bool:
    """
    Elimina una máquina.
    Retorna True si se eliminó correctamente, False si no se encontró.
    """
    db_machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not db_machine:
        return False
    
    db.delete(db_machine)
    db.commit()
    return True

# ======== CRUD para Alert ========

def create_alert(
    db: Session,
    sensor_id: int,
    error_type: Optional[int] = None,
    data_id: Optional[int] = None,
    timestamp: Optional[datetime] = None
) -> Alert:
    """
    Crea una nueva alerta en la base de datos.
    
    Esta función se utiliza para registrar anomalías detectadas
    por el sistema de monitoreo y clasificación.
    
    Parámetros:
    - db: Sesión de base de datos
    - sensor_id: ID del sensor que generó la alerta
    - error_type: Tipo/nivel de error (0-3)
    - data_id: Referencia al registro de datos que generó la alerta
    - timestamp: Momento de la alerta (default: now())
    
    Retorna:
    - Objeto Alert creado y guardado
    
    IMPORTANTE: Las alertas nivel 3 deben recibir atención inmediata
    ya que indican posibles fallos críticos.
    """
    db_alert = Alert(
        sensor_id=sensor_id,
        error_type=error_type,
        data_id=data_id,
        timestamp=timestamp or datetime.now()
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert

def get_alerts(
    db: Session,
    log_id: Optional[int] = None,
    sensor_id: Optional[int] = None,
    error_type: Optional[int] = None,
    data_id: Optional[int] = None,
    limit: int = 100,
    skip: int = 0,
    sort_by: str = "timestamp",
    sort_desc: bool = True
) -> Union[List[Alert], Alert]:
    """
    Obtiene alertas con filtros opcionales.
    
    Función utilizada para consultar alertas históricas o activas,
    filtradas por diferentes criterios.
    
    Parámetros:
    - db: Sesión de base de datos
    - log_id: Para obtener una alerta específica
    - sensor_id/error_type/data_id: Filtros opcionales
    - limit/skip: Para paginación
    - sort_by/sort_desc: Para ordenamiento
    
    Retorna:
    - Si log_id es proporcionado: Una única alerta o None
    - Si no: Lista de alertas según filtros
    
    USO TÍPICO: Esta función alimenta el panel de alertas en el
    dashboard, mostrando las más recientes primero.
    """
    if log_id is not None:
        return db.query(Alert).filter(Alert.log_id == log_id).first()
    
    query = db.query(Alert)
    
    if sensor_id is not None:
        query = query.filter(Alert.sensor_id == sensor_id)
    
    if error_type is not None:
        query = query.filter(Alert.error_type == error_type)
    
    if data_id is not None:
        query = query.filter(Alert.data_id == data_id)
    
    # Ordenamiento
    order_column = getattr(Alert, sort_by, Alert.timestamp)
    if sort_desc:
        query = query.order_by(desc(order_column))
    else:
        query = query.order_by(asc(order_column))
    
    return query.offset(skip).limit(limit).all()

def update_alert(
    db: Session,
    log_id: int,
    update_data: Dict[str, Any]
) -> Optional[Alert]:
    """
    Actualiza una alerta existente.
    """
    db_alert = db.query(Alert).filter(Alert.log_id == log_id).first()
    if not db_alert:
        return None
    
    for key, value in update_data.items():
        setattr(db_alert, key, value)
    
    db.commit()
    db.refresh(db_alert)
    return db_alert

def delete_alert(
    db: Session,
    log_id: int
) -> bool:
    """
    Elimina una alerta.
    Retorna True si se eliminó correctamente, False si no se encontró.
    """
    db_alert = db.query(Alert).filter(Alert.log_id == log_id).first()
    if not db_alert:
        return False
    
    db.delete(db_alert)
    db.commit()
    return True

# ======== CRUD para LimitConfig ========

def create_limit_config(
    db: Session,
    config_data: Dict[str, Any]
) -> LimitConfig:
    """
    Crea una nueva configuración de límites en la base de datos.
    """
    db_limit_config = LimitConfig(**config_data)
    db.add(db_limit_config)
    db.commit()
    db.refresh(db_limit_config)
    return db_limit_config

def get_limit_configs(
    db: Session,
    limit_config_id: Optional[int] = None,
    limit: int = 100,
    skip: int = 0
) -> Union[List[LimitConfig], LimitConfig]:
    """
    Obtiene configuraciones de límites.
    Si se proporciona limit_config_id, devuelve una única configuración.
    """
    if limit_config_id is not None:
        return db.query(LimitConfig).filter(LimitConfig.limit_config_id == limit_config_id).first()
    
    return db.query(LimitConfig).offset(skip).limit(limit).all()

def get_latest_limit_config(
    db: Session
) -> Optional[LimitConfig]:
    """
    Obtiene la configuración de límites más reciente.
    
    Esta función es crítica para el sistema de clasificación
    ya que obtiene los umbrales actuales que determinan la
    severidad de las vibraciones.
    
    Parámetros:
    - db: Sesión de base de datos
    
    Retorna:
    - Objeto LimitConfig más reciente o None
    
    NOTA: Si esta función retorna None, el sistema debería
    usar los valores predeterminados para la clasificación.
    """
    return db.query(LimitConfig).order_by(LimitConfig.update_limits.desc()).first()

def update_limit_config(
    db: Session,
    limit_config_id: int,
    update_data: Dict[str, Any]
) -> Optional[LimitConfig]:
    """
    Actualiza una configuración de límites existente.
    """
    db_limit_config = db.query(LimitConfig).filter(LimitConfig.limit_config_id == limit_config_id).first()
    if not db_limit_config:
        return None
    
    for key, value in update_data.items():
        setattr(db_limit_config, key, value)
    
    # Actualizar timestamp
    db_limit_config.update_limits = datetime.now()
    
    db.commit()
    db.refresh(db_limit_config)
    return db_limit_config

def delete_limit_config(
    db: Session,
    limit_config_id: int
) -> bool:
    """
    Elimina una configuración de límites.
    Retorna True si se eliminó correctamente, False si no se encontró.
    """
    db_limit_config = db.query(LimitConfig).filter(LimitConfig.limit_config_id == limit_config_id).first()
    if not db_limit_config:
        return False
    
    db.delete(db_limit_config)
    db.commit()
    return True
