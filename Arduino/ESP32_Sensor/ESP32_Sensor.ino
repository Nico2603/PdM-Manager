/**
 * ESP32 Sensor - PdM-Manager
 * Lectura de aceleración y envío de datos vía MQTT con almacenamiento local
 */

#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>        // CAMBIO: Reemplaza HTTPClient para MQTT
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <time.h>               // Para NTP
#include <SPIFFS.h>             // NUEVO: Almacenamiento local
#include <esp_task_wdt.h>       // NUEVO: Watchdog Timer
#include "credentials.h"

// Configuración del sensor
Adafruit_MPU6050 mpu;

// CAMBIO: Configuración MQTT (reemplaza apiUrl de HTTP)
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
const char* mqttTopic = "GL_Ingenieros/sensores/vibracion";

// Configuración NTP
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = -18000;  // UTC-5 (Colombia) en segundos
const int   daylightOffset_sec = 0;  // Sin horario de verano

// Variables globales
unsigned long lastSendTime = 0;
unsigned long lastWifiCheckTime = 0;
unsigned long lastWatchdogTime = 0;       // NUEVO: Control Watchdog
const int wifiCheckInterval = 30000;      // Revisar WiFi cada 30 segundos
const int watchdogTimeout = 60000;        // NUEVO: Timeout Watchdog 60 segundos
bool timeInitialized = false;
bool spiffsInitialized = false;           // NUEVO: Estado SPIFFS

// OPCIÓN: Desactivar watchdog si causa problemas (cambiar a false para desactivar)
const bool enableWatchdog = false;

// NUEVO: Handle para Watchdog Timer en ESP32 Core v3.x
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
esp_task_wdt_user_handle_t wdt_user_handle = NULL;
#endif

// NUEVO: Cola de datos offline
const int maxOfflineData = 50;            // Máximo 50 registros offline
int offlineDataCount = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  delay(100);
  
  Serial.println("\n===== INICIALIZANDO ESP32 SENSOR =====");
  Serial.println("Versión: 2.0.0 - PdM-Manager MQTT+SPIFFS+Watchdog");
  Serial.println("Desarrollado para monitoreo de vibraciones - GL Ingenieros");
  
  // NUEVO: Inicializar Watchdog Timer (compatible con ESP32 Core v2.x y v3.x)
  if (enableWatchdog) {
    Serial.println("Configurando Watchdog Timer...");
    
    #if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
      // ESP32 Arduino Core v3.x (IDF 5.x) - Nueva API
      esp_task_wdt_config_t wdt_config = {
        .timeout_ms = watchdogTimeout,    // 60000 ms = 60 segundos
        .idle_core_mask = 0,              // No monitorear tareas idle (causa problemas)
        .trigger_panic = true             // Resetear automáticamente en timeout
      };
      esp_task_wdt_init(&wdt_config);     // Inicializar con nueva API
      esp_task_wdt_add_user("ESP32_Sensor", &wdt_user_handle);  // Crear handle de usuario
    #else
      // ESP32 Arduino Core v2.x (IDF 4.x) - API antigua
      esp_task_wdt_init(watchdogTimeout / 1000, true);  // 60 segundos, reset automático
      esp_task_wdt_add(NULL);             // Agregar tarea actual al watchdog
    #endif
    Serial.println("✓ Watchdog Timer configurado (60s timeout)");
  } else {
    Serial.println("⚠️ Watchdog Timer DESACTIVADO (enableWatchdog = false)");
  }
  
  // NUEVO: Inicializar SPIFFS para almacenamiento local
  if (!initializeSPIFFS()) {
    Serial.println("⚠️  SPIFFS no disponible - funcionando solo en modo online");
  }
  
  // CAMBIO: Configuración MQTT (reemplaza construcción de URL HTTP)
  mqttClient.setServer(mqttBrokerHost, mqttBrokerPort);
  mqttClient.setCallback(mqttCallback);
  Serial.print("Broker MQTT configurado: ");
  Serial.print(mqttBrokerHost);
  Serial.print(":");
  Serial.println(mqttBrokerPort);
  Serial.print("Tópico: ");
  Serial.println(mqttTopic);
  
  Serial.print("ID del Sensor: ");
  Serial.println(sensorId);
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
  
  // CAMBIO: Conectar a MQTT broker (reemplaza inicialización HTTP)
  connectToMQTT();
  
  // Configurar tiempo NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  initializeTime();
  
  // NUEVO: Procesar datos offline almacenados
  processOfflineData();
  
  Serial.println("\n===== SISTEMA LISTO =====");
  Serial.println("Iniciando monitoreo de vibraciones con MQTT...");
}

void loop() {
  unsigned long currentTime = millis();
  
  // NUEVO: Alimentar Watchdog Timer (solo si está habilitado)
  if (enableWatchdog && currentTime - lastWatchdogTime >= 30000) {  // Cada 30 segundos
    #if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
      // ESP32 Core v3.x - Nueva API
      if (wdt_user_handle != NULL) {
        esp_task_wdt_reset_user(wdt_user_handle);
      }
    #else
      // ESP32 Core v2.x - API antigua
      esp_task_wdt_reset();
    #endif
    lastWatchdogTime = currentTime;
    Serial.println("🐕 Watchdog alimentado");
  }
  
  // Verificar si la conexión WiFi sigue activa
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Conexión WiFi perdida. Reconectando...");
    connectToWiFi();
    initializeTime(); // Reinicializar el tiempo después de reconectar
    connectToMQTT();  // NUEVO: Reconectar MQTT después de WiFi
  }
  
  // NUEVO: Mantener conexión MQTT activa
  if (!mqttClient.connected()) {
    Serial.println("Conexión MQTT perdida. Reconectando...");
    connectToMQTT();
  }
  mqttClient.loop();  // Procesar mensajes MQTT
  
  // Verificar si es momento de tomar una lectura
  if (currentTime - lastSendTime >= sampleInterval) {
    // Leer datos del sensor
    sensors_event_t accel, gyro, temp;
    mpu.getEvent(&accel, &gyro, &temp);
    
    // Obtener el timestamp actual en ISO8601
    char timestamp[25];
    getISOTimestamp(timestamp);
    
    // Crear JSON con los datos
    DynamicJsonDocument jsonDoc(256);
    
    // Usar el ID del sensor como un número entero (importante para la API)
    jsonDoc["sensor_id"] = sensorId;
    jsonDoc["timestamp"] = timestamp;
    jsonDoc["acceleration_x"] = accel.acceleration.x;
    jsonDoc["acceleration_y"] = accel.acceleration.y;
    jsonDoc["acceleration_z"] = accel.acceleration.z;
    
    // Convertir el JSON a String
    String jsonData;
    serializeJson(jsonDoc, jsonData);
    
    // CAMBIO: Enviar datos vía MQTT (reemplaza sendDataToServer HTTP)
    sendDataViaMQTT(jsonData);
    
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

// NUEVO: Función MQTT que reemplaza sendDataToServer HTTP
void sendDataViaMQTT(String jsonData) {
  Serial.println("\n------ ENVIANDO DATOS VÍA MQTT ------");
  Serial.println("JSON a enviar:");
  Serial.println(jsonData);
  Serial.println("------------------------------------");
  
  if (mqttClient.connected()) {
    // Intentar enviar vía MQTT
    if (mqttClient.publish(mqttTopic, jsonData.c_str())) {
      Serial.println("✓ DATOS ENVIADOS VÍA MQTT CON ÉXITO ✓");
      Serial.print("Tópico: ");
      Serial.println(mqttTopic);
      
      // NUEVO: Si hay datos offline, intentar sincronizarlos
      if (offlineDataCount > 0 && spiffsInitialized) {
        Serial.println("📤 Sincronizando datos offline...");
        processOfflineData();
      }
    } else {
      Serial.println("✗ ERROR AL ENVIAR VÍA MQTT ✗");
      // NUEVO: Guardar en SPIFFS si MQTT falla
      saveDataOffline(jsonData);
    }
  } else {
    Serial.println("⚠️ MQTT desconectado - Guardando datos offline");
    // NUEVO: Guardar en SPIFFS si no hay conexión MQTT
    saveDataOffline(jsonData);
  }
}

// NUEVO: Función para conectar a broker MQTT
void connectToMQTT() {
  Serial.println("Conectando a broker MQTT...");
  
  String clientId = "ESP32_Sensor_" + String(sensorId);
  
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 5) {
    Serial.print("Intento MQTT ");
    Serial.print(attempts + 1);
    Serial.print("/5... ");
    
    if (mqttClient.connect(clientId.c_str(), mqttUser, mqttPassword)) {
      Serial.println("✓ Conectado a MQTT");
      Serial.print("Cliente ID: ");
      Serial.println(clientId);
      
      // Suscribirse a tópico de comandos (opcional)
      String commandTopic = "GL_Ingenieros/sensores/comandos/" + String(sensorId);
      mqttClient.subscribe(commandTopic.c_str());
      Serial.print("Suscrito a: ");
      Serial.println(commandTopic);
      
    } else {
      Serial.print("✗ Error MQTT: ");
      Serial.println(mqttClient.state());
      delay(2000);
    }
    attempts++;
  }
  
  if (!mqttClient.connected()) {
    Serial.println("⚠️ No se pudo conectar a MQTT - Modo offline activado");
  }
}

// NUEVO: Callback para mensajes MQTT recibidos
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📨 Mensaje MQTT recibido en tópico: ");
  Serial.println(topic);
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("Contenido: ");
  Serial.println(message);
  
  // Procesar comandos (ej: cambio de frecuencia, reinicio, etc.)
  if (message == "restart") {
    Serial.println("🔄 Comando de reinicio recibido");
    delay(1000);
    ESP.restart();
  }
}

void initializeTime() {
  timeInitialized = false;
  Serial.println("Inicializando servidor NTP...");
  
  // Intentar obtener la hora hasta 5 veces
  int retries = 0;
  while (!timeInitialized && retries < 5) {
    struct tm timeinfo;
    if(getLocalTime(&timeinfo)) {
      Serial.println("Hora obtenida del servidor NTP:");
      Serial.println(&timeinfo, "%Y-%m-%d %H:%M:%S");
      timeInitialized = true;
    } else {
      Serial.println("Error al obtener la hora, reintentando...");
      delay(1000);
      retries++;
    }
  }
  
  if (!timeInitialized) {
    Serial.println("No se pudo sincronizar con el servidor NTP");
    Serial.println("Se usarán timestamps relativos");
  }
}

// Función para generar un timestamp ISO8601
void getISOTimestamp(char* buffer) {
  if (timeInitialized) {
    // Obtener la hora actual del sistema NTP
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      // Formato: "2023-04-05T12:34:56Z"
      sprintf(buffer, "%04d-%02d-%02dT%02d:%02d:%02dZ", 
              timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
              timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
      return;
    }
  }
  
  // Fallback en caso de error: usar un timestamp relativo al millis()
  time_t now = time(nullptr);
  sprintf(buffer, "2023-04-05T12:%02d:%02dZ", (now / 60) % 60, now % 60);
}

// NUEVO: Función para inicializar SPIFFS
bool initializeSPIFFS() {
  Serial.println("Inicializando SPIFFS...");
  
  if (!SPIFFS.begin(true)) {
    Serial.println("✗ Error al montar SPIFFS");
    spiffsInitialized = false;
    return false;
  }
  
  spiffsInitialized = true;
  Serial.println("✓ SPIFFS inicializado correctamente");
  
  // Mostrar información del sistema de archivos
  size_t totalBytes = SPIFFS.totalBytes();
  size_t usedBytes = SPIFFS.usedBytes();
  Serial.print("Espacio total: ");
  Serial.print(totalBytes);
  Serial.println(" bytes");
  Serial.print("Espacio usado: ");
  Serial.print(usedBytes);
  Serial.print(" bytes (");
  Serial.print((usedBytes * 100) / totalBytes);
  Serial.println("%)");
  
  // Contar datos offline existentes
  countOfflineData();
  
  return true;
}

// NUEVO: Función para guardar datos offline
void saveDataOffline(String jsonData) {
  if (!spiffsInitialized) {
    Serial.println("⚠️ SPIFFS no disponible - Datos perdidos");
    return;
  }
  
  if (offlineDataCount >= maxOfflineData) {
    Serial.println("⚠️ Almacenamiento offline lleno - Eliminando datos antiguos");
    // Eliminar el archivo más antiguo
    deleteOldestOfflineData();
  }
  
  // Crear nombre de archivo único
  String filename = "/data_" + String(millis()) + ".json";
  
  File file = SPIFFS.open(filename, "w");
  if (!file) {
    Serial.println("✗ Error al crear archivo offline");
    return;
  }
  
  file.print(jsonData);
  file.close();
  
  offlineDataCount++;
  Serial.print("💾 Datos guardados offline: ");
  Serial.print(filename);
  Serial.print(" (Total: ");
  Serial.print(offlineDataCount);
  Serial.println(")");
}

// NUEVO: Función para procesar datos offline
void processOfflineData() {
  if (!spiffsInitialized || offlineDataCount == 0) {
    return;
  }
  
  Serial.print("📤 Procesando ");
  Serial.print(offlineDataCount);
  Serial.println(" datos offline...");
  
  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  
  int processed = 0;
  while (file && mqttClient.connected()) {
    String filename = file.name();
    
    if (filename.startsWith("/data_") && filename.endsWith(".json")) {
      // Leer contenido del archivo
      String jsonData = file.readString();
      
      // Intentar enviar vía MQTT
      if (mqttClient.publish(mqttTopic, jsonData.c_str())) {
        Serial.print("✓ Sincronizado: ");
        Serial.println(filename);
        
        // Eliminar archivo después de envío exitoso
        file.close();
        SPIFFS.remove(filename);
        processed++;
        offlineDataCount--;
      } else {
        Serial.print("✗ Error al sincronizar: ");
        Serial.println(filename);
        break; // Salir si hay error en el envío
      }
    }
    
    if (file) {
      file = root.openNextFile();
    }
  }
  
  if (file) file.close();
  root.close();
  
  Serial.print("📤 Sincronizados ");
  Serial.print(processed);
  Serial.print(" archivos. Restantes: ");
  Serial.println(offlineDataCount);
}

// NUEVO: Función para contar datos offline
void countOfflineData() {
  offlineDataCount = 0;
  
  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  
  while (file) {
    String filename = file.name();
    if (filename.startsWith("/data_") && filename.endsWith(".json")) {
      offlineDataCount++;
    }
    file = root.openNextFile();
  }
  
  if (file) file.close();
  root.close();
  
  if (offlineDataCount > 0) {
    Serial.print("📁 Encontrados ");
    Serial.print(offlineDataCount);
    Serial.println(" datos offline para sincronizar");
  }
}

// NUEVO: Función para eliminar datos offline antiguos
void deleteOldestOfflineData() {
  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  
  String oldestFile = "";
  unsigned long oldestTime = ULONG_MAX;
  
  while (file) {
    String filename = file.name();
    if (filename.startsWith("/data_") && filename.endsWith(".json")) {
      // Extraer timestamp del nombre del archivo
      int start = filename.indexOf("_") + 1;
      int end = filename.indexOf(".json");
      unsigned long timestamp = filename.substring(start, end).toInt();
      
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestFile = filename;
      }
    }
    file = root.openNextFile();
  }
  
  if (file) file.close();
  root.close();
  
  if (oldestFile != "") {
    SPIFFS.remove(oldestFile);
    offlineDataCount--;
    Serial.print("🗑️ Eliminado archivo antiguo: ");
    Serial.println(oldestFile);
  }
}