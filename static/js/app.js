/**
 * PdM-Manager - JavaScript Principal v2.0.0
 * Inicialización de aplicación y carga de componentes
 * 
 * Última actualización: 2023-09-15
 * 
 * Optimizaciones (2024):
 * - Eliminadas referencias a campos antiguos (type, ubicacion, frecuencia notificaciones)
 * - Eliminadas vistas obsoletas (pestaña Notificaciones)
 * - Eliminado código responsive innecesario
 * - Unificadas funciones para gestión de límites
 * - Simplificada lógica de severidad para usar valores 0, 1, 2 conforme al backend
 * - Funcionalidad para nivel 3 mantenida en estructura para futura implementación
 */

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicación PdM-Manager v2.0...');
    
    // Inicializar eventos de estado global
    if (typeof initGlobalStateEvents === 'function') {
        initGlobalStateEvents();
    }
    
    // Inicializar navegación
    if (typeof initNavigation === 'function') {
        initNavigation();
    }
    
    // Inicializar menú lateral
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    // Inicializar componentes UI
    if (typeof initUI === 'function') {
        initUI();
    }
    
    console.log('Aplicación inicializada correctamente');
});

// Suscribirse a eventos de cambio de estado global
document.addEventListener('globalStateChange', function(e) {
    if (typeof handleGlobalStateChange === 'function') {
        handleGlobalStateChange(e);
    }
}); 