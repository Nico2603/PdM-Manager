/**
 * PdM-Manager Dashboard - Navegación
 * Script para manejar la navegación SPA y elementos interactivos
 */

document.addEventListener('DOMContentLoaded', function() {
  // Referencias a elementos DOM
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.content-section');
  const breadcrumbActive = document.querySelector('.breadcrumb-item.active');
  const lastUpdateTime = document.getElementById('lastUpdateTime');
  
  // Estado del sistema
  let systemState = {
    lastUpdate: new Date(),
    sidebarCollapsed: window.innerWidth <= 768,
    currentSection: 'dashboard-section'
  };
  
  // Inicialización
  function init() {
    // Actualizar hora
    updateLastUpdateTime();
    
    // Inicializar sidebar en dispositivos móviles
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('active');
    }
    
    // Activar sección inicial
    activateSection('dashboard-section');
    
    // Registrar eventos
    registerEvents();
  }
  
  // Registrar todos los event listeners
  function registerEvents() {
    // Navegación
    navLinks.forEach(link => {
      link.addEventListener('click', handleNavigation);
    });
    
    // Toggle Sidebar en móvil
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', toggleSidebar);
    }
    
    // Botón de actualizar datos
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', refreshData);
    }
    
    // Eventos de resize para responsividad
    window.addEventListener('resize', handleResize);
  }
  
  // Manejar la navegación entre secciones
  function handleNavigation(e) {
    e.preventDefault();
    const target = e.currentTarget.getAttribute('href').replace('#', '');
    
    // Activar sección correspondiente
    activateSection(`${target}-section`);
    
    // Actualizar navegación
    updateNavigation(e.currentTarget, target);
    
    // En móviles, cerrar el sidebar después de navegar
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('active');
    }
  }
  
  // Activar sección y desactivar las demás
  function activateSection(sectionId) {
    contentSections.forEach(section => {
      if (section.id === sectionId) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });
    
    systemState.currentSection = sectionId;
  }
  
  // Actualizar navegación (links activos y breadcrumb)
  function updateNavigation(activeLink, target) {
    // Actualizar links
    navLinks.forEach(link => {
      link.classList.remove('active');
    });
    activeLink.classList.add('active');
    
    // Actualizar breadcrumb
    if (breadcrumbActive) {
      breadcrumbActive.textContent = target.charAt(0).toUpperCase() + target.slice(1);
    }
  }
  
  // Toggle sidebar en móviles
  function toggleSidebar() {
    sidebar.classList.toggle('active');
  }
  
  // Actualizar hora de última actualización
  function updateLastUpdateTime() {
    if (lastUpdateTime) {
      lastUpdateTime.textContent = formatDateTime(systemState.lastUpdate);
    }
  }
  
  // Refrescar datos
  function refreshData() {
    // Mostrar overlay de carga
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('active');
    }
    
    // Simular carga de datos (se reemplazará con fetch real)
    setTimeout(() => {
      // Actualizar hora
      systemState.lastUpdate = new Date();
      updateLastUpdateTime();
      
      // Ocultar overlay
      if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
      }
      
      // Mostrar toast de confirmación
      showToast('Datos actualizados correctamente');
    }, 1000);
  }
  
  // Mostrar notificación toast
  function showToast(message) {
    // Crear toast si no existe
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }
    
    // ID único para el toast
    const toastId = 'toast-' + Date.now();
    
    // Crear toast
    const toastHTML = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
          <i class="fas fa-info-circle text-primary me-2"></i>
          <strong class="me-auto">Notificación</strong>
          <small>${formatTime(new Date())}</small>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    // Añadir toast al contenedor
    toastContainer.innerHTML += toastHTML;
    
    // Inicializar y mostrar el toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
    toast.show();
    
    // Auto-eliminar después de ocultarse
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }
  
  // Manejar resize de la ventana
  function handleResize() {
    if (window.innerWidth <= 768) {
      if (!systemState.sidebarCollapsed) {
        sidebar.classList.remove('active');
        systemState.sidebarCollapsed = true;
      }
    } else {
      if (systemState.sidebarCollapsed) {
        systemState.sidebarCollapsed = false;
      }
    }
  }
  
  // Formatos de fecha/hora
  function formatDateTime(date) {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  function formatTime(date) {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Iniciar
  init();
}); 