# app/mqtt_client.py
import os
import json
import time
import logging
from datetime import datetime
from typing import Optional, Callable, Any
import asyncio
from threading import Thread

import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.crud import create_vibration_data, get_sensors, create_alert, update_sensor_last_status
from app.crud_config import get_system_config, get_model_by_id
from app.models import VibrationData

# Configuración de logging
logger = logging.getLogger("pdm_manager.mqtt_client")

class MQTTProcessor:
    """
    Cliente MQTT integrado con PdM Manager que procesa datos de sensores
    usando la misma lógica de ML que el endpoint HTTP.
    """
    
    def __init__(self, ml_processor_func: Optional[Callable] = None):
        """
        Inicializa el procesador MQTT.
        
        Args:
            ml_processor_func: Función para procesar ML (se pasará desde main.py)
        """
        # Configuración MQTT desde variables de entorno
        self.mqtt_broker = os.getenv("MQTT_BROKER", "broker.hivemq.com")
        self.mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
        self.mqtt_topic = os.getenv("MQTT_TOPIC", "GL_Ingenieros/sensores/vibracion")
        self.mqtt_username = os.getenv("MQTT_USERNAME", None)
        self.mqtt_password = os.getenv("MQTT_PASSWORD", None)
        
        # Cliente MQTT
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Configurar autenticación si está disponible
        if self.mqtt_username and self.mqtt_password:
            self.client.username_pw_set(self.mqtt_username, self.mqtt_password)
        
        # Función de procesamiento ML (se inyecta desde main.py)
        self.ml_processor = ml_processor_func
        
        # Control de ejecución
        self.running = False
        self.thread = None
        
    def on_connect(self, client, userdata, flags, rc):
        """Callback de conexión MQTT."""
        if rc == 0:
            logger.info(f"Conectado al broker MQTT {self.mqtt_broker}:{self.mqtt_port}")
            client.subscribe(self.mqtt_topic)
            logger.info(f"Suscrito al tópico: {self.mqtt_topic}")
        else:
            logger.error(f"Error de conexión MQTT rc={rc}")

    def on_disconnect(self, client, userdata, rc):
        """Callback de desconexión MQTT."""
        logger.warning(f"Desconectado del broker MQTT rc={rc}")

    def on_message(self, client, userdata, msg):
        """
        Procesa mensajes MQTT recibidos.
        Usa la misma lógica de procesamiento que el endpoint HTTP.
        """
        try:
            payload = msg.payload.decode("utf-8", errors="ignore")
            logger.info(f"Mensaje MQTT recibido en {msg.topic}: {payload}")
            
            # Parsear JSON
            data = json.loads(payload)
            
            # Validar campos requeridos
            required_fields = ["sensor_id", "timestamp", "acceleration_x", "acceleration_y", "acceleration_z"]
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Campo requerido faltante: {field}")
            
            # Procesar los datos usando la misma lógica del endpoint HTTP
            self._process_sensor_data(data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Error al parsear JSON del mensaje MQTT: {e}")
        except ValueError as e:
            logger.error(f"Error de validación en mensaje MQTT: {e}")
        except Exception as e:
            logger.error(f"Error inesperado procesando mensaje MQTT: {e}", exc_info=True)

    def _process_sensor_data(self, data: dict):
        """
        Procesa los datos del sensor usando la misma lógica que el endpoint HTTP.
        """
        db = SessionLocal()
        try:
            sensor_id = int(data["sensor_id"])
            logger.info(f"Procesando datos MQTT del sensor {sensor_id}")
            
            # Validar que el sensor existe (misma lógica que endpoint HTTP)
            sensor = get_sensors(db=db, sensor_id=sensor_id)
            if not sensor:
                logger.warning(f"Sensor {sensor_id} no registrado en la base de datos")
                return
            
            # Obtener configuración del sistema
            system_config = get_system_config(db)
            is_sys_configured = system_config.is_configured == 1
            active_model_id = system_config.active_model_id
            
            # Valores por defecto para severidad/anomalía
            severidad = 0
            anomalia = False
            
            # Procesar con ML si está configurado y hay función de procesamiento
            if is_sys_configured and active_model_id and self.ml_processor:
                logger.info(f"Sistema configurado con modelo activo ID {active_model_id}. Ejecutando ML...")
                try:
                    # Preparar datos para el procesador ML
                    ml_data = {
                        'sensor_id': sensor_id,
                        'acceleration_x': float(data["acceleration_x"]),
                        'acceleration_y': float(data["acceleration_y"]),
                        'acceleration_z': float(data["acceleration_z"]),
                        'timestamp': data["timestamp"]
                    }
                    
                    # Llamar al procesador ML (función inyectada desde main.py)
                    ml_result = self.ml_processor(ml_data, db)
                    if ml_result:
                        severidad = ml_result.get('severity', 0)
                        anomalia = ml_result.get('is_anomaly', False)
                        logger.info(f"ML procesado para sensor {sensor_id}: anomalía={anomalia}, severidad={severidad}")
                    
                except Exception as e:
                    logger.error(f"Error durante procesamiento ML para sensor {sensor_id}: {str(e)}", exc_info=True)
            else:
                logger.info(f"Sistema no configurado o sin modelo activo. Guardando datos crudos para sensor {sensor_id}.")
            
            # Guardar los datos en la base de datos (siempre se guardan)
            try:
                # Parsear timestamp
                timestamp = self._parse_timestamp(data.get("timestamp"))
                
                db_data = create_vibration_data(
                    db=db,
                    sensor_id=sensor_id,
                    acceleration_x=float(data["acceleration_x"]),
                    acceleration_y=float(data["acceleration_y"]),
                    acceleration_z=float(data["acceleration_z"]),
                    date=timestamp,
                    severity=severidad,
                    is_anomaly=1 if anomalia else 0
                )
                
                # Crear alerta si la severidad es alta
                if severidad >= 2:
                    create_alert(
                        db=db,
                        sensor_id=sensor_id,
                        error_type=severidad,
                        data_id=db_data.data_id,
                        timestamp=timestamp
                    )
                    logger.warning(f"Alerta creada para sensor {sensor_id} con severidad {severidad}")
                
                # Actualizar el último estado del sensor
                update_sensor_last_status(
                    db=db,
                    sensor_id=sensor_id,
                    is_anomaly=anomalia,
                    severity=severidad,
                    timestamp=timestamp
                )
                
                logger.info(f"✓ Datos MQTT guardados para sensor {sensor_id}. Severidad: {severidad}")
                
            except Exception as e:
                logger.error(f"Error al guardar datos MQTT en BD para sensor {sensor_id}: {str(e)}", exc_info=True)
                db.rollback()
                
        except Exception as e:
            logger.error(f"Error general procesando datos MQTT: {str(e)}", exc_info=True)
            db.rollback()
        finally:
            db.close()

    def _parse_timestamp(self, ts_value: Optional[str]) -> datetime:
        """
        Parsea timestamp con el mismo formato que el ingestor original.
        """
        if not ts_value:
            return datetime.utcnow()
        
        try:
            # Aceptar ISO8601 con Z
            ts_norm = ts_value.replace("Z", "+00:00")
            return datetime.fromisoformat(ts_norm)
        except Exception:
            return datetime.utcnow()

    def start(self):
        """
        Inicia el cliente MQTT en un hilo separado.
        """
        if self.running:
            logger.warning("Cliente MQTT ya está ejecutándose")
            return
        
        self.running = True
        self.thread = Thread(target=self._run_mqtt_loop, daemon=True)
        self.thread.start()
        logger.info("Cliente MQTT iniciado en hilo separado")

    def stop(self):
        """
        Detiene el cliente MQTT.
        """
        if not self.running:
            return
        
        self.running = False
        if self.client:
            self.client.disconnect()
        
        if self.thread:
            self.thread.join(timeout=5)
        
        logger.info("Cliente MQTT detenido")

    def _run_mqtt_loop(self):
        """
        Ejecuta el bucle principal del cliente MQTT.
        """
        logger.info("Iniciando bucle MQTT...")
        
        while self.running:
            try:
                logger.info(f"Conectando al broker MQTT {self.mqtt_broker}:{self.mqtt_port}")
                self.client.connect(self.mqtt_broker, self.mqtt_port, 60)
                self.client.loop_forever()
            except Exception as e:
                logger.error(f"Error en cliente MQTT: {e}")
                if self.running:
                    logger.info("Reintentando conexión MQTT en 5 segundos...")
                    time.sleep(5)
        
        logger.info("Bucle MQTT finalizado")

    def is_running(self) -> bool:
        """
        Verifica si el cliente MQTT está ejecutándose.
        """
        return self.running and self.thread and self.thread.is_alive()


# Instancia global del procesador MQTT
mqtt_processor: Optional[MQTTProcessor] = None

def init_mqtt_client(ml_processor_func: Callable) -> MQTTProcessor:
    """
    Inicializa el cliente MQTT con la función de procesamiento ML.
    """
    global mqtt_processor
    mqtt_processor = MQTTProcessor(ml_processor_func)
    return mqtt_processor

def start_mqtt_client():
    """
    Inicia el cliente MQTT si está configurado.
    """
    global mqtt_processor
    if mqtt_processor:
        mqtt_processor.start()
    else:
        logger.warning("Cliente MQTT no inicializado")

def stop_mqtt_client():
    """
    Detiene el cliente MQTT.
    """
    global mqtt_processor
    if mqtt_processor:
        mqtt_processor.stop()

def get_mqtt_status() -> dict:
    """
    Obtiene el estado actual del cliente MQTT.
    """
    global mqtt_processor
    if not mqtt_processor:
        return {"status": "not_initialized", "running": False}
    
    return {
        "status": "initialized",
        "running": mqtt_processor.is_running(),
        "broker": mqtt_processor.mqtt_broker,
        "port": mqtt_processor.mqtt_port,
        "topic": mqtt_processor.mqtt_topic
    }
