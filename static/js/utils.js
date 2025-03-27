/**
 * PdM-Manager - JavaScript Utilidades v1.0.0
 * Funciones de utilidad y componentes UI comunes
 * 
 * Última actualización: 2023-09-15
 */

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
// GESTIÓN DE VARIABLES GLOBALES
// ==========================================================================

// Objeto centralizado para variables globales compartidas entre módulos
const globalState = {
    // Máquinas y sensores seleccionados
    selectedMachine: '',
    selectedSensor: '',
    timeRange: '24h',
    
    // Estadísticas y límites
    stats: {
        x: {
            sigma2: { lower: -2.364295, upper: 2.180056 },
            sigma3: { lower: -3.500383, upper: 3.316144 }
        },
        y: {
            sigma2: { lower: 7.177221, upper: 12.088666 },
            sigma3: { lower: 5.949359, upper: 13.316528 }
        },
        z: {
            sigma2: { lower: -2.389107, upper: 1.106510 },
            sigma3: { lower: -3.263011, upper: 1.980414 }
        }
    },
    
    // Opciones de visualización
    chartOptions: {
        showMean: true,
        showSigmaLines: true
    },
    
    // Estado de simulación
    simulation: {
        running: false,
        timer: null
    }
};

// Funciones para acceder y modificar el estado global
function getGlobalState(key) {
    if (key) {
        return globalState[key];
    }
    return globalState;
}

function setGlobalState(key, value) {
    if (key && value !== undefined) {
        globalState[key] = value;
        // Disparar evento para notificar cambios a otros módulos
        dispatchGlobalStateChange(key, value);
        return true;
    }
    return false;
}

function updateGlobalStats(newStats) {
    if (newStats && typeof newStats === 'object') {
        globalState.stats = {...globalState.stats, ...newStats};
        dispatchGlobalStateChange('stats', globalState.stats);
        return true;
    }
    return false;
}

// Evento personalizado para notificar cambios en estado global
function dispatchGlobalStateChange(key, value) {
    const event = new CustomEvent('globalStateChange', {
        detail: { key, value, timestamp: new Date() }
    });
    document.dispatchEvent(event);
}

// Función para inicializar los eventos de cambios de estado global
function initGlobalStateEvents() {
    // Escuchar eventos de cambios de estado global
    document.addEventListener('globalStateChange', (e) => {
        const { key, value } = e.detail;
        console.log(`Estado global actualizado: ${key}`, value);
        
        // Funciones específicas para reaccionar ante cambios
        switch (key) {
            case 'stats':
                // Actualizar valores estadísticos visuales si existe la función
                if (typeof updateStatisticalDisplayValues === 'function') {
                    updateStatisticalDisplayValues();
                }
                break;
            case 'chartOptions':
                // Actualizar visibilidad de elementos en gráficos
                if (typeof updateChartsVisibility === 'function') {
                    updateChartsVisibility();
                }
                break;
            case 'selectedMachine':
            case 'selectedSensor':
            case 'timeRange':
                // Estas actualizaciones se manejan en cada módulo específico
                break;
        }
    });
}

// Exponer funciones globales para acceso desde otros módulos
window.getGlobalState = getGlobalState;
window.setGlobalState = setGlobalState;
window.updateGlobalStats = updateGlobalStats;
window.initGlobalStateEvents = initGlobalStateEvents;

// ==========================================================================
// NOTIFICACIONES Y TOASTS
// ==========================================================================

// Mostrar toast de notificación
function showToast(message, type = 'info') {
    // Eliminar toasts anteriores si existen
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
        toast.remove();
    });

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-up`;
    
    // Iconos según el tipo
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'error') icon = 'times-circle';
    
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
    
    document.body.appendChild(toast);
    
    // Evento para cerrar el toast
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeToast(toast));
    }
    
    // Auto cerrar después de 5 segundos
    setTimeout(() => {
        closeToast(toast);
    }, 5000);
}

// Cerrar toast
function closeToast(toast) {
    if (!toast) return;
    
    toast.classList.add('animate-fade-out');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// ==========================================================================
// INDICADORES DE CARGA
// ==========================================================================

// Mostrar indicador de carga global
function showLoadingIndicator(message = 'Cargando...') {
    const loader = document.createElement('div');
    loader.className = 'global-loader';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(loader);
}

// Ocultar indicador de carga global
function hideLoadingIndicator() {
    const loader = document.querySelector('.global-loader');
    if (loader) {
        loader.remove();
    }
}

// Mostrar toast de carga
function showLoadingToast(message = 'Procesando...') {
    // Eliminar loading toasts previos
    const existingLoadingToasts = document.querySelectorAll('.toast-loading');
    existingLoadingToasts.forEach(toast => {
        toast.remove();
    });
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-loading animate-slide-up';
    toast.id = 'loadingToast';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <div class="spinner-mini"></div>
        </div>
        <div class="toast-content">
            <p id="loadingToastMessage">${message}</p>
            <div class="progress">
                <div class="progress-bar" id="loadingProgress" style="width: 0%"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animar la barra de progreso
    let progress = 0;
    const progressBar = document.getElementById('loadingProgress');
    
    if (progressBar) {
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 5;
                progressBar.style.width = `${progress}%`;
            }
        }, 300);
        
        // Guardar el intervalo para poder limpiarlo después
        toast.dataset.progressInterval = progressInterval;
    }
}

// Ocultar toast de carga
function hideLoadingToast() {
    const toast = document.getElementById('loadingToast');
    if (!toast) return;
    
    // Completar la barra de progreso
    const progressBar = document.getElementById('loadingProgress');
    if (progressBar) {
        progressBar.style.width = '100%';
    }
    
    // Limpiar el intervalo de progreso
    if (toast.dataset.progressInterval) {
        clearInterval(parseInt(toast.dataset.progressInterval));
    }
    
    // Esperar un momento para que se vea completo
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 500);
}

// ==========================================================================
// INICIALIZACIÓN DE COMPONENTES UI
// ==========================================================================

// Inicializar tema oscuro
function initDarkTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
}

// Inicializar tooltips
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            const tooltipText = element.getAttribute('data-tooltip');
            
            // Crear tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipText;
            
            // Posicionar tooltip
            const rect = element.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) + 'px';
            tooltip.style.top = rect.top - 8 + 'px';
            
            // Añadir al DOM
            document.body.appendChild(tooltip);
            
            // Animar
            setTimeout(() => {
                tooltip.classList.add('show');
            }, 10);
            
            // Guardar referencia
            element.tooltipElement = tooltip;
        });
        
        element.addEventListener('mouseleave', () => {
            if (element.tooltipElement) {
                element.tooltipElement.classList.remove('show');
                
                setTimeout(() => {
                    if (element.tooltipElement && element.tooltipElement.parentNode) {
                        element.tooltipElement.parentNode.removeChild(element.tooltipElement);
                        element.tooltipElement = null;
                    }
                }, 200);
            }
        });
    });
}

// Inicializar dropdowns
function initDropdowns() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.filter-dropdown-toggle');
        const menu = dropdown.querySelector('.filter-dropdown-menu');
        
        if (!toggle || !menu) return;
        
        // Toggle dropdown al hacer clic
        toggle.addEventListener('click', () => {
            // Cerrar otros dropdowns
            document.querySelectorAll('.filter-dropdown-menu.show').forEach(openMenu => {
                if (openMenu !== menu) {
                    openMenu.classList.remove('show');
                }
            });
            
            menu.classList.toggle('show');
        });
        
        // Manejar selección de items
        const items = menu.querySelectorAll('.filter-dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                // Actualizar selección
                menu.querySelectorAll('.filter-dropdown-item.selected').forEach(selectedItem => {
                    selectedItem.classList.remove('selected');
                });
                
                item.classList.add('selected');
                
                // Actualizar texto del toggle
                const textElement = toggle.querySelector('span');
                if (textElement) {
                    textElement.textContent = item.textContent;
                }
                
                // Cerrar dropdown
                menu.classList.remove('show');
                
                // Disparar evento de cambio
                const event = new CustomEvent('dropdown-change', {
                    detail: {
                        dropdownId: dropdown.id,
                        value: item.getAttribute('data-value')
                    }
                });
                document.dispatchEvent(event);
            });
        });
        
        // Cerrar dropdown al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                menu.classList.remove('show');
            }
        });
    });
}

// Inicializar switches
function initSwitches() {
    const switches = document.querySelectorAll('.custom-switch input[type="checkbox"]');
    
    switches.forEach(switchEl => {
        switchEl.addEventListener('change', () => {
            updateChartsVisibility();
        });
    });
}

// Actualizar visibilidad de elementos en gráficos
function updateChartsVisibility() {
    // Obtener estados de los switches
    const showMean = document.getElementById('showMean')?.checked || false;
    const show1Sigma = document.getElementById('show1Sigma')?.checked || false;
    const show2Sigma = document.getElementById('show2Sigma')?.checked || false;
    const show3Sigma = document.getElementById('show3Sigma')?.checked || false;
    
    // Si están disponibles los gráficos de vibración, actualizar visibilidad
    if (typeof updateVibrationChartX === 'function' && 
        typeof updateVibrationChartY === 'function' && 
        typeof updateVibrationChartZ === 'function') {
        
        // Actualizar configuración global
        window.showMean = showMean;
        window.showSigmaLines = show1Sigma || show2Sigma || show3Sigma;
        
        // Actualizar cada eje del gráfico
        updateVibrationChartX();
        updateVibrationChartY();
        updateVibrationChartZ();
    }
}

// Actualizar tiempo de última actualización
function updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdateTime');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = new Date().toLocaleTimeString();
    }
}

// Inicializar tema según preferencias del usuario
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggle');
    if (!themeToggleBtn) return;
    
    // Cargar preferencia almacenada
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    // Actualizar icono del botón
    const themeIcon = themeToggleBtn.querySelector('i');
    if (themeIcon) {
        themeIcon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Manejar cambio de tema
    themeToggleBtn.addEventListener('click', () => {
        const currentDarkMode = document.body.classList.contains('dark-mode');
        document.body.classList.toggle('dark-mode');
        
        // Guardar preferencia
        localStorage.setItem('darkMode', !currentDarkMode);
        
        // Actualizar icono
        if (themeIcon) {
            themeIcon.className = !currentDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        }
    });
}

// Inicializar componentes específicos de la página
function initPageSpecificComponents() {
    const currentPage = getCurrentPage();
    
    // Usar la función centralizada en navigation.js
    if (typeof initPageContent === 'function') {
        initPageContent(currentPage);
    }
}

// Inicializar la UI global
function initUI() {
    // Inicializar tema
    initDarkTheme();
    
    // Inicializar componentes generales
    initTooltips();
    initDropdowns();
    initSwitches();
    initThemeToggle();
    
    // Inicializar componentes específicos de la página
    initPageSpecificComponents();
}

// Exportar funciones para uso global
window.showToast = showToast;
window.closeToast = closeToast;
window.showLoadingIndicator = showLoadingIndicator;
window.hideLoadingIndicator = hideLoadingIndicator;
window.showLoadingToast = showLoadingToast;
window.hideLoadingToast = hideLoadingToast;
window.initUI = initUI;
window.initTooltips = initTooltips;
window.initDropdowns = initDropdowns;
window.initSwitches = initSwitches;
window.updateChartsVisibility = updateChartsVisibility;
window.updateLastUpdateTime = updateLastUpdateTime;
window.initThemeToggle = initThemeToggle;
window.SEVERITY_COLORS = SEVERITY_COLORS;
window.cache = cache; 