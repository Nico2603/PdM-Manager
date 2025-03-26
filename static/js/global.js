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
    mean: 0,
    stdDev: 1,
    sigma2: { 
        lower: -2.0, 
        upper: 2.0 
    },
    sigma3: { 
        lower: -3.0, 
        upper: 3.0 
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

// ==========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initAdjustLimitsModal();
    initChartDownloadButtons();
    
    // Simulación inicial de carga
    showLoadingOverlay();
    setTimeout(() => {
        hideLoadingOverlay();
        showToast('Datos cargados correctamente', 'success');
    }, 1500);
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
    const currentPath = window.location.pathname;
    let activePage = 'dashboard';
    
    if (currentPath.includes('configuracion')) {
        activePage = 'configuracion';
    } else if (currentPath.includes('alertas')) {
        activePage = 'alertas';
    } else if (currentPath.includes('modelos')) {
        activePage = 'modelos';
    } else if (currentPath.includes('sensores')) {
        activePage = 'sensores';
    } else if (currentPath.includes('ajustes')) {
        activePage = 'ajustes';
    }
    
    // Ajustar la navegación basada en la URL
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        
        if (linkPage === activePage) {
            link.classList.add('active');
            // Activar la sección correspondiente
            showSection(activePage);
        }
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });
    
    // Exponer la función navigateTo globalmente
    window.navigateTo = navigateTo;
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
    const targetSection = document.getElementById(page + 'Section');
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
    const targetSection = document.getElementById(sectionId + 'Section');
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
 * Inicializa componentes específicos según la página actual
 */
function initPageSpecificComponents() {
    const currentPage = getCurrentPage();
    switch (currentPage) {
        case 'dashboard':
            initDashboard();
            break;
        case 'configuracion':
            initConfig();
            break;
        case 'alertas':
            initAlerts();
            break;
        case 'analitica':
            initModels();
            break;
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
    const meanToggle = document.getElementById('showMeanToggle');
    const sigmaToggle = document.getElementById('showSigmaToggle');
    
    if (meanToggle) {
        meanToggle.addEventListener('change', function() {
            showMean = this.checked;
            updateVibrationChartX();
            updateVibrationChartY();
            updateVibrationChartZ();
        });
    }
    
    if (sigmaToggle) {
        sigmaToggle.addEventListener('change', function() {
            showSigmaLines = this.checked;
            updateVibrationChartX();
            updateVibrationChartY();
            updateVibrationChartZ();
        });
    }
}

/**
 * Carga los datos iniciales para el dashboard
 */
function loadInitialData() {
    // Cargar máquinas disponibles
    loadMachines();
    
    // Actualizar datos del dashboard
    updateDashboardData();
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
    if (!machineId) return;
    
    showLoadingToast('Cargando sensores...');
    
    fetch(`/api/machines/${machineId}/sensors`)
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
            
            // Añadir sensores
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
            
            // Si no hay sensor seleccionado, seleccionar el primero
            if (!selectedSensor && data.sensors.length > 0) {
                selectedSensor = data.sensors[0].id;
                const selectedText = sensorDropdown.querySelector('span');
                if (selectedText) {
                    selectedText.textContent = data.sensors[0].name;
                }
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
    if (!selectedMachine || !selectedSensor) return;
    
    showLoadingToast('Actualizando datos...');
    
    fetch(`/api/data?machine=${selectedMachine}&sensor=${selectedSensor}&timeRange=${timeRange}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar los datos');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
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
    updateStatDisplayValue('x2SigmaLowerDisplay', stats.sigma2.lower);
    updateStatDisplayValue('x2SigmaUpperDisplay', stats.sigma2.upper);
    updateStatDisplayValue('x3SigmaLowerDisplay', stats.sigma3.lower);
    updateStatDisplayValue('x3SigmaUpperDisplay', stats.sigma3.upper);
    
    // Actualizar valores para el eje Y
    updateStatDisplayValue('y2SigmaLowerDisplay', stats.sigma2.lower);
    updateStatDisplayValue('y2SigmaUpperDisplay', stats.sigma2.upper);
    updateStatDisplayValue('y3SigmaLowerDisplay', stats.sigma3.lower);
    updateStatDisplayValue('y3SigmaUpperDisplay', stats.sigma3.upper);
    
    // Actualizar valores para el eje Z
    updateStatDisplayValue('z2SigmaLowerDisplay', stats.sigma2.lower);
    updateStatDisplayValue('z2SigmaUpperDisplay', stats.sigma2.upper);
    updateStatDisplayValue('z3SigmaLowerDisplay', stats.sigma3.lower);
    updateStatDisplayValue('z3SigmaUpperDisplay', stats.sigma3.upper);
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
    
    // Actualizar línea de media
    if (showMean) {
        const meanValue = stats.mean;
        chart.data.datasets[1].data = Array(chartData.timestamps.length).fill(meanValue);
    } else {
        chart.data.datasets[1].data = [];
    }
    
    // Actualizar líneas de límites estadísticos
    if (showSigmaLines) {
        // Límites 2σ
        chart.data.datasets[2].data = Array(chartData.timestamps.length).fill(stats.sigma2.upper);
        chart.data.datasets[3].data = Array(chartData.timestamps.length).fill(stats.sigma2.lower);
        
        // Límites 3σ
        chart.data.datasets[4].data = Array(chartData.timestamps.length).fill(stats.sigma3.upper);
        chart.data.datasets[5].data = Array(chartData.timestamps.length).fill(stats.sigma3.lower);
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
    // Inicializar formulario de configuración
    initConfigForm();
    
    // Inicializar listado de configuraciones
    loadConfigList();
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
// ALERTAS
// ==========================================================================

/**
 * Inicializa la sección de alertas
 */
function initAlerts() {
    // Cargar listado de alertas
    loadAlertsList();
    
    // Inicializar filtros de alertas
    initAlertFilters();
}

/**
 * Carga la lista de alertas
 */
function loadAlertsList(filters = {}) {
    const alertsList = document.getElementById('alertsList');
    
    if (!alertsList) return;
    
    showLoadingToast('Cargando alertas...');
    
    // Construir query string con filtros
    const queryParams = new URLSearchParams();
    
    if (filters.machine) queryParams.append('machine', filters.machine);
    if (filters.sensor) queryParams.append('sensor', filters.sensor);
    if (filters.severity) queryParams.append('severity', filters.severity);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    fetch(`/api/alerts/list?${queryParams.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar las alertas');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Limpiar lista actual
            alertsList.innerHTML = '';
            
            // Añadir alertas
            if (data.alerts.length === 0) {
                alertsList.innerHTML = '<tr><td colspan="6" class="text-center">No hay alertas disponibles</td></tr>';
                return;
            }
            
            data.alerts.forEach(alert => {
                const row = document.createElement('tr');
                
                // Clase según severidad
                let severityClass = '';
                let severityText = '';
                
                switch (alert.severity) {
                    case 1:
                        severityClass = 'severity-1';
                        severityText = 'Nivel 1';
                        break;
                    case 2:
                        severityClass = 'severity-2';
                        severityText = 'Nivel 2';
                        break;
                    case 3:
                        severityClass = 'severity-3';
                        severityText = 'Nivel 3';
                        break;
                    default:
                        severityClass = '';
                        severityText = 'Normal';
                }
                
                // Formatear fecha
                const date = new Date(alert.timestamp);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${alert.machine_name}</td>
                    <td>${alert.sensor_name}</td>
                    <td><span class="severity-badge ${severityClass}">${severityText}</span></td>
                    <td>${alert.message || '-'}</td>
                    <td>
                        <button class="btn-icon view-alert" data-id="${alert.id}" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon acknowledge-alert" data-id="${alert.id}" title="Reconocer">
                            <i class="fas fa-check"></i>
                        </button>
                    </td>
                `;
                
                alertsList.appendChild(row);
            });
            
            // Inicializar eventos de acciones
            initAlertActions();
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar las alertas: ' + error.message);
        });
}

/**
 * Inicializa los filtros de alertas
 */
function initAlertFilters() {
    const filterForm = document.getElementById('alertFilterForm');
    
    if (!filterForm) return;
    
    filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        // Recopilar datos de filtros
        const machineFilter = document.getElementById('machineFilter').value;
        const sensorFilter = document.getElementById('sensorFilter').value;
        const severityFilter = document.getElementById('severityFilter').value;
        const dateFromFilter = document.getElementById('dateFromFilter').value;
        const dateToFilter = document.getElementById('dateToFilter').value;
        
        // Aplicar filtros
        loadAlertsList({
            machine: machineFilter,
            sensor: sensorFilter,
            severity: severityFilter,
            dateFrom: dateFromFilter,
            dateTo: dateToFilter
        });
    });
    
    // Botón de resetear filtros
    const resetBtn = document.getElementById('resetFiltersBtn');
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            filterForm.reset();
            loadAlertsList();
        });
    }
}

/**
 * Inicializa eventos de acciones en la lista de alertas
 */
function initAlertActions() {
    // Botones de ver detalles
    const viewButtons = document.querySelectorAll('.view-alert');
    
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const alertId = button.getAttribute('data-id');
            viewAlertDetails(alertId);
        });
    });
    
    // Botones de reconocer alerta
    const ackButtons = document.querySelectorAll('.acknowledge-alert');
    
    ackButtons.forEach(button => {
        button.addEventListener('click', () => {
            const alertId = button.getAttribute('data-id');
            acknowledgeAlert(alertId);
        });
    });
}

/**
 * Muestra los detalles de una alerta
 */
function viewAlertDetails(alertId) {
    showLoadingToast('Cargando detalles de alerta...');
    
    fetch(`/api/alerts/${alertId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar los detalles de la alerta');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingToast();
            
            // Mostrar modal de detalles
            const modal = document.getElementById('alertDetailsModal');
            
            if (!modal) return;
            
            // Formatear severidad
            let severityText = 'Normal';
            switch (data.severity) {
                case 1:
                    severityText = 'Nivel 1';
                    break;
                case 2:
                    severityText = 'Nivel 2';
                    break;
                case 3:
                    severityText = 'Nivel 3';
                    break;
            }
            
            // Formatear fecha
            const date = new Date(data.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            // Actualizar contenido del modal
            const modalContent = modal.querySelector('.alert-details-content');
            
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="alert-detail-item">
                        <span>Fecha:</span> ${formattedDate}
                    </div>
                    <div class="alert-detail-item">
                        <span>Máquina:</span> ${data.machine_name}
                    </div>
                    <div class="alert-detail-item">
                        <span>Sensor:</span> ${data.sensor_name}
                    </div>
                    <div class="alert-detail-item">
                        <span>Severidad:</span> <span class="severity-badge severity-${data.severity}">${severityText}</span>
                    </div>
                    <div class="alert-detail-item">
                        <span>Mensaje:</span> ${data.message || '-'}
                    </div>
                    <div class="alert-detail-item">
                        <span>Valores:</span>
                        <ul>
                            <li>X: ${data.values?.x.toFixed(3) || 'N/A'}</li>
                            <li>Y: ${data.values?.y.toFixed(3) || 'N/A'}</li>
                            <li>Z: ${data.values?.z.toFixed(3) || 'N/A'}</li>
                        </ul>
                    </div>
                    <div class="alert-detail-item">
                        <span>Estado:</span> ${data.acknowledged ? 'Reconocida' : 'No reconocida'}
                    </div>
                `;
            }
            
            // Mostrar modal
            modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingToast();
            showToast('danger', 'Error al cargar los detalles de la alerta: ' + error.message);
        });
}

/**
 * Reconoce una alerta
 */
function acknowledgeAlert(alertId) {
    showLoadingToast('Reconociendo alerta...');
    
    fetch(`/api/alerts/acknowledge/${alertId}`, {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al reconocer la alerta');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingToast();
        
        // Recargar lista de alertas
        loadAlertsList();
        
        showToast('success', 'Alerta reconocida correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingToast();
        showToast('danger', 'Error al reconocer la alerta: ' + error.message);
    });
}

// ==========================================================================
// SENSORES
// ==========================================================================

/**
 * Inicializa la sección de sensores
 */
function initSensors() {
    // Cargar listado de sensores
    loadSensorsList();
    
    // Inicializar formulario de sensores
    initSensorForm();
}

/**
 * Carga la lista de sensores
 */
function loadSensorsList() {
    // Implementación similar a las otras listas
    // ...
}

// ==========================================================================
// MODELOS PREDICTIVOS
// ==========================================================================

/**
 * Inicializa la sección de modelos predictivos
 */
function initModels() {
    // Cargar listado de modelos
    loadModelsList();
    
    // Inicializar formulario de modelos
    initModelForm();
    
    // Inicializar gráficos de rendimiento de modelos
    initModelPerformanceCharts();
}

/**
 * Carga la lista de modelos
 */
function loadModelsList() {
    // Implementación similar a las otras listas
    // ...
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
    initSidebar();
    initThemeToggle();
    initFilters();
    initTooltips();
    
    // Actualizar hora de última actualización
    updateLastUpdateTime();
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
    const showMean = document.getElementById('showMean').checked;
    const show1Sigma = document.getElementById('show1Sigma').checked;
    const show2Sigma = document.getElementById('show2Sigma').checked;
    const show3Sigma = document.getElementById('show3Sigma').checked;
    
    // Aquí podemos agregar código para actualizar la visibilidad de los elementos en los gráficos
    // según los switches seleccionados
    if (window.vibrationChartX) {
        // Ejemplo para el gráfico X
        window.vibrationChartX.data.datasets.forEach(dataset => {
            if (dataset.label.includes('Media')) {
                dataset.hidden = !showMean;
            } else if (dataset.label.includes('1σ')) {
                dataset.hidden = !show1Sigma;
            } else if (dataset.label.includes('2σ')) {
                dataset.hidden = !show2Sigma;
            } else if (dataset.label.includes('3σ')) {
                dataset.hidden = !show3Sigma;
            }
        });
        window.vibrationChartX.update();
    }
    
    // Repetir para los otros gráficos
    if (window.vibrationChartY) {
        // Actualizar gráfico Y
        window.vibrationChartY.update();
    }
    
    if (window.vibrationChartZ) {
        // Actualizar gráfico Z
        window.vibrationChartZ.update();
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
    // Aquí obtendríamos los valores actuales de alguna fuente (API, localStorage, etc.)
    document.getElementById('sigma2LowerInput').value = document.getElementById('sigma2LowerValue').textContent.split('m/s²')[0];
    document.getElementById('sigma2UpperInput').value = document.getElementById('sigma2UpperValue').textContent.split('m/s²')[0];
    document.getElementById('sigma3LowerInput').value = document.getElementById('sigma3LowerValue').textContent.split('m/s²')[0];
    document.getElementById('sigma3UpperInput').value = document.getElementById('sigma3UpperValue').textContent.split('m/s²')[0];
}

// Guardar nuevos límites
function saveLimits() {
    // Obtener valores del formulario
    const sigma2Lower = document.getElementById('sigma2LowerInput').value;
    const sigma2Upper = document.getElementById('sigma2UpperInput').value;
    const sigma3Lower = document.getElementById('sigma3LowerInput').value;
    const sigma3Upper = document.getElementById('sigma3UpperInput').value;
    
    // Validar que sean valores numéricos
    if (isNaN(sigma2Lower) || isNaN(sigma2Upper) || isNaN(sigma3Lower) || isNaN(sigma3Upper)) {
        showToast('Todos los valores deben ser numéricos', 'danger');
        return;
    }
    
    // Actualizar los valores mostrados
    document.getElementById('sigma2LowerValue').innerHTML = sigma2Lower + '<span class="stat-unit">m/s²</span>';
    document.getElementById('sigma2UpperValue').innerHTML = sigma2Upper + '<span class="stat-unit">m/s²</span>';
    document.getElementById('sigma3LowerValue').innerHTML = sigma3Lower + '<span class="stat-unit">m/s²</span>';
    document.getElementById('sigma3UpperValue').innerHTML = sigma3Upper + '<span class="stat-unit">m/s²</span>';
    
    // Aquí enviaríamos los datos a la API o los guardaríamos en localStorage
    // Ejemplo de guardado en localStorage
    const limits = {
        sigma2Lower,
        sigma2Upper,
        sigma3Lower,
        sigma3Upper
    };
    localStorage.setItem('pdm-limits', JSON.stringify(limits));
    
    // Actualizar los gráficos con los nuevos límites
    updateChartsWithNewLimits(limits);
    
    showToast('Límites guardados correctamente', 'success');
}

// Resetear límites a valores predeterminados
function resetLimits() {
    // Valores predeterminados (ejemplo)
    const defaultLimits = {
        sigma2Lower: '-2.364',
        sigma2Upper: '2.180',
        sigma3Lower: '-3.500',
        sigma3Upper: '3.316'
    };
    
    // Actualizar inputs del formulario
    document.getElementById('sigma2LowerInput').value = defaultLimits.sigma2Lower;
    document.getElementById('sigma2UpperInput').value = defaultLimits.sigma2Upper;
    document.getElementById('sigma3LowerInput').value = defaultLimits.sigma3Lower;
    document.getElementById('sigma3UpperInput').value = defaultLimits.sigma3Upper;
    
    showToast('Límites restablecidos a valores predeterminados', 'info');
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

// Fin de archivo 