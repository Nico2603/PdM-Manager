import logging
import os
import traceback
from datetime import datetime
from pathlib import Path

# Crear directorio de logs si no existe
logs_dir = Path("logs")
logs_dir.mkdir(exist_ok=True)

# Configurar formato de logs
LOG_FORMAT = "[%(asctime)s] [%(levelname)s] [%(module)s:%(lineno)d] - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Configuración de logger principal
logger = logging.getLogger("pdm_manager")
logger.setLevel(logging.INFO)

# Crear manejador para archivo
log_file = logs_dir / f"pdm_manager_{datetime.now().strftime('%Y%m%d')}.log"
file_handler = logging.FileHandler(log_file, encoding="utf-8")
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
logger.addHandler(file_handler)

# Crear manejador para consola
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
logger.addHandler(console_handler)

# Configurar un logger específico para el escalado de datos
scaler_logger = logging.getLogger("pdm_manager.scaler")
scaler_logger.setLevel(logging.DEBUG)

# Archivo de log específico para escalado
scaler_log_file = logs_dir / f"scaler_{datetime.now().strftime('%Y%m%d')}.log"
scaler_file_handler = logging.FileHandler(scaler_log_file, encoding="utf-8")
scaler_file_handler.setLevel(logging.DEBUG)
scaler_file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
scaler_logger.addHandler(scaler_file_handler)
# Evitamos duplicar mensajes en el logger principal
scaler_logger.propagate = False

def log_error(error, context=None):
    """
    Registra errores con detalles completos incluyendo traza de la pila
    
    Args:
        error: La excepción o error a registrar
        context: Información adicional sobre el contexto del error
    """
    error_msg = str(error)
    error_traceback = traceback.format_exc()
    
    # Construir mensaje detallado
    detailed_msg = f"ERROR: {error_msg}"
    if context:
        detailed_msg += f"\nCONTEXTO: {context}"
    detailed_msg += f"\nTRACEBACK: {error_traceback}"
    
    # Registrar en el log
    logger.error(detailed_msg)
    
    # Retornar mensaje simplificado para la respuesta API
    return error_msg

def log_warning(message, context=None):
    """Registra advertencias con contexto opcional"""
    detailed_msg = f"ADVERTENCIA: {message}"
    if context:
        detailed_msg += f"\nCONTEXTO: {context}"
    
    logger.warning(detailed_msg)

def log_info(message):
    """Registra mensajes informativos"""
    logger.info(message)

def log_db_error(error, operation=None, model=None, data=None):
    """
    Registra errores específicos de base de datos con contexto relevante
    
    Args:
        error: La excepción de base de datos
        operation: Operación que se estaba realizando (select, insert, update, delete)
        model: Modelo o tabla involucrada
        data: Datos relacionados con la operación
    """
    context = {}
    if operation:
        context["operacion"] = operation
    if model:
        context["modelo"] = model
    if data:
        # Evitar registrar datos sensibles o muy grandes
        if isinstance(data, dict):
            # Solo incluir claves, no valores completos
            context["datos"] = list(data.keys())
        else:
            # Incluir representación resumida
            context["datos"] = str(data)[:100] + "..." if len(str(data)) > 100 else str(data)
    
    log_error(error, context)

def log_scaling(original_values, scaled_values=None, scaler_info=None, sensor_id=None, success=True):
    """
    Registra información detallada sobre el proceso de escalado
    
    Args:
        original_values: Valores originales antes del escalado (array, lista o dict)
        scaled_values: Valores después del escalado (array, lista o dict), None si hubo error
        scaler_info: Información sobre el escalador utilizado (ruta, tipo, etc)
        sensor_id: Identificador del sensor asociado con los datos
        success: Indica si el escalado fue exitoso
    """
    context = {
        "sensor_id": sensor_id,
        "scaler": scaler_info,
        "success": success
    }
    
    # Formatear información básica
    message = f"ESCALADO {'EXITOSO' if success else 'FALLIDO'}"
    if sensor_id:
        message += f" | Sensor: {sensor_id}"
    if scaler_info:
        message += f" | Escalador: {scaler_info}"
    
    # Registrar valores originales siempre
    scaler_logger.info(message)
    scaler_logger.debug(f"Valores originales: {original_values}")
    
    # Registrar valores escalados solo si están disponibles
    if scaled_values is not None:
        scaler_logger.debug(f"Valores escalados: {scaled_values}")
        
        # Si numpy está disponible, calcular estadísticas
        try:
            import numpy as np
            if isinstance(original_values, (np.ndarray, list)) and isinstance(scaled_values, (np.ndarray, list)):
                orig_array = np.array(original_values) if not isinstance(original_values, np.ndarray) else original_values
                scaled_array = np.array(scaled_values) if not isinstance(scaled_values, np.ndarray) else scaled_values
                
                # Calcular estadísticas básicas
                orig_stats = {
                    "min": float(np.min(orig_array)),
                    "max": float(np.max(orig_array)),
                    "mean": float(np.mean(orig_array)),
                    "std": float(np.std(orig_array))
                }
                
                scaled_stats = {
                    "min": float(np.min(scaled_array)),
                    "max": float(np.max(scaled_array)),
                    "mean": float(np.mean(scaled_array)),
                    "std": float(np.std(scaled_array))
                }
                
                scaler_logger.debug(f"Estadísticas originales: {orig_stats}")
                scaler_logger.debug(f"Estadísticas escaladas: {scaled_stats}")
        except:
            # Si ocurre algún error, simplemente no registramos estadísticas
            pass
    
    return message 