/**
 * OmnixLang Distributed Executor
 * Scale pipeline execution across multiple workers
 * Premium feature for Team/Business/Enterprise tiers
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { licenseManager } = require('../licensing/license-manager');

// Worker node states
const WorkerState = {
    IDLE: 'idle',
    BUSY: 'busy',
    OFFLINE: 'offline',
    ERROR: 'error'
};

// Job states
const JobState = {
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

class WorkerNode {
    constructor(id, config = {}) {
        this.id = id;
        this.name = config.name || `worker-${id}`;
        this.host = config.host || 'localhost';
        this.port = config.port || 5000 + parseInt(id);
        this.capabilities = config.capabilities || ['python', 'javascript', 'sql'];
        this.maxJobs = config.maxJobs || 5;
        this.state = WorkerState.IDLE;
        this.currentJobs = new Map();
        this.stats = {
            jobsCompleted: 0,
            jobsFailed: 0,
            totalRuntime: 0,
            lastHeartbeat: Date.now()
        };
    }
    
    canAcceptJob(requirements = {}) {
        if (this.state !== WorkerState.IDLE && this.state !== WorkerState.BUSY) {
            return false;
        }
        
        if (this.currentJobs.size >= this.maxJobs) {
            return false;
        }
        
        // Check if worker has required capabilities
        if (requirements.adapters) {
            const hasAllAdapters = requirements.adapters.every(
                adapter => this.capabilities.includes(adapter)
            );
            if (!hasAllAdapters) {
                return false;
            }
        }
        
        return true;
    }
    
    assignJob(job) {
        this.currentJobs.set(job.id, job);
        this.state = this.currentJobs.size >= this.maxJobs ? WorkerState.BUSY : WorkerState.IDLE;
    }
    
    completeJob(jobId, success = true) {
        const job = this.currentJobs.get(jobId);
        if (job) {
            this.currentJobs.delete(jobId);
            
            if (success) {
                this.stats.jobsCompleted++;
            } else {
                this.stats.jobsFailed++;
            }
            
            this.stats.totalRuntime += Date.now() - job.startTime;
            this.state = this.currentJobs.size === 0 ? WorkerState.IDLE : WorkerState.BUSY;
        }
    }
    
    heartbeat() {
        this.stats.lastHeartbeat = Date.now();
        return {
            id: this.id,
            state: this.state,
            currentJobs: this.currentJobs.size,
            stats: this.stats
        };
    }
    
    isHealthy() {
        const heartbeatAge = Date.now() - this.stats.lastHeartbeat;
        return heartbeatAge < 30000; // 30 seconds
    }
}

class Job {
    constructor(nodeConfig, data = null) {
        this.id = crypto.randomBytes(16).toString('hex');
        this.nodeConfig = nodeConfig;
        this.data = data;
        this.state = JobState.PENDING;
        this.workerId = null;
        this.result = null;
        this.error = null;
        this.createdAt = Date.now();
        this.startTime = null;
        this.endTime = null;
        this.retries = 0;
        this.maxRetries = 3;
    }
    
    getRequirements() {
        return {
            adapters: [this.nodeConfig.type],
            memory: this.estimateMemory(),
            timeout: this.nodeConfig.timeout || 30000
        };
    }
    
    estimateMemory() {
        // Estimate memory based on data size and node type
        const dataSize = JSON.stringify(this.data || {}).length;
        const baseMemory = {
            'python': 100,
            'javascript': 50,
            'sql': 30,
            'transform': 20
        }[this.nodeConfig.type] || 50;
        
        return baseMemory + Math.ceil(dataSize / 1024); // MB
    }
}

class DistributedExecutor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Check license
        if (!licenseManager.canUseDistributed()) {
            throw new Error('Distributed execution requires Team tier or higher');
        }
        
        this.workers = new Map();
        this.jobQueue = [];
        this.activeJobs = new Map();
        this.completedJobs = new Map();
        this.scheduler = null;
        this.config = {
            maxWorkers: config.maxWorkers || licenseManager.getLimit('concurrentPipelines'),
            schedulingStrategy: config.schedulingStrategy || 'round-robin',
            healthCheckInterval: config.healthCheckInterval || 10000,
            jobTimeout: config.jobTimeout || 300000, // 5 minutes
            retryPolicy: config.retryPolicy || 'exponential',
            ...config
        };
        
        this.stats = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            averageRuntime: 0,
            queueLength: 0,
            activeWorkers: 0
        };
    }
    
    async init() {
        console.log('[DistributedExecutor] Initializing distributed execution system');
        
        // Start scheduler
        this.startScheduler();
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        // Initialize default workers based on license
        const workerCount = Math.min(3, this.config.maxWorkers);
        for (let i = 0; i < workerCount; i++) {
            this.addWorker(new WorkerNode(i.toString()));
        }
        
        this.emit('initialized', { workers: this.workers.size });
    }
    
    addWorker(worker) {
        if (this.workers.size >= this.config.maxWorkers) {
            throw new Error(`Maximum workers (${this.config.maxWorkers}) reached for current license`);
        }
        
        this.workers.set(worker.id, worker);
        console.log(`[DistributedExecutor] Added worker: ${worker.name}`);
        this.emit('workerAdded', { workerId: worker.id });
    }
    
    removeWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            // Reassign jobs from this worker
            for (const [jobId, job] of worker.currentJobs) {
                job.state = JobState.PENDING;
                job.workerId = null;
                this.jobQueue.push(job);
            }
            
            this.workers.delete(workerId);
            console.log(`[DistributedExecutor] Removed worker: ${worker.name}`);
            this.emit('workerRemoved', { workerId });
        }
    }
    
    async submitJob(nodeConfig, data = null) {
        // Track usage
        await licenseManager.trackUsage('apiCalls');
        
        const job = new Job(nodeConfig, data);
        this.stats.totalJobs++;
        
        // Add to queue
        this.jobQueue.push(job);
        this.activeJobs.set(job.id, job);
        
        console.log(`[DistributedExecutor] Job ${job.id} submitted for ${nodeConfig.type} node`);
        this.emit('jobSubmitted', { jobId: job.id });
        
        // Trigger scheduling
        this.scheduleJobs();
        
        return job.id;
    }
    
    async executeJob(job, worker) {
        job.state = JobState.RUNNING;
        job.startTime = Date.now();
        job.workerId = worker.id;
        
        console.log(`[DistributedExecutor] Executing job ${job.id} on worker ${worker.name}`);
        this.emit('jobStarted', { jobId: job.id, workerId: worker.id });
        
        try {
            // Simulate remote execution
            // In production, would send job to actual worker via network
            const result = await this.simulateRemoteExecution(job, worker);
            
            job.result = result;
            job.state = JobState.COMPLETED;
            job.endTime = Date.now();
            
            worker.completeJob(job.id, true);
            this.completedJobs.set(job.id, job);
            this.activeJobs.delete(job.id);
            
            this.stats.completedJobs++;
            this.updateAverageRuntime(job.endTime - job.startTime);
            
            console.log(`[DistributedExecutor] Job ${job.id} completed successfully`);
            this.emit('jobCompleted', { jobId: job.id, result });
            
            return result;
            
        } catch (error) {
            job.error = error.message;
            job.endTime = Date.now();
            
            if (job.retries < job.maxRetries) {
                // Retry job
                job.retries++;
                job.state = JobState.PENDING;
                job.workerId = null;
                this.jobQueue.push(job);
                
                console.log(`[DistributedExecutor] Job ${job.id} failed, retrying (${job.retries}/${job.maxRetries})`);
                this.emit('jobRetry', { jobId: job.id, retries: job.retries });
                
            } else {
                // Final failure
                job.state = JobState.FAILED;
                worker.completeJob(job.id, false);
                this.completedJobs.set(job.id, job);
                this.activeJobs.delete(job.id);
                
                this.stats.failedJobs++;
                
                console.error(`[DistributedExecutor] Job ${job.id} failed permanently:`, error.message);
                this.emit('jobFailed', { jobId: job.id, error: error.message });
            }
            
            throw error;
        }
    }
    
    async simulateRemoteExecution(job, worker) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        // Simulate processing based on node type
        const { adapterManager } = require('../adapters');
        
        if (!adapterManager.initialized) {
            await adapterManager.init();
        }
        
        const adapter = adapterManager.getAdapter(job.nodeConfig.type);
        const result = await adapter.execute(
            job.nodeConfig.properties.code || job.nodeConfig.properties.query || '',
            job.data
        );
        
        // Simulate return network delay
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        
        return result;
    }
    
    scheduleJobs() {
        if (this.jobQueue.length === 0) {
            return;
        }
        
        // Get available workers
        const availableWorkers = Array.from(this.workers.values())
            .filter(w => w.canAcceptJob());
        
        if (availableWorkers.length === 0) {
            return;
        }
        
        // Schedule jobs based on strategy
        switch (this.config.schedulingStrategy) {
            case 'round-robin':
                this.scheduleRoundRobin(availableWorkers);
                break;
                
            case 'least-loaded':
                this.scheduleLeastLoaded(availableWorkers);
                break;
                
            case 'capability-match':
                this.scheduleCapabilityMatch(availableWorkers);
                break;
                
            default:
                this.scheduleRoundRobin(availableWorkers);
        }
    }
    
    scheduleRoundRobin(workers) {
        let workerIndex = 0;
        
        while (this.jobQueue.length > 0 && workers.length > 0) {
            const job = this.jobQueue.shift();
            const worker = workers[workerIndex % workers.length];
            
            if (worker.canAcceptJob(job.getRequirements())) {
                job.state = JobState.ASSIGNED;
                worker.assignJob(job);
                
                // Execute job asynchronously
                this.executeJob(job, worker).catch(error => {
                    console.error(`[DistributedExecutor] Job execution error:`, error);
                });
                
                workerIndex++;
            } else {
                // Put job back in queue
                this.jobQueue.unshift(job);
                break;
            }
        }
    }
    
    scheduleLeastLoaded(workers) {
        while (this.jobQueue.length > 0) {
            const job = this.jobQueue.shift();
            
            // Find least loaded worker
            const worker = workers
                .filter(w => w.canAcceptJob(job.getRequirements()))
                .sort((a, b) => a.currentJobs.size - b.currentJobs.size)[0];
            
            if (worker) {
                job.state = JobState.ASSIGNED;
                worker.assignJob(job);
                
                this.executeJob(job, worker).catch(error => {
                    console.error(`[DistributedExecutor] Job execution error:`, error);
                });
            } else {
                // Put job back in queue
                this.jobQueue.unshift(job);
                break;
            }
        }
    }
    
    scheduleCapabilityMatch(workers) {
        const pendingJobs = [...this.jobQueue];
        this.jobQueue = [];
        
        for (const job of pendingJobs) {
            const requirements = job.getRequirements();
            
            // Find best matching worker
            const matchingWorkers = workers.filter(w => w.canAcceptJob(requirements));
            
            if (matchingWorkers.length > 0) {
                // Prefer workers with exact capability match
                const worker = matchingWorkers.sort((a, b) => {
                    const aExact = requirements.adapters.every(r => a.capabilities.includes(r));
                    const bExact = requirements.adapters.every(r => b.capabilities.includes(r));
                    return bExact - aExact;
                })[0];
                
                job.state = JobState.ASSIGNED;
                worker.assignJob(job);
                
                this.executeJob(job, worker).catch(error => {
                    console.error(`[DistributedExecutor] Job execution error:`, error);
                });
            } else {
                // Keep in queue
                this.jobQueue.push(job);
            }
        }
    }
    
    startScheduler() {
        this.scheduler = setInterval(() => {
            this.scheduleJobs();
            this.updateStats();
        }, 1000); // Schedule every second
    }
    
    startHealthMonitoring() {
        setInterval(() => {
            for (const [workerId, worker] of this.workers) {
                if (!worker.isHealthy()) {
                    console.warn(`[DistributedExecutor] Worker ${worker.name} is unhealthy`);
                    worker.state = WorkerState.OFFLINE;
                    this.emit('workerUnhealthy', { workerId });
                    
                    // Optionally remove unhealthy workers
                    if (this.config.removeUnhealthyWorkers) {
                        this.removeWorker(workerId);
                    }
                }
            }
        }, this.config.healthCheckInterval);
    }
    
    updateStats() {
        this.stats.queueLength = this.jobQueue.length;
        this.stats.activeWorkers = Array.from(this.workers.values())
            .filter(w => w.state === WorkerState.IDLE || w.state === WorkerState.BUSY).length;
    }
    
    updateAverageRuntime(runtime) {
        const total = this.stats.averageRuntime * (this.stats.completedJobs - 1) + runtime;
        this.stats.averageRuntime = total / this.stats.completedJobs;
    }
    
    getJobStatus(jobId) {
        const job = this.activeJobs.get(jobId) || this.completedJobs.get(jobId);
        
        if (!job) {
            return null;
        }
        
        return {
            id: job.id,
            state: job.state,
            workerId: job.workerId,
            result: job.result,
            error: job.error,
            createdAt: job.createdAt,
            startTime: job.startTime,
            endTime: job.endTime,
            runtime: job.endTime ? job.endTime - job.startTime : null,
            retries: job.retries
        };
    }
    
    getStats() {
        return {
            ...this.stats,
            workers: Array.from(this.workers.values()).map(w => ({
                id: w.id,
                name: w.name,
                state: w.state,
                currentJobs: w.currentJobs.size,
                stats: w.stats
            }))
        };
    }
    
    async shutdown() {
        console.log('[DistributedExecutor] Shutting down...');
        
        // Stop scheduler
        if (this.scheduler) {
            clearInterval(this.scheduler);
        }
        
        // Wait for active jobs to complete (with timeout)
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (this.activeJobs.size > 0 && Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Cancel remaining jobs
        for (const job of this.activeJobs.values()) {
            job.state = JobState.CANCELLED;
            this.emit('jobCancelled', { jobId: job.id });
        }
        
        this.emit('shutdown');
    }
}

module.exports = DistributedExecutor;