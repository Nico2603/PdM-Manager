# app/config.py

from pydantic import ConfigDict
import sys

# Configuración para suprimir advertencias de espacios de nombres protegidos
pydantic_config = ConfigDict(protected_namespaces=())

# Configurar a nivel global
import pydantic
if hasattr(pydantic, "BaseModel"):
    # Pydantic v1
    pydantic.BaseModel.Config = type('Config', (), {'protected_namespaces': ()})
else:
    # Pydantic v2
    import pydantic.config
    pydantic.config.ConfigDefaults.protected_namespaces = ()

# Suprimir advertencias específicas de Pydantic
import warnings
warnings.filterwarnings("ignore", message="Field \"model_.*\" has conflict with protected namespace")

print("Configuración de Pydantic cargada. Versión:", pydantic.__version__) 