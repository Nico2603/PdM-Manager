# PdM-Manager

Sistema de Mantenimiento Predictivo para monitoreo y análisis de vibraciones en maquinaria industrial.

## Descripción

PdM-Manager es una aplicación web para el monitoreo en tiempo real de sensores de vibración en maquinaria industrial. Permite la recolección, procesamiento y visualización de datos de vibración, así como la detección de anomalías y la predicción de fallos mediante algoritmos de aprendizaje automático.

## Características

- Monitoreo en tiempo real de sensores de vibración
- Registro y visualización de datos históricos
- Detección de anomalías y clasificación de severidad
- Interfaz gráfica para visualización de datos
- API RESTful para integración con otros sistemas

## Requisitos

- Python 3.8 o superior
- PostgreSQL o SQLite
- Dependencias listadas en `requirements.txt`

## Instalación

1. Clonar el repositorio:
```
git clone https://github.com/tu-usuario/PdM-Manager.git
cd PdM-Manager
```

2. Crear y activar un entorno virtual:
```
python -m venv venv
source venv/bin/activate  # En Linux/macOS
venv\Scripts\activate     # En Windows
```

3. Instalar las dependencias:
```
pip install -r requirements.txt
```

4. Configurar la base de datos:
```
# Crear la base de datos y tablas
python -m app.database
```

## Uso

Para iniciar el servidor:
```
python -m uvicorn app.main:app --reload
```

La aplicación estará disponible en: http://localhost:8000

## API Endpoints

- `GET /health`: Verifica el estado del sistema
- `GET /sensors`: Lista todos los sensores disponibles
- `POST /sensor-data`: Envía datos de un sensor
- `GET /vibration-data`: Consulta datos de vibración filtrados

## Pruebas

Para ejecutar todas las pruebas automáticamente use el script correspondiente a su sistema operativo:

En Windows:
```
run_tests.bat
```

En Unix/Linux:
```
chmod +x run_tests.sh  # Dar permisos de ejecución (solo la primera vez)
./run_tests.sh
```

Estos scripts realizarán las siguientes acciones:
1. Crearán un entorno virtual si no existe
2. Instalarán las dependencias necesarias
3. Configurarán las variables de entorno para las pruebas
4. Crearán archivos de recursos mock si es necesario
5. Ejecutarán las pruebas unitarias y de integración
6. Generarán un informe de cobertura

### Ejecutar pruebas manualmente

#### Pruebas Unitarias

Para ejecutar las pruebas unitarias:
```
python -m pytest tests/test_unit.py
```

#### Pruebas de Integración

Para ejecutar las pruebas de integración:
```
# Configurar el modo de prueba
set TESTING=1  # Windows
export TESTING=1  # Unix/Linux

# Ejecutar las pruebas
python -m pytest tests/test_integration.py -v
```

#### Pruebas con Cobertura

Para ejecutar las pruebas y generar informes de cobertura:
```
python -m pytest --cov=app tests/
```

Para más detalles sobre las pruebas, consulta [tests/README.md](tests/README.md)

## Estructura del Proyecto

```
PdM-Manager/
├── app/                  # Código principal de la aplicación
│   ├── crud.py           # Operaciones CRUD para la base de datos
│   ├── database.py       # Configuración de la base de datos
│   ├── main.py           # Punto de entrada y endpoints de la API
│   └── ...
├── static/               # Archivos estáticos (CSS, JS, imágenes)
│   ├── css/
│   ├── js/
│   └── ...
├── tests/                # Pruebas unitarias y de integración
├── requirements.txt      # Dependencias principales
├── requirements-test.txt # Dependencias para pruebas
└── ...
```

## Licencia

[MIT License](LICENSE)

## Arquitectura del Sistema

### Flujo de Datos

1. **Captura de Datos**
   - Los sensores de vibración triaxial instalados en las máquinas miden las aceleraciones en los ejes X, Y y Z
   - Estos datos son enviados al sistema junto con un identificador de sensor y una marca de tiempo

2. **Procesamiento y Clasificación**
   - La API recibe los datos a través del endpoint `/sensor-data`
   - Los datos son validados y preprocesados utilizando un escalador (.pkl)
   - Un modelo de Red Neuronal Recurrente (.h5) clasifica cada lectura y asigna un nivel de severidad (0-3)
   - Los resultados del procesamiento se almacenan en la base de datos

3. **Almacenamiento**
   - Los datos de vibración se guardan en la tabla `vibration_data`
   - Las alertas generadas se registran en la tabla `alerts`
   - La configuración de límites y parámetros se mantiene en tablas específicas

4. **Consulta y Visualización**
   - El frontend solicita datos al backend a través de endpoints REST
   - Los datos son mostrados en gráficos, tablas y paneles de control
   - El sistema permite filtrar por fecha, sensor y otros parámetros

### Operaciones CRUD

El sistema implementa operaciones CRUD (Crear, Leer, Actualizar, Eliminar) para las siguientes entidades:

#### Datos de Vibración
- **Crear**: Endpoint POST `/sensor-data` para recibir y almacenar nuevos datos
- **Leer**: Endpoint GET `/vibration-data` para consultar datos históricos con filtros por sensor, fecha, etc.
- **Actualizar**: Funcionalidad interna para actualizar el estado o severidad
- **Eliminar**: Funcionalidad interna para mantenimiento de datos

#### Sensores
- **Crear**: Registro de nuevos sensores con nombre, descripción y configuración
- **Leer**: Endpoint GET `/sensors` para listar los sensores disponibles
- **Actualizar**: Actualización de parámetros y configuración de sensores
- **Eliminar**: Eliminación lógica o física de sensores no utilizados

#### Alertas
- **Crear**: Generación automática de alertas basada en el análisis de datos
- **Leer**: Consulta de alertas históricas y activas
- **Actualizar**: Cambio de estado (resuelta, en proceso, etc.)
- **Eliminar**: Funcionalidad de limpieza para alertas antiguas

### Comunicación Backend-Frontend

1. **API RESTful**
   - El backend expone una API RESTful que sirve como punto de comunicación con el frontend
   - Los endpoints están documentados y siguen estándares HTTP para métodos y códigos de estado

2. **Intercambio de Datos**
   - Las solicitudes y respuestas utilizan formato JSON
   - La autenticación se realiza mediante tokens JWT para operaciones protegidas
   - Los endpoints principales incluyen:
     - `/health`: Verificación del estado del sistema
     - `/sensor-data`: Envío de datos de sensores
     - `/vibration-data`: Consulta de datos históricos
     - `/sensors`: Gestión de sensores

3. **Tiempo Real**
   - Las actualizaciones críticas (como alertas) pueden ser enviadas en tiempo real
   - El dashboard se actualiza periódicamente para mostrar datos recientes

4. **Gestión de Errores**
   - Errores de validación, procesamiento o base de datos son manejados con respuestas HTTP apropiadas
   - El frontend interpreta estos errores y muestra mensajes informativos al usuario

## Modo de Pruebas

El sistema incluye un modo especial para pruebas activado mediante la variable de entorno `TESTING=1`. En este modo:

1. No se requiere conexión a la base de datos real
2. Se generan datos simulados para los endpoints
3. Las validaciones de seguridad se relajan para facilitar las pruebas
4. El sistema garantiza que todas las funcionalidades puedan probarse sin dependencias externas

Para ejecutar las pruebas, utilice los scripts proporcionados (`run_tests.bat` o `run_tests.sh`).

## Desarrollo Futuro

- **Mejoras en Visualización**: Implementar gráficos interactivos y paneles personalizables
- **Aprendizaje Continuo**: Permitir que el modelo se actualice con nuevos datos
- **Integración IoT**: Ampliar la compatibilidad con más dispositivos y protocolos
- **Análisis Avanzado**: Incorporar algoritmos de análisis espectral y wavelets
- **App Móvil**: Desarrollar una aplicación móvil para monitoreo en tiempo real .
