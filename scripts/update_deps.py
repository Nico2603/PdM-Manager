#!/usr/bin/env python
# scripts/update_deps.py
"""
Script para actualizar automáticamente las dependencias de Python del proyecto.
Examina las importaciones y actualiza requirements.txt.
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from typing import Set, List, Dict

# Patrón para encontrar importaciones
IMPORT_PATTERN = re.compile(r'^(?:from|import)\s+([a-zA-Z0-9_\.]+)')
# Patrón para excluir módulos de Python estándar o internos
BUILT_IN_MODULES = {
    'os', 'sys', 're', 'datetime', 'json', 'time', 'logging', 'functools',
    'pathlib', 'math', 'random', 'collections', 'typing', 'uuid', 'base64',
    'io', 'tempfile', 'shutil', 'hashlib', 'warnings', 'urllib', 'itertools',
    'contextlib', 'inspect', 'traceback', 'glob', 'string', 'pickle', 'enum'
}
# Directorio para excluir
EXCLUDE_DIRS = {'venv', 'env', '.venv', '.env', 'node_modules', '.git', '__pycache__'}

def get_python_files(root_dir: str) -> List[str]:
    """Obtiene la lista de archivos Python en el directorio y subdirectorios."""
    python_files = []
    for root, dirs, files in os.walk(root_dir):
        # Excluir directorios que no necesitamos escanear
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    return python_files

def extract_imports(file_path: str) -> Set[str]:
    """Extrae las importaciones de un archivo Python."""
    imports = set()
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Ignorar comentarios y cadenas multilinea
            if line.startswith('#') or line.startswith('"""') or line.startswith("'''"):
                continue
                
            match = IMPORT_PATTERN.match(line)
            if match:
                # Obtener el módulo principal (primer componente)
                full_import = match.group(1)
                main_module = full_import.split('.')[0]
                
                # Excluir módulos internos y relativos
                if main_module not in BUILT_IN_MODULES and not main_module.startswith('.'):
                    imports.add(main_module)
    
    return imports

def get_installed_packages() -> Dict[str, str]:
    """Obtiene los paquetes instalados con sus versiones."""
    result = subprocess.run(
        [sys.executable, '-m', 'pip', 'freeze'],
        capture_output=True,
        text=True,
        check=True
    )
    
    packages = {}
    for line in result.stdout.splitlines():
        if '==' in line:
            name, version = line.split('==', 1)
            packages[name.lower()] = version
    
    return packages

def update_requirements(imports: Set[str], output_file: str = 'requirements.txt'):
    """Actualiza el archivo requirements.txt con las dependencias encontradas."""
    try:
        installed_packages = get_installed_packages()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# Automatically generated requirements.txt\n")
            f.write("# Generated on: {}\n\n".format(
                subprocess.check_output(['date']).decode('utf-8').strip()
            ))
            
            # Ordenar las importaciones para una salida consistente
            for module in sorted(imports):
                module_lower = module.lower()
                
                # Manejar casos especiales y alias comunes
                if module_lower in installed_packages:
                    f.write(f"{module}=={installed_packages[module_lower]}\n")
                else:
                    # Para importaciones que no coinciden exactamente con el nombre del paquete
                    mapping = {
                        'bs4': 'beautifulsoup4',
                        'PIL': 'pillow',
                        'sklearn': 'scikit-learn',
                        'cv2': 'opencv-python',
                        'yaml': 'pyyaml',
                        'dotenv': 'python-dotenv',
                        'jwt': 'pyjwt',
                    }
                    
                    if module in mapping and mapping[module].lower() in installed_packages:
                        f.write(f"{mapping[module]}=={installed_packages[mapping[module].lower()]}\n")
                    else:
                        # Si no podemos determinar la versión, simplemente incluimos el módulo
                        f.write(f"{module}\n")
        
        print(f"✅ Archivo {output_file} actualizado con {len(imports)} dependencias.")
    
    except Exception as e:
        print(f"❌ Error al actualizar {output_file}: {str(e)}")

def main():
    """Función principal."""
    # Obtener el directorio base del proyecto
    project_dir = Path(__file__).parent.parent
    
    # Obtener todos los archivos Python del proyecto
    python_files = get_python_files(project_dir)
    print(f"🔎 Encontrados {len(python_files)} archivos Python para analizar")
    
    # Extraer todas las importaciones
    all_imports = set()
    for file in python_files:
        imports = extract_imports(file)
        all_imports.update(imports)
    
    # Filtrar sólo dependencias de terceros (no módulos internos)
    third_party_imports = {imp for imp in all_imports if imp not in BUILT_IN_MODULES}
    
    # Excluir nuestros propios módulos (los que existen como directorios en el proyecto)
    project_modules = {d.name for d in project_dir.iterdir() 
                      if d.is_dir() and d.name not in EXCLUDE_DIRS}
    dependencies = {imp for imp in third_party_imports if imp not in project_modules}
    
    # Algunos módulos típicos que pueden faltar
    common_deps = {'fastapi', 'sqlalchemy', 'alembic', 'pydantic', 'uvicorn', 'python-dotenv', 'httpx'}
    for dep in common_deps:
        if dep.replace('-', '_') in dependencies and dep not in dependencies:
            dependencies.add(dep)
    
    # Actualizar requirements.txt
    update_requirements(dependencies, os.path.join(project_dir, 'requirements.txt'))

if __name__ == "__main__":
    main() 