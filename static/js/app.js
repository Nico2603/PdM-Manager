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
  isUpdating: false,
  modelInfo: {
    name: "",
    description: ""
  },
  sensorInfo: {
    name: "",
    description: ""
  },
  machineInfo: {
    name: "",
    description: ""
  }
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
    
    // Cargar configuración actual
    await loadConfiguration();
    
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
  // Inicializar las pestañas de configuración
  initConfigTabs();
  
  // Rellenar campos con los límites actuales
  document.getElementById('x2infInput').value = globalState.limits.x.warning.min;
  document.getElementById('x2supInput').value = globalState.limits.x.warning.max;
  document.getElementById('x3infInput').value = globalState.limits.x.critical.min;
  document.getElementById('x3supInput').value = globalState.limits.x.critical.max;
  
  document.getElementById('y2infInput').value = globalState.limits.y.warning.min;
  document.getElementById('y2supInput').value = globalState.limits.y.warning.max;
  document.getElementById('y3infInput').value = globalState.limits.y.critical.min;
  document.getElementById('y3supInput').value = globalState.limits.y.critical.max;
  
  document.getElementById('z2infInput').value = globalState.limits.z.warning.min;
  document.getElementById('z2supInput').value = globalState.limits.z.warning.max;
  document.getElementById('z3infInput').value = globalState.limits.z.critical.min;
  document.getElementById('z3supInput').value = globalState.limits.z.critical.max;
  
  // Inicializar los formularios CRUD
  initCrudForms();
  
  // Cargar datos para todas las tablas
  loadModels();
  loadSensorsTable();
  loadMachines();
  loadLimits();
}

// Inicializa las pestañas de configuración
function initConfigTabs() {
  const tabLinks = document.querySelectorAll('.nav-tabs .nav-link');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remover clase 'active' de todos los enlaces y contenidos
      document.querySelectorAll('.nav-tabs .nav-link').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.config-tab-content').forEach(el => el.classList.remove('active'));
      
      // Activar la pestaña actual
      e.target.closest('.nav-link').classList.add('active');
      
      // Mostrar el contenido correspondiente
      const targetTab = e.target.closest('.nav-link').getAttribute('data-tab');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// Inicializa los formularios CRUD
function initCrudForms() {
  // Formulario de Sensor
  const sensorForm = document.getElementById('sensorForm');
  if (sensorForm) {
    sensorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSensor();
    });
  }
  
  // Formulario de Modelo
  const modelForm = document.getElementById('modelForm');
  if (modelForm) {
    modelForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveModel();
    });
  }
  
  // Formulario de Máquina
  const machineForm = document.getElementById('machineForm');
  if (machineForm) {
    machineForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMachine();
    });
  }
  
  // Formulario de Límites
  const limitsForm = document.getElementById('limitsForm');
  if (limitsForm) {
    limitsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveLimits();
    });
  }
  
  // Botones de reset
  document.getElementById('resetSensorBtn')?.addEventListener('click', () => resetForm('sensorForm'));
  document.getElementById('resetModelBtn')?.addEventListener('click', () => resetForm('modelForm'));
  document.getElementById('resetMachineBtn')?.addEventListener('click', () => resetForm('machineForm'));
  document.getElementById('resetLimitsBtn')?.addEventListener('click', () => resetForm('limitsForm'));
  
  // Botones para seleccionar archivos
  document.getElementById('selectModelFileBtn')?.addEventListener('click', () => selectFile('modelRouteH5Input', 'h5'));
  document.getElementById('selectScalerFileBtn')?.addEventListener('click', () => selectFile('modelRoutePklInput', 'pkl'));
}

// Función para seleccionar archivos
async function selectFile(inputId, fileType) {
  try {
    // Aquí se podría implementar una llamada a un API para seleccionar archivos
    // Por ahora, simulamos la selección con un valor predeterminado
    let filePath = '';
    
    if (fileType === 'h5') {
      filePath = 'Modelo/anomaly_detection_model.h5';
    } else if (fileType === 'pkl') {
      filePath = 'Scaler/scaler.pkl';
    }
    
    if (filePath) {
      document.getElementById(inputId).value = filePath;
    }
  } catch (error) {
    console.error(`Error al seleccionar archivo ${fileType}:`, error);
    showToast(`Error al seleccionar archivo: ${error.message}`, 'error');
  }
}

// Función para resetear un formulario
function resetForm(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.reset();
    
    // Limpiar campos ocultos de ID
    if (formId === 'sensorForm') {
      document.getElementById('sensorIdInput').value = '';
    } else if (formId === 'modelForm') {
      document.getElementById('modelIdInput').value = '';
    } else if (formId === 'machineForm') {
      document.getElementById('machineIdInput').value = '';
    } else if (formId === 'limitsForm') {
      document.getElementById('limitIdInput').value = '';
    }
  }
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

// Carga la configuración actual desde el servidor
async function loadConfiguration() {
  try {
    const config = await fetchAPI('/config');
    
    // Actualizar estado global con los datos recibidos
    if (config.system_config) {
      isConfigured = config.system_config.is_configured === 1;
    }
    
    // Actualizar límites
    if (config.limit_config) {
      globalState.limits = {
        x: { 
          warning: { min: config.limit_config.x_2inf, max: config.limit_config.x_2sup },
          critical: { min: config.limit_config.x_3inf, max: config.limit_config.x_3sup }
        },
        y: { 
          warning: { min: config.limit_config.y_2inf, max: config.limit_config.y_2sup },
          critical: { min: config.limit_config.y_3inf, max: config.limit_config.y_3sup }
        },
        z: { 
          warning: { min: config.limit_config.z_2inf, max: config.limit_config.z_2sup },
          critical: { min: config.limit_config.z_3inf, max: config.limit_config.z_3sup }
        }
      };
    }
    
    // Actualizar información del modelo
    if (config.model) {
      globalState.modelPath = config.model.route_h5 || "";
      globalState.scalerPath = config.model.route_pkl || "";
      globalState.modelInfo = {
        name: config.model.name || "",
        description: config.model.description || ""
      };
    }
    
    // Actualizar información del sensor (usar el primer sensor si hay varios)
    if (config.sensors && config.sensors.length > 0) {
      globalState.sensorInfo = {
        name: config.sensors[0].name || "",
        description: config.sensors[0].description || ""
      };
    }
    
    // Actualizar información de la máquina (usar la primera máquina si hay varias)
    if (config.machines && config.machines.length > 0) {
      globalState.machineInfo = {
        name: config.machines[0].name || "",
        description: config.machines[0].description || ""
      };
    }
    
    // Inicializar los campos del formulario con los valores cargados
    initConfigFields();
    
    // Actualizar UI según el estado de configuración
    updateConfigurationStatus();
    
    // Actualiza la visualización de la configuración en tiempo real
    updateConfigurationView(config);
    
    // Cargar tablas de entidades
    await loadModels();
    await loadSensorsTable();
    await loadMachines();
    await loadLimits();
    
    return true;
  } catch (error) {
    console.error('Error al cargar la configuración:', error);
    showToast('Error al cargar la configuración', 'error');
    return false;
  }
}

// Verifica si el sistema está correctamente configurado
function checkConfiguration() {
  fetchAPI('/config')
    .then(config => {
      // Verificar si el sistema está configurado según la respuesta del servidor
      isConfigured = config.system_config && config.system_config.is_configured === 1;
      
      // Actualizar UI según el estado de configuración
      updateConfigurationStatus();
      
      // Si el sistema está configurado, cargar los datos y actualizar la UI
      if (isConfigured) {
        loadConfiguration();
        
        if (currentPage === 'dashboard' && globalState.currentSensor) {
          startAutoUpdate();
        }
      } else {
        // Mostrar mensaje de configuración necesaria
        showConfigurationRequiredMessage();
      }
    })
    .catch(error => {
      console.error('Error al verificar la configuración:', error);
      showToast('Error al verificar la configuración del sistema', 'error');
    });
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
    configurationWarning.style.display = isConfigured ? 'none' : 'block';
  }
  
  console.log(`Estado de configuración: ${isConfigured ? 'Configurado' : 'No configurado'}`);
}

// Muestra un mensaje indicando que se requiere configuración
function showConfigurationRequiredMessage() {
  // Mostrar el mensaje de configuración en el botón de monitoreo
  const configWarning = document.getElementById('configurationWarning');
  if (configWarning) {
    configWarning.style.display = 'block';
  }
  
  // Deshabilitar el botón de iniciar monitoreo
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  if (startMonitoringBtn) {
    startMonitoringBtn.disabled = true;
  }
  
  // Mostrar toast informativo
  if (currentPage === 'dashboard') {
    showToast('Configure el sistema en la sección "Configuración" antes de iniciar el monitoreo', 'info', 10000);
  }
}

// Actualiza la visualización de la configuración en tiempo real
function updateConfigurationView(config) {
  // Actualizar tabla de configuración general
  document.getElementById('configStatus').textContent = config.system_config.is_configured === 1 ? 'Configurado' : 'No configurado';
  document.getElementById('configLastUpdate').textContent = config.system_config.last_update ? new Date(config.system_config.last_update).toLocaleString() : '-';
  document.getElementById('configActiveModel').textContent = config.model ? config.model.name || config.model.model_id : 'No hay modelo activo';
  
  // Actualizar tabla de límites
  if (config.limit_config) {
    document.getElementById('limitXWarningMin').textContent = config.limit_config.x_2inf.toFixed(2);
    document.getElementById('limitXWarningMax').textContent = config.limit_config.x_2sup.toFixed(2);
    document.getElementById('limitXCriticalMin').textContent = config.limit_config.x_3inf.toFixed(2);
    document.getElementById('limitXCriticalMax').textContent = config.limit_config.x_3sup.toFixed(2);
    
    document.getElementById('limitYWarningMin').textContent = config.limit_config.y_2inf.toFixed(2);
    document.getElementById('limitYWarningMax').textContent = config.limit_config.y_2sup.toFixed(2);
    document.getElementById('limitYCriticalMin').textContent = config.limit_config.y_3inf.toFixed(2);
    document.getElementById('limitYCriticalMax').textContent = config.limit_config.y_3sup.toFixed(2);
    
    document.getElementById('limitZWarningMin').textContent = config.limit_config.z_2inf.toFixed(2);
    document.getElementById('limitZWarningMax').textContent = config.limit_config.z_2sup.toFixed(2);
    document.getElementById('limitZCriticalMin').textContent = config.limit_config.z_3inf.toFixed(2);
    document.getElementById('limitZCriticalMax').textContent = config.limit_config.z_3sup.toFixed(2);
  }
  
  // Actualizar tabla de sensores
  const sensorTableBody = document.getElementById('sensorTableBody');
  sensorTableBody.innerHTML = '';
  
  if (config.sensors && config.sensors.length > 0) {
    config.sensors.forEach(sensor => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${sensor.sensor_id}</td>
        <td>${sensor.name || ''}</td>
        <td>${sensor.description || ''}</td>
      `;
      sensorTableBody.appendChild(row);
    });
  } else {
    sensorTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay sensores configurados</td></tr>';
  }
  
  // Actualizar tabla de máquinas
  const machineTableBody = document.getElementById('machineTableBody');
  machineTableBody.innerHTML = '';
  
  if (config.machines && config.machines.length > 0) {
    config.machines.forEach(machine => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${machine.machine_id}</td>
        <td>${machine.name || ''}</td>
        <td>${machine.description || ''}</td>
        <td>${machine.sensor_id || ''}</td>
      `;
      machineTableBody.appendChild(row);
    });
  } else {
    machineTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay máquinas configuradas</td></tr>';
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
  // Validar que la página existe
  if (!page || (page !== 'dashboard' && page !== 'configuracion')) {
    console.error(`Página "${page}" no válida`);
    return;
  }
  
  // Detener monitoreo automático si salimos del dashboard
  if (currentPage === 'dashboard' && page !== 'dashboard' && globalState.isUpdating) {
    stopAutoUpdate();
  }
  
  // Actualizar estado de navegación
  currentPage = page;
  
  // Actualizar historial si no estamos saltando (para evitar loops)
  if (!skipPushState) {
    window.history.pushState({ page }, `PdM-Manager | ${page}`, `#${page}`);
  }
  
  // Actualizar clases activas en el menú
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
  
  // Ocultar todas las secciones
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
    section.classList.remove('animate-fade-in');
  });
  
  // Mostrar la sección correspondiente con animación
  const targetSection = document.getElementById(`${page}-section`);
  if (targetSection) {
    targetSection.style.display = 'block';
    targetSection.classList.add('animate-fade-in');
    
    // Acciones específicas por página
    if (page === 'dashboard') {
      // Si estamos en dashboard y el sistema está configurado, cargar datos
      if (isConfigured && globalState.currentSensor) {
        loadDashboardData();
        
        // Si estaba configurado para actualización automática, reiniciarla
        if (isConfigured && !globalState.isUpdating && 
            document.getElementById('startMonitoringBtn').textContent.includes('Detener')) {
          startAutoUpdate();
        }
      } else {
        // Mostrar mensaje de configuración necesaria
        showConfigurationRequiredMessage();
      }
    } else if (page === 'configuracion') {
      // Si estamos en configuración, asegurar que los campos estén actualizados
      initConfigFields();
    }
  }
  
  console.log(`Navegación a: ${page}`);
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
  // === Botones de Configuración ===
  // Guardar configuración
  const saveConfigButton = document.getElementById('saveConfigButton');
  if (saveConfigButton) {
    saveConfigButton.addEventListener('click', saveConfiguration);
  }
  
  // Restablecer configuración
  const resetConfigButton = document.getElementById('resetConfigButton');
  if (resetConfigButton) {
    resetConfigButton.addEventListener('click', resetConfigFields);
  }
  
  // Probar conexión
  const testConnectionButton = document.getElementById('testConnectionButton');
  if (testConnectionButton) {
    testConnectionButton.addEventListener('click', async function() {
      try {
        await checkSystemHealth();
        showToast('Conexión probada correctamente', 'success');
      } catch (error) {
        showToast('Error al probar la conexión: ' + error.message, 'error');
      }
    });
  }
  
  // Actualizar configuración
  const refreshConfigBtn = document.getElementById('refreshConfigBtn');
  if (refreshConfigBtn) {
    refreshConfigBtn.addEventListener('click', async function() {
      try {
        await loadConfiguration();
        showToast('Configuración actualizada correctamente', 'success');
      } catch (error) {
        showToast('Error al actualizar la configuración: ' + error.message, 'error');
      }
    });
  }
  
  // Seleccionar archivo de modelo
  const selectModelBtn = document.getElementById('selectModelBtn');
  if (selectModelBtn) {
    selectModelBtn.addEventListener('click', function() {
      // En un entorno web real, esto abriría un explorador de archivos
      // Aquí simulamos la selección
      const newPath = prompt('Introduce la ruta del archivo del modelo (.h5):', globalState.modelPath);
      if (newPath) {
        document.getElementById('modelFile').value = newPath;
      }
    });
  }
  
  // Seleccionar archivo de escalador
  const selectScalerBtn = document.getElementById('selectScalerBtn');
  if (selectScalerBtn) {
    selectScalerBtn.addEventListener('click', function() {
      // En un entorno web real, esto abriría un explorador de archivos
      // Aquí simulamos la selección
      const newPath = prompt('Introduce la ruta del archivo del escalador (.pkl):', globalState.scalerPath);
      if (newPath) {
        document.getElementById('scalerFile').value = newPath;
      }
    });
  }
  
  // === Botones de Control de Monitoreo ===
  // Iniciar monitoreo
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  if (startMonitoringBtn) {
    startMonitoringBtn.addEventListener('click', function() {
      if (!isConfigured) {
        showToast('Debe configurar el sistema antes de iniciar el monitoreo', 'warning');
        navigateTo('config');
        return;
      }
      
      if (!globalState.currentSensor) {
        showToast('Debe seleccionar un sensor para monitorear', 'warning');
        return;
      }
      
      if (!globalState.isUpdating) {
        startAutoUpdate();
        showToast('Monitoreo iniciado', 'success');
        this.innerHTML = '<i class="fas fa-pause"></i> Pausar Monitoreo';
        this.classList.remove('btn-success');
        this.classList.add('btn-warning');
      } else {
        stopAutoUpdate();
        showToast('Monitoreo pausado', 'info');
        this.innerHTML = '<i class="fas fa-play"></i> Iniciar Monitoreo';
        this.classList.remove('btn-warning');
        this.classList.add('btn-success');
      }
    });
  }
  
  // Selector de sensores
  const sensorSelect = document.getElementById('sensorSelect');
  if (sensorSelect) {
    sensorSelect.addEventListener('change', function() {
      const sensorId = parseInt(this.value);
      if (sensorId) {
        // Si ya estamos monitoreando, detener antes de cambiar
        if (globalState.isUpdating) {
          stopAutoUpdate();
        }
        
        // Actualizar sensor actual
        globalState.currentSensor = sensorId;
        
        // Cargar datos iniciales
        loadVibrationData(sensorId).then(() => {
          // Si el sistema está configurado, reiniciar monitoreo automático
          if (isConfigured) {
            startAutoUpdate();
            
            // Actualizar botón de monitoreo
            const startMonitoringBtn = document.getElementById('startMonitoringBtn');
            if (startMonitoringBtn) {
              startMonitoringBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar Monitoreo';
              startMonitoringBtn.classList.remove('btn-success');
              startMonitoringBtn.classList.add('btn-warning');
            }
          }
        });
      } else {
        // Si se selecciona "Seleccionar sensor" (valor 0), detener monitoreo
        stopAutoUpdate();
        globalState.currentSensor = null;
        
        // Limpiar gráficos
        clearCharts();
        
        // Actualizar botón de monitoreo
        const startMonitoringBtn = document.getElementById('startMonitoringBtn');
        if (startMonitoringBtn) {
          startMonitoringBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar Monitoreo';
          startMonitoringBtn.classList.remove('btn-warning');
          startMonitoringBtn.classList.add('btn-success');
        }
      }
    });
  }
  
  // Eventos para toggles de ejes
  document.getElementById('toggleXAxis').addEventListener('change', toggleChartVisibility);
  document.getElementById('toggleYAxis').addEventListener('change', toggleChartVisibility);
  document.getElementById('toggleZAxis').addEventListener('change', toggleChartVisibility);
  
  // Botones para gestión de entidades
  document.getElementById('refreshModelsBtn')?.addEventListener('click', loadModels);
  document.getElementById('refreshSensorsBtn')?.addEventListener('click', loadSensorsTable);
  document.getElementById('refreshMachinesBtn')?.addEventListener('click', loadMachines);
  document.getElementById('refreshLimitsBtn')?.addEventListener('click', loadLimits);
  
  document.getElementById('addModelBtn')?.addEventListener('click', createModel);
  document.getElementById('addSensorBtn')?.addEventListener('click', createSensor);
  document.getElementById('addMachineBtn')?.addEventListener('click', createMachine);
}

// Guarda la configuración en el servidor
async function saveConfiguration() {
  try {
    // Mostrar indicador de carga
    const saveButton = document.getElementById('saveConfigButton');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Guardando...';
    saveButton.disabled = true;
    
    // Recopilar datos del formulario
    const configData = {
      // Archivos del modelo
      route_h5: document.getElementById('modelFile').value.trim(),
      route_pkl: document.getElementById('scalerFile').value.trim(),
      
      // Información del modelo
      model_name: document.getElementById('modelName').value.trim(),
      model_description: document.getElementById('modelDescription').value.trim(),
      
      // Información del sensor
      sensor_name: document.getElementById('sensorName').value.trim(),
      sensor_description: document.getElementById('sensorDescription').value.trim(),
      
      // Información de la máquina
      machine_name: document.getElementById('machineName').value.trim(),
      machine_description: document.getElementById('machineDescription').value.trim(),
      
      // Límites de alerta para el eje X
      x_2inf: parseFloat(document.getElementById('xWarningMin').value),
      x_2sup: parseFloat(document.getElementById('xWarningMax').value),
      x_3inf: parseFloat(document.getElementById('xCriticalMin').value),
      x_3sup: parseFloat(document.getElementById('xCriticalMax').value),
      
      // Límites de alerta para el eje Y
      y_2inf: parseFloat(document.getElementById('yWarningMin').value),
      y_2sup: parseFloat(document.getElementById('yWarningMax').value),
      y_3inf: parseFloat(document.getElementById('yCriticalMin').value),
      y_3sup: parseFloat(document.getElementById('yCriticalMax').value),
      
      // Límites de alerta para el eje Z
      z_2inf: parseFloat(document.getElementById('zWarningMin').value),
      z_2sup: parseFloat(document.getElementById('zWarningMax').value),
      z_3inf: parseFloat(document.getElementById('zCriticalMin').value),
      z_3sup: parseFloat(document.getElementById('zCriticalMax').value)
    };
    
    // Validar campos obligatorios
    if (!configData.route_h5 || !configData.route_pkl) {
      showToast('Las rutas de los archivos del modelo y del escalador son obligatorias', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    
    if (!configData.model_name || !configData.sensor_name || !configData.machine_name) {
      showToast('Los nombres del modelo, sensor y máquina son obligatorios', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    
    // Validar límites coherentes
    // Eje X
    if (configData.x_2inf >= configData.x_2sup) {
      showToast('El límite inferior de warning X debe ser menor que el superior', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    if (configData.x_3inf >= configData.x_2inf) {
      showToast('El límite inferior critical X debe ser menor que el inferior warning', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    if (configData.x_2sup >= configData.x_3sup) {
      showToast('El límite superior warning X debe ser menor que el superior critical', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    
    // Eje Y
    if (configData.y_2inf >= configData.y_2sup) {
      showToast('El límite inferior de warning Y debe ser menor que el superior', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    if (configData.y_3inf >= configData.y_2inf) {
      showToast('El límite inferior critical Y debe ser menor que el inferior warning', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    if (configData.y_2sup >= configData.y_3sup) {
      showToast('El límite superior warning Y debe ser menor que el superior critical', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    
    // Eje Z
    if (configData.z_2inf >= configData.z_2sup) {
      showToast('El límite inferior de warning Z debe ser menor que el superior', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    if (configData.z_3inf >= configData.z_2inf) {
      showToast('El límite inferior critical Z debe ser menor que el inferior warning', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    if (configData.z_2sup >= configData.z_3sup) {
      showToast('El límite superior warning Z debe ser menor que el superior critical', 'error');
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return false;
    }
    
    // Enviar configuración al servidor
    const response = await fetchAPI('/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configData)
    });
    
    // Actualizar estado global con los datos actualizados
    if (response.config) {
      // Actualizar estado global con los valores del servidor
      await loadConfiguration();
      
      // Actualizar UI
      isConfigured = true;
      updateConfigurationStatus();
      
      showToast('Configuración guardada correctamente', 'success');
      
      // Si estamos en la página de configuración, ir al dashboard
      if (currentPage === 'config') {
        navigateTo('dashboard');
      }
      
      // Iniciar monitoreo si hay un sensor seleccionado
      if (globalState.currentSensor) {
        startAutoUpdate();
      }
      
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      return true;
    } else {
      throw new Error('Respuesta inválida del servidor');
    }
  } catch (error) {
    console.error('Error al guardar la configuración:', error);
    showToast(`Error al guardar la configuración: ${error.message || 'Error desconocido'}`, 'error');
    
    const saveButton = document.getElementById('saveConfigButton');
    saveButton.textContent = 'Guardar Configuración';
    saveButton.disabled = false;
    
    return false;
  }
}

// Función para restablecer todos los campos de configuración
function resetConfigFields() {
  // Restablecer límites a valores por defecto
  globalState.limits = {
    x: { warning: { min: -2.36, max: 2.18 }, critical: { min: -3.50, max: 3.32 } },
    y: { warning: { min: 7.18, max: 12.09 }, critical: { min: 5.95, max: 13.32 } },
    z: { warning: { min: -2.39, max: 1.11 }, critical: { min: -3.26, max: 1.98 } }
  };
  
  // Restablecer rutas a valores por defecto
  globalState.modelPath = "Modelo/anomaly_detection_model.h5";
  globalState.scalerPath = "Scaler/scaler.pkl";
  
  // Restablecer información a valores por defecto
  globalState.modelInfo = { name: "", description: "" };
  globalState.sensorInfo = { name: "", description: "" };
  globalState.machineInfo = { name: "", description: "" };
  
  // Actualizar campos
  initConfigFields();
  
  showToast('Configuración restablecida a valores por defecto', 'info');
}

// Función para toggle de visibilidad de las gráficas
function toggleChartVisibility() {
  // Obtener estados de los toggles
  const showXAxis = document.getElementById('toggleXAxis').checked;
  const showYAxis = document.getElementById('toggleYAxis').checked;
  const showZAxis = document.getElementById('toggleZAxis').checked;
  
  // Obtener elementos contenedores de las gráficas
  const xAxisContainer = document.querySelector('.chart-card:nth-child(1)');
  const yAxisContainer = document.querySelector('.chart-card:nth-child(2)');
  const zAxisContainer = document.querySelector('.chart-card:nth-child(3)');
  
  // Mostrar u ocultar los contenedores según estado de los toggles
  if (xAxisContainer) {
    xAxisContainer.style.display = showXAxis ? 'block' : 'none';
  }
  
  if (yAxisContainer) {
    yAxisContainer.style.display = showYAxis ? 'block' : 'none';
  }
  
  if (zAxisContainer) {
    zAxisContainer.style.display = showZAxis ? 'block' : 'none';
  }
}

// ==========================================================================
// FUNCIONES CRUD PARA GESTIÓN DE ENTIDADES
// ==========================================================================

// Cargar modelos y poblar la tabla
async function loadModels() {
  try {
    const models = await fetchAPI('/models');
    const tableBody = document.getElementById('modelsTableBody');
    const selectElement = document.getElementById('sensorModelIdInput');
    
    if (tableBody) {
      tableBody.innerHTML = '';
      
      if (models.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay modelos configurados</td></tr>';
      } else {
        models.forEach(model => {
          tableBody.innerHTML += `
            <tr>
              <td>${model.model_id}</td>
              <td>${model.name || '-'}</td>
              <td>${model.description || '-'}</td>
              <td>${truncateText(model.route_h5 || '-', 20)}</td>
              <td>${truncateText(model.route_pkl || '-', 20)}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="editModel(${model.model_id})">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteModel(${model.model_id})">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        });
      }
    }
    
    // Poblar el selector de modelos para sensores
    if (selectElement) {
      // Guardar el valor seleccionado actualmente
      const currentValue = selectElement.value;
      selectElement.innerHTML = '<option value="" disabled selected>Seleccione un modelo</option>';
      
      models.forEach(model => {
        selectElement.innerHTML += `<option value="${model.model_id}">${model.name || `Modelo ${model.model_id}`}</option>`;
      });
      
      // Restaurar el valor seleccionado si existe
      if (currentValue) {
        selectElement.value = currentValue;
      }
    }
  } catch (error) {
    console.error('Error al cargar los modelos:', error);
    showToast('Error al cargar los modelos', 'error');
  }
}

// Truncar texto si es muy largo
function truncateText(text, maxLength) {
  if (!text) return '-';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Cargar sensores y poblar la tabla
async function loadSensorsTable() {
  try {
    const sensors = await fetchAPI('/sensors');
    const tableBody = document.getElementById('sensorsTableBody');
    const selectElement = document.getElementById('machineSensorIdInput');
    
    if (tableBody) {
      tableBody.innerHTML = '';
      
      if (sensors.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay sensores configurados</td></tr>';
      } else {
        sensors.forEach(sensor => {
          tableBody.innerHTML += `
            <tr>
              <td>${sensor.sensor_id}</td>
              <td>${sensor.name || '-'}</td>
              <td>${sensor.description || '-'}</td>
              <td>${sensor.model_id || '-'}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="editSensor(${sensor.sensor_id})">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSensor(${sensor.sensor_id})">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        });
      }
    }
    
    // Poblar el selector de sensores para máquinas
    if (selectElement) {
      // Guardar el valor seleccionado actualmente
      const currentValue = selectElement.value;
      selectElement.innerHTML = '<option value="" disabled selected>Seleccione un sensor</option>';
      
      sensors.forEach(sensor => {
        selectElement.innerHTML += `<option value="${sensor.sensor_id}">${sensor.name || `Sensor ${sensor.sensor_id}`}</option>`;
      });
      
      // Restaurar el valor seleccionado si existe
      if (currentValue) {
        selectElement.value = currentValue;
      }
    }
  } catch (error) {
    console.error('Error al cargar los sensores:', error);
    showToast('Error al cargar los sensores', 'error');
  }
}

// Cargar máquinas y poblar la tabla
async function loadMachines() {
  try {
    const machines = await fetchAPI('/machines');
    const tableBody = document.getElementById('machinesTableBody');
    
    if (tableBody) {
      tableBody.innerHTML = '';
      
      if (machines.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay máquinas configuradas</td></tr>';
      } else {
        machines.forEach(machine => {
          tableBody.innerHTML += `
            <tr>
              <td>${machine.machine_id}</td>
              <td>${machine.name || '-'}</td>
              <td>${machine.description || '-'}</td>
              <td>${machine.sensor_id || '-'}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="editMachine(${machine.machine_id})">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMachine(${machine.machine_id})">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        });
      }
    }
  } catch (error) {
    console.error('Error al cargar las máquinas:', error);
    showToast('Error al cargar las máquinas', 'error');
  }
}

// Cargar configuraciones de límites y poblar la tabla
async function loadLimits() {
  try {
    const limits = await fetchAPI('/limits');
    const tableBody = document.getElementById('limitsTableBody');
    
    if (tableBody) {
      tableBody.innerHTML = '';
      
      if (!limits || limits.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="14" class="text-center">No hay configuraciones de límites</td></tr>';
      } else {
        limits.forEach(limit => {
          tableBody.innerHTML += `
            <tr>
              <td>${limit.limit_id}</td>
              <td>${limit.x_2inf}</td>
              <td>${limit.x_2sup}</td>
              <td>${limit.x_3inf}</td>
              <td>${limit.x_3sup}</td>
              <td>${limit.y_2inf}</td>
              <td>${limit.y_2sup}</td>
              <td>${limit.y_3inf}</td>
              <td>${limit.y_3sup}</td>
              <td>${limit.z_2inf}</td>
              <td>${limit.z_2sup}</td>
              <td>${limit.z_3inf}</td>
              <td>${limit.z_3sup}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="editLimit(${limit.limit_id})">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteLimit(${limit.limit_id})">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        });
      }
    }
    
    // Actualizar los campos del formulario con los valores del primer límite
    if (limits && limits.length > 0) {
      const limit = limits[0];
      
      document.getElementById('limitIdInput').value = limit.limit_id;
      document.getElementById('x2infInput').value = limit.x_2inf;
      document.getElementById('x2supInput').value = limit.x_2sup;
      document.getElementById('x3infInput').value = limit.x_3inf;
      document.getElementById('x3supInput').value = limit.x_3sup;
      
      document.getElementById('y2infInput').value = limit.y_2inf;
      document.getElementById('y2supInput').value = limit.y_2sup;
      document.getElementById('y3infInput').value = limit.y_3inf;
      document.getElementById('y3supInput').value = limit.y_3sup;
      
      document.getElementById('z2infInput').value = limit.z_2inf;
      document.getElementById('z2supInput').value = limit.z_2sup;
      document.getElementById('z3infInput').value = limit.z_3inf;
      document.getElementById('z3supInput').value = limit.z_3sup;
    }
  } catch (error) {
    console.error('Error al cargar los límites:', error);
    showToast('Error al cargar los límites', 'error');
  }
}

// Crear nuevo modelo
async function createModel() {
  try {
    // Implementar lógica para abrir modal y crear modelo
    showModelModal();
  } catch (error) {
    console.error('Error al crear modelo:', error);
    showToast('Error al crear el modelo: ' + error.message, 'error');
  }
}

// Editar modelo existente
async function editModel(modelId) {
  try {
    const model = await fetchAPI(`/models/${modelId}`);
    // Implementar lógica para abrir modal con datos del modelo
    showModelModal(model);
  } catch (error) {
    console.error('Error al editar modelo:', error);
    showToast('Error al editar el modelo: ' + error.message, 'error');
  }
}

// Eliminar modelo
async function deleteModel(modelId) {
  try {
    if (confirm('¿Está seguro de eliminar este modelo? Esta acción no se puede deshacer.')) {
      await fetchAPI(`/models/${modelId}`, { method: 'DELETE' });
      showToast('Modelo eliminado correctamente', 'success');
      loadModels();
    }
  } catch (error) {
    console.error('Error al eliminar modelo:', error);
    showToast('Error al eliminar el modelo: ' + error.message, 'error');
  }
}

// Crear nuevo sensor
async function createSensor() {
  try {
    // Implementar lógica para abrir modal y crear sensor
    showSensorModal();
  } catch (error) {
    console.error('Error al crear sensor:', error);
    showToast('Error al crear el sensor: ' + error.message, 'error');
  }
}

// Editar sensor existente
async function editSensor(sensorId) {
  try {
    const sensor = await fetchAPI(`/sensors/${sensorId}`);
    // Implementar lógica para abrir modal con datos del sensor
    showSensorModal(sensor);
  } catch (error) {
    console.error('Error al editar sensor:', error);
    showToast('Error al editar el sensor: ' + error.message, 'error');
  }
}

// Eliminar sensor
async function deleteSensor(sensorId) {
  try {
    if (confirm('¿Está seguro de eliminar este sensor? Esta acción no se puede deshacer.')) {
      await fetchAPI(`/sensors/${sensorId}`, { method: 'DELETE' });
      showToast('Sensor eliminado correctamente', 'success');
      loadSensorsTable();
    }
  } catch (error) {
    console.error('Error al eliminar sensor:', error);
    showToast('Error al eliminar el sensor: ' + error.message, 'error');
  }
}

// Crear nueva máquina
async function createMachine() {
  try {
    // Implementar lógica para abrir modal y crear máquina
    showMachineModal();
  } catch (error) {
    console.error('Error al crear máquina:', error);
    showToast('Error al crear la máquina: ' + error.message, 'error');
  }
}

// Editar máquina existente
async function editMachine(machineId) {
  try {
    const machine = await fetchAPI(`/machines/${machineId}`);
    // Implementar lógica para abrir modal con datos de la máquina
    showMachineModal(machine);
  } catch (error) {
    console.error('Error al editar máquina:', error);
    showToast('Error al editar la máquina: ' + error.message, 'error');
  }
}

// Eliminar máquina
async function deleteMachine(machineId) {
  try {
    if (confirm('¿Está seguro de eliminar esta máquina? Esta acción no se puede deshacer.')) {
      await fetchAPI(`/machines/${machineId}`, { method: 'DELETE' });
      showToast('Máquina eliminada correctamente', 'success');
      loadMachines();
    }
  } catch (error) {
    console.error('Error al eliminar máquina:', error);
    showToast('Error al eliminar la máquina: ' + error.message, 'error');
  }
}

// Crear nueva configuración de límites
async function createLimit() {
  try {
    // Implementar lógica para abrir modal y crear límites
    showLimitModal();
  } catch (error) {
    console.error('Error al crear límites:', error);
    showToast('Error al crear los límites: ' + error.message, 'error');
  }
}

// Editar configuración de límites existente
async function editLimit(limitId) {
  try {
    const limit = await fetchAPI(`/limits/${limitId}`);
    // Implementar lógica para abrir modal con datos de los límites
    showLimitModal(limit);
  } catch (error) {
    console.error('Error al editar límites:', error);
    showToast('Error al editar los límites: ' + error.message, 'error');
  }
}

// Eliminar configuración de límites
async function deleteLimit(limitId) {
  try {
    if (confirm('¿Está seguro de eliminar esta configuración de límites? Esta acción no se puede deshacer.')) {
      await fetchAPI(`/limits/${limitId}`, { method: 'DELETE' });
      showToast('Configuración de límites eliminada correctamente', 'success');
      loadLimits();
    }
  } catch (error) {
    console.error('Error al eliminar límites:', error);
    showToast('Error al eliminar la configuración de límites: ' + error.message, 'error');
  }
}

// Funciones para mostrar/ocultar modales
function showModelModal(model = null) {
  // Implementación básica de modal para modelos
  const modalTitle = model ? 'Editar Modelo' : 'Crear Nuevo Modelo';
  const modalHtml = `
    <div class="modal-overlay" id="modelModal">
      <div class="modal-content">
        <div class="modal-header">
          <h5>${modalTitle}</h5>
          <button type="button" class="modal-close" onclick="closeModal('modelModal')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="modelForm">
            <input type="hidden" id="modelIdInput" value="${model ? model.model_id : ''}">
            <div class="form-group">
              <label for="modelNameInput">Nombre:</label>
              <input type="text" class="form-control" id="modelNameInput" value="${model ? model.name : ''}" required>
            </div>
            <div class="form-group">
              <label for="modelDescriptionInput">Descripción:</label>
              <input type="text" class="form-control" id="modelDescriptionInput" value="${model ? model.description : ''}">
            </div>
            <div class="form-group">
              <label for="modelRouteH5Input">Ruta Modelo (.h5):</label>
              <input type="text" class="form-control" id="modelRouteH5Input" value="${model ? model.route_h5 : ''}">
            </div>
            <div class="form-group">
              <label for="modelRoutePklInput">Ruta Escalador (.pkl):</label>
              <input type="text" class="form-control" id="modelRoutePklInput" value="${model ? model.route_pkl : ''}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" onclick="closeModal('modelModal')">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="saveModel()">Guardar</button>
        </div>
      </div>
    </div>
  `;
  
  // Añadir modal al DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
  
  // Mostrar modal
  setTimeout(() => {
    document.getElementById('modelModal').classList.add('active');
  }, 50);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
  
  // Eliminar del DOM después de la animación
  setTimeout(() => {
    modal.parentNode.remove();
  }, 300);
}

// Función para guardar el modelo (crear o actualizar)
async function saveModel() {
  try {
    const modelId = document.getElementById('modelIdInput').value;
    const modelData = {
      name: document.getElementById('modelNameInput').value,
      description: document.getElementById('modelDescriptionInput').value,
      route_h5: document.getElementById('modelRouteH5Input').value,
      route_pkl: document.getElementById('modelRoutePklInput').value
    };
    
    let response;
    
    if (modelId) {
      // Actualizar modelo existente
      response = await fetchAPI(`/models/${modelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelData)
      });
      
      showToast('Modelo actualizado correctamente', 'success');
    } else {
      // Crear nuevo modelo
      response = await fetchAPI('/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelData)
      });
      
      showToast('Modelo creado correctamente', 'success');
    }
    
    // Cerrar modal y recargar lista
    closeModal('modelModal');
    loadModels();
  } catch (error) {
    console.error('Error al guardar modelo:', error);
    showToast('Error al guardar el modelo: ' + error.message, 'error');
  }
}

// Guarda o actualiza un sensor
async function saveSensor() {
  try {
    const sensorId = document.getElementById('sensorIdInput').value;
    const data = {
      name: document.getElementById('sensorNameInput').value,
      description: document.getElementById('sensorDescriptionInput').value,
      model_id: parseInt(document.getElementById('sensorModelIdInput').value)
    };
    
    let response;
    
    if (sensorId) {
      // Actualizar sensor existente
      response = await fetchAPI(`/sensor/${sensorId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('Sensor actualizado correctamente', 'success');
    } else {
      // Crear nuevo sensor
      response = await fetchAPI('/sensor', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('Sensor creado correctamente', 'success');
    }
    
    // Resetear formulario y recargar datos
    resetForm('sensorForm');
    await loadSensorsTable();
    
    return response;
  } catch (error) {
    console.error('Error al guardar el sensor:', error);
    showToast(`Error al guardar el sensor: ${error.message}`, 'error');
    throw error;
  }
}

// Edita un sensor existente
async function editSensor(sensorId) {
  try {
    const sensor = await fetchAPI(`/sensor/${sensorId}`);
    
    document.getElementById('sensorIdInput').value = sensor.sensor_id;
    document.getElementById('sensorNameInput').value = sensor.name || '';
    document.getElementById('sensorDescriptionInput').value = sensor.description || '';
    
    if (sensor.model_id) {
      document.getElementById('sensorModelIdInput').value = sensor.model_id;
    }
    
    // Cambiar a la pestaña de sensores
    document.querySelector('.nav-link[data-tab="config-sensor"]').click();
    
    // Hacer scroll al formulario
    document.getElementById('sensorForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error al cargar el sensor para editar:', error);
    showToast('Error al cargar el sensor para editar', 'error');
  }
}

// Elimina un sensor
async function deleteSensor(sensorId) {
  if (confirm('¿Está seguro de eliminar este sensor? Esta acción no se puede deshacer.')) {
    try {
      await fetchAPI(`/sensor/${sensorId}`, {
        method: 'DELETE'
      });
      
      showToast('Sensor eliminado correctamente', 'success');
      await loadSensorsTable();
    } catch (error) {
      console.error('Error al eliminar el sensor:', error);
      showToast('Error al eliminar el sensor', 'error');
    }
  }
}

// Guarda o actualiza una máquina
async function saveMachine() {
  try {
    const machineId = document.getElementById('machineIdInput').value;
    const data = {
      name: document.getElementById('machineNameInput').value,
      description: document.getElementById('machineDescriptionInput').value,
      sensor_id: parseInt(document.getElementById('machineSensorIdInput').value)
    };
    
    let response;
    
    if (machineId) {
      // Actualizar máquina existente
      response = await fetchAPI(`/machine/${machineId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('Máquina actualizada correctamente', 'success');
    } else {
      // Crear nueva máquina
      response = await fetchAPI('/machine', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('Máquina creada correctamente', 'success');
    }
    
    // Resetear formulario y recargar datos
    resetForm('machineForm');
    await loadMachines();
    
    return response;
  } catch (error) {
    console.error('Error al guardar la máquina:', error);
    showToast(`Error al guardar la máquina: ${error.message}`, 'error');
    throw error;
  }
}

// Edita una máquina existente
async function editMachine(machineId) {
  try {
    const machine = await fetchAPI(`/machine/${machineId}`);
    
    document.getElementById('machineIdInput').value = machine.machine_id;
    document.getElementById('machineNameInput').value = machine.name || '';
    document.getElementById('machineDescriptionInput').value = machine.description || '';
    
    if (machine.sensor_id) {
      document.getElementById('machineSensorIdInput').value = machine.sensor_id;
    }
    
    // Cambiar a la pestaña de máquinas
    document.querySelector('.nav-link[data-tab="config-machine"]').click();
    
    // Hacer scroll al formulario
    document.getElementById('machineForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error al cargar la máquina para editar:', error);
    showToast('Error al cargar la máquina para editar', 'error');
  }
}

// Elimina una máquina
async function deleteMachine(machineId) {
  if (confirm('¿Está seguro de eliminar esta máquina? Esta acción no se puede deshacer.')) {
    try {
      await fetchAPI(`/machine/${machineId}`, {
        method: 'DELETE'
      });
      
      showToast('Máquina eliminada correctamente', 'success');
      await loadMachines();
    } catch (error) {
      console.error('Error al eliminar la máquina:', error);
      showToast('Error al eliminar la máquina', 'error');
    }
  }
}

// Guarda o actualiza los límites
async function saveLimits() {
  try {
    const limitId = document.getElementById('limitIdInput').value;
    const data = {
      x_2inf: parseFloat(document.getElementById('x2infInput').value),
      x_2sup: parseFloat(document.getElementById('x2supInput').value),
      x_3inf: parseFloat(document.getElementById('x3infInput').value),
      x_3sup: parseFloat(document.getElementById('x3supInput').value),
      y_2inf: parseFloat(document.getElementById('y2infInput').value),
      y_2sup: parseFloat(document.getElementById('y2supInput').value),
      y_3inf: parseFloat(document.getElementById('y3infInput').value),
      y_3sup: parseFloat(document.getElementById('y3supInput').value),
      z_2inf: parseFloat(document.getElementById('z2infInput').value),
      z_2sup: parseFloat(document.getElementById('z2supInput').value),
      z_3inf: parseFloat(document.getElementById('z3infInput').value),
      z_3sup: parseFloat(document.getElementById('z3supInput').value)
    };
    
    // Validar límites
    if (!validateLimits(data)) {
      showToast('Error: Los límites deben ser coherentes (min < max, warning < critical)', 'error');
      return;
    }
    
    let response;
    
    if (limitId) {
      // Actualizar límites existentes
      response = await fetchAPI(`/limit/${limitId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('Límites actualizados correctamente', 'success');
    } else {
      // Crear nuevos límites
      response = await fetchAPI('/limit', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('Límites creados correctamente', 'success');
    }
    
    // Actualizar el estado global con los nuevos límites
    globalState.limits = {
      x: { 
        warning: { min: data.x_2inf, max: data.x_2sup },
        critical: { min: data.x_3inf, max: data.x_3sup }
      },
      y: { 
        warning: { min: data.y_2inf, max: data.y_2sup },
        critical: { min: data.y_3inf, max: data.y_3sup }
      },
      z: { 
        warning: { min: data.z_2inf, max: data.z_2sup },
        critical: { min: data.z_3inf, max: data.z_3sup }
      }
    };
    
    // Resetear formulario y recargar datos
    await loadLimits();
    
    return response;
  } catch (error) {
    console.error('Error al guardar los límites:', error);
    showToast(`Error al guardar los límites: ${error.message}`, 'error');
    throw error;
  }
}

// Valida que los límites sean coherentes
function validateLimits(limits) {
  // Validar que min < max para cada par
  if (limits.x_2inf >= limits.x_2sup || 
      limits.x_3inf >= limits.x_3sup || 
      limits.y_2inf >= limits.y_2sup || 
      limits.y_3inf >= limits.y_3sup || 
      limits.z_2inf >= limits.z_2sup || 
      limits.z_3inf >= limits.z_3sup) {
    return false;
  }
  
  // Validar que warning está dentro de critical
  if (limits.x_2inf > limits.x_3inf || 
      limits.x_2sup < limits.x_3sup || 
      limits.y_2inf > limits.y_3inf || 
      limits.y_2sup < limits.y_3sup || 
      limits.z_2inf > limits.z_3inf || 
      limits.z_2sup < limits.z_3sup) {
    return false;
  }
  
  return true;
}

// Edita un límite existente
async function editLimit(limitId) {
  try {
    const limit = await fetchAPI(`/limit/${limitId}`);
    
    document.getElementById('limitIdInput').value = limit.limit_id;
    document.getElementById('x2infInput').value = limit.x_2inf;
    document.getElementById('x2supInput').value = limit.x_2sup;
    document.getElementById('x3infInput').value = limit.x_3inf;
    document.getElementById('x3supInput').value = limit.x_3sup;
    
    document.getElementById('y2infInput').value = limit.y_2inf;
    document.getElementById('y2supInput').value = limit.y_2sup;
    document.getElementById('y3infInput').value = limit.y_3inf;
    document.getElementById('y3supInput').value = limit.y_3sup;
    
    document.getElementById('z2infInput').value = limit.z_2inf;
    document.getElementById('z2supInput').value = limit.z_2sup;
    document.getElementById('z3infInput').value = limit.z_3inf;
    document.getElementById('z3supInput').value = limit.z_3sup;
    
    // Cambiar a la pestaña de límites
    document.querySelector('.nav-link[data-tab="config-limits"]').click();
    
    // Hacer scroll al formulario
    document.getElementById('limitsForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error al cargar los límites para editar:', error);
    showToast('Error al cargar los límites para editar', 'error');
  }
}

// Elimina un límite
async function deleteLimit(limitId) {
  if (confirm('¿Está seguro de eliminar esta configuración de límites? Esta acción no se puede deshacer.')) {
    try {
      await fetchAPI(`/limit/${limitId}`, {
        method: 'DELETE'
      });
      
      showToast('Configuración de límites eliminada correctamente', 'success');
      await loadLimits();
    } catch (error) {
      console.error('Error al eliminar la configuración de límites:', error);
      showToast('Error al eliminar la configuración de límites', 'error');
    }
  }
}
