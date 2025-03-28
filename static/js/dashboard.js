/**
 * PdM-Manager - JavaScript Dashboard v2.0.0
 * Funciones específicas para el dashboard principal
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// VARIABLES GLOBALES DEL DASHBOARD
// ==========================================================================

// Mantener referencias a las selecciones actuales (ahora gestionadas por globalState)
// Estas referencias se eliminan y se usan las funciones de utils.js para acceder a los valores

// Estado del monitoreo
let monitoringInterval = null;
let isMonitoring = false;
let hasValidConfiguration = false;

// ==========================================================================
// INICIALIZACIÓN DEL DASHBOARD
// ==========================================================================

function initDashboard() {
    console.log('Inicializando dashboard...');
    
    try {
        // Inicializar componentes de UI primero (no requieren datos de la API)
        initCustomUIComponents();
        initVisualFilters();
        initExportButtons();
        initAdjustLimitsButton();
        initVibrationDataSection();
        
        // Inicializar nueva funcionalidad de monitoreo
        initMonitoringButton();
        
        // Ocultar gráficos hasta que se carguen datos
        hideCharts();
        
        // Inicializar botones de filtros
        initApplyFiltersButton();
        
        // Leer valores iniciales de filtros
        const initialFilters = getVibrationFilters();
        
        // Establecer valores iniciales en el estado global
        setGlobalState('selectedMachine', initialFilters.machineId || '');
        setGlobalState('selectedSensor', initialFilters.sensorId || '');
        setGlobalState('timeRange', initialFilters.timeRange || '24h');
        
        // Configurar opciones de visualización de gráficos
        setGlobalState('chartOptions', {
            showMean: false,
            show2Sigma: true,
            show3Sigma: true
        });
        
        // Crear objeto para cachear las respuestas (evita llamadas redundantes)
        setGlobalState('dashboardCache', {});
        
        // Mostrar indicador de carga mientras se inicializa
        showLoadingIndicator('Inicializando panel de control...');
        
        // Cargar datos en secuencia para optimizar rendimiento
        Promise.resolve()
            .then(() => {
                // Cargar máquinas primero
                return loadMachines();
            })
            .then(() => {
                // Cargar sensores después de que se hayan cargado las máquinas
                const selectedMachine = getGlobalState('selectedMachine');
                if (selectedMachine) {
                    return loadSensors(selectedMachine);
                }
                return Promise.resolve([]);
            })
            .then(() => {
                // Comprobar si hay una configuración válida antes de cargar datos
                hasValidConfiguration = checkValidConfiguration();
                if (!hasValidConfiguration) {
                    hideLoadingIndicator();
                    showNoConfigurationMessage();
                    return Promise.reject('No hay configuración válida');
                }
                
                // Una vez cargados los datos de configuración, cargar datos del dashboard
                return updateDashboardData();
            })
            .then(() => {
                console.log('Dashboard inicializado correctamente');
                hideLoadingIndicator();
                showToast('Panel de control inicializado', 'success');
            })
            .catch(error => {
                if (error !== 'No hay configuración válida') {
                    console.error('Error al inicializar dashboard:', error);
                    showToast('Error al inicializar el panel', 'error');
                }
                hideLoadingIndicator();
            });
        
    } catch (error) {
        console.error('Error catastrófico al inicializar dashboard:', error);
        showToast('Error crítico al inicializar el panel', 'error');
        hideLoadingIndicator();
    }
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
    
    // Inicializar dropdowns de gráficos
    initChartDropdowns();
    
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

// Inicializar dropdowns en gráficos
function initChartDropdowns() {
    const chartDropdowns = document.querySelectorAll('.chart-dropdown');
    
    chartDropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.chart-dropdown-toggle');
        
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
                
                // Cerrar otros dropdowns abiertos
                chartDropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown && otherDropdown.classList.contains('active')) {
                        otherDropdown.classList.remove('active');
                    }
                });
            });
        }
    });
    
    // Cerrar dropdowns al hacer clic en cualquier parte
    document.addEventListener('click', () => {
        chartDropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    });
}

// Inicializar filtros visuales
function initVisualFilters() {
    // Obtener elementos del DOM
    const show2SigmaToggle = document.getElementById('show2Sigma');
    const show3SigmaToggle = document.getElementById('show3Sigma');
    
    if (show2SigmaToggle && show3SigmaToggle) {
        // Obtener estado actual (o usar valor por defecto)
        const chartOptions = getGlobalState('chartOptions') || {
            show2Sigma: true,
            show3Sigma: true
        };
        
        // Asegurarse de que los toggles reflejen el estado actual
        show2SigmaToggle.checked = chartOptions.show2Sigma;
        show3SigmaToggle.checked = chartOptions.show3Sigma;
        
        // Añadir evento change que actualiza los gráficos en tiempo real
        show2SigmaToggle.addEventListener('change', () => {
            // Actualizar estado global
            const chartOptions = getGlobalState('chartOptions') || {};
            chartOptions.show2Sigma = show2SigmaToggle.checked;
            setGlobalState('chartOptions', chartOptions);
            
            // Actualizar visualización de gráficos inmediatamente
            if (typeof updateChartsVisibility === 'function') {
                updateChartsVisibility();
            }
            
            // Mostrar mensaje de éxito
            const status = show2SigmaToggle.checked ? 'activadas' : 'desactivadas';
            showToast(`Líneas 2σ ${status}`, 'info', 1000);
        });
        
        show3SigmaToggle.addEventListener('change', () => {
            // Actualizar estado global
            const chartOptions = getGlobalState('chartOptions') || {};
            chartOptions.show3Sigma = show3SigmaToggle.checked;
            setGlobalState('chartOptions', chartOptions);
            
            // Actualizar visualización de gráficos inmediatamente
            if (typeof updateChartsVisibility === 'function') {
                updateChartsVisibility();
            }
            
            // Mostrar mensaje de éxito
            const status = show3SigmaToggle.checked ? 'activadas' : 'desactivadas';
            showToast(`Líneas 3σ ${status}`, 'info', 1000);
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
    const noConfigMessage = document.getElementById('noConfigurationMessage');
    const chartsContainers = document.querySelectorAll('.chart-container');
    const warningMessage = document.getElementById('configurationWarning');
    
    if (noConfigMessage) {
        noConfigMessage.classList.remove('d-none');
    }
    
    if (warningMessage) {
        warningMessage.classList.remove('d-none');
    }
    
    chartsContainers.forEach(container => {
        if (container.id !== 'noConfigurationMessage') {
            container.classList.add('d-none');
        }
    });
    
    // Desactivar el botón de monitoreo
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    if (startMonitoringBtn) {
        startMonitoringBtn.disabled = true;
    }
}

// Ocultar mensaje de no configuración
function hideNoConfigurationMessage() {
    const noConfigMessage = document.getElementById('noConfigurationMessage');
    const chartsContainers = document.querySelectorAll('.chart-container');
    const warningMessage = document.getElementById('configurationWarning');
    
    if (noConfigMessage) {
        noConfigMessage.classList.add('d-none');
    }
    
    if (warningMessage) {
        warningMessage.classList.add('d-none');
    }
    
    chartsContainers.forEach(container => {
        if (container.id !== 'noConfigurationMessage') {
            container.classList.remove('d-none');
        }
    });
    
    // Activar el botón de monitoreo
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    if (startMonitoringBtn) {
        startMonitoringBtn.disabled = false;
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
    // Obtener parámetros de filtrado actuales
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Construir URL para el endpoint optimizado
    let url = `/api/dashboard-data?`;
    
    // Añadir filtros
    if (selectedSensor) {
        url += `&sensor_id=${selectedSensor}`;
    }
    
    if (selectedMachine) {
        url += `&machine_id=${selectedMachine}`;
    }
    
    if (timeRange) {
        url += `&time_range=${timeRange}`;
    }
    
    // Mostrar indicador de carga
    showLoadingIndicator('Actualizando datos del panel...');
    
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar datos del dashboard: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos del dashboard recibidos:', data);
            
            // Procesar datos
            if (data.vibration_data) {
                processVibrationData(data.vibration_data);
            }
            
            if (data.alerts) {
                updateAlertCounters({
                    level1: data.alerts.filter(a => a.error_type === 1).length,
                    level2: data.alerts.filter(a => a.error_type === 2).length,
                    level3: data.alerts.filter(a => a.error_type === 3).length
                });
            }
            
            if (data.limits) {
                // Actualizar límites
                setGlobalState('limits', data.limits);
                
                // Guardar en localStorage para persistencia
                localStorage.setItem('limitConfig', JSON.stringify({
                    x_2inf: data.limits.x_2inf,
                    x_2sup: data.limits.x_2sup,
                    x_3inf: data.limits.x_3inf,
                    x_3sup: data.limits.x_3sup,
                    y_2inf: data.limits.y_2inf,
                    y_2sup: data.limits.y_2sup,
                    y_3inf: data.limits.y_3inf,
                    y_3sup: data.limits.y_3sup,
                    z_2inf: data.limits.z_2inf,
                    z_2sup: data.limits.z_2sup,
                    z_3inf: data.limits.z_3inf,
                    z_3sup: data.limits.z_3sup
                }));
                
                updateStatisticalDisplayValues();
            }
            
            // Actualizar últimos valores de severidad
            if (data.vibration_data && data.vibration_data.length > 0) {
                const lastData = data.vibration_data[data.vibration_data.length - 1];
                
                // Si hay una alerta de tipo 3 (severidad 3), mostrar alerta
                if (lastData.severity === 3) {
                    showCriticalAlert();
                }
            }
            
            // Actualizar gráficos
            updateAllCharts();
            
            // Mostrar gráficos si están ocultos
            showCharts();
            
            // Ocultar indicador de carga
            hideLoadingIndicator();
            
            // Actualizar timestamp de última actualización
            document.getElementById('lastUpdateTime').textContent = 
                new Date().toLocaleTimeString();
                
            return data;
        })
        .catch(error => {
            console.error('Error al actualizar datos del dashboard:', error);
            hideLoadingIndicator();
            showToast('Error al cargar datos del panel', 'error');
            return null;
        });
}

// Función para verificar si hay una configuración válida
function checkValidConfiguration() {
    const cache = getGlobalState('dashboardCache') || {};
    
    // Verificar si hay al menos una máquina con sensor asignado
    if (!cache.machines || cache.machines.length === 0) {
        return false;
    }
    
    // Verificar que al menos una máquina tenga sensor y que el sensor tenga modelo
    let hasValidSetup = false;
    
    // Obtener datos de sensores desde el caché
    const sensors = cache.sensors || {};
    
    // Verificar cada máquina para encontrar una configuración válida
    for (const machine of cache.machines) {
        if (machine.sensor_id) {
            // Buscar información del sensor para esta máquina
            if (sensors[machine.sensor_id] && sensors[machine.sensor_id].model_id) {
                hasValidSetup = true;
                break;
            }
        }
    }
    
    return hasValidSetup;
}

// Procesamiento de datos de vibración actualizado
function processVibrationData(vibrationData) {
    if (!vibrationData || vibrationData.length === 0) {
        console.warn('No hay datos de vibración para procesar');
        return;
    }
    
    console.log('Procesando datos de vibración:', vibrationData.length);
    
    // Asegurarse de que los datos estén ordenados por timestamp
    vibrationData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Actualizar datos de gráficos
    chartData.timestamps = vibrationData.map(item => new Date(item.date).toLocaleTimeString());
    
    // Preparar datos para cada eje
    chartData.x = vibrationData.map(item => item.acceleration_x !== undefined ? parseFloat(item.acceleration_x) : null);
    chartData.y = vibrationData.map(item => item.acceleration_y !== undefined ? parseFloat(item.acceleration_y) : null);
    chartData.z = vibrationData.map(item => item.acceleration_z !== undefined ? parseFloat(item.acceleration_z) : null);
    chartData.status = vibrationData.map(item => item.severity !== undefined ? parseInt(item.severity) : 0);
    
    // Actualizar indicadores de severidad en los gráficos
    updateSeverityIndicators(vibrationData);
    
    console.log('Datos procesados para gráficas', {
        timestamps: chartData.timestamps.length,
        x: chartData.x.length,
        y: chartData.y.length,
        z: chartData.z.length
    });
}

// Actualizar indicadores de severidad
function updateSeverityIndicators(vibrationData) {
    // Si no hay datos, no hacer nada
    if (!vibrationData || vibrationData.length === 0) return;
    
    // Obtener el último elemento de datos para mostrar la severidad actual
    const lastData = vibrationData[vibrationData.length - 1];
    
    // Obtener elementos DOM para actualizar
    const xAxisSeverity = document.getElementById('xAxisSeverity');
    const yAxisSeverity = document.getElementById('yAxisSeverity');
    const zAxisSeverity = document.getElementById('zAxisSeverity');
    
    if (xAxisSeverity && yAxisSeverity && zAxisSeverity) {
        // Resetear clases
        xAxisSeverity.className = 'severity-value';
        yAxisSeverity.className = 'severity-value';
        zAxisSeverity.className = 'severity-value';
        
        // Aplicar clase según severidad
        const severityClass = getSeverityClass(lastData.severity);
        const severityText = getSeverityText(lastData.severity);
        
        xAxisSeverity.classList.add(severityClass);
        yAxisSeverity.classList.add(severityClass);
        zAxisSeverity.classList.add(severityClass);
        
        xAxisSeverity.textContent = severityText;
        yAxisSeverity.textContent = severityText;
        zAxisSeverity.textContent = severityText;
    }
}

// Obtener clase CSS según la severidad
function getSeverityClass(severity) {
    switch (parseInt(severity)) {
        case 0:
            return 'normal';
        case 1:
            return 'warning-level-1';
        case 2:
            return 'warning-level-2';
        case 3:
            return 'critical';
        default:
            return 'normal';
    }
}

// Obtener texto según la severidad
function getSeverityText(severity) {
    switch (parseInt(severity)) {
        case 0:
            return 'Normal';
        case 1:
            return 'Alerta Nivel 1';
        case 2:
            return 'Alerta Nivel 2';
        case 3:
            return 'Crítico (Nivel 3)';
        default:
            return 'Normal';
    }
}

// Mostrar alerta crítica
function showCriticalAlert() {
    // Solo mostrar la alerta si no estamos en modo silencioso
    const isSilent = localStorage.getItem('silentAlerts') === 'true';
    
    if (!isSilent) {
        // Crear elemento de alerta crítica
        const alertEl = document.createElement('div');
        alertEl.className = 'critical-alert-popup';
        alertEl.innerHTML = `
            <div class="critical-alert-content">
                <div class="alert-icon">
                    <i class="fas fa-radiation-alt fa-pulse"></i>
                </div>
                <div class="alert-message">
                    <h3>¡Alerta Crítica!</h3>
                    <p>Se ha detectado un nivel crítico de vibración (Nivel 3).</p>
                    <p>Se recomienda revisión inmediata del equipo.</p>
                </div>
                <button class="alert-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Agregar a la página
        document.body.appendChild(alertEl);
        
        // Efecto de entrada
        setTimeout(() => {
            alertEl.classList.add('show');
        }, 100);
        
        // Configurar botón de cierre
        const closeBtn = alertEl.querySelector('.alert-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                alertEl.classList.remove('show');
                setTimeout(() => {
                    alertEl.remove();
                }, 300);
            });
        }
        
        // Reproducir sonido de alerta
        playAlertSound();
        
        // Auto-cerrar después de 10 segundos
        setTimeout(() => {
            if (alertEl.parentNode) {
                alertEl.classList.remove('show');
                setTimeout(() => {
                    if (alertEl.parentNode) {
                        alertEl.remove();
                    }
                }, 300);
            }
        }, 10000);
    }
}

// Reproducir sonido de alerta
function playAlertSound() {
    const isMuted = localStorage.getItem('muteAlerts') === 'true';
    
    if (!isMuted) {
        try {
            const audio = new Audio('/static/audio/alert.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch (e) {
            console.warn('No se pudo reproducir el sonido de alerta:', e);
        }
    }
}

// Inicializar botón de monitoreo
function initMonitoringButton() {
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    const monitoringStatus = document.getElementById('monitoringStatus');
    
    if (startMonitoringBtn && monitoringStatus) {
        startMonitoringBtn.addEventListener('click', function() {
            if (!hasValidConfiguration) {
                showToast('No hay configuración válida para iniciar el monitoreo', 'error');
                return;
            }
            
            if (!isMonitoring) {
                // Iniciar monitoreo
                startMonitoring();
                
                // Cambiar apariencia del botón
                startMonitoringBtn.innerHTML = '<i class="fas fa-stop-circle mr-2"></i> Detener Monitoreo';
                startMonitoringBtn.classList.remove('btn-primary');
                startMonitoringBtn.classList.add('btn-danger');
                
                // Actualizar estado
                const statusIndicator = monitoringStatus.querySelector('.status-indicator');
                const statusText = monitoringStatus.querySelector('.status-text');
                
                if (statusIndicator && statusText) {
                    statusIndicator.classList.add('active');
                    statusText.textContent = 'Monitoreo activo';
                }
            } else {
                // Detener monitoreo
                stopMonitoring();
                
                // Cambiar apariencia del botón
                startMonitoringBtn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> Iniciar Monitoreo';
                startMonitoringBtn.classList.remove('btn-danger');
                startMonitoringBtn.classList.add('btn-primary');
                
                // Actualizar estado
                const statusIndicator = monitoringStatus.querySelector('.status-indicator');
                const statusText = monitoringStatus.querySelector('.status-text');
                
                if (statusIndicator && statusText) {
                    statusIndicator.classList.remove('active');
                    statusText.textContent = 'Monitoreo detenido';
                }
            }
        });
    }
}

// Iniciar monitoreo
function startMonitoring() {
    if (monitoringInterval !== null) {
        clearInterval(monitoringInterval);
    }
    
    // Realizar una actualización inmediata
    updateDashboardData();
    
    // Establecer intervalo de actualización (cada 5 segundos)
    monitoringInterval = setInterval(() => {
        updateDashboardData();
    }, 5000);
    
    // Actualizar estado
    isMonitoring = true;
    
    showToast('Monitoreo iniciado correctamente', 'success');
}

// Detener monitoreo
function stopMonitoring() {
    if (monitoringInterval !== null) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    // Actualizar estado
    isMonitoring = false;
    
    showToast('Monitoreo detenido', 'info');
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

// Inicializar botones de exportación
function initExportButtons() {
    // Exportación a PDF para cada eje
    const exportPdfXBtn = document.getElementById('exportPdfX');
    if (exportPdfXBtn) {
        exportPdfXBtn.addEventListener('click', () => {
            exportAxisToPDF('x');
        });
    }
    
    const exportPdfYBtn = document.getElementById('exportPdfY');
    if (exportPdfYBtn) {
        exportPdfYBtn.addEventListener('click', () => {
            exportAxisToPDF('y');
        });
    }
    
    const exportPdfZBtn = document.getElementById('exportPdfZ');
    if (exportPdfZBtn) {
        exportPdfZBtn.addEventListener('click', () => {
            exportAxisToPDF('z');
        });
    }
    
    // Botones de descarga de gráfico como imagen
    const downloadChartXBtn = document.getElementById('downloadChartX');
    if (downloadChartXBtn) {
        downloadChartXBtn.addEventListener('click', () => {
            downloadChart('vibrationChartX', 'vibracion-eje-x.png');
        });
    }
    
    const downloadChartYBtn = document.getElementById('downloadChartY');
    if (downloadChartYBtn) {
        downloadChartYBtn.addEventListener('click', () => {
            downloadChart('vibrationChartY', 'vibracion-eje-y.png');
        });
    }
    
    const downloadChartZBtn = document.getElementById('downloadChartZ');
    if (downloadChartZBtn) {
        downloadChartZBtn.addEventListener('click', () => {
            downloadChart('vibrationChartZ', 'vibracion-eje-z.png');
        });
    }
    
    const downloadChartAlertsBtn = document.getElementById('downloadChartAlerts');
    if (downloadChartAlertsBtn) {
        downloadChartAlertsBtn.addEventListener('click', () => {
            downloadChart('alertsHistoryChart', 'historial-alertas.png');
        });
    }
}

// Exportar datos de un eje a PDF
function exportAxisToPDF(axis) {
    // Mostrar indicador de carga
    showLoadingIndicator(`Generando PDF para eje ${axis.toUpperCase()}...`);
    
    // Obtener información del sensor y máquina seleccionados
    const machineId = getGlobalState('selectedMachine');
    const sensorId = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Verificar que hay datos para exportar
    if (!machineId || !sensorId) {
        showToast('Seleccione una máquina y un sensor para exportar datos', 'warning');
        hideLoadingIndicator();
        return;
    }
    
    try {
        // Preparar datos para el reporte
        // Capturar el gráfico como imagen base64
        const canvas = document.getElementById(`vibrationChart${axis.toUpperCase()}`);
        if (!canvas) {
            throw new Error(`No se encuentra el gráfico para el eje ${axis.toUpperCase()}`);
        }
        
        const imageData = canvas.toDataURL('image/png');
        
        // Obtener límites y estadísticas actuales
        const limits = getGlobalState('limits') || {};
        const stats = getGlobalState('stats') || {};
        
        // Preparar datos para enviar al servidor
        const reportData = {
            imageData,
            axis: axis.toUpperCase(),
            machineId,
            sensorId,
            timeRange,
            limits: limits[axis] || {},
            stats: stats[axis] || {},
            timestamp: new Date().toISOString()
        };
        
        // Enviar datos al servidor para generar PDF
        fetch('/api/export/axis-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al generar PDF');
            }
            return response.blob();
        })
        .then(blob => {
            // Crear URL para descargar el PDF
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `reporte-vibracion-eje-${axis}-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Mostrar mensaje de éxito
            showToast(`PDF para eje ${axis.toUpperCase()} generado correctamente`, 'success');
        })
        .catch(error => {
            console.error('Error al capturar gráfico:', error);
            showToast('Error al preparar datos para PDF', 'error');
            hideLoadingIndicator();
        });
    } catch (error) {
        console.error('Error al capturar gráfico:', error);
        showToast('Error al preparar datos para PDF', 'error');
        hideLoadingIndicator();
    }
}

// Inicializar botón de ajuste de límites
function initAdjustLimitsButton() {
    const adjustLimitsBtn = document.getElementById('adjustLimitsBtn');
    
    if (adjustLimitsBtn) {
        adjustLimitsBtn.addEventListener('click', () => {
            // Abrir el modal
            const modal = document.getElementById('adjustLimitsModal');
            if (modal) {
                // Cargar los valores actuales en el formulario
                loadCurrentLimitsToModal();
                
                // Mostrar el modal
                modal.classList.add('show');
            }
        });
    }
    
    // Inicializar botones del modal
    const saveLimitsBtn = document.getElementById('saveLimitsBtn');
    const resetLimitsBtn = document.getElementById('resetLimitsBtn');
    const closeModalBtn = document.querySelector('#adjustLimitsModal .modal-close');
    
    if (saveLimitsBtn) {
        saveLimitsBtn.addEventListener('click', saveLimitsFromModal);
    }
    
    if (resetLimitsBtn) {
        resetLimitsBtn.addEventListener('click', resetLimitsFromModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('adjustLimitsModal').classList.remove('show');
        });
    }
}

// Cargar los límites actuales en el modal
function loadCurrentLimitsToModal() {
    // Obtener límites actuales del estado global
    const stats = getGlobalState('stats') || {};
    
    // Establecer valores en los campos del formulario
    for (const axis of ['x', 'y', 'z']) {
        if (stats[axis]?.sigma2) {
            document.getElementById(`${axis}2SigmaLowerInput`).value = stats[axis].sigma2.lower;
            document.getElementById(`${axis}2SigmaUpperInput`).value = stats[axis].sigma2.upper;
        }
        
        if (stats[axis]?.sigma3) {
            document.getElementById(`${axis}3SigmaLowerInput`).value = stats[axis].sigma3.lower;
            document.getElementById(`${axis}3SigmaUpperInput`).value = stats[axis].sigma3.upper;
        }
    }
}

// Guardar límites desde el modal
function saveLimitsFromModal() {
    // Recopilar valores del formulario
    const limits = {
        x: {
            sigma2: {
                lower: parseFloat(document.getElementById('x2SigmaLowerInput').value),
                upper: parseFloat(document.getElementById('x2SigmaUpperInput').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('x3SigmaLowerInput').value),
                upper: parseFloat(document.getElementById('x3SigmaUpperInput').value)
            }
        },
        y: {
            sigma2: {
                lower: parseFloat(document.getElementById('y2SigmaLowerInput').value),
                upper: parseFloat(document.getElementById('y2SigmaUpperInput').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('y3SigmaLowerInput').value),
                upper: parseFloat(document.getElementById('y3SigmaUpperInput').value)
            }
        },
        z: {
            sigma2: {
                lower: parseFloat(document.getElementById('z2SigmaLowerInput').value),
                upper: parseFloat(document.getElementById('z2SigmaUpperInput').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('z3SigmaLowerInput').value),
                upper: parseFloat(document.getElementById('z3SigmaUpperInput').value)
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
    fetch('/api/limits/save', {
        method: 'POST',
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
            document.getElementById('adjustLimitsModal').classList.remove('show');
            
            // Actualizar valores mostrados en pantalla
            updateStatisticalDisplayValues();
            
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
function resetLimitsFromModal() {
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
                document.getElementById(`${axis}2SigmaLowerInput`).value = limits[axis]?.sigma2?.lower || '';
                document.getElementById(`${axis}2SigmaUpperInput`).value = limits[axis]?.sigma2?.upper || '';
                document.getElementById(`${axis}3SigmaLowerInput`).value = limits[axis]?.sigma3?.lower || '';
                document.getElementById(`${axis}3SigmaUpperInput`).value = limits[axis]?.sigma3?.upper || '';
            }
            
            // Actualizar valores mostrados en pantalla
            updateStatisticalDisplayValues();
            
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

// Inicializar botón de aplicar filtros
function initApplyFiltersButton() {
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            // Mostrar indicador de carga
            showLoadingIndicator('Aplicando filtros y actualizando datos...');
            
            // Almacenar selecciones actuales en el estado global
            const machineSelector = document.getElementById('machineDropdown');
            const sensorSelector = document.getElementById('sensorDropdown');
            const timeRangeSelector = document.getElementById('timeRangeDropdown');
            
            if (machineSelector && sensorSelector && timeRangeSelector) {
                const machineId = machineSelector.querySelector('.selected')?.getAttribute('data-value') || '';
                const sensorId = sensorSelector.querySelector('.selected')?.getAttribute('data-value') || '';
                const timeRange = timeRangeSelector.querySelector('.selected')?.getAttribute('data-value') || '24h';
                
                console.log('Aplicando filtros:', { machineId, sensorId, timeRange });
                
                // Actualizar estado global con las selecciones
                setGlobalState('selectedMachine', machineId);
                setGlobalState('selectedSensor', sensorId);
                setGlobalState('timeRange', timeRange);
            }
            
            // Leer estado de los toggles de visualización
            const show2Sigma = document.getElementById('show2Sigma')?.checked;
            const show3Sigma = document.getElementById('show3Sigma')?.checked;
            
            // Actualizar opciones de visualización en el estado global
            const chartOptions = getGlobalState('chartOptions') || {};
            chartOptions.show2Sigma = show2Sigma !== undefined ? show2Sigma : chartOptions.show2Sigma;
            chartOptions.show3Sigma = show3Sigma !== undefined ? show3Sigma : chartOptions.show3Sigma;
            setGlobalState('chartOptions', chartOptions);
            
            // Actualizar datos y gráficos
            Promise.resolve()
                .then(() => {
                    // Mostrar mensajes de depuración
                    console.log('Estado global actualizado:', {
                        machine: getGlobalState('selectedMachine'),
                        sensor: getGlobalState('selectedSensor'),
                        timeRange: getGlobalState('timeRange'),
                        chartOptions: getGlobalState('chartOptions')
                    });
                    
                    // Actualizar datos del dashboard
                    return updateDashboardData();
                })
                .then(() => {
                    console.log('Datos del dashboard actualizados');
                    
                    // Mostrar gráficos después de cargar datos
                    showCharts();
                    
                    // Actualizar la visibilidad de las líneas sigma según los checkboxes
                    if (typeof updateChartsVisibility === 'function') {
                        updateChartsVisibility();
                    }
                    
                    // Actualizar contadores de alertas
                    updateDashboardAlertCounts();
                    
                    // Cargar datos de vibración recientes
                    return loadVibrationData(1);
                })
                .then(() => {
                    console.log('Datos de vibración cargados');
                    
                    // Cargar alertas simplificadas
                    return loadSimplifiedAlerts();
                })
                .then(() => {
                    console.log('Alertas simplificadas cargadas');
                    
                    // Mostrar mensaje de éxito
                    showToast('Filtros aplicados correctamente', 'success');
                })
                .catch(error => {
                    console.error('Error al aplicar filtros:', error);
                    showToast('Error al aplicar filtros', 'error');
                })
                .finally(() => {
                    hideLoadingIndicator();
                });
        });
    }
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
    // Mostrar indicador de carga
    const showLoader = !filters.silentLoad;
    if (showLoader) {
        showLoadingIndicator('Cargando datos de vibración...');
    }
    
    // Obtener filtros globales del dashboard si no se proporcionan filtros específicos
    if (!filters.sensor_id && !filters.machine_id) {
        const selectedMachine = getGlobalState('selectedMachine');
        const selectedSensor = getGlobalState('selectedSensor');
        
        if (selectedSensor) {
            filters.sensor_id = selectedSensor;
        }
        
        if (selectedMachine) {
            filters.machine_id = selectedMachine;
        }
    }
    
    // Construir URL para el endpoint optimizado
    const limit = filters.limit || 10;
    
    // Usar el endpoint dashboard-data para obtener datos de vibración
    let url = `/api/dashboard-data?data_type=vibration&page=${page}&limit=${limit}`;
    
    // Añadir filtros
    if (filters.sensor_id) {
        url += `&sensor_id=${filters.sensor_id}`;
    }
    
    // Para filtros adicionales que puedan ser necesarios
    if (filters.severity !== undefined && filters.severity !== '') {
        url += `&severity=${filters.severity}`;
    }
    
    if (filters.date_start) {
        url += `&date_start=${filters.date_start}`;
    }
    
    if (filters.date_end) {
        url += `&date_end=${filters.date_end}`;
    }
    
    // Realizar petición a la API
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener datos de vibración: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (showLoader) {
                hideLoadingIndicator();
            }
            
            if (!data) {
                console.warn('No se recibieron datos de vibración');
                return null;
            }
            
            // Estructurar los datos para compatibilidad con el formato anterior
            const formattedData = {
                items: data.items || [],
                total: data.total || 0,
                page: data.page || page,
                limit: data.limit || limit,
                pages: data.pages || Math.ceil((data.total || 0) / limit)
            };
            
            // Actualizar la tabla con los datos recibidos
            updateVibrationDataTable(formattedData.items);
            
            // Actualizar la información de paginación
            updateVibrationPagination(formattedData.total, formattedData.page, formattedData.pages);
            
            return formattedData;
        })
        .catch(error => {
            if (showLoader) {
                hideLoadingIndicator();
            }
            console.error('Error al cargar datos de vibración:', error);
            if (showLoader) {
                showToast('Error al cargar datos de vibración: ' + error.message, 'error');
            }
            return null;
        });
}

// Actualizar tabla de datos de vibración
function updateVibrationDataTable(vibrationData) {
    const tableBody = document.getElementById('vibrationDataTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (vibrationData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">No hay datos de vibración disponibles</td>
            </tr>
        `;
        return;
    }
    
    vibrationData.forEach(item => {
        const row = document.createElement('tr');
        
        // Formatear fecha
        const date = new Date(item.date || item.timestamp);
        const formattedDate = date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Obtener clase de severidad
        let severityClass = '';
        switch (item.severity) {
            case 0:
                severityClass = 'status-normal';
                break;
            case 1:
                severityClass = 'status-level1';
                break;
            case 2:
                severityClass = 'status-level2';
                break;
            case 3:
                severityClass = 'status-level3';
                break;
        }
        
        // Adaptar a los nombres de campo del nuevo endpoint
        const dataId = item.id || item.data_id || item.vibration_data_id;
        const sensorId = item.sensor_id;
        const accelX = item.acceleration_x !== undefined ? item.acceleration_x : (item.accel_x || 0);
        const accelY = item.acceleration_y !== undefined ? item.acceleration_y : (item.accel_y || 0);
        const accelZ = item.acceleration_z !== undefined ? item.acceleration_z : (item.accel_z || 0);
        const magnitude = item.magnitude || 0;
        
        row.innerHTML = `
            <td>${dataId}</td>
            <td>${sensorId}</td>
            <td>${formattedDate}</td>
            <td>${parseFloat(accelX).toFixed(3)}</td>
            <td>${parseFloat(accelY).toFixed(3)}</td>
            <td>${parseFloat(accelZ).toFixed(3)}</td>
            <td><span class="${severityClass}">${getSeverityText(item.severity)}</span></td>
            <td>${parseFloat(magnitude).toFixed(3)}</td>
            <td class="column-actions">
                <div class="table-actions">
                    <button class="btn-icon btn-view" title="Ver detalles" data-id="${dataId}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Añadir evento para ver detalles
    const viewButtons = document.querySelectorAll('.btn-view');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const dataId = button.getAttribute('data-id');
            viewVibrationDetails(dataId);
        });
    });
}

// Actualizar información de paginación
function updateVibrationPagination(total, currentPage, totalPages) {
    const paginationInfo = document.getElementById('vibrationDataPageInfo');
    const prevButton = document.getElementById('prevVibrationPageBtn');
    const nextButton = document.getElementById('nextVibrationPageBtn');
    
    if (!paginationInfo || !prevButton || !nextButton) return;
    
    paginationInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    
    // Habilitar/deshabilitar botones de paginación
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
    
    // Configurar eventos de paginación con los filtros actuales
    const currentFilters = getVibrationFilters();
    
    prevButton.onclick = () => {
        if (currentPage > 1) {
            loadVibrationData(currentPage - 1, currentFilters);
        }
    };
    
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            loadVibrationData(currentPage + 1, currentFilters);
        }
    };
}

// Obtener filtros actuales para los datos de vibración
function getVibrationFilters() {
    return {
        machine_id: getGlobalState('selectedMachine'),
        sensor_id: getGlobalState('selectedSensor'),
        timeRange: getGlobalState('timeRange')
    };
}

// Ver detalles de datos de vibración
function viewVibrationDetails(dataId) {
    // Construir URL para el endpoint de detalles
    const url = `/api/dashboard-data?data_type=vibration&id=${dataId}`;
    
    showLoadingIndicator('Cargando detalles de vibración...');
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener detalles: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            hideLoadingIndicator();
            
            // Si tenemos un arreglo de items, tomar el primero (el que coincide con el ID)
            const item = data.items && data.items.length > 0 ? data.items[0] : data;
            
            // Verificar que tenemos datos válidos
            if (!item || !item.id) {
                showToast('No se encontraron detalles para este registro', 'warning');
                return;
            }
            
            // Adaptar a los nombres de campo del nuevo endpoint
            const detailData = {
                data_id: item.id || item.data_id,
                sensor_id: item.sensor_id,
                date: item.date || item.timestamp,
                acceleration_x: item.acceleration_x !== undefined ? item.acceleration_x : (item.accel_x || 0),
                acceleration_y: item.acceleration_y !== undefined ? item.acceleration_y : (item.accel_y || 0),
                acceleration_z: item.acceleration_z !== undefined ? item.acceleration_z : (item.accel_z || 0),
                severity: item.severity,
                magnitude: item.magnitude || 0
            };
            
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
                                        <div class="detail-value">${detailData.data_id}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Sensor ID:</div>
                                        <div class="detail-value">${detailData.sensor_id}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Fecha y Hora:</div>
                                        <div class="detail-value">${new Date(detailData.date).toLocaleString()}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Aceleración X:</div>
                                        <div class="detail-value">${detailData.acceleration_x !== null ? parseFloat(detailData.acceleration_x).toFixed(6) : 'N/A'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Aceleración Y:</div>
                                        <div class="detail-value">${detailData.acceleration_y !== null ? parseFloat(detailData.acceleration_y).toFixed(6) : 'N/A'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Aceleración Z:</div>
                                        <div class="detail-value">${detailData.acceleration_z !== null ? parseFloat(detailData.acceleration_z).toFixed(6) : 'N/A'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Severidad:</div>
                                        <div class="detail-value">${getSeverityText(detailData.severity)}</div>
                                    </div>
                                    <div class="detail-item">
                                        <div class="detail-label">Magnitud:</div>
                                        <div class="detail-value">${detailData.magnitude !== null ? parseFloat(detailData.magnitude).toFixed(6) : 'N/A'}</div>
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
            hideLoadingIndicator();
            console.error('Error al cargar detalles de datos de vibración:', error);
            showToast('Error al cargar detalles: ' + error.message, 'error');
        });
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

// Inicializar sección de datos de vibración
function initVibrationDataSection() {
    // Configurar botón de refrescar datos de vibración
    const refreshBtn = document.getElementById('refreshVibrationDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Mostrar indicador de carga
            showLoadingIndicator('Actualizando datos de vibración...');
            
            // Cargar datos de vibración con los filtros actuales del dashboard
            loadVibrationData(1, getVibrationFilters())
                .then(() => {
                    showToast('Datos de vibración actualizados', 'success');
                })
                .catch(error => {
                    console.error('Error al actualizar datos de vibración:', error);
                    showToast('Error al actualizar datos', 'error');
                })
                .finally(() => {
                    hideLoadingIndicator();
                });
        });
    }
    
    // Inicializar botones de paginación
    const prevButton = document.getElementById('prevVibrationPageBtn');
    const nextButton = document.getElementById('nextVibrationPageBtn');
    
    if (prevButton && nextButton) {
        // Los eventos de clic se configuran en updateVibrationPagination
        // para que usen los filtros actuales en cada momento
        
        // Deshabilitar inicialmente hasta que se carguen los datos
        prevButton.disabled = true;
        nextButton.disabled = true;
    }
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