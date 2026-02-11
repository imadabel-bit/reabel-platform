/**
 * Modal Component
 * Reusable modal dialog with header, body, footer
 * Supports different sizes and types
 */

class Modal extends Component {
    constructor(props = {}) {
        super(props);
        
        this.state = {
            isOpen: false,
            title: props.title || '',
            content: props.content || '',
            size: props.size || 'medium', // small, medium, large, full
            type: props.type || 'default', // default, confirm, alert
            onConfirm: props.onConfirm || null,
            onCancel: props.onCancel || null,
            showFooter: props.showFooter !== false,
            closeOnBackdrop: props.closeOnBackdrop !== false
        };
    }

    /**
     * Open modal
     * @param {object} config - Modal configuration
     */
    open(config = {}) {
        this.setState({
            isOpen: true,
            ...config
        });

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Subscribe to ESC key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Close modal
     */
    close() {
        this.setState({ isOpen: false });

        // Restore body scroll
        document.body.style.overflow = '';

        // Remove ESC handler
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }

        // Call onCancel if provided
        if (this.state.onCancel) {
            this.state.onCancel();
        }
    }

    /**
     * Handle confirm action
     */
    confirm() {
        if (this.state.onConfirm) {
            this.state.onConfirm();
        }
        this.close();
    }

    /**
     * Handle backdrop click
     */
    handleBackdropClick(e) {
        if (e.target.classList.contains('modal-backdrop') && this.state.closeOnBackdrop) {
            this.close();
        }
    }

    /**
     * Render template
     */
    template() {
        const { isOpen, size, type } = this.state;

        if (!isOpen) return '';

        return `
            <div class="modal-backdrop" onclick="modalComponent.handleBackdropClick(event)">
                <div class="modal-dialog modal-${size}" onclick="event.stopPropagation()">
                    ${this.renderHeader()}
                    ${this.renderBody()}
                    ${this.state.showFooter ? this.renderFooter() : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render modal header
     */
    renderHeader() {
        return `
            <div class="modal-header">
                <h3 class="modal-title">${this.state.title}</h3>
                <button class="modal-close" onclick="modalComponent.close()">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render modal body
     */
    renderBody() {
        return `
            <div class="modal-body">
                ${this.state.content}
            </div>
        `;
    }

    /**
     * Render modal footer
     */
    renderFooter() {
        const { type } = this.state;

        if (type === 'confirm') {
            return `
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="modalComponent.close()">
                        Cancel
                    </button>
                    <button class="btn btn-primary" onclick="modalComponent.confirm()">
                        Confirm
                    </button>
                </div>
            `;
        }

        if (type === 'alert') {
            return `
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="modalComponent.close()">
                        OK
                    </button>
                </div>
            `;
        }

        return `
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modalComponent.close()">
                    Close
                </button>
            </div>
        `;
    }

    /**
     * After render
     */
    afterRender() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Focus first input if any
        const firstInput = this.$('input, textarea, select');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    /**
     * Static helper methods
     */
    static confirm(title, message, onConfirm, onCancel) {
        if (!window.modalComponent) {
            console.error('[Modal] Modal component not initialized');
            return;
        }

        window.modalComponent.open({
            title: title,
            content: message,
            type: 'confirm',
            onConfirm: onConfirm,
            onCancel: onCancel
        });
    }

    static alert(title, message, onClose) {
        if (!window.modalComponent) {
            console.error('[Modal] Modal component not initialized');
            return;
        }

        window.modalComponent.open({
            title: title,
            content: message,
            type: 'alert',
            onCancel: onClose
        });
    }

    static custom(config) {
        if (!window.modalComponent) {
            console.error('[Modal] Modal component not initialized');
            return;
        }

        window.modalComponent.open(config);
    }
}

// Create global instance
let modalComponent;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Modal };
}
