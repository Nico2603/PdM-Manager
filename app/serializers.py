"""
Utilidades para serializar objetos SQLAlchemy a formatos JSON seguros
"""
import datetime
import decimal
from typing import Any, Dict, List, Union, Optional

def remove_sa_instance(obj_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Elimina el atributo _sa_instance_state de un diccionario y
    convierte tipos no serializables a serializables.
    
    Args:
        obj_dict: Diccionario a limpiar
        
    Returns:
        Diccionario limpio y listo para serializar a JSON
    """
    if not isinstance(obj_dict, dict):
        return obj_dict
        
    # Eliminar atributos SQLAlchemy
    if '_sa_instance_state' in obj_dict:
        obj_dict.pop('_sa_instance_state')
    
    # Convertir tipos no serializables
    for key, value in list(obj_dict.items()):
        # Manejar fechas y horas
        if isinstance(value, (datetime.datetime, datetime.date)):
            obj_dict[key] = value.isoformat()
        # Manejar decimales
        elif isinstance(value, decimal.Decimal):
            obj_dict[key] = float(value)
        # Manejar bytes
        elif isinstance(value, bytes):
            obj_dict[key] = value.decode('utf-8', errors='replace')
        # Manejar objetos anidados
        elif hasattr(value, '__dict__'):
            obj_dict[key] = remove_sa_instance(value.__dict__.copy())
    
    return obj_dict

def serialize_model(
    model: Any, 
    exclude_fields: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Serializa un modelo SQLAlchemy a un diccionario JSON seguro
    
    Args:
        model: Modelo SQLAlchemy a serializar
        exclude_fields: Lista de campos a excluir
        
    Returns:
        Diccionario listo para serializar a JSON
    """
    if model is None:
        return {}
    
    exclude_fields = exclude_fields or []
    
    # Convertir modelo a diccionario
    model_dict = model.__dict__.copy()
    
    # Eliminar campos excluidos
    for field in exclude_fields:
        if field in model_dict:
            model_dict.pop(field)
    
    # Limpiar atributos SQLAlchemy y convertir tipos
    return remove_sa_instance(model_dict)

def serialize_list(
    model_list: List[Any], 
    exclude_fields: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Serializa una lista de modelos SQLAlchemy a una lista de diccionarios
    
    Args:
        model_list: Lista de modelos a serializar
        exclude_fields: Lista de campos a excluir
        
    Returns:
        Lista de diccionarios listos para serializar a JSON
    """
    return [serialize_model(item, exclude_fields) for item in model_list]

def create_response(
    success: bool = True,
    data: Any = None,
    message: str = "",
    error: Optional[str] = None,
    status_code: int = 200
) -> Dict[str, Any]:
    """
    Crea una respuesta estandarizada para las APIs
    
    Args:
        success: Indica si la operación fue exitosa
        data: Datos a incluir en la respuesta
        message: Mensaje informativo
        error: Mensaje de error (si hubo uno)
        status_code: Código de estado HTTP
        
    Returns:
        Diccionario con la respuesta estandarizada
    """
    response = {
        "success": success,
        "status_code": status_code
    }
    
    if data is not None:
        response["data"] = data
        
    if message:
        response["message"] = message
        
    if error:
        response["error"] = error
        
    return response 