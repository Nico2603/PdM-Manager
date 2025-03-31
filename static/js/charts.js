// ==========================================================================
// VARIABLES GLOBALES PARA GRÁFICOS
// ==========================================================================

// Gráficos
let vibrationChartX = null;
let vibrationChartY = null;
let vibrationChartZ = null;

// Datos de los gráficos
let chartData = {
    timestamps: [],
    x: [],
    y: [],
    z: [],
    status: []
};

// ==========================================================================
// INICIALIZACIÓN DE GRÁFICOS
// ==========================================================================

// Inicializar gráficos de vibración (todos los ejes)
function initVibrationChart() {
    console.log('Inicializando gráficos de vibración para todos los ejes');
    
    // Inicializar gráficos para cada eje
    vibrationChartX = initAxisChart('vibrationChartX', 'Vibración Eje X', 'x');
    vibrationChartY = initAxisChart('vibrationChartY', 'Vibración Eje Y', 'y');
    vibrationChartZ = initAxisChart('vibrationChartZ', 'Vibración Eje Z', 'z');
    
    // Verificar que todas las gráficas se crearon correctamente
    console.log('Estado de inicialización de gráficos:', {
        x: !!vibrationChartX,
        y: !!vibrationChartY,
        z: !!vibrationChartZ
    });
}

// Inicializar un gráfico de vibración para un eje específico
function initAxisChart(canvasId, title, axis) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`No se pudo encontrar el canvas con ID: ${canvasId}`);
        return null;
    }
    
    console.log(`Inicializando gráfico para eje ${axis.toUpperCase()}`);
    
    const ctx = canvas.getContext('2d');
    
    // Comprobar si el gráfico ya existe y destruirlo
    if (window[`vibrationChart${axis.toUpperCase()}`]) {
        window[`vibrationChart${axis.toUpperCase()}`].destroy();
    }
    
    // Obtener los límites del estado global
    const stats = getGlobalState('stats') || {
        x: {
            sigma2: { lower: -2.36, upper: 2.18 },
            sigma3: { lower: -3.50, upper: 3.32 }
        },
        y: {
            sigma2: { lower: 7.18, upper: 12.09 },
            sigma3: { lower: 5.95, upper: 13.32 }
        },
        z: {
            sigma2: { lower: -2.39, upper: 1.11 },
            sigma3: { lower: -3.26, upper: 1.98 }
        }
    };
    
    // Si no hay stats en el estado global, inicializar con valores por defecto
    if (!getGlobalState('stats')) {
        setGlobalState('stats', stats);
    }
    
    const chartOptions = getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    
    // Configuración de colores y opciones
    const chartColors = {
        x: '#FF6384',
        y: '#36A2EB',
        z: '#4BC0C0'
    };
    
    // Conjuntos de datos base
    const datasets = [
        {
            label: `Aceleración eje ${axis.toUpperCase()} (m/s²)`,
            data: chartData[axis] || [],
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
        if (chartOptions && chartOptions.show2Sigma && stats[axis].sigma2) {
            datasets.push({
                label: `+2σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length || 0).fill(stats[axis].sigma2.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: `-2σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length || 0).fill(stats[axis].sigma2.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }
        
        // Límites 3-sigma
        if (chartOptions && chartOptions.show3Sigma && stats[axis].sigma3) {
            datasets.push({
                label: `+3σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length || 0).fill(stats[axis].sigma3.upper),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: `-3σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length || 0).fill(stats[axis].sigma3.lower),
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
            labels: chartData.timestamps || [],
            datasets: datasets
        },
        options: {
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
                            const status = chartData.status && chartData.status[dataIndex] ? chartData.status[dataIndex] : 0;
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
                        color: 'rgba(200, 200, 200, 0.1)'
                    },
                    title: {
                        display: true,
                        text: 'Aceleración (m/s²)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
    
    console.log(`Gráfico para eje ${axis.toUpperCase()} creado correctamente`);
    
    return chart;
}

// Actualizar gráfico para eje X
function updateVibrationChartX() {
    if (!vibrationChartX) return;
    updateAxisChart(vibrationChartX, 'x');
}

// Actualizar gráfico para eje Y
function updateVibrationChartY() {
    if (!vibrationChartY) return;
    updateAxisChart(vibrationChartY, 'y');
}

// Actualizar gráfico para eje Z
function updateVibrationChartZ() {
    if (!vibrationChartZ) return;
    updateAxisChart(vibrationChartZ, 'z');
}

// Actualizar gráfico para un eje específico
function updateAxisChart(chart, axis) {
    if (!chart) return;
    
    // Obtener datos actualizados para el eje específico
    const values = chartData[axis]; // Datos del eje específico (x, y o z)
    const timestamps = chartData.timestamps;
    
    // Actualizar datos principales
    chart.data.labels = timestamps;
    chart.data.datasets[0].data = values;
    
    // Obtener estadísticas y opciones de gráfico
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    
    // Eliminar datasets adicionales (líneas estadísticas)
    while (chart.data.datasets.length > 1) {
        chart.data.datasets.pop();
    }
    
    // Añadir líneas estadísticas si están disponibles y activadas
    if (stats && stats[axis]) {
        // Límites 2-sigma (solo si show2Sigma está activo)
        if (chartOptions && chartOptions.show2Sigma && stats[axis].sigma2) {
            chart.data.datasets.push({
                label: `+2σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma2.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
            
            chart.data.datasets.push({
                label: `-2σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma2.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }
        
        // Límites 3-sigma (solo si show3Sigma está activo)
        if (chartOptions && chartOptions.show3Sigma && stats[axis].sigma3) {
            chart.data.datasets.push({
                label: `+3σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma3.upper),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
            
            chart.data.datasets.push({
                label: `-3σ (${axis.toUpperCase()})`,
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

// ==========================================================================
// ACTUALIZACIÓN DE LÍMITES
// ==========================================================================

// Actualizar gráficos con nuevos límites
function updateChartsWithNewLimits(limits) {
    console.log('Actualizando gráficos con nuevos límites:', limits);
    
    // Validar los límites
    if (!limits || typeof limits !== 'object') {
        console.error('Límites inválidos:', limits);
        return;
    }
    
    try {
        // Verificar que los límites contienen la estructura correcta para cada eje
        const ejes = ['x', 'y', 'z'];
        let limitesValidos = true;
        
        for (const eje of ejes) {
            if (!limits[eje] || !limits[eje].sigma2 || !limits[eje].sigma3 ||
                limits[eje].sigma2.upper === undefined || limits[eje].sigma2.lower === undefined ||
                limits[eje].sigma3.upper === undefined || limits[eje].sigma3.lower === undefined) {
                console.error(`Estructura de límites inválida para el eje ${eje}:`, limits[eje]);
                limitesValidos = false;
            }
        }
        
        if (!limitesValidos) {
            console.error('Estructura de límites inválida, utilizando valores por defecto');
            // Usar límites por defecto
            limits = {
                x: {
                    sigma2: { lower: -2.36, upper: 2.18 },
                    sigma3: { lower: -3.50, upper: 3.32 }
                },
                y: {
                    sigma2: { lower: 7.18, upper: 12.09 },
                    sigma3: { lower: 5.95, upper: 13.32 }
                },
                z: {
                    sigma2: { lower: -2.39, upper: 1.11 },
                    sigma3: { lower: -3.26, upper: 1.98 }
                }
            };
        }
        
        // Actualizar el estado global
        setGlobalState('stats', limits);
        
        // Verificar que las variables de los gráficos existen
        if (!vibrationChartX || !vibrationChartY || !vibrationChartZ) {
            console.warn('Algunos gráficos no están inicializados:', {
                x: !!vibrationChartX,
                y: !!vibrationChartY,
                z: !!vibrationChartZ
            });
            
            // Si no hay gráficos, intentar inicializarlos
            if (!vibrationChartX && !vibrationChartY && !vibrationChartZ) {
                console.log('Intentando inicializar gráficos...');
                initVibrationChart();
            }
        }
        
        // Actualizar los gráficos inmediatamente
        if (vibrationChartX) {
            updateAxisChartLimits(vibrationChartX, 'x', limits);
            vibrationChartX.update('none'); // Actualizar sin animación para mejor rendimiento
        }
        
        if (vibrationChartY) {
            updateAxisChartLimits(vibrationChartY, 'y', limits);
            vibrationChartY.update('none');
        }
        
        if (vibrationChartZ) {
            updateAxisChartLimits(vibrationChartZ, 'z', limits);
            vibrationChartZ.update('none');
        }
        
        // Actualizar los valores estadísticos mostrados
        if (typeof updateStatisticalDisplayValues === 'function') {
            updateStatisticalDisplayValues();
        }
        
        console.log('Gráficos actualizados con nuevos límites');
    } catch (error) {
        console.error('Error al actualizar gráficos con nuevos límites:', error);
    }
}

// Función auxiliar para actualizar límites en un gráfico específico
function updateAxisChartLimits(chart, axis, limits) {
    if (!chart || !chart.data || !chart.data.datasets) {
        console.error(`Gráfico para eje ${axis} no disponible`);
        return;
    }
    
    if (!limits || !limits[axis] || !limits[axis].sigma2 || !limits[axis].sigma3) {
        console.error(`Límites no válidos para eje ${axis}:`, limits && limits[axis]);
        return;
    }
    
    const chartOptions = getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    console.log(`Actualizando límites para eje ${axis}:`, limits[axis]);
    
    // Obtener la cantidad de puntos de datos a mostrar
    const dataLength = chart.data.labels ? chart.data.labels.length : 0;
    
    // Remover las líneas de límites existentes
    chart.data.datasets = chart.data.datasets.filter(dataset => 
        !dataset.label.includes('2σ') && !dataset.label.includes('3σ')
    );
    
    // Solo mantener el primer dataset (los datos de aceleración)
    if (chart.data.datasets.length > 1) {
        chart.data.datasets = [chart.data.datasets[0]];
    }
    
    // Añadir líneas límite 2-sigma
    if (chartOptions.show2Sigma) {
        chart.data.datasets.push({
            label: `+2σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(limits[axis].sigma2.upper),
            borderColor: 'rgba(255, 159, 64, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        chart.data.datasets.push({
            label: `-2σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(limits[axis].sigma2.lower),
            borderColor: 'rgba(255, 159, 64, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
    
    // Añadir líneas límite 3-sigma
    if (chartOptions.show3Sigma) {
        chart.data.datasets.push({
            label: `+3σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(limits[axis].sigma3.upper),
            borderColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false
        });
        
        chart.data.datasets.push({
            label: `-3σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(limits[axis].sigma3.lower),
            borderColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false
        });
    }
    
    // Actualizar el gráfico
    try {
        chart.update('none');
        console.log(`Límites actualizados para eje ${axis}`);
    } catch (error) {
        console.error(`Error al actualizar gráfico para eje ${axis}:`, error);
    }
}

// Actualizar la visibilidad de los elementos en los gráficos
function updateChartsVisibility() {
    console.log('Actualizando visibilidad de elementos en gráficos...');
    
    // Obtener estados de los switches
    const show2SigmaToggle = document.getElementById('show2Sigma');
    const show3SigmaToggle = document.getElementById('show3Sigma');
    
    const show2Sigma = show2SigmaToggle ? show2SigmaToggle.checked : true;
    const show3Sigma = show3SigmaToggle ? show3SigmaToggle.checked : true;
    
    console.log('Estado de toggles:', { show2Sigma, show3Sigma });
    
    // Actualizar opciones de visualización en el estado global
    const chartOptions = getGlobalState('chartOptions') || {};
    chartOptions.show2Sigma = show2Sigma;
    chartOptions.show3Sigma = show3Sigma;
    setGlobalState('chartOptions', chartOptions);
    
    console.log('Opciones de gráfico actualizadas:', chartOptions);
    
    // Obtener límites actuales
    const stats = getGlobalState('stats');
    if (!stats) {
        console.warn('No hay estadísticas disponibles para actualizar la visibilidad');
        return;
    }
    
    // Verificar que existen los gráficos
    if (!vibrationChartX || !vibrationChartY || !vibrationChartZ) {
        console.warn('Algunos gráficos no están inicializados al actualizar visibilidad:', {
            x: !!vibrationChartX,
            y: !!vibrationChartY,
            z: !!vibrationChartZ
        });
        return;
    }
    
    // Actualizar visibilidad en cada gráfico
    updateAxisChartVisibility(vibrationChartX, 'x', chartOptions);
    updateAxisChartVisibility(vibrationChartY, 'y', chartOptions);
    updateAxisChartVisibility(vibrationChartZ, 'z', chartOptions);
    
    console.log('Visibilidad de gráficos actualizada correctamente');
}

// Actualizar visibilidad específica de un gráfico de eje
function updateAxisChartVisibility(chart, axis, options) {
    if (!chart || !chart.data || !chart.data.datasets) {
        console.warn(`No se puede actualizar visibilidad del gráfico para eje ${axis}`);
        return;
    }
    
    const chartOptions = options || getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    console.log(`Actualizando visibilidad del gráfico para eje ${axis}:`, chartOptions);
    
    // Obtener límites actuales
    const stats = getGlobalState('stats');
    if (!stats || !stats[axis]) {
        console.warn(`No hay estadísticas disponibles para el eje ${axis}`);
        return;
    }
    
    // Obtener la cantidad de puntos de datos a mostrar
    const dataLength = chart.data.labels ? chart.data.labels.length : 0;
    
    // Filtrar datasets para mantener solo la línea principal de datos
    const mainDataset = chart.data.datasets.find(ds => 
        ds.label && ds.label.includes(`Aceleración eje ${axis.toUpperCase()}`)
    );
    
    if (!mainDataset) {
        console.warn(`No se encontró el dataset principal para el eje ${axis}`);
        return;
    }
    
    // Reiniciar datasets solo con la línea principal
    chart.data.datasets = [mainDataset];
    
    // Agregar límites 2-sigma si están habilitados
    if (chartOptions.show2Sigma && stats[axis].sigma2) {
        chart.data.datasets.push({
            label: `+2σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(stats[axis].sigma2.upper),
            borderColor: 'rgba(255, 159, 64, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        
        chart.data.datasets.push({
            label: `-2σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(stats[axis].sigma2.lower),
            borderColor: 'rgba(255, 159, 64, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }
    
    // Agregar límites 3-sigma si están habilitados
    if (chartOptions.show3Sigma && stats[axis].sigma3) {
        chart.data.datasets.push({
            label: `+3σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(stats[axis].sigma3.upper),
            borderColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false
        });
        
        chart.data.datasets.push({
            label: `-3σ (${axis.toUpperCase()})`,
            data: Array(dataLength).fill(stats[axis].sigma3.lower),
            borderColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false
        });
    }
    
    // Actualizar gráfico
    try {
        chart.update();
        console.log(`Visibilidad actualizada para el eje ${axis}`);
    } catch (error) {
        console.error(`Error al actualizar la visibilidad para el eje ${axis}:`, error);
    }
}

// Exportar funciones para uso global
window.initVibrationChart = initVibrationChart;
window.initAxisChart = initAxisChart;
window.updateVibrationChartX = updateVibrationChartX;
window.updateVibrationChartY = updateVibrationChartY;
window.updateVibrationChartZ = updateVibrationChartZ;
window.updateAxisChart = updateAxisChart;
window.updateAxisChartLimits = updateAxisChartLimits;
window.updateChartsWithNewLimits = updateChartsWithNewLimits;
window.chartData = chartData;
window.stats = getGlobalState('stats');

// Inicializar estado global para opciones de gráficos
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando opciones de gráficos...');
    
    // Establecer las opciones iniciales de los gráficos
    const show2SigmaToggle = document.getElementById('show2Sigma');
    const show3SigmaToggle = document.getElementById('show3Sigma');
    
    // Valores predeterminados si no existen los toggles
    const show2Sigma = show2SigmaToggle ? show2SigmaToggle.checked : true;
    const show3Sigma = show3SigmaToggle ? show3SigmaToggle.checked : true;
    
    // Si no hay opciones previas en el estado global, inicializar
    const currentOptions = getGlobalState('chartOptions');
    if (!currentOptions) {
        // Establecer opciones iniciales
        setGlobalState('chartOptions', {
            showMean: false,
            show2Sigma: show2Sigma, 
            show3Sigma: show3Sigma
        });
        
        console.log('Opciones de gráficos inicializadas:', getGlobalState('chartOptions'));
    } else {
        // Sincronizar UI con el estado global
        if (show2SigmaToggle && show2SigmaToggle.checked !== currentOptions.show2Sigma) {
            show2SigmaToggle.checked = currentOptions.show2Sigma;
        }
        
        if (show3SigmaToggle && show3SigmaToggle.checked !== currentOptions.show3Sigma) {
            show3SigmaToggle.checked = currentOptions.show3Sigma;
        }
        
        console.log('UI sincronizada con opciones de gráficos existentes:', currentOptions);
    }
    
    // Agregar event listeners a los toggles si no están configurados
    if (show2SigmaToggle) {
        show2SigmaToggle.addEventListener('change', function() {
            updateChartsVisibility();
        });
    }
    
    if (show3SigmaToggle) {
        show3SigmaToggle.addEventListener('change', function() {
            updateChartsVisibility();
        });
    }
}); 