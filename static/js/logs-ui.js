// ==========================================================================
// GESTIÓN DE LA INTERFAZ DE LOGS
// ==========================================================================

// Variables globales
let logsModal = null;
let logsTable = null;
let logFilters = {
    component: '',
    level: '',
    search: ''
};

// Funciones para manejar el filtrado y visualización de logs
function initLogsUI() {
    AppLogger.info('logs-ui', 'Inicializando interfaz de logs');
    const startTime = performance.now();
    
    // Obtener referencias a elementos DOM
    logsModal = document.getElementById('logsModal');
    logsTable = document.getElementById('logsTableBody');
    
    if (!logsModal || !logsTable) {
        AppLogger.error('logs-ui', 'No se encontraron los elementos necesarios para la interfaz de logs');
        return;
    }
    
    // Configurar eventos para el botón de mostrar logs
    const showLogsBtn = document.getElementById('showLogsBtn');
    if (showLogsBtn) {
        showLogsBtn.addEventListener('click', showLogsModal);
    }
    
    // Configurar eventos para cerrar el modal
    const closeButtons = logsModal.querySelectorAll('.modal-close, #closeLogsBtn');
    closeButtons.forEach(button => {
        button.addEventListener('click', hideLogsModal);
    });
    
    // Cerrar el modal al hacer clic fuera del contenido
    logsModal.addEventListener('click', function(event) {
        if (event.target === logsModal) {
            hideLogsModal();
        }
    });
    
    // Configurar eventos para los filtros
    const componentFilter = document.getElementById('logComponentFilter');
    const levelFilter = document.getElementById('logLevelFilter');
    const searchFilter = document.getElementById('logSearchFilter');
    
    if (componentFilter && levelFilter && searchFilter) {
        componentFilter.addEventListener('change', function() {
            logFilters.component = this.value;
            refreshLogsTable();
        });
        
        levelFilter.addEventListener('change', function() {
            logFilters.level = this.value;
            refreshLogsTable();
        });
        
        searchFilter.addEventListener('input', function() {
            logFilters.search = this.value.toLowerCase();
            refreshLogsTable();
        });
    }
    
    // Configurar eventos para los botones de acción
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const exportLogsBtn = document.getElementById('exportLogsBtn');
    const debugModeToggle = document.getElementById('debugModeToggle');
    
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', function() {
            if (confirm('¿Estás seguro de que deseas limpiar todos los logs?')) {
                AppLogger.clear();
                refreshLogsTable();
            }
        });
    }
    
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', function() {
            const filename = AppLogger.exportLogs();
            if (filename) {
                showToast(`Logs exportados a ${filename}`, 'success');
            } else {
                showToast('Error al exportar logs', 'error');
            }
        });
    }
    
    if (debugModeToggle) {
        // Establecer estado inicial
        debugModeToggle.checked = AppLogger.isDebugMode();
        
        debugModeToggle.addEventListener('change', function() {
            AppLogger.setDebugMode(this.checked);
            refreshLogsTable();
        });
    }
    
    // Configurar observer para actualizar la tabla de logs automáticamente
    window.addEventListener('app-log', function() {
        if (logsModal.classList.contains('show')) {
            refreshLogsTable();
        }
    });
    
    AppLogger.info('logs-ui', 'Interfaz de logs inicializada correctamente', null, startTime);
}

// Función para mostrar el modal de logs
function showLogsModal() {
    AppLogger.debug('logs-ui', 'Mostrando modal de logs');
    
    if (logsModal) {
        document.body.classList.add('modal-open');
        logsModal.classList.add('show');
        refreshLogsTable();
    }
}

// Función para ocultar el modal de logs
function hideLogsModal() {
    AppLogger.debug('logs-ui', 'Ocultando modal de logs');
    
    if (logsModal) {
        document.body.classList.remove('modal-open');
        logsModal.classList.remove('show');
    }
}

// Función para actualizar la tabla de logs
function refreshLogsTable() {
    const startTime = performance.now();
    AppLogger.debug('logs-ui', 'Actualizando tabla de logs');
    
    if (!logsTable) return;
    
    // Obtener logs filtrados
    let logs = AppLogger.getLogs();
    
    // Aplicar filtros
    if (logFilters.component) {
        logs = logs.filter(log => log.component === logFilters.component);
    }
    
    if (logFilters.level) {
        logs = logs.filter(log => log.level === logFilters.level);
    }
    
    if (logFilters.search) {
        logs = logs.filter(log => 
            log.message.toLowerCase().includes(logFilters.search) ||
            log.component.toLowerCase().includes(logFilters.search)
        );
    }
    
    // Vaciar tabla
    logsTable.innerHTML = '';
    
    // Si no hay logs
    if (logs.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="5" class="text-center">No hay logs disponibles</td>`;
        logsTable.appendChild(emptyRow);
    } else {
        // Mostrar los logs más recientes primero
        logs.reverse().forEach(log => {
            const row = document.createElement('tr');
            row.className = `log-row log-level-${log.level}`;
            
            // Formatear la fecha
            const timestamp = new Date(log.timestamp);
            const formattedTime = timestamp.toLocaleTimeString();
            
            // Formatear duración
            const duration = log.timeElapsed ? `${log.timeElapsed} ms` : '-';
            
            row.innerHTML = `
                <td>${formattedTime}</td>
                <td>${log.component}</td>
                <td>${log.level}</td>
                <td>${escapeHtml(log.message)}</td>
                <td>${duration}</td>
            `;
            
            // Si hay datos adicionales, agregar un data-attribute
            if (log.data) {
                row.setAttribute('data-log-data', JSON.stringify(log.data));
                row.classList.add('has-details');
                
                row.addEventListener('click', function() {
                    console.log('Detalles del log:', log.data);
                });
            }
            
            logsTable.appendChild(row);
        });
    }
    
    // Actualizar contador de logs
    const logsCount = document.getElementById('logsCount');
    if (logsCount) {
        logsCount.textContent = `${logs.length} logs`;
    }
    
    AppLogger.debug('logs-ui', 'Tabla de logs actualizada', null, startTime);
}

// Función para escapar HTML y prevenir XSS
function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initLogsUI);

// Exportar funciones
window.showLogsModal = showLogsModal;
window.hideLogsModal = hideLogsModal; 