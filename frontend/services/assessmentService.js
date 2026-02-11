/**
 * Assessment Service
 * Manages complete assessment lifecycle for strategic evaluations
 * Database-driven with workflow engine integration
 * Supports multi-dimensional strategic frameworks
 */

class AssessmentService {
    constructor() {
        this.assessments = null;
        this.templates = null;
        this.currentAssessment = null;
        this.initialized = false;
        this.cache = new Map();
    }

    /**
     * Initialize assessment service
     * Loads templates and configurations from database
     */
    async initialize() {
        try {
            console.log('[AssessmentService] Initializing strategic assessment engine...');

            // Load assessment templates from database
            const templatesData = await apiService.load('templates');
            this.templates = templatesData.templates || templatesData;

            // Load user's assessments
            await this.loadUserAssessments();

            this.initialized = true;
            eventBus.emit('assessment:initialized', { 
                templateCount: this.templates.length 
            });

            console.log('[AssessmentService] Initialized with', this.templates.length, 'templates');
            return true;

        } catch (error) {
            console.error('[AssessmentService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Load user's assessments based on role and permissions
     * Implements row-level security
     */
    async loadUserAssessments() {
        try {
            const role = roleService.getCurrentRole();
            const user = store.get('user');

            // Build filter based on role
            const filter = this.buildDataFilter(role.id, user.id);

            // Load assessments from database/API
            const assessmentsData = await apiService.load('assessments');
            
            // Apply client-side filtering (in production, this is server-side)
            this.assessments = this.filterAssessmentsByPermissions(
                assessmentsData.assessments || assessmentsData,
                filter
            );

            console.log('[AssessmentService] Loaded', this.assessments.length, 'assessments');
            return this.assessments;

        } catch (error) {
            console.error('[AssessmentService] Failed to load assessments:', error);
            return [];
        }
    }

    /**
     * Build data filter based on role permissions
     * Implements database-driven row-level security
     * @param {string} roleId - User's role ID
     * @param {string} userId - User ID
     * @returns {object} Filter configuration
     */
    buildDataFilter(roleId, userId) {
        // Get data filter rules from permissions configuration
        const permissionsData = store.get('data.permissions');
        if (!permissionsData || !permissionsData.data_filters) {
            return { scope: 'all' };
        }

        const filter = permissionsData.data_filters.assessments[roleId];

        switch (filter) {
            case 'all':
                return { scope: 'all' };
            
            case 'all_customers':
                return { scope: 'tenant', excludeSelf: false };
            
            case 'own_company':
                return { scope: 'tenant', userId: userId };
            
            case 'assigned_domains':
                return { scope: 'domain', userId: userId };
            
            case 'assigned_only':
                return { scope: 'assigned', userId: userId };
            
            case 'pending_review':
                return { scope: 'review', reviewerId: userId };
            
            default:
                return { scope: 'none' };
        }
    }

    /**
     * Filter assessments based on permissions
     * @param {array} assessments - All assessments
     * @param {object} filter - Filter configuration
     * @returns {array} Filtered assessments
     */
    filterAssessmentsByPermissions(assessments, filter) {
        if (filter.scope === 'all') {
            return assessments;
        }

        if (filter.scope === 'none') {
            return [];
        }

        return assessments.filter(assessment => {
            switch (filter.scope) {
                case 'tenant':
                    return assessment.tenant_id === store.get('user.tenant_id');
                
                case 'assigned':
                    return assessment.assigned_to?.includes(filter.userId);
                
                case 'domain':
                    return assessment.assigned_domains?.some(d => 
                        store.get('user.assigned_domains')?.includes(d)
                    );
                
                case 'review':
                    return assessment.status === 'in_review' && 
                           assessment.reviewers?.includes(filter.reviewerId);
                
                default:
                    return false;
            }
        });
    }

    /**
     * Create new strategic assessment
     * @param {object} data - Assessment data
     * @returns {Promise<object>} Created assessment
     */
    async createAssessment(data) {
        try {
            console.log('[AssessmentService] Creating assessment:', data.title);

            // Validate required fields
            this.validateAssessmentData(data);

            // Check create permission
            if (!roleService.hasPermission('create', 'assessments')) {
                throw new Error('Permission denied: Cannot create assessments');
            }

            // Get template configuration
            const template = this.getTemplate(data.template_id);
            if (!template) {
                throw new Error('Template not found');
            }

            // Get workflow configuration
            const workflow = configService.getWorkflow('assessment');
            
            // Build complete assessment object
            const assessment = {
                id: this.generateId(),
                title: data.title,
                description: data.description || '',
                template_id: data.template_id,
                template_name: template.name,
                tenant_id: store.get('user.tenant_id'),
                created_by: store.get('user.id'),
                created_by_name: store.get('user.name'),
                status: workflow.initialState,
                progress: 0,
                dimensions: this.initializeDimensions(template),
                metadata: {
                    framework: template.framework || 'custom',
                    scope: data.scope || 'company',
                    priority: data.priority || 'medium',
                    tags: data.tags || []
                },
                started_at: new Date().toISOString(),
                due_date: data.due_date || null,
                completed_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Save to database/API
            const response = await apiService.save('assessments', assessment, 'POST');

            if (!response.success) {
                throw new Error(response.error || 'Failed to create assessment');
            }

            // Add to local cache
            if (!this.assessments) this.assessments = [];
            this.assessments.push(assessment);

            // Emit event
            eventBus.emit(EVENTS.ASSESSMENT_CREATED, assessment);

            // Show notification
            eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
                type: 'success',
                message: `Assessment "${assessment.title}" created successfully`
            });

            console.log('[AssessmentService] Assessment created:', assessment.id);
            return assessment;

        } catch (error) {
            console.error('[AssessmentService] Create failed:', error);
            
            eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
                type: 'error',
                message: error.message
            });

            throw error;
        }
    }

    /**
     * Initialize dimensions for new assessment
     * @param {object} template - Assessment template
     * @returns {array} Dimension objects
     */
    initializeDimensions(template) {
        if (!template.dimensions) return [];

        return template.dimensions.map(dim => ({
            id: dim.id,
            name: dim.name,
            description: dim.description,
            weight: dim.weight || 1.0,
            score: null,
            max_score: dim.max_score || 5,
            percentage: null,
            status: 'not_started',
            questions_total: dim.questions?.length || 0,
            questions_answered: 0,
            assigned_to: null,
            color: dim.color || '#48A9A6',
            icon: dim.icon || 'target'
        }));
    }

    /**
     * Update assessment
     * @param {string} assessmentId - Assessment ID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>} Updated assessment
     */
    async updateAssessment(assessmentId, updates) {
        try {
            console.log('[AssessmentService] Updating assessment:', assessmentId);

            const assessment = await this.getAssessment(assessmentId);
            if (!assessment) {
                throw new Error('Assessment not found');
            }

            // Check update permission
            if (!this.canUpdate(assessment)) {
                throw new Error('Permission denied: Cannot update this assessment');
            }

            // Merge updates
            const updated = {
                ...assessment,
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Save to database
            const response = await apiService.save(
                `assessments/${assessmentId}`, 
                updated, 
                'PUT'
            );

            if (!response.success) {
                throw new Error(response.error || 'Failed to update assessment');
            }

            // Update cache
            const index = this.assessments.findIndex(a => a.id === assessmentId);
            if (index !== -1) {
                this.assessments[index] = updated;
            }

            // Emit event
            eventBus.emit(EVENTS.ASSESSMENT_UPDATED, updated);

            console.log('[AssessmentService] Assessment updated');
            return updated;

        } catch (error) {
            console.error('[AssessmentService] Update failed:', error);
            throw error;
        }
    }

    /**
     * Transition assessment to new state
     * Implements workflow engine
     * @param {string} assessmentId - Assessment ID
     * @param {string} newState - Target state
     * @returns {Promise<object>} Updated assessment
     */
    async transitionState(assessmentId, newState) {
        try {
            const assessment = await this.getAssessment(assessmentId);
            const currentState = assessment.status;
            const roleId = roleService.currentRole;

            // Check if transition is allowed
            const canTransition = configService.canTransition(
                'assessment',
                currentState,
                newState,
                roleId
            );

            if (!canTransition) {
                throw new Error(`Cannot transition from ${currentState} to ${newState}`);
            }

            // Perform transition
            const updated = await this.updateAssessment(assessmentId, {
                status: newState,
                [`${newState}_at`]: new Date().toISOString(),
                [`${newState}_by`]: store.get('user.id')
            });

            // Trigger post-transition actions
            await this.executePostTransitionActions(assessment, currentState, newState);

            eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
                type: 'success',
                message: `Assessment moved to ${newState}`
            });

            return updated;

        } catch (error) {
            console.error('[AssessmentService] State transition failed:', error);
            throw error;
        }
    }

    /**
     * Execute post-transition actions
     * @param {object} assessment - Assessment object
     * @param {string} fromState - Previous state
     * @param {string} toState - New state
     */
    async executePostTransitionActions(assessment, fromState, toState) {
        // Get transition configuration
        const workflow = configService.getWorkflow('assessment');
        const transition = workflow.transitions?.[fromState]?.find(t => t.to === toState);

        if (!transition?.post_actions) return;

        // Execute each post-action
        for (const action of transition.post_actions) {
            try {
                switch (action.type) {
                    case 'notify':
                        await this.sendNotification(assessment, action.config);
                        break;
                    
                    case 'assign':
                        await this.autoAssign(assessment, action.config);
                        break;
                    
                    case 'calculate_score':
                        await this.calculateScores(assessment.id);
                        break;
                    
                    case 'create_action_items':
                        await this.generateActionItems(assessment);
                        break;
                }
            } catch (error) {
                console.error('[AssessmentService] Post-action failed:', action.type, error);
            }
        }
    }

    /**
     * Calculate assessment scores
     * Aggregates dimension scores with weights
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<object>} Score data
     */
    async calculateScores(assessmentId) {
        try {
            const assessment = await this.getAssessment(assessmentId);
            
            let totalWeightedScore = 0;
            let totalWeight = 0;
            let completedDimensions = 0;

            // Calculate dimension scores
            const dimensionScores = assessment.dimensions.map(dim => {
                if (dim.score !== null) {
                    const percentage = (dim.score / dim.max_score) * 100;
                    totalWeightedScore += percentage * dim.weight;
                    totalWeight += dim.weight;
                    completedDimensions++;

                    return {
                        dimension_id: dim.id,
                        dimension_name: dim.name,
                        score: dim.score,
                        max_score: dim.max_score,
                        percentage: percentage,
                        weight: dim.weight
                    };
                }
                return null;
            }).filter(Boolean);

            // Calculate overall score
            const overallScore = totalWeight > 0 
                ? totalWeightedScore / totalWeight 
                : 0;

            // Calculate progress
            const progress = (completedDimensions / assessment.dimensions.length) * 100;

            // Update assessment
            await this.updateAssessment(assessmentId, {
                progress: Math.round(progress),
                overall_score: Math.round(overallScore * 10) / 10,
                dimension_scores: dimensionScores
            });

            return {
                overall_score: overallScore,
                dimension_scores: dimensionScores,
                progress: progress
            };

        } catch (error) {
            console.error('[AssessmentService] Score calculation failed:', error);
            throw error;
        }
    }

    /**
     * Assign assessment to users
     * @param {string} assessmentId - Assessment ID
     * @param {array} assignments - Assignment configurations
     */
    async assignAssessment(assessmentId, assignments) {
        try {
            // Check assign permission
            if (!roleService.hasPermission('assign', 'assessments')) {
                throw new Error('Permission denied: Cannot assign assessments');
            }

            const assessment = await this.getAssessment(assessmentId);

            // Process each assignment
            for (const assignment of assignments) {
                const assignmentRecord = {
                    assessment_id: assessmentId,
                    user_id: assignment.user_id,
                    dimension_ids: assignment.dimension_ids || null,
                    assigned_by: store.get('user.id'),
                    assigned_at: new Date().toISOString(),
                    due_date: assignment.due_date || null,
                    status: 'pending'
                };

                await apiService.save('assessment_assignments', assignmentRecord, 'POST');

                // Send notification
                await this.sendAssignmentNotification(assessment, assignment);
            }

            eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
                type: 'success',
                message: `Assessment assigned to ${assignments.length} user(s)`
            });

        } catch (error) {
            console.error('[AssessmentService] Assignment failed:', error);
            throw error;
        }
    }

    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<object>} Assessment object
     */
    async getAssessment(assessmentId) {
        // Check cache first
        if (this.cache.has(assessmentId)) {
            return this.cache.get(assessmentId);
        }

        // Load from database
        if (this.assessments) {
            const assessment = this.assessments.find(a => a.id === assessmentId);
            if (assessment) {
                this.cache.set(assessmentId, assessment);
                return assessment;
            }
        }

        // Fetch from API
        const response = await apiService.fetch(
            `${APP_CONFIG.api.baseUrl}/assessments/${assessmentId}`
        );

        if (response.success) {
            this.cache.set(assessmentId, response.data);
            return response.data;
        }

        return null;
    }

    /**
     * Get all assessments for current user
     * Filtered by role permissions
     * @param {object} filters - Additional filters
     * @returns {array} Assessments
     */
    getAssessments(filters = {}) {
        if (!this.assessments) return [];

        let filtered = [...this.assessments];

        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(a => a.status === filters.status);
        }

        // Apply template filter
        if (filters.template_id) {
            filtered = filtered.filter(a => a.template_id === filters.template_id);
        }

        // Apply search
        if (filters.search) {
            const query = filters.search.toLowerCase();
            filtered = filtered.filter(a => 
                a.title.toLowerCase().includes(query) ||
                a.description.toLowerCase().includes(query)
            );
        }

        // Apply sorting
        if (filters.sortBy) {
            filtered.sort((a, b) => {
                const aVal = a[filters.sortBy];
                const bVal = b[filters.sortBy];
                return filters.sortOrder === 'desc' 
                    ? (bVal > aVal ? 1 : -1)
                    : (aVal > bVal ? 1 : -1);
            });
        }

        return filtered;
    }

    /**
     * Get assessment templates
     * @returns {array} Templates
     */
    getTemplates() {
        return this.templates || [];
    }

    /**
     * Get template by ID
     * @param {string} templateId - Template ID
     * @returns {object|null} Template
     */
    getTemplate(templateId) {
        if (!this.templates) return null;
        return this.templates.find(t => t.id === templateId);
    }

    /**
     * Check if user can update assessment
     * @param {object} assessment - Assessment object
     * @returns {boolean}
     */
    canUpdate(assessment) {
        const roleId = roleService.currentRole;
        const userId = store.get('user.id');

        // Check write permission
        if (!roleService.hasPermission('write', 'assessments')) {
            return false;
        }

        // Check if user is creator or assigned
        if (assessment.created_by === userId) return true;
        if (assessment.assigned_to?.includes(userId)) return true;

        // Check role-based permissions
        if (roleId === 'customer_admin' || roleId === 'reabel_superadmin') {
            return true;
        }

        return false;
    }

    /**
     * Delete assessment
     * @param {string} assessmentId - Assessment ID
     */
    async deleteAssessment(assessmentId) {
        try {
            // Check delete permission
            if (!roleService.hasPermission('delete', 'assessments')) {
                throw new Error('Permission denied: Cannot delete assessments');
            }

            const assessment = await this.getAssessment(assessmentId);

            await apiService.delete('assessments', assessmentId);

            // Remove from cache
            this.assessments = this.assessments.filter(a => a.id !== assessmentId);
            this.cache.delete(assessmentId);

            eventBus.emit(EVENTS.DATA_DELETED, { 
                resource: 'assessment', 
                id: assessmentId 
            });

            eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
                type: 'success',
                message: `Assessment "${assessment.title}" deleted`
            });

        } catch (error) {
            console.error('[AssessmentService] Delete failed:', error);
            throw error;
        }
    }

    /**
     * Export assessment data
     * @param {string} assessmentId - Assessment ID
     * @param {string} format - Export format (json, csv, pdf)
     * @returns {Promise<Blob>} Export file
     */
    async exportAssessment(assessmentId, format = 'json') {
        try {
            // Check export permission
            if (!roleService.hasPermission('export', 'assessments')) {
                throw new Error('Permission denied: Cannot export assessments');
            }

            const assessment = await this.getAssessment(assessmentId);

            // In production, this calls backend export API
            // For now, return JSON
            const exportData = {
                assessment: assessment,
                exported_at: new Date().toISOString(),
                exported_by: store.get('user.name')
            };

            const blob = new Blob(
                [JSON.stringify(exportData, null, 2)], 
                { type: 'application/json' }
            );

            return blob;

        } catch (error) {
            console.error('[AssessmentService] Export failed:', error);
            throw error;
        }
    }

    /**
     * Validate assessment data
     * @param {object} data - Assessment data
     */
    validateAssessmentData(data) {
        const rules = configService.getValidationRules('assessment');
        
        if (!data.title || data.title.length < 3) {
            throw new Error('Title must be at least 3 characters');
        }

        if (!data.template_id) {
            throw new Error('Template is required');
        }

        // Additional validations from database config
        if (rules) {
            // Validate each field against rules
            Object.keys(rules).forEach(field => {
                const value = data[field];
                const fieldRules = rules[field];

                if (fieldRules.required && !value) {
                    throw new Error(`${field} is required`);
                }

                if (fieldRules.minLength && value.length < fieldRules.minLength) {
                    throw new Error(`${field} must be at least ${fieldRules.minLength} characters`);
                }

                if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
                    throw new Error(`${field} must not exceed ${fieldRules.maxLength} characters`);
                }
            });
        }
    }

    /**
     * Generate unique ID
     * @returns {string} UUID
     */
    generateId() {
        return 'assess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Send notification (placeholder for notification service)
     */
    async sendNotification(assessment, config) {
        console.log('[AssessmentService] Sending notification for assessment:', assessment.id);
        // Will be implemented in NotificationService
    }

    /**
     * Send assignment notification
     */
    async sendAssignmentNotification(assessment, assignment) {
        console.log('[AssessmentService] Sending assignment notification');
        // Will be implemented in NotificationService
    }

    /**
     * Auto-assign based on rules
     */
    async autoAssign(assessment, config) {
        console.log('[AssessmentService] Auto-assigning based on rules');
        // Implement auto-assignment logic
    }

    /**
     * Generate action items from assessment results
     */
    async generateActionItems(assessment) {
        console.log('[AssessmentService] Generating action items for assessment:', assessment.id);
        // Will be implemented in future
    }
}

// Create singleton instance
const assessmentService = new AssessmentService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssessmentService, assessmentService };
}
