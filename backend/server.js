/**
 * REABEL Assessment Platform - Backend API Server
 * 
 * Enterprise-grade multi-tenant SaaS backend
 * 
 * Features:
 * - Multi-tenant with row-level security
 * - JWT authentication
 * - Complete RBAC
 * - RESTful API
 * - PostgreSQL database
 * - Microservices-ready architecture
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || 'CHANGE-THIS-SECRET-IN-PRODUCTION',
    jwtExpiry: '24h',
    bcryptRounds: 10,
    
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'reabel_platform',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 20, // connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:8000',
        credentials: true
    }
};

// ============================================================================
// DATABASE CONNECTION POOL
// ============================================================================

const pool = new Pool(CONFIG.database);

// Test database connection
pool.query('SELECT NOW() as now', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Database connected at:', res.rows[0].now);
    }
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('💥 Unexpected database error:', err);
});

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(CONFIG.cors));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authenticate JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'No authentication token provided' 
            });
        }
        
        const token = authHeader.substring(7);
        
        // Verify token
        const decoded = jwt.verify(token, CONFIG.jwtSecret);
        
        // Get user with tenant info from database
        const result = await pool.query(`
            SELECT 
                u.user_id,
                u.email,
                u.full_name,
                u.tenant_id,
                u.role_id,
                u.is_active,
                t.tenant_name,
                t.subscription_tier,
                r.role_name,
                r.role_key
            FROM users u
            JOIN tenants t ON u.tenant_id = t.tenant_id
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.user_id = $1 
              AND u.is_active = true
              AND t.is_active = true
        `, [decoded.userId]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        
        // Attach user and tenant to request
        req.user = result.rows[0];
        req.tenantId = result.rows[0].tenant_id;
        req.userId = result.rows[0].user_id;
        req.roleKey = result.rows[0].role_key;
        
        next();
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired' 
            });
        }
        
        console.error('Authentication error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Authentication failed' 
        });
    }
};

/**
 * Check if user has required permission
 */
const authorize = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // Check permission in database
            const result = await pool.query(`
                SELECT 1
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.permission_id
                WHERE rp.role_id = $1 
                  AND p.permission_key = $2
            `, [req.user.role_id, requiredPermission]);
            
            if (result.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
            }
            
            next();
            
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/auth/login
 * Login user and return JWT token
 */
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        // Get user from database
        const result = await pool.query(`
            SELECT 
                u.user_id,
                u.email,
                u.full_name,
                u.password_hash,
                u.tenant_id,
                u.role_id,
                t.tenant_name,
                r.role_name,
                r.role_key
            FROM users u
            JOIN tenants t ON u.tenant_id = t.tenant_id
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.email = $1 
              AND u.is_active = true
              AND t.is_active = true
        `, [email.toLowerCase()]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        const user = result.rows[0];
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.user_id,
                tenantId: user.tenant_id,
                roleId: user.role_id,
                roleKey: user.role_key
            },
            CONFIG.jwtSecret,
            { expiresIn: CONFIG.jwtExpiry }
        );
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
            [user.user_id]
        );
        
        // Return user data and token
        res.json({
            success: true,
            token,
            user: {
                id: user.user_id,
                email: user.email,
                name: user.full_name,
                tenantId: user.tenant_id,
                tenantName: user.tenant_name,
                role: user.role_key,
                roleName: user.role_name
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
app.get('/api/v1/auth/me', authenticate, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.user_id,
            email: req.user.email,
            name: req.user.full_name,
            tenantId: req.user.tenant_id,
            tenantName: req.user.tenant_name,
            role: req.user.role_key,
            roleName: req.user.role_name
        }
    });
});

// ============================================================================
// ROLES ENDPOINT
// ============================================================================

/**
 * GET /api/v1/roles
 * Get all roles
 */
app.get('/api/v1/roles', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                role_id,
                role_key,
                role_name,
                description,
                is_platform_role
            FROM roles
            WHERE is_active = true
            ORDER BY role_name
        `);
        
        res.json({
            success: true,
            roles: result.rows
        });
        
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch roles'
        });
    }
});

// ============================================================================
// PERMISSIONS ENDPOINT
// ============================================================================

/**
 * GET /api/v1/permissions
 * Get all permissions for current user's role
 */
app.get('/api/v1/permissions', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.permission_id,
                p.permission_key,
                p.resource_type,
                p.action,
                p.scope
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.permission_id
            WHERE rp.role_id = $1
        `, [req.user.role_id]);
        
        res.json({
            success: true,
            permissions: result.rows
        });
        
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch permissions'
        });
    }
});

// ============================================================================
// NAVIGATION ENDPOINT
// ============================================================================

/**
 * GET /api/v1/navigation
 * Get navigation menu for current user's role
 */
app.get('/api/v1/navigation', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                m.menu_id,
                m.menu_key,
                m.label,
                m.href,
                m.icon,
                m.parent_id,
                m.sort_order
            FROM ui_menus m
            JOIN role_menus rm ON m.menu_id = rm.menu_id
            WHERE rm.role_id = $1
              AND m.is_active = true
            ORDER BY m.parent_id NULLS FIRST, m.sort_order
        `, [req.user.role_id]);
        
        res.json({
            success: true,
            navigation: result.rows
        });
        
    } catch (error) {
        console.error('Get navigation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch navigation'
        });
    }
});

// ============================================================================
// TEMPLATES ENDPOINT
// ============================================================================

/**
 * GET /api/v1/templates
 * Get all assessment templates
 */
app.get('/api/v1/templates', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                template_id,
                template_name,
                description,
                framework_type,
                total_questions,
                estimated_duration_weeks
            FROM assessment_templates
            WHERE is_active = true
            ORDER BY template_name
        `);
        
        res.json({
            success: true,
            templates: result.rows
        });
        
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch templates'
        });
    }
});

// ============================================================================
// ASSESSMENTS ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/assessments
 * Get all assessments for current tenant
 */
app.get('/api/v1/assessments', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.assessment_id,
                a.assessment_name,
                a.template_id,
                t.template_name,
                t.framework_type,
                a.status,
                a.completion_percentage,
                a.due_date,
                a.created_at
            FROM assessments a
            JOIN assessment_templates t ON a.template_id = t.template_id
            WHERE a.tenant_id = $1
            ORDER BY a.created_at DESC
        `, [req.tenantId]);
        
        res.json({
            success: true,
            assessments: result.rows
        });
        
    } catch (error) {
        console.error('Get assessments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assessments'
        });
    }
});

/**
 * POST /api/v1/assessments
 * Create new assessment
 */
app.post('/api/v1/assessments', authenticate, authorize('write:assessments'), async (req, res) => {
    try {
        const { name, templateId, dueDate } = req.body;
        
        if (!name || !templateId) {
            return res.status(400).json({
                success: false,
                message: 'Name and template ID are required'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO assessments (
                tenant_id, 
                template_id, 
                assessment_name,
                due_date,
                created_by,
                status
            )
            VALUES ($1, $2, $3, $4, $5, 'draft')
            RETURNING assessment_id, assessment_name, status
        `, [req.tenantId, templateId, name, dueDate, req.userId]);
        
        res.status(201).json({
            success: true,
            assessment: result.rows[0]
        });
        
    } catch (error) {
        console.error('Create assessment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create assessment'
        });
    }
});

// ============================================================================
// QUESTIONS ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/questions
 * Get questions for a template
 */
app.get('/api/v1/questions', authenticate, async (req, res) => {
    try {
        const { templateId } = req.query;
        
        if (!templateId) {
            return res.status(400).json({
                success: false,
                message: 'Template ID is required'
            });
        }
        
        const result = await pool.query(`
            SELECT 
                q.question_id,
                q.question_text,
                q.question_type,
                q.dimension_id,
                d.dimension_name,
                q.sort_order
            FROM questions q
            JOIN template_dimensions d ON q.dimension_id = d.dimension_id
            WHERE d.template_id = $1
            ORDER BY d.sort_order, q.sort_order
        `, [templateId]);
        
        res.json({
            success: true,
            questions: result.rows
        });
        
    } catch (error) {
        console.error('Get questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch questions'
        });
    }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(CONFIG.port, () => {
    console.log('');
    console.log('========================================');
    console.log('🚀 REABEL Platform API Server');
    console.log('========================================');
    console.log(`✅ Server running on port ${CONFIG.port}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Database: ${CONFIG.database.database}@${CONFIG.database.host}`);
    console.log('========================================');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        pool.end(() => {
            console.log('Server and database connections closed');
            process.exit(0);
        });
    });
});

module.exports = app;
