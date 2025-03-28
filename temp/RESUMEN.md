# Resumen de Cambios en la Lógica de Alertas y Severidades

## Cambios en el Esquema SQL

Se ha creado un nuevo esquema SQL en `temp/PdM_schema.sql` con las siguientes modificaciones:

1. En la tabla `alert`:
   - Se eliminó la columna `severity` ya que ahora toda la información de severidad está en `error_type`
   - Se mantiene el campo `error_type` como `integer` con los siguientes valores:
     - `1`: Alerta Nivel 1 (clasificada por el modelo)
     - `2`: Alerta Nivel 2 (clasificada por el modelo)
     - `3`: Alerta Nivel 3 (generada por software)

2. Se ha creado un trigger SQL que detecta cuando hay repeticiones de registros con `severity = 2` en la tabla `vibration_data`:
   ```sql
   CREATE OR REPLACE FUNCTION check_severity_pattern() RETURNS TRIGGER AS $$
   DECLARE
       repeated_count INTEGER;
       time_interval INTERVAL := INTERVAL '1 hour'; -- Intervalo configurable
   BEGIN
       -- Verificar si hay repetición de severidad 2 en el intervalo de tiempo definido
       IF NEW.severity = 2 THEN
           SELECT COUNT(*) INTO repeated_count
           FROM public.vibration_data
           WHERE sensor_id = NEW.sensor_id
             AND severity = 2
             AND date >= (NEW.date - time_interval)
             AND date <= NEW.date
             AND data_id != NEW.data_id;
           
           -- Si hay al menos una repetición (contando el registro actual serían 2)
           IF repeated_count >= 1 THEN
               -- Crear alerta de tipo 3 (generada por software)
               INSERT INTO public.alert (sensor_id, error_type, data_id)
               VALUES (NEW.sensor_id, 3, NEW.data_id);
           END IF;
       END IF;
       
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. Se configuró un trigger en la tabla `vibration_data` para ejecutar esta función automáticamente:
   ```sql
   CREATE TRIGGER trigger_check_severity_pattern
   AFTER INSERT ON public.vibration_data
   FOR EACH ROW
   EXECUTE FUNCTION check_severity_pattern();
   ```

## Cambios en el Código Python

1. Se ha actualizado la clase `Alert` en `app/models.py` para reflejar los cambios del esquema:
   - Se mantiene solo `error_type` como `Integer`
   - Se agregó un comentario explicativo sobre los valores de `error_type`

2. Se modificó la función `receive_sensor_data` en `app/main.py`:
   - Se eliminó la verificación de condición nivel 3 basada en histórico
   - Ahora las alertas creadas por el sistema solo tienen `error_type = 1` o `error_type = 2`
   - Las alertas con `error_type = 3` son generadas exclusivamente por el trigger SQL

3. Se eliminó la función `check_level3_condition` que ya no es necesaria

4. Se actualizó la función `process_batch_data` para seguir la misma lógica

## Cambios en el Frontend (JavaScript)

1. Se actualizó la función `updateAlertsTable` en `static/js/dashboard.js`:
   - Ahora procesa `error_type` como valor numérico (1, 2 o 3)
   - Asigna las clases de estilo CSS correctas según el error_type
   - Muestra el texto descriptivo adecuado para cada nivel de alerta

## Lógica Actualizada

1. **Clasificación del Modelo**:
   - El modelo de IA asigna `severity = 1` o `severity = 2` a los registros de `vibration_data`
   - Cuando se guarda un registro con `severity >= 1`, se crea automáticamente una alerta con `error_type = severity`

2. **Detección de Nivel 3 (Crítico)**:
   - El trigger SQL monitorea inserciones en `vibration_data`
   - Cuando detecta que hay repeticiones de `severity = 2` en un intervalo de tiempo, crea automáticamente una alerta con `error_type = 3`

3. **Dashboard**:
   - El dashboard muestra alertas con `error_type = 1` o `2` (clasificadas por el modelo)
   - También muestra alertas con `error_type = 3` (generadas por el software)
   - La UI solo muestra `log_id`, `sensor_id`, `timestamp` y `error_type` (mostrado como texto descriptivo) 