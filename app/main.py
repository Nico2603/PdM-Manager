from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import pandas as pd
from app.database import engine, Base, get_db
from app.crud import get_all_data

# Crear las tablas (si aún no existen)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Montar archivos estáticos (HTML, CSS, JS) 
# Cambia la ruta "static" si tu carpeta está realmente en la raíz del proyecto
app.mount("/static", StaticFiles(directory="static"), name="static")

# Variable global para almacenar los resultados del procesamiento (para fines de ejemplo)
processing_results = {"images": []}


@app.get("/")
def root():
    # Servir la página index.html desde la carpeta 'static' en la raíz
    return FileResponse("static/index.html")


@app.get("/check_db")
def check_db(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.post("/start_processing")
def start_processing(db: Session = Depends(get_db)):
    print("Iniciando procesamiento de datos...")
    data_list = get_all_data(db)
    print(f"Datos obtenidos: {len(data_list)} registros.")

    # Convertir los datos de la base de datos a DataFrame
    df = pd.DataFrame([{
        "id_sensor": d.id_sensor,
        "id_locacion": d.id_locacion,
        "fecha": d.fecha,
        "eje_x": float(d.eje_x) if d.eje_x is not None else None,
        "eje_y": float(d.eje_y) if d.eje_y is not None else None,
        "eje_z": float(d.eje_z) if d.eje_z is not None else None,
    } for d in data_list])

    # Importar y ejecutar la función del algoritmo predefinido
    from Algorithms.algorithm_placeholder import run_algorithms
    result = run_algorithms(df)

    # Guardar resultados globalmente
    processing_results["images"] = result.get("images", [])
    print("Procesamiento completado.")

    return {"message": "Procesamiento completado"}


@app.get("/get_results")
def get_results():
    return processing_results


@app.get("/results")
def results_page():
    # Servir la página results.html desde la carpeta 'static'
    return FileResponse("static/results.html")