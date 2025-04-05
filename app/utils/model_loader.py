# app/utils/model_loader.py

import os
import pickle
import joblib
from tensorflow.keras.models import load_model
from typing import Dict, Any, Optional, Tuple

from app.logger import log_error, log_info, log_warning

# Definir rutas base (mantener compatibilidad con la estructura actual)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELO_DIR = os.path.join(BASE_DIR, "Modelo")
SCALER_DIR = os.path.join(BASE_DIR, "Scaler")

# Configurar variable de entorno para evitar diferencias numéricas
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

def load_model_and_scaler() -> Dict[str, Any]:
    """
    Carga el modelo y el escalador desde las ubicaciones predeterminadas.
    
    Returns:
        Dict[str, Any]: Diccionario con el estado de la carga y mensajes informativos.
    """
    global modelo, scaler
    
    model_path = os.path.join(MODELO_DIR, "modeloRNN_multiclase_v3_finetuned.h5")
    scaler_path = os.path.join(SCALER_DIR, "scaler_RNN.pkl")
    # Ruta alternativa usando joblib (más robusto para modelos scikit-learn)
    scaler_joblib_path = os.path.join(SCALER_DIR, "scaler_RNN_joblib.pkl")
    
    result = {
        "status": "error",
        "message": "",
        "model_loaded": False,
        "scaler_loaded": False
    }
    
    # Verificar existencia de directorios
    if not os.path.exists(MODELO_DIR):
        os.makedirs(MODELO_DIR, exist_ok=True)
        result["message"] = f"Se creó el directorio de modelos en: {MODELO_DIR}"
    
    if not os.path.exists(SCALER_DIR):
        os.makedirs(SCALER_DIR, exist_ok=True)
        result["message"] += f". Se creó el directorio de escaladores en: {SCALER_DIR}"
    
    # Intentar cargar el modelo
    try:
        if os.path.exists(model_path):
            modelo = load_model(model_path)
            result["model_loaded"] = True
            log_info(f"Modelo cargado correctamente desde: {model_path}")
        else:
            log_warning(f"Archivo de modelo no encontrado en: {model_path}")
            modelo = None
    except Exception as e:
        error_msg = f"Error al cargar el modelo: {str(e)}"
        log_error(e, error_msg)
        modelo = None
        result["message"] = error_msg
    
    # Intentar cargar el escalador - Primero con joblib, luego con pickle como respaldo
    try:
        # Intentar primero con joblib (más robusto para objetos scikit-learn)
        if os.path.exists(scaler_joblib_path):
            scaler = joblib.load(scaler_joblib_path)
            result["scaler_loaded"] = True
            log_info(f"Escalador cargado correctamente con joblib desde: {scaler_joblib_path}")
        # Si no existe, intentar con pickle
        elif os.path.exists(scaler_path):
            with open(scaler_path, 'rb') as f:
                scaler = pickle.load(f)
            result["scaler_loaded"] = True
            log_info(f"Escalador cargado correctamente con pickle desde: {scaler_path}")
        else:
            log_warning(f"Archivos de escalador no encontrados en: {scaler_path} o {scaler_joblib_path}")
            scaler = None
    except Exception as e:
        error_msg = f"Error al cargar el escalador: {str(e)}"
        log_error(e, error_msg)
        scaler = None
        if result["message"]:
            result["message"] += f". {error_msg}"
        else:
            result["message"] = error_msg
    
    # Establecer estado general
    if result["model_loaded"] and result["scaler_loaded"]:
        result["status"] = "ok"
        if not result["message"]:
            result["message"] = "Modelo y escalador cargados correctamente"
    elif result["model_loaded"]:
        result["status"] = "partial"
        if not result["message"]:
            result["message"] = "Modelo cargado correctamente, pero no se pudo cargar el escalador"
    elif result["scaler_loaded"]:
        result["status"] = "partial"
        if not result["message"]:
            result["message"] = "Escalador cargado correctamente, pero no se pudo cargar el modelo"
    
    return result

def load_model_safely(model_path: str) -> Optional[Any]:
    """
    Carga un modelo desde una ruta específica de forma segura.
    
    Args:
        model_path (str): Ruta al archivo del modelo.
        
    Returns:
        Optional[Any]: Modelo cargado o None si ocurre un error.
    """
    try:
        if os.path.exists(model_path):
            model = load_model(model_path)
            log_info(f"Modelo cargado correctamente desde: {model_path}")
            return model
        else:
            log_warning(f"Archivo de modelo no encontrado en: {model_path}")
            return None
    except Exception as e:
        error_msg = f"Error al cargar el modelo desde {model_path}: {str(e)}"
        log_error(e, error_msg)
        return None

def load_scaler_safely(scaler_path: str) -> Optional[Any]:
    """
    Carga un escalador desde una ruta específica de forma segura.
    
    Args:
        scaler_path (str): Ruta al archivo del escalador.
        
    Returns:
        Optional[Any]: Escalador cargado o None si ocurre un error.
    """
    try:
        if os.path.exists(scaler_path):
            # Intentar cargar con joblib primero (mejor para objetos scikit-learn)
            if scaler_path.endswith('_joblib.pkl'):
                scaler_obj = joblib.load(scaler_path)
                log_info(f"Escalador cargado correctamente con joblib desde: {scaler_path}")
            else:
                # Intentar con pickle si no es un archivo joblib
                with open(scaler_path, 'rb') as f:
                    scaler_obj = pickle.load(f)
                log_info(f"Escalador cargado correctamente con pickle desde: {scaler_path}")
            return scaler_obj
        else:
            log_warning(f"Archivo de escalador no encontrado en: {scaler_path}")
            return None
    except Exception as e:
        error_msg = f"Error al cargar el escalador desde {scaler_path}: {str(e)}"
        log_error(e, error_msg)
        return None

def load_model_and_scaler_by_paths(model_path: str, scaler_path: str) -> Tuple[Optional[Any], Optional[Any]]:
    """
    Carga un modelo y escalador específicos por sus rutas.
    
    Args:
        model_path (str): Ruta al archivo del modelo.
        scaler_path (str): Ruta al archivo del escalador.
        
    Returns:
        Tuple[Optional[Any], Optional[Any]]: Tupla (modelo, escalador), cualquiera puede ser None si ocurre un error.
    """
    model = load_model_safely(model_path)
    scaler = load_scaler_safely(scaler_path)
    return model, scaler 