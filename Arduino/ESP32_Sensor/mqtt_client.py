#!/usr/bin/env python3
"""
Cliente MQTT para PdM-Manager
Recibe datos de sensores ESP32 vía MQTT y los envía al backend FastAPI
"""

import json
import logging
import time
import requests
import paho.mqtt.client as mqtt
from datetime import datetime
from typing import Optional
import sys
import os

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('mqtt_client.log')
    ]
)
logger = logging.getLogger("mqtt_client")

class MQTTToAPIBridge:
    """
    Cliente MQTT que recibe datos de sensores y los envía al backend FastAPI
    """
    
    def __init__(self, 
                 mqtt_broker: str = "broker.hivemq.com",
                 mqtt_port: int = 1883,
                 mqtt_user: str = "",
                 mqtt_password: str = "",
                 api_base_url: str = "http://localhost:8000",
                 topic: str = "GL_Ingenieros/sensores/vibracion"):
        
        self.mqtt_broker = mqtt_broker
        self.mqtt_port = mqtt_port
        self.mqtt_user = mqtt_user
        self.mqtt_password = mqtt_password
        self.api_base_url = api_base_url
        self.topic = topic
        
        # Estadísticas
        self.messages_received = 0
        self.messages_sent = 0
        self.errors = 0
        
        # Cliente MQTT
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Configurar autenticación si es necesaria
        if mqtt_user and mqtt_password:
            self.client.username_pw_set(mqtt_user, mqtt_password)
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback cuando se conecta al broker MQTT"""
        if rc == 0:
            logger.info(f"✓ Conectado al broker MQTT: {self.mqtt_broker}:{self.mqtt_port}")
            
            # Suscribirse al tema
            client.subscribe(self.topic)
            logger.info(f"✓ Suscrito al tema: {self.topic}")
            
            # Suscribirse también a comandos (opcional)
            command_topic = "GL_Ingenieros/sensores/comandos/+"
            client.subscribe(command_topic)
            logger.info(f"✓ Suscrito a comandos: {command_topic}")
            
        else:
            logger.error(f"✗ Error de conexión MQTT. Código: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback cuando se desconecta del broker MQTT"""
        logger.warning(f"⚠️ Desconectado del broker MQTT. Código: {rc}")
        if rc != 0:
            logger.info("Intentando reconectar...")
    
    def on_message(self, client, userdata, msg):
        """Callback cuando se recibe un mensaje MQTT"""
        try:
            self.messages_received += 1
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            logger.info(f"📨 Mensaje recibido en '{topic}': {payload}")
            
            # Procesar mensajes de datos de sensores
            if topic == self.topic:
                self.process_sensor_data(payload)
            # Procesar comandos (opcional)
            elif "comandos" in topic:
                self.process_command(topic, payload)
                
        except Exception as e:
            self.errors += 1
            logger.error(f"✗ Error procesando mensaje: {str(e)}")
    
    def process_sensor_data(self, payload: str):
        """Procesa los datos del sensor y los envía al backend"""
        try:
            # Parsear JSON
            data = json.loads(payload)
            
            # Validar datos requeridos
            required_fields = ['sensor_id', 'timestamp', 'acceleration_x', 'acceleration_y', 'acceleration_z']
            for field in required_fields:
                if field not in data:
                    logger.error(f"✗ Campo requerido faltante: {field}")
                    return
            
            # Enviar al backend FastAPI
            response = self.send_to_api(data)
            
            if response and response.status_code in [200, 201]:
                self.messages_sent += 1
                logger.info(f"✓ Datos enviados al backend para sensor {data['sensor_id']}")
                
                # Log de respuesta del backend
                try:
                    api_response = response.json()
                    if 'calculated_severity' in api_response:
                        logger.info(f"  → Severidad calculada: {api_response['calculated_severity']}")
                except:
                    pass
            else:
                self.errors += 1
                logger.error(f"✗ Error enviando al backend: {response.status_code if response else 'Sin respuesta'}")
                
        except json.JSONDecodeError:
            self.errors += 1
            logger.error(f"✗ Error parseando JSON: {payload}")
        except Exception as e:
            self.errors += 1
            logger.error(f"✗ Error procesando datos del sensor: {str(e)}")
    
    def process_command(self, topic: str, payload: str):
        """Procesa comandos recibidos vía MQTT"""
        try:
            logger.info(f"🔧 Comando recibido en {topic}: {payload}")
            
            # Extraer sensor_id del tema
            sensor_id = topic.split('/')[-1]
            
            # Procesar comandos específicos
            if payload == "status":
                self.send_status_update(sensor_id)
            elif payload == "stats":
                self.log_statistics()
            else:
                logger.info(f"Comando desconocido: {payload}")
                
        except Exception as e:
            logger.error(f"✗ Error procesando comando: {str(e)}")
    
    def send_to_api(self, data: dict) -> Optional[requests.Response]:
        """Envía datos al endpoint del backend FastAPI"""
        try:
            url = f"{self.api_base_url}/sensor-data"
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Timeout de 10 segundos
            response = requests.post(url, json=data, headers=headers, timeout=10)
            
            if response.status_code not in [200, 201]:
                logger.error(f"API Error {response.status_code}: {response.text}")
            
            return response
            
        except requests.exceptions.Timeout:
            logger.error("✗ Timeout enviando al backend")
            return None
        except requests.exceptions.ConnectionError:
            logger.error("✗ Error de conexión con el backend")
            return None
        except Exception as e:
            logger.error(f"✗ Error enviando al backend: {str(e)}")
            return None
    
    def send_status_update(self, sensor_id: str):
        """Envía actualización de estado para un sensor"""
        status = {
            "client_status": "running",
            "messages_received": self.messages_received,
            "messages_sent": self.messages_sent,
            "errors": self.errors,
            "timestamp": datetime.now().isoformat()
        }
        
        response_topic = f"GL_Ingenieros/status/{sensor_id}"
        self.client.publish(response_topic, json.dumps(status))
        logger.info(f"📤 Estado enviado a {response_topic}")
    
    def log_statistics(self):
        """Registra estadísticas del cliente"""
        uptime = time.time() - self.start_time
        logger.info("📊 Estadísticas del cliente MQTT:")
        logger.info(f"  • Tiempo activo: {uptime:.1f} segundos")
        logger.info(f"  • Mensajes recibidos: {self.messages_received}")
        logger.info(f"  • Mensajes enviados: {self.messages_sent}")
        logger.info(f"  • Errores: {self.errors}")
        
        if self.messages_received > 0:
            success_rate = (self.messages_sent / self.messages_received) * 100
            logger.info(f"  • Tasa de éxito: {success_rate:.1f}%")
    
    def start(self):
        """Inicia el cliente MQTT"""
        try:
            self.start_time = time.time()
            logger.info("🚀 Iniciando cliente MQTT para PdM-Manager...")
            logger.info(f"  • Broker: {self.mqtt_broker}:{self.mqtt_port}")
            logger.info(f"  • Tema: {self.topic}")
            logger.info(f"  • Backend: {self.api_base_url}")
            
            # Verificar conectividad con el backend
            try:
                health_url = f"{self.api_base_url}/health"
                response = requests.get(health_url, timeout=5)
                if response.status_code == 200:
                    logger.info("✓ Backend FastAPI alcanzable")
                else:
                    logger.warning(f"⚠️ Backend respondió con código {response.status_code}")
            except Exception as e:
                logger.warning(f"⚠️ No se puede alcanzar el backend: {str(e)}")
                logger.info("Continuando de todos modos...")
            
            # Conectar al broker MQTT
            self.client.connect(self.mqtt_broker, self.mqtt_port, 60)
            
            # Bucle principal
            self.client.loop_forever()
            
        except KeyboardInterrupt:
            logger.info("⏹️ Deteniendo cliente MQTT...")
            self.client.disconnect()
            self.log_statistics()
        except Exception as e:
            logger.error(f"✗ Error crítico: {str(e)}")
            raise


def main():
    """Función principal"""
    # Configuración (puedes cambiar estos valores)
    config = {
        'mqtt_broker': 'broker.hivemq.com',
        'mqtt_port': 1883,
        'mqtt_user': '',  # Vacío para broker público
        'mqtt_password': '',  # Vacío para broker público
        'api_base_url': 'http://localhost:8000',  # Cambia si tu backend está en otra IP
        'topic': 'GL_Ingenieros/sensores/vibracion'
    }
    
    # Permitir override desde variables de entorno
    config['mqtt_broker'] = os.getenv('MQTT_BROKER', config['mqtt_broker'])
    config['mqtt_port'] = int(os.getenv('MQTT_PORT', config['mqtt_port']))
    config['api_base_url'] = os.getenv('API_BASE_URL', config['api_base_url'])
    
    logger.info("🔧 Configuración del cliente MQTT:")
    for key, value in config.items():
        if 'password' not in key.lower():
            logger.info(f"  • {key}: {value}")
    
    # Crear y iniciar cliente
    bridge = MQTTToAPIBridge(**config)
    bridge.start()


if __name__ == "__main__":
    main()