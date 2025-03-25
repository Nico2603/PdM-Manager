/**
 * Dashboard.js - Funciones principales para PdM-Manager
 * Incluye lógica para visualización de datos, simulación y configuración
 */

// Variables globales
let vibrationChart = null;
let chartData = {
    timestamps: [],
    x: [],
    y: [],
    z: [],
    status: []
};

// Estado de simulación
let simulationRunning = false;
let simulationTimer = null;
let simulationProgress = {
    current: 0,
    total: 0,
    startTime: null
};

// Estadísticas para límites
let stats = {
    mean: { x: 0, y: 0, z: 0 },
    stdDev: { x: 1, y: 1, z: 1 },
    sigma1: { upper: { x: 0, y: 0, z: 0 }, lower: { x: 0, y: 0, z: 0 } },
    sigma2: { upper: { x: 0, y: 0, z: 0 }, lower: { x: 0, y: 0, z: 0 } },
    sigma3: { upper: { x: 0, y: 0, z: 0 }, lower: { x: 0, y: 0, z: 0 } }
};

// Selecciones actuales
let selectedMachine = '';
let selectedSensor = '';
let selectedCsvFile = '';

// Colores para severidades
const SEVERITY_COLORS = {
    0: '#28a745', // Normal - Verde
    1: '#ffc107', // Nivel 1 - Amarillo
    2: '#ff5722', // Nivel 2 - Naranja
    3: '#dc3545'  // Nivel 3 - Rojo
};

// Cuando el documento está listo
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar el gráfico de vibraciones
    initVibrationChart();
    
    // Cargar datos iniciales
    loadInitialData();
    
    // Inicializar eventos de UI
    initUIEvents();
    
    // Verificar estado de simulación
    checkSimulationStatus();
    
    // Actualizar datos cada 10 segundos
    setInterval(updateDashboardData, 10000);
});

/**
 * Carga los datos iniciales para el dashboard
 */
function loadInitialData() {
    // Cargar máquinas disponibles
    loadMachines();
    
    // Cargar archivos CSV disponibles
    loadCsvFiles();
    
    // Actualizar datos del dashboard
    updateDashboardData();
}

/**
 * Inicializa el gráfico de vibraciones
 */
function initVibrationChart() {
    const ctx = document.getElementById('vibrationChart');
    if (!ctx) return;
    
    // Configuración del gráfico
    vibrationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Aceleración X',
                    data: [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Aceleración Y',
                    data: [],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Aceleración Z',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: false
                },
                // Líneas para límites estadísticos (se añadirán dinámicamente)
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tiempo'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Aceleración (m/s²)'
                    },
                    suggestedMin: -15,
                    suggestedMax: 15
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + ' m/s²';
                            }
                            return label;
                        },
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            if (chartData.status && chartData.status[dataIndex] !== undefined) {
                                const status = chartData.status[dataIndex];
                                let statusText = '';
                                switch (status) {
                                    case 0: statusText = 'Normal'; break;
                                    case 1: statusText = 'Alerta Nivel 1'; break;
                                    case 2: statusText = 'Alerta Nivel 2'; break;
                                    case 3: statusText = 'Alerta Nivel 3 (Crítico)'; break;
                                    default: statusText = 'Desconocido';
                                }
                                return 'Estado: ' + statusText;
                            }
                            return '';
                        }
                    }
                },
                legend: {
                    position: 'top',
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    }
                }
            }
        }
    });
    
    // Manejar reset de zoom
    document.getElementById('zoomResetBtn').addEventListener('click', function() {
        vibrationChart.resetZoom();
    });
}

/**
 * Inicializa los eventos de la interfaz de usuario
 */
function initUIEvents() {
    // Eventos para selección de máquina y sensor
    const selectMachine = document.getElementById('selectMachine');
    if (selectMachine) {
        selectMachine.addEventListener('change', function() {
            selectedMachine = this.value;
            loadSensors(selectedMachine);
            updateDashboardData();
        });
    }
    
    const selectSensor = document.getElementById('selectSensor');
    if (selectSensor) {
        selectSensor.addEventListener('change', function() {
            selectedSensor = this.value;
            updateDashboardData();
        });
    }
    
    // Eventos para los botones de simulación
    const startSimBtn = document.getElementById('startSimBtn');
    if (startSimBtn) {
        startSimBtn.addEventListener('click', startSimulation);
    }
    
    const stopSimBtn = document.getElementById('stopSimBtn');
    if (stopSimBtn) {
        stopSimBtn.addEventListener('click', stopSimulation);
    }
    
    // Eventos para CSV y configuración de simulación
    const selectCsvFile = document.getElementById('selectCsvFile');
    if (selectCsvFile) {
        selectCsvFile.addEventListener('change', validateSimulationForm);
    }
    
    const simSelectSensor = document.getElementById('simSelectSensor');
    if (simSelectSensor) {
        simSelectSensor.addEventListener('change', validateSimulationForm);
    }
    
    // Evento para subir CSV
    const uploadCsvBtn = document.getElementById('uploadCsvBtn');
    if (uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', function() {
            // Activar el input file
            document.getElementById('csvFileInput').click();
        });
    }
    
    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                uploadCsvFile();
            }
        });
    }
    
    // Eventos para filtros de tiempo
    const timeFilterButtons = document.querySelectorAll('.time-filter');
    timeFilterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remover clase activa de todos los botones
            timeFilterButtons.forEach(btn => btn.classList.remove('active'));
            // Añadir clase activa al botón seleccionado
            this.classList.add('active');
            
            // Actualizar rango de tiempo seleccionado
            timeRange = this.dataset.range;
            
            // Actualizar dashboard
            updateDashboardData();
        });
    });
    
    // Eventos para botones de visualización de límites en gráficos
    const limitToggleButtons = document.querySelectorAll('.limit-toggle');
    limitToggleButtons.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateChartWithStatLimits();
        });
    });
    
    // Evento para botón de ajuste de límites estadísticos
    const adjustLimitsBtn = document.getElementById('adjustLimitsBtn');
    if (adjustLimitsBtn) {
        adjustLimitsBtn.addEventListener('click', showAdjustLimitsForm);
    }
    
    // Evento para refrescar automáticamente (cada 30 segundos)
    if (document.getElementById('autoRefresh').checked) {
        refreshTimer = setInterval(updateDashboardData, 30000);
    }
    
    document.getElementById('autoRefresh').addEventListener('change', function() {
        if (this.checked) {
            refreshTimer = setInterval(updateDashboardData, 30000);
        } else {
            clearInterval(refreshTimer);
        }
    });
}

/**
 * Valida el formulario de simulación y actualiza los botones
 */
function validateSimulationForm() {
    const csvFile = document.getElementById('selectCsvFile').value;
    const sensorId = document.getElementById('simSelectSensor').value;
    const startBtn = document.getElementById('startSimBtn');
    
    if (startBtn) {
        startBtn.disabled = !csvFile || !sensorId || simulationRunning;
    }
}

/**
 * Muestra un indicador de carga
 */
function showLoadingIndicator(message = 'Cargando...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingOverlay && loadingText) {
        loadingText.textContent = message;
        loadingOverlay.classList.add('show');
    }
}

/**
 * Oculta el indicador de carga
 */
function hideLoadingToast() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingOverlay) {
        loadingOverlay.classList.remove('show');
    }
}

/**
 * Actualiza los datos del dashboard
 */
function updateDashboardData() {
    // Construir URL con parámetros
    let url = '/api/dashboard';
    if (selectedSensor) {
        url += `?sensor_id=${selectedSensor}`;
    }
    
    // Obtener los datos
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener datos del dashboard');
            }
            return response.json();
        })
        .then(data => {
            // Actualizar la hora de la última actualización
            updateLastUpdateTime();
            
            // Actualizar contadores de alertas
            if (data.alerts_count) {
                updateAlertCounters(
                    data.alerts_count.level1 || 0,
                    data.alerts_count.level2 || 0,
                    data.alerts_count.level3 || 0
                );
            }
            
            // Actualizar alertas recientes
            if (data.recent_alerts) {
                updateRecentAlerts(data.recent_alerts);
            }
            
            // Actualizar límites estadísticos
            if (data.stats) {
                updateStatisticalLimits(data.stats);
            }
            
            // Actualizar datos de vibración para el gráfico
            if (data.vibration_data) {
                // Actualizar datos del gráfico
                chartData = {
                    timestamps: data.vibration_data.timestamps || [],
                    x: data.vibration_data.x || [],
                    y: data.vibration_data.y || [],
                    z: data.vibration_data.z || [],
                    status: data.vibration_data.status || []
                };
                
                // Actualizar gráfico
                updateVibrationChart();
            }
            
            // Actualizar tabla de datos recientes
            if (data.recent_data) {
                updateRecentDataTable(data.recent_data);
            }
        })
        .catch(error => {
            console.error('Error actualizando dashboard:', error);
            // No mostrar toast para no interrumpir al usuario
        });
}

/**
 * Actualiza la hora de la última actualización
 */
function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const lastUpdateTime = document.getElementById('lastUpdateTime');
    if (lastUpdateTime) {
        lastUpdateTime.textContent = timeStr;
    }
}

/**
 * Actualiza los contadores de alertas
 */
function updateAlertCounters(level1, level2, level3) {
    // Actualizar contadores
    document.getElementById('level1Count').textContent = level1;
    document.getElementById('level2Count').textContent = level2;
    document.getElementById('level3Count').textContent = level3;
    document.getElementById('totalCount').textContent = level1 + level2 + level3;
    
    // Animar contadores (opcional)
    const counters = ['level1Count', 'level2Count', 'level3Count', 'totalCount'];
    counters.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('animated');
            setTimeout(() => {
                element.classList.remove('animated');
            }, 1000);
        }
    });
}

/**
 * Actualiza el panel de alertas recientes
 */
function updateRecentAlerts(alerts) {
    const tableBody = document.getElementById('recentAlertsTable');
    if (!tableBody) return;
    
    if (alerts && alerts.length > 0) {
        // Construir filas de la tabla
        let html = '';
        alerts.forEach(alert => {
            // Convertir timestamp a formato legible
            const date = new Date(alert.timestamp);
            const timeStr = date.toLocaleTimeString();
            
            // Determinar clase CSS según severidad
            let severityClass = '';
            let severityIcon = '';
            
            switch (alert.severity) {
                case 1:
                    severityClass = 'warning';
                    severityIcon = 'exclamation-circle';
                    break;
                case 2:
                    severityClass = 'danger';
                    severityIcon = 'exclamation-triangle';
                    break;
                case 3:
                    severityClass = 'danger';
                    severityIcon = 'radiation-alt';
                    break;
                default:
                    severityClass = 'secondary';
                    severityIcon = 'info-circle';
            }
            
            html += `
                <tr>
                    <td>
                        <span class="badge badge-${severityClass}">
                            <i class="fas fa-${severityIcon} mr-1"></i>
                            ${alert.severity}
                        </span>
                    </td>
                    <td>${alert.sensor_name || 'Sensor ' + alert.sensor_id}</td>
                    <td>${timeStr}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } else {
        // No hay alertas
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-3">
                    <span class="text-muted">No hay alertas recientes</span>
                </td>
            </tr>
        `;
    }
}

/**
 * Actualiza los límites estadísticos para el gráfico
 */
function updateStatisticalLimits(statsData) {
    if (!statsData) return;
    
    // Actualizar estadísticas globales
    stats.mean = statsData.mean || { x: 0, y: 0, z: 0 };
    stats.stdDev = statsData.std_dev || { x: 1, y: 1, z: 1 };
    
    // Si recibimos límites estadísticos predefinidos, usarlos
    if (statsData.statistical_limits) {
        const limits = statsData.statistical_limits;
        
        // Actualizar los límites sigma2 y sigma3
        ['x', 'y', 'z'].forEach(axis => {
            if (limits[axis]) {
                // Establecer límites sigma2 del backend
                if (limits[axis].sigma2) {
                    stats.sigma2.lower[axis] = limits[axis].sigma2.lower;
                    stats.sigma2.upper[axis] = limits[axis].sigma2.upper;
                }
                
                // Establecer límites sigma3 del backend
                if (limits[axis].sigma3) {
                    stats.sigma3.lower[axis] = limits[axis].sigma3.lower;
                    stats.sigma3.upper[axis] = limits[axis].sigma3.upper;
                }
                
                // Calcular sigma1 como punto medio
                stats.sigma1.upper[axis] = stats.mean[axis] + stats.stdDev[axis];
                stats.sigma1.lower[axis] = stats.mean[axis] - stats.stdDev[axis];
            }
        });
    } else {
        // Calcular límites sigma si no se reciben
        ['x', 'y', 'z'].forEach(axis => {
            stats.sigma1.upper[axis] = stats.mean[axis] + stats.stdDev[axis];
            stats.sigma1.lower[axis] = stats.mean[axis] - stats.stdDev[axis];
            
            stats.sigma2.upper[axis] = stats.mean[axis] + (2 * stats.stdDev[axis]);
            stats.sigma2.lower[axis] = stats.mean[axis] - (2 * stats.stdDev[axis]);
            
            stats.sigma3.upper[axis] = stats.mean[axis] + (3 * stats.stdDev[axis]);
            stats.sigma3.lower[axis] = stats.mean[axis] - (3 * stats.stdDev[axis]);
        });
    }
    
    // Actualizar gráfico con los nuevos límites
    updateChartWithStatLimits();
}

/**
 * Actualiza el gráfico de vibraciones con los datos más recientes
 */
function updateVibrationChart() {
    if (!vibrationChart) return;
    
    // Convertir timestamps a formato legible
    const labels = chartData.timestamps.map(ts => {
        const date = new Date(ts);
        return date.toLocaleTimeString();
    });
    
    // Actualizar datos del gráfico
    vibrationChart.data.labels = labels;
    vibrationChart.data.datasets[0].data = chartData.x;
    vibrationChart.data.datasets[1].data = chartData.y;
    vibrationChart.data.datasets[2].data = chartData.z;
    
    // Actualizar puntos con colores según severidad
    vibrationChart.data.datasets.slice(0, 3).forEach((dataset, index) => {
        const colors = chartData.status.map(status => {
            return getBackgroundColorForSeverity(status);
        });
        
        dataset.pointBackgroundColor = colors;
        dataset.pointBorderColor = colors;
    });
    
    // Actualizar límites estadísticos
    updateChartWithStatLimits();
    
    // Actualizar gráfico
    vibrationChart.update();
}

/**
 * Actualiza la tabla de datos recientes
 */
function updateRecentDataTable(data) {
    const tableBody = document.getElementById('recentDataTable');
    if (!tableBody) return;
    
    if (data && data.length > 0) {
        // Construir filas de la tabla
        let html = '';
        data.forEach(item => {
            // Convertir timestamp a formato legible
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleTimeString();
            
            // Determinar clase CSS según severidad
            const bgClass = colorBackgroundBySeverity(item.severity);
            
            // Formatear valores de aceleración
            const xValue = parseFloat(item.x).toFixed(2);
            const yValue = parseFloat(item.y).toFixed(2);
            const zValue = parseFloat(item.z).toFixed(2);
            
            // Determinar textos de estado
            let statusText = '';
            let statusClass = '';
            
            switch (item.severity) {
                case 0:
                    statusText = 'Normal';
                    statusClass = 'success';
                    break;
                case 1:
                    statusText = 'Nivel 1';
                    statusClass = 'warning';
                    break;
                case 2:
                    statusText = 'Nivel 2';
                    statusClass = 'danger';
                    break;
                case 3:
                    statusText = 'Nivel 3';
                    statusClass = 'danger';
                    break;
                default:
                    statusText = 'Desconocido';
                    statusClass = 'secondary';
            }
            
            html += `
                <tr class="${bgClass}">
                    <td>${timeStr}</td>
                    <td>${item.machine_name || 'Máquina 1'}</td>
                    <td>${item.sensor_name || 'Sensor ' + item.sensor_id}</td>
                    <td>${xValue}</td>
                    <td>${yValue}</td>
                    <td>${zValue}</td>
                    <td>
                        <span class="badge badge-${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } else {
        // No hay datos
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-3">
                    <span class="text-muted">No hay datos recientes</span>
                </td>
            </tr>
        `;
    }
}

/**
 * Devuelve una clase CSS para el fondo de la fila según la severidad
 */
function colorBackgroundBySeverity(severity) {
    switch (severity) {
        case 1: return 'bg-warning-light';
        case 2: return 'bg-danger-light';
        case 3: return 'bg-danger-light';
        default: return '';
    }
}

/**
 * Devuelve el color de fondo para un punto según su severidad
 */
function getBackgroundColorForSeverity(severity) {
    switch (severity) {
        case 0: return '#28a745'; // Verde (normal)
        case 1: return '#ffc107'; // Amarillo (nivel 1)
        case 2: return '#ff5722'; // Naranja (nivel 2)
        case 3: return '#dc3545'; // Rojo (nivel 3)
        default: return '#6c757d'; // Gris (desconocido)
    }
}

/**
 * Actualiza el gráfico con los límites estadísticos
 */
function updateChartWithStatLimits() {
    if (!vibrationChart) return;
    
    // Limitar a los primeros 3 datasets (x, y, z)
    vibrationChart.data.datasets = vibrationChart.data.datasets.slice(0, 3);
    
    // Añadir líneas de media y límites sigma si están activados
    const showMean = document.getElementById('showMean').checked;
    const show1Sigma = document.getElementById('show1Sigma').checked;
    const show2Sigma = document.getElementById('show2Sigma').checked;
    const show3Sigma = document.getElementById('show3Sigma').checked;
    
    // Datos para las líneas horizontales
    const labels = vibrationChart.data.labels;
    const axisColors = ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(75, 192, 192, 0.7)'];
    const axisLabels = ['X', 'Y', 'Z'];
    
    // Para cada eje (x, y, z)
    ['x', 'y', 'z'].forEach((axis, axisIndex) => {
        // Añadir línea de media
        if (showMean) {
            vibrationChart.data.datasets.push({
                label: `Media ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.mean[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
        }
        
        // Añadir límites sigma 1
        if (show1Sigma) {
            // Límite superior
            vibrationChart.data.datasets.push({
                label: `+1σ ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.sigma1.upper[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
            
            // Límite inferior
            vibrationChart.data.datasets.push({
                label: `-1σ ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.sigma1.lower[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
        }
        
        // Añadir límites sigma 2
        if (show2Sigma) {
            // Límite superior
            vibrationChart.data.datasets.push({
                label: `+2σ ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.sigma2.upper[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [4, 2],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
            
            // Límite inferior
            vibrationChart.data.datasets.push({
                label: `-2σ ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.sigma2.lower[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [4, 2],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
        }
        
        // Añadir límites sigma 3
        if (show3Sigma) {
            // Límite superior
            vibrationChart.data.datasets.push({
                label: `+3σ ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.sigma3.upper[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [6, 2],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
            
            // Límite inferior
            vibrationChart.data.datasets.push({
                label: `-3σ ${axisLabels[axisIndex]}`,
                data: Array(labels.length).fill(stats.sigma3.lower[axis]),
                borderColor: axisColors[axisIndex],
                borderWidth: 1,
                borderDash: [6, 2],
                pointRadius: 0,
                fill: false,
                hidden: false
            });
        }
    });
    
    // Actualizar gráfico
    vibrationChart.update();
}

/**
 * Carga las máquinas disponibles desde el backend
 */
function loadMachines() {
    showLoadingIndicator('Cargando máquinas...');
    
    fetch('/api/config/machines')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar máquinas');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Actualizar el selector principal
            const selectMachine = document.getElementById('selectMachine');
            if (selectMachine) {
                // Guardar selección actual
                const currentSelection = selectMachine.value;
                
                // Limpiar opciones actuales
                selectMachine.innerHTML = '<option value="">Todas las máquinas</option>';
                
                // Añadir cada máquina como opción
                if (data && data.length > 0) {
                    data.forEach(machine => {
                        const option = document.createElement('option');
                        option.value = machine.id;
                        option.textContent = machine.name;
                        
                        // Añadir clase según estado
                        if (machine.status) {
                            option.classList.add(getStatusClass(machine.status));
                        }
                        
                        selectMachine.appendChild(option);
                    });
                    
                    // Restaurar selección si existe
                    if (currentSelection) {
                        selectMachine.value = currentSelection;
                    }
                    
                    // Si no hay una máquina seleccionada, seleccionar la primera
                    if (!selectMachine.value && data.length > 0) {
                        selectMachine.value = data[0].id;
                        selectedMachine = data[0].id;
                    }
                }
                
                // Cargar sensores para la máquina seleccionada
                loadSensors(selectMachine.value);
            }
            
            // Actualizar el selector de la sección de configuración
            const filterMachine = document.getElementById('filterMachine');
            if (filterMachine) {
                // Guardar selección actual
                const currentSelection = filterMachine.value;
                
                // Limpiar opciones actuales
                filterMachine.innerHTML = '<option value="">Todas las máquinas</option>';
                
                // Añadir cada máquina como opción
                if (data && data.length > 0) {
                    data.forEach(machine => {
                        const option = document.createElement('option');
                        option.value = machine.id;
                        option.textContent = machine.name;
                        filterMachine.appendChild(option);
                    });
                    
                    // Restaurar selección si existe
                    if (currentSelection) {
                        filterMachine.value = currentSelection;
                    }
                }
            }
            
            // Actualizar el selector de la sección de simulación
            const sensorMachine = document.getElementById('sensorMachine');
            if (sensorMachine) {
                // Guardar selección actual
                const currentSelection = sensorMachine.value;
                
                // Limpiar opciones actuales
                sensorMachine.innerHTML = '<option value="">Seleccionar máquina...</option>';
                
                // Añadir cada máquina como opción
                if (data && data.length > 0) {
                    data.forEach(machine => {
                        const option = document.createElement('option');
                        option.value = machine.id;
                        option.textContent = machine.name;
                        sensorMachine.appendChild(option);
                    });
                    
                    // Restaurar selección si existe
                    if (currentSelection) {
                        sensorMachine.value = currentSelection;
                    }
                }
            }
            
            // Actualizar tabla de máquinas si existe
            updateMachinesTable(data);
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar máquinas: ' + error.message);
            
            // Si no hay datos, crear una máquina ficticia para simulación
            const selectMachine = document.getElementById('selectMachine');
            if (selectMachine) {
                selectMachine.innerHTML = '';
                
                const option = document.createElement('option');
                option.value = "1";
                option.textContent = "Máquina 1";
                selectMachine.appendChild(option);
                
                selectedMachine = "1";
                loadSensors("1");
            }
        });
}

/**
 * Devuelve la clase CSS correspondiente al estado
 */
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'normal': return 'text-success';
        case 'warning': return 'text-warning';
        case 'danger': return 'text-danger';
        case 'offline': return 'text-muted';
        default: return '';
    }
}

/**
 * Actualiza la tabla de máquinas
 */
function updateMachinesTable(machines) {
    const tableBody = document.getElementById('machinesTable');
    if (!tableBody) return;
    
    if (machines && machines.length > 0) {
        // Construir filas de la tabla
        let html = '';
        machines.forEach(machine => {
            const statusClass = getStatusClass(machine.status || 'normal');
            
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="machine-icon mr-2">
                                <i class="fas fa-industry ${statusClass}"></i>
                            </div>
                            <div>
                                <div class="font-weight-bold">${machine.name}</div>
                                <small class="text-muted">${machine.type || 'Tipo no especificado'}</small>
                            </div>
                        </div>
                    </td>
                    <td>${getReadableType(machine.type, 'machine')}</td>
                    <td>${machine.sensors_count || 0}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="editMachine(${machine.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="confirmDelete('machine', ${machine.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } else {
        // No hay máquinas
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-3">
                    <span class="text-muted">No hay máquinas configuradas</span>
                </td>
            </tr>
        `;
    }
}

/**
 * Carga los sensores para la máquina seleccionada
 */
function loadSensors(machineId) {
    // Si no hay máquina seleccionada, no hacer nada
    if (!machineId) {
        // Limpiar los selectores
        const selectSensor = document.getElementById('selectSensor');
        if (selectSensor) {
            selectSensor.innerHTML = '<option value="">Todos los sensores</option>';
            selectedSensor = '';
        }
        
        const simSelectSensor = document.getElementById('simSelectSensor');
        if (simSelectSensor) {
            simSelectSensor.innerHTML = '<option value="">Seleccionar sensor...</option>';
        }
        
        return;
    }
    
    showLoadingIndicator('Cargando sensores...');
    
    fetch(`/api/machines/${machineId}/sensors`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar sensores');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Actualizar el selector principal
            const selectSensor = document.getElementById('selectSensor');
            if (selectSensor) {
                // Guardar selección actual
                const currentSelection = selectSensor.value;
                
                // Limpiar opciones actuales
                selectSensor.innerHTML = '<option value="">Todos los sensores</option>';
                
                // Añadir cada sensor como opción
                if (data && data.length > 0) {
                    data.forEach(sensor => {
                        const option = document.createElement('option');
                        option.value = sensor.id;
                        option.textContent = sensor.name;
                        selectSensor.appendChild(option);
                    });
                    
                    // Restaurar selección si existe y pertenece a esta máquina
                    const sensorExists = data.some(s => s.id === currentSelection);
                    if (currentSelection && sensorExists) {
                        selectSensor.value = currentSelection;
                    } else if (data.length > 0) {
                        // Seleccionar el primer sensor
                        selectSensor.value = data[0].id;
                        selectedSensor = data[0].id;
                        updateDashboardData();
                    }
                }
            }
            
            // Actualizar el selector de simulación
            const simSelectSensor = document.getElementById('simSelectSensor');
            if (simSelectSensor) {
                // Guardar selección actual
                const currentSelection = simSelectSensor.value;
                
                // Limpiar opciones actuales
                simSelectSensor.innerHTML = '<option value="">Seleccionar sensor...</option>';
                
                // Añadir cada sensor como opción
                if (data && data.length > 0) {
                    data.forEach(sensor => {
                        const option = document.createElement('option');
                        option.value = sensor.id;
                        option.textContent = sensor.name;
                        simSelectSensor.appendChild(option);
                    });
                    
                    // Restaurar selección si existe y pertenece a esta máquina
                    const sensorExists = data.some(s => s.id === currentSelection);
                    if (currentSelection && sensorExists) {
                        simSelectSensor.value = currentSelection;
                    }
                }
                
                // Validar formulario de simulación
                validateSimulationForm();
            }
            
            // Actualizar tabla de sensores si existe
            updateSensorsTable(data);
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar sensores: ' + error.message);
            
            // Si no hay datos, crear un sensor ficticio para simulación
            const selectSensor = document.getElementById('selectSensor');
            if (selectSensor) {
                selectSensor.innerHTML = '';
                
                const option = document.createElement('option');
                option.value = "1";
                option.textContent = "Sensor 1";
                selectSensor.appendChild(option);
                
                selectedSensor = "1";
            }
            
            const simSelectSensor = document.getElementById('simSelectSensor');
            if (simSelectSensor) {
                simSelectSensor.innerHTML = '';
                
                const option = document.createElement('option');
                option.value = "1";
                option.textContent = "Sensor 1";
                simSelectSensor.appendChild(option);
            }
        });
}

/**
 * Convierte un tipo técnico a un nombre legible
 */
function getReadableType(type, category) {
    if (!type) return 'No especificado';
    
    const types = {
        machine: {
            'motor': 'Motor',
            'pump': 'Bomba',
            'fan': 'Ventilador',
            'compressor': 'Compresor',
            'generator': 'Generador',
            'other': 'Otro'
        },
        sensor: {
            'vibration': 'Vibración',
            'temperature': 'Temperatura',
            'pressure': 'Presión',
            'flow': 'Flujo',
            'other': 'Otro'
        },
        model: {
            'anomaly_detection': 'Detección de Anomalías',
            'classification': 'Clasificación',
            'regression': 'Regresión',
            'other': 'Otro'
        },
        scaler: {
            'standard': 'StandardScaler',
            'minmax': 'MinMaxScaler',
            'robust': 'RobustScaler',
            'other': 'Otro'
        }
    };
    
    if (category && types[category] && types[category][type.toLowerCase()]) {
        return types[category][type.toLowerCase()];
    }
    
    return type; // Devolver el tipo tal cual si no se encuentra
}

/**
 * Carga los archivos CSV disponibles
 */
function loadCsvFiles() {
    showLoadingIndicator('Cargando archivos CSV...');
    
    fetch('/api/simulation/csv-files')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar los archivos CSV');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            if (data.success && data.files) {
                updateCsvFilesTable(data.files);
                
                // Actualizar el selector de archivos CSV
                const selectCsvFile = document.getElementById('selectCsvFile');
                if (selectCsvFile) {
                    // Limpiar opciones actuales
                    selectCsvFile.innerHTML = '<option value="">Seleccionar archivo...</option>';
                    
                    // Añadir cada archivo como opción
                    data.files.forEach(file => {
                        const option = document.createElement('option');
                        option.value = file.name;
                        option.textContent = `${file.name} (${formatFileSize(file.size)}, ${file.records || 0} registros)`;
                        selectCsvFile.appendChild(option);
                    });
                    
                    // Si tenemos filtered_dataf.csv, seleccionarlo por defecto
                    if (data.files.some(file => file.name === 'filtered_dataf.csv')) {
                        selectCsvFile.value = 'filtered_dataf.csv';
                    }
                    
                    // Validar formulario de simulación
                    validateSimulationForm();
                }
            } else {
                console.error('Formato de respuesta incorrecto:', data);
                showToast('warning', 'Error al cargar archivos CSV: formato de respuesta incorrecto');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar archivos CSV: ' + error.message);
        });
}

/**
 * Actualiza la tabla de archivos CSV
 */
function updateCsvFilesTable(files) {
    const tableBody = document.getElementById('csvFilesTable');
    if (!tableBody) return;
    
    if (files && files.length > 0) {
        // Construir filas de la tabla
        let html = '';
        files.forEach(file => {
            html += `
                <tr>
                    <td>${file.name}</td>
                    <td>${formatFileSize(file.size)}</td>
                    <td>${file.records.toLocaleString()}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="selectCsvFile('${file.name}')">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="confirmDelete('csv', '${file.name}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } else {
        // No hay archivos
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-3">
                    <span class="text-muted">No hay archivos CSV disponibles. Suba uno para comenzar.</span>
                </td>
            </tr>
        `;
    }
}

/**
 * Formatea el tamaño de archivo
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * Sube un archivo CSV al servidor
 */
function uploadCsvFile() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput.files || !fileInput.files[0]) {
        showToast('warning', 'Por favor seleccione un archivo CSV para subir.');
        return;
    }
    
    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('warning', 'El archivo debe tener extensión .csv');
        return;
    }
    
    // Mostrar indicador de carga
    showLoadingIndicator('Subiendo archivo CSV...');
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('file', file);
    
    // Subir el archivo
    fetch('/api/simulation/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al subir el archivo');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        if (data.success) {
            showToast('success', 'Archivo subido correctamente: ' + data.filename);
            fileInput.value = ''; // Limpiar input
            loadCsvFiles(); // Recargar lista de archivos
        } else {
            showToast('warning', data.message || 'Error desconocido al subir el archivo');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al subir el archivo: ' + error.message);
    });
}

/**
 * Selecciona un archivo CSV para la simulación
 */
function selectCsvFile(filename) {
    // Actualizar el selector
    const selectCsvFile = document.getElementById('selectCsvFile');
    if (selectCsvFile) {
        selectCsvFile.value = filename;
        selectedCsvFile = filename;
        validateSimulationForm();
    }
    
    // Navegar a la sección de simulación si no estamos allí
    if (window.currentSection !== 'simulacion') {
        window.navigateTo('simulacion');
    }
    
    // Destacar visualmente el archivo seleccionado
    const csvTable = document.getElementById('csvFilesTable');
    if (csvTable) {
        const rows = csvTable.querySelectorAll('tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td:first-child');
            if (firstCell && firstCell.textContent.trim() === filename) {
                row.classList.add('table-active');
            } else {
                row.classList.remove('table-active');
            }
        });
    }
    
    showToast('success', 'Archivo seleccionado: ' + filename);
}

/**
 * Confirma una acción de eliminación
 */
function confirmDelete(type, id) {
    let title, body, callback;
    
    switch (type) {
        case 'machine':
            title = 'Eliminar Máquina';
            body = '¿Está seguro que desea eliminar esta máquina? Esta acción no se puede deshacer y eliminará todos los sensores asociados.';
            callback = () => deleteMachine(id);
            break;
        case 'sensor':
            title = 'Eliminar Sensor';
            body = '¿Está seguro que desea eliminar este sensor? Esta acción no se puede deshacer y eliminará todos los datos asociados.';
            callback = () => deleteSensor(id);
            break;
        case 'model':
            title = 'Eliminar Modelo';
            body = '¿Está seguro que desea eliminar este modelo? Esta acción no se puede deshacer.';
            callback = () => deleteModel(id);
            break;
        case 'csv':
            title = 'Eliminar Archivo CSV';
            body = '¿Está seguro que desea eliminar este archivo CSV? Esta acción no se puede deshacer.';
            callback = () => deleteCsvFile(id);
            break;
        default:
            return;
    }
    
    // Configurar modal de confirmación
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('confirmModalLabel');
    const modalBody = document.getElementById('confirmModalBody');
    const confirmBtn = document.getElementById('confirmModalBtn');
    
    if (modal && modalTitle && modalBody && confirmBtn) {
        modalTitle.textContent = title;
        modalBody.textContent = body;
        
        // Limpiar eventos anteriores
        confirmBtn.onclick = null;
        
        // Asignar nuevo evento
        confirmBtn.onclick = function() {
            $(modal).modal('hide');
            if (callback) callback();
        };
        
        // Mostrar modal
        $(modal).modal('show');
    } else {
        // Si no hay modal, preguntar directamente
        if (confirm(body)) {
            if (callback) callback();
        }
    }
}

/**
 * Elimina un archivo CSV
 */
function deleteCsvFile(filename) {
    showLoadingIndicator('Eliminando archivo CSV...');
    
    fetch(`/api/simulation/files/${filename}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar el archivo');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        showToast('success', 'Archivo eliminado correctamente');
        
        // Recargar lista de archivos
        loadCsvFiles();
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al eliminar el archivo: ' + error.message);
    });
}

/**
 * Exporta la tabla de datos a un archivo CSV
 */
function exportTableToCSV(filename) {
    const tableId = 'recentDataTable';
    const table = document.getElementById(tableId);
    if (!table) {
        showToast('warning', 'No hay datos para exportar');
        return;
    }
    
    // Obtener encabezados
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
        headers.push(th.textContent.trim());
    });
    
    // Obtener filas de datos
    const rows = [];
    table.querySelectorAll('tbody tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => {
            // Extraer solo el texto plano, sin etiquetas HTML
            const content = td.textContent.trim().replace(/,/g, ';');
            row.push(content);
        });
        if (row.length > 0) {
            rows.push(row);
        }
    });
    
    // Crear contenido CSV
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Crear URL del blob
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('success', 'Datos exportados correctamente');
}

/**
 * Inicia la simulación con los parámetros configurados
 */
function startSimulation() {
    // Validar que se ha seleccionado un archivo y un sensor
    const csvFile = document.getElementById('selectCsvFile').value;
    const sensorId = document.getElementById('simSelectSensor').value;
    const interval = parseInt(document.getElementById('simInterval').value) || 5000;
    const loopSim = document.getElementById('loopSimulation').checked;
    
    if (!csvFile) {
        showToast('warning', 'Por favor seleccione un archivo CSV para la simulación.');
        return;
    }
    
    if (!sensorId) {
        showToast('warning', 'Por favor seleccione un sensor para asignar los datos.');
        return;
    }
    
    // Mostrar indicador de carga
    showLoadingIndicator('Iniciando simulación...');
    
    // Preparar datos para la solicitud
    const data = {
        file: csvFile,
        sensor_id: parseInt(sensorId),
        interval: Math.floor(interval / 1000), // Convertir de ms a segundos
        loop: loopSim
    };
    
    // Enviar solicitud para iniciar simulación
    fetch('/api/simulation/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al iniciar la simulación');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        if (data.success) {
            showToast('success', 'Simulación iniciada correctamente');
            simulationRunning = true;
            
            // Actualizar UI
            document.getElementById('startSimBtn').disabled = true;
            document.getElementById('stopSimBtn').disabled = false;
            
            // Configurar temporizador para actualizar progreso
            simulationTimer = setInterval(updateSimulationProgress, 1000);
            
            // Mostrar panel de estado
            document.getElementById('simulationStatusPlaceholder').classList.add('d-none');
            document.getElementById('simulationStatus').classList.remove('d-none');
            
            // Actualizar información de estado
            updateSimulationStatus(true);
            
            // Actualizar dashboard para mostrar datos en tiempo real
            updateDashboardData();
        } else {
            showToast('warning', data.message || 'Error desconocido al iniciar la simulación');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al iniciar la simulación: ' + error.message);
    });
}

/**
 * Detiene la simulación en curso
 */
function stopSimulation() {
    if (!simulationRunning) {
        return;
    }
    
    // Mostrar indicador de carga
    showLoadingIndicator('Deteniendo simulación...');
    
    // Enviar solicitud para detener simulación
    fetch('/api/simulation/stop', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al detener la simulación');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        if (data.success) {
            showToast('success', 'Simulación detenida correctamente');
            simulationRunning = false;
            
            // Limpiar temporizador
            if (simulationTimer) {
                clearInterval(simulationTimer);
                simulationTimer = null;
            }
            
            // Actualizar UI
            document.getElementById('startSimBtn').disabled = false;
            document.getElementById('stopSimBtn').disabled = true;
            
            // Actualizar información de estado
            updateSimulationStatus(false);
        } else {
            showToast('warning', data.message || 'Error desconocido al detener la simulación');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al detener la simulación: ' + error.message);
    });
}

/**
 * Verifica el estado actual de la simulación
 */
function checkSimulationStatus() {
    fetch('/api/simulation/status')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al verificar estado de simulación');
            }
            return response.json();
        })
        .then(data => {
            // Actualizar variables globales
            simulationRunning = data.running;
            
            if (data.running) {
                // Actualizar progreso de simulación
                simulationProgress = {
                    current: data.processed_records,
                    total: data.total_records,
                    startTime: new Date(data.start_time) || new Date()
                };
                
                // Configurar temporizador si está corriendo
                if (!simulationTimer) {
                    simulationTimer = setInterval(updateSimulationProgress, 1000);
                }
                
                // Mostrar panel de estado
                document.getElementById('simulationStatusPlaceholder').classList.add('d-none');
                document.getElementById('simulationStatus').classList.remove('d-none');
                
                // Actualizar botones
                document.getElementById('startSimBtn').disabled = true;
                document.getElementById('stopSimBtn').disabled = false;
            } else {
                // Limpiar temporizador si no está corriendo
                if (simulationTimer) {
                    clearInterval(simulationTimer);
                    simulationTimer = null;
                }
                
                // Ocultar panel de estado si no hay simulación activa
                if (data.processed_records === 0) {
                    document.getElementById('simulationStatusPlaceholder').classList.remove('d-none');
                    document.getElementById('simulationStatus').classList.add('d-none');
                }
                
                // Actualizar botones
                document.getElementById('startSimBtn').disabled = false;
                document.getElementById('stopSimBtn').disabled = true;
            }
            
            // Actualizar información de estado
            updateSimulationStatus(data.running);
        })
        .catch(error => {
            console.error('Error:', error);
            // No mostrar toast para no interrumpir al usuario
        });
}

/**
 * Actualiza la interfaz con el estado actual de la simulación
 */
function updateSimulationStatus(running) {
    // Actualizar información de simulación en la interfaz
    fetch('/api/simulation/status')
        .then(response => response.json())
        .then(data => {
            document.getElementById('simStatusFile').textContent = data.file || '-';
            document.getElementById('simStatusSensor').textContent = `ID: ${data.sensor_id || '-'}`;
            document.getElementById('simStatusInterval').textContent = `${data.interval || '-'} seg`;
            
            const statusElement = document.getElementById('simStatusState');
            if (statusElement) {
                if (running) {
                    statusElement.textContent = 'Corriendo';
                    statusElement.className = 'mb-0 text-success';
                } else {
                    statusElement.textContent = 'Detenido';
                    statusElement.className = 'mb-0 text-danger';
                }
            }
            
            // Actualizar progreso
            simulationProgress.current = data.processed_records || 0;
            simulationProgress.total = data.total_records || 0;
            
            // Actualizar barra de progreso
            const progressBar = document.getElementById('simProgressBar');
            if (progressBar && simulationProgress.total > 0) {
                const percentage = Math.min(100, Math.round((simulationProgress.current / simulationProgress.total) * 100));
                progressBar.style.width = `${percentage}%`;
                progressBar.textContent = `${percentage}%`;
                progressBar.setAttribute('aria-valuenow', percentage);
            }
            
            // Actualizar contadores de registros
            document.getElementById('simCurrentRecord').textContent = simulationProgress.current.toLocaleString();
            document.getElementById('simTotalRecords').textContent = simulationProgress.total.toLocaleString();
            
            // Actualizar alertas generadas (si están disponibles)
            if (data.alerts) {
                document.getElementById('simAlerts1').textContent = data.alerts.level1 || 0;
                document.getElementById('simAlerts2').textContent = data.alerts.level2 || 0;
                document.getElementById('simAlerts3').textContent = data.alerts.level3 || 0;
            }
        })
        .catch(error => console.error('Error actualizando estado de simulación:', error));
}

/**
 * Actualiza el progreso de la simulación
 */
function updateSimulationProgress() {
    if (!simulationRunning) return;
    
    // Actualizar el estado de la simulación
    updateSimulationStatus(true);
    
    // Actualizar tiempos
    updateSimulationTimes();
    
    // Actualizar contadores de alertas
    updateSimulationAlerts();
    
    // Actualizar dashboard si es la sección activa
    if (window.currentSection === 'dashboard') {
        updateDashboardData();
    }
}

/**
 * Actualiza los tiempos de simulación
 */
function updateSimulationTimes() {
    // Solo si tenemos una simulación en curso
    if (!simulationRunning || !simulationProgress.startTime) return;
    
    // Calcular tiempo transcurrido
    const now = new Date();
    const elapsedMs = now - simulationProgress.startTime;
    document.getElementById('simElapsedTime').textContent = formatTime(elapsedMs);
    
    // Calcular tiempo restante (si tenemos suficiente información)
    if (simulationProgress.current > 0 && simulationProgress.total > 0) {
        const recordsRemaining = simulationProgress.total - simulationProgress.current;
        const msPerRecord = elapsedMs / simulationProgress.current;
        const remainingMs = recordsRemaining * msPerRecord;
        document.getElementById('simRemainingTime').textContent = formatTime(remainingMs);
    } else {
        document.getElementById('simRemainingTime').textContent = '--:--:--';
    }
}

/**
 * Formatea un tiempo en milisegundos a formato HH:MM:SS
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Actualiza los contadores de alertas de la simulación
 */
function updateSimulationAlerts() {
    if (!simulationRunning) return;
    
    // Obtener contadores de alertas
    fetch('/api/alerts/count')
        .then(response => response.json())
        .then(data => {
            // Actualizar contadores en la sección de simulación
            document.getElementById('simAlerts1').textContent = data.level1 || 0;
            document.getElementById('simAlerts2').textContent = data.level2 || 0;
            document.getElementById('simAlerts3').textContent = data.level3 || 0;
            
            // También actualizar contadores en el dashboard
            updateAlertCounters(data.level1 || 0, data.level2 || 0, data.level3 || 0);
        })
        .catch(error => console.error('Error actualizando alertas:', error));
}

/**
 * Genera alertas recientes simuladas
 */
function generateRecentAlerts(count) {
    const alerts = [];
    let points = 0;
    
    switch (timeRange) {
        case '15m':
            points = 30;
            break;
        case '1h':
            points = 40;
            break;
        case '6h':
            points = 50;
            break;
        case '24h':
        default:
            points = 60;
    }
    
    // Limpiar datos existentes
    chartData.timestamps = [];
    chartData.x = [];
    chartData.y = [];
    chartData.z = [];
    chartData.status = [];
    
    // Generar un punto base
    let baseX = Math.random() * 2 + 1;
    let baseY = Math.random() * 2 + 0.5;
    let baseZ = Math.random() * 2 + 0.8;
    
    // Obtener la hora actual
    const now = new Date();
    
    // Definir duración por punto basado en el rango de tiempo
    const msPerPoint = getMillisecondsFromTimeRange(timeRange) / points;
    
    // Generar puntos
    for (let i = 0; i < points; i++) {
        // Calcular timestamp
        const timestamp = new Date(now.getTime() - (points - i) * msPerPoint);
        
        // Añadir un poco de ruido aleatorio
        const noiseX = (Math.random() - 0.5) * 0.3;
        const noiseY = (Math.random() - 0.5) * 0.3;
        const noiseZ = (Math.random() - 0.5) * 0.3;
        
        // Añadir alguna tendencia (aumento gradual en algún eje)
        const trendX = (i / points) * 0.5;
        
        // Simular algún pico cada cierto tiempo (15-20 puntos)
        const spikeX = (i % 15 === 0) ? Math.random() * 1.5 : 0;
        const spikeY = (i % 20 === 0) ? Math.random() * 1.2 : 0;
        
        // Calcular valores finales
        const x = baseX + noiseX + trendX + spikeX;
        const y = baseY + noiseY + spikeY;
        const z = baseZ + noiseZ;
        
        // Determinar status
        let status = 'normal';
        if (x > stats.sigma3.upper.x || y > stats.sigma3.upper.y || z > stats.sigma3.upper.z) {
            status = 'level3';
        } else if (x > stats.sigma2.upper.x || y > stats.sigma2.upper.y || z > stats.sigma2.upper.z) {
            status = 'level2';
        } else if (x > stats.sigma1.upper.x || y > stats.sigma1.upper.y || z > stats.sigma1.upper.z) {
            status = 'level1';
        }
        
        // Agregar datos
        chartData.timestamps.push(timestamp);
        chartData.x.push(x);
        chartData.y.push(y);
        chartData.z.push(z);
        chartData.status.push(status);
    }
}

// Obtiene los milisegundos para un rango de tiempo
function getMillisecondsFromTimeRange(range) {
    switch (range) {
        case '15m':
            return 15 * 60 * 1000;
        case '1h':
            return 60 * 60 * 1000;
        case '6h':
            return 6 * 60 * 60 * 1000;
        case '24h':
            return 24 * 60 * 60 * 1000;
        default:
            return 60 * 60 * 1000; // 1 hora por defecto
    }
}

// Actualiza el gráfico de vibraciones
function updateVibrationChart() {
    if (!vibrationChart) {
        console.error('El gráfico de vibraciones no está inicializado');
        return;
    }
    
    // Configurar datos
    vibrationChart.data.labels = chartData.timestamps;
    vibrationChart.data.datasets[0].data = chartData.x.map((value, index) => {
        return {
            x: chartData.timestamps[index],
            y: value
        };
    });
    
    vibrationChart.data.datasets[1].data = chartData.y.map((value, index) => {
        return {
            x: chartData.timestamps[index],
            y: value
        };
    });
    
    vibrationChart.data.datasets[2].data = chartData.z.map((value, index) => {
        return {
            x: chartData.timestamps[index],
            y: value
        };
    });
    
    // Actualizar limites en el gráfico
    updateChartWithStatLimits();
    
    // Actualizar el gráfico
    vibrationChart.update();
}

// Actualiza la tabla de datos recientes
function updateRecentDataTable() {
    const tableBody = document.getElementById('recentDataTable').querySelector('tbody');
    
    if (!tableBody) {
        console.error('No se encontró el cuerpo de la tabla de datos recientes');
        return;
    }
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    // Obtener los últimos 5 puntos (o menos si no hay suficientes)
    const recentPoints = Math.min(5, chartData.timestamps.length);
    
    // Añadir filas en la tabla
    for (let i = chartData.timestamps.length - 1; i >= chartData.timestamps.length - recentPoints; i--) {
        if (i < 0) break;
        
        const timestamp = chartData.timestamps[i];
        const x = chartData.x[i];
        const y = chartData.y[i];
        const z = chartData.z[i];
        const status = chartData.status[i];
        
        // Crear fila
        const row = document.createElement('tr');
        
        // Añadir clase según el estado
        if (status === 'level3') {
            row.className = 'table-danger';
        } else if (status === 'level2') {
            row.className = 'table-warning';
        } else if (status === 'level1') {
            row.className = 'table-info';
        }
        
        // Añadir contenido
        row.innerHTML = `
            <td>${timestamp.toLocaleTimeString()}</td>
            <td>${x.toFixed(4)}</td>
            <td>${y.toFixed(4)}</td>
            <td>${z.toFixed(4)}</td>
            <td>${Math.sqrt(x*x + y*y + z*z).toFixed(4)}</td>
        `;
        
        // Añadir a la tabla
        tableBody.appendChild(row);
    }
}

// Cambia el color del fondo del gráfico según la severidad
function colorBackgroundBySeverity(severity) {
    if (!vibrationChart) return;
    
    const backgroundColor = getBackgroundColorForSeverity(severity);
    
    // Actualizar plugin bgColor
    vibrationChart.options.plugins.bgColor = {
        backgroundColor: {
            fill: backgroundColor
        }
    };
    
    // Actualizar el gráfico
    vibrationChart.update();
}

// Obtiene la posición X para un índice dado
function getXPosition(index) {
    if (!vibrationChart || !vibrationChart.data.labels || index >= vibrationChart.data.labels.length) {
        return null;
    }
    
    return vibrationChart.data.labels[index];
}

// Obtiene el color de fondo para una severidad dada
function getBackgroundColorForSeverity(severity) {
    switch (severity) {
        case 'level1':
            return 'rgba(255, 206, 86, 0.1)';
        case 'level2':
            return 'rgba(255, 159, 64, 0.1)';
        case 'level3':
            return 'rgba(255, 99, 132, 0.1)';
        default:
            return 'rgba(75, 192, 192, 0.05)';
    }
}

// Actualiza el gráfico con límites estadísticos
function updateChartWithStatLimits() {
    if (!vibrationChart) return;
    
    // Eliminar datasets para los límites si existen
    while (vibrationChart.data.datasets.length > 3) {
        vibrationChart.data.datasets.pop();
    }
    
    // Obtener los checkbox de límites
    const showSigma1 = document.getElementById('showSigma1') && document.getElementById('showSigma1').checked;
    const showSigma2 = document.getElementById('showSigma2') && document.getElementById('showSigma2').checked;
    const showSigma3 = document.getElementById('showSigma3') && document.getElementById('showSigma3').checked;
    
    // Preparar líneas para los límites
    if (showSigma1) {
        // Añadir líneas para sigma 1
        vibrationChart.data.datasets.push({
            label: 'Límite +1σ',
            data: chartData.timestamps.map(t => ({ x: t, y: stats.sigma1.upper.x })),
            borderColor: 'rgba(255, 206, 86, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        vibrationChart.data.datasets.push({
            label: 'Límite -1σ',
            data: chartData.timestamps.map(t => ({ x: t, y: stats.sigma1.lower.x })),
            borderColor: 'rgba(255, 206, 86, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
    
    if (showSigma2) {
        // Añadir líneas para sigma 2
        vibrationChart.data.datasets.push({
            label: 'Límite +2σ',
            data: chartData.timestamps.map(t => ({ x: t, y: stats.sigma2.upper.x })),
            borderColor: 'rgba(255, 159, 64, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        vibrationChart.data.datasets.push({
            label: 'Límite -2σ',
            data: chartData.timestamps.map(t => ({ x: t, y: stats.sigma2.lower.x })),
            borderColor: 'rgba(255, 159, 64, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
    
    if (showSigma3) {
        // Añadir líneas para sigma 3
        vibrationChart.data.datasets.push({
            label: 'Límite +3σ',
            data: chartData.timestamps.map(t => ({ x: t, y: stats.sigma3.upper.x })),
            borderColor: 'rgba(255, 99, 132, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        vibrationChart.data.datasets.push({
            label: 'Límite -3σ',
            data: chartData.timestamps.map(t => ({ x: t, y: stats.sigma3.lower.x })),
            borderColor: 'rgba(255, 99, 132, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
}

/**
 * Añade un formulario para ajustar los límites estadísticos
 */
function showAdjustLimitsForm() {
    // Crear modal para ajustar límites
    const modalHtml = `
        <div class="modal fade" id="adjustLimitsModal" tabindex="-1" role="dialog">
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Ajustar Límites Estadísticos</h5>
                        <button type="button" class="close" data-dismiss="modal">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-4">
                                <h6 class="text-center">Eje X</h6>
                                <div class="form-group">
                                    <label>Límite Superior 2σ</label>
                                    <input type="number" step="0.01" class="form-control" id="x-sigma2-upper" value="${stats.sigma2.upper.x.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Inferior 2σ</label>
                                    <input type="number" step="0.01" class="form-control" id="x-sigma2-lower" value="${stats.sigma2.lower.x.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Superior 3σ</label>
                                    <input type="number" step="0.01" class="form-control" id="x-sigma3-upper" value="${stats.sigma3.upper.x.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Inferior 3σ</label>
                                    <input type="number" step="0.01" class="form-control" id="x-sigma3-lower" value="${stats.sigma3.lower.x.toFixed(4)}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <h6 class="text-center">Eje Y</h6>
                                <div class="form-group">
                                    <label>Límite Superior 2σ</label>
                                    <input type="number" step="0.01" class="form-control" id="y-sigma2-upper" value="${stats.sigma2.upper.y.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Inferior 2σ</label>
                                    <input type="number" step="0.01" class="form-control" id="y-sigma2-lower" value="${stats.sigma2.lower.y.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Superior 3σ</label>
                                    <input type="number" step="0.01" class="form-control" id="y-sigma3-upper" value="${stats.sigma3.upper.y.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Inferior 3σ</label>
                                    <input type="number" step="0.01" class="form-control" id="y-sigma3-lower" value="${stats.sigma3.lower.y.toFixed(4)}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <h6 class="text-center">Eje Z</h6>
                                <div class="form-group">
                                    <label>Límite Superior 2σ</label>
                                    <input type="number" step="0.01" class="form-control" id="z-sigma2-upper" value="${stats.sigma2.upper.z.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Inferior 2σ</label>
                                    <input type="number" step="0.01" class="form-control" id="z-sigma2-lower" value="${stats.sigma2.lower.z.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Superior 3σ</label>
                                    <input type="number" step="0.01" class="form-control" id="z-sigma3-upper" value="${stats.sigma3.upper.z.toFixed(4)}">
                                </div>
                                <div class="form-group">
                                    <label>Límite Inferior 3σ</label>
                                    <input type="number" step="0.01" class="form-control" id="z-sigma3-lower" value="${stats.sigma3.lower.z.toFixed(4)}">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="saveLimitsBtn">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Añadir modal al DOM si no existe
    if (!document.getElementById('adjustLimitsModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Manejar evento de guardar cambios
        document.getElementById('saveLimitsBtn').addEventListener('click', function() {
            updateStatisticalLimitsInBackend();
        });
    }
    
    // Mostrar modal
    $('#adjustLimitsModal').modal('show');
}

/**
 * Actualiza los límites estadísticos en el backend
 */
function updateStatisticalLimitsInBackend() {
    // Recopilar valores del formulario
    const limits = {
        x: {
            sigma2: {
                lower: parseFloat(document.getElementById('x-sigma2-lower').value),
                upper: parseFloat(document.getElementById('x-sigma2-upper').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('x-sigma3-lower').value),
                upper: parseFloat(document.getElementById('x-sigma3-upper').value)
            }
        },
        y: {
            sigma2: {
                lower: parseFloat(document.getElementById('y-sigma2-lower').value),
                upper: parseFloat(document.getElementById('y-sigma2-upper').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('y-sigma3-lower').value),
                upper: parseFloat(document.getElementById('y-sigma3-upper').value)
            }
        },
        z: {
            sigma2: {
                lower: parseFloat(document.getElementById('z-sigma2-lower').value),
                upper: parseFloat(document.getElementById('z-sigma2-upper').value)
            },
            sigma3: {
                lower: parseFloat(document.getElementById('z-sigma3-lower').value),
                upper: parseFloat(document.getElementById('z-sigma3-upper').value)
            }
        }
    };
    
    // Actualizar estado local
    for (const axis of ['x', 'y', 'z']) {
        stats.sigma2.lower[axis] = limits[axis].sigma2.lower;
        stats.sigma2.upper[axis] = limits[axis].sigma2.upper;
        stats.sigma3.lower[axis] = limits[axis].sigma3.lower;
        stats.sigma3.upper[axis] = limits[axis].sigma3.upper;
    }
    
    // Actualizar gráfico con nuevos límites
    updateChartWithStatLimits();
    
    // Cerrar modal
    $('#adjustLimitsModal').modal('hide');
    
    // Actualizar límites en el backend
    const updateRequests = [];
    
    // Función para crear una promesa de actualización para un límite específico
    const createUpdateRequest = (axis, sigmaLevel, limitType, value) => {
        return fetch(`/api/statistical-limits/${axis}/${sigmaLevel}/${limitType}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value }),
        }).then(response => {
            if (!response.ok) throw new Error(`Error al actualizar ${axis} ${sigmaLevel} ${limitType}`);
            return response.json();
        });
    };
    
    // Crear promesas para cada actualización
    for (const axis of ['x', 'y', 'z']) {
        updateRequests.push(createUpdateRequest(axis, 'sigma2', 'lower', limits[axis].sigma2.lower));
        updateRequests.push(createUpdateRequest(axis, 'sigma2', 'upper', limits[axis].sigma2.upper));
        updateRequests.push(createUpdateRequest(axis, 'sigma3', 'lower', limits[axis].sigma3.lower));
        updateRequests.push(createUpdateRequest(axis, 'sigma3', 'upper', limits[axis].sigma3.upper));
    }
    
    // Procesar todas las actualizaciones
    Promise.all(updateRequests)
        .then(() => {
            showToast('success', 'Límites estadísticos actualizados correctamente');
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('danger', 'Error al actualizar límites: ' + error.message);
        });
} 