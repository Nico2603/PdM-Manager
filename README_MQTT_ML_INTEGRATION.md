# Integración MQTT y ML - Guía de Implementación

## Resumen de los Cambios Realizados

### 1. Base de Datos Modificada (`PdM.sql`)

- **Cambio principal**: La tabla `vibration_data` se renombró a `classified_data`
- **Razón**: Evitar conflictos con la tabla `vibration_data` creada por `mqtt_ingestor`
- **Nueva estructura**:
  - `classified_data`: Datos procesados y clasificados por ML
  - `vibration_data`: Datos crudos del broker MQTT (creada por mqtt_ingestor)

### 2. Modelos SQLAlchemy Actualizados (`app/models.py`)

- **ClassifiedData**: Nuevo modelo para datos clasificados
- **RawVibrationData**: Modelo de solo lectura para datos crudos del mqtt_ingestor
- **Relaciones**: Actualizadas para usar `classified_data` en lugar de `vibration_data`

### 3. Nuevo Procesador ML (`app/ml_processor.py`)

**Funcionalidades**:

- Lee datos crudos de `vibration_data`
- Aplica el escalador (`scaler.pkl`)
- Clasifica con el modelo RNN (`modelo.h5`)
- Guarda resultados clasificados en `classified_data`

**Clases de clasificación**:

- Clase 0: Normal (severity=0, is_anomaly=0)
- Clase 1: Leve (severity=1, is_anomaly=1)
- Clase 2: Grave (severity=2, is_anomaly=1)

### 4. Servicio en Background (`app/background_processor.py`)

- Ejecuta el procesamiento ML cada 30 segundos (configurable)
- Se inicia automáticamente con la aplicación
- Maneja errores y reconexión

### 5. Configuración de Entorno (`.env.example`)

Nuevas variables agregadas:

```bash
# BD Universidad (descomenta para usar)
# DB_HOST=10.1.11.230
# DB_NAME=sensor
# DB_USER=consultadb

# Rutas del modelo ML
MODEL_H5_PATH=modelo/modeloRNN_multiclase_v3_finetuned.h5
SCALER_PKL_PATH=scaler/scaler_RNN.pkl
PROCESSING_INTERVAL=30
```

## Flujo de Datos Implementado

```
ESP32 Sensor → MQTT Broker (HiveMQ) → mqtt_ingestor → vibration_data (BD Universidad)
                                                            ↓
PdM-Manager Background Processor ← vibration_data (lee datos crudos)
                ↓
        Aplicar Escalador (scaler.pkl)
                ↓
        Clasificar con Modelo RNN (.h5)
                ↓
        Guardar en classified_data (BD Universidad)
                ↓
        Interfaz Web (gráficas y alertas)
```

## Pasos para el Despliegue

### 1. Preparar Base de Datos en Universidad

```bash
# Conectarse a la BD universidad (desde red wifi UCP)
psql -h 10.1.11.230 -p 5432 -U consultadb -d sensor

# Ejecutar el script modificado
\i PdM.sql
```

**Nota**: El script creará:

- Todas las tablas del PdM-Manager con `classified_data`
- La tabla `vibration_data` será creada automáticamente por mqtt_ingestor

### 2. Configurar Variables de Entorno

```bash
# Copiar y configurar variables de entorno
cp .env.example .env

# Editar .env y descomentar configuración de BD universidad:
DB_HOST=10.1.11.230
DB_NAME=sensor
DB_USER=consultadb
DB_PASSWORD=tu_password_aqui
```

### 3. Instalar Dependencias

```bash
pip install -r requirements.txt
```

### 4. Verificar Archivos del Modelo

Asegurar que existen:

- `modelo/modeloRNN_multiclase_v3_finetuned.h5`
- `scaler/scaler_RNN.pkl`

### 5. Ejecutar la Aplicación

```bash
# Desde el directorio PdM-Manager
python -m app.main

# O usando uvicorn directamente
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verificación del Funcionamiento

### 1. Verificar mqtt_ingestor está funcionando

```sql
-- Verificar que hay datos crudos llegando
SELECT COUNT(*) FROM public.vibration_data;
SELECT * FROM public.vibration_data ORDER BY ts DESC LIMIT 5;
```

### 2. Verificar procesamiento ML

```sql
-- Verificar que hay datos clasificados
SELECT COUNT(*) FROM public.classified_data;

-- Ver datos procesados recientes
SELECT
    cd.data_id,
    cd.sensor_id,
    cd.date,
    cd.severity,
    cd.is_anomaly,
    cd.raw_data_id
FROM public.classified_data cd
ORDER BY cd.date DESC LIMIT 10;
```

### 3. Logs de la aplicación

```bash
# Verificar logs del procesador ML
tail -f app.log | grep "ml_processor\|background_processor"
```

Buscar mensajes como:

- `✅ Modelo ML cargado desde modelo/...`
- `✅ Escalador cargado desde scaler/...`
- `🚀 Procesador ML iniciado`
- `✅ Procesados N registros en X.XXs`

## Troubleshooting

### Problema: Modelo no se carga

**Solución**: Verificar rutas en `.env`:

```bash
MODEL_H5_PATH=modelo/modeloRNN_multiclase_v3_finetuned.h5
SCALER_PKL_PATH=scaler/scaler_RNN.pkl
```

### Problema: Sin datos para procesar

**Verificar**:

1. mqtt_ingestor está funcionando y llenando `vibration_data`
2. Conexión a la BD universidad
3. Logs del background processor

### Problema: Error de conexión BD

**Solución**:

1. Verificar estar en red WiFi universidad
2. Comprobar credenciales en `.env`
3. Probar conexión manual:

```bash
psql -h 10.1.11.230 -p 5432 -U consultadb -d sensor -c "SELECT 1"
```

## Lo que Falta por Implementar

1. **Manejo de errores más robusto**: Reintentos automáticos si falla la clasificación
2. **Dashboard de monitoreo**: Página web para ver estado del procesador ML
3. **Configuración dinámica**: Cambiar intervalos de procesamiento desde la interfaz
4. **Métricas de rendimiento**: Tiempo de procesamiento, throughput, etc.
5. **Alertas por email/SMS**: Cuando se detecten anomalías graves
6. **Backup automático**: Respaldo periódico de datos clasificados

## Estructura Final del Proyecto

```
PdM-Manager/
├── app/
│   ├── main.py                   # ✅ Actualizado con background processor
│   ├── models.py                 # ✅ ClassifiedData + RawVibrationData
│   ├── database.py               # ✅ Con soporte para BD universidad
│   ├── ml_processor.py           # ✅ NUEVO - Procesador ML
│   ├── background_processor.py   # ✅ NUEVO - Servicio en background
│   ├── mqtt_client.py            # Existente (MQTT client)
│   └── ...
├── modelo/
│   ├── modeloRNN_multiclase_v3_finetuned.h5  # Modelo ML
│   └── ...
├── scaler/
│   ├── scaler_RNN.pkl            # Escalador
│   └── ...
├── PdM.sql                       # ✅ Actualizado con classified_data
├── .env.example                  # ✅ Actualizado con nuevas variables
└── requirements.txt              # ✅ Con todas las dependencias
```

## Conclusión

La integración está **COMPLETA** y lista para desplegar. El sistema ahora:

1. ✅ Consume datos del broker MQTT via mqtt_ingestor
2. ✅ Procesa automáticamente con ML en background
3. ✅ Guarda datos clasificados separados de los crudos
4. ✅ Mantiene compatibilidad con BD universidad
5. ✅ Integra completamente el flujo ESP32 → MQTT → Clasificación → Web

**Próximos pasos**: Desplegar en el servidor de la universidad y verificar el flujo completo.
