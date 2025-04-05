# app/utils/data_analysis.py

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

from app.logger import log_error, log_info, log_warning

def sample_data_adaptive(data_list: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    """
    Realiza un muestreo adaptativo de datos, conservando puntos de interés y extremos.
    
    Args:
        data_list (List[Dict[str, Any]]): Lista de datos a muestrear
        limit (int): Número máximo de puntos a retornar
        
    Returns:
        List[Dict[str, Any]]: Lista muestreada de datos
    """
    if len(data_list) <= limit:
        return data_list
    
    try:
        # Convertir a DataFrame para facilitar el procesamiento
        df = pd.DataFrame(data_list)
        
        # Calcular el "interés" de cada punto basado en la severidad y valores extremos
        df['interest'] = df.get('severity', 0)
        
        for col in ['acceleration_x', 'acceleration_y', 'acceleration_z']:
            if col in df.columns:
                # Normalizar al rango [0,1]
                min_val = df[col].min()
                max_val = df[col].max()
                range_val = max_val - min_val
                
                if range_val > 0:
                    normalized = (df[col] - min_val) / range_val
                    # Aumentar interés para valores extremos (cerca de 0 o 1)
                    df['interest'] += abs(normalized - 0.5) * 2
        
        # Ordenar por interés descendente
        df = df.sort_values('interest', ascending=False)
        
        # Tomar los top_n puntos más interesantes
        top_n = min(limit // 3, len(df))
        if top_n > 0:
            most_interesting = df.head(top_n)
            remaining = df.iloc[top_n:].copy()
        else:
            most_interesting = pd.DataFrame()
            remaining = df.copy()
        
        # Para los puntos restantes, hacer un muestreo uniforme
        remaining_samples = limit - len(most_interesting)
        if remaining_samples > 0 and len(remaining) > remaining_samples:
            # Reordenar por fecha
            remaining = remaining.sort_values('date')
            indices = np.linspace(0, len(remaining) - 1, remaining_samples, dtype=int)
            uniform_samples = remaining.iloc[indices]
        else:
            uniform_samples = remaining
        
        # Combinar los puntos interesantes con el muestreo uniforme
        combined = pd.concat([most_interesting, uniform_samples])
        # Reordenar por fecha
        if 'date' in combined.columns:
            combined = combined.sort_values('date')
        
        # Eliminar la columna de interés y convertir de nuevo a lista de diccionarios
        if 'interest' in combined.columns:
            combined = combined.drop('interest', axis=1)
        
        return combined.to_dict(orient='records')
    
    except Exception as e:
        log_error(e, "Error en sample_data_adaptive")
        # En caso de error, aplicar un muestreo uniforme simple
        indices = np.linspace(0, len(data_list) - 1, limit, dtype=int)
        return [data_list[i] for i in indices]

def sample_data_uniform(data_list: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    """
    Realiza un muestreo uniforme de datos.
    
    Args:
        data_list (List[Dict[str, Any]]): Lista de datos a muestrear
        limit (int): Número máximo de puntos a retornar
        
    Returns:
        List[Dict[str, Any]]: Lista muestreada de datos
    """
    if len(data_list) <= limit:
        return data_list
    
    indices = np.linspace(0, len(data_list) - 1, limit, dtype=int)
    return [data_list[i] for i in indices]

def process_vibration_data(
    accel_x: float, 
    accel_y: float, 
    accel_z: float, 
    limit_config: Optional[Any] = None
) -> Tuple[int, Optional[int]]:
    """
    Evalúa los datos de vibración basado en límites de alerta.
    
    Args:
        accel_x (float): Aceleración en el eje X
        accel_y (float): Aceleración en el eje Y
        accel_z (float): Aceleración en el eje Z
        limit_config (Optional[Any]): Configuración de límites
        
    Returns:
        Tuple[int, Optional[int]]: (severity, error_type)
    """
    # Predicción inicial (por defecto: normal)
    severity = 0
    error_type = None
    
    if not limit_config:
        return severity, error_type
    
    # Verificar eje X
    if accel_x < limit_config.x_3inf or accel_x > limit_config.x_3sup:
        severity = 3
        error_type = 3
    elif accel_x < limit_config.x_2inf or accel_x > limit_config.x_2sup:
        severity = max(severity, 2)
        error_type = 2 if severity == 2 else error_type
    
    # Verificar eje Y
    if accel_y < limit_config.y_3inf or accel_y > limit_config.y_3sup:
        severity = 3
        error_type = 3
    elif accel_y < limit_config.y_2inf or accel_y > limit_config.y_2sup:
        severity = max(severity, 2)
        error_type = 2 if severity == 2 else error_type
    
    # Verificar eje Z
    if accel_z < limit_config.z_3inf or accel_z > limit_config.z_3sup:
        severity = 3
        error_type = 3
    elif accel_z < limit_config.z_2inf or accel_z > limit_config.z_2sup:
        severity = max(severity, 2)
        error_type = 2 if severity == 2 else error_type
    
    return severity, error_type

def detect_severity_pattern(db, sensor_id: int, current_date: datetime) -> bool:
    """
    Detecta patrones de severidad 2 en el tiempo que justifiquen una alerta de nivel 3.
    
    Args:
        db: Sesión de base de datos
        sensor_id (int): ID del sensor a analizar
        current_date (datetime): Fecha actual para establecer el intervalo de tiempo
        
    Returns:
        bool: True si se detecta un patrón que requiere alerta nivel 3, False en caso contrario
    """
    from app import models
    
    try:
        # Definir el intervalo de tiempo para buscar el patrón (últimas 24 horas)
        start_date = current_date - timedelta(hours=24)
        
        # Consultar registros con severidad 2 en el intervalo
        severity2_records = db.query(models.VibrationData).filter(
            models.VibrationData.sensor_id == sensor_id,
            models.VibrationData.severity == 2,
            models.VibrationData.date >= start_date,
            models.VibrationData.date <= current_date
        ).order_by(models.VibrationData.date.desc()).all()
        
        # Contar cuántos registros de severidad 2 hay
        severity2_count = len(severity2_records)
        
        # Verificar si ya existe una alerta de nivel 3 en el intervalo
        existing_level3_alert = db.query(models.Alert).filter(
            models.Alert.sensor_id == sensor_id,
            models.Alert.error_type == 3,
            models.Alert.timestamp >= start_date,
            models.Alert.timestamp <= current_date
        ).first()
        
        # Criterios para generar una alerta de nivel 3:
        # 1. Al menos 5 registros de severidad 2 en las últimas 24 horas
        # 2. No existe ya una alerta de nivel 3 en ese intervalo
        if severity2_count >= 5 and not existing_level3_alert:
            log_info(f"Patrón detectado: {severity2_count} eventos de severidad 2 en las últimas 24 horas para sensor {sensor_id}")
            return True
            
        # Criterio alternativo: 3 registros de severidad 2 en la última hora
        if severity2_count >= 3:
            # Verificar si hay al menos 3 en la última hora
            last_hour = current_date - timedelta(hours=1)
            recent_records = [r for r in severity2_records if r.date >= last_hour]
            if len(recent_records) >= 3 and not existing_level3_alert:
                log_info(f"Patrón crítico detectado: {len(recent_records)} eventos de severidad 2 en la última hora para sensor {sensor_id}")
                return True
        
        return False
    except Exception as e:
        log_error(e, f"Error al detectar patrón de severidad para sensor {sensor_id}")
        return False 