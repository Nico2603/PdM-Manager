# app/crud.py
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.models import VibrationData, Sensor, Model, Machine, Alert, LimitConfig, SystemConfig
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

def _validate_limits(limit_data: Dict[str, float]) -> bool:
    """
    Valida que los límites sean coherentes (los inferiores deben ser menores que los superiores)
    
    Args:
        limit_data (Dict[str, float]): Diccionario con los límites a validar
        
    Returns:
        bool: True si los límites son coherentes, False en caso contrario
        
    Raises:
        ValueError: Si los límites no son coherentes
    """
    # Validar que los límites inferiores sean menores que los superiores
    for axis in ['x', 'y', 'z']:
        for level in [2, 3]:
            inf_key = f"{axis}_{level}inf"
            sup_key = f"{axis}_{level}sup"
            
            if inf_key in limit_data and sup_key in limit_data:
                if limit_data[inf_key] >= limit_data[sup_key]:
                    raise ValueError(f"El límite {inf_key} debe ser menor que {sup_key}")
    
    return True

def create_limit_config(
    db: Session, 
    limit_data: Dict[str, float]
) -> LimitConfig:
    """
    Crea una nueva configuración de límites
    
    Args:
        db (Session): Sesión de base de datos activa
        limit_data (Dict[str, float]): Datos de los nuevos límites
        
    Returns:
        LimitConfig: Objeto creado en la base de datos
    """
    # Validar los límites
    _validate_limits(limit_data)
    
    # Crear nueva configuración
    new_limit = LimitConfig(**limit_data)
    db.add(new_limit)
    db.commit()
    db.refresh(new_limit)
    
    return new_limit

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

# ======== CRUD para SystemConfig ========

def get_system_config(
    db: Session
) -> SystemConfig:
    """
    Obtiene la configuración del sistema.
    Si no existe, la crea con valores predeterminados.
    """
    config = db.query(SystemConfig).first()
    if not config:
        # Crear configuración por defecto
        config = SystemConfig(is_configured=0)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def update_system_config(
    db: Session,
    is_configured: bool = None,
    active_model_id: int = None
) -> SystemConfig:
    """
    Actualiza la configuración del sistema.
    """
    config = get_system_config(db)
    
    if is_configured is not None:
        config.is_configured = 1 if is_configured else 0
    
    if active_model_id is not None:
        config.active_model_id = active_model_id
    
    config.last_update = datetime.now()
    
    db.commit()
    db.refresh(config)
    return config

# ======== Funciones de configuración del sistema ========

def get_system_configuration(
    db: Session
) -> Dict[str, Any]:
    """
    Obtiene la configuración completa del sistema:
    - Modelo (ruta h5, ruta pkl)
    - Límites de vibración
    - Sensores
    - Máquinas
    
    Retorna:
    - Un diccionario con toda la configuración del sistema
    """
    # Obtener la configuración del sistema
    system_config = get_system_config(db)
    
    # Obtener el modelo activo configurado
    model = None
    if system_config.active_model_id:
        model = db.query(Model).filter(Model.model_id == system_config.active_model_id).first()
    else:
        # Si no hay modelo activo, obtener el primer modelo disponible
        model = db.query(Model).first()
        
        # Si existe un modelo, establecerlo como activo
        if model:
            system_config.active_model_id = model.model_id
            db.commit()
    
    # Obtener la configuración de límites más reciente
    limit_config = get_latest_limit_config(db)
    
    # Obtener todos los sensores
    sensors = db.query(Sensor).all()
    
    # Obtener todas las máquinas
    machines = db.query(Machine).all()
    
    # Determinar si el sistema está configurado (desde la BD)
    is_configured = bool(system_config.is_configured)
    
    # Si el sistema no está marcado como configurado pero tiene todos los requisitos,
    # actualizamos su estado
    if not is_configured and (
        model is not None and 
        model.route_h5 is not None and 
        model.route_pkl is not None and
        limit_config is not None
    ):
        system_config.is_configured = 1
        system_config.last_update = datetime.now()
        db.commit()
        is_configured = True
    
    return {
        "model": model,
        "limit_config": limit_config,
        "sensors": sensors,
        "machines": machines,
        "is_configured": is_configured
    }

def update_system_configuration(
    db: Session,
    config_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Actualiza la configuración del sistema según el diccionario proporcionado.
    
    Este método puede:
    1. Actualizar o crear un modelo
    2. Actualizar o crear configuración de límites
    3. Actualizar sensores
    4. Actualizar máquinas
    
    Parámetros:
    - db: Sesión de base de datos
    - config_data: Diccionario con datos de configuración
    
    Retorna:
    - Un diccionario con el estado de la actualización
    """
    try:
        model_id = None
        
        # Actualizar/crear modelo
        if "model" in config_data and config_data["model"]:
            model_data = config_data["model"]
            
            # Verificar si ya existe un modelo
            if "model_id" in model_data and model_data["model_id"]:
                # Actualizar modelo existente
                model = update_model(db, model_data["model_id"], model_data)
                model_id = model.model_id if model else None
            else:
                # Crear nuevo modelo
                model = create_model(
                    db, 
                    name=model_data.get("name"),
                    description=model_data.get("description"),
                    route_h5=model_data.get("route_h5"),
                    route_pkl=model_data.get("route_pkl")
                )
                model_id = model.model_id if model else None
        
        # Actualizar configuración de límites
        if "limit_config" in config_data and config_data["limit_config"]:
            limit_data = config_data["limit_config"]
            
            # Siempre crear una nueva configuración de límites (para mantener historial)
            create_limit_config(db, limit_data)
        
        # Actualizar sensores
        if "sensors" in config_data and config_data["sensors"]:
            for sensor_data in config_data["sensors"]:
                if "sensor_id" in sensor_data and sensor_data["sensor_id"]:
                    # Actualizar sensor existente
                    update_sensor(db, sensor_data["sensor_id"], sensor_data)
                else:
                    # Crear nuevo sensor
                    create_sensor(
                        db,
                        name=sensor_data.get("name", "Sensor sin nombre"),
                        description=sensor_data.get("description"),
                        model_id=sensor_data.get("model_id")
                    )
        
        # Actualizar máquinas
        if "machines" in config_data and config_data["machines"]:
            for machine_data in config_data["machines"]:
                if "machine_id" in machine_data and machine_data["machine_id"]:
                    # Actualizar máquina existente
                    update_machine(db, machine_data["machine_id"], machine_data)
                else:
                    # Crear nueva máquina
                    create_machine(
                        db,
                        name=machine_data.get("name", "Máquina sin nombre"),
                        description=machine_data.get("description"),
                        sensor_id=machine_data.get("sensor_id")
                    )
        
        # Actualizar estado de configuración del sistema
        is_configured = config_data.get("is_configured")
        if is_configured is not None or model_id is not None:
            update_system_config(db, is_configured=is_configured, active_model_id=model_id)
        
        # Obtener la configuración actualizada
        return get_system_configuration(db)
    
    except Exception as e:
        # Registrar el error pero no detener la ejecución
        print(f"Error al actualizar la configuración del sistema: {str(e)}")
        # Re-lanzar la excepción para manejo en el nivel superior
        raise

# ======== Funciones CRUD para configuración del sistema ========

def get_config(
    db: Session
) -> Dict[str, Any]:
    """
    Obtiene la configuración actual del sistema, combinando información de las tablas
    system_config y limit_config, además de información del modelo activo si está disponible.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        Dict[str, Any]: Diccionario con la configuración del sistema
    """
    # Obtener la configuración del sistema
    system_config = get_system_config(db)
    
    # Obtener la configuración de límites más reciente
    limit_config = get_latest_limit_config(db)
    
    # Preparar la respuesta
    config = {
        "system_config": {
            "is_configured": system_config.is_configured,
            "active_model_id": system_config.active_model_id,
            "last_update": system_config.last_update.isoformat() if system_config.last_update else None
        }
    }
    
    # Obtener información del modelo activo (si existe)
    model_info = None
    if system_config.active_model_id:
        model = db.query(Model).filter(Model.model_id == system_config.active_model_id).first()
        if model:
            model_info = {
                "model_id": model.model_id,
                "route_h5": model.route_h5,
                "route_pkl": model.route_pkl,
                "name": model.name,
                "description": model.description
            }
    
    config["model_info"] = model_info
    
    # Agregar información de límites si existe
    if limit_config:
        config["limit_config"] = {
            "x_2inf": limit_config.x_2inf,
            "x_2sup": limit_config.x_2sup,
            "x_3inf": limit_config.x_3inf,
            "x_3sup": limit_config.x_3sup,
            "y_2inf": limit_config.y_2inf,
            "y_2sup": limit_config.y_2sup,
            "y_3inf": limit_config.y_3inf,
            "y_3sup": limit_config.y_3sup,
            "z_2inf": limit_config.z_2inf,
            "z_2sup": limit_config.z_2sup,
            "z_3inf": limit_config.z_3inf,
            "z_3sup": limit_config.z_3sup,
            "update_limits": limit_config.update_limits.isoformat() if limit_config.update_limits else None
        }
    
    return config

def update_config(
    db: Session, 
    config_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Actualiza la configuración del sistema según el diccionario proporcionado.
    
    El proceso de actualización sigue este orden:
    1. Actualiza o crea un modelo (si se proporcionan datos del modelo)
    2. Actualiza los límites de vibración (si se proporcionan)
    3. Actualiza o crea un sensor (si se proporciona información)
    4. Actualiza o crea una máquina (si se proporciona información)
    5. Actualiza la configuración del sistema (is_configured, active_model_id)
    
    Args:
        db (Session): Sesión de base de datos activa
        config_data (Dict[str, Any]): Datos de configuración
        
    Returns:
        Dict[str, Any]: Configuración actualizada
        
    Raises:
        ValueError: Si los datos no son válidos
        Exception: Si ocurre un error durante la actualización
    """
    try:
        # Variable para almacenar el ID del modelo (si se crea o actualiza)
        model_id = None
        
        # 1. Procesar datos del modelo
        if "route_h5" in config_data or "route_pkl" in config_data:
            # Obtener configuración del sistema
            system_config = get_system_config(db)
            
            # Verificar si hay un modelo activo
            if system_config.active_model_id:
                # Actualizar modelo existente
                model = db.query(Model).filter(Model.model_id == system_config.active_model_id).first()
                if model:
                    # Actualizar campos que vengan en config_data
                    for field in ["route_h5", "route_pkl", "name", "description"]:
                        if field in config_data and config_data[field] is not None:
                            # Adaptar nombres de campos que puedan ser diferentes
                            model_field = field
                            if field == "name" and "model_name" in config_data:
                                model_field = "name"
                                field = "model_name"
                            elif field == "description" and "model_description" in config_data:
                                model_field = "description"
                                field = "model_description"
                            
                            setattr(model, model_field, config_data[field])
                    
                    db.commit()
                    model_id = model.model_id
                else:
                    # Crear un nuevo modelo
                    model_data = {}
                    for field in ["route_h5", "route_pkl"]:
                        if field in config_data and config_data[field] is not None:
                            model_data[field] = config_data[field]
                    
                    # Manejar campos que pueden tener nombres diferentes
                    if "model_name" in config_data and config_data["model_name"] is not None:
                        model_data["name"] = config_data["model_name"]
                    elif "name" in config_data and config_data["name"] is not None:
                        model_data["name"] = config_data["name"]
                    
                    if "model_description" in config_data and config_data["model_description"] is not None:
                        model_data["description"] = config_data["model_description"]
                    elif "description" in config_data and config_data["description"] is not None:
                        model_data["description"] = config_data["description"]
                    
                    # Crear el modelo
                    if "route_h5" in model_data or "route_pkl" in model_data:
                        model = Model(**model_data)
                        db.add(model)
                        db.flush()
                        model_id = model.model_id
            else:
                # No hay modelo activo, crear uno nuevo
                model_data = {}
                for field in ["route_h5", "route_pkl"]:
                    if field in config_data and config_data[field] is not None:
                        model_data[field] = config_data[field]
                
                # Manejar campos que pueden tener nombres diferentes
                if "model_name" in config_data and config_data["model_name"] is not None:
                    model_data["name"] = config_data["model_name"]
                elif "name" in config_data and config_data["name"] is not None:
                    model_data["name"] = config_data["name"]
                
                if "model_description" in config_data and config_data["model_description"] is not None:
                    model_data["description"] = config_data["model_description"]
                elif "description" in config_data and config_data["description"] is not None:
                    model_data["description"] = config_data["description"]
                
                # Crear el modelo
                if "route_h5" in model_data or "route_pkl" in model_data:
                    model = Model(**model_data)
                    db.add(model)
                    db.flush()
                    model_id = model.model_id
        
        # 2. Procesar límites de vibración
        limit_data = {}
        for field in ["x_2inf", "x_2sup", "x_3inf", "x_3sup", 
                     "y_2inf", "y_2sup", "y_3inf", "y_3sup", 
                     "z_2inf", "z_2sup", "z_3inf", "z_3sup"]:
            if field in config_data and config_data[field] is not None:
                limit_data[field] = config_data[field]
        
        # Validar y crear nueva configuración de límites si hay datos
        if limit_data:
            # Validar límites
            _validate_limits(limit_data)
            
            # Siempre crear una nueva entrada para mantener historial
            new_limit = LimitConfig(**limit_data)
            db.add(new_limit)
            db.flush()
        
        # 3. Procesar información del sensor (si existe)
        sensor_id = None
        if "sensor_info" in config_data and config_data["sensor_info"]:
            sensor_info = config_data["sensor_info"]
            
            if "sensor_id" in sensor_info and sensor_info["sensor_id"]:
                # Actualizar sensor existente
                sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_info["sensor_id"]).first()
                if sensor:
                    for key, value in sensor_info.items():
                        if key != "sensor_id" and value is not None:
                            setattr(sensor, key, value)
                    db.flush()
                    sensor_id = sensor.sensor_id
            else:
                # Crear nuevo sensor
                sensor_data = {k: v for k, v in sensor_info.items() if v is not None}
                if model_id and "model_id" not in sensor_data:
                    sensor_data["model_id"] = model_id
                
                if "name" in sensor_data:
                    new_sensor = Sensor(**sensor_data)
                    db.add(new_sensor)
                    db.flush()
                    sensor_id = new_sensor.sensor_id
        
        # 4. Procesar información de la máquina (si existe)
        if "machine_info" in config_data and config_data["machine_info"]:
            machine_info = config_data["machine_info"]
            
            if "machine_id" in machine_info and machine_info["machine_id"]:
                # Actualizar máquina existente
                machine = db.query(Machine).filter(Machine.machine_id == machine_info["machine_id"]).first()
                if machine:
                    for key, value in machine_info.items():
                        if key != "machine_id" and value is not None:
                            setattr(machine, key, value)
                    db.flush()
            else:
                # Crear nueva máquina
                machine_data = {k: v for k, v in machine_info.items() if v is not None}
                if sensor_id and "sensor_id" not in machine_data:
                    machine_data["sensor_id"] = sensor_id
                
                if "name" in machine_data:
                    new_machine = Machine(**machine_data)
                    db.add(new_machine)
                    db.flush()
        
        # 5. Actualizar configuración del sistema
        system_config = get_system_config(db)
        
        # Actualizar estado de configuración
        system_config.is_configured = 1
        system_config.last_update = datetime.now()
        
        # Actualizar modelo activo si se creó o actualizó
        if model_id:
            system_config.active_model_id = model_id
        
        # Guardar cambios
        db.commit()
        
        # Retornar configuración actualizada
        return get_config(db)
    
    except ValueError as ve:
        # Hacer rollback para revertir cambios parciales
        db.rollback()
        raise ValueError(f"Error de validación: {str(ve)}")
    
    except Exception as e:
        # Hacer rollback para revertir cambios parciales
        db.rollback()
        raise Exception(f"Error al actualizar la configuración: {str(e)}")
