/**
 * ESP32 Sensor - PdM-Manager
 * Lectura de aceleración y envío de datos vía HTTP
 */

#include <WiFi.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include "credentials.h"

// Configuración del sensor
Adafruit_MPU6050 mpu;

// URL completa para el envío de datos de vibración
char apiUrl[100];

// Variables globales
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  delay(100);
  
  Serial.println("\n===== Inicializando ESP32 Sensor =====");
  
  // Construir la URL completa para la API
  sprintf(apiUrl, "%s/api/vibration-data", serverBaseUrl);
  Serial.print("URL de la API: ");
  Serial.println(apiUrl);
  
  // Inicializar el sensor MPU6050
  if (!initializeSensor()) {
    Serial.println("Error: No se pudo inicializar el sensor MPU6050");
    while (1) {
      delay(1000);
    }
  }
  
  // Conectar a WiFi
  connectToWiFi();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Verificar si la conexión WiFi sigue activa
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Conexión WiFi perdida. Reconectando...");
    connectToWiFi();
  }
  
  // Verificar si es momento de tomar una lectura
  if (currentTime - lastSendTime >= sampleInterval) {
    // Leer datos del sensor
    sensors_event_t accel, gyro, temp;
    mpu.getEvent(&accel, &gyro, &temp);
    
    // Crear JSON con los datos
    DynamicJsonDocument jsonDoc(256);
    jsonDoc["sensor_id"] = sensorId;
    jsonDoc["timestamp"] = currentTime;
    jsonDoc["acceleration_x"] = accel.acceleration.x;
    jsonDoc["acceleration_y"] = accel.acceleration.y;
    jsonDoc["acceleration_z"] = accel.acceleration.z;
    
    // Convertir el JSON a String
    String jsonData;
    serializeJson(jsonDoc, jsonData);
    
    // Enviar datos al servidor
    sendDataToServer(jsonData);
    
    // Actualizar tiempo de la última lectura
    lastSendTime = currentTime;
  }
}

bool initializeSensor() {
  Serial.println("Inicializando MPU6050...");
  
  // Intentar inicializar el sensor
  if (!mpu.begin()) {
    Serial.println("No se pudo encontrar el chip MPU6050");
    return false;
  }
  
  // Configurar el sensor
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  
  Serial.println("Sensor MPU6050 inicializado correctamente");
  return true;
}

void connectToWiFi() {
  Serial.print("Conectando a WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  unsigned long startAttemptTime = millis();
  
  while (WiFi.status() != WL_CONNECTED && 
         millis() - startAttemptTime < connectionTimeout) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConexión WiFi establecida");
    Serial.print("Dirección IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nError al conectar con WiFi. Reiniciando...");
    delay(1000);
    ESP.restart();
  }
}

void sendDataToServer(String jsonData) {
  const int MAX_RETRIES = 3;
  int retries = 0;
  bool success = false;
  
  Serial.println("Enviando datos al servidor...");
  Serial.println(jsonData);
  
  while (!success && retries < MAX_RETRIES) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Código de respuesta HTTP: ");
      Serial.println(httpResponseCode);
      Serial.print("Respuesta: ");
      Serial.println(response);
      
      if (httpResponseCode == 200 || httpResponseCode == 201) {
        success = true;
        Serial.println("Datos enviados con éxito");
      } else {
        Serial.print("Error en la respuesta del servidor: ");
        Serial.println(httpResponseCode);
      }
    } else {
      Serial.print("Error en la petición HTTP: ");
      Serial.println(http.errorToString(httpResponseCode));
    }
    
    http.end();
    
    if (!success) {
      retries++;
      if (retries < MAX_RETRIES) {
        Serial.print("Reintentando envío... (");
        Serial.print(retries);
        Serial.println("/3)");
        delay(1000);
      }
    }
  }
  
  if (!success) {
    Serial.println("No se pudieron enviar los datos después de varios intentos");
  }
} 