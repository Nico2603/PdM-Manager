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

// Función centralizada para manejar errores en WebSocket
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

    return window.addManagedEventListener(element, event, handler, 'realtime', options);
}

// Función para limpiar todos los listeners de tiempo real
function cleanupRealtimeListeners() {
    logWebSocket('info', 'Limpiando event listeners de tiempo real');
    return window.cleanupEventListenersByCategory('realtime');
}

// Función para controlar la tasa de actualizaciones utilizando el sistema unificado
function shouldProcessWebSocketUpdate(key) {
    // Usar el sistema unificado shouldUpdate con un intervalo específico para WebSocket
    const result = shouldUpdate(`websocket_${key}`, UPDATE_CONFIG.MIN_UPDATE_INTERVAL);
    
    if (!result && THROTTLE_CONFIG.LOG_SKIPPED_UPDATES) {
        logWebSocket('debug', `Actualización WebSocket ignorada para '${key}' (throttled)`);
    }
    
    return result;
}

// Función obsoleta - usar shouldProcessWebSocketUpdate en su lugar
function shouldUpdate() {
    console.warn('Función shouldUpdate() en realtime-updates.js está obsoleta. Usar shouldProcessWebSocketUpdate() en su lugar.');
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
    
    // Generar una clave única para este tipo de mensaje
    const throttleKey = `message_${messageType}`;
    
    // Usar el sistema unificado shouldUpdate para verificar si debemos procesar
    if (shouldUpdate(throttleKey, UPDATE_CONFIG.THROTTLE_INTERVAL, true)) {
        logWebSocket('debug', `Procesando mensaje (intervalo suficiente): ${messageType}`);
        return true;
    }
    
    // Obtener una versión throttled de la función de procesamiento
    const throttledFn = getThrottledMessageProcessor(messageType);
    
    // Programar para ejecución posterior
    if (THROTTLE_CONFIG.LOG_SKIPPED_UPDATES) {
        logWebSocket('debug', `Throttling mensaje: ${messageType}, programando para ejecución posterior`);
    }
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
    logWebSocket('info', 'Solicitando datos iniciales del servidor');
    
    try {
        // Verificar que los límites de aceleración estén configurados
        fetch(`${API_CONFIG.BASE_URL}/api/limits`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error al obtener límites: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                logWebSocket('debug', 'Límites de aceleración cargados correctamente');
                
                // Establecer límites en estado global
                if (typeof setGlobalState === 'function') {
                    setGlobalState('vibrationLimits', data);
                }
                
                // Actualizar formulario de límites si es visible
                if (document.getElementById('limitsForm')) {
                    updateLimitsForm(data);
                }
            })
            .catch(error => {
                logWebSocket('error', 'Error al cargar límites, intentando crear valores por defecto', error);
                
                // Intentar crear límites por defecto
                fetch(`${API_CONFIG.BASE_URL}/api/limits/reset`, {
                    method: 'POST'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error al resetear límites: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    logWebSocket('info', 'Límites de aceleración restablecidos a valores por defecto');
                    
                    // Establecer límites en estado global
                    if (typeof setGlobalState === 'function') {
                        setGlobalState('vibrationLimits', data);
                    }
                    
                    // Actualizar formulario de límites si es visible
                    if (document.getElementById('limitsForm')) {
                        updateLimitsForm(data);
                    }
                })
                .catch(resetError => {
                    logWebSocket('error', 'Error al restablecer límites por defecto', resetError);
                });
            });
        
        // Solicitar datos para las tablas principales
        Promise.all([
            refreshMachinesTable(), 
            refreshSensorsTable(), 
            refreshModelsTable()
        ])
        .then(() => {
            logWebSocket('info', 'Datos iniciales cargados correctamente');
        })
        .catch(error => {
            logWebSocket('error', 'Error al cargar datos iniciales', error);
        });
        
    } catch (error) {
        logWebSocket('error', 'Error al solicitar datos iniciales', error);
    }
}

// Manejar mensajes WebSocket
function handleWebSocketMessage(data) {
    logWebSocket('debug', `Mensaje recibido: ${data.type}`);
    
    // Comprobar si debemos procesar este tipo de mensaje o aplicar throttling
    if (!shouldProcessMessage(data.type)) {
        return; // El mensaje se procesará más tarde mediante throttling
    }
    
    try {
        switch (data.type) {
            case 'machine_update':
                logWebSocket('debug', 'Actualizando tabla de máquinas desde WebSocket');
                refreshMachinesTable();
                break;
                
            case 'sensor_update':
                logWebSocket('debug', 'Actualizando tabla de sensores desde WebSocket');
                refreshSensorsTable();
                
                // También actualizar los selectores de sensores en las máquinas
                updateMachineSensorSelectors();
                break;
                
            case 'model_update':
                logWebSocket('debug', 'Actualizando tabla de modelos desde WebSocket');
                refreshModelsTable();
                
                // También actualizar los selectores de modelos en los sensores
                updateModelSelectors();
                break;
                
            case 'vibration_data':
                if (!shouldProcessWebSocketUpdate('vibration_data')) return;
                
                logWebSocket('debug', 'Datos de vibración recibidos');
                // Implementación de actualización de datos de vibración
                handleVibrationData(data.data);
                break;
                
            case 'alert':
                if (!shouldProcessWebSocketUpdate('alert')) return;
                
                logWebSocket('debug', 'Alerta recibida');
                // Implementación de actualización de alertas
                handleAlertUpdate(data.data);
                break;
                
            case 'system_status':
                logWebSocket('debug', 'Actualización de estado del sistema recibida');
                updateSystemStatus(data.data);
                break;
                
            case 'config_update':
                logWebSocket('debug', 'Actualización de configuración recibida');
                handleConfigUpdate(data.data);
                break;
                
            default:
                logWebSocket('warn', `Tipo de mensaje desconocido: ${data.type}`);
        }
    } catch (error) {
        logWebSocket('error', `Error al procesar mensaje WebSocket de tipo ${data.type}`, error);
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

// Función para manejar actualizaciones de datos de vibración
function handleVibrationData(data) {
    logWebSocket('debug', 'Procesando datos de vibración');
    
    // Actualizar gráficos si la función existe
    if (typeof window.updateChartData === 'function') {
        window.updateChartData(data);
    }
    
    // Actualizar valores de monitoreo en tiempo real
    updateRealtimeMonitoringValues(data);
}

// Función para actualizar valores de monitoreo en tiempo real
function updateRealtimeMonitoringValues(data) {
    // Actualizar valores en la interfaz si existen los elementos
    if (data.acceleration_x !== undefined) {
        const xValueElement = document.getElementById('acceleration-x-value');
        if (xValueElement) {
            xValueElement.textContent = data.acceleration_x.toFixed(2);
        }
    }
    
    if (data.acceleration_y !== undefined) {
        const yValueElement = document.getElementById('acceleration-y-value');
        if (yValueElement) {
            yValueElement.textContent = data.acceleration_y.toFixed(2);
        }
    }
    
    if (data.acceleration_z !== undefined) {
        const zValueElement = document.getElementById('acceleration-z-value');
        if (zValueElement) {
            zValueElement.textContent = data.acceleration_z.toFixed(2);
        }
    }
    
    // Actualizar indicador de severidad si existe
    if (data.severity !== undefined) {
        const severityElement = document.getElementById('vibration-severity');
        if (severityElement) {
            severityElement.textContent = getSeverityText(data.severity);
            
            // Actualizar clase de severidad
            severityElement.className = 'severity-indicator';
            severityElement.classList.add(`severity-${data.severity}`);
        }
    }
}

// Función para obtener texto de severidad
function getSeverityText(severity) {
    switch (severity) {
        case 0: return 'Normal';
        case 1: return 'Advertencia';
        case 2: return 'Alerta';
        case 3: return 'Crítico';
        default: return 'Desconocido';
    }
}

// Función para manejar actualizaciones de alertas
function handleAlertUpdate(data) {
    logWebSocket('debug', 'Procesando alerta recibida', data);
    
    // Mostrar alerta en UI para alertas de severidad alta
    if (data.error_type >= 2) {
        logWebSocket('warn', `Alerta de tipo ${data.error_type} recibida`);
        
        // Mostrar alertas críticas con mayor prominencia
        if (data.error_type === 3 && typeof window.showCriticalAlert === 'function') {
            window.showCriticalAlert(data);
        }
        
        // Mostrar notificación toast
        showToast(
            `Alerta: ${getAlertTypeText(data.error_type)}`, 
            data.error_type === 3 ? 'error' : 'warning'
        );
        
        // Reproducir sonido de alerta si existe la función
        if (typeof window.playAlertSound === 'function') {
            window.playAlertSound(data.error_type);
        }
    }
    
    // Actualizar contadores de alertas en el dashboard
    updateAlertCounters();
    
    // Actualizar tabla de alertas si estamos en la vista de alertas
    if (document.getElementById('alertsTable') && 
        typeof window.refreshAlertsTable === 'function') {
        window.refreshAlertsTable();
    }
}

// Función para obtener texto descriptivo del tipo de alerta
function getAlertTypeText(errorType) {
    switch (errorType) {
        case 1: return 'Anomalía Leve';
        case 2: return 'Anomalía Significativa';
        case 3: return 'Anomalía Crítica / Repetitiva';
        default: return 'Desconocida';
    }
}

// Función para actualizar contadores de alertas
function updateAlertCounters() {
    // Obtener contadores actualizados desde el servidor
    fetch(`${API_CONFIG.BASE_URL}/api/dashboard-data/stats?time_range=day`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener estadísticas: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Actualizar contadores en la interfaz
            if (data.alert_counts) {
                const counts = data.alert_counts;
                
                // Actualizar contadores si existen los elementos
                if (document.getElementById('level1Count')) {
                    document.getElementById('level1Count').textContent = counts.level1 || 0;
                }
                
                if (document.getElementById('level2Count')) {
                    document.getElementById('level2Count').textContent = counts.level2 || 0;
                }
                
                if (document.getElementById('level3Count')) {
                    document.getElementById('level3Count').textContent = counts.level3 || 0;
                }
                
                if (document.getElementById('totalAlertsCount')) {
                    document.getElementById('totalAlertsCount').textContent = counts.total || 0;
                }
            }
        })
        .catch(error => {
            logWebSocket('error', 'Error al actualizar contadores de alertas', error);
        });
}

// Función para manejar actualizaciones de estado del sistema
function updateSystemStatus(data) {
    logWebSocket('debug', 'Actualizando estado del sistema', data);
    
    // Actualizar indicador de estado
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    if (statusIndicator && statusText) {
        if (data.connected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('disconnected');
            statusText.textContent = 'Sistema conectado';
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Sistema desconectado';
        }
    }
    
    // Actualizar estado de monitoreo
    if (data.monitoring !== undefined) {
        const monitoringStatus = document.getElementById('monitoringStatus');
        const startMonitoringBtn = document.getElementById('startMonitoringBtn');
        
        if (monitoringStatus) {
            const statusIndicator = monitoringStatus.querySelector('.status-indicator');
            const statusText = monitoringStatus.querySelector('.status-text');
            
            if (statusIndicator && statusText) {
                if (data.monitoring) {
                    statusIndicator.classList.add('active');
                    statusText.textContent = 'Monitoreo activo';
                    
                    if (startMonitoringBtn) {
                        startMonitoringBtn.innerHTML = '<i class="fas fa-stop-circle mr-2"></i> Detener Monitoreo';
                        startMonitoringBtn.classList.add('btn-danger');
                        startMonitoringBtn.classList.remove('btn-primary');
                    }
                } else {
                    statusIndicator.classList.remove('active');
                    statusText.textContent = 'Monitoreo detenido';
                    
                    if (startMonitoringBtn) {
                        startMonitoringBtn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> Iniciar Monitoreo';
                        startMonitoringBtn.classList.add('btn-primary');
                        startMonitoringBtn.classList.remove('btn-danger');
                    }
                }
            }
        }
    }
    
    // Actualizar hora de última actualización
    updateLastUpdateTime();
}

// Función para manejar actualizaciones de configuración
function handleConfigUpdate(data) {
    logWebSocket('debug', 'Procesando actualización de configuración', data);
    
    if (data.limits) {
        // Actualizar límites en el estado global
        if (typeof setGlobalState === 'function') {
            setGlobalState('vibrationLimits', data.limits);
        }
        
        // Actualizar formulario de límites si es visible
        if (document.getElementById('limitsForm')) {
            updateLimitsForm(data.limits);
        }
    }
    
    // Verificar si tenemos una configuración válida para el monitoreo
    if (typeof window.checkValidConfiguration === 'function') {
        setTimeout(() => {
            window.checkValidConfiguration();
        }, 500);
    }
} 