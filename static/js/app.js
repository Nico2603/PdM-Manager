/**
 * PdM-Manager - JavaScript Principal v1.0.0
 * Inicialización y coordinación de la aplicación
 * 
 * Última actualización: 2023-09-15
 */

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando PdM-Manager...');

    // Inicializar eventos globales
    if (typeof initGlobalStateEvents === 'function') {
        initGlobalStateEvents();
    } else {
        console.error('Error: La función initGlobalStateEvents no está disponible');
    }

    // Inicializar funciones de navegación
    if (typeof initNavigation === 'function') {
        initNavigation();
    } else {
        console.error('Error: La función initNavigation no está disponible');
    }

    // Inicializar barra lateral
    if (typeof initSidebar === 'function') {
        initSidebar();
    } else {
        console.error('Error: La función initSidebar no está disponible');
    }

    // Inicializar elementos UI comunes
    if (typeof initUI === 'function') {
        initUI();
    } else {
        console.error('Error: La función initUI no está disponible');
    }

    // Registrar listener para cambios de estado global
    document.addEventListener('globalStateChange', function(e) {
        console.log('Cambio de estado global detectado:', e.detail.key);
        
        // Propagar el evento a los módulos que lo necesiten
        if (typeof handleGlobalStateChange === 'function') {
            handleGlobalStateChange(e);
        }
    });

    console.log('Inicialización completada');
}); 