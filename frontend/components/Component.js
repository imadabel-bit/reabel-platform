/**
 * Base Component Class
 * Foundation for all reusable UI components
 * Provides lifecycle methods, event handling, and state management
 */

class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = {};
        this.element = null;
        this.listeners = [];
        this.subscriptions = [];
        this.mounted = false;
    }

    /**
     * Set component state (triggers re-render)
     * @param {object} newState - New state object
     */
    setState(newState) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        
        if (this.mounted) {
            this.onStateChanged(oldState, this.state);
            this.render();
        }
    }

    /**
     * Get element by selector within component
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    $(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * Get all elements by selector within component
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    $$(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }

    /**
     * Add event listener (auto-cleanup on destroy)
     * @param {string} event - Event name
     * @param {string} selector - CSS selector
     * @param {function} handler - Event handler
     */
    on(event, selector, handler) {
        const listener = { event, selector, handler };
        this.listeners.push(listener);

        if (this.element) {
            this.element.addEventListener(event, (e) => {
                if (e.target.matches(selector) || e.target.closest(selector)) {
                    handler.call(this, e);
                }
            });
        }
    }

    /**
     * Subscribe to event bus event (auto-cleanup on destroy)
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    subscribe(event, callback) {
        const unsubscribe = eventBus.on(event, callback.bind(this));
        this.subscriptions.push(unsubscribe);
    }

    /**
     * Emit event to event bus
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        eventBus.emit(event, data);
    }

    /**
     * Render component HTML
     * Override this method in subclasses
     * @returns {string} HTML string
     */
    template() {
        return '<div></div>';
    }

    /**
     * Render component to DOM
     */
    render() {
        if (!this.element) return;

        const html = this.template();
        this.element.innerHTML = html;

        this.afterRender();
    }

    /**
     * Mount component to container
     * @param {string|HTMLElement} container - Container element or selector
     */
    mount(container) {
        const el = typeof container === 'string' 
            ? document.querySelector(container)
            : container;

        if (!el) {
            console.error('[Component] Container not found:', container);
            return;
        }

        this.element = el;
        this.beforeMount();
        this.render();
        this.mounted = true;
        this.afterMount();

        console.log(`[Component] ${this.constructor.name} mounted`);
    }

    /**
     * Unmount and destroy component
     */
    destroy() {
        this.beforeDestroy();

        // Clear event listeners
        this.listeners = [];

        // Unsubscribe from event bus
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];

        // Remove element
        if (this.element) {
            this.element.innerHTML = '';
            this.element = null;
        }

        this.mounted = false;
        this.afterDestroy();

        console.log(`[Component] ${this.constructor.name} destroyed`);
    }

    /**
     * Update component props
     * @param {object} newProps - New props
     */
    updateProps(newProps) {
        this.props = { ...this.props, ...newProps };
        if (this.mounted) {
            this.render();
        }
    }

    // Lifecycle hooks (override in subclasses)
    beforeMount() {}
    afterMount() {}
    beforeDestroy() {}
    afterDestroy() {}
    afterRender() {}
    onStateChanged(oldState, newState) {}
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Component };
}
