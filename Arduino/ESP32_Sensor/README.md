# ESP32 Sensor para PdM-Manager

Este código permite a un ESP32 con sensor MPU6050 enviar datos de aceleración a la API de PdM-Manager para el monitoreo predictivo de maquinaria.

## Requisitos de Hardware

- ESP32 (cualquier variante)
- Sensor MPU6050
- Conexión a Internet WiFi

## Conexiones

Conectar el MPU6050 al ESP32:
- VCC → 3.3V
- GND → GND
- SCL → GPIO22
- SDA → GPIO21

## Requisitos de Software

- Arduino IDE 1.8.x o superior
- Bibliotecas:
  - WiFi.h
  - Wire.h
  - HTTPClient.h
  - Adafruit_MPU6050.h
  - Adafruit_Sensor.h
  - ArduinoJson.h

## Instalación

1. Instala todas las bibliotecas requeridas usando el Gestor de Bibliotecas de Arduino
2. Abre el archivo `credentials.h` y modifica:
   - `ssid`: Nombre de tu red WiFi
   - `password`: Contraseña de tu red WiFi
   - `serverBaseUrl`: URL de tu servidor PdM-Manager (usa la IP local para pruebas locales)
   - `sensorId`: ID del sensor registrado en la base de datos
   
3. Ajusta el `sampleInterval` según tus necesidades (por defecto: 10 segundos)
4. Verifica que el sensor esté conectado correctamente
5. Sube el código al ESP32

## Resolución de Problemas

### Error "connection refused"

Si recibes el error "connection refused", sigue estos pasos:

1. **Verifica que el servidor esté en ejecución**:
   - Ejecuta el comando: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
   - Visita http://localhost:8000 en tu navegador para confirmar que responde

2. **Usa la IP local correcta**:
   - Si el ESP32 y el servidor están en la misma red local, usa la IP local del servidor
   - Puedes encontrar la IP local con el comando `ipconfig` (Windows) o `ifconfig` (Linux/Mac)
   - Modifica `serverBaseUrl` en `credentials.h` para usar esta IP local

3. **Verifica el endpoint correcto**:
   - Asegúrate de que el endpoint en `ESP32_Sensor.ino` (línea ~32) coincida con el endpoint en tu backend
   - Si el backend espera `/api/vibration-data`, asegúrate de que el código use exactamente el mismo endpoint
   - Si el backend espera `/api/sensor_data`, cámbialo en el código

4. **Prueba la conexión**:
   - Desde tu navegador o con herramientas como Postman, intenta una petición a la URL completa
   - Si falla también desde tu computadora, el problema está en el backend

5. **Revisa el firewall**:
   - Asegúrate de que el puerto 8000 esté abierto en el firewall de tu servidor

## Endpoint de la API

Este código envía datos JSON al endpoint configurado (por defecto `/api/vibration-data`) con el siguiente formato:

```json
{
  "sensor_id": 1,
  "acceleration_x": 0.123,
  "acceleration_y": -0.234,
  "acceleration_z": 9.81
}
``` 