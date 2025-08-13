#!/usr/bin/env python3
"""
Script de configuración inicial para PdM-Manager
Configura la base de datos con los datos básicos necesarios
"""

import sys
import os
from datetime import datetime

# Agregar el directorio app al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SessionLocal, engine
from app.models import Base, Sensor, Model, SystemConfig, LimitConfig, User
from app.auth import get_password_hash
from sqlalchemy.exc import SQLAlchemyError

def create_tables():
    """Crear todas las tablas en la base de datos"""
    print("🔧 Creando tablas en la base de datos...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✓ Tablas creadas correctamente")
        return True
    except Exception as e:
        print(f"✗ Error creando tablas: {str(e)}")
        return False

def setup_default_model(db):
    """Configurar modelo por defecto"""
    print("🤖 Configurando modelo por defecto...")
    
    try:
        # Verificar si ya existe un modelo
        existing_model = db.query(Model).first()
        if existing_model:
            print(f"✓ Modelo existente encontrado: {existing_model.name}")
            return existing_model.model_id
        
        # Crear modelo por defecto
        default_model = Model(
            name="Modelo de Detección de Anomalías",
            description="Modelo RNN para detección de anomalías en vibraciones",
            route_h5="modelo/modeloRNN_multiclase_v3_finetuned.h5",
            route_pkl="scaler/scaler_RNN.pkl"
        )
        
        db.add(default_model)
        db.commit()
        db.refresh(default_model)
        
        print(f"✓ Modelo por defecto creado con ID: {default_model.model_id}")
        return default_model.model_id
        
    except Exception as e:
        print(f"✗ Error configurando modelo: {str(e)}")
        db.rollback()
        return None

def setup_default_sensors(db, model_id):
    """Configurar sensores por defecto"""
    print("📡 Configurando sensores por defecto...")
    
    try:
        # Sensores por defecto
        default_sensors = [
            {
                "sensor_id": 1,
                "name": "Sensor MPU6050 #1",
                "description": "Sensor de vibración principal - Área de producción",
                "model_id": model_id
            },
            {
                "sensor_id": 2,
                "name": "Sensor MPU6050 #2", 
                "description": "Sensor de vibración secundario - Área de mantenimiento",
                "model_id": model_id
            }
        ]
        
        created_sensors = []
        for sensor_data in default_sensors:
            # Verificar si el sensor ya existe
            existing_sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_data["sensor_id"]).first()
            
            if existing_sensor:
                print(f"✓ Sensor {sensor_data['sensor_id']} ya existe: {existing_sensor.name}")
                created_sensors.append(existing_sensor)
            else:
                # Crear nuevo sensor
                new_sensor = Sensor(**sensor_data)
                db.add(new_sensor)
                created_sensors.append(new_sensor)
                print(f"✓ Sensor {sensor_data['sensor_id']} creado: {sensor_data['name']}")
        
        db.commit()
        print(f"✓ {len(created_sensors)} sensores configurados")
        return created_sensors
        
    except Exception as e:
        print(f"✗ Error configurando sensores: {str(e)}")
        db.rollback()
        return []

def setup_system_config(db, model_id):
    """Configurar configuración del sistema"""
    print("⚙️ Configurando sistema...")
    
    try:
        # Verificar si ya existe configuración
        existing_config = db.query(SystemConfig).first()
        
        if existing_config:
            # Actualizar configuración existente
            existing_config.active_model_id = model_id
            existing_config.is_configured = 1
            existing_config.last_update = datetime.now()
            print("✓ Configuración del sistema actualizada")
        else:
            # Crear nueva configuración
            system_config = SystemConfig(
                is_configured=1,
                active_model_id=model_id,
                last_update=datetime.now()
            )
            db.add(system_config)
            print("✓ Configuración del sistema creada")
        
        db.commit()
        return True
        
    except Exception as e:
        print(f"✗ Error configurando sistema: {str(e)}")
        db.rollback()
        return False

def setup_default_limits(db):
    """Configurar límites por defecto"""
    print("📊 Configurando límites por defecto...")
    
    try:
        # Verificar si ya existen límites
        existing_limits = db.query(LimitConfig).first()
        
        if existing_limits:
            print("✓ Límites ya configurados")
            return True
        
        # Crear límites por defecto
        default_limits = LimitConfig(
            x_2inf=-2.36, x_2sup=2.18, x_3inf=-3.50, x_3sup=3.32,
            y_2inf=7.18, y_2sup=12.09, y_3inf=5.95, y_3sup=13.32,
            z_2inf=-2.39, z_2sup=1.11, z_3inf=-3.26, z_3sup=1.98,
            update_limits=datetime.now()
        )
        
        db.add(default_limits)
        db.commit()
        print("✓ Límites por defecto configurados")
        return True
        
    except Exception as e:
        print(f"✗ Error configurando límites: {str(e)}")
        db.rollback()
        return False

def setup_default_user(db):
    """Configurar usuario por defecto"""
    print("👤 Configurando usuario por defecto...")
    
    try:
        # Verificar si ya existe usuario
        existing_user = db.query(User).first()
        
        if existing_user:
            print(f"✓ Usuario existente encontrado: {existing_user.username}")
            return True
        
        # Crear usuario por defecto
        default_password = "admin123"
        hashed_password = get_password_hash(default_password)
        
        default_user = User(
            username="admin",
            hashed_password=hashed_password
        )
        
        db.add(default_user)
        db.commit()
        
        print("✓ Usuario por defecto creado:")
        print(f"  • Usuario: admin")
        print(f"  • Contraseña: {default_password}")
        print("  ⚠️ CAMBIA esta contraseña después del primer login")
        return True
        
    except Exception as e:
        print(f"✗ Error configurando usuario: {str(e)}")
        db.rollback()
        return False

def verify_files():
    """Verificar que los archivos del modelo existen"""
    print("📁 Verificando archivos del modelo...")
    
    files_to_check = [
        "modelo/modeloRNN_multiclase_v3_finetuned.h5",
        "scaler/scaler_RNN.pkl"
    ]
    
    all_files_exist = True
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print(f"✓ {file_path}")
        else:
            print(f"⚠️ Archivo no encontrado: {file_path}")
            all_files_exist = False
    
    if not all_files_exist:
        print("⚠️ Algunos archivos del modelo no existen. El sistema funcionará pero sin predicciones.")
    
    return all_files_exist

def test_database_connection():
    """Probar la conexión a la base de datos"""
    print("🔌 Probando conexión a la base de datos...")
    
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        print("✓ Conexión a la base de datos exitosa")
        return True
    except Exception as e:
        print(f"✗ Error de conexión a la base de datos: {str(e)}")
        print("  • Verifica que PostgreSQL esté ejecutándose")
        print("  • Verifica las credenciales en app/database.py")
        return False

def main():
    """Función principal de configuración"""
    print("🚀 Configuración inicial de PdM-Manager")
    print("=" * 50)
    
    # Verificar conexión a BD
    if not test_database_connection():
        sys.exit(1)
    
    # Crear tablas
    if not create_tables():
        sys.exit(1)
    
    # Verificar archivos del modelo
    verify_files()
    
    # Configuración de la base de datos
    db = SessionLocal()
    
    try:
        # 1. Configurar modelo
        model_id = setup_default_model(db)
        if not model_id:
            print("✗ No se pudo configurar el modelo")
            sys.exit(1)
        
        # 2. Configurar sensores
        sensors = setup_default_sensors(db, model_id)
        if not sensors:
            print("✗ No se pudieron configurar los sensores")
            sys.exit(1)
        
        # 3. Configurar sistema
        if not setup_system_config(db, model_id):
            print("✗ No se pudo configurar el sistema")
            sys.exit(1)
        
        # 4. Configurar límites
        if not setup_default_limits(db):
            print("✗ No se pudieron configurar los límites")
            sys.exit(1)
        
        # 5. Configurar usuario por defecto
        if not setup_default_user(db):
            print("✗ No se pudo configurar el usuario")
            sys.exit(1)
        
        print("\n" + "=" * 50)
        print("🎉 ¡Configuración completada exitosamente!")
        print("\n📋 Resumen de configuración:")
        print(f"  • Modelo activo: ID {model_id}")
        print(f"  • Sensores configurados: {len(sensors)}")
        print("  • Sistema configurado: ✓")
        print("  • Límites configurados: ✓")
        print("  • Usuario administrador: ✓")
        
        print("\n🚀 Pasos siguientes:")
        print("1. Instalar dependencias: pip install -r requirements.txt")
        print("2. Iniciar backend: python app/main.py")
        print("3. Iniciar cliente MQTT: python mqtt_client.py")
        print("4. Cargar código al ESP32")
        print("5. Acceder al dashboard: http://localhost:8000")
        
    except Exception as e:
        print(f"✗ Error durante la configuración: {str(e)}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()