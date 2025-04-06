/**
 * PdM-Manager - Sistema de Mantenimiento Predictivo
 * app.js - Archivo JavaScript principal simplificado
 */

// ==========================================================================
// VARIABLES GLOBALES
// ==========================================================================
const API_BASE_URL = ''; // URL vacía para rutas relativas
let currentPage = 'dashboard'; // Página por defecto
let isConfigured = false; // Indica si el sistema está configurado
let globalState = {
  sensors: [],
  currentSensor: null,
  vibrationData: {
    timestamps: [],
    x: [],
    y: [],
    z: [],
    status: []
  },
  lastUpdated: null,
  limits: {
    x: { warning: { min: -2.36, max: 2.18 }, critical: { min: -3.50, max: 3.32 } },
    y: { warning: { min: 7.18, max: 12.09 }, critical: { min: 5.95, max: 13.32 } },
    z: { warning: { min: -2.39, max: 1.11 }, critical: { min: -3.26, max: 1.98 } }
  },
  modelPath: "Modelo/anomaly_detection_model.h5",
  scalerPath: "Scaler/scaler.pkl",
  updateFrequency: 5000, // Milisegundos
  maxDataPoints: 100,
  isUpdating: false
};

// ==========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================================

// Inicializa la aplicación cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM cargado, inicializando aplicación PdM-Manager');
  
  // Inicializar navegación
  initNavigation();
  
  // Configurar eventos de UI
  setupUIButtons();
  
  // Cargar datos iniciales
  initApp();
});

// Inicialización principal
async function initApp() {
  try {
    // Cargar sensores
    await loadSensors();
    
    // Verificar estado del sistema
    await checkSystemHealth();
    
    // Inicializar campos de configuración
    initConfigFields();
    
    // Verificar si hay una configuración guardada
    checkConfiguration();
    
    // Iniciar actualización automática si hay sensor seleccionado y está configurado
    if (globalState.currentSensor && isConfigured) {
      startAutoUpdate();
    } else {
      // Mostrar mensaje de configuración necesaria
      showConfigurationRequiredMessage();
    }
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    showToast('Error al inicializar la aplicación: ' + error.message, 'error');
  }
}

// Inicializa los campos de configuración
function initConfigFields() {
  // Rellenar campos con los límites actuales
  document.getElementById('xWarningMin').value = globalState.limits.x.warning.min;
  document.getElementById('xWarningMax').value = globalState.limits.x.warning.max;
  document.getElementById('xCriticalMin').value = globalState.limits.x.critical.min;
  document.getElementById('xCriticalMax').value = globalState.limits.x.critical.max;
  
  document.getElementById('yWarningMin').value = globalState.limits.y.warning.min;
  document.getElementById('yWarningMax').value = globalState.limits.y.warning.max;
  document.getElementById('yCriticalMin').value = globalState.limits.y.critical.min;
  document.getElementById('yCriticalMax').value = globalState.limits.y.critical.max;
  
  document.getElementById('zWarningMin').value = globalState.limits.z.warning.min;
  document.getElementById('zWarningMax').value = globalState.limits.z.warning.max;
  document.getElementById('zCriticalMin').value = globalState.limits.z.critical.min;
  document.getElementById('zCriticalMax').value = globalState.limits.z.critical.max;
  
  // Rellenar campos de rutas de archivos
  document.getElementById('modelFile').value = globalState.modelPath;
  document.getElementById('scalerFile').value = globalState.scalerPath;
}

// Verifica el estado de salud del sistema
async function checkSystemHealth() {
  try {
    const health = await fetchAPI('/health');
    
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (health.status === 'ok') {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Sistema conectado';
      
      // Verificar si los modelos están cargados
      if (health.models === 'loaded') {
        console.log('Modelos ML cargados correctamente');
      } else {
        console.warn('Modelos ML no cargados');
        showToast('Los modelos de ML no están cargados correctamente.', 'warning');
      }
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Error en el sistema';
      showToast(`Error en el sistema: ${health.error_details || 'Desconocido'}`, 'error');
    }
  } catch (error) {
    console.error('Error al verificar la salud del sistema:', error);
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Error de conexión';
  }
}

// Verifica si el sistema está correctamente configurado
function checkConfiguration() {
  // Verificar que las rutas de modelo y escalador sean válidas
  const modelPathValid = globalState.modelPath && globalState.modelPath.trim() !== "";
  const scalerPathValid = globalState.scalerPath && globalState.scalerPath.trim() !== "";
  
  // Verificar que los límites estén configurados
  const limitsValid = globalState.limits && 
                      globalState.limits.x && 
                      globalState.limits.y && 
                      globalState.limits.z;
  
  // Actualizar el estado de configuración
  isConfigured = modelPathValid && scalerPathValid && limitsValid;
  
  // Actualizar la UI según el estado de configuración
  updateConfigurationStatus();
  
  return isConfigured;
}

// Actualiza la UI según el estado de configuración
function updateConfigurationStatus() {
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  const configurationWarning = document.getElementById('configurationWarning');
  
  if (startMonitoringBtn) {
    startMonitoringBtn.disabled = !isConfigured;
    startMonitoringBtn.title = isConfigured ? 
      'Iniciar monitoreo de datos' : 
      'Configure el sistema antes de iniciar el monitoreo';
  }
  
  if (configurationWarning) {
    configurationWarning.classList.toggle('d-none', isConfigured);
  }
  
  console.log(`Estado de configuración: ${isConfigured ? 'Configurado' : 'No configurado'}`);
}

// Muestra un mensaje indicando que se requiere configuración
function showConfigurationRequiredMessage() {
  const dataStatus = document.getElementById('dataStatus');
  if (dataStatus) {
    dataStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Configure el sistema antes de iniciar el monitoreo';
    dataStatus.classList.add('warning-message');
  }
  
  // Mostrar toast informativo
  if (currentPage === 'dashboard') {
    showToast('Configure el sistema en la sección "Configuración" antes de iniciar el monitoreo', 'info', 10000);
  }
}

// ==========================================================================
// UTILIDADES
// ==========================================================================

// Función para formatear fechas
function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') date = new Date(date);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Función para mostrar notificaciones
function showToast(message, type = 'info', duration = 5000) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  if (type === 'warning') icon = 'exclamation-triangle';
  if (type === 'error') icon = 'exclamation-circle';
  
  toast.innerHTML = `
    <div class="toast-header">
      <i class="fas fa-${icon}"></i>
      <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    </div>
    <div class="toast-body">${message}</div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Mostrar toast con animación
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Configurar botón de cerrar
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
  
  // Auto-cerrar después de duration ms
  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
  
  return toast;
}

// Función para realizar peticiones a la API
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Opciones por defecto
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  
  try {
    console.log(`Realizando petición a ${url}`);
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      
      // Intentar extraer mensaje de error del cuerpo de la respuesta
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        // Si no se puede parsear como JSON, usar el mensaje por defecto
      }
      
      throw new Error(errorMessage);
    }
    
    // Para operaciones que no devuelven JSON (como DELETE)
    if (response.status === 204) {
      return { success: true };
    }
    
    const data = await response.json();
    console.log(`Respuesta exitosa de ${url}`);
    return data;
  } catch (error) {
    console.error(`Error en petición a ${url}:`, error.message);
    throw error;
  }
}

// ==========================================================================
// NAVEGACIÓN
// ==========================================================================

// Inicializa la navegación
function initNavigation() {
  console.log('Inicializando navegación');
  
  // Configurar enlaces de navegación
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    // Remover cualquier listener previo para evitar duplicados
    const clonedLink = link.cloneNode(true);
    link.parentNode.replaceChild(clonedLink, link);
    
    clonedLink.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = clonedLink.getAttribute('data-page');
      if (targetPage) {
        console.log(`Clic en enlace de navegación: ${targetPage}`);
        navigateTo(targetPage);
      } else {
        console.error('Enlace de navegación sin atributo data-page');
      }
    });
  });
  
  // Manejar cambios en la URL
  window.addEventListener('popstate', handlePopState);
  
  // Configurar página inicial basada en el hash de la URL
  const initialPage = window.location.hash.substring(1) || 'dashboard';
  navigateTo(initialPage, true);
}

// Muestra una indicación visual durante la transición entre secciones
function showNavigationFeedback(targetPage) {
  // Actualizar el título de la aplicación para feedback inmediato
  document.title = `PdM-Manager | ${targetPage.charAt(0).toUpperCase() + targetPage.slice(1)}`;
  
  // Mostrar notificación sutil
  const feedbackToast = showToast(`Navegando a ${targetPage}...`, 'info', 1000);
  
  // Aplicar efecto al enlace activo
  const activeNavLink = document.querySelector(`.nav-link[data-page="${targetPage}"]`);
  if (activeNavLink) {
    activeNavLink.classList.add('navigating');
    setTimeout(() => {
      activeNavLink.classList.remove('navigating');
    }, 500);
  }
  
  // También podríamos añadir un leve efecto de "carga" en el contenido principal
  document.querySelector('.main-content').classList.add('loading');
  setTimeout(() => {
    document.querySelector('.main-content').classList.remove('loading');
  }, 300);
}

// Navega a una página específica
function navigateTo(page, skipPushState = false) {
  console.log(`Navegando a: ${page}`);
  
  // Verificar si ya estamos en esa página
  if (currentPage === page) {
    console.log(`Ya estamos en la página ${page}`);
    return;
  }
  
  // Proporcionar feedback visual de navegación
  showNavigationFeedback(page);
  
  // Actualizar navegación
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.getAttribute('data-page') === page) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Ocultar todas las secciones primero
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(section => {
    section.style.display = 'none';
    section.classList.remove('active');
  });
  
  // Pequeño retraso para asegurar que el DOM ha sido actualizado
  setTimeout(() => {
    // Mostrar la sección correspondiente
    const targetSection = document.getElementById(`${page}-section`);
    if (targetSection) {
      // Actualizar estado actual antes de mostrar la nueva sección
      currentPage = page;
      
      // Mostrar la sección
      targetSection.style.display = 'block';
      
      // Pequeño retraso para la animación
      setTimeout(() => {
        targetSection.classList.add('active');
      }, 50);
      
      // Actualizar historial del navegador
      if (!skipPushState) {
        window.history.pushState({ page }, `PdM-Manager - ${page}`, `#${page}`);
      }
      
      // Ejecutar lógica específica de la página
      switch (page) {
        case 'dashboard':
          loadDashboardData();
          
          // Si no está configurado y venimos de configuración, mostrar mensaje
          if (!isConfigured) {
            showToast('El sistema no está completamente configurado. Configure el sistema para iniciar el monitoreo', 'warning');
          }
          break;
          
        case 'configuracion':
          // Asegurar que los campos de configuración estén actualizados
          initConfigFields();
          
          // Si no está configurado, mostrar mensaje guía
          if (!isConfigured) {
            showToast('Configure las rutas de los archivos y los límites de alertas para habilitar el monitoreo', 'info');
          }
          break;
      }
    } else {
      console.error(`Página no encontrada: ${page}`);
      showToast(`La página "${page}" no existe.`, 'error');
    }
  }, 50);
}

// Maneja eventos de navegación del navegador
function handlePopState(event) {
  const page = event.state?.page || 'dashboard';
  navigateTo(page, true);
}

// ==========================================================================
// GESTIÓN DE DATOS DE VIBRACIÓN
// ==========================================================================

// Carga datos para el dashboard
async function loadDashboardData() {
  try {
    console.log('Cargando datos del dashboard');
    
    // Cargar sensores disponibles si no están cargados
    if (globalState.sensors.length === 0) {
      await loadSensors();
    }
    
    // Configurar selector de sensores
    const sensorSelector = document.getElementById('sensorSelector');
    if (sensorSelector) {
      // Limpiar opciones actuales
      sensorSelector.innerHTML = '';
      
      // Agregar opción por defecto
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleccione un sensor';
      defaultOption.disabled = true;
      defaultOption.selected = !globalState.currentSensor;
      sensorSelector.appendChild(defaultOption);
      
      // Agregar opciones de sensores
      globalState.sensors.forEach(sensor => {
        const option = document.createElement('option');
        option.value = sensor.sensor_id;
        option.textContent = `Sensor ${sensor.sensor_id}: ${sensor.name || 'Sin nombre'}`;
        option.selected = globalState.currentSensor === sensor.sensor_id;
        sensorSelector.appendChild(option);
      });
      
      // Configurar evento de cambio
      sensorSelector.addEventListener('change', function() {
        const sensorId = parseInt(this.value);
        if (sensorId) {
          globalState.currentSensor = sensorId;
          
          // Solo cargar datos si el sistema está configurado
          if (isConfigured) {
            loadVibrationData(sensorId);
          } else {
            showConfigurationRequiredMessage();
          }
        }
      });
    }
    
    // Verificar estado de configuración
    checkConfiguration();
    
    // Cargar datos de vibración si hay un sensor seleccionado y el sistema está configurado
    if (globalState.currentSensor && isConfigured) {
      await loadVibrationData(globalState.currentSensor);
    } else if (globalState.currentSensor && !isConfigured) {
      // Si hay sensor pero no está configurado, mostrar mensaje
      showConfigurationRequiredMessage();
    }
    
    // Actualizar contador de alertas si hay datos
    if (globalState.vibrationData.status && globalState.vibrationData.status.length > 0) {
      updateAlertCounters(globalState.vibrationData.status);
    }
  } catch (error) {
    console.error('Error al cargar datos del dashboard:', error);
    showToast('Error al cargar datos del dashboard: ' + error.message, 'error');
  }
}

// Inicia la actualización automática de datos
function startAutoUpdate() {
  // Verificar que el sistema esté configurado antes de iniciar
  if (!isConfigured) {
    showToast('Configure el sistema antes de iniciar el monitoreo', 'warning');
    return;
  }
  
  // Verificar que haya un sensor seleccionado
  if (!globalState.currentSensor) {
    showToast('Seleccione un sensor antes de iniciar el monitoreo', 'warning');
    return;
  }
  
  if (globalState.isUpdating) return;
  
  globalState.isUpdating = true;
  
  // Actualizar UI para reflejar estado de monitoreo
  const monitoringStatus = document.getElementById('monitoringStatus');
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  
  if (monitoringStatus) {
    monitoringStatus.querySelector('.status-indicator').classList.add('active');
    monitoringStatus.querySelector('.status-text').textContent = 'Monitoreo activo';
  }
  
  if (startMonitoringBtn) {
    startMonitoringBtn.innerHTML = '<i class="fas fa-stop-circle mr-2"></i> Detener Monitoreo';
  }
  
  // Iniciar intervalo de actualización
  const updateInterval = setInterval(async () => {
    if (!globalState.isUpdating) {
      clearInterval(updateInterval);
      return;
    }
    
    // Asegurar que solo actualizamos si estamos en la página dashboard y configurados
    if (globalState.currentSensor && currentPage === 'dashboard' && isConfigured) {
      try {
        await loadVibrationData(globalState.currentSensor, true);
      } catch (error) {
        console.error('Error en actualización automática:', error);
      }
    }
  }, globalState.updateFrequency);
  
  console.log(`Actualización automática iniciada (cada ${globalState.updateFrequency}ms)`);
}

// Detiene la actualización automática de datos
function stopAutoUpdate() {
  globalState.isUpdating = false;
  
  // Actualizar UI para reflejar estado de monitoreo
  const monitoringStatus = document.getElementById('monitoringStatus');
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  
  if (monitoringStatus) {
    monitoringStatus.querySelector('.status-indicator').classList.remove('active');
    monitoringStatus.querySelector('.status-text').textContent = 'Monitoreo detenido';
  }
  
  if (startMonitoringBtn) {
    startMonitoringBtn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> Iniciar Monitoreo';
  }
  
  console.log('Actualización automática detenida');
}

// Carga la lista de sensores disponibles
async function loadSensors() {
  try {
    const sensors = await fetchAPI('/sensors');
    globalState.sensors = sensors;
    
    // Si no hay sensor seleccionado y hay sensores disponibles, seleccionar el primero
    if (!globalState.currentSensor && sensors.length > 0) {
      globalState.currentSensor = sensors[0].sensor_id;
    }
    
    return sensors;
  } catch (error) {
    console.error('Error al cargar sensores:', error);
    showToast('Error al cargar sensores: ' + error.message, 'error');
    return [];
  }
}

// Carga datos de vibración para un sensor específico
async function loadVibrationData(sensorId, isUpdate = false) {
  // Verificar que el sistema esté configurado
  if (!isConfigured && !isUpdate) {
    const dataStatus = document.getElementById('dataStatus');
    if (dataStatus) {
      dataStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Configure el sistema antes de cargar datos';
      dataStatus.classList.add('warning-message');
    }
    showToast('Configure el sistema antes de cargar datos', 'warning');
    return;
  }
  
  if (!sensorId) {
    console.warn('No se especificó ID de sensor');
    return;
  }
  
  try {
    const dataStatus = document.getElementById('dataStatus');
    if (dataStatus) {
      dataStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Cargando datos...';
      dataStatus.classList.remove('warning-message');
    }
    
    // Construir parámetros de consulta
    const params = new URLSearchParams({
      sensor_id: sensorId,
      limit: globalState.maxDataPoints
    });
    
    const vibrationData = await fetchAPI(`/vibration-data?${params.toString()}`);
    
    // Si no hay datos, mostrar mensaje
    if (!vibrationData || !vibrationData.data || vibrationData.data.length === 0) {
      if (dataStatus) {
        dataStatus.innerHTML = '<i class="fas fa-info-circle"></i> No hay datos para este sensor';
      }
      return;
    }
    
    // Procesar datos recibidos
    const timestamps = [];
    const x = [];
    const y = [];
    const z = [];
    const status = [];
    
    vibrationData.data.forEach(item => {
      timestamps.push(item.timestamp);
      x.push(item.acceleration_x);
      y.push(item.acceleration_y);
      z.push(item.acceleration_z);
      status.push(item.severity);
    });
    
    // Actualizar estado global
    globalState.vibrationData = {
      timestamps,
      x,
      y,
      z,
      status
    };
    
    // Actualizar última actualización
    globalState.lastUpdated = new Date();
    document.getElementById('lastUpdateTime').textContent = 
      globalState.lastUpdated.toLocaleTimeString();
    
    if (dataStatus) {
      dataStatus.innerHTML = '<i class="fas fa-check-circle"></i> Datos cargados correctamente';
    }
    
    // Actualizar contadores de alertas
    updateAlertCounters(status);
    
    // Actualizar gráficos
    updateCharts();
    
    // Actualizar campo de última actualización
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
      lastUpdate.textContent = formatDate(globalState.lastUpdated);
    }
  } catch (error) {
    console.error(`Error al cargar datos de vibración para sensor ${sensorId}:`, error);
    
    const dataStatus = document.getElementById('dataStatus');
    if (dataStatus) {
      dataStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error al cargar datos: ${error.message}`;
    }
    
    if (!isUpdate) {
      showToast(`Error al cargar datos: ${error.message}`, 'error');
    }
  }
}

// Actualiza los contadores de alertas en el dashboard
function updateAlertCounters(statusArray) {
  // Inicializar contadores
  let level1Count = 0;
  let level2Count = 0;
  let level3Count = 0;
  
  // Contar por nivel
  statusArray.forEach(status => {
    switch (status) {
      case 1:
        level1Count++;
        break;
      case 2:
        level2Count++;
        break;
      case 3:
        level3Count++;
        break;
    }
  });
  
  // Actualizar elementos en el DOM
  const level1Element = document.getElementById('level1Count');
  const level2Element = document.getElementById('level2Count');
  const level3Element = document.getElementById('level3Count');
  const totalElement = document.getElementById('totalCount');
  
  if (level1Element) level1Element.textContent = level1Count;
  if (level2Element) level2Element.textContent = level2Count;
  if (level3Element) level3Element.textContent = level3Count;
  if (totalElement) totalElement.textContent = level1Count + level2Count + level3Count;
}

// ==========================================================================
// CONFIGURACIÓN DE EVENTOS DE UI
// ==========================================================================

function setupUIButtons() {
  // Botón de iniciar/detener monitoreo
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  if (startMonitoringBtn) {
    startMonitoringBtn.addEventListener('click', function() {
      if (globalState.isUpdating) {
        stopAutoUpdate();
      } else {
        if (globalState.currentSensor) {
          startAutoUpdate();
        } else {
          showToast('Seleccione un sensor para iniciar el monitoreo', 'warning');
        }
      }
    });
  }
  
  // Botón de guardar rutas de archivos
  const saveFilePathsBtn = document.getElementById('saveFilePathsBtn');
  if (saveFilePathsBtn) {
    saveFilePathsBtn.addEventListener('click', function() {
      const modelPath = document.getElementById('modelFile').value;
      const scalerPath = document.getElementById('scalerFile').value;
      
      if (!modelPath || !scalerPath) {
        showToast('Las rutas no pueden estar vacías', 'warning');
        return;
      }
      
      globalState.modelPath = modelPath;
      globalState.scalerPath = scalerPath;
      
      // Verificar el estado de configuración
      checkConfiguration();
      
      // Mostrar mensaje de éxito
      showToast('Rutas de archivos guardadas correctamente', 'success');
      
      // Si estamos completamente configurados, mostrar mensaje adicional
      if (isConfigured) {
        showToast('Configuración completa. Puede iniciar el monitoreo ahora.', 'success');
      } else {
        showToast('Configure también los límites de alertas para habilitar el monitoreo', 'info');
      }
    });
  }
  
  // Botones para seleccionar archivos
  const selectModelBtn = document.getElementById('selectModelBtn');
  const selectScalerBtn = document.getElementById('selectScalerBtn');
  
  if (selectModelBtn) {
    selectModelBtn.addEventListener('click', function() {
      // Esta función se implementaría con un diálogo nativo del sistema
      // En el frontend web usaríamos un input type="file"
      alert('Seleccione el archivo del modelo (.h5)');
    });
  }
  
  if (selectScalerBtn) {
    selectScalerBtn.addEventListener('click', function() {
      // Esta función se implementaría con un diálogo nativo del sistema
      alert('Seleccione el archivo del escalador (.pkl)');
    });
  }
  
  // Botón de guardar límites
  const saveLimitsBtn = document.getElementById('saveLimitsBtn');
  if (saveLimitsBtn) {
    saveLimitsBtn.addEventListener('click', function() {
      // Leer valores de los inputs
      const xWarningMin = parseFloat(document.getElementById('xWarningMin').value);
      const xWarningMax = parseFloat(document.getElementById('xWarningMax').value);
      const xCriticalMin = parseFloat(document.getElementById('xCriticalMin').value);
      const xCriticalMax = parseFloat(document.getElementById('xCriticalMax').value);
      
      const yWarningMin = parseFloat(document.getElementById('yWarningMin').value);
      const yWarningMax = parseFloat(document.getElementById('yWarningMax').value);
      const yCriticalMin = parseFloat(document.getElementById('yCriticalMin').value);
      const yCriticalMax = parseFloat(document.getElementById('yCriticalMax').value);
      
      const zWarningMin = parseFloat(document.getElementById('zWarningMin').value);
      const zWarningMax = parseFloat(document.getElementById('zWarningMax').value);
      const zCriticalMin = parseFloat(document.getElementById('zCriticalMin').value);
      const zCriticalMax = parseFloat(document.getElementById('zCriticalMax').value);
      
      // Validar que los valores son números
      if ([xWarningMin, xWarningMax, xCriticalMin, xCriticalMax,
           yWarningMin, yWarningMax, yCriticalMin, yCriticalMax,
           zWarningMin, zWarningMax, zCriticalMin, zCriticalMax].some(isNaN)) {
        showToast('Todos los valores deben ser números válidos', 'warning');
        return;
      }
      
      // Validar que los límites son coherentes
      if (xWarningMin > xWarningMax || xCriticalMin > xCriticalMax ||
          yWarningMin > yWarningMax || yCriticalMin > yCriticalMax ||
          zWarningMin > zWarningMax || zCriticalMin > zCriticalMax) {
        showToast('Los valores mínimos deben ser menores que los máximos', 'warning');
        return;
      }
      
      // Guardar límites
      globalState.limits = {
        x: {
          warning: { min: xWarningMin, max: xWarningMax },
          critical: { min: xCriticalMin, max: xCriticalMax }
        },
        y: {
          warning: { min: yWarningMin, max: yWarningMax },
          critical: { min: yCriticalMin, max: yCriticalMax }
        },
        z: {
          warning: { min: zWarningMin, max: zWarningMax },
          critical: { min: zCriticalMin, max: zCriticalMax }
        }
      };
      
      // Verificar el estado de configuración
      checkConfiguration();
      
      // Actualizar gráficos para mostrar los nuevos límites
      if (currentPage === 'dashboard' && globalState.vibrationData.timestamps.length > 0) {
        updateCharts();
      }
      
      // Mostrar mensaje de éxito
      showToast('Límites guardados correctamente', 'success');
      
      // Si estamos completamente configurados, mostrar mensaje adicional
      if (isConfigured) {
        showToast('Configuración completa. Puede iniciar el monitoreo ahora.', 'success');
      } else {
        showToast('Configure también las rutas de archivos para habilitar el monitoreo', 'info');
      }
    });
  }
  
  // Botón para restablecer límites
  const resetLimitsBtn = document.getElementById('resetLimitsBtn');
  if (resetLimitsBtn) {
    resetLimitsBtn.addEventListener('click', function() {
      // Restablecer límites a valores por defecto
      globalState.limits = {
        x: { warning: { min: -2.36, max: 2.18 }, critical: { min: -3.50, max: 3.32 } },
        y: { warning: { min: 7.18, max: 12.09 }, critical: { min: 5.95, max: 13.32 } },
        z: { warning: { min: -2.39, max: 1.11 }, critical: { min: -3.26, max: 1.98 } }
      };
      
      // Actualizar campos
      initConfigFields();
      
      // Actualizar gráficos
      if (currentPage === 'dashboard' && globalState.vibrationData.timestamps.length > 0) {
        updateCharts();
      }
      
      showToast('Límites restablecidos a valores por defecto', 'success');
    });
  }
}
