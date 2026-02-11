/**
 * Application Configuration
 * Central configuration for the entire application
 */

const APP_CONFIG = {
    // Application metadata
    app: {
        name: 'REABEL Assessment Platform',
        version: '1.0.0',
        environment: 'demo', // demo | development | staging | production
        baseUrl: window.location.origin
    },

    // API configuration (ready for backend)
    api: {
        baseUrl: '/api/v1',
        timeout: 30000,
        retryAttempts: 3,
        endpoints: {
            auth: '/auth',
            users: '/users',
            roles: '/roles',
            assessments: '/assessments',
            questions: '/questions',
            templates: '/templates',
            reviews: '/reviews',
            actions: '/actions',
            progress: '/progress',
            team: '/team'
        }
    },

    // Data sources (currently JSON, ready for API)
    dataSources: {
        mode: 'local', // local | api | hybrid
        local: {
            basePath: '../data',
            files: {
                roles: 'roles.json',
                permissions: 'permissions.json',
                navigation: 'navigation.json',
                templates: 'templates.json',
                questions: 'questions.json',
                assessments: 'assessments.json',
                actions: 'actions.json',
                team: 'team.json'
            }
        }
    },

    // Feature flags
    features: {
        roleSwitcher: true,
        notifications: true,
        darkMode: false,
        analytics: true,
        realTimeUpdates: false,
        collaborativeEditing: false
    },

    // UI configuration
    ui: {
        theme: 'default',
        defaultRole: 'customer_admin',
        notificationDuration: 3000,
        autoSaveInterval: 30000,
        pageSize: 20,
        maxUploadSize: 10485760 // 10MB
    },

    // Storage configuration
    storage: {
        prefix: 'reabel_',
        keys: {
            role: 'demoRole',
            user: 'currentUser',
            theme: 'theme',
            session: 'sessionData'
        }
    },

    // Event bus configuration
    events: {
        debounceDelay: 300,
        throttleDelay: 1000
    }
};

// Freeze config to prevent modifications
Object.freeze(APP_CONFIG);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
}
