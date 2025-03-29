/**
 * PdM-Manager - JavaScript Utilidades v2.0.0
 * Funciones de utilidad y componentes UI comunes
 * 
 * Última actualización: 2024-03-29
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
    return { ...globalState }; // Devolver copia para evitar modificaciones directas
}

function setGlobalState(key, value) {
    if (!key) {
        console.error('Error: Se intentó establecer estado global sin especificar una clave');
        return false;
    }
    
    if (value === undefined) {
        console.warn(`Advertencia: Se intentó establecer un valor undefined para la clave ${key}`);
        return false;
    }
    
    // Comprobar si realmente cambia el valor para evitar actualizaciones innecesarias
    if (JSON.stringify(globalState[key]) === JSON.stringify(value)) {
        return true; // No ha cambiado, pero no es un error
    }
    
    // Actualizar valor
    globalState[key] = value;
    
    // Notificar cambio a otros componentes
    dispatchGlobalStateChange(key, value);
    
    return true;
}

// Actualizar límites en el estado global
function updateGlobalStats(limits) {
    if (!limits) {
        console.error('Error: Se intentó actualizar estadísticas sin proporcionar datos');
        return null;
    }
    
    try {
        // Obtener estadísticas actuales
        const currentStats = getGlobalState('stats') || {};
        
        // Validar estructura de los límites
        if (!validateLimitsStructure(limits)) {
            console.error('Error: Estructura de límites inválida', limits);
            return null;
        }
        
        // Preparar estructura de actualización
        const updatedStats = {
            ...currentStats
        };
        
        // Actualizar cada eje
        ['x', 'y', 'z'].forEach(axis => {
            if (!limits[axis]) return;
            
            updatedStats[axis] = {
                ...(updatedStats[axis] || {}),
                sigma2: limits[axis].sigma2 || updatedStats[axis]?.sigma2,
                sigma3: limits[axis].sigma3 || updatedStats[axis]?.sigma3
            };
        });
        
        // Actualizar estado global
        setGlobalState('stats', updatedStats);
        
        return updatedStats;
    } catch (error) {
        console.error('Error al actualizar estadísticas globales:', error);
        return null;
    }
    
    // Validar estructura de límites
    function validateLimitsStructure(limits) {
        // Debe tener al menos un eje
        if (!limits.x && !limits.y && !limits.z) {
            return false;
        }
        
        // Validar cada eje presente
        for (const axis of ['x', 'y', 'z']) {
            if (limits[axis]) {
                // Debe tener al menos sigma2 o sigma3
                if (!limits[axis].sigma2 && !limits[axis].sigma3) {
                    return false;
                }
                
                // Validar estructura de sigma2 si existe
                if (limits[axis].sigma2 && 
                    (typeof limits[axis].sigma2.lower !== 'number' || 
                     typeof limits[axis].sigma2.upper !== 'number')) {
                    return false;
                }
                
                // Validar estructura de sigma3 si existe
                if (limits[axis].sigma3 && 
                    (typeof limits[axis].sigma3.lower !== 'number' || 
                     typeof limits[axis].sigma3.upper !== 'number')) {
                    return false;
                }
            }
        }
        
        return true;
    }
}

// Evento personalizado para notificar cambios en estado global
function dispatchGlobalStateChange(key, value) {
    try {
        const event = new CustomEvent('globalStateChange', {
            detail: { 
                key, 
                value, 
                timestamp: new Date().toISOString() 
            }
        });
        document.dispatchEvent(event);
    } catch (error) {
        console.error('Error al despachar evento de cambio de estado:', error);
    }
}

// Inicializar eventos de cambios de estado global
function initGlobalStateEvents() {
    // Usar variable para controlar si ya se inicializaron
    if (window._globalStateEventsInitialized) {
        console.warn('Los eventos de estado global ya fueron inicializados');
        return;
    }
    
    // Escuchar cambios de estado global
    document.addEventListener('globalStateChange', handleGlobalStateEvent);
    
    // Marcar como inicializados
    window._globalStateEventsInitialized = true;
    
    console.log('Eventos de estado global inicializados');
}

// Manejar eventos de cambio de estado global
function handleGlobalStateEvent(e) {
    try {
        const { key, value, timestamp } = e.detail;
        console.log(`Estado global actualizado (${timestamp}): ${key}`);
        
        // Actualizar componentes específicos según la clave
        switch (key) {
            case 'stats':
                // Actualizar valores estadísticos visuales
                if (typeof updateStatisticalDisplayValues === 'function') {
                    updateStatisticalDisplayValues();
                }
                
                // Actualizar gráficos con nuevos límites 
                if (typeof updateChartsWithNewLimits === 'function') {
                    const stats = value;
                    const limits = statsToLimitsFormat(stats);
                    updateChartsWithNewLimits(limits);
                }
                break;
                
            case 'chartOptions':
                // Actualizar visibilidad de elementos en gráficos
                if (typeof updateChartsVisibility === 'function') {
                    updateChartsVisibility(value);
                }
                break;
                
            case 'selectedMachine':
            case 'selectedSensor':
            case 'timeRange':
                // Actualizar filtros visuales
                updateFilterVisualization(key, value);
                break;
                
            default:
                // No se requiere acción específica para otras claves
                break;
        }
    } catch (error) {
        console.error('Error al procesar evento de cambio de estado:', error);
    }
    
    // Actualizar elementos visuales de filtros
    function updateFilterVisualization(key, value) {
        const elementMap = {
            'selectedMachine': 'selectedMachineText',
            'selectedSensor': 'selectedSensorText',
            'timeRange': 'selectedTimeRangeText'
        };
        
        const elementId = elementMap[key];
        if (elementId) {
            const element = document.getElementById(elementId);
            if (element && element.hasAttribute('data-value')) {
                element.setAttribute('data-value', value || '');
            }
        }
    }
    
    // Convertir formato de stats a formato de límites para API
    function statsToLimitsFormat(stats) {
        if (!stats) return null;
        
        const limits = {};
        
        try {
            if (stats.x && stats.x.sigma2) {
                limits.x_2inf = stats.x.sigma2.lower;
                limits.x_2sup = stats.x.sigma2.upper;
            }
            
            if (stats.x && stats.x.sigma3) {
                limits.x_3inf = stats.x.sigma3.lower;
                limits.x_3sup = stats.x.sigma3.upper;
            }
            
            if (stats.y && stats.y.sigma2) {
                limits.y_2inf = stats.y.sigma2.lower;
                limits.y_2sup = stats.y.sigma2.upper;
            }
            
            if (stats.y && stats.y.sigma3) {
                limits.y_3inf = stats.y.sigma3.lower;
                limits.y_3sup = stats.y.sigma3.upper;
            }
            
            if (stats.z && stats.z.sigma2) {
                limits.z_2inf = stats.z.sigma2.lower;
                limits.z_2sup = stats.z.sigma2.upper;
            }
            
            if (stats.z && stats.z.sigma3) {
                limits.z_3inf = stats.z.sigma3.lower;
                limits.z_3sup = stats.z.sigma3.upper;
            }
        } catch (error) {
            console.error('Error al convertir estadísticas a formato de límites:', error);
            return null;
        }
        
        return limits;
    }
}

// Exponer funciones globales para acceso desde otros módulos
window.getGlobalState = getGlobalState;
window.setGlobalState = setGlobalState;
window.updateGlobalStats = updateGlobalStats;
window.initGlobalStateEvents = initGlobalStateEvents;

// ==========================================================================
// TOASTS Y ALERTAS
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
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Añadir al cuerpo del documento
    document.body.appendChild(toast);
    
    // Añadir clase para mostrar con animación
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Configurar evento de cierre
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeToast(toast));
    }
    
    // Auto cerrar después de un tiempo
    setTimeout(() => {
        closeToast(toast);
    }, 5000);
    
    return toast;
}

// Cerrar toast
function closeToast(toast) {
    if (!toast) return;
    
    toast.classList.remove('show');
    
    // Remover del DOM después de la animación
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// Mostrar indicador de carga
function showLoadingIndicator(message = 'Cargando...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingOverlay) loadingOverlay.classList.add('show');
}

// Ocultar indicador de carga
function hideLoadingIndicator() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('show');
}

// Mostrar toast de carga
function showLoadingToast(message = 'Procesando...') {
    // Eliminar cualquier toast de carga existente
    hideLoadingToast();
    
    const toast = document.createElement('div');
    toast.id = 'loadingToast';
    toast.className = 'toast toast-info animate-slide-up';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-spinner fa-spin"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    // Añadir al cuerpo del documento
    document.body.appendChild(toast);
    
    // Añadir clase para mostrar con animación
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    return toast;
}

// Ocultar toast de carga
function hideLoadingToast() {
    const loadingToast = document.getElementById('loadingToast');
    if (!loadingToast) return;
    
    loadingToast.classList.remove('show');
    
    // Remover del DOM después de la animación
    setTimeout(() => {
        if (loadingToast.parentNode) {
            loadingToast.parentNode.removeChild(loadingToast);
        }
    }, 300);
}

// Inicializar dropdowns
function initDropdowns() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.filter-dropdown-toggle');
        const menu = dropdown.querySelector('.filter-dropdown-menu');
        const items = dropdown.querySelectorAll('.filter-dropdown-item');
        const selectedText = dropdown.querySelector('[id$="Text"]');
        
        if (toggle && menu) {
            // Alternar menú al hacer clic en el botón
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
                
                // Cerrar otros dropdowns que estén abiertos
                dropdowns.forEach(other => {
                    if (other !== dropdown && other.classList.contains('open')) {
                        other.classList.remove('open');
                    }
                });
            });
            
            // Manejar selección de elementos
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Obtener valores
                    const value = item.getAttribute('data-value');
                    const text = item.textContent;
                    const dropdownId = dropdown.id;
                    
                    // Actualizar texto seleccionado
                    if (selectedText) {
                        selectedText.textContent = text;
                    }
                    
                    // Actualizar estado de selección
                    items.forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    
                    // Cerrar menú
                    dropdown.classList.remove('open');
                    
                    // Disparar evento
                    const event = new CustomEvent('dropdown-change', {
                        detail: { dropdownId, value, text }
                    });
                    document.dispatchEvent(event);
                });
            });
        }
    });
    
    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', () => {
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('open');
        });
    });
}

// Inicializar switches
function initSwitches() {
    // Ya implementado automáticamente con CSS e input:checked
}

// Actualizar hora de última actualización
function updateLastUpdateTime() {
    const lastUpdateTimeEl = document.getElementById('lastUpdateTime');
    if (lastUpdateTimeEl) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        lastUpdateTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// Inicializar todos los componentes de la UI
function initUI() {
    console.log('Inicializando componentes UI...');
    
    // Inicializar dropdowns personalizados
    initDropdowns();
    
    // Inicializar interruptores (switches)
    initSwitches();
    
    // Inicializar últimos tiempos de actualización
    updateLastUpdateTime();
    
    // Inicializar tooltips
    initTooltips();
    
    // Inicializar botones de colapso 
    initCollapseButtons();
    
    // Inicializar manejadores para campos de archivos
    initFileInputHandlers();
    
    console.log('Componentes UI inicializados');
}

// Inicializar tooltips
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(element => {
        if (element.title) {
            element.setAttribute('data-tooltip', element.title);
            element.removeAttribute('title');
        }
    });
}

// Inicializar botones de colapso
function initCollapseButtons() {
    const collapseButtons = document.querySelectorAll('[data-collapse]');
    
    collapseButtons.forEach(button => {
        const targetId = button.getAttribute('data-collapse');
        const targetElement = document.getElementById(targetId);
        
        if (button && targetElement) {
            button.addEventListener('click', () => {
                targetElement.classList.toggle('collapsed');
                const icon = button.querySelector('i');
                if (icon) {
                    if (targetElement.classList.contains('collapsed')) {
                        icon.className = icon.className.replace('up', 'down');
                    } else {
                        icon.className = icon.className.replace('down', 'up');
                    }
                }
            });
        }
    });
}

// Inicializar manejadores para campos de archivos
function initFileInputHandlers() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const button = input.nextElementSibling;
        const label = button ? button.nextElementSibling : null;
        
        if (input && button && label) {
            // Hacer clic en el botón activa el input file
            button.addEventListener('click', (e) => {
                e.preventDefault();
                input.click();
            });
            
            // Actualizar la etiqueta al seleccionar un archivo
            input.addEventListener('change', () => {
                if (input.files.length > 0) {
                    label.textContent = input.files[0].name;
                } else {
                    label.textContent = 'Ningún archivo seleccionado';
                }
            });
        }
    });
}

// Exportar funciones para uso global
window.initUI = initUI;
window.showToast = showToast;
window.closeToast = closeToast;
window.showLoadingIndicator = showLoadingIndicator;
window.hideLoadingIndicator = hideLoadingIndicator;
window.showLoadingToast = showLoadingToast;
window.hideLoadingToast = hideLoadingToast;
window.updateLastUpdateTime = updateLastUpdateTime; 