/**
 * PdM-Manager - Funciones de Responsividad
 * Mejora la experiencia de usuario en dispositivos móviles y pantallas pequeñas
 */

document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent = document.querySelector('.main-content');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Estado
    let isSidebarVisible = false;
    
    // Función para alternar la visibilidad del sidebar en móviles
    function toggleSidebar() {
        isSidebarVisible = !isSidebarVisible;
        sidebar.classList.toggle('show', isSidebarVisible);
        
        // Evitar el scroll cuando el menú está abierto en móviles
        if (window.innerWidth < 992) {
            document.body.style.overflow = isSidebarVisible ? 'hidden' : '';
        }
    }
    
    // Cerrar el sidebar al hacer clic en un enlace (en móviles)
    function closeSidebar() {
        if (window.innerWidth < 992 && isSidebarVisible) {
            isSidebarVisible = false;
            sidebar.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
    
    // Cerrar el sidebar al hacer clic fuera de él
    function handleOutsideClick(event) {
        if (window.innerWidth < 992 && isSidebarVisible && 
            !sidebar.contains(event.target) && 
            event.target !== sidebarToggle) {
            closeSidebar();
        }
    }
    
    // Ajustar UI al cambiar el tamaño de la ventana
    function handleResize() {
        if (window.innerWidth >= 992) {
            sidebar.classList.remove('show');
            document.body.style.overflow = '';
            isSidebarVisible = false;
        }
        
        // Ajustar la altura de los gráficos para evitar problemas de layout
        const chartContainers = document.querySelectorAll('.chart-body');
        chartContainers.forEach(container => {
            const width = container.offsetWidth;
            container.style.height = `${Math.max(300, width * 0.6)}px`;
        });
    }
    
    // Ajustar tablas para dispositivos móviles
    function setupResponsiveTables() {
        const tables = document.querySelectorAll('.data-table');
        
        if (window.innerWidth < 768) {
            tables.forEach(table => {
                table.classList.add('mobile-view');
                const headerCells = table.querySelectorAll('thead th');
                
                // Guardar los textos de las cabeceras
                const headerTexts = Array.from(headerCells).map(cell => cell.textContent.trim());
                
                // Añadir atributos data para mostrar etiquetas en móviles
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    cells.forEach((cell, index) => {
                        if (index < headerTexts.length) {
                            cell.setAttribute('data-label', headerTexts[index]);
                        }
                    });
                });
            });
        } else {
            tables.forEach(table => {
                table.classList.remove('mobile-view');
            });
        }
    }
    
    // Mejorar accesibilidad para elementos táctiles
    function enhanceTouchTargets() {
        const touchTargets = document.querySelectorAll('.btn, .btn-icon, .nav-link, .tab-item, .filter-dropdown-item');
        
        touchTargets.forEach(target => {
            // Asegurar tamaño mínimo para objetivos táctiles (44x44px recomendado)
            const rect = target.getBoundingClientRect();
            if (rect.width < 44 || rect.height < 44) {
                target.classList.add('touch-optimized');
            }
        });
    }
    
    // Añadir manejadores de eventos
    sidebarToggle.addEventListener('click', toggleSidebar);
    window.addEventListener('resize', handleResize);
    document.addEventListener('click', handleOutsideClick);
    
    // Cerrar sidebar al hacer clic en links de navegación
    navLinks.forEach(link => {
        link.addEventListener('click', closeSidebar);
    });
    
    // Inicializar adaptaciones responsivas
    handleResize();
    setupResponsiveTables();
    enhanceTouchTargets();
    
    // Reconfigurar tablas cuando cambia el contenido
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            // Permitir tiempo para que el DOM se actualice
            setTimeout(setupResponsiveTables, 100);
        });
    });
    
    // Volver a configurar en cambios de orientación
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleResize();
            setupResponsiveTables();
        }, 200);
    });
}); 