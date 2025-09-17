# app/background_processor.py
import asyncio
import logging
import os
from datetime import datetime
from typing import Optional

from app.ml_processor import process_pending_data

logger = logging.getLogger("pdm_manager.background_processor")


class BackgroundMLProcessor:
    """Servicio en background que procesa datos ML periódicamente."""
    
    def __init__(self, interval_seconds: int = 30):
        self.interval = interval_seconds
        self.running = False
        self.task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Inicia el procesamiento en background."""
        if self.running:
            logger.warning("⚠️ El procesador ya está ejecutándose")
            return
            
        self.running = True
        self.task = asyncio.create_task(self._process_loop())
        logger.info(f"🚀 Procesador ML iniciado (intervalo: {self.interval}s)")
        
    async def stop(self):
        """Detiene el procesamiento en background."""
        if not self.running:
            return
            
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 Procesador ML detenido")
        
    async def _process_loop(self):
        """Loop principal de procesamiento."""
        logger.info("🔄 Loop de procesamiento ML iniciado")
        
        while self.running:
            try:
                start_time = datetime.now()
                
                # Procesar datos pendientes
                processed_count = process_pending_data()
                
                processing_time = (datetime.now() - start_time).total_seconds()
                
                if processed_count > 0:
                    logger.info(f"✅ Procesados {processed_count} registros en {processing_time:.2f}s")
                else:
                    logger.debug(f"📝 Sin datos para procesar ({processing_time:.2f}s)")
                    
            except Exception as e:
                logger.error(f"❌ Error en loop de procesamiento: {e}")
                
            # Esperar antes del siguiente ciclo
            try:
                await asyncio.sleep(self.interval)
            except asyncio.CancelledError:
                break
                
        logger.info("🏁 Loop de procesamiento ML finalizado")


# Instancia global del procesador en background
background_processor = BackgroundMLProcessor(
    interval_seconds=int(os.getenv("PROCESSING_INTERVAL", "30"))
)