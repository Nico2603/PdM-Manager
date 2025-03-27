/**
 * PdM-Manager - JavaScript Gráficos v1.0.0
 * Funciones para la inicialización y actualización de gráficos
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// VARIABLES GLOBALES PARA GRÁFICOS
// ==========================================================================

// Gráficos
let vibrationChartX = null;
let vibrationChartY = null;
let vibrationChartZ = null;
let alertsHistoryChart = null;

// Datos de los gráficos
let chartData = {
    timestamps: [],
    x: [],
    y: [],
    z: [],
    status: []
};

// Las estadísticas ahora se manejan con el estado global en utils.js

// ==========================================================================
// INICIALIZACIÓN DE GRÁFICOS
// ==========================================================================

// Inicializar gráficos de vibración (todos los ejes)
function initVibrationChart() {
    initAxisChart('vibrationChartX', 'Vibración Eje X', 'x');
    initAxisChart('vibrationChartY', 'Vibración Eje Y', 'y');
    initAxisChart('vibrationChartZ', 'Vibración Eje Z', 'z');
}

// Inicializar un gráfico de vibración para un eje específico
function initAxisChart(canvasId, title, axis) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    // Comprobar si el gráfico ya existe y destruirlo
    if (window[`vibrationChart${axis.toUpperCase()}`]) {
        window[`vibrationChart${axis.toUpperCase()}`].destroy();
    }
    
    // Calcular media para las líneas
    const values = chartData[axis];
    let mean = 0;
    if (values && values.length > 0) {
        mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    
    // Obtener los límites del estado global
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions');
    
    // Configuración del gráfico
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.timestamps,
            datasets: [
                {
                    label: `${title} (m/s²)`,
                    data: chartData[axis],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 2,
                    pointHoverRadius: 5
                },
                {
                    label: 'Media',
                    data: Array(chartData.timestamps.length).fill(mean),
                    borderColor: '#6b7280',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hidden: !chartOptions.showMean
                },
                {
                    label: 'Límite Superior +2σ',
                    data: Array(chartData.timestamps.length).fill(stats[axis].sigma2.upper),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 1.5,
                    borderDash: [5, 3],
                    fill: '+4',  // Llenar hasta el dataset 4 (límite inferior)
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hidden: !chartOptions.showSigmaLines
                },
                {
                    label: 'Límite Inferior -2σ',
                    data: Array(chartData.timestamps.length).fill(stats[axis].sigma2.lower),
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                    borderDash: [5, 3],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hidden: !chartOptions.showSigmaLines
                },
                {
                    label: 'Límite Superior +3σ',
                    data: Array(chartData.timestamps.length).fill(stats[axis].sigma3.upper),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    fill: '+6',  // Llenar hasta el dataset 6 (límite inferior)
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hidden: !chartOptions.showSigmaLines
                },
                {
                    label: 'Límite Inferior -3σ',
                    data: Array(chartData.timestamps.length).fill(stats[axis].sigma3.lower),
                    borderColor: '#ef4444',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hidden: !chartOptions.showSigmaLines
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 150
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        drawBorder: false
                    },
                    ticks: {
                        padding: 10
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: {
                        size: 12
                    },
                    bodyFont: {
                        size: 11
                    },
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            let label = context.dataset.label || '';
                            
                            if (label) {
                                label += ': ';
                            }
                            
                            if (value !== null) {
                                label += value.toFixed(3);
                            }
                            
                            return label;
                        }
                    }
                }
            }
        }
    });
    
    // Guardar referencia al gráfico
    window[`vibrationChart${axis.toUpperCase()}`] = chart;
    
    // También guardar en las variables globales
    if (axis === 'x') vibrationChartX = chart;
    if (axis === 'y') vibrationChartY = chart;
    if (axis === 'z') vibrationChartZ = chart;
    
    return chart;
}

// Actualizar datos del gráfico X
function updateVibrationChartX() {
    updateAxisChart(vibrationChartX, 'x');
}

// Actualizar datos del gráfico Y
function updateVibrationChartY() {
    updateAxisChart(vibrationChartY, 'y');
}

// Actualizar datos del gráfico Z
function updateVibrationChartZ() {
    updateAxisChart(vibrationChartZ, 'z');
}

// Actualizar gráfico para un eje específico
function updateAxisChart(chart, axis) {
    if (!chart) return;
    
    // Calcular media para la línea de media
    let mean = 0;
    if (chartData[axis] && chartData[axis].length > 0) {
        mean = chartData[axis].reduce((sum, value) => sum + value, 0) / chartData[axis].length;
    }
    
    // Obtener los límites del estado global
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions');
    
    // Actualizar datos
    chart.data.labels = chartData.timestamps;
    chart.data.datasets[0].data = chartData[axis];
    chart.data.datasets[1].data = Array(chartData.timestamps.length).fill(mean);
    chart.data.datasets[2].data = Array(chartData.timestamps.length).fill(stats[axis].sigma2.upper);
    chart.data.datasets[3].data = Array(chartData.timestamps.length).fill(stats[axis].sigma2.lower);
    chart.data.datasets[4].data = Array(chartData.timestamps.length).fill(stats[axis].sigma3.upper);
    chart.data.datasets[5].data = Array(chartData.timestamps.length).fill(stats[axis].sigma3.lower);
    
    // Actualizar visibilidad según configuración
    chart.data.datasets[1].hidden = !chartOptions.showMean;
    chart.data.datasets[2].hidden = !chartOptions.showSigmaLines;
    chart.data.datasets[3].hidden = !chartOptions.showSigmaLines;
    chart.data.datasets[4].hidden = !chartOptions.showSigmaLines;
    chart.data.datasets[5].hidden = !chartOptions.showSigmaLines;
    
    // Aplicar actualización
    chart.update();
}

// Inicializar gráfico de historial de alertas
function initAlertsHistoryChart() {
    const canvas = document.getElementById('alertsHistoryChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Si ya existe, destruirlo
    if (alertsHistoryChart) {
        alertsHistoryChart.destroy();
    }
    
    // Preparar datos iniciales
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const datasets = [
        {
            label: 'Nivel 1',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: SEVERITY_COLORS[1],
            borderColor: SEVERITY_COLORS[1],
            borderWidth: 1
        },
        {
            label: 'Nivel 2',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: SEVERITY_COLORS[2],
            borderColor: SEVERITY_COLORS[2],
            borderWidth: 1
        },
        {
            label: 'Nivel 3',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: SEVERITY_COLORS[3],
            borderColor: SEVERITY_COLORS[3],
            borderWidth: 1
        }
    ];
    
    // Crear gráfico
    alertsHistoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
    
    // Cargar datos reales
    fetchAlertsHistoryData();
    
    return alertsHistoryChart;
}

// Cargar datos para el gráfico de historial de alertas
function fetchAlertsHistoryData() {
    // Simular carga de datos (deberá reemplazarse con llamada API real)
    setTimeout(() => {
        const level1Data = [3, 1, 5, 2, 7, 4, 1];
        const level2Data = [1, 0, 2, 1, 3, 0, 0];
        const level3Data = [0, 0, 1, 0, 1, 0, 0];
        
        updateAlertsHistoryChart(level1Data, level2Data, level3Data);
    }, 500);
}

// Actualizar el gráfico de historial de alertas con nuevos datos
function updateAlertsHistoryChart(level1Data, level2Data, level3Data) {
    if (!alertsHistoryChart) return;
    
    alertsHistoryChart.data.datasets[0].data = level1Data;
    alertsHistoryChart.data.datasets[1].data = level2Data;
    alertsHistoryChart.data.datasets[2].data = level3Data;
    
    alertsHistoryChart.update();
}

// ==========================================================================
// DESCARGA DE GRÁFICOS
// ==========================================================================

// Inicializar botones de descarga de gráficos
function initChartDownloadButtons() {
    const downloadButtons = document.querySelectorAll('.download-chart-btn');
    
    downloadButtons.forEach(button => {
        button.addEventListener('click', () => {
            const chartId = button.getAttribute('data-chart');
            const filename = button.getAttribute('data-filename') || 'chart';
            
            if (chartId) {
                downloadChart(chartId, filename);
            }
        });
    });
}

// Descargar gráfico como imagen PNG
function downloadChart(chartId, filename) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    
    // Crear enlace de descarga
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ==========================================================================
// ACTUALIZACIÓN DE LÍMITES
// ==========================================================================

// Actualizar gráficos con nuevos límites
function updateChartsWithNewLimits(limits) {
    // Actualizar variable global de stats
    if (limits && typeof limits === 'object') {
        // Actualizar el estado global
        updateGlobalStats(limits);
        
        // Actualizar los gráficos
        if (vibrationChartX) updateVibrationChartX();
        if (vibrationChartY) updateVibrationChartY();
        if (vibrationChartZ) updateVibrationChartZ();
        
        // Actualizar los valores estadísticos mostrados
        if (typeof updateStatisticalDisplayValues === 'function') {
            updateStatisticalDisplayValues();
        }
    }
}

// Función para actualizar la visibilidad de los gráficos
function updateChartsVisibility() {
    // Obtener el estado de los switches
    const showMean = document.getElementById('showMean')?.checked || false;
    const show1Sigma = document.getElementById('show1Sigma')?.checked || false;
    const show2Sigma = document.getElementById('show2Sigma')?.checked || false;
    const show3Sigma = document.getElementById('show3Sigma')?.checked || false;
    
    // Actualizar el estado global
    setGlobalState('chartOptions', {
        showMean: showMean,
        showSigmaLines: show2Sigma || show3Sigma
    });
    
    // Actualizar los gráficos
    updateVibrationChartX();
    updateVibrationChartY();
    updateVibrationChartZ();
}

// Exportar funciones para uso global
window.initVibrationChart = initVibrationChart;
window.initAxisChart = initAxisChart;
window.updateVibrationChartX = updateVibrationChartX;
window.updateVibrationChartY = updateVibrationChartY;
window.updateVibrationChartZ = updateVibrationChartZ;
window.updateAxisChart = updateAxisChart;
window.initAlertsHistoryChart = initAlertsHistoryChart;
window.initChartDownloadButtons = initChartDownloadButtons;
window.downloadChart = downloadChart;
window.updateChartsWithNewLimits = updateChartsWithNewLimits;
window.chartData = chartData;
window.stats = getGlobalState('stats'); 