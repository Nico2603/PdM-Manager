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
    
    // Inicializar sección de datos de vibración
    initVibrationDataSection();
    
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
    showLoadingIndicator('Actualizando datos...');
    
    // Obtener valores de filtros actuales
    const machineId = getGlobalState('selectedMachine');
    const sensorId = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Construir una URL de búsqueda con los filtros
    let url = '/api/dashboard-data';
    let params = new URLSearchParams();
    
    if (machineId) params.append('machine_id', machineId);
    if (sensorId) params.append('sensor_id', sensorId);
    if (timeRange) params.append('time_range', timeRange);
    
    const searchUrl = `${url}?${params.toString()}`;
    
    // Realizar fetches paralelos para los diferentes tipos de datos
    const promises = [
        // Datos de vibración para gráficos
        fetch(`${searchUrl}&data_type=vibration`)
            .then(response => response.json())
            .then(data => {
                if (data && data.items) {
                    processVibrationData(data.items);
                }
                return data;
            }),
        
        // Alertas para contadores y gráfico de alertas
        fetch(`${searchUrl}&data_type=alerts`)
            .then(response => response.json())
            .then(data => {
                if (data && data.items) {
                    updateAlertCounters(data.items);
                }
                return data;
            }),
        
        // Estadísticas para límites de control
        fetch(`${searchUrl}&data_type=stats`)
            .then(response => response.json())
            .then(data => {
                if (data && data.limits) {
                    updateGlobalStats(data.limits);
                }
                return data;
            }),
            
        // Cargar datos de vibración para la tabla
        loadVibrationData(1, {
            machine_id: machineId,
            sensor_id: sensorId
        })
    ];
    
    return Promise.all(promises)
        .then(([vibrationData, alertsData, statsData]) => {
            // Todos los datos se han cargado correctamente
            hideLoadingIndicator();
            updateLastUpdateTime();
            
            // Actualizar gráficos de vibración
            if (typeof updateVibrationChartX === 'function') updateVibrationChartX();
            if (typeof updateVibrationChartY === 'function') updateVibrationChartY();
            if (typeof updateVibrationChartZ === 'function') updateVibrationChartZ();
            
            // Actualizar gráfico de historial de alertas
            if (typeof fetchAlertsHistoryData === 'function') fetchAlertsHistoryData();
            
            // Mostrar estadísticas actualizadas
            updateStatisticalDisplayValues();
            
            showToast('Datos actualizados correctamente', 'success');
            return { vibrationData, alertsData, statsData };
        })
        .catch(error => {
            console.error('Error al actualizar datos del dashboard:', error);
            hideLoadingIndicator();
            showToast('Error al actualizar datos del dashboard', 'error');
            throw error;
        });
}

// Procesar datos de vibración para las gráficas
function processVibrationData(vibrationData) {
    if (!vibrationData || vibrationData.length === 0) {
        console.warn('No hay datos de vibración para procesar');
        return;
    }
    
    console.log('Procesando datos de vibración:', vibrationData.length);
    
    // Asegurarse de que los datos estén ordenados por timestamp
    vibrationData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Actualizar datos de gráficos
    chartData.timestamps = vibrationData.map(item => new Date(item.timestamp).toLocaleTimeString());
    
    // Preparar datos para cada eje
    chartData.x = vibrationData.map(item => item.accel_x !== undefined ? parseFloat(item.accel_x) : null);
    chartData.y = vibrationData.map(item => item.accel_y !== undefined ? parseFloat(item.accel_y) : null);
    chartData.z = vibrationData.map(item => item.accel_z !== undefined ? parseFloat(item.accel_z) : null);
    chartData.status = vibrationData.map(item => item.severity !== undefined ? parseInt(item.severity) : 0);
    
    console.log('Datos procesados para gráficas', {
        timestamps: chartData.timestamps.length,
        x: chartData.x.length,
        y: chartData.y.length,
        z: chartData.z.length
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
            console.error('Error al exportar a PDF:', error);
            showToast('Error al generar PDF', 'error');
        })
        .finally(() => {
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
    const adjustBtn = document.getElementById('adjustLimitsBtn');
    if (!adjustBtn) return;
    
    adjustBtn.addEventListener('click', () => {
        // Abrir directamente el modal en el dashboard
        const modal = document.getElementById('adjustLimitsModal');
        if (modal) {
            modal.classList.add('show');
            loadLimitsIntoModal();
        }
    });
}

// Cargar límites actuales en el modal
function loadLimitsIntoModal() {
    // Obtener los valores actuales de los límites desde el DOM o el estado global
    fetch('/api/limits')
        .then(response => response.json())
        .then(limits => {
            // Actualizar campos del formulario con los límites actuales
            for (const axis of ['x', 'y', 'z']) {
                document.getElementById(`${axis}2SigmaLowerInput`).value = limits[axis]?.sigma2?.lower || '';
                document.getElementById(`${axis}2SigmaUpperInput`).value = limits[axis]?.sigma2?.upper || '';
                document.getElementById(`${axis}3SigmaLowerInput`).value = limits[axis]?.sigma3?.lower || '';
                document.getElementById(`${axis}3SigmaUpperInput`).value = limits[axis]?.sigma3?.upper || '';
            }
            
            // Configurar los botones del modal
            setupModalButtons();
        })
        .catch(error => {
            console.error('Error al cargar límites actuales:', error);
            showToast('Error al cargar límites actuales', 'error');
        });
}

// Configurar botones del modal
function setupModalButtons() {
    // Configurar el botón de cierre del modal
    const closeBtn = document.querySelector('#adjustLimitsModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('adjustLimitsModal').classList.remove('show');
        });
    }
    
    // Configurar el botón de guardar
    const saveBtn = document.getElementById('saveLimitsBtn');
    if (saveBtn) {
        // Eliminar todos los event listeners anteriores
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', () => {
            saveLimitsFromModal();
        });
    }
    
    // Configurar el botón de resetear
    const resetBtn = document.getElementById('resetLimitsBtn');
    if (resetBtn) {
        // Eliminar todos los event listeners anteriores
        const newResetBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
        
        newResetBtn.addEventListener('click', () => {
            resetLimitsFromModal();
        });
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
                
                // Actualizar estado global con las selecciones
                setGlobalState('selectedMachine', machineId);
                setGlobalState('selectedSensor', sensorId);
                setGlobalState('timeRange', timeRange);
            }
            
            // Leer estado de los toggles de visualización
            const show2Sigma = document.getElementById('show2Sigma')?.checked || false;
            const show3Sigma = document.getElementById('show3Sigma')?.checked || false;
            
            // Actualizar opciones de visualización en el estado global
            const chartOptions = getGlobalState('chartOptions') || {};
            chartOptions.show2Sigma = show2Sigma;
            chartOptions.show3Sigma = show3Sigma;
            setGlobalState('chartOptions', chartOptions);
            
            // Actualizar datos y gráficos
            updateDashboardData()
                .then(() => {
                    // Mostrar gráficos después de cargar datos
                    showCharts();
                    
                    // Actualizar la visibilidad de las líneas sigma según los checkboxes
                    if (typeof updateChartsVisibility === 'function') {
                        updateChartsVisibility();
                    }
                    
                    // Actualizar contadores de alertas
                    updateDashboardAlertCounts();
                    
                    // Cargar datos de vibración recientes
                    loadVibrationData(1);
                    
                    // Cargar alertas simplificadas
                    loadSimplifiedAlerts();
                    
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
    showLoadingIndicator('Cargando datos de vibración...');
    
    // Obtener filtros globales del dashboard si no se proporcionan filtros específicos
    if (!filters.machine_id && !filters.sensor_id) {
        const selectedMachine = getGlobalState('selectedMachine');
        const selectedSensor = getGlobalState('selectedSensor');
        
        if (selectedMachine) {
            filters.machine_id = selectedMachine;
        }
        
        if (selectedSensor) {
            filters.sensor_id = selectedSensor;
        }
    }
    
    // Construir URL con parámetros de paginación y filtros
    let url = `/api/vibration-data?page=${page}&limit=10`;
    
    // Añadir filtros a la URL si están definidos
    if (filters.machine_id) {
        url += `&machine_id=${filters.machine_id}`;
    }
    
    if (filters.sensor_id) {
        url += `&sensor_id=${filters.sensor_id}`;
    }
    
    if (filters.severity !== undefined && filters.severity !== '') {
        url += `&severity=${filters.severity}`;
    }
    
    if (filters.date) {
        url += `&date=${filters.date}`;
    }
    
    // Realizar petición a la API
    fetch(url)
        .then(response => response.json())
        .then(data => {
            hideLoadingIndicator();
            
            // Actualizar la tabla con los datos recibidos
            updateVibrationDataTable(data.items || []);
            
            // Actualizar la información de paginación
            updateVibrationPagination(data.total, data.page, data.pages);
        })
        .catch(error => {
            hideLoadingIndicator();
            console.error('Error al cargar datos de vibración:', error);
            showToast('Error al cargar datos de vibración', 'error');
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
        const date = new Date(item.timestamp);
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
        
        row.innerHTML = `
            <td>${item.vibration_data_id}</td>
            <td>${item.sensor_id}</td>
            <td>${formattedDate}</td>
            <td>${item.accel_x.toFixed(3)}</td>
            <td>${item.accel_y.toFixed(3)}</td>
            <td>${item.accel_z.toFixed(3)}</td>
            <td><span class="${severityClass}">${getSeverityText(item.severity)}</span></td>
            <td>${item.magnitude.toFixed(3)}</td>
            <td class="column-actions">
                <div class="table-actions">
                    <button class="btn-icon btn-view" title="Ver detalles" data-id="${item.vibration_data_id}">
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
        sensor_id: getGlobalState('selectedSensor')
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