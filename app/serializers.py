"""
Utilidades para serializar objetos SQLAlchemy a formatos JSON seguros
"""
import datetime
import decimal
from typing import Any, Dict, List, Union, Optional
from fastapi.responses import JSONResponse

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
    model_instance: Any,
    exclude: List[str] = None
) -> Dict[str, Any]:
    """
    Serializa un modelo SQLAlchemy a un diccionario
    excluyendo campos específicos
    
    Args:
        model_instance: Instancia del modelo SQLAlchemy
        exclude: Lista de campos a excluir
        
    Returns:
        Diccionario serializado
    """
    if not model_instance:
        return {}
    
    exclude = exclude or []
    
    # Convertir a diccionario
    model_dict = {}
    for column in model_instance.__table__.columns:
        if column.name not in exclude:
            model_dict[column.name] = getattr(model_instance, column.name)
    
    # Limpiar atributos SQLAlchemy
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
    data: Any = None,
    message: str = "OK",
    success: bool = True,
    status_code: int = 200,
    error: str = None
) -> Dict[str, Any]:
    """
    Crea una respuesta JSON estándar para la API
    
    Args:
        data: Los datos a devolver
        message: Un mensaje informativo
        success: Indica si la operación fue exitosa
        status_code: Código de estado HTTP opcional (por defecto 200)
        error: Mensaje de error opcional
    
    Returns:
        Dict: Un diccionario con formato estándar para respuestas
    """
    
    response = {
        "data": data,
        "message": message,
        "success": success
    }
    
    if error:
        response["error"] = error
    
    return response 