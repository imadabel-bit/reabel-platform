/**
 * Navigation Service
 * Manages dynamic navigation menus from database
 * Filters based on role permissions and feature flags
 * Builds hierarchical menu structures
 */

class NavigationService {
    constructor() {
        this.navigationData = null;
        this.compiledMenus = {};
        this.initialized = false;
        this.currentPage = null;
    }

    /**
     * Initialize navigation service
     * Loads navigation configuration from database
     */
    async initialize() {
        try {
            console.log('[NavigationService] Loading navigation from database...');

            // Load navigation structure from database/JSON
            const navData = await apiService.load('navigation');
            this.navigationData = navData.navigation || navData;

            this.initialized = true;
            eventBus.emit(EVENTS.NAV_LOADED, this.navigationData);

            console.log('[NavigationService] Navigation loaded:', this.navigationData.length, 'items');
            return true;

        } catch (error) {
            console.error('[NavigationService] Failed to load navigation:', error);
            return false;
        }
    }

    /**
     * Build navigation menu filtered by role
     * @param {string} roleId - Current user role
     * @param {string} menuType - Type of menu (sidebar, header, context)
     * @returns {array} Filtered navigation items
     */
    buildMenu(roleId, menuType = 'sidebar') {
        if (!this.navigationData) {
            console.error('[NavigationService] Navigation not loaded');
            return [];
        }

        const role = roleService.getCurrentRole();
        if (!role) {
            console.error('[NavigationService] No current role');
            return [];
        }

        // Get allowed navigation from role configuration
        const allowedNav = role.navigation;

        // If role has 'all' access, return all items
        if (allowedNav === 'all') {
            return this.navigationData.map(item => ({
                ...item,
                isAllowed: true,
                isActive: this.isCurrentPage(item.id)
            }));
        }

        // Filter navigation based on allowed items
        const filtered = this.navigationData.map(item => {
            const isAllowed = this.isItemAllowedForRole(item, allowedNav);
            
            return {
                ...item,
                isAllowed,
                isDisabled: !isAllowed,
                isActive: this.isCurrentPage(item.id)
            };
        });

        return filtered;
    }

    /**
     * Check if navigation item is allowed for role
     * @param {object} item - Navigation item
     * @param {array|string} allowedNav - Allowed navigation for role
     * @returns {boolean}
     */
    isItemAllowedForRole(item, allowedNav) {
        if (allowedNav === 'all') return true;
        if (!Array.isArray(allowedNav)) return false;

        // Check if item ID is in allowed list
        return allowedNav.some(allowed => {
            return item.id.includes(allowed) || item.href.includes(allowed);
        });
    }

    /**
     * Render navigation HTML
     * @param {string} containerId - DOM container ID
     * @param {string} roleId - Current user role
     * @param {string} menuType - Menu type
     */
    render(containerId, roleId, menuType = 'sidebar') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[NavigationService] Container not found:', containerId);
            return;
        }

        const menuItems = this.buildMenu(roleId, menuType);
        const html = this.buildMenuHTML(menuItems);

        container.innerHTML = html;

        // Initialize Lucide icons if available
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Attach event listeners
        this.attachEventListeners(container);

        console.log('[NavigationService] Menu rendered:', menuItems.length, 'items');
    }

    /**
     * Build HTML for menu items
     * @param {array} items - Menu items
     * @returns {string} HTML string
     */
    buildMenuHTML(items) {
        return items.map(item => {
            const activeClass = item.isActive ? ' active' : '';
            const disabledClass = item.isDisabled ? ' disabled' : '';
            const disabledStyle = item.isDisabled ? 'opacity: 0.3; pointer-events: none; cursor: not-allowed;' : '';

            return `
                <a href="${item.href}" 
                   class="nav-link${activeClass}${disabledClass}"
                   data-nav-id="${item.id}"
                   style="${disabledStyle}"
                   ${item.isDisabled ? 'onclick="return false;"' : ''}>
                    <i data-lucide="${item.icon}"></i>
                    <span>${item.label}</span>
                    ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                </a>
            `;
        }).join('');
    }

    /**
     * Attach event listeners to navigation
     * @param {HTMLElement} container - Menu container
     */
    attachEventListeners(container) {
        const links = container.querySelectorAll('.nav-link:not(.disabled)');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const navId = link.getAttribute('data-nav-id');
                
                // Emit navigation event
                eventBus.emit(EVENTS.PAGE_CHANGED, {
                    from: this.currentPage,
                    to: navId,
                    href: link.getAttribute('href')
                });

                this.currentPage = navId;
            });
        });
    }

    /**
     * Check if item is current page
     * @param {string} itemId - Navigation item ID
     * @returns {boolean}
     */
    isCurrentPage(itemId) {
        // Get current page from URL
        const currentPath = window.location.pathname;
        const filename = currentPath.split('/').pop();

        // Check if any navigation item matches
        const item = this.navigationData.find(nav => nav.id === itemId);
        if (!item) return false;

        return item.href === filename || item.href.includes(filename);
    }

    /**
     * Get navigation item by ID
     * @param {string} itemId - Navigation item ID
     * @returns {object|null}
     */
    getItem(itemId) {
        if (!this.navigationData) return null;
        return this.navigationData.find(item => item.id === itemId);
    }

    /**
     * Get breadcrumb trail for current page
     * @returns {array} Breadcrumb items
     */
    getBreadcrumbs() {
        const currentItem = this.navigationData?.find(item => this.isCurrentPage(item.id));
        
        if (!currentItem) return [];

        const breadcrumbs = [
            { label: 'Home', href: '02_dashboard.html' },
            { label: currentItem.label, href: currentItem.href, active: true }
        ];

        return breadcrumbs;
    }

    /**
     * Update navigation badges (notifications, counts)
     * @param {object} badges - Badge data { itemId: count }
     */
    updateBadges(badges) {
        Object.entries(badges).forEach(([itemId, count]) => {
            const link = document.querySelector(`[data-nav-id="${itemId}"]`);
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

    /**
     * Highlight active navigation item
     * @param {string} itemId - Navigation item ID
     */
    setActive(itemId) {
        // Remove all active classes
        document.querySelectorAll('.nav-link.active').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current item
        const link = document.querySelector(`[data-nav-id="${itemId}"]`);
        if (link) {
            link.classList.add('active');
        }

        this.currentPage = itemId;
    }

    /**
     * Get navigation items for specific category
     * @param {string} category - Category name
     * @returns {array} Filtered items
     */
    getByCategory(category) {
        if (!this.navigationData) return [];
        
        return this.navigationData.filter(item => 
            item.category === category
        );
    }

    /**
     * Search navigation items
     * @param {string} query - Search query
     * @returns {array} Matching items
     */
    search(query) {
        if (!this.navigationData || !query) return [];

        const lowerQuery = query.toLowerCase();

        return this.navigationData.filter(item => {
            return item.label.toLowerCase().includes(lowerQuery) ||
                   (item.keywords && item.keywords.some(k => k.toLowerCase().includes(lowerQuery)));
        });
    }

    /**
     * Get menu for quick access / command palette
     * @returns {array} All accessible items
     */
    getQuickAccessMenu() {
        const roleId = roleService.currentRole;
        return this.buildMenu(roleId).filter(item => item.isAllowed);
    }

    /**
     * Check if user can access a specific page
     * @param {string} pageId - Page identifier
     * @returns {boolean}
     */
    canAccessPage(pageId) {
        const item = this.getItem(pageId);
        if (!item) return false;

        const role = roleService.getCurrentRole();
        if (!role) return false;

        return this.isItemAllowedForRole(item, role.navigation);
    }

    /**
     * Get page metadata
     * @param {string} pageId - Page identifier
     * @returns {object} Page metadata
     */
    getPageMetadata(pageId) {
        const item = this.getItem(pageId);
        if (!item) return null;

        return {
            id: item.id,
            title: item.label,
            icon: item.icon,
            href: item.href,
            description: item.description || '',
            category: item.category || 'general'
        };
    }
}

// Create singleton instance
const navigationService = new NavigationService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationService, navigationService };
}
