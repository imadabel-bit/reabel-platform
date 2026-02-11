/**
 * Configuration Service
 * Manages all dynamic configurations from database
 * Everything is configurable - no hardcoding
 */

class ConfigService {
    constructor() {
        this.configs = {
            ui: null,           // UI configurations
            workflows: null,    // Workflow definitions
            forms: null,        // Dynamic form schemas
            validations: null,  // Validation rules
            menus: null,        // Menu hierarchies
            features: null      // Feature flags
        };
        this.initialized = false;
    }

    /**
     * Initialize configuration service
     * Loads all configurations from database/JSON
     */
    async initialize() {
        try {
            console.log('[ConfigService] Loading configurations from database...');

            // Load all configuration files
            // In production, these come from database tables
            const [ui, workflows, forms, validations, menus, features] = await Promise.all([
                apiService.load('config_ui').catch(() => this.getDefaultUIConfig()),
                apiService.load('config_workflows').catch(() => this.getDefaultWorkflows()),
                apiService.load('config_forms').catch(() => this.getDefaultForms()),
                apiService.load('config_validations').catch(() => this.getDefaultValidations()),
                apiService.load('config_menus').catch(() => this.getDefaultMenus()),
                apiService.load('config_features').catch(() => this.getDefaultFeatures())
            ]);

            this.configs.ui = ui;
            this.configs.workflows = workflows;
            this.configs.forms = forms;
            this.configs.validations = validations;
            this.configs.menus = menus;
            this.configs.features = features;

            this.initialized = true;

            console.log('[ConfigService] All configurations loaded');
            eventBus.emit('config:loaded', this.configs);

            return true;

        } catch (error) {
            console.error('[ConfigService] Failed to load configurations:', error);
            return false;
        }
    }

    /**
     * Get UI configuration
     * Controls colors, themes, layouts, etc.
     * @param {string} key - Config key
     * @returns {*} Config value
     */
    getUIConfig(key) {
        if (!this.configs.ui) return null;
        return key ? this.configs.ui[key] : this.configs.ui;
    }

    /**
     * Get workflow definition
     * Defines state machines, transitions, validations
     * @param {string} workflowType - Type of workflow (assessment, question, etc.)
     * @returns {object} Workflow configuration
     */
    getWorkflow(workflowType) {
        if (!this.configs.workflows) return null;
        return this.configs.workflows[workflowType];
    }

    /**
     * Get form schema
     * Defines dynamic forms - fields, types, validations
     * @param {string} formName - Form identifier
     * @returns {object} Form schema
     */
    getFormSchema(formName) {
        if (!this.configs.forms) return null;
        return this.configs.forms[formName];
    }

    /**
     * Get validation rules
     * Dynamic validation rules from database
     * @param {string} entity - Entity type
     * @param {string} field - Field name
     * @returns {object} Validation rules
     */
    getValidationRules(entity, field) {
        if (!this.configs.validations) return null;
        
        const entityRules = this.configs.validations[entity];
        if (!entityRules) return null;

        return field ? entityRules[field] : entityRules;
    }

    /**
     * Get menu hierarchy
     * Dynamic menu structure from database
     * @param {string} menuId - Menu identifier
     * @returns {object} Menu structure
     */
    getMenu(menuId) {
        if (!this.configs.menus) return null;
        return this.configs.menus[menuId];
    }

    /**
     * Check if feature is enabled
     * Feature flags from database
     * @param {string} featureName - Feature identifier
     * @returns {boolean}
     */
    isFeatureEnabled(featureName) {
        if (!this.configs.features) return false;
        return this.configs.features[featureName] === true;
    }

    /**
     * Get all features
     * @returns {object} All feature flags
     */
    getAllFeatures() {
        return this.configs.features || {};
    }

    /**
     * Get field configuration for dynamic rendering
     * @param {string} entity - Entity type
     * @param {string} fieldName - Field name
     * @returns {object} Field configuration
     */
    getFieldConfig(entity, fieldName) {
        const formSchema = this.getFormSchema(entity);
        if (!formSchema || !formSchema.fields) return null;

        return formSchema.fields.find(f => f.name === fieldName);
    }

    /**
     * Get workflow states for an entity
     * @param {string} workflowType - Workflow type
     * @returns {array} Available states
     */
    getWorkflowStates(workflowType) {
        const workflow = this.getWorkflow(workflowType);
        return workflow ? workflow.states : [];
    }

    /**
     * Get allowed transitions from current state
     * @param {string} workflowType - Workflow type
     * @param {string} currentState - Current state
     * @param {string} roleId - User's role
     * @returns {array} Allowed transitions
     */
    getAllowedTransitions(workflowType, currentState, roleId) {
        const workflow = this.getWorkflow(workflowType);
        if (!workflow || !workflow.transitions) return [];

        const stateTransitions = workflow.transitions[currentState] || [];

        // Filter by role permissions
        return stateTransitions.filter(transition => {
            return !transition.roles || transition.roles.includes(roleId);
        });
    }

    /**
     * Validate transition is allowed
     * @param {string} workflowType - Workflow type
     * @param {string} fromState - Current state
     * @param {string} toState - Target state
     * @param {string} roleId - User's role
     * @returns {boolean}
     */
    canTransition(workflowType, fromState, toState, roleId) {
        const allowedTransitions = this.getAllowedTransitions(workflowType, fromState, roleId);
        return allowedTransitions.some(t => t.to === toState);
    }

    /**
     * Get default UI config (fallback)
     */
    getDefaultUIConfig() {
        return {
            theme: 'default',
            primaryColor: '#48A9A6',
            secondaryColor: '#667eea',
            pageSize: 20,
            dateFormat: 'YYYY-MM-DD',
            timeFormat: 'HH:mm',
            language: 'en'
        };
    }

    /**
     * Get default workflows (fallback)
     */
    getDefaultWorkflows() {
        return {
            assessment: {
                states: ['draft', 'active', 'in_review', 'approved', 'published', 'archived'],
                initialState: 'draft',
                transitions: {
                    draft: [
                        { to: 'active', label: 'Activate', roles: ['customer_admin', 'domain_manager'] }
                    ],
                    active: [
                        { to: 'in_review', label: 'Submit for Review', roles: ['contributor', 'domain_manager'] },
                        { to: 'archived', label: 'Archive', roles: ['customer_admin'] }
                    ],
                    in_review: [
                        { to: 'approved', label: 'Approve', roles: ['reviewer', 'customer_admin'] },
                        { to: 'active', label: 'Reject', roles: ['reviewer', 'customer_admin'] }
                    ],
                    approved: [
                        { to: 'published', label: 'Publish', roles: ['customer_admin'] }
                    ]
                }
            }
        };
    }

    /**
     * Get default forms (fallback)
     */
    getDefaultForms() {
        return {
            assessment: {
                fields: [
                    {
                        name: 'title',
                        type: 'text',
                        label: 'Assessment Title',
                        required: true,
                        maxLength: 200
                    },
                    {
                        name: 'description',
                        type: 'textarea',
                        label: 'Description',
                        required: false,
                        rows: 4
                    },
                    {
                        name: 'template_id',
                        type: 'select',
                        label: 'Template',
                        required: true,
                        options: 'templates' // Dynamic from API
                    }
                ]
            }
        };
    }

    /**
     * Get default validations (fallback)
     */
    getDefaultValidations() {
        return {
            assessment: {
                title: {
                    required: true,
                    minLength: 3,
                    maxLength: 200,
                    pattern: '^[a-zA-Z0-9\\s-]+$'
                },
                description: {
                    maxLength: 1000
                }
            }
        };
    }

    /**
     * Get default menus (fallback)
     */
    getDefaultMenus() {
        return {
            main: [
                { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '02_dashboard.html' },
                { id: 'assessments', label: 'Assessments', icon: 'file-text', href: '03_templates.html' }
            ]
        };
    }

    /**
     * Get default features (fallback)
     */
    getDefaultFeatures() {
        return {
            collaboration: true,
            comments: true,
            attachments: true,
            notifications: true,
            analytics: true,
            export: true
        };
    }

    /**
     * Refresh specific configuration
     * @param {string} configType - Type of config to refresh
     */
    async refreshConfig(configType) {
        try {
            console.log(`[ConfigService] Refreshing ${configType} configuration...`);
            
            const data = await apiService.load(`config_${configType}`);
            this.configs[configType] = data;

            eventBus.emit('config:refreshed', { type: configType, data });

            return true;

        } catch (error) {
            console.error(`[ConfigService] Failed to refresh ${configType}:`, error);
            return false;
        }
    }

    /**
     * Refresh all configurations
     */
    async refreshAll() {
        return await this.initialize();
    }
}

// Create singleton instance
const configService = new ConfigService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigService, configService };
}
