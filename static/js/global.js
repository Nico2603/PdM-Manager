/**
 * PdM-Manager - JavaScript Global Unificado v1.0.0
 * Archivo optimizado que contiene todas las funcionalidades JavaScript del sistema
 * organizadas por secciones para evitar redundancias.
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// VARIABLES GLOBALES
// ==========================================================================

// Gráficos
let vibrationChartX = null;
let vibrationChartY = null;
let vibrationChartZ = null;
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

// Selecciones actuales
let selectedMachine = '';
let selectedSensor = '';
let timeRange = '24h';

// Estado de simulación
let simulationRunning = false;
let simulationTimer = null;

// Opciones de visualización
let showMean = true;     // Mostrar línea de media
let showSigmaLines = true; // Mostrar líneas de límites sigma

// Colores para severidades
const SEVERITY_COLORS = {
    0: '#10b981', // Normal - Verde
    1: '#f59e0b', // Nivel 1 - Amarillo
    2: '#f97316', // Nivel 2 - Naranja
    3: '#ef4444'  // Nivel 3 - Rojo
};

// Cache para evitar consultas repetidas
const cache = {
    machines: [],
    sensors: {},
    lastUpdate: null
};

// ===================================================
// GESTIÓN DE MÁQUINAS
// ===================================================

// Inicialización de la gestión de máquinas
function initMachineManagement() {
  // Cargar lista de máquinas
  loadMachinesTable();
  
  // Cargar selectores para el modal
  loadSensorsForSelect();
  loadModelsForSelect();
  
  // Configurar evento para añadir nueva máquina
  const addMachineBtn = document.getElementById('addMachineBtn');
  if (addMachineBtn) {
    addMachineBtn.addEventListener('click', () => {
      // Limpiar el formulario
      document.getElementById('machineForm').reset();
      document.getElementById('machineId').value = '';
      document.getElementById('machineModalTitle').textContent = 'Nueva Máquina';
      
      // Mostrar el modal
      const modal = document.getElementById('machineModal');
      modal.classList.add('show');
    });
  }
  
  // Configurar evento para guardar máquina
  const saveMachineBtn = document.getElementById('saveMachineBtn');
  if (saveMachineBtn) {
    saveMachineBtn.addEventListener('click', saveMachine);
  }
  
  // Configurar eventos para cerrar modales
  const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) modal.classList.remove('show');
    });
  });
}

// Cargar tabla de máquinas
function loadMachinesTable() {
  fetch('/api/machines')
    .then(response => response.json())
    .then(machines => {
      const tableBody = document.getElementById('machinesTableBody');
      if (!tableBody) return;
      
      tableBody.innerHTML = '';
      
      if (machines.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center">No hay máquinas registradas</td>
          </tr>
        `;
        return;
      }
      
      machines.forEach(machine => {
        const row = document.createElement('tr');
        
        // Obtener nombres de sensor y modelo del resultado del backend
        const sensorName = machine.sensor_name || 'No asignado';
        const modelName = machine.model_name || 'No asignado';
        
        row.innerHTML = `
          <td>${machine.machine_id}</td>
          <td>${machine.name}</td>
          <td>${machine.description || '-'}</td>
          <td>${sensorName}</td>
          <td>${modelName}</td>
          <td class="actions-cell">
            <button class="btn-icon btn-edit" data-id="${machine.machine_id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon btn-delete" data-id="${machine.machine_id}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        
        tableBody.appendChild(row);
      });
      
      // Configurar eventos para editar y eliminar
      const editButtons = tableBody.querySelectorAll('.btn-edit');
      editButtons.forEach(button => {
        button.addEventListener('click', () => {
          const machineId = button.getAttribute('data-id');
          editMachine(machineId);
        });
      });
      
      const deleteButtons = tableBody.querySelectorAll('.btn-delete');
      deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
          const machineId = button.getAttribute('data-id');
          deleteMachine(machineId);
        });
      });
    })
    .catch(error => {
      console.error('Error al cargar máquinas:', error);
      showToast('Error al cargar la lista de máquinas', 'error');
    });
}

// Cargar sensores para el selector
function loadSensorsForSelect() {
  fetch('/api/sensors')
    .then(response => response.json())
    .then(sensors => {
      const sensorSelect = document.getElementById('machineSensor');
      if (!sensorSelect) return;
      
      // Mantener la opción "Ninguno"
      sensorSelect.innerHTML = '<option value="">Ninguno</option>';
      
      sensors.forEach(sensor => {
        const option = document.createElement('option');
        option.value = sensor.sensor_id;
        option.textContent = sensor.name;
        sensorSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error al cargar sensores:', error);
    });
}

// Cargar modelos para el selector
function loadModelsForSelect() {
  fetch('/api/models')
    .then(response => response.json())
    .then(models => {
      const modelSelect = document.getElementById('machineModel');
      if (!modelSelect) return;
      
      // Mantener la opción "Ninguno"
      modelSelect.innerHTML = '<option value="">Ninguno</option>';
      
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.model_id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error al cargar modelos:', error);
    });
}

// Editar máquina
function editMachine(machineId) {
  fetch(`/api/machines/${machineId}`)
    .then(response => response.json())
    .then(machine => {
      // Llenar el formulario con los datos de la máquina
      document.getElementById('machineId').value = machine.machine_id;
      document.getElementById('machineName').value = machine.name || '';
      document.getElementById('machineDescription').value = machine.description || '';
      document.getElementById('machineRoute').value = machine.route || '';
      
      const sensorSelect = document.getElementById('machineSensor');
      if (sensorSelect) {
        sensorSelect.value = machine.sensor_id || '';
      }
      
      const modelSelect = document.getElementById('machineModel');
      if (modelSelect) {
        modelSelect.value = machine.model_id || '';
      }
      
      // Actualizar título del modal
      document.getElementById('machineModalTitle').textContent = 'Editar Máquina';
      
      // Mostrar el modal
      const modal = document.getElementById('machineModal');
      modal.classList.add('show');
    })
    .catch(error => {
      console.error('Error al cargar datos de la máquina:', error);
      showToast('Error al cargar los datos de la máquina', 'error');
    });
}

// Guardar máquina (crear o actualizar)
function saveMachine() {
  const machineId = document.getElementById('machineId').value;
  const form = document.getElementById('machineForm');
  
  // Validar el formulario
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  // Preparar datos del formulario
  const formData = new FormData(form);
  
  // Convertir FormData a objeto para enviar como JSON
  const machineData = {};
  formData.forEach((value, key) => {
    // Convertir valores vacíos a null para campos opcionales
    if (key === 'sensor_id' || key === 'model_id') {
      machineData[key] = value ? parseInt(value) : null;
    } else {
      machineData[key] = value || null;
    }
  });
  
  // Determinar si es una creación o actualización
  const isUpdate = !!machineId;
  const url = isUpdate ? `/api/machines/${machineId}` : '/api/machines';
  const method = isUpdate ? 'PUT' : 'POST';
  
  // Enviar solicitud
  fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(machineData)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al guardar la máquina');
      }
      return response.json();
    })
    .then(() => {
      // Cerrar modal
      const modal = document.getElementById('machineModal');
      modal.classList.remove('show');
      
      // Recargar lista de máquinas
      loadMachinesTable();
      
      // Mostrar mensaje de éxito
      const message = isUpdate ? 'Máquina actualizada correctamente' : 'Máquina creada correctamente';
      showToast(message, 'success');
    })
    .catch(error => {
      console.error('Error al guardar máquina:', error);
      showToast('Error al guardar la máquina', 'error');
    });
}

// Eliminar máquina
function deleteMachine(machineId) {
  // Confirmar eliminación
  if (!confirm('¿Está seguro de que desea eliminar esta máquina?')) {
    return;
  }
  
  fetch(`/api/machines/${machineId}`, {
    method: 'DELETE'
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al eliminar la máquina');
      }
      return response.json();
    })
    .then(() => {
      // Recargar lista de máquinas
      loadMachinesTable();
      
      // Mostrar mensaje de éxito
      showToast('Máquina eliminada correctamente', 'success');
    })
    .catch(error => {
      console.error('Error al eliminar máquina:', error);
      showToast('Error al eliminar la máquina', 'error');
    });
}

// Añadir initMachineManagement a la función de inicialización
document.addEventListener('DOMContentLoaded', function() {
  // Otras inicializaciones
  // ... existing code ...
  
  // Inicializar gestión de máquinas
  initMachineManagement();
});

// ==========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar la interfaz de usuario
    initUI();
    
    // Inicializar la navegación
    initNavigation();
    
    // Inicializar el dashboard por defecto
    initDashboard();
    
    // Inicializar la gestión de máquinas
    initMachineManagement();
    
    // Inicializar eventos para el botón de actualizar datos
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', function() {
            showToast('info', 'Actualizando datos...');
            updateDashboardData();
        });
    }
    
    // Manejar el cambio de hash en la URL para la navegación
    window.addEventListener('hashchange', function() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            navigateTo(hash);
        }
    });
    
    console.log('Aplicación PdM-Manager inicializada');
});

/**
 * Inicializa el menú lateral
 */
function initSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    if (!sidebarToggle || !sidebar || !content) return;
    
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        content.classList.toggle('expanded');
        
        // Guardar preferencia del usuario
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    
    // Cargar preferencia del usuario
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
        content.classList.add('expanded');
    }
}

/**
 * Inicializa la navegación entre páginas
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Establecer la sección activa basada en la URL
    const currentPage = getCurrentPage();
    
    // Ajustar la navegación basada en la página actual
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        
        if (linkPage === currentPage) {
            link.classList.add('active');
            // Activar la sección correspondiente
            showSection(currentPage);
        }
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });
}

/**
 * Navega a una sección específica
 */
function navigateTo(page) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(page + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Actualizar URL sin recargar la página
        window.history.pushState({page: page}, page, page === 'dashboard' ? '/' : '/' + page);
        
        // Actualizar enlace activo
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            
            if (link.getAttribute('data-page') === page) {
                link.classList.add('active');
            }
        });
        
        // Actualizar breadcrumb
        const currentSectionElement = document.getElementById('currentSection');
        if (currentSectionElement) {
            // Convertir primera letra a mayúscula
            const pageName = page.charAt(0).toUpperCase() + page.slice(1);
            currentSectionElement.textContent = pageName;
        }
        
        // Reinicializar componentes específicos según la página
        initPageSpecificComponents();
    }
}

/**
 * Muestra una sección específica
 */
function showSection(sectionId) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(sectionId + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

/**
 * Inicializa el tema oscuro
 */
function initDarkTheme() {
    // El tema oscuro está aplicado por defecto con las variables CSS
    // En caso de querer un toggle en el futuro, se implementaría aquí
}

/**
 * Obtiene la página actual basada en la URL o un elemento activo
 */
function getCurrentPage() {
    // Intentar obtener la página desde la URL
    const path = window.location.pathname;
    const hash = window.location.hash.substring(1); // Eliminar el # del inicio
    
    if (hash) {
        return hash;
    }
    
    if (path === '/' || path === '/index.html') {
        return 'dashboard';
    }
    
    // Extraer nombre de la página desde el path
    const pathSegments = path.split('/').filter(segment => segment);
    if (pathSegments.length > 0) {
        return pathSegments[0];
    }
    
    // Verificar la navegación activa como respaldo
    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
        const page = activeLink.getAttribute('data-page');
        if (page) {
            return page;
        }
    }
    
    // Por defecto, mostrar dashboard
    return 'dashboard';
}

/**
 * Inicializa componentes específicos según la página actual
 */
function initPageSpecificComponents() {
    const currentPage = getCurrentPage();
    
    if (currentPage === 'dashboard') {
        initDashboard();
        initCustomUIComponents();
        updateDashboardData();
    } 
    else if (currentPage === 'configuracion') {
        initConfig();
    }
}

// ==========================================================================
// UTILIDADES DE UI
// ==========================================================================

/**
 * Muestra un mensaje de notificación
 * @param {string} type - Tipo de mensaje: 'success', 'warning', 'danger', 'info'
 * @param {string} message - Mensaje a mostrar
 */
function showToast(type, message) {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icono según el tipo
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'danger') icon = 'exclamation-circle';
    
    // Contenido del toast
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">
            <p>${message}</p>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Añadir al container de toasts
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // Mostrar con animación
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Configurar cierre
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        closeToast(toast);
    });
    
    // Auto-cierre después de 5 segundos
    setTimeout(() => {
        closeToast(toast);
    }, 5000);
}

/**
 * Cierra un toast con animación
 */
function closeToast(toast) {
    toast.classList.remove('show');
    
    // Eliminar después de la animación
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

/**
 * Muestra el indicador de carga
 */
function showLoadingIndicator(message = 'Cargando...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingText) {
        loadingText.textContent = message;
    }
    
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
}

/**
 * Oculta el indicador de carga
 */
function hideLoadingIndicator() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}

/**
 * Muestra un toast de carga (para operaciones más largas)
 */
function showLoadingToast(message = 'Procesando...') {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = 'toast toast-loading';
    toast.id = 'loadingToast';
    
    // Contenido del toast
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-spinner fa-spin"></i>
        </div>
        <div class="toast-content">
            <p>${message}</p>
        </div>
    `;
    
    // Añadir al container de toasts
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Remover toast de carga anterior si existe
    const existingToast = document.getElementById('loadingToast');
    if (existingToast) {
        toastContainer.removeChild(existingToast);
    }
    
    toastContainer.appendChild(toast);
    
    // Mostrar con animación
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
}

/**
 * Oculta el toast de carga
 */
function hideLoadingToast() {
    const toast = document.getElementById('loadingToast');
    
    if (toast) {
        toast.classList.remove('show');
        
        // Eliminar después de la animación
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// ==========================================================================
// DASHBOARD
// ==========================================================================

/**
 * Inicializa el dashboard
 */
function initDashboard() {
    // Inicializar componentes de UI personalizados
    initCustomUIComponents();
    
    // Inicializar gráfico de vibración
    initVibrationChart();
    
    // Inicializar gráfico histórico de alertas
    initAlertsHistoryChart();
    
    // Inicializar botón de exportación
    initExportButton();
    
    // Inicializar botón de ajuste de límites
    initAdjustLimitsButton();
    
    // Inicializar botones de estadísticas
    initStatLimitsButtons();
    
    // Inicializar filtros de visualización
    initVisualFilters();
    
    // Cargar datos iniciales
    loadInitialData();
    
    // Verificar estado de simulación
    checkSimulationStatus();
    
    // Actualizar datos cada 10 segundos
    setInterval(updateDashboardData, 10000);
}

/**
 * Inicializa los componentes personalizados de la UI
 */
function initCustomUIComponents() {
    // Inicializar dropdowns personalizados
    initCustomDropdowns();
    
    // Inicializar panel de filtros colapsable
    initCollapseFilters();
    
    // Inicializar exportación a PDF
    initPDFExport();
}

/**
 * Inicializa los dropdowns personalizados
 */
function initCustomDropdowns() {
    // Obtener todos los dropdowns
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.filter-dropdown-toggle');
        const menu = dropdown.querySelector('.filter-dropdown-menu');
        const items = dropdown.querySelectorAll('.filter-dropdown-item');
        const selectedText = dropdown.querySelector('span');
        const dropdownId = dropdown.id;
        
        // Evento al hacer clic en el toggle
        toggle.addEventListener('click', () => {
            menu.classList.toggle('show');
            toggle.classList.toggle('active');
            
            // Cerrar otros dropdowns abiertos
            dropdowns.forEach(otherDropdown => {
                if (otherDropdown !== dropdown) {
                    const otherMenu = otherDropdown.querySelector('.filter-dropdown-menu');
                    const otherToggle = otherDropdown.querySelector('.filter-dropdown-toggle');
                    otherMenu.classList.remove('show');
                    otherToggle.classList.remove('active');
                }
            });
        });
        
        // Eventos al hacer clic en los items
        items.forEach(item => {
            item.addEventListener('click', () => {
                const value = item.getAttribute('data-value');
                const text = item.textContent;
                
                // Actualizar texto seleccionado
                selectedText.textContent = text;
                
                // Actualizar clases de item seleccionado
                items.forEach(otherItem => {
                    otherItem.classList.remove('selected');
                });
                item.classList.add('selected');
                
                // Cerrar dropdown
                menu.classList.remove('show');
                toggle.classList.remove('active');
                
                // Ejecutar acción correspondiente según el dropdown
                handleDropdownChange(dropdownId, value);
            });
        });
    });
    
    // Cerrar los dropdowns al hacer clic fuera
    document.addEventListener('click', (event) => {
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                const menu = dropdown.querySelector('.filter-dropdown-menu');
                const toggle = dropdown.querySelector('.filter-dropdown-toggle');
                menu.classList.remove('show');
                toggle.classList.remove('active');
            }
        });
    });
}

/**
 * Maneja el cambio en los dropdowns
 */
function handleDropdownChange(dropdownId, value) {
    switch (dropdownId) {
        case 'machineDropdown':
            // Actualizar máquina seleccionada
            selectedMachine = value;
            
            // Actualizar sensores disponibles
            loadSensors(value);
            
            // Actualizar datos del dashboard
            updateDashboardData();
            break;
        
        case 'sensorDropdown':
            // Actualizar sensor seleccionado
            selectedSensor = value;
            
            // Actualizar datos del dashboard
            updateDashboardData();
            break;
        
        case 'timeRangeDropdown':
            // Actualizar rango de tiempo seleccionado
            timeRange = value;
            
            // Actualizar datos del dashboard
            updateDashboardData();
            break;
    }
}

/**
 * Inicializa el panel de filtros colapsable
 */
function initCollapseFilters() {
    const expandBtn = document.getElementById('expandFiltersBtn');
    const filterPanel = document.querySelector('.filter-panel');
    
    if (!expandBtn || !filterPanel) return;
    
    expandBtn.addEventListener('click', () => {
        filterPanel.classList.toggle('collapsed');
        const icon = expandBtn.querySelector('i');
        
        if (filterPanel.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    });
}

/**
 * Inicializa los filtros de visualización
 */
function initVisualFilters() {
    // No necesitamos el checkbox de la media, solo los límites sigma
    document.getElementById('showMean').checked = false;
    document.getElementById('showMean').parentNode.style.display = 'none';
    
    document.getElementById('show1Sigma').addEventListener('change', function() {
        showSigmaLines = this.checked || document.getElementById('show2Sigma').checked || document.getElementById('show3Sigma').checked;
        updateChartsVisibility();
    });
    
    document.getElementById('show2Sigma').addEventListener('change', function() {
        showSigmaLines = this.checked || document.getElementById('show1Sigma').checked || document.getElementById('show3Sigma').checked;
        updateChartsVisibility();
    });
    
    document.getElementById('show3Sigma').addEventListener('change', function() {
        showSigmaLines = this.checked || document.getElementById('show1Sigma').checked || document.getElementById('show2Sigma').checked;
        updateChartsVisibility();
    });
    
    // Desactivar la opción de mostrar la media
    showMean = false;
    
    // Actualizar la visualización inicial
    updateChartsVisibility();
}

/**
 * Carga los datos iniciales para el dashboard
 */
function loadInitialData() {
    // Mostrar indicador de carga
    showLoadingToast('Verificando configuración...');
    
    // Verificar si existe configuración
    fetch('/api/machines')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar las máquinas');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Verificar si hay máquinas configuradas
            if (!data.machines || data.machines.length === 0) {
                // Mostrar mensaje al usuario
                showNoConfigurationMessage();
                return;
            }
            
            // Si hay configuración, cargar máquinas
            loadMachines();
        })
        .catch(error => {
            console.error('Error al cargar configuración inicial:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar la configuración: ' + error.message);
        });
}

/**
 * Muestra un mensaje indicando que no hay configuración
 */
function showNoConfigurationMessage() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        // Crear mensaje
        const noConfigMessage = document.createElement('div');
        noConfigMessage.className = 'no-config-message';
        noConfigMessage.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <h4 class="alert-heading"><i class="fas fa-exclamation-triangle"></i> Configuración no encontrada</h4>
                <p>No hay máquinas, sensores o modelos configurados en el sistema.</p>
                <hr>
                <p class="mb-0">Por favor, vaya a la sección de <a href="#configuracion" class="alert-link">Configuración</a> para configurar al menos una máquina, sensor y modelo antes de usar el Dashboard.</p>
            </div>
        `;
        
        // Insertar al principio del contenido principal
        mainContent.insertBefore(noConfigMessage, mainContent.firstChild);
        
        // Ocultar elementos del dashboard que requieren configuración
        const dashboardElements = document.querySelectorAll('.dashboard-card, .dashboard-chart');
        dashboardElements.forEach(element => {
            element.style.display = 'none';
        });
    }
}

/**
 * Carga las máquinas disponibles
 */
function loadMachines() {
    showLoadingToast('Cargando máquinas...');
    
    fetch('/api/machines')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar las máquinas');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            if (!data.machines || data.machines.length === 0) {
                showNoConfigurationMessage();
                return;
            }
            
            const machineDropdown = document.getElementById('machineDropdown');
            const menu = machineDropdown?.querySelector('.filter-dropdown-menu');
            
            if (!menu) return;
            
            // Limpiar menú
            menu.innerHTML = '';
            
            // Añadir máquinas
            data.machines.forEach(machine => {
                const item = document.createElement('div');
                item.className = 'filter-dropdown-item';
                item.setAttribute('data-value', machine.id);
                item.textContent = machine.name;
                
                if (machine.id === selectedMachine) {
                    item.classList.add('selected');
                    const selectedText = machineDropdown.querySelector('span');
                    if (selectedText) {
                        selectedText.textContent = machine.name;
                    }
                }
                
                menu.appendChild(item);
            });
            
            // Si no hay máquina seleccionada, seleccionar la primera
            if (!selectedMachine && data.machines.length > 0) {
                selectedMachine = data.machines[0].id;
                const selectedText = machineDropdown.querySelector('span');
                if (selectedText) {
                    selectedText.textContent = data.machines[0].name;
                }
                
                // Cargar sensores para la máquina seleccionada
                loadSensors(selectedMachine);
            }
            
            // Reinicializar eventos
            initCustomDropdowns();
            
            // Una vez que tenemos máquinas y sensores, actualizar dashboard
            if (selectedMachine && selectedSensor) {
                updateDashboardData();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar las máquinas: ' + error.message);
        });
}

/**
 * Carga los sensores disponibles para una máquina
 */
function loadSensors(machineId) {
    showLoadingToast('Cargando sensores...');
    
    fetch(`/api/machine/${machineId}/sensors`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar los sensores');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            const sensorDropdown = document.getElementById('sensorDropdown');
            const menu = sensorDropdown?.querySelector('.filter-dropdown-menu');
            
            if (!menu) return;
            
            // Limpiar menú
            menu.innerHTML = '';
            
            // Verificar si hay sensores disponibles
            if (!data.sensors || data.sensors.length === 0) {
                const noSensorsItem = document.createElement('div');
                noSensorsItem.className = 'filter-dropdown-item disabled';
                noSensorsItem.textContent = 'No hay sensores configurados';
                menu.appendChild(noSensorsItem);
                
                // Restablecer selección de sensor
                selectedSensor = null;
                const selectedText = sensorDropdown.querySelector('span');
                if (selectedText) {
                    selectedText.textContent = 'Sin sensores';
                }
                
                // Mostrar mensaje al usuario
                showToast('warning', 'La máquina seleccionada no tiene sensores configurados. Configure sensores en la sección de Configuración.');
                return;
            }
            
            // Añadir sensores al menú
            data.sensors.forEach(sensor => {
                const item = document.createElement('div');
                item.className = 'filter-dropdown-item';
                item.setAttribute('data-value', sensor.id);
                item.textContent = sensor.name;
                
                if (sensor.id === selectedSensor) {
                    item.classList.add('selected');
                    const selectedText = sensorDropdown.querySelector('span');
                    if (selectedText) {
                        selectedText.textContent = sensor.name;
                    }
                }
                
                menu.appendChild(item);
            });
            
            // Si no hay sensor seleccionado o el sensor seleccionado no está en la lista,
            // seleccionar el primero
            const sensorIds = data.sensors.map(s => s.id);
            if (!selectedSensor || !sensorIds.includes(selectedSensor)) {
                selectedSensor = data.sensors[0].id;
                const selectedText = sensorDropdown.querySelector('span');
                if (selectedText) {
                    selectedText.textContent = data.sensors[0].name;
                }
                
                // Actualizar datos del dashboard con el nuevo sensor
                updateDashboardData();
            }
            
            // Reinicializar eventos
            initCustomDropdowns();
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar los sensores: ' + error.message);
        });
}

/**
 * Actualiza los datos del dashboard
 */
function updateDashboardData() {
    if (!selectedMachine || !selectedSensor) {
        // Si no hay máquina o sensor seleccionado pero hay config message,
        // probablemente es porque no hay configuración
        if (!document.querySelector('.no-config-message')) {
            showToast('warning', 'Seleccione una máquina y un sensor para ver los datos');
        }
        return;
    }
    
    showLoadingToast('Actualizando datos...');
    
    fetch(`/api/data?machine=${selectedMachine}&sensor=${selectedSensor}&timeRange=${timeRange}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || 'Error al cargar los datos');
                });
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            if (data.status === 'error') {
                showToast('danger', data.message);
                return;
            }
            
            // Actualizar datos de los gráficos
            chartData = data.chartData;
            
            // Actualizar estadísticas
            stats = data.stats;
            
            // Actualizar gráficos
            updateVibrationChartX();
            updateVibrationChartY();
            updateVibrationChartZ();
            
            // Actualizar contadores de alertas
            updateAlertCounters(data.alerts);
            
            // Actualizar valores estadísticos en la interfaz
            updateStatisticalDisplayValues();
            
            // Actualizar última actualización
            document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al actualizar los datos: ' + error.message);
        });
}

/**
 * Actualiza los contadores de alertas
 */
function updateAlertCounters(alerts) {
    const level1Count = document.getElementById('level1Count');
    const level2Count = document.getElementById('level2Count');
    const level3Count = document.getElementById('level3Count');
    const totalCount = document.getElementById('totalCount');
    
    if (level1Count) level1Count.textContent = alerts.level1 || 0;
    if (level2Count) level2Count.textContent = alerts.level2 || 0;
    if (level3Count) level3Count.textContent = alerts.level3 || 0;
    if (totalCount) totalCount.textContent = (alerts.level1 || 0) + (alerts.level2 || 0) + (alerts.level3 || 0);
}

/**
 * Actualiza los valores estadísticos mostrados en la interfaz
 */
function updateStatisticalDisplayValues() {
    // Actualizar valores para el eje X
    updateStatDisplayValue('x2SigmaLowerDisplay', stats.x.sigma2.lower);
    updateStatDisplayValue('x2SigmaUpperDisplay', stats.x.sigma2.upper);
    updateStatDisplayValue('x3SigmaLowerDisplay', stats.x.sigma3.lower);
    updateStatDisplayValue('x3SigmaUpperDisplay', stats.x.sigma3.upper);
    
    // Actualizar valores para el eje Y
    updateStatDisplayValue('y2SigmaLowerDisplay', stats.y.sigma2.lower);
    updateStatDisplayValue('y2SigmaUpperDisplay', stats.y.sigma2.upper);
    updateStatDisplayValue('y3SigmaLowerDisplay', stats.y.sigma3.lower);
    updateStatDisplayValue('y3SigmaUpperDisplay', stats.y.sigma3.upper);
    
    // Actualizar valores para el eje Z
    updateStatDisplayValue('z2SigmaLowerDisplay', stats.z.sigma2.lower);
    updateStatDisplayValue('z2SigmaUpperDisplay', stats.z.sigma2.upper);
    updateStatDisplayValue('z3SigmaLowerDisplay', stats.z.sigma3.lower);
    updateStatDisplayValue('z3SigmaUpperDisplay', stats.z.sigma3.upper);
}

/**
 * Actualiza un valor estadístico específico en la interfaz
 */
function updateStatDisplayValue(elementId, value) {
    const element = document.getElementById(elementId);
    
    if (element) {
        element.textContent = value.toFixed(2);
    }
}

// ==========================================================================
// GRÁFICOS DE VIBRACIÓN
// ==========================================================================

/**
 * Inicializa el gráfico de vibración con los tres ejes (X, Y, Z)
 */
function initVibrationChart() {
    initAxisChart('vibrationChartX', 'Vibración - Eje X', 'x');
    initAxisChart('vibrationChartY', 'Vibración - Eje Y', 'y');
    initAxisChart('vibrationChartZ', 'Vibración - Eje Z', 'z');
}

/**
 * Inicializa un gráfico para un eje específico
 */
function initAxisChart(canvasId, title, axis) {
    const canvas = document.getElementById(canvasId);
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: `${title}`,
                    data: [],
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 1,
                    pointBackgroundColor: '#10b981',
                    pointHoverRadius: 4,
                    fill: false
                },
                {
                    label: 'Media',
                    data: [],
                    borderColor: '#6b7280',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Límite 2σ Superior',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Límite 2σ Inferior',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Límite 3σ Superior',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Límite 3σ Inferior',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw;
                            return label + ': ' + (value ? value.toFixed(3) : '0');
                        }
                    }
                },
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: title,
                    color: '#6b7280',
                    font: {
                        size: 16
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function(value, index, values) {
                            const timestamp = chartData.timestamps[value];
                            if (!timestamp) return '';
                            return new Date(timestamp).toLocaleTimeString();
                        }
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(200, 200, 200, 0.1)'
                    }
                }
            }
        }
    });
    
    // Asignar a la variable global correspondiente
    if (axis === 'x') {
        vibrationChartX = chart;
    } else if (axis === 'y') {
        vibrationChartY = chart;
    } else if (axis === 'z') {
        vibrationChartZ = chart;
    }
}

/**
 * Actualiza el gráfico del eje X
 */
function updateVibrationChartX() {
    updateAxisChart(vibrationChartX, 'x');
}

/**
 * Actualiza el gráfico del eje Y
 */
function updateVibrationChartY() {
    updateAxisChart(vibrationChartY, 'y');
}

/**
 * Actualiza el gráfico del eje Z
 */
function updateVibrationChartZ() {
    updateAxisChart(vibrationChartZ, 'z');
}

/**
 * Actualiza un gráfico específico con los datos actuales
 */
function updateAxisChart(chart, axis) {
    if (!chart || !chartData) return;
    
    // Actualizar datos del eje
    chart.data.labels = Array.from(Array(chartData.timestamps.length).keys());
    chart.data.datasets[0].data = chartData[axis];
    
    // Colorear puntos según estado
    const pointBackgroundColors = [];
    const pointBorderColors = [];
    const borderColors = [];
    
    for (let i = 0; i < chartData.status.length; i++) {
        const status = chartData.status[i];
        const color = SEVERITY_COLORS[status];
        pointBackgroundColors.push(color);
        pointBorderColors.push(color);
        borderColors.push(color);
    }
    
    chart.data.datasets[0].pointBackgroundColor = pointBackgroundColors;
    chart.data.datasets[0].pointBorderColor = pointBorderColors;
    chart.data.datasets[0].borderColor = borderColors;
    
    // Actualizar línea de media - no mostramos media según los nuevos requisitos
    chart.data.datasets[1].data = [];
    
    // Actualizar líneas de límites estadísticos
    if (showSigmaLines) {
        // Límites 2σ para el eje específico
        chart.data.datasets[2].data = Array(chartData.timestamps.length).fill(stats[axis].sigma2.upper);
        chart.data.datasets[3].data = Array(chartData.timestamps.length).fill(stats[axis].sigma2.lower);
        
        // Límites 3σ para el eje específico
        chart.data.datasets[4].data = Array(chartData.timestamps.length).fill(stats[axis].sigma3.upper);
        chart.data.datasets[5].data = Array(chartData.timestamps.length).fill(stats[axis].sigma3.lower);
    } else {
        chart.data.datasets[2].data = [];
        chart.data.datasets[3].data = [];
        chart.data.datasets[4].data = [];
        chart.data.datasets[5].data = [];
    }
    
    // Actualizar el gráfico
    chart.update();
}

/**
 * Inicializa el gráfico histórico de alertas
 */
function initAlertsHistoryChart() {
    const canvas = document.getElementById('alertsHistoryChart');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [
                {
                    label: 'Alertas Nivel 1',
                    data: [12, 15, 13, 8, 7, 9, 11, 13, 10, 14, 16, 12],
                    backgroundColor: '#f59e0b'
                },
                {
                    label: 'Alertas Nivel 2',
                    data: [8, 9, 7, 5, 4, 3, 6, 7, 5, 8, 9, 7],
                    backgroundColor: '#f97316'
                },
                {
                    label: 'Alertas Nivel 3',
                    data: [3, 4, 2, 1, 0, 1, 2, 3, 1, 3, 4, 3],
                    backgroundColor: '#ef4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Historial Anual de Alertas',
                    color: '#6b7280',
                    font: {
                        size: 16
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.1)'
                    }
                }
            }
        }
    });
}

// ==========================================================================
// BOTONES Y FUNCIONES DE EXPORTACIÓN
// ==========================================================================

/**
 * Inicializa el botón de exportación
 */
function initExportButton() {
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            // Obtener filtros actuales
            const filters = {
                machine: selectedMachine,
                sensor: selectedSensor,
                timeRange: timeRange,
                showMean: document.getElementById('showMean').checked,
                showSigma: {
                    sigma1: document.getElementById('show1Sigma').checked,
                    sigma2: document.getElementById('show2Sigma').checked,
                    sigma3: document.getElementById('show3Sigma').checked
                }
            };
            
            // Mostrar indicador de carga
            showLoading();
            
            // Generar PDF con los datos filtrados
            fetch('/api/export/pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filters)
            })
            .then(response => response.blob())
            .then(blob => {
                // Crear URL del blob
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pdm_report_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                hideLoading();
                showNotification('Reporte exportado correctamente', 'success');
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoading();
                showNotification('Error al exportar el reporte', 'error');
            });
        });
    }
}

/**
 * Inicializa la exportación a PDF
 */
function initPDFExport() {
    const pdfBtn = document.getElementById('exportPDFBtn');
    
    if (!pdfBtn) return;
    
    pdfBtn.addEventListener('click', () => {
        if (!selectedMachine || !selectedSensor) {
            showToast('warning', 'Seleccione una máquina y un sensor antes de exportar');
            return;
        }
        
        showLoadingToast('Generando PDF...');
        
        fetch(`/api/export/pdf?machine=${selectedMachine}&sensor=${selectedSensor}&timeRange=${timeRange}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al generar el PDF');
                }
                return response.blob();
            })
            .then(blob => {
                hideLoadingToast();
                
                // Crear URL para el blob
                const url = window.URL.createObjectURL(blob);
                
                // Crear enlace para descarga
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `informe_vibracion_${selectedMachine}_${selectedSensor}_${timeRange}.pdf`;
                
                // Añadir al documento y simular clic
                document.body.appendChild(a);
                a.click();
                
                // Limpiar
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showToast('success', 'PDF generado correctamente');
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoadingToast();
                showToast('danger', 'Error al generar el PDF: ' + error.message);
            });
    });
}

// ==========================================================================
// AJUSTE DE LÍMITES Y ANÁLISIS ESTADÍSTICO
// ==========================================================================

/**
 * Inicializa el botón de ajuste de límites
 */
function initAdjustLimitsButton() {
    const adjustLimitsBtn = document.getElementById('adjustLimitsBtn');
    if (adjustLimitsBtn) {
        adjustLimitsBtn.addEventListener('click', () => {
            // Guardar estado actual
            localStorage.setItem('returnToSection', 'dashboard');
            localStorage.setItem('returnToMachine', selectedMachine);
            localStorage.setItem('returnToSensor', selectedSensor);
            
            // Navegar a la sección de configuración
            navigateTo('configuracion');
            
            // Esperar a que la sección de configuración se cargue
            setTimeout(() => {
                const configSection = document.querySelector('#configuracion-section');
                if (configSection) {
                    // Desplazarse a la sección de límites
                    const limitsSection = configSection.querySelector('#limitsSection');
                    if (limitsSection) {
                        limitsSection.scrollIntoView({ behavior: 'smooth' });
                        
                        // Pre-seleccionar la máquina y sensor si estaban seleccionados
                        if (selectedMachine && selectedSensor) {
                            const machineSelect = document.getElementById('limitsMachineSelect');
                            const sensorSelect = document.getElementById('limitsSensorSelect');
                            if (machineSelect) machineSelect.value = selectedMachine;
                            if (sensorSelect) sensorSelect.value = selectedSensor;
                            
                            // Cargar límites actuales
                            loadCurrentLimits(selectedMachine, selectedSensor);
                        }
                    }
                }
            }, 500);
        });
    }
}

/**
 * Guarda los límites actualizados en el servidor
 */
function saveLimits(sigma2Lower, sigma2Upper, sigma3Lower, sigma3Upper) {
    showLoadingToast('Guardando límites...');
    
    fetch('/api/limits/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            machine: selectedMachine,
            sensor: selectedSensor,
            limits: {
                sigma2: {
                    lower: sigma2Lower,
                    upper: sigma2Upper
                },
                sigma3: {
                    lower: sigma3Lower,
                    upper: sigma3Upper
                }
            }
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar los límites');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        showToast('success', 'Límites guardados correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al guardar los límites: ' + error.message);
    });
}

/**
 * Inicializa los botones de estadísticas
 */
function initStatLimitsButtons() {
    const recalcBtn = document.getElementById('recalcLimitsBtn');
    
    if (recalcBtn) {
        recalcBtn.addEventListener('click', () => {
            if (!selectedMachine || !selectedSensor) {
                showToast('warning', 'Seleccione una máquina y un sensor antes de recalcular límites');
                return;
            }
            
            showLoadingToast('Recalculando límites estadísticos...');
            
            fetch(`/api/limits/recalculate?machine=${selectedMachine}&sensor=${selectedSensor}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Error al recalcular los límites');
                    }
                    return response.json();
                })
                .then(data => {
                    hideLoadingToast();
                    
                    // Actualizar estadísticas con los nuevos valores
                    stats = data.stats;
                    
                    // Actualizar visualización
                    updateVibrationChartX();
                    updateVibrationChartY();
                    updateVibrationChartZ();
                    
                    // Actualizar valores estadísticos en la interfaz
                    updateStatisticalDisplayValues();
                    
                    showToast('success', 'Límites recalculados correctamente');
                })
                .catch(error => {
                    console.error('Error:', error);
                    hideLoadingToast();
                    showToast('danger', 'Error al recalcular los límites: ' + error.message);
                });
        });
    }
    
    const resetBtn = document.getElementById('resetLimitsBtn');
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (!selectedMachine || !selectedSensor) {
                showToast('warning', 'Seleccione una máquina y un sensor antes de restablecer límites');
                return;
            }
            
            showLoadingToast('Restableciendo límites predeterminados...');
            
            fetch(`/api/limits/reset?machine=${selectedMachine}&sensor=${selectedSensor}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Error al restablecer los límites');
                    }
                    return response.json();
                })
                .then(data => {
                    hideLoadingToast();
                    
                    // Actualizar estadísticas con los valores predeterminados
                    stats = data.stats;
                    
                    // Actualizar visualización
                    updateVibrationChartX();
                    updateVibrationChartY();
                    updateVibrationChartZ();
                    
                    // Actualizar valores estadísticos en la interfaz
                    updateStatisticalDisplayValues();
                    
                    showToast('success', 'Límites restablecidos correctamente');
                })
                .catch(error => {
                    console.error('Error:', error);
                    hideLoadingToast();
                    showToast('danger', 'Error al restablecer los límites: ' + error.message);
                });
        });
    }
}

// ==========================================================================
// SIMULACIÓN
// ==========================================================================

/**
 * Verifica el estado actual de la simulación
 */
function checkSimulationStatus() {
    const startBtn = document.getElementById('startSimulationBtn');
    const stopBtn = document.getElementById('stopSimulationBtn');
    
    fetch('/api/simulation/status')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al verificar estado de simulación');
            }
            return response.json();
        })
        .then(data => {
            simulationRunning = data.running;
            
            // Actualizar UI según estado
            if (startBtn && stopBtn) {
                if (simulationRunning) {
                    startBtn.classList.add('hidden');
                    stopBtn.classList.remove('hidden');
                } else {
                    startBtn.classList.remove('hidden');
                    stopBtn.classList.add('hidden');
                }
            }
            
            // Si la simulación está activa, iniciar temporizador de actualización
            if (simulationRunning) {
                startSimulationUpdates();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('danger', 'Error al verificar estado de simulación: ' + error.message);
        });
    
    // Inicializar botones de simulación
    initSimulationButtons();
}

/**
 * Inicializa los botones de control de simulación
 */
function initSimulationButtons() {
    const startBtn = document.getElementById('startSimulationBtn');
    const stopBtn = document.getElementById('stopSimulationBtn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (!selectedMachine || !selectedSensor) {
                showToast('warning', 'Seleccione una máquina y un sensor antes de iniciar la simulación');
                return;
            }
            
            showLoadingToast('Iniciando simulación...');
            
            fetch('/api/simulation/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    machine: selectedMachine,
                    sensor: selectedSensor
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al iniciar la simulación');
                }
                return response.json();
            })
            .then(data => {
                hideLoadingToast();
                
                simulationRunning = true;
                
                // Actualizar UI
                if (startBtn && stopBtn) {
                    startBtn.classList.add('hidden');
                    stopBtn.classList.remove('hidden');
                }
                
                // Iniciar temporizador de actualización
                startSimulationUpdates();
                
                showToast('success', 'Simulación iniciada correctamente');
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoadingToast();
                showToast('danger', 'Error al iniciar la simulación: ' + error.message);
            });
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            showLoadingToast('Deteniendo simulación...');
            
            fetch('/api/simulation/stop', {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al detener la simulación');
                }
                return response.json();
            })
            .then(data => {
                hideLoadingToast();
                
                simulationRunning = false;
                
                // Actualizar UI
                if (startBtn && stopBtn) {
                    startBtn.classList.remove('hidden');
                    stopBtn.classList.add('hidden');
                }
                
                // Detener temporizador de actualización
                stopSimulationUpdates();
                
                showToast('success', 'Simulación detenida correctamente');
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoadingToast();
                showToast('danger', 'Error al detener la simulación: ' + error.message);
            });
        });
    }
}

/**
 * Inicia actualizaciones periódicas durante la simulación
 */
function startSimulationUpdates() {
    // Detener timer anterior si existe
    stopSimulationUpdates();
    
    // Crear nuevo timer para actualizar datos cada 2 segundos
    simulationTimer = setInterval(() => {
        updateDashboardData();
    }, 2000);
}

/**
 * Detiene las actualizaciones periódicas
 */
function stopSimulationUpdates() {
    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }
}

// ==========================================================================
// CONFIGURACIÓN
// ==========================================================================

/**
 * Inicializa la sección de configuración
 */
function initConfig() {
    console.log("Inicializando sección de configuración...");
    
    // Inicializar la gestión de máquinas
    initMachineManagement();
    
    // Inicializar la gestión de sensores
    initSensorManagement();
    
    // Inicializar formularios y botones
    initConfigForm();
    initConfigActions();
    
    // Inicializar sección de límites de aceleración
    initLimitsSection();
}

/**
 * Inicializa el formulario de configuración
 */
function initConfigForm() {
    const configForm = document.getElementById('configForm');
    
    if (!configForm) return;
    
    configForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        // Recopilar datos del formulario
        const configName = document.getElementById('configName').value;
        const configType = document.getElementById('configType').value;
        const configValue = document.getElementById('configValue').value;
        const configDescription = document.getElementById('configDescription').value;
        
        // Validar datos
        if (!configName || !configType || !configValue) {
            showToast('warning', 'Por favor, complete todos los campos obligatorios');
            return;
        }
        
        // Enviar datos al servidor
        showLoadingToast('Guardando configuración...');
        
        fetch('/api/config/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: configName,
                type: configType,
                value: configValue,
                description: configDescription
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al guardar la configuración');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Limpiar formulario
            configForm.reset();
            
            // Recargar lista de configuraciones
            loadConfigList();
            
            showToast('success', 'Configuración guardada correctamente');
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al guardar la configuración: ' + error.message);
        });
    });
}

/**
 * Carga la lista de configuraciones
 */
function loadConfigList() {
    const configList = document.getElementById('configList');
    
    if (!configList) return;
    
    showLoadingToast('Cargando configuraciones...');
    
    fetch('/api/config/list')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar las configuraciones');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Limpiar lista actual
            configList.innerHTML = '';
            
            // Añadir configuraciones
            if (data.configs.length === 0) {
                configList.innerHTML = '<tr><td colspan="5" class="text-center">No hay configuraciones disponibles</td></tr>';
                return;
            }
            
            data.configs.forEach(config => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${config.name}</td>
                    <td>${config.type}</td>
                    <td>${config.value}</td>
                    <td>${config.description || '-'}</td>
                    <td>
                        <button class="btn-icon edit-config" data-id="${config.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-config" data-id="${config.id}" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
                
                configList.appendChild(row);
            });
            
            // Inicializar eventos de edición/eliminación
            initConfigActions();
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar las configuraciones: ' + error.message);
        });
}

/**
 * Inicializa eventos de acciones en la lista de configuraciones
 */
function initConfigActions() {
    // Botones de edición
    const editButtons = document.querySelectorAll('.edit-config');
    
    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            const configId = button.getAttribute('data-id');
            editConfig(configId);
        });
    });
    
    // Botones de eliminación
    const deleteButtons = document.querySelectorAll('.delete-config');
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const configId = button.getAttribute('data-id');
            deleteConfig(configId);
        });
    });
}

/**
 * Edita una configuración existente
 */
function editConfig(configId) {
    showLoadingToast('Cargando datos de configuración...');
    
    fetch(`/api/config/${configId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar la configuración');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Mostrar modal de edición
            const modal = document.getElementById('editConfigModal');
            
            if (!modal) return;
            
            // Rellenar formulario con datos
            document.getElementById('editConfigId').value = data.id;
            document.getElementById('editConfigName').value = data.name;
            document.getElementById('editConfigType').value = data.type;
            document.getElementById('editConfigValue').value = data.value;
            document.getElementById('editConfigDescription').value = data.description || '';
            
            // Mostrar modal
            modal.classList.add('show');
            
            // Inicializar formulario de edición
            initEditConfigForm();
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar la configuración: ' + error.message);
        });
}

/**
 * Inicializa el formulario de edición de configuración
 */
function initEditConfigForm() {
    const editForm = document.getElementById('editConfigForm');
    
    if (!editForm) return;
    
    // Eliminar listener anterior si existe
    const newEditForm = editForm.cloneNode(true);
    editForm.parentNode.replaceChild(newEditForm, editForm);
    
    // Añadir nuevo listener
    newEditForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        // Recopilar datos del formulario
        const configId = document.getElementById('editConfigId').value;
        const configName = document.getElementById('editConfigName').value;
        const configType = document.getElementById('editConfigType').value;
        const configValue = document.getElementById('editConfigValue').value;
        const configDescription = document.getElementById('editConfigDescription').value;
        
        // Validar datos
        if (!configName || !configType || !configValue) {
            showToast('warning', 'Por favor, complete todos los campos obligatorios');
            return;
        }
        
        // Enviar datos al servidor
        showLoadingToast('Actualizando configuración...');
        
        fetch(`/api/config/update/${configId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: configName,
                type: configType,
                value: configValue,
                description: configDescription
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al actualizar la configuración');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Cerrar modal
            const modal = document.getElementById('editConfigModal');
            if (modal) {
                modal.classList.remove('show');
            }
            
            // Recargar lista de configuraciones
            loadConfigList();
            
            showToast('success', 'Configuración actualizada correctamente');
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al actualizar la configuración: ' + error.message);
        });
    });
}

/**
 * Elimina una configuración
 */
function deleteConfig(configId) {
    // Confirmar eliminación
    if (!confirm('¿Está seguro de que desea eliminar esta configuración?')) {
        return;
    }
    
    showLoadingToast('Eliminando configuración...');
    
    fetch(`/api/config/delete/${configId}`, {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar la configuración');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        
        // Recargar lista de configuraciones
        loadConfigList();
        
        showToast('success', 'Configuración eliminada correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al eliminar la configuración: ' + error.message);
    });
}

// ==========================================================================
// AJUSTES
// ==========================================================================

/**
 * Inicializa la sección de ajustes
 */
function initSettings() {
    // Inicializar ajustes generales
    initGeneralSettings();
    
    // Inicializar ajustes de notificaciones
    initNotificationSettings();
    
    // Inicializar ajustes de usuarios
    initUserSettings();
}

/**
 * Inicializa los ajustes generales
 */
function initGeneralSettings() {
    // Implementación de ajustes generales
    // ...
}

// Funciones de configuración
function initConfigSection() {
    initAddMachineButton();
    initAddSensorButton();
    initSensorDetails();
    loadMachinesList();
    loadSensorsList();
}

function initAddMachineButton() {
    const addMachineBtn = document.getElementById('addMachineBtn');
    const machineForm = document.getElementById('machineForm');
    
    if (addMachineBtn && machineForm) {
        addMachineBtn.addEventListener('click', () => {
            const formData = new FormData(machineForm);
            const machineData = {
                name: formData.get('machineName'),
                description: formData.get('machineDescription'),
                location: formData.get('machineLocation'),
                status: 'active'
            };
            
            fetch('/api/machines/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(machineData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    showNotification('Máquina añadida correctamente', 'success');
                    loadMachinesList();
                    machineForm.reset();
                } else {
                    showNotification('Error al añadir máquina', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error al añadir máquina', 'error');
            });
        });
    }
}

function initAddSensorButton() {
    const addSensorBtn = document.getElementById('addSensorBtn');
    const sensorForm = document.getElementById('sensorForm');
    
    if (addSensorBtn && sensorForm) {
        // Cargar lista de máquinas disponibles
        fetch('/api/machines/list')
            .then(response => response.json())
            .then(machines => {
                const machineSelect = document.getElementById('sensorMachine');
                machineSelect.innerHTML = '<option value="">Seleccionar máquina...</option>';
                machines.forEach(machine => {
                    machineSelect.innerHTML += `<option value="${machine.id}">${machine.name}</option>`;
                });
            });
        
        addSensorBtn.addEventListener('click', () => {
            const formData = new FormData(sensorForm);
            const sensorData = {
                name: formData.get('sensorName'),
                type: formData.get('sensorType'),
                machine_id: formData.get('sensorMachine'),
                description: formData.get('sensorDescription'),
                status: 'active'
            };
            
            fetch('/api/sensors/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sensorData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    showNotification('Sensor añadido correctamente', 'success');
                    loadSensorsList();
                    sensorForm.reset();
                } else {
                    showNotification('Error al añadir sensor', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error al añadir sensor', 'error');
            });
        });
    }
}

function initSensorDetails() {
    const sensorsList = document.getElementById('sensorsList');
    if (sensorsList) {
        sensorsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-sensor')) {
                const sensorId = e.target.dataset.sensorId;
                const row = e.target.closest('tr');
                
                // Convertir campos a editables
                row.querySelectorAll('.editable').forEach(cell => {
                    const currentValue = cell.textContent;
                    const fieldName = cell.dataset.field;
                    cell.innerHTML = `<input type="text" class="form-control" value="${currentValue}" data-original="${currentValue}" data-field="${fieldName}">`;
                });
                
                // Cambiar botón de editar por guardar
                e.target.innerHTML = '<i class="fas fa-save"></i>';
                e.target.classList.remove('edit-sensor');
                e.target.classList.add('save-sensor');
            } else if (e.target.classList.contains('save-sensor')) {
                const sensorId = e.target.dataset.sensorId;
                const row = e.target.closest('tr');
                const updates = {};
                
                // Recoger valores actualizados
                row.querySelectorAll('.editable input').forEach(input => {
                    const fieldName = input.dataset.field;
                    const newValue = input.value;
                    if (newValue !== input.dataset.original) {
                        updates[fieldName] = newValue;
                    }
                });
                
                // Guardar cambios
                if (Object.keys(updates).length > 0) {
                    fetch(`/api/sensors/${sensorId}/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updates)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'ok') {
                            showNotification('Sensor actualizado correctamente', 'success');
                            loadSensorsList();
                        } else {
                            showNotification('Error al actualizar sensor', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        showNotification('Error al actualizar sensor', 'error');
                    });
                }
                
                // Restaurar vista normal
                row.querySelectorAll('.editable input').forEach(input => {
                    const cell = input.closest('.editable');
                    cell.textContent = input.value;
                });
                
                e.target.innerHTML = '<i class="fas fa-edit"></i>';
                e.target.classList.remove('save-sensor');
                e.target.classList.add('edit-sensor');
            }
        });
    }
}

// Funciones para el tema de la aplicación
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const appContainer = document.querySelector('.app-container');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Verificar si hay un tema guardado en localStorage
    const savedTheme = localStorage.getItem('pdm-theme');
    if (savedTheme === 'light') {
        appContainer.classList.add('light-theme');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else if (!savedTheme && !prefersDarkScheme.matches) {
        // Si no hay tema guardado y el usuario prefiere el tema claro
        appContainer.classList.add('light-theme');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    // Manejar el cambio de tema
    themeToggleBtn.addEventListener('click', () => {
        if (appContainer.classList.contains('light-theme')) {
            appContainer.classList.remove('light-theme');
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('pdm-theme', 'dark');
        } else {
            appContainer.classList.add('light-theme');
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('pdm-theme', 'light');
        }
    });
}

// Inicialización mejorada de la UI
function initUI() {
    // Inicializar sidebar
    initSidebar();
    
    // Inicializar tooltips
    initTooltips();
    
    // Inicializar dropdowns
    initDropdowns();
    
    // Inicializar switches
    initSwitches();
    
    // Inicializar tema
    initDarkTheme();
    
    // Hacer visible la navegación (para optimizar carga inicial)
    document.body.classList.add('nav-loaded');
}

// Función para inicializar tooltips personalizados
function initTooltips() {
    // Crear el elemento tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
    
    // Seleccionar todos los elementos con atributo 'title'
    const elementsWithTitle = document.querySelectorAll('[title]');
    
    elementsWithTitle.forEach(element => {
        const title = element.getAttribute('title');
        element.removeAttribute('title'); // Eliminar title para evitar el tooltip nativo
        
        // Agregar eventos para mostrar/ocultar tooltip
        element.addEventListener('mouseenter', (e) => {
            tooltip.textContent = title;
            tooltip.classList.add('visible');
            
            // Posicionar el tooltip
            const rect = element.getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + 10}px`;
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        });
        
        element.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
}

// Filtros mejorados
function initFilters() {
    // Inicializar dropdowns
    initDropdowns();
    
    // Expandir/colapsar panel de filtros en dispositivos móviles
    const expandFiltersBtn = document.getElementById('expandFiltersBtn');
    const filterPanel = document.querySelector('.filter-panel');
    
    if (expandFiltersBtn && filterPanel) {
        expandFiltersBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('show');
            
            // Cambiar el ícono según el estado
            const icon = expandFiltersBtn.querySelector('i');
            if (filterPanel.classList.contains('show')) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        });
        
        // Verificar si estamos en dispositivo móvil para colapsar por defecto
        if (window.innerWidth < 768) {
            filterPanel.classList.remove('show');
        } else {
            filterPanel.classList.add('show');
        }
    }
    
    // Inicializar switches
    initSwitches();
}

// Inicialización de dropdowns
function initDropdowns() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.filter-dropdown-toggle');
        const menu = dropdown.querySelector('.filter-dropdown-menu');
        const items = dropdown.querySelectorAll('.filter-dropdown-item');
        const textSpan = toggle.querySelector('span');
        
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdowns.forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });
        
        items.forEach(item => {
            item.addEventListener('click', () => {
                const value = item.getAttribute('data-value');
                const text = item.textContent;
                
                // Actualizar el texto del toggle
                textSpan.textContent = text;
                
                // Actualizar la selección
                items.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                
                // Cerrar el dropdown
                dropdown.classList.remove('open');
                
                // Disparar evento de cambio
                const changeEvent = new CustomEvent('dropdown-change', {
                    detail: { value, text, dropdown: dropdown.id }
                });
                document.dispatchEvent(changeEvent);
                
                // Actualizar datos según el filtro seleccionado
                updateDashboardData();
            });
        });
    });
    
    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });
}

// Inicialización de switches
function initSwitches() {
    const switches = document.querySelectorAll('.custom-control-input');
    
    switches.forEach(switchEl => {
        switchEl.addEventListener('change', () => {
            // Actualizar visualización de gráficos según los switches
            updateChartsVisibility();
        });
    });
}

// Actualizar visibilidad de elementos en los gráficos
function updateChartsVisibility() {
    // Mantener la línea de media oculta
    const showMean = false;
    const show1Sigma = document.getElementById('show1Sigma').checked;
    const show2Sigma = document.getElementById('show2Sigma').checked;
    const show3Sigma = document.getElementById('show3Sigma').checked;
    
    // Actualizar gráfico X
    if (vibrationChartX) {
        vibrationChartX.data.datasets.forEach(dataset => {
            if (dataset.label.includes('Media')) {
                dataset.hidden = true; // Siempre ocultar la media
            } else if (dataset.label.includes('1σ')) {
                dataset.hidden = !show1Sigma;
            } else if (dataset.label.includes('2σ')) {
                dataset.hidden = !show2Sigma;
            } else if (dataset.label.includes('3σ')) {
                dataset.hidden = !show3Sigma;
            }
        });
        vibrationChartX.update();
    }
    
    // Actualizar gráfico Y
    if (vibrationChartY) {
        vibrationChartY.data.datasets.forEach(dataset => {
            if (dataset.label.includes('Media')) {
                dataset.hidden = true; // Siempre ocultar la media
            } else if (dataset.label.includes('1σ')) {
                dataset.hidden = !show1Sigma;
            } else if (dataset.label.includes('2σ')) {
                dataset.hidden = !show2Sigma;
            } else if (dataset.label.includes('3σ')) {
                dataset.hidden = !show3Sigma;
            }
        });
        vibrationChartY.update();
    }
    
    // Actualizar gráfico Z
    if (vibrationChartZ) {
        vibrationChartZ.data.datasets.forEach(dataset => {
            if (dataset.label.includes('Media')) {
                dataset.hidden = true; // Siempre ocultar la media
            } else if (dataset.label.includes('1σ')) {
                dataset.hidden = !show1Sigma;
            } else if (dataset.label.includes('2σ')) {
                dataset.hidden = !show2Sigma;
            } else if (dataset.label.includes('3σ')) {
                dataset.hidden = !show3Sigma;
            }
        });
        vibrationChartZ.update();
    }
}

// Inicialización del modal de ajuste de límites
function initAdjustLimitsModal() {
    const adjustLimitsBtn = document.getElementById('adjustLimitsBtn');
    const modal = document.getElementById('adjustLimitsModal');
    const closeBtn = modal.querySelector('.modal-close');
    const saveBtn = document.getElementById('saveLimitsBtn');
    const resetBtn = document.getElementById('resetLimitsBtn');
    
    // Mostrar modal
    adjustLimitsBtn.addEventListener('click', () => {
        // Cargar los valores actuales en los inputs
        loadCurrentLimits();
        modal.classList.add('show');
    });
    
    // Cerrar modal
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    // Cerrar al hacer clic fuera del contenido
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Guardar límites
    saveBtn.addEventListener('click', () => {
        saveLimits();
        modal.classList.remove('show');
    });
    
    // Resetear límites
    resetBtn.addEventListener('click', () => {
        resetLimits();
    });
}

// Cargar límites actuales en el formulario
function loadCurrentLimits() {
    // Cargar los límites para el eje X
    document.getElementById('x2SigmaLowerInput').value = stats.x.sigma2.lower.toFixed(6);
    document.getElementById('x2SigmaUpperInput').value = stats.x.sigma2.upper.toFixed(6);
    document.getElementById('x3SigmaLowerInput').value = stats.x.sigma3.lower.toFixed(6);
    document.getElementById('x3SigmaUpperInput').value = stats.x.sigma3.upper.toFixed(6);
    
    // Cargar los límites para el eje Y
    document.getElementById('y2SigmaLowerInput').value = stats.y.sigma2.lower.toFixed(6);
    document.getElementById('y2SigmaUpperInput').value = stats.y.sigma2.upper.toFixed(6);
    document.getElementById('y3SigmaLowerInput').value = stats.y.sigma3.lower.toFixed(6);
    document.getElementById('y3SigmaUpperInput').value = stats.y.sigma3.upper.toFixed(6);
    
    // Cargar los límites para el eje Z
    document.getElementById('z2SigmaLowerInput').value = stats.z.sigma2.lower.toFixed(6);
    document.getElementById('z2SigmaUpperInput').value = stats.z.sigma2.upper.toFixed(6);
    document.getElementById('z3SigmaLowerInput').value = stats.z.sigma3.lower.toFixed(6);
    document.getElementById('z3SigmaUpperInput').value = stats.z.sigma3.upper.toFixed(6);
}

// Guardar nuevos límites
function saveLimits() {
    // Obtener valores para el eje X
    const x2SigmaLower = parseFloat(document.getElementById('x2SigmaLowerInput').value);
    const x2SigmaUpper = parseFloat(document.getElementById('x2SigmaUpperInput').value);
    const x3SigmaLower = parseFloat(document.getElementById('x3SigmaLowerInput').value);
    const x3SigmaUpper = parseFloat(document.getElementById('x3SigmaUpperInput').value);
    
    // Obtener valores para el eje Y
    const y2SigmaLower = parseFloat(document.getElementById('y2SigmaLowerInput').value);
    const y2SigmaUpper = parseFloat(document.getElementById('y2SigmaUpperInput').value);
    const y3SigmaLower = parseFloat(document.getElementById('y3SigmaLowerInput').value);
    const y3SigmaUpper = parseFloat(document.getElementById('y3SigmaUpperInput').value);
    
    // Obtener valores para el eje Z
    const z2SigmaLower = parseFloat(document.getElementById('z2SigmaLowerInput').value);
    const z2SigmaUpper = parseFloat(document.getElementById('z2SigmaUpperInput').value);
    const z3SigmaLower = parseFloat(document.getElementById('z3SigmaLowerInput').value);
    const z3SigmaUpper = parseFloat(document.getElementById('z3SigmaUpperInput').value);
    
    // Validar que todos sean valores numéricos
    if (isNaN(x2SigmaLower) || isNaN(x2SigmaUpper) || isNaN(x3SigmaLower) || isNaN(x3SigmaUpper) ||
        isNaN(y2SigmaLower) || isNaN(y2SigmaUpper) || isNaN(y3SigmaLower) || isNaN(y3SigmaUpper) ||
        isNaN(z2SigmaLower) || isNaN(z2SigmaUpper) || isNaN(z3SigmaLower) || isNaN(z3SigmaUpper)) {
        showToast('error', 'Todos los valores deben ser numéricos');
        return;
    }
    
    // Actualizar la estructura stats con los nuevos valores
    stats.x.sigma2.lower = x2SigmaLower;
    stats.x.sigma2.upper = x2SigmaUpper;
    stats.x.sigma3.lower = x3SigmaLower;
    stats.x.sigma3.upper = x3SigmaUpper;
    
    stats.y.sigma2.lower = y2SigmaLower;
    stats.y.sigma2.upper = y2SigmaUpper;
    stats.y.sigma3.lower = y3SigmaLower;
    stats.y.sigma3.upper = y3SigmaUpper;
    
    stats.z.sigma2.lower = z2SigmaLower;
    stats.z.sigma2.upper = z2SigmaUpper;
    stats.z.sigma3.lower = z3SigmaLower;
    stats.z.sigma3.upper = z3SigmaUpper;
    
    // Actualizar los valores mostrados en la interfaz
    updateStatisticalDisplayValues();
    
    // Actualizar los gráficos
    updateVibrationChartX();
    updateVibrationChartY();
    updateVibrationChartZ();
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('pdm-limits', JSON.stringify(stats));
    
    showToast('success', 'Límites guardados correctamente');
}

// Resetear límites a valores predeterminados
function resetLimits() {
    // Valores predeterminados para el eje X
    document.getElementById('x2SigmaLowerInput').value = '-2.364295';
    document.getElementById('x2SigmaUpperInput').value = '2.180056';
    document.getElementById('x3SigmaLowerInput').value = '-3.500383';
    document.getElementById('x3SigmaUpperInput').value = '3.316144';
    
    // Valores predeterminados para el eje Y
    document.getElementById('y2SigmaLowerInput').value = '7.177221';
    document.getElementById('y2SigmaUpperInput').value = '12.088666';
    document.getElementById('y3SigmaLowerInput').value = '5.949359';
    document.getElementById('y3SigmaUpperInput').value = '13.316528';
    
    // Valores predeterminados para el eje Z
    document.getElementById('z2SigmaLowerInput').value = '-2.389107';
    document.getElementById('z2SigmaUpperInput').value = '1.106510';
    document.getElementById('z3SigmaLowerInput').value = '-3.263011';
    document.getElementById('z3SigmaUpperInput').value = '1.980414';
    
    showToast('info', 'Límites restablecidos a valores predeterminados');
}

// Actualizar gráficos con nuevos límites
function updateChartsWithNewLimits(limits) {
    // Actualizar líneas de límites en los gráficos
    if (window.vibrationChartX) {
        // Buscar dataset de límites y actualizar
        window.vibrationChartX.data.datasets.forEach(dataset => {
            if (dataset.label.includes('2σ Superior')) {
                dataset.data = dataset.data.map(() => limits.sigma2Upper);
            } else if (dataset.label.includes('2σ Inferior')) {
                dataset.data = dataset.data.map(() => limits.sigma2Lower);
            } else if (dataset.label.includes('3σ Superior')) {
                dataset.data = dataset.data.map(() => limits.sigma3Upper);
            } else if (dataset.label.includes('3σ Inferior')) {
                dataset.data = dataset.data.map(() => limits.sigma3Lower);
            }
        });
        window.vibrationChartX.update();
    }
    
    // Hacer lo mismo para los otros gráficos
}

// Actualizar hora de última actualización
function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    document.getElementById('lastUpdateTime').textContent = timeStr;
}

// Manejar los botones de descarga de gráficos
function initChartDownloadButtons() {
    document.getElementById('downloadChartX').addEventListener('click', () => {
        downloadChart('vibrationChartX', 'vibracion-eje-x');
    });
    
    document.getElementById('downloadChartY').addEventListener('click', () => {
        downloadChart('vibrationChartY', 'vibracion-eje-y');
    });
    
    document.getElementById('downloadChartZ').addEventListener('click', () => {
        downloadChart('vibrationChartZ', 'vibracion-eje-z');
    });
    
    document.getElementById('downloadAlertsChart').addEventListener('click', () => {
        downloadChart('alertsHistoryChart', 'historial-alertas');
    });
}

// Función para descargar un gráfico como imagen
function downloadChart(chartId, filename) {
    const canvas = document.getElementById(chartId);
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ==========================================================================
// LÍMITES DE ACELERACIÓN
// ==========================================================================

/**
 * Inicializa la sección de límites de aceleración
 */
function initLimitsSection() {
    console.log("Inicializando sección de límites de aceleración...");
    
    // Cargar máquinas en el selector
    fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            const machineSelect = document.getElementById('limitsMachineSelect');
            if (machineSelect) {
                machineSelect.innerHTML = '<option value="">Seleccione una máquina</option>';
                machines.forEach(machine => {
                    const option = document.createElement('option');
                    option.value = machine.machine_id;
                    option.textContent = machine.name;
                    machineSelect.appendChild(option);
                });
                
                // Evento de cambio de máquina
                machineSelect.addEventListener('change', function() {
                    const machineId = this.value;
                    loadSensorsForLimits(machineId);
                    clearLimitsForm();
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar las máquinas:', error);
            showToast('danger', 'Error al cargar las máquinas');
        });
    
    // Inicializar botones
    const saveBtn = document.getElementById('limitsSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveLimitsConfig);
    }
    
    const resetBtn = document.getElementById('limitsResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetLimitsToDefault);
    }
    
    // Inicializar selector de sensores
    const sensorSelect = document.getElementById('limitsSensorSelect');
    if (sensorSelect) {
        sensorSelect.addEventListener('change', function() {
            const machineId = document.getElementById('limitsMachineSelect').value;
            const sensorId = this.value;
            if (machineId && sensorId) {
                loadLimitsForSensor(machineId, sensorId);
            } else {
                clearLimitsForm();
            }
        });
    }
}

/**
 * Carga los sensores para una máquina específica en el selector de límites
 */
function loadSensorsForLimits(machineId) {
    if (!machineId) {
        const sensorSelect = document.getElementById('limitsSensorSelect');
        if (sensorSelect) {
            sensorSelect.innerHTML = '<option value="">Seleccione un sensor</option>';
        }
        return;
    }
    
    fetch(`/api/sensors?machine_id=${machineId}`)
        .then(response => response.json())
        .then(sensors => {
            const sensorSelect = document.getElementById('limitsSensorSelect');
            if (sensorSelect) {
                sensorSelect.innerHTML = '<option value="">Seleccione un sensor</option>';
                sensors.forEach(sensor => {
                    const option = document.createElement('option');
                    option.value = sensor.sensor_id;
                    option.textContent = sensor.name;
                    sensorSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar los sensores:', error);
            showToast('danger', 'Error al cargar los sensores');
        });
}

/**
 * Carga los límites actuales para un sensor específico
 */
function loadLimitsForSensor(machineId, sensorId) {
    showLoadingToast('Cargando límites...');
    
    fetch(`/api/limits?machine_id=${machineId}&sensor_id=${sensorId}`)
        .then(response => {
            if (!response.ok) {
                // Si no hay límites específicos, usar los valores por defecto
                return fetch('/api/limits/default');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Llenar el formulario con los valores
            document.getElementById('x2SigmaLower').value = data.x.sigma2.lower;
            document.getElementById('x2SigmaUpper').value = data.x.sigma2.upper;
            document.getElementById('x3SigmaLower').value = data.x.sigma3.lower;
            document.getElementById('x3SigmaUpper').value = data.x.sigma3.upper;
            
            document.getElementById('y2SigmaLower').value = data.y.sigma2.lower;
            document.getElementById('y2SigmaUpper').value = data.y.sigma2.upper;
            document.getElementById('y3SigmaLower').value = data.y.sigma3.lower;
            document.getElementById('y3SigmaUpper').value = data.y.sigma3.upper;
            
            document.getElementById('z2SigmaLower').value = data.z.sigma2.lower;
            document.getElementById('z2SigmaUpper').value = data.z.sigma2.upper;
            document.getElementById('z3SigmaLower').value = data.z.sigma3.lower;
            document.getElementById('z3SigmaUpper').value = data.z.sigma3.upper;
        })
        .catch(error => {
            console.error('Error al cargar los límites:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar los límites: ' + error.message);
            
            // Limpiar el formulario en caso de error
            clearLimitsForm();
        });
}

/**
 * Limpia el formulario de límites
 */
function clearLimitsForm() {
    const inputs = [
        'x2SigmaLower', 'x2SigmaUpper', 'x3SigmaLower', 'x3SigmaUpper',
        'y2SigmaLower', 'y2SigmaUpper', 'y3SigmaLower', 'y3SigmaUpper',
        'z2SigmaLower', 'z2SigmaUpper', 'z3SigmaLower', 'z3SigmaUpper'
    ];
    
    inputs.forEach(id => {
        document.getElementById(id).value = '';
    });
}

/**
 * Guarda la configuración de límites
 */
function saveLimitsConfig() {
    const machineId = document.getElementById('limitsMachineSelect').value;
    const sensorId = document.getElementById('limitsSensorSelect').value;
    
    if (!machineId || !sensorId) {
        showToast('warning', 'Seleccione una máquina y un sensor');
        return;
    }
    
    // Recopilar valores del formulario
    const limitsData = {
        machine_id: machineId,
        sensor_id: sensorId,
        limits: {
            x: {
                sigma2: {
                    lower: parseFloat(document.getElementById('x2SigmaLower').value),
                    upper: parseFloat(document.getElementById('x2SigmaUpper').value)
                },
                sigma3: {
                    lower: parseFloat(document.getElementById('x3SigmaLower').value),
                    upper: parseFloat(document.getElementById('x3SigmaUpper').value)
                }
            },
            y: {
                sigma2: {
                    lower: parseFloat(document.getElementById('y2SigmaLower').value),
                    upper: parseFloat(document.getElementById('y2SigmaUpper').value)
                },
                sigma3: {
                    lower: parseFloat(document.getElementById('y3SigmaLower').value),
                    upper: parseFloat(document.getElementById('y3SigmaUpper').value)
                }
            },
            z: {
                sigma2: {
                    lower: parseFloat(document.getElementById('z2SigmaLower').value),
                    upper: parseFloat(document.getElementById('z2SigmaUpper').value)
                },
                sigma3: {
                    lower: parseFloat(document.getElementById('z3SigmaLower').value),
                    upper: parseFloat(document.getElementById('z3SigmaUpper').value)
                }
            }
        }
    };
    
    showLoadingToast('Guardando límites...');
    
    fetch('/api/limits/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(limitsData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar los límites');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        showToast('success', 'Límites guardados correctamente');
        
        // Actualizar las estadísticas globales si es el sensor actualmente seleccionado
        if (selectedMachine == machineId && selectedSensor == sensorId) {
            stats = data.limits;
            updateStatisticalDisplayValues();
            
            // Actualizar las gráficas
            updateVibrationChartX();
            updateVibrationChartY();
            updateVibrationChartZ();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al guardar los límites: ' + error.message);
    });
}

/**
 * Restablece los límites a los valores por defecto
 */
function resetLimitsToDefault() {
    const machineId = document.getElementById('limitsMachineSelect').value;
    const sensorId = document.getElementById('limitsSensorSelect').value;
    
    if (!machineId || !sensorId) {
        showToast('warning', 'Seleccione una máquina y un sensor');
        return;
    }
    
    showLoadingToast('Restableciendo límites por defecto...');
    
    fetch('/api/limits/default')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener los límites por defecto');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Llenar el formulario con los valores por defecto
            document.getElementById('x2SigmaLower').value = data.x.sigma2.lower;
            document.getElementById('x2SigmaUpper').value = data.x.sigma2.upper;
            document.getElementById('x3SigmaLower').value = data.x.sigma3.lower;
            document.getElementById('x3SigmaUpper').value = data.x.sigma3.upper;
            
            document.getElementById('y2SigmaLower').value = data.y.sigma2.lower;
            document.getElementById('y2SigmaUpper').value = data.y.sigma2.upper;
            document.getElementById('y3SigmaLower').value = data.y.sigma3.lower;
            document.getElementById('y3SigmaUpper').value = data.y.sigma3.upper;
            
            document.getElementById('z2SigmaLower').value = data.z.sigma2.lower;
            document.getElementById('z2SigmaUpper').value = data.z.sigma2.upper;
            document.getElementById('z3SigmaLower').value = data.z.sigma3.lower;
            document.getElementById('z3SigmaUpper').value = data.z.sigma3.upper;
            
            showToast('success', 'Límites restablecidos a los valores por defecto');
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al restablecer los límites: ' + error.message);
        });
}

// Resto del código de configuración... 

// ===================================================
// GESTIÓN DE SENSORES
// ===================================================

// Inicialización de la gestión de sensores
function initSensorManagement() {
  // Cargar lista de sensores
  loadSensorsTable();
  
  // Configurar evento para añadir nuevo sensor
  const addSensorBtn = document.getElementById('addSensorBtn');
  if (addSensorBtn) {
    addSensorBtn.addEventListener('click', () => {
      // Limpiar el formulario
      document.getElementById('sensorForm').reset();
      document.getElementById('sensorId').value = '';
      document.getElementById('sensorModalTitle').textContent = 'Nuevo Sensor';
      
      // Mostrar el modal
      const modal = document.getElementById('sensorModal');
      modal.classList.add('show');
    });
  }
  
  // Configurar evento para guardar sensor
  const saveSensorBtn = document.getElementById('saveSensorBtn');
  if (saveSensorBtn) {
    saveSensorBtn.addEventListener('click', saveSensor);
  }
  
  // Configurar eventos para cerrar modales (si no se han configurado ya)
  const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) modal.classList.remove('show');
    });
  });
}

// Cargar tabla de sensores
function loadSensorsTable() {
  fetch('/api/sensors')
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al cargar los sensores');
      }
      return response.json();
    })
    .then(sensors => {
      const tableBody = document.getElementById('sensorsTableBody');
      if (!tableBody) return;
      
      tableBody.innerHTML = '';
      
      if (sensors.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay sensores registrados</td></tr>';
        return;
      }
      
      // Procesar cada sensor
      sensors.forEach(sensor => {
        // Obtener el número de máquinas asociadas al sensor
        fetch(`/api/sensors/${sensor.sensor_id}/machines`)
          .then(response => response.json())
          .then(machines => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${sensor.sensor_id}</td>
              <td>${sensor.name}</td>
              <td>${sensor.description || '-'}</td>
              <td>
                <span class="badge">${machines.length} máquina(s)</span>
                ${machines.length > 0 ? 
                  `<button class="btn-icon view-machines" data-id="${sensor.sensor_id}" data-name="${sensor.name}">
                    <i class="fas fa-eye"></i>
                  </button>` : ''}
              </td>
              <td>
                <button class="btn-icon edit-sensor" data-id="${sensor.sensor_id}" title="Editar">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-sensor" data-id="${sensor.sensor_id}" title="Eliminar">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </td>
            `;
            
            tableBody.appendChild(row);
            
            // Añadir event listeners a los botones
            // (hacemos esto aquí para que se aplique a la fila recién añadida)
            const viewButton = row.querySelector('.view-machines');
            if (viewButton) {
              viewButton.addEventListener('click', () => {
                showSensorMachines(sensor.sensor_id, sensor.name);
              });
            }
            
            const editButton = row.querySelector('.edit-sensor');
            if (editButton) {
              editButton.addEventListener('click', () => {
                editSensor(sensor.sensor_id);
              });
            }
            
            const deleteButton = row.querySelector('.delete-sensor');
            if (deleteButton) {
              deleteButton.addEventListener('click', () => {
                deleteSensor(sensor.sensor_id);
              });
            }
          })
          .catch(error => {
            console.error(`Error al obtener máquinas para el sensor ${sensor.sensor_id}:`, error);
          });
      });
    })
    .catch(error => {
      console.error('Error al cargar sensores:', error);
      showToast('Error al cargar la lista de sensores', 'error');
    });
}

// Mostrar las máquinas asociadas a un sensor
function showSensorMachines(sensorId, sensorName) {
  fetch(`/api/sensors/${sensorId}/machines`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al cargar las máquinas asociadas');
      }
      return response.json();
    })
    .then(associatedMachines => {
      // Actualizar el título del modal
      const modalTitle = document.getElementById('sensorMachinesTitle');
      if (modalTitle) {
        modalTitle.textContent = `Máquinas asociadas a: ${sensorName}`;
      }
      
      // Actualizar la lista de máquinas
      const machinesList = document.getElementById('sensorMachinesList');
      if (machinesList) {
        machinesList.innerHTML = '';
        
        if (associatedMachines.length === 0) {
          machinesList.innerHTML = '<li class="list-group-item">No hay máquinas asociadas a este sensor</li>';
        } else {
          associatedMachines.forEach(machine => {
            const item = document.createElement('li');
            item.className = 'list-group-item';
            item.innerHTML = `
              <div class="d-flex justify-content-between align-items-center">
                <span><strong>${machine.name}</strong> - ${machine.description || 'Sin descripción'}</span>
                <span class="badge">${machine.status || 'Sin estado'}</span>
              </div>
            `;
            machinesList.appendChild(item);
          });
        }
      }
      
      // Mostrar el modal
      const modal = document.getElementById('sensorMachinesModal');
      if (modal) {
        modal.classList.add('show');
      }
    })
    .catch(error => {
      console.error('Error al cargar máquinas:', error);
      showToast('Error al cargar las máquinas asociadas', 'error');
    });
}

// Editar un sensor existente
function editSensor(sensorId) {
  fetch(`/api/sensors/${sensorId}`)
    .then(response => response.json())
    .then(sensor => {
      // Llenar formulario con datos del sensor
      document.getElementById('sensorId').value = sensor.sensor_id;
      document.getElementById('sensorName').value = sensor.name;
      document.getElementById('sensorDescription').value = sensor.description || '';
      
      // Actualizar título del modal
      document.getElementById('sensorModalTitle').textContent = 'Editar Sensor';
      
      // Mostrar el modal
      const modal = document.getElementById('sensorModal');
      modal.classList.add('show');
    })
    .catch(error => {
      console.error('Error al cargar sensor:', error);
      showToast('Error al cargar los datos del sensor', 'error');
    });
}

// Guardar sensor (crear o actualizar)
function saveSensor() {
  const sensorId = document.getElementById('sensorId').value;
  const form = document.getElementById('sensorForm');
  
  // Validar el formulario
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  // Preparar datos del formulario
  const name = document.getElementById('sensorName').value;
  const description = document.getElementById('sensorDescription').value;
  
  // Crear FormData para el envío
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  
  // Determinar si es una creación o actualización
  const isUpdate = !!sensorId;
  let url = '/api/sensors';
  let method = 'POST';
  
  if (isUpdate) {
    url = `/api/sensors/${sensorId}`;
    method = 'PUT';
  }
  
  // Enviar solicitud
  fetch(url, {
    method: method,
    body: formData
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al guardar el sensor');
      }
      return response.json();
    })
    .then(() => {
      // Cerrar modal
      const modal = document.getElementById('sensorModal');
      modal.classList.remove('show');
      
      // Recargar lista de sensores
      loadSensorsTable();
      
      // Mostrar mensaje de éxito
      const message = isUpdate ? 'Sensor actualizado correctamente' : 'Sensor creado correctamente';
      showToast(message, 'success');
    })
    .catch(error => {
      console.error('Error al guardar sensor:', error);
      showToast('Error al guardar el sensor', 'error');
    });
}

// Eliminar sensor
function deleteSensor(sensorId) {
  // Confirmar eliminación
  if (!confirm('¿Está seguro de que desea eliminar este sensor?')) {
    return;
  }
  
  fetch(`/api/sensors/${sensorId}`, {
    method: 'DELETE'
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al eliminar el sensor');
      }
      return response.json();
    })
    .then(() => {
      // Recargar lista de sensores
      loadSensorsTable();
      
      // Mostrar mensaje de éxito
      showToast('Sensor eliminado correctamente', 'success');
    })
    .catch(error => {
      console.error('Error al eliminar sensor:', error);
      showToast('Error al eliminar el sensor', 'error');
    });
}

// ==========================================================================
// GESTIÓN DE MODELOS
// ==========================================================================

// Cargar y mostrar la lista de modelos
function loadModels() {
  fetch('/api/models')
    .then(response => response.json())
    .then(models => {
      const tableBody = document.getElementById('modelsTableBody');
      if (!tableBody) return;
      
      tableBody.innerHTML = '';
      
      if (models.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="5" class="text-center">No hay modelos disponibles</td>`;
        tableBody.appendChild(emptyRow);
        return;
      }
      
      models.forEach(model => {
        // Formatear la fecha
        const date = new Date(model.last_update);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${model.model_id}</td>
          <td>${model.name}</td>
          <td>${model.description || 'Sin descripción'}</td>
          <td>${formattedDate}</td>
          <td>
            <div class="table-actions">
              <button class="btn-icon edit-model" data-id="${model.model_id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon delete-model" data-id="${model.model_id}">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        `;
        tableBody.appendChild(row);
      });
      
      // Agregar event listeners a los botones de editar y eliminar
      addModelActionListeners();
      
      // También recargar los modelos en los selectores
      loadModelsForSelect();
    })
    .catch(error => {
      console.error('Error al cargar modelos:', error);
      showToast('Error al cargar los modelos', 'error');
    });
}

// Agregar listeners a los botones de acciones de modelos
function addModelActionListeners() {
  // Botones de editar
  document.querySelectorAll('.edit-model').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modelId = e.currentTarget.getAttribute('data-id');
      openModelModal('edit', modelId);
    });
  });
  
  // Botones de eliminar
  document.querySelectorAll('.delete-model').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modelId = e.currentTarget.getAttribute('data-id');
      document.getElementById('deleteModelId').value = modelId;
      openModal('deleteModelModal');
    });
  });
}

// Abrir modal para crear o editar modelo
async function openModelModal(mode, modelId = null) {
  const modal = document.getElementById('modelModal');
  const title = document.getElementById('modelModalTitle');
  const form = document.getElementById('modelForm');
  const modelFileRequired = document.getElementById('modelFileRequired');
  const modelFileOptional = document.getElementById('modelFileOptional');
  
  // Resetear el formulario
  form.reset();
  document.getElementById('modelId').value = '';
  document.getElementById('modelFileName').textContent = 'Ningún archivo seleccionado';
  document.getElementById('scalerFileName').textContent = 'Ningún archivo seleccionado';
  
  if (mode === 'add') {
    title.textContent = 'Añadir Modelo';
    modelFileRequired.style.display = 'block';
    modelFileOptional.style.display = 'none';
  } else if (mode === 'edit') {
    title.textContent = 'Editar Modelo';
    modelFileRequired.style.display = 'none';
    modelFileOptional.style.display = 'block';
    
    try {
      const response = await fetch(`/api/models/${modelId}`);
      if (!response.ok) throw new Error('No se pudo cargar el modelo');
      
      const model = await response.json();
      
      // Llenar el formulario con los datos del modelo
      document.getElementById('modelId').value = model.model_id;
      document.getElementById('modelName').value = model.name;
      document.getElementById('modelDescription').value = model.description || '';
    } catch (error) {
      console.error('Error al cargar datos del modelo:', error);
      showToast('Error al cargar los datos del modelo', 'error');
      closeModal('modelModal');
      return;
    }
  }
  
  openModal('modelModal');
}

// Manejar la visibilidad del nombre del archivo seleccionado
function setupFileInputs() {
  // Para el archivo del modelo
  const modelFileInput = document.getElementById('modelFile');
  if (modelFileInput) {
    modelFileInput.addEventListener('change', (e) => {
      const fileName = e.target.files[0] ? e.target.files[0].name : 'Ningún archivo seleccionado';
      document.getElementById('modelFileName').textContent = fileName;
    });
  }
  
  // Para el archivo del escalador
  const scalerFileInput = document.getElementById('scalerFile');
  if (scalerFileInput) {
    scalerFileInput.addEventListener('change', (e) => {
      const fileName = e.target.files[0] ? e.target.files[0].name : 'Ningún archivo seleccionado';
      document.getElementById('scalerFileName').textContent = fileName;
    });
  }
  
  // Botones personalizados para seleccionar archivos
  document.querySelectorAll('.custom-file-button').forEach((button, index) => {
    button.addEventListener('click', () => {
      const fileInput = button.parentElement.querySelector('.custom-file-input');
      if (fileInput) fileInput.click();
    });
  });
}

// Guardar un modelo (crear o actualizar)
async function saveModel() {
  const form = document.getElementById('modelForm');
  const modelId = document.getElementById('modelId').value;
  const modelName = document.getElementById('modelName').value;
  const modelDescription = document.getElementById('modelDescription').value;
  const modelFile = document.getElementById('modelFile').files[0];
  const scalerFile = document.getElementById('scalerFile').files[0];
  
  // Validación básica
  if (!modelName.trim()) {
    showToast('El nombre del modelo es obligatorio', 'error');
    return;
  }
  
  // Si es un nuevo modelo, el archivo es obligatorio
  if (!modelId && !modelFile) {
    showToast('Debe seleccionar un archivo .h5 para el modelo', 'error');
    return;
  }
  
  try {
    // Crear un FormData para enviar archivos
    const formData = new FormData();
    formData.append('name', modelName);
    if (modelDescription) formData.append('description', modelDescription);
    if (modelFile) formData.append('model_file', modelFile);
    if (scalerFile) formData.append('scaler_file', scalerFile);
    
    // Determinar si es crear o actualizar
    let url = '/api/models';
    let method = 'POST';
    
    if (modelId) {
      url = `/api/models/${modelId}`;
      method = 'PUT';
    }
    
    const response = await fetch(url, {
      method: method,
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Error al guardar el modelo');
    }
    
    const result = await response.json();
    
    showToast(result.message || 'Modelo guardado correctamente', 'success');
    closeModal('modelModal');
    loadModels(); // Recargar la lista de modelos
  } catch (error) {
    console.error('Error al guardar el modelo:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Eliminar un modelo
async function deleteModel() {
  const modelId = document.getElementById('deleteModelId').value;
  
  if (!modelId) {
    showToast('ID de modelo no válido', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/models/${modelId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Error al eliminar el modelo');
    }
    
    const result = await response.json();
    
    showToast(result.message || 'Modelo eliminado correctamente', 'success');
    closeModal('deleteModelModal');
    loadModels(); // Recargar la lista de modelos
  } catch (error) {
    console.error('Error al eliminar el modelo:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

// ==========================================================================
// INICIALIZACIÓN Y EVENT LISTENERS GENERALES
// ==========================================================================

// ... existing code ...

// Inicializar la gestión de modelos
document.getElementById('addModelBtn')?.addEventListener('click', () => openModelModal('add'));
document.getElementById('saveModelBtn')?.addEventListener('click', saveModel);
document.getElementById('confirmDeleteModelBtn')?.addEventListener('click', deleteModel);

// Configurar los inputs de archivo
setupFileInputs();

// Cargar datos al iniciar
// ... existing code ...
loadModels();

// ... existing code ...