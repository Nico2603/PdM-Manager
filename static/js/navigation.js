/**
 * PdM-Manager - JavaScript Navegación v2.0.0
 * Funciones para la navegación, menú lateral y breadcrumbs
 * 
 * Última actualización: 2024-03-29
 */

// ==========================================================================
// NAVEGACIÓN Y MENÚ LATERAL
// ==========================================================================

// Inicializar menú lateral
function initSidebar() {
    // Inicializar botón de actualización de datos
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
                showToast('Datos actualizados', 'success');
            } else {
                console.error('La función updateDashboardData no está disponible');
            }
        });
    }
}

// Inicializar navegación
function initNavigation() {
    console.log('Inicializando navegación...');
    
    // Configurar enlaces de navegación
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Obtener página de destino
            const targetPage = link.getAttribute('data-page');
            
            if (targetPage) {
                // Actualizar clase activa
                navLinks.forEach(navlink => navlink.classList.remove('active'));
                link.classList.add('active');
                
                // Navegar a la página
                navigateTo(targetPage);
            }
        });
    });
    
    // Configurar enlaces dentro del contenido
    const contentLinks = document.querySelectorAll('a[href^="#"]');
    contentLinks.forEach(link => {
        if (!link.classList.contains('nav-link')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = link.getAttribute('href').substring(1);
                if (targetPage) {
                    navigateTo(targetPage);
                }
            });
        }
    });
    
    // Inicializar navegación por hash
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            console.log('Hash cambiado a:', hash);
            navigateTo(hash);
        } else {
            // Si no hay hash, ir a la página por defecto (dashboard)
            navigateTo('dashboard');
        }
    });
    
    // Comprobar hash inicial al cargar la página
    if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        navigateTo(hash);
    } else {
        navigateTo('dashboard');
    }
    
    console.log('Navegación inicializada');
}

// Navegar a la página indicada
function navigateTo(page) {
    console.log('Navegando a:', page);
    
    // Validar que page sea una cadena no vacía
    if (!page || typeof page !== 'string') {
        console.error('Error: se intentó navegar a una página inválida', page);
        page = 'dashboard'; // Valor predeterminado si hay error
    }
    
    // Si la página contiene ":", es una subpágina (por ejemplo, "configuracion:maquinas")
    let mainPage = page;
    let subPage = null;
    
    if (page.includes(':')) {
        [mainPage, subPage] = page.split(':');
    }
    
    // Actualizar hash en la URL
    const newHash = '#' + page;
    if (window.location.hash !== newHash) {
        // Usar history.pushState para mejor compatibilidad entre navegadores
        try {
            history.pushState(null, null, newHash);
        } catch (e) {
            console.warn('Error al actualizar history API:', e);
            // Fallback si history API falla
            window.location.hash = page;
        }
    }
    
    // Actualizar estado de navegación en el menú
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        link.classList.toggle('active', linkPage === mainPage);
    });
    
    // Mostrar la sección correspondiente
    showSection(mainPage + '-section');
    
    // Si hay una subpágina, activar esa pestaña específica
    if (subPage && mainPage === 'configuracion') {
        // Usar setTimeout para asegurarse de que el DOM esté actualizado
        setTimeout(() => {
            const tabItem = document.querySelector(`.tab-item[data-tab="${subPage}"]`);
            if (tabItem) {
                tabItem.click();
            } else {
                console.warn(`Tab "${subPage}" no encontrado. Verifique que existe en HTML.`);
            }
        }, 150); // Tiempo suficiente para que se complete la transición de sección
    }
    
    // Inicializar componentes específicos de la página
    initPageContent(mainPage);
    
    // Actualizar datos dinámicos según la sección
    updateSectionData(mainPage);
}

// Mostrar una sección y ocultar las demás
function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    let sectionFound = false;
    
    sections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.add('active');
            section.classList.add('animate-fade-in');
            sectionFound = true;
        } else {
            section.classList.remove('active');
            section.classList.remove('animate-fade-in');
        }
    });
    
    // Si la sección no existe, mostrar un mensaje o redirigir al dashboard
    if (!sectionFound && sectionId !== 'dashboard-section') {
        console.warn(`La sección "${sectionId}" no existe. Redirigiendo al dashboard.`);
        showSection('dashboard-section');
        
        // Actualizar URL y navegación 
        window.location.hash = 'dashboard';
        
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const linkPage = link.getAttribute('data-page');
            link.classList.toggle('active', linkPage === 'dashboard');
        });
    }
}

// Actualizar datos dinámicos según la sección activa
function updateSectionData(page) {
    switch (page) {
        case 'dashboard':
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
            }
            break;
        case 'configuracion':
            // No se requiere actualización dinámica para configuración
            break;
        // Se eliminaron otras secciones que ya no existen
    }
}

// Inicializar el contenido específico de cada página
function initPageContent(page) {
    switch (page) {
        case 'dashboard':
            if (typeof initDashboard === 'function') {
                initDashboard();
            } else {
                console.error('La función initDashboard no está disponible');
            }
            break;
        case 'configuracion':
            if (typeof initConfig === 'function') {
                initConfig();
            } else {
                console.error('La función initConfig no está disponible');
            }
            break;
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