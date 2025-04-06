/**
 * PdM-Manager - Sistema de Mantenimiento Predictivo
 * charts.js - Gestión de gráficos y visualización de datos
 */

// ==========================================================================
// VARIABLES GLOBALES PARA GRÁFICOS
// ==========================================================================

// Referencias a los gráficos
let vibrationChartX = null;
let vibrationChartY = null;
let vibrationChartZ = null;

// Colores para gráficos
const CHART_COLORS = {
  x: 'rgba(75, 192, 192, 1)',
  y: 'rgba(255, 159, 64, 1)',
  z: 'rgba(255, 99, 132, 1)',
  background: {
    x: 'rgba(75, 192, 192, 0.2)',
    y: 'rgba(255, 159, 64, 0.2)',
    z: 'rgba(255, 99, 132, 0.2)'
  },
  grid: 'rgba(0, 0, 0, 0.1)',
  text: '#555',
  warning: 'rgba(255, 193, 7, 0.8)',
  critical: 'rgba(220, 53, 69, 0.8)'
};

// ==========================================================================
// INICIALIZACIÓN DE GRÁFICOS
// ==========================================================================

// Inicializa los gráficos de vibración al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  initVibrationCharts();
});

// Inicializa todos los gráficos de vibración
function initVibrationCharts() {
  initAxisChart('X');
  initAxisChart('Y');
  initAxisChart('Z');
  console.log('Gráficos de vibración inicializados');
  
  // Establecer estado inicial de visibilidad de las gráficas
  if (typeof toggleChartVisibility === 'function') {
    toggleChartVisibility();
  }
}

// Inicializa un gráfico para un eje específico
function initAxisChart(axis) {
  const canvasId = `vibrationChart${axis}`;
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`Canvas para gráfico de vibración ${axis} no encontrado`);
    return;
  }
  
  console.log(`Inicializando gráfico de vibración para eje ${axis}`);
  
  // Obtener color según el eje
  const axisLower = axis.toLowerCase();
  const axisColor = CHART_COLORS[axisLower];
  const axisBackgroundColor = CHART_COLORS.background[axisLower];
  
  // Crear configuración del gráfico
  const config = {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: `Aceleración ${axis}`,
          data: [],
          borderColor: axisColor,
          backgroundColor: axisBackgroundColor,
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false
        },
        {
          label: 'Warning Superior (2σ)',
          data: [],
          borderColor: CHART_COLORS.warning,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Warning Inferior (2σ)',
          data: [],
          borderColor: CHART_COLORS.warning,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Critical Superior (3σ)',
          data: [],
          borderColor: CHART_COLORS.critical,
          borderWidth: 2,
          borderDash: [2, 2],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Critical Inferior (3σ)',
          data: [],
          borderColor: CHART_COLORS.critical,
          borderWidth: 2,
          borderDash: [2, 2],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      aspectRatio: 2.5,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Tiempo'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            callback: function(value, index, values) {
              // Formatear etiquetas de tiempo para que sean más legibles
              if (index % 5 === 0) {
                const date = this.chart.data.labels[index];
                if (date instanceof Date) {
                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }
              return '';
            }
          },
          grid: {
            color: CHART_COLORS.grid
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Aceleración (g)'
          },
          grid: {
            color: CHART_COLORS.grid
          }
        }
      }
    }
  };
  
  // Crear y guardar referencia al gráfico
  switch (axis) {
    case 'X':
      vibrationChartX = new Chart(canvas, config);
      break;
    case 'Y':
      vibrationChartY = new Chart(canvas, config);
      break;
    case 'Z':
      vibrationChartZ = new Chart(canvas, config);
      break;
  }
}

// ==========================================================================
// ACTUALIZACIÓN DE GRÁFICOS
// ==========================================================================

// Actualiza todos los gráficos con los datos más recientes
function updateCharts() {
  if (!globalState.vibrationData || 
      !globalState.vibrationData.timestamps || 
      globalState.vibrationData.timestamps.length === 0) {
    console.warn('No hay datos de vibración para actualizar los gráficos');
    return;
  }
  
  // Actualizar gráficos de vibración para cada eje
  updateAxisChart('X');
  updateAxisChart('Y');
  updateAxisChart('Z');
}

// Actualiza un gráfico para un eje específico
function updateAxisChart(axis) {
  let chart;
  let axisData;
  
  // Seleccionar el gráfico y datos correspondientes
  switch (axis) {
    case 'X':
      chart = vibrationChartX;
      axisData = globalState.vibrationData.x;
      break;
    case 'Y':
      chart = vibrationChartY;
      axisData = globalState.vibrationData.y;
      break;
    case 'Z':
      chart = vibrationChartZ;
      axisData = globalState.vibrationData.z;
      break;
    default:
      console.warn(`Eje desconocido: ${axis}`);
      return;
  }
  
  if (!chart) {
    console.warn(`Gráfico para eje ${axis} no inicializado`);
    return;
  }
  
  const axisLower = axis.toLowerCase();
  
  // Obtener límites para este eje
  const warningMin = globalState.limits[axisLower].warning.min;
  const warningMax = globalState.limits[axisLower].warning.max;
  const criticalMin = globalState.limits[axisLower].critical.min;
  const criticalMax = globalState.limits[axisLower].critical.max;
  
  // Preparar etiquetas de tiempo
  const labels = globalState.vibrationData.timestamps.map(timestamp => new Date(timestamp));
  
  // Crear datos para las líneas de referencia
  const warningMaxLine = new Array(labels.length).fill(warningMax);
  const warningMinLine = new Array(labels.length).fill(warningMin);
  const criticalMaxLine = new Array(labels.length).fill(criticalMax);
  const criticalMinLine = new Array(labels.length).fill(criticalMin);
  
  // Actualizar datasets
  chart.data.labels = labels;
  chart.data.datasets[0].data = axisData;
  chart.data.datasets[1].data = warningMaxLine;
  chart.data.datasets[2].data = warningMinLine;
  chart.data.datasets[3].data = criticalMaxLine;
  chart.data.datasets[4].data = criticalMinLine;
  
  // Colorear puntos según estado (si está disponible)
  if (globalState.vibrationData.status && globalState.vibrationData.status.length > 0) {
    // Asegurarse de que pointBackgroundColor es un array
    if (!chart.data.datasets[0].pointBackgroundColor) {
      chart.data.datasets[0].pointBackgroundColor = [];
    }
    
    for (let i = 0; i < globalState.vibrationData.status.length; i++) {
      const status = globalState.vibrationData.status[i];
      const value = axisData[i];
      
      // Asignar color según estado
      if (value > criticalMax || value < criticalMin) {
        chart.data.datasets[0].pointBackgroundColor[i] = CHART_COLORS.critical;
      } else if (value > warningMax || value < warningMin) {
        chart.data.datasets[0].pointBackgroundColor[i] = CHART_COLORS.warning;
      } else {
        chart.data.datasets[0].pointBackgroundColor[i] = CHART_COLORS[axisLower];
      }
    }
  }
  
  // Actualizar gráfico
  chart.update();
}

// ==========================================================================
// UTILIDADES PARA LOS GRÁFICOS
// ==========================================================================

// Función para limpiar todos los gráficos
function clearCharts() {
  if (vibrationChartX) {
    vibrationChartX.data.labels = [];
    vibrationChartX.data.datasets.forEach(dataset => {
      dataset.data = [];
    });
    vibrationChartX.update();
  }
  
  if (vibrationChartY) {
    vibrationChartY.data.labels = [];
    vibrationChartY.data.datasets.forEach(dataset => {
      dataset.data = [];
    });
    vibrationChartY.update();
  }
  
  if (vibrationChartZ) {
    vibrationChartZ.data.labels = [];
    vibrationChartZ.data.datasets.forEach(dataset => {
      dataset.data = [];
    });
    vibrationChartZ.update();
  }
}
