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

// Flag para mostrar mensaje de config solo una vez por carga de página
let initialConfigMessageShown = false; 

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
  
  // Cargar datos iniciales y configurar estado
  initApp(); 
});

// Inicialización principal
async function initApp() {
  console.log("Iniciando initApp...");
  try {
    // 1. Cargar lista de sensores disponibles para el selector
    await loadSensors(); 
    
    // 2. Cargar la configuración completa del sistema
    const configLoaded = await loadConfiguration(); // Determina isConfigured

    // 3. Verificar estado detallado del backend (después de saber si está configurado)
    await checkSystemHealth(); 
    
    // 4. Actualizar UI final (sidebar/botón) basado en el estado final
    updateConfigurationStatus(); 

    // 5. Decidir acción final (iniciar monitoreo o mostrar toast config)
    if (configLoaded && isConfigured) {
      console.log("Sistema configurado. Iniciando actualización automática si hay sensor.");
      if (currentPage === 'dashboard' && globalState.currentSensor) {
        startAutoUpdate();
      }
    } else if (configLoaded && !isConfigured) {
      console.log("Configuración cargada, pero sistema no configurado.");
      showConfigurationRequiredMessage(); 
    } else {
      console.log("Fallo al cargar configuración.");
    }
    
    console.log("initApp finalizado.");

  } catch (error) {
    // Captura errores inesperados DURANTE initApp (no los de fetchAPI manejados dentro)
    console.error('Error grave durante la inicialización de la aplicación:', error);
    showToast('Error crítico al inicializar: ' + error.message, 'error');
    isConfigured = false; // Asegurar estado no configurado
    updateConfigurationStatus(); 
    const configWarning = document.getElementById('configurationWarning');
    if (configWarning) configWarning.style.display = 'block'; 
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
  
  // --- Añadir listeners para botones de selección de archivo ---
  const selectModelFileBtn = document.getElementById('selectModelFileBtn');
  if (selectModelFileBtn) {
    selectModelFileBtn.addEventListener('click', () => {
      document.getElementById('modelFileInput').click();
    });
  }

  const selectScalerFileBtn = document.getElementById('selectScalerFileBtn');
  if (selectScalerFileBtn) {
    selectScalerFileBtn.addEventListener('click', () => {
      document.getElementById('scalerFileInput').click();
    });
  }
  // --- Fin de listeners añadidos ---
  
  // Cargar datos para todas las tablas
  loadModels();
  loadSensorsTable();
  loadMachines();
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
  // Event Listeners para los formularios CRUD
  const sensorForm = document.getElementById('sensorForm');
  if (sensorForm) {
    sensorForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveSensor();
    });
  }
  
  const modelForm = document.getElementById('modelForm');
  if (modelForm) {
    modelForm.addEventListener('submit', modelFormSubmitHandler);
  }
  
  const machineForm = document.getElementById('machineForm');
  if (machineForm) {
    machineForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveMachine();
    });
  }
  
  const limitsForm = document.getElementById('limitsForm');
  if (limitsForm) {
    limitsForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveLimits();
    });
  }
  
  // Botones de reset
  document.getElementById('resetSensorBtn')?.addEventListener('click', () => resetForm('sensorForm'));
  document.getElementById('resetModelBtn')?.addEventListener('click', () => resetForm('modelForm'));
  document.getElementById('resetMachineBtn')?.addEventListener('click', () => resetForm('machineForm'));
  document.getElementById('resetLimitsBtn')?.addEventListener('click', () => resetForm('limitsForm'));
  
  // Los listeners para los botones de selección de archivos ahora están directamente en el HTML
  // Ya no los necesitamos aquí
}

// Función para manejar la selección de archivos
function handleFileSelection(fileInput, targetInputId) {
  try {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      // Guardamos el nombre del archivo en el input correspondiente
      document.getElementById(targetInputId).value = file.name;
      
      // También guardamos el archivo completo en un objeto global para su posible uso posterior
      if (!window.selectedFiles) {
        window.selectedFiles = {};
      }
      window.selectedFiles[targetInputId] = file;
      
      console.log(`Archivo seleccionado para ${targetInputId}: ${file.name}`);
    }
  } catch (error) {
    console.error(`Error al procesar el archivo seleccionado:`, error);
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
      // Limpiar los campos de archivo también
      const routeH5Input = document.getElementById('modelRouteH5Input');
      const routePklInput = document.getElementById('modelRoutePklInput');
      if (routeH5Input) routeH5Input.value = '';
      if (routePklInput) routePklInput.value = '';
      
      // Limpiar archivos seleccionados
      if (window.selectedFiles) {
        delete window.selectedFiles['modelRouteH5Input'];
        delete window.selectedFiles['modelRoutePklInput'];
      }
    } else if (formId === 'machineForm') {
      document.getElementById('machineIdInput').value = '';
    } else if (formId === 'limitsForm') {
      document.getElementById('limitIdInput').value = '';
    }
  }
}

// Verifica el estado de salud del sistema
async function checkSystemHealth() {
  console.log("Verificando salud del sistema...");
  const statusDot = document.querySelector('#estadoSistema .status-dot');
  const statusText = document.querySelector('#estadoSistema .status-text');
  let backendStatus = 'unknown'; // Para registrar el estado detectado

  try {
    const health = await fetchAPI('/health');
    console.log("Respuesta de /health:", health);
    backendStatus = health.status || 'error'; // Asumir error si falta status

    // Solo actualiza el estado visual si el sistema DEBERÍA estar configurado.
    if (isConfigured) { 
        if (health.status === 'ok') {
          // No es necesario tocar el estado aquí, updateConfigurationStatus lo pondrá verde.
          console.log('Salud del sistema: OK (Configurado)');
          if (health.models !== 'loaded') {
             console.warn('Modelos ML no cargados según /health.');
             showToast('Advertencia: Modelos de ML no cargados correctamente.', 'warning');
             // Podríamos cambiar el estado a warning si queremos ser más específicos
             if(statusDot) statusDot.className = 'status-dot warning';
             if(statusText) statusText.textContent = 'Modelos no cargados';
          }
        } else if (health.status === 'warning') {
            if(statusDot) statusDot.className = 'status-dot warning';
            if(statusText) statusText.textContent = 'Sistema con advertencias';
            console.warn(`Salud del sistema: Warning (Configurado). Detalles: ${health.warning_details}`);
            if (health.warning_details) {
                showToast(health.warning_details, 'warning');
            }
        } else { 
          // Otros estados (ej. error)
          if(statusDot) statusDot.className = 'status-dot disconnected';
          if(statusText) statusText.textContent = 'Error en el sistema';
          console.error(`Salud del sistema: Error (Configurado). Detalles: ${health.error_details || 'Desconocido'}`);
          showToast(`Error en el sistema: ${health.error_details || 'Desconocido'}`, 'error');
        }
    } else {
         // Si no está configurado, solo logueamos.
         console.log(`Salud del sistema (No Configurado): Status=${health.status}, Details=${health.warning_details || health.error_details || 'N/A'}`);
    }

  } catch (error) {
    // Error al contactar el endpoint /health
    console.error('Error al verificar la salud del sistema (fetch fallido):', error);
    backendStatus = 'error';
    // Solo mostrar error si se supone que está configurado
    if (isConfigured) {
        if(statusDot) statusDot.className = 'status-dot disconnected';
        if(statusText) statusText.textContent = 'Error de conexión';
        showToast('Error de conexión al verificar estado del sistema.', 'error');
    }
  }
  // Devolver el estado detectado para posible uso futuro
  return backendStatus; 
}

// Carga la configuración actual desde el servidor
async function loadConfiguration() {
  console.log("Cargando configuración desde /config...");
  let config = null; 
  try {
    config = await fetchAPI('/config');
    console.log("Configuración recibida:", config);
    
    // Actualizar estado global isConfigured
    if (config && config.system_config) { 
      isConfigured = config.system_config.is_configured === 1;
      console.log("Estado isConfigured actualizado a:", isConfigured);
    } else {
      isConfigured = false;
      console.warn("Respuesta de /config inválida o incompleta. Asumiendo no configurado.");
    }
    
    // Actualizar el resto del estado global solo si la config es válida
    if (config && config.limit_config) {
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
    
    if (config && config.model) {
        const defaultModelPath = "Modelo/anomaly_detection_model.h5"; // Usar rutas relativas por defecto
        const defaultScalerPath = "Scaler/scaler.pkl";
        globalState.modelPath = config.model.route_h5 || defaultModelPath;
        globalState.scalerPath = config.model.route_pkl || defaultScalerPath;
        globalState.modelInfo = {
          name: config.model.name || "Modelo por defecto",
          description: config.model.description || ""
        };
    } else {
       globalState.modelPath = "Modelo/anomaly_detection_model.h5";
       globalState.scalerPath = "Scaler/scaler.pkl";
       globalState.modelInfo = { name: "Modelo no configurado", description: "" };
    }
    
    if (config && config.sensors && config.sensors.length > 0) {
        globalState.sensorInfo = {
            name: config.sensors[0].name || "",
            description: config.sensors[0].description || ""
          };
    }
    
    if (config && config.machines && config.machines.length > 0) {
        globalState.machineInfo = {
            name: config.machines[0].name || "",
            description: config.machines[0].description || ""
          };
    }
    
    // --- NO LLAMAR a initConfigFields ni updateConfigurationView aquí --- 
    // Se llamarán al navegar a la página de configuración.
     
    console.log("loadConfiguration completado.");
    return true; // Indicar que la carga fue exitosa

  } catch (error) {
    console.error('Error fatal al cargar la configuración desde /config:', error);
    showToast('Error crítico al cargar la configuración. Verifique la conexión con el backend.', 'error', 15000); 
    isConfigured = false; // Asegurar estado no configurado
    return false; // Indicar que la carga falló
  }
}

// Actualiza la UI según el estado de configuración FINAL
function updateConfigurationStatus() {
  const startMonitoringBtn = document.getElementById('startMonitoringBtn');
  const configurationWarning = document.getElementById('configurationWarning');
  const estadoSistemaText = document.querySelector('#estadoSistema .status-text'); 
  const estadoSistemaDot = document.querySelector('#estadoSistema .status-dot');

  // Controlar botón de monitoreo
  if (startMonitoringBtn) {
    startMonitoringBtn.disabled = !isConfigured;
    startMonitoringBtn.title = isConfigured ? 'Iniciar monitoreo de datos' : 'Configure el sistema...';
  }
  
  // Controlar aviso visual en sidebar
  if (configurationWarning) {
    configurationWarning.style.display = isConfigured ? 'none' : 'block';
  }

  // Actualizar estado general visual en sidebar
  // Este es el estado por defecto basado en si se pudo configurar o no.
  // checkSystemHealth puede sobreescribirlo DESPUÉS si detecta un problema específico.
  if (isConfigured) {
      // Si está configurado, asumimos conectado inicialmente.
      // checkSystemHealth lo corregirá si hay problemas.
      if (estadoSistemaText) estadoSistemaText.textContent = "Sistema Configurado";
      if (estadoSistemaDot) estadoSistemaDot.className = 'status-dot connected';
  } else {
      // Si no está configurado (ya sea por fallo al cargar o porque is_configured=0)
      if (estadoSistemaText) estadoSistemaText.textContent = "Configuración Requerida";
      if (estadoSistemaDot) estadoSistemaDot.className = 'status-dot warning'; 
  }
  
  console.log(`Estado de configuración actualizado en UI: ${isConfigured ? 'Configurado' : 'No configurado/Error'}`);
}

// Muestra un mensaje indicando que se requiere configuración
function showConfigurationRequiredMessage() {
  // Solo mostrar el toast informativo una vez por carga de página y si está en dashboard
  if (!initialConfigMessageShown && currentPage === 'dashboard') {
    showToast('Configure el sistema en la sección "Configuración" antes de iniciar el monitoreo', 'info', 10000);
    initialConfigMessageShown = true; // Marcar como mostrado
  }
  // El aviso visual en el sidebar se controla en updateConfigurationStatus
}

// Actualiza la visualización de la configuración en tiempo real (SOLO para la página de config)
function updateConfigurationView(configData) {
  // Verificar si estamos en la página de configuración antes de intentar actualizar
  if (currentPage !== 'configuracion') {
      console.log("No estamos en la página de configuración, omitiendo updateConfigurationView.");
      return;
  }
  console.log("Actualizando vista de configuración con datos:", configData);
  
  // Usar los datos pasados (que vienen de globalState o de la respuesta de PUT /config)
  const sysConfig = configData?.system_config;
  const limitConfig = configData?.limit_config;
  const modelConfig = configData?.model;
  const sensorsList = configData?.sensors;
  const machinesList = configData?.machines;

  try {
      // Actualizar tabla de configuración general
      const configStatusEl = document.getElementById('configStatus');
      if (configStatusEl) configStatusEl.textContent = sysConfig?.is_configured === 1 ? 'Configurado' : 'No configurado';
      
      const configLastUpdateEl = document.getElementById('configLastUpdate');
      if(configLastUpdateEl) configLastUpdateEl.textContent = sysConfig?.last_update ? new Date(sysConfig.last_update).toLocaleString() : '-';
      
      const configActiveModelEl = document.getElementById('configActiveModel');
      if(configActiveModelEl) configActiveModelEl.textContent = modelConfig ? modelConfig.name || `ID: ${modelConfig.model_id}` : 'No hay modelo activo';
      
      // Actualizar tabla de límites (Solo lectura)
      if (limitConfig) {
          const elements = {
              limitXWarningMin: limitConfig.x_2inf,
              limitXWarningMax: limitConfig.x_2sup,
              limitXCriticalMin: limitConfig.x_3inf,
              limitXCriticalMax: limitConfig.x_3sup,
              limitYWarningMin: limitConfig.y_2inf,
              limitYWarningMax: limitConfig.y_2sup,
              limitYCriticalMin: limitConfig.y_3inf,
              limitYCriticalMax: limitConfig.y_3sup,
              limitZWarningMin: limitConfig.z_2inf,
              limitZWarningMax: limitConfig.z_2sup,
              limitZCriticalMin: limitConfig.z_3inf,
              limitZCriticalMax: limitConfig.z_3sup,
          };
          for (const [id, value] of Object.entries(elements)) {
              const el = document.getElementById(id);
              if (el) el.textContent = value?.toFixed(2) ?? '-';
          }
      }
      
      // Actualizar tabla de sensores (Solo lectura)
      const sensorTableBody = document.getElementById('sensorTableBody');
      if (sensorTableBody) {
          sensorTableBody.innerHTML = ''; // Limpiar antes de poblar
          if (sensorsList && sensorsList.length > 0) {
            sensorsList.forEach(sensor => {
              const row = sensorTableBody.insertRow();
              row.innerHTML = `
                <td>${sensor.sensor_id}</td>
                <td>${sensor.name || ''}</td>
                <td>${sensor.description || ''}</td>
                <td>${sensor.model_id || '-'}</td> 
              `;
            });
          } else {
            sensorTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay sensores configurados</td></tr>';
          }
      }
      
      // Actualizar tabla de máquinas (Solo lectura)
      const machineTableBody = document.getElementById('machineTableBody');
      if (machineTableBody) {
          machineTableBody.innerHTML = ''; // Limpiar antes de poblar
          if (machinesList && machinesList.length > 0) {
            machinesList.forEach(machine => {
              const row = machineTableBody.insertRow();
              row.innerHTML = `
                <td>${machine.machine_id}</td>
                <td>${machine.name || ''}</td>
                <td>${machine.description || ''}</td>
                <td>${machine.sensor_id || '-'}</td>
              `;
            });
          } else {
            machineTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay máquinas configuradas</td></tr>';
          }
      }
  } catch (error) {
      console.error("Error dentro de updateConfigurationView:", error);
      // Evitar que un error aquí rompa la aplicación, pero loguearlo.
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
  
  currentPage = page;
  if (!skipPushState) {
    window.history.pushState({ page }, `PdM-Manager | ${page}`, `#${page}`);
  }
  
  // Actualizar clases activas en el menú
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');
  
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
      if (isConfigured && globalState.currentSensor) {
        loadDashboardData(); // Recargar datos del sensor actual
        if (!globalState.isUpdating) { // Reiniciar si no estaba corriendo
             startAutoUpdate();
        }
      } else if (!isConfigured) {
        showConfigurationRequiredMessage();
      }
    } else if (page === 'configuracion') {
      // *** LLAMAR A initConfigFields y updateConfigurationView AQUÍ ***
      console.log("Navegando a configuración, actualizando campos y vista...");
      initConfigFields(); 
      updateConfigurationView(globalState); // Usar datos globales ya cargados
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
  document.getElementById('addModelBtn')?.addEventListener('click', createModel);
  document.getElementById('addSensorBtn')?.addEventListener('click', createSensor);
  document.getElementById('addMachineBtn')?.addEventListener('click', createMachine);

  // --- Botones CRUD --- 
  // LÍMITES
  const limitsForm = document.getElementById('limitsForm');
  if (limitsForm) {
    limitsForm.addEventListener('submit', (e) => { e.preventDefault(); saveLimits(); });
  }
  const resetLimitsBtn = document.getElementById('resetLimitsBtn');
  if (resetLimitsBtn) {
    resetLimitsBtn.addEventListener('click', resetLimitsForm);
  }

  // MODELO
  const modelForm = document.getElementById('modelForm');
  if (modelForm) {
    // Llamar a saveModel en lugar del handler anterior
    modelForm.addEventListener('submit', (e) => { e.preventDefault(); saveModel(); }); 
  }
  const resetModelBtn = document.getElementById('resetModelBtn');
  if (resetModelBtn) {
    resetModelBtn.addEventListener('click', resetModelForm);
  }
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener('click', loadModels);
  }
  
  // SENSOR (Listeners para save/reset/refresh se añadirán con las funciones)
  // MÁQUINA (Listeners para save/reset/refresh se añadirán con las funciones)

  // SENSOR
  const sensorForm = document.getElementById('sensorForm');
  if (sensorForm) {
    sensorForm.addEventListener('submit', (e) => { e.preventDefault(); saveSensor(); });
  }
  const resetSensorBtn = document.getElementById('resetSensorBtn');
  if (resetSensorBtn) {
    resetSensorBtn.addEventListener('click', resetSensorForm);
  }
  const refreshSensorsBtn = document.getElementById('refreshSensorsBtn');
  if (refreshSensorsBtn) {
    // Asegurarse que recarga la tabla y el selector
    refreshSensorsBtn.addEventListener('click', async () => { 
      await loadSensorsTable(); 
      await loadSensors(); 
    });
  }

  // MÁQUINA
  const machineForm = document.getElementById('machineForm');
  if (machineForm) {
    machineForm.addEventListener('submit', (e) => { e.preventDefault(); saveMachine(); });
  }
  const resetMachineBtn = document.getElementById('resetMachineBtn');
  if (resetMachineBtn) {
    resetMachineBtn.addEventListener('click', resetMachineForm);
  }
  const refreshMachinesBtn = document.getElementById('refreshMachinesBtn');
  if (refreshMachinesBtn) {
    refreshMachinesBtn.addEventListener('click', loadMachines);
  }
}

// Guarda la configuración en el servidor
async function saveConfiguration() {
  try {
    // Mostrar indicador de carga
    const saveButton = document.getElementById('saveConfigButton');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Guardando...';
    saveButton.disabled = true;
    
    // Recopilar datos del formulario - *** CORREGIDO IDs de límites ***
    const configData = {
      route_h5: document.getElementById('modelRouteH5Input').value.trim(),
      route_pkl: document.getElementById('modelRoutePklInput').value.trim(),
      model_name: document.getElementById('modelName').value.trim(),
      model_description: document.getElementById('modelDescription').value.trim(),
      sensor_name: document.getElementById('sensorName').value.trim(),
      sensor_description: document.getElementById('sensorDescription').value.trim(),
      machine_name: document.getElementById('machineName').value.trim(),
      machine_description: document.getElementById('machineDescription').value.trim(),

      // Límites de alerta para el eje X
      x_2inf: parseFloat(document.getElementById('x2infInput').value), // ID corregido
      x_2sup: parseFloat(document.getElementById('x2supInput').value), // ID corregido
      x_3inf: parseFloat(document.getElementById('x3infInput').value), // ID corregido
      x_3sup: parseFloat(document.getElementById('x3supInput').value), // ID corregido

      // Límites de alerta para el eje Y
      y_2inf: parseFloat(document.getElementById('y2infInput').value), // ID corregido
      y_2sup: parseFloat(document.getElementById('y2supInput').value), // ID corregido
      y_3inf: parseFloat(document.getElementById('y3infInput').value), // ID corregido
      y_3sup: parseFloat(document.getElementById('y3supInput').value), // ID corregido

      // Límites de alerta para el eje Z
      z_2inf: parseFloat(document.getElementById('z2infInput').value), // ID corregido
      z_2sup: parseFloat(document.getElementById('z2supInput').value), // ID corregido
      z_3inf: parseFloat(document.getElementById('z3infInput').value), // ID corregido
      z_3sup: parseFloat(document.getElementById('z3supInput').value), // ID corregido
    };

    // Validar campos obligatorios (rutas, nombres)
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
    
    // *** VALIDACIONES DE LÍMITES EN FRONTEND ELIMINADAS ***
    // Se confía en las validaciones del backend (Pydantic)
    /* 
    if (configData.x_2inf >= configData.x_2sup) { ... }
    if (configData.x_3inf >= configData.x_2inf) { ... }
    if (configData.x_2sup >= configData.x_3sup) { ... }
    // ... validaciones para Y y Z ...
    */

    // Si tenemos archivos seleccionados, primero debemos cargarlos al servidor
    let formData = null;
    if (window.selectedFiles && (window.selectedFiles['modelRouteH5Input'] || window.selectedFiles['modelRoutePklInput'])) {
      formData = new FormData();
      
      if (window.selectedFiles['modelRouteH5Input']) {
        formData.append('model_file', window.selectedFiles['modelRouteH5Input']);
        // Actualizamos la ruta en configData con el nombre real del archivo
        configData.route_h5 = `Modelo/${window.selectedFiles['modelRouteH5Input'].name}`;
      }
      
      if (window.selectedFiles['modelRoutePklInput']) {
        formData.append('scaler_file', window.selectedFiles['modelRoutePklInput']);
        // Actualizamos la ruta en configData con el nombre real del archivo
        configData.route_pkl = `Scaler/${window.selectedFiles['modelRoutePklInput'].name}`;
      }
      
      // Subir los archivos al servidor primero
      try {
        const uploadResponse = await fetch('/upload_model_files', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Error al cargar archivos al servidor');
        }
        
        // Limpiar los archivos seleccionados después de cargarlos
        if (window.selectedFiles) {
          delete window.selectedFiles['modelRouteH5Input'];
          delete window.selectedFiles['modelRoutePklInput'];
        }
      } catch (uploadError) {
        console.error('Error al cargar archivos:', uploadError);
        showToast(`Error al cargar archivos: ${uploadError.message}`, 'error');
        saveButton.textContent = originalText;
        saveButton.disabled = false;
        return false;
      }
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
  
  // Rutas predeterminadas absolutas
  globalState.modelPath = "C:\\Users\\nicol\\Documentos\\GitHub\\PdM-Manager\\Modelo\\anomaly_detection_model.h5";
  globalState.scalerPath = "C:\\Users\\nicol\\Documentos\\GitHub\\PdM-Manager\\Scaler\\scaler.pkl";
  
  // Restablecer información a valores por defecto
  globalState.modelInfo = { name: "Modelo por defecto", description: "Modelo de detección de anomalías por defecto" };
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

// ==========================================================================
// FUNCIONES CRUD (Create, Read, Update, Delete)
// ==========================================================================

// --- Límites ---

// Carga los límites desde el backend y actualiza el estado global y el formulario
async function loadLimits() {
  console.log("Cargando configuración de límites...");
  try {
    // Asumimos que siempre trabajamos con el ID=1 para la configuración de límites activa
    const limitId = 1;
    const data = await fetchAPI(`/config/limits/${limitId}`);
    
    if (data && data.limit_config) {
      const limits = data.limit_config;
      globalState.limits = {
        x: {
          warning: { min: limits.x_2inf, max: limits.x_2sup },
          critical: { min: limits.x_3inf, max: limits.x_3sup }
        },
        y: {
          warning: { min: limits.y_2inf, max: limits.y_2sup },
          critical: { min: limits.y_3inf, max: limits.y_3sup }
        },
        z: {
          warning: { min: limits.z_2inf, max: limits.z_2sup },
          critical: { min: limits.z_3inf, max: limits.z_3sup }
        }
      };
      console.log("Límites cargados y estado global actualizado:", globalState.limits);
      populateLimitsForm(); // Rellena el formulario con los datos cargados
      updateChartsWithLimits(); // Actualiza las gráficas con los nuevos límites
      return true;
    } else {
      console.warn("No se encontraron datos de límites válidos en la respuesta.");
      showToast("No se pudo cargar la configuración de límites.", "warning");
      // Podríamos mantener los valores por defecto o limpiar el formulario
      return false;
    }
  } catch (error) {
    console.error('Error al cargar los límites:', error);
    showToast(`Error al cargar límites: ${error.message || 'Error desconocido'}`, 'error');
    return false;
  }
}

// Rellena el formulario de límites con los datos del estado global
function populateLimitsForm() {
  if (!globalState.limits) {
    console.warn("populateLimitsForm: globalState.limits no está definido.");
    return;
  }
  
  // Verificar que los elementos existen antes de asignarles valor
  const fields = {
    'x2infInput': globalState.limits.x?.warning?.min,
    'x2supInput': globalState.limits.x?.warning?.max,
    'x3infInput': globalState.limits.x?.critical?.min,
    'x3supInput': globalState.limits.x?.critical?.max,
    'y2infInput': globalState.limits.y?.warning?.min,
    'y2supInput': globalState.limits.y?.warning?.max,
    'y3infInput': globalState.limits.y?.critical?.min,
    'y3supInput': globalState.limits.y?.critical?.max,
    'z2infInput': globalState.limits.z?.warning?.min,
    'z2supInput': globalState.limits.z?.warning?.max,
    'z3infInput': globalState.limits.z?.critical?.min,
    'z3supInput': globalState.limits.z?.critical?.max
  };

  for (const id in fields) {
    const element = document.getElementById(id);
    if (element) {
      // Asignar solo si el valor no es null o undefined
      element.value = fields[id] !== null && fields[id] !== undefined ? fields[id] : '';
    } else {
      console.warn(`Elemento con ID '${id}' no encontrado en el DOM.`);
    }
  }
  console.log("Formulario de límites poblado.");
}

// Guarda los límites actuales del formulario en el backend
async function saveLimits() {
  const saveButton = document.getElementById('saveLimitsBtn');
  const originalText = saveButton.innerHTML; // Guardar contenido HTML (incluye icono)
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  saveButton.disabled = true;

  try {
    // Recopilar datos del formulario de límites
    const limitData = {
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
      z_3sup: parseFloat(document.getElementById('z3supInput').value),
    };

    // Validar que todos los campos sean números válidos (aunque Pydantic lo hará también)
    for (const key in limitData) {
      if (isNaN(limitData[key])) {
        showToast(`El valor para ${key.replace('_', ' ')} no es un número válido.`, 'error');
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
        return;
      }
    }

    console.log("Enviando datos de límites para guardar:", limitData);

    // Asumimos que siempre actualizamos la configuración con ID=1
    const limitId = 1;
    const response = await fetchAPI(`/config/limits/${limitId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(limitData)
    });

    // Actualizar estado global y UI si la operación fue exitosa
    if (response && response.limit_config) { // Verificar la respuesta del endpoint específico
      console.log("Respuesta del servidor al guardar límites:", response.limit_config);
      // Volver a cargar los límites para asegurar consistencia
      await loadLimits(); 
      showToast('Límites guardados correctamente', 'success');
      updateChartsWithLimits(); // Actualizar gráficas
    } else {
      // Si la respuesta no es la esperada, mostrar error genérico o detalles si están disponibles
      const errorDetail = response?.detail || 'Respuesta inesperada del servidor.';
      console.error('Error al guardar límites - Respuesta inválida:', response);
      showToast(`Error al guardar límites: ${errorDetail}`, 'error');
    }

  } catch (error) {
    console.error('Error al guardar los límites:', error);
    showToast(`Error al guardar límites: ${error.message || 'Error desconocido'}`, 'error');
  } finally {
    // Restaurar botón independientemente del resultado
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

// Resetea los campos del formulario de límites
function resetLimitsForm() {
  document.getElementById('limitsForm').reset(); // Usa el reset nativo del formulario
  document.getElementById('limitIdInput').value = ''; // Limpiar ID oculto si se usara
  console.log("Formulario de límites reseteado.");
  // Opcional: Rellenar con los valores por defecto si es necesario después del reset
  // populateLimitsForm(); 
}

// --- Modelo ---

// Función para limpiar el formulario de modelo
function resetModelForm() {
  document.getElementById('modelForm').reset();
  document.getElementById('modelIdInput').value = ''; // Limpiar ID
  document.getElementById('saveModelBtn').innerHTML = '<i class="fas fa-save"></i> Guardar'; // Restaurar texto botón
  // Limpiar selección de archivos si se implementó
  const modelFileInput = document.getElementById('modelFileInput');
  const scalerFileInput = document.getElementById('scalerFileInput');
  if (modelFileInput) modelFileInput.value = null;
  if (scalerFileInput) scalerFileInput.value = null;
  // Limpiar nombres de archivo en los inputs de texto si existen
  const modelRouteInput = document.getElementById('modelRouteH5Input');
  const scalerRouteInput = document.getElementById('modelRoutePklInput');
  if (modelRouteInput) modelRouteInput.value = '';
  if (scalerRouteInput) scalerRouteInput.value = '';
  console.log("Formulario de modelo reseteado.");
}

// Carga los datos de un modelo en el formulario para edición
async function editModel(modelId) {
  console.log(`Editando modelo con ID: ${modelId}`);
  try {
    const model = await fetchAPI(`/models/${modelId}`);
    if (model) {
      document.getElementById('modelIdInput').value = model.model_id;
      document.getElementById('modelNameInput').value = model.name || '';
      document.getElementById('modelDescriptionInput').value = model.description || '';
      document.getElementById('modelRouteH5Input').value = model.route_h5 || '';
      document.getElementById('modelRoutePklInput').value = model.route_pkl || '';
      document.getElementById('saveModelBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar'; // Cambiar texto botón
      // Enfocar el primer campo para conveniencia
      document.getElementById('modelNameInput').focus(); 
      showToast('Datos del modelo cargados para edición.', 'info');
    } else {
      showToast('No se pudo cargar el modelo para editar.', 'error');
    }
  } catch (error) {
    console.error('Error al cargar modelo para editar:', error);
    showToast(`Error cargando modelo: ${error.message}`, 'error');
  }
}

// Guarda (Crea o Actualiza) un modelo
async function saveModel() {
  const modelId = document.getElementById('modelIdInput').value;
  const isUpdating = !!modelId; // True si hay un ID, indica actualización
  const url = isUpdating ? `/models/${modelId}` : '/models';
  const method = isUpdating ? 'PUT' : 'POST';

  const saveButton = document.getElementById('saveModelBtn');
  const originalText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  saveButton.disabled = true;

  // TODO: Manejar carga de archivos .h5 y .pkl si se seleccionaron nuevos.
  // Esto requeriría enviar FormData en lugar de JSON, o un endpoint separado /upload.
  // Por ahora, asumimos que las rutas se escriben manualmente.

  const modelData = {
    name: document.getElementById('modelNameInput').value.trim(),
    description: document.getElementById('modelDescriptionInput').value.trim(),
    route_h5: document.getElementById('modelRouteH5Input').value.trim(),
    route_pkl: document.getElementById('modelRoutePklInput').value.trim(),
  };

  // Validación básica en frontend
  if (!modelData.name || !modelData.route_h5 || !modelData.route_pkl) {
    showToast('Nombre, Ruta H5 y Ruta PKL son obligatorios.', 'error');
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
    return;
  }

  try {
    const response = await fetchAPI(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modelData)
    });

    // La respuesta debería ser el modelo creado/actualizado
    if (response && response.model_id) {
      showToast(`Modelo ${isUpdating ? 'actualizado' : 'creado'} correctamente`, 'success');
      resetModelForm(); // Limpiar formulario
      await loadModels(); // Recargar la tabla de modelos
    } else {
      // Si hay error, el backend debería devolver detalles
      const errorDetail = response?.detail || 'Respuesta inesperada del servidor.';
      console.error('Error al guardar modelo - Respuesta inválida:', response);
      showToast(`Error al guardar modelo: ${errorDetail}`, 'error');
    }
  } catch (error) {
    console.error('Error al guardar el modelo:', error);
    showToast(`Error al guardar modelo: ${error.message || 'Error desconocido'}`, 'error');
  } finally {
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

// Elimina un modelo
async function deleteModel(modelId) {
  // Confirmación
  if (!confirm(`¿Está seguro de que desea eliminar el modelo con ID ${modelId}? Esta acción no se puede deshacer.`)) {
    return;
  }

  console.log(`Eliminando modelo con ID: ${modelId}`);
  try {
    // No se espera contenido en la respuesta (status 204)
    await fetchAPI(`/models/${modelId}`, {
      method: 'DELETE'
    }); 
    showToast('Modelo eliminado correctamente', 'success');
    await loadModels(); // Recargar la tabla de modelos
  } catch (error) {
    console.error('Error al eliminar el modelo:', error);
    // El error puede venir del fetchAPI (red) o si el backend devuelve error (ej. 400, 404, 500)
    showToast(`Error al eliminar modelo: ${error.message || 'Error desconocido'}`, 'error');
  }
}

// --- Sensor ---

// Función para limpiar el formulario de sensor
function resetSensorForm() {
  document.getElementById('sensorForm').reset();
  document.getElementById('sensorIdInput').value = ''; // Limpiar ID
  document.getElementById('saveSensorBtn').innerHTML = '<i class="fas fa-save"></i> Guardar'; // Restaurar texto botón
  // Resetear selector de modelo
  const modelSelect = document.getElementById('sensorModelIdInput');
  if(modelSelect) modelSelect.selectedIndex = 0; // Poner en "Seleccione un modelo"
  console.log("Formulario de sensor reseteado.");
}

// Carga los datos de un sensor en el formulario para edición
async function editSensor(sensorId) {
  console.log(`Editando sensor con ID: ${sensorId}`);
  try {
    const sensor = await fetchAPI(`/sensors/${sensorId}`);
    if (sensor) {
      document.getElementById('sensorIdInput').value = sensor.sensor_id;
      document.getElementById('sensorNameInput').value = sensor.name || '';
      document.getElementById('sensorDescriptionInput').value = sensor.description || '';
      document.getElementById('sensorModelIdInput').value = sensor.model_id || ''; // Seleccionar modelo
      document.getElementById('saveSensorBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar'; // Cambiar texto botón
      document.getElementById('sensorNameInput').focus();
      showToast('Datos del sensor cargados para edición.', 'info');
    } else {
      showToast('No se pudo cargar el sensor para editar.', 'error');
    }
  } catch (error) {
    console.error('Error al cargar sensor para editar:', error);
    showToast(`Error cargando sensor: ${error.message}`, 'error');
  }
}

// Guarda (Crea o Actualiza) un sensor
async function saveSensor() {
  const sensorId = document.getElementById('sensorIdInput').value;
  const isUpdating = !!sensorId;
  const url = isUpdating ? `/sensors/${sensorId}` : '/sensors';
  const method = isUpdating ? 'PUT' : 'POST';

  const saveButton = document.getElementById('saveSensorBtn');
  const originalText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  saveButton.disabled = true;

  const sensorData = {
    name: document.getElementById('sensorNameInput').value.trim(),
    description: document.getElementById('sensorDescriptionInput').value.trim(),
    model_id: parseInt(document.getElementById('sensorModelIdInput').value) || null, // Convertir a int o null
  };

  // Validación básica
  if (!sensorData.name) {
    showToast('El nombre del sensor es obligatorio.', 'error');
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
    return;
  }
  // Opcional: Validar que se seleccionó un modelo si es obligatorio
  // if (!sensorData.model_id) { ... }

  try {
    const response = await fetchAPI(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sensorData)
    });

    if (response && response.sensor_id) {
      showToast(`Sensor ${isUpdating ? 'actualizado' : 'creado'} correctamente`, 'success');
      resetSensorForm();
      await loadSensorsTable(); // Recargar tabla de sensores
      await loadSensors(); // Recargar selector de sensores en dashboard y máquinas
    } else {
      const errorDetail = response?.detail || 'Respuesta inesperada del servidor.';
      console.error('Error al guardar sensor - Respuesta inválida:', response);
      showToast(`Error al guardar sensor: ${errorDetail}`, 'error');
    }
  } catch (error) {
    console.error('Error al guardar el sensor:', error);
    showToast(`Error al guardar sensor: ${error.message || 'Error desconocido'}`, 'error');
  } finally {
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

// Elimina un sensor
async function deleteSensor(sensorId) {
  if (!confirm(`¿Está seguro de que desea eliminar el sensor con ID ${sensorId}? Esto también eliminará las máquinas asociadas.`)) {
    return;
  }

  console.log(`Eliminando sensor con ID: ${sensorId}`);
  try {
    await fetchAPI(`/sensors/${sensorId}`, {
      method: 'DELETE'
    });
    showToast('Sensor eliminado correctamente', 'success');
    await loadSensorsTable(); // Recargar tabla de sensores
    await loadSensors(); // Recargar selector de sensores en dashboard y máquinas
    await loadMachines(); // Recargar tabla de máquinas (por si alguna usaba este sensor)
  } catch (error) {
    console.error('Error al eliminar el sensor:', error);
    showToast(`Error al eliminar sensor: ${error.message || 'Error desconocido'}`, 'error');
  }
}

// --- Máquina ---

// Función para limpiar el formulario de máquina
function resetMachineForm() {
  document.getElementById('machineForm').reset();
  document.getElementById('machineIdInput').value = ''; // Limpiar ID
  document.getElementById('saveMachineBtn').innerHTML = '<i class="fas fa-save"></i> Guardar'; // Restaurar texto botón
  // Resetear selector de sensor
  const sensorSelect = document.getElementById('machineSensorIdInput');
  if (sensorSelect) sensorSelect.selectedIndex = 0; // Poner en "Seleccione un sensor"
  console.log("Formulario de máquina reseteado.");
}

// Carga los datos de una máquina en el formulario para edición
async function editMachine(machineId) {
  console.log(`Editando máquina con ID: ${machineId}`);
  try {
    const machine = await fetchAPI(`/machines/${machineId}`);
    if (machine) {
      document.getElementById('machineIdInput').value = machine.machine_id;
      document.getElementById('machineNameInput').value = machine.name || '';
      document.getElementById('machineDescriptionInput').value = machine.description || '';
      document.getElementById('machineSensorIdInput').value = machine.sensor_id || ''; // Seleccionar sensor
      document.getElementById('saveMachineBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar'; // Cambiar texto botón
      document.getElementById('machineNameInput').focus();
      showToast('Datos de la máquina cargados para edición.', 'info');
    } else {
      showToast('No se pudo cargar la máquina para editar.', 'error');
    }
  } catch (error) {
    console.error('Error al cargar máquina para editar:', error);
    showToast(`Error cargando máquina: ${error.message}`, 'error');
  }
}

// Guarda (Crea o Actualiza) una máquina
async function saveMachine() {
  const machineId = document.getElementById('machineIdInput').value;
  const isUpdating = !!machineId;
  const url = isUpdating ? `/machines/${machineId}` : '/machines';
  const method = isUpdating ? 'PUT' : 'POST';

  const saveButton = document.getElementById('saveMachineBtn');
  const originalText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  saveButton.disabled = true;

  const machineData = {
    name: document.getElementById('machineNameInput').value.trim(),
    description: document.getElementById('machineDescriptionInput').value.trim(),
    sensor_id: parseInt(document.getElementById('machineSensorIdInput').value) || null, // Convertir a int o null
  };

  // Validación básica
  if (!machineData.name) {
    showToast('El nombre de la máquina es obligatorio.', 'error');
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
    return;
  }
  // Opcional: Validar que se seleccionó un sensor si es obligatorio
  if (!machineData.sensor_id) {
     showToast('Debe seleccionar un sensor para la máquina.', 'error');
     saveButton.innerHTML = originalText;
     saveButton.disabled = false;
     return;
  }

  try {
    const response = await fetchAPI(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(machineData)
    });

    if (response && response.machine_id) {
      showToast(`Máquina ${isUpdating ? 'actualizada' : 'creada'} correctamente`, 'success');
      resetMachineForm();
      await loadMachines(); // Recargar tabla de máquinas
    } else {
      const errorDetail = response?.detail || 'Respuesta inesperada del servidor.';
      console.error('Error al guardar máquina - Respuesta inválida:', response);
      showToast(`Error al guardar máquina: ${errorDetail}`, 'error');
    }
  } catch (error) {
    console.error('Error al guardar la máquina:', error);
    showToast(`Error al guardar máquina: ${error.message || 'Error desconocido'}`, 'error');
  } finally {
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

// Elimina una máquina
async function deleteMachine(machineId) {
  if (!confirm(`¿Está seguro de que desea eliminar la máquina con ID ${machineId}?`)) {
    return;
  }

  console.log(`Eliminando máquina con ID: ${machineId}`);
  try {
    await fetchAPI(`/machines/${machineId}`, {
      method: 'DELETE'
    });
    showToast('Máquina eliminada correctamente', 'success');
    await loadMachines(); // Recargar tabla de máquinas
  } catch (error) {
    console.error('Error al eliminar la máquina:', error);
    showToast(`Error al eliminar máquina: ${error.message || 'Error desconocido'}`, 'error');
  }
}
