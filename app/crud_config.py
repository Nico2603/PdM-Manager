# app/crud_config.py
from sqlalchemy.orm import Session
from app.models import SystemConfig, Model, LimitConfig, Sensor, Machine
from datetime import datetime
from typing import Dict, Any, Optional, List, Union

def get_system_config(db: Session) -> SystemConfig:
    """
    Obtiene la configuración global del sistema.
    Si no existe, crea una nueva entrada con valores predeterminados.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        SystemConfig: Objeto de configuración del sistema
    """
    # Buscar configuración existente
    config = db.query(SystemConfig).first()
    
    # Si no existe, crear una nueva
    if not config:
        config = SystemConfig(
            is_configured=0,
            last_update=datetime.now(),
            active_model_id=None
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    
    return config

def update_system_config(db: Session, is_configured: Optional[int] = None, 
                         active_model_id: Optional[int] = None) -> SystemConfig:
    """
    Actualiza la configuración global del sistema.
    
    Args:
        db (Session): Sesión de base de datos activa
        is_configured (Optional[int]): Estado de configuración (0=no, 1=sí)
        active_model_id (Optional[int]): ID del modelo activo
        
    Returns:
        SystemConfig: Objeto de configuración actualizado
    """
    # Obtener configuración actual
    config = get_system_config(db)
    
    # Actualizar campos si se proporcionan valores
    if is_configured is not None:
        config.is_configured = is_configured
    
    if active_model_id is not None:
        config.active_model_id = active_model_id
    
    # Actualizar timestamp
    config.last_update = datetime.now()
    
    db.commit()
    db.refresh(config)
    return config

def get_latest_limit_config(db: Session) -> Optional[LimitConfig]:
    """
    Obtiene la configuración más reciente de límites de alerta.
    Si no existe, crea una nueva con valores predeterminados.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        Optional[LimitConfig]: Objeto de configuración de límites o None
    """
    # Buscar la configuración más reciente por ID (asumiendo que IDs más altos son más recientes)
    config = db.query(LimitConfig).order_by(LimitConfig.limit_config_id.desc()).first()
    
    # Si no existe, crear una nueva con valores predeterminados
    if not config:
        config = LimitConfig(
            # Valores predeterminados según especificación
            x_2inf=-2.36, x_2sup=2.18, x_3inf=-3.5, x_3sup=3.32,
            y_2inf=7.18, y_2sup=12.09, y_3inf=5.95, y_3sup=13.32,
            z_2inf=-2.39, z_2sup=1.11, z_3inf=-3.26, z_3sup=1.98,
            update_limits=datetime.now()
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    
    return config

def create_or_update_limit_config(db: Session, limit_data: Dict[str, float]) -> LimitConfig:
    """
    Crea una nueva entrada en la tabla de configuración de límites.
    
    Args:
        db (Session): Sesión de base de datos activa
        limit_data (Dict[str, float]): Datos de límites
        
    Returns:
        LimitConfig: Objeto de configuración de límites creado
        
    Raises:
        ValueError: Si algún límite no es válido
    """
    # Validar límites
    if not validate_limits(limit_data):
        raise ValueError("Los límites proporcionados no son válidos")
    
    # Obtener valores actuales para cualquier límite no proporcionado
    current_config = get_latest_limit_config(db)
    for field in [
        "x_2inf", "x_2sup", "x_3inf", "x_3sup",
        "y_2inf", "y_2sup", "y_3inf", "y_3sup",
        "z_2inf", "z_2sup", "z_3inf", "z_3sup"
    ]:
        if field not in limit_data or limit_data[field] is None:
            limit_data[field] = getattr(current_config, field)
    
    # Crear nueva configuración
    limit_data["update_limits"] = datetime.now()
    new_config = LimitConfig(**limit_data)
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    
    return new_config

def validate_limits(limit_data: Dict[str, float]) -> bool:
    """
    Valida que los límites proporcionados sean coherentes.
    
    Args:
        limit_data (Dict[str, float]): Datos de límites a validar
        
    Returns:
        bool: True si los límites son válidos, False en caso contrario
        
    Reglas de validación (con excepciones para valores por defecto):
    - Eje X: Permite valores por defecto (Warning: -2.36 y 2.18; Critical: -3.5 y 3.32)
    - Eje Y y Z: Sigue la validación estándar (min < max, warning < critical)
    
    Si no se están modificando los valores (no están en limit_data), no se realiza la validación.
    """
    # Casos especiales para valores por defecto
    default_values = {
        "x_2inf": -2.36,
        "x_2sup": 2.18,
        "x_3inf": -3.5,
        "x_3sup": 3.32
    }
    
    # Comprueba si se están usando los valores por defecto para el eje X
    def is_default_x_values():
        x_values = {
            "x_2inf": -2.36,
            "x_2sup": 2.18,
            "x_3inf": -3.5,
            "x_3sup": 3.32
        }
        
        # Verifica que todos los valores definidos en limit_data estén cerca de los valores por defecto
        for key in limit_data:
            if key in x_values and key in limit_data and limit_data[key] is not None:
                if abs(limit_data[key] - x_values[key]) > 0.001:  # Tolerancia para comparación de flotantes
                    return False
        return True
    
    # Si se están usando los valores por defecto para el eje X, no aplica la validación para estos valores
    if is_default_x_values():
        # Validar solo ejes Y y Z
        pass
    else:
        # Validar eje X
        if "x_2inf" in limit_data and "x_2sup" in limit_data:
            if limit_data["x_2inf"] >= limit_data["x_2sup"]:
                return False
        
        if "x_3inf" in limit_data and "x_2inf" in limit_data:
            if limit_data["x_3inf"] >= limit_data["x_2inf"]:
                return False
        
        if "x_2sup" in limit_data and "x_3sup" in limit_data:
            if limit_data["x_2sup"] >= limit_data["x_3sup"]:
                return False
    
    # Validar eje Y
    if "y_2inf" in limit_data and "y_2sup" in limit_data:
        if limit_data["y_2inf"] >= limit_data["y_2sup"]:
            return False
    
    if "y_3inf" in limit_data and "y_2inf" in limit_data:
        if limit_data["y_3inf"] >= limit_data["y_2inf"]:
            return False
    
    if "y_2sup" in limit_data and "y_3sup" in limit_data:
        if limit_data["y_2sup"] >= limit_data["y_3sup"]:
            return False
    
    # Validar eje Z
    if "z_2inf" in limit_data and "z_2sup" in limit_data:
        if limit_data["z_2inf"] >= limit_data["z_2sup"]:
            return False
    
    if "z_3inf" in limit_data and "z_2inf" in limit_data:
        if limit_data["z_3inf"] >= limit_data["z_2inf"]:
            return False
    
    if "z_2sup" in limit_data and "z_3sup" in limit_data:
        if limit_data["z_2sup"] >= limit_data["z_3sup"]:
            return False
    
    return True

def get_or_create_model(db: Session, model_data: Dict[str, Any]) -> Model:
    """
    Obtiene un modelo existente o crea uno nuevo.
    
    Args:
        db (Session): Sesión de base de datos activa
        model_data (Dict[str, Any]): Datos del modelo
        
    Returns:
        Model: Objeto modelo
    """
    # Si se proporciona un ID, buscar el modelo
    if "model_id" in model_data and model_data["model_id"]:
        model = db.query(Model).filter(Model.model_id == model_data["model_id"]).first()
        if model:
            # Actualizar campos
            for field in ["route_h5", "route_pkl", "name", "description"]:
                if field in model_data and model_data[field] is not None:
                    setattr(model, field, model_data[field])
            
            db.commit()
            db.refresh(model)
            return model
    
    # Crear un nuevo modelo
    new_model = Model(
        route_h5=model_data.get("route_h5"),
        route_pkl=model_data.get("route_pkl"),
        name=model_data.get("name"),
        description=model_data.get("description")
    )
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    return new_model

def get_or_create_sensor(db: Session, sensor_data: Dict[str, Any]) -> Sensor:
    """
    Obtiene un sensor existente o crea uno nuevo.
    
    Args:
        db (Session): Sesión de base de datos activa
        sensor_data (Dict[str, Any]): Datos del sensor
        
    Returns:
        Sensor: Objeto sensor
    """
    # Si se proporciona un ID, buscar el sensor
    if "sensor_id" in sensor_data and sensor_data["sensor_id"]:
        sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_data["sensor_id"]).first()
        if sensor:
            # Actualizar campos
            for field in ["name", "description", "model_id"]:
                if field in sensor_data and sensor_data[field] is not None:
                    setattr(sensor, field, sensor_data[field])
            
            db.commit()
            db.refresh(sensor)
            return sensor
    
    # Crear un nuevo sensor
    new_sensor = Sensor(
        name=sensor_data.get("name"),
        description=sensor_data.get("description"),
        model_id=sensor_data.get("model_id")
    )
    db.add(new_sensor)
    db.commit()
    db.refresh(new_sensor)
    return new_sensor

def get_or_create_machine(db: Session, machine_data: Dict[str, Any]) -> Machine:
    """
    Obtiene una máquina existente o crea una nueva.
    
    Args:
        db (Session): Sesión de base de datos activa
        machine_data (Dict[str, Any]): Datos de la máquina
        
    Returns:
        Machine: Objeto máquina
    """
    # Si se proporciona un ID, buscar la máquina
    if "machine_id" in machine_data and machine_data["machine_id"]:
        machine = db.query(Machine).filter(Machine.machine_id == machine_data["machine_id"]).first()
        if machine:
            # Actualizar campos
            for field in ["name", "description", "sensor_id"]:
                if field in machine_data and machine_data[field] is not None:
                    setattr(machine, field, machine_data[field])
            
            db.commit()
            db.refresh(machine)
            return machine
    
    # Crear una nueva máquina
    new_machine = Machine(
        name=machine_data.get("name"),
        description=machine_data.get("description"),
        sensor_id=machine_data.get("sensor_id")
    )
    db.add(new_machine)
    db.commit()
    db.refresh(new_machine)
    return new_machine

def get_full_config(db: Session) -> Dict[str, Any]:
    """
    Obtiene la configuración completa del sistema.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        Dict[str, Any]: Diccionario con todos los datos de configuración
    """
    # Obtener configuración del sistema
    system_config = get_system_config(db)
    
    # Obtener límites de alerta
    limit_config = get_latest_limit_config(db)
    
    # Obtener información del modelo activo
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
    
    # Obtener todos los sensores
    sensors = db.query(Sensor).all()
    sensors_info = []
    for sensor in sensors:
        sensors_info.append({
            "sensor_id": sensor.sensor_id,
            "name": sensor.name,
            "description": sensor.description,
            "model_id": sensor.model_id
        })
    
    # Obtener todas las máquinas
    machines = db.query(Machine).all()
    machines_info = []
    for machine in machines:
        machines_info.append({
            "machine_id": machine.machine_id,
            "name": machine.name,
            "description": machine.description,
            "sensor_id": machine.sensor_id
        })
    
    # Construir respuesta
    config = {
        "system_config": {
            "is_configured": system_config.is_configured,
            "active_model_id": system_config.active_model_id,
            "last_update": system_config.last_update.isoformat() if system_config.last_update else None
        },
        "limit_config": {
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
        },
        "model": model_info,
        "sensors": sensors_info,
        "machines": machines_info
    }
    
    return config

def update_full_config(db: Session, config_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Actualiza la configuración completa del sistema.
    
    Args:
        db (Session): Sesión de base de datos activa
        config_data (Dict[str, Any]): Datos de configuración
        
    Returns:
        Dict[str, Any]: Configuración actualizada
    """
    try:
        # 1. Procesar datos del modelo
        model_id = None
        if "route_h5" in config_data or "route_pkl" in config_data:
            # Crear datos del modelo
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
            
            # Crear o actualizar el modelo
            model = get_or_create_model(db, model_data)
            model_id = model.model_id
        
        # 2. Procesar límites de vibración
        limit_data = {}
        for field in ["x_2inf", "x_2sup", "x_3inf", "x_3sup", 
                     "y_2inf", "y_2sup", "y_3inf", "y_3sup", 
                     "z_2inf", "z_2sup", "z_3inf", "z_3sup"]:
            if field in config_data and config_data[field] is not None:
                limit_data[field] = config_data[field]
        
        # Crear o actualizar límites si hay datos
        if limit_data:
            create_or_update_limit_config(db, limit_data)
        
        # 3. Procesar información del sensor
        sensor_id = None
        if "sensor_name" in config_data and config_data["sensor_name"]:
            sensor_data = {
                "name": config_data["sensor_name"],
                "description": config_data.get("sensor_description"),
                "model_id": model_id  # Asociar con el modelo creado/actualizado
            }
            sensor = get_or_create_sensor(db, sensor_data)
            sensor_id = sensor.sensor_id
        
        # 4. Procesar información de la máquina
        if "machine_name" in config_data and config_data["machine_name"]:
            machine_data = {
                "name": config_data["machine_name"],
                "description": config_data.get("machine_description"),
                "sensor_id": sensor_id  # Asociar con el sensor creado/actualizado
            }
            get_or_create_machine(db, machine_data)
        
        # 5. Actualizar configuración del sistema
        update_system_config(
            db, 
            is_configured=1,  # Sistema configurado
            active_model_id=model_id
        )
        
        # Obtener la configuración actualizada
        return get_full_config(db)
        
    except Exception as e:
        # Registrar el error y relanzar excepción
        print(f"Error al actualizar la configuración completa: {str(e)}")
        raise 

# ==========================================================================
# FUNCIONES CRUD ESPECÍFICAS PARA ENTIDADES
# ==========================================================================

def get_all_models(db: Session) -> List[Model]:
    """
    Obtiene todos los modelos disponibles en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        List[Model]: Lista de modelos
    """
    return db.query(Model).all()

def get_model_by_id(db: Session, model_id: int) -> Optional[Model]:
    """
    Obtiene un modelo por su ID.
    
    Args:
        db (Session): Sesión de base de datos activa
        model_id (int): ID del modelo a buscar
        
    Returns:
        Optional[Model]: Modelo encontrado o None
    """
    return db.query(Model).filter(Model.model_id == model_id).first()

def create_new_model(db: Session, model_data: Dict[str, Any]) -> Model:
    """
    Crea un nuevo modelo en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        model_data (Dict[str, Any]): Datos del modelo
        
    Returns:
        Model: Modelo creado
    """
    new_model = Model(**model_data)
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    return new_model

def update_existing_model(db: Session, model_id: int, model_data: Dict[str, Any]) -> Optional[Model]:
    """
    Actualiza un modelo existente.
    
    Args:
        db (Session): Sesión de base de datos activa
        model_id (int): ID del modelo a actualizar
        model_data (Dict[str, Any]): Datos actualizados del modelo
        
    Returns:
        Optional[Model]: Modelo actualizado o None si no existe
    """
    db_model = get_model_by_id(db, model_id)
    if not db_model:
        return None
        
    # Actualizar atributos
    for key, value in model_data.items():
        if hasattr(db_model, key):
            setattr(db_model, key, value)
    
    db.commit()
    db.refresh(db_model)
    return db_model

def delete_model(db: Session, model_id: int) -> bool:
    """
    Elimina un modelo de la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        model_id (int): ID del modelo a eliminar
        
    Returns:
        bool: True si se eliminó correctamente, False en caso contrario
    """
    db_model = get_model_by_id(db, model_id)
    if not db_model:
        return False
        
    db.delete(db_model)
    db.commit()
    return True

def get_all_sensors(db: Session) -> List[Sensor]:
    """
    Obtiene todos los sensores disponibles en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        List[Sensor]: Lista de sensores
    """
    return db.query(Sensor).all()

def get_sensor_by_id(db: Session, sensor_id: int) -> Optional[Sensor]:
    """
    Obtiene un sensor por su ID.
    
    Args:
        db (Session): Sesión de base de datos activa
        sensor_id (int): ID del sensor a buscar
        
    Returns:
        Optional[Sensor]: Sensor encontrado o None
    """
    return db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()

def create_new_sensor(db: Session, sensor_data: Dict[str, Any]) -> Sensor:
    """
    Crea un nuevo sensor en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        sensor_data (Dict[str, Any]): Datos del sensor
        
    Returns:
        Sensor: Sensor creado
    """
    new_sensor = Sensor(**sensor_data)
    db.add(new_sensor)
    db.commit()
    db.refresh(new_sensor)
    return new_sensor

def update_existing_sensor(db: Session, sensor_id: int, sensor_data: Dict[str, Any]) -> Optional[Sensor]:
    """
    Actualiza un sensor existente.
    
    Args:
        db (Session): Sesión de base de datos activa
        sensor_id (int): ID del sensor a actualizar
        sensor_data (Dict[str, Any]): Datos actualizados del sensor
        
    Returns:
        Optional[Sensor]: Sensor actualizado o None si no existe
    """
    db_sensor = get_sensor_by_id(db, sensor_id)
    if not db_sensor:
        return None
        
    # Actualizar atributos
    for key, value in sensor_data.items():
        if hasattr(db_sensor, key):
            setattr(db_sensor, key, value)
    
    db.commit()
    db.refresh(db_sensor)
    return db_sensor

def delete_sensor(db: Session, sensor_id: int) -> bool:
    """
    Elimina un sensor de la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        sensor_id (int): ID del sensor a eliminar
        
    Returns:
        bool: True si se eliminó correctamente, False en caso contrario
    """
    db_sensor = get_sensor_by_id(db, sensor_id)
    if not db_sensor:
        return False
        
    db.delete(db_sensor)
    db.commit()
    return True

def get_all_machines(db: Session) -> List[Machine]:
    """
    Obtiene todas las máquinas disponibles en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        List[Machine]: Lista de máquinas
    """
    return db.query(Machine).all()

def get_machine_by_id(db: Session, machine_id: int) -> Optional[Machine]:
    """
    Obtiene una máquina por su ID.
    
    Args:
        db (Session): Sesión de base de datos activa
        machine_id (int): ID de la máquina a buscar
        
    Returns:
        Optional[Machine]: Máquina encontrada o None
    """
    return db.query(Machine).filter(Machine.machine_id == machine_id).first()

def create_new_machine(db: Session, machine_data: Dict[str, Any]) -> Machine:
    """
    Crea una nueva máquina en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        machine_data (Dict[str, Any]): Datos de la máquina
        
    Returns:
        Machine: Máquina creada
    """
    new_machine = Machine(**machine_data)
    db.add(new_machine)
    db.commit()
    db.refresh(new_machine)
    return new_machine

def update_existing_machine(db: Session, machine_id: int, machine_data: Dict[str, Any]) -> Optional[Machine]:
    """
    Actualiza una máquina existente.
    
    Args:
        db (Session): Sesión de base de datos activa
        machine_id (int): ID de la máquina a actualizar
        machine_data (Dict[str, Any]): Datos actualizados de la máquina
        
    Returns:
        Optional[Machine]: Máquina actualizada o None si no existe
    """
    db_machine = get_machine_by_id(db, machine_id)
    if not db_machine:
        return None
        
    # Actualizar atributos
    for key, value in machine_data.items():
        if hasattr(db_machine, key):
            setattr(db_machine, key, value)
    
    db.commit()
    db.refresh(db_machine)
    return db_machine

def delete_machine(db: Session, machine_id: int) -> bool:
    """
    Elimina una máquina de la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        machine_id (int): ID de la máquina a eliminar
        
    Returns:
        bool: True si se eliminó correctamente, False en caso contrario
    """
    db_machine = get_machine_by_id(db, machine_id)
    if not db_machine:
        return False
        
    db.delete(db_machine)
    db.commit()
    return True

def get_all_limits(db: Session) -> List[LimitConfig]:
    """
    Obtiene todas las configuraciones de límites disponibles en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        
    Returns:
        List[LimitConfig]: Lista de configuraciones de límites
    """
    return db.query(LimitConfig).all()

def get_limit_by_id(db: Session, limit_id: int) -> Optional[LimitConfig]:
    """
    Obtiene una configuración de límites por su ID.
    
    Args:
        db (Session): Sesión de base de datos activa
        limit_id (int): ID de la configuración de límites a buscar
        
    Returns:
        Optional[LimitConfig]: Configuración de límites encontrada o None
    """
    return db.query(LimitConfig).filter(LimitConfig.limit_config_id == limit_id).first()

def delete_limit(db: Session, limit_id: int) -> bool:
    """
    Elimina una configuración de límites de la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa
        limit_id (int): ID de la configuración de límites a eliminar
        
    Returns:
        bool: True si se eliminó correctamente, False en caso contrario
    """
    db_limit = get_limit_by_id(db, limit_id)
    if not db_limit:
        return False
        
    db.delete(db_limit)
    db.commit()
    return True 