/**
 * Archivo de credenciales y configuración - PdM-Manager v2.0.0
 * Para ESP32 con sensor MPU6050 + MQTT + SPIFFS + Watchdog
 */

#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// Configuración WiFi
const char* ssid = "A55";                       // SSID WiFi (Tigo Colombia)
const char* password = "mukava123";             // Contraseña WiFi

// NUEVO: Configuración MQTT HiveMQ (reemplaza serverBaseUrl HTTP)
const char* mqttBrokerHost = "broker.hivemq.com";    // Broker HiveMQ público
const int mqttBrokerPort = 1883;                     // Puerto MQTT estándar
const char* mqttUser = "";                           // Usuario MQTT (vacío para broker público)
const char* mqttPassword = "";                       // Contraseña MQTT (vacío para broker público)

// ALTERNATIVA: HiveMQ Cloud (descomenta si tienes cuenta HiveMQ Cloud)
// const char* mqttBrokerHost = "tu-cluster.s1.eu.hivemq.cloud";
// const int mqttBrokerPort = 8883;                   // Puerto TLS
// const char* mqttUser = "tu_usuario";
// const char* mqttPassword = "tu_contraseña";

// ID del sensor registrado en la base de datos
// IMPORTANTE: Este ID debe existir en la base de datos del sistema
// Para múltiples sensores, solo cambiar este valor: 1, 2, 3, 4...
const int sensorId = 1;

// Configuración de tiempos
const unsigned long sampleInterval = 10000;     // Intervalo entre muestras en milisegundos (10 segundos)
const unsigned long connectionTimeout = 15000;  // Timeout para intentar conexión WiFi (15 segundos)

#endif 