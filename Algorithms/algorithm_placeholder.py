# Algorithms/algorithm_placeholder.py
import matplotlib.pyplot as plt
import base64
import io
import pandas as pd
from sklearn.cluster import KMeans


def run_algorithms(df: pd.DataFrame):
    print("Ejecutando algoritmos predefinidos...")
    images = []

    if df.empty:
        print("No hay datos para procesar.")
        return {"images": images}

    # Ejemplo: Aplicar KMeans en las columnas eje_x y eje_y
    features = df[["eje_x", "eje_y"]].dropna()
    kmeans = KMeans(n_clusters=3, random_state=42)
    clusters = kmeans.fit_predict(features)
    features["cluster"] = clusters

    # Generar gráfica de dispersión
    fig, ax = plt.subplots()
    scatter = ax.scatter(features["eje_x"], features["eje_y"], c=features["cluster"], cmap="viridis")
    ax.set_title("KMeans clustering (eje_x vs eje_y)")
    plt.colorbar(scatter, ax=ax)

    buf = io.BytesIO()
    plt.savefig(buf, format="png")
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    images.append(image_base64)
    plt.close(fig)

    print("Algoritmo KMeans completado.")

    # Aquí podrás agregar la ejecución de otros algoritmos en orden específico.

    return {"images": images}
