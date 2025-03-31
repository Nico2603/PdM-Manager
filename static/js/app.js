// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', initApplication);

// Inicialización de la aplicación
function initApplication() {
    console.log('Inicializando aplicación PdM-Manager v2.0...');
    
    try {
        // Inicializar logger
        if (typeof initLogger === 'function') {
            initLogger();
        }

        // Log de inicio de la aplicación
        AppLogger.info('system', 'Inicializando aplicación');
        
        // Inicializar eventos de estado global - Primero para que otros componentes puedan usarlo
        if (typeof initGlobalStateEvents === 'function') {
            initGlobalStateEvents();
        } else {
            console.error('La función initGlobalStateEvents no está disponible');
        }
        
        // Cargar límites de vibración por defecto
        // Esta operación se debe realizar temprano en el flujo de inicialización
        if (typeof fetchVibrationLimits === 'function') {
            console.log('Cargando límites de vibración por defecto...');
            fetchVibrationLimits();
        } else {
            console.warn('La función fetchVibrationLimits no está disponible, no se cargarán los límites de vibración');
        }
        
        // Inicializar componentes UI comunes (como toasts, dropdowns, etc.)
        if (typeof initUI === 'function') {
            initUI();
        } else {
            console.warn('La función initUI no está disponible, algunos componentes visuales pueden no funcionar');
        }
        
        // Inicializar navegación
        if (typeof initNavigation === 'function') {
            initNavigation();
        } else {
            console.error('La función initNavigation no está disponible, la navegación no funcionará');
        }
        
        // Inicializar menú lateral
        if (typeof initSidebar === 'function') {
            initSidebar();
        } else {
            console.warn('La función initSidebar no está disponible, el menú lateral puede no funcionar');
        }

        // Inicializar configuración
        if (typeof initConfig === 'function') {
            console.log('Iniciando inicialización de configuración...');
            initConfig();
        } else {
            console.error('La función initConfig no está disponible, la sección de configuración no funcionará');
        }
        
        // Inicializar el WebSocket
        if (typeof initWebSocket === 'function') {
            AppLogger.debug('system', 'Inicializando conexión WebSocket');
            initWebSocket();
        } else {
            AppLogger.warn('system', 'Función initWebSocket no disponible');
            // Cargar datos manualmente si no hay WebSocket
            loadInitialData();
        }
        
        // Inicializar logs UI
        if (typeof initLogsUI === 'function') {
            initLogsUI();
        }
        
        // Registrar eventos globales
        registerGlobalEvents();
        
        // Establecer tiempo para actualizar datos iniciales
        setTimeout(() => {
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
            }
            // Asegurar que los datos de configuración estén cargados
            loadInitialData();
        }, 500);
        
        console.log('Aplicación inicializada correctamente');
    } catch (error) {
        console.error('Error durante la inicialización de la aplicación:', error);
    }
}

// Gestionar cambios de estado global
document.addEventListener('globalStateChange', function(e) {
    try {
        if (typeof handleGlobalStateChange === 'function') {
            handleGlobalStateChange(e);
        }
    } catch (error) {
        console.error('Error al manejar cambio de estado global:', error);
    }
});

// Configuración global
const THROTTLE_CONFIG = {
    DEFAULT_INTERVAL: 1000,  // 1 segundo por defecto entre llamadas a la misma función
    LOG_SKIPPED_UPDATES: false
};

// Estado global de la aplicación
const APP_STATE = {
    debug: false,
    monitoringActive: false,
    activeSection: 'dashboard',
    vibrationLimits: null
};

// Registrar eventos globales
function registerGlobalEvents() {
    // Botón de refrescar datos
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            AppLogger.info('system', 'Actualización manual de datos iniciada');
            showToast('Actualizando datos...', 'info');
            
            if (typeof window.refreshAllTables === 'function') {
                window.refreshAllTables();
                showToast('Datos actualizados correctamente', 'success');
            } else {
                AppLogger.warn('system', 'Función refreshAllTables no disponible');
                
                // Intentar refrescar las tablas individuales si están disponibles
                if (typeof window.refreshMachinesTable === 'function') {
                    window.refreshMachinesTable();
                }
                
                if (typeof window.refreshSensorsTable === 'function') {
                    window.refreshSensorsTable();
                }
                
                if (typeof window.refreshModelsTable === 'function') {
                    window.refreshModelsTable();
                }
                
                showToast('Datos actualizados', 'info');
            }
        });
    }
}

// Función para establecer una propiedad en el estado global
function setGlobalState(key, value) {
    if (key in APP_STATE) {
        APP_STATE[key] = value;
        return true;
    }
    return false;
}

// Función para obtener una propiedad del estado global
function getGlobalState(key) {
    return APP_STATE[key];
}

// Sistema unificado de throttling para funciones
const throttleTimestamps = {};
const throttledFunctions = {};

// Función throttle para limitar la frecuencia de llamadas a una función
function throttle(func, wait, options = {}) {
    const context = options.context || 'default';
    const leading = options.leading !== false;
    const trailing = options.trailing !== false;
    
    if (!throttledFunctions[context]) {
        throttledFunctions[context] = {};
    }
    
    const uniqueId = Date.now().toString();
    throttledFunctions[context][uniqueId] = {
        func: func,
        wait: wait,
        timeout: null,
        context: context,
        args: null,
        leading: leading,
        trailing: trailing,
        previous: 0
    };
    
    return function(...args) {
        const now = Date.now();
        const fn = throttledFunctions[context][uniqueId];
        
        if (!fn.previous && !fn.leading) {
            fn.previous = now;
        }
        
        const remaining = fn.wait - (now - fn.previous);
        
        if (remaining <= 0) {
            if (fn.timeout) {
                clearTimeout(fn.timeout);
                fn.timeout = null;
            }
            fn.previous = now;
            fn.func.apply(this, args);
        } else if (!fn.timeout && fn.trailing) {
            fn.args = args;
            fn.timeout = setTimeout(() => {
                fn.previous = fn.leading ? Date.now() : 0;
                fn.timeout = null;
                fn.func.apply(this, fn.args);
                fn.args = null;
            }, remaining);
        }
    };
}

// Sistema unificado de debounce para funciones 
const debouncedFunctions = {}; 

// Función debounce para agrupar llamadas a una función
function debounce(func, wait, options = {}) {
    const context = options.context || 'default';
    
    if (!debouncedFunctions[context]) {
        debouncedFunctions[context] = {};
    }
    
    const uniqueId = Date.now().toString();
    
    debouncedFunctions[context][uniqueId] = {
        func: func,
        wait: wait,
        timeout: null,
        context: context
    };
    
    return function(...args) {
        const fn = debouncedFunctions[context][uniqueId];
        
        if (fn.timeout) {
            clearTimeout(fn.timeout);
        }
        
        fn.timeout = setTimeout(() => {
            fn.func.apply(this, args);
            fn.timeout = null;
        }, fn.wait);
    };
}

// Función para verificar si se debe permitir una actualización (throttling)
function shouldUpdate(key, interval = THROTTLE_CONFIG.DEFAULT_INTERVAL, force = false) {
    if (force) return true;
    
    const now = Date.now();
    const lastUpdate = throttleTimestamps[key] || 0;
    
    if (now - lastUpdate < interval) {
        return false;
    }
    
    throttleTimestamps[key] = now;
    return true;
}

// Exponer funciones globalmente
window.setGlobalState = setGlobalState;
window.getGlobalState = getGlobalState;
window.throttle = throttle;
window.debounce = debounce;
window.shouldUpdate = shouldUpdate;

// Función para cargar datos iniciales desde el servidor
function loadInitialData() {
    console.log('Cargando datos iniciales desde el servidor...');
    
    // Cargar modelos, sensores y máquinas
    const loadFunctions = [
        { name: 'refreshModelsTable', fn: window.refreshModelsTable },
        { name: 'refreshSensorsTable', fn: window.refreshSensorsTable },
        { name: 'refreshMachinesTable', fn: window.refreshMachinesTable },
        { name: 'updateMachineSensorSelectors', fn: window.updateMachineSensorSelectors },
        { name: 'updateModelSelectors', fn: window.updateModelSelectors }
    ];
    
    // Ejecutar las funciones que estén disponibles
    loadFunctions.forEach((item, index) => {
        setTimeout(() => {
            if (typeof item.fn === 'function') {
                console.log(`Cargando datos: ${item.name}`);
                try {
                    item.fn();
                } catch (error) {
                    console.error(`Error al cargar ${item.name}:`, error);
                }
            } else {
                console.warn(`Función ${item.name} no disponible`);
            }
        }, index * 200); // Espaciar las llamadas para evitar problemas
    });
} 