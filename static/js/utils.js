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

function updateGlobalStats(limits) {
    if (!limits) return;
    
    // Obtener stats actuales o inicializar si no existen
    const currentStats = getGlobalState('stats') || {};
    
    // Actualizar límites para cada eje
    const updatedStats = {
        ...currentStats,
        x: {
            ...(currentStats.x || {}),
            sigma2: {
                lower: limits.x.sigma2.lower,
                upper: limits.x.sigma2.upper
            },
            sigma3: {
                lower: limits.x.sigma3.lower,
                upper: limits.x.sigma3.upper
            }
        },
        y: {
            ...(currentStats.y || {}),
            sigma2: {
                lower: limits.y.sigma2.lower,
                upper: limits.y.sigma2.upper
            },
            sigma3: {
                lower: limits.y.sigma3.lower,
                upper: limits.y.sigma3.upper
            }
        },
        z: {
            ...(currentStats.z || {}),
            sigma2: {
                lower: limits.z.sigma2.lower,
                upper: limits.z.sigma2.upper
            },
            sigma3: {
                lower: limits.z.sigma3.lower,
                upper: limits.z.sigma3.upper
            }
        }
    };
    
    // Actualizar el estado global
    setGlobalState('stats', updatedStats);
    
    return updatedStats;
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