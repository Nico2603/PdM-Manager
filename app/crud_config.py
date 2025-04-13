# app/crud_config.py
from sqlalchemy.orm import Session
from app.models import SystemConfig, Model, LimitConfig, Sensor, Machine
from datetime import datetime
from typing import Dict, Any, Optional, List, Union
import logging
from sqlalchemy.orm.exc import NoResultFound # Importar NoResultFound
from fastapi import HTTPException, status

logger = logging.getLogger("pdm_manager.crud_config") # Crear un logger específico

# Nueva función para asegurar la existencia de los límites por defecto
def ensure_default_limits_exist(db: Session):
    """
    Asegura que la configuración de límites con ID=1 exista.
    Si no existe, la crea utilizando los valores por defecto definidos en el modelo.
    Esta función debe llamarse al inicio de la aplicación.
    """
    default_limits = db.query(LimitConfig).filter(LimitConfig.limit_config_id == 1).first()
    if not default_limits:
        logger.info("Configuración de límites por defecto (ID=1) no encontrada. Creando...")
        try:
            # Crear una nueva instancia. Los valores `default` del modelo se usarán.
            new_limits = LimitConfig(limit_config_id=1)
            db.add(new_limits)
            db.commit()
            db.refresh(new_limits)
            logger.info("Configuración de límites por defecto (ID=1) creada exitosamente.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error crítico al crear la configuración de límites por defecto (ID=1): {e}")
            # Dependiendo de la criticidad, podrías querer que la app no inicie.
            # raise RuntimeError(f"No se pudo crear la configuración de límites por defecto: {e}") from e

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
    Obtiene la configuración de límites con ID=1.
    Se asume que esta es la configuración activa y por defecto.

    Args:
        db (Session): Sesión de base de datos activa

    Returns:
        Optional[LimitConfig]: Objeto de configuración de límites con ID=1 o None si no existe.
    """
    # Buscar la configuración con ID=1 específicamente
    config = db.query(LimitConfig).filter(LimitConfig.limit_config_id == 1).first()
    
    # Ya no crea una configuración por defecto aquí. 
    # Eso se maneja en ensure_default_limits_exist al inicio de la app.
    if not config:
        logger.warning("No se encontró la configuración de límites por defecto (ID=1). Esto debería haber sido creado al inicio.")
        # Podría lanzar una excepción aquí si se considera un estado irrecuperable.
        # raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuración de límites por defecto (ID=1) no encontrada.")
        
    return config

def create_or_update_limit_config(db: Session, limit_data: Dict[str, float]) -> LimitConfig:
    """
    Actualiza la configuración de límites con ID=1.
    Asume que la configuración con ID=1 siempre existe (creada al inicio).

    Args:
        db (Session): Sesión de base de datos activa
        limit_data (Dict[str, float]): Datos de límites a actualizar validados previamente por Pydantic.

    Returns:
        LimitConfig: Objeto de configuración de límites actualizado.
        
    Raises:
        HTTPException: Si la configuración con ID=1 no se encuentra.
    """
    # Ya no se llama a validate_limits aquí. La validación ocurre en el schema Pydantic (main.py).
    # if not validate_limits(limit_data): 
    #     raise ValueError("Los límites proporcionados no son coherentes (ej. min >= max)")
    
    # Obtener la configuración con ID=1
    config = db.query(LimitConfig).filter(LimitConfig.limit_config_id == 1).first()
    
    if not config:
        logger.error("Intento de actualizar límites fallido: Configuración ID=1 no encontrada.")
        # Si no existe, es un error porque ensure_default_limits_exist debió crearla.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Error crítico: No se encontró la configuración de límites base (ID=1)."
        )
            
    # Actualizar los campos del objeto existente con los datos proporcionados
    updated = False
    for field, value in limit_data.items():
        # Asegurarse de que el campo existe en el modelo y el valor no es None
        if hasattr(config, field) and value is not None:
            # Solo actualizar si el valor nuevo es diferente al actual
            if getattr(config, field) != value:
                 setattr(config, field, value)
                 updated = True
            
    # Actualizar timestamp solo si hubo cambios reales
    if updated:
        config.update_limits = datetime.now()
        try:
            db.commit()
            db.refresh(config)
            logger.info(f"Configuración de límites (ID=1) actualizada correctamente.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error al guardar cambios en límites (ID=1): {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Error al guardar la actualización de límites: {e}"
            )
    else:
        logger.info("No se realizaron cambios en los límites (valores iguales a los existentes).")
        
    return config

def get_or_create_model(db: Session, model_data: Dict[str, Any]) -> Model:
    """
    Obtiene un modelo existente por nombre o lo crea si no existe.
    Actualiza las rutas y descripción si el modelo ya existe y los datos son diferentes.

    Args:
        db (Session): Sesión de base de datos activa
        model_data (Dict[str, Any]): Datos del modelo (debe incluir 'name', 'route_h5', 'route_pkl')

    Returns:
        Model: Objeto modelo existente o recién creado

    Raises:
        ValueError: Si falta el nombre o las rutas del modelo
    """
    model_name = model_data.get("name")
    if not model_name:
        logger.error("Intento de obtener/crear modelo sin nombre.")
        raise ValueError("El nombre ('name') es requerido para obtener o crear un modelo.")

    try:
        # Intentar buscar el modelo por nombre
        existing_model = db.query(Model).filter(Model.name == model_name).one()
        logger.info(f"Modelo encontrado por nombre '{model_name}'. Verificando actualizaciones...")

        # Actualizar campos si se proporcionan y son diferentes
        updated = False
        for field in ["route_h5", "route_pkl", "description"]:
            new_value = model_data.get(field)
            if new_value is not None and getattr(existing_model, field) != new_value:
                setattr(existing_model, field, new_value)
                updated = True
                logger.info(f"Modelo '{model_name}': Campo '{field}' actualizado.")

        if updated:
            db.commit()
            db.refresh(existing_model)
            logger.info(f"Modelo '{model_name}' actualizado en la BD.")
        else:
            logger.info(f"Modelo '{model_name}' encontrado, sin cambios necesarios.")
        return existing_model

    except NoResultFound:
        # Si no se encuentra, crear uno nuevo
        logger.info(f"Modelo con nombre '{model_name}' no encontrado. Creando nuevo modelo...")
        try:
            # Asegurarse de que los campos requeridos (rutas) estén presentes para la creación
            route_h5 = model_data.get("route_h5")
            route_pkl = model_data.get("route_pkl")
            if not route_h5 or not route_pkl:
                 logger.error(f"Faltan rutas al intentar crear el modelo '{model_name}'.")
                 raise ValueError("Las rutas 'route_h5' y 'route_pkl' son requeridas para crear un nuevo modelo.")

            new_model = Model(
                name=model_name,
                route_h5=route_h5,
                route_pkl=route_pkl,
                description=model_data.get("description")
            )
            db.add(new_model)
            db.commit()
            db.refresh(new_model)
            logger.info(f"Nuevo modelo '{model_name}' creado con ID: {new_model.model_id}")
            return new_model
        except Exception as create_err:
            logger.error(f"Error al crear el nuevo modelo '{model_name}': {create_err}")
            db.rollback() # Revertir cambios si la creación falla
            raise ValueError(f"No se pudo crear el modelo: {create_err}")

    except Exception as e:
        logger.error(f"Error inesperado al obtener/crear modelo '{model_name}': {e}", exc_info=True)
        db.rollback()
        # Relanzar como ValueError para que update_full_config lo maneje como 400
        raise ValueError(f"Error inesperado procesando el modelo: {e}")

def get_or_create_sensor(db: Session, sensor_data: Dict[str, Any]) -> Sensor:
    """
    Obtiene un sensor existente por nombre o lo crea si no existe.
    Actualiza la descripción y model_id si el sensor ya existe y los datos son diferentes.

    Args:
        db (Session): Sesión de base de datos activa
        sensor_data (Dict[str, Any]): Datos del sensor (debe incluir 'name')

    Returns:
        Sensor: Objeto sensor existente o recién creado

    Raises:
        ValueError: Si falta el nombre del sensor
    """
    sensor_name = sensor_data.get("name")
    if not sensor_name:
        logger.error("Intento de obtener/crear sensor sin nombre.")
        raise ValueError("El nombre ('name') es requerido para obtener o crear un sensor.")

    try:
        # Intentar buscar el sensor por nombre
        existing_sensor = db.query(Sensor).filter(Sensor.name == sensor_name).one()
        logger.info(f"Sensor encontrado por nombre '{sensor_name}'. Verificando actualizaciones...")

        # Actualizar campos si se proporcionan y son diferentes
        updated = False
        for field in ["description", "model_id"]:
            new_value = sensor_data.get(field)
            # Permitir actualizar model_id a None si se pasa explícitamente
            if field in sensor_data and getattr(existing_sensor, field) != new_value:
                setattr(existing_sensor, field, new_value)
                updated = True
                logger.info(f"Sensor '{sensor_name}': Campo '{field}' actualizado a '{new_value}'.")

        if updated:
            db.commit()
            db.refresh(existing_sensor)
            logger.info(f"Sensor '{sensor_name}' actualizado en la BD.")
        else:
            logger.info(f"Sensor '{sensor_name}' encontrado, sin cambios necesarios.")
        return existing_sensor

    except NoResultFound:
        # Si no se encuentra, crear uno nuevo
        logger.info(f"Sensor con nombre '{sensor_name}' no encontrado. Creando nuevo sensor...")
        try:
            new_sensor = Sensor(
                name=sensor_name,
                description=sensor_data.get("description"),
                model_id=sensor_data.get("model_id") # Puede ser None
            )
            db.add(new_sensor)
            db.commit()
            db.refresh(new_sensor)
            logger.info(f"Nuevo sensor '{sensor_name}' creado con ID: {new_sensor.sensor_id}")
            return new_sensor
        except Exception as create_err:
            logger.error(f"Error al crear el nuevo sensor '{sensor_name}': {create_err}")
            db.rollback()
            raise ValueError(f"No se pudo crear el sensor: {create_err}")

    except Exception as e:
        logger.error(f"Error inesperado al obtener/crear sensor '{sensor_name}': {e}", exc_info=True)
        db.rollback()
        raise ValueError(f"Error inesperado procesando el sensor: {e}")

def get_or_create_machine(db: Session, machine_data: Dict[str, Any]) -> Machine:
    """
    Obtiene una máquina existente por nombre o la crea si no existe.
    Actualiza la descripción y sensor_id si la máquina ya existe y los datos son diferentes.

    Args:
        db (Session): Sesión de base de datos activa
        machine_data (Dict[str, Any]): Datos de la máquina (debe incluir 'name')

    Returns:
        Machine: Objeto máquina existente o recién creado

    Raises:
        ValueError: Si falta el nombre de la máquina
    """
    machine_name = machine_data.get("name")
    if not machine_name:
        logger.error("Intento de obtener/crear máquina sin nombre.")
        raise ValueError("El nombre ('name') es requerido para obtener o crear una máquina.")

    try:
        # Intentar buscar la máquina por nombre
        existing_machine = db.query(Machine).filter(Machine.name == machine_name).one()
        logger.info(f"Máquina encontrada por nombre '{machine_name}'. Verificando actualizaciones...")

        # Actualizar campos si se proporcionan y son diferentes
        updated = False
        for field in ["description", "sensor_id"]:
             new_value = machine_data.get(field)
             # Permitir actualizar sensor_id a None si se pasa explícitamente
             if field in machine_data and getattr(existing_machine, field) != new_value:
                setattr(existing_machine, field, new_value)
                updated = True
                logger.info(f"Máquina '{machine_name}': Campo '{field}' actualizado a '{new_value}'.")

        if updated:
            db.commit()
            db.refresh(existing_machine)
            logger.info(f"Máquina '{machine_name}' actualizada en la BD.")
        else:
            logger.info(f"Máquina '{machine_name}' encontrada, sin cambios necesarios.")
        return existing_machine

    except NoResultFound:
        # Si no se encuentra, crear una nueva
        logger.info(f"Máquina con nombre '{machine_name}' no encontrada. Creando nueva máquina...")
        try:
            new_machine = Machine(
                name=machine_name,
                description=machine_data.get("description"),
                sensor_id=machine_data.get("sensor_id") # Puede ser None
            )
            db.add(new_machine)
            db.commit()
            db.refresh(new_machine)
            logger.info(f"Nueva máquina '{machine_name}' creada con ID: {new_machine.machine_id}")
            return new_machine
        except Exception as create_err:
            logger.error(f"Error al crear la nueva máquina '{machine_name}': {create_err}")
            db.rollback()
            raise ValueError(f"No se pudo crear la máquina: {create_err}")

    except Exception as e:
        logger.error(f"Error inesperado al obtener/crear máquina '{machine_name}': {e}", exc_info=True)
        db.rollback()
        raise ValueError(f"Error inesperado procesando la máquina: {e}")

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
    logger.info(f"Iniciando actualización de configuración completa con datos: {config_data}")
    try:
        # 1. Procesar datos del modelo
        model_id = None
        model = None # Variable para almacenar el modelo creado/actualizado
        if "route_h5" in config_data or "route_pkl" in config_data:
            logger.info("Procesando datos del modelo...")
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
            try:
                model = get_or_create_model(db, model_data)
                model_id = model.model_id
                logger.info(f"Modelo {'actualizado' if model else 'creado'} con ID: {model_id}")
            except Exception as model_err:
                logger.error(f"Error al procesar modelo: {model_err}")
                raise ValueError(f"Error al procesar el modelo: {model_err}")
        
        # 2. Procesar límites de vibración
        limit_data = {}
        for field in ["x_2inf", "x_2sup", "x_3inf", "x_3sup", 
                     "y_2inf", "y_2sup", "y_3inf", "y_3sup", 
                     "z_2inf", "z_2sup", "z_3inf", "z_3sup"]:
            if field in config_data and config_data[field] is not None:
                limit_data[field] = config_data[field]
        
        # Crear o actualizar límites si hay datos
        if limit_data:
            logger.info("Actualizando límites de vibración...")
            try:
                create_or_update_limit_config(db, limit_data)
                logger.info("Límites de vibración actualizados correctamente.")
            except ValueError as limit_val_err:
                logger.error(f"Error de validación al actualizar límites: {limit_val_err}")
                raise # Relanzar error de validación
            except Exception as limit_err:
                logger.error(f"Error al actualizar límites: {limit_err}")
                raise ValueError(f"Error al actualizar los límites: {limit_err}")
        
        # 3. Procesar información del sensor
        sensor_id = None
        sensor = None # Variable para almacenar el sensor creado/actualizado
        # Usar 'sensor_name' o buscar en 'sensor_info' si está presente
        sensor_name = config_data.get("sensor_name")
        sensor_info = config_data.get("sensor_info")
        
        if sensor_name or sensor_info:
            logger.info("Procesando datos del sensor...")
            sensor_data = {}
            if sensor_info: # Dar prioridad a sensor_info si existe
                sensor_data = sensor_info
            else: # Usar campos individuales si no hay sensor_info
                sensor_data["name"] = sensor_name
                sensor_data["description"] = config_data.get("sensor_description")
            
            # Asociar con el modelo creado/actualizado si existe
            if model_id:
                 sensor_data["model_id"] = model_id
            
            try:
                sensor = get_or_create_sensor(db, sensor_data)
                sensor_id = sensor.sensor_id
                logger.info(f"Sensor {'actualizado' if sensor else 'creado'} con ID: {sensor_id}")
            except Exception as sensor_err:
                logger.error(f"Error al procesar sensor: {sensor_err}")
                raise ValueError(f"Error al procesar el sensor: {sensor_err}")
        
        # 4. Procesar información de la máquina
        machine_name = config_data.get("machine_name")
        machine_info = config_data.get("machine_info")
        
        if machine_name or machine_info:
            logger.info("Procesando datos de la máquina...")
            machine_data = {}
            if machine_info:
                machine_data = machine_info
            else:
                machine_data["name"] = machine_name
                machine_data["description"] = config_data.get("machine_description")
                
            # Asociar con el sensor creado/actualizado si existe
            if sensor_id:
                 machine_data["sensor_id"] = sensor_id
            
            try:
                get_or_create_machine(db, machine_data)
                logger.info(f"Máquina {'actualizada' if 'machine_id' in machine_data else 'creada'}: {machine_data.get('name')}")
            except Exception as machine_err:
                logger.error(f"Error al procesar máquina: {machine_err}")
                raise ValueError(f"Error al procesar la máquina: {machine_err}")

        # 5. Actualizar configuración del sistema
        logger.info("Actualizando configuración global del sistema...")
        try:
            update_system_config(
                db,
                is_configured=1,  # Marcar como configurado
                active_model_id=model_id # Establecer modelo activo
            )
            logger.info("Configuración global del sistema actualizada.")
        except Exception as sys_err:
            logger.error(f"Error al actualizar SystemConfig: {sys_err}")
            raise ValueError(f"Error al finalizar la configuración del sistema: {sys_err}")
        
        # Obtener la configuración actualizada para devolverla
        logger.info("Actualización de configuración completa finalizada.")
        return get_full_config(db)
        
    except ValueError as ve: # Capturar errores de validación específicos
        logger.error(f"Error de validación durante la actualización de configuración: {ve}")
        raise # Relanzar para que el endpoint lo maneje como 400
    except Exception as e:
        # Registrar el error y relanzar una excepción genérica para 500
        logger.error(f"Error inesperado al actualizar la configuración completa: {e}", exc_info=True)
        raise Exception(f"Error inesperado durante la actualización: {e}")

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