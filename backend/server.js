/**
 * MODULE 1: AUTHENTICATION & USER MANAGEMENT
 * Backend API Server
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-12345';
const DATABASE_URL = process.env.DATABASE_URL;

// Database connection
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected at:', res.rows[0].now);
    }
});

// Express app
const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/register
 * Register new partner account
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, partnerName, companyName } = req.body;

        // Validation
        if (!email || !password || !partnerName) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and partner name are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Check if email exists
        const existing = await pool.query(
            'SELECT partner_id FROM partners WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create partner
        const result = await pool.query(`
            INSERT INTO partners (
                partner_name, 
                email, 
                password_hash, 
                company_name,
                email_verified
            )
            VALUES ($1, $2, $3, $4, false)
            RETURNING partner_id, partner_name, email, company_name, created_at
        `, [partnerName, email.toLowerCase(), passwordHash, companyName || null]);

        const partner = result.rows[0];

        // Generate verification token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await pool.query(`
            INSERT INTO verification_tokens (partner_id, token, token_type, expires_at)
            VALUES ($1, $2, 'email_verification', $3)
        `, [partner.partner_id, token, expiresAt]);

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            partner: {
                id: partner.partner_id,
                name: partner.partner_name,
                email: partner.email,
                companyName: partner.company_name
            },
            verificationToken: token // In production, send via email
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

/**
 * POST /api/auth/login
 * Partner login
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Get partner
        const result = await pool.query(`
            SELECT 
                partner_id,
                partner_name,
                email,
                password_hash,
                company_name,
                email_verified,
                is_active,
                is_admin
            FROM partners
            WHERE email = $1
        `, [email.toLowerCase()]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const partner = result.rows[0];

        // Check if active
        if (!partner.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, partner.password_hash);

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check email verification
        if (!partner.email_verified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in',
                needsVerification: true
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { 
                partnerId: partner.partner_id,
                email: partner.email,
                isAdmin: partner.is_admin
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update last login
        await pool.query(
            'UPDATE partners SET last_login_at = NOW() WHERE partner_id = $1',
            [partner.partner_id]
        );

        res.json({
            success: true,
            token,
            partner: {
                id: partner.partner_id,
                name: partner.partner_name,
                email: partner.email,
                companyName: partner.company_name,
                isAdmin: partner.is_admin
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
 * POST /api/auth/verify-email
 * Verify email with token
 */
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        // Find valid token
        const result = await pool.query(`
            SELECT vt.partner_id, p.email
            FROM verification_tokens vt
            JOIN partners p ON vt.partner_id = p.partner_id
            WHERE vt.token = $1
              AND vt.token_type = 'email_verification'
              AND vt.expires_at > NOW()
              AND vt.used_at IS NULL
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        const { partner_id, email } = result.rows[0];

        // Mark email as verified
        await pool.query(
            'UPDATE partners SET email_verified = true WHERE partner_id = $1',
            [partner_id]
        );

        // Mark token as used
        await pool.query(
            'UPDATE verification_tokens SET used_at = NOW() WHERE token = $1',
            [token]
        );

        res.json({
            success: true,
            message: 'Email verified successfully! You can now log in.',
            email
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Email verification failed'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find partner
        const result = await pool.query(
            'SELECT partner_id FROM partners WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );

        // Always return success (don't reveal if email exists)
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                message: 'If that email exists, a password reset link has been sent'
            });
        }

        const { partner_id } = result.rows[0];

        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

        await pool.query(`
            INSERT INTO verification_tokens (partner_id, token, token_type, expires_at)
            VALUES ($1, $2, 'password_reset', $3)
        `, [partner_id, token, expiresAt]);

        res.json({
            success: true,
            message: 'If that email exists, a password reset link has been sent',
            resetToken: token // In production, send via email
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Password reset request failed'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Find valid token
        const result = await pool.query(`
            SELECT partner_id
            FROM verification_tokens
            WHERE token = $1
              AND token_type = 'password_reset'
              AND expires_at > NOW()
              AND used_at IS NULL
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        const { partner_id } = result.rows[0];

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE partners SET password_hash = $1 WHERE partner_id = $2',
            [passwordHash, partner_id]
        );

        // Mark token as used
        await pool.query(
            'UPDATE verification_tokens SET used_at = NOW() WHERE token = $1',
            [token]
        );

        res.json({
            success: true,
            message: 'Password reset successfully! You can now log in with your new password.'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Password reset failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current partner info (requires authentication)
 */
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                partner_id,
                partner_name,
                email,
                company_name,
                phone,
                is_admin,
                email_verified,
                created_at,
                last_login_at
            FROM partners
            WHERE partner_id = $1 AND is_active = true
        `, [req.partner.partnerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner not found'
            });
        }

        res.json({
            success: true,
            partner: result.rows[0]
        });

    } catch (error) {
        console.error('Get partner error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get partner info'
        });
    }
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, partner) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        req.partner = partner;
        next();
    });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
    res.json({
        success: true,
        module: 'MODULE 1: Authentication',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('🔐 MODULE 1: AUTHENTICATION API');
    console.log('========================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');
    console.log('');
    console.log('Available endpoints:');
    console.log('  POST /api/auth/register');
    console.log('  POST /api/auth/login');
    console.log('  POST /api/auth/verify-email');
    console.log('  POST /api/auth/forgot-password');
    console.log('  POST /api/auth/reset-password');
    console.log('  GET  /api/auth/me');
    console.log('  GET  /health');
    console.log('');
});

module.exports = app;
