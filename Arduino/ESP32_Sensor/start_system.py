#!/usr/bin/env python3
"""
Script de inicio completo para PdM-Manager
Inicia todos los servicios necesarios del sistema
"""

import subprocess
import time
import sys
import os
import signal
import threading
from concurrent.futures import ThreadPoolExecutor

# Lista de procesos en ejecución
running_processes = []

def signal_handler(sig, frame):
    """Manejador de señales para terminar todos los procesos"""
    print("\n🛑 Deteniendo todos los servicios...")
    
    for process in running_processes:
        try:
            process.terminate()
            print(f"  • Terminando proceso PID {process.pid}")
        except:
            pass
    
    # Esperar un poco para que terminen gracefully
    time.sleep(2)
    
    # Forzar terminación si es necesario
    for process in running_processes:
        try:
            if process.poll() is None:  # Aún ejecutándose
                process.kill()
                print(f"  • Forzando terminación PID {process.pid}")
        except:
            pass
    
    print("✓ Todos los servicios detenidos")
    sys.exit(0)

def run_command(command, name, working_dir=None):
    """Ejecuta un comando en un subproceso"""
    try:
        print(f"🚀 Iniciando {name}...")
        
        process = subprocess.Popen(
            command,
            shell=True,
            cwd=working_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        running_processes.append(process)
        
        # Leer salida en tiempo real
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                print(f"[{name}] {output.strip()}")
        
        # Obtener código de salida
        rc = process.poll()
        if rc != 0:
            print(f"⚠️ {name} terminó con código {rc}")
        else:
            print(f"✓ {name} terminó correctamente")
            
    except Exception as e:
        print(f"✗ Error ejecutando {name}: {str(e)}")

def check_dependencies():
    """Verificar que las dependencias estén instaladas"""
    print("🔍 Verificando dependencias...")
    
    # Verificar Python
    if sys.version_info < (3, 8):
        print("✗ Se requiere Python 3.8 o superior")
        return False
    
    # Verificar pip packages críticos
    critical_packages = ['fastapi', 'uvicorn', 'paho-mqtt', 'sqlalchemy', 'psycopg2']
    missing_packages = []
    
    for package in critical_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("✗ Paquetes faltantes:")
        for package in missing_packages:
            print(f"    • {package}")
        print("\n💡 Ejecuta: pip install -r requirements.txt")
        return False
    
    print("✓ Dependencias verificadas")
    return True

def check_database():
    """Verificar conexión a la base de datos"""
    print("🔌 Verificando base de datos...")
    
    try:
        # Importar aquí para evitar errores si no están instaladas las dependencias
        sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))
        from app.database import SessionLocal
        
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        print("✓ Conexión a la base de datos exitosa")
        return True
        
    except Exception as e:
        print(f"✗ Error de conexión a la base de datos: {str(e)}")
        print("\n💡 Soluciones posibles:")
        print("  • Verificar que PostgreSQL esté ejecutándose")
        print("  • Ejecutar: python setup_database.py")
        print("  • Verificar credenciales en app/database.py")
        return False

def check_model_files():
    """Verificar que los archivos del modelo existan"""
    print("📁 Verificando archivos del modelo...")
    
    files = [
        "modelo/modeloRNN_multiclase_v3_finetuned.h5",
        "scaler/scaler_RNN.pkl"
    ]
    
    missing_files = []
    for file_path in files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print("⚠️ Archivos del modelo faltantes:")
        for file_path in missing_files:
            print(f"    • {file_path}")
        print("  El sistema funcionará pero sin predicciones de ML")
        return False
    
    print("✓ Archivos del modelo encontrados")
    return True

def wait_for_service(url, service_name, max_attempts=30):
    """Esperar a que un servicio esté disponible"""
    import requests
    
    print(f"⏳ Esperando a que {service_name} esté listo...")
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print(f"✓ {service_name} está listo")
                return True
        except:
            pass
        
        time.sleep(1)
        if attempt % 5 == 0 and attempt > 0:
            print(f"  Intento {attempt}/{max_attempts}...")
    
    print(f"⚠️ {service_name} no respondió después de {max_attempts} segundos")
    return False

def main():
    """Función principal"""
    print("🚀 Iniciando PdM-Manager System")
    print("=" * 50)
    
    # Configurar manejador de señales
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Verificaciones previas
    if not check_dependencies():
        sys.exit(1)
    
    if not check_database():
        print("\n💡 ¿Quieres configurar la base de datos ahora? (y/n): ", end="")
        response = input().lower()
        
        if response == 'y':
            print("🔧 Ejecutando configuración de base de datos...")
            try:
                result = subprocess.run([sys.executable, "setup_database.py"], 
                                      capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"✗ Error en configuración: {result.stderr}")
                    sys.exit(1)
                print("✓ Base de datos configurada")
            except Exception as e:
                print(f"✗ Error ejecutando setup: {str(e)}")
                sys.exit(1)
        else:
            sys.exit(1)
    
    check_model_files()  # Solo advertencia, no bloquea
    
    print("\n🎯 Iniciando servicios...")
    
    # Usar ThreadPoolExecutor para ejecutar servicios en paralelo
    with ThreadPoolExecutor(max_workers=3) as executor:
        
        # 1. Iniciar backend FastAPI
        backend_future = executor.submit(
            run_command,
            f"{sys.executable} -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload",
            "Backend FastAPI"
        )
        
        # Esperar a que el backend esté listo
        time.sleep(5)
        if not wait_for_service("http://localhost:8000/health", "Backend FastAPI"):
            print("⚠️ El backend puede no estar funcionando correctamente")
        
        # 2. Iniciar cliente MQTT
        mqtt_future = executor.submit(
            run_command,
            f"{sys.executable} mqtt_client.py",
            "Cliente MQTT"
        )
        
        print("\n" + "=" * 50)
        print("🎉 ¡Sistema iniciado correctamente!")
        print("\n📋 Servicios ejecutándose:")
        print("  • Backend FastAPI: http://localhost:8000")
        print("  • Cliente MQTT: broker.hivemq.com:1883")
        print("  • Dashboard: http://localhost:8000/login")
        
        print("\n👤 Credenciales por defecto:")
        print("  • Usuario: admin")
        print("  • Contraseña: admin123")
        
        print("\n🔧 Para detener el sistema: Ctrl+C")
        print("📱 Para probar MQTT: Carga el código al ESP32")
        
        # Mantener servicios ejecutándose
        try:
            while True:
                time.sleep(1)
                
                # Verificar si algún servicio terminó inesperadamente
                if backend_future.done():
                    print("⚠️ Backend FastAPI terminó inesperadamente")
                    break
                
                if mqtt_future.done():
                    print("⚠️ Cliente MQTT terminó inesperadamente")
                    break
                    
        except KeyboardInterrupt:
            signal_handler(signal.SIGINT, None)

if __name__ == "__main__":
    main()