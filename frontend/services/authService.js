/**
 * Authentication Service
 * Handles user authentication, session management
 */

class AuthService {
    constructor() {
        this.storageKey = APP_CONFIG.storage.prefix + APP_CONFIG.storage.keys.user;
        this.sessionKey = APP_CONFIG.storage.prefix + APP_CONFIG.storage.keys.session;
    }

    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise} Login result
     */
    async login(email, password) {
        try {
            // In demo mode, any credentials work
            if (APP_CONFIG.app.environment === 'demo') {
                return this.demoLogin(email);
            }

            // In real mode, call API
            const response = await apiService.fetch(`${APP_CONFIG.api.baseUrl}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                await this.handleLoginSuccess(response.data);
            }

            return response;

        } catch (error) {
            console.error('[Auth] Login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Demo login (accepts any credentials)
     * @param {string} email - User email
     * @returns {Promise} Login result
     */
    async demoLogin(email) {
        const demoUser = {
            id: '12345',
            email: email,
            name: this.extractNameFromEmail(email),
            role: store.get('currentRole.id') || 'customer_admin',
            avatar: null,
            company: 'Acme Corporation'
        };

        const session = {
            token: 'demo-token-' + Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };

        await this.handleLoginSuccess({ user: demoUser, session });

        return { success: true, data: { user: demoUser, session } };
    }

    /**
     * Handle successful login
     * @param {object} data - Login response data
     */
    async handleLoginSuccess(data) {
        const { user, session } = data;

        // Update store
        store.setState({
            user: {
                ...user,
                permissions: this.getRolePermissions(user.role)
            },
            session: {
                isAuthenticated: true,
                token: session.token,
                expiresAt: session.expiresAt
            }
        });

        // Save to localStorage
        this.saveToStorage('user', user);
        this.saveToStorage('session', session);

        // Emit login event
        eventBus.emit(EVENTS.USER_LOGGED_IN, user);

        console.log('[Auth] User logged in:', user.email);
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            // Call logout API if not in demo mode
            if (APP_CONFIG.app.environment !== 'demo') {
                await apiService.fetch(`${APP_CONFIG.api.baseUrl}/auth/logout`, {
                    method: 'POST'
                });
            }

            // Clear state
            store.setState({
                user: { id: null, email: null, name: null, role: null, permissions: [] },
                session: { isAuthenticated: false, token: null, expiresAt: null }
            });

            // Clear storage
            this.clearStorage();

            // Clear API cache
            apiService.clearCache();

            // Emit logout event
            eventBus.emit(EVENTS.USER_LOGGED_OUT);

            console.log('[Auth] User logged out');

            return { success: true };

        } catch (error) {
            console.error('[Auth] Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        const session = store.get('session');
        
        if (!session.isAuthenticated) {
            return false;
        }

        // Check if token is expired
        if (session.expiresAt && Date.now() > session.expiresAt) {
            console.log('[Auth] Session expired');
            this.logout();
            return false;
        }

        return true;
    }

    /**
     * Get current user
     * @returns {object|null} Current user
     */
    getCurrentUser() {
        return store.get('user');
    }

    /**
     * Check if user has permission
     * @param {string} permission - Permission to check
     * @returns {boolean}
     */
    hasPermission(permission) {
        const permissions = store.get('user.permissions') || [];
        return permissions.includes(permission);
    }

    /**
     * Get role permissions
     * @param {string} roleId - Role ID
     * @returns {array} Array of permissions
     */
    getRolePermissions(roleId) {
        const rolePermissions = {
            'reabel_superadmin': ['*'], // All permissions
            'reabel_csm': ['read:all', 'write:customer', 'manage:support'],
            'reabel_analyst': ['read:all'],
            'customer_admin': ['read:own', 'write:own', 'manage:team', 'manage:assessment'],
            'domain_manager': ['read:own', 'write:assigned', 'review:assigned'],
            'contributor': ['read:assigned', 'write:assigned'],
            'reviewer': ['read:all', 'review:all', 'approve:all'],
            'observer': ['read:all']
        };

        return rolePermissions[roleId] || [];
    }

    /**
     * Restore session from storage
     * @returns {Promise}
     */
    async restoreSession() {
        try {
            const user = this.loadFromStorage('user');
            const session = this.loadFromStorage('session');

            if (user && session) {
                // Check if session is still valid
                if (session.expiresAt && Date.now() < session.expiresAt) {
                    store.setState({
                        user: {
                            ...user,
                            permissions: this.getRolePermissions(user.role)
                        },
                        session: {
                            isAuthenticated: true,
                            ...session
                        }
                    });

                    console.log('[Auth] Session restored for:', user.email);
                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('[Auth] Error restoring session:', error);
            return false;
        }
    }

    /**
     * Extract name from email
     * @param {string} email - Email address
     * @returns {string} Name
     */
    extractNameFromEmail(email) {
        const username = email.split('@')[0];
        return username.split('.').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
        ).join(' ');
    }

    /**
     * Save to localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    saveToStorage(key, value) {
        try {
            const fullKey = APP_CONFIG.storage.prefix + key;
            localStorage.setItem(fullKey, JSON.stringify(value));
        } catch (error) {
            console.error('[Auth] Error saving to storage:', error);
        }
    }

    /**
     * Load from localStorage
     * @param {string} key - Storage key
     * @returns {*} Stored value
     */
    loadFromStorage(key) {
        try {
            const fullKey = APP_CONFIG.storage.prefix + key;
            const value = localStorage.getItem(fullKey);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('[Auth] Error loading from storage:', error);
            return null;
        }
    }

    /**
     * Clear storage
     */
    clearStorage() {
        try {
            Object.values(APP_CONFIG.storage.keys).forEach(key => {
                const fullKey = APP_CONFIG.storage.prefix + key;
                localStorage.removeItem(fullKey);
            });
        } catch (error) {
            console.error('[Auth] Error clearing storage:', error);
        }
    }
}

// Create singleton instance
const authService = new AuthService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthService, authService };
}
