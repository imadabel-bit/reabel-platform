/**
 * Notification Service
 * Manages in-app notifications, toasts, and alerts
 * Supports multiple notification types and templates
 */

class NotificationService {
    constructor() {
        this.notifications = [];
        this.templates = null;
        this.container = null;
        this.defaultDuration = APP_CONFIG.ui.notificationDuration || 3000;
        this.maxVisible = 3;
        this.initialized = false;
    }

    /**
     * Initialize notification service
     */
    async initialize() {
        try {
            console.log('[NotificationService] Initializing...');

            // Create notification container
            this.createContainer();

            // Load notification templates from database
            try {
                const templatesData = await apiService.load('notification_templates');
                this.templates = templatesData.templates || templatesData;
            } catch (error) {
                console.log('[NotificationService] Using default templates');
                this.templates = this.getDefaultTemplates();
            }

            // Subscribe to notification events
            this.subscribeToEvents();

            this.initialized = true;
            console.log('[NotificationService] Initialized');
            return true;

        } catch (error) {
            console.error('[NotificationService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Create DOM container for notifications
     */
    createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;

        document.body.appendChild(this.container);
    }

    /**
     * Subscribe to application events
     */
    subscribeToEvents() {
        // Show notification event
        eventBus.on(EVENTS.NOTIFICATION_SHOW, (data) => {
            this.show(data.message, data.type, data.options);
        });

        // Assessment events
        eventBus.on(EVENTS.ASSESSMENT_CREATED, (assessment) => {
            this.show(`Assessment "${assessment.title}" created successfully`, 'success');
        });

        eventBus.on(EVENTS.ASSESSMENT_UPDATED, (assessment) => {
            this.show(`Assessment updated`, 'success');
        });

        // Question events
        eventBus.on(EVENTS.QUESTION_ANSWERED, (data) => {
            this.show('Response saved successfully', 'success');
        });

        eventBus.on(EVENTS.QUESTION_SAVED, () => {
            this.show('Draft saved', 'info');
        });

        // Review events
        eventBus.on(EVENTS.REVIEW_APPROVED, () => {
            this.show('Response approved', 'success');
        });

        eventBus.on(EVENTS.REVIEW_REJECTED, () => {
            this.show('Response rejected', 'warning');
        });

        // Role events
        eventBus.on(EVENTS.ROLE_CHANGED, (data) => {
            const role = data.role;
            this.show(`Switched to ${role.name}`, 'success', { icon: role.icon });
        });

        // Data errors
        eventBus.on(EVENTS.DATA_ERROR, (data) => {
            this.show(data.error?.message || 'An error occurred', 'error');
        });
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {object} options - Additional options
     */
    show(message, type = 'info', options = {}) {
        try {
            // Create notification object
            const notification = {
                id: this.generateId(),
                message: message,
                type: type,
                icon: options.icon || this.getIcon(type),
                duration: options.duration || this.defaultDuration,
                action: options.action || null,
                dismissible: options.dismissible !== false,
                createdAt: Date.now()
            };

            // Add to notifications array
            this.notifications.push(notification);

            // Render notification
            this.render(notification);

            // Auto-dismiss after duration
            if (notification.duration > 0) {
                setTimeout(() => {
                    this.dismiss(notification.id);
                }, notification.duration);
            }

            // Limit visible notifications
            this.limitVisibleNotifications();

            console.log('[NotificationService] Notification shown:', type, message);

        } catch (error) {
            console.error('[NotificationService] Show failed:', error);
        }
    }

    /**
     * Render notification in DOM
     * @param {object} notification - Notification object
     */
    render(notification) {
        const el = document.createElement('div');
        el.id = `notification-${notification.id}`;
        el.className = `notification notification-${notification.type}`;
        el.style.cssText = `
            background: ${this.getBackgroundColor(notification.type)};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
            pointer-events: all;
            cursor: pointer;
            transition: all 0.3s;
            animation: slideInRight 0.3s ease-out;
        `;

        // Icon
        if (notification.icon) {
            const iconEl = document.createElement('div');
            iconEl.style.cssText = 'font-size: 20px; flex-shrink: 0;';
            iconEl.textContent = notification.icon;
            el.appendChild(iconEl);
        }

        // Message
        const messageEl = document.createElement('div');
        messageEl.style.cssText = 'flex: 1; font-size: 14px; line-height: 1.5;';
        messageEl.textContent = notification.message;
        el.appendChild(messageEl);

        // Dismiss button
        if (notification.dismissible) {
            const dismissEl = document.createElement('button');
            dismissEl.textContent = '×';
            dismissEl.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                opacity: 0.7;
                transition: opacity 0.2s;
            `;
            dismissEl.onmouseover = () => dismissEl.style.opacity = '1';
            dismissEl.onmouseout = () => dismissEl.style.opacity = '0.7';
            dismissEl.onclick = (e) => {
                e.stopPropagation();
                this.dismiss(notification.id);
            };
            el.appendChild(dismissEl);
        }

        // Action button
        if (notification.action) {
            el.onclick = () => {
                notification.action.callback();
                this.dismiss(notification.id);
            };
            el.style.cursor = 'pointer';
        }

        // Add to container
        this.container.appendChild(el);

        // Add CSS animation
        this.addAnimationStyles();
    }

    /**
     * Dismiss notification
     * @param {string} notificationId - Notification ID
     */
    dismiss(notificationId) {
        const el = document.getElementById(`notification-${notificationId}`);
        if (!el) return;

        // Animate out
        el.style.animation = 'slideOutRight 0.3s ease-in';
        
        setTimeout(() => {
            el.remove();
            
            // Remove from array
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
        }, 300);
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        this.notifications.forEach(n => this.dismiss(n.id));
    }

    /**
     * Limit visible notifications
     */
    limitVisibleNotifications() {
        if (this.notifications.length > this.maxVisible) {
            const toRemove = this.notifications.length - this.maxVisible;
            const oldest = this.notifications.slice(0, toRemove);
            
            oldest.forEach(n => this.dismiss(n.id));
        }
    }

    /**
     * Show success notification
     * @param {string} message - Message
     * @param {object} options - Options
     */
    success(message, options = {}) {
        this.show(message, 'success', options);
    }

    /**
     * Show error notification
     * @param {string} message - Message
     * @param {object} options - Options
     */
    error(message, options = {}) {
        this.show(message, 'error', { ...options, duration: 5000 });
    }

    /**
     * Show warning notification
     * @param {string} message - Message
     * @param {object} options - Options
     */
    warning(message, options = {}) {
        this.show(message, 'warning', options);
    }

    /**
     * Show info notification
     * @param {string} message - Message
     * @param {object} options - Options
     */
    info(message, options = {}) {
        this.show(message, 'info', options);
    }

    /**
     * Show notification with action button
     * @param {string} message - Message
     * @param {string} actionLabel - Action button label
     * @param {function} actionCallback - Action callback
     * @param {object} options - Options
     */
    showWithAction(message, actionLabel, actionCallback, options = {}) {
        this.show(message, options.type || 'info', {
            ...options,
            action: {
                label: actionLabel,
                callback: actionCallback
            }
        });
    }

    /**
     * Show confirmation dialog
     * @param {string} message - Message
     * @param {function} onConfirm - Confirm callback
     * @param {function} onCancel - Cancel callback
     */
    confirm(message, onConfirm, onCancel = null) {
        // This would show a modal dialog
        // For now, use browser confirm
        if (confirm(message)) {
            onConfirm();
        } else if (onCancel) {
            onCancel();
        }
    }

    /**
     * Get icon for notification type
     * @param {string} type - Notification type
     * @returns {string} Icon
     */
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    /**
     * Get background color for notification type
     * @param {string} type - Notification type
     * @returns {string} Color
     */
    getBackgroundColor(type) {
        const colors = {
            success: '#48A9A6',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    /**
     * Add CSS animation styles
     */
    addAnimationStyles() {
        if (document.getElementById('notification-animations')) return;

        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get default notification templates
     * @returns {object} Default templates
     */
    getDefaultTemplates() {
        return {
            assessment_created: {
                type: 'success',
                message: 'Assessment created successfully'
            },
            assessment_updated: {
                type: 'success',
                message: 'Assessment updated'
            },
            response_saved: {
                type: 'success',
                message: 'Response saved successfully'
            },
            review_approved: {
                type: 'success',
                message: 'Response approved'
            },
            permission_denied: {
                type: 'error',
                message: 'Permission denied'
            }
        };
    }

    /**
     * Generate unique ID
     * @returns {string} ID
     */
    generateId() {
        return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all active notifications
     * @returns {array} Notifications
     */
    getAll() {
        return this.notifications;
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        this.dismissAll();
    }
}

// Create singleton instance (let allows pages to reinitialize)
let notificationService;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotificationService, notificationService };
}
