/**
 * Event Bus
 * Pub/Sub pattern for inter-service communication
 * Decouples services from each other
 */

class EventBus {
    constructor() {
        this.events = {};
        this.debugMode = APP_CONFIG.app.environment === 'development';
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     * @returns {function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }

        this.events[event].push(callback);

        if (this.debugMode) {
            console.log(`[EventBus] Subscribed to: ${event}`);
        }

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.events[event]) return;

        this.events[event] = this.events[event].filter(cb => cb !== callback);

        if (this.debugMode) {
            console.log(`[EventBus] Unsubscribed from: ${event}`);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to callbacks
     */
    emit(event, data) {
        if (!this.events[event]) return;

        if (this.debugMode) {
            console.log(`[EventBus] Emitting: ${event}`, data);
        }

        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventBus] Error in callback for ${event}:`, error);
            }
        });
    }

    /**
     * Subscribe to event once
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };

        this.on(event, onceCallback);
    }

    /**
     * Clear all event listeners
     */
    clear() {
        this.events = {};
        if (this.debugMode) {
            console.log('[EventBus] All events cleared');
        }
    }

    /**
     * Get all registered events (debugging)
     */
    getEvents() {
        return Object.keys(this.events);
    }
}

// Create singleton instance
const eventBus = new EventBus();

// Standard event names (prevents typos)
const EVENTS = {
    // Auth events
    USER_LOGGED_IN: 'user:logged-in',
    USER_LOGGED_OUT: 'user:logged-out',
    
    // Role events
    ROLE_CHANGED: 'role:changed',
    ROLE_LOADED: 'role:loaded',
    
    // Navigation events
    PAGE_CHANGED: 'page:changed',
    NAV_LOADED: 'nav:loaded',
    
    // Data events
    DATA_LOADED: 'data:loaded',
    DATA_UPDATED: 'data:updated',
    DATA_DELETED: 'data:deleted',
    DATA_ERROR: 'data:error',
    
    // UI events
    NOTIFICATION_SHOW: 'ui:notification-show',
    MODAL_OPEN: 'ui:modal-open',
    MODAL_CLOSE: 'ui:modal-close',
    LOADER_SHOW: 'ui:loader-show',
    LOADER_HIDE: 'ui:loader-hide',
    
    // Assessment events
    ASSESSMENT_CREATED: 'assessment:created',
    ASSESSMENT_UPDATED: 'assessment:updated',
    ASSESSMENT_SUBMITTED: 'assessment:submitted',
    
    // Question events
    QUESTION_ANSWERED: 'question:answered',
    QUESTION_SAVED: 'question:saved',
    
    // Review events
    REVIEW_APPROVED: 'review:approved',
    REVIEW_REJECTED: 'review:rejected',
    
    // State events
    STATE_UPDATED: 'state:updated'
};

Object.freeze(EVENTS);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBus, eventBus, EVENTS };
}
