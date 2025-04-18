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
  
  // Cargar límites y rellenar formulario + tabla
  loadLimits(); // <- Llamada para cargar límites y actualizar UI
  
  // Inicializar los formularios CRUD
  initCrudForms();
  
  // --- Añadir listeners para botones de selección de archivo ---
  const selectModelFileBtnH5 = document.getElementById('selectModelFileBtnH5'); // ID actualizado
  if (selectModelFileBtnH5) {
    selectModelFileBtnH5.addEventListener('click', () => {
      document.getElementById('modelFileInputH5').click(); // ID actualizado
    });
  }

  const selectModelFileBtnPkl = document.getElementById('selectModelFileBtnPkl'); // ID actualizado
  if (selectModelFileBtnPkl) {
    selectModelFileBtnPkl.addEventListener('click', () => {
      document.getElementById('modelFileInputPkl').click(); // ID actualizado
    });
  }

  // --- Añadir listeners para los inputs de archivo ocultos ---
  const modelFileInputH5 = document.getElementById('modelFileInputH5');
  if(modelFileInputH5) {
      modelFileInputH5.addEventListener('change', (event) => {
          handleFileSelection(event.target, 'modelRouteH5Input');
      });
  }

  const modelFileInputPkl = document.getElementById('modelFileInputPkl');
  if(modelFileInputPkl) {
      modelFileInputPkl.addEventListener('change', (event) => {
          handleFileSelection(event.target, 'modelRoutePklInput');
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
  // Función helper para añadir listener de forma segura (remueve el anterior si existe)
  const safeAddSubmitListener = (formId, handlerFn) => {
    const form = document.getElementById(formId);
    if (form) {
        // Crear una nueva función para pasarla a removeEventListener
        const submitWrapper = (e) => { 
            e.preventDefault(); 
            handlerFn(); 
        };
        // Intentar remover cualquier listener previo (puede que no exista)
        // Nota: Para que removeEventListener funcione, necesita la misma referencia de función.
        // Esto es difícil sin guardar la referencia original. Una alternativa es clonar el nodo.
        // O, más simple para este caso, asumir que queremos uno solo y añadirlo.
        // Vamos a simplificar y confiar en que la lógica de navegación evita múltiples llamadas a init.
        
        // Limpiar listeners previos clonando el nodo (forma más segura)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Añadir el nuevo listener al nodo clonado
        newForm.addEventListener('submit', submitWrapper);
        console.log(`Listener submit añadido para ${formId}`);
    }
  };

  // Event Listeners para los formularios CRUD usando el helper
  safeAddSubmitListener('sensorForm', saveSensor);
  safeAddSubmitListener('modelForm', saveModel);
  safeAddSubmitListener('machineForm', saveMachine);
  safeAddSubmitListener('limitsForm', saveLimits);

  // Botones de reset
  document.getElementById('resetSensorBtn')?.addEventListener('click', () => resetForm('sensorForm'));
  document.getElementById('resetModelBtn')?.addEventListener('click', () => resetForm('modelForm'));
  document.getElementById('resetMachineBtn')?.addEventListener('click', () => resetForm('machineForm'));
  document.getElementById('resetLimitsBtn')?.addEventListener('click', () => resetForm('limitsForm'));
}

// Función para manejar la selección de archivos
function handleFileSelection(fileInput, targetInputId) {
  try {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      // Guardamos el nombre del archivo en el input correspondiente (visual)
      document.getElementById(targetInputId).value = file.name;

      // Guardamos el objeto File completo para usarlo al enviar
      if (!window.selectedFiles) {
        window.selectedFiles = {};
      }
      // Usar el ID del input de texto como clave para guardar el archivo
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
      // // *** DEBUG LOG ***
      // console.log('[loadConfiguration] Recibido config.system_config:', config.system_config);
      isConfigured = config.system_config.is_configured === 1;
      console.log(`[loadConfiguration] Estado global isConfigured actualizado a: ${isConfigured}`);
      // // *** FIN DEBUG LOG ***
    } else {
      isConfigured = false;
      console.warn("[loadConfiguration] Respuesta de /config inválida o incompleta. Asumiendo no configurado.");
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

  // // *** DEBUG LOG ***
  // console.log(`[updateConfigurationStatus] Verificando estado... isConfigured = ${isConfigured}`);
  // // *** FIN DEBUG LOG ***

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
      // Usar el valor booleano isConfigured global o el del objeto system_config si se pasa
      const isSystemConfigured = sysConfig ? sysConfig.is_configured === 1 : isConfigured;
      if (configStatusEl) configStatusEl.textContent = isSystemConfigured ? 'Configurado' : 'No configurado';
      
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
      // 'Content-Type': 'application/json', // REMOVED - Let browser set for FormData, default handled below
      'Accept': 'application/json'
    }
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  
  // Set default Content-Type ONLY if not FormData and not already set
  if (!(requestOptions.body instanceof FormData) && !requestOptions.headers['Content-Type']) {
      requestOptions.headers['Content-Type'] = 'application/json';
  }
  
  // *** IMPORTANTE: Si el body es FormData, eliminar Content-Type ***
  // El navegador lo establecerá automáticamente con el boundary correcto.
  if (requestOptions.body instanceof FormData) {
    delete requestOptions.headers['Content-Type']; // Ensure Content-Type is deleted for FormData
  }
  
  try {
    console.log(`Realizando petición a ${url}`);
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      let errorMessage = response.statusText; // Default error message
      
      // Intentar extraer mensaje de error del cuerpo de la respuesta
      try {
        const errorData = await response.json();
        if (errorData.message) { // Prefer 'message' if present
          errorMessage = errorData.message;
        } else if (errorData.detail) { // Handle FastAPI 'detail'
          if (Array.isArray(errorData.detail)) {
            // Format validation errors nicely
            errorMessage = errorData.detail
              .map(err => `Campo '${err.loc[err.loc.length - 1]}': ${err.msg}`) // Extract field name and message
              .join('; ');
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          }
          // Add other potential structures if needed
        }
        // If no specific message found, keep the default status text
      } catch (e) {
        // Non-JSON error body, keep default status text
        console.log("Could not parse error response body as JSON.");
      }
      // Add the HTTP status to the error message for clarity
      errorMessage = `Error ${response.status}: ${errorMessage || response.statusText}`;
      
      throw new Error(errorMessage); // Throw the potentially improved message
    }
    
    // Para operaciones que no devuelven JSON (como DELETE con 204 No Content)
    if (response.status === 204) {
      return { success: true }; // Return a success indicator
    }
    
    // Intentar parsear como JSON solo si hay contenido
    if (response.headers.get("content-length") === "0") {
        return { success: true }; // O considera devolver null/undefined si es apropiado
    }

    const data = await response.json();
    console.log(`Respuesta exitosa de ${url}`);
    return data;
  } catch (error) {
    // Log the error caught here, which might be from fetch() itself or the throw above
    console.error(`Error en petición a ${url}:`, error.message); 
    // Re-throw the error so the calling function's catch block can handle it
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
    // checkConfiguration();
    
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
    
    // *** POBLAR TABLA DE DATOS ***
    populateVibrationDataTable(globalState.vibrationData);
    
    // *** NOTIFICACIÓN DE ALERTA CRÍTICA ***
    if (status.length > 0) {
        const lastSeverity = status[status.length - 1]; // Obtener la severidad del último dato
        // Considerar 2 y 3 como críticos para la notificación
        if (lastSeverity >= 2) { 
            // Evitar spam de notificaciones: podríamos añadir lógica para mostrar solo una vez cada X tiempo
            showToast(`¡Alerta Crítica Detectada! Severidad: ${lastSeverity}`, 'error', 10000); // Duración más larga
        }
    }
    // *** FIN NOTIFICACIÓN ***

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
      case 3: // Asegurarse de contar el nivel 3 si existe
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

// *** NUEVA FUNCIÓN PARA POBLAR LA TABLA DE DATOS ***
function populateVibrationDataTable(data) {
  const tableBody = document.getElementById('vibrationDataTableBody');
  if (!tableBody) {
      console.warn("Elemento tbody 'vibrationDataTableBody' no encontrado.");
      return;
  }

  tableBody.innerHTML = ''; // Limpiar tabla antes de poblar

  if (!data || !data.timestamps || data.timestamps.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos disponibles para este sensor.</td></tr>';
      return;
  }

  // Mostrar los datos más recientes primero (invertir el array para iterar)
  const reversedData = {
    timestamps: [...data.timestamps].reverse(),
    x: [...data.x].reverse(),
    y: [...data.y].reverse(),
    z: [...data.z].reverse(),
    status: [...data.status].reverse()
  };

  for (let i = 0; i < reversedData.timestamps.length; i++) {
    const row = tableBody.insertRow();
    const timestamp = new Date(reversedData.timestamps[i]);
    const severity = reversedData.status[i];
    
    // Determinar clase CSS para la severidad
    let severityClass = 'severity-normal'; // Clase por defecto
    let severityText = 'Normal (0)';
    if (severity === 1) {
      severityClass = 'severity-warning';
      severityText = 'Leve (1)';
    } else if (severity === 2) {
      severityClass = 'severity-critical';
      severityText = 'Grave (2)';
    } else if (severity >= 3) { // Considerar 3 o más como crítico
      severityClass = 'severity-critical';
      severityText = 'Crítico (3+)';
    }

    row.innerHTML = `
      <td>${timestamp.toLocaleString()}</td>
      <td>${reversedData.x[i]?.toFixed(4) ?? '-'}</td>
      <td>${reversedData.y[i]?.toFixed(4) ?? '-'}</td>
      <td>${reversedData.z[i]?.toFixed(4) ?? '-'}</td>
      <td class="${severityClass}">${severityText}</td>
    `;
  }
}
// *** FIN NUEVA FUNCIÓN ***

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
    // Este listener es redundante, ya se añade en initConfigFields
    // limitsForm.addEventListener('submit', (e) => { e.preventDefault(); saveLimits(); }); 
  }
  const resetLimitsBtn = document.getElementById('resetLimitsBtn');
  if (resetLimitsBtn) {
    resetLimitsBtn.addEventListener('click', resetLimitsForm);
  }

  // MODELO
  const modelForm = document.getElementById('modelForm');
  if (modelForm) {
    // Corregir el handler: llamar a saveModel y prevenir default
    // El listener principal se añade en initCrudForms. Comentamos el duplicado aquí:
    // modelForm.addEventListener('submit', function(e) {
    //   e.preventDefault(); // Prevenir envío estándar del formulario
    //   saveModel();        // Llamar a la función correcta
    // });
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
    // El listener principal se añade en initCrudForms. Comentamos el duplicado aquí:
    // sensorForm.addEventListener('submit', (e) => { e.preventDefault(); saveSensor(); });
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
    // El listener principal se añade en initCrudForms. Comentamos el duplicado aquí:
    // machineForm.addEventListener('submit', (e) => { e.preventDefault(); saveMachine(); });
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
  const endpoint = '/models'; // Usar la nueva ruta
  console.log("Cargando modelos desde", endpoint);
  try {
    const models = await fetchAPI(endpoint);
    const tableBody = document.getElementById('modelsTableBody');
    const modelSelect = document.getElementById('sensorModelIdInput'); // *** OBTENER REFERENCIA AL SELECT ***

    if (!tableBody) return;
    tableBody.innerHTML = ''; // Limpiar tabla

    if (models && models.length > 0) {
      models.forEach(model => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${model.model_id}</td>
          <td>${model.name || '-'}</td>
          <td title="${model.description || ''}">${truncateText(model.description || '-', 30)}</td>
          <td title="${model.route_h5 || ''}">${truncateText(model.route_h5 || '-', 20)}</td>
          <td title="${model.route_pkl || ''}">${truncateText(model.route_pkl || '-', 20)}</td>
          <td class="action-buttons">
            <button class="btn btn-sm btn-outline-primary" onclick="editModel(${model.model_id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteModel(${model.model_id})"><i class="fas fa-trash"></i></button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay modelos configurados</td></tr>';
    }

    // --- *** POBLAR EL DROPDOWN DE MODELOS PARA SENSORES *** ---
    if (modelSelect) {
        // Guardar valor seleccionado actualmente (por si se está editando)
        const currentSelectedValue = modelSelect.value;
        
        // Limpiar opciones existentes (excepto la primera "Seleccione...")
        while (modelSelect.options.length > 1) {
            modelSelect.remove(1);
        }
        
        // Añadir nuevas opciones desde la lista de modelos
        if (models && models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.model_id;
                // Usar un texto descriptivo para la opción
                option.textContent = `${model.name || 'Modelo sin nombre'} (ID: ${model.model_id})`; 
                modelSelect.appendChild(option);
            });
        }
        
        // Intentar restaurar la selección anterior si aún es válida
        if (currentSelectedValue && modelSelect.querySelector(`option[value="${currentSelectedValue}"]`)) {
            modelSelect.value = currentSelectedValue;
        } else {
             // Si no hay selección previa o ya no es válida, asegurar que esté en "Seleccione..."
             modelSelect.selectedIndex = 0; 
        }
        modelSelect.disabled = !(models && models.length > 0); // Deshabilitar si no hay modelos
    } else {
        console.warn("Elemento select 'sensorModelIdInput' no encontrado.");
    }
    // --- *** FIN POBLAR DROPDOWN *** ---

  } catch (error) {
    console.error('Error cargando modelos:', error);
    showToast('Error al cargar los modelos. Verifique la conexión.', 'error');
    const tableBody = document.getElementById('modelsTableBody');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error al cargar modelos</td></tr>';
    
    // Deshabilitar dropdown si falla la carga
    const modelSelect = document.getElementById('sensorModelIdInput'); 
    if(modelSelect) {
        while (modelSelect.options.length > 1) { modelSelect.remove(1); }
        modelSelect.disabled = true;
    }
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
  console.log("Cargando límites desde /limits/latest...");
  const endpoint = '/limits/latest'; // Endpoint GET
  try {
    const limitsData = await fetchAPI(endpoint);
    if (limitsData && limitsData.limit_config_id !== undefined) {
      console.log("Límites recibidos:", limitsData);
      // Actualizar estado global (si aún se usa)
      globalState.limits = {
        x: {
          warning: { min: limitsData.x_2inf, max: limitsData.x_2sup },
          critical: { min: limitsData.x_3inf, max: limitsData.x_3sup }
        },
        y: {
          warning: { min: limitsData.y_2inf, max: limitsData.y_2sup },
          critical: { min: limitsData.y_3inf, max: limitsData.y_3sup }
        },
        z: {
          warning: { min: limitsData.z_2inf, max: limitsData.z_2sup },
          critical: { min: limitsData.z_3inf, max: limitsData.z_3sup }
        }
      };
      populateLimitsForm(limitsData); // Rellenar el formulario
      populateLimitsTable(limitsData); // Rellenar la tabla
      // Actualizar timestamp
      const lastUpdateSpan = document.getElementById('limitsLastUpdate');
      if (lastUpdateSpan) {
          lastUpdateSpan.textContent = limitsData.update_limits ? formatDate(new Date(limitsData.update_limits)) : '-';
      }
    } else {
      console.warn("No se encontraron datos de límites válidos. Usando valores por defecto en formulario.");
      // Si no hay datos en BD, llenar formulario con defaults del estado global inicial
      populateLimitsForm(globalState.limits); 
       const tableBody = document.getElementById('limitsTableBody');
      if(tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No se encontraron límites configurados.</td></tr>';
       const lastUpdateSpan = document.getElementById('limitsLastUpdate');
      if (lastUpdateSpan) lastUpdateSpan.textContent = '-';
    }
  } catch (error) {
    console.error('Error al cargar los límites:', error);
    showToast('Error al cargar la configuración de límites.', 'error');
     const tableBody = document.getElementById('limitsTableBody');
     if(tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar límites.</td></tr>';
     const lastUpdateSpan = document.getElementById('limitsLastUpdate');
     if (lastUpdateSpan) lastUpdateSpan.textContent = 'Error';
  }
}

// Rellena el formulario con los datos de límites
function populateLimitsForm(limits) {
  document.getElementById('x2infInput').value = limits.x_2inf ?? '';
  document.getElementById('x2supInput').value = limits.x_2sup ?? '';
  document.getElementById('x3infInput').value = limits.x_3inf ?? '';
  document.getElementById('x3supInput').value = limits.x_3sup ?? '';
  document.getElementById('y2infInput').value = limits.y_2inf ?? '';
  document.getElementById('y2supInput').value = limits.y_2sup ?? '';
  document.getElementById('y3infInput').value = limits.y_3inf ?? '';
  document.getElementById('y3supInput').value = limits.y_3sup ?? '';
  document.getElementById('z2infInput').value = limits.z_2inf ?? '';
  document.getElementById('z2supInput').value = limits.z_2sup ?? '';
  document.getElementById('z3infInput').value = limits.z_3inf ?? '';
  document.getElementById('z3supInput').value = limits.z_3sup ?? '';
}

// Rellena la tabla con los datos de límites
function populateLimitsTable(limits) {
    const tableBody = document.getElementById('limitsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = ''; // Limpiar tabla

    const createRow = (axis, level, levelClass, inf, sup) => {
        const row = document.createElement('tr');
        row.classList.add(levelClass);
        row.innerHTML = `
            <td class="axis-${axis.toLowerCase()}">${axis}</td>
            <td>${level} (±${level === 'Warning' ? 2 : 3}σ)</td>
            <td>${inf ?? '-'}</td>
            <td>${sup ?? '-'}</td>
        `;
        return row;
    };

    // Eje X
    tableBody.appendChild(createRow('X', 'Warning', 'level-warning', limits.x_2inf, limits.x_2sup));
    tableBody.appendChild(createRow('X', 'Critical', 'level-critical', limits.x_3inf, limits.x_3sup));
    // Eje Y
    tableBody.appendChild(createRow('Y', 'Warning', 'level-warning', limits.y_2inf, limits.y_2sup));
    tableBody.appendChild(createRow('Y', 'Critical', 'level-critical', limits.y_3inf, limits.y_3sup));
    // Eje Z
    tableBody.appendChild(createRow('Z', 'Warning', 'level-warning', limits.z_2inf, limits.z_2sup));
    tableBody.appendChild(createRow('Z', 'Critical', 'level-critical', limits.z_3inf, limits.z_3sup));
}

// Guarda los límites
async function saveLimits() {
  console.log("Intentando guardar límites...");
  const form = document.getElementById('limitsForm');
  if (!form.checkValidity()) {
      form.reportValidity();
      showToast('Por favor, complete todos los campos de límites.', 'warning');
      return;
  }

  // Recoger datos del formulario
  const limitsData = {
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

  // Validación simple: inf < sup
  for (const axis of ['x', 'y', 'z']) {
      // Usar ?? 0 para manejar campos vacíos como cero en la comparación
      const inf2 = limitsData[`${axis}_2inf`] ?? 0;
      const sup2 = limitsData[`${axis}_2sup`] ?? 0;
      const inf3 = limitsData[`${axis}_3inf`] ?? 0;
      const sup3 = limitsData[`${axis}_3sup`] ?? 0;

      if (inf2 >= sup2) {
          showToast(`Error en Eje ${axis.toUpperCase()}: Límite inferior (Warning) debe ser menor que el superior.`, 'error');
          return;
      }
      if (inf3 >= sup3) {
          showToast(`Error en Eje ${axis.toUpperCase()}: Límite inferior (Critical) debe ser menor que el superior.`, 'error');
          return;
      }
      // Opcional: Validar que critical esté fuera de warning
      // if (inf3 > inf2 || sup3 < sup2) { ... }
  }

  const endpoint = '/limits/1'; // Endpoint PUT
  console.log("Enviando límites a", endpoint, limitsData);

  const saveButton = document.getElementById('saveLimitsBtn');
  const originalHtml = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  saveButton.disabled = true;

  try {
    const updatedLimits = await fetchAPI(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limitsData)
    });

    if (updatedLimits && updatedLimits.limit_config_id !== undefined) {
      showToast('Límites actualizados correctamente', 'success');
      // Actualizar estado global y UI (formulario y tabla)
      loadLimits();
      // *** RECARGAR CONFIGURACIÓN Y ACTUALIZAR ESTADO GENERAL ***
      await loadConfiguration();
      updateConfigurationStatus();
      // *** FIN RECARGA ***
    } else {
      // fetchAPI maneja errores y muestra toast si la respuesta no es JSON válido o hay error HTTP
      console.error('Error al guardar límites, respuesta inválida o error HTTP:', updatedLimits);
      // No mostrar doble toast si fetchAPI ya lo hizo
    }
  } catch (error) {
    // Errores inesperados no capturados por fetchAPI (ej. error de red)
    console.error('Error inesperado al guardar límites:', error);
    showToast(`Error inesperado al guardar límites: ${error.message}`, 'error');
  } finally {
    saveButton.innerHTML = originalHtml;
    saveButton.disabled = false;
  }
}

// Resetea el formulario de límites
function resetLimitsForm() {
    console.log("Reseteando formulario de límites...");
    const form = document.getElementById('limitsForm');
    if (form) {
        form.reset();
        // Volver a cargar los valores actuales desde el estado global o API
        loadLimits();
    }
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
  console.log("Intentando guardar modelo (con archivos)...");
  const form = document.getElementById('modelForm');
  if (!form) return;

  // Validar campos de texto requeridos
  if (!form.checkValidity()) {
    form.reportValidity();
    showToast('Por favor, complete Nombre y Descripción.', 'warning');
    return;
  }

  const modelId = document.getElementById('modelIdInput').value;
  const name = document.getElementById('modelNameInput').value;
  const description = document.getElementById('modelDescriptionInput').value;
  const isUpdating = !!modelId;

  // --- Crear FormData --- 
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);

  // --- Obtener y añadir archivos desde el almacenamiento global --- 
  const fileH5 = window.selectedFiles ? window.selectedFiles['modelRouteH5Input'] : null;
  const filePkl = window.selectedFiles ? window.selectedFiles['modelRoutePklInput'] : null;

  // --- Validación y adición de archivos --- 
  if (!isUpdating) {
    // Al CREAR, los archivos son obligatorios
    if (!fileH5) {
        showToast('El archivo del modelo (.h5) es obligatorio al crear.', 'error');
        return;
    }
    if (!filePkl) {
        showToast('El archivo del escalador (.pkl) es obligatorio al crear.', 'error');
        return;
    }
    formData.append('file_h5', fileH5);
    formData.append('file_pkl', filePkl);
  } else {
    // Al ACTUALIZAR, los archivos son opcionales
    if (fileH5) {
        formData.append('file_h5', fileH5);
        console.log("Añadiendo archivo H5 actualizado a FormData.");
    }
    if (filePkl) {
        formData.append('file_pkl', filePkl);
        console.log("Añadiendo archivo PKL actualizado a FormData.");
    }
    // Si no se seleccionan nuevos archivos al actualizar,
    // el backend debe manejar la lógica para mantener los existentes si es necesario.
    // Aquí solo enviamos los nuevos si se seleccionaron.
  }
  
  // --- NO limpiar selección visual/global aquí ---
  
  // --- Configurar endpoint y método --- 
  const method = isUpdating ? 'PUT' : 'POST';
  const endpoint = isUpdating ? `/models/${modelId}` : '/models';

  console.log(`Enviando modelo ${isUpdating ? 'actualizado' : 'nuevo'} a ${endpoint}`);
  
  const saveButton = document.getElementById('saveModelBtn');
  const originalHtml = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  saveButton.disabled = true;

  try {
    const result = await fetchAPI(endpoint, {
      method: method,
      body: formData
      // NO HEADERS HERE for FormData
    });

    if (result && result.model_id) {
      showToast(`Modelo ${isUpdating ? 'actualizado' : 'creado'} correctamente`, 'success');

      // --- Moved file clearing here (AFTER successful save) ---
      const routeH5Input = document.getElementById('modelRouteH5Input');
      const routePklInput = document.getElementById('modelRoutePklInput');
      const fileInputH5 = document.getElementById('modelFileInputH5');
      const fileInputPkl = document.getElementById('modelFileInputPkl');
      
      if (routeH5Input) routeH5Input.value = ''; // Limpiar texto visible
      if (routePklInput) routePklInput.value = ''; // Limpiar texto visible
      if (fileInputH5) fileInputH5.value = null; // Resetear input file
      if (fileInputPkl) fileInputPkl.value = null; // Resetear input file
      
      if (window.selectedFiles) {
        delete window.selectedFiles['modelRouteH5Input'];
        delete window.selectedFiles['modelRoutePklInput'];
        console.log("Archivos seleccionados limpiados después del éxito.");
      }
      // --- End of moved block ---

      resetModelForm(); // Limpia el resto del formulario y el ID
      loadModels(); // Recarga la tabla de modelos
      // *** RECARGAR CONFIGURACIÓN Y ACTUALIZAR ESTADO GENERAL ***
      await loadConfiguration(); 
      updateConfigurationStatus();
      // *** FIN RECARGA ***
    } else {
      // Handle cases where API returns OK status but not the expected data structure
      console.error('Respuesta inesperada o error al guardar modelo (pero status OK):', result);
      // The improved fetchAPI error handling should prevent reaching here often on actual errors
      showToast('Error al guardar el modelo: Respuesta inesperada del servidor.', 'error');
    }
  } catch (error) {
    // Error handling: fetchAPI now throws a potentially formatted error message
    console.error(`Error durante la operación de guardar modelo:`, error);
    // Show the error message thrown by fetchAPI (should be more informative now)
    showToast(`Error al guardar: ${error.message}`, 'error'); 
  } finally {
      saveButton.innerHTML = originalHtml;
      saveButton.disabled = false;
  }
}

// Elimina un modelo
async function deleteModel(modelId) {
  console.log(`Intentando eliminar modelo ID: ${modelId}`);
  if (!confirm(`¿Está seguro de que desea eliminar el modelo con ID ${modelId}?`)) {
    return;
  }

  const endpoint = `/models/${modelId}`;

  try {
    const result = await fetchAPI(endpoint, { method: 'DELETE' });

    // DELETE exitoso no devuelve cuerpo, fetchAPI puede devolver null o response
    // Verificar status o si fetchAPI ya manejó el error
    if (result !== false) { // fetchAPI devuelve false si hubo error y mostró toast
        showToast(`Modelo ${modelId} eliminado correctamente`, 'success');
        loadModels(); // Actualizar la tabla
    } else {
        // Si fetchAPI devolvió false, ya mostró un toast de error
        console.log("fetchAPI indicó un error al eliminar el modelo.")
    }
  } catch (error) {
      // Error inesperado no capturado por fetchAPI
      console.error(`Error inesperado al eliminar modelo ${modelId}:`, error);
      showToast(`Error inesperado al eliminar modelo ${modelId}`, 'error');
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
      // *** RECARGAR CONFIGURACIÓN Y ACTUALIZAR ESTADO GENERAL ***
      await loadConfiguration();
      updateConfigurationStatus();
      // *** FIN RECARGA ***
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
      // *** RECARGAR CONFIGURACIÓN Y ACTUALIZAR ESTADO GENERAL ***
      // // *** DEBUG LOG ***
      // console.log('[saveMachine] Llamando a loadConfiguration y updateConfigurationStatus');
      // // *** FIN DEBUG LOG ***
      await loadConfiguration();
      updateConfigurationStatus();
      // *** FIN RECARGA ***
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
