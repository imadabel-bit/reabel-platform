/**
 * Role Switcher Component
 * Dropdown menu for switching between different roles
 * Displays available roles grouped by category
 */

class RoleSwitcher extends Component {
    constructor(props = {}) {
        super(props);
        
        this.state = {
            isOpen: false,
            roles: null,
            currentRole: null,
            categorizedRoles: {}
        };
    }

    /**
     * Initialize role switcher
     */
    async beforeMount() {
        // Get all roles
        await roleService.initialize();
        this.state.roles = roleService.getAllRoles();
        this.state.currentRole = roleService.getCurrentRole();
        this.state.categorizedRoles = roleService.getRolesByCategory();

        // Subscribe to role changes
        this.subscribe(EVENTS.ROLE_CHANGED, this.onRoleChanged);

        // Close on outside click
        document.addEventListener('click', this.handleOutsideClick.bind(this));
    }

    /**
     * Handle role change event
     */
    onRoleChanged(data) {
        this.setState({
            currentRole: data.role,
            isOpen: false
        });
    }

    /**
     * Handle click outside dropdown
     */
    handleOutsideClick(e) {
        if (this.element && !this.element.contains(e.target)) {
            this.setState({ isOpen: false });
        }
    }

    /**
     * Toggle dropdown
     */
    toggle(event) {
        if (event) {
            event.stopPropagation();
        }
        this.setState({ isOpen: !this.state.isOpen });
    }

    /**
     * Switch to role
     */
    async switchRole(roleId, event) {
        if (event) {
            event.stopPropagation();
        }

        try {
            const success = await roleService.switchRole(roleId);
            
            if (success) {
                this.setState({ isOpen: false });
                
                // Show notification
                notificationService.success(`Switched to ${roleService.getRoleDisplayName(roleId)}`);
            }
        } catch (error) {
            notificationService.error('Failed to switch role: ' + error.message);
        }
    }

    /**
     * Render template
     */
    template() {
        const { isOpen, categorizedRoles } = this.state;
        const openClass = isOpen ? ' open' : '';

        return `
            <div class="role-switcher-dropdown${openClass}" style="display: ${isOpen ? 'block' : 'none'};">
                ${this.renderHeader()}
                ${this.renderBody(categorizedRoles)}
            </div>
        `;
    }

    /**
     * Render dropdown header
     */
    renderHeader() {
        return `
            <div class="role-switcher-header">
                <span>Switch Role (Demo)</span>
                <button onclick="roleSwitcherComponent.toggle(event)" class="close-switcher">×</button>
            </div>
        `;
    }

    /**
     * Render dropdown body with roles
     */
    renderBody(categorizedRoles) {
        const platformRoles = categorizedRoles.platform || [];
        const customerRoles = categorizedRoles.customer || [];

        return `
            <div class="role-switcher-body">
                ${this.renderRoleGroup('REABEL Partners', 'building-2', platformRoles)}
                ${this.renderRoleGroup('Acme Corporation', 'building', customerRoles)}
            </div>
        `;
    }

    /**
     * Render role group
     */
    renderRoleGroup(label, icon, roles) {
        if (!roles || roles.length === 0) return '';

        const rolesHTML = roles.map(role => this.renderRoleOption(role)).join('');

        return `
            <div class="role-group">
                <div class="role-group-label">
                    <i data-lucide="${icon}"></i>
                    ${label}
                </div>
                ${rolesHTML}
            </div>
        `;
    }

    /**
     * Render single role option
     */
    renderRoleOption(role) {
        const activeClass = role.id === roleService.currentRole ? ' active' : '';

        return `
            <div class="role-option${activeClass}" 
                 onclick="roleSwitcherComponent.switchRole('${role.id}', event)">
                <div class="role-icon">${role.icon}</div>
                <div class="role-info">
                    <div class="role-name">${role.name}</div>
                    <div class="role-desc">${role.type}</div>
                </div>
            </div>
        `;
    }

    /**
     * After render - initialize Lucide icons
     */
    afterRender() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// Create global instance
let roleSwitcherComponent;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RoleSwitcher };
}
