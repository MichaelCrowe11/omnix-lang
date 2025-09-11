/**
 * OmnixLang Team Collaboration Manager
 * Multi-user support, permissions, and sharing
 * Premium feature for Team/Business/Enterprise tiers
 */

const crypto = require('crypto');
const { licenseManager } = require('../licensing/license-manager');

// User roles
const UserRole = {
    OWNER: 'owner',
    ADMIN: 'admin',
    DEVELOPER: 'developer',
    VIEWER: 'viewer'
};

// Permissions matrix
const Permissions = {
    [UserRole.OWNER]: {
        pipelines: ['create', 'read', 'update', 'delete', 'execute', 'share'],
        users: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update'],
        billing: ['read', 'update'],
        audit: ['read']
    },
    [UserRole.ADMIN]: {
        pipelines: ['create', 'read', 'update', 'delete', 'execute', 'share'],
        users: ['create', 'read', 'update'],
        settings: ['read', 'update'],
        billing: ['read'],
        audit: ['read']
    },
    [UserRole.DEVELOPER]: {
        pipelines: ['create', 'read', 'update', 'execute'],
        users: ['read'],
        settings: ['read'],
        billing: [],
        audit: []
    },
    [UserRole.VIEWER]: {
        pipelines: ['read'],
        users: ['read'],
        settings: ['read'],
        billing: [],
        audit: []
    }
};

class User {
    constructor(data) {
        this.id = data.id || crypto.randomBytes(16).toString('hex');
        this.email = data.email;
        this.name = data.name;
        this.role = data.role || UserRole.VIEWER;
        this.teamId = data.teamId;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.lastLogin = data.lastLogin || null;
        this.apiKey = data.apiKey || this.generateApiKey();
        this.preferences = data.preferences || {};
        this.active = data.active !== false;
    }
    
    generateApiKey() {
        return `omnix_${crypto.randomBytes(32).toString('hex')}`;
    }
    
    hasPermission(resource, action) {
        const rolePermissions = Permissions[this.role];
        return rolePermissions && 
               rolePermissions[resource] && 
               rolePermissions[resource].includes(action);
    }
    
    canEditPipeline(pipeline) {
        // Check ownership or permissions
        if (pipeline.ownerId === this.id) {
            return true;
        }
        
        return this.hasPermission('pipelines', 'update');
    }
    
    canExecutePipeline() {
        return this.hasPermission('pipelines', 'execute');
    }
    
    canManageUsers() {
        return this.role === UserRole.OWNER || this.role === UserRole.ADMIN;
    }
}

class Team {
    constructor(data) {
        this.id = data.id || crypto.randomBytes(16).toString('hex');
        this.name = data.name;
        this.ownerId = data.ownerId;
        this.plan = data.plan || 'team';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.members = new Map();
        this.pipelines = new Map();
        this.sharedResources = new Map();
        this.settings = data.settings || {
            maxMembers: licenseManager.getLimit('users'),
            dataRetention: licenseManager.getFeature('dataRetention'),
            allowExternalSharing: false,
            requireMFA: false,
            ipWhitelist: []
        };
        this.usage = {
            members: 0,
            pipelines: 0,
            executions: 0,
            storage: 0
        };
    }
    
    addMember(user) {
        if (this.members.size >= this.settings.maxMembers) {
            throw new Error(`Team member limit (${this.settings.maxMembers}) reached`);
        }
        
        user.teamId = this.id;
        this.members.set(user.id, user);
        this.usage.members = this.members.size;
        
        return user;
    }
    
    removeMember(userId) {
        const user = this.members.get(userId);
        if (user) {
            if (user.id === this.ownerId) {
                throw new Error('Cannot remove team owner');
            }
            
            this.members.delete(userId);
            this.usage.members = this.members.size;
        }
    }
    
    updateMemberRole(userId, newRole) {
        const user = this.members.get(userId);
        if (user) {
            if (user.id === this.ownerId && newRole !== UserRole.OWNER) {
                throw new Error('Cannot change owner role');
            }
            
            user.role = newRole;
        }
    }
}

class Pipeline {
    constructor(data) {
        this.id = data.id || crypto.randomBytes(16).toString('hex');
        this.name = data.name;
        this.description = data.description || '';
        this.ownerId = data.ownerId;
        this.teamId = data.teamId;
        this.nodes = data.nodes || [];
        this.connections = data.connections || [];
        this.version = data.version || 1;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.lastExecutedAt = data.lastExecutedAt || null;
        this.executionCount = data.executionCount || 0;
        this.tags = data.tags || [];
        this.visibility = data.visibility || 'private'; // private, team, public
        this.permissions = data.permissions || {};
        this.config = data.config || {};
        this.secrets = new Map(); // Encrypted secrets
    }
    
    canAccess(user) {
        // Owner always has access
        if (this.ownerId === user.id) {
            return true;
        }
        
        // Team members based on visibility
        if (this.visibility === 'team' && user.teamId === this.teamId) {
            return true;
        }
        
        // Public pipelines
        if (this.visibility === 'public') {
            return true;
        }
        
        // Specific permissions
        return this.permissions[user.id] !== undefined;
    }
    
    share(userId, permission = 'read') {
        this.permissions[userId] = permission;
    }
    
    unshare(userId) {
        delete this.permissions[userId];
    }
    
    addSecret(key, value) {
        // Encrypt secret before storing
        const encrypted = this.encryptSecret(value);
        this.secrets.set(key, encrypted);
    }
    
    encryptSecret(value) {
        // In production, use proper encryption
        const cipher = crypto.createCipher('aes-256-cbc', 'secret-key');
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    
    decryptSecret(encrypted) {
        // In production, use proper decryption
        const decipher = crypto.createDecipher('aes-256-cbc', 'secret-key');
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            ownerId: this.ownerId,
            teamId: this.teamId,
            nodes: this.nodes,
            connections: this.connections,
            version: this.version,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastExecutedAt: this.lastExecutedAt,
            executionCount: this.executionCount,
            tags: this.tags,
            visibility: this.visibility,
            config: this.config
            // Don't include secrets in JSON
        };
    }
}

class TeamCollaborationManager {
    constructor() {
        // License check moved to init() to allow singleton creation
        
        this.teams = new Map();
        this.users = new Map();
        this.pipelines = new Map();
        this.sessions = new Map();
        this.auditLog = [];
        this.licensed = false;
    }
    
    // Initialize with license check
    async init() {
        // Check license
        if (!licenseManager.initialized) {
            await licenseManager.init();
        }
        
        if (!licenseManager.canUseTeamFeatures()) {
            console.log('[TeamManager] Team features not available in current tier');
            this.licensed = false;
            return false;
        }
        
        this.licensed = true;
        console.log('[TeamManager] Team collaboration features enabled');
        return true;
    }
    
    checkLicense() {
        if (!this.licensed) {
            throw new Error('Team collaboration requires Team tier or higher');
        }
    }
    
    // Team management
    createTeam(name, ownerId) {
        this.checkLicense();
        const owner = this.users.get(ownerId);
        if (!owner) {
            throw new Error('Owner user not found');
        }
        
        const team = new Team({
            name,
            ownerId,
            plan: licenseManager.currentTier
        });
        
        this.teams.set(team.id, team);
        team.addMember(owner);
        owner.role = UserRole.OWNER;
        
        this.audit('team.created', ownerId, { teamId: team.id, name });
        
        return team;
    }
    
    getTeam(teamId) {
        return this.teams.get(teamId);
    }
    
    updateTeam(teamId, updates, userId) {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        
        const user = this.users.get(userId);
        if (!user || !user.canManageUsers()) {
            throw new Error('Insufficient permissions');
        }
        
        Object.assign(team, updates);
        this.audit('team.updated', userId, { teamId, updates });
        
        return team;
    }
    
    // User management
    createUser(userData) {
        const user = new User(userData);
        this.users.set(user.id, user);
        
        this.audit('user.created', user.id, { email: user.email });
        
        return user;
    }
    
    authenticateUser(email, password) {
        // In production, properly hash and verify password
        const user = Array.from(this.users.values()).find(u => u.email === email);
        
        if (!user || !user.active) {
            throw new Error('Invalid credentials');
        }
        
        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        this.sessions.set(sessionId, {
            userId: user.id,
            createdAt: Date.now(),
            lastActivity: Date.now()
        });
        
        user.lastLogin = new Date().toISOString();
        
        this.audit('user.login', user.id, { email });
        
        return { user, sessionId };
    }
    
    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return null;
        }
        
        // Check session timeout (24 hours)
        if (Date.now() - session.lastActivity > 24 * 60 * 60 * 1000) {
            this.sessions.delete(sessionId);
            return null;
        }
        
        session.lastActivity = Date.now();
        return this.users.get(session.userId);
    }
    
    // Pipeline management
    createPipeline(pipelineData, userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        if (!user.hasPermission('pipelines', 'create')) {
            throw new Error('Insufficient permissions');
        }
        
        const pipeline = new Pipeline({
            ...pipelineData,
            ownerId: userId,
            teamId: user.teamId
        });
        
        this.pipelines.set(pipeline.id, pipeline);
        
        // Update team usage
        if (user.teamId) {
            const team = this.teams.get(user.teamId);
            if (team) {
                team.pipelines.set(pipeline.id, pipeline);
                team.usage.pipelines = team.pipelines.size;
            }
        }
        
        this.audit('pipeline.created', userId, { 
            pipelineId: pipeline.id, 
            name: pipeline.name 
        });
        
        return pipeline;
    }
    
    updatePipeline(pipelineId, updates, userId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }
        
        const user = this.users.get(userId);
        if (!user || !user.canEditPipeline(pipeline)) {
            throw new Error('Insufficient permissions');
        }
        
        // Version control
        pipeline.version++;
        pipeline.updatedAt = new Date().toISOString();
        Object.assign(pipeline, updates);
        
        this.audit('pipeline.updated', userId, { 
            pipelineId, 
            version: pipeline.version 
        });
        
        return pipeline;
    }
    
    sharePipeline(pipelineId, targetUserId, permission, userId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }
        
        const user = this.users.get(userId);
        if (!user || !user.hasPermission('pipelines', 'share')) {
            throw new Error('Insufficient permissions');
        }
        
        pipeline.share(targetUserId, permission);
        
        this.audit('pipeline.shared', userId, { 
            pipelineId, 
            targetUserId, 
            permission 
        });
        
        return pipeline;
    }
    
    executePipeline(pipelineId, userId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }
        
        const user = this.users.get(userId);
        if (!user || !user.canExecutePipeline()) {
            throw new Error('Insufficient permissions');
        }
        
        pipeline.executionCount++;
        pipeline.lastExecutedAt = new Date().toISOString();
        
        // Update team usage
        if (user.teamId) {
            const team = this.teams.get(user.teamId);
            if (team) {
                team.usage.executions++;
            }
        }
        
        this.audit('pipeline.executed', userId, { pipelineId });
        
        return pipeline;
    }
    
    // Search and discovery
    searchPipelines(query, userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const results = [];
        
        for (const pipeline of this.pipelines.values()) {
            if (pipeline.canAccess(user)) {
                // Simple search by name and description
                if (pipeline.name.toLowerCase().includes(query.toLowerCase()) ||
                    pipeline.description.toLowerCase().includes(query.toLowerCase()) ||
                    pipeline.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))) {
                    results.push(pipeline);
                }
            }
        }
        
        return results;
    }
    
    getUserPipelines(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const pipelines = [];
        
        for (const pipeline of this.pipelines.values()) {
            if (pipeline.canAccess(user)) {
                pipelines.push(pipeline);
            }
        }
        
        return pipelines;
    }
    
    // Audit logging
    audit(action, userId, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            userId,
            details
        };
        
        this.auditLog.push(entry);
        
        // Keep only last 10000 entries
        if (this.auditLog.length > 10000) {
            this.auditLog.shift();
        }
        
        console.log(`[Audit] ${action} by ${userId}:`, details);
    }
    
    getAuditLog(filter = {}) {
        let logs = [...this.auditLog];
        
        if (filter.userId) {
            logs = logs.filter(log => log.userId === filter.userId);
        }
        
        if (filter.action) {
            logs = logs.filter(log => log.action === filter.action);
        }
        
        if (filter.from) {
            logs = logs.filter(log => new Date(log.timestamp) >= new Date(filter.from));
        }
        
        if (filter.to) {
            logs = logs.filter(log => new Date(log.timestamp) <= new Date(filter.to));
        }
        
        return logs;
    }
    
    // Statistics
    getTeamStats(teamId) {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        
        return {
            members: team.usage.members,
            pipelines: team.usage.pipelines,
            executions: team.usage.executions,
            storage: team.usage.storage,
            limits: {
                maxMembers: team.settings.maxMembers,
                dataRetention: team.settings.dataRetention
            },
            memberDetails: Array.from(team.members.values()).map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                lastLogin: u.lastLogin
            }))
        };
    }
}

// Singleton instance
const teamManager = new TeamCollaborationManager();

module.exports = {
    TeamCollaborationManager,
    teamManager,
    User,
    Team,
    Pipeline,
    UserRole,
    Permissions
};