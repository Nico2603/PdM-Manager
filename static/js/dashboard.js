/**
 * PdM-Manager - JavaScript Dashboard v1.0.0
 * Funciones específicas para el dashboard principal
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// VARIABLES GLOBALES DEL DASHBOARD
// ==========================================================================

// Mantener referencias a las selecciones actuales (ahora gestionadas por globalState)
// Estas referencias se eliminan y se usan las funciones de utils.js para acceder a los valores

// ==========================================================================
// INICIALIZACIÓN DEL DASHBOARD
// ==========================================================================

// Inicializar el dashboard
function initDashboard() {
    console.log('Inicializando dashboard...');
    
    // Inicializar componentes de UI personalizados
    initCustomUIComponents();
    
    // Inicializar filtros visuales
    initVisualFilters();
    
    // Inicializar gráficos
    if (typeof initVibrationChart === 'function') {
        initVibrationChart();
    }
    
    if (typeof initAlertsHistoryChart === 'function') {
        initAlertsHistoryChart();
    }
    
    // Inicializar botones de exportación
    initExportButton();
    
    // Inicializar botones de ajuste de límites
    initAdjustLimitsButton();
    
    // Comprobar estado de simulación
    checkSimulationStatus();
    
    // Cargar datos iniciales
    loadInitialData();
    
    // Configurar escucha para cambios de estado global
    document.addEventListener('globalStateChange', handleGlobalStateChange);
}

// Manejar cambios en el estado global
function handleGlobalStateChange(e) {
    const { key, value } = e.detail;
    
    // Actualizaciones basadas en cambios específicos
    if (key === 'selectedMachine' || key === 'selectedSensor' || key === 'timeRange') {
        updateDashboardData();
    } else if (key === 'stats') {
        updateStatisticalDisplayValues();
    } else if (key === 'simulation') {
        if (value.running) {
            startSimulationUpdates();
        } else {
            stopSimulationUpdates();
        }
    }
}

// Inicializar componentes de UI personalizados
function initCustomUIComponents() {
    // Inicializar dropdowns personalizados
    initCustomDropdowns();
    
    // Inicializar colapso de filtros
    initCollapseFilters();
    
    // Inicializar botones de descarga de gráficos
    if (typeof initChartDownloadButtons === 'function') {
        initChartDownloadButtons();
    }
}

// Inicializar dropdowns personalizados
function initCustomDropdowns() {
    // Suscribirse al evento de cambio de dropdown
    document.addEventListener('dropdown-change', (e) => {
        const { dropdownId, value } = e.detail;
        handleDropdownChange(dropdownId, value);
    });
    
    // Obtener elementos de los dropdowns
    const machineDropdown = document.getElementById('machineDropdown');
    const sensorDropdown = document.getElementById('sensorDropdown');
    const timeRangeDropdown = document.getElementById('timeRangeDropdown');
    
    if (machineDropdown && sensorDropdown && timeRangeDropdown) {
        // Suscribirse a eventos de clic en los dropdowns para móviles
        // (complementario a la inicialización general de dropdowns)
        const machineToggle = machineDropdown.querySelector('.filter-dropdown-toggle');
        const sensorToggle = sensorDropdown.querySelector('.filter-dropdown-toggle');
        const timeRangeToggle = timeRangeDropdown.querySelector('.filter-dropdown-toggle');
        
        if (machineToggle && sensorToggle && timeRangeToggle) {
            // La lógica de toggle ya se maneja en initDropdowns de utils.js
        }
    }
}

// Manejar cambio en dropdown
function handleDropdownChange(dropdownId, value) {
    switch (dropdownId) {
        case 'machineDropdown':
            setGlobalState('selectedMachine', value);
            // Actualizar lista de sensores si cambia la máquina
            loadSensors(value);
            break;
        case 'sensorDropdown':
            setGlobalState('selectedSensor', value);
            break;
        case 'timeRangeDropdown':
            setGlobalState('timeRange', value);
            break;
    }
}

// Inicializar colapso de filtros
function initCollapseFilters() {
    const expandBtn = document.getElementById('expandFiltersBtn');
    const filterPanel = document.querySelector('.filter-panel');
    
    if (expandBtn && filterPanel) {
        expandBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('show');
            
            // Cambiar icono
            const icon = expandBtn.querySelector('i');
            if (icon) {
                if (filterPanel.classList.contains('show')) {
                    icon.className = 'fas fa-chevron-up';
                } else {
                    icon.className = 'fas fa-chevron-down';
                }
            }
        });
    }
}

// Inicializar filtros visuales
function initVisualFilters() {
    // Inicializar switches de visualización
    const showMeanSwitch = document.getElementById('showMean');
    const show1SigmaSwitch = document.getElementById('show1Sigma');
    const show2SigmaSwitch = document.getElementById('show2Sigma');
    const show3SigmaSwitch = document.getElementById('show3Sigma');
    
    if (showMeanSwitch && show1SigmaSwitch && show2SigmaSwitch && show3SigmaSwitch) {
        // Configurar evento de cambio para actualizar visualización
        [showMeanSwitch, show1SigmaSwitch, show2SigmaSwitch, show3SigmaSwitch].forEach(switchEl => {
            switchEl.addEventListener('change', () => {
                if (typeof updateChartsVisibility === 'function') {
                    updateChartsVisibility();
                }
            });
        });
    }
}

// ==========================================================================
// CARGA Y ACTUALIZACIÓN DE DATOS
// ==========================================================================

// Cargar datos iniciales
function loadInitialData() {
    showLoadingIndicator('Cargando datos iniciales...');
    
    // Cargar máquinas primero
    loadMachines()
        .then(() => {
            // Comprobar si hay una configuración válida
            if (cache.machines && cache.machines.length === 0) {
                hideLoadingIndicator();
                showNoConfigurationMessage();
                return Promise.reject('No hay máquinas configuradas');
            }
            
            // Cargar sensores para la máquina seleccionada (o primera máquina)
            return loadSensors(getGlobalState('selectedMachine'));
        })
        .then(() => {
            // Actualizar datos del dashboard
            return updateDashboardData();
        })
        .catch(error => {
            console.error('Error al cargar datos iniciales:', error);
            if (error !== 'No hay máquinas configuradas') {
                showToast('Error al cargar datos iniciales', 'error');
            }
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Mostrar mensaje de no configuración
function showNoConfigurationMessage() {
    const dashboardSection = document.getElementById('dashboard-section');
    if (!dashboardSection) return;
    
    // Crear mensaje 
    const noConfigMessage = document.createElement('div');
    noConfigMessage.className = 'no-config-message animate-fade-in';
    noConfigMessage.innerHTML = `
        <div class="message-icon">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>No hay configuración inicial</h3>
        <p>No se encontraron máquinas configuradas en el sistema. Por favor, configure al menos una máquina y un sensor para comenzar a monitorear.</p>
        <button class="btn btn-primary" id="goToConfigBtn">
            <i class="fas fa-cog mr-2"></i>
            Ir a Configuración
        </button>
    `;
    
    // Reemplazar el contenido
    dashboardSection.querySelector('.dashboard-grid')?.remove();
    dashboardSection.querySelector('.alert-cards-grid')?.remove();
    
    // Añadir el mensaje después del encabezado de sección
    const sectionHeader = dashboardSection.querySelector('.section-header');
    if (sectionHeader) {
        sectionHeader.after(noConfigMessage);
    } else {
        dashboardSection.appendChild(noConfigMessage);
    }
    
    // Configurar evento para ir a configuración
    const configBtn = document.getElementById('goToConfigBtn');
    if (configBtn) {
        configBtn.addEventListener('click', () => {
            if (typeof navigateTo === 'function') {
                navigateTo('configuracion');
            }
        });
    }
}

// Cargar lista de máquinas
function loadMachines() {
    return fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            // Guardar en caché
            cache.machines = machines;
            
            // Obtener el dropdown de máquinas
            const machineDropdownMenu = document.getElementById('machineDropdownMenu');
            if (!machineDropdownMenu) return;
            
            // Limpiar opciones anteriores, manteniendo la opción "Todas"
            const allOption = machineDropdownMenu.querySelector('.filter-dropdown-item[data-value=""]');
            machineDropdownMenu.innerHTML = '';
            
            if (allOption) {
                machineDropdownMenu.appendChild(allOption);
            } else {
                const newAllOption = document.createElement('div');
                newAllOption.className = 'filter-dropdown-item selected';
                newAllOption.setAttribute('data-value', '');
                newAllOption.textContent = 'Todas las máquinas';
                machineDropdownMenu.appendChild(newAllOption);
            }
            
            // Añadir máquinas al dropdown
            machines.forEach(machine => {
                const option = document.createElement('div');
                option.className = 'filter-dropdown-item';
                option.setAttribute('data-value', machine.machine_id);
                option.textContent = machine.name;
                machineDropdownMenu.appendChild(option);
            });
            
            // Si hay máquinas y no hay selección previa, seleccionar la primera
            if (machines.length > 0 && !getGlobalState('selectedMachine')) {
                setGlobalState('selectedMachine', machines[0].machine_id);
                
                // Actualizar texto del dropdown
                const machineDropdownText = document.getElementById('selectedMachineText');
                if (machineDropdownText) {
                    machineDropdownText.textContent = machines[0].name;
                }
            }
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
            return Promise.reject(error);
        });
}

// Cargar sensores para una máquina
function loadSensors(machineId) {
    // Si no hay máquina seleccionada y hay máquinas disponibles, seleccionar la primera
    if (!machineId && cache.machines && cache.machines.length > 0) {
        machineId = cache.machines[0].machine_id;
        setGlobalState('selectedMachine', machineId);
    }
    
    // Si no hay máquina, detener
    if (!machineId) {
        return Promise.resolve([]);
    }
    
    // Si ya tenemos los sensores en caché, usarlos
    if (cache.sensors[machineId]) {
        updateSensorDropdown(cache.sensors[machineId]);
        return Promise.resolve(cache.sensors[machineId]);
    }
    
    // Obtener sensores de la API
    return fetch(`/api/machines/${machineId}/sensors`)
        .then(response => response.json())
        .then(sensors => {
            // Guardar en caché
            cache.sensors[machineId] = sensors;
            
            // Actualizar dropdown
            updateSensorDropdown(sensors);
            
            return sensors;
        });
}

// Actualizar dropdown de sensores
function updateSensorDropdown(sensors) {
    // Obtener el dropdown de sensores
    const sensorDropdownMenu = document.getElementById('sensorDropdownMenu');
    const sensorDropdownText = document.getElementById('selectedSensorText');
    
    if (!sensorDropdownMenu || !sensorDropdownText) return;
    
    // Limpiar opciones anteriores
    sensorDropdownMenu.innerHTML = '';
    
    // Si no hay sensores, mostrar mensaje
    if (!sensors || sensors.length === 0) {
        const noSensorsItem = document.createElement('li');
        noSensorsItem.className = 'filter-dropdown-item disabled';
        noSensorsItem.textContent = 'No hay sensores disponibles';
        sensorDropdownMenu.appendChild(noSensorsItem);
        
        sensorDropdownText.textContent = 'Sin sensores';
        setGlobalState('selectedSensor', '');
        return;
    }
    
    // Añadir sensores al dropdown
    sensors.forEach(sensor => {
        const sensorItem = document.createElement('li');
        sensorItem.className = 'filter-dropdown-item';
        sensorItem.dataset.value = sensor.sensor_id;
        sensorItem.textContent = sensor.sensor_name;
        
        sensorItem.addEventListener('click', () => {
            // Actualizar texto visible
            sensorDropdownText.textContent = sensor.sensor_name;
            
            // Cerrar dropdown
            sensorDropdownMenu.classList.remove('show');
            
            // Actualizar variable global
            setGlobalState('selectedSensor', sensor.sensor_id);
        });
        
        sensorDropdownMenu.appendChild(sensorItem);
    });
    
    // Seleccionar el primer sensor si no hay uno seleccionado o si el seleccionado no existe
    const selectedSensor = getGlobalState('selectedSensor');
    const sensorExists = sensors.some(s => s.sensor_id === selectedSensor);
    
    if (!selectedSensor || !sensorExists) {
        // Seleccionar el primer sensor
        const firstSensor = sensors[0];
        setGlobalState('selectedSensor', firstSensor.sensor_id);
        sensorDropdownText.textContent = firstSensor.sensor_name;
    } else {
        // Mantener la selección actual y actualizar el texto
        const sensor = sensors.find(s => s.sensor_id === selectedSensor);
        sensorDropdownText.textContent = sensor.sensor_name;
    }
}

// Actualizar datos del dashboard
function updateDashboardData() {
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    if (!selectedMachine || !selectedSensor) {
        return Promise.resolve();
    }
    
    showLoadingToast('Actualizando datos del dashboard...');
    
    // Calcular rango de tiempo
    let startTime;
    const endTime = new Date();
    
    switch (timeRange) {
        case '1h':
            startTime = new Date(endTime - 60 * 60 * 1000);
            break;
        case '6h':
            startTime = new Date(endTime - 6 * 60 * 60 * 1000);
            break;
        case '12h':
            startTime = new Date(endTime - 12 * 60 * 60 * 1000);
            break;
        case '24h':
        default:
            startTime = new Date(endTime - 24 * 60 * 60 * 1000);
            break;
    }
    
    // Formatear fechas
    const startTimeStr = startTime.toISOString();
    const endTimeStr = endTime.toISOString();
    
    // Obtener datos de vibración y alertas
    return Promise.all([
        fetch(`/api/machines/${selectedMachine}/sensors/${selectedSensor}/data?start=${startTimeStr}&end=${endTimeStr}`),
        fetch(`/api/machines/${selectedMachine}/sensors/${selectedSensor}/alerts?start=${startTimeStr}&end=${endTimeStr}`)
    ])
    .then(([dataResponse, alertsResponse]) => Promise.all([
        dataResponse.json(),
        alertsResponse.json()
    ]))
    .then(([data, alerts]) => {
        // Actualizar gráficos si están disponibles
        if (typeof updateVibrationChartX === 'function' && 
            typeof updateVibrationChartY === 'function' && 
            typeof updateVibrationChartZ === 'function') {
            
            // Actualizar datos de gráficos
            chartData.timestamps = data.map(item => new Date(item.timestamp).toLocaleTimeString());
            chartData.x = data.map(item => item.x);
            chartData.y = data.map(item => item.y);
            chartData.z = data.map(item => item.z);
            chartData.status = data.map(item => item.status);
            
            // Actualizar gráficos
            updateVibrationChartX();
            updateVibrationChartY();
            updateVibrationChartZ();
        }
        
        // Actualizar contadores de alertas
        updateAlertCounters(alerts);
        
        // Actualizar valores estadísticos mostrados
        updateStatisticalDisplayValues();
        
        // Actualizar datos de gráfico de historial de alertas
        if (typeof fetchAlertsHistoryData === 'function') {
            fetchAlertsHistoryData();
        }
        
        // Actualizar hora de última actualización
        updateLastUpdateTime();
        
        return {data, alerts};
    })
    .catch(error => {
        console.error('Error al actualizar datos del dashboard:', error);
        showToast('Error al actualizar datos', 'error');
    })
    .finally(() => {
        hideLoadingToast();
    });
}

// ==========================================================================
// CONTADORES Y VALORES ESTADÍSTICOS
// ==========================================================================

// Actualizar contadores de alertas
function updateAlertCounters(alerts) {
    // Actualizar contadores en las tarjetas de alerta
    document.getElementById('level1Count').textContent = alerts.level1 || 0;
    document.getElementById('level2Count').textContent = alerts.level2 || 0;
    document.getElementById('level3Count').textContent = alerts.level3 || 0;
    document.getElementById('totalCount').textContent = 
        (alerts.level1 || 0) + (alerts.level2 || 0) + (alerts.level3 || 0);
}

// Actualizar valores estadísticos mostrados
function updateStatisticalDisplayValues() {
    const machine = cache.machines.find(m => m.machine_id === getGlobalState('selectedMachine'));
    const sensors = cache.sensors[getGlobalState('selectedMachine')] || [];
    const sensor = sensors.find(s => s.sensor_id === getGlobalState('selectedSensor'));
    
    if (!machine || !sensor) return;
    
    // Obtener los límites
    const stats = getGlobalState('stats');
    
    // Actualizar texto de valores estadísticos
    document.querySelectorAll('.stat-value').forEach(element => {
        const axis = element.dataset.axis;
        const type = element.dataset.type;
        
        if (axis && type && stats[axis] && stats[axis][type]) {
            if (element.dataset.bound === 'upper') {
                element.textContent = stats[axis][type].upper.toFixed(3);
            } else if (element.dataset.bound === 'lower') {
                element.textContent = stats[axis][type].lower.toFixed(3);
            }
        }
    });
}

// ==========================================================================
// BOTONES Y ACCIONES
// ==========================================================================

// Inicializar botón de exportación
function initExportButton() {
    const exportBtn = document.getElementById('exportDataBtn');
    if (!exportBtn) return;
    
    exportBtn.addEventListener('click', () => {
        exportToPDF();
    });
}

// Exportar dashboard a PDF
function exportToPDF() {
    showLoadingToast('Preparando exportación a PDF...');
    
    // Obtener título según selecciones
    let title = 'Reporte de Vibración';
    if (getGlobalState('selectedMachine') && cache.machines) {
        const machine = cache.machines.find(m => m.machine_id === getGlobalState('selectedMachine'));
        if (machine) title += ` - ${machine.name}`;
    }
    
    if (getGlobalState('selectedSensor') && cache.sensors[getGlobalState('selectedMachine')]) {
        const sensor = cache.sensors[getGlobalState('selectedMachine')].find(s => s.sensor_id === getGlobalState('selectedSensor'));
        if (sensor) title += ` - ${sensor.name}`;
    }
    
    // Preparar datos para reporte
    const reportData = {
        title: title,
        date: new Date().toLocaleDateString(),
        charts: [
            {
                id: 'vibrationChartX',
                title: 'Vibración Eje X'
            },
            {
                id: 'vibrationChartY',
                title: 'Vibración Eje Y'
            },
            {
                id: 'vibrationChartZ',
                title: 'Vibración Eje Z'
            }
        ],
        alertsSummary: {
            level1: parseInt(document.getElementById('level1Count').textContent) || 0,
            level2: parseInt(document.getElementById('level2Count').textContent) || 0,
            level3: parseInt(document.getElementById('level3Count').textContent) || 0
        }
    };
    
    // Simular generación de PDF (reemplazar con biblioteca real)
    setTimeout(() => {
        hideLoadingToast();
        showToast('Exportación a PDF completada', 'success');
        console.log('Datos para exportar:', reportData);
    }, 1500);
}

// Inicializar botón de ajuste de límites
function initAdjustLimitsButton() {
    const adjustBtn = document.getElementById('adjustLimitsBtn');
    if (!adjustBtn) return;
    
    adjustBtn.addEventListener('click', () => {
        if (typeof openAdjustLimitsModal === 'function') {
            openAdjustLimitsModal();
        }
    });
}

// ==========================================================================
// SIMULACIÓN (PARA ACTUALIZACIÓN AUTOMÁTICA)
// ==========================================================================

// Comprobar estado de simulación
function checkSimulationStatus() {
    fetch('/api/simulation/status')
        .then(response => response.json())
        .then(data => {
            if (data.running) {
                // Actualizar estado global
                setGlobalState('simulation', {
                    running: true,
                    timer: getGlobalState('simulation').timer
                });
            }
        })
        .catch(error => {
            console.error('Error al comprobar estado de simulación:', error);
        });
}

// Iniciar actualizaciones automáticas por simulación
function startSimulationUpdates() {
    // Establecer un temporizador para actualizar cada 10 segundos
    const timer = setInterval(() => {
        updateDashboardData();
    }, 10000);
    
    // Guardar el temporizador
    setGlobalState('simulation', {
        running: true,
        timer: timer
    });
}

// Detener actualizaciones automáticas por simulación
function stopSimulationUpdates() {
    const simulation = getGlobalState('simulation');
    
    // Detener el temporizador si existe
    if (simulation.timer) {
        clearInterval(simulation.timer);
    }
    
    // Actualizar estado
    setGlobalState('simulation', {
        running: false,
        timer: null
    });
}

// Exportar funciones para uso global
window.initDashboard = initDashboard;
window.updateDashboardData = updateDashboardData;
window.initCustomUIComponents = initCustomUIComponents;
window.initVisualFilters = initVisualFilters;
window.exportToPDF = exportToPDF; 