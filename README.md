# PDM Manager

![Portada del Proyecto](https://example.com/imagen_portada.png "Portada del Proyecto")  
> _Nota:_ Reemplaza el link de arriba con tu propia imagen.

---

## Descripción General

**PDM Manager** es una aplicación de **Mantenimiento Predictivo (PdM)** enfocada en la gestión, análisis y visualización de datos de vibración en tiempo real. Permite:

- Capturar datos de sensores triaxiales conectados directamente a la plataforma.
- Preprocesar/escalar los datos con el escalador optimizado (`.pkl`).
- Clasificar las vibraciones utilizando un modelo RNN (`.h5`) para detectar severidades (normal, nivel 1, nivel 2).
- Detectar automáticamente el nivel 3 (crítico) basado en la frecuencia de alertas nivel 2.
- Almacenar los datos en una base de datos PostgreSQL para su posterior análisis.
- Visualizar en tiempo real el estado de los sensores y las alertas a través de un dashboard intuitivo.
- Consultar el histórico de datos con filtros avanzados.

El proyecto está desarrollado con **FastAPI** para la capa backend y utiliza una **SPA (Single Page Application)** para la capa frontend.

---

## 🚀 Despliegue en Producción

La aplicación está desplegada en **Render** y puedes acceder a ella en el siguiente enlace:

🔗 [PDM Manager en Render](https://pdm-manager.onrender.com)

---

## Arquitectura y Estructura

La estructura principal del proyecto es:

```bash
PDM-Manager/
├── Modelo/
│   ├── modeloRNN_multiclase_v3_finetuned.h5   # Modelo entrenado para clasificación
│   └── scaler_RNN.pkl                         # Escalador para normalizar datos
├── app/
│   ├── __init__.py
│   ├── database.py      # Configuración de la base de datos (SQLAlchemy)
│   ├── models.py        # Definición de tablas (Sensor, Machine, Model, VibrationData, Alert)
│   ├── crud.py          # Funciones para interactuar con la BD
│   └── main.py          # Punto de entrada de la app FastAPI (endpoints, lógica ML)
├── static/
│   ├── css/
│   │   ├── style.css     # Estilos CSS básicos
│   │   └── dashboard.css # Estilos específicos del dashboard
│   └── index.html        # SPA principal con dashboard, históricos y configuración
├── README.md            # Este documento
└── requirements.txt     # Dependencias (FastAPI, SQLAlchemy, TensorFlow, etc.)
```

## Flujo de Datos

El sistema implementa el siguiente flujo de datos:

1. **Captura de Datos**: Los sensores triaxiales envían datos de aceleración (X, Y, Z) a la API.
2. **Preprocesamiento**: Los datos son preprocesados y escalados utilizando un escalador previamente entrenado (`.pkl`).
3. **Clasificación**: El modelo RNN (`.h5`) clasifica las vibraciones en tres niveles:
   - **Nivel 0**: Normal (sin alerta)
   - **Nivel 1**: Anomalía leve (requiere atención)
   - **Nivel 2**: Anomalía moderada (requiere mantenimiento pronto)
4. **Detección de Nivel 3**: Si se detectan múltiples alertas de Nivel 2 en un período corto, se genera una alerta de Nivel 3 (crítica).
5. **Almacenamiento**: Todos los datos de vibración se almacenan en la tabla `VibrationData` con su severidad correspondiente.
6. **Alertas**: Las anomalías (severidad > 0) generan registros en la tabla `Alert` para su seguimiento.
7. **Visualización**: El dashboard muestra en tiempo real las tendencias de vibración, alertas activas y estadísticas.

## Requisitos

1. **Python 3.8+**  
2. **PostgreSQL** (local o remoto, p. ej. en Render).  
3. **TensorFlow** (para cargar el modelo `.h5`).  
4. **SQLAlchemy**, **FastAPI**, **Uvicorn** y otras dependencias incluidas en `requirements.txt`.

Para ver la lista completa, revisa el archivo:

```bash
pip install -r requirements.txt
```

## Instalación y Configuración

### Clona el repositorio:
```bash
git clone https://github.com/usuario/PDM-Manager.git
cd PDM-Manager
```

### Crea un entorno virtual (opcional pero recomendado):
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows
```

### Instala las dependencias:
```bash
pip install -r requirements.txt
```

### Configura la base de datos:
1. Asegúrate de tener PostgreSQL corriendo.
2. Crea una base de datos (p. ej. `pdm_manager_db`).
3. En `app/database.py`, ajusta la variable `DATABASE_URL` o establece la variable de entorno `DATABASE_URL`.
   - Ejemplo de URL: `postgresql://usuario:password@localhost:5432/pdm_manager_db`.
4. Coloca tu modelo `.h5` y escalador `.pkl` en la carpeta `Modelo/`.
   - Asegúrate de que los nombres coincidan con los especificados en `main.py`.

## Uso de la Aplicación

### Ejecuta la app en modo local:
```bash
uvicorn app.main:app --reload
```
Esto levantará el servidor en `http://127.0.0.1:8000`.

### Accede a la SPA en tu navegador:
Abre `http://127.0.0.1:8000/`
- Verás la interfaz principal con un menú lateral (Dashboard, Históricos, Configuración).

#### Dashboard
- Muestra en tiempo real el estado de los sensores, alertas activas y gráficos de tendencias.
- Los filtros permiten seleccionar máquinas y sensores específicos.
- Las tarjetas de alertas muestran el conteo de problemas por nivel de severidad.

#### Históricos
- Permite consultar datos históricos con filtros avanzados por fecha, sensor, máquina y severidad.
- Visualiza los resultados en formato tabular y gráfico.
- Exporta los datos filtrados en formato CSV.

#### Configuración
- Gestiona máquinas, sensores y modelos.
- Configura los límites estadísticos (±2σ, ±3σ) para cada eje.
- Asigna modelos específicos a máquinas.

## API Endpoints Principales

### `GET /check_db`
- Verifica la conexión a la base de datos.
- Retorna `{"status":"ok"}` o `{"status":"error", "error":"..."}`.

### `POST /api/sensor_data`
- Recibe datos del sensor triaxial, los procesa y guarda en la BD.
- Cuerpo de la solicitud:
  ```json
  {
    "sensor_id": 1,
    "acceleration_x": 0.25,
    "acceleration_y": 0.5,
    "acceleration_z": 0.75
  }
  ```
- Retorna el resultado de la clasificación y el ID del registro guardado.

### `GET /api/dashboard`
- Obtiene datos para el dashboard (alertas, datos recientes).
- Parámetros opcionales: `sensor_id` para filtrar por sensor.

### `GET /api/vibration-data`
- Consulta datos de vibración almacenados.
- Parámetros: `sensor_id` (opcional), `limit` (opcional, defecto 100).

### `GET /api/alerts`
- Obtiene alertas activas.
- Parámetros: `sensor_id` (opcional), `acknowledged` (opcional), `limit` (opcional).

### `PUT /api/alerts/{alert_id}/acknowledge`
- Marca una alerta como reconocida.

## Seguridad y Escalabilidad

- La aplicación está diseñada para manejar múltiples sensores y máquinas.
- La base de datos incluye índices optimizados para consultas rápidas.
- Se puede desplegar en sistemas de alta disponibilidad para monitoreo 24/7.
- Recomendado configurar HTTPS en producción.

## Contribuciones
1. Forkea este repositorio y crea tu rama de características.
2. Haz cambios o mejoras en la estructura, endpoints, etc.
3. Envía un **pull request** con una descripción clara de lo que aportas.
4. También puedes abrir **issues** para sugerir nuevas funcionalidades o reportar bugs.

---

## ¡Gracias por usar PDM Manager!
Si tienes dudas o sugerencias, no dudes en abrir un **issue** o contactarnos.

¡Éxitos en tu proyecto de **Mantenimiento Predictivo**!