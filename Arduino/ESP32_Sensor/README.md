# ESP32 Sensor - PdM-Manager v2.0.0

Sistema de monitoreo de vibraciones con ESP32, sensor MPU6050 y comunicación MQTT.

## 🔧 Características

- ✅ **Comunicación MQTT** - Envío de datos en tiempo real
- ✅ **Almacenamiento offline** - SPIFFS para datos sin conexión
- ✅ **Watchdog Timer** - Auto-reinicio en caso de fallos
- ✅ **Sincronización NTP** - Timestamps precisos
- ✅ **WiFi robusto** - Reconexión automática
- ✅ **Comandos remotos** - Control vía MQTT
- ✅ **Compatible** - ESP32 Core v2.x y v3.x

## 📦 Hardware Requerido

- ESP32 Development Board
- Sensor MPU6050 (acelerómetro/giroscopio)
- Cables jumper
- Breadboard (opcional)

## 🔌 Conexiones

```
ESP32    <-->    MPU6050
GND      <-->    GND
3.3V     <-->    VCC  
GPIO21   <-->    SDA
GPIO22   <-->    SCL
```

## 🚀 Configuración Rápida

### 1. Verificar configuración:
```bash
python check_esp32_setup.py
```

### 2. Instalar librerías:
```
Herramientas → Gestionar Bibliotecas → Instalar:
- PubSubClient (v2.8.0+)
- Adafruit MPU6050 (v2.0.0+)
- Adafruit Unified Sensor (v1.1.4+)
- ArduinoJson (v6.19.4+)
```

### 3. Configurar placa:
```
Herramientas → Placa → ESP32 Dev Module
- CPU Frequency: 240MHz
- Flash Size: 4MB
- Partition Scheme: Default 4MB with spiffs
- Upload Speed: 921600
```

### 4. Configurar WiFi:
Editar `credentials.h`:
```cpp
const char* ssid = "TU_WIFI";
const char* password = "TU_PASSWORD";
const int sensorId = 1;  // Cambiar para múltiples sensores
```

## 📊 Datos MQTT

**Tópico de datos:** `GL_Ingenieros/sensores/vibracion`

**Formato JSON:**
```json
{
  "sensor_id": 1,
  "timestamp": "2024-01-15T10:30:45Z",
  "acceleration_x": -0.234,
  "acceleration_y": 9.821,
  "acceleration_z": 0.156
}
```

## 🚨 Solución de Problemas

### Error de compilación Watchdog:
```
error: invalid conversion from 'int' to 'const esp_task_wdt_config_t*'
```
**Solución:** ✅ El código ya es compatible con ambas versiones
- Verifica versión ESP32 Core: `Herramientas → Placa → Gestor de Tarjetas`
- Actualiza a v3.x para mejor rendimiento
- O usa v2.0.17 para estabilidad

### Sensor no detectado:
- ✅ Verificar conexiones I2C
- ✅ Comprobar alimentación 3.3V
- ✅ Revisar dirección I2C (0x68)

### Error de conexión WiFi:
- ✅ Verificar SSID y contraseña en `credentials.h`
- ✅ Comprobar señal WiFi
- ✅ Revisar configuración de red

### Error MQTT:
- ✅ Verificar broker: broker.hivemq.com:1883
- ✅ Comprobar conectividad a internet
- ✅ Revisar logs en Monitor Serial

## 📈 Monitoreo

- **Monitor Serial:** 115200 baudios
- **Datos cada:** 10 segundos (configurable)
- **Almacenamiento offline:** Hasta 50 registros
- **Watchdog:** Reset automático en 60 segundos

## 🔄 Comandos MQTT

**Tópico:** `GL_Ingenieros/sensores/comandos/[sensor_id]`

Comandos disponibles:
- `restart` - Reinicia el ESP32
- `status` - Solicita estado del sensor

## ⚡ Prueba Rápida

1. **Sube el sketch de prueba:** `ESP32_Test.ino` (generado por `check_esp32_setup.py`)
2. **Verifica funcionamiento** en Monitor Serial
3. **Sube código principal:** `ESP32_Sensor.ino`
4. **Monitorea datos** en el cliente MQTT

## 🆘 Soporte

Si tienes problemas:
1. ✅ Ejecuta `python check_esp32_setup.py`
2. ✅ Sube `ESP32_Test.ino` para prueba básica
3. ✅ Verifica conexiones de hardware
4. ✅ Revisa logs en Monitor Serial (115200 baudios)

---

**Desarrollado para GL Ingenieros**  
**Sistema PdM-Manager v2.0.0**