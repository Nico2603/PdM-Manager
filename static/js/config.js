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
    
    // Inicializar gestión de modelos
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
                        <td colspan="7" class="text-center">No hay máquinas registradas</td>
                    </tr>
                `;
                return;
            }
            
            machines.forEach(machine => {
                const row = document.createElement('tr');
                
                // Preparar estado según valor
                let statusClass = '';
                let statusText = 'Desconocido';
                
                switch (machine.status) {
                    case 'operativo':
                        statusClass = 'status-operativo';
                        statusText = 'Operativo';
                        break;
                    case 'mantenimiento':
                        statusClass = 'status-mantenimiento';
                        statusText = 'En Mantenimiento';
                        break;
                    case 'apagado':
                        statusClass = 'status-apagado';
                        statusText = 'Apagado';
                        break;
                    case 'error':
                    case 'critical':
                        statusClass = 'status-critical';
                        statusText = machine.status === 'error' ? 'Error' : 'Crítico';
                        break;
                }
                
                row.innerHTML = `
                    <td class="column-id">${machine.machine_id}</td>
                    <td><strong>${machine.name}</strong></td>
                    <td>${machine.description || '-'}</td>
                    <td>${machine.location || '-'}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${machine.route || '-'}</td>
                    <td class="column-actions">
                        <div class="table-actions">
                            <button class="btn-icon btn-edit" title="Editar máquina" data-id="${machine.machine_id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" title="Eliminar máquina" data-id="${machine.machine_id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
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

// Editar máquina
function editMachine(machineId) {
    fetch(`/api/machines/${machineId}`)
        .then(response => response.json())
        .then(machine => {
            // Cargar datos en el formulario
            document.getElementById('machineId').value = machine.machine_id;
            document.getElementById('machineName').value = machine.name;
            document.getElementById('machineDescription').value = machine.description || '';
            document.getElementById('machineLocation').value = machine.location || '';
            document.getElementById('machineRoute').value = machine.route || '';
            
            // Seleccionar estado si está definido
            const statusSelect = document.getElementById('machineStatus');
            if (statusSelect) {
                statusSelect.value = machine.status || 'operativo';
            }
            
            // Seleccionar sensor si está asignado
            const sensorSelect = document.getElementById('machineSensor');
            if (sensorSelect && machine.sensor_id) {
                sensorSelect.value = machine.sensor_id;
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

// Guardar máquina (crear nueva o actualizar existente)
function saveMachine() {
    // Obtener valores del formulario
    const machineId = document.getElementById('machineId').value;
    const machineName = document.getElementById('machineName').value;
    const machineDescription = document.getElementById('machineDescription').value;
    const machineLocation = document.getElementById('machineLocation').value;
    const machineStatus = document.getElementById('machineStatus').value;
    const machineRoute = document.getElementById('machineRoute').value;
    const sensorId = document.getElementById('machineSensor').value;
    
    // Verificar campo obligatorio
    if (!machineName) {
        showToast('El nombre de la máquina es obligatorio', 'warning');
        return;
    }
    
    // Preparar datos para envío
    const machineData = {
        name: machineName,
        description: machineDescription || '',
        location: machineLocation || '',
        status: machineStatus || 'operativo',
        route: machineRoute || '',
        sensor_id: sensorId ? parseInt(sensorId) : null
    };
    
    // Determinar si es creación o actualización
    const isUpdate = machineId && machineId !== '';
    const url = isUpdate ? `/api/machines/${machineId}` : '/api/machines';
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Mostrar indicador de carga
    showLoadingIndicator(isUpdate ? 'Actualizando máquina...' : 'Creando máquina...');
    
    // Enviar solicitud al servidor
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(machineData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al ${isUpdate ? 'actualizar' : 'crear'} máquina`);
            }
            return response.json();
        })
        .then(data => {
            // Cerrar modal
            const modal = document.getElementById('machineModal');
            if (modal) modal.classList.remove('show');
            
            // Mostrar mensaje de éxito
            showToast(
                `Máquina ${isUpdate ? 'actualizada' : 'creada'} correctamente`,
                'success'
            );
            
            // Refrescar tabla de máquinas
            loadMachinesTable();
            
            // Si se asignó un sensor a esta máquina, actualizar ese sensor
            if (sensorId) {
                updateSensorMachineAssociation(sensorId, data.machine_id);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(
                `Error al ${isUpdate ? 'actualizar' : 'crear'} la máquina: ${error.message}`,
                'error'
            );
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Actualizar la asociación entre sensor y máquina
function updateSensorMachineAssociation(sensorId, machineId) {
    // Obtener datos actuales del sensor
    fetch(`/api/sensors/${sensorId}`)
        .then(response => response.json())
        .then(sensor => {
            // Si el sensor ya está asignado a otra máquina, no hacer nada
            if (sensor.machine_id && sensor.machine_id === machineId) {
                return; // Ya está correctamente asociado
            }
            
            // Actualizar el sensor con la nueva asignación de máquina
            const formData = new FormData();
            formData.append('name', sensor.name);
            formData.append('description', sensor.description || '');
            formData.append('location', sensor.location || '');
            formData.append('type', sensor.type || '');
            formData.append('machine_id', machineId);
            
            // Actualizar el sensor
            fetch(`/api/sensors/${sensorId}`, {
                method: 'PUT',
                body: formData
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Error al actualizar asociación del sensor');
                    }
                    
                    // Actualizar la tabla de sensores
                    loadSensorsTable();
                })
                .catch(error => {
                    console.error('Error al actualizar asociación de sensor:', error);
                    showToast('Error al actualizar asociación de sensor', 'error');
                });
        })
        .catch(error => {
            console.error('Error al obtener datos del sensor:', error);
            showToast('Error al obtener datos del sensor', 'error');
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
    // Cargar lista de sensores
    loadSensorsTable();
    
    // Cargar selectores para el modal (máquinas y modelos disponibles)
    loadMachinesForSelect();
    loadModelsForSelect();
    
    // Configurar evento para añadir nuevo sensor
    const addSensorBtn = document.getElementById('addSensorBtn');
    if (addSensorBtn) {
        addSensorBtn.addEventListener('click', () => {
            // Limpiar el formulario
            document.getElementById('sensorForm').reset();
            document.getElementById('sensorId').value = '';
            document.getElementById('sensorModalTitle').textContent = 'Nuevo Sensor';
            
            // Actualizar selectores
            loadMachinesForSelect('sensorMachine');
            loadModelsForSelect('sensorModel');
            
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

// Cargar máquinas para el selector en el formulario de sensores
function loadMachinesForSelect(selectedMachine = null) {
    fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            const machineSelect = document.getElementById('sensorMachine');
            if (!machineSelect) return;
            
            // Mantener la opción "Ninguna"
            machineSelect.innerHTML = '<option value="">Ninguna</option>';
            
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.machine_id;
                option.textContent = machine.name;
                machineSelect.appendChild(option);
            });
            
            if (selectedMachine) {
                machineSelect.value = selectedMachine;
            }
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
        });
}

// Cargar modelos para el selector
function loadModelsForSelect() {
    fetch('/api/models')
        .then(response => response.json())
        .then(models => {
            const modelSelect = document.getElementById('sensorModel');
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
                        <td colspan="8" class="text-center">No hay sensores registrados</td>
                    </tr>
                `;
                return;
            }
            
            sensors.forEach(sensor => {
                const row = document.createElement('tr');
                
                // Preparar información de máquina asociada
                let machineInfo = '<span class="badge badge-secondary">Sin asignar</span>';
                if (sensor.machine && sensor.machine.name) {
                    machineInfo = `<span class="badge badge-info" title="ID: ${sensor.machine.machine_id}">${sensor.machine.name}</span>`;
                }
                
                // Preparar información de modelo asociado
                let modelInfo = '<span class="badge badge-secondary">Sin asignar</span>';
                if (sensor.model && sensor.model.name) {
                    modelInfo = `<span class="badge badge-primary" title="ID: ${sensor.model.model_id}">${sensor.model.name}</span>`;
                }
                
                row.innerHTML = `
                    <td class="column-id">${sensor.sensor_id}</td>
                    <td><strong>${sensor.name}</strong></td>
                    <td>${sensor.description || '-'}</td>
                    <td>${sensor.location || '-'}</td>
                    <td>${sensor.type || '-'}</td>
                    <td>${machineInfo}</td>
                    <td>${modelInfo}</td>
                    <td class="column-actions">
                        <div class="table-actions">
                            <button class="btn-icon btn-edit" title="Editar sensor" data-id="${sensor.sensor_id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" title="Eliminar sensor" data-id="${sensor.sensor_id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Configurar eventos para botones de editar y eliminar
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

// Editar sensor existente
function editSensor(sensorId) {
    // Cargar datos del sensor para edición
    fetch(`/api/sensors/${sensorId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar datos del sensor');
            }
            return response.json();
        })
        .then(sensor => {
            // Actualizar UI y formulario
            document.getElementById('sensorModalTitle').textContent = 'Editar Sensor';
            
            // Cargar valores en el formulario
            document.getElementById('sensorId').value = sensor.sensor_id;
            document.getElementById('sensorName').value = sensor.name || '';
            document.getElementById('sensorDescription').value = sensor.description || '';
            document.getElementById('sensorLocation').value = sensor.location || '';
            document.getElementById('sensorType').value = sensor.type || '';
            
            // Seleccionar máquina si está asociada
            if (document.getElementById('sensorMachine')) {
                document.getElementById('sensorMachine').value = sensor.machine_id || '';
            }
            
            // Seleccionar modelo si está asignado
            if (document.getElementById('sensorModel')) {
                document.getElementById('sensorModel').value = sensor.model_id || '';
            }
            
            // Almacenar id de máquina actual para comparación posterior
            const hiddenField = document.getElementById('currentMachineId') || document.createElement('input');
            hiddenField.type = 'hidden';
            hiddenField.id = 'currentMachineId';
            hiddenField.value = sensor.machine_id || '';
            document.getElementById('sensorForm').appendChild(hiddenField);
            
            // Mostrar modal
            const modal = document.getElementById('sensorModal');
            if (modal) modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar sensor:', error);
            showToast('Error al cargar datos del sensor', 'error');
        });
}

// Guardar sensor (crear nuevo o actualizar existente)
function saveSensor() {
    // Crear objeto FormData para envío de datos
    const formData = new FormData();
    
    // Obtener valores del formulario
    const sensorId = document.getElementById('sensorId').value;
    const sensorName = document.getElementById('sensorName').value;
    const sensorDescription = document.getElementById('sensorDescription').value;
    const sensorLocation = document.getElementById('sensorLocation').value;
    const sensorType = document.getElementById('sensorType').value;
    const machineId = document.getElementById('sensorMachine').value;
    const modelId = document.getElementById('sensorModel').value;
    
    // Verificar campo obligatorio
    if (!sensorName) {
        showToast('El nombre del sensor es obligatorio', 'warning');
        return;
    }
    
    // Añadir datos al FormData
    formData.append('name', sensorName);
    formData.append('description', sensorDescription || '');
    formData.append('location', sensorLocation || '');
    formData.append('type', sensorType || '');
    formData.append('machine_id', machineId || '');
    formData.append('model_id', modelId || '');
    
    // Determinar si es creación o actualización
    const isUpdate = sensorId && sensorId !== '';
    const url = isUpdate ? `/api/sensors/${sensorId}` : '/api/sensors';
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Mostrar indicador de carga
    showLoadingIndicator(isUpdate ? 'Actualizando sensor...' : 'Creando sensor...');
    
    // Enviar solicitud al servidor
    fetch(url, {
        method: method,
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al ${isUpdate ? 'actualizar' : 'crear'} sensor`);
            }
            return response.json();
        })
        .then(data => {
            // Cerrar modal
            const modal = document.getElementById('sensorModal');
            if (modal) modal.classList.remove('show');
            
            // Mostrar mensaje de éxito
            showToast(
                `Sensor ${isUpdate ? 'actualizado' : 'creado'} correctamente`,
                'success'
            );
            
            // Refrescar tabla de sensores y selectores
            loadSensorsTable();
            
            // Actualizar selectores en formularios de máquinas
            if (typeof loadSensorsForSelect === 'function') {
                loadSensorsForSelect();
            }
            
            // Si hay un cambio en la asignación de máquina, verificar referencias
            if (machineId) {
                const oldMachineId = document.getElementById('currentMachineId')?.value;
                if (oldMachineId !== machineId) {
                    ensureMachineSensorReference(data.sensor_id, machineId);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(
                `Error al ${isUpdate ? 'actualizar' : 'crear'} el sensor: ${error.message}`,
                'error'
            );
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Asegurar que la máquina tenga correcta referencia al sensor
function ensureMachineSensorReference(sensorId, machineId) {
    if (!sensorId || !machineId) return;
    
    // Obtener datos actuales de la máquina
    fetch(`/api/machines/${machineId}`)
        .then(response => response.json())
        .then(machine => {
            // Si la máquina ya tiene este sensor asignado, no hacer nada
            if (machine.sensor_id && machine.sensor_id === parseInt(sensorId)) {
                return; // Ya está correctamente asociado
            }
            
            // Actualizar la máquina para que se referencie a este sensor
            const machineData = {
                name: machine.name,
                description: machine.description || '',
                location: machine.location || '',
                status: machine.status || 'operativo',
                route: machine.route || '',
                sensor_id: parseInt(sensorId)
            };
            
            // Actualizar la máquina
            fetch(`/api/machines/${machineId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(machineData)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Error al actualizar asociación de la máquina');
                    }
                    
                    // Actualizar la tabla de máquinas si es necesario
                    loadMachinesTable();
                })
                .catch(error => {
                    console.error('Error al actualizar asociación de máquina:', error);
                });
        })
        .catch(error => {
            console.error('Error al obtener datos de la máquina:', error);
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
// GESTIÓN DE MODELOS
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
            
            // Mostrar elementos necesarios para un nuevo modelo
            document.getElementById('modelFileRequired').style.display = 'block';
            document.getElementById('modelFileOptional').style.display = 'none';
            
            // Resetear los nombres de archivos seleccionados
            document.getElementById('modelFileName').textContent = 'Ningún archivo seleccionado';
            document.getElementById('scalerFileName').textContent = 'Ningún archivo seleccionado';
            
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
    
    // Configurar evento para confirmar eliminación de modelo
    const confirmDeleteModelBtn = document.getElementById('confirmDeleteModelBtn');
    if (confirmDeleteModelBtn) {
        confirmDeleteModelBtn.addEventListener('click', () => {
            const modelId = document.getElementById('deleteModelId').value;
            if (modelId) {
                deleteModel(modelId);
            }
        });
    }
    
    // Configurar eventos para los inputs de archivo
    setupFileInputs();
}

// Configurar inputs de archivo personalizados
function setupFileInputs() {
    // Configurar input de archivo del modelo
    const modelFileInput = document.getElementById('modelFile');
    const modelFileButton = modelFileInput.nextElementSibling;
    const modelFileName = document.getElementById('modelFileName');
    
    modelFileButton.addEventListener('click', () => {
        modelFileInput.click();
    });
    
    modelFileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            modelFileName.textContent = event.target.files[0].name;
        } else {
            modelFileName.textContent = 'Ningún archivo seleccionado';
        }
    });
    
    // Configurar input de archivo del escalador
    const scalerFileInput = document.getElementById('scalerFile');
    const scalerFileButton = scalerFileInput.nextElementSibling;
    const scalerFileName = document.getElementById('scalerFileName');
    
    scalerFileButton.addEventListener('click', () => {
        scalerFileInput.click();
    });
    
    scalerFileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            scalerFileName.textContent = event.target.files[0].name;
        } else {
            scalerFileName.textContent = 'Ningún archivo seleccionado';
        }
    });
}

// Cargar tabla de modelos
function loadModelsTable() {
    fetch('/api/models')
        .then(response => response.json())
        .then(models => {
            const tableBody = document.getElementById('modelsTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (models.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center">No hay modelos registrados</td>
                    </tr>
                `;
                return;
            }
            
            models.forEach(model => {
                const row = document.createElement('tr');
                
                // Formatear fecha
                const lastUpdate = model.last_update ? new Date(model.last_update).toLocaleString() : '-';
                
                // Formatear exactitud
                const accuracy = model.accuracy ? `${parseFloat(model.accuracy).toFixed(2)}%` : '-';
                
                // Formatear parámetros
                let configParams = '-';
                if (model.config_params) {
                    try {
                        // Si es un string JSON, intentar formatearlo
                        if (typeof model.config_params === 'string') {
                            const parsedParams = JSON.parse(model.config_params);
                            configParams = Object.keys(parsedParams).map(key => 
                                `${key}: ${typeof parsedParams[key] === 'object' ? JSON.stringify(parsedParams[key]) : parsedParams[key]}`
                            ).join('<br>');
                        } else if (typeof model.config_params === 'object') {
                            configParams = Object.keys(model.config_params).map(key => 
                                `${key}: ${typeof model.config_params[key] === 'object' ? JSON.stringify(model.config_params[key]) : model.config_params[key]}`
                            ).join('<br>');
                        }
                    } catch (e) {
                        configParams = String(model.config_params);
                    }
                }
                
                // Preparar iconos para archivos
                const h5Icon = model.route_h5 ? 
                    `<span class="file-indicator" title="${model.route_h5}"><i class="fas fa-file-code"></i></span>` : '-';
                    
                const pkgIcon = model.route_pkl ? 
                    `<span class="file-indicator" title="${model.route_pkl}"><i class="fas fa-cog"></i></span>` : '-';
                
                row.innerHTML = `
                    <td class="column-id">${model.model_id}</td>
                    <td><strong>${model.name}</strong></td>
                    <td>${model.description || '-'}</td>
                    <td title="${model.route_h5 || ''}">${h5Icon} ${model.route_h5 ? model.route_h5.split('/').pop() : '-'}</td>
                    <td title="${model.route_pkl || ''}">${pkgIcon} ${model.route_pkl ? model.route_pkl.split('/').pop() : '-'}</td>
                    <td>${accuracy}</td>
                    <td><span class="text-truncate" title="${configParams.replace(/<br>/g, '\n')}">${configParams.replace(/<br>/g, ', ')}</span></td>
                    <td>${lastUpdate}</td>
                    <td class="column-actions">
                        <div class="table-actions">
                            <button class="btn-icon btn-edit" title="Editar modelo" data-id="${model.model_id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" title="Eliminar modelo" data-id="${model.model_id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Configurar eventos para botones de editar y eliminar
            const editButtons = tableBody.querySelectorAll('.btn-edit');
            editButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const modelId = button.getAttribute('data-id');
                    editModel(modelId);
                });
            });
            
            const deleteButtons = tableBody.querySelectorAll('.btn-delete');
            deleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const modelId = button.getAttribute('data-id');
                    deleteModel(modelId);
                });
            });
        })
        .catch(error => {
            console.error('Error al cargar modelos:', error);
            showToast('Error al cargar modelos', 'error');
        });
}

// Editar modelo
function editModel(modelId) {
    fetch(`/api/models/${modelId}`)
        .then(response => response.json())
        .then(model => {
            // Cargar datos en el formulario
            document.getElementById('modelId').value = model.model_id;
            document.getElementById('modelName').value = model.name;
            document.getElementById('modelDescription').value = model.description || '';
            document.getElementById('modelAccuracy').value = model.accuracy || '';
            document.getElementById('modelConfigParams').value = model.config_params || '';
            
            // Actualizar UI para edición
            document.getElementById('modelFileRequired').style.display = 'none';
            document.getElementById('modelFileOptional').style.display = 'block';
            
            // Mostrar nombres de archivo actuales
            const h5FileName = model.route_h5 ? model.route_h5.split('/').pop() : 'No seleccionado';
            const pklFileName = model.route_pkl ? model.route_pkl.split('/').pop() : 'No seleccionado';
            
            document.getElementById('modelFileName').textContent = h5FileName;
            document.getElementById('scalerFileName').textContent = pklFileName;
            
            // Actualizar título del modal
            document.getElementById('modelModalTitle').textContent = 'Editar Modelo';
            
            // Mostrar el modal
            const modal = document.getElementById('modelModal');
            modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar datos del modelo:', error);
            showToast('Error al cargar datos del modelo', 'error');
        });
}

// Guardar modelo (crear o actualizar)
function saveModel() {
    // Obtener datos del formulario
    const modelId = document.getElementById('modelId').value;
    const name = document.getElementById('modelName').value;
    const description = document.getElementById('modelDescription').value;
    const accuracy = document.getElementById('modelAccuracy').value;
    const configParams = document.getElementById('modelConfigParams').value;
    const modelFile = document.getElementById('modelFile').files[0];
    const scalerFile = document.getElementById('scalerFile').files[0];
    
    // Validar nombre
    if (!name) {
        showToast('El nombre del modelo es obligatorio', 'warning');
        return;
    }
    
    // Validar archivo del modelo para nuevos modelos
    if (!modelId && !modelFile) {
        showToast('El archivo del modelo es obligatorio para nuevos modelos', 'warning');
        return;
    }
    
    // Preparar datos del formulario
    const formData = new FormData();
    formData.append('name', name);
    
    if (description) {
        formData.append('description', description);
    }
    
    if (accuracy) {
        formData.append('accuracy', accuracy);
    }
    
    if (configParams) {
        formData.append('config_params', configParams);
    }
    
    if (modelFile) {
        formData.append('model_file', modelFile);
    }
    
    if (scalerFile) {
        formData.append('scaler_file', scalerFile);
    }
    
    // Determinar si es creación o actualización
    const isUpdate = !!modelId;
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `/api/models/${modelId}` : '/api/models';
    
    // Mostrar indicador de carga
    showLoadingIndicator(isUpdate ? 'Actualizando modelo...' : 'Creando modelo...');
    
    // Enviar solicitud
    fetch(url, {
        method: method,
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            // Cerrar modal
            const modal = document.getElementById('modelModal');
            modal.classList.remove('show');
            
            // Actualizar UI
            loadModelsTable();
            
            // Recargar selectores
            if (typeof loadModelsForSelect === 'function') {
                loadModelsForSelect();
            }
            
            // Mostrar mensaje
            const action = isUpdate ? 'actualizado' : 'creado';
            showToast(`Modelo ${action} correctamente`, 'success');
        })
        .catch(error => {
            console.error('Error al guardar modelo:', error);
            showToast(`Error al guardar modelo: ${error.message}`, 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Eliminar modelo
function deleteModel(modelId) {
    // Mostrar indicador de carga
    showLoadingIndicator('Eliminando modelo...');
    
    // Enviar solicitud de eliminación
    fetch(`/api/models/${modelId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al eliminar modelo');
            }
            return response.json();
        })
        .then(result => {
            // Cerrar modal de confirmación
            const modal = document.getElementById('deleteModelModal');
            modal.classList.remove('show');
            
            // Actualizar UI
            loadModelsTable();
            
            // Recargar selectores
            if (typeof loadModelsForSelect === 'function') {
                loadModelsForSelect();
            }
            
            // Mostrar mensaje
            showToast('Modelo eliminado correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al eliminar modelo:', error);
            showToast(`Error al eliminar modelo: ${error.message}`, 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
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
    
    // Mostrar indicador de carga
    showLoadingIndicator('Actualizando límites...');
    
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
        .then(updatedLimits => {
            // Cerrar modal
            const modal = document.getElementById('limitsModal');
            if (modal) modal.classList.remove('show');
            
            // Actualizar gráficos con nuevos límites
            if (typeof updateChartsWithNewLimits === 'function') {
                updateChartsWithNewLimits(updatedLimits);
            }
            
            // Mostrar mensaje
            showToast('Límites actualizados correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al guardar límites:', error);
            showToast('Error al guardar límites', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Restablecer límites a valores por defecto
function resetLimits() {
    // Mostrar indicador de carga
    showLoadingIndicator('Restableciendo límites...');
    
    fetch('/api/limits/reset', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al restablecer límites');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar campos del formulario con los límites por defecto
            const limits = result.limits || {};
            
            for (const axis of ['x', 'y', 'z']) {
                document.getElementById(`${axis}Sigma2Lower`).value = limits[axis]?.sigma2?.lower || '';
                document.getElementById(`${axis}Sigma2Upper`).value = limits[axis]?.sigma2?.upper || '';
                document.getElementById(`${axis}Sigma3Lower`).value = limits[axis]?.sigma3?.lower || '';
                document.getElementById(`${axis}Sigma3Upper`).value = limits[axis]?.sigma3?.upper || '';
            }
            
            // Actualizar gráficos con nuevos límites
            if (typeof updateChartsWithNewLimits === 'function') {
                updateChartsWithNewLimits(limits);
            }
            
            // Mostrar mensaje
            showToast('Límites restablecidos correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al restablecer límites:', error);
            showToast('Error al restablecer límites', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Cargar datos para el modal de sensor
function loadSensorForm(sensorId = null) {
    // Limpiar formulario primero
    document.getElementById('sensorForm').reset();
    document.getElementById('sensorId').value = '';
    document.getElementById('sensorModalTitle').textContent = 'Nuevo Sensor';
    
    // Cargar máquinas y modelos disponibles
    loadMachinesForSelect('sensorMachine');
    loadModelsForSelect('sensorModel');
    
    // Si es edición, cargar datos del sensor
    if (sensorId) {
        document.getElementById('sensorModalTitle').textContent = 'Editar Sensor';
        
        // Cargar datos del sensor
        fetch(`/api/sensors/${sensorId}`)
            .then(response => response.json())
            .then(sensor => {
                document.getElementById('sensorId').value = sensor.sensor_id;
                document.getElementById('sensorName').value = sensor.name;
                document.getElementById('sensorDescription').value = sensor.description || '';
                document.getElementById('sensorLocation').value = sensor.location || '';
                document.getElementById('sensorType').value = sensor.type || '';
                
                // Seleccionar máquina si está asignada
                if (document.getElementById('sensorMachine')) {
                    document.getElementById('sensorMachine').value = sensor.machine_id || '';
                }
                
                // Seleccionar modelo si está asignado
                if (document.getElementById('sensorModel')) {
                    document.getElementById('sensorModel').value = sensor.model_id || '';
                }
            })
            .catch(error => {
                console.error('Error al cargar datos del sensor:', error);
                showToast('Error al cargar datos del sensor', 'error');
            });
    }
}