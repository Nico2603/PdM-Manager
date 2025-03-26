/**
 * PdM-Manager - Formularios y Configuración
 * Lógica para modales de creación y asignación de recursos
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar eventos de modales
    initializeModals();
    
    // Inicializar eventos de formularios
    initializeFormEvents();
    
    // Cargar datos iniciales
    loadInitialFormData();
});

/**
 * Inicializar modales de Bootstrap
 */
function initializeModals() {
    // Bootstrap 5 utiliza nuevas clases para modales
    const modals = [
        'addMachineModal', 
        'addSensorModal', 
        'addModelModal',
        'adjustLimitsModal'
    ];
    
    modals.forEach(modalId => {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            // Evento al mostrar el modal
            modalElement.addEventListener('show.bs.modal', function() {
                // Limpiar formulario
                const form = this.querySelector('form');
                if (form) form.reset();
                
                // Cargar datos específicos según el modal
                switch(modalId) {
                    case 'addMachineModal':
                        loadSensorsForMachine();
                        break;
                    case 'addSensorModal':
                        loadModelsForSensor();
                        break;
                    case 'addModelModal':
                        loadScalersForModel();
                        break;
                    case 'adjustLimitsModal':
                        loadCurrentLimits();
                        break;
                }
            });
        }
    });
}

/**
 * Inicializar eventos de formularios
 */
function initializeFormEvents() {
    // Botones de guardar
    setupSaveButton('saveMachineBtn', saveMachine);
    setupSaveButton('saveSensorBtn', saveSensor);
    setupSaveButton('saveModelBtn', saveModel);
    setupSaveButton('saveLimitsBtn', saveLimits);
    
    // Evento para archivos
    setupFileInput('modelFile', 'modelRoute', 'models/');
}

/**
 * Configurar botón de guardar
 */
function setupSaveButton(buttonId, saveFunction) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.addEventListener('click', saveFunction);
    }
}

/**
 * Configurar input de archivo
 */
function setupFileInput(inputId, routeInputId, defaultPath) {
    const fileInput = document.getElementById(inputId);
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            // Actualizar label con nombre de archivo
            const fileName = this.files[0] ? this.files[0].name : 'Elegir archivo...';
            const fileLabel = document.querySelector(`label[for="${inputId}"]`);
            if (fileLabel) {
                fileLabel.textContent = fileName;
            }
            
            // Auto-completar ruta si existe el campo
            const routeInput = document.getElementById(routeInputId);
            if (routeInput && this.files[0]) {
                routeInput.value = defaultPath + fileName;
            }
        });
    }
}

/**
 * Cargar datos iniciales para formularios
 */
function loadInitialFormData() {
    // Cualquier dato que deba cargarse al inicio
    // Por ejemplo, poblar selects con opciones de tipos
}

/**
 * Cargar sensores para asignar a máquina
 */
function loadSensorsForMachine() {
    const sensorSelect = document.getElementById('machineSensor');
    if (!sensorSelect) return;
    
    // Limpiar opciones actuales
    sensorSelect.innerHTML = '<option value="">Seleccionar sensor...</option>';
    
    // Simular carga (reemplazar con fetch real)
    setTimeout(() => {
        // Datos de ejemplo
        const sensors = [
            { id: 1, name: 'Sensor ACC-001', type: 'vibration' },
            { id: 2, name: 'Sensor TEMP-001', type: 'temperature' },
            { id: 3, name: 'Sensor ACC-002', type: 'vibration' }
        ];
        
        // Añadir opciones al select
        sensors.forEach(sensor => {
            const option = document.createElement('option');
            option.value = sensor.id;
            option.textContent = `${sensor.name} (${translateSensorType(sensor.type)})`;
            sensorSelect.appendChild(option);
        });
    }, 300);
}

/**
 * Cargar modelos para asignar a sensor
 */
function loadModelsForSensor() {
    const modelSelect = document.getElementById('sensorModel');
    if (!modelSelect) return;
    
    // Limpiar opciones actuales
    modelSelect.innerHTML = '<option value="">Ninguno (opcional)</option>';
    
    // Simular carga (reemplazar con fetch real)
    setTimeout(() => {
        // Datos de ejemplo
        const models = [
            { id: 1, name: 'Modelo Anomalía', type: 'anomaly_detection' },
            { id: 2, name: 'Modelo Clasificación', type: 'classification' }
        ];
        
        // Añadir opciones al select
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.name} (${translateModelType(model.type)})`;
            modelSelect.appendChild(option);
        });
    }, 300);
}

/**
 * Cargar scalers para asignar a modelo
 */
function loadScalersForModel() {
    const scalerSelect = document.getElementById('modelScaler');
    if (!scalerSelect) return;
    
    // Limpiar opciones actuales
    scalerSelect.innerHTML = '<option value="">Ninguno (opcional)</option>';
    
    // Simular carga (reemplazar con fetch real)
    setTimeout(() => {
        // Datos de ejemplo
        const scalers = [
            { id: 1, name: 'StandardScaler General', type: 'standard' },
            { id: 2, name: 'MinMax Vibración', type: 'minmax' }
        ];
        
        // Añadir opciones al select
        scalers.forEach(scaler => {
            const option = document.createElement('option');
            option.value = scaler.id;
            option.textContent = `${scaler.name} (${translateScalerType(scaler.type)})`;
            scalerSelect.appendChild(option);
        });
    }, 300);
}

/**
 * Cargar límites estadísticos actuales
 */
function loadCurrentLimits() {
    // Los valores por defecto
    const defaultLimits = {
        sigma2: {
            lower: { x: -2.364295, y: 7.177221, z: -2.389107 },
            upper: { x: 2.180056, y: 12.088666, z: 1.106510 }
        },
        sigma3: {
            lower: { x: -3.500383, y: 5.949359, z: -3.263011 },
            upper: { x: 3.316144, y: 13.316528, z: 1.980414 }
        }
    };
    
    // Actualizar campos
    document.getElementById('x2SigmaLower').value = defaultLimits.sigma2.lower.x.toFixed(6);
    document.getElementById('x2SigmaUpper').value = defaultLimits.sigma2.upper.x.toFixed(6);
    document.getElementById('x3SigmaLower').value = defaultLimits.sigma3.lower.x.toFixed(6);
    document.getElementById('x3SigmaUpper').value = defaultLimits.sigma3.upper.x.toFixed(6);
    
    document.getElementById('y2SigmaLower').value = defaultLimits.sigma2.lower.y.toFixed(6);
    document.getElementById('y2SigmaUpper').value = defaultLimits.sigma2.upper.y.toFixed(6);
    document.getElementById('y3SigmaLower').value = defaultLimits.sigma3.lower.y.toFixed(6);
    document.getElementById('y3SigmaUpper').value = defaultLimits.sigma3.upper.y.toFixed(6);
    
    document.getElementById('z2SigmaLower').value = defaultLimits.sigma2.lower.z.toFixed(6);
    document.getElementById('z2SigmaUpper').value = defaultLimits.sigma2.upper.z.toFixed(6);
    document.getElementById('z3SigmaLower').value = defaultLimits.sigma3.lower.z.toFixed(6);
    document.getElementById('z3SigmaUpper').value = defaultLimits.sigma3.upper.z.toFixed(6);
}

/**
 * Guardar nueva máquina
 */
function saveMachine() {
    // Recoger datos del formulario
    const data = {
        name: document.getElementById('machineName').value,
        type: document.getElementById('machineType').value,
        location: document.getElementById('machineLocation').value,
        description: document.getElementById('machineDescription').value,
        sensorId: document.getElementById('machineSensor').value
    };
    
    // Validación
    if (!data.name || !data.type || !data.location || !data.sensorId) {
        showAlert('Por favor complete todos los campos requeridos', 'warning');
        return;
    }
    
    // Lógica para guardar (reemplazar con fetch real)
    console.log('Guardando máquina:', data);
    
    // Simular guardado exitoso
    setTimeout(() => {
        // Cerrar modal
        const modal = document.getElementById('addMachineModal');
        if (modal) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) modalInstance.hide();
        }
        
        // Mostrar mensaje de éxito
        showAlert('Máquina guardada correctamente', 'success');
        
        // Recargar datos si es necesario
        // loadMachinesData();
    }, 500);
}

/**
 * Guardar nuevo sensor
 */
function saveSensor() {
    // Recoger datos del formulario
    const data = {
        name: document.getElementById('sensorName').value,
        type: document.getElementById('sensorType').value,
        sampleRate: document.getElementById('sensorSampleRate').value,
        location: document.getElementById('sensorLocation').value,
        description: document.getElementById('sensorDescription').value,
        modelId: document.getElementById('sensorModel').value
    };
    
    // Validación
    if (!data.name || !data.type || !data.location) {
        showAlert('Por favor complete todos los campos requeridos', 'warning');
        return;
    }
    
    // Lógica para guardar (reemplazar con fetch real)
    console.log('Guardando sensor:', data);
    
    // Simular guardado exitoso
    setTimeout(() => {
        // Cerrar modal
        const modal = document.getElementById('addSensorModal');
        if (modal) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) modalInstance.hide();
        }
        
        // Mostrar mensaje de éxito
        showAlert('Sensor guardado correctamente', 'success');
        
        // Recargar datos si es necesario
        // loadSensorsData();
    }, 500);
}

/**
 * Guardar nuevo modelo
 */
function saveModel() {
    // Recoger datos del formulario
    const fileInput = document.getElementById('modelFile');
    const data = {
        name: document.getElementById('modelName').value,
        type: document.getElementById('modelType').value,
        route: document.getElementById('modelRoute').value,
        description: document.getElementById('modelDescription').value,
        scalerId: document.getElementById('modelScaler').value,
        file: fileInput.files[0] ? fileInput.files[0].name : null
    };
    
    // Validación
    if (!data.name || !data.type || !fileInput.files[0] || !data.route) {
        showAlert('Por favor complete todos los campos requeridos', 'warning');
        return;
    }
    
    // Comprobar formato
    if (fileInput.files[0] && !fileInput.files[0].name.endsWith('.h5')) {
        showAlert('El archivo debe tener formato .h5', 'warning');
        return;
    }
    
    // Lógica para guardar (reemplazar con fetch real)
    console.log('Guardando modelo:', data);
    
    // Simular guardado exitoso
    setTimeout(() => {
        // Cerrar modal
        const modal = document.getElementById('addModelModal');
        if (modal) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) modalInstance.hide();
        }
        
        // Mostrar mensaje de éxito
        showAlert('Modelo guardado correctamente', 'success');
        
        // Recargar datos si es necesario
        // loadModelsData();
    }, 500);
}

/**
 * Guardar límites estadísticos
 */
function saveLimits() {
    // Recoger datos
    const limits = {
        sigma2: {
            lower: {
                x: parseFloat(document.getElementById('x2SigmaLower').value),
                y: parseFloat(document.getElementById('y2SigmaLower').value),
                z: parseFloat(document.getElementById('z2SigmaLower').value)
            },
            upper: {
                x: parseFloat(document.getElementById('x2SigmaUpper').value),
                y: parseFloat(document.getElementById('y2SigmaUpper').value),
                z: parseFloat(document.getElementById('z2SigmaUpper').value)
            }
        },
        sigma3: {
            lower: {
                x: parseFloat(document.getElementById('x3SigmaLower').value),
                y: parseFloat(document.getElementById('y3SigmaLower').value),
                z: parseFloat(document.getElementById('z3SigmaLower').value)
            },
            upper: {
                x: parseFloat(document.getElementById('x3SigmaUpper').value),
                y: parseFloat(document.getElementById('y3SigmaUpper').value),
                z: parseFloat(document.getElementById('z3SigmaUpper').value)
            }
        }
    };
    
    // Validar que todos sean números
    for (const sigmaLevel in limits) {
        for (const boundType in limits[sigmaLevel]) {
            for (const axis in limits[sigmaLevel][boundType]) {
                if (isNaN(limits[sigmaLevel][boundType][axis])) {
                    showAlert('Todos los valores deben ser números', 'warning');
                    return;
                }
            }
        }
    }
    
    // Lógica para guardar (reemplazar con fetch real)
    console.log('Guardando límites:', limits);
    
    // Simular guardado exitoso
    setTimeout(() => {
        // Cerrar modal
        const modal = document.getElementById('adjustLimitsModal');
        if (modal) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) modalInstance.hide();
        }
        
        // Mostrar mensaje de éxito
        showAlert('Límites estadísticos guardados correctamente', 'success');
        
        // Actualizar valores mostrados
        updateDisplayedLimits(limits);
    }, 500);
}

/**
 * Actualizar valores mostrados en la interfaz
 */
function updateDisplayedLimits(limits) {
    // Actualizar displays
    document.getElementById('x2SigmaLowerDisplay').textContent = limits.sigma2.lower.x.toFixed(6);
    document.getElementById('x2SigmaUpperDisplay').textContent = limits.sigma2.upper.x.toFixed(6);
    document.getElementById('x3SigmaLowerDisplay').textContent = limits.sigma3.lower.x.toFixed(6);
    document.getElementById('x3SigmaUpperDisplay').textContent = limits.sigma3.upper.x.toFixed(6);
    
    document.getElementById('y2SigmaLowerDisplay').textContent = limits.sigma2.lower.y.toFixed(6);
    document.getElementById('y2SigmaUpperDisplay').textContent = limits.sigma2.upper.y.toFixed(6);
    document.getElementById('y3SigmaLowerDisplay').textContent = limits.sigma3.lower.y.toFixed(6);
    document.getElementById('y3SigmaUpperDisplay').textContent = limits.sigma3.upper.y.toFixed(6);
    
    document.getElementById('z2SigmaLowerDisplay').textContent = limits.sigma2.lower.z.toFixed(6);
    document.getElementById('z2SigmaUpperDisplay').textContent = limits.sigma2.upper.z.toFixed(6);
    document.getElementById('z3SigmaLowerDisplay').textContent = limits.sigma3.lower.z.toFixed(6);
    document.getElementById('z3SigmaUpperDisplay').textContent = limits.sigma3.upper.z.toFixed(6);
}

/**
 * Traducir tipo de sensor a español
 */
function translateSensorType(type) {
    const types = {
        'vibration': 'Vibración',
        'temperature': 'Temperatura',
        'pressure': 'Presión',
        'flow': 'Flujo',
        'other': 'Otro'
    };
    return types[type] || 'Desconocido';
}

/**
 * Traducir tipo de modelo a español
 */
function translateModelType(type) {
    const types = {
        'anomaly_detection': 'Detección de Anomalías',
        'classification': 'Clasificación',
        'regression': 'Regresión',
        'other': 'Otro'
    };
    return types[type] || 'Desconocido';
}

/**
 * Traducir tipo de scaler a español
 */
function translateScalerType(type) {
    const types = {
        'standard': 'StandardScaler',
        'minmax': 'MinMaxScaler',
        'robust': 'RobustScaler',
        'other': 'Otro'
    };
    return types[type] || 'Desconocido';
}

/**
 * Mostrar alerta en la interfaz
 */
function showAlert(message, type = 'info') {
    // Verificar si existe la función de Toast de Bootstrap
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        // Crear elemento toast si no existe
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Crear toast
        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center border-0 bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body text-${type === 'warning' || type === 'danger' ? 'dark' : 'light'}">
                        ${message}
                    </div>
                    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        toastContainer.innerHTML += toastHTML;
        
        // Mostrar toast
        const toast = new bootstrap.Toast(document.getElementById(toastId), {
            autohide: true,
            delay: 3000
        });
        toast.show();
    } else {
        // Fallback a alert
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Si no existe Bootstrap, usar alert básico
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Añadir al principio del contenido principal
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.prepend(alertDiv);
            
            // Auto-eliminar después de 3 segundos
            setTimeout(() => {
                alertDiv.classList.remove('show');
                setTimeout(() => alertDiv.remove(), 300);
            }, 3000);
        } else {
            // Fallback a alert básico
            alert(message);
        }
    }
} 