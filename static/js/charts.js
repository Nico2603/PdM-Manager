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

// Estadísticas para límites (valores por defecto)
let stats = {
    // Límites para el eje X
    x: {
        sigma2: {
            lower: -2.364295,
            upper: 2.180056
        },
        sigma3: {
            lower: -3.500383,
            upper: 3.316144
        }
    },
    // Límites para el eje Y
    y: {
        sigma2: {
            lower: 7.177221,
            upper: 12.088666
        },
        sigma3: {
            lower: 5.949359,
            upper: 13.316528
        }
    },
    // Límites para el eje Z
    z: {
        sigma2: {
            lower: -2.389107,
            upper: 1.106510
        },
        sigma3: {
            lower: -3.263011,
            upper: 1.980414
        }
    }
};

// Opciones de visualización
let showMean = true;     // Mostrar línea de media
let showSigmaLines = true; // Mostrar líneas de límites sigma

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
                    hidden: !showMean
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
                    hidden: !showSigmaLines
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
                    hidden: !showSigmaLines
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
                    hidden: !showSigmaLines
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
                    hidden: !showSigmaLines
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
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#f9fafb',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(107, 114, 128, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 4,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            const value = context.parsed.y;
                            
                            if (datasetLabel.includes('Media')) {
                                return `Media: ${value.toFixed(4)}`;
                            } else if (datasetLabel.includes('Límite')) {
                                return `${datasetLabel}: ${value.toFixed(4)}`;
                            } else {
                                return `${datasetLabel}: ${value.toFixed(4)} m/s²`;
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Asignar a la variable global correspondiente
    window[`vibrationChart${axis.toUpperCase()}`] = chart;
    
    return chart;
}

// Actualizar gráfico del eje X
function updateVibrationChartX() {
    updateAxisChart(window.vibrationChartX, 'x');
}

// Actualizar gráfico del eje Y
function updateVibrationChartY() {
    updateAxisChart(window.vibrationChartY, 'y');
}

// Actualizar gráfico del eje Z
function updateVibrationChartZ() {
    updateAxisChart(window.vibrationChartZ, 'z');
}

// Actualizar gráfico de un eje
function updateAxisChart(chart, axis) {
    if (!chart) return;
    
    // Actualizar datos
    chart.data.labels = chartData.timestamps;
    chart.data.datasets[0].data = chartData[axis];
    
    // Calcular media
    let mean = 0;
    if (chartData[axis] && chartData[axis].length > 0) {
        mean = chartData[axis].reduce((sum, value) => sum + value, 0) / chartData[axis].length;
    }
    
    // Actualizar línea de media
    chart.data.datasets[1].data = Array(chartData.timestamps.length).fill(mean);
    chart.data.datasets[1].hidden = !showMean;
    
    // Actualizar líneas de límites
    chart.data.datasets[2].data = Array(chartData.timestamps.length).fill(stats[axis].sigma2.upper);
    chart.data.datasets[3].data = Array(chartData.timestamps.length).fill(stats[axis].sigma2.lower);
    chart.data.datasets[4].data = Array(chartData.timestamps.length).fill(stats[axis].sigma3.upper);
    chart.data.datasets[5].data = Array(chartData.timestamps.length).fill(stats[axis].sigma3.lower);
    
    // Actualizar visibilidad de líneas sigma
    chart.data.datasets[2].hidden = !showSigmaLines;
    chart.data.datasets[3].hidden = !showSigmaLines;
    chart.data.datasets[4].hidden = !showSigmaLines;
    chart.data.datasets[5].hidden = !showSigmaLines;
    
    // Colorear puntos según estado de alerta
    const pointBackgroundColors = [];
    const pointBorderColors = [];
    const pointRadiuses = [];
    
    chartData.status.forEach(status => {
        let color = SEVERITY_COLORS[status] || SEVERITY_COLORS[0];
        pointBackgroundColors.push(color);
        pointBorderColors.push(color);
        pointRadiuses.push(status > 0 ? 4 : 2); // Puntos más grandes para alertas
    });
    
    chart.data.datasets[0].pointBackgroundColor = pointBackgroundColors;
    chart.data.datasets[0].pointBorderColor = pointBorderColors;
    chart.data.datasets[0].pointRadius = pointRadiuses;
    
    // Actualizar gráfico
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
    if (limits) {
        // Actualizar variable global de stats
        stats = limits;
    }
    
    // Actualizar gráficos
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
window.stats = stats; 