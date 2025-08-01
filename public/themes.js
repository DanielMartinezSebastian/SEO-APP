// Theme Management System
class ThemeManager {
    constructor() {
        this.currentTheme = null;
        this.init();
    }

    init() {
        // Detectar tema guardado o preferencia del sistema
        this.detectTheme();
        
        // Aplicar tema inicial
        this.applyTheme(this.currentTheme);
        
        // Crear botón de toggle
        this.createThemeToggle();
        
        // Escuchar cambios en la preferencia del sistema
        this.listenToSystemChanges();
    }

    detectTheme() {
        // Primero verificar si hay tema guardado en localStorage
        const savedTheme = localStorage.getItem('seo-app-theme');
        
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else {
            // Detectar preferencia del sistema
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                this.currentTheme = 'dark';
            } else {
                this.currentTheme = 'light';
            }
        }
    }

    applyTheme(theme) {
        this.currentTheme = theme;
        
        // Aplicar tema al documento
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        // Guardar en localStorage
        localStorage.setItem('seo-app-theme', theme);
        
        // Actualizar icono del botón
        this.updateToggleIcon();
        
        // Actualizar gráficos si existen
        this.updateChartColors();
        
        // Disparar evento personalizado para notificar el cambio de tema
        document.dispatchEvent(new CustomEvent('theme-changed', {
            detail: { theme: theme, isDark: theme === 'dark' }
        }));
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        // Añadir animación visual al cambio
        this.animateThemeChange();
    }

    createThemeToggle() {
        // Verificar si ya existe el botón
        if (document.getElementById('theme-toggle')) return;
        
        const button = document.createElement('button');
        button.id = 'theme-toggle';
        button.className = 'theme-toggle';
        button.setAttribute('title', 'Cambiar tema');
        button.setAttribute('aria-label', 'Cambiar entre tema claro y oscuro');
        
        // Crear icono
        const icon = document.createElement('i');
        icon.className = 'fas fa-sun icon';
        button.appendChild(icon);
        
        // Agregar evento
        button.addEventListener('click', () => this.toggleTheme());
        
        // Agregar al documento
        document.body.appendChild(button);
        
        // Actualizar icono inicial
        this.updateToggleIcon();
    }

    updateToggleIcon() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        
        const icon = button.querySelector('.icon');
        
        if (this.currentTheme === 'dark') {
            icon.className = 'fas fa-moon icon';
            button.setAttribute('title', 'Cambiar a tema claro');
        } else {
            icon.className = 'fas fa-sun icon';
            button.setAttribute('title', 'Cambiar a tema oscuro');
        }
    }

    listenToSystemChanges() {
        // Escuchar cambios en la preferencia del sistema
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            mediaQuery.addEventListener('change', (e) => {
                // Solo aplicar cambio automático si no hay tema guardado manualmente
                const savedTheme = localStorage.getItem('seo-app-theme');
                if (!savedTheme) {
                    const systemTheme = e.matches ? 'dark' : 'light';
                    this.applyTheme(systemTheme);
                }
            });
        }
    }

    animateThemeChange() {
        // Añadir clase de animación temporal
        document.body.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    updateChartColors() {
        // Actualizar colores de Chart.js si existe
        if (window.Chart && window.Chart.defaults) {
            const isDark = this.currentTheme === 'dark';
            
            // Actualizar colores por defecto de Chart.js
            Chart.defaults.color = isDark ? '#ffffff' : '#666666';
            Chart.defaults.borderColor = isDark ? '#404040' : '#dee2e6';
            Chart.defaults.backgroundColor = isDark ? '#1e1e1e' : '#ffffff';
        }
    }

    // Método para obtener el tema actual
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Método para verificar si está en modo oscuro
    isDarkMode() {
        return this.currentTheme === 'dark';
    }

    // Método para forzar un tema específico
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
        }
    }

    // Método para resetear al tema del sistema
    resetToSystem() {
        localStorage.removeItem('seo-app-theme');
        this.detectTheme();
        this.applyTheme(this.currentTheme);
    }
}

// Inicializar el gestor de temas cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// También inicializar inmediatamente para evitar flash
if (document.readyState === 'loading') {
    // Si el documento aún está cargando, usar DOMContentLoaded
} else {
    // Si el documento ya está cargado
    window.themeManager = new ThemeManager();
}

// Exportar para uso global
window.ThemeManager = ThemeManager;
