/**
 * State Management Store
 * Centralized state management with reactive updates
 * Similar to Redux/Vuex pattern
 */

class Store {
    constructor(initialState = {}) {
        this.state = this.deepFreeze(initialState);
        this.listeners = [];
        this.debugMode = APP_CONFIG.app.environment === 'development';
    }

    /**
     * Get current state
     * @returns {object} Current state (read-only)
     */
    getState() {
        return this.state;
    }

    /**
     * Update state (immutable)
     * @param {function} updater - Function that returns new state
     */
    setState(updater) {
        const previousState = this.state;
        const newState = typeof updater === 'function' 
            ? updater(this.state) 
            : updater;

        this.state = this.deepFreeze({ ...this.state, ...newState });

        if (this.debugMode) {
            console.log('[Store] State updated:', {
                previous: previousState,
                current: this.state
            });
        }

        // Notify all listeners
        this.listeners.forEach(listener => {
            try {
                listener(this.state, previousState);
            } catch (error) {
                console.error('[Store] Error in listener:', error);
            }
        });

        // Emit state update event
        if (typeof eventBus !== 'undefined') {
            eventBus.emit(EVENTS.STATE_UPDATED, {
                state: this.state,
                previousState
            });
        }
    }

    /**
     * Subscribe to state changes
     * @param {function} listener - Callback function
     * @returns {function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);

        if (this.debugMode) {
            console.log('[Store] New subscriber added');
        }

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Deep freeze object to prevent mutations
     * @param {object} obj - Object to freeze
     * @returns {object} Frozen object
     */
    deepFreeze(obj) {
        Object.keys(obj).forEach(prop => {
            if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                this.deepFreeze(obj[prop]);
            }
        });
        return Object.freeze(obj);
    }

    /**
     * Get specific value from state
     * @param {string} path - Dot notation path (e.g., 'user.profile.name')
     * @returns {*} Value at path
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    /**
     * Check if value exists in state
     * @param {string} path - Dot notation path
     * @returns {boolean}
     */
    has(path) {
        return this.get(path) !== undefined;
    }

    /**
     * Reset state to initial
     * @param {object} initialState - New initial state
     */
    reset(initialState = {}) {
        this.state = this.deepFreeze(initialState);
        this.listeners.forEach(listener => listener(this.state, {}));
    }
}

// Create singleton store instance
const store = new Store({
    // User state
    user: {
        id: null,
        email: null,
        name: null,
        role: APP_CONFIG.ui.defaultRole,
        permissions: []
    },

    // Session state
    session: {
        isAuthenticated: false,
        token: null,
        expiresAt: null
    },

    // Current role
    currentRole: {
        id: APP_CONFIG.ui.defaultRole,
        name: 'Customer Admin',
        type: 'Company Owner',
        readOnly: false
    },

    // UI state
    ui: {
        sidebarOpen: true,
        theme: 'light',
        notifications: [],
        modals: [],
        loading: false
    },

    // Data state
    data: {
        roles: null,
        navigation: null,
        templates: null,
        questions: null,
        assessments: null,
        actions: null,
        team: null
    },

    // Current page
    currentPage: {
        id: null,
        title: null,
        params: {}
    }
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Store, store };
}
