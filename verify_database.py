#!/usr/bin/env python3
"""
Script para verificar los datos insertados en la base de datos PdM.
"""

import psycopg2
from psycopg2.extras import DictCursor
import os

def main():
    try:
        # Conectar a PostgreSQL
        conn = psycopg2.connect(
            host='localhost', 
            port=5432, 
            database='PdM', 
            user='postgres', 
            password='pdm123'
        )
        
        print("✅ Conectado a PostgreSQL: localhost:5432/PdM")
        print()
        
        # Consultar datos de vibración
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute('''
                SELECT data_id, sensor_id, date, acceleration_x, acceleration_y, acceleration_z, 
                       severity, is_anomaly 
                FROM public.vibration_data 
                WHERE sensor_id = 1 
                ORDER BY date DESC 
                LIMIT 10
            ''')
            
            vibration_data = cur.fetchall()
            
            print('📊 DATOS DE VIBRACIÓN INSERTADOS:')
            print('=' * 80)
            for row in vibration_data:
                severity_text = ['Normal', 'Leve', 'Grave', 'Crítico'][min(row['severity'], 3)]
                anomaly_text = 'Sí' if row['is_anomaly'] else 'No'
                print(f'ID: {row["data_id"]:2d} | Sensor: {row["sensor_id"]} | Fecha: {row["date"]}')
                print(f'       Aceleración: X={row["acceleration_x"]:6.3f}, Y={row["acceleration_y"]:6.3f}, Z={row["acceleration_z"]:6.3f}')
                print(f'       Severidad: {row["severity"]} ({severity_text}) | Anomalía: {anomaly_text}')
                print()

            # Consultar alertas
            cur.execute('SELECT COUNT(*) FROM public.alert WHERE sensor_id = 1')
            alert_count = cur.fetchone()[0]

            print(f'🚨 ALERTAS GENERADAS: {alert_count}')
            print()

            # Estadísticas del sensor
            cur.execute('''
                SELECT 
                    COUNT(*) as total_registros,
                    AVG(acceleration_x) as avg_x,
                    AVG(acceleration_y) as avg_y, 
                    AVG(acceleration_z) as avg_z,
                    MAX(severity) as max_severity,
                    SUM(is_anomaly) as total_anomalias
                FROM public.vibration_data 
                WHERE sensor_id = 1
            ''')
            
            stats = cur.fetchone()
            print('📈 ESTADÍSTICAS DEL SENSOR:')
            print(f'   Total registros: {stats["total_registros"]}')
            print(f'   Aceleración promedio: X={stats["avg_x"]:6.3f}, Y={stats["avg_y"]:6.3f}, Z={stats["avg_z"]:6.3f}')
            print(f'   Severidad máxima: {stats["max_severity"]}')
            print(f'   Total anomalías: {stats["total_anomalias"]}')
        
        conn.close()
        print()
        print("👋 Consulta completada exitosamente")
        
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == "__main__":
    main()
