/**
 * OmnixLang Premium Orchestrator
 * Integrated platform with licensing, distributed execution, and team features
 */

const PipelineExecutor = require('./engine/pipeline-executor');
const DistributedExecutor = require('./distributed/distributed-executor');
const { licenseManager } = require('./licensing/license-manager');
const { teamManager } = require('./collaboration/team-manager');
const { usageTracker } = require('./metrics/usage-tracker');
const { adapterManager } = require('./adapters');
const EventEmitter = require('events');

class PremiumOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            licenseFile: config.licenseFile || process.env.OMNIX_LICENSE_FILE,
            licenseKey: config.licenseKey || process.env.OMNIX_LICENSE_KEY,
            mode: config.mode || 'auto', // auto, local, distributed
            ...config
        };
        
        this.executor = null;
        this.initialized = false;
        this.stats = {
            startTime: Date.now(),
            pipelinesExecuted: 0,
            totalRuntime: 0,
            errors: 0
        };
    }
    
    async init() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 OmnixLang Premium Orchestrator');
        console.log('='.repeat(60));
        
        // Initialize license manager
        await this.initLicense();
        
        // Initialize adapters
        await adapterManager.init();
        
        // Initialize usage tracking
        await usageTracker.init();
        
        // Initialize executor based on license
        await this.initExecutor();
        
        // Setup event forwarding
        this.setupEventForwarding();
        
        this.initialized = true;
        
        console.log('✅ Orchestrator initialized successfully');
        console.log('='.repeat(60) + '\n');
        
        this.emit('initialized', this.getSystemInfo());
    }
    
    async initLicense() {
        console.log('📋 Initializing license system...');
        
        await licenseManager.init(this.config.licenseFile);
        
        const info = licenseManager.getInfo();
        console.log(`  Tier: ${info.tierName} (${info.tier})`);
        console.log(`  Features: ${Object.entries(info.features)
            .filter(([k, v]) => v === true)
            .map(([k]) => k)
            .slice(0, 5)
            .join(', ')}...`);
        console.log(`  Limits: ${JSON.stringify(info.limits)}`);
        
        if (info.license) {
            console.log(`  License ID: ${info.license.id}`);
            console.log(`  Expires: ${info.license.expiresAt}`);
        }
    }
    
    async initExecutor() {
        console.log('⚙️  Initializing execution engine...');
        
        // Determine execution mode
        let mode = this.config.mode;
        
        if (mode === 'auto') {
            mode = licenseManager.canUseDistributed() ? 'distributed' : 'local';
        }
        
        if (mode === 'distributed' && !licenseManager.canUseDistributed()) {
            console.warn('  ⚠️  Distributed execution not available in current tier');
            mode = 'local';
        }
        
        // Create executor
        if (mode === 'distributed') {
            console.log('  Mode: Distributed (premium)');
            this.executor = new DistributedExecutor({
                maxWorkers: licenseManager.getLimit('concurrentPipelines')
            });
            await this.executor.init();
        } else {
            console.log('  Mode: Local (standard)');
            this.executor = new PipelineExecutor();
            await this.executor.init();
        }
        
        this.mode = mode;
    }
    
    setupEventForwarding() {
        // Forward executor events
        if (this.executor) {
            this.executor.on('log', (entry) => this.emit('log', entry));
            this.executor.on('start', (data) => this.emit('pipelineStart', data));
            this.executor.on('complete', (data) => this.emit('pipelineComplete', data));
            this.executor.on('error', (data) => this.emit('pipelineError', data));
            this.executor.on('nodeStart', (data) => this.emit('nodeStart', data));
            this.executor.on('nodeComplete', (data) => this.emit('nodeComplete', data));
        }
        
        // Forward usage tracker events
        usageTracker.on('limitExceeded', (data) => {
            console.error(`⚠️  Limit exceeded: ${data.metric}`);
            this.emit('limitExceeded', data);
        });
        
        usageTracker.on('alert', (alert) => {
            console.warn(`🔔 Alert: ${alert.message}`);
            this.emit('alert', alert);
        });
    }
    
    // Pipeline execution with license checks
    async executePipeline(pipeline, options = {}) {
        if (!this.initialized) {
            await this.init();
        }
        
        const userId = options.userId || 'system';
        
        // Check permissions if team features enabled
        if (licenseManager.canUseTeamFeatures() && userId !== 'system') {
            const user = teamManager.users.get(userId);
            if (!user || !user.canExecutePipeline()) {
                throw new Error('Insufficient permissions to execute pipeline');
            }
        }
        
        // Track execution
        const startTime = Date.now();
        
        try {
            // Check execution limits
            await licenseManager.trackUsage('executions', 1);
            
            // Track in usage system
            usageTracker.trackExecution(
                pipeline.id || 'unnamed',
                userId,
                0, // Duration updated later
                pipeline.nodes.length
            );
            
            // Execute based on mode
            let result;
            
            if (this.mode === 'distributed') {
                // Submit jobs to distributed executor
                result = await this.executeDistributed(pipeline, options);
            } else {
                // Execute locally
                result = await this.executor.execute(pipeline);
            }
            
            // Update metrics
            const duration = Date.now() - startTime;
            this.stats.pipelinesExecuted++;
            this.stats.totalRuntime += duration;
            
            // Track completion
            usageTracker.trackExecution(
                pipeline.id || 'unnamed',
                userId,
                duration,
                pipeline.nodes.length
            );
            
            // Record in team system if applicable
            if (licenseManager.canUseTeamFeatures() && pipeline.id) {
                teamManager.executePipeline(pipeline.id, userId);
            }
            
            return result;
            
        } catch (error) {
            this.stats.errors++;
            
            // Track error
            usageTracker.trackError('pipeline', error.message, userId);
            
            throw error;
        }
    }
    
    async executeDistributed(pipeline, options) {
        const jobs = [];
        const results = new Map();
        
        // Submit each node as a job
        for (const node of pipeline.nodes) {
            const inputData = this.getNodeInput(node, pipeline.connections, results);
            const jobId = await this.executor.submitJob(node, inputData);
            
            jobs.push({
                nodeId: node.id,
                jobId
            });
        }
        
        // Wait for all jobs to complete
        const jobResults = await Promise.all(
            jobs.map(async ({ nodeId, jobId }) => {
                // Poll for job completion
                let status;
                do {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    status = this.executor.getJobStatus(jobId);
                } while (status && status.state !== 'completed' && status.state !== 'failed');
                
                if (status.state === 'failed') {
                    throw new Error(`Node ${nodeId} failed: ${status.error}`);
                }
                
                results.set(nodeId, status.result);
                return { nodeId, result: status.result };
            })
        );
        
        return {
            success: true,
            results: Object.fromEntries(jobResults.map(r => [r.nodeId, r.result]))
        };
    }
    
    getNodeInput(node, connections, results) {
        const inputConnection = connections.find(c => c.to.id === node.id);
        
        if (!inputConnection) {
            return null;
        }
        
        return results.get(inputConnection.from.id);
    }
    
    // Team collaboration features
    async createTeam(name, ownerEmail, ownerName) {
        if (!licenseManager.canUseTeamFeatures()) {
            throw new Error('Team features require Team tier or higher');
        }
        
        // Create owner user
        const owner = teamManager.createUser({
            email: ownerEmail,
            name: ownerName
        });
        
        // Create team
        const team = teamManager.createTeam(name, owner.id);
        
        return team;
    }
    
    async addTeamMember(teamId, userData, invitedBy) {
        if (!licenseManager.canUseTeamFeatures()) {
            throw new Error('Team features require Team tier or higher');
        }
        
        const team = teamManager.getTeam(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        
        const inviter = teamManager.users.get(invitedBy);
        if (!inviter || !inviter.canManageUsers()) {
            throw new Error('Insufficient permissions');
        }
        
        const user = teamManager.createUser(userData);
        team.addMember(user);
        
        return user;
    }
    
    async createSharedPipeline(pipelineData, userId) {
        if (!licenseManager.canUseTeamFeatures()) {
            throw new Error('Team features require Team tier or higher');
        }
        
        return teamManager.createPipeline(pipelineData, userId);
    }
    
    // License management
    async upgradeLicense(newLicenseKey) {
        await licenseManager.validateLicenseKey(newLicenseKey);
        
        // Reinitialize executor if tier changed
        const oldTier = licenseManager.currentTier;
        
        if (licenseManager.currentTier !== oldTier) {
            console.log(`📈 License upgraded from ${oldTier} to ${licenseManager.currentTier}`);
            await this.initExecutor();
        }
        
        this.emit('licenseUpgraded', licenseManager.getInfo());
    }
    
    generateLicense(tier, organization) {
        // Only enterprise admins can generate licenses
        if (!licenseManager.isEnterprise()) {
            throw new Error('License generation requires Enterprise tier');
        }
        
        return licenseManager.generateLicense(tier, {
            organization,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });
    }
    
    // Usage and metrics
    getUsageReport(startDate, endDate) {
        return usageTracker.getUsageReport(startDate, endDate);
    }
    
    getUsageStats() {
        return licenseManager.getUsageStats();
    }
    
    getMetrics() {
        return {
            system: this.stats,
            executor: this.executor && this.executor.getStats ? this.executor.getStats() : null,
            usage: usageTracker.exportJSON(),
            license: licenseManager.getInfo()
        };
    }
    
    getSystemInfo() {
        return {
            version: '0.1.0',
            tier: licenseManager.currentTier,
            tierName: licenseManager.getInfo().tierName,
            mode: this.mode,
            features: {
                distributed: licenseManager.canUseDistributed(),
                teamCollaboration: licenseManager.canUseTeamFeatures(),
                scheduling: licenseManager.canUseScheduling(),
                sso: licenseManager.canUseSSO(),
                customConnectors: licenseManager.canUseCustomConnectors()
            },
            limits: licenseManager.getInfo().limits,
            adapters: adapterManager.listAdapters().map(a => a.name),
            uptime: Date.now() - this.stats.startTime
        };
    }
    
    // Shutdown
    async shutdown() {
        console.log('🛑 Shutting down orchestrator...');
        
        if (this.executor) {
            if (this.mode === 'distributed') {
                await this.executor.shutdown();
            }
        }
        
        this.emit('shutdown');
    }
}

// Example usage and testing
async function testPremiumFeatures() {
    console.log('\n📋 Testing OmnixLang Premium Features\n');
    
    const orchestrator = new PremiumOrchestrator({
        mode: 'auto'
    });
    
    // Listen to events
    orchestrator.on('alert', (alert) => {
        console.log(`🔔 Alert: ${alert.message}`);
    });
    
    orchestrator.on('limitExceeded', (data) => {
        console.log(`⚠️  Limit exceeded: ${data.metric}`);
    });
    
    try {
        // Initialize
        await orchestrator.init();
        
        // Show system info
        const info = orchestrator.getSystemInfo();
        console.log('\n📊 System Information:');
        console.log(`  Version: ${info.version}`);
        console.log(`  Tier: ${info.tierName}`);
        console.log(`  Mode: ${info.mode}`);
        console.log(`  Features:`, info.features);
        
        // Test pipeline execution
        console.log('\n🔄 Testing Pipeline Execution...');
        
        const testPipeline = {
            id: 'test-premium',
            name: 'Premium Test Pipeline',
            nodes: [
                {
                    id: 1,
                    type: 'javascript',
                    properties: {
                        code: 'return [1, 2, 3, 4, 5];'
                    }
                },
                {
                    id: 2,
                    type: 'javascript',
                    properties: {
                        code: 'return data.map(x => x * 2);'
                    }
                }
            ],
            connections: [
                { from: { id: 1 }, to: { id: 2 } }
            ]
        };
        
        const result = await orchestrator.executePipeline(testPipeline, {
            userId: 'test-user'
        });
        
        console.log('✅ Pipeline executed successfully');
        console.log('  Result:', result.results);
        
        // Show usage report
        console.log('\n📈 Usage Report:');
        const usage = orchestrator.getUsageStats();
        console.log('  Tier:', usage.tier);
        console.log('  Usage:', usage.usage);
        console.log('  Remaining:', usage.remaining);
        
        // Show metrics
        console.log('\n📊 Metrics:');
        const metrics = orchestrator.getMetrics();
        console.log('  Pipelines Executed:', metrics.system.pipelinesExecuted);
        console.log('  Total Runtime:', metrics.system.totalRuntime, 'ms');
        console.log('  Errors:', metrics.system.errors);
        
        // Test license upgrade (simulation)
        console.log('\n🔑 Testing License System...');
        
        // Generate a team license key
        const teamKey = 'OMNIX-T1234-56789-ABCDE-FGHIJ';
        
        try {
            await orchestrator.upgradeLicense(teamKey);
            console.log('✅ License upgraded successfully');
        } catch (error) {
            console.log('ℹ️  License upgrade simulation:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await orchestrator.shutdown();
    }
}

// Export module
module.exports = PremiumOrchestrator;

// Run tests if executed directly
if (require.main === module) {
    testPremiumFeatures().catch(console.error);
}