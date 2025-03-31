// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', initApplication);

// Inicialización de la aplicación
function initApplication() {
    console.log('Inicializando aplicación PdM-Manager v2.0...');
    
    try {
        // Inicializar eventos de estado global - Primero para que otros componentes puedan usarlo
        if (typeof initGlobalStateEvents === 'function') {
            initGlobalStateEvents();
        } else {
            console.error('La función initGlobalStateEvents no está disponible');
        }
        
        // Cargar límites de vibración por defecto
        // Esta operación se debe realizar temprano en el flujo de inicialización
        if (typeof fetchVibrationLimits === 'function') {
            console.log('Cargando límites de vibración por defecto...');
            fetchVibrationLimits();
        } else {
            console.warn('La función fetchVibrationLimits no está disponible, no se cargarán los límites de vibración');
        }
        
        // Inicializar componentes UI comunes (como toasts, dropdowns, etc.)
        if (typeof initUI === 'function') {
            initUI();
        } else {
            console.warn('La función initUI no está disponible, algunos componentes visuales pueden no funcionar');
        }
        
        // Inicializar navegación
        if (typeof initNavigation === 'function') {
            initNavigation();
        } else {
            console.error('La función initNavigation no está disponible, la navegación no funcionará');
        }
        
        // Inicializar menú lateral
        if (typeof initSidebar === 'function') {
            initSidebar();
        } else {
            console.warn('La función initSidebar no está disponible, el menú lateral puede no funcionar');
        }

        // Inicializar configuración
        if (typeof initConfig === 'function') {
            console.log('Iniciando inicialización de configuración...');
            initConfig();
        } else {
            console.error('La función initConfig no está disponible, la sección de configuración no funcionará');
        }
        
        // Establecer tiempo para actualizar datos iniciales
        setTimeout(() => {
            if (typeof updateDashboardData === 'function') {
                updateDashboardData();
            }
        }, 500);
        
        console.log('Aplicación inicializada correctamente');
    } catch (error) {
        console.error('Error durante la inicialización de la aplicación:', error);
    }
}

// Gestionar cambios de estado global
document.addEventListener('globalStateChange', function(e) {
    try {
        if (typeof handleGlobalStateChange === 'function') {
            handleGlobalStateChange(e);
        }
    } catch (error) {
        console.error('Error al manejar cambio de estado global:', error);
    }
}); 