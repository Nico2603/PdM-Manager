# PdM-Manager

Sistema de Mantenimiento Predictivo (PdM) con FastAPI, PostgreSQL y modelo de ML para análisis de vibraciones. Incluye frontend estático (Chart.js), autenticación con formularios (JWT en cookie) y **cliente MQTT integrado con procesamiento automático**.

## Descripción

PdM-Manager es una solución completa de mantenimiento predictivo que permite:
- 📡 **Ingestión automática** de datos triaxiales vía MQTT o HTTP POST
- 🧠 **Clasificación inteligente** de severidad usando modelos Keras (.h5) y escaladores (.pkl)
- 🗄️ **Persistencia robusta** de datos y alertas en PostgreSQL
- 📊 **Visualización en tiempo real** con Chart.js y dashboards interactivos
- ⚙️ **Gestión completa** de modelos, límites, sensores y máquinas vía API/UI
- 🚀 **Cliente MQTT integrado** que procesa datos automáticamente al iniciar la aplicación
- 🔄 **Procesamiento ML automático** sin intervención manual

## Tecnologías
- **Backend**: FastAPI, Uvicorn
- **Base de datos**: SQLAlchemy (PostgreSQL)
- **Machine Learning**: TensorFlow/Keras, scikit-learn, joblib/pickle
- **Comunicación IoT**: paho-mqtt (cliente MQTT integrado)
- **Frontend**: Chart.js, HTML/CSS/JS (vanilla)
- **Autenticación**: JWT con cookies httponly

## 🚀 **NUEVA FUNCIONALIDAD**: Cliente MQTT Integrado Automático

PdM-Manager ahora incluye un **cliente MQTT completamente integrado** que:

### ✨ Características Principales:
- **🔄 Inicio automático**: Se conecta al broker MQTT al iniciar la aplicación (sin botones ni intervención manual)
- **🧠 Procesamiento ML en tiempo real**: Cada mensaje MQTT se procesa automáticamente con el modelo de ML cargado
- **📊 Clasificación automática**: Calcula severidad (0=Normal, 1=Leve, 2=Grave, 3=Crítico) para cada lectura
- **🚨 Alertas automáticas**: Genera alertas en BD cuando severidad >= 2
- **💾 Persistencia automática**: Guarda todos los datos procesados en PostgreSQL
- **🔍 Monitoreo de estado**: Endpoints dedicados para verificar el estado del cliente MQTT

### ⚡ Flujo de Trabajo Automatizado:
1. **Arranque**: PdM-Manager inicia → Cliente MQTT se conecta automáticamente
2. **Recepción**: Sensor ESP32 envía datos → Broker MQTT → PdM-Manager
3. **Procesamiento**: Datos → Normalización con escalador → Modelo ML → Clasificación
4. **Persistencia**: Datos + severidad → PostgreSQL 
5. **Alertas**: Si severidad >= 2 → Alerta automática en BD
6. **Visualización**: Dashboard muestra datos en tiempo real

### 🎯 Sin Configuración Manual:
- ❌ **Eliminado**: Botón "Iniciar Monitoreo" 
- ✅ **Automático**: Todo se inicia al arrancar la aplicación
- ✅ **Robusto**: Reconexión automática en caso de pérdida de conexión
- ✅ **Monitoreable**: Estado visible en `/health` y `/mqtt/status`

## Requisitos
- Python 3.12 (recomendado)
- PostgreSQL 13+
- `pip` y `venv`
- **Broker MQTT** (configurable, por defecto: `broker.hivemq.com`)

## Instalación
1) Clonar y crear entorno
```bash
git clone https://github.com/tu-usuario/PdM-Manager.git
cd PdM-Manager
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate
pip install -r requirements.txt
```

2) Variables de entorno (BD y MQTT)
Crea `.env` o exporta variables. Valores por defecto en `app/database.py`:
```env
# Base de datos PostgreSQL
DB_USER=postgres
DB_PASSWORD=pdm123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=PdM

# Configuración MQTT (opcional)
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883
MQTT_TOPIC=GL_Ingenieros/sensores/vibracion
MQTT_USERNAME=
MQTT_PASSWORD=

# CORS (opcional)
CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

3) Inicializar BD (PostgreSQL)
Ejecuta `PdM.sql` sobre la base `PdM`:
```bash
createdb PdM -h localhost -p 5432 -U postgres
psql -h localhost -p 5432 -U postgres -d PdM -f PdM.sql
```
El script crea tablas, secuencias, índices y el trigger de alertas (severidad repetida).

4) Carpetas para modelos
La API guarda archivos subidos en `Modelo/` y `Scaler/` (con mayúscula):
```bash
mkdir Modelo Scaler
```

## Ejecución
```bash
python -m uvicorn app.main:app --reload
```
- App: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- Frontend: `http://localhost:8000/` → `/login` → `/panel`

## Autenticación
- Formularios: `/login` y `/register`
- Tras login se define cookie `access_token` (JWT, httponly, samesite=Lax)
- El `SECRET_KEY` se regenera en cada arranque (relogin tras reinicio)

## Estructura del proyecto
```
PdM-Manager/
├─ app/
│  ├─ main.py               # App FastAPI, rutas web y API + integración MQTT
│  ├─ mqtt_client.py        # 🆕 Cliente MQTT integrado con procesamiento ML
│  ├─ auth.py               # Autenticación (JWT en cookie), hashing
│  ├─ database.py           # Motor/sesión SQLAlchemy (PostgreSQL)
│  ├─ models.py             # ORM: model, sensor, machine, vibration_data, alert, limit_config, system_config, users
│  ├─ crud.py               # CRUD datos/alertas/sensores/máquinas/límites
│  ├─ crud_config.py        # CRUD de configuración y utilidades
│  └─ config.py             # Endpoints gestión de modelos/límites/sensores/máquinas
├─ static/
│  ├─ index.html            # Dashboard/Configuración (sin botón iniciar monitoreo)
│  ├─ login.html            # Login
│  ├─ register.html         # Registro
│  ├─ js/
│  │  ├─ app.js             # Lógica frontend (actualizada para MQTT automático)
│  │  └─ charts.js          # Gráficos Chart.js
│  └─ css/style.css         # Estilos
├─ test_mqtt_integration.py # 🆕 Script de prueba MQTT con verificación BD
├─ verify_database.py       # 🆕 Script para verificar datos insertados en PostgreSQL
├─ .env.example             # 🆕 Plantilla de variables de entorno
├─ PdM.sql                  # Esquema/índices/trigger
├─ Modelo/                  # Archivos .h5 subidos (mayúscula)
├─ Scaler/                  # Archivos .pkl subidos (mayúscula)
├─ modelo/                  # Ejemplos de modelos (minúscula)
├─ scaler/                  # Ejemplos de escaladores (minúscula)
└─ requirements.txt         # Dependencias incluyendo paho-mqtt, requests
```

## API principal

- **Salud y Monitoreo**
  - GET `/health` - Estado completo del sistema (BD, ML, MQTT)
  - GET `/mqtt/status` - 🆕 Estado específico del cliente MQTT

- **Datos de vibración**
  - POST `/sensor-data` - Ingesta manual vía HTTP
  - 🆕 **MQTT automático** - Ingesta automática vía cliente MQTT integrado
  - GET `/vibration-data` (query: `sensor_id`, `limit`, `start_date`, `end_date`)

- Configuración consolidada
  - GET `/config`

- Modelos (ML)
  - GET `/models`
  - GET `/models/{model_id}`
  - POST `/models` (multipart: `name`, `description`, `file_h5`, `file_pkl`)
  - PUT `/models/{model_id}` (archivos opcionales)
  - DELETE `/models/{model_id}`

- Límites
  - GET `/limits`, `/limits/latest`, `/limits/{limit_id}`
  - PUT `/limits/1` (actualiza la configuración activa)
  - DELETE `/limits/{limit_id}`

- Sensores
  - GET `/sensors` (query: `sensor_id`, `model_id`, `skip`, `limit`)
  - GET `/sensors/{sensor_id}`
  - POST `/sensors`
  - PUT `/sensors/{sensor_id}`
  - DELETE `/sensors/{sensor_id}`

- Máquinas
  - GET `/machines` (query: `machine_id`, `sensor_id`)
  - GET `/machines/{machine_id}`
  - POST `/machines`
  - PUT `/machines/{machine_id}`
  - DELETE `/machines/{machine_id}`

### Ejemplos
Ingesta tri-axial:
```bash
curl -X POST http://localhost:8000/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": 1,
    "acceleration_x": 0.12,
    "acceleration_y": -0.03,
    "acceleration_z": 0.08,
    "timestamp": "2024-01-10T12:34:56Z"
  }'
```

Consulta histórica:
```bash
curl "http://localhost:8000/vibration-data?sensor_id=1&limit=100"
```

Subir modelo/escalador:
```bash
curl -X POST http://localhost:8000/models \
  -F "name=Modelo RNN" \
  -F "description=Clasificación" \
  -F "file_h5=@Modelo/anomaly_detection_model.h5" \
  -F "file_pkl=@Scaler/scaler.pkl"
```

Actualizar límites activos (ID=1):
```bash
curl -X PUT http://localhost:8000/limits/1 \
  -H "Content-Type: application/json" \
  -d '{
    "x_2inf": -2.36, "x_2sup": 2.18,
    "x_3inf": -3.50, "x_3sup": 3.32,
    "y_2inf": 7.18,  "y_2sup": 12.09,
    "y_3inf": 5.95,  "y_3sup": 13.32,
    "z_2inf": -2.39, "z_2sup": 1.11,
    "z_3inf": -3.26, "z_3sup": 1.98
  }'
```

## Modelo de ML y severidad
- Normalización con escalador; predicción con modelo Keras
- Umbral por defecto: predicción > 0.5 = anomalía; severidad 0/1/2
- Si `severidad >= 2`, se registra alerta asociada
- `/health` intenta carga bajo demanda del modelo/escalador

## 📡 Integración MQTT Automática Completa

### 🔧 Configuración del Cliente MQTT
El sistema incluye un **cliente MQTT totalmente integrado** que se inicia automáticamente:

#### Variables de entorno (.env):
```env
# Configuración MQTT (todas opcionales, valores por defecto incluidos)
MQTT_BROKER=broker.hivemq.com          # Broker MQTT
MQTT_PORT=1883                         # Puerto (1883 para no-TLS, 8883 para TLS)
MQTT_TOPIC=GL_Ingenieros/sensores/vibracion  # Tópico de escucha
MQTT_USERNAME=                         # Usuario (opcional)
MQTT_PASSWORD=                         # Contraseña (opcional)
```

#### Inicio Automático:
- ✅ **Sin configuración manual**: El cliente se inicia automáticamente al arrancar PdM-Manager
- ✅ **Reconexión automática**: Si se pierde la conexión, intenta reconectar automáticamente
- ✅ **Logging completo**: Todos los eventos MQTT se registran en los logs
- ✅ **Estado monitoreable**: Estado visible en tiempo real vía `/health` y `/mqtt/status`

### 📨 Formato de datos MQTT esperado:
```json
{
  "sensor_id": 1,
  "timestamp": "2024-01-15T10:30:45Z",
  "acceleration_x": -0.234,
  "acceleration_y": 9.821,
  "acceleration_z": 0.156
}
```

### ⚡ Procesamiento Automático:
1. **Recepción**: Mensaje MQTT → Validación de formato JSON
2. **Normalización**: Datos → Escalador (.pkl) → Normalización
3. **Clasificación**: Datos normalizados → Modelo ML (.h5) → Predicción
4. **Severidad**: Predicción → Cálculo de severidad (0-3)
5. **Persistencia**: Datos + severidad → PostgreSQL `vibration_data`
6. **Alertas**: Si severidad >= 2 → Inserción automática en tabla `alert`

### 🛠️ Endpoints de Monitoreo MQTT:
```bash
# Estado completo del sistema (incluye MQTT)
GET /health
# Respuesta incluye: "mqtt": "running" | "stopped" | "error"

# Estado específico del cliente MQTT  
GET /mqtt/status
# Respuesta detallada del estado MQTT
```

### 🧪 Scripts de Prueba y Verificación:

#### 1. Script de Prueba MQTT Completo:
```bash
# Prueba básica (1 mensaje)
python test_mqtt_integration.py --sensor-id 1

# Prueba múltiple con verificación BD
python test_mqtt_integration.py --sensor-id 1 --count 5 --interval 2

# Broker personalizado con autenticación
python test_mqtt_integration.py \
  --broker tu-broker.com \
  --port 1883 \
  --username tu_usuario \
  --password tu_password \
  --sensor-id 1 \
  --count 3
```

#### 2. Verificación de Base de Datos:
```bash
# Verificar datos insertados por MQTT
python verify_database.py
```

#### Salida ejemplo del script de verificación:
```
✅ Conectado a PostgreSQL: localhost:5432/PdM

📊 DATOS DE VIBRACIÓN INSERTADOS:
================================================================================
ID:  5 | Sensor: 1 | Fecha: 2024-01-15 10:30:45.123456-05:00
       Aceleración: X= 1.672, Y= 8.139, Z= 0.975
       Severidad: 0 (Normal) | Anomalía: No

🚨 ALERTAS GENERADAS: 0
📈 ESTADÍSTICAS DEL SENSOR:
   Total registros: 5
   Aceleración promedio: X=-0.764, Y=10.273, Z=0.326
   Severidad máxima: 0
   Total anomalías: 0
```

### 🔄 Flujo de Trabajo de Producción:
1. **Sensor ESP32** → Envía datos → **Broker MQTT**
2. **PdM-Manager** → Recibe automáticamente → **Procesa con ML**
3. **PostgreSQL** → Almacena datos + severidad → **Dashboard actualizado**
4. **Alertas automáticas** → Si severidad alta → **Notificación en sistema**

### ⚠️ Solución de Problemas MQTT:
```bash
# Verificar estado del sistema
curl http://localhost:8000/health

# Verificar estado específico MQTT
curl http://localhost:8000/mqtt/status

# Ver logs del servidor (incluye eventos MQTT)
# Los logs muestran: conexión, mensajes recibidos, errores, etc.
```

## 🖥️ Frontend

### Características del Dashboard:
- **Inicio de sesión requerido**: Acceso vía `/login` y `/register`
- **Dashboard en tiempo real**: Visualización automática de datos MQTT + HTTP
- **🆕 Sin botón "Iniciar Monitoreo"**: Todo es automático al arrancar la aplicación
- **Gestión completa**: Sensores, modelos, límites y máquinas via interfaz web
- **Gráficos interactivos**: Chart.js con filtros y controles de visualización
- **Estado del sistema**: Indicadores visuales del estado MQTT, BD y ML

### Flujo de usuario:
1. **Login** → `/` → **Dashboard automático**
2. **Configuración** → Modelos, sensores, límites, máquinas  
3. **Monitoreo automático** → Datos MQTT se muestran en tiempo real
4. **Alertas visuales** → Notificaciones de severidad alta

## ⚠️ Notas y Resolución de Problemas

### 🗄️ Base de Datos:
- **Conexión**: Verifica credenciales PostgreSQL y que `PdM.sql` se ejecutó sin errores
- **Directorios**: Crea `Modelo/` y `Scaler/` (con mayúscula) para archivos subidos
- **Datos de prueba**: Usa `python verify_database.py` para verificar inserciones

### 🧠 Modelos ML:
- **Modelos no cargados**: Verifica rutas y existencia de archivos; consulta `/health`  
- **Formato de archivos**: `.h5` para modelos Keras, `.pkl` para escaladores
- **Diagnóstico**: El endpoint `/health` muestra estado de carga de modelos

### 📡 MQTT (Nuevas funcionalidades):
- **No conecta**: Verifica configuración del broker en `.env` (MQTT_BROKER, MQTT_PORT)
- **Datos no se procesan**: Verifica que el sensor esté registrado en tabla `sensor`
- **Estado del cliente**: Usa `/mqtt/status` y `/health` para diagnóstico detallado
- **Pruebas**: Ejecuta `python test_mqtt_integration.py` para pruebas completas
- **Verificación BD**: Usa `python verify_database.py` para confirmar inserción de datos
- **Logs**: Revisa los logs de consola para eventos MQTT (conexión, mensajes, errores)

### 🔐 Autenticación:
- **Tokens inválidos**: El `SECRET_KEY` se regenera en cada arranque, requiere relogin tras reinicio
- **CORS**: Abierto (`*`) para desarrollo; restringir en producción
- **Cookies**: JWT almacenado en cookie httponly con samesite=Lax

### 🚀 Producción:
- **Variables de entorno**: Usa `.env` para configuración (ver `.env.example`)
- **Monitoreo**: Consulta `/health` para estado completo del sistema
- **Escalabilidad**: Cliente MQTT usa threading para no bloquear API principal
- **Robustez**: Reconexión automática MQTT en caso de pérdida de conexión

---

## 🆕 **CHANGELOG v2.0 - Integración MQTT Automática**

### ✨ Nuevas Características:
- **Cliente MQTT integrado** con inicio automático al arrancar la aplicación
- **Procesamiento ML automático** de todos los mensajes MQTT recibidos
- **Persistencia automática** en PostgreSQL con clasificación de severidad
- **Alertas automáticas** para severidades >= 2
- **Monitoreo de estado MQTT** vía endpoints `/health` y `/mqtt/status`
- **Scripts de prueba y verificación** (`test_mqtt_integration.py`, `verify_database.py`)
- **Plantilla de configuración** (`.env.example`) con todas las variables

### 🔄 Cambios de UX:
- **Eliminado botón "Iniciar Monitoreo"**: Ya no es necesario - todo es automático
- **Dashboard actualizado**: Muestra estado MQTT en tiempo real
- **Logs mejorados**: Incluyen eventos MQTT detallados
- **Indicadores visuales**: Estado del cliente MQTT visible en la interfaz

### 🛠️ Cambios Técnicos:
- **Nuevo módulo**: `app/mqtt_client.py` con clase `MQTTProcessor`
- **Integración en main.py**: Inicialización automática en startup
- **Nuevas dependencias**: `paho-mqtt`, `requests` en `requirements.txt`
- **Threading robusto**: Cliente MQTT no bloquea API principal
- **Manejo de errores**: Reconexión automática y logging completo

### 📋 Migración desde v1.x:
1. Actualizar dependencias: `pip install -r requirements.txt`
2. Configurar variables MQTT en `.env` (opcional, usa valores por defecto)
3. ⚠️ **Importante**: El botón "Iniciar Monitoreo" ha sido eliminado - todo es automático
4. Verificar que sensores estén registrados en BD antes de enviar datos MQTT
5. Usar scripts de prueba para verificar funcionamiento

### 🎯 Próximas Características (Roadmap):
- Dashboard en tiempo real con WebSockets
- Configuración MQTT desde interfaz web
- Soporte para múltiples brokers MQTT
- Alertas push y notificaciones email
- Análisis predictivo avanzado con tendencias

---

**¡PdM-Manager v2.0 está listo para producción con monitoreo 100% automático!** 🚀