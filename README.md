# PdM-Manager

Sistema de Mantenimiento Predictivo (PdM) con FastAPI, PostgreSQL y un modelo de ML para análisis de vibraciones. Incluye frontend estático (Chart.js) y autenticación con formularios (JWT en cookie).

## Descripción

PdM-Manager permite:
- Ingestar lecturas triaxiales por sensor
- Clasificar severidad con un modelo Keras (.h5) y escalador (.pkl)
- Persistir datos/alertas en PostgreSQL
- Visualizar métricas y alertas (Chart.js)
- Gestionar modelos, límites, sensores y máquinas vía API/UI

## Tecnologías
- FastAPI, Uvicorn
- SQLAlchemy (PostgreSQL)
- TensorFlow/Keras, scikit-learn, joblib/pickle
- Chart.js, HTML/CSS/JS

## Requisitos
- Python 3.12 (recomendado)
- PostgreSQL 13+
- `pip` y `venv`

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

2) Variables de entorno (BD)
Crea `.env` o exporta variables. Valores por defecto en `app/database.py`:
```env
DB_USER=postgres
DB_PASSWORD=pdm123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=PdM
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
│  ├─ main.py           # App FastAPI, rutas web y API
│  ├─ auth.py           # Autenticación (JWT en cookie), hashing
│  ├─ database.py       # Motor/sesión SQLAlchemy (PostgreSQL)
│  ├─ models.py         # ORM: model, sensor, machine, vibration_data, alert, limit_config, system_config, users
│  ├─ crud.py           # CRUD datos/alertas/sensores/máquinas/límites
│  ├─ crud_config.py    # CRUD de configuración y utilidades
│  └─ config.py         # Endpoints gestión de modelos/límites/sensores/máquinas
├─ static/
│  ├─ index.html        # Dashboard/Configuración
│  ├─ login.html        # Login
│  ├─ register.html     # Registro
│  ├─ js/{app.js,charts.js}
│  └─ css/style.css
├─ PdM.sql              # Esquema/índices/trigger
├─ modelo/              # Ejemplos de modelos (minúscula)
├─ scaler/              # Ejemplos de escaladores (minúscula)
└─ requirements.txt
```

## API principal

- Salud
  - GET `/health`

- Datos de vibración
  - POST `/sensor-data`
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

## Frontend
- `static/index.html` usa la API para listar sensores, gestionar límites/modelos/sensores/máquinas y graficar datos
- Requiere login para acceder al panel

## Notas y resolución de problemas
- BD: verifica conexión/credenciales y que `PdM.sql` se ejecutó sin errores
- Directorios: crea `Modelo/` y `Scaler/` para la subida de archivos
- Modelos no cargados: verifica rutas y existencia de archivos; revisa `/health`
- CORS: abierto (`*`) para desarrollo; restringe en producción
- Tokens inválidos tras reinicio: inicia sesión de nuevo