// ==========================================================================
// VARIABLES GLOBALES DEL DASHBOARD
// ==========================================================================

// Estado del monitoreo
let monitoringInterval = null;
let isMonitoring = false;
let hasValidConfiguration = false;

// Control de actualizaciones del dashboard
const DASHBOARD_UPDATE_INTERVAL = 5000; // 5 segundos entre actualizaciones
let isDashboardUpdating = false;

// Variables para control de peticiones
let currentFetchController = null;

// ==========================================================================
// MANEJO CENTRALIZADO DE ERRORES
// ==========================================================================

/**
 * Función centralizada para manejar errores en peticiones AJAX
 * @param {Error} error - El objeto de error capturado
 * @param {string} context - Contexto donde ocurrió el error (nombre de la operación)
 * @param {boolean} showNotification - Indica si se debe mostrar una notificación al usuario
 * @param {Object} extraData - Datos adicionales a registrar con el error
 */
function handleAjaxError(error, context, showNotification = true, extraData = {}) {
    // Evitar errores de AbortError causados por cancelaciones intencionales
    if (error.name === 'AbortError') {
        logDashboard('debug', `Solicitud cancelada: ${context}`);
        return;
    }
    
    // Registrar error en el sistema de logs 
    AppLogger.error('ajax', `Error en ${context}`, {
        message: error.message,
        stack: error.stack,
        context: context,
        ...extraData
    });
    
    // Mostrar notificación al usuario si es necesario
    if (showNotification) {
        showToast(`Error en ${context}: ${error.message}`, 'error');
    }
    
    // Registrar evento para analíticas
    if (typeof trackEvent === 'function') {
        trackEvent('error', 'ajax_error', { context });
    }
}

// ==========================================================================
// INICIALIZACIÓN DEL DASHBOARD
// ==========================================================================

function initDashboard() {
    logDashboard('info', 'Iniciando inicialización del dashboard');
    const startTime = performance.now();
    
    try {
        // Limpiar listeners previos para evitar duplicación
        cleanupDashboardListeners();
        
        // Cancelar cualquier actualización pendiente 
        cancelDashboardUpdates();
        
        logDashboard('debug', 'Inicializando componentes de UI');
        initCustomUIComponents();
        
        logDashboard('debug', 'Inicializando filtros visuales');
        initVisualFilters();
        
        logDashboard('debug', 'Inicializando botones de exportación');
        initExportButtons();
        
        logDashboard('debug', 'Inicializando botón de ajuste de límites');
        initAdjustLimitsButton();
        
        // Inicializar nueva funcionalidad de monitoreo
        logDashboard('debug', 'Inicializando botón de monitoreo');
        initMonitoringButton();
        
        // Ocultar gráficos hasta que se carguen datos
        logDashboard('debug', 'Ocultando gráficos inicialmente');
        hideCharts();
        
        // Inicializar botones de filtros
        logDashboard('debug', 'Inicializando filtros');
        initApplyFiltersButton();
        
        // Comprobar si hay configuración válida
        logDashboard('debug', 'Verificando configuración inicial');
        hasValidConfiguration = checkValidConfiguration();
        
        // Cargar datos iniciales
        if (hasValidConfiguration) {
            logDashboard('debug', 'Configuración válida encontrada, cargando datos iniciales');
            hideNoConfigurationMessage();
            loadInitialData();
        } else {
            logDashboard('warn', 'No se encontró configuración válida, mostrando mensaje');
            showNoConfigurationMessage();
        }
        
        // Verificar estado de simulación
        logDashboard('debug', 'Verificando estado de simulación');
        checkSimulationStatus();
        
        // Inicializar alertas simplificadas
        logDashboard('debug', 'Cargando alertas iniciales');
        loadSimplifiedAlerts();
        
        logDashboard('info', 'Inicialización del dashboard completada', null, startTime);
    } catch (error) {
        logDashboard('error', 'Error durante la inicialización del dashboard:', error);
        showNoConfigurationMessage(`Error: ${error.message}`);
    }
}

// ==========================================================================
// INICIALIZACIÓN DE LA SECCIÓN DE CONFIGURACIÓN
// ==========================================================================

// Inicializar la sección de configuración
function initConfig() {
    logConfig('info', 'Inicializando sección de configuración');
    
    try {
        // Inicializar sistema de pestañas de configuración
        initConfigTabs();
        
        // Inicializar formularios y tablas
        initMachineTab();
        initSensorTab();
        initModelTab();
        initLimitsTab();
        
        showToast('Sección de configuración inicializada', 'success');
        logConfig('info', 'Sección de configuración inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar sección de configuración', error);
        showToast('Error al inicializar configuración', 'error');
    }
}

// Inicializar sistema de pestañas de la sección de configuración
function initConfigTabs() {
    const tabItems = document.querySelectorAll('.config-tabs .tab-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Manejar clic en pestañas
    tabItems.forEach(tab => {
        addDashboardListener(tab, 'click', (e) => {
            logDashboard('debug', 'Tab click detectado');
            
            // Evitar procesamiento múltiple del evento y propagación
            e.preventDefault();
            e.stopPropagation();
            
            const tabId = tab.getAttribute('data-tab');
            logDashboard('debug', `Cambiando a pestaña: ${tabId}`);
            
            // Actualizar clases activas en pestañas
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Actualizar contenido visible
            tabContents.forEach(content => {
                if (content.id === tabId + 'Content') {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
            
            // Actualizar hash en la URL de forma segura sin causar otra navegación
            const currentHash = window.location.hash;
            const newHash = '#configuracion:' + tabId;
            
            if (currentHash !== newHash) {
                logDashboard('debug', `Actualizando hash a: ${newHash}`);
                try {
                    // Usar replaceState para no añadir a la historia de navegación
                    history.replaceState(null, null, newHash);
                } catch(e) {
                    logDashboard('warn', 'Error al actualizar history API:', e);
                }
            }
        });
    });
}

// Inicializar pestaña de máquinas
function initMachineTab() {
    // La funcionalidad específica para la pestaña de máquinas
    logConfig('debug', 'Inicializando pestaña de máquinas');
}

// Inicializar pestaña de sensores
function initSensorTab() {
    // La funcionalidad específica para la pestaña de sensores
    logConfig('debug', 'Inicializando pestaña de sensores');
}

// Inicializar pestaña de modelos
function initModelTab() {
    // La funcionalidad específica para la pestaña de modelos
    logConfig('debug', 'Inicializando pestaña de modelos');
}

// Inicializar pestaña de límites
function initLimitsTab() {
    // La funcionalidad específica para la pestaña de límites
    logConfig('debug', 'Inicializando pestaña de límites');
}

// Manejar cambios en el estado global
function handleGlobalStateChange(e) {
    const { key, value } = e.detail;
    
    // Actualizaciones basadas en cambios específicos
    if (key === 'selectedMachine' || key === 'selectedSensor' || key === 'timeRange') {
        // Usar la versión debounced para evitar múltiples actualizaciones
        debouncedDashboardUpdate();
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
}

// Manejar eventos de cambio en dropdowns
function handleDropdownChangeEvent(e) {
    const { dropdownId, value, text } = e.detail;
    logDashboard('debug', `Dropdown changed: ${dropdownId} - ${value}`);
    
    // Actualizar estado global según el dropdown
    if (dropdownId === 'machineDropdown') {
        setGlobalState('selectedMachine', value);
        loadSensors(value);
    } else if (dropdownId === 'sensorDropdown') {
        setGlobalState('selectedSensor', value);
    } else if (dropdownId === 'timeRangeDropdown') {
        setGlobalState('timeRange', value);
    }
    
    // Actualizar datos del dashboard si están disponibles los filtros
    updateDashboardData();
}

// Inicializar dropdowns personalizados
function initCustomDropdowns() {
    // Registrar el listener para dropdown-change
    addDashboardListener(document, 'dropdown-change', handleDropdownChangeEvent);
}

// Inicializar colapso de filtros
function initCollapseFilters() {
    const expandBtn = document.getElementById('expandFiltersBtn');
    const filterPanel = document.querySelector('.filter-panel');
    
    if (expandBtn && filterPanel) {
        // Restaurar estado anterior si existe
        const savedState = localStorage.getItem('filterPanelState');
        if (savedState === 'collapsed') {
            filterPanel.classList.remove('show');
            const icon = expandBtn.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-chevron-down';
                expandBtn.setAttribute('title', 'Expandir filtros');
            }
        }
        
        addDashboardListener(expandBtn, 'click', () => {
            // Toggle de la clase show
            filterPanel.classList.toggle('show');
            
            // Cambiar icono
            const icon = expandBtn.querySelector('i');
            if (icon) {
                if (filterPanel.classList.contains('show')) {
                    icon.className = 'fas fa-chevron-up';
                    expandBtn.setAttribute('title', 'Minimizar filtros');
                    // Guardar estado en localStorage
                    localStorage.setItem('filterPanelState', 'expanded');
                } else {
                    icon.className = 'fas fa-chevron-down';
                    expandBtn.setAttribute('title', 'Expandir filtros');
                    // Guardar estado en localStorage
                    localStorage.setItem('filterPanelState', 'collapsed');
                }
            }
            
            // Disparar evento para que otros componentes puedan reaccionar
            document.dispatchEvent(new CustomEvent('filterPanelToggled', {
                detail: { isExpanded: filterPanel.classList.contains('show') }
            }));
        });
    }
}

// Inicializar dropdowns en gráficos
function initChartDropdowns() {
    const chartDropdowns = document.querySelectorAll('.chart-dropdown');
    
    chartDropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.chart-dropdown-toggle');
        
        if (toggle) {
            addDashboardListener(toggle, 'click', (e) => {
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
    addDashboardListener(document, 'click', () => {
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
        addDashboardListener(show2SigmaToggle, 'change', () => {
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
        
        addDashboardListener(show3SigmaToggle, 'change', () => {
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
    logDashboard('info', 'Cargando datos iniciales');
    const startTime = performance.now();
    
    logDashboard('debug', 'Iniciando carga de máquinas');
    const machinesStartTime = performance.now();
    
    // Cargar lista de máquinas
    loadMachines()
        .then(machines => {
            logDashboard('debug', `${machines.length} máquinas cargadas correctamente`, null, machinesStartTime);
            
            if (machines && machines.length > 0) {
                // Seleccionar primera máquina por defecto
                const firstMachine = machines[0].machine_id;
                setGlobalState('selectedMachine', firstMachine);
                
                // Cargar sensores asociados a la primera máquina
                logDashboard('debug', `Cargando sensores para máquina ${firstMachine}`);
                const sensorsStartTime = performance.now();
                
                return loadSensors(firstMachine)
                    .then(sensors => {
                        logDashboard('debug', `${sensors.length} sensores cargados correctamente`, null, sensorsStartTime);
                        
                        if (sensors && sensors.length > 0) {
                            // Seleccionar primer sensor por defecto
                            const firstSensor = sensors[0].sensor_id;
                            setGlobalState('selectedSensor', firstSensor);
                            
                            // Comprobar nuevamente si hay configuración válida
                            logDashboard('debug', 'Verificando configuración después de cargar datos iniciales');
                            hasValidConfiguration = checkValidConfiguration();
                            
                            if (hasValidConfiguration) {
                                logDashboard('debug', 'Configuración válida, actualizando datos del dashboard');
                                return updateDashboardData();
                            } else {
                                logDashboard('warn', 'No se encontró configuración válida después de cargar datos iniciales');
                                showNoConfigurationMessage();
                            }
                        } else {
                            logDashboard('warn', 'No se encontraron sensores asociados a la máquina');
                            showNoConfigurationMessage('No hay sensores configurados para esta máquina');
                        }
                    });
            } else {
                logDashboard('warn', 'No se encontraron máquinas configuradas');
                showNoConfigurationMessage('No hay máquinas configuradas en el sistema');
            }
        })
        .catch(error => {
            logDashboard('error', 'Error al cargar datos iniciales:', error);
            showNoConfigurationMessage(`Error: ${error.message}`);
        })
        .finally(() => {
            logDashboard('info', 'Proceso de carga de datos iniciales completado', null, startTime);
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
    logDashboard('debug', 'Cargando lista de máquinas');
    const startTime = performance.now();
    
    return fetch('/api/machines')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar máquinas: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logDashboard('debug', `${data.length} máquinas cargadas correctamente`, null, startTime);
            return data;
        })
        .catch(error => {
            logDashboard('error', 'Error al cargar máquinas:', error);
            throw error;
        });
}

// Cargar sensores para una máquina
function loadSensors(machineId) {
    if (!machineId) {
        logDashboard('warn', 'Se intentó cargar sensores sin proporcionar ID de máquina');
        return Promise.resolve([]);
    }
    
    logDashboard('debug', `Cargando sensores para máquina ${machineId}`);
    const startTime = performance.now();
    
    return fetch(`/api/machines/${machineId}/sensors`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar sensores: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logDashboard('debug', `${data.length} sensores cargados correctamente para máquina ${machineId}`, null, startTime);
            
            // Actualizar dropdown de sensores
            updateSensorDropdown(data);
            
            return data;
        })
        .catch(error => {
            logDashboard('error', `Error al cargar sensores para máquina ${machineId}:`, error);
            throw error;
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
        sensorItem.textContent = `${sensor.sensor_name} (${sensor.position})`;
        
        addDashboardListener(sensorItem, 'click', () => {
            document.getElementById('sensorDropdown').value = sensor.sensor_id;
            document.getElementById('sensorName').textContent = sensor.sensor_name;
            document.getElementById('sensorPosition').textContent = sensor.position;
            updateCharts(sensor.sensor_id);
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
        sensorDropdownText.textContent = `${firstSensor.sensor_name} (${firstSensor.position})`;
    } else {
        // Mantener la selección actual y actualizar el texto
        const sensor = sensors.find(s => s.sensor_id === selectedSensor);
        sensorDropdownText.textContent = `${sensor.sensor_name} (${sensor.position})`;
    }
}

// Actualizar datos del dashboard
async function updateDashboardData() {
    // Redirigir directamente a la versión debounced
    debouncedDashboardUpdate();
}

// Crear una versión debounced de la actualización del dashboard con el sistema unificado
const debouncedDashboardUpdate = debounce(
    async function executeDashboardUpdate() {
        // Si ya hay una actualización en curso, no iniciar otra
        if (isDashboardUpdating) {
            logDashboard('debug', 'Actualización del dashboard ya en curso, ignorando solicitud');
            return;
        }
        
        const startTime = performance.now();
        logDashboard('debug', 'Ejecutando actualización de dashboard debounced');
        
        // Verificar si debemos permitir esta actualización basada en el tiempo transcurrido
        if (!shouldUpdate('dashboard_update', DASHBOARD_UPDATE_INTERVAL)) {
            logDashboard('debug', `Actualización demasiado frecuente, ignorando`);
            return;
        }
        
        // Cancelar solicitud anterior si existe
        if (currentFetchController) {
            logDashboard('debug', 'Cancelando petición anterior');
            currentFetchController.abort();
            currentFetchController = null;
        }
        
        isDashboardUpdating = true;
        
        // Crear nuevo controlador para esta petición
        currentFetchController = new AbortController();
        const signal = currentFetchController.signal;
        
        try {
            // Verificar si hay una configuración válida
            if (!hasValidConfiguration) {
                logDashboard('warn', 'No hay configuración válida, omitiendo actualización');
                showNoConfigurationMessage();
                isDashboardUpdating = false;
                return;
            }
            
            // Obtener filtros actuales
            const filters = getVibrationFilters();
            logDashboard('debug', 'Filtros actuales:', filters);
            
            // Verificar que tengamos filtros válidos
            if (!filters.machine_id || !filters.sensor_id) {
                logDashboard('debug', 'Filtros incompletos, no se puede actualizar');
                // Ocultar gráficos cuando no hay selección
                hideCharts();
                isDashboardUpdating = false;
                return;
            }
            
            // Verificar si los filtros han cambiado
            const cacheKey = JSON.stringify(filters);
            const cache = getGlobalState('dashboardCache') || {};
            const now = Date.now();
            
            if (cache[cacheKey] && now - cache[cacheKey].timestamp < DASHBOARD_UPDATE_INTERVAL) {
                logDashboard('debug', 'Usando datos en caché para evitar solicitud repetida');
                updateDashboardUI(cache[cacheKey].data);
                isDashboardUpdating = false;
                logDashboard('info', 'Actualización desde caché completada', null, startTime);
                return;
            }
            
            // Mostrar indicador de carga
            logDashboard('debug', 'Mostrando indicador de carga');
            showLoadingIndicator('Actualizando datos...');
            
            // Realizar peticiones en paralelo con señal de cancelación
            logDashboard('debug', 'Iniciando peticiones de datos');
            const fetchStartTime = performance.now();
            
            Promise.all([
                fetchVibrationData(filters, signal),
                fetchAlerts(signal)
            ])
            .then(([vibrationData, alerts]) => {
                logDashboard('debug', 'Peticiones completadas correctamente', null, fetchStartTime);
                logDashboard('debug', `Datos recibidos: ${vibrationData ? vibrationData.length : 0} registros de vibración, ${alerts ? alerts.length : 0} alertas`);
                
                // Procesar datos
                logDashboard('debug', 'Procesando datos de vibración');
                const processStartTime = performance.now();
                const processedData = processVibrationData(vibrationData);
                logDashboard('debug', 'Procesamiento de datos completado', null, processStartTime);
                
                // Actualizar caché
                logDashboard('debug', 'Actualizando caché de datos');
                cache[cacheKey] = {
                    data: processedData,
                    timestamp: now
                };
                setGlobalState('dashboardCache', cache);
                
                // Actualizar UI
                logDashboard('debug', 'Actualizando interfaz de usuario');
                const uiUpdateStartTime = performance.now();
                updateDashboardUI(processedData);
                logDashboard('debug', 'Actualización de UI completada', null, uiUpdateStartTime);
                
                // Actualizar alertas
                if (alerts) {
                    logDashboard('debug', 'Actualizando contadores de alertas');
                    updateAlertCounters(alerts);
                    logDashboard('debug', 'Actualizando tabla de alertas');
                    updateAlertsTable(alerts);
                }
                
                logDashboard('info', 'Actualización del dashboard completada', null, startTime);
            })
            .catch(error => {
                // Si no es un error de cancelación, lo manejamos
                if (error.name !== 'AbortError') {
                    // Usar el sistema centralizado de manejo de errores
                    handleAjaxError(error, 'actualización del dashboard', true, {
                        filters: filters,
                        elapsedTime: performance.now() - startTime
                    });
                    
                    // Ocultar gráficos en caso de error
                    hideCharts();
                } else {
                    logDashboard('debug', 'Actualización del dashboard cancelada');
                }
            })
            .finally(() => {
                // Ocultar indicador de carga
                hideLoadingIndicator();
                
                // Marcar como no actualizando
                isDashboardUpdating = false;
                currentFetchController = null;
            });
        } catch (error) {
            // Para errores que ocurren antes de la petición asíncrona
            handleAjaxError(error, 'preparación de actualización', true);
            hideLoadingIndicator();
            isDashboardUpdating = false;
            currentFetchController = null;
        }
    },
    Math.floor(DASHBOARD_UPDATE_INTERVAL / 3), // Establecer delay como 1/3 del intervalo mínimo
    { 
        leading: false,
        trailing: true,
        context: 'dashboard' 
    }
);

// Cancelar todas las actualizaciones pendientes del dashboard
function cancelDashboardUpdates() {
    logDashboard('info', 'Cancelando actualizaciones del dashboard');
    const startTime = performance.now();
    
    // Cancelar timers relacionados con dashboard
    cancelPendingTimers('dashboard');
    
    // Cancelar solicitud en curso
    if (currentFetchController) {
        currentFetchController.abort();
        currentFetchController = null;
    }
    
    isDashboardUpdating = false;
    
    logDashboard('info', 'Actualizaciones del dashboard canceladas', null, startTime);
}

// Función auxiliar para actualizar la UI del dashboard
function updateDashboardUI(data) {
    console.log('updateDashboardUI: Iniciando actualización de UI');
    
    try {
        // Actualizar gráficos
        if (data.charts) {
            Object.entries(data.charts).forEach(([axis, chartData]) => {
                updateChart(axis, chartData);
            });
        }
        
        // Actualizar valores estadísticos
        if (data.stats) {
            updateStatisticalDisplayValues(data.stats);
        }
        
        // Mostrar gráficos si hay datos
        if (Object.keys(data.charts || {}).length > 0) {
            showCharts();
        }
        
        console.log('updateDashboardUI: Actualización completada');
    } catch (error) {
        console.error('updateDashboardUI: Error al actualizar UI:', error);
    }
}

// Función para verificar si hay una configuración válida
function checkValidConfiguration() {
    const cache = getGlobalState('dashboardCache') || {};
    let hasValidSetup = false;
    
    // Verificar si hay al menos una máquina con sensor asignado
    if (!cache.machines || cache.machines.length === 0) {
        logDashboard('debug', 'No hay máquinas configuradas');
        return false;
    }
    
    // Obtener datos de sensores desde el caché
    const sensors = cache.sensors || {};
    
    // Verificar cada máquina para encontrar una configuración válida
    for (const machine of cache.machines) {
        if (machine.sensor_id) {
            // Buscar información del sensor para esta máquina
            if (sensors[machine.sensor_id] && sensors[machine.sensor_id].model_id) {
                hasValidSetup = true;
                logDashboard('debug', `Configuración válida encontrada: Máquina ${machine.machine_id} con sensor ${machine.sensor_id} y modelo ${sensors[machine.sensor_id].model_id}`);
                break;
            }
        }
    }
    
    // Actualizar la interfaz según el estado de configuración
    if (hasValidSetup) {
        logDashboard('info', 'Configuración válida detectada, actualizando interfaz');
        hideNoConfigurationMessage();
        showCharts();
        updateDashboardData(); // Actualizar datos para mostrar información actual
    } else {
        logDashboard('warn', 'No se encontró configuración válida');
        showNoConfigurationMessage();
        hideCharts();
    }
    
    return hasValidSetup;
}

// Procesamiento de datos de vibración
function processVibrationData(vibrationData) {
    logDashboard('info', 'Procesando datos de vibración');
    const startTime = performance.now();
    
    if (!vibrationData || vibrationData.length === 0) {
        logDashboard('warn', 'No hay datos de vibración para procesar');
        return { charts: {}, stats: {} };
    }
    
    logDashboard('debug', `Procesando ${vibrationData.length} registros de vibración`);
    
    try {
        // Asegurarse de que los datos estén ordenados por timestamp
        logDashboard('debug', 'Ordenando datos por timestamp');
        vibrationData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Crear un logger de bucle para monitorear el progreso
        const loopLogger = createLoopLogger('DASHBOARD', 'procesamiento-datos', vibrationData.length);
        const loopStartTime = loopLogger.start();
        
        // Actualizar datos de gráficos
        const timestamps = [];
        const xValues = [];
        const yValues = [];
        const zValues = [];
        const statusValues = [];
        
        // Recorrer los datos (monitoreando el rendimiento)
        for (let i = 0; i < vibrationData.length; i++) {
            const item = vibrationData[i];
            
            // Registrar progreso periódicamente
            loopLogger.progress(i, item);
            
            // Procesar item
            timestamps.push(new Date(item.date).toLocaleTimeString());
            xValues.push(item.acceleration_x !== undefined ? parseFloat(item.acceleration_x) : null);
            yValues.push(item.acceleration_y !== undefined ? parseFloat(item.acceleration_y) : null);
            zValues.push(item.acceleration_z !== undefined ? parseFloat(item.acceleration_z) : null);
            statusValues.push(item.severity !== undefined ? parseInt(item.severity) : 0);
        }
        
        // Registrar finalización del bucle
        loopLogger.end(loopStartTime);
        
        // Calcular estadísticas (valores mínimos, máximos, medios)
        logDashboard('debug', 'Calculando estadísticas de los datos');
        const statsStartTime = performance.now();
        
        const calculateStats = (values) => {
            if (!values || values.length === 0) return null;
            
            // Filtrar valores null o undefined
            const filteredValues = values.filter(v => v !== null && v !== undefined);
            if (filteredValues.length === 0) return null;
            
            const min = Math.min(...filteredValues);
            const max = Math.max(...filteredValues);
            const sum = filteredValues.reduce((acc, val) => acc + val, 0);
            const mean = sum / filteredValues.length;
            
            // Calcular desviación estándar
            const squaredDiffs = filteredValues.map(val => Math.pow(val - mean, 2));
            const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / filteredValues.length;
            const stdDev = Math.sqrt(avgSquaredDiff);
            
            // Calcular límites 2-sigma y 3-sigma
            return {
                min,
                max,
                mean,
                stdDev,
                sigma2: {
                    lower: mean - 2 * stdDev,
                    upper: mean + 2 * stdDev
                },
                sigma3: {
                    lower: mean - 3 * stdDev,
                    upper: mean + 3 * stdDev
                }
            };
        };
        
        const stats = {
            x: calculateStats(xValues),
            y: calculateStats(yValues),
            z: calculateStats(zValues)
        };
        
        logDashboard('debug', 'Cálculo de estadísticas completado', null, statsStartTime);
        
        // Preparar datos de retorno
        const result = {
            charts: {
                x: {
                    timestamps,
                    values: xValues,
                    status: statusValues
                },
                y: {
                    timestamps,
                    values: yValues,
                    status: statusValues
                },
                z: {
                    timestamps,
                    values: zValues,
                    status: statusValues
                }
            },
            stats
        };
        
        logDashboard('info', 'Procesamiento de datos completado', null, startTime);
        return result;
    } catch (error) {
        logDashboard('error', 'Error durante el procesamiento de datos:', error);
        return { charts: {}, stats: {} };
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
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.innerHTML = '&times;';
        alertEl.appendChild(closeBtn);
        
        addDashboardListener(closeBtn, 'click', () => {
            alertEl.classList.remove('show');
            setTimeout(() => {
                alertEl.remove();
            }, 300);
        });
        
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
    console.log('Inicializando botón de monitoreo...');
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    
    if (!startMonitoringBtn) {
        console.error('Error: No se encontró el botón de monitoreo');
        return;
    }
    
    // Estado actual del monitoreo
    const updateButtonState = () => {
        const monitoringStatus = document.getElementById('monitoringStatus');
        const statusText = monitoringStatus ? monitoringStatus.querySelector('.status-text') : null;
        const statusIndicator = monitoringStatus ? monitoringStatus.querySelector('.status-indicator') : null;
        
        if (isMonitoring) {
            startMonitoringBtn.innerHTML = '<i class="fas fa-stop-circle mr-2"></i> Detener Monitoreo';
            startMonitoringBtn.classList.remove('btn-primary');
            startMonitoringBtn.classList.add('btn-danger');
            
            if (statusText) statusText.textContent = 'Monitoreo activo';
            if (statusIndicator) statusIndicator.classList.add('active');
        } else {
            startMonitoringBtn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> Iniciar Monitoreo';
            startMonitoringBtn.classList.remove('btn-danger');
            startMonitoringBtn.classList.add('btn-primary');
            
            if (statusText) statusText.textContent = 'Monitoreo detenido';
            if (statusIndicator) statusIndicator.classList.remove('active');
        }
    };
    
    // Verificar si hay una configuración válida
    checkValidConfiguration().then(isValid => {
        hasValidConfiguration = isValid;
        
        // Mostrar advertencia si no hay configuración válida
        const configWarning = document.getElementById('configurationWarning');
        if (configWarning) {
            if (!hasValidConfiguration) {
                configWarning.classList.remove('d-none');
            } else {
                configWarning.classList.add('d-none');
            }
        }
        
        // Actualizar estado inicial del botón
        updateButtonState();
    });
    
    // Evento de clic para iniciar/detener monitoreo
    addDashboardListener(startMonitoringBtn, 'click', () => {
        if (!hasValidConfiguration) {
            showToast('Configure al menos una máquina con sensor y modelo para iniciar el monitoreo', 'warning');
            
            // Ofrecer ir a configuración
            if (confirm('¿Desea ir a la sección de configuración para configurar una máquina?')) {
                navigateTo('configuracion');
            }
            return;
        }
        
        if (isMonitoring) {
            // Detener monitoreo
            stopMonitoring();
            showToast('Monitoreo detenido', 'info');
        } else {
            // Iniciar monitoreo
            startMonitoring();
            showToast('Monitoreo iniciado', 'success');
        }
        
        // Actualizar estado del botón
        updateButtonState();
    });
}

// Iniciar monitoreo
function startMonitoring() {
    if (isMonitoring) return;
    
    logDashboard('info', 'Iniciando monitoreo');
    
    // Actualizar estado
    isMonitoring = true;
    setGlobalState('monitoring', true);
    
    // Configurar intervalo de monitoreo usando throttling para evitar sobrecarga
    const throttledUpdateFunction = throttle(
        updateDashboardData,
        10000, // 10 segundos entre actualizaciones throttled
        { context: 'dashboard_monitoring' }
    );
    
    // Iniciar intervalo
    monitoringInterval = setInterval(throttledUpdateFunction, 5000);
    
    // Actualizar UI
    document.getElementById('startMonitoringBtn').innerHTML = '<i class="fas fa-stop-circle mr-2"></i> Detener Monitoreo';
    document.getElementById('startMonitoringBtn').classList.replace('btn-primary', 'btn-danger');
    
    // Realizar una actualización inmediata
    updateDashboardData();
    
    logDashboard('info', 'Monitoreo iniciado');
    showToast('Monitoreo iniciado', 'success');
}

// Detener monitoreo
function stopMonitoring() {
    if (!isMonitoring) return;
    
    logDashboard('info', 'Deteniendo monitoreo');
    
    // Limpiar intervalo
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    // Cancelar cualquier actualización pendiente
    cancelDashboardUpdates();
    
    // Actualizar estado
    isMonitoring = false;
    setGlobalState('monitoring', false);
    
    // Actualizar UI
    document.getElementById('startMonitoringBtn').innerHTML = '<i class="fas fa-play-circle mr-2"></i> Iniciar Monitoreo';
    document.getElementById('startMonitoringBtn').classList.replace('btn-danger', 'btn-primary');
    
    logDashboard('info', 'Monitoreo detenido');
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
    console.log('Actualizando valores estadísticos en la interfaz...');
    
    // Obtener estadísticas del estado global
    const stats = getGlobalState('stats');
    
    if (!stats) {
        console.warn('No hay estadísticas disponibles en el estado global');
        return;
    }
    
    try {
        // Formato para valores numéricos
        const formatValue = (value) => value.toFixed(2);
        
        // Actualizar todos los ejes de forma consistente
        ['x', 'y', 'z'].forEach(axis => {
            if (!stats[axis]) {
                console.warn(`No hay datos para el eje ${axis.toUpperCase()}`);
                return;
            }
            
            // Actualizar límites 2-sigma
            if (stats[axis].sigma2) {
                updateDisplayValue(
                    `${axis}2SigmaLowerDisplay`, 
                    formatValue(stats[axis].sigma2.lower)
                );
                
                updateDisplayValue(
                    `${axis}2SigmaUpperDisplay`, 
                    formatValue(stats[axis].sigma2.upper)
                );
            }
            
            // Actualizar límites 3-sigma
            if (stats[axis].sigma3) {
                updateDisplayValue(
                    `${axis}3SigmaLowerDisplay`, 
                    formatValue(stats[axis].sigma3.lower)
                );
                
                updateDisplayValue(
                    `${axis}3SigmaUpperDisplay`, 
                    formatValue(stats[axis].sigma3.upper)
                );
            }
        });
        
        // Añadir animación para destacar cambios
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(el => {
            el.classList.add('value-updated');
            setTimeout(() => {
                el.classList.remove('value-updated');
            }, 1000);
        });
        
        console.log('Valores estadísticos actualizados correctamente');
    } catch (error) {
        console.error('Error al actualizar valores estadísticos:', error);
    }
    
    // Función auxiliar para actualizar un único elemento
    function updateDisplayValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `${value}<span class="stat-unit">m/s²</span>`;
        } else {
            console.warn(`Elemento no encontrado: ${elementId}`);
        }
    }
}

// ==========================================================================
// BOTONES Y ACCIONES
// ==========================================================================

// Inicializar botones de exportación
function initExportButtons() {
    // Exportación a PDF para cada eje
    const exportPdfXBtn = document.getElementById('exportPdfX');
    if (exportPdfXBtn) {
        addDashboardListener(exportPdfXBtn, 'click', () => {
            exportAxisToPDF('x');
        });
    }
    
    const exportPdfYBtn = document.getElementById('exportPdfY');
    if (exportPdfYBtn) {
        addDashboardListener(exportPdfYBtn, 'click', () => {
            exportAxisToPDF('y');
        });
    }
    
    const exportPdfZBtn = document.getElementById('exportPdfZ');
    if (exportPdfZBtn) {
        addDashboardListener(exportPdfZBtn, 'click', () => {
            exportAxisToPDF('z');
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
        addDashboardListener(adjustLimitsBtn, 'click', (event) => {
            event.preventDefault();
            console.log('Redirigiendo a configuración de límites');
            
            // Usar la notación correcta para configuración y subpestaña de límites
            window.location.hash = 'configuracion:limites';
            
            // Eliminar el timeout innecesario y usar un enfoque más directo
            // para activar la pestaña cuando la navegación esté completa
            document.addEventListener('pageChanged', function activateTab(e) {
                if (e.detail.to === 'configuracion:limites') {
                    const limiteTab = document.querySelector('.tab-item[data-tab="limites"]');
                    if (limiteTab && !limiteTab.classList.contains('active')) {
                        limiteTab.click();
                    }
                    // Remover el listener después de usarlo para evitar duplicados
                    document.removeEventListener('pageChanged', activateTab);
                }
            }, { once: true });
        });
    }
}

// Inicializar botón de aplicar filtros
function initApplyFiltersButton() {
    console.log('Inicializando botón de filtros...');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    
    if (!applyFiltersBtn) {
        console.error('Error: No se encontró el botón de aplicar filtros');
        return;
    }
    
    // Evento de clic para aplicar filtros
    addDashboardListener(applyFiltersBtn, 'click', () => {
        // Leer valores de los filtros desde los elementos del DOM
        const selectedMachine = document.getElementById('selectedMachineText').getAttribute('data-value') || '';
        const selectedSensor = document.getElementById('selectedSensorText').getAttribute('data-value') || '';
        const selectedTimeRange = document.getElementById('selectedTimeRangeText').getAttribute('data-value') || '24h';
        
        // Actualizar estado global con los valores de los filtros
        setGlobalState('selectedMachine', selectedMachine);
        setGlobalState('selectedSensor', selectedSensor);
        setGlobalState('timeRange', selectedTimeRange);
        
        // Actualizar las opciones de visualización
        const show2Sigma = document.getElementById('show2Sigma').checked;
        const show3Sigma = document.getElementById('show3Sigma').checked;
        
        setGlobalState('chartOptions', {
            show2Sigma,
            show3Sigma
        });
        
        // Actualizar datos del dashboard con los nuevos filtros
        updateDashboardData();
        
        // Mostrar notificación
        showToast('Filtros aplicados correctamente', 'success');
    });
    
    // Inicializar dropdowns
    initDashboardDropdowns();
}

// Inicializar dropdowns personalizados
function initDashboardDropdowns() {
    // Dropdown de máquinas
    initDropdown('machineDropdown', (value, text) => {
        // Cargar sensores cuando se selecciona una máquina
        if (value !== undefined) {
            loadSensors(value);
        }
    });
    
    // Dropdown de sensores
    initDropdown('sensorDropdown');
    
    // Dropdown de rango de tiempo
    initDropdown('timeRangeDropdown');
}

// Inicializar un dropdown específico
function initDropdown(dropdownId, callback) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const toggle = dropdown.querySelector('.filter-dropdown-toggle');
    const menu = dropdown.querySelector('.filter-dropdown-menu');
    const selectedText = dropdown.querySelector('span[id$="Text"]');
    
    if (!toggle || !menu || !selectedText) return;
    
    // Toggle del menú
    addDashboardListener(toggle, 'click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
        
        // Cerrar otros dropdowns abiertos
        document.querySelectorAll('.filter-dropdown-menu.show').forEach(openMenu => {
            if (openMenu !== menu) {
                openMenu.classList.remove('show');
            }
        });
    });
    
    // Selección de items usando delegación de eventos
    addDashboardListener(menu, 'click', (e) => {
        const item = e.target.closest('.filter-dropdown-item');
        if (!item) return;
        
        // Obtener valor seleccionado
        const value = item.getAttribute('data-value');
        const text = item.textContent;
        
        // Actualizar texto visible
        selectedText.textContent = text;
        selectedText.setAttribute('data-value', value);
        
        // Marcar item seleccionado
        menu.querySelectorAll('.filter-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        
        // Cerrar dropdown
        menu.classList.remove('show');
        
        // Ejecutar callback si existe
        if (typeof callback === 'function') {
            callback(value, text);
        }
    });
    
    // Cerrar dropdown al hacer clic fuera
    addDashboardListener(document, 'click', (e) => {
        if (!dropdown.contains(e.target)) {
            menu.classList.remove('show');
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

// ==========================================================================
// TABLA DE ALERTAS SIMPLIFICADA
// ==========================================================================

// Cargar alertas simplificadas
function loadSimplifiedAlerts() {
    showLoadingIndicator('Cargando alertas...');
    
    // Aplicar filtros globales si están disponibles
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Construir URL con filtros
    let url = '/api/alerts?';
    
    if (selectedSensor) {
        url += `sensor_id=${selectedSensor}&`;
    } else if (selectedMachine) {
        url += `machine_id=${selectedMachine}&`;
    }
    
    // Añadir filtro de tiempo si está seleccionado
    if (timeRange) {
        const currentTime = new Date();
        let startTime = new Date(currentTime);
        
        switch(timeRange) {
            case '1h':
                startTime.setHours(currentTime.getHours() - 1);
                break;
            case '6h':
                startTime.setHours(currentTime.getHours() - 6);
                break;
            case '24h':
                startTime.setDate(currentTime.getDate() - 1);
                break;
            case '7d':
                startTime.setDate(currentTime.getDate() - 7);
                break;
        }
        
        url += `start_date=${startTime.toISOString()}&end_date=${currentTime.toISOString()}&`;
    }
    
    // Eliminar el último '&' si existe
    if (url.endsWith('&')) {
        url = url.slice(0, -1);
    }
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en la respuesta: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Actualizar contadores de alertas
            updateAlertCounters(data);
            
            // Actualizar tabla de alertas con los datos obtenidos
            updateAlertsTable(data);
            hideLoadingIndicator();
        })
        .catch(err => {
            console.error('Error al cargar alertas:', err);
            hideLoadingIndicator();
            showToast('Error al cargar historial de alertas', 'error');
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
        cell.colSpan = 5; // Actualizado a 5 columnas
        cell.textContent = 'No hay alertas registradas';
        cell.className = 'text-center';
        return;
    }
    
    // Agregar filas de alertas
    for (const alert of alerts) {
        const row = tableBody.insertRow();
        
        // Determinar el nivel de alerta y aplicar clase según el error_type numérico
        const errorType = parseInt(alert.error_type);
        switch (errorType) {
            case 3:
                row.classList.add('level-3');
                break;
            case 2:
                row.classList.add('level-2');
                break;
            case 1:
                row.classList.add('level-1');
                break;
            default:
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
        
        // Data ID
        const dataIdCell = row.insertCell();
        if (alert.data_id) {
            // Si hay data_id, mostrar como un enlace para ver detalles
            dataIdCell.innerHTML = `<a href="#" class="view-vibration-data" data-alert-id="${alert.log_id}" data-id="${alert.data_id}">${alert.data_id}</a>`;
        } else {
            dataIdCell.textContent = 'N/A';
        }
        
        // Tipo de Error
        const errorTypeCell = row.insertCell();
        const severityText = getSeverityText(errorType);
        errorTypeCell.innerHTML = `<span class="status-level${errorType}">${severityText}</span>`;
    }
    
    // Añadir manejadores de eventos para ver datos de vibración usando delegación
    const alertsTable = document.getElementById('alertsTable');
    if (alertsTable) {
        // Remover listener previo si existe
        const tableWrapper = alertsTable.closest('.table-wrapper') || alertsTable.parentElement;
        if (tableWrapper) {
            addDashboardListener(tableWrapper, 'click', (e) => {
                const link = e.target.closest('.view-vibration-data');
                if (!link) return;
                
                e.preventDefault();
                const alertId = link.getAttribute('data-alert-id');
                const dataId = link.getAttribute('data-id');
                viewAlertDetails(alertId, dataId);
            });
        }
    }
    
    // Inicializar el botón de actualizar
    const refreshBtn = document.getElementById('refreshAlertsTable');
    if (refreshBtn) {
        addDashboardListener(refreshBtn, 'click', loadSimplifiedAlerts);
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

// Obtener filtros actuales para los datos de vibración
function getVibrationFilters() {
    const machineId = getGlobalState('selectedMachine');
    const sensorId = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Crear objeto de filtros con solo valores válidos
    const filters = {
        timeRange: timeRange
    };
    
    // Añadir machine_id solo si no es null, undefined o string vacío
    if (machineId !== null && machineId !== undefined && machineId !== "") {
        filters.machine_id = machineId;
    }
    
    // Añadir sensor_id solo si no es null, undefined o string vacío
    if (sensorId !== null && sensorId !== undefined && sensorId !== "") {
        filters.sensor_id = sensorId;
    }
    
    return filters;
}

// Ocultar gráficos cuando no hay configuración válida
function hideCharts() {
    logDashboard('debug', 'Ocultando gráficos');
    const chartsContainers = document.querySelectorAll('.chart-container');
    
    chartsContainers.forEach(container => {
        if (!container.classList.contains('no-config-message')) {
            container.classList.add('d-none');
        }
    });
}

// Mostrar gráficos cuando hay configuración válida
function showCharts() {
    logDashboard('debug', 'Mostrando gráficos');
    const chartsContainers = document.querySelectorAll('.chart-container');
    
    chartsContainers.forEach(container => {
        if (!container.classList.contains('no-config-message') && 
            !container.id.includes('noConfigurationMessage')) {
            container.classList.remove('d-none');
        }
    });
}

// Mostrar un modal con contenido dinámico
function showModal(title, content) {
    // Crear el HTML del modal
    const modalHtml = `
        <div class="modal" id="dynamicModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="modal-close" id="closeModalBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn" id="closeModalActionBtn">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eliminar modal anterior si existe
    const oldModal = document.getElementById('dynamicModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // Añadir el nuevo modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Configurar eventos de cierre
    const modal = document.getElementById('dynamicModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const closeActionBtn = document.getElementById('closeModalActionBtn');
    
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
            document.getElementById('modalBackdrop').remove();
        }, 300);
    };
    
    if (closeBtn) {
        addDashboardListener(closeBtn, 'click', closeModal);
    }
    
    if (closeActionBtn) {
        addDashboardListener(closeActionBtn, 'click', closeModal);
    }
    
    // Mostrar el modal
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
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
window.loadAlerts = loadAlerts;
window.viewAlertDetails = viewAlertDetails;
window.acknowledgeAlert = acknowledgeAlert;
window.getVibrationFilters = getVibrationFilters;
window.getSeverityText = getSeverityText;
window.updateDashboardAlertCounts = updateDashboardAlertCounts;
window.cleanupDashboardListeners = cleanupDashboardListeners;

// Modificar las funciones de fetch para aceptar señal de cancelación
function fetchVibrationData(filters, signal) {
    logDashboard('debug', 'Solicitando datos de vibración');
    const startTime = performance.now();
    
    const url = new URL('/api/vibration-data', window.location.origin);
    
    // Añadir filtros a la URL
    if (filters) {
        Object.keys(filters).forEach(key => {
            if (filters[key] !== null && filters[key] !== undefined) {
                url.searchParams.append(key, filters[key]);
            }
        });
    }
    
    logDashboard('debug', `URL de solicitud: ${url.toString()}`);
    
    return fetch(url, { signal })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            logDashboard('debug', `Datos de vibración recibidos (${data.length} registros)`, null, startTime);
            return data;
        })
        .catch(error => {
            // Usar el sistema centralizado de manejo de errores
            handleAjaxError(error, 'obtención de datos de vibración', true, {
                url: url.toString(),
                filters: filters,
                elapsedTime: performance.now() - startTime
            });
            throw error; // Re-lanzar el error para manejo adicional
        });
}

function fetchAlerts(signal) {
    logDashboard('debug', 'Solicitando datos de alertas');
    const startTime = performance.now();
    
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    
    if (!selectedMachine || !selectedSensor) {
        logDashboard('warn', 'No se pueden obtener alertas sin máquina y sensor seleccionados');
        return Promise.resolve(null);
    }
    
    const url = `/api/alerts?machine_id=${selectedMachine}&sensor_id=${selectedSensor}`;
    logDashboard('debug', `URL de solicitud de alertas: ${url}`);
    
    return fetch(url, { signal })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            logDashboard('debug', `Alertas recibidas (${data.length} registros)`, null, startTime);
            return data;
        })
        .catch(error => {
            // Usar el sistema centralizado de manejo de errores
            handleAjaxError(error, 'obtención de alertas', true, {
                url: url,
                machine: selectedMachine,
                sensor: selectedSensor,
                elapsedTime: performance.now() - startTime
            });
            throw error; // Re-lanzar el error para manejo adicional
        });
}

// Función para gestionar event listeners
function addDashboardListener(element, event, handler, options = false) {
    if (!element) {
        logDashboard('warn', 'addDashboardListener: Elemento no válido');
        return null;
    }
    
    return window.addManagedEventListener(element, event, handler, 'dashboard', options);
}

// Función para limpiar todos los listeners del dashboard
function cleanupDashboardListeners() {
    logDashboard('info', 'Limpiando event listeners del dashboard');
    
    // Cancelar actualizaciones pendientes
    cancelDashboardUpdates();
    
    // Limpiar todos los event listeners de la categoría dashboard
    const count = window.cleanupEventListenersByCategory('dashboard');
    
    logDashboard('info', `${count} event listeners del dashboard eliminados`);
    return count;
}

// Limpiar listeners al desmontar la página del dashboard
window.addManagedEventListener(document, 'pageChanged', function(event) {
    if (event.detail && event.detail.from === 'dashboard') {
        logDashboard('info', 'Saliendo del dashboard, limpiando listeners...');
        cleanupDashboardListeners();
    }
}, 'navigation'); 