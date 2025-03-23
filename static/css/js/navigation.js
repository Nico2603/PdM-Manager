/**
 * Navegación para PdM-Manager
 * Este archivo controla la navegación, transiciones entre secciones y estados de la UI
 */

// Variable para almacenar la sección actual
let currentSection = 'dashboard';

// Inicializa la navegación cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
});

// Inicializa el sistema de navegación
function initNavigation() {
    console.log('Inicializando sistema de navegación...');
    
    // Configurar navegación por hash en URL
    handleUrlHash();
    
    // Gestionar cambios en el hash de la URL
    window.addEventListener('hashchange', handleUrlHash);
    
    // Añadir eventos a enlaces de navegación
    document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1); // Quitar el #
            if (target) {
                navigateTo(target);
            }
        });
    });
    
    // Configurar los botones de colapso del sidebar
    setupSidebarToggle();
    
    // Añadir eventos a botones de actualización
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
                showToast('success', 'Datos actualizados correctamente');
            }
        });
    }
    
    // Comprobar estado del sistema
    checkSystemStatus();
    
    // Comprobar periódicamente el estado del sistema
    setInterval(checkSystemStatus, 30000); // Cada 30 segundos
}

// Comprobar estado del sistema (conexión)
function checkSystemStatus() {
    // Simulación de verificación de conexión
    const isConnected = Math.random() > 0.1; // 90% probabilidad de estar conectado
    
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (statusDot && statusText) {
        if (isConnected) {
            statusDot.classList.remove('disconnected');
            statusDot.classList.add('connected');
            statusText.textContent = 'Sistema conectado';
            statusText.style.color = 'rgba(255, 255, 255, 0.8)';
        } else {
            statusDot.classList.remove('connected');
            statusDot.classList.add('disconnected');
            statusText.textContent = 'Sistema desconectado';
            statusText.style.color = 'rgba(255, 255, 255, 0.6)';
        }
    }
}

// Configura los botones de colapso del sidebar
function setupSidebarToggle() {
    // Toggle de la barra lateral desde el botón en la barra lateral
    const sidebarToggle = document.querySelector('.sidebar-header .sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });
    }
    
    // Toggle de la barra lateral desde el botón en el header (móvil)
    const mobileToggle = document.querySelector('.content-header .mobile-menu-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            const sidebar = document.querySelector('.sidebar');
            if (window.innerWidth < 992) {
                sidebar.classList.toggle('expanded');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }
    
    // Cerrar sidebar al hacer clic fuera en dispositivos móviles
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        
        if (window.innerWidth < 992 && 
            sidebar && 
            sidebar.classList.contains('expanded') && 
            !e.target.closest('.sidebar') && 
            !e.target.closest('.mobile-menu-toggle')) {
            sidebar.classList.remove('expanded');
        }
    });
}

// Maneja la navegación basada en el hash de la URL
function handleUrlHash() {
    const hash = window.location.hash.substring(1); // Quitar el #
    if (hash) {
        navigateTo(hash);
    } else {
        // Si no hay hash, mostrar dashboard por defecto
        window.location.hash = 'dashboard';
    }
}

// Navega a la sección especificada
function navigateTo(sectionName) {
    console.log(`Navegando a sección: ${sectionName}`);
    
    // Ignorar si estamos ya en esa sección
    if (currentSection === sectionName) return;
    
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada con animación
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Actualizar sección actual
        currentSection = sectionName;
        
        // Actualizar hash en URL sin recargar la página
        history.replaceState(null, null, `#${sectionName}`);
        
        // Actualizar navegación activa
        updateActiveNavigation(sectionName);
        
        // Actualizar miga de pan
        updateBreadcrumb(sectionName);
        
        // Ejecutar acciones específicas por sección
        executeOnSectionLoad(sectionName);
    } else {
        console.error(`Sección no encontrada: ${sectionName}-section`);
    }
}

// Actualiza los elementos de navegación activos
function updateActiveNavigation(sectionName) {
    // Quitar clase activa de todos los enlaces
    document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Añadir clase activa al enlace correspondiente
    const activeLink = document.querySelector(`.sidebar-menu .nav-link[href="#${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Actualiza la miga de pan según la sección
function updateBreadcrumb(sectionName) {
    const breadcrumbText = document.querySelector('.breadcrumb-item.active');
    if (breadcrumbText) {
        breadcrumbText.textContent = getSectionTitle(sectionName);
    }
    
    // También actualizar el título del documento
    document.title = `PdM-Manager | ${getSectionTitle(sectionName)}`;
}

// Obtiene el título legible de una sección
function getSectionTitle(sectionName) {
    const titles = {
        'dashboard': 'Dashboard',
        'configuracion': 'Configuración',
        'simulacion': 'Simulación'
    };
    
    return titles[sectionName] || sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
}

// Ejecuta acciones específicas al cargar cada sección
function executeOnSectionLoad(sectionName) {
    // Acciones comunes
    window.scrollTo(0, 0);
    
    // Acciones específicas por sección
    switch(sectionName) {
        case 'dashboard':
            // Actualizar datos del dashboard
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
            }
            break;
            
        case 'configuracion':
            // Cargar máquinas disponibles
            if (typeof loadMachines === 'function') {
                loadMachines();
            }
            // Cargar modelos disponibles
            if (typeof loadModels === 'function') {
                loadModels();
            }
            break;
            
        case 'simulacion':
            // Cargar archivos CSV disponibles
            if (typeof loadCsvFiles === 'function') {
                loadCsvFiles();
            }
            // Verificar estado de simulación
            if (typeof checkSimulationStatus === 'function') {
                checkSimulationStatus();
            }
            break;
    }
    
    // Cerrar sidebar expandido en móviles al navegar
    if (window.innerWidth < 992) {
        document.querySelector('.sidebar').classList.remove('expanded');
    }
}

// Muestra un indicador de cargando
function showLoading(message = 'Cargando...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingOverlay && loadingText) {
        loadingText.textContent = message;
        loadingOverlay.classList.add('show');
    }
}

// Oculta el indicador de cargando
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingOverlay) {
        loadingOverlay.classList.remove('show');
    }
}

// Muestra un toast de notificación
function showToast(type, message) {
    // Contenedor de toasts
    let toastContainer = document.querySelector('.toast-container');
    
    // Crear contenedor si no existe
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Crear toast
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Iconos según tipo
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'danger') icon = 'exclamation-circle';
    
    // Contenido del toast
    toast.innerHTML = `
        <div class="toast-header">
            <i class="fas fa-${icon} mr-2"></i>
            <strong class="mr-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
            <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Añadir al contenedor
    toastContainer.appendChild(toast);
    
    // Cerrar al hacer clic en el botón
    toast.querySelector('.close').addEventListener('click', function() {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto cerrar después de 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// Exportar funciones para uso global
window.navigateTo = navigateTo;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast; 
window.hideLoading = hideLoading; 