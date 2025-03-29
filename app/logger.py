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