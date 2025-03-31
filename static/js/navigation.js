// ==========================================================================
// NAVEGACIÓN Y MENÚ LATERAL
// ==========================================================================

// Función para registrar y gestionar event listeners
function addNavigationListener(element, event, handler, options = false) {
    if (!element) {
        logNavigation('warn', 'addNavigationListener: Elemento no válido');
        return null;
    }
    
    return window.addManagedEventListener(element, event, handler, 'navigation', options);
}

// Función para remover todos los event listeners registrados
function cleanupNavigationListeners() {
    logNavigation('info', `Limpieza de event listeners de navegación`);
    return window.cleanupEventListenersByCategory('navigation');
}

// Inicializar menú lateral
function initSidebar() {
    logNavigation('info', 'Inicializando menú lateral');
    const startTime = performance.now();
    
    // Usar delegación de eventos para el sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Manejar clics en elementos del sidebar
        addNavigationListener(sidebar, 'click', (e) => {
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
                    // Prevenir navegaciones mientras otra está en progreso
                    if (isNavigating) {
                        logNavigation('warn', `Clic en menú ignorado: navegación a ${targetPage} bloqueada mientras otra está en progreso`);
                        return;
                    }
                    
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
    cleanupNavigationListeners();
    
    // Inicializar el sidebar primero
    initSidebar();
    
    // Configurar delegación de eventos para el contenido principal
    const contentContainer = document.querySelector('.content');
    if (contentContainer) {
        addNavigationListener(contentContainer, 'click', (e) => {
            // Enlaces dentro del contenido
            const link = e.target.closest('a[href^="#"]');
            if (link && !link.classList.contains('nav-link')) {
                e.preventDefault();
                const targetPage = link.getAttribute('href').substring(1);
                if (targetPage) {
                    // Prevenir navegaciones mientras otra está en progreso
                    if (isNavigating) {
                        logNavigation('warn', `Clic en enlace ignorado: navegación a ${targetPage} bloqueada mientras otra está en progreso`);
                        return;
                    }
                    
                    logNavigation('debug', `Clic en enlace interno: ${targetPage}`);
                    navigateTo(targetPage);
                }
            }
        }, 'navigation');
    } else {
        logNavigation('warn', 'No se encontró el contenedor de contenido');
    }
    
    // Configurar listener de hashchange con opción para evitar duplicados
    // Remover cualquier event listener existente para hashchange antes de agregar el nuevo
    window.removeEventListener('hashchange', handleHashChange);
    addNavigationListener(window, 'hashchange', (e) => {
        // Verificar si ya estamos en proceso de navegación para evitar recursión
        if (isNavigating) {
            logNavigation('debug', 'Evento hashchange ignorado: navegación en progreso');
            return;
        }
        handleHashChange();
    }, 'navigation');
    
    // Configurar listener para eventos de página cambiada
    addNavigationListener(document, 'pageChanged', (e) => {
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
            window.cleanupEventListenersByCategory('dashboard');
            break;
        case 'configuracion':
            logNavigation('debug', 'Limpiando listeners específicos de configuración');
            window.cleanupEventListenersByCategory('realtime');
            break;
    }
    
    logNavigation('info', `Limpieza específica de página ${page} completada`, null, startTime);
}

// Control de navegación
let navigationCount = 0;
let lastNavigationTime = 0;
const NAVIGATION_DEBOUNCE = 300; // 300ms entre navegaciones
let currentPage = '';
let isNavigating = false; // Flag para evitar navegaciones simultáneas
let navigationInProgressTimeout = null; // Timeout de seguridad para el flag isNavigating
let navigationStack = []; // Stack para detectar navegaciones recursivas
const MAX_NAVIGATION_STACK = 5; // Máximo de navegaciones permitidas en el stack

// Navegar a la página indicada
function navigateTo(page, fromHashChange = false) {
    // Validar que page sea una cadena no vacía para evitar errores
    if (!page || typeof page !== 'string') {
        logNavigation('error', 'Página inválida:', page);
        page = 'dashboard';
    }
    
    // Verificar si ya estamos navegando para evitar llamadas recursivas
    if (isNavigating) {
        logNavigation('warn', `Navegación ignorada: otra navegación en progreso (destino: ${page})`);
        return; // Salir inmediatamente para evitar recursión
    }
    
    // Establecer flag de navegación y timeout para resetearlo en caso de error
    isNavigating = true;
    
    // Establecer timeout de seguridad para resetear el flag en caso de error
    if (navigationInProgressTimeout) {
        clearTimeout(navigationInProgressTimeout);
    }
    navigationInProgressTimeout = setTimeout(() => {
        if (isNavigating) {
            logNavigation('warn', 'Forzando reset del flag de navegación después de 2s');
            isNavigating = false;
        }
    }, 2000); // 2 segundos como máximo para cualquier navegación
    
    logNavigation('info', `Iniciando navegación a: ${page}`);
    const startTime = performance.now();
    
    const now = Date.now();
    navigationCount++;
    logNavigation('debug', `Navegación #${navigationCount} - Tiempo desde última: ${now - lastNavigationTime}ms - Desde hashChange: ${fromHashChange}`);
    
    // Evitar navegaciones demasiado frecuentes
    if (now - lastNavigationTime < NAVIGATION_DEBOUNCE) {
        logNavigation('warn', `Navegación ignorada: demasiado frecuente (< ${NAVIGATION_DEBOUNCE}ms)`);
        // Resetear flag antes de salir
        resetNavigationFlag();
        return;
    }
    
    lastNavigationTime = now;
    
    try {
        // Si la página contiene ":", es una subpágina
        let mainPage = page;
        let subPage = null;
        
        if (page.includes(':')) {
            [mainPage, subPage] = page.split(':');
            logNavigation('debug', 'Subpágina detectada:', { mainPage, subPage });
        }
        
        // Si page ya está activa, evitar procesamiento innecesario
        if (mainPage === currentPage && document.querySelector(`.nav-link[data-page="${mainPage}"]`)?.classList.contains('active')) {
            // Solo continuamos si es una subpágina diferente
            if (!subPage || (subPage && window.location.hash === '#' + page)) {
                logNavigation('debug', `Ya estamos en la página ${page}, omitiendo navegación redundante`);
                // Resetear flag antes de salir
                resetNavigationFlag();
                return;
            }
        }
        
        // Capturar la página anterior antes de cambiar
        const previousPage = currentPage;
        
        // Si estamos en una subpágina de configuración y vamos a otra subpágina de configuración,
        // no tratamos esto como un cambio de página principal para evitar reinicios innecesarios
        let isSubpageNavigation = false;
        if (previousPage === 'configuracion' && mainPage === 'configuracion' && subPage) {
            isSubpageNavigation = true;
            logNavigation('debug', 'Navegación entre subpáginas de configuración detectada');
        } else {
            currentPage = mainPage;
        }
        
        // Lanzar evento de cambio de página solo si no es navegación entre subpáginas
        if (!isSubpageNavigation) {
            dispatchPageChangedEvent(mainPage, previousPage);
            
            // Limpieza específica de la página anterior solo si cambiamos de página principal
            if (previousPage && previousPage !== mainPage) {
                logNavigation('debug', `Cambiando de ${previousPage} a ${mainPage}, iniciando limpieza`);
                cleanupPageSpecific(previousPage);
            }
        }
        
        // Actualizar hash en la URL de manera segura para evitar disparar más eventos
        const newHash = '#' + page;
        if (window.location.hash !== newHash && !fromHashChange) {
            logNavigation('debug', `Actualizando hash de URL: ${newHash}`);
            try {
                // Usar history.replaceState que no dispara eventos hashchange
                logNavigation('debug', 'Usando history.replaceState para actualización silenciosa');
                history.replaceState(null, null, newHash);
            } catch (e) {
                logNavigation('warn', 'Error al actualizar history API:', e);
                
                // Alternativa: desactivar temporalmente el listener global y establecer un flag para evitar recursión
                logNavigation('debug', 'Intentando actualización alternativa');
                window.removeEventListener('hashchange', handleHashChange);
                
                // Actualizar el hash
                window.location.hash = page;
                
                // Restaurar el event listener después de un breve tiempo
                setTimeout(() => {
                    window.addEventListener('hashchange', handleHashChange);
                    logNavigation('debug', 'Listener de hashchange restaurado');
                }, 50);
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
        
        // Solo mostramos la sección correspondiente si NO es una navegación entre subpáginas
        if (!isSubpageNavigation) {
            // Mostrar la sección correspondiente
            logNavigation('debug', `Mostrando sección: ${mainPage}-section`);
            const sectionStartTime = performance.now();
            const sectionId = mainPage + '-section';
            showSection(sectionId);
            logNavigation('debug', 'Cambio de sección completado', null, sectionStartTime);
        }
        
        // Manejar subpáginas de configuración
        if (subPage && mainPage === 'configuracion') {
            logNavigation('debug', `Activando subpágina de configuración: ${subPage}`);
            const tabItem = document.querySelector(`.tab-item[data-tab="${subPage}"]`);
            if (tabItem) {
                // Aseguramos que la sección de configuración esté visible antes de cambiar la pestaña
                const configSection = document.getElementById('configuracion-section');
                if (configSection) {
                    logNavigation('debug', `Estado de configuracion-section antes: visible=${configSection.classList.contains('active')}`);
                    if (!configSection.classList.contains('active')) {
                        configSection.classList.add('active', 'animate-fade-in');
                        logNavigation('debug', 'Sección de configuración activada manualmente');
                    }
                } else {
                    logNavigation('error', 'No se encontró el elemento configuracion-section');
                }
                
                // Usar una sola llamada a requestAnimationFrame para evitar múltiples actualizaciones
                requestAnimationFrame(() => {
                    logNavigation('debug', `Activando tab: ${subPage}`);
                    
                    // Desactivar el flag isNavigating temporalmente para evitar problemas durante 
                    // la manipulación del DOM, ya que esta parte no debe causar eventos hashchange
                    const wasNavigating = isNavigating;
                    
                    try {
                        // Actualizamos las clases activas manualmente para evitar recursión
                        const allTabs = document.querySelectorAll('.tab-item');
                        allTabs.forEach(tab => tab.classList.remove('active'));
                        tabItem.classList.add('active');
                        
                        // También actualizamos los contenidos de pestaña directamente
                        const tabContents = document.querySelectorAll('.tab-content');
                        tabContents.forEach(content => {
                            content.classList.remove('active');
                        });
                        
                        const targetContent = document.getElementById(`${subPage}Content`);
                        if (targetContent) {
                            targetContent.classList.add('active');
                            logNavigation('debug', `Contenido de pestaña ${subPage} activado`);
                        } else {
                            logNavigation('error', `No se encontró el contenido para la pestaña ${subPage}`);
                        }
                        
                        // Verificamos nuevamente el estado de la sección después de actualizar
                        const configSection = document.getElementById('configuracion-section');
                        if (configSection) {
                            logNavigation('debug', `Estado de configuracion-section después: visible=${configSection.classList.contains('active')}`);
                        }
                    } catch (error) {
                        logNavigation('error', `Error al activar subpágina ${subPage}:`, error);
                    } finally {
                        // Restaurar el estado de navegación
                        isNavigating = wasNavigating;
                    }
                });
            } else {
                logNavigation('warn', `No se encontró la pestaña ${subPage}`);
            }
        }
        
        // Inicializar componentes específicos solo si no es navegación entre subpáginas
        if (!isSubpageNavigation) {
            logNavigation('debug', `Inicializando contenido de: ${mainPage}`);
            const initStartTime = performance.now();
            initPageContent(mainPage);
            logNavigation('debug', 'Inicialización de contenido completada', null, initStartTime);
            
            // Actualizar datos dinámicos
            logNavigation('debug', `Actualizando datos de: ${mainPage}`);
            const updateStartTime = performance.now();
            updateSectionData(mainPage);
            logNavigation('debug', 'Actualización de datos completada', null, updateStartTime);
        }
        
    } catch (error) {
        logNavigation('error', 'Error durante la navegación:', error);
    } finally {
        logNavigation('info', `Navegación a ${page} completada`, null, startTime);
        // Establecer un timeout para asegurar que el flag se resetee incluso en caso de error
        resetNavigationFlag(100);
    }
}

// Función auxiliar para resetear la bandera de navegación de forma segura
function resetNavigationFlag(delay = 0) {
    if (delay > 0) {
        setTimeout(() => {
            isNavigating = false;
            logNavigation('debug', 'Flag de navegación reseteado');
            
            // Limpiar el timeout de seguridad
            if (navigationInProgressTimeout) {
                clearTimeout(navigationInProgressTimeout);
                navigationInProgressTimeout = null;
            }
        }, delay);
    } else {
        isNavigating = false;
        logNavigation('debug', 'Flag de navegación reseteado inmediatamente');
        
        // Limpiar el timeout de seguridad
        if (navigationInProgressTimeout) {
            clearTimeout(navigationInProgressTimeout);
            navigationInProgressTimeout = null;
        }
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
    
    // Verificar si estamos en una subpágina de configuración (hash contiene "configuracion:")
    const currentHash = window.location.hash;
    const isConfigSubpage = currentHash.startsWith('#configuracion:');
    
    // Si estamos navegando a una subpágina de configuración y no estamos mostrando explícitamente
    // la sección de configuración, ajustamos el sectionId
    if (isConfigSubpage && sectionId !== 'configuracion-section') {
        logNavigation('debug', `Navegación de subpágina de configuración detectada, ajustando a sección principal`);
        sectionId = 'configuracion-section';
    }
    
    const sections = document.querySelectorAll('.content-section');
    logNavigation('debug', `Total de secciones encontradas: ${sections.length}`);
    
    const targetSection = document.getElementById(sectionId);
    
    if (targetSection) {
        // Usar requestAnimationFrame para las animaciones
        requestAnimationFrame(() => {
            logNavigation('debug', 'Actualizando clases de las secciones');
            let visibleCount = 0;
            
            sections.forEach(section => {
                // Si estamos en una subpágina de configuración, asegurarnos de que la sección de configuración
                // permanezca visible
                if (isConfigSubpage && section.id === 'configuracion-section') {
                    logNavigation('debug', 'Manteniendo sección de configuración visible para subpágina');
                    section.classList.add('active', 'animate-fade-in');
                    visibleCount++;
                }
                // Proceso normal para las demás secciones
                else if (section.id === sectionId) {
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

// Registrar listener para evento de cierre de ventana
addNavigationListener(window, 'beforeunload', () => {
    logNavigation('info', 'Cerrando página, limpiando recursos...');
    
    // Intentar limpiar recursos antes de salir
    window.cleanupAllEventListeners();
    
    if (typeof socket !== 'undefined' && socket) {
        socket.close();
        logNavigation('debug', 'WebSocket cerrado');
    }
    
    // No mostrar diálogo de confirmación
    return undefined;
});

// Manejador de cambios de hash
function handleHashChange() {
    logNavigation('debug', 'Evento hashchange detectado');
    
    // Verificar si estamos en proceso de navegación para evitar recursión
    if (isNavigating) {
        logNavigation('warn', 'Evento hashchange ignorado: navegación en progreso');
        return;
    }
    
    const hash = window.location.hash.substring(1);
    if (!hash) {
        logNavigation('debug', 'Hash vacío, navegando a dashboard');
        navigateTo('dashboard', true); // Pasar true para indicar que viene de un evento hashchange
        return;
    }
    
    // Verificar navegaciones recursivas
    navigationStack.push(hash);
    if (navigationStack.length > MAX_NAVIGATION_STACK) {
        navigationStack.shift(); // Mantener el tamaño del stack limitado
        
        // Verificar si estamos en un ciclo de navegación
        const counts = {};
        navigationStack.forEach(h => {
            counts[h] = (counts[h] || 0) + 1;
        });
        
        // Si alguna página aparece más de 2 veces en el stack, probablemente estamos en un ciclo
        const possibleLoop = Object.values(counts).some(count => count > 2);
        if (possibleLoop) {
            logNavigation('error', 'Posible ciclo de navegación detectado, interrumpiendo:', navigationStack);
            navigationStack = []; // Limpiar el stack
            resetNavigationFlag(); // Asegurar que el flag esté reseteado
            return; // Interrumpir la navegación
        }
    }
    
    // Verificar si el hash es igual a la página actual para evitar recursión
    const mainPageRequested = hash.includes(':') ? hash.split(':')[0] : hash;
    const currentMainPage = currentPage && currentPage.includes(':') ? currentPage.split(':')[0] : currentPage;
    
    if (hash === currentPage || mainPageRequested === currentMainPage) {
        // Solo comparar subpáginas si ambas páginas son iguales
        if (hash.includes(':') && currentPage.includes(':')) {
            const newSubPage = hash.split(':')[1];
            const currentSubPage = currentPage.split(':')[1];
            
            // Si es la misma subpágina, ignorar
            if (newSubPage === currentSubPage) {
                logNavigation('debug', `Ignorando navegación repetida a la misma subpágina: ${hash}`);
                return;
            }
        } else if (hash === currentPage) {
            logNavigation('debug', `Ignorando navegación repetida a la misma página: ${hash}`);
            return; // Evitar recursión
        }
    }
    
    // Prevenir múltiples navegaciones por hash en corto tiempo
    const now = Date.now();
    if (now - lastNavigationTime < NAVIGATION_DEBOUNCE) {
        logNavigation('warn', `Evento hashchange ignorado: demasiado frecuente (< ${NAVIGATION_DEBOUNCE}ms)`);
        return;
    }
    
    logNavigation('debug', `Navegando a hash: ${hash}`);
    navigateTo(hash, true); // Pasar true para indicar que viene de un evento hashchange
} 