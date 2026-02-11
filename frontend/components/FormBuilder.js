/**
 * Form Builder Component
 * Dynamically generates forms from database schema
 * Supports validation, conditional fields, and multiple field types
 */

class FormBuilder extends Component {
    constructor(props = {}) {
        super(props);
        
        this.state = {
            schema: props.schema || {},
            values: props.values || {},
            errors: {},
            touched: {},
            submitting: false
        };
    }

    /**
     * Set form values
     */
    setValues(values) {
        this.setState({ values: { ...this.state.values, ...values } });
    }

    /**
     * Handle field change
     */
    handleChange(fieldName, value) {
        const newValues = { ...this.state.values, [fieldName]: value };
        this.setState({ 
            values: newValues,
            touched: { ...this.state.touched, [fieldName]: true }
        });

        // Validate field
        this.validateField(fieldName, value);

        // Call onChange callback if provided
        if (this.props.onChange) {
            this.props.onChange(fieldName, value, newValues);
        }
    }

    /**
     * Validate single field
     */
    validateField(fieldName, value) {
        const field = this.getField(fieldName);
        if (!field) return;

        const error = this.getFieldError(field, value);
        
        this.setState({
            errors: {
                ...this.state.errors,
                [fieldName]: error
            }
        });

        return !error;
    }

    /**
     * Get field error message
     */
    getFieldError(field, value) {
        // Required validation
        if (field.required && (!value || value === '')) {
            return `${field.label} is required`;
        }

        // Min length
        if (field.minLength && value && value.length < field.minLength) {
            return `${field.label} must be at least ${field.minLength} characters`;
        }

        // Max length
        if (field.maxLength && value && value.length > field.maxLength) {
            return `${field.label} must not exceed ${field.maxLength} characters`;
        }

        // Pattern
        if (field.pattern && value && !new RegExp(field.pattern).test(value)) {
            return field.patternMessage || `${field.label} format is invalid`;
        }

        // Custom validator
        if (field.validator && value) {
            const customError = field.validator(value, this.state.values);
            if (customError) return customError;
        }

        return null;
    }

    /**
     * Validate entire form
     */
    validate() {
        const errors = {};
        let isValid = true;

        this.state.schema.fields?.forEach(field => {
            const value = this.state.values[field.name];
            const error = this.getFieldError(field, value);
            
            if (error) {
                errors[field.name] = error;
                isValid = false;
            }
        });

        this.setState({ errors, touched: this.getTouchedAll() });

        return isValid;
    }

    /**
     * Get all fields as touched
     */
    getTouchedAll() {
        const touched = {};
        this.state.schema.fields?.forEach(field => {
            touched[field.name] = true;
        });
        return touched;
    }

    /**
     * Handle form submit
     */
    async handleSubmit(event) {
        if (event) {
            event.preventDefault();
        }

        if (!this.validate()) {
            notificationService.error('Please fix the errors in the form');
            return;
        }

        this.setState({ submitting: true });

        try {
            if (this.props.onSubmit) {
                await this.props.onSubmit(this.state.values);
            }
        } catch (error) {
            console.error('[FormBuilder] Submit error:', error);
            notificationService.error(error.message || 'Form submission failed');
        } finally {
            this.setState({ submitting: false });
        }
    }

    /**
     * Reset form
     */
    reset() {
        this.setState({
            values: {},
            errors: {},
            touched: {},
            submitting: false
        });
    }

    /**
     * Get field from schema
     */
    getField(fieldName) {
        return this.state.schema.fields?.find(f => f.name === fieldName);
    }

    /**
     * Render template
     */
    template() {
        const { schema } = this.state;

        return `
            <form class="form-builder" onsubmit="formBuilderComponent.handleSubmit(event); return false;">
                ${schema.title ? `<h2 class="form-title">${schema.title}</h2>` : ''}
                ${schema.description ? `<p class="form-description">${schema.description}</p>` : ''}
                ${this.renderFields()}
                ${this.renderActions()}
            </form>
        `;
    }

    /**
     * Render form fields
     */
    renderFields() {
        const { schema } = this.state;
        if (!schema.fields) return '';

        // Group fields if specified
        if (schema.groups) {
            return schema.groups.map(group => this.renderGroup(group)).join('');
        }

        // Render fields without grouping
        return schema.fields.map(field => this.renderField(field)).join('');
    }

    /**
     * Render field group
     */
    renderGroup(group) {
        const fields = this.state.schema.fields.filter(f => f.group === group.id);

        return `
            <div class="form-group-section">
                <h3 class="form-group-title">${group.label}</h3>
                ${fields.map(field => this.renderField(field)).join('')}
            </div>
        `;
    }

    /**
     * Render single field
     */
    renderField(field) {
        const value = this.state.values[field.name] || '';
        const error = this.state.errors[field.name];
        const touched = this.state.touched[field.name];
        const showError = touched && error;

        // Check if field should be visible (conditional rendering)
        if (field.condition && !this.evaluateCondition(field.condition)) {
            return '';
        }

        return `
            <div class="form-group ${showError ? 'has-error' : ''}">
                <label class="form-label">
                    ${field.label}
                    ${field.required ? '<span class="required">*</span>' : ''}
                </label>
                ${this.renderFieldInput(field, value)}
                ${field.helpText ? `<small class="form-help">${field.helpText}</small>` : ''}
                ${showError ? `<div class="form-error">${error}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render field input based on type
     */
    renderFieldInput(field, value) {
        switch (field.type) {
            case 'text':
            case 'email':
            case 'password':
            case 'number':
            case 'date':
            case 'time':
                return this.renderTextInput(field, value);
            
            case 'textarea':
                return this.renderTextarea(field, value);
            
            case 'select':
                return this.renderSelect(field, value);
            
            case 'radio':
                return this.renderRadio(field, value);
            
            case 'checkbox':
                return this.renderCheckbox(field, value);
            
            case 'file':
                return this.renderFileInput(field, value);
            
            default:
                return this.renderTextInput(field, value);
        }
    }

    /**
     * Render text input
     */
    renderTextInput(field, value) {
        return `
            <input type="${field.type || 'text'}"
                   class="form-control"
                   name="${field.name}"
                   value="${value}"
                   placeholder="${field.placeholder || ''}"
                   ${field.required ? 'required' : ''}
                   ${field.readonly ? 'readonly' : ''}
                   ${field.disabled ? 'disabled' : ''}
                   oninput="formBuilderComponent.handleChange('${field.name}', this.value)">
        `;
    }

    /**
     * Render textarea
     */
    renderTextarea(field, value) {
        return `
            <textarea class="form-control"
                      name="${field.name}"
                      rows="${field.rows || 4}"
                      placeholder="${field.placeholder || ''}"
                      ${field.required ? 'required' : ''}
                      ${field.readonly ? 'readonly' : ''}
                      ${field.disabled ? 'disabled' : ''}
                      oninput="formBuilderComponent.handleChange('${field.name}', this.value)">${value}</textarea>
        `;
    }

    /**
     * Render select dropdown
     */
    renderSelect(field, value) {
        const options = field.options || [];

        return `
            <select class="form-control"
                    name="${field.name}"
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                    onchange="formBuilderComponent.handleChange('${field.name}', this.value)">
                <option value="">Select ${field.label}</option>
                ${options.map(opt => `
                    <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                        ${opt.label}
                    </option>
                `).join('')}
            </select>
        `;
    }

    /**
     * Render radio buttons
     */
    renderRadio(field, value) {
        const options = field.options || [];

        return options.map(opt => `
            <label class="form-radio">
                <input type="radio"
                       name="${field.name}"
                       value="${opt.value}"
                       ${value === opt.value ? 'checked' : ''}
                       onchange="formBuilderComponent.handleChange('${field.name}', this.value)">
                <span>${opt.label}</span>
            </label>
        `).join('');
    }

    /**
     * Render checkbox
     */
    renderCheckbox(field, value) {
        return `
            <label class="form-checkbox">
                <input type="checkbox"
                       name="${field.name}"
                       ${value ? 'checked' : ''}
                       onchange="formBuilderComponent.handleChange('${field.name}', this.checked)">
                <span>${field.checkboxLabel || field.label}</span>
            </label>
        `;
    }

    /**
     * Render file input
     */
    renderFileInput(field, value) {
        return `
            <input type="file"
                   class="form-control"
                   name="${field.name}"
                   ${field.accept ? `accept="${field.accept}"` : ''}
                   ${field.multiple ? 'multiple' : ''}
                   onchange="formBuilderComponent.handleFileChange('${field.name}', this.files)">
        `;
    }

    /**
     * Handle file change
     */
    handleFileChange(fieldName, files) {
        this.handleChange(fieldName, files[0]);
    }

    /**
     * Render form actions
     */
    renderActions() {
        const { submitting } = this.state;

        return `
            <div class="form-actions">
                ${this.props.showCancel !== false ? `
                    <button type="button" 
                            class="btn btn-secondary"
                            onclick="formBuilderComponent.handleCancel()">
                        Cancel
                    </button>
                ` : ''}
                <button type="submit" 
                        class="btn btn-primary"
                        ${submitting ? 'disabled' : ''}>
                    ${submitting ? 'Submitting...' : (this.props.submitLabel || 'Submit')}
                </button>
            </div>
        `;
    }

    /**
     * Handle cancel
     */
    handleCancel() {
        if (this.props.onCancel) {
            this.props.onCancel();
        } else {
            this.reset();
        }
    }

    /**
     * Evaluate conditional field visibility
     */
    evaluateCondition(condition) {
        const { field, operator, value } = condition;
        const fieldValue = this.state.values[field];

        switch (operator) {
            case '===':
            case '==':
                return fieldValue == value;
            case '!==':
            case '!=':
                return fieldValue != value;
            case 'includes':
                return Array.isArray(fieldValue) && fieldValue.includes(value);
            case 'empty':
                return !fieldValue || fieldValue === '';
            case 'notEmpty':
                return !!fieldValue && fieldValue !== '';
            default:
                return true;
        }
    }

    /**
     * Get form values
     */
    getValues() {
        return { ...this.state.values };
    }

    /**
     * Check if form is valid
     */
    isValid() {
        return Object.keys(this.state.errors).length === 0;
    }
}

// Create global instance
let formBuilderComponent;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FormBuilder };
}
