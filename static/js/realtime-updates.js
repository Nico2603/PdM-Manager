// Inicialización del WebSocket
let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3 segundos
let isWebSocketActive = false;

// Configuración de actualizaciones
const UPDATE_CONFIG = {
    AUTO_REFRESH_INTERVAL: 60000, // 60 segundos
    MIN_UPDATE_INTERVAL: 5000,    // 5 segundos entre actualizaciones
    BATCH_UPDATE_DELAY: 1000,     // 1 segundo para agrupar actualizaciones
    THROTTLE_INTERVAL: 2000       // 2 segundos entre mensajes procesados del mismo tipo
};

// Control de actualizaciones
let lastUpdateTime = 0;
let pendingUpdates = new Set();
let updateTimeout = null;

// Control de throttling de mensajes
let lastMessageTime = {};
let throttledMessages = {};

// Temporizadores de actualización automática
let autoRefreshTimers = {
    machines: null,
    sensors: null,
    models: null
};

// Registro de event listeners para limpieza
const realtimeListeners = new Map();

/**
 * Función centralizada para manejar errores en WebSocket
 * @param {Error|Event} error - El objeto de error capturado
 * @param {string} context - Contexto donde ocurrió el error
 * @param {boolean} reconnect - Indica si se debe intentar reconectar automáticamente
 * @param {Object} extraData - Datos adicionales a registrar con el error
 */
function handleWebSocketError(error, context, reconnect = true, extraData = {}) {
    // Datos básicos del error
    const errorData = {
        context: context,
        timestamp: new Date().toISOString(),
        reconnectAttempts: reconnectAttempts,
        isWebSocketActive: isWebSocketActive,
        ...extraData
    };
    
    // Añadir detalles del objeto de error si existe
    if (error instanceof Error) {
        errorData.message = error.message;
        errorData.stack = error.stack;
        errorData.name = error.name;
    } else if (error instanceof Event) {
        errorData.type = error.type;
    }
    
    // Registrar error en sistema de logs
    AppLogger.error('websocket', `Error en ${context}`, errorData);
    
    // Actualizar estado de conexión
    isWebSocketActive = false;
    updateConnectionStatus(false);
    
    // Mostrar mensaje de error al usuario
    showToast(`Error en conexión WebSocket: ${context}`, 'error');
    
    // Iniciar actualización automática como respaldo
    startAutoRefresh();
    
    // Intentar reconectar si es necesario
    if (reconnect && reconnectAttempts < maxReconnectAttempts) {
        handleWebSocketReconnection();
    }
}

// Función para gestionar event listeners
function addRealtimeListener(element, event, handler, options = false) {
    if (!element) {
        logWebSocket('warn', 'addRealtimeListener: Elemento no válido');
        return null;
    }

    return addManagedEventListener(element, event, handler, 'realtime', options);
}

// Función para limpiar todos los listeners de tiempo real
function cleanupRealtimeListeners() {
    logWebSocket('info', 'Limpiando event listeners de tiempo real');
    return cleanupEventListenersByCategory('realtime');
}

// Función para controlar la tasa de actualizaciones utilizando el sistema unificado
function shouldProcessWebSocketUpdate(key) {
    return shouldUpdate(`websocket_${key}`, UPDATE_CONFIG.MIN_UPDATE_INTERVAL);
}

// Función para controlar la tasa de actualizaciones
function shouldUpdate() {
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_CONFIG.MIN_UPDATE_INTERVAL) {
        return false;
    }
    lastUpdateTime = now;
    return true;
}

// Función de throttling para tipos de mensajes WebSocket usando el sistema unificado
function shouldProcessMessage(messageType) {
    logWebSocket('debug', `Evaluando throttling para mensaje: ${messageType}`);
    
    // Usar el sistema unificado shouldUpdate para verificar si debemos procesar
    if (shouldUpdate(`message_${messageType}`, UPDATE_CONFIG.THROTTLE_INTERVAL, true)) {
        logWebSocket('debug', `Procesando mensaje (intervalo suficiente): ${messageType}`);
        return true;
    }
    
    // Obtener una versión throttled de la función de procesamiento
    const throttledFn = getThrottledMessageProcessor(messageType);
    
    // Programar para ejecución posterior
    logWebSocket('debug', `Throttling mensaje: ${messageType}, programando para ejecución posterior`);
    throttledFn();
    
    return false;
}

// Caché de funciones throttled para evitar recrearlas
const throttledProcessors = {};

// Obtener o crear una función throttled para procesar un tipo de mensaje
function getThrottledMessageProcessor(messageType) {
    if (!throttledProcessors[messageType]) {
        // Crear una función throttled para este tipo de mensaje
        throttledProcessors[messageType] = throttle(
            () => processThrottledMessage(messageType),
            UPDATE_CONFIG.THROTTLE_INTERVAL,
            { 
                leading: false, 
                trailing: true,
                context: `websocket_${messageType}`
            }
        );
    }
    
    return throttledProcessors[messageType];
}

// Procesar un mensaje que fue throttled
function processThrottledMessage(messageType) {
    logWebSocket('debug', `Procesando mensaje throttled: ${messageType}`);
    
    switch (messageType) {
        case 'machine_update':
            refreshMachinesTable();
            break;
            
        case 'sensor_update':
            refreshSensorsTable();
            break;
            
        case 'model_update':
            refreshModelsTable();
            break;
    }
}

// Función para agrupar actualizaciones pendientes con sistema unificado de debounce
const debouncedBatchUpdate = debounce(
    function executeBatchUpdate() {
        if (pendingUpdates.size > 0) {
            logWebSocket('debug', `Ejecutando ${pendingUpdates.size} actualizaciones pendientes`);
            const batchStartTime = performance.now();
            
            try {
                pendingUpdates.forEach(update => {
                    if (typeof update === 'function') {
                        update();
                    }
                });
                logWebSocket('debug', 'Batch de actualizaciones completado correctamente', null, batchStartTime);
            } catch (error) {
                logWebSocket('error', 'Error durante la ejecución del batch de actualizaciones:', error);
            } finally {
                pendingUpdates.clear();
            }
        } else {
            logWebSocket('debug', 'No hay actualizaciones pendientes para ejecutar');
        }
    },
    UPDATE_CONFIG.BATCH_UPDATE_DELAY,
    { context: 'websocket_batch' }
);

// Función para agregar actualización al lote
function queueUpdate(updateFunction) {
    pendingUpdates.add(updateFunction);
    debouncedBatchUpdate();
}

// Función para cancelar todas las actualizaciones pendientes
function cancelPendingUpdates() {
    logWebSocket('info', 'Cancelando todas las actualizaciones pendientes');
    const startTime = performance.now();
    
    // Cancelar timers de throttle y debounce relacionados con WebSocket
    const canceledTimers = cancelPendingTimers('websocket');
    
    const pendingCount = pendingUpdates.size;
    pendingUpdates.clear();
    
    logWebSocket('info', `Actualizaciones canceladas: ${pendingCount} pendientes, ${canceledTimers.debounce} debounce, ${canceledTimers.throttle} throttle`, null, startTime);
}

// Función para inicializar la conexión WebSocket
function initWebSocket() {
    logWebSocket('info', 'Iniciando conexión WebSocket');
    const startTime = performance.now();
    
    // Determinar el protocolo de WebSocket (wss para HTTPS, ws para HTTP)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    logWebSocket('debug', `URL de conexión: ${wsUrl}`);
    
    // Crear objeto WebSocket
    try {
        socket = new WebSocket(wsUrl);
        
        // Evento de conexión establecida
        socket.onopen = function(event) {
            logWebSocket('info', 'Conexión WebSocket establecida', null, startTime);
            reconnectAttempts = 0;
            isWebSocketActive = true;
            updateConnectionStatus(true);
            showToast('Conexión en tiempo real establecida', 'success');
            
            // Solicitar actualización inicial de datos
            requestInitialData();
        };
        
        // Evento de recepción de mensaje
        socket.onmessage = function(event) {
            const messageStartTime = performance.now();
            logWebSocket('debug', 'Mensaje recibido');
            handleWebSocketMessage(event.data);
            logWebSocket('debug', 'Procesamiento de mensaje completado', null, messageStartTime);
        };
        
        // Evento de cierre de conexión
        socket.onclose = function(event) {
            logWebSocket('warn', `Conexión WebSocket cerrada. Código: ${event.code}`);
            isWebSocketActive = false;
            updateConnectionStatus(false);
            
            // Iniciar actualización automática como respaldo
            startAutoRefresh();
            
            // Intentar reconectar si no fue un cierre normal
            if (event.code !== 1000 && event.code !== 1001) {
                handleWebSocketReconnection();
            }
        };
        
        // Evento de error
        socket.onerror = function(error) {
            handleWebSocketError(error, 'conexión WebSocket');
        };
    } catch (error) {
        handleWebSocketError(error, 'inicialización WebSocket');
    }
}

// Actualizar indicador visual de estado de conexión
function updateConnectionStatus(connected) {
    logWebSocket('debug', `Actualizando estado de conexión: ${connected ? 'conectado' : 'desconectado'}`);
    
    const statusIndicator = document.querySelector('.status-indicator .status-dot');
    const statusText = document.querySelector('.status-indicator .status-text');
    
    if (statusIndicator && statusText) {
        if (connected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('disconnected');
            statusText.textContent = 'Sistema conectado';
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Sistema desconectado';
        }
    } else {
        logWebSocket('warn', 'No se encontraron los elementos de indicador de estado');
    }
    
    // Actualizar última hora de actualización
    updateLastUpdateTime();
}

// Actualizar hora de última actualización
function updateLastUpdateTime() {
    const lastUpdateTimeEl = document.getElementById('lastUpdateTime');
    if (lastUpdateTimeEl) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        lastUpdateTimeEl.textContent = timeStr;
    }
}

// Manejar la reconexión del WebSocket
function handleWebSocketReconnection() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        logWebSocket('debug', `Intentando reconectar (${reconnectAttempts}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
            logWebSocket('debug', 'Ejecutando reconexión programada');
            try {
                initWebSocket();
            } catch (error) {
                handleWebSocketError(error, 'reconexión WebSocket');
            }
        }, reconnectDelay);
    } else {
        AppLogger.error('websocket', 'Se ha alcanzado el número máximo de intentos de reconexión', {
            intentos: reconnectAttempts,
            maximo: maxReconnectAttempts
        });
        showToast('Error de conexión en tiempo real. Recargue la página para reintentar.', 'error');
        
        // Iniciar actualización automática como respaldo
        startAutoRefresh();
    }
}

// Solicitar datos iniciales al conectar
function requestInitialData() {
    logWebSocket('debug', 'Solicitando datos iniciales');
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        const requestMsg = JSON.stringify({
            type: 'request_data',
            data: { tables: ['machines', 'sensors', 'models'] }
        });
        
        try {
            socket.send(requestMsg);
            logWebSocket('debug', 'Solicitud de datos iniciales enviada correctamente');
        } catch (error) {
            handleWebSocketError(error, 'solicitud de datos iniciales');
        }
    } else {
        logWebSocket('warn', 'No se pueden solicitar datos iniciales: socket no disponible o no está abierto');
    }
}

// Procesar los mensajes recibidos por WebSocket
function handleWebSocketMessage(data) {
    const startTime = performance.now();
    
    try {
        // Intentar parsear el mensaje JSON
        let message;
        try {
            message = JSON.parse(data);
        } catch (parseError) {
            handleWebSocketError(parseError, 'parseo de mensaje WebSocket', false, {
                rawData: typeof data === 'string' ? data.substring(0, 100) + '...' : 'Datos no válidos',
                dataType: typeof data
            });
            return;
        }
        
        if (!message.type) {
            logWebSocket('warn', 'Formato de mensaje inválido:', message);
            return;
        }
        
        logWebSocket('debug', `Mensaje recibido de tipo: ${message.type}`);
        
        // Actualizar hora de última actualización
        updateLastUpdateTime();
        
        // Aplicar throttling a los mensajes
        if (!shouldProcessMessage(message.type)) {
            logWebSocket('debug', `Mensaje throttled: ${message.type}`);
            return;
        }
        
        // Medir el tiempo de procesamiento según el tipo de mensaje
        const processingStartTime = performance.now();
        
        // Manejar diferentes tipos de mensajes
        switch (message.type) {
            case 'machine_update':
                logWebSocket('debug', 'Procesando actualización de máquinas');
                refreshMachinesTable();
                break;
                
            case 'sensor_update':
                logWebSocket('debug', 'Procesando actualización de sensores');
                refreshSensorsTable();
                break;
                
            case 'model_update':
                logWebSocket('debug', 'Procesando actualización de modelos');
                refreshModelsTable();
                break;
                
            case 'reload_all':
                // Para reload_all siempre procesar inmediatamente
                logWebSocket('debug', 'Procesando recarga completa');
                refreshAllTables();
                break;
                
            case 'ping':
                // Solo actualizar el estado de conexión
                logWebSocket('debug', 'Ping recibido');
                updateConnectionStatus(true);
                break;
                
            default:
                logWebSocket('warn', `Tipo de mensaje no reconocido: ${message.type}`);
        }
        
        logWebSocket('debug', `Procesamiento de mensaje ${message.type} completado`, null, processingStartTime);
    } catch (error) {
        handleWebSocketError(error, 'procesamiento de mensaje WebSocket', false, {
            dataSnippet: typeof data === 'string' ? data.substring(0, 100) + '...' : 'Datos no válidos'
        });
    } finally {
        logWebSocket('debug', 'Manejo de mensaje WebSocket completado', null, startTime);
    }
}

// Actualizar tabla de máquinas
function refreshMachinesTable() {
    logWebSocket('debug', 'Solicitud de actualización para tabla de máquinas');
    
    if (!shouldUpdate()) {
        logWebSocket('debug', 'Actualizaciones demasiado frecuentes, encolando actualización de máquinas');
        queueUpdate(() => {
            if (typeof loadMachinesTable === 'function') {
                loadMachinesTable();
            }
        });
        return;
    }
    
    logWebSocket('debug', 'Ejecutando actualización inmediata de tabla de máquinas');
    const startTime = performance.now();
    
    if (typeof loadMachinesTable === 'function') {
        try {
            loadMachinesTable();
            logWebSocket('debug', 'Actualización de tabla de máquinas completada', null, startTime);
        } catch (error) {
            handleWebSocketError(error, 'actualización de tabla de máquinas');
        }
    } else {
        logWebSocket('warn', 'Función loadMachinesTable no disponible');
    }
}

// Actualizar tabla de sensores
function refreshSensorsTable() {
    logWebSocket('debug', 'Solicitud de actualización para tabla de sensores');
    
    if (!shouldUpdate()) {
        logWebSocket('debug', 'Actualizaciones demasiado frecuentes, encolando actualización de sensores');
        queueUpdate(() => {
            if (typeof loadSensorsTable === 'function') {
                loadSensorsTable();
            }
        });
        return;
    }
    
    logWebSocket('debug', 'Ejecutando actualización inmediata de tabla de sensores');
    const startTime = performance.now();
    
    if (typeof loadSensorsTable === 'function') {
        try {
            loadSensorsTable();
            logWebSocket('debug', 'Actualización de tabla de sensores completada', null, startTime);
        } catch (error) {
            handleWebSocketError(error, 'actualización de tabla de sensores');
        }
    } else {
        logWebSocket('warn', 'Función loadSensorsTable no disponible');
    }
}

// Actualizar tabla de modelos
function refreshModelsTable() {
    logWebSocket('debug', 'Solicitud de actualización para tabla de modelos');
    
    if (!shouldUpdate()) {
        logWebSocket('debug', 'Actualizaciones demasiado frecuentes, encolando actualización de modelos');
        queueUpdate(() => {
            if (typeof loadModelsTable === 'function') {
                loadModelsTable();
            }
        });
        return;
    }
    
    logWebSocket('debug', 'Ejecutando actualización inmediata de tabla de modelos');
    const startTime = performance.now();
    
    if (typeof loadModelsTable === 'function') {
        try {
            loadModelsTable();
            logWebSocket('debug', 'Actualización de tabla de modelos completada', null, startTime);
        } catch (error) {
            handleWebSocketError(error, 'actualización de tabla de modelos');
        }
    } else {
        logWebSocket('warn', 'Función loadModelsTable no disponible');
    }
}

// Actualizar todas las tablas
function refreshAllTables() {
    logWebSocket('info', 'Iniciando actualización de todas las tablas');
    const startTime = performance.now();
    
    if (!shouldUpdate()) {
        logWebSocket('debug', 'Actualizaciones demasiado frecuentes, encolando actualización completa');
        queueUpdate(() => {
            refreshMachinesTable();
            refreshSensorsTable();
            refreshModelsTable();
        });
        return;
    }
    
    try {
        refreshMachinesTable();
        refreshSensorsTable();
        refreshModelsTable();
        logWebSocket('info', 'Actualización de todas las tablas completada', null, startTime);
    } catch (error) {
        handleWebSocketError(error, 'actualización de todas las tablas');
    }
}

// Iniciar actualización automática como respaldo cuando WebSocket no está disponible
function startAutoRefresh() {
    logWebSocket('info', 'Iniciando actualización automática como respaldo');
    
    // Limpiar temporizadores existentes
    stopAutoRefresh();
    
    // Solo iniciar si WebSocket no está activo
    if (!isWebSocketActive) {
        logWebSocket('debug', `Configurando actualizaciones automáticas cada ${UPDATE_CONFIG.AUTO_REFRESH_INTERVAL}ms`);
        
        // Configurar temporizadores para actualización periódica
        autoRefreshTimers.machines = setInterval(() => {
            if (!isWebSocketActive) {
                logWebSocket('debug', 'Ejecutando actualización automática de máquinas');
                refreshMachinesTable();
            }
        }, UPDATE_CONFIG.AUTO_REFRESH_INTERVAL);
        
        autoRefreshTimers.sensors = setInterval(() => {
            if (!isWebSocketActive) {
                logWebSocket('debug', 'Ejecutando actualización automática de sensores');
                refreshSensorsTable();
            }
        }, UPDATE_CONFIG.AUTO_REFRESH_INTERVAL);
        
        autoRefreshTimers.models = setInterval(() => {
            if (!isWebSocketActive) {
                logWebSocket('debug', 'Ejecutando actualización automática de modelos');
                refreshModelsTable();
            }
        }, UPDATE_CONFIG.AUTO_REFRESH_INTERVAL);
        
        logWebSocket('info', 'Actualización automática configurada correctamente');
    } else {
        logWebSocket('debug', 'No se inicia actualización automática porque WebSocket está activo');
    }
}

// Detener actualización automática
function stopAutoRefresh() {
    logWebSocket('debug', 'Deteniendo actualizaciones automáticas');
    
    let count = 0;
    if (autoRefreshTimers.machines) {
        clearInterval(autoRefreshTimers.machines);
        autoRefreshTimers.machines = null;
        count++;
    }
    
    if (autoRefreshTimers.sensors) {
        clearInterval(autoRefreshTimers.sensors);
        autoRefreshTimers.sensors = null;
        count++;
    }
    
    if (autoRefreshTimers.models) {
        clearInterval(autoRefreshTimers.models);
        autoRefreshTimers.models = null;
        count++;
    }
    
    logWebSocket('debug', `${count} temporizadores de actualización automática detenidos`);
}

// Escuchar eventos de actualización desde los componentes
function setupUpdateListeners() {
    // Limpiar listeners existentes para evitar duplicaciones
    cleanupRealtimeListeners();
    
    // Configurar botón de actualización manual usando delegación de eventos
    const configHeader = document.querySelector('.config-header') || document.querySelector('.header-actions');
    if (configHeader) {
        addRealtimeListener(configHeader, 'click', (e) => {
            const refreshBtn = e.target.closest('#refreshDataBtn');
            if (refreshBtn) {
                refreshAllTables();
                showToast('Datos actualizados', 'info');
            }
        });
    }
    
    // Escuchar eventos de actualización de tablas
    addRealtimeListener(document, 'machinesTableUpdated', () => {
        console.log('Tabla de máquinas actualizada');
        updateLastUpdateTime();
    });
    
    addRealtimeListener(document, 'sensorsTableUpdated', () => {
        console.log('Tabla de sensores actualizada');
        updateLastUpdateTime();
    });
    
    addRealtimeListener(document, 'modelsTableUpdated', () => {
        console.log('Tabla de modelos actualizada');
        updateLastUpdateTime();
    });
}

// Iniciar el WebSocket y configurar escuchas de eventos cuando el documento esté listo
addRealtimeListener(document, 'DOMContentLoaded', function() {
    // Configurar escuchas de eventos primero
    setupUpdateListeners();
    
    // Solo iniciar si estamos en la página de configuración
    if (getCurrentPage().includes('configuracion')) {
        initWebSocket();
    }
});

// Iniciar WebSocket cuando se cambie a la página de configuración
addRealtimeListener(document, 'pageChanged', function(event) {
    // Limpiar listeners si salimos de la página de configuración
    if (event.detail && event.detail.from === 'configuracion') {
        console.log('Saliendo de configuración, limpiando listeners de tiempo real...');
        cleanupRealtimeListeners();
    }
    
    // Iniciar WebSocket si entramos a la página de configuración
    if (event.detail && event.detail.page.includes('configuracion')) {
        // Cancelar actualizaciones pendientes
        cancelPendingUpdates();
        
        // Si ya había una conexión, cerrarla primero
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        
        // Detener actualización automática
        stopAutoRefresh();
        
        // Iniciar WebSocket
        initWebSocket();
        
        // Configurar nuevos listeners
        setupUpdateListeners();
    }
});

// Exportar funciones necesarias
window.cleanupRealtimeListeners = cleanupRealtimeListeners; 