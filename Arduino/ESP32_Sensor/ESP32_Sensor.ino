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
unsigned long lastWifiCheckTime = 0;
const int wifiCheckInterval = 30000; // Revisar WiFi cada 30 segundos

void setup() {
  Serial.begin(115200);
  Wire.begin();
  delay(100);
  
  Serial.println("\n===== INICIALIZANDO ESP32 SENSOR =====");
  Serial.println("Versión: 1.0.2 - PdM-Manager");
  Serial.println("Desarrollado para monitoreo de vibraciones");
  
  // Construir la URL completa para la API
  // IMPORTANTE: Este endpoint debe coincidir con el de tu backend
  sprintf(apiUrl, "%s/api/vibration-data", serverBaseUrl);
  Serial.print("URL de la API: ");
  Serial.println(apiUrl);
  
  // Construir el ID del sensor en formato de cadena
  char sensorIdStr[20];
  sprintf(sensorIdStr, "ESP32_SENSOR_%02d", sensorId);
  Serial.print("ID del Sensor: ");
  Serial.println(sensorIdStr);
  Serial.print("Intervalo de muestreo: ");
  Serial.print(sampleInterval / 1000.0);
  Serial.println(" segundos");
  
  // Inicializar el sensor MPU6050
  if (!initializeSensor()) {
    Serial.println("Error crítico: No se pudo inicializar el sensor MPU6050");
    Serial.println("El sistema no puede continuar sin el sensor");
    Serial.println("Reiniciando en 5 segundos...");
    delay(5000);
    ESP.restart();
  }
  
  // Conectar a WiFi
  connectToWiFi();
  
  Serial.println("\n===== SISTEMA LISTO =====");
  Serial.println("Iniciando monitoreo de vibraciones...");
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
    // Convertir el ID numérico a un formato de cadena como "ESP32_SENSOR_XX"
    char sensorIdStr[20];
    sprintf(sensorIdStr, "ESP32_SENSOR_%02d", sensorId);
    
    jsonDoc["sensor_id"] = sensorIdStr;
    jsonDoc["timestamp"] = currentTime;  // Añadir timestamp en milisegundos
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
  Serial.println("\n====== INICIALIZACIÓN DEL SENSOR ======");
  Serial.println("Inicializando MPU6050...");
  
  // Intentar inicializar el sensor
  if (!mpu.begin()) {
    Serial.println("ERROR: No se pudo encontrar el chip MPU6050");
    Serial.println("- Verifique las conexiones del sensor");
    Serial.println("- Compruebe la alimentación del sensor");
    Serial.println("======================================");
    return false;
  }
  
  // Configurar el sensor
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  
  Serial.println("¡Sensor MPU6050 inicializado correctamente!");
  Serial.println("- Rango del acelerómetro: ±8g");
  Serial.println("- Rango del giroscopio: ±500°/s");
  Serial.println("- Ancho de banda del filtro: 21 Hz");
  Serial.println("======================================");
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
    
    // Mostrar información de la señal WiFi
    int rssi = WiFi.RSSI();
    Serial.print("Intensidad de la señal (RSSI): ");
    Serial.print(rssi);
    Serial.println(" dBm");
    
    if (rssi > -50) {
      Serial.println("Señal excelente");
    } else if (rssi > -60) {
      Serial.println("Señal muy buena");
    } else if (rssi > -70) {
      Serial.println("Señal buena");
    } else if (rssi > -80) {
      Serial.println("Señal regular");
    } else {
      Serial.println("Señal débil - posible inestabilidad");
    }
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
  
  Serial.println("\n------ ENVIANDO DATOS AL SERVIDOR ------");
  Serial.println("JSON a enviar:");
  Serial.println(jsonData);
  Serial.println("---------------------------------------");
  
  // Verificar si la API URL es correcta antes de enviar
  if (strlen(apiUrl) < 10) {
    Serial.println("Error: URL de API no válida. Revise la configuración.");
    return;
  }
  
  while (!success && retries < MAX_RETRIES) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Código de respuesta HTTP: ");
      Serial.println(httpResponseCode);
      
      if (httpResponseCode == 200 || httpResponseCode == 201) {
        success = true;
        Serial.println("✓ DATOS ENVIADOS CON ÉXITO ✓");
        Serial.println("Respuesta del servidor: ");
        Serial.println(response);
      } else {
        Serial.println("✗ ERROR EN LA RESPUESTA DEL SERVIDOR ✗");
        Serial.print("Código: ");
        Serial.println(httpResponseCode);
        Serial.println("Respuesta: ");
        Serial.println(response);
      }
    } else {
      Serial.println("✗ ERROR EN LA PETICIÓN HTTP ✗");
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
    Serial.println("Verifique que el servidor esté en ejecución y la URL sea correcta");
    Serial.print("URL actual: ");
    Serial.println(apiUrl);
  }
}