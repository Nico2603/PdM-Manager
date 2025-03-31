// ==========================================================================
// SISTEMA CENTRAL DE LOGGING
// ==========================================================================

// Inicializar el registro de logs global
window.APP_LOGS = window.APP_LOGS || [];
window.DEBUG_MODE = window.localStorage.getItem('debug_mode') === 'true' || false;

// Sistema centralizado de logging
const AppLogger = {
    /**
     * Registra un mensaje en el sistema central de logs
     * @param {string} component - Componente que genera el log ('dashboard', 'navigation', 'websocket', etc)
     * @param {string} level - Nivel de log ('debug', 'info', 'warn', 'error')
     * @param {string} message - Mensaje a registrar
     * @param {any} data - Datos adicionales opcionales
     * @param {number} startTime - Tiempo de inicio en ms para calcular duración (opcional)
     */
    log: function(component, level, message, data = null, startTime = null) {
        // Definir colores para cada nivel de log
        const logColors = {
            debug: '#888888',
            info: '#0088ff',
            warn: '#ff8800',
            error: '#ff0000'
        };
        
        // Formatear tiempo transcurrido si se proporcionó un tiempo de inicio
        let timeInfo = '';
        if (startTime) {
            const elapsed = (performance.now() - startTime).toFixed(2);
            timeInfo = ` (${elapsed}ms)`;
        }
        
        // Formatear mensaje con componente, nivel y tiempo
        const formattedMsg = `[${component.toUpperCase()}][${level.toUpperCase()}]${timeInfo} ${message}`;
        
        // Log según nivel con el color adecuado
        switch (level) {
            case 'debug':
                if (window.DEBUG_MODE) {
                    console.debug(`%c${formattedMsg}`, `color: ${logColors.debug}`);
                }
                break;
            case 'info':
                console.info(`%c${formattedMsg}`, `color: ${logColors.info}`);
                break;
            case 'warn':
                console.warn(`%c${formattedMsg}`, `color: ${logColors.warn}`);
                break;
            case 'error':
                console.error(`%c${formattedMsg}`, `color: ${logColors.error}`);
                break;
        }
        
        // Mostrar datos adicionales si se proporcionaron
        if (data && (level === 'error' || level === 'warn' || window.DEBUG_MODE)) {
            console.log(data);
        }
        
        // Guardar log en historial global
        const logEntry = {
            timestamp: new Date().toISOString(),
            component: component,
            level: level,
            message: message,
            timeElapsed: startTime ? (performance.now() - startTime).toFixed(2) : null,
            data: data
        };
        
        window.APP_LOGS.push(logEntry);
        
        // Limitar tamaño del historial de logs
        if (window.APP_LOGS.length > 1000) {
            window.APP_LOGS.shift();
        }
        
        // Notificar a la interfaz de usuario
        if (typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('app-log', { detail: logEntry }));
        }
    },
    
    /**
     * Registra un mensaje de nivel debug
     */
    debug: function(component, message, data = null, startTime = null) {
        this.log(component, 'debug', message, data, startTime);
    },
    
    /**
     * Registra un mensaje de nivel info
     */
    info: function(component, message, data = null, startTime = null) {
        this.log(component, 'info', message, data, startTime);
    },
    
    /**
     * Registra un mensaje de nivel warn
     */
    warn: function(component, message, data = null, startTime = null) {
        this.log(component, 'warn', message, data, startTime);
    },
    
    /**
     * Registra un mensaje de nivel error
     */
    error: function(component, message, data = null, startTime = null) {
        this.log(component, 'error', message, data, startTime);
    },
    
    /**
     * Limpia todos los logs almacenados
     */
    clear: function() {
        window.APP_LOGS = [];
        console.clear();
        this.info('system', 'Logs limpiados');
    },
    
    /**
     * Activa o desactiva el modo debug
     */
    setDebugMode: function(enabled) {
        window.DEBUG_MODE = enabled;
        window.localStorage.setItem('debug_mode', enabled);
        this.info('system', `Modo debug ${enabled ? 'activado' : 'desactivado'}`);
    },
    
    /**
     * Devuelve si el modo debug está activado
     */
    isDebugMode: function() {
        return window.DEBUG_MODE;
    },
    
    /**
     * Devuelve todos los logs almacenados
     */
    getLogs: function() {
        return window.APP_LOGS;
    },
    
    /**
     * Filtra logs por componente y/o nivel
     */
    filter: function(component = null, level = null) {
        let filtered = window.APP_LOGS;
        
        if (component) {
            filtered = filtered.filter(log => log.component === component);
        }
        
        if (level) {
            filtered = filtered.filter(log => log.level === level);
        }
        
        return filtered;
    },
    
    /**
     * Exporta los logs a un archivo JSON
     */
    exportLogs: function() {
        try {
            const logs = JSON.stringify(window.APP_LOGS, null, 2);
            const blob = new Blob([logs], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `pdm-logs-${timestamp}.json`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            this.info('system', 'Logs exportados correctamente');
            
            return filename;
        } catch (error) {
            this.error('system', 'Error al exportar logs', error);
            return null;
        }
    }
};

// Crear acceso global al logger
window.AppLogger = AppLogger;

// Función para registrar eventos de rendimiento
function logPerformanceEvent(name, duration) {
    AppLogger.debug('performance', `Evento: ${name}`, { duration });
}

// Configurar observer para monitorear eventos de rendimiento
if (window.PerformanceObserver) {
    try {
        const perfObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // Registrar eventos largos que pueden causar congelamiento
                if (entry.duration > 50) {
                    logPerformanceEvent(entry.name, entry.duration);
                }
            }
        });
        
        // Observar diferentes tipos de eventos de rendimiento
        perfObserver.observe({ entryTypes: ['longtask', 'measure', 'resource'] });
        AppLogger.info('system', 'Observer de rendimiento configurado');
    } catch (e) {
        AppLogger.warn('system', 'PerformanceObserver no soportado completamente', e);
    }
}

// Capturar errores no manejados
window.addEventListener('error', (event) => {
    AppLogger.error('system', 'Error no manejado', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
});

// Capturar promesas rechazadas no manejadas
window.addEventListener('unhandledrejection', (event) => {
    AppLogger.error('system', 'Promesa rechazada no manejada', {
        reason: event.reason
    });
});

// Exportar la herramienta de logging
AppLogger.info('system', 'Sistema de logging inicializado');
console.log('%c[PdM Manager] Sistema de logging inicializado. Usa AppLogger para registrar eventos.', 'color: #0088ff; font-weight: bold;'); 