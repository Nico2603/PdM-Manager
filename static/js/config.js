/**
 * PdM-Manager - JavaScript Configuración v1.0.0
 * Funciones para la gestión de configuración y ajustes del sistema
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// INICIALIZACIÓN DE CONFIGURACIÓN
// ==========================================================================

// Inicializar sección de configuración
function initConfig() {
    console.log('Inicializando configuración...');
    
    // Inicializar gestión de máquinas
    initMachineManagement();
    
    // Inicializar gestión de sensores
    initSensorManagement();
    
    // Inicializar gestión de modelos predictivos
    initModelManagement();
    
    // Inicializar formulario de configuración general
    initConfigForm();
    
    // Inicializar botón de ajuste de límites si existe
    if (typeof initAdjustLimitsButton === 'function') {
        initAdjustLimitsButton();
    }
    
    // Actualizar listados y datos
    refreshConfigData();
}

// Actualizar datos de configuración
function refreshConfigData() {
    // Recargar tablas de datos
    loadMachinesTable();
    
    // Recargar selectores
    if (typeof loadSensorsForSelect === 'function') {
        loadSensorsForSelect();
    }
    
    if (typeof loadModelsForSelect === 'function') {
        loadModelsForSelect();
    }
    
    // Cargar configuración actual
    if (typeof loadCurrentConfig === 'function') {
        loadCurrentConfig();
    }
}

// ==========================================================================
// GESTIÓN DE MÁQUINAS
// ==========================================================================

// Inicialización de la gestión de máquinas
function initMachineManagement() {
    // Cargar lista de máquinas
    loadMachinesTable();
    
    // Cargar selectores para el modal
    loadSensorsForSelect();
    loadModelsForSelect();
    
    // Configurar evento para añadir nueva máquina
    const addMachineBtn = document.getElementById('addMachineBtn');
    if (addMachineBtn) {
        addMachineBtn.addEventListener('click', () => {
            // Limpiar el formulario
            document.getElementById('machineForm').reset();
            document.getElementById('machineId').value = '';
            document.getElementById('machineModalTitle').textContent = 'Nueva Máquina';
            
            // Mostrar el modal
            const modal = document.getElementById('machineModal');
            modal.classList.add('show');
        });
    }
    
    // Configurar evento para guardar máquina
    const saveMachineBtn = document.getElementById('saveMachineBtn');
    if (saveMachineBtn) {
        saveMachineBtn.addEventListener('click', saveMachine);
    }
    
    // Configurar eventos para cerrar modales
    const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) modal.classList.remove('show');
        });
    });
}

// Cargar tabla de máquinas
function loadMachinesTable() {
    fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            const tableBody = document.getElementById('machinesTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (machines.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center">No hay máquinas registradas</td>
                    </tr>
                `;
                return;
            }
            
            machines.forEach(machine => {
                const row = document.createElement('tr');
                
                // Obtener nombres de sensor y modelo del resultado del backend
                const sensorName = machine.sensor_name || 'No asignado';
                const modelName = machine.model_name || 'No asignado';
                
                row.innerHTML = `
                    <td>${machine.machine_id}</td>
                    <td>${machine.name}</td>
                    <td>${machine.description || '-'}</td>
                    <td>${sensorName}</td>
                    <td>${modelName}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-id="${machine.machine_id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" data-id="${machine.machine_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Configurar eventos para editar y eliminar
            const editButtons = tableBody.querySelectorAll('.btn-edit');
            editButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const machineId = button.getAttribute('data-id');
                    editMachine(machineId);
                });
            });
            
            const deleteButtons = tableBody.querySelectorAll('.btn-delete');
            deleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const machineId = button.getAttribute('data-id');
                    deleteMachine(machineId);
                });
            });
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
            showToast('Error al cargar la lista de máquinas', 'error');
        });
}

// Cargar sensores para el selector
function loadSensorsForSelect() {
    fetch('/api/sensors')
        .then(response => response.json())
        .then(sensors => {
            const sensorSelect = document.getElementById('machineSensor');
            if (!sensorSelect) return;
            
            // Mantener la opción "Ninguno"
            sensorSelect.innerHTML = '<option value="">Ninguno</option>';
            
            sensors.forEach(sensor => {
                const option = document.createElement('option');
                option.value = sensor.sensor_id;
                option.textContent = sensor.name;
                sensorSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error al cargar sensores:', error);
        });
}

// Cargar modelos para el selector
function loadModelsForSelect() {
    fetch('/api/models')
        .then(response => response.json())
        .then(models => {
            const modelSelect = document.getElementById('machineModel');
            if (!modelSelect) return;
            
            // Mantener la opción "Ninguno"
            modelSelect.innerHTML = '<option value="">Ninguno</option>';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.model_id;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error al cargar modelos:', error);
        });
}

// Editar máquina
function editMachine(machineId) {
    fetch(`/api/machines/${machineId}`)
        .then(response => response.json())
        .then(machine => {
            // Cargar datos en el formulario
            document.getElementById('machineId').value = machine.machine_id;
            document.getElementById('machineName').value = machine.name;
            document.getElementById('machineDescription').value = machine.description || '';
            
            // Seleccionar sensor y modelo si están asignados
            const sensorSelect = document.getElementById('machineSensor');
            if (sensorSelect && machine.sensor_id) {
                sensorSelect.value = machine.sensor_id;
            }
            
            const modelSelect = document.getElementById('machineModel');
            if (modelSelect && machine.model_id) {
                modelSelect.value = machine.model_id;
            }
            
            // Actualizar título del modal
            document.getElementById('machineModalTitle').textContent = 'Editar Máquina';
            
            // Mostrar el modal
            const modal = document.getElementById('machineModal');
            modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar datos de la máquina:', error);
            showToast('Error al cargar datos de la máquina', 'error');
        });
}

// Guardar máquina (crear o actualizar)
function saveMachine() {
    // Obtener datos del formulario
    const machineId = document.getElementById('machineId').value;
    const name = document.getElementById('machineName').value;
    const description = document.getElementById('machineDescription').value;
    const sensorId = document.getElementById('machineSensor').value;
    const modelId = document.getElementById('machineModel').value;
    
    // Validar nombre
    if (!name) {
        showToast('El nombre de la máquina es obligatorio', 'warning');
        return;
    }
    
    // Preparar datos
    const machineData = {
        name: name,
        description: description,
        sensor_id: sensorId || null,
        model_id: modelId || null
    };
    
    // Determinar si es creación o actualización
    const isUpdate = !!machineId;
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `/api/machines/${machineId}` : '/api/machines';
    
    // Enviar solicitud
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(machineData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al guardar máquina');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI
            loadMachinesTable();
            
            // Cerrar modal
            const modal = document.getElementById('machineModal');
            modal.classList.remove('show');
            
            // Mostrar mensaje
            showToast(
                isUpdate ? 'Máquina actualizada correctamente' : 'Máquina creada correctamente',
                'success'
            );
        })
        .catch(error => {
            console.error('Error al guardar máquina:', error);
            showToast('Error al guardar máquina', 'error');
        });
}

// Eliminar máquina
function deleteMachine(machineId) {
    // Confirmar eliminación
    if (!confirm('¿Está seguro de que desea eliminar esta máquina? Esta acción no se puede deshacer.')) {
        return;
    }
    
    // Enviar solicitud de eliminación
    fetch(`/api/machines/${machineId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al eliminar máquina');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI
            loadMachinesTable();
            
            // Mostrar mensaje
            showToast('Máquina eliminada correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al eliminar máquina:', error);
            showToast('Error al eliminar máquina', 'error');
        });
}

// ==========================================================================
// GESTIÓN DE SENSORES
// ==========================================================================

// Inicializar gestión de sensores
function initSensorManagement() {
    // Cargar tabla de sensores
    loadSensorsTable();
    
    // Configurar evento para añadir nuevo sensor
    const addSensorBtn = document.getElementById('addSensorBtn');
    if (addSensorBtn) {
        addSensorBtn.addEventListener('click', () => {
            // Limpiar el formulario
            document.getElementById('sensorForm').reset();
            document.getElementById('sensorId').value = '';
            document.getElementById('sensorModalTitle').textContent = 'Nuevo Sensor';
            
            // Mostrar el modal
            const modal = document.getElementById('sensorModal');
            modal.classList.add('show');
        });
    }
    
    // Configurar evento para guardar sensor
    const saveSensorBtn = document.getElementById('saveSensorBtn');
    if (saveSensorBtn) {
        saveSensorBtn.addEventListener('click', saveSensor);
    }
}

// Cargar tabla de sensores
function loadSensorsTable() {
    fetch('/api/sensors')
        .then(response => response.json())
        .then(sensors => {
            const tableBody = document.getElementById('sensorsTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (sensors.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">No hay sensores registrados</td>
                    </tr>
                `;
                return;
            }
            
            sensors.forEach(sensor => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${sensor.sensor_id}</td>
                    <td>${sensor.name}</td>
                    <td>${sensor.description || '-'}</td>
                    <td>${sensor.type || '-'}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-id="${sensor.sensor_id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" data-id="${sensor.sensor_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Configurar eventos para editar y eliminar
            const editButtons = tableBody.querySelectorAll('.btn-edit');
            editButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const sensorId = button.getAttribute('data-id');
                    editSensor(sensorId);
                });
            });
            
            const deleteButtons = tableBody.querySelectorAll('.btn-delete');
            deleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const sensorId = button.getAttribute('data-id');
                    deleteSensor(sensorId);
                });
            });
        })
        .catch(error => {
            console.error('Error al cargar sensores:', error);
            showToast('Error al cargar la lista de sensores', 'error');
        });
}

// Editar sensor
function editSensor(sensorId) {
    fetch(`/api/sensors/${sensorId}`)
        .then(response => response.json())
        .then(sensor => {
            // Cargar datos en el formulario
            document.getElementById('sensorId').value = sensor.sensor_id;
            document.getElementById('sensorName').value = sensor.name;
            document.getElementById('sensorDescription').value = sensor.description || '';
            document.getElementById('sensorType').value = sensor.type || '';
            
            // Actualizar título del modal
            document.getElementById('sensorModalTitle').textContent = 'Editar Sensor';
            
            // Mostrar el modal
            const modal = document.getElementById('sensorModal');
            modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar datos del sensor:', error);
            showToast('Error al cargar datos del sensor', 'error');
        });
}

// Guardar sensor (crear o actualizar)
function saveSensor() {
    // Obtener datos del formulario
    const sensorId = document.getElementById('sensorId').value;
    const name = document.getElementById('sensorName').value;
    const description = document.getElementById('sensorDescription').value;
    const type = document.getElementById('sensorType').value;
    
    // Validar nombre
    if (!name) {
        showToast('El nombre del sensor es obligatorio', 'warning');
        return;
    }
    
    // Preparar datos
    const sensorData = {
        name: name,
        description: description,
        type: type
    };
    
    // Determinar si es creación o actualización
    const isUpdate = !!sensorId;
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `/api/sensors/${sensorId}` : '/api/sensors';
    
    // Enviar solicitud
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(sensorData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al guardar sensor');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI
            loadSensorsTable();
            
            // Cerrar modal
            const modal = document.getElementById('sensorModal');
            modal.classList.remove('show');
            
            // Mostrar mensaje
            showToast(
                isUpdate ? 'Sensor actualizado correctamente' : 'Sensor creado correctamente',
                'success'
            );
        })
        .catch(error => {
            console.error('Error al guardar sensor:', error);
            showToast('Error al guardar sensor', 'error');
        });
}

// Eliminar sensor
function deleteSensor(sensorId) {
    // Confirmar eliminación
    if (!confirm('¿Está seguro de que desea eliminar este sensor? Esta acción no se puede deshacer.')) {
        return;
    }
    
    // Enviar solicitud de eliminación
    fetch(`/api/sensors/${sensorId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al eliminar sensor');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI
            loadSensorsTable();
            
            // Mostrar mensaje
            showToast('Sensor eliminado correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al eliminar sensor:', error);
            showToast('Error al eliminar sensor', 'error');
        });
}

// ==========================================================================
// GESTIÓN DE MODELOS PREDICTIVOS
// ==========================================================================

// Inicializar gestión de modelos
function initModelManagement() {
    // Cargar tabla de modelos
    loadModelsTable();
    
    // Configurar evento para añadir nuevo modelo
    const addModelBtn = document.getElementById('addModelBtn');
    if (addModelBtn) {
        addModelBtn.addEventListener('click', () => {
            // Limpiar el formulario
            document.getElementById('modelForm').reset();
            document.getElementById('modelId').value = '';
            document.getElementById('modelModalTitle').textContent = 'Nuevo Modelo';
            
            // Mostrar el modal
            const modal = document.getElementById('modelModal');
            modal.classList.add('show');
        });
    }
    
    // Configurar evento para guardar modelo
    const saveModelBtn = document.getElementById('saveModelBtn');
    if (saveModelBtn) {
        saveModelBtn.addEventListener('click', saveModel);
    }
}

// ==========================================================================
// AJUSTES DE LÍMITES
// ==========================================================================

// Inicializar botón de ajuste de límites
function initAdjustLimitsButton() {
    const adjustBtn = document.getElementById('adjustLimitsBtn');
    if (!adjustBtn) return;
    
    adjustBtn.addEventListener('click', () => {
        openAdjustLimitsModal();
    });
}

// Abrir modal de ajuste de límites
function openAdjustLimitsModal() {
    const modal = document.getElementById('limitsModal');
    if (!modal) return;
    
    // Cargar límites actuales
    loadCurrentLimits()
        .then(() => {
            // Mostrar modal
            modal.classList.add('show');
            
            // Configurar evento para guardar límites
            const saveLimitsBtn = document.getElementById('saveLimitsBtn');
            if (saveLimitsBtn) {
                saveLimitsBtn.addEventListener('click', saveLimits);
            }
            
            // Configurar evento para restablecer límites
            const resetLimitsBtn = document.getElementById('resetLimitsBtn');
            if (resetLimitsBtn) {
                resetLimitsBtn.addEventListener('click', resetLimits);
            }
        })
        .catch(error => {
            console.error('Error al cargar límites actuales:', error);
            showToast('Error al cargar límites actuales', 'error');
        });
}

// Cargar límites actuales
function loadCurrentLimits() {
    return fetch('/api/limits')
        .then(response => response.json())
        .then(limits => {
            // Actualizar campos del formulario con los límites actuales
            for (const axis of ['x', 'y', 'z']) {
                document.getElementById(`${axis}Sigma2Lower`).value = limits[axis]?.sigma2?.lower || '';
                document.getElementById(`${axis}Sigma2Upper`).value = limits[axis]?.sigma2?.upper || '';
                document.getElementById(`${axis}Sigma3Lower`).value = limits[axis]?.sigma3?.lower || '';
                document.getElementById(`${axis}Sigma3Upper`).value = limits[axis]?.sigma3?.upper || '';
            }
            
            return limits;
        });
}

// Guardar nuevos límites
function saveLimits() {
    // Recopilar valores del formulario
    const limits = {
        x: {
            sigma2: {
                lower: parseFloat(document.getElementById('xSigma2Lower').value),
                upper: parseFloat(document.getElementById('xSigma2Upper').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('xSigma3Lower').value),
                upper: parseFloat(document.getElementById('xSigma3Upper').value)
            }
        },
        y: {
            sigma2: {
                lower: parseFloat(document.getElementById('ySigma2Lower').value),
                upper: parseFloat(document.getElementById('ySigma2Upper').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('ySigma3Lower').value),
                upper: parseFloat(document.getElementById('ySigma3Upper').value)
            }
        },
        z: {
            sigma2: {
                lower: parseFloat(document.getElementById('zSigma2Lower').value),
                upper: parseFloat(document.getElementById('zSigma2Upper').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('zSigma3Lower').value),
                upper: parseFloat(document.getElementById('zSigma3Upper').value)
            }
        }
    };
    
    // Validar que los valores sean números válidos
    for (const axis of ['x', 'y', 'z']) {
        for (const sigma of ['sigma2', 'sigma3']) {
            for (const bound of ['lower', 'upper']) {
                if (isNaN(limits[axis][sigma][bound])) {
                    showToast(`Valor inválido en límite ${bound} de ${sigma} para eje ${axis.toUpperCase()}`, 'warning');
                    return;
                }
            }
        }
    }
    
    // Enviar solicitud para guardar límites
    fetch('/api/limits', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(limits)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al guardar límites');
            }
            return response.json();
        })
        .then(result => {
            // Cerrar modal
            const modal = document.getElementById('limitsModal');
            if (modal) modal.classList.remove('show');
            
            // Actualizar gráficos con nuevos límites
            if (typeof updateChartsWithNewLimits === 'function') {
                updateChartsWithNewLimits(limits);
            }
            
            // Mostrar mensaje
            showToast('Límites actualizados correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al guardar límites:', error);
            showToast('Error al guardar límites', 'error');
        });
}

// Restablecer límites a valores por defecto
function resetLimits() {
    fetch('/api/limits/reset', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al restablecer límites');
            }
            return response.json();
        })
        .then(limits => {
            // Actualizar campos del formulario con los límites por defecto
            for (const axis of ['x', 'y', 'z']) {
                document.getElementById(`${axis}Sigma2Lower`).value = limits[axis]?.sigma2?.lower || '';
                document.getElementById(`${axis}Sigma2Upper`).value = limits[axis]?.sigma2?.upper || '';
                document.getElementById(`${axis}Sigma3Lower`).value = limits[axis]?.sigma3?.lower || '';
                document.getElementById(`${axis}Sigma3Upper`).value = limits[axis]?.sigma3?.upper || '';
            }
            
            // Actualizar gráficos con límites por defecto
            if (typeof updateChartsWithNewLimits === 'function') {
                updateChartsWithNewLimits(limits);
            }
            
            // Mostrar mensaje
            showToast('Límites restablecidos a valores por defecto', 'success');
        })
        .catch(error => {
            console.error('Error al restablecer límites:', error);
            showToast('Error al restablecer límites', 'error');
        });
}

// Inicializar formulario de configuración
function initConfigForm() {
    const configForm = document.getElementById('configForm');
    if (!configForm) return;
    
    configForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        // Obtener valores del formulario
        const updateInterval = document.getElementById('updateInterval').value;
        const autoSave = document.getElementById('autoSave').checked;
        const notificationsEnabled = document.getElementById('notificationsEnabled').checked;
        
        // Preparar datos
        const configData = {
            update_interval: parseInt(updateInterval),
            auto_save: autoSave,
            notifications_enabled: notificationsEnabled
        };
        
        // Enviar solicitud
        fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al guardar configuración');
                }
                return response.json();
            })
            .then(result => {
                showToast('Configuración guardada correctamente', 'success');
            })
            .catch(error => {
                console.error('Error al guardar configuración:', error);
                showToast('Error al guardar configuración', 'error');
            });
    });
    
    // Cargar configuración actual
    loadCurrentConfig();
}

// Cargar configuración actual
function loadCurrentConfig() {
    fetch('/api/config')
        .then(response => response.json())
        .then(config => {
            // Actualizar campos del formulario
            document.getElementById('updateInterval').value = config.update_interval || 5;
            document.getElementById('autoSave').checked = config.auto_save || false;
            document.getElementById('notificationsEnabled').checked = config.notifications_enabled || true;
        })
        .catch(error => {
            console.error('Error al cargar configuración:', error);
        });
}

// Exportar funciones para uso global
window.initConfig = initConfig;
window.initMachineManagement = initMachineManagement;
window.initSensorManagement = initSensorManagement;
window.initModelManagement = initModelManagement;
window.openAdjustLimitsModal = openAdjustLimitsModal;
window.saveLimits = saveLimits;
window.resetLimits = resetLimits; 