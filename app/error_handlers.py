"""
Manejadores de errores centralizados para FastAPI
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from pydantic import ValidationError

from app.logger import log_error, log_db_error
from app.serializers import create_response

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Manejador para errores de validación de FastAPI
    """
    # Generar mensaje de error claro y útil
    error_msgs = []
    for error in exc.errors():
        location = " -> ".join([str(loc) for loc in error["loc"] if loc != "body"])
        error_msgs.append(f"Campo '{location}': {error['msg']}")
    
    error_message = "Error de validación en los datos enviados: " + "; ".join(error_msgs)
    
    # Registrar el error
    log_error(exc, {
        "endpoint": request.url.path,
        "método": request.method,
        "errores": exc.errors()
    })
    
    # Retornar respuesta JSON estandarizada
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=create_response(
            success=False,
            error=error_message,
            message="La solicitud contiene datos inválidos",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )
    )

async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Manejador para errores de SQLAlchemy
    """
    # Determinar tipo específico de error y mensaje apropiado
    if isinstance(exc, IntegrityError):
        error_message = "Error de integridad en la base de datos"
        if "unique constraint" in str(exc).lower():
            error_message = "Ya existe un registro con esos datos"
        elif "foreign key constraint" in str(exc).lower():
            error_message = "El registro referenciado no existe"
        status_code = status.HTTP_409_CONFLICT
    elif isinstance(exc, OperationalError):
        error_message = "Error operacional en la base de datos"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        error_message = "Error en la operación de base de datos"
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    # Registrar error detallado en logs
    log_db_error(exc, 
        operation=request.method,
        model=request.url.path.split('/')[-1] if len(request.url.path.split('/')) > 1 else None
    )
    
    # Retornar respuesta JSON estandarizada
    return JSONResponse(
        status_code=status_code,
        content=create_response(
            success=False,
            error=error_message,
            message="Se produjo un error en la base de datos",
            status_code=status_code
        )
    )

async def http_exception_handler(request: Request, exc):
    """
    Manejador genérico para excepciones HTTP
    """
    # Registrar error
    log_error(exc, {
        "endpoint": request.url.path,
        "método": request.method
    })
    
    # Retornar respuesta JSON estandarizada
    return JSONResponse(
        status_code=exc.status_code,
        content=create_response(
            success=False,
            error=exc.detail,
            status_code=exc.status_code
        )
    )

async def general_exception_handler(request: Request, exc: Exception):
    """
    Manejador para todas las demás excepciones no capturadas
    """
    # Registrar error detallado
    log_error(exc, {
        "endpoint": request.url.path,
        "método": request.method,
        "query_params": str(request.query_params),
        "client": request.client.host if request.client else "Unknown"
    })
    
    # Mensaje simplificado para la respuesta
    error_message = "Se produjo un error interno en el servidor"
    
    # En desarrollo, podemos enviar el error real
    # En producción, enviar solo mensaje genérico
    # (Esto se puede controlar con una variable de entorno)
    
    # Retornar respuesta JSON estandarizada
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_response(
            success=False,
            error=str(exc) if True else error_message,  # Cambiar a False en producción
            message="Error interno del servidor",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    )

def configure_error_handlers(app):
    """
    Configura todos los manejadores de errores en la aplicación FastAPI
    
    Args:
        app: Instancia de FastAPI
    """
    from fastapi.exceptions import HTTPException
    
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler) 