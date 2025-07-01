// ROOTUIP Enterprise Cryptographic Utilities
// Secure encryption, hashing, and token generation functions

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const SecurityConfig = require('../config/security-config');

class CryptoUtils {
    constructor() {
        this.config = SecurityConfig.encryption;
    }

    // Password Hashing
    async hashPassword(password) {
        try {
            const saltRounds = this.config.bcrypt.rounds;
            return await bcrypt.hash(password, saltRounds);
        } catch (error) {
            throw new Error(`Password hashing failed: ${error.message}`);
        }
    }

    async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new Error(`Password verification failed: ${error.message}`);
        }
    }

    // Password Policy Validation
    validatePassword(password, policy = SecurityConfig.passwordPolicy.default) {
        const errors = [];
        const warnings = [];

        // Length validation
        if (password.length < policy.minLength) {
            errors.push(`Password must be at least ${policy.minLength} characters long`);
        }
        if (password.length > policy.maxLength) {
            errors.push(`Password must be no more than ${policy.maxLength} characters long`);
        }

        // Complexity validation
        let complexityScore = 0;
        const patterns = policy.complexity.patterns;

        if (policy.requireLowercase && !patterns[0].test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        } else if (patterns[0].test(password)) {
            complexityScore++;
        }

        if (policy.requireUppercase && !patterns[1].test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        } else if (patterns[1].test(password)) {
            complexityScore++;
        }

        if (policy.requireNumbers && !patterns[2].test(password)) {
            errors.push('Password must contain at least one number');
        } else if (patterns[2].test(password)) {
            complexityScore++;
        }

        if (policy.requireSpecialChars && !patterns[3].test(password)) {
            errors.push('Password must contain at least one special character');
        } else if (patterns[3].test(password)) {
            complexityScore++;
        }

        // Overall complexity check
        if (complexityScore < policy.complexity.minScore) {
            errors.push(`Password complexity is insufficient (score: ${complexityScore}/${patterns.length})`);
        }

        // Common password patterns
        const commonPatterns = [
            /(.)\1{2,}/, // Three or more repeating characters
            /123456|654321|abc|qwerty/i, // Common sequences
            /password|admin|login|root/i, // Common words
            /^(.)(.*\1){2,}$/ // Repeating character patterns
        ];

        for (const pattern of commonPatterns) {
            if (pattern.test(password)) {
                warnings.push('Password contains common patterns that may be easily guessed');
                break;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            score: complexityScore,
            maxScore: patterns.length
        };
    }

    // Check if password was recently used
    async checkPasswordHistory(userId, newPasswordHash, previousHashes, preventReuseCount) {
        for (let i = 0; i < Math.min(previousHashes.length, preventReuseCount); i++) {
            if (await bcrypt.compare(newPasswordHash, previousHashes[i])) {
                return true; // Password was recently used
            }
        }
        return false;
    }

    // Secure Random Generation
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    generateSecureNumericCode(digits = 6) {
        const max = Math.pow(10, digits) - 1;
        const min = Math.pow(10, digits - 1);
        return crypto.randomInt(min, max + 1).toString().padStart(digits, '0');
    }

    generateApiKey() {
        const prefix = SecurityConfig.apiKey.prefix;
        const randomBytes = crypto.randomBytes(SecurityConfig.apiKey.length);
        const encoded = randomBytes.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        
        return `${prefix}${encoded}`;
    }

    // API Key Management
    async hashApiKey(apiKey) {
        // Extract the part after the prefix for hashing
        const keyPart = apiKey.replace(SecurityConfig.apiKey.prefix, '');
        return crypto.createHash('sha256').update(keyPart).digest('hex');
    }

    getApiKeyPrefix(apiKey) {
        return apiKey.substring(0, SecurityConfig.apiKey.prefix.length + 8);
    }

    async verifyApiKey(providedKey, storedHash) {
        const providedHash = await this.hashApiKey(providedKey);
        return crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );
    }

    // Multi-Factor Authentication
    generateMFASecret() {
        return speakeasy.generateSecret({
            name: 'ROOTUIP',
            issuer: SecurityConfig.mfa.issuer,
            length: 32
        });
    }

    async generateMFAQRCode(secret, userEmail) {
        const otpauthUrl = speakeasy.otpauthURL({
            secret: secret.base32,
            label: encodeURIComponent(userEmail),
            issuer: SecurityConfig.mfa.issuer,
            algorithm: SecurityConfig.mfa.algorithm,
            digits: SecurityConfig.mfa.digits,
            period: SecurityConfig.mfa.step
        });

        return await qrcode.toDataURL(otpauthUrl, SecurityConfig.mfa.qrCodeOptions);
    }

    verifyMFAToken(token, secret) {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: SecurityConfig.mfa.window,
            step: SecurityConfig.mfa.step,
            digits: SecurityConfig.mfa.digits,
            algorithm: SecurityConfig.mfa.algorithm
        });
    }

    // Generate MFA backup codes
    generateMFABackupCodes() {
        const codes = [];
        const config = SecurityConfig.mfa.backupCodes;
        
        for (let i = 0; i < config.count; i++) {
            let code = '';
            const chars = config.format === 'numeric' ? '0123456789' : '0123456789abcdefghijklmnopqrstuvwxyz';
            
            for (let j = 0; j < config.length; j++) {
                code += chars[crypto.randomInt(0, chars.length)];
            }
            
            // Add dash in the middle for readability
            if (config.length > 4) {
                const middle = Math.floor(config.length / 2);
                code = code.substring(0, middle) + '-' + code.substring(middle);
            }
            
            codes.push(code);
        }
        
        return codes;
    }

    async hashMFABackupCode(code) {
        // Remove dashes and convert to lowercase for consistent hashing
        const normalizedCode = code.replace(/-/g, '').toLowerCase();
        return crypto.createHash('sha256').update(normalizedCode).digest('hex');
    }

    async verifyMFABackupCode(providedCode, hashedCodes) {
        const normalizedProvided = providedCode.replace(/-/g, '').toLowerCase();
        const providedHash = crypto.createHash('sha256').update(normalizedProvided).digest('hex');
        
        for (const hashedCode of hashedCodes) {
            if (crypto.timingSafeEqual(
                Buffer.from(providedHash, 'hex'),
                Buffer.from(hashedCode, 'hex')
            )) {
                return true;
            }
        }
        return false;
    }

    // Session and Token Security
    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateRefreshToken() {
        return crypto.randomBytes(64).toString('base64url');
    }

    async hashRefreshToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    // Device Fingerprinting
    generateDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding, acceptHeaders) {
        const fingerprintData = [
            userAgent || '',
            acceptLanguage || '',
            acceptEncoding || '',
            JSON.stringify(acceptHeaders || {})
        ].join('|');

        return crypto.createHash(SecurityConfig.session.fingerprintAlgorithm)
            .update(fingerprintData)
            .digest('hex');
    }

    // Data Encryption (for sensitive PII)
    async encryptSensitiveData(data, masterKey) {
        try {
            const algorithm = this.config.algorithm;
            const key = crypto.scryptSync(masterKey, 'salt', 32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(algorithm, key, iv);
            
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    async decryptSensitiveData(encryptedData, masterKey) {
        try {
            const algorithm = this.config.algorithm;
            const key = crypto.scryptSync(masterKey, 'salt', 32);
            const decipher = crypto.createDecipher(algorithm, key, Buffer.from(encryptedData.iv, 'hex'));
            
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    // CSRF Token Management
    generateCSRFToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    hashCSRFToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    verifyCSRFToken(providedToken, hashedToken) {
        const providedHash = this.hashCSRFToken(providedToken);
        return crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(hashedToken, 'hex')
        );
    }

    // Email Verification
    generateEmailVerificationToken(email) {
        const timestamp = Date.now().toString();
        const data = `${email}:${timestamp}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        return Buffer.from(`${data}:${hash}`).toString('base64url');
    }

    verifyEmailVerificationToken(token, email, maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        try {
            const decoded = Buffer.from(token, 'base64url').toString('utf8');
            const [tokenEmail, timestamp, hash] = decoded.split(':');
            
            // Verify email matches
            if (tokenEmail !== email) {
                return { valid: false, reason: 'Email mismatch' };
            }
            
            // Verify token hasn't expired
            const tokenTime = parseInt(timestamp);
            if (Date.now() - tokenTime > maxAge) {
                return { valid: false, reason: 'Token expired' };
            }
            
            // Verify hash
            const expectedHash = crypto.createHash('sha256')
                .update(`${tokenEmail}:${timestamp}`)
                .digest('hex');
            
            if (hash !== expectedHash) {
                return { valid: false, reason: 'Invalid token' };
            }
            
            return { valid: true };
        } catch (error) {
            return { valid: false, reason: 'Malformed token' };
        }
    }

    // Secure comparison to prevent timing attacks
    secureCompare(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    // Generate secure IDs
    generateSecureId() {
        return crypto.randomUUID();
    }

    // Hash function for audit logs (one-way, for privacy)
    hashForAudit(data) {
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }

    // Rate limiting token bucket
    generateRateLimitKey(identifier, endpoint) {
        return crypto.createHash('sha256')
            .update(`${identifier}:${endpoint}:${process.env.RATE_LIMIT_SALT || 'default'}`)
            .digest('hex');
    }

    // IP Address utilities
    normalizeIP(ip) {
        // Convert IPv4-mapped IPv6 addresses to IPv4
        if (ip.startsWith('::ffff:')) {
            return ip.substring(7);
        }
        return ip;
    }

    hashIP(ip) {
        // Hash IP for privacy in logs while maintaining ability to detect patterns
        const salt = process.env.IP_HASH_SALT || 'default-salt';
        return crypto.createHash('sha256').update(`${ip}:${salt}`).digest('hex').substring(0, 16);
    }
}

module.exports = new CryptoUtils();