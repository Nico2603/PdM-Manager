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
    
    // Obtener los límites del estado global
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions');
    
    // Configuración de colores y opciones
    const chartColors = {
        x: '#FF6384',
        y: '#36A2EB',
        z: '#4BC0C0'
    };
    
    // Conjuntos de datos base
    const datasets = [
        {
            label: `Aceleración eje ${axis.toUpperCase()}`,
            data: chartData[axis],
            borderColor: chartColors[axis],
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
        }
    ];
    
    // Añadir líneas estadísticas si están disponibles y activadas
    if (stats && stats[axis]) {
        // Límites 2-sigma
        if (chartOptions.show2Sigma && stats[axis].sigma2) {
            datasets.push({
                label: '+2σ',
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma2.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: '-2σ',
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma2.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }
        
        // Límites 3-sigma
        if (chartOptions.show3Sigma && stats[axis].sigma3) {
            datasets.push({
                label: '+3σ',
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma3.upper),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: '-3σ',
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma3.lower),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
        }
    }
    
    // Crear gráfico
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.timestamps,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'white',
                    borderWidth: 1,
                    caretPadding: 5,
                    displayColors: true,
                    callbacks: {
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const status = chartData.status[dataIndex];
                            let statusText = '';
                            
                            switch(status) {
                                case 0:
                                    statusText = 'Normal';
                                    break;
                                case 1:
                                    statusText = 'Advertencia';
                                    break;
                                case 2:
                                    statusText = 'Alerta';
                                    break;
                                case 3:
                                    statusText = 'Crítico';
                                    break;
                                default:
                                    statusText = 'Desconocido';
                            }
                            
                            return `Estado: ${statusText}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#666'
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Tiempo',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#666'
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)'
                    },
                    title: {
                        display: true,
                        text: 'Aceleración (g)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
    
    // Guardar referencia
    window[`vibrationChart${axis.toUpperCase()}`] = chart;
    
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
    
    // Obtener datos actualizados
    const values = chartData[axis];
    const timestamps = chartData.timestamps;
    
    // Actualizar datos principales
    chart.data.labels = timestamps;
    chart.data.datasets[0].data = values;
    
    // Obtener estadísticas y opciones de gráfico
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions');
    
    // Eliminar datasets adicionales (líneas estadísticas)
    while (chart.data.datasets.length > 1) {
        chart.data.datasets.pop();
    }
    
    // Añadir líneas estadísticas si están disponibles y activadas
    if (stats && stats[axis]) {
        // Límites 2-sigma
        if (chartOptions.show2Sigma && stats[axis].sigma2) {
            chart.data.datasets.push({
                label: '+2σ',
                data: Array(timestamps.length).fill(stats[axis].sigma2.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
            
            chart.data.datasets.push({
                label: '-2σ',
                data: Array(timestamps.length).fill(stats[axis].sigma2.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }
        
        // Límites 3-sigma
        if (chartOptions.show3Sigma && stats[axis].sigma3) {
            chart.data.datasets.push({
                label: '+3σ',
                data: Array(timestamps.length).fill(stats[axis].sigma3.upper),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
            
            chart.data.datasets.push({
                label: '-3σ',
                data: Array(timestamps.length).fill(stats[axis].sigma3.lower),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
        }
    }
    
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
    // Obtener los datos reales de alertas simplificadas desde el API
    fetch('/api/alerts/simplified')
        .then(response => response.json())
        .then(data => {
            // Agrupar alertas por día de la semana
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const alertsByDay = {
                'Lun': { level1: 0, level2: 0, level3: 0 },
                'Mar': { level1: 0, level2: 0, level3: 0 },
                'Mié': { level1: 0, level2: 0, level3: 0 },
                'Jue': { level1: 0, level2: 0, level3: 0 },
                'Vie': { level1: 0, level2: 0, level3: 0 },
                'Sáb': { level1: 0, level2: 0, level3: 0 },
                'Dom': { level1: 0, level2: 0, level3: 0 }
            };
            
            // Procesar cada alerta
            data.forEach(alert => {
                const date = new Date(alert.timestamp);
                const dayName = days[date.getDay()];
                
                // Determinar el nivel según el error_type
                // Asumimos que error_type puede contener información sobre el nivel
                if (alert.error_type.includes('Nivel 3') || alert.error_type.includes('Level 3') || alert.error_type.includes('Crítico')) {
                    alertsByDay[dayName].level3++;
                } else if (alert.error_type.includes('Nivel 2') || alert.error_type.includes('Level 2')) {
                    alertsByDay[dayName].level2++;
                } else {
                    alertsByDay[dayName].level1++;
                }
            });
            
            // Extraer datos para las series
            const level1Data = [];
            const level2Data = [];
            const level3Data = [];
            
            // Mantener el orden correcto de los días
            ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(day => {
                level1Data.push(alertsByDay[day].level1);
                level2Data.push(alertsByDay[day].level2);
                level3Data.push(alertsByDay[day].level3);
            });
            
            updateAlertsHistoryChart(level1Data, level2Data, level3Data);
        })
        .catch(error => {
            console.error('Error al cargar datos de alertas:', error);
            // En caso de error, mostrar datos vacíos
            updateAlertsHistoryChart([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
        });
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
    const show2Sigma = document.getElementById('show2Sigma')?.checked || false;
    const show3Sigma = document.getElementById('show3Sigma')?.checked || false;
    
    // Actualizar el estado global
    setGlobalState('chartOptions', {
        showMean: false,
        show2Sigma: show2Sigma,
        show3Sigma: show3Sigma
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

// Inicializar estado global para opciones de gráficos
document.addEventListener('DOMContentLoaded', function() {
    // Establecer las opciones iniciales de los gráficos
    const show2Sigma = document.getElementById('show2Sigma')?.checked || false;
    const show3Sigma = document.getElementById('show3Sigma')?.checked || false;
    
    setGlobalState('chartOptions', {
        showMean: false,
        show2Sigma: show2Sigma, 
        show3Sigma: show3Sigma
    });
}); 