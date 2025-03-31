// Configuración de la API
const API_CONFIG = {
    BASE_URL: window.location.origin,
    ENDPOINTS: {
        PREDICT: '/api/predict',
        SENSORS: '/api/sensors',
        HISTORY: '/api/history',
        MAINTENANCE: '/api/maintenance',
        DASHBOARD: '/api/dashboard',
        CONFIG: '/api/config',
        ALERTS: '/api/alerts',
        STATS: '/api/stats',
    },
    REFRESH_INTERVAL: 10000, // Milisegundos para actualización automática
};

// Configuración de gráficos
const CHART_CONFIG = {
    COLORS: {
        PRIMARY: '#3498db',
        SUCCESS: '#2ecc71',
        WARNING: '#f39c12',
        DANGER: '#e74c3c',
        INFO: '#00c0ef',
        SECONDARY: '#9b59b6',
        BACKGROUND: 'rgba(255, 255, 255, 0.7)',
        GRID: 'rgba(0, 0, 0, 0.1)',
    },
    ANIMATION_DURATION: 800,
    RESPONSIVE: true,
};

// Configuración de alertas
const ALERT_CONFIG = {
    LEVELS: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error',
    },
    AUTO_CLOSE: 5000, // Tiempo en ms para cerrar automáticamente
};

// Umbrales para diferentes estados de salud de la maquinaria
const THRESHOLD_CONFIG = {
    NORMAL: 0.25,
    WARNING: 0.5,
    CRITICAL: 0.75,
};

// Inicializar la sección de configuración
function initConfig() {
    logConfig('info', 'Inicializando sección de configuración');
    
    try {
        // Inicializar pestañas de configuración
        initConfigTabs();
        
        // Inicializar contenido de cada pestaña
        initMachineTab();
        initSensorTab();
        initModelTab();
        initLimitsTab();
        
        logConfig('info', 'Sección de configuración inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar la sección de configuración', error);
        throw error; // Re-lanzar para manejo superior
    }
}

// Inicializar pestañas de configuración
function initConfigTabs() {
    logConfig('debug', 'Inicializando pestañas de configuración');
    const tabItems = document.querySelectorAll('.tab-item');
    
    if (!tabItems.length) {
        logConfig('warn', 'No se encontraron elementos de pestaña');
        return;
    }
    
    tabItems.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = tab.getAttribute('data-tab');
            logConfig('debug', `Cambiando a pestaña: ${tabId}`);
            
            try {
                // Actualizar estado activo
                tabItems.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Mostrar contenido correspondiente
                const tabContents = document.querySelectorAll('.tab-content');
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                
                // Buscar el contenedor por ID
                const targetContent = document.getElementById(`${tabId}Content`);
                if (targetContent) {
                    targetContent.classList.add('active');
                    logConfig('debug', `Contenido de pestaña ${tabId} activado`);
                } else {
                    logConfig('error', `No se encontró el contenido para la pestaña ${tabId}`);
                }
            } catch (error) {
                logConfig('error', `Error al cambiar a pestaña ${tabId}`, error);
            }
        });
    });
}

// Inicializar pestaña de máquinas
function initMachineTab() {
    logConfig('debug', 'Inicializando pestaña de máquinas');
    try {
        // Verificar elementos necesarios
        const machineForm = document.getElementById('machineForm');
        const machinesTable = document.getElementById('machinesTable');
        
        if (!machineForm || !machinesTable) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de máquinas');
            return;
        }
        
        // Cargar máquinas existentes
        refreshMachinesTable();
        
        // Cargar los sensores en el selector de sensores
        updateMachineSensorSelectors();
        
        // Manejar envío del formulario
        machineForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const machineName = document.getElementById('machineName').value;
            const machineDescription = document.getElementById('machineDescription').value;
            const machineSensor = document.getElementById('machineSensor').value;
            const machineId = document.getElementById('machineId').value;
            
            logConfig('info', `Enviando formulario de máquina: ${machineName}`);
            
            // Llamar a la función saveMachine con los datos del formulario
            saveMachine({
                name: machineName,
                description: machineDescription,
                sensor_id: machineSensor,
                machine_id: machineId
            });
        });
        
        // Configurar botones de cancelar
        document.getElementById('cancelMachineBtn').addEventListener('click', resetMachineForm);
        
        // Inicializar event listeners para los botones de edición y eliminación
        setupMachineTableActions();
        
        // Configurar evento para cuando se cambie a esta pestaña
        const machineTab = document.querySelector('.tab-item[data-tab="machine"]');
        if (machineTab) {
            machineTab.addEventListener('click', function() {
                // Actualizar listado de sensores al activar esta pestaña
                setTimeout(() => {
                    updateMachineSensorSelectors();
                }, 100);
            });
        }
        
        logConfig('debug', 'Pestaña de máquinas inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de máquinas', error);
        throw error;
    }
}

// Función para guardar una máquina (creación o actualización)
function saveMachine(machineData) {
    // Verificar datos mínimos requeridos
    if (!machineData.name || machineData.name.trim() === '') {
        showToast('El nombre de la máquina es obligatorio', 'error');
        return;
    }
    
    // Crear FormData
    const formData = new FormData();
    formData.append('name', machineData.name);
    if (machineData.description) formData.append('description', machineData.description);
    if (machineData.sensor_id) formData.append('sensor_id', machineData.sensor_id);
    
    // Determinar si es una actualización o creación
    const isUpdate = machineData.machine_id !== '';
    const url = isUpdate 
        ? `${API_CONFIG.BASE_URL}/api/machines/${machineData.machine_id}`
        : `${API_CONFIG.BASE_URL}/api/machines`;
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Mostrar notificación de carga
    showToast('Guardando máquina...', 'info');
    
    // Deshabilitar el botón de guardar para evitar dobles envíos
    const submitButton = document.querySelector('#machineForm button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
    }
    
    logConfig('debug', `Enviando petición ${method} a ${url} con datos:`, machineData);
    
    // Enviar petición al servidor
    fetch(url, {
        method: method,
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        logConfig('debug', 'Respuesta del servidor recibida correctamente');
        return response.json();
    })
    .then(data => {
        logConfig('info', `Máquina ${isUpdate ? 'actualizada' : 'creada'} correctamente`, data);
        showToast(`Máquina ${isUpdate ? 'actualizada' : 'guardada'} correctamente`, 'success');
        
        // Limpiar formulario
        resetMachineForm();
        
        // Actualizar la tabla de máquinas de forma forzada
        setTimeout(() => {
            // Recuperar los datos actualizados del servidor
            refreshMachinesTable();
            
            // Disparar evento personalizado para notificar que la tabla de máquinas se ha actualizado
            const event = new CustomEvent('machinesTableUpdated', { 
                detail: { 
                    action: isUpdate ? 'update' : 'create',
                    machine_id: data.data ? data.data.machine_id : (data.machine_id || '')
                } 
            });
            document.dispatchEvent(event);
        }, 300);
        
        // Si tenemos WebSockets activos, notificar a otros clientes
        if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'machine_update',
                data: { 
                    machine_id: data.data ? data.data.machine_id : (data.machine_id || ''),
                    action: isUpdate ? 'update' : 'create'
                }
            }));
        }
    })
    .catch(error => {
        logConfig('error', 'Error al guardar la máquina', error);
        showToast(`Error al guardar la máquina: ${error.message}`, 'error');
    })
    .finally(() => {
        // Re-habilitar el botón de guardar
        if (submitButton) {
            submitButton.disabled = false;
        }
    });
}

// Función para actualizar la tabla de máquinas
function refreshMachinesTable() {
    logConfig('debug', 'Actualizando tabla de máquinas');
    
    const machinesTable = document.getElementById('machinesTable');
    if (!machinesTable) {
        logConfig('warn', 'No se encontró la tabla de máquinas en el DOM');
        return;
    }
    
    const tbody = machinesTable.querySelector('tbody');
    if (!tbody) {
        logConfig('warn', 'No se encontró el tbody en la tabla de máquinas');
        return;
    }
    
    // Mostrar indicador de carga
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando máquinas...</td></tr>';
    
    // Obtener sensores para mapear IDs a nombres
    let sensorMap = {};
    
    fetch(`${API_CONFIG.BASE_URL}/api/sensors`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener sensores: ${response.status}`);
            }
            return response.json();
        })
        .then(response => {
            // Asegurarse de extraer correctamente los datos de cualquier formato de respuesta
            let sensors = response;
            if (response.data && Array.isArray(response.data)) {
                sensors = response.data;
            } else if (response.success && response.data && Array.isArray(response.data)) {
                sensors = response.data;
            }
            
            if (!Array.isArray(sensors)) {
                logConfig('warn', 'Respuesta no válida: sensors no es un array', { response });
                // Continuar con un mapa vacío
                return fetch(`${API_CONFIG.BASE_URL}/api/machines`);
            }
            
            logConfig('debug', `Se encontraron ${sensors.length} sensores para mapear nombres`);
            
            // Crear mapa de IDs a nombres de sensores
            sensorMap = sensors.reduce((map, sensor) => {
                if (sensor && sensor.sensor_id) {
                    map[sensor.sensor_id] = sensor.name || `Sensor ${sensor.sensor_id}`;
                }
                return map;
            }, {});
            
            // Ahora obtener las máquinas
            return fetch(`${API_CONFIG.BASE_URL}/api/machines`);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener máquinas: ${response.status}`);
            }
            return response.json();
        })
        .then(response => {
            // Asegurarse de extraer correctamente los datos de cualquier formato de respuesta
            let data = response;
            if (response.data && Array.isArray(response.data)) {
                data = response.data;
            } else if (response.success && response.data && Array.isArray(response.data)) {
                data = response.data;
            }
            
            if (!Array.isArray(data)) {
                logConfig('warn', 'Respuesta no válida: data no es un array', { response });
                // Mostrar mensaje de error en la tabla
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error al cargar máquinas</td></tr>';
                return;
            }
            
            logConfig('debug', `Se encontraron ${data.length} máquinas para mostrar en la tabla`);
            
            // Limpiar tabla
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                // No hay máquinas, mostrar fila de "no hay datos"
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="5" class="text-center">No hay máquinas configuradas</td>`;
                tbody.appendChild(emptyRow);
                return;
            }
            
            // Poblar tabla con datos
            data.forEach(machine => {
                const sensorName = machine.sensor_id ? (sensorMap[machine.sensor_id] || 'Sensor desconocido') : 'No asignado';
                
                const row = document.createElement('tr');
                row.setAttribute('data-machine-id', machine.machine_id);
                row.innerHTML = `
                    <td>${machine.machine_id}</td>
                    <td>${machine.name || 'Sin nombre'}</td>
                    <td>${machine.description || 'Sin descripción'}</td>
                    <td>${sensorName}</td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-icon edit-machine" data-id="${machine.machine_id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon delete-machine" data-id="${machine.machine_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Reinicializar listeners
            setupMachineTableActions();
            
            // Disparar evento personalizado para notificar que la tabla se ha actualizado
            const event = new CustomEvent('machinesTableUpdated', { 
                detail: { 
                    count: data.length,
                    action: 'refresh'
                } 
            });
            document.dispatchEvent(event);
            
            logConfig('debug', `Tabla de máquinas actualizada con ${data.length} registros`);
        })
        .catch(error => {
            logConfig('error', 'Error al actualizar tabla de máquinas', error);
            showToast(`Error al cargar máquinas: ${error.message}`, 'error');
            
            // Mostrar mensaje de error en la tabla
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">Error al cargar máquinas: ${error.message}</td></tr>`;
        });
}

// Función para actualizar los selectores de sensores en los formularios de máquinas
function updateMachineSensorSelectors() {
    logConfig('debug', 'Actualizando selectores de sensores para máquinas');
    
    // Obtener los selectores de sensores en los formularios de máquinas
    const machineSensorSelects = [
        document.getElementById('machineSensor'),
        document.getElementById('machineModalForm')?.querySelector('#machineSensor')
    ].filter(Boolean);
    
    if (machineSensorSelects.length === 0) {
        logConfig('warn', 'No se encontraron selectores de sensores para máquinas');
        return;
    }
    
    // Mostrar estado de carga en los selectores
    machineSensorSelects.forEach(select => {
        if (!select) return;
        
        // Guardar el valor seleccionado actualmente
        const currentValue = select.value;
        
        // Limpiar opciones actuales, excepto la primera (si existe)
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Si no hay primera opción, crearla
        if (select.options.length === 0) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Seleccione un sensor';
            select.appendChild(defaultOption);
        }
        
        // Añadir opción de carga
        const loadingOption = document.createElement('option');
        loadingOption.value = '';
        loadingOption.textContent = 'Cargando sensores...';
        loadingOption.disabled = true;
        select.appendChild(loadingOption);
        
        // Seleccionar opción de carga
        select.value = '';
    });
    
    // Obtener sensores desde el servidor
    fetch(`${API_CONFIG.BASE_URL}/api/sensors`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(response => {
            // Asegurarse de extraer correctamente los datos de cualquier formato de respuesta
            let sensors = response;
            if (response.data && Array.isArray(response.data)) {
                sensors = response.data;
            } else if (response.success && response.data && Array.isArray(response.data)) {
                sensors = response.data;
            }
            
            if (!Array.isArray(sensors)) {
                logConfig('warn', 'Respuesta no válida: sensors no es un array', { response });
                throw new Error('Formato de respuesta no válido');
            }
            
            logConfig('debug', `Se encontraron ${sensors.length} sensores para actualizar selectores`);
            
            machineSensorSelects.forEach(select => {
                if (!select) return;
                
                // Guardar el valor seleccionado actualmente
                const currentValue = select.value;
                
                // Limpiar opciones actuales, excepto la primera
                while (select.options.length > 1) {
                    select.remove(1);
                }
                
                // Si no hay primera opción, crearla
                if (select.options.length === 0) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Seleccione un sensor';
                    select.appendChild(defaultOption);
                }
                
                // Si no hay sensores, mostrar mensaje
                if (sensors.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No hay sensores disponibles';
                    option.disabled = true;
                    select.appendChild(option);
                } else {
                    // Ordenar sensores por ID
                    sensors.sort((a, b) => (a.sensor_id || 0) - (b.sensor_id || 0));
                    
                    // Añadir opciones para cada sensor
                    sensors.forEach(sensor => {
                        if (!sensor || !sensor.sensor_id) {
                            logConfig('warn', 'Sensor inválido encontrado', { sensor });
                            return;
                        }
                        
                        const option = document.createElement('option');
                        option.value = sensor.sensor_id;
                        option.textContent = sensor.name || `Sensor ${sensor.sensor_id}`;
                        select.appendChild(option);
                    });
                }
                
                // Restaurar valor seleccionado si aún existe
                if (currentValue) {
                    const exists = Array.from(select.options).some(option => option.value === currentValue);
                    if (exists) {
                        select.value = currentValue;
                    } else {
                        // Si la opción anterior ya no existe, seleccionar la predeterminada
                        select.selectedIndex = 0;
                    }
                } else {
                    // Si no había valor seleccionado, seleccionar la predeterminada
                    select.selectedIndex = 0;
                }
            });
            
            logConfig('debug', `Selectores de sensores actualizados con ${sensors.length} sensores`);
        })
        .catch(error => {
            logConfig('error', 'Error al actualizar selectores de sensores', error);
            showToast('Error al cargar sensores disponibles', 'error');
            
            // Mostrar mensaje de error en los selectores
            machineSensorSelects.forEach(select => {
                if (!select) return;
                
                // Limpiar opciones actuales, excepto la primera
                while (select.options.length > 1) {
                    select.remove(1);
                }
                
                // Añadir mensaje de error
                const errorOption = document.createElement('option');
                errorOption.value = '';
                errorOption.textContent = 'Error al cargar sensores';
                errorOption.disabled = true;
                select.appendChild(errorOption);
                
                // Restaurar a primera opción
                select.selectedIndex = 0;
            });
        });
}

// Función para configurar los event listeners de los botones de edición y eliminación de máquinas
function setupMachineTableActions() {
    // Event listeners para botones de edición
    document.querySelectorAll('.edit-machine').forEach(button => {
        button.addEventListener('click', function() {
            const machineId = this.getAttribute('data-id');
            logConfig('debug', `Editando máquina con ID: ${machineId}`);
            
            // Cargar datos de la máquina
            fetch(`${API_CONFIG.BASE_URL}/api/machines/${machineId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(machine => {
                    // Llenar formulario con datos de la máquina
                    document.getElementById('machineId').value = machine.machine_id;
                    document.getElementById('machineName').value = machine.name || '';
                    document.getElementById('machineDescription').value = machine.description || '';
                    
                    // Seleccionar el sensor si existe
                    if (machine.sensor_id) {
                        const machineSensorSelect = document.getElementById('machineSensor');
                        if (machineSensorSelect) {
                            machineSensorSelect.value = machine.sensor_id;
                        }
                    }
                    
                    // Hacer scroll al formulario
                    document.getElementById('machineForm').scrollIntoView({ behavior: 'smooth' });
                })
                .catch(error => {
                    logConfig('error', `Error al cargar datos de la máquina ${machineId}`, error);
                    showToast(`Error al cargar máquina: ${error.message}`, 'error');
                });
        });
    });
    
    // Event listeners para botones de eliminación
    document.querySelectorAll('.delete-machine').forEach(button => {
        button.addEventListener('click', function() {
            const machineId = this.getAttribute('data-id');
            if (confirm(`¿Está seguro que desea eliminar la máquina con ID ${machineId}?`)) {
                logConfig('debug', `Eliminando máquina con ID: ${machineId}`);
                
                // Mostrar notificación de carga
                showToast('Eliminando máquina...', 'info');
                
                fetch(`${API_CONFIG.BASE_URL}/api/machines/${machineId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    logConfig('info', `Máquina ${machineId} eliminada correctamente`);
                    showToast('Máquina eliminada correctamente', 'success');
                    
                    // Actualizar tabla
                    refreshMachinesTable();
                    
                    // Disparar evento personalizado
                    const event = new CustomEvent('machinesTableUpdated', { 
                        detail: { 
                            action: 'delete',
                            machine_id: machineId 
                        } 
                    });
                    document.dispatchEvent(event);
                    
                    // Si tenemos WebSockets activos, notificar a otros clientes
                    if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'machine_update',
                            data: { 
                                machine_id: machineId, 
                                action: 'delete'
                            }
                        }));
                    }
                })
                .catch(error => {
                    logConfig('error', `Error al eliminar máquina ${machineId}`, error);
                    showToast(`Error al eliminar máquina: ${error.message}`, 'error');
                });
            }
        });
    });
}

// Función para restablecer el formulario de máquinas
function resetMachineForm() {
    const machineForm = document.getElementById('machineForm');
    if (!machineForm) return;
    
    machineForm.reset();
    document.getElementById('machineId').value = '';
}

// Inicializar pestaña de sensores
function initSensorTab() {
    logConfig('debug', 'Inicializando pestaña de sensores');
    try {
        // Verificar elementos necesarios
        const sensorForm = document.getElementById('sensorForm');
        const sensorsTable = document.getElementById('sensorsTable');
        
        if (!sensorForm || !sensorsTable) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de sensores');
            return;
        }
        
        // Cargar sensores y modelos existentes
        refreshSensorsTable();
        
        // Cargar los modelos en el selector de modelos
        refreshModelsTable();
        
        // Manejar envío del formulario
        sensorForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const sensorName = document.getElementById('sensorName').value;
            const sensorDescription = document.getElementById('sensorDescription').value;
            const sensorModel = document.getElementById('sensorModel').value;
            const sensorId = document.getElementById('sensorId').value;
            
            if (!sensorModel) {
                showToast('Debe seleccionar un modelo', 'error');
                return;
            }
            
            logConfig('info', `Enviando formulario de sensor: ${sensorName}`);
            
            // Llamar a la función saveSensor con los datos del formulario
            saveSensor({
                name: sensorName,
                description: sensorDescription,
                model_id: sensorModel,
                sensor_id: sensorId
            });
        });
        
        // Configurar botones de cancelar
        document.getElementById('cancelSensorBtn').addEventListener('click', resetSensorForm);
        
        // Inicializar event listeners para los botones de edición y eliminación
        setupSensorTableActions();
        
        logConfig('debug', 'Pestaña de sensores inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de sensores', error);
        throw error;
    }
}

// Función para guardar un sensor (creación o actualización)
function saveSensor(sensorData) {
    // Crear FormData
    const formData = new FormData();
    formData.append('name', sensorData.name);
    if (sensorData.description) formData.append('description', sensorData.description);
    formData.append('model_id', sensorData.model_id);
    
    // Determinar si es una actualización o creación
    const isUpdate = sensorData.sensor_id !== '';
    const url = isUpdate 
        ? `${API_CONFIG.BASE_URL}/api/sensors/${sensorData.sensor_id}`
        : `${API_CONFIG.BASE_URL}/api/sensors`;
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Mostrar notificación de carga
    showToast('Guardando sensor...', 'info');
    
    // Deshabilitar el botón de guardar para evitar dobles envíos
    const submitButton = document.querySelector('#sensorForm button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
    }
    
    // Enviar petición al servidor
    fetch(url, {
        method: method,
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        logConfig('info', `Sensor ${isUpdate ? 'actualizado' : 'creado'} correctamente`, data);
        showToast(`Sensor ${isUpdate ? 'actualizado' : 'guardado'} correctamente`, 'success');
        
        // Limpiar formulario
        resetSensorForm();
        
        // Actualizar la tabla de sensores de forma forzada
        setTimeout(() => {
            // Recuperar los datos actualizados del servidor
            refreshSensorsTable();
            
            // Actualizar los selectores de sensores en formularios de máquinas
            updateMachineSensorSelectors();
            
            // Disparar evento personalizado para notificar que la tabla de sensores se ha actualizado
            const event = new CustomEvent('sensorsTableUpdated', { 
                detail: { 
                    action: isUpdate ? 'update' : 'create',
                    sensor_id: data.data ? data.data.sensor_id : (data.sensor_id || '')
                } 
            });
            document.dispatchEvent(event);
        }, 300);
        
        // Si tenemos WebSockets activos, notificar a otros clientes
        if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'sensor_update',
                data: { 
                    sensor_id: data.data ? data.data.sensor_id : (data.sensor_id || ''),
                    action: isUpdate ? 'update' : 'create'
                }
            }));
        }
    })
    .catch(error => {
        logConfig('error', 'Error al guardar el sensor', error);
        showToast(`Error al guardar el sensor: ${error.message}`, 'error');
    })
    .finally(() => {
        // Re-habilitar el botón de guardar
        if (submitButton) {
            submitButton.disabled = false;
        }
    });
}

// Función para actualizar la tabla de sensores
function refreshSensorsTable() {
    logConfig('debug', 'Actualizando tabla de sensores');
    
    const sensorsTable = document.getElementById('sensorsTable');
    if (!sensorsTable) {
        logConfig('warn', 'No se encontró la tabla de sensores en el DOM');
        return;
    }
    
    const tbody = sensorsTable.querySelector('tbody');
    if (!tbody) {
        logConfig('warn', 'No se encontró el tbody en la tabla de sensores');
        return;
    }
    
    // Mostrar indicador de carga
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando sensores...</td></tr>';
    
    // Obtener modelos para mapear IDs a nombres
    let modelMap = {};
    
    fetch(`${API_CONFIG.BASE_URL}/api/models`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener modelos: ${response.status}`);
            }
            return response.json();
        })
        .then(response => {
            // Asegurarse de extraer correctamente los datos de cualquier formato de respuesta
            let models = response;
            if (response.data && Array.isArray(response.data)) {
                models = response.data;
            } else if (response.success && response.data && Array.isArray(response.data)) {
                models = response.data;
            }
            
            if (!Array.isArray(models)) {
                logConfig('warn', 'Respuesta no válida: models no es un array', { response });
                // Continuar con un mapa vacío
                return fetch(`${API_CONFIG.BASE_URL}/api/sensors`);
            }
            
            logConfig('debug', `Se encontraron ${models.length} modelos para mapear nombres`);
            
            // Crear mapa de IDs a nombres de modelos
            modelMap = models.reduce((map, model) => {
                if (model && model.model_id) {
                    map[model.model_id] = model.name || `Modelo ${model.model_id}`;
                }
                return map;
            }, {});
            
            // Ahora obtener los sensores
            return fetch(`${API_CONFIG.BASE_URL}/api/sensors`);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener sensores: ${response.status}`);
            }
            return response.json();
        })
        .then(response => {
            // Asegurarse de extraer correctamente los datos de cualquier formato de respuesta
            let data = response;
            if (response.data && Array.isArray(response.data)) {
                data = response.data;
            } else if (response.success && response.data && Array.isArray(response.data)) {
                data = response.data;
            }
            
            if (!Array.isArray(data)) {
                logConfig('warn', 'Respuesta no válida: data no es un array', { response });
                // Mostrar mensaje de error en la tabla
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error al cargar sensores</td></tr>';
                return;
            }
            
            logConfig('debug', `Se encontraron ${data.length} sensores para mostrar en la tabla`);
            
            // Limpiar tabla
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                // No hay sensores, mostrar fila de "no hay datos"
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="5" class="text-center">No hay sensores configurados</td>`;
                tbody.appendChild(emptyRow);
                return;
            }
            
            // Poblar tabla con datos
            data.forEach(sensor => {
                const modelName = sensor.model_id ? (modelMap[sensor.model_id] || 'Modelo desconocido') : 'No asignado';
                
                const row = document.createElement('tr');
                row.setAttribute('data-sensor-id', sensor.sensor_id);
                row.innerHTML = `
                    <td>${sensor.sensor_id}</td>
                    <td>${sensor.name || 'Sin nombre'}</td>
                    <td>${sensor.description || 'Sin descripción'}</td>
                    <td>${modelName}</td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-icon edit-sensor" data-id="${sensor.sensor_id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon delete-sensor" data-id="${sensor.sensor_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Reinicializar listeners
            setupSensorTableActions();
            
            // Disparar evento personalizado para notificar que la tabla se ha actualizado
            const event = new CustomEvent('sensorsTableUpdated', { 
                detail: { 
                    count: data.length,
                    action: 'refresh'
                } 
            });
            document.dispatchEvent(event);
            
            // Actualizar también los selectores después de cargar los sensores
            if (typeof updateMachineSensorSelectors === 'function') {
                setTimeout(() => {
                    updateMachineSensorSelectors();
                }, 200);
            }
            
            logConfig('debug', `Tabla de sensores actualizada con ${data.length} registros`);
        })
        .catch(error => {
            logConfig('error', 'Error al actualizar tabla de sensores', error);
            showToast(`Error al cargar sensores: ${error.message}`, 'error');
            
            // Mostrar mensaje de error en la tabla
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">Error al cargar sensores: ${error.message}</td></tr>`;
        });
}

// Función para configurar los event listeners de los botones de edición y eliminación de sensores
function setupSensorTableActions() {
    // Event listeners para botones de edición
    document.querySelectorAll('.edit-sensor').forEach(button => {
        button.addEventListener('click', function() {
            const sensorId = this.getAttribute('data-id');
            logConfig('debug', `Editando sensor con ID: ${sensorId}`);
            
            // Cargar datos del sensor
            fetch(`${API_CONFIG.BASE_URL}/api/sensors/${sensorId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(sensor => {
                    // Llenar formulario con datos del sensor
                    document.getElementById('sensorId').value = sensor.sensor_id;
                    document.getElementById('sensorName').value = sensor.name || '';
                    document.getElementById('sensorDescription').value = sensor.description || '';
                    
                    // Seleccionar el modelo si existe
                    if (sensor.model_id) {
                        const sensorModelSelect = document.getElementById('sensorModel');
                        if (sensorModelSelect) {
                            sensorModelSelect.value = sensor.model_id;
                        }
                    }
                    
                    // Hacer scroll al formulario
                    document.getElementById('sensorForm').scrollIntoView({ behavior: 'smooth' });
                })
                .catch(error => {
                    logConfig('error', `Error al cargar datos del sensor ${sensorId}`, error);
                    showToast(`Error al cargar sensor: ${error.message}`, 'error');
                });
        });
    });
    
    // Event listeners para botones de eliminación
    document.querySelectorAll('.delete-sensor').forEach(button => {
        button.addEventListener('click', function() {
            const sensorId = this.getAttribute('data-id');
            if (confirm(`¿Está seguro que desea eliminar el sensor con ID ${sensorId}?`)) {
                logConfig('debug', `Eliminando sensor con ID: ${sensorId}`);
                
                fetch(`${API_CONFIG.BASE_URL}/api/sensors/${sensorId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    logConfig('info', `Sensor ${sensorId} eliminado correctamente`);
                    showToast('Sensor eliminado correctamente', 'success');
                    
                    // Actualizar tabla
                    refreshSensorsTable();
                    
                    // Actualizar los selectores de sensores en formularios de máquinas
                    updateMachineSensorSelectors();
                    
                    // Si tenemos WebSockets activos, notificar a otros clientes
                    if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'sensor_update',
                            data: { sensor_id: sensorId, deleted: true }
                        }));
                    }
                })
                .catch(error => {
                    logConfig('error', `Error al eliminar sensor ${sensorId}`, error);
                    showToast(`Error al eliminar sensor: ${error.message}`, 'error');
                });
            }
        });
    });
}

// Función para restablecer el formulario de sensores
function resetSensorForm() {
    const sensorForm = document.getElementById('sensorForm');
    if (!sensorForm) return;
    
    sensorForm.reset();
    document.getElementById('sensorId').value = '';
}

// Inicializar pestaña de modelos
function initModelTab() {
    logConfig('debug', 'Inicializando pestaña de modelos');
    try {
        // Verificar elementos necesarios
        const modelForm = document.getElementById('modelForm');
        const modelsTable = document.getElementById('modelsTable');
        
        if (!modelForm || !modelsTable) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de modelos');
            return;
        }
        
        // Cargar modelos existentes
        refreshModelsTable();
        
        // Manejar envío del formulario
        modelForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const modelName = document.getElementById('modelName').value;
            const modelDescription = document.getElementById('modelDescription').value;
            const modelFile = document.getElementById('modelFile').files[0];
            const scalerFile = document.getElementById('scalerFile').files[0];
            const modelId = document.getElementById('modelId').value;
            
            logConfig('info', `Enviando formulario de modelo: ${modelName}`);
            
            // Llamar a la función saveModel con los datos del formulario
            saveModel({
                name: modelName,
                description: modelDescription,
                model_file: modelFile,
                scaler_file: scalerFile,
                model_id: modelId
            });
        });
        
        // Configurar botones de cancelar y editar/eliminar
        document.getElementById('cancelModelBtn').addEventListener('click', resetModelForm);
        
        // Inicializar event listeners para los botones de edición y eliminación
        setupModelTableActions();
        
        logConfig('debug', 'Pestaña de modelos inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de modelos', error);
        throw error;
    }
}

// Función para guardar un modelo (creación o actualización)
function saveModel(modelData) {
    // Crear FormData para enviar los archivos
    const formData = new FormData();
    formData.append('name', modelData.name);
    if (modelData.description) formData.append('description', modelData.description);
    if (modelData.model_file) formData.append('model_h5_file', modelData.model_file);
    if (modelData.scaler_file) formData.append('scaler_file', modelData.scaler_file);
    
    // Determinar si es una actualización o creación
    const isUpdate = modelData.model_id !== '';
    const url = isUpdate 
        ? `${API_CONFIG.BASE_URL}/api/models/${modelData.model_id}`
        : `${API_CONFIG.BASE_URL}/api/models`;
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Enviar petición al servidor
    fetch(url, {
        method: method,
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        logConfig('info', `Modelo ${isUpdate ? 'actualizado' : 'creado'} correctamente`);
        showToast(`Modelo ${isUpdate ? 'actualizado' : 'guardado'} correctamente`, 'success');
        
        // Limpiar formulario
        resetModelForm();
        
        // Actualizar la tabla de modelos
        refreshModelsTable();
        
        // Si tenemos WebSockets activos, notificar a otros clientes
        if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'model_update',
                data: { model_id: data.model_id }
            }));
        }
    })
    .catch(error => {
        logConfig('error', 'Error al guardar el modelo', error);
        showToast(`Error al guardar el modelo: ${error.message}`, 'error');
    });
}

// Función para actualizar la tabla de modelos
function refreshModelsTable() {
    logConfig('debug', 'Actualizando tabla de modelos');
    
    const modelsTable = document.getElementById('modelsTable');
    if (!modelsTable) return;
    
    const tbody = modelsTable.querySelector('tbody');
    if (!tbody) return;
    
    // Obtener modelos desde el servidor
    fetch(`${API_CONFIG.BASE_URL}/api/models`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Limpiar tabla
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                // No hay modelos, mostrar fila de "no hay datos"
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="4" class="text-center">No hay modelos configurados</td>`;
                tbody.appendChild(emptyRow);
                return;
            }
            
            // Poblar tabla con datos
            data.forEach(model => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${model.model_id}</td>
                    <td>${model.name || 'Sin nombre'}</td>
                    <td>${model.description || 'Sin descripción'}</td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-icon edit-model" data-id="${model.model_id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon delete-model" data-id="${model.model_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Reinicializar listeners
            setupModelTableActions();
            
            // Actualizar selectores de modelos en los formularios de sensores
            updateModelSelectors(data);
            
            logConfig('debug', `Tabla de modelos actualizada con ${data.length} registros`);
        })
        .catch(error => {
            logConfig('error', 'Error al actualizar tabla de modelos', error);
            showToast(`Error al cargar modelos: ${error.message}`, 'error');
        });
}

// Función para configurar los event listeners de los botones de edición y eliminación
function setupModelTableActions() {
    // Event listeners para botones de edición
    document.querySelectorAll('.edit-model').forEach(button => {
        button.addEventListener('click', function() {
            const modelId = this.getAttribute('data-id');
            logConfig('debug', `Editando modelo con ID: ${modelId}`);
            
            // Cargar datos del modelo
            fetch(`${API_CONFIG.BASE_URL}/api/models/${modelId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(model => {
                    // Llenar formulario con datos del modelo
                    document.getElementById('modelId').value = model.model_id;
                    document.getElementById('modelName').value = model.name || '';
                    document.getElementById('modelDescription').value = model.description || '';
                    
                    // Actualizar etiquetas de archivos
                    document.getElementById('modelFileName').textContent = model.route_h5 ? 'Archivo actual' : 'Ningún archivo seleccionado';
                    document.getElementById('scalerFileName').textContent = model.route_pkl ? 'Archivo actual' : 'Ningún archivo seleccionado';
                    
                    // Cambiar requisitos de archivos para edición
                    document.getElementById('modelFileRequired').style.display = 'none';
                    document.getElementById('modelFileOptional').style.display = 'inline';
                    document.getElementById('scalerFileRequired').style.display = 'none';
                    document.getElementById('scalerFileOptional').style.display = 'inline';
                    
                    // Hacer scroll al formulario
                    document.getElementById('modelForm').scrollIntoView({ behavior: 'smooth' });
                })
                .catch(error => {
                    logConfig('error', `Error al cargar datos del modelo ${modelId}`, error);
                    showToast(`Error al cargar modelo: ${error.message}`, 'error');
                });
        });
    });
    
    // Event listeners para botones de eliminación
    document.querySelectorAll('.delete-model').forEach(button => {
        button.addEventListener('click', function() {
            const modelId = this.getAttribute('data-id');
            if (confirm(`¿Está seguro que desea eliminar el modelo con ID ${modelId}?`)) {
                logConfig('debug', `Eliminando modelo con ID: ${modelId}`);
                
                fetch(`${API_CONFIG.BASE_URL}/api/models/${modelId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    logConfig('info', `Modelo ${modelId} eliminado correctamente`);
                    showToast('Modelo eliminado correctamente', 'success');
                    
                    // Actualizar tabla
                    refreshModelsTable();
                    
                    // Si tenemos WebSockets activos, notificar a otros clientes
                    if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'model_update',
                            data: { model_id: modelId, deleted: true }
                        }));
                    }
                })
                .catch(error => {
                    logConfig('error', `Error al eliminar modelo ${modelId}`, error);
                    showToast(`Error al eliminar modelo: ${error.message}`, 'error');
                });
            }
        });
    });
}

// Función para actualizar los selectores de modelos en los formularios de sensores
function updateModelSelectors(models) {
    const sensorModelSelects = [
        document.getElementById('sensorModel'),
        document.getElementById('sensorModalForm')?.querySelector('#sensorModel')
    ].filter(Boolean);
    
    sensorModelSelects.forEach(select => {
        if (!select) return;
        
        // Guardar el valor seleccionado actualmente
        const currentValue = select.value;
        
        // Limpiar opciones actuales, excepto la primera
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Añadir opciones para cada modelo
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.model_id;
            option.textContent = model.name || `Modelo ${model.model_id}`;
            select.appendChild(option);
        });
        
        // Restaurar valor seleccionado si aún existe
        if (currentValue) {
            const exists = Array.from(select.options).some(option => option.value === currentValue);
            if (exists) {
                select.value = currentValue;
            }
        }
    });
}

// Función para restablecer el formulario de modelos
function resetModelForm() {
    const modelForm = document.getElementById('modelForm');
    if (!modelForm) return;
    
    modelForm.reset();
    document.getElementById('modelId').value = '';
    document.getElementById('modelFileName').textContent = 'Ningún archivo seleccionado';
    document.getElementById('scalerFileName').textContent = 'Ningún archivo seleccionado';
    
    // Restablecer requisitos de archivos para creación
    document.getElementById('modelFileRequired').style.display = 'inline';
    document.getElementById('modelFileOptional').style.display = 'none';
    document.getElementById('scalerFileRequired').style.display = 'inline';
    document.getElementById('scalerFileOptional').style.display = 'none';
}

// Inicializar pestaña de límites
function initLimitsTab() {
    logConfig('debug', 'Inicializando pestaña de límites');
    try {
        // Verificar elementos necesarios
        const limitsForm = document.getElementById('limitsForm');
        
        if (!limitsForm) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de límites');
            return;
        }
        
        // Cargar límites actuales desde el servidor
        fetchVibrationLimits();
        
        // Aquí irá la lógica específica de la pestaña de límites
        logConfig('debug', 'Pestaña de límites inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de límites', error);
        throw error;
    }
}

// Función para obtener los límites de vibración desde el servidor
function fetchVibrationLimits() {
    logConfig('debug', 'Obteniendo límites de vibración desde el servidor');
    
    // Usar la configuración de API para construir la URL
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONFIG}/limits`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener límites: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            logConfig('info', 'Límites de vibración cargados correctamente desde el servidor');
            
            // Actualizar los campos del formulario si existen
            updateLimitsForm(data);
            
            // También podemos almacenar los límites en el estado global para usar en otras partes de la aplicación
            if (typeof setGlobalState === 'function') {
                setGlobalState('vibrationLimits', data);
            }
        })
        .catch(error => {
            logConfig('error', 'Error al obtener límites de vibración', error);
            showToast('error', 'No se pudieron cargar los límites de vibración');
        });
}

// Función para actualizar el formulario con los límites obtenidos
function updateLimitsForm(limits) {
    // Buscar cada campo del formulario y actualizarlo con el valor correspondiente
    const limitsForm = document.getElementById('limitsForm');
    
    if (!limitsForm) return;
    
    // Actualizar campos para el eje X
    if (document.getElementById('x_2inf')) document.getElementById('x_2inf').value = limits.x_2inf || '';
    if (document.getElementById('x_2sup')) document.getElementById('x_2sup').value = limits.x_2sup || '';
    if (document.getElementById('x_3inf')) document.getElementById('x_3inf').value = limits.x_3inf || '';
    if (document.getElementById('x_3sup')) document.getElementById('x_3sup').value = limits.x_3sup || '';
    
    // Actualizar campos para el eje Y
    if (document.getElementById('y_2inf')) document.getElementById('y_2inf').value = limits.y_2inf || '';
    if (document.getElementById('y_2sup')) document.getElementById('y_2sup').value = limits.y_2sup || '';
    if (document.getElementById('y_3inf')) document.getElementById('y_3inf').value = limits.y_3inf || '';
    if (document.getElementById('y_3sup')) document.getElementById('y_3sup').value = limits.y_3sup || '';
    
    // Actualizar campos para el eje Z
    if (document.getElementById('z_2inf')) document.getElementById('z_2inf').value = limits.z_2inf || '';
    if (document.getElementById('z_2sup')) document.getElementById('z_2sup').value = limits.z_2sup || '';
    if (document.getElementById('z_3inf')) document.getElementById('z_3inf').value = limits.z_3inf || '';
    if (document.getElementById('z_3sup')) document.getElementById('z_3sup').value = limits.z_3sup || '';
}

// Exportar funciones para uso global
window.initConfig = initConfig;
window.initConfigTabs = initConfigTabs;
window.initMachineTab = initMachineTab;
window.initSensorTab = initSensorTab;
window.initModelTab = initModelTab;
window.initLimitsTab = initLimitsTab;
window.fetchVibrationLimits = fetchVibrationLimits;

// Exportar funciones de actualización de tablas
window.refreshMachinesTable = refreshMachinesTable;
window.refreshSensorsTable = refreshSensorsTable;
window.refreshModelsTable = refreshModelsTable;
window.loadMachinesTable = refreshMachinesTable;
window.loadSensorsTable = refreshSensorsTable;
window.loadModelsTable = refreshModelsTable;

// Exportar funciones de actualización de selectores
window.updateMachineSensorSelectors = updateMachineSensorSelectors;
window.updateModelSelectors = updateModelSelectors;
window.setupSensorTableActions = setupSensorTableActions;
window.setupMachineTableActions = setupMachineTableActions;
window.setupModelTableActions = setupModelTableActions; 