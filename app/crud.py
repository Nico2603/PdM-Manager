# app/crud.py

from sqlalchemy.orm import Session
from app.models import DataSensor

def get_data_by_sensor_and_dates(db: Session, sensor_id: int, start_date, end_date):
    """
    Devuelve registros de la tabla data_sensor filtrados por sensor y rango de fechas.
    """
    query = db.query(DataSensor).filter(DataSensor.id_sensor == sensor_id)
    query = query.filter(DataSensor.fecha >= start_date, DataSensor.fecha <= end_date)
    return query.order_by(DataSensor.fecha).all()
