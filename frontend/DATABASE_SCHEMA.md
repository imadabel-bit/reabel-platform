# DATABASE SCHEMA - FULLY CONFIGURABLE ARCHITECTURE

## 🎯 DESIGN PHILOSOPHY

**EVERYTHING IS DATABASE-DRIVEN:**
- ✅ Zero hardcoding in frontend
- ✅ All configurations in database
- ✅ Dynamic menus, forms, workflows
- ✅ Granular RBAC from database
- ✅ Multi-tenant ready
- ✅ Fully configurable without code changes

---

## 📊 CORE TABLES

### **1. users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    tenant_id UUID,
    default_role_id UUID,
    status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_login TIMESTAMP
);
```

### **2. tenants** (Multi-tenancy)
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    settings JSONB,  -- Tenant-specific configurations
    subscription_tier VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
);
```

---

## 🔐 RBAC TABLES (Fully Database-Driven)

### **3. roles**
```sql
CREATE TABLE roles (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    icon VARCHAR(50),
    description TEXT,
    is_read_only BOOLEAN DEFAULT false,
    is_system_role BOOLEAN DEFAULT false,  -- Cannot be deleted
    tenant_id UUID,  -- NULL for platform roles
    color VARCHAR(20),
    sort_order INTEGER,
    metadata JSONB,  -- Banner config, etc.
    created_at TIMESTAMP
);
```

### **4. permissions**
```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'read:assessments'
    resource VARCHAR(100),   -- 'assessments', 'questions', etc.
    action VARCHAR(50),      -- 'read', 'write', 'delete', etc.
    description TEXT,
    category VARCHAR(100),   -- For grouping in UI
    created_at TIMESTAMP
);
```

### **5. role_permissions**
```sql
CREATE TABLE role_permissions (
    role_id VARCHAR(100),
    permission_id UUID,
    scope VARCHAR(50),  -- 'all', 'own', 'assigned', 'team'
    conditions JSONB,   -- Complex permission rules
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
);
```

### **6. user_roles**
```sql
CREATE TABLE user_roles (
    user_id UUID,
    role_id VARCHAR(100),
    tenant_id UUID,
    scope JSONB,  -- e.g., { "domains": ["product", "tech"] }
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP,
    assigned_by UUID,
    PRIMARY KEY (user_id, role_id, tenant_id)
);
```

---

## 🎨 UI CONFIGURATION TABLES

### **7. ui_menus**
```sql
CREATE TABLE ui_menus (
    id UUID PRIMARY KEY,
    parent_id UUID,  -- For nested menus
    label VARCHAR(255),
    icon VARCHAR(100),
    href VARCHAR(500),
    menu_type VARCHAR(50),  -- 'sidebar', 'header', 'dropdown'
    sort_order INTEGER,
    required_permission VARCHAR(100),
    visible_for_roles JSONB,  -- Array of role IDs
    tenant_id UUID,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,  -- Badge, tooltip, etc.
    created_at TIMESTAMP
);
```

### **8. ui_features**
```sql
CREATE TABLE ui_features (
    id UUID PRIMARY KEY,
    feature_code VARCHAR(100) UNIQUE,
    name VARCHAR(255),
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    enabled_for_tenants JSONB,  -- Array of tenant IDs
    enabled_for_roles JSONB,    -- Array of role IDs
    config JSONB,  -- Feature-specific configuration
    created_at TIMESTAMP
);
```

### **9. ui_field_configs**
```sql
CREATE TABLE ui_field_configs (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(100),  -- 'assessment', 'question', etc.
    field_name VARCHAR(100),
    field_type VARCHAR(50),    -- 'text', 'select', 'textarea', etc.
    label VARCHAR(255),
    is_required BOOLEAN,
    is_visible BOOLEAN,
    visible_for_roles JSONB,
    editable_for_roles JSONB,
    validation_rules JSONB,
    display_order INTEGER,
    group_name VARCHAR(100),   -- For field grouping
    help_text TEXT,
    placeholder VARCHAR(255),
    default_value TEXT,
    options JSONB,  -- For select/radio/checkbox
    tenant_id UUID,
    created_at TIMESTAMP
);
```

---

## 🔄 WORKFLOW TABLES

### **10. workflows**
```sql
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    entity_type VARCHAR(100),  -- 'assessment', 'question', etc.
    description TEXT,
    initial_state VARCHAR(100),
    tenant_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
);
```

### **11. workflow_states**
```sql
CREATE TABLE workflow_states (
    id UUID PRIMARY KEY,
    workflow_id UUID,
    state_code VARCHAR(100),
    label VARCHAR(255),
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(50),
    is_initial BOOLEAN DEFAULT false,
    is_final BOOLEAN DEFAULT false,
    sort_order INTEGER,
    actions JSONB,  -- Available actions in this state
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

### **12. workflow_transitions**
```sql
CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY,
    workflow_id UUID,
    from_state VARCHAR(100),
    to_state VARCHAR(100),
    action_label VARCHAR(255),
    required_permission VARCHAR(100),
    allowed_roles JSONB,
    conditions JSONB,  -- Complex transition rules
    validation_rules JSONB,
    post_transition_actions JSONB,  -- Trigger notifications, etc.
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

## 📝 ASSESSMENT TABLES

### **13. assessment_templates**
```sql
CREATE TABLE assessment_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    tenant_id UUID,
    created_by UUID,
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,  -- Icon, tags, etc.
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### **14. template_dimensions**
```sql
CREATE TABLE template_dimensions (
    id UUID PRIMARY KEY,
    template_id UUID,
    name VARCHAR(255),
    description TEXT,
    weight DECIMAL(5,2),  -- For scoring
    sort_order INTEGER,
    color VARCHAR(20),
    icon VARCHAR(50),
    FOREIGN KEY (template_id) REFERENCES assessment_templates(id)
);
```

### **15. questions**
```sql
CREATE TABLE questions (
    id UUID PRIMARY KEY,
    template_id UUID,
    dimension_id UUID,
    question_text TEXT,
    help_text TEXT,
    question_type VARCHAR(50),  -- 'text', 'multiple_choice', 'scale', etc.
    is_required BOOLEAN DEFAULT true,
    options JSONB,  -- For multiple choice
    validation_rules JSONB,
    scoring_rubric JSONB,
    sort_order INTEGER,
    tags JSONB,
    metadata JSONB,
    created_at TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES assessment_templates(id),
    FOREIGN KEY (dimension_id) REFERENCES template_dimensions(id)
);
```

### **16. assessments**
```sql
CREATE TABLE assessments (
    id UUID PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    template_id UUID,
    tenant_id UUID,
    created_by UUID,
    status VARCHAR(50),  -- Uses workflow states
    progress DECIMAL(5,2),
    started_at TIMESTAMP,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES assessment_templates(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### **17. assessment_responses**
```sql
CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY,
    assessment_id UUID,
    question_id UUID,
    user_id UUID,
    response_text TEXT,
    response_data JSONB,  -- For structured responses
    status VARCHAR(50),   -- 'draft', 'submitted', 'approved', etc.
    score DECIMAL(5,2),
    reviewer_comments TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### **18. assessment_assignments**
```sql
CREATE TABLE assessment_assignments (
    id UUID PRIMARY KEY,
    assessment_id UUID,
    user_id UUID,
    dimension_id UUID,  -- Can assign specific dimensions
    assigned_by UUID,
    assigned_at TIMESTAMP,
    due_date TIMESTAMP,
    status VARCHAR(50),
    completed_at TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 📊 ANALYTICS & REPORTING TABLES

### **19. assessment_scores**
```sql
CREATE TABLE assessment_scores (
    id UUID PRIMARY KEY,
    assessment_id UUID,
    dimension_id UUID,
    score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    percentage DECIMAL(5,2),
    calculated_at TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id),
    FOREIGN KEY (dimension_id) REFERENCES template_dimensions(id)
);
```

### **20. action_items**
```sql
CREATE TABLE action_items (
    id UUID PRIMARY KEY,
    assessment_id UUID,
    dimension_id UUID,
    title VARCHAR(255),
    description TEXT,
    priority VARCHAR(50),
    status VARCHAR(50),
    assigned_to UUID,
    assigned_by UUID,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);
```

---

## 🔔 NOTIFICATION TABLES

### **21. notification_templates**
```sql
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY,
    template_code VARCHAR(100) UNIQUE,
    name VARCHAR(255),
    subject VARCHAR(500),
    body_template TEXT,  -- With placeholders
    notification_type VARCHAR(50),  -- 'email', 'in-app', 'sms'
    trigger_event VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
);
```

### **22. notifications**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID,
    template_id UUID,
    subject VARCHAR(500),
    body TEXT,
    notification_type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    data JSONB,  -- Event data
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🔍 AUDIT TABLES

### **23. audit_logs**
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID,
    tenant_id UUID,
    entity_type VARCHAR(100),
    entity_id UUID,
    action VARCHAR(100),  -- 'create', 'update', 'delete', etc.
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🎯 KEY FEATURES OF THIS SCHEMA

### **1. Complete RBAC**
- ✅ Granular permissions
- ✅ Role-based access at row/field level
- ✅ Conditional permissions
- ✅ Scope-based access (own, team, all)

### **2. Multi-Tenancy**
- ✅ Tenant isolation
- ✅ Tenant-specific configurations
- ✅ Cross-tenant roles (REABEL platform roles)

### **3. Dynamic UI**
- ✅ Menu structure from database
- ✅ Field visibility by role
- ✅ Feature flags per tenant/role
- ✅ Dynamic forms and validations

### **4. Workflow Engine**
- ✅ Configurable state machines
- ✅ Role-based transitions
- ✅ Conditional workflows
- ✅ Post-transition actions

### **5. Full Configurability**
- ✅ No hardcoded menus
- ✅ No hardcoded permissions
- ✅ No hardcoded workflows
- ✅ No hardcoded forms
- ✅ Everything controlled by database

---

## 📡 API ENDPOINTS STRUCTURE

All frontend services will call these endpoints:

```
GET  /api/v1/config/ui             → UI configurations
GET  /api/v1/config/workflows      → Workflow definitions
GET  /api/v1/config/forms          → Form schemas
GET  /api/v1/config/permissions    → Permission matrix
GET  /api/v1/config/menus          → Menu hierarchy

GET  /api/v1/roles                 → All roles
GET  /api/v1/roles/:id/permissions → Role permissions
POST /api/v1/users/role            → Switch role

GET  /api/v1/assessments           → List assessments (filtered by role)
POST /api/v1/assessments           → Create assessment
GET  /api/v1/assessments/:id       → Get assessment
PUT  /api/v1/assessments/:id       → Update assessment

GET  /api/v1/questions             → List questions (filtered)
POST /api/v1/responses             → Submit response
PUT  /api/v1/responses/:id/review  → Review response
```

---

## 🚀 MIGRATION STRATEGY

### **Phase 1: Core Tables**
1. users, tenants, roles, permissions
2. role_permissions, user_roles
3. Basic RBAC working

### **Phase 2: UI Configuration**
1. ui_menus, ui_features, ui_field_configs
2. Dynamic menus and forms working

### **Phase 3: Workflows**
1. workflows, workflow_states, workflow_transitions
2. State machine working

### **Phase 4: Assessment Domain**
1. assessment_templates, template_dimensions, questions
2. assessments, assessment_responses, assessment_assignments
3. Full assessment lifecycle

### **Phase 5: Enhancements**
1. action_items, notification_templates, notifications
2. assessment_scores, audit_logs
3. Analytics and reporting

---

**This schema provides:**
- ✅ **Zero hardcoding** - Everything is data-driven
- ✅ **Maximum flexibility** - Change anything without code
- ✅ **Enterprise-ready** - Multi-tenant, RBAC, audit
- ✅ **Scalable** - Easy to add new entities/workflows
- ✅ **Secure** - Granular permissions at every level
