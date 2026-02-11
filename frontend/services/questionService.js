/**
 * Question Service
 * Manages questions, responses, and answer validation
 * Supports multiple question types and scoring
 */

class QuestionService {
    constructor() {
        this.questions = null;
        this.responses = new Map();
        this.initialized = false;
    }

    /**
     * Initialize question service
     */
    async initialize() {
        try {
            console.log('[QuestionService] Initializing...');

            // Load questions bank from database
            const questionsData = await apiService.load('questions');
            this.questions = questionsData.questions || questionsData;

            this.initialized = true;
            console.log('[QuestionService] Loaded', this.questions.length, 'questions');
            return true;

        } catch (error) {
            console.error('[QuestionService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Get questions for specific dimension
     * @param {string} dimensionId - Dimension ID
     * @param {string} templateId - Template ID
     * @returns {array} Questions
     */
    getQuestionsByDimension(dimensionId, templateId = null) {
        if (!this.questions) return [];

        return this.questions.filter(q => {
            const dimensionMatch = q.dimension_id === dimensionId;
            const templateMatch = !templateId || q.template_id === templateId;
            return dimensionMatch && templateMatch;
        });
    }

    /**
     * Get question by ID
     * @param {string} questionId - Question ID
     * @returns {object|null} Question
     */
    getQuestion(questionId) {
        if (!this.questions) return null;
        return this.questions.find(q => q.id === questionId);
    }

    /**
     * Submit response to question
     * @param {string} assessmentId - Assessment ID
     * @param {string} questionId - Question ID
     * @param {object} responseData - Response data
     * @returns {Promise<object>} Saved response
     */
    async submitResponse(assessmentId, questionId, responseData) {
        try {
            const question = this.getQuestion(questionId);
            if (!question) {
                throw new Error('Question not found');
            }

            // Validate response
            this.validateResponse(question, responseData);

            // Calculate score if applicable
            const score = this.calculateScore(question, responseData);

            // Build response object
            const response = {
                id: this.generateId(),
                assessment_id: assessmentId,
                question_id: questionId,
                user_id: store.get('user.id'),
                response_text: responseData.text || null,
                response_data: responseData.data || null,
                score: score,
                status: 'submitted',
                submitted_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Save to database
            const result = await apiService.save('responses', response, 'POST');

            if (!result.success) {
                throw new Error(result.error || 'Failed to save response');
            }

            // Cache response
            this.responses.set(questionId, response);

            // Emit event
            eventBus.emit(EVENTS.QUESTION_ANSWERED, {
                assessmentId,
                questionId,
                response
            });

            return response;

        } catch (error) {
            console.error('[QuestionService] Submit failed:', error);
            throw error;
        }
    }

    /**
     * Save draft response
     * @param {string} assessmentId - Assessment ID
     * @param {string} questionId - Question ID
     * @param {object} responseData - Response data
     */
    async saveDraft(assessmentId, questionId, responseData) {
        try {
            const response = {
                id: this.generateId(),
                assessment_id: assessmentId,
                question_id: questionId,
                user_id: store.get('user.id'),
                response_text: responseData.text || null,
                response_data: responseData.data || null,
                status: 'draft',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await apiService.save('responses', response, 'POST');

            // Cache draft
            this.responses.set(questionId, response);

            console.log('[QuestionService] Draft saved');

        } catch (error) {
            console.error('[QuestionService] Save draft failed:', error);
        }
    }

    /**
     * Get response for question
     * @param {string} assessmentId - Assessment ID
     * @param {string} questionId - Question ID
     * @returns {Promise<object|null>} Response
     */
    async getResponse(assessmentId, questionId) {
        // Check cache
        if (this.responses.has(questionId)) {
            return this.responses.get(questionId);
        }

        // Load from database
        try {
            const result = await apiService.fetch(
                `${APP_CONFIG.api.baseUrl}/responses?assessment_id=${assessmentId}&question_id=${questionId}`
            );

            if (result.success && result.data.length > 0) {
                const response = result.data[0];
                this.responses.set(questionId, response);
                return response;
            }

            return null;

        } catch (error) {
            console.error('[QuestionService] Get response failed:', error);
            return null;
        }
    }

    /**
     * Review and approve/reject response
     * @param {string} responseId - Response ID
     * @param {object} reviewData - Review data
     * @returns {Promise<object>} Updated response
     */
    async reviewResponse(responseId, reviewData) {
        try {
            // Check review permission
            if (!roleService.hasPermission('review', 'responses')) {
                throw new Error('Permission denied: Cannot review responses');
            }

            const update = {
                status: reviewData.approved ? 'approved' : 'rejected',
                reviewer_id: store.get('user.id'),
                reviewer_comments: reviewData.comments || null,
                reviewed_at: new Date().toISOString(),
                score: reviewData.score || null
            };

            const result = await apiService.save(
                `responses/${responseId}`,
                update,
                'PUT'
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to update response');
            }

            eventBus.emit(reviewData.approved ? EVENTS.REVIEW_APPROVED : EVENTS.REVIEW_REJECTED, {
                responseId,
                reviewData
            });

            return result.data;

        } catch (error) {
            console.error('[QuestionService] Review failed:', error);
            throw error;
        }
    }

    /**
     * Validate response data
     * @param {object} question - Question object
     * @param {object} responseData - Response data
     */
    validateResponse(question, responseData) {
        // Required check
        if (question.is_required && !responseData.text && !responseData.data) {
            throw new Error('Response is required');
        }

        // Type-specific validation
        switch (question.question_type) {
            case 'text':
                this.validateTextResponse(question, responseData);
                break;
            
            case 'multiple_choice':
                this.validateMultipleChoiceResponse(question, responseData);
                break;
            
            case 'scale':
                this.validateScaleResponse(question, responseData);
                break;
            
            case 'matrix':
                this.validateMatrixResponse(question, responseData);
                break;
        }

        // Custom validation rules
        if (question.validation_rules) {
            this.applyCustomValidation(question.validation_rules, responseData);
        }
    }

    /**
     * Validate text response
     */
    validateTextResponse(question, responseData) {
        if (!responseData.text) return;

        const text = responseData.text;
        const rules = question.validation_rules || {};

        if (rules.min_length && text.length < rules.min_length) {
            throw new Error(`Response must be at least ${rules.min_length} characters`);
        }

        if (rules.max_length && text.length > rules.max_length) {
            throw new Error(`Response cannot exceed ${rules.max_length} characters`);
        }

        if (rules.pattern && !new RegExp(rules.pattern).test(text)) {
            throw new Error('Response format is invalid');
        }
    }

    /**
     * Validate multiple choice response
     */
    validateMultipleChoiceResponse(question, responseData) {
        if (!responseData.data || !responseData.data.selected) {
            throw new Error('Please select an option');
        }

        const selected = responseData.data.selected;
        const validOptions = question.options.map(o => o.id || o.value);

        if (Array.isArray(selected)) {
            // Multiple selection
            if (!selected.every(s => validOptions.includes(s))) {
                throw new Error('Invalid option selected');
            }
        } else {
            // Single selection
            if (!validOptions.includes(selected)) {
                throw new Error('Invalid option selected');
            }
        }
    }

    /**
     * Validate scale response
     */
    validateScaleResponse(question, responseData) {
        if (!responseData.data || typeof responseData.data.value !== 'number') {
            throw new Error('Please select a rating');
        }

        const value = responseData.data.value;
        const min = question.scale_min || 1;
        const max = question.scale_max || 5;

        if (value < min || value > max) {
            throw new Error(`Rating must be between ${min} and ${max}`);
        }
    }

    /**
     * Validate matrix response
     */
    validateMatrixResponse(question, responseData) {
        if (!responseData.data || !responseData.data.matrix) {
            throw new Error('Please complete all matrix items');
        }

        const matrix = responseData.data.matrix;
        const requiredRows = question.matrix_rows?.filter(r => r.required) || [];

        requiredRows.forEach(row => {
            if (!matrix[row.id]) {
                throw new Error(`Please answer: ${row.label}`);
            }
        });
    }

    /**
     * Apply custom validation rules
     */
    applyCustomValidation(rules, responseData) {
        if (rules.custom_validator) {
            // In production, this would execute server-side validation
            console.log('[QuestionService] Applying custom validation');
        }
    }

    /**
     * Calculate score for response
     * @param {object} question - Question object
     * @param {object} responseData - Response data
     * @returns {number|null} Score
     */
    calculateScore(question, responseData) {
        if (!question.scoring_rubric) return null;

        const rubric = question.scoring_rubric;

        switch (question.question_type) {
            case 'multiple_choice':
                return this.scoreMultipleChoice(rubric, responseData);
            
            case 'scale':
                return this.scoreScale(rubric, responseData);
            
            case 'matrix':
                return this.scoreMatrix(rubric, responseData);
            
            default:
                return null;
        }
    }

    /**
     * Score multiple choice response
     */
    scoreMultipleChoice(rubric, responseData) {
        const selected = responseData.data?.selected;
        if (!selected) return 0;

        // Find score for selected option
        const optionScore = rubric.options?.find(o => o.id === selected);
        return optionScore?.score || 0;
    }

    /**
     * Score scale response
     */
    scoreScale(rubric, responseData) {
        const value = responseData.data?.value;
        if (typeof value !== 'number') return 0;

        // Scale responses are typically 1-1 mapped to scores
        return rubric.direct_mapping ? value : (value / rubric.max_value) * rubric.max_score;
    }

    /**
     * Score matrix response
     */
    scoreMatrix(rubric, responseData) {
        const matrix = responseData.data?.matrix;
        if (!matrix) return 0;

        let totalScore = 0;
        let scoredItems = 0;

        Object.entries(matrix).forEach(([rowId, value]) => {
            const rowRubric = rubric.rows?.find(r => r.id === rowId);
            if (rowRubric) {
                const optionScore = rowRubric.options?.find(o => o.value === value);
                if (optionScore) {
                    totalScore += optionScore.score;
                    scoredItems++;
                }
            }
        });

        return scoredItems > 0 ? totalScore / scoredItems : 0;
    }

    /**
     * Get question progress for assessment
     * @param {string} assessmentId - Assessment ID
     * @param {string} dimensionId - Optional dimension filter
     * @returns {Promise<object>} Progress statistics
     */
    async getProgress(assessmentId, dimensionId = null) {
        try {
            const questions = dimensionId
                ? this.getQuestionsByDimension(dimensionId)
                : this.questions;

            const totalQuestions = questions.length;
            let answeredQuestions = 0;
            let approvedQuestions = 0;

            for (const question of questions) {
                const response = await this.getResponse(assessmentId, question.id);
                if (response) {
                    if (response.status === 'submitted' || response.status === 'approved') {
                        answeredQuestions++;
                    }
                    if (response.status === 'approved') {
                        approvedQuestions++;
                    }
                }
            }

            return {
                total: totalQuestions,
                answered: answeredQuestions,
                approved: approvedQuestions,
                pending: answeredQuestions - approvedQuestions,
                remaining: totalQuestions - answeredQuestions,
                percentage: Math.round((answeredQuestions / totalQuestions) * 100)
            };

        } catch (error) {
            console.error('[QuestionService] Get progress failed:', error);
            return { total: 0, answered: 0, approved: 0, pending: 0, remaining: 0, percentage: 0 };
        }
    }

    /**
     * Bulk import questions from template
     * @param {string} templateId - Template ID
     * @param {array} questions - Question definitions
     */
    async importQuestions(templateId, questions) {
        try {
            // Check permission
            if (!roleService.hasPermission('create', 'questions')) {
                throw new Error('Permission denied: Cannot create questions');
            }

            const imported = [];

            for (const questionData of questions) {
                const question = {
                    id: this.generateId(),
                    template_id: templateId,
                    ...questionData,
                    created_at: new Date().toISOString()
                };

                const result = await apiService.save('questions', question, 'POST');
                if (result.success) {
                    imported.push(question);
                }
            }

            console.log('[QuestionService] Imported', imported.length, 'questions');
            return imported;

        } catch (error) {
            console.error('[QuestionService] Import failed:', error);
            throw error;
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Create singleton instance
const questionService = new QuestionService();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuestionService, questionService };
}
