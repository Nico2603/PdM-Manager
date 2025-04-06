-- ============================================
-- Final Database Definition for PdM Manager
-- ============================================

-- 1) Elimina el esquema 'public' si ya existe y todo su contenido
DROP SCHEMA IF EXISTS public CASCADE;

-- 2) Crea el esquema 'public' y asigna propietario
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO postgres;
COMMENT ON SCHEMA public IS 'standard public schema';

-- 3) Configuración inicial de sesión (opcional)
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

-- 4) Creación de tablas

-- Tabla: sensor  
-- Se mantienen sensor_id, name y description.
-- Se agrega model_id (FK → model.model_id)
CREATE TABLE public.sensor (
    sensor_id   integer       NOT NULL,
    name        varchar(100)  NOT NULL,
    description text,
    model_id    integer,      -- FK a model.model_id
    CONSTRAINT sensor_pkey PRIMARY KEY (sensor_id)
);
ALTER TABLE public.sensor OWNER TO postgres;

-- Tabla: model  
-- Se conservan: model_id, route_h5, route_pkl, name, description.
-- Se define PRIMARY KEY directamente para que la FK en sensor pueda referenciarla.
CREATE TABLE public.model (
    model_id    integer       NOT NULL,
    route_h5    varchar(255),
    route_pkl   varchar(255),
    name        varchar(100),
    description text,
    CONSTRAINT model_pkey PRIMARY KEY (model_id)
);
ALTER TABLE public.model OWNER TO postgres;

-- Tabla: machine  
-- Se elimina model_id; se conserva sensor_id, name y description  
CREATE TABLE public.machine (
    machine_id   integer       NOT NULL,
    sensor_id    integer,      -- FK a sensor.sensor_id (la máquina tiene un sensor)
    name         varchar(100)  NOT NULL,
    description  text,
    CONSTRAINT machine_pkey PRIMARY KEY (machine_id)
);
ALTER TABLE public.machine OWNER TO postgres;

-- Tabla: alert  
-- error_type se define como integer (1, 2 o 3)
-- Se elimina cualquier columna extra; la FK hacia vibration_data se llama data_id
CREATE TABLE public.alert (
    log_id      integer       NOT NULL,
    sensor_id   integer       NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    error_type  integer,      -- 1 o 2 (clasificadas por el modelo) o 3 (generada por software)
    data_id     integer,      -- FK a vibration_data.data_id
    CONSTRAINT alert_pkey PRIMARY KEY (log_id)
);
ALTER TABLE public.alert OWNER TO postgres;

-- Tabla: vibration_data  
-- Se quita la columna magnitude  
CREATE TABLE public.vibration_data (
    data_id        integer          NOT NULL,
    sensor_id      integer          NOT NULL,
    date           timestamp with time zone DEFAULT now() NOT NULL,
    acceleration_x double precision,
    acceleration_y double precision,
    acceleration_z double precision,
    severity       integer          DEFAULT 0,
    CONSTRAINT vibration_data_pkey PRIMARY KEY (data_id)
);
ALTER TABLE public.vibration_data OWNER TO postgres;

-- Tabla: limit_config  
-- Se quitan el prefijo "acc_" y se renombra updated_at a update_limits
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
    update_limits   timestamp with time zone DEFAULT now(),
    CONSTRAINT limit_config_pkey PRIMARY KEY (limit_config_id)
);
ALTER TABLE public.limit_config OWNER TO postgres;

-- Tabla: system_config (Configuración global del sistema)
CREATE TABLE IF NOT EXISTS public.system_config (
    config_id SERIAL PRIMARY KEY,
    is_configured INTEGER NOT NULL DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active_model_id INTEGER REFERENCES public.model(model_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.system_config IS 'Configuración global del sistema PdM Manager';
COMMENT ON COLUMN public.system_config.config_id IS 'ID único de configuración';
COMMENT ON COLUMN public.system_config.is_configured IS 'Indica si el sistema está configurado (0=no, 1=sí)';
COMMENT ON COLUMN public.system_config.last_update IS 'Fecha y hora de la última actualización de la configuración';
COMMENT ON COLUMN public.system_config.active_model_id IS 'ID del modelo activo actualmente en el sistema';

-- 5) Creación de secuencias (una por tabla)
CREATE SEQUENCE public.sensor_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.sensor_id_seq OWNER TO postgres;
ALTER SEQUENCE public.sensor_id_seq OWNED BY public.sensor.sensor_id;

CREATE SEQUENCE public.model_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.model_id_seq OWNER TO postgres;
ALTER SEQUENCE public.model_id_seq OWNED BY public.model.model_id;

CREATE SEQUENCE public.machine_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machine_id_seq OWNER TO postgres;
ALTER SEQUENCE public.machine_id_seq OWNED BY public.machine.machine_id;

CREATE SEQUENCE public.alert_log_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.alert_log_id_seq OWNER TO postgres;
ALTER SEQUENCE public.alert_log_id_seq OWNED BY public.alert.log_id;

CREATE SEQUENCE public.vibration_data_data_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.vibration_data_data_id_seq OWNER TO postgres;
ALTER SEQUENCE public.vibration_data_data_id_seq OWNED BY public.vibration_data.data_id;

CREATE SEQUENCE public.limit_config_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.limit_config_id_seq OWNER TO postgres;
ALTER SEQUENCE public.limit_config_id_seq OWNED BY public.limit_config.limit_config_id;

-- 6) Ajustes de columnas para usar las secuencias
ALTER TABLE ONLY public.sensor ALTER COLUMN sensor_id SET DEFAULT nextval('public.sensor_id_seq'::regclass);
ALTER TABLE ONLY public.model ALTER COLUMN model_id SET DEFAULT nextval('public.model_id_seq'::regclass);
ALTER TABLE ONLY public.machine ALTER COLUMN machine_id SET DEFAULT nextval('public.machine_id_seq'::regclass);
ALTER TABLE ONLY public.alert ALTER COLUMN log_id SET DEFAULT nextval('public.alert_log_id_seq'::regclass);
ALTER TABLE ONLY public.vibration_data ALTER COLUMN data_id SET DEFAULT nextval('public.vibration_data_data_id_seq'::regclass);
ALTER TABLE ONLY public.limit_config ALTER COLUMN limit_config_id SET DEFAULT nextval('public.limit_config_id_seq'::regclass);

-- 7) Inicializa las secuencias (setval)
SELECT pg_catalog.setval('public.sensor_id_seq', 1, false);
SELECT pg_catalog.setval('public.model_id_seq', 1, false);
SELECT pg_catalog.setval('public.machine_id_seq', 1, false);
SELECT pg_catalog.setval('public.alert_log_id_seq', 1, false);
SELECT pg_catalog.setval('public.vibration_data_data_id_seq', 1, false);
SELECT pg_catalog.setval('public.limit_config_id_seq', 1, false);

-- 8) Constraints (PRIMARY KEY, UNIQUE, FOREIGN KEY)
-- (Las claves primarias ya se incluyeron en el CREATE TABLE cuando fue posible)
-- Claves Foráneas:
ALTER TABLE ONLY public.machine ADD CONSTRAINT fk_machine_sensor FOREIGN KEY (sensor_id)
    REFERENCES public.sensor(sensor_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sensor ADD CONSTRAINT fk_sensor_model FOREIGN KEY (model_id)
    REFERENCES public.model(model_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert ADD CONSTRAINT fk_alert_sensor FOREIGN KEY (sensor_id)
    REFERENCES public.sensor(sensor_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert ADD CONSTRAINT fk_alert_vibration_data FOREIGN KEY (data_id)
    REFERENCES public.vibration_data(data_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vibration_data ADD CONSTRAINT fk_vibration_data_sensor FOREIGN KEY (sensor_id)
    REFERENCES public.sensor(sensor_id) ON DELETE CASCADE;

-- system_config.active_model_id se define en su tabla

-- 9) Función para detectar repeticiones de severidad 2 y generar alertas tipo 3
CREATE OR REPLACE FUNCTION check_severity_pattern() RETURNS TRIGGER AS $$
DECLARE
    repeated_count INTEGER;
    time_interval INTERVAL := INTERVAL '1 hour';
BEGIN
    IF NEW.severity = 2 THEN
        SELECT COUNT(*) INTO repeated_count
        FROM public.vibration_data
        WHERE sensor_id = NEW.sensor_id
          AND severity = 2
          AND date BETWEEN (NEW.date - time_interval) AND NEW.date
          AND data_id != NEW.data_id;
        
        IF repeated_count >= 1 THEN
            INSERT INTO public.alert (sensor_id, error_type, data_id)
            VALUES (NEW.sensor_id, 3, NEW.data_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Disparador: después de insertar en vibration_data, se ejecuta la función
CREATE TRIGGER trigger_check_severity_pattern
AFTER INSERT ON public.vibration_data
FOR EACH ROW
EXECUTE FUNCTION check_severity_pattern();

-- 10) Optimización de índices y trigger de severidad
CREATE INDEX IF NOT EXISTS idx_vibration_sensor_id ON public.vibration_data (sensor_id);
CREATE INDEX IF NOT EXISTS idx_vibration_date ON public.vibration_data (date);
CREATE INDEX IF NOT EXISTS idx_vibration_severity ON public.vibration_data (severity);
CREATE INDEX IF NOT EXISTS idx_vibration_sensor_date ON public.vibration_data (sensor_id, date);
CREATE INDEX IF NOT EXISTS idx_vibration_sensor_severity ON public.vibration_data (sensor_id, severity);
CREATE INDEX IF NOT EXISTS idx_alert_sensor_id ON public.alert (sensor_id);
CREATE INDEX IF NOT EXISTS idx_alert_timestamp ON public.alert ("timestamp");
CREATE INDEX IF NOT EXISTS idx_alert_error_type ON public.alert (error_type);
CREATE INDEX IF NOT EXISTS idx_alert_data_id ON public.alert (data_id);
CREATE INDEX IF NOT EXISTS idx_alert_sensor_timestamp ON public.alert (sensor_id, "timestamp");
CREATE INDEX IF NOT EXISTS idx_alert_error_timestamp ON public.alert (error_type, "timestamp");
CREATE INDEX IF NOT EXISTS idx_vibration_severity_pattern ON public.vibration_data (sensor_id, severity, date DESC);
ANALYZE public.vibration_data;
ANALYZE public.alert;

-- ============================================
-- Fin del script
-- ============================================
