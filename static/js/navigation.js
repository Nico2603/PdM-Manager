/**
 * PdM-Manager - JavaScript Navegación v1.0.0
 * Funciones para la navegación, menú lateral y breadcrumbs
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// NAVEGACIÓN Y MENÚ LATERAL
// ==========================================================================

// Inicializar menú lateral
function initSidebar() {
    // Manejar toggle del menú en móvil
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const appContainer = document.querySelector('.app-container');
    
    if (mobileMenuToggle && appContainer) {
        mobileMenuToggle.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-open');
        });
    }
    
    // Inicializar botón de actualización de datos
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
            }
        });
    }
}

// Inicializar navegación
function initNavigation() {
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
    
    // Inicializar navegación por hash
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
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
}

// Navegar a la página indicada
function navigateTo(page) {
    // Actualizar hash en la URL
    window.location.hash = page;
    
    // Actualizar estado de navegación
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        link.classList.toggle('active', linkPage === page);
    });
    
    // Mostrar la sección correspondiente
    showSection(page + '-section');
    
    // Actualizar breadcrumb
    updateBreadcrumb(page);
    
    // Inicializar componentes específicos de la página
    initPageContent(page);
}

// Mostrar una sección y ocultar las demás
function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    
    sections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
}

// Actualizar breadcrumb
function updateBreadcrumb(page) {
    const currentSectionEl = document.getElementById('currentSection');
    
    if (currentSectionEl) {
        let sectionName = 'Dashboard';
        
        switch (page) {
            case 'dashboard':
                sectionName = 'Dashboard';
                break;
            case 'configuracion':
                sectionName = 'Configuración';
                break;
            case 'ajustes':
                sectionName = 'Ajustes';
                break;
            default:
                sectionName = page.charAt(0).toUpperCase() + page.slice(1);
                break;
        }
        
        currentSectionEl.textContent = sectionName;
    }
}

// Inicializar el contenido específico de cada página
function initPageContent(page) {
    switch (page) {
        case 'dashboard':
            if (typeof initDashboard === 'function') {
                initDashboard();
            }
            break;
        case 'configuracion':
            if (typeof initConfig === 'function') {
                initConfig();
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

// Exportar funciones para uso global
window.initSidebar = initSidebar;
window.initNavigation = initNavigation;
window.navigateTo = navigateTo;
window.showSection = showSection;
window.getCurrentPage = getCurrentPage; 