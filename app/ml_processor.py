# app/ml_processor.py
import os
import pickle
import numpy as np
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import logging
from sqlalchemy.orm import Session
from tensorflow import keras  # Para cargar modelo .h5
import joblib

from app.database import get_db, SessionLocal
from app.models import RawVibrationData, ClassifiedData, Sensor

logger = logging.getLogger("pdm_manager.ml_processor")


class MLProcessor:
    """Procesador que consume datos crudos, los clasifica con ML y los guarda procesados."""
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = os.getenv("MODEL_H5_PATH", "modelo/modeloRNN_multiclase_v3_finetuned.h5")
        self.scaler_path = os.getenv("SCALER_PKL_PATH", "scaler/scaler_RNN.pkl")
        self.processing_interval = int(os.getenv("PROCESSING_INTERVAL", "30"))
        self._load_ml_components()
    
    def _load_ml_components(self):
        """Carga el modelo y el escalador."""
        try:
            # Cargar modelo de Keras (.h5)
            if os.path.exists(self.model_path):
                self.model = keras.models.load_model(self.model_path)
                logger.info(f"✅ Modelo ML cargado desde {self.model_path}")
            else:
                logger.warning(f"⚠️ Archivo de modelo no encontrado: {self.model_path}")
            
            # Cargar escalador (.pkl)
            if os.path.exists(self.scaler_path):
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                logger.info(f"✅ Escalador cargado desde {self.scaler_path}")
            else:
                logger.warning(f"⚠️ Archivo de escalador no encontrado: {self.scaler_path}")
                
        except Exception as e:
            logger.error(f"❌ Error cargando componentes ML: {e}")
            self.model = None
            self.scaler = None
    
    def get_unprocessed_data(self, db: Session, limit: int = 100) -> List[RawVibrationData]:
        """
        Obtiene datos crudos que aún no han sido procesados.
        Se basa en buscar registros en vibration_data que no tienen equivalente en classified_data.
        """
        try:
            # Subconsulta: obtener todos los raw_data_id ya procesados
            processed_ids_subquery = db.query(ClassifiedData.raw_data_id).filter(
                ClassifiedData.raw_data_id.isnot(None)
            ).subquery()
            
            # Query principal: datos crudos que no están en la subconsulta
            unprocessed = db.query(RawVibrationData).filter(
                ~RawVibrationData.id.in_(processed_ids_subquery)
            ).order_by(RawVibrationData.ts.asc()).limit(limit).all()
            
            return unprocessed
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos no procesados: {e}")
            return []
    
    def preprocess_data(self, raw_data: List[RawVibrationData]) -> Optional[np.ndarray]:
        """
        Preprocesa los datos crudos para el modelo ML.
        Aplica el escalador y formatea para el modelo RNN.
        """
        if not raw_data or not self.scaler:
            return None
            
        try:
            # Extraer características (x, y, z) de cada registro
            features = []
            for record in raw_data:
                features.append([
                    record.acceleration_x,
                    record.acceleration_y, 
                    record.acceleration_z
                ])
            
            # Convertir a numpy array
            X = np.array(features)
            
            # Aplicar escalador
            X_scaled = self.scaler.transform(X)
            
            # Para modelo RNN: reshape a (samples, timesteps, features)
            # Si esperamos secuencias, aquí podríamos agrupar por ventanas temporales
            # Por simplicidad, procesamos cada registro individualmente
            X_reshaped = X_scaled.reshape(-1, 1, 3)  # (n_samples, 1 timestep, 3 features)
            
            return X_reshaped
            
        except Exception as e:
            logger.error(f"❌ Error en preprocesamiento: {e}")
            return None
    
    def classify_data(self, X_preprocessed: np.ndarray) -> Optional[np.ndarray]:
        """
        Clasifica los datos usando el modelo ML.
        Devuelve las predicciones.
        """
        if not self.model or X_preprocessed is None:
            return None
            
        try:
            predictions = self.model.predict(X_preprocessed, verbose=0)
            return predictions
            
        except Exception as e:
            logger.error(f"❌ Error en clasificación ML: {e}")
            return None
    
    def interpret_predictions(self, predictions: np.ndarray) -> List[Tuple[int, int]]:
        """
        Interpreta las predicciones del modelo y devuelve (severity, is_anomaly).
        
        Asumiendo que el modelo devuelve:
        - Clase 0: Normal (severity=0, is_anomaly=0)
        - Clase 1: Leve (severity=1, is_anomaly=1) 
        - Clase 2: Grave (severity=2, is_anomaly=1)
        """
        results = []
        
        try:
            # Si el modelo devuelve probabilidades, tomar el argmax
            if predictions.shape[1] > 1:
                predicted_classes = np.argmax(predictions, axis=1)
            else:
                predicted_classes = (predictions > 0.5).astype(int).flatten()
            
            for pred_class in predicted_classes:
                if pred_class == 0:
                    severity, is_anomaly = 0, 0  # Normal
                elif pred_class == 1:
                    severity, is_anomaly = 1, 1  # Leve
                elif pred_class == 2:
                    severity, is_anomaly = 2, 1  # Grave
                else:
                    severity, is_anomaly = 0, 0  # Por defecto
                    
                results.append((severity, is_anomaly))
                
        except Exception as e:
            logger.error(f"❌ Error interpretando predicciones: {e}")
            # Valores por defecto en caso de error
            results = [(0, 0)] * len(predictions)
        
        return results
    
    def save_classified_data(self, db: Session, raw_records: List[RawVibrationData], 
                           classifications: List[Tuple[int, int]]) -> int:
        """
        Guarda los datos clasificados en la tabla classified_data.
        Retorna el número de registros guardados.
        """
        saved_count = 0
        
        try:
            for raw_record, (severity, is_anomaly) in zip(raw_records, classifications):
                classified_record = ClassifiedData(
                    sensor_id=raw_record.sensor_id,
                    date=raw_record.ts,
                    acceleration_x=raw_record.acceleration_x,
                    acceleration_y=raw_record.acceleration_y,
                    acceleration_z=raw_record.acceleration_z,
                    severity=severity,
                    is_anomaly=is_anomaly,
                    raw_data_id=raw_record.id  # Enlace al registro original
                )
                
                db.add(classified_record)
                saved_count += 1
            
            db.commit()
            logger.info(f"✅ Guardados {saved_count} registros clasificados")
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error guardando datos clasificados: {e}")
            saved_count = 0
        
        return saved_count
    
    def process_batch(self) -> int:
        """
        Procesa un lote de datos crudos: los clasifica y guarda.
        Retorna el número de registros procesados.
        """
        if not self.model or not self.scaler:
            logger.warning("⚠️ Modelo o escalador no disponible, saltando procesamiento")
            return 0
        
        db = SessionLocal()
        try:
            # 1. Obtener datos no procesados
            raw_data = self.get_unprocessed_data(db)
            if not raw_data:
                logger.debug("📝 No hay datos nuevos para procesar")
                return 0
            
            logger.info(f"🔄 Procesando {len(raw_data)} registros nuevos")
            
            # 2. Preprocesar
            X_preprocessed = self.preprocess_data(raw_data)
            if X_preprocessed is None:
                logger.warning("⚠️ Error en preprocesamiento")
                return 0
            
            # 3. Clasificar con ML
            predictions = self.classify_data(X_preprocessed)
            if predictions is None:
                logger.warning("⚠️ Error en clasificación ML")
                return 0
            
            # 4. Interpretar predicciones
            classifications = self.interpret_predictions(predictions)
            
            # 5. Guardar datos clasificados
            saved_count = self.save_classified_data(db, raw_data, classifications)
            
            return saved_count
            
        except Exception as e:
            logger.error(f"❌ Error en procesamiento por lotes: {e}")
            return 0
        finally:
            db.close()


# Instancia global del procesador
ml_processor = MLProcessor()


def process_pending_data() -> int:
    """Función pública para procesar datos pendientes."""
    return ml_processor.process_batch()


if __name__ == "__main__":
    # Para pruebas
    logging.basicConfig(level=logging.INFO)
    count = process_pending_data()
    print(f"Procesados {count} registros")