/**
 * Sidebar Component
 * Main navigation sidebar with logo, menu, and role switcher
 * Fully responsive and role-aware
 */

class Sidebar extends Component {
    constructor(props = {}) {
        super(props);
        
        this.state = {
            collapsed: false,
            currentPage: props.currentPage || 'dashboard',
            currentRole: null,
            menuItems: []
        };
    }

    /**
     * Initialize sidebar
     */
    async beforeMount() {
        // Load current role
        await roleService.initialize();
        this.state.currentRole = roleService.getCurrentRole();

        // Load navigation
        await navigationService.initialize();
        this.state.menuItems = navigationService.buildMenu(roleService.currentRole);

        // Subscribe to role changes
        this.subscribe(EVENTS.ROLE_CHANGED, this.onRoleChanged);
    }

    /**
     * Handle role change
     */
    onRoleChanged(data) {
        this.setState({
            currentRole: data.role,
            menuItems: navigationService.buildMenu(data.roleId)
        });
    }

    /**
     * Toggle sidebar collapse
     */
    toggleCollapse() {
        this.setState({ collapsed: !this.state.collapsed });
    }

    /**
     * Render sidebar template
     */
    template() {
        const { collapsed, menuItems, currentRole } = this.state;
        const collapsedClass = collapsed ? ' collapsed' : '';

        return `
            <div class="sidebar${collapsedClass}" id="sidebar">
                ${this.renderHeader()}
                ${this.renderNavigation(menuItems)}
                ${this.renderRoleSwitcher(currentRole)}
            </div>
        `;
    }

    /**
     * Render sidebar header with logo
     */
    renderHeader() {
        return `
            <div class="sidebar-header">
                <div class="sidebar-logo" onclick="window.location.href='02_dashboard.html'">
                    <div class="sidebar-logo-icon">R</div>
                    <div class="sidebar-logo-text">
                        <div class="logo-title">REABEL</div>
                        <div class="logo-subtitle">Assessment Platform</div>
                    </div>
                </div>
                <button class="sidebar-toggle" onclick="sidebar.toggleCollapse()">
                    <i data-lucide="menu"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render navigation menu
     */
    renderNavigation(menuItems) {
        const navHTML = menuItems.map(item => {
            const activeClass = item.isActive ? ' active' : '';
            const disabledClass = item.isDisabled ? ' disabled' : '';
            const disabledStyle = item.isDisabled ? 'opacity: 0.3; pointer-events: none;' : '';

            return `
                <a href="${item.href}" 
                   class="nav-link${activeClass}${disabledClass}"
                   data-nav-id="${item.id}"
                   style="${disabledStyle}"
                   ${item.isDisabled ? 'onclick="return false;"' : ''}>
                    <i data-lucide="${item.icon}"></i>
                    <span class="nav-label">${item.label}</span>
                    ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                </a>
            `;
        }).join('');

        return `<nav class="sidebar-nav">${navHTML}</nav>`;
    }

    /**
     * Render role switcher
     */
    renderRoleSwitcher(currentRole) {
        if (!currentRole) return '';

        return `
            <div class="role-switcher-container">
                <div class="current-role-badge" onclick="roleSwitcherComponent.toggle(event)">
                    <div class="role-badge-info">
                        <div id="currentRoleName">${currentRole.name}</div>
                        <div id="currentRoleType">${currentRole.type}</div>
                    </div>
                    <div class="dropdown-arrow">▼</div>
                </div>
                <div id="roleSwitcherDropdown"></div>
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

        // Set active nav item
        this.setActiveNavItem(this.state.currentPage);
    }

    /**
     * Set active navigation item
     */
    setActiveNavItem(pageId) {
        this.$$('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = this.$(`[data-nav-id="${pageId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Update navigation badges
     */
    updateBadges(badges) {
        Object.entries(badges).forEach(([itemId, count]) => {
            const link = this.$(`[data-nav-id="${itemId}"]`);
            if (!link) return;

            let badge = link.querySelector('.nav-badge');
            
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'nav-badge';
                    link.appendChild(badge);
                }
                badge.textContent = count;
            } else if (badge) {
                badge.remove();
            }
        });
    }
}

// Create global instance
let sidebar;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Sidebar };
}
