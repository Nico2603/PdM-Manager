from sqlalchemy.orm import Session
from app.logger import log_info, log_error

def notify_alert(db: Session, alert_id: int, severity: int, sensor_name: str):
    """
    Maneja notificaciones cuando se genera una alerta.
    Actualmente solo registra en logs, pero puede expandirse para
    enviar emails, SMS, webhooks, etc.
    
    Args:
        db: Sesión de base de datos
        alert_id: ID de la alerta generada
        severity: Nivel de severidad de la alerta (1, 2, 3)
        sensor_name: Nombre del sensor que generó la alerta
    """
    # Definir nivel de prioridad basado en la severidad
    priority_levels = {
        1: "BAJA",
        2: "MEDIA", 
        3: "ALTA"
    }
    priority = priority_levels.get(severity, "DESCONOCIDA")
    
    # Registrar en logs
    log_info(f"NOTIFICACIÓN DE ALERTA: ID={alert_id}, Sensor={sensor_name}, Severidad={severity}, Prioridad={priority}")
    
    # TODO: Implementar notificaciones reales según necesidades:
    # - Envío de emails
    # - SMS
    # - Integraciones con sistemas de tickets/alertas
    # - Webhooks a otros sistemas
    
    return True 