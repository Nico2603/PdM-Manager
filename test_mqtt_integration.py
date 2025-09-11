#!/usr/bin/env python3
"""
Script de prueba para la integración MQTT en PdM Manager.
Este script envía datos de prueba al broker MQTT y verifica que se insertaron correctamente en PostgreSQL.
"""

import json
import time
import random
from datetime import datetime, timezone
import paho.mqtt.client as mqtt
import argparse
import os
import sys
from typing import List, Dict, Any

# Importar dependencias para PostgreSQL
try:
    import psycopg2
    from psycopg2.extras import DictCursor
    import requests
except ImportError as e:
    print(f"❌ Error: Falta instalar dependencias. Ejecuta: pip install psycopg2-binary requests")
    print(f"   Detalle del error: {e}")
    sys.exit(1)

def generate_test_data(sensor_id: int = 1) -> dict:
    """Genera datos de prueba simulando un sensor de vibración."""
    return {
        "sensor_id": sensor_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "acceleration_x": round(random.uniform(-3.0, 3.0), 3),
        "acceleration_y": round(random.uniform(7.0, 13.0), 3),
        "acceleration_z": round(random.uniform(-3.0, 2.0), 3)
    }

class DatabaseVerifier:
    """Verifica que los datos se insertaron correctamente en PostgreSQL."""
    
    def __init__(self, db_host="localhost", db_port=5432, db_name="PdM", 
                 db_user="postgres", db_password="pdm123"):
        self.db_config = {
            "host": db_host,
            "port": db_port,
            "database": db_name,
            "user": db_user,
            "password": db_password
        }
        self.conn = None
    
    def connect(self) -> bool:
        """Conecta a la base de datos PostgreSQL."""
        try:
            self.conn = psycopg2.connect(**self.db_config)
            print(f"✅ Conectado a PostgreSQL: {self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}")
            return True
        except Exception as e:
            print(f"❌ Error conectando a PostgreSQL: {e}")
            return False
    
    def disconnect(self):
        """Desconecta de la base de datos."""
        if self.conn:
            self.conn.close()
            print("👋 Desconectado de PostgreSQL")
    
    def check_sensor_exists(self, sensor_id: int) -> bool:
        """Verifica si el sensor existe en la base de datos."""
        if not self.conn:
            return False
        
        try:
            with self.conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("SELECT sensor_id, name FROM public.sensor WHERE sensor_id = %s", (sensor_id,))
                result = cur.fetchone()
                if result:
                    print(f"✅ Sensor {sensor_id} encontrado: {result['name']}")
                    return True
                else:
                    print(f"⚠️  Sensor {sensor_id} NO encontrado en la base de datos")
                    return False
        except Exception as e:
            print(f"❌ Error verificando sensor: {e}")
            return False
    
    def get_recent_vibration_data(self, sensor_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Obtiene los datos de vibración más recientes para un sensor."""
        if not self.conn:
            return []
        
        try:
            with self.conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT data_id, sensor_id, date, acceleration_x, acceleration_y, acceleration_z, 
                           severity, is_anomaly
                    FROM public.vibration_data 
                    WHERE sensor_id = %s 
                    ORDER BY date DESC 
                    LIMIT %s
                """, (sensor_id, limit))
                
                results = cur.fetchall()
                return [dict(row) for row in results]
        except Exception as e:
            print(f"❌ Error obteniendo datos de vibración: {e}")
            return []
    
    def get_recent_alerts(self, sensor_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """Obtiene las alertas más recientes para un sensor."""
        if not self.conn:
            return []
        
        try:
            with self.conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT log_id, sensor_id, timestamp, error_type, data_id
                    FROM public.alert 
                    WHERE sensor_id = %s 
                    ORDER BY timestamp DESC 
                    LIMIT %s
                """, (sensor_id, limit))
                
                results = cur.fetchall()
                return [dict(row) for row in results]
        except Exception as e:
            print(f"❌ Error obteniendo alertas: {e}")
            return []
    
    def count_data_since(self, sensor_id: int, since_time: datetime) -> int:
        """Cuenta los registros insertados desde un tiempo específico."""
        if not self.conn:
            return 0
        
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM public.vibration_data 
                    WHERE sensor_id = %s AND date >= %s
                """, (sensor_id, since_time))
                
                result = cur.fetchone()
                return result[0] if result else 0
        except Exception as e:
            print(f"❌ Error contando registros: {e}")
            return 0

def check_pdm_manager_status(api_url: str = "http://localhost:8000") -> bool:
    """Verifica si PdM Manager está ejecutándose y funcionando."""
    try:
        # Verificar endpoint de salud
        response = requests.get(f"{api_url}/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ PdM Manager está ejecutándose")
            print(f"   - Estado: {health_data.get('status', 'unknown')}")
            print(f"   - Base de datos: {health_data.get('database', 'unknown')}")
            print(f"   - Modelos ML: {health_data.get('models', 'unknown')}")
            print(f"   - MQTT: {health_data.get('mqtt', 'unknown')}")
            return True
        else:
            print(f"⚠️  PdM Manager responde pero con error: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ PdM Manager no está accesible: {e}")
        print(f"   Asegúrate de que esté ejecutándose en {api_url}")
        return False

def check_mqtt_status(api_url: str = "http://localhost:8000") -> bool:
    """Verifica el estado específico del cliente MQTT."""
    try:
        response = requests.get(f"{api_url}/mqtt/status", timeout=5)
        if response.status_code == 200:
            mqtt_data = response.json()
            mqtt_info = mqtt_data.get('mqtt', {})
            print(f"✅ Estado MQTT obtenido:")
            print(f"   - Estado: {mqtt_info.get('status', 'unknown')}")
            print(f"   - Ejecutándose: {mqtt_info.get('running', False)}")
            print(f"   - Broker: {mqtt_info.get('broker', 'unknown')}")
            print(f"   - Puerto: {mqtt_info.get('port', 'unknown')}")
            print(f"   - Tópico: {mqtt_info.get('topic', 'unknown')}")
            return mqtt_info.get('running', False)
        else:
            print(f"⚠️  Error obteniendo estado MQTT: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Error verificando estado MQTT: {e}")
        return False

def on_connect(client, userdata, flags, rc):
    """Callback de conexión MQTT."""
    if rc == 0:
        print(f"✅ Conectado al broker MQTT")
    else:
        print(f"❌ Error de conexión MQTT rc={rc}")

def on_publish(client, userdata, mid):
    """Callback de publicación MQTT."""
    print(f"✅ Mensaje publicado (mid: {mid})")

def main():
    parser = argparse.ArgumentParser(description="Envía datos de prueba al broker MQTT y verifica la inserción en PostgreSQL")
    parser.add_argument("--broker", default="broker.hivemq.com", help="Broker MQTT (default: broker.hivemq.com)")
    parser.add_argument("--port", type=int, default=1883, help="Puerto MQTT (default: 1883)")
    parser.add_argument("--topic", default="GL_Ingenieros/sensores/vibracion", help="Tópico MQTT")
    parser.add_argument("--sensor-id", type=int, default=1, help="ID del sensor (default: 1)")
    parser.add_argument("--count", type=int, default=3, help="Número de mensajes a enviar (default: 3)")
    parser.add_argument("--interval", type=float, default=2.0, help="Intervalo entre mensajes en segundos (default: 2.0)")
    parser.add_argument("--username", help="Usuario MQTT (opcional)")
    parser.add_argument("--password", help="Contraseña MQTT (opcional)")
    parser.add_argument("--api-url", default="http://localhost:8000", help="URL de PdM Manager API")
    parser.add_argument("--db-host", default="localhost", help="Host de PostgreSQL")
    parser.add_argument("--db-port", type=int, default=5432, help="Puerto de PostgreSQL")
    parser.add_argument("--db-name", default="PdM", help="Nombre de la base de datos")
    parser.add_argument("--db-user", default="postgres", help="Usuario de PostgreSQL")
    parser.add_argument("--db-password", default="pdm123", help="Contraseña de PostgreSQL")
    parser.add_argument("--skip-verification", action="store_true", help="Saltar verificación de PdM Manager")
    parser.add_argument("--verify-only", action="store_true", help="Solo verificar datos existentes sin enviar nuevos")
    
    args = parser.parse_args()
    
    print("🚀 Script de prueba MQTT para PdM Manager")
    print("=" * 60)
    
    # Verificar que PdM Manager esté ejecutándose
    if not args.skip_verification and not args.verify_only:
        print("\n🔍 1. Verificando estado de PdM Manager...")
        if not check_pdm_manager_status(args.api_url):
            print("❌ PdM Manager no está ejecutándose. Inicia el servidor primero:")
            print("   python -m uvicorn app.main:app --reload")
            return
        
        print("\n🔍 2. Verificando estado del cliente MQTT...")
        mqtt_running = check_mqtt_status(args.api_url)
        if not mqtt_running:
            print("⚠️  El cliente MQTT interno no está ejecutándose, pero continuaremos...")
    
    # Configurar conexión a la base de datos
    print(f"\n🗄️  3. Conectando a PostgreSQL...")
    db_verifier = DatabaseVerifier(
        db_host=args.db_host,
        db_port=args.db_port,
        db_name=args.db_name,
        db_user=args.db_user,
        db_password=args.db_password
    )
    
    if not db_verifier.connect():
        print("❌ No se pudo conectar a PostgreSQL. Verifica las credenciales.")
        return
    
    try:
        # Verificar que el sensor existe
        print(f"\n🔍 4. Verificando que el sensor {args.sensor_id} existe...")
        if not db_verifier.check_sensor_exists(args.sensor_id):
            print(f"⚠️  El sensor {args.sensor_id} no existe. Creando sensor de prueba...")
            # Aquí podrías añadir lógica para crear el sensor automáticamente
            print("   Puedes crear el sensor manualmente desde la interfaz web de PdM Manager")
            print("   o usar la API POST /sensors")
        
        # Obtener conteo inicial de datos
        start_time = datetime.now(timezone.utc)
        initial_count = db_verifier.count_data_since(args.sensor_id, start_time)
        print(f"📊 Registros iniciales para sensor {args.sensor_id}: {initial_count}")
        
        if args.verify_only:
            print(f"\n📋 Verificando datos existentes...")
            recent_data = db_verifier.get_recent_vibration_data(args.sensor_id, 5)
            if recent_data:
                print(f"✅ Se encontraron {len(recent_data)} registros recientes:")
                for data in recent_data:
                    print(f"   - ID: {data['data_id']}, Fecha: {data['date']}, "
                          f"Severidad: {data['severity']}, Anomalía: {data['is_anomaly']}")
            else:
                print("❌ No se encontraron datos recientes")
            
            recent_alerts = db_verifier.get_recent_alerts(args.sensor_id, 3)
            if recent_alerts:
                print(f"🚨 Se encontraron {len(recent_alerts)} alertas recientes:")
                for alert in recent_alerts:
                    print(f"   - ID: {alert['log_id']}, Fecha: {alert['timestamp']}, "
                          f"Tipo: {alert['error_type']}")
            else:
                print("✅ No hay alertas recientes")
            return
        
        # Configurar cliente MQTT
        print(f"\n📡 5. Configurando cliente MQTT...")
        client = mqtt.Client()
        client.on_connect = on_connect
        client.on_publish = on_publish
        
        # Configurar autenticación si se proporciona
        if args.username and args.password:
            client.username_pw_set(args.username, args.password)
            print(f"🔐 Autenticación configurada para usuario: {args.username}")
        
        print(f"🔄 Conectando a {args.broker}:{args.port}")
        client.connect(args.broker, args.port, 60)
        client.loop_start()
        
        print(f"\n📤 6. Enviando {args.count} mensaje(s) de prueba...")
        print(f"   Tópico: {args.topic}")
        print(f"   Sensor ID: {args.sensor_id}")
        print(f"   Intervalo: {args.interval}s")
        print("-" * 50)
        
        sent_messages = []
        
        for i in range(args.count):
            # Generar datos de prueba
            test_data = generate_test_data(args.sensor_id)
            sent_messages.append(test_data)
            
            # Convertir a JSON
            message = json.dumps(test_data, indent=2)
            
            print(f"📤 Enviando mensaje {i+1}/{args.count}:")
            print(f"   Timestamp: {test_data['timestamp']}")
            print(f"   Aceleración X: {test_data['acceleration_x']}")
            print(f"   Aceleración Y: {test_data['acceleration_y']}")
            print(f"   Aceleración Z: {test_data['acceleration_z']}")
            
            # Publicar mensaje
            result = client.publish(args.topic, message)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"   ✅ Mensaje enviado correctamente")
            else:
                print(f"   ❌ Error enviando mensaje: {result.rc}")
            
            # Esperar antes del siguiente mensaje (si hay más)
            if i < args.count - 1:
                print(f"   ⏳ Esperando {args.interval}s...")
                time.sleep(args.interval)
            
            print()
        
        print("🎉 Todos los mensajes enviados")
        
        # Esperar un poco para que se procesen los mensajes
        print(f"\n⏳ Esperando 5 segundos para que se procesen los mensajes...")
        time.sleep(5)
        
        # Verificar que se insertaron los datos
        print(f"\n🔍 7. Verificando inserción en la base de datos...")
        final_count = db_verifier.count_data_since(args.sensor_id, start_time)
        new_records = final_count - initial_count
        
        print(f"📊 Registros nuevos insertados: {new_records}")
        print(f"📊 Total de registros después del test: {final_count}")
        
        if new_records >= args.count:
            print(f"✅ ¡Éxito! Se insertaron al menos {args.count} registros nuevos")
        elif new_records > 0:
            print(f"⚠️  Se insertaron {new_records} registros, pero se esperaban {args.count}")
        else:
            print(f"❌ No se insertaron registros nuevos. Verifica la configuración.")
        
        # Mostrar datos recientes
        print(f"\n📋 Últimos registros insertados:")
        recent_data = db_verifier.get_recent_vibration_data(args.sensor_id, args.count + 2)
        if recent_data:
            for data in recent_data[:args.count + 1]:
                severity_text = ["Normal", "Leve", "Grave", "Crítico"][min(data['severity'], 3)]
                anomaly_text = "Sí" if data['is_anomaly'] else "No"
                print(f"   - ID: {data['data_id']}, Fecha: {data['date']}")
                print(f"     Accel: X={data['acceleration_x']:.3f}, Y={data['acceleration_y']:.3f}, Z={data['acceleration_z']:.3f}")
                print(f"     Severidad: {data['severity']} ({severity_text}), Anomalía: {anomaly_text}")
                print()
        
        # Verificar alertas generadas
        print(f"🚨 Verificando alertas generadas...")
        recent_alerts = db_verifier.get_recent_alerts(args.sensor_id, 5)
        if recent_alerts:
            print(f"✅ Se generaron {len(recent_alerts)} alertas:")
            for alert in recent_alerts:
                error_types = {1: "Leve", 2: "Grave", 3: "Software"}
                error_type_text = error_types.get(alert['error_type'], f"Tipo {alert['error_type']}")
                print(f"   - Alerta ID: {alert['log_id']}, Tipo: {error_type_text}")
                print(f"     Fecha: {alert['timestamp']}, Data ID: {alert['data_id']}")
        else:
            print("ℹ️  No se generaron alertas (severidad < 2)")
        
        client.loop_stop()
        client.disconnect()
        
    except KeyboardInterrupt:
        print("\n⚠️  Interrumpido por el usuario")
    except Exception as e:
        print(f"❌ Error durante la ejecución: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db_verifier.disconnect()
        print("\n👋 Test completado")

if __name__ == "__main__":
    main()
