# app/main.py

import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Importar componentes para manejo de errores y logs
from app.error_handlers import configure_error_handlers
from app.logger import logger, log_info
from app.database import engine, Base

# Importar routers
from app.routers import vibration_data
from app.routers import sensors
from app.routers import machines
from app.routers import ml_models_routes

# Importar funciones de utilidad
from app.utils.model_loader import load_model_and_scaler

# Crear la aplicación FastAPI
app = FastAPI(
    title="PdM Manager API",
    description="API para gestión de mantenimiento predictivo",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, limitar a orígenes específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurar el manejo de errores
configure_error_handlers(app)

# Crear las tablas de la base de datos
Base.metadata.create_all(bind=engine)

# Incluir routers
app.include_router(vibration_data.router)
app.include_router(sensors.router)
app.include_router(machines.router)
app.include_router(ml_models_routes.router)

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")

# Ruta de inicio que sirve el archivo index.html
@app.get("/", tags=["root"])
def read_root():
    """
    Ruta de inicio que sirve la interfaz de usuario
    """
    return FileResponse('static/index.html')

# Ruta para la API
@app.get("/api", tags=["api"])
def api_root():
    """
    Ruta de inicio para verificar que la API está funcionando
    """
    return {
        "message": "¡Bienvenido a la API de PdM Manager!",
        "version": "1.0.0",
        "status": "online"
    }

# Ruta para verificar el estado de la aplicación
@app.get("/api/health", tags=["system"])
def health_check():
    """
    Verificar el estado general de la aplicación
    """
    # Verificar estado de modelos
    model_status = load_model_and_scaler()
    
    return {
        "status": "ok",
        "database": "connected",
        "models": model_status,
        "api_version": "1.0.0"
    }

# Iniciar aplicación
if __name__ == "__main__":
    import uvicorn
    # Cargar el modelo al inicio
    log_info("Iniciando aplicación...")
    load_model_and_scaler()
    # Iniciar servidor
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)