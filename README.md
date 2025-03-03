# PDM Manager

![Portada del Proyecto](https://example.com/imagen_portada.png "Portada del Proyecto")  
> _Nota:_ Reemplaza el link de arriba con tu propia imagen.

---

## Descripción General

**PDM Manager** es una aplicación de **Mantenimiento Predictivo (PdM)** enfocada en la gestión, análisis y visualización de datos de vibración. Permite:

- Cargar y consultar datos de sensores desde una base de datos PostgreSQL.
- Visualizar gráficas en tiempo real (o bajo demanda) con **Chart.js**.
- Aplicar un modelo de Machine Learning (en formato `.h5`) para **predecir** el estado de la máquina (p. ej. _normal_, _leve_, _crítico_).

El proyecto está desarrollado con **FastAPI** para la capa backend y utiliza una **SPA (Single Page Application)** en la carpeta `static/` para la capa frontend.

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
│   └── modeloRNN_multiclase_optimizado.h5   # Modelo entrenado en formato .h5
├── app/
│   ├── __init__.py
│   ├── database.py      # Configuración de la base de datos (SQLAlchemy)
│   ├── models.py        # Definición de tablas (DataSensor, etc.)
│   ├── crud.py          # Funciones para consultar datos (get_data_by_sensor_and_dates)
│   └── main.py          # Punto de entrada de la app FastAPI
├── static/
│   ├── css/
│   │   └── style.css    # Estilos CSS para la SPA
│   └── index.html       # SPA principal con navbar, Chart.js, etc.
├── README.md            # Este documento
└── requirements.txt     # Dependencias (FastAPI, SQLAlchemy, etc.)
```

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
2. Crea una base de datos (p. ej. `servomonitor_xglp`).
3. En `app/database.py`, ajusta la variable `DATABASE_URL` o establece la variable de entorno `DATABASE_URL`.
   - Ejemplo de URL: `postgresql://usuario:password@localhost:5432/servomonitor_xglp`.
4. Coloca tu modelo `.h5` en la carpeta `Modelo/`.
   - Asegúrate de que el nombre coincida con el especificado en `main.py` (por defecto `modeloRNN_multiclase_optimizado.h5`).

## Uso de la Aplicación

### Ejecuta la app en modo local:
```bash
uvicorn app.main:app --reload
```
Esto levantará el servidor en `http://127.0.0.1:8000`.

### Accede a la SPA en tu navegador:
Abre `http://127.0.0.1:8000/`
- Verás la interfaz principal con un navbar lateral (Inicio, Gráficas, Predicción).

#### Sección Inicio
- Muestra un mensaje de bienvenida y el estado de la conexión a la base de datos (`/check_db`).

#### Sección Gráficas
1. Rellena los campos **Sensor ID, Fecha inicio, Fecha fin**.
2. Pulsa **Consultar** para llamar al endpoint `"/get_vibration_data"`.
3. Se dibujará una gráfica con Chart.js mostrando ejes X, Y, Z.

#### Sección Predicción
1. Rellena los mismos campos **Sensor ID, Fecha inicio, Fecha fin**.
2. Pulsa **Predecir** para llamar al endpoint `"/predict_condition"`.
3. Se mostrará la clase predicha (p. ej. **“normal”, “leve”, “crítico”**).

## Endpoints Principales

### `GET /check_db`
- Verifica la conexión a la base de datos.
- Retorna `{"status":"ok"}` o `{"status":"error", "error":"..."}`.

### `GET /get_vibration_data?sensor_id=X&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- Consulta registros de la tabla `data_sensor`.
- Retorna un JSON con listas: **fechas, eje_x, eje_y, eje_z**.

### `GET /predict_condition?sensor_id=X&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- Consulta los mismos datos de vibración, arma un array **numpy (1, timesteps, 3)** y llama `model.predict()`.
- Retorna la clase predicha: **“normal”, “leve” o “crítico”**.

## Contribuciones
1. Forkea este repositorio y crea tu rama de características.
2. Haz cambios o mejoras en la estructura, endpoints, etc.
3. Envía un **pull request** con una descripción clara de lo que aportas.
4. También puedes abrir **issues** para sugerir nuevas funcionalidades o reportar bugs.

---

## ¡Gracias por usar PDM Manager!
Si tienes dudas o sugerencias, no dudes en abrir un **issue** o contactarnos.

¡Éxitos en tu proyecto de **Mantenimiento Predictivo**!