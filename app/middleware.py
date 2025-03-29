"""
Middleware para registrar solicitudes y manejar errores
"""
import time
from fastapi import Request, FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from app.logger import log_info, log_error

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware para registrar todas las solicitudes HTTP
    y su tiempo de respuesta
    """
    
    async def dispatch(self, request: Request, call_next):
        """
        Procesa la solicitud, registra tiempo y respuesta
        """
        start_time = time.time()
        
        # Registrar información de la solicitud
        client_host = request.client.host if request.client else "unknown"
        log_info(f"Solicitud {request.method} {request.url.path} desde {client_host}")
        
        # Procesar la solicitud
        try:
            response = await call_next(request)
            
            # Calcular tiempo de procesamiento
            process_time = time.time() - start_time
            
            # Registrar información de la respuesta
            log_info(
                f"Respuesta {response.status_code} para {request.method} {request.url.path} "
                f"procesada en {process_time:.4f}s"
            )
            
            # Añadir header con tiempo de procesamiento (opcional, útil para depuración)
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            # Registrar errores no manejados
            process_time = time.time() - start_time
            log_error(
                e,
                f"Error no manejado en {request.method} {request.url.path} "
                f"después de {process_time:.4f}s"
            )
            raise  # Re-lanzar para que lo maneje el error handler global

def configure_middleware(app: FastAPI):
    """
    Configura todos los middleware personalizados
    
    Args:
        app: Instancia de FastAPI
    """
    # Registrar middleware de logging
    app.add_middleware(RequestLoggingMiddleware) 