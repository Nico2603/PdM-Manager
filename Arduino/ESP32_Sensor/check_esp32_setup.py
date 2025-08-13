#!/usr/bin/env python3
"""
Script de verificación para configuración ESP32
Verifica que todas las dependencias y configuraciones estén correctas
"""

import os
import re
import json
import platform
from pathlib import Path

def get_arduino_paths():
    """Detecta las rutas de Arduino en diferentes sistemas operativos"""
    system = platform.system()
    
    if system == "Windows":
        arduino_paths = [
            Path.home() / "AppData/Local/Arduino15",
            Path("C:/Program Files (x86)/Arduino"),
            Path("C:/Program Files/Arduino")
        ]
    elif system == "Darwin":  # macOS
        arduino_paths = [
            Path.home() / "Library/Arduino15",
            Path("/Applications/Arduino.app")
        ]
    else:  # Linux
        arduino_paths = [
            Path.home() / ".arduino15",
            Path("/usr/share/arduino")
        ]
    
    return [path for path in arduino_paths if path.exists()]

def check_esp32_core_version():
    """Verifica la versión del ESP32 Arduino Core"""
    print("🔍 Verificando ESP32 Arduino Core...")
    
    arduino_paths = get_arduino_paths()
    esp32_core_found = False
    
    for arduino_path in arduino_paths:
        esp32_package_path = arduino_path / "packages/esp32"
        
        if esp32_package_path.exists():
            esp32_core_found = True
            
            # Buscar archivos de versión
            version_files = list(esp32_package_path.rglob("package.json"))
            platform_files = list(esp32_package_path.rglob("platform.txt"))
            
            if version_files:
                try:
                    with open(version_files[0], 'r') as f:
                        package_data = json.load(f)
                        version = package_data.get('version', 'Desconocida')
                        print(f"✅ ESP32 Core encontrado: v{version}")
                        
                        # Verificar compatibilidad
                        major_version = int(version.split('.')[0])
                        if major_version >= 3:
                            print("✅ Versión compatible con nueva API Watchdog (v3.x)")
                        elif major_version == 2:
                            print("✅ Versión compatible con API Watchdog antigua (v2.x)")
                        else:
                            print("⚠️  Versión muy antigua, considera actualizar")
                        
                except Exception as e:
                    print(f"⚠️  Error leyendo versión: {e}")
            
            if platform_files:
                try:
                    with open(platform_files[0], 'r') as f:
                        content = f.read()
                        # Buscar versión en platform.txt
                        version_match = re.search(r'version=([0-9.]+)', content)
                        if version_match:
                            version = version_match.group(1)
                            print(f"✅ Platform version: {version}")
                except Exception as e:
                    print(f"⚠️  Error leyendo platform.txt: {e}")
    
    if not esp32_core_found:
        print("❌ ESP32 Arduino Core no encontrado")
        print("💡 Instalar desde: Herramientas → Placa → Gestor de Tarjetas → ESP32")

def check_required_libraries():
    """Verifica las librerías requeridas"""
    print("\n🔍 Verificando librerías requeridas...")
    
    required_libs = [
        "PubSubClient",
        "Adafruit MPU6050",
        "Adafruit Unified Sensor",
        "ArduinoJson"
    ]
    
    arduino_paths = get_arduino_paths()
    libraries_found = []
    
    for arduino_path in arduino_paths:
        # Buscar en directorios de librerías
        lib_paths = [
            arduino_path / "libraries",
            Path.home() / "Documents/Arduino/libraries"
        ]
        
        for lib_path in lib_paths:
            if lib_path.exists():
                for lib_name in required_libs:
                    lib_variants = [
                        lib_name,
                        lib_name.replace(" ", "_"),
                        lib_name.replace(" ", "-")
                    ]
                    
                    for variant in lib_variants:
                        lib_dir = lib_path / variant
                        if lib_dir.exists():
                            libraries_found.append(lib_name)
                            print(f"✅ {lib_name} encontrada")
                            break
    
    # Verificar librerías faltantes
    missing_libs = set(required_libs) - set(libraries_found)
    if missing_libs:
        print(f"\n❌ Librerías faltantes: {', '.join(missing_libs)}")
        print("💡 Instalar desde: Herramientas → Gestionar Bibliotecas")

def check_credentials_file():
    """Verifica el archivo credentials.h"""
    print("\n🔍 Verificando archivo credentials.h...")
    
    credentials_path = Path("credentials.h")
    if not credentials_path.exists():
        print("❌ Archivo credentials.h no encontrado")
        return
    
    try:
        with open(credentials_path, 'r') as f:
            content = f.read()
        
        # Verificar configuraciones importantes
        checks = [
            (r'const char\* ssid\s*=\s*"([^"]+)"', "SSID WiFi"),
            (r'const char\* password\s*=\s*"([^"]+)"', "Contraseña WiFi"),
            (r'const char\* mqttBrokerHost\s*=\s*"([^"]+)"', "Broker MQTT"),
            (r'const int mqttBrokerPort\s*=\s*([0-9]+)', "Puerto MQTT"),
            (r'const int sensorId\s*=\s*([0-9]+)', "ID del Sensor")
        ]
        
        for pattern, name in checks:
            match = re.search(pattern, content)
            if match:
                value = match.group(1)
                if name in ["SSID WiFi", "Contraseña WiFi"] and len(value) < 3:
                    print(f"⚠️  {name}: '{value}' (muy corto, verifica)")
                else:
                    print(f"✅ {name}: {value}")
            else:
                print(f"❌ {name} no encontrado")
    
    except Exception as e:
        print(f"❌ Error leyendo credentials.h: {e}")

def check_board_configuration():
    """Información sobre configuración de la placa"""
    print("\n🔧 Configuración recomendada de la placa:")
    print("✅ Placa: ESP32 Dev Module")
    print("✅ CPU Frequency: 240MHz")
    print("✅ Flash Size: 4MB")
    print("✅ Partition Scheme: Default 4MB with spiffs")
    print("✅ Upload Speed: 921600")

def generate_test_sketch():
    """Genera un sketch de prueba simple"""
    print("\n🧪 Generando sketch de prueba...")
    
    test_sketch = '''
// Test sketch para verificar configuración ESP32
#include <WiFi.h>
#include <esp_task_wdt.h>

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== TEST ESP32 CONFIGURATION ===");
  
  // Test Watchdog Timer compatibility
  Serial.println("Testing Watchdog Timer API...");
  
  #if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
    Serial.println("✅ ESP32 Core v3.x detected (IDF 5.x)");
    esp_task_wdt_config_t wdt_config = {
      .timeout_ms = 10000,
      .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
      .trigger_panic = false
    };
    esp_task_wdt_init(&wdt_config);
  #else
    Serial.println("✅ ESP32 Core v2.x detected (IDF 4.x)");
    esp_task_wdt_init(10, false);
  #endif
  
  Serial.println("✅ Watchdog Timer OK");
  
  // Test WiFi
  Serial.print("WiFi MAC Address: ");
  Serial.println(WiFi.macAddress());
  
  Serial.println("=== TEST COMPLETED ===");
}

void loop() {
  delay(5000);
  Serial.println("ESP32 funcionando correctamente!");
}
'''
    
    with open("ESP32_Test.ino", "w") as f:
        f.write(test_sketch)
    
    print("✅ Sketch de prueba generado: ESP32_Test.ino")
    print("💡 Sube este sketch para verificar que todo funciona")

def main():
    print("🚀 Verificador de configuración ESP32 - PdM-Manager")
    print("=" * 60)
    
    check_esp32_core_version()
    check_required_libraries()
    check_credentials_file()
    check_board_configuration()
    generate_test_sketch()
    
    print("\n" + "=" * 60)
    print("🎯 Resumen:")
    print("1. Verifica que todas las librerías estén instaladas")
    print("2. Configura credentials.h con tus datos WiFi")
    print("3. Sube ESP32_Test.ino para verificar funcionamiento")
    print("4. Luego sube el código principal ESP32_Sensor.ino")

if __name__ == "__main__":
    main()