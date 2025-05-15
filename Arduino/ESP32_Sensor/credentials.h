/**
 * Archivo de credenciales y configuración - PdM-Manager
 * Para ESP32 con sensor MPU6050
 */

#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// Configuración WiFi
const char* ssid = "A55";               // SSID WiFi (Tigo Colombia)
const char* password = "mukava123";            // Contraseña WiFi

// Configuración del servidor
// IP PÚBLICA (solo usar si tienes configurado port forwarding en tu router):
// const char* serverBaseUrl = "http://191.98.43.133:8000"; // IP pública de Colombia, Pereira (Tigo)

// IP LOCAL (usa esta para conexiones dentro de tu red local):
const char* serverBaseUrl = "http://192.168.1.11:8000"; // Reemplaza con la IP local de tu servidor

// ID del sensor registrado en la base de datos
// IMPORTANTE: Este ID debe existir en la base de datos del sistema
const int sensorId = 1;

// Configuración de tiempos
const unsigned long sampleInterval = 10000;     // Intervalo entre muestras en milisegundos (10 segundos)
const unsigned long connectionTimeout = 15000;  // Timeout para intentar conexión WiFi (15 segundos)

#endif 