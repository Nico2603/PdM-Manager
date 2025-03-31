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
// SISTEMA CENTRALIZADO DE GESTIÓN DE EVENT LISTENERS
// ==========================================================================

// Mapa global para almacenar todos los event listeners
const globalEventListeners = new Map();

/**
 * Registra un event listener y lo almacena para limpieza posterior
 * @param {HTMLElement|Window|Document} element - El elemento al que se añade el listener
 * @param {string} event - El tipo de evento (click, change, etc.)
 * @param {Function} handler - La función manejadora del evento
 * @param {string} [category='global'] - Categoría para agrupar listeners (ej: 'navigation', 'dashboard')
 * @param {Object|boolean} [options=false] - Opciones para addEventListener
 * @returns {string} - Clave única para el listener
 */
function addManagedEventListener(element, event, handler, category = 'global', options = false) {
    if (!element) {
        AppLogger.warn('eventlisteners', 'addManagedEventListener: Elemento no válido');
        return null;
    }
    
    // Crear identificador único para el elemento
    const elementId = element.id || 
                     (element === document ? 'document' : 
                     (element === window ? 'window' : 'anonymous'));
    
    // Crear clave única para el registro
    const key = `${category}-${elementId}-${event}`;
    
    // Remover listener existente si existe
    removeManagedEventListener(key);
    
    // Agregar nuevo listener
    element.addEventListener(event, handler, options);
    
    // Almacenar en el mapa global
    globalEventListeners.set(key, { element, event, handler, options, category });
    
    AppLogger.debug('eventlisteners', `Listener registrado: ${key}`);
    return key;
}

/**
 * Elimina un event listener específico por su clave
 * @param {string} key - Clave única del listener a eliminar
 * @returns {boolean} - true si se eliminó correctamente, false si no existía
 */
function removeManagedEventListener(key) {
    if (globalEventListeners.has(key)) {
        const { element, event, handler, options } = globalEventListeners.get(key);
        
        try {
            element.removeEventListener(event, handler, options);
            globalEventListeners.delete(key);
            AppLogger.debug('eventlisteners', `Listener eliminado: ${key}`);
            return true;
        } catch (error) {
            AppLogger.warn('eventlisteners', `Error al eliminar listener ${key}:`, error);
            return false;
        }
    }
    return false;
}

/**
 * Limpia todos los event listeners registrados
 * @returns {number} - Número de listeners eliminados
 */
function cleanupAllEventListeners() {
    AppLogger.info('eventlisteners', `Limpiando ${globalEventListeners.size} event listeners`);
    const startTime = performance.now();
    
    let successCount = 0;
    let errorCount = 0;
    
    globalEventListeners.forEach((data, key) => {
        try {
            const { element, event, handler, options } = data;
            element.removeEventListener(event, handler, options);
            successCount++;
            AppLogger.debug('eventlisteners', `Listener removido: ${key}`);
        } catch (error) {
            errorCount++;
            AppLogger.warn('eventlisteners', `Error al remover listener ${key}:`, error);
        }
    });
    
    globalEventListeners.clear();
    
    AppLogger.info('eventlisteners', `Limpieza completada: ${successCount} correctos, ${errorCount} errores`, null, startTime);
    return successCount;
}

/**
 * Limpia los event listeners de una categoría específica
 * @param {string} category - Categoría de listeners a limpiar
 * @returns {number} - Número de listeners eliminados
 */
function cleanupEventListenersByCategory(category) {
    if (!category) {
        AppLogger.warn('eventlisteners', 'Se intentó limpiar listeners sin especificar categoría');
        return 0;
    }
    
    // Recopilar las claves que coinciden con la categoría
    const keysToRemove = [];
    globalEventListeners.forEach((data, key) => {
        if (data.category === category) {
            keysToRemove.push(key);
        }
    });
    
    AppLogger.info('eventlisteners', `Limpiando ${keysToRemove.length} event listeners de categoría: ${category}`);
    const startTime = performance.now();
    
    let successCount = 0;
    let errorCount = 0;
    
    // Eliminar los listeners
    keysToRemove.forEach(key => {
        try {
            const { element, event, handler, options } = globalEventListeners.get(key);
            element.removeEventListener(event, handler, options);
            globalEventListeners.delete(key);
            successCount++;
            AppLogger.debug('eventlisteners', `Listener removido: ${key}`);
        } catch (error) {
            errorCount++;
            AppLogger.warn('eventlisteners', `Error al remover listener ${key}:`, error);
        }
    });
    
    AppLogger.info('eventlisteners', `Limpieza de categoría ${category} completada: ${successCount} correctos, ${errorCount} errores`, null, startTime);
    return successCount;
}

/**
 * Obtiene información sobre todos los event listeners registrados
 * @returns {Object} - Información sobre los listeners registrados
 */
function getEventListenersInfo() {
    const info = {
        total: globalEventListeners.size,
        byCategory: {},
        byElement: {},
        byEvent: {}
    };
    
    globalEventListeners.forEach((data) => {
        const { category, element, event } = data;
        
        // Agrupar por categoría
        if (!info.byCategory[category]) {
            info.byCategory[category] = 0;
        }
        info.byCategory[category]++;
        
        // Agrupar por elemento
        const elementId = element.id || 
                         (element === document ? 'document' : 
                         (element === window ? 'window' : 'anonymous'));
        if (!info.byElement[elementId]) {
            info.byElement[elementId] = 0;
        }
        info.byElement[elementId]++;
        
        // Agrupar por tipo de evento
        if (!info.byEvent[event]) {
            info.byEvent[event] = 0;
        }
        info.byEvent[event]++;
    });
    
    return info;
}

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

// ==========================================================================
// SISTEMA DE LOGGING
// ==========================================================================

// Configuración del sistema de logs
const LOG_CONFIG = {
    ENABLED: true,
    LEVEL: 'debug', // 'debug', 'info', 'warn', 'error'
    SHOW_TIMESTAMP: true,
    SHOW_DURATION: true,
    MODULES: {
        NAVIGATION: true,
        DASHBOARD: true,
        CONFIG: true,
        WEBSOCKET: true,
        AJAX: true
    }
};

// Colores para los distintos módulos
const LOG_COLORS = {
    NAVIGATION: '#4f46e5', // Índigo
    DASHBOARD: '#0ea5e9',  // Celeste
    CONFIG: '#10b981',     // Verde
    WEBSOCKET: '#ec4899',  // Rosa
    AJAX: '#f59e0b',       // Ámbar
    PERFORMANCE: '#ef4444' // Rojo
};

// Función de compatibilidad que redirecciona a AppLogger
function appLog(module, level, message, data = null, startTime = null) {
    // Convertir módulo a formato esperado por AppLogger (minúsculas)
    const component = module.toLowerCase();
    
    // Verificar que el nivel sea válido
    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
        console.error(`Nivel de log inválido: ${level}`);
        level = 'info'; // Nivel por defecto
    }
    
    // Redireccionar al AppLogger centralizado
    AppLogger[level](component, message, data, startTime);
    
    // Mantener la misma interfaz de retorno por compatibilidad
    return new Date();
}

// Funciones específicas por módulo para simplificar uso
const logNavigation = (level, message, data = null, startTime = null) => 
    AppLogger[level]('navigation', message, data, startTime);

const logDashboard = (level, message, data = null, startTime = null) => 
    AppLogger[level]('dashboard', message, data, startTime);

const logConfig = (level, message, data = null, startTime = null) => 
    AppLogger[level]('config', message, data, startTime);

const logWebSocket = (level, message, data = null, startTime = null) => 
    AppLogger[level]('websocket', message, data, startTime);

const logAjax = (level, message, data = null, startTime = null) => 
    AppLogger[level]('ajax', message, data, startTime);

const logPerformance = (level, message, data = null, startTime = null) => 
    AppLogger[level]('performance', message, data, startTime);

// Medición de rendimiento
function measurePerformance(functionName, callback) {
    const startTime = performance.now();
    logPerformance('debug', `Iniciando medición: ${functionName}`);
    
    try {
        return callback();
    } finally {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Clasificar según duración
        let level = 'debug';
        if (duration > 1000) {
            level = 'warn';
        } else if (duration > 3000) {
            level = 'error';
        }
        
        logPerformance(level, `${functionName} completado en ${duration.toFixed(2)}ms`);
    }
}

// Función para crear un logger de bucles que evita spam de logs
function createLoopLogger(module, loopName, totalItems) {
    let lastLogTime = 0;
    const MIN_LOG_INTERVAL = 500; // ms mínimo entre logs
    
    return {
        start: () => {
            AppLogger.debug(module.toLowerCase(), `Iniciando bucle: ${loopName} con ${totalItems} elementos`);
            return performance.now();
        },
        
        progress: (index, item = null) => {
            const now = performance.now();
            // Evitar logging excesivo, solo registrar periódicamente
            if (now - lastLogTime > MIN_LOG_INTERVAL || index === totalItems - 1 || index === 0) {
                const percentage = ((index + 1) / totalItems * 100).toFixed(1);
                lastLogTime = now;
                AppLogger.debug(module.toLowerCase(), `Bucle ${loopName}: ${percentage}% completado (${index + 1}/${totalItems})`, item);
            }
        },
        
        end: (startTime) => {
            const duration = performance.now() - startTime;
            AppLogger.debug(module.toLowerCase(), `Bucle ${loopName} completado en ${duration.toFixed(2)}ms`);
        },
        
        error: (error, index) => {
            AppLogger.error(module.toLowerCase(), `Error en bucle ${loopName} en índice ${index}:`, error);
        }
    };
}

// Exportar funciones para uso global
window.appLog = appLog;
window.logNavigation = logNavigation;
window.logDashboard = logDashboard;
window.logConfig = logConfig;
window.logWebSocket = logWebSocket;
window.logAjax = logAjax;
window.logPerformance = logPerformance;
window.measurePerformance = measurePerformance;
window.createLoopLogger = createLoopLogger; 

// Exportar funciones de gestión de event listeners
window.addManagedEventListener = addManagedEventListener;
window.removeManagedEventListener = removeManagedEventListener;
window.cleanupAllEventListeners = cleanupAllEventListeners;
window.cleanupEventListenersByCategory = cleanupEventListenersByCategory;
window.getEventListenersInfo = getEventListenersInfo;

/**
 * Función de ayuda para migrar addEventListener a addManagedEventListener
 * Esta función reemplaza todos los event listeners directos por el sistema centralizado
 * @param {HTMLElement} element - Elemento a procesar
 * @param {string} category - Categoría para los event listeners
 */
function migrateElementEventListeners(element, category = 'global') {
    if (!element || typeof element.addEventListener !== 'function') {
        AppLogger.warn('eventlisteners', 'Elemento no válido para migración de listeners');
        return;
    }
    
    // Guardar la función original
    if (!element._originalAddEventListener) {
        element._originalAddEventListener = element.addEventListener;
        
        // Reemplazar con nuestra versión que usa el sistema centralizado
        element.addEventListener = function(event, handler, options) {
            return addManagedEventListener(this, event, handler, category, options);
        };
        
        AppLogger.debug('eventlisteners', `Migración de addEventListener completada para ${element.tagName || 'document/window'}`);
    }
}

// Función para migrar event listeners globales
function migrateGlobalEventListeners() {
    migrateElementEventListeners(window, 'global');
    migrateElementEventListeners(document, 'global');
    
    AppLogger.info('eventlisteners', 'Migración de listeners globales completada');
}

// Exportar función de migración para uso global
window.migrateElementEventListeners = migrateElementEventListeners;
window.migrateGlobalEventListeners = migrateGlobalEventListeners; 

// ==========================================================================
// SISTEMA UNIFICADO DE THROTTLING Y DEBOUNCING
// ==========================================================================

// Configuración global de throttling/debouncing
const THROTTLE_CONFIG = {
    DEFAULT_DEBOUNCE_DELAY: 300,         // ms para debounce
    DEFAULT_THROTTLE_INTERVAL: 2000,     // ms para throttle
    MIN_UPDATE_INTERVAL: 5000,           // Intervalo mínimo entre actualizaciones
    LOG_SKIPPED_UPDATES: true,           // Registrar actualizaciones ignoradas
    USE_IDLE_CALLBACK: true              // Usar requestIdleCallback si está disponible
};

// Registro de timers para control centralizado
const timers = {
    debounce: new Map(),
    throttle: new Map(),
    lastExecution: new Map()
};

/**
 * Crear una función con debounce 
 * @param {Function} func - Función a ejecutar con debounce
 * @param {number} wait - Tiempo de espera en ms
 * @param {Object} options - Opciones adicionales
 * @returns {Function} - Función con debounce aplicado
 */
function debounce(func, wait = THROTTLE_CONFIG.DEFAULT_DEBOUNCE_DELAY, options = {}) {
    const { leading = false, maxWait = null, context = 'global' } = options;
    const key = func.toString().slice(0, 100) + context;
    let lastArgs;
    
    return function(...args) {
        lastArgs = args;
        
        // Si se solicita ejecución inmediata al inicio y no hay timer pendiente
        if (leading && !timers.debounce.has(key)) {
            AppLogger.debug('performance', `Debounce (${context}): ejecución inmediata por leading=true`);
            func.apply(this, args);
            // Guardar timestamp de la última ejecución
            timers.lastExecution.set(key, Date.now());
        }
        
        // Cancelar timer anterior si existe
        if (timers.debounce.has(key)) {
            clearTimeout(timers.debounce.get(key));
            AppLogger.debug('performance', `Debounce (${context}): reset de timer`);
        }
        
        // Crear nuevo timer
        const timer = setTimeout(() => {
            // Ejecutar la función con los últimos argumentos
            AppLogger.debug('performance', `Debounce (${context}): ejecutando función después de ${wait}ms`);
            func.apply(this, lastArgs);
            // Limpiar el timer
            timers.debounce.delete(key);
            // Guardar timestamp de la última ejecución
            timers.lastExecution.set(key, Date.now());
        }, wait);
        
        // Almacenar el timer para poder cancelarlo
        timers.debounce.set(key, timer);
        
        // Si hay un tiempo máximo de espera, configurar maxWait timer
        if (maxWait !== null && maxWait > wait) {
            // Verificar si ya pasó el tiempo máximo de espera desde la última ejecución
            const lastExec = timers.lastExecution.get(key) || 0;
            const timeSinceLastExec = Date.now() - lastExec;
            
            if (timeSinceLastExec >= maxWait) {
                // Si ya pasó el tiempo máximo, ejecutar inmediatamente
                clearTimeout(timers.debounce.get(key));
                timers.debounce.delete(key);
                AppLogger.debug('performance', `Debounce (${context}): ejecución forzada por maxWait (${maxWait}ms)`);
                func.apply(this, lastArgs);
                timers.lastExecution.set(key, Date.now());
            }
        }
    };
}

/**
 * Crear una función con throttle
 * @param {Function} func - Función a ejecutar con throttle
 * @param {number} limit - Tiempo mínimo entre ejecuciones en ms
 * @param {Object} options - Opciones adicionales
 * @returns {Function} - Función con throttle aplicado
 */
function throttle(func, limit = THROTTLE_CONFIG.DEFAULT_THROTTLE_INTERVAL, options = {}) {
    const { leading = true, trailing = true, context = 'global' } = options;
    const key = func.toString().slice(0, 100) + context;
    let lastArgs;
    let lastThis;
    
    return function(...args) {
        const now = Date.now();
        const lastTime = timers.lastExecution.get(key) || 0;
        const timeSinceLastExec = now - lastTime;
        
        // Guardar argumentos y contexto para posible ejecución posterior
        lastArgs = args;
        lastThis = this;
        
        // Si ha pasado suficiente tiempo, ejecutar inmediatamente
        if (timeSinceLastExec >= limit) {
            if (leading) {
                AppLogger.debug('performance', `Throttle (${context}): ejecución inmediata`);
                func.apply(lastThis, lastArgs);
                timers.lastExecution.set(key, now);
                return;
            }
        }
        
        // Si no hay un timer pendiente y se permite trailing, programarlo
        if (!timers.throttle.has(key) && trailing) {
            const nextExecTime = Math.max(limit - timeSinceLastExec, 0);
            
            if (THROTTLE_CONFIG.LOG_SKIPPED_UPDATES) {
                AppLogger.debug('performance', `Throttle (${context}): ejecución diferida para ${nextExecTime}ms`);
            }
            
            const timer = setTimeout(() => {
                // Solo ejecutar si se permite trailing o no se ha ejecutado recientemente
                if (trailing || Date.now() - timers.lastExecution.get(key) >= limit) {
                    AppLogger.debug('performance', `Throttle (${context}): ejecutando función diferida después de ${limit}ms`);
                    func.apply(lastThis, lastArgs);
                    timers.lastExecution.set(key, Date.now());
                }
                timers.throttle.delete(key);
            }, nextExecTime);
            
            timers.throttle.set(key, timer);
        } else if (THROTTLE_CONFIG.LOG_SKIPPED_UPDATES) {
            AppLogger.debug('performance', `Throttle (${context}): actualización ignorada (throttled)`);
        }
    };
}

/**
 * Cancelar todos los timers pendientes de debounce y throttle
 * @param {string} [context] - Contexto opcional para filtrar (e.g., 'dashboard', 'websocket')
 */
function cancelPendingTimers(context = null) {
    const startTime = performance.now();
    let countDebounce = 0;
    let countThrottle = 0;
    
    // Cancelar timers de debounce
    timers.debounce.forEach((timer, key) => {
        if (!context || key.includes(context)) {
            clearTimeout(timer);
            timers.debounce.delete(key);
            countDebounce++;
        }
    });
    
    // Cancelar timers de throttle
    timers.throttle.forEach((timer, key) => {
        if (!context || key.includes(context)) {
            clearTimeout(timer);
            timers.throttle.delete(key);
            countThrottle++;
        }
    });
    
    AppLogger.info('performance', `Timers cancelados: ${countDebounce} debounce, ${countThrottle} throttle`, 
        { context: context || 'todos' }, startTime);
    
    return { debounce: countDebounce, throttle: countThrottle };
}

/**
 * Comprobar si se debe permitir una actualización basada en un intervalo mínimo
 * @param {string} key - Clave única para identificar el tipo de actualización
 * @param {number} minInterval - Intervalo mínimo entre actualizaciones en ms
 * @param {boolean} updateTimestamp - Si se actualiza el timestamp en caso positivo
 * @returns {boolean} - true si se debe permitir la actualización
 */
function shouldUpdate(key, minInterval = THROTTLE_CONFIG.MIN_UPDATE_INTERVAL, updateTimestamp = true) {
    const now = Date.now();
    const lastTime = timers.lastExecution.get(key) || 0;
    const elapsed = now - lastTime;
    
    if (elapsed >= minInterval) {
        if (updateTimestamp) {
            timers.lastExecution.set(key, now);
        }
        return true;
    }
    
    if (THROTTLE_CONFIG.LOG_SKIPPED_UPDATES) {
        AppLogger.debug('performance', `Actualización ignorada para '${key}' (${elapsed}ms < ${minInterval}ms)`);
    }
    
    return false;
}

// Exportar funciones para uso global
window.debounce = debounce;
window.throttle = throttle;
window.cancelPendingTimers = cancelPendingTimers;
window.shouldUpdate = shouldUpdate; 