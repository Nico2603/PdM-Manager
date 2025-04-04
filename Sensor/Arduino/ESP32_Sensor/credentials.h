#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// Credenciales de WiFi
// Puede modificar estos valores según su red
const char* ssid = "servo";
const char* password = "servoapi24";

// Configuración de la API
// URL base del servidor PdM-Manager
// Modifique esta IP según la dirección de su servidor
const char* serverBaseUrl = "http://127.0.0.1:8000";

// Configuración del sensor
// Identificador único para este dispositivo
const char* sensorId = "ESP32_001";

// Configuración de intervalos (en milisegundos)
const unsigned long sampleInterval = 5000;    // Intervalo entre lecturas (5 segundos)
const unsigned long connectionTimeout = 10000; // Tiempo máximo para conexiones

#endif 