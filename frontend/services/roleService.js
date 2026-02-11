/**
 * Role Service
 * Manages role switching and permissions
 * FULLY DATABASE-DRIVEN - All role data comes from backend/JSON
 */

class RoleService {
    constructor() {
        this.roles = null;
        this.permissions = null;
        this.currentRole = null;
        this.initialized = false;
    }

    /**
     * Initialize role service
     * Loads all role configurations from database/JSON
     */
    async initialize() {
        try {
            console.log('[RoleService] Initializing...');

            // Load roles configuration from database/JSON
            const rolesData = await apiService.load('roles');
            this.roles = rolesData.roles;

            // Load permissions matrix from database/JSON
            // This defines what each role can do - fully configurable
            const permissionsData = await apiService.load('permissions');
            this.permissions = permissionsData;

            // Set current role from storage or default
            const savedRoleId = localStorage.getItem(APP_CONFIG.storage.prefix + APP_CONFIG.storage.keys.role);
            this.currentRole = savedRoleId || APP_CONFIG.ui.defaultRole;

            // Update store
            this.updateStoreRole(this.currentRole);

            this.initialized = true;
            eventBus.emit(EVENTS.ROLE_LOADED, this.currentRole);

            console.log('[RoleService] Initialized with role:', this.currentRole);
            return true;

        } catch (error) {
            console.error('[RoleService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Switch to a different role
     * @param {string} roleId - Role ID to switch to
     * @returns {Promise<boolean>} Success status
     */
    async switchRole(roleId) {
        try {
            const role = this.roles[roleId];

            if (!role) {
                throw new Error(`Role not found: ${roleId}`);
            }

            console.log('[RoleService] Switching to role:', roleId);

            // In production, this would call backend to validate role switch
            if (APP_CONFIG.dataSources.mode === 'api') {
                const response = await apiService.save('user/role', { roleId }, 'PUT');
                if (!response.success) {
                    throw new Error('Failed to switch role on backend');
                }
            }

            // Update current role
            this.currentRole = roleId;

            // Save to storage
            localStorage.setItem(
                APP_CONFIG.storage.prefix + APP_CONFIG.storage.keys.role,
                roleId
            );

            // Update store
            this.updateStoreRole(roleId);

            // Emit role change event
            eventBus.emit(EVENTS.ROLE_CHANGED, { roleId, role });

            console.log('[RoleService] Role switched successfully');
            return true;

        } catch (error) {
            console.error('[RoleService] Role switch failed:', error);
            eventBus.emit(EVENTS.DATA_ERROR, { 
                service: 'RoleService', 
                action: 'switchRole', 
                error 
            });
            return false;
        }
    }

    /**
     * Get current role configuration
     * @returns {object} Role object
     */
    getCurrentRole() {
        return this.roles ? this.roles[this.currentRole] : null;
    }

    /**
     * Get all available roles
     * @returns {object} All roles
     */
    getAllRoles() {
        return this.roles;
    }

    /**
     * Check if user has specific permission
     * Database-driven permission check
     * @param {string} permission - Permission to check
     * @param {string} resource - Optional resource type
     * @returns {boolean}
     */
    hasPermission(permission, resource = null) {
        if (!this.permissions || !this.currentRole) {
            return false;
        }

        const rolePerms = this.permissions[this.currentRole];

        if (!rolePerms) {
            return false;
        }

        // Super admin has all permissions
        if (rolePerms.includes('*') || rolePerms.includes('admin:*')) {
            return true;
        }

        // Check specific permission
        if (resource) {
            const fullPermission = `${permission}:${resource}`;
            return rolePerms.includes(fullPermission) || rolePerms.includes(`${permission}:*`);
        }

        return rolePerms.includes(permission);
    }

    /**
     * Get permissions for current role
     * @returns {array} Array of permissions
     */
    getCurrentPermissions() {
        return this.permissions ? this.permissions[this.currentRole] || [] : [];
    }

    /**
     * Get allowed navigation items for current role
     * Database-driven navigation filtering
     * @returns {array} Array of allowed nav item IDs
     */
    getAllowedNavigation() {
        const role = this.getCurrentRole();
        
        if (!role) {
            return [];
        }

        // If navigation is 'all', return all
        if (role.navigation === 'all') {
            return 'all';
        }

        // Return specific allowed pages from database config
        return role.navigation || [];
    }

    /**
     * Check if role is read-only
     * @returns {boolean}
     */
    isReadOnly() {
        const role = this.getCurrentRole();
        return role ? role.readOnly === true : false;
    }

    /**
     * Get role banner configuration
     * @returns {object|null} Banner config or null
     */
    getBanner() {
        const role = this.getCurrentRole();
        return role ? role.banner : null;
    }

    /**
     * Update store with role data
     * @param {string} roleId - Role ID
     */
    updateStoreRole(roleId) {
        const role = this.roles[roleId];
        
        if (role) {
            store.setState({
                currentRole: {
                    id: roleId,
                    name: role.name,
                    type: role.type,
                    icon: role.icon,
                    readOnly: role.readOnly || false,
                    navigation: role.navigation,
                    permissions: this.permissions[roleId] || []
                }
            });
        }
    }

    /**
     * Get role display name
     * @param {string} roleId - Role ID
     * @returns {string} Display name
     */
    getRoleDisplayName(roleId) {
        const role = this.roles[roleId];
        return role ? role.name : roleId;
    }

    /**
     * Get roles by category (for dropdown grouping)
     * Database can define role categories
     * @returns {object} Roles grouped by category
     */
    getRolesByCategory() {
        if (!this.roles) return {};

        const categorized = {
            'platform': [],
            'customer': []
        };

        Object.entries(this.roles).forEach(([id, role]) => {
            const category = id.startsWith('reabel_') ? 'platform' : 'customer';
            categorized[category].push({ id, ...role });
        });

        return categorized;
    }

    /**
     * Validate role switch is allowed
     * In production, this checks backend for allowed role transitions
     * @param {string} fromRole - Current role
     * @param {string} toRole - Target role
     * @returns {Promise<boolean>}
     */
    async canSwitchRole(fromRole, toRole) {
        // In demo mode, allow all switches
        if (APP_CONFIG.app.environment === 'demo') {
            return true;
        }

        // In production, call backend to validate
        try {
            const response = await apiService.fetch(
                `${APP_CONFIG.api.baseUrl}/roles/can-switch`,
                {
                    method: 'POST',
                    body: JSON.stringify({ fromRole, toRole })
                }
            );

            return response.success && response.data.allowed;

        } catch (error) {
            console.error('[RoleService] Error checking role switch permission:', error);
            return false;
        }
    }

    /**
     * Get role metadata (for UI display)
     * @param {string} roleId - Role ID
     * @returns {object} Metadata
     */
    getRoleMetadata(roleId) {
        const role = this.roles[roleId];
        
        if (!role) return null;

        return {
            id: roleId,
            name: role.name,
            type: role.type,
            icon: role.icon,
            description: role.description || '',
            readOnly: role.readOnly || false,
            color: role.color || '#48A9A6'
        };
    }

    /**
     * Reset to default role
     */
    resetToDefault() {
        this.switchRole(APP_CONFIG.ui.defaultRole);
    }
}

// Create singleton instance
const roleService = new RoleService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RoleService, roleService };
}
