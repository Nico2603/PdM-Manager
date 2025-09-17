# PdM-Manager

Sistema de Mantenimiento Predictivo (PdM) con FastAPI, PostgreSQL y modelo de ML para análisis de vibraciones. Incluye frontend estático (Chart.js), autenticación con formularios (JWT en cookie) y **procesamiento automático en background** de datos MQTT.

## Descripción

PdM-Manager es una solución completa de mantenimiento predictivo que permite:

- 📡 **Integración completa** con sistema MQTT vía `mqtt_ingestor` + procesamiento automático
- 🧠 **Clasificación inteligente** de severidad usando modelos Keras (.h5) y escaladores (.pkl)
- 🗄️ **Persistencia robusta** en PostgreSQL con separación de datos crudos y clasificados
- 📊 **Visualización en tiempo real** con Chart.js y dashboards interactivos
- ⚙️ **Gestión completa** de modelos, límites, sensores y máquinas vía API/UI
- � **Procesamiento ML automático** en background sin intervención manual
- 🏢 **Soporte BD Universidad** y local para desarrollo/producción

## Tecnologías

- **Backend**: FastAPI, Uvicorn
- **Base de datos**: SQLAlchemy (PostgreSQL)
- **Machine Learning**: TensorFlow/Keras, scikit-learn, joblib/pickle
- **Comunicación IoT**: Integración con mqtt_ingestor (paho-mqtt)
- **Frontend**: Chart.js, HTML/CSS/JS (vanilla)
- **Autenticación**: JWT con cookies httponly

## 🌊 **ARQUITECTURA DEL SISTEMA**: Flujo de Datos Completo

### ✨ Flujo de Trabajo:

```
ESP32 Sensores → MQTT Broker (HiveMQ) → mqtt_ingestor → vibration_data (BD Universidad)
                                                             ↓
                                                        (datos crudos)
                                                             ↓
PdM-Manager Background → Lee vibration_data → Escalador → Modelo ML → classified_data
                                                                         ↓
                                                                   (datos clasificados)
                                                                         ↓
                                                                  Interfaz Web + Alertas
```

### 🔧 Componentes del Sistema:

- **ESP32**: Sensores IoT enviando datos triaxiales al broker MQTT
- **mqtt_ingestor**: Servicio independiente que consume MQTT y guarda datos crudos
- **PdM-Manager**: Aplicación web que procesa datos crudos con ML y presenta interfaz
- **PostgreSQL Universidad**: Base de datos centralizada con dos tablas principales:
  - `vibration_data`: Datos crudos del mqtt_ingestor
  - `classified_data`: Datos procesados y clasificados por PdM-Manager

### ⚡ Procesamiento Automático:

1. **Background Processor**: Servicio que ejecuta cada 30 segundos
2. **Escalador + Modelo ML**: Procesamiento automático de datos nuevos
3. **Clasificación de Severidad**: 0=Normal, 1=Leve, 2=Grave
4. **Alertas Automáticas**: Generación automática para severidad >= 2

## Requisitos

- Python 3.12 (recomendado)
- PostgreSQL 13+
- `pip` y `venv`
- **mqtt_ingestor** ejecutándose en el servidor (para ingestión de datos MQTT)

## 🚀 Instalación y Configuración

### Opción A: Desarrollo Local

```bash
# 1. Clonar y crear entorno
git clone https://github.com/tu-usuario/PdM-Manager.git
cd PdM-Manager
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# 2. Configurar .env para BD local
cp .env.example .env
# Editar .env con configuración local:
DATABASE_URL=postgresql://postgres:password@localhost:5432/pdm_manager

# 3. Crear BD local
createdb pdm_manager -U postgres
psql -U postgres -d pdm_manager -f PdM.sql

# 4. Ejecutar aplicación
python -m app.main
```

### Opción B: Despliegue en Servidor Universidad

```bash
# 1. Preparar proyecto (eliminar archivos temporales)
rm -rf app/__pycache__/
# Crear ZIP del proyecto limpio

# 2. En el servidor (vía escritorio remoto):
# - Descargar ZIP por WhatsApp
# - Extraer archivos
unzip PdM-Manager.zip
cd PdM-Manager

# 3. Crear entorno virtual
python -m venv pdm_env
# Windows: pdm_env\Scripts\activate
# Linux: source pdm_env/bin/activate
pip install -r requirements.txt

# 4. Configurar .env para BD Universidad
nano .env
# Cambiar a:
DATABASE_URL=postgresql://consultadb:c0nsult4@10.1.11.230:5432/sensor

# 5. Configurar BD (SOLO LA PRIMERA VEZ)
psql -h 10.1.11.230 -U consultadb -d sensor -f PdM.sql

# 6. Ejecutar aplicación
python -m app.main
```

### ✅ Verificación del Sistema

```bash
# 1. Verificar conectividad BD
python -c "from app.database import engine; print('✅ BD conectada')"

# 2. Verificar datos del mqtt_ingestor
psql -h 10.1.11.230 -U consultadb -d sensor -c "SELECT COUNT(*) FROM vibration_data;"

# 3. Verificar procesamiento ML
psql -h 10.1.11.230 -U consultadb -d sensor -c "SELECT COUNT(*) FROM classified_data;"

# 4. Verificar aplicación web
curl http://localhost:8000/health
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
│  ├─ main.py               # App FastAPI con endpoints web y API
│  ├─ background_processor.py  # 🔄 Procesador ML automático en background
│  ├─ ml_processor.py       # 🧠 Lógica de escalador + modelo ML + clasificación
│  ├─ auth.py               # Autenticación (JWT en cookie), hashing
│  ├─ database.py           # Motor/sesión SQLAlchemy (PostgreSQL)
│  ├─ models.py             # ORM: ClassifiedData, RawVibrationData, Sensor, etc.
│  ├─ crud.py               # CRUD datos/alertas/sensores/máquinas/límites
│  ├─ crud_config.py        # CRUD de configuración y utilidades
│  ├─ config.py             # Endpoints gestión de modelos/límites/sensores/máquinas
│  └─ mqtt_client.py        # Cliente MQTT (heredado, puede no usarse)
├─ static/
│  ├─ index.html            # Dashboard principal
│  ├─ login.html            # Página de login
│  ├─ register.html         # Página de registro
│  ├─ js/
│  │  ├─ app.js             # Lógica frontend principal
│  │  └─ charts.js          # Gráficos Chart.js
│  └─ css/style.css         # Estilos del sistema
├─ modelo/
│  └─ modeloRNN_multiclase_v3_finetuned.h5  # Modelo ML principal
├─ scaler/
│  └─ scaler_RNN.pkl        # Escalador para preprocesamiento
├─ .env                     # Variables de entorno (no incluir en git)
├─ .env.example             # Plantilla de configuración
├─ PdM.sql                  # ✅ Script BD actualizado (classified_data)
└─ requirements.txt         # Dependencias del proyecto
```

## API principal

- **Salud y Monitoreo**

  - GET `/health` - Estado completo del sistema (BD, ML, procesador background)

- **Datos de vibración**

  - POST `/sensor-data` - Ingesta manual vía HTTP (alternativa)
  - GET `/vibration-data` (query: `sensor_id`, `limit`, `start_date`, `end_date`)
  - 📊 **Datos automáticos**: Via mqtt_ingestor → vibration_data → background processor → classified_data

- **Configuración consolidada**

  - GET `/config` - Configuración completa del sistema

- **Modelos (ML)**

  - GET `/models` - Listar modelos disponibles
  - POST `/models` - Subir nuevo modelo (.h5 + .pkl)
  - PUT/DELETE `/models/{model_id}` - Gestionar modelos existentes

- **Sensores, Máquinas, Límites**
  - CRUD completo para gestión de configuración
  - Endpoints estándar con filtros y paginación

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

- Normalización con escalador (`scaler_RNN.pkl`); predicción con modelo Keras (`modeloRNN_multiclase_v3_finetuned.h5`)
- Clasificación automática: Clase 0=Normal, 1=Leve, 2=Grave
- Si `severidad >= 2`, se registra alerta asociada automáticamente
- Procesamiento en background cada 30 segundos (configurable)

## 🔄 Procesamiento Automático en Background

### Funcionamiento:

1. **Servicio Background**: Se inicia automáticamente con la aplicación
2. **Consulta Periódica**: Cada 30s busca datos nuevos en `vibration_data`
3. **Procesamiento ML**: Aplica escalador → modelo → clasificación
4. **Persistencia**: Guarda resultados en `classified_data` con severidad
5. **Alertas**: Genera alertas automáticas para severidad >= 2

### Configuración:

```env
# En .env
PROCESSING_INTERVAL=30  # Intervalo en segundos (default: 30)
MODEL_H5_PATH=modelo/modeloRNN_multiclase_v3_finetuned.h5
SCALER_PKL_PATH=scaler/scaler_RNN.pkl
```

### Monitoreo:

- Logs detallados del procesamiento
- Estado visible en `/health`
- Contadores de registros procesados

## 🖥️ Frontend

### Características:

- **Autenticación requerida**: Login via `/login` y `/register`
- **Dashboard en tiempo real**: Visualización de datos clasificados
- **Gestión completa**: Interfaz web para configurar sensores, modelos, límites
- **Gráficos interactivos**: Chart.js con datos de `classified_data`
- **Alertas visuales**: Notificaciones de severidad alta automáticas

## ⚠️ Notas y Resolución de Problemas

### 🗄️ Base de Datos:

- **Conexión**: Verifica credenciales PostgreSQL y que `PdM.sql` se ejecutó correctamente
- **Tabla vibration_data**: Debe existir y ser llenada por mqtt_ingestor
- **Tabla classified_data**: Creada por PdM.sql, contiene datos procesados
- **Diagnóstico**: Usa `/health` para verificar conectividad

### 🧠 Modelos ML:

- **Archivos requeridos**:
  - `modelo/modeloRNN_multiclase_v3_finetuned.h5` (modelo)
  - `scaler/scaler_RNN.pkl` (escalador)
- **Carga automática**: Se cargan al iniciar la aplicación
- **Diagnóstico**: El endpoint `/health` muestra estado de carga

### � Procesador Background:

- **Estado**: Visible en `/health` como "background_processor"
- **Logs**: Buscar "ml_processor" y "background_processor" en consola
- **Intervalo**: Configurable via `PROCESSING_INTERVAL` en .env
- **Problemas**: Verificar que mqtt_ingestor esté llenando `vibration_data`

### 🏢 Configuración Servidor Universidad:

- **Red**: Requiere estar en WiFi de la universidad para acceder a BD
- **Credenciales**: `10.1.11.230:5432`, usuario `consultadb`, BD `sensor`
- **Dependencia**: mqtt_ingestor debe estar ejecutándose en el servidor
- **Verificación**: `psql -h 10.1.11.230 -U consultadb -d sensor -c "SELECT COUNT(*) FROM vibration_data;"`

### 🔐 Autenticación:

- **Tokens**: JWT almacenado en cookie httponly
- **Regeneración**: SECRET_KEY se regenera en cada arranque (requiere relogin)
- **Acceso**: Usuario/contraseña se crean via `/register`

---

## 📋 **RESUMEN DEL SISTEMA ACTUALIZADO**

### ✅ Flujo de Datos Final:

1. **ESP32 Sensores** → **MQTT Broker (HiveMQ)** → **mqtt_ingestor** → **vibration_data**
2. **PdM-Manager Background** → Lee **vibration_data** → Procesa ML → **classified_data**
3. **Interfaz Web** → Lee **classified_data** → **Gráficas + Alertas**

### 🎯 Características Principales:

- ✅ **Separación clara**: Datos crudos vs clasificados
- ✅ **Procesamiento automático**: Background processor cada 30s
- ✅ **Escalabilidad**: Independiente del mqtt_ingestor
- ✅ **Robustez**: Manejo de errores y reconexión automática
- ✅ **Monitoreo**: Estado completo via `/health`

### � Listo para Producción:

- ✅ **BD Universidad**: Soporte completo configurado
- ✅ **Modelos ML**: Carga automática de escalador + modelo
- ✅ **Interfaz Web**: Dashboard completo con autenticación
- ✅ **Alertas**: Generación automática de alertas críticas

**¡Sistema completo y funcional para mantenimiento predictivo en tiempo real!** 🎉
