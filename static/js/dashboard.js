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
    
    // Inicializar gráficos (pero no mostrarlos todavía)
    if (typeof initVibrationChart === 'function') {
        initVibrationChart();
    }
    
    if (typeof initAlertsHistoryChart === 'function') {
        initAlertsHistoryChart();
    }
    
    // Ocultar gráficos hasta que se apliquen filtros
    hideCharts();
    
    // Inicializar botones de exportación individuales
    initExportButtons();
    
    // Inicializar botón de aplicar filtros
    initApplyFiltersButton();
    
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
    const show2SigmaSwitch = document.getElementById('show2Sigma');
    const show3SigmaSwitch = document.getElementById('show3Sigma');
    
    if (show2SigmaSwitch && show3SigmaSwitch) {
        // Configurar evento de cambio para actualizar visualización
        [show2SigmaSwitch, show3SigmaSwitch].forEach(switchEl => {
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
    // Verificar que se han seleccionado machine y sensor
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange') || '24h';
    
    if (!selectedMachine || !selectedSensor) {
        console.warn('No se ha seleccionado máquina o sensor');
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
        // Verificar que hay datos
        if (data && data.length > 0) {
            console.log('Datos recibidos para actualizar gráficos:', data.length);
            
            // Actualizar datos de gráficos
            chartData.timestamps = data.map(item => new Date(item.timestamp).toLocaleTimeString());
            
            // Asegurar que cada gráfica utiliza sus datos específicos del eje
            chartData.x = data.map(item => parseFloat(item.x) || null);  // Datos específicos del eje X
            chartData.y = data.map(item => parseFloat(item.y) || null);  // Datos específicos del eje Y
            chartData.z = data.map(item => parseFloat(item.z) || null);  // Datos específicos del eje Z
            chartData.status = data.map(item => item.status || 0);  // Usar 0 (normal) si no hay status
            
            // Actualizar gráficos si están disponibles
            if (typeof updateVibrationChartX === 'function') updateVibrationChartX();
            if (typeof updateVibrationChartY === 'function') updateVibrationChartY();
            if (typeof updateVibrationChartZ === 'function') updateVibrationChartZ();
        } else {
            console.warn('No hay datos para actualizar gráficos');
        }
        
        // Actualizar contadores de alertas
        updateAlertCounters(alerts);
        
        // Actualizar valores estadísticos mostrados
        updateStatisticalDisplayValues();
        
        // Actualizar datos de gráfico de historial de alertas
        if (typeof fetchAlertsHistoryData === 'function') {
            fetchAlertsHistoryData();
        }
        
        // Cargar datos de tabla de alertas simplificada
        loadSimplifiedAlerts();
        
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

// Actualizar valores de parámetros estadísticos
function updateStatisticalDisplayValues() {
    // Obtener valores actuales del localStorage o usar valores predeterminados
    const limits = JSON.parse(localStorage.getItem('limitConfig')) || {
        x_2sigma_lower: -2.36,
        x_2sigma_upper: 2.18,
        x_3sigma_lower: -3.50,
        x_3sigma_upper: 3.32,
        y_2sigma_lower: 7.18,
        y_2sigma_upper: 12.09,
        y_3sigma_lower: 5.95,
        y_3sigma_upper: 13.32,
        z_2sigma_lower: -2.39,
        z_2sigma_upper: 1.11,
        z_3sigma_lower: -3.26,
        z_3sigma_upper: 1.98
    };
    
    // Actualizar elementos del DOM
    // Eje X
    document.getElementById('x2SigmaLowerDisplay').innerHTML = 
        limits.x_2sigma_lower.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('x2SigmaUpperDisplay').innerHTML = 
        limits.x_2sigma_upper.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('x3SigmaLowerDisplay').innerHTML = 
        limits.x_3sigma_lower.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('x3SigmaUpperDisplay').innerHTML = 
        limits.x_3sigma_upper.toFixed(2) + '<span class="stat-unit">m/s²</span>';
        
    // Eje Y
    document.getElementById('y2SigmaLowerDisplay').innerHTML = 
        limits.y_2sigma_lower.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('y2SigmaUpperDisplay').innerHTML = 
        limits.y_2sigma_upper.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('y3SigmaLowerDisplay').innerHTML = 
        limits.y_3sigma_lower.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('y3SigmaUpperDisplay').innerHTML = 
        limits.y_3sigma_upper.toFixed(2) + '<span class="stat-unit">m/s²</span>';
        
    // Eje Z
    document.getElementById('z2SigmaLowerDisplay').innerHTML = 
        limits.z_2sigma_lower.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('z2SigmaUpperDisplay').innerHTML = 
        limits.z_2sigma_upper.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('z3SigmaLowerDisplay').innerHTML = 
        limits.z_3sigma_lower.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    document.getElementById('z3SigmaUpperDisplay').innerHTML = 
        limits.z_3sigma_upper.toFixed(2) + '<span class="stat-unit">m/s²</span>';
    
    // Añadir animación para destacar cambios
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => {
        el.classList.add('value-updated');
        setTimeout(() => {
            el.classList.remove('value-updated');
        }, 1000);
    });
}

// ==========================================================================
// BOTONES Y ACCIONES
// ==========================================================================

// Inicializar botón de exportación individuales para cada eje
function initExportButtons() {
    // Botón de exportación para eje X
    const exportPdfXBtn = document.getElementById('exportPdfX');
    if (exportPdfXBtn) {
        exportPdfXBtn.addEventListener('click', () => {
            exportAxisToPDF('X');
        });
    }
    
    // Botón de exportación para eje Y
    const exportPdfYBtn = document.getElementById('exportPdfY');
    if (exportPdfYBtn) {
        exportPdfYBtn.addEventListener('click', () => {
            exportAxisToPDF('Y');
        });
    }
    
    // Botón de exportación para eje Z
    const exportPdfZBtn = document.getElementById('exportPdfZ');
    if (exportPdfZBtn) {
        exportPdfZBtn.addEventListener('click', () => {
            exportAxisToPDF('Z');
        });
    }
}

// Exportar a PDF un eje específico
function exportAxisToPDF(axis) {
    showLoadingToast('Preparando exportación a PDF...');
    
    // Obtener título según selecciones
    let title = `Reporte de Vibración - Eje ${axis}`;
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
                id: `vibrationChart${axis}`,
                title: `Vibración Eje ${axis}`
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

// Inicializar botón de aplicar filtros
function initApplyFiltersButton() {
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (!applyFiltersBtn) return;
    
    applyFiltersBtn.addEventListener('click', () => {
        // Mostrar indicador de carga
        showLoadingToast('Aplicando filtros y cargando datos...');
        
        // Actualizar datos del dashboard con los filtros seleccionados
        updateDashboardData()
            .then(() => {
                // Mostrar gráficos
                showCharts();
                // Actualizar contadores de alertas
                updateDashboardAlertCounts();
                // Ocultar indicador de carga
                hideLoadingToast();
                // Mostrar mensaje de éxito
                showToast('Filtros aplicados correctamente', 'success');
            })
            .catch(error => {
                hideLoadingToast();
                showToast('Error al aplicar filtros', 'error');
                console.error('Error al aplicar filtros:', error);
            });
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

// ==========================================================================
// TABLA DE ALERTAS SIMPLIFICADA
// ==========================================================================

// Cargar alertas simplificadas
function loadSimplifiedAlerts() {
    fetch('/api/alerts/simplified')
        .then(response => response.json())
        .then(data => {
            updateAlertsTable(data);
        })
        .catch(error => {
            console.error('Error al cargar alertas simplificadas:', error);
        });
}

// Actualizar tabla de alertas
function updateAlertsTable(alerts) {
    const tableBody = document.getElementById('alertsTableBody');
    if (!tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    // Si no hay alertas, mostrar mensaje
    if (!alerts || alerts.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = 'No hay alertas registradas';
        cell.className = 'text-center';
        return;
    }
    
    // Agregar filas de alertas (máximo 10)
    const alertsToShow = alerts.slice(0, 10);
    for (const alert of alertsToShow) {
        const row = tableBody.insertRow();
        
        // Determinar el nivel de alerta y aplicar clase
        let alertLevel = 1;
        if (alert.error_type.includes('Nivel 3') || alert.error_type.includes('Level 3') || alert.error_type.includes('Crítico')) {
            alertLevel = 3;
            row.classList.add('level-3');
        } else if (alert.error_type.includes('Nivel 2') || alert.error_type.includes('Level 2')) {
            alertLevel = 2;
            row.classList.add('level-2');
        } else {
            row.classList.add('level-1');
        }
        
        // ID
        const idCell = row.insertCell();
        idCell.textContent = alert.log_id;
        idCell.className = 'column-id';
        
        // Sensor ID
        const sensorCell = row.insertCell();
        sensorCell.textContent = alert.sensor_id;
        
        // Fecha y hora
        const timestampCell = row.insertCell();
        const date = new Date(alert.timestamp);
        timestampCell.textContent = date.toLocaleString();
        timestampCell.className = 'column-datetime';
        
        // Tipo de error
        const errorTypeCell = row.insertCell();
        errorTypeCell.textContent = alert.error_type;
    }
    
    // Inicializar el botón de actualizar
    const refreshBtn = document.getElementById('refreshAlertsTable');
    if (refreshBtn) {
        refreshBtn.removeEventListener('click', loadSimplifiedAlerts);
        refreshBtn.addEventListener('click', loadSimplifiedAlerts);
    }
}

// Cargar datos de vibración
function loadVibrationData(page = 1, filters = {}) {
    // Construir URL para la API
    let url = `/api/vibration-data?limit=10&page=${page}`;
    
    // Añadir filtros si existen
    if (filters.sensor_id) {
        url += `&sensor_id=${filters.sensor_id}`;
    }
    
    if (filters.severity) {
        url += `&severity=${filters.severity}`;
    }
    
    if (filters.date) {
        url += `&date=${filters.date}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Actualizar tabla
            const tableBody = document.getElementById('vibrationDataTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            // Si no hay datos, mostrar mensaje
            if (!data.records || data.records.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center">No hay datos de vibración registrados</td>
                    </tr>
                `;
                // Actualizar paginación
                document.getElementById('vibrationDataPageInfo').textContent = 'Página 1 de 1';
                return;
            }
            
            // Mostrar datos
            data.records.forEach(record => {
                const row = document.createElement('tr');
                
                // Añadir clase según severidad
                if (record.severity === 3) {
                    row.classList.add('row-level-3');
                } else if (record.severity === 2) {
                    row.classList.add('row-level-2');
                } else if (record.severity === 1) {
                    row.classList.add('row-level-1');
                }
                
                // Formatear fecha
                const date = new Date(record.date);
                const formattedDate = date.toLocaleDateString() + ' ' + 
                                     date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Formatear aceleraciones
                const accelX = parseFloat(record.acceleration_x).toFixed(4);
                const accelY = parseFloat(record.acceleration_y).toFixed(4);
                const accelZ = parseFloat(record.acceleration_z).toFixed(4);
                
                // Calcular magnitud (si no existe)
                const magnitude = record.magnitude ? 
                    parseFloat(record.magnitude).toFixed(4) : 
                    parseFloat(Math.sqrt(Math.pow(record.acceleration_x, 2) + 
                                        Math.pow(record.acceleration_y, 2) + 
                                        Math.pow(record.acceleration_z, 2))).toFixed(4);
                
                // Formatear severidad
                const severityText = getSeverityText(record.severity);
                const severityClass = record.severity === 3 ? 'badge-danger' : 
                                     record.severity === 2 ? 'badge-warning' : 
                                     record.severity === 1 ? 'badge-info' : 'badge-secondary';
                
                row.innerHTML = `
                    <td class="column-id">${record.data_id}</td>
                    <td>${record.sensor_id}</td>
                    <td>${formattedDate}</td>
                    <td>${accelX} m/s²</td>
                    <td>${accelY} m/s²</td>
                    <td>${accelZ} m/s²</td>
                    <td><span class="badge ${severityClass}">${severityText}</span></td>
                    <td>${magnitude} m/s²</td>
                    <td class="column-actions">
                        <div class="table-actions">
                            <button class="btn-icon btn-view" title="Ver detalles" data-id="${record.data_id}">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Actualizar paginación
            document.getElementById('vibrationDataPageInfo').textContent = `Página ${data.page} de ${data.total_pages}`;
            
            // Configurar botones de vista detallada
            const viewButtons = tableBody.querySelectorAll('.btn-view');
            viewButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const dataId = button.getAttribute('data-id');
                    viewVibrationDetails(dataId);
                });
            });
        })
        .catch(error => {
            console.error('Error al cargar datos de vibración:', error);
            showToast('Error al cargar datos de vibración', 'error');
        });
}

// Cargar alertas con todos los campos
function loadAlerts() {
    fetch('/api/alerts')
        .then(response => response.json())
        .then(alerts => {
            const tableBody = document.getElementById('alertsTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (alerts.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center">No hay alertas registradas</td>
                    </tr>
                `;
                return;
            }
            
            alerts.forEach(alert => {
                const row = document.createElement('tr');
                
                // Añadir clase según severidad
                if (alert.severity === 3) {
                    row.classList.add('row-level-3');
                } else if (alert.severity === 2) {
                    row.classList.add('row-level-2');
                } else if (alert.severity === 1) {
                    row.classList.add('row-level-1');
                }
                
                // Formatear fecha
                const timestamp = new Date(alert.timestamp);
                const formattedDate = timestamp.toLocaleDateString() + ' ' + 
                                     timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Obtener clase CSS e icono según severidad
                let severityClass = '';
                let severityIcon = '';
                let severityText = '';
                
                switch (alert.severity) {
                    case 3:
                        severityClass = 'badge-danger';
                        severityIcon = 'fa-exclamation-circle';
                        severityText = 'Nivel 3';
                        break;
                    case 2:
                        severityClass = 'badge-warning';
                        severityIcon = 'fa-exclamation-triangle';
                        severityText = 'Nivel 2';
                        break;
                    case 1:
                        severityClass = 'badge-info';
                        severityIcon = 'fa-info-circle';
                        severityText = 'Nivel 1';
                        break;
                    default:
                        severityClass = 'badge-secondary';
                        severityIcon = 'fa-question-circle';
                        severityText = 'Desconocido';
                }
                
                // Formatear datos de vibración
                const vibrationDataIdDisplay = alert.vibration_data_id ? 
                    `<a href="#" class="view-vibration-data" data-id="${alert.vibration_data_id}">${alert.vibration_data_id}</a>` : 
                    '-';
                
                // Formatear estado de reconocimiento
                const acknowledgedStatus = alert.acknowledged ? 
                    '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>Reconocida</span>' : 
                    '<span class="badge badge-secondary"><i class="fas fa-clock mr-1"></i>Pendiente</span>';
                
                row.innerHTML = `
                    <td class="column-id">${alert.log_id}</td>
                    <td>${alert.sensor_id}</td>
                    <td>${formattedDate}</td>
                    <td>${alert.error_type}</td>
                    <td><span class="badge ${severityClass}"><i class="fas ${severityIcon} mr-1"></i>${severityText}</span></td>
                    <td><span class="text-truncate" title="${alert.message || ''}">${alert.message || '-'}</span></td>
                    <td>${vibrationDataIdDisplay}</td>
                    <td>${acknowledgedStatus}</td>
                    <td class="column-actions">
                        <div class="table-actions">
                            <button class="btn-icon btn-view-alert" title="Ver detalles" data-id="${alert.log_id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${!alert.acknowledged ? 
                              `<button class="btn-icon btn-acknowledge" title="Reconocer alerta" data-id="${alert.log_id}">
                                <i class="fas fa-check"></i>
                               </button>` : ''}
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Configurar eventos para botones y enlaces
            const viewButtons = tableBody.querySelectorAll('.btn-view-alert');
            viewButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const alertId = button.getAttribute('data-id');
                    viewAlertDetails(alertId);
                });
            });
            
            const acknowledgeButtons = tableBody.querySelectorAll('.btn-acknowledge');
            acknowledgeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const alertId = button.getAttribute('data-id');
                    acknowledgeAlert(alertId);
                });
            });
            
            const vibrationLinks = tableBody.querySelectorAll('.view-vibration-data');
            vibrationLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const dataId = link.getAttribute('data-id');
                    viewVibrationDetails(dataId);
                });
            });
        })
        .catch(error => {
            console.error('Error al cargar alertas:', error);
            showToast('Error al cargar alertas', 'error');
        });
}

// Ver detalles de una alerta
function viewAlertDetails(alertId) {
    fetch(`/api/alerts/${alertId}`)
        .then(response => response.json())
        .then(alert => {
            // Poblar el modal con los detalles
            document.getElementById('alertDetailId').textContent = alert.log_id;
            document.getElementById('alertDetailSensorId').textContent = alert.sensor_id;
            document.getElementById('alertDetailVibrationDataId').textContent = alert.vibration_data_id || 'N/A';
            
            // Formatear fecha
            const timestamp = new Date(alert.timestamp);
            document.getElementById('alertDetailTimestamp').textContent = timestamp.toLocaleString();
            
            document.getElementById('alertDetailErrorType').textContent = alert.error_type;
            document.getElementById('alertDetailSeverity').textContent = `Nivel ${alert.severity}`;
            document.getElementById('alertDetailMessage').textContent = alert.message || 'Sin mensaje';
            document.getElementById('alertDetailAcknowledged').textContent = alert.acknowledged ? 'Reconocida' : 'Pendiente';
            
            // Configurar botón para ver datos de vibración asociados
            const viewDataBtn = document.getElementById('viewVibrationDataBtn');
            if (viewDataBtn) {
                if (alert.vibration_data_id) {
                    viewDataBtn.classList.remove('disabled');
                    viewDataBtn.onclick = () => {
                        // Cerrar modal actual
                        document.getElementById('alertDetailsModal').classList.remove('show');
                        // Abrir modal de datos de vibración
                        viewVibrationDetails(alert.vibration_data_id);
                    };
                } else {
                    viewDataBtn.classList.add('disabled');
                    viewDataBtn.onclick = null;
                }
            }
            
            // Configurar botón para reconocer alerta
            const acknowledgeBtn = document.getElementById('acknowledgeAlertBtn');
            if (acknowledgeBtn) {
                if (alert.acknowledged) {
                    acknowledgeBtn.classList.add('disabled');
                    acknowledgeBtn.textContent = 'Alerta Reconocida';
                } else {
                    acknowledgeBtn.classList.remove('disabled');
                    acknowledgeBtn.textContent = 'Reconocer Alerta';
                    acknowledgeBtn.onclick = () => {
                        acknowledgeAlert(alert.log_id);
                    };
                }
            }
            
            // Mostrar modal
            document.getElementById('alertDetailsModal').classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar detalles de alerta:', error);
            showToast('Error al cargar detalles de alerta', 'error');
        });
}

// Reconocer una alerta
function acknowledgeAlert(alertId) {
    showLoadingIndicator('Reconociendo alerta...');
    
    fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'PUT'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al reconocer alerta');
            }
            return response.json();
        })
        .then(result => {
            showToast('Alerta reconocida correctamente', 'success');
            
            // Cerrar modal si está abierto
            document.getElementById('alertDetailsModal').classList.remove('show');
            
            // Recargar datos de alertas
            loadAlerts();
            
            // Actualizar contadores del dashboard
            updateDashboardAlertCounts();
        })
        .catch(error => {
            console.error('Error al reconocer alerta:', error);
            showToast('Error al reconocer alerta', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Inicializar filtros y paginación para datos de vibración
function initVibrationDataSection() {
    // Botón de aplicar filtros
    const applyFiltersBtn = document.getElementById('applyVibrationFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const filters = {
                sensor_id: document.getElementById('vibrationDataSensorFilter').value,
                severity: document.getElementById('vibrationDataSeverityFilter').value,
                date: document.getElementById('vibrationDataDateFilter').value
            };
            
            loadVibrationData(1, filters);
        });
    }
    
    // Botones de paginación
    const prevBtn = document.getElementById('prevVibrationPageBtn');
    const nextBtn = document.getElementById('nextVibrationPageBtn');
    
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            const currentPage = parseInt(document.getElementById('vibrationDataPageInfo').textContent.split(' ')[1]);
            if (currentPage > 1) {
                loadVibrationData(currentPage - 1, getVibrationFilters());
            }
        });
        
        nextBtn.addEventListener('click', () => {
            const pageInfo = document.getElementById('vibrationDataPageInfo').textContent;
            const [currentPage, totalPages] = pageInfo.split(' ')[1].split(' de ');
            
            if (parseInt(currentPage) < parseInt(totalPages)) {
                loadVibrationData(parseInt(currentPage) + 1, getVibrationFilters());
            }
        });
    }
    
    // Botón de refrescar
    const refreshBtn = document.getElementById('refreshVibrationDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadVibrationData(1, getVibrationFilters());
        });
    }
    
    // Cargar datos iniciales
    loadVibrationData();
}

// Obtener filtros actuales para los datos de vibración
function getVibrationFilters() {
    return {
        sensor_id: document.getElementById('vibrationDataSensorFilter').value,
        severity: document.getElementById('vibrationDataSeverityFilter').value,
        date: document.getElementById('vibrationDataDateFilter').value
    };
}

// Ver detalles de datos de vibración
function viewVibrationDetails(dataId) {
    fetch(`/api/vibration-data/${dataId}`)
        .then(response => response.json())
        .then(data => {
            // Crear un modal dinámico para mostrar los detalles
            const modalHtml = `
                <div class="modal" id="vibrationDetailModal">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Detalles de Datos de Vibración</h5>
                                <button type="button" class="modal-close" id="closeVibrationDetailBtn">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="modal-body">
                                <div class="details-grid">
                                    <div class="detail-item">
                                        <div class="detail-label">ID:</div>
                                        <div class="detail-value">${data.data_id}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Sensor ID:</div>
                                        <div class="detail-value">${data.sensor_id}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Fecha y Hora:</div>
                                        <div class="detail-value">${new Date(data.date).toLocaleString()}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Aceleración X:</div>
                                        <div class="detail-value">${data.acceleration_x !== null ? data.acceleration_x.toFixed(6) : 'N/A'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Aceleración Y:</div>
                                        <div class="detail-value">${data.acceleration_y !== null ? data.acceleration_y.toFixed(6) : 'N/A'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Aceleración Z:</div>
                                        <div class="detail-value">${data.acceleration_z !== null ? data.acceleration_z.toFixed(6) : 'N/A'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Severidad:</div>
                                        <div class="detail-value">${getSeverityText(data.severity)}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Magnitud:</div>
                                        <div class="detail-value">${data.magnitude !== null ? data.magnitude.toFixed(6) : 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn" id="closeVibrationDetailModalBtn">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Eliminar modal anterior si existe
            const oldModal = document.getElementById('vibrationDetailModal');
            if (oldModal) {
                oldModal.remove();
            }
            
            // Añadir el nuevo modal al DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Configurar eventos de cierre
            const modal = document.getElementById('vibrationDetailModal');
            const closeBtn = document.getElementById('closeVibrationDetailBtn');
            const closeModalBtn = document.getElementById('closeVibrationDetailModalBtn');
            
            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            };
            
            if (closeBtn) {
                closeBtn.addEventListener('click', closeModal);
            }
            
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', closeModal);
            }
            
            // Mostrar el modal
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        })
        .catch(error => {
            console.error('Error al cargar detalles de datos de vibración:', error);
            showToast('Error al cargar detalles de datos de vibración', 'error');
        });
}

// Obtener texto descriptivo de severidad
function getSeverityText(severity) {
    switch(severity) {
        case 0:
            return 'Normal';
        case 1:
            return 'Nivel 1 - Advertencia';
        case 2:
            return 'Nivel 2 - Atención Requerida';
        case 3:
            return 'Nivel 3 - Crítico';
        default:
            return 'Desconocido';
    }
}

// Actualizar contadores de alertas en el dashboard
function updateDashboardAlertCounts() {
    // Obtener los filtros actuales
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    
    if (!selectedMachine || !selectedSensor) {
        // Si no hay selección, mostrar 0 en todos los contadores
        document.getElementById('level1Count').textContent = '0';
        document.getElementById('level2Count').textContent = '0';
        document.getElementById('level3Count').textContent = '0';
        document.getElementById('totalCount').textContent = '0';
        return;
    }
    
    // Realizar petición para obtener los contadores según los filtros
    fetch(`/api/alerts/count?machine_id=${selectedMachine}&sensor_id=${selectedSensor}`)
        .then(response => response.json())
        .then(data => {
            // Actualizar contadores en la UI
            document.getElementById('level1Count').textContent = data.level1 || '0';
            document.getElementById('level2Count').textContent = data.level2 || '0';
            document.getElementById('level3Count').textContent = data.level3 || '0';
            document.getElementById('totalCount').textContent = data.total || '0';
        })
        .catch(error => {
            console.error('Error al actualizar contadores de alertas:', error);
        });
}

// Ocultar gráficos hasta que se apliquen filtros
function hideCharts() {
    const chartContainers = document.querySelectorAll('.charts-container .chart-container');
    chartContainers.forEach(container => {
        container.style.display = 'none';
    });
}

// Mostrar gráficos después de aplicar filtros
function showCharts() {
    const chartContainers = document.querySelectorAll('.charts-container .chart-container');
    chartContainers.forEach(container => {
        container.style.display = 'block';
    });
}

// Exportar funciones para uso global
window.initDashboard = initDashboard;
window.updateDashboardData = updateDashboardData;
window.initCustomUIComponents = initCustomUIComponents;
window.initVisualFilters = initVisualFilters;
window.hideCharts = hideCharts;
window.showCharts = showCharts;
window.initApplyFiltersButton = initApplyFiltersButton;
window.initExportButtons = initExportButtons;
window.exportAxisToPDF = exportAxisToPDF;
window.loadSimplifiedAlerts = loadSimplifiedAlerts;
window.loadVibrationData = loadVibrationData;
window.loadAlerts = loadAlerts;
window.viewAlertDetails = viewAlertDetails;
window.acknowledgeAlert = acknowledgeAlert;
window.initVibrationDataSection = initVibrationDataSection;
window.getVibrationFilters = getVibrationFilters;
window.viewVibrationDetails = viewVibrationDetails;
window.getSeverityText = getSeverityText;
window.updateDashboardAlertCounts = updateDashboardAlertCounts; 