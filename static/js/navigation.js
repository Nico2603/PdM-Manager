// ==========================================================================
// NAVEGACIÓN Y MENÚ LATERAL
// ==========================================================================

// Gestión de Event Listeners
const eventListeners = new Map();

// Función para registrar y gestionar event listeners
function addManagedEventListener(element, event, handler, options = false) {
    if (!element) {
        logNavigation('warn', 'addManagedEventListener: Elemento no válido');
        return;
    }
    
    // Crear identificador único para el elemento
    const elementId = element.id || 
                     (element === document ? 'document' : 
                     (element === window ? 'window' : 'anonymous'));
    
    // Crear clave única para el registro
    const key = `${elementId}-${event}`;
    
    // Remover listener existente si existe
    if (eventListeners.has(key)) {
        const { handler: oldHandler, options: oldOptions } = eventListeners.get(key);
        logNavigation('debug', `Removiendo listener existente: ${key}`);
        element.removeEventListener(event, oldHandler, oldOptions);
        eventListeners.delete(key);
    }
    
    // Agregar nuevo listener
    element.addEventListener(event, handler, options);
    eventListeners.set(key, { element, handler, options });
    
    logNavigation('debug', `Listener registrado: ${key}`);
    return key;
}

// Función para remover todos los event listeners registrados
function cleanupEventListeners() {
    logNavigation('info', `Limpieza de event listeners de navegación`);
    return cleanupEventListenersByCategory('navigation');
}

// Inicializar menú lateral
function initSidebar() {
    logNavigation('info', 'Inicializando menú lateral');
    const startTime = performance.now();
    
    // Usar delegación de eventos para el sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Manejar clics en elementos del sidebar
        addManagedEventListener(sidebar, 'click', (e) => {
            // Botón de actualización
            const refreshBtn = e.target.closest('#refreshDataBtn');
            if (refreshBtn) {
                logNavigation('debug', 'Clic en botón de actualización');
                if (typeof updateDashboardData === 'function') {
                    logNavigation('debug', 'Iniciando updateDashboardData desde sidebar');
                    updateDashboardData();
                    showToast('Datos actualizados', 'success');
                } else {
                    logNavigation('error', 'La función updateDashboardData no está disponible');
                }
                return;
            }
            
            // Enlaces de navegación
            const navLink = e.target.closest('.nav-link');
            if (navLink) {
                e.preventDefault();
                const targetPage = navLink.getAttribute('data-page');
                
                if (targetPage) {
                    logNavigation('debug', `Clic en enlace de navegación: ${targetPage}`);
                    // Actualizar clase activa directamente desde aquí
                    document.querySelectorAll('.nav-link').forEach(link => 
                        link.classList.remove('active'));
                    navLink.classList.add('active');
                    
                    // Navegar a la página
                    navigateTo(targetPage);
                }
            }
        }, 'navigation');
    } else {
        logNavigation('warn', 'No se encontró el elemento sidebar');
    }
    
    logNavigation('info', 'Inicialización de menú lateral completada', null, startTime);
}

// Inicializar navegación
function initNavigation() {
    logNavigation('info', 'Inicializando sistema de navegación');
    const startTime = performance.now();
    
    // Limpiar listeners existentes
    cleanupEventListeners();
    
    // Inicializar el sidebar primero
    initSidebar();
    
    // Configurar delegación de eventos para el contenido principal
    const contentContainer = document.querySelector('.content');
    if (contentContainer) {
        addManagedEventListener(contentContainer, 'click', (e) => {
            // Enlaces dentro del contenido
            const link = e.target.closest('a[href^="#"]');
            if (link && !link.classList.contains('nav-link')) {
                e.preventDefault();
                const targetPage = link.getAttribute('href').substring(1);
                if (targetPage) {
                    logNavigation('debug', `Clic en enlace interno: ${targetPage}`);
                    navigateTo(targetPage);
                }
            }
        }, 'navigation');
    } else {
        logNavigation('warn', 'No se encontró el contenedor de contenido');
    }
    
    // Configurar listener de hashchange
    addManagedEventListener(window, 'hashchange', handleHashChange, 'navigation');
    
    // Configurar listener para eventos de página cambiada
    addManagedEventListener(document, 'pageChanged', (e) => {
        logNavigation('debug', 'Evento pageChanged detectado:', e.detail);
        
        // Si hay listeners específicos para limpiar según la página
        if (e.detail.from) {
            if (e.detail.from === 'dashboard' && typeof cleanupDashboardListeners === 'function') {
                logNavigation('debug', 'Limpiando listeners específicos del dashboard');
                cleanupDashboardListeners();
            } else if (e.detail.from === 'configuracion' && typeof cleanupRealtimeListeners === 'function') {
                logNavigation('debug', 'Limpiando listeners específicos de configuración');
                cleanupRealtimeListeners();
            }
        }
    }, 'navigation');
    
    // Comprobar hash inicial
    if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        logNavigation('debug', `Hash inicial detectado: ${hash}`);
        navigateTo(hash);
    } else {
        logNavigation('debug', 'Sin hash inicial, navegando a dashboard');
        navigateTo('dashboard');
    }
    
    logNavigation('info', 'Inicialización de navegación completada', null, startTime);
}

// Manejar limpiezas específicas de página
function cleanupPageSpecific(page) {
    logNavigation('info', `Limpiando recursos específicos de página: ${page}`);
    const startTime = performance.now();
    
    // Limpiar recursos específicos según la página que se abandona
    switch (page) {
        case 'dashboard':
            logNavigation('debug', 'Limpiando listeners específicos del dashboard');
            cleanupEventListenersByCategory('dashboard');
            break;
        case 'configuracion':
            logNavigation('debug', 'Limpiando listeners específicos de configuración');
            cleanupEventListenersByCategory('realtime');
            break;
    }
    
    logNavigation('info', `Limpieza específica de página ${page} completada`, null, startTime);
}

// Manejador de cambios de hash
function handleHashChange() {
    logNavigation('debug', 'Evento hashchange detectado');
    const hash = window.location.hash.substring(1);
    if (hash) {
        logNavigation('debug', `Nuevo hash: ${hash}`);
        navigateTo(hash);
    } else {
        logNavigation('debug', 'Hash vacío, navegando a dashboard');
        // Si no hay hash, ir a la página por defecto (dashboard)
        navigateTo('dashboard');
    }
}

// Control de navegación
let navigationCount = 0;
let lastNavigationTime = 0;
const NAVIGATION_DEBOUNCE = 300; // 300ms entre navegaciones
let currentPage = '';

// Navegar a la página indicada
function navigateTo(page) {
    logNavigation('info', `Iniciando navegación a: ${page}`);
    const startTime = performance.now();
    
    const now = Date.now();
    navigationCount++;
    logNavigation('debug', `Navegación #${navigationCount} - Tiempo desde última: ${now - lastNavigationTime}ms`);
    
    // Evitar navegaciones demasiado frecuentes
    if (now - lastNavigationTime < NAVIGATION_DEBOUNCE) {
        logNavigation('warn', `Navegación ignorada: demasiado frecuente (< ${NAVIGATION_DEBOUNCE}ms)`);
        return;
    }
    
    lastNavigationTime = now;
    
    try {
        // Validar que page sea una cadena no vacía
        if (!page || typeof page !== 'string') {
            logNavigation('error', 'Página inválida:', page);
            page = 'dashboard';
        }
        
        // Si la página contiene ":", es una subpágina
        let mainPage = page;
        let subPage = null;
        
        if (page.includes(':')) {
            [mainPage, subPage] = page.split(':');
            logNavigation('debug', 'Subpágina detectada:', { mainPage, subPage });
        }
        
        // Capturar la página anterior antes de cambiar
        const previousPage = currentPage;
        currentPage = mainPage;
        
        // Lanzar evento de cambio de página
        dispatchPageChangedEvent(mainPage, previousPage);
        
        // Limpieza específica de la página anterior
        if (previousPage && previousPage !== mainPage) {
            logNavigation('debug', `Cambiando de ${previousPage} a ${mainPage}, iniciando limpieza`);
            cleanupPageSpecific(previousPage);
        }
        
        // Actualizar hash en la URL
        const newHash = '#' + page;
        if (window.location.hash !== newHash) {
            logNavigation('debug', `Actualizando hash de URL: ${newHash}`);
            try {
                history.replaceState(null, null, newHash);
            } catch (e) {
                logNavigation('warn', 'Error al actualizar history API:', e);
                window.location.hash = page;
            }
        }
        
        // Actualizar estado de navegación en el menú
        logNavigation('debug', 'Actualizando menú de navegación');
        const menuStartTime = performance.now();
        const navLinks = document.querySelectorAll('.nav-link');
        const activeLink = document.querySelector(`.nav-link[data-page="${mainPage}"]`);
        
        if (activeLink) {
            navLinks.forEach(link => link.classList.remove('active'));
            activeLink.classList.add('active');
        }
        logNavigation('debug', 'Actualización del menú completada', null, menuStartTime);
        
        // Mostrar la sección correspondiente
        logNavigation('debug', `Mostrando sección: ${mainPage}-section`);
        const sectionStartTime = performance.now();
        const sectionId = mainPage + '-section';
        showSection(sectionId);
        logNavigation('debug', 'Cambio de sección completado', null, sectionStartTime);
        
        // Manejar subpáginas de configuración
        if (subPage && mainPage === 'configuracion') {
            logNavigation('debug', `Activando subpágina de configuración: ${subPage}`);
            const tabItem = document.querySelector(`.tab-item[data-tab="${subPage}"]`);
            if (tabItem) {
                requestAnimationFrame(() => {
                    logNavigation('debug', `Activando tab: ${subPage}`);
                    tabItem.click();
                });
            } else {
                logNavigation('warn', `No se encontró la pestaña ${subPage}`);
            }
        }
        
        // Inicializar componentes específicos
        logNavigation('debug', `Inicializando contenido de: ${mainPage}`);
        const initStartTime = performance.now();
        initPageContent(mainPage);
        logNavigation('debug', 'Inicialización de contenido completada', null, initStartTime);
        
        // Actualizar datos dinámicos
        logNavigation('debug', `Actualizando datos de: ${mainPage}`);
        const updateStartTime = performance.now();
        updateSectionData(mainPage);
        logNavigation('debug', 'Actualización de datos completada', null, updateStartTime);
        
    } catch (error) {
        logNavigation('error', 'Error durante la navegación:', error);
    } finally {
        logNavigation('info', `Navegación a ${page} completada`, null, startTime);
    }
}

// Despachar evento de cambio de página
function dispatchPageChangedEvent(to, from) {
    logNavigation('debug', `Despachando evento pageChanged: ${from} → ${to}`);
    
    try {
        const event = new CustomEvent('pageChanged', {
            detail: { 
                page: to,
                from: from,
                timestamp: new Date().toISOString() 
            }
        });
        document.dispatchEvent(event);
        logNavigation('debug', `Evento pageChanged despachado correctamente`);
    } catch (error) {
        logNavigation('error', 'Error al despachar evento de cambio de página:', error);
    }
}

// Mostrar una sección y ocultar las demás de manera eficiente
function showSection(sectionId) {
    logNavigation('debug', `Mostrando sección: ${sectionId}`);
    const startTime = performance.now();
    
    const sections = document.querySelectorAll('.content-section');
    logNavigation('debug', `Total de secciones encontradas: ${sections.length}`);
    
    const targetSection = document.getElementById(sectionId);
    
    if (targetSection) {
        // Usar requestAnimationFrame para las animaciones
        requestAnimationFrame(() => {
            logNavigation('debug', 'Actualizando clases de las secciones');
            let visibleCount = 0;
            
            sections.forEach(section => {
                if (section.id === sectionId) {
                    section.classList.add('active', 'animate-fade-in');
                    visibleCount++;
                } else {
                    section.classList.remove('active', 'animate-fade-in');
                }
            });
            
            logNavigation('debug', `Actualización de secciones completada. Secciones visibles: ${visibleCount}`);
        });
        
        logNavigation('debug', `Sección ${sectionId} mostrada correctamente`, null, startTime);
    } else {
        logNavigation('warn', `La sección "${sectionId}" no existe. Redirigiendo al dashboard.`);
        showSection('dashboard-section');
        window.location.hash = 'dashboard';
        
        const dashboardLink = document.querySelector('.nav-link[data-page="dashboard"]');
        if (dashboardLink) {
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            dashboardLink.classList.add('active');
        }
    }
}

// Control de actualizaciones
let lastUpdateTime = 0;
const MIN_UPDATE_INTERVAL = 2000; // 2 segundos entre actualizaciones
let updateTimeout = null;
let currentUpdateSection = null;
let activePollingInterval = null;
let activeWebSocket = null;

// Limpiar recursos de la sección anterior
function cleanupPreviousSection() {
    logNavigation('info', `Limpiando recursos de la sección: ${currentUpdateSection}`);
    const startTime = performance.now();
    
    // Limpiar intervalos de polling
    if (activePollingInterval) {
        logNavigation('debug', 'Limpiando intervalo de polling');
        clearInterval(activePollingInterval);
        activePollingInterval = null;
    }
    
    // Cerrar conexión WebSocket si existe
    if (activeWebSocket) {
        logNavigation('debug', 'Cerrando conexión WebSocket');
        activeWebSocket.close();
        activeWebSocket = null;
    }
    
    // Limpiar timeouts pendientes
    if (updateTimeout) {
        logNavigation('debug', 'Limpiando timeout pendiente');
        clearTimeout(updateTimeout);
        updateTimeout = null;
    }
    
    logNavigation('info', 'Limpieza de recursos completada', null, startTime);
}

// Actualizar datos dinámicos según la sección activa
function updateSectionData(page) {
    logNavigation('info', `Actualizando datos para sección: ${page}`);
    const startTime = performance.now();
    
    // Evitar actualizaciones si la sección no ha cambiado
    if (currentUpdateSection === page) {
        logNavigation('debug', 'Sección sin cambios, omitiendo actualización');
        return;
    }
    
    // Limpiar recursos de la sección anterior
    logNavigation('debug', `Limpiando recursos de la sección anterior: ${currentUpdateSection}`);
    cleanupPreviousSection();
    
    // Evitar actualizaciones demasiado frecuentes
    const now = Date.now();
    if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
        logNavigation('debug', `Actualización demasiado frecuente (${now - lastUpdateTime}ms < ${MIN_UPDATE_INTERVAL}ms), encolando...`);
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(() => updateSectionData(page), MIN_UPDATE_INTERVAL);
        return;
    }
    
    lastUpdateTime = now;
    currentUpdateSection = page;
    
    try {
        switch (page) {
            case 'dashboard':
                if (typeof updateDashboardData === 'function') {
                    logNavigation('debug', 'Iniciando actualización del dashboard...');
                    const dashboardSection = document.getElementById('dashboard-section');
                    
                    if (dashboardSection && dashboardSection.classList.contains('active')) {
                        if (!activePollingInterval) {
                            logNavigation('debug', 'Configurando intervalo de actualización (5s)');
                            activePollingInterval = setInterval(() => {
                                const isVisible = dashboardSection.classList.contains('active');
                                logNavigation('debug', `Intervalo de actualización: dashboard ${isVisible ? 'visible' : 'oculto'}`);
                                
                                if (isVisible) {
                                    logNavigation('debug', 'Ejecutando actualización programada del dashboard');
                                    const intervalStartTime = performance.now();
                                    try {
                                        updateDashboardData();
                                        logNavigation('debug', 'Actualización programada completada', null, intervalStartTime);
                                    } catch (error) {
                                        logNavigation('error', 'Error en actualización programada del dashboard:', error);
                                    }
                                }
                            }, 5000);
                        }
                        
                        // Actualización inicial
                        logNavigation('debug', 'Ejecutando actualización inicial del dashboard');
                        const initialUpdateTime = performance.now();
                        updateDashboardData();
                        logNavigation('debug', 'Actualización inicial completada', null, initialUpdateTime);
                    } else {
                        logNavigation('debug', 'Dashboard no visible, omitiendo actualización');
                    }
                } else {
                    logNavigation('warn', 'La función updateDashboardData no está disponible');
                }
                break;
                
            case 'configuracion':
                logNavigation('debug', 'Sección de configuración, no requiere actualización dinámica');
                break;
                
            default:
                logNavigation('warn', `Página no reconocida: ${page}`);
        }
    } catch (error) {
        logNavigation('error', 'Error durante la actualización:', error);
    } finally {
        logNavigation('info', `Actualización de datos para ${page} completada`, null, startTime);
    }
}

// Inicializar el contenido específico de cada página
function initPageContent(page) {
    logNavigation('info', `Inicializando contenido para página: ${page}`);
    const startTime = performance.now();
    
    try {
        switch (page) {
            case 'dashboard':
                if (typeof initDashboard === 'function') {
                    logNavigation('debug', 'Iniciando inicialización del dashboard');
                    const dashboardStartTime = performance.now();
                    initDashboard();
                    logNavigation('debug', 'Inicialización del dashboard completada', null, dashboardStartTime);
                } else {
                    logNavigation('error', 'La función initDashboard no está disponible');
                }
                break;
                
            case 'configuracion':
                if (typeof initConfig === 'function') {
                    logNavigation('debug', 'Iniciando inicialización de la configuración');
                    const configStartTime = performance.now();
                    initConfig();
                    logNavigation('debug', 'Inicialización de la configuración completada', null, configStartTime);
                } else {
                    logNavigation('error', 'La función initConfig no está disponible');
                }
                break;
                
            default:
                logNavigation('warn', `Página no reconocida: ${page}`);
        }
    } catch (error) {
        logNavigation('error', 'Error durante la inicialización:', error);
    } finally {
        logNavigation('info', `Inicialización de contenido para ${page} completada`, null, startTime);
    }
}

// Obtener la página actual según el hash
function getCurrentPage() {
    if (window.location.hash) {
        return window.location.hash.substring(1);
    }
    
    // Valor por defecto
    return 'dashboard';
}

// Obtener nombre formateado de la pestaña
function getTabName(tabId) {
    switch(tabId) {
        case 'models':
        case 'modelos':
            return 'Modelos';
        case 'sensors':
        case 'sensores':
            return 'Sensores';
        case 'machines':
        case 'maquinas':
            return 'Máquinas';
        case 'limits':
        case 'limites':
            return 'Límites de Aceleración';
        default:
            return 'Configuración';
    }
}

// Exportar funciones para uso global
window.initSidebar = initSidebar;
window.initNavigation = initNavigation;
window.navigateTo = navigateTo;
window.showSection = showSection;
window.getCurrentPage = getCurrentPage;
window.updateSectionData = updateSectionData;

// Limpiar recursos al cerrar la página
addManagedEventListener(window, 'beforeunload', () => {
    logNavigation('info', 'Limpiando recursos antes de cerrar la página');
    cleanupPreviousSection();
    cleanupEventListeners();
    
    // Limpiar recursos específicos de la página actual
    cleanupPageSpecific(currentPage);
}, 'navigation'); 