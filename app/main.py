# app/main.py

import os
from datetime import datetime
import numpy as np

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session

# Importar la configuración de la BD y el modelo de datos
from app.database import engine, Base, get_db
from app.models import DataSensor
from app.crud import get_data_by_sensor_and_dates

# Cargar modelo entrenado (Keras/TensorFlow) desde la carpeta "Modelo"
from tensorflow.keras.models import load_model

# Ruta al modelo .h5
model_path = os.path.join("Modelo", "modeloRNN_multiclase_optimizado.h5")
model = load_model(model_path)

# Diccionario de clases (ajusta si tu modelo maneja más o menos clases)
class_dict = {
    0: "normal",
    1: "leve",
    2: "crítico"
}

# Crear la aplicación FastAPI
app = FastAPI()

# Crear las tablas en la BD (solo si no existen)
Base.metadata.create_all(bind=engine)

# Montar la carpeta estática (HTML, CSS, JS)
# Ajusta la ruta si tu carpeta "static" está en otro lugar
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
def root():
    """
    Devuelve la página principal (index.html).
    Manejarás toda la interfaz (SPA) desde aquí.
    """
    return FileResponse("static/index.html")


@app.get("/check_db")
def check_db(db: Session = Depends(get_db)):
    """
    Comprueba la conexión a la base de datos.
    """
    try:
        db.execute("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/get_vibration_data")
def get_vibration_data(
    sensor_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    Devuelve datos de vibración (eje_x, eje_y, eje_z) para un sensor 
    y rango de fechas en formato JSON. Ideal para graficar con Chart.js.
    """
    # Convertir fechas a datetime
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )

    # Obtener registros de la BD
    data_list = get_data_by_sensor_and_dates(db, sensor_id, start_dt, end_dt)

    # Extraer datos en listas para JSON
    eje_x = []
    eje_y = []
    eje_z = []
    fechas = []

    for d in data_list:
        eje_x.append(float(d.eje_x) if d.eje_x is not None else None)
        eje_y.append(float(d.eje_y) if d.eje_y is not None else None)
        eje_z.append(float(d.eje_z) if d.eje_z is not None else None)
        fechas.append(d.fecha.isoformat())  # o str(d.fecha)

    return {
        "sensor_id": sensor_id,
        "fechas": fechas,
        "eje_x": eje_x,
        "eje_y": eje_y,
        "eje_z": eje_z
    }


@app.get("/predict_condition")
def predict_condition(
    sensor_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    1) Consulta datos de vibración en la BD (sensor + rango de fechas).
    2) Ajusta la forma del array según requiera tu RNN.
    3) Devuelve la predicción (normal, leve, crítico).
    """
    # Convertir fechas
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )

    # Obtener datos
    data_list = get_data_by_sensor_and_dates(db, sensor_id, start_dt, end_dt)
    if not data_list:
        raise HTTPException(
            status_code=404,
            detail="No hay datos para ese sensor y rango de fechas."
        )

    # Construir array numpy con ejes X, Y, Z
    arr = []
    for d in data_list:
        arr.append([
            float(d.eje_x or 0),
            float(d.eje_y or 0),
            float(d.eje_z or 0)
        ])

    arr = np.array(arr, dtype=np.float32)
    # Suponiendo que tu RNN espera (1, timesteps, 3)
    arr = arr.reshape((1, arr.shape[0], 3))

    # Hacer la predicción
    pred = model.predict(arr)
    predicted_class = int(np.argmax(pred, axis=1)[0])
    predicted_label = class_dict.get(predicted_class, "desconocido")

    return {
        "sensor_id": sensor_id,
        "start_date": start_date,
        "end_date": end_date,
        "predicted_class": predicted_label,
        "prediction_raw": pred.tolist()
    }