from sqlalchemy.orm import Session
from app.models import DataSensor

def save_data(db: Session, data: dict):
    db_data = DataSensor(**data)
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data

def get_all_data(db: Session):
    return db.query(DataSensor).all()
