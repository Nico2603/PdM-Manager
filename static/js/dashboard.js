/**
 * PdM-Manager - JavaScript Dashboard v1.0.0
 * Funciones específicas para el dashboard principal
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// VARIABLES GLOBALES DEL DASHBOARD
// ==========================================================================

// Selecciones actuales
let selectedMachine = '';
let selectedSensor = '';
let timeRange = '24h';

// Estado de simulación
let simulationRunning = false;
let simulationTimer = null;

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
            selectedMachine = value;
            // Actualizar lista de sensores si cambia la máquina
            loadSensors(value);
            break;
        case 'sensorDropdown':
            selectedSensor = value;
            break;
        case 'timeRangeDropdown':
            timeRange = value;
            break;
    }
    
    // Actualizar datos del dashboard
    updateDashboardData();
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
            return loadSensors(selectedMachine);
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
            if (machines.length > 0 && !selectedMachine) {
                selectedMachine = machines[0].machine_id;
                
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
    // Si no hay selección, mantener la opción "Todos"
    if (!machineId) {
        const sensorDropdownMenu = document.getElementById('sensorDropdownMenu');
        if (!sensorDropdownMenu) return Promise.resolve();
        
        // Limpiar opciones anteriores, manteniendo la opción "Todos"
        const allOption = sensorDropdownMenu.querySelector('.filter-dropdown-item[data-value=""]');
        sensorDropdownMenu.innerHTML = '';
        
        if (allOption) {
            sensorDropdownMenu.appendChild(allOption);
        } else {
            const newAllOption = document.createElement('div');
            newAllOption.className = 'filter-dropdown-item selected';
            newAllOption.setAttribute('data-value', '');
            newAllOption.textContent = 'Todos los sensores';
            sensorDropdownMenu.appendChild(newAllOption);
        }
        
        // Resetear selección
        selectedSensor = '';
        
        return Promise.resolve();
    }
    
    // Si ya tenemos los sensores en caché, usarlos
    if (cache.sensors[machineId]) {
        updateSensorDropdown(cache.sensors[machineId]);
        return Promise.resolve();
    }
    
    // Cargar sensores desde la API
    return fetch(`/api/machines/${machineId}/sensors`)
        .then(response => response.json())
        .then(sensors => {
            // Guardar en caché
            cache.sensors[machineId] = sensors;
            
            // Actualizar dropdown
            updateSensorDropdown(sensors);
        })
        .catch(error => {
            console.error('Error al cargar sensores:', error);
            return Promise.reject(error);
        });
}

// Actualizar dropdown de sensores
function updateSensorDropdown(sensors) {
    const sensorDropdownMenu = document.getElementById('sensorDropdownMenu');
    const sensorDropdownText = document.getElementById('selectedSensorText');
    
    if (!sensorDropdownMenu) return;
    
    // Limpiar opciones anteriores, manteniendo la opción "Todos"
    const allOption = sensorDropdownMenu.querySelector('.filter-dropdown-item[data-value=""]');
    sensorDropdownMenu.innerHTML = '';
    
    if (allOption) {
        sensorDropdownMenu.appendChild(allOption);
    } else {
        const newAllOption = document.createElement('div');
        newAllOption.className = 'filter-dropdown-item selected';
        newAllOption.setAttribute('data-value', '');
        newAllOption.textContent = 'Todos los sensores';
        sensorDropdownMenu.appendChild(newAllOption);
    }
    
    // Añadir sensores al dropdown
    sensors.forEach(sensor => {
        const option = document.createElement('div');
        option.className = 'filter-dropdown-item';
        option.setAttribute('data-value', sensor.sensor_id);
        option.textContent = sensor.name;
        sensorDropdownMenu.appendChild(option);
    });
    
    // Si hay sensores y no hay selección previa, seleccionar el primero
    if (sensors.length > 0) {
        if (!selectedSensor) {
            selectedSensor = sensors[0].sensor_id;
            
            // Actualizar texto del dropdown
            if (sensorDropdownText) {
                sensorDropdownText.textContent = sensors[0].name;
            }
        } else {
            // Verificar que el sensor seleccionado existe en la nueva lista
            const sensorExists = sensors.some(s => s.sensor_id === selectedSensor);
            
            if (!sensorExists) {
                selectedSensor = sensors[0].sensor_id;
                
                // Actualizar texto del dropdown
                if (sensorDropdownText) {
                    sensorDropdownText.textContent = sensors[0].name;
                }
            }
        }
    } else {
        // Si no hay sensores, resetear selección
        selectedSensor = '';
        
        if (sensorDropdownText) {
            sensorDropdownText.textContent = 'Todos los sensores';
        }
    }
}

// Actualizar datos del dashboard
function updateDashboardData() {
    showLoadingToast('Actualizando datos...');
    
    // Construir URL según los filtros seleccionados
    let url = '/api/vibration-data';
    const params = [];
    
    if (selectedMachine) params.push(`machine_id=${selectedMachine}`);
    if (selectedSensor) params.push(`sensor_id=${selectedSensor}`);
    if (timeRange) params.push(`time_range=${timeRange}`);
    
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            // Actualizar datos de los gráficos
            chartData.timestamps = data.timestamps || [];
            chartData.x = data.values?.x || [];
            chartData.y = data.values?.y || [];
            chartData.z = data.values?.z || [];
            chartData.status = data.status || [];
            
            // Actualizar gráficos
            updateVibrationChartX();
            updateVibrationChartY();
            updateVibrationChartZ();
            
            // Actualizar contadores de alertas si están disponibles
            if (data.alerts) {
                updateAlertCounters(data.alerts);
            }
            
            // Actualizar valores estadísticos
            updateStatisticalDisplayValues();
            
            // Actualizar tiempo de última actualización
            updateLastUpdateTime();
            
            return data;
        })
        .catch(error => {
            console.error('Error al actualizar datos:', error);
            showToast('Error al actualizar datos', 'error');
            return Promise.reject(error);
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

// Actualizar valores estadísticos que se muestran
function updateStatisticalDisplayValues() {
    // Calcular valores estadísticos para cada eje
    const axes = ['x', 'y', 'z'];
    
    axes.forEach(axis => {
        const values = chartData[axis];
        if (!values || values.length === 0) return;
        
        // Calcular estadísticas
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const sortedValues = [...values].sort((a, b) => a - b);
        const min = sortedValues[0];
        const max = sortedValues[sortedValues.length - 1];
        
        // Calcular desviación estándar
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        // Actualizar valores en el panel de estadísticas
        document.getElementById(`${axis}Mean`).textContent = mean.toFixed(4);
        document.getElementById(`${axis}StdDev`).textContent = stdDev.toFixed(4);
        document.getElementById(`${axis}Min`).textContent = min.toFixed(4);
        document.getElementById(`${axis}Max`).textContent = max.toFixed(4);
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
    if (selectedMachine && cache.machines) {
        const machine = cache.machines.find(m => m.machine_id === selectedMachine);
        if (machine) title += ` - ${machine.name}`;
    }
    
    if (selectedSensor && cache.sensors[selectedMachine]) {
        const sensor = cache.sensors[selectedMachine].find(s => s.sensor_id === selectedSensor);
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
                simulationRunning = true;
                startSimulationUpdates();
                
                // Actualizar UI
                const simStatusEl = document.getElementById('simulationStatus');
                if (simStatusEl) simStatusEl.classList.add('running');
            }
        })
        .catch(error => {
            console.error('Error al comprobar estado de simulación:', error);
        });
}

// Iniciar actualizaciones automáticas
function startSimulationUpdates() {
    if (simulationTimer) return; // Ya está corriendo
    
    // Actualizar cada 5 segundos
    simulationTimer = setInterval(() => {
        updateDashboardData();
    }, 5000);
}

// Detener actualizaciones automáticas
function stopSimulationUpdates() {
    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }
}

// Exportar funciones para uso global
window.initDashboard = initDashboard;
window.updateDashboardData = updateDashboardData;
window.initCustomUIComponents = initCustomUIComponents;
window.initVisualFilters = initVisualFilters;
window.exportToPDF = exportToPDF; 