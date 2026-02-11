/**
 * API Service
 * Abstraction layer for all data fetching
 * Switches between local JSON and remote API based on config
 */

class ApiService {
    constructor() {
        this.baseUrl = APP_CONFIG.api.baseUrl;
        this.timeout = APP_CONFIG.api.timeout;
        this.mode = APP_CONFIG.dataSources.mode;
        this.cache = new Map();
        this.pendingRequests = new Map();
    }

    /**
     * Generic fetch with error handling and retries
     * @param {string} url - URL to fetch
     * @param {object} options - Fetch options
     * @returns {Promise} Response data
     */
    async fetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };

        } catch (error) {
            clearTimeout(timeoutId);

            console.error(`[API] Error fetching ${url}:`, error);

            return {
                success: false,
                error: error.message,
                status: error.status || 500
            };
        }
    }

    /**
     * Get authentication headers
     * @returns {object} Headers with auth token
     */
    getAuthHeaders() {
        const token = store.get('session.token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    /**
     * Load data from local JSON or remote API
     * @param {string} resource - Resource name
     * @returns {Promise} Resource data
     */
    async load(resource) {
        // Check cache first
        if (this.cache.has(resource)) {
            console.log(`[API] Returning cached data for: ${resource}`);
            return this.cache.get(resource);
        }

        // Check if request is already pending
        if (this.pendingRequests.has(resource)) {
            console.log(`[API] Request already pending for: ${resource}`);
            return this.pendingRequests.get(resource);
        }

        // Create new request
        const request = this.mode === 'local' 
            ? this.loadLocal(resource)
            : this.loadRemote(resource);

        this.pendingRequests.set(resource, request);

        try {
            const result = await request;
            this.cache.set(resource, result);
            this.pendingRequests.delete(resource);

            // Emit data loaded event
            eventBus.emit(EVENTS.DATA_LOADED, { resource, data: result });

            return result;
        } catch (error) {
            this.pendingRequests.delete(resource);
            eventBus.emit(EVENTS.DATA_ERROR, { resource, error });
            throw error;
        }
    }

    /**
     * Load from local JSON file
     * @param {string} resource - Resource name
     * @returns {Promise} JSON data
     */
    async loadLocal(resource) {
        const basePath = APP_CONFIG.dataSources.local.basePath;
        const filename = APP_CONFIG.dataSources.local.files[resource];

        if (!filename) {
            throw new Error(`No local file configured for resource: ${resource}`);
        }

        const url = `${basePath}/${filename}`;
        console.log(`[API] Loading local file: ${url}`);

        const response = await this.fetch(url);

        if (!response.success) {
            throw new Error(response.error);
        }

        return response.data;
    }

    /**
     * Load from remote API
     * @param {string} resource - Resource name
     * @returns {Promise} API response data
     */
    async loadRemote(resource) {
        const endpoint = APP_CONFIG.api.endpoints[resource];

        if (!endpoint) {
            throw new Error(`No API endpoint configured for resource: ${resource}`);
        }

        const url = `${this.baseUrl}${endpoint}`;
        console.log(`[API] Loading from API: ${url}`);

        const response = await this.fetch(url);

        if (!response.success) {
            throw new Error(response.error);
        }

        return response.data;
    }

    /**
     * Save/update data
     * @param {string} resource - Resource name
     * @param {object} data - Data to save
     * @param {string} method - HTTP method (POST, PUT, PATCH)
     * @returns {Promise} Response
     */
    async save(resource, data, method = 'POST') {
        if (this.mode === 'local') {
            // In local mode, just update cache and emit event
            console.log(`[API] Local mode: Simulating ${method} for ${resource}`);
            this.cache.set(resource, data);
            eventBus.emit(EVENTS.DATA_UPDATED, { resource, data });
            return { success: true, data };
        }

        const endpoint = APP_CONFIG.api.endpoints[resource];
        const url = `${this.baseUrl}${endpoint}`;

        const response = await this.fetch(url, {
            method,
            body: JSON.stringify(data)
        });

        if (response.success) {
            // Invalidate cache
            this.cache.delete(resource);
            eventBus.emit(EVENTS.DATA_UPDATED, { resource, data: response.data });
        }

        return response;
    }

    /**
     * Delete data
     * @param {string} resource - Resource name
     * @param {string} id - Item ID
     * @returns {Promise} Response
     */
    async delete(resource, id) {
        if (this.mode === 'local') {
            console.log(`[API] Local mode: Simulating DELETE for ${resource}/${id}`);
            eventBus.emit(EVENTS.DATA_DELETED, { resource, id });
            return { success: true };
        }

        const endpoint = APP_CONFIG.api.endpoints[resource];
        const url = `${this.baseUrl}${endpoint}/${id}`;

        const response = await this.fetch(url, { method: 'DELETE' });

        if (response.success) {
            this.cache.delete(resource);
            eventBus.emit(EVENTS.DATA_DELETED, { resource, id });
        }

        return response;
    }

    /**
     * Clear cache
     * @param {string} resource - Optional specific resource to clear
     */
    clearCache(resource = null) {
        if (resource) {
            this.cache.delete(resource);
            console.log(`[API] Cache cleared for: ${resource}`);
        } else {
            this.cache.clear();
            console.log('[API] All cache cleared');
        }
    }

    /**
     * Get cache status
     * @returns {object} Cache statistics
     */
    getCacheStatus() {
        return {
            size: this.cache.size,
            resources: Array.from(this.cache.keys())
        };
    }
}

// Create singleton instance
const apiService = new ApiService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiService, apiService };
}
