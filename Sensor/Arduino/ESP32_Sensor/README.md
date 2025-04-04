# ESP32 Sensor para PdM-Manager

Este proyecto contiene el código para configurar un sensor ESP32 con un acelerómetro MPU6050 para enviar datos a la plataforma PdM-Manager.

## Requisitos de Hardware

- ESP32 (placa de desarrollo)
- Sensor MPU6050 (acelerómetro y giroscopio)
- Cables de conexión

## Conexiones del Hardware

Conecte el MPU6050 al ESP32 de la siguiente manera:

- VCC del MPU6050 a 3.3V del ESP32
- GND del MPU6050 a GND del ESP32
- SCL del MPU6050 a pin GPIO22 del ESP32
- SDA del MPU6050 a pin GPIO21 del ESP32

## Requisitos de Software

- Arduino IDE 1.8.19 o superior
- Las siguientes bibliotecas (instalar desde el Gestor de Bibliotecas de Arduino):
  - Adafruit MPU6050 (y dependencias)
  - Adafruit Unified Sensor
  - ArduinoJson (versión 6.x)
  - WiFi (incluida con ESP32)
  - Wire (incluida con ESP32)
  - HTTPClient (incluida con ESP32)

## Configuración

1. Modifique el archivo `credentials.h` con:
   - Sus credenciales de WiFi
   - La dirección de su servidor PdM-Manager
   - El identificador del sensor
   - Los intervalos de muestreo deseados

2. Instale las bibliotecas requeridas a través del Gestor de Bibliotecas de Arduino.

3. Cargue el archivo `ESP32_Sensor.ino` en su ESP32.

## Funcionamiento

El sensor realizará las siguientes acciones:

1. Conectar a la red WiFi configurada
2. Inicializar el sensor MPU6050
3. Leer los datos de aceleración en intervalos regulares
4. Enviar los datos al servidor PdM-Manager en formato JSON
5. Reintentar el envío si falla
6. Monitorear la conexión WiFi y reconectar si es necesario

## Estructura de los Datos

El sensor envía datos JSON con el siguiente formato:

```json
{
  "sensor_id": "ESP32_001",
  "timestamp": 123456789,
  "acceleration_x": 0.123,
  "acceleration_y": -0.456,
  "acceleration_z": 9.789
}
```

## Solución de Problemas

Si encuentra problemas:

1. Verifique las conexiones físicas entre el ESP32 y el MPU6050
2. Compruebe que las credenciales WiFi sean correctas
3. Verifique que el servidor PdM-Manager esté en ejecución y accesible
4. Revise los mensajes de depuración en el Monitor Serial (115200 baudios)

## Personalización

Puede ajustar los siguientes parámetros en el archivo `credentials.h`:

- `sensorId`: Identificador único del sensor
- `serverBaseUrl`: URL base del servidor PdM-Manager
- `sampleInterval`: Intervalo entre lecturas (en milisegundos)
- `connectionTimeout`: Tiempo de espera para conexiones 