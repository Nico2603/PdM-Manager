/**
 * PdM-Manager - Actualizaciones en tiempo real
 * Maneja la sincronización en tiempo real de los datos a través de WebSockets
 */

// Inicialización del WebSocket
let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3 segundos
let isWebSocketActive = false;

// Configurar intervalos de actualización automática (como respaldo al WebSocket)
const autoRefreshInterval = 30000; // 30 segundos
let autoRefreshTimers = {
    machines: null,
    sensors: null,
    models: null
};

// Función para inicializar la conexión WebSocket
function initWebSocket() {
    // Determinar el protocolo de WebSocket (wss para HTTPS, ws para HTTP)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Iniciando conexión WebSocket a:', wsUrl);
    
    // Crear objeto WebSocket
    socket = new WebSocket(wsUrl);
    
    // Evento de conexión establecida
    socket.onopen = function(event) {
        console.log('Conexión WebSocket establecida');
        reconnectAttempts = 0;
        isWebSocketActive = true;
        updateConnectionStatus(true);
        showToast('Conexión en tiempo real establecida', 'success');
        
        // Solicitar actualización inicial de datos
        requestInitialData();
    };
    
    // Evento de recepción de mensaje
    socket.onmessage = function(event) {
        handleWebSocketMessage(event.data);
    };
    
    // Evento de cierre de conexión
    socket.onclose = function(event) {
        console.log('Conexión WebSocket cerrada. Código:', event.code);
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
        console.error('Error en la conexión WebSocket:', error);
        isWebSocketActive = false;
        updateConnectionStatus(false);
        
        // Iniciar actualización automática como respaldo
        startAutoRefresh();
    };
}

// Actualizar indicador visual de estado de conexión
function updateConnectionStatus(connected) {
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
        console.log(`Intentando reconectar (${reconnectAttempts}/${maxReconnectAttempts})...`);
        
        setTimeout(() => {
            initWebSocket();
        }, reconnectDelay);
    } else {
        console.error('Se ha alcanzado el número máximo de intentos de reconexión');
        showToast('Error de conexión en tiempo real. Recargue la página para reintentar.', 'error');
    }
}

// Solicitar datos iniciales al conectar
function requestInitialData() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const requestMsg = JSON.stringify({
            type: 'request_data',
            data: { tables: ['machines', 'sensors', 'models'] }
        });
        socket.send(requestMsg);
    }
}

// Procesar los mensajes recibidos por WebSocket
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        
        if (!message.type) {
            console.warn('Formato de mensaje inválido:', message);
            return;
        }
        
        console.log('Mensaje WebSocket recibido:', message.type);
        
        // Actualizar hora de última actualización
        updateLastUpdateTime();
        
        // Manejar diferentes tipos de mensajes
        switch (message.type) {
            case 'machine_update':
                refreshMachinesTable();
                break;
                
            case 'sensor_update':
                refreshSensorsTable();
                break;
                
            case 'model_update':
                refreshModelsTable();
                break;
                
            case 'reload_all':
                refreshAllTables();
                break;
                
            case 'ping':
                // Solo actualizar el estado de conexión
                updateConnectionStatus(true);
                break;
                
            default:
                console.warn('Tipo de mensaje no reconocido:', message.type);
        }
    } catch (error) {
        console.error('Error al procesar mensaje WebSocket:', error);
    }
}

// Actualizar tabla de máquinas
function refreshMachinesTable() {
    if (typeof loadMachinesTable === 'function') {
        loadMachinesTable();
    }
}

// Actualizar tabla de sensores
function refreshSensorsTable() {
    if (typeof loadSensorsTable === 'function') {
        loadSensorsTable();
    }
}

// Actualizar tabla de modelos
function refreshModelsTable() {
    if (typeof loadModelsTable === 'function') {
        loadModelsTable();
    }
}

// Actualizar todas las tablas
function refreshAllTables() {
    refreshMachinesTable();
    refreshSensorsTable();
    refreshModelsTable();
}

// Iniciar actualización automática como respaldo cuando WebSocket no está disponible
function startAutoRefresh() {
    // Limpiar temporizadores existentes
    stopAutoRefresh();
    
    // Solo iniciar si WebSocket no está activo
    if (!isWebSocketActive) {
        console.log('Iniciando actualización automática como respaldo');
        
        // Configurar temporizadores para actualización periódica
        autoRefreshTimers.machines = setInterval(refreshMachinesTable, autoRefreshInterval);
        autoRefreshTimers.sensors = setInterval(refreshSensorsTable, autoRefreshInterval);
        autoRefreshTimers.models = setInterval(refreshModelsTable, autoRefreshInterval);
    }
}

// Detener actualización automática
function stopAutoRefresh() {
    if (autoRefreshTimers.machines) clearInterval(autoRefreshTimers.machines);
    if (autoRefreshTimers.sensors) clearInterval(autoRefreshTimers.sensors);
    if (autoRefreshTimers.models) clearInterval(autoRefreshTimers.models);
    
    autoRefreshTimers.machines = null;
    autoRefreshTimers.sensors = null;
    autoRefreshTimers.models = null;
}

// Escuchar eventos de actualización desde los componentes
function setupUpdateListeners() {
    // Configurar botón de actualización manual
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', () => {
            refreshAllTables();
            showToast('Datos actualizados', 'info');
        });
    }
    
    // Escuchar eventos de actualización de tablas
    document.addEventListener('machinesTableUpdated', () => {
        console.log('Tabla de máquinas actualizada');
        updateLastUpdateTime();
    });
    
    document.addEventListener('sensorsTableUpdated', () => {
        console.log('Tabla de sensores actualizada');
        updateLastUpdateTime();
    });
    
    document.addEventListener('modelsTableUpdated', () => {
        console.log('Tabla de modelos actualizada');
        updateLastUpdateTime();
    });
}

// Iniciar el WebSocket y configurar escuchas de eventos cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Configurar escuchas de eventos primero
    setupUpdateListeners();
    
    // Solo iniciar si estamos en la página de configuración
    if (getCurrentPage().includes('configuracion')) {
        initWebSocket();
    }
});

// Iniciar WebSocket cuando se cambie a la página de configuración
document.addEventListener('pageChanged', function(event) {
    if (event.detail.page.includes('configuracion')) {
        // Si ya había una conexión, cerrarla primero
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        
        // Detener actualización automática
        stopAutoRefresh();
        
        // Iniciar WebSocket
        initWebSocket();
    }
}); 