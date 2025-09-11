/**
 * OmnixLang License Manager
 * Open-core licensing system with feature flags
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class LicenseManager {
    constructor() {
        this.license = null;
        this.features = new Map();
        this.usage = new Map();
        this.tiers = this.defineTiers();
        this.currentTier = 'free';
        this.initialized = false;
    }
    
    defineTiers() {
        return {
            free: {
                name: 'Community',
                price: 0,
                features: {
                    // Core features (always free)
                    graphIDE: true,
                    localExecution: true,
                    adapters: ['python', 'javascript', 'sql'],
                    maxNodes: Infinity,
                    maxPipelines: Infinity,
                    maxExecutions: 100, // per day
                    dataRetention: 1, // days
                    
                    // Limited features
                    distributedExecution: false,
                    teamCollaboration: false,
                    secretsManagement: false,
                    auditLogs: false,
                    ssoIntegration: false,
                    customConnectors: false,
                    prioritySupport: false,
                    sla: false,
                    monitoring: 'basic',
                    scheduling: false,
                    triggers: false,
                    versionControl: false,
                    marketplace: 'read-only'
                },
                limits: {
                    users: 1,
                    apiCalls: 1000, // per day
                    storage: 100, // MB
                    concurrentPipelines: 1
                }
            },
            
            team: {
                name: 'Team',
                price: 299, // per month
                features: {
                    // All free features
                    graphIDE: true,
                    localExecution: true,
                    adapters: ['python', 'javascript', 'sql', 'r', 'julia'],
                    maxNodes: Infinity,
                    maxPipelines: 100,
                    maxExecutions: 1000, // per day
                    dataRetention: 30, // days
                    
                    // Team features
                    distributedExecution: true,
                    teamCollaboration: true,
                    secretsManagement: true,
                    auditLogs: true,
                    ssoIntegration: false,
                    customConnectors: 5,
                    prioritySupport: false,
                    sla: false,
                    monitoring: 'advanced',
                    scheduling: true,
                    triggers: true,
                    versionControl: true,
                    marketplace: 'read-write'
                },
                limits: {
                    users: 5,
                    apiCalls: 10000, // per day
                    storage: 10000, // MB (10GB)
                    concurrentPipelines: 5
                }
            },
            
            business: {
                name: 'Business',
                price: 999, // per month
                features: {
                    // All team features
                    graphIDE: true,
                    localExecution: true,
                    adapters: ['python', 'javascript', 'sql', 'r', 'julia', 'scala', 'go'],
                    maxNodes: Infinity,
                    maxPipelines: Infinity,
                    maxExecutions: 10000, // per day
                    dataRetention: 90, // days
                    
                    // Business features
                    distributedExecution: true,
                    teamCollaboration: true,
                    secretsManagement: true,
                    auditLogs: true,
                    ssoIntegration: true,
                    customConnectors: 20,
                    prioritySupport: true,
                    sla: '99.9%',
                    monitoring: 'enterprise',
                    scheduling: true,
                    triggers: true,
                    versionControl: true,
                    marketplace: 'premium'
                },
                limits: {
                    users: 20,
                    apiCalls: 100000, // per day
                    storage: 100000, // MB (100GB)
                    concurrentPipelines: 20
                }
            },
            
            enterprise: {
                name: 'Enterprise',
                price: 'custom', // negotiated
                features: {
                    // All features
                    graphIDE: true,
                    localExecution: true,
                    adapters: 'all',
                    maxNodes: Infinity,
                    maxPipelines: Infinity,
                    maxExecutions: Infinity,
                    dataRetention: 365, // days
                    
                    // Enterprise features
                    distributedExecution: true,
                    teamCollaboration: true,
                    secretsManagement: true,
                    auditLogs: true,
                    ssoIntegration: true,
                    customConnectors: Infinity,
                    prioritySupport: true,
                    sla: '99.99%',
                    monitoring: 'custom',
                    scheduling: true,
                    triggers: true,
                    versionControl: true,
                    marketplace: 'enterprise',
                    
                    // Enterprise-only
                    onPremise: true,
                    whiteLabeling: true,
                    customIntegrations: true,
                    dedicatedSupport: true,
                    compliance: ['SOC2', 'HIPAA', 'GDPR'],
                    privateCloud: true
                },
                limits: {
                    users: Infinity,
                    apiCalls: Infinity,
                    storage: Infinity,
                    concurrentPipelines: Infinity
                }
            }
        };
    }
    
    async init(licenseFile = null) {
        try {
            // Load license from file or environment
            if (licenseFile) {
                await this.loadLicense(licenseFile);
            } else if (process.env.OMNIX_LICENSE_KEY) {
                await this.validateLicenseKey(process.env.OMNIX_LICENSE_KEY);
            } else {
                // Default to free tier
                this.setTier('free');
            }
            
            this.initialized = true;
            console.log(`[LicenseManager] Initialized with ${this.currentTier} tier`);
            
        } catch (error) {
            console.error('[LicenseManager] Initialization failed:', error.message);
            this.setTier('free'); // Fallback to free
            this.initialized = true;
        }
    }
    
    async loadLicense(filePath) {
        try {
            const licenseData = await fs.readFile(filePath, 'utf8');
            const license = JSON.parse(licenseData);
            
            if (await this.validateLicense(license)) {
                this.license = license;
                this.setTier(license.tier);
                return true;
            }
            
            throw new Error('Invalid license');
        } catch (error) {
            throw new Error(`Failed to load license: ${error.message}`);
        }
    }
    
    async validateLicense(license) {
        // Validate license structure
        if (!license.id || !license.tier || !license.expiresAt) {
            return false;
        }
        
        // Check expiration
        if (new Date(license.expiresAt) < new Date()) {
            throw new Error('License expired');
        }
        
        // Verify signature (in production, would check against public key)
        if (!this.verifySignature(license)) {
            return false;
        }
        
        return true;
    }
    
    async validateLicenseKey(key) {
        // In production, would validate against license server
        const keyPattern = /^OMNIX-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
        
        if (!keyPattern.test(key)) {
            throw new Error('Invalid license key format');
        }
        
        // Decode tier from key (simplified)
        const tierCode = key.split('-')[1][0];
        const tierMap = { 'F': 'free', 'T': 'team', 'B': 'business', 'E': 'enterprise' };
        const tier = tierMap[tierCode] || 'free';
        
        this.license = {
            id: key,
            tier: tier,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            signature: this.generateSignature(key)
        };
        
        this.setTier(tier);
        return true;
    }
    
    setTier(tier) {
        if (!this.tiers[tier]) {
            throw new Error(`Unknown tier: ${tier}`);
        }
        
        this.currentTier = tier;
        this.features = new Map(Object.entries(this.tiers[tier].features));
        
        console.log(`[LicenseManager] Activated ${tier} tier with features:`, 
            Array.from(this.features.entries()).filter(([k, v]) => v === true).map(([k]) => k)
        );
    }
    
    hasFeature(feature) {
        return this.features.get(feature) === true;
    }
    
    getFeature(feature) {
        return this.features.get(feature);
    }
    
    getLimit(limit) {
        return this.tiers[this.currentTier].limits[limit];
    }
    
    checkLimit(limit, current) {
        const max = this.getLimit(limit);
        if (max === Infinity) return true;
        return current < max;
    }
    
    async trackUsage(metric, value = 1) {
        const key = `${metric}:${new Date().toISOString().split('T')[0]}`;
        const current = this.usage.get(key) || 0;
        this.usage.set(key, current + value);
        
        // Check if limit exceeded
        const limit = this.getLimit(metric);
        if (limit !== Infinity && current + value > limit) {
            throw new Error(`Usage limit exceeded for ${metric}: ${current + value}/${limit}`);
        }
        
        return current + value;
    }
    
    async getUsageStats() {
        const stats = {};
        const today = new Date().toISOString().split('T')[0];
        
        for (const [key, value] of this.usage) {
            const [metric, date] = key.split(':');
            if (date === today) {
                stats[metric] = value;
            }
        }
        
        return {
            tier: this.currentTier,
            limits: this.tiers[this.currentTier].limits,
            usage: stats,
            remaining: Object.entries(this.tiers[this.currentTier].limits).reduce((acc, [key, limit]) => {
                if (limit !== Infinity) {
                    acc[key] = Math.max(0, limit - (stats[key] || 0));
                }
                return acc;
            }, {})
        };
    }
    
    generateLicense(tier, options = {}) {
        const license = {
            id: this.generateLicenseKey(tier),
            tier: tier,
            organization: options.organization || 'Unknown',
            issuedAt: new Date().toISOString(),
            expiresAt: options.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            features: this.tiers[tier].features,
            limits: this.tiers[tier].limits,
            metadata: options.metadata || {}
        };
        
        license.signature = this.generateSignature(license);
        
        return license;
    }
    
    generateLicenseKey(tier) {
        const tierCode = tier[0].toUpperCase();
        const random = () => Math.random().toString(36).substr(2, 5).toUpperCase();
        return `OMNIX-${tierCode}${random().substr(1)}-${random()}-${random()}-${random()}`;
    }
    
    generateSignature(data) {
        // In production, use private key signing
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(data));
        return hash.digest('hex');
    }
    
    verifySignature(license) {
        // In production, verify with public key
        const { signature, ...data } = license;
        const expectedSignature = this.generateSignature(data);
        return signature === expectedSignature;
    }
    
    async saveLicense(filePath) {
        if (!this.license) {
            throw new Error('No license to save');
        }
        
        await fs.writeFile(filePath, JSON.stringify(this.license, null, 2));
    }
    
    getInfo() {
        return {
            tier: this.currentTier,
            tierName: this.tiers[this.currentTier].name,
            price: this.tiers[this.currentTier].price,
            features: Object.fromEntries(this.features),
            limits: this.tiers[this.currentTier].limits,
            license: this.license ? {
                id: this.license.id,
                expiresAt: this.license.expiresAt,
                organization: this.license.organization
            } : null
        };
    }
    
    // Feature flag helpers
    canUseDistributed() {
        return this.hasFeature('distributedExecution');
    }
    
    canUseTeamFeatures() {
        return this.hasFeature('teamCollaboration');
    }
    
    canUseCustomConnectors() {
        const limit = this.getFeature('customConnectors');
        return limit && limit > 0;
    }
    
    canUseScheduling() {
        return this.hasFeature('scheduling');
    }
    
    canUseSSO() {
        return this.hasFeature('ssoIntegration');
    }
    
    isEnterprise() {
        return this.currentTier === 'enterprise';
    }
    
    isPaid() {
        return this.currentTier !== 'free';
    }
}

// Singleton instance
const licenseManager = new LicenseManager();

module.exports = {
    LicenseManager,
    licenseManager
};