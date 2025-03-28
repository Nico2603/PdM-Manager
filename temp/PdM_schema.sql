-- ============================================
-- 1) Elimina el esquema 'public' si ya existe y todo su contenido
-- ============================================
DROP SCHEMA IF EXISTS public CASCADE;

-- ============================================
-- 2) Crea el esquema 'public' y asigna propietario
-- ============================================
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO postgres;
COMMENT ON SCHEMA public IS 'standard public schema';

-- ============================================
-- Configuración inicial de sesión (opcional)
-- ============================================
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_table_access_method = heap;

-- ============================================
-- 3) Creación de tablas
-- ============================================

-- Tabla: sensor
--   Con sensor_id, name, description, model_id (FK -> model)
CREATE TABLE public.sensor (
    sensor_id   integer       NOT NULL,
    name        varchar(100)  NOT NULL,
    description text,
    model_id    integer       -- NUEVO: un sensor apunta a un modelo
);
ALTER TABLE public.sensor OWNER TO postgres;

-- Tabla: model
--   Quitar last_update, accuracy, config_params
--   Mantener: model_id, route_h5, route_pkl, name, description
CREATE TABLE public.model (
    model_id    integer       NOT NULL,
    route_h5    varchar(255),
    route_pkl   varchar(255),
    name        varchar(100),
    description text
);
ALTER TABLE public.model OWNER TO postgres;

-- Tabla: machine
--   Elimina model_id, conserva machine_id, sensor_id, name, description
CREATE TABLE public.machine (
    machine_id   integer       NOT NULL,
    sensor_id    integer,
    name         varchar(100),
    description  text
);
ALTER TABLE public.machine OWNER TO postgres;

-- Tabla: alert
--   Cambiar error_type a integer
--   data_id es la FK a vibration_data
--   Se quitan severity, message, acknowledged
CREATE TABLE public.alert (
    log_id      integer       NOT NULL,
    sensor_id   integer       NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    error_type  integer,      -- 1, 2 (clasificado por modelo) o 3 (generado por software)
    data_id     integer
);
ALTER TABLE public.alert OWNER TO postgres;

-- Tabla: vibration_data
--   Quitar magnitude
--   Mantener data_id, sensor_id, date, acceleration_x, y, z, severity
CREATE TABLE public.vibration_data (
    data_id        integer          NOT NULL,
    sensor_id      integer          NOT NULL,
    date           timestamp with time zone DEFAULT now() NOT NULL,
    acceleration_x double precision,
    acceleration_y double precision,
    acceleration_z double precision,
    severity       integer          DEFAULT 0
);
ALTER TABLE public.vibration_data OWNER TO postgres;

-- Tabla: limit_config
--   Renombrar updated_at -> update_limits
--   Quitar prefijo acc_ en x_2inf, x_2sup, etc.
CREATE TABLE public.limit_config (
    limit_config_id integer         NOT NULL,
    x_2inf          double precision NOT NULL DEFAULT -2.36,
    x_2sup          double precision NOT NULL DEFAULT 2.18,
    x_3inf          double precision NOT NULL DEFAULT -3.50,
    x_3sup          double precision NOT NULL DEFAULT 3.32,
    y_2inf          double precision NOT NULL DEFAULT 7.18,
    y_2sup          double precision NOT NULL DEFAULT 12.09,
    y_3inf          double precision NOT NULL DEFAULT 5.95,
    y_3sup          double precision NOT NULL DEFAULT 13.32,
    z_2inf          double precision NOT NULL DEFAULT -2.39,
    z_2sup          double precision NOT NULL DEFAULT 1.11,
    z_3inf          double precision NOT NULL DEFAULT -3.26,
    z_3sup          double precision NOT NULL DEFAULT 1.98,
    update_limits   timestamp with time zone DEFAULT now()
);
ALTER TABLE public.limit_config OWNER TO postgres;

-- ============================================
-- 4) Creación de secuencias (una por tabla)
-- ============================================
CREATE SEQUENCE public.sensor_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.sensor_id_seq OWNER TO postgres;
ALTER SEQUENCE public.sensor_id_seq OWNED BY public.sensor.sensor_id;

CREATE SEQUENCE public.model_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.model_id_seq OWNER TO postgres;
ALTER SEQUENCE public.model_id_seq OWNED BY public.model.model_id;

CREATE SEQUENCE public.machine_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machine_id_seq OWNER TO postgres;
ALTER SEQUENCE public.machine_id_seq OWNED BY public.machine.machine_id;

CREATE SEQUENCE public.alert_log_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.alert_log_id_seq OWNER TO postgres;
ALTER SEQUENCE public.alert_log_id_seq OWNED BY public.alert.log_id;

CREATE SEQUENCE public.vibration_data_data_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.vibration_data_data_id_seq OWNER TO postgres;
ALTER SEQUENCE public.vibration_data_data_id_seq OWNED BY public.vibration_data.data_id;

CREATE SEQUENCE public.limit_config_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.limit_config_id_seq OWNER TO postgres;
ALTER SEQUENCE public.limit_config_id_seq OWNED BY public.limit_config.limit_config_id;

-- ============================================
-- 5) Ajustes de columnas para usar las secuencias
-- ============================================
ALTER TABLE ONLY public.sensor
    ALTER COLUMN sensor_id SET DEFAULT nextval('public.sensor_id_seq'::regclass);

ALTER TABLE ONLY public.model
    ALTER COLUMN model_id SET DEFAULT nextval('public.model_id_seq'::regclass);

ALTER TABLE ONLY public.machine
    ALTER COLUMN machine_id SET DEFAULT nextval('public.machine_id_seq'::regclass);

ALTER TABLE ONLY public.alert
    ALTER COLUMN log_id SET DEFAULT nextval('public.alert_log_id_seq'::regclass);

ALTER TABLE ONLY public.vibration_data
    ALTER COLUMN data_id SET DEFAULT nextval('public.vibration_data_data_id_seq'::regclass);

ALTER TABLE ONLY public.limit_config
    ALTER COLUMN limit_config_id SET DEFAULT nextval('public.limit_config_id_seq'::regclass);

-- ============================================
-- 6) Inicializa las secuencias (setval)
-- ============================================
SELECT pg_catalog.setval('public.sensor_id_seq', 1, false);
SELECT pg_catalog.setval('public.model_id_seq', 1, false);
SELECT pg_catalog.setval('public.machine_id_seq', 1, false);
SELECT pg_catalog.setval('public.alert_log_id_seq', 1, false);
SELECT pg_catalog.setval('public.vibration_data_data_id_seq', 1, false);
SELECT pg_catalog.setval('public.limit_config_id_seq', 1, false);

-- ============================================
-- 7) Constraints (PRIMARY KEY, UNIQUE, FOREIGN KEY)
-- ============================================

-- Claves Primarias
ALTER TABLE ONLY public.sensor
    ADD CONSTRAINT sensor_pkey PRIMARY KEY (sensor_id);

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_pkey PRIMARY KEY (model_id);

ALTER TABLE ONLY public.machine
    ADD CONSTRAINT machine_pkey PRIMARY KEY (machine_id);

ALTER TABLE ONLY public.alert
    ADD CONSTRAINT alert_pkey PRIMARY KEY (log_id);

ALTER TABLE ONLY public.vibration_data
    ADD CONSTRAINT vibration_data_pkey PRIMARY KEY (data_id);

ALTER TABLE ONLY public.limit_config
    ADD CONSTRAINT limit_config_pkey PRIMARY KEY (limit_config_id);

-- Unique (opcional): si deseas que cada machine tenga un sensor único, etc.
-- (No se define un unique para model_id, pues ya no está en machine)

-- Claves Foráneas
-- machine -> sensor
ALTER TABLE ONLY public.machine
    ADD CONSTRAINT fk_machine_sensor FOREIGN KEY (sensor_id)
        REFERENCES public.sensor(sensor_id) ON DELETE CASCADE;

-- sensor -> model (NUEVO)
ALTER TABLE ONLY public.sensor
    ADD CONSTRAINT fk_sensor_model FOREIGN KEY (model_id)
        REFERENCES public.model(model_id) ON DELETE CASCADE;

-- alert -> sensor
ALTER TABLE ONLY public.alert
    ADD CONSTRAINT fk_alert_sensor FOREIGN KEY (sensor_id)
        REFERENCES public.sensor(sensor_id) ON DELETE CASCADE;

-- alert -> vibration_data (columna data_id)
ALTER TABLE ONLY public.alert
    ADD CONSTRAINT fk_alert_vibration_data FOREIGN KEY (data_id)
        REFERENCES public.vibration_data(data_id) ON DELETE CASCADE;

-- vibration_data -> sensor
ALTER TABLE ONLY public.vibration_data
    ADD CONSTRAINT fk_vibration_data_sensor FOREIGN KEY (sensor_id)
        REFERENCES public.sensor(sensor_id) ON DELETE CASCADE;

-- (limit_config es independiente, no requiere FKs)

-- ============================================
-- 8) Función para detectar repeticiones de severidad 2 y generar alertas tipo 3
-- ============================================

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

-- Disparador que ejecuta la función después de insertar un nuevo registro de vibración
CREATE TRIGGER trigger_check_severity_pattern
AFTER INSERT ON public.vibration_data
FOR EACH ROW
EXECUTE FUNCTION check_severity_pattern();

-- ============================================
-- Fin del script
-- ============================================ 