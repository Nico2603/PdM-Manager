// Configuración de la API
const API_CONFIG = {
    BASE_URL: window.location.origin,
    ENDPOINTS: {
        PREDICT: '/api/predict',
        SENSORS: '/api/sensors',
        HISTORY: '/api/history',
        MAINTENANCE: '/api/maintenance',
        DASHBOARD: '/api/dashboard',
        CONFIG: '/api/config',
        ALERTS: '/api/alerts',
        STATS: '/api/stats',
    },
    REFRESH_INTERVAL: 10000, // Milisegundos para actualización automática
};

// Configuración de gráficos
const CHART_CONFIG = {
    COLORS: {
        PRIMARY: '#3498db',
        SUCCESS: '#2ecc71',
        WARNING: '#f39c12',
        DANGER: '#e74c3c',
        INFO: '#00c0ef',
        SECONDARY: '#9b59b6',
        BACKGROUND: 'rgba(255, 255, 255, 0.7)',
        GRID: 'rgba(0, 0, 0, 0.1)',
    },
    ANIMATION_DURATION: 800,
    RESPONSIVE: true,
};

// Configuración de alertas
const ALERT_CONFIG = {
    LEVELS: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error',
    },
    AUTO_CLOSE: 5000, // Tiempo en ms para cerrar automáticamente
};

// Umbrales para diferentes estados de salud de la maquinaria
const THRESHOLD_CONFIG = {
    NORMAL: 0.25,
    WARNING: 0.5,
    CRITICAL: 0.75,
};

// Inicializar la sección de configuración
function initConfig() {
    logConfig('info', 'Inicializando sección de configuración');
    
    try {
        // Inicializar pestañas de configuración
        initConfigTabs();
        
        // Inicializar contenido de cada pestaña
        initMachineTab();
        initSensorTab();
        initModelTab();
        initLimitsTab();
        
        logConfig('info', 'Sección de configuración inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar la sección de configuración', error);
        throw error; // Re-lanzar para manejo superior
    }
}

// Inicializar pestañas de configuración
function initConfigTabs() {
    logConfig('debug', 'Inicializando pestañas de configuración');
    const tabItems = document.querySelectorAll('.tab-item');
    
    if (!tabItems.length) {
        logConfig('warn', 'No se encontraron elementos de pestaña');
        return;
    }
    
    tabItems.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = tab.getAttribute('data-tab');
            logConfig('debug', `Cambiando a pestaña: ${tabId}`);
            
            try {
                // Actualizar estado activo
                tabItems.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Mostrar contenido correspondiente
                const tabContents = document.querySelectorAll('.tab-content');
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.getAttribute('data-tab') === tabId) {
                        content.classList.add('active');
                        logConfig('debug', `Contenido de pestaña ${tabId} activado`);
                    }
                });
            } catch (error) {
                logConfig('error', `Error al cambiar a pestaña ${tabId}`, error);
            }
        });
    });
}

// Inicializar pestaña de máquinas
function initMachineTab() {
    logConfig('debug', 'Inicializando pestaña de máquinas');
    try {
        // Verificar elementos necesarios
        const machineForm = document.getElementById('machineForm');
        const machinesTable = document.getElementById('machinesTable');
        
        if (!machineForm || !machinesTable) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de máquinas');
            return;
        }
        
        // Aquí irá la lógica específica de la pestaña de máquinas
        logConfig('debug', 'Pestaña de máquinas inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de máquinas', error);
        throw error;
    }
}

// Inicializar pestaña de sensores
function initSensorTab() {
    logConfig('debug', 'Inicializando pestaña de sensores');
    try {
        // Verificar elementos necesarios
        const sensorForm = document.getElementById('sensorForm');
        const sensorsTable = document.getElementById('sensorsTable');
        
        if (!sensorForm || !sensorsTable) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de sensores');
            return;
        }
        
        // Aquí irá la lógica específica de la pestaña de sensores
        logConfig('debug', 'Pestaña de sensores inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de sensores', error);
        throw error;
    }
}

// Inicializar pestaña de modelos
function initModelTab() {
    logConfig('debug', 'Inicializando pestaña de modelos');
    try {
        // Verificar elementos necesarios
        const modelForm = document.getElementById('modelForm');
        const modelsTable = document.getElementById('modelsTable');
        
        if (!modelForm || !modelsTable) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de modelos');
            return;
        }
        
        // Aquí irá la lógica específica de la pestaña de modelos
        logConfig('debug', 'Pestaña de modelos inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de modelos', error);
        throw error;
    }
}

// Inicializar pestaña de límites
function initLimitsTab() {
    logConfig('debug', 'Inicializando pestaña de límites');
    try {
        // Verificar elementos necesarios
        const limitsForm = document.getElementById('limitsForm');
        
        if (!limitsForm) {
            logConfig('warn', 'No se encontraron elementos necesarios para la pestaña de límites');
            return;
        }
        
        // Aquí irá la lógica específica de la pestaña de límites
        logConfig('debug', 'Pestaña de límites inicializada correctamente');
    } catch (error) {
        logConfig('error', 'Error al inicializar pestaña de límites', error);
        throw error;
    }
}

// Exportar funciones para uso global
window.initConfig = initConfig;
window.initConfigTabs = initConfigTabs;
window.initMachineTab = initMachineTab;
window.initSensorTab = initSensorTab;
window.initModelTab = initModelTab;
window.initLimitsTab = initLimitsTab; 