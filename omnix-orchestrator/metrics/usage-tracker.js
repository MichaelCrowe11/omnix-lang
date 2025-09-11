/**
 * OmnixLang Usage Tracker & Metrics
 * Comprehensive usage tracking for billing and analytics
 */

const EventEmitter = require('events');
const { licenseManager } = require('../licensing/license-manager');

class MetricsCollector {
    constructor() {
        this.metrics = new Map();
        this.intervals = new Map();
        this.aggregations = new Map();
    }
    
    record(metric, value = 1, tags = {}) {
        const key = this.buildKey(metric, tags);
        const timestamp = Date.now();
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        
        this.metrics.get(key).push({
            timestamp,
            value,
            tags
        });
        
        // Keep only last hour of data
        this.cleanup(key);
    }
    
    increment(metric, tags = {}) {
        this.record(metric, 1, tags);
    }
    
    gauge(metric, value, tags = {}) {
        this.record(metric, value, tags);
    }
    
    histogram(metric, value, tags = {}) {
        this.record(metric, value, tags);
    }
    
    buildKey(metric, tags) {
        const tagStr = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(',');
        
        return tagStr ? `${metric}{${tagStr}}` : metric;
    }
    
    cleanup(key) {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const data = this.metrics.get(key);
        
        if (data) {
            const filtered = data.filter(d => d.timestamp > oneHourAgo);
            this.metrics.set(key, filtered);
        }
    }
    
    getMetrics(metric, tags = {}, duration = 3600000) {
        const key = this.buildKey(metric, tags);
        const data = this.metrics.get(key) || [];
        const since = Date.now() - duration;
        
        return data.filter(d => d.timestamp > since);
    }
    
    aggregate(metric, tags = {}, aggregation = 'sum', duration = 3600000) {
        const data = this.getMetrics(metric, tags, duration);
        
        if (data.length === 0) return 0;
        
        switch (aggregation) {
            case 'sum':
                return data.reduce((sum, d) => sum + d.value, 0);
                
            case 'avg':
                return data.reduce((sum, d) => sum + d.value, 0) / data.length;
                
            case 'min':
                return Math.min(...data.map(d => d.value));
                
            case 'max':
                return Math.max(...data.map(d => d.value));
                
            case 'count':
                return data.length;
                
            case 'p95':
                const sorted = data.map(d => d.value).sort((a, b) => a - b);
                const index = Math.floor(sorted.length * 0.95);
                return sorted[index];
                
            default:
                return 0;
        }
    }
}

class UsageTracker extends EventEmitter {
    constructor() {
        super();
        this.collector = new MetricsCollector();
        this.usage = new Map();
        this.costs = new Map();
        this.alerts = [];
        this.initialized = false;
        
        // Pricing model (per unit)
        this.pricing = {
            execution: 0.001,      // per execution
            storage: 0.0001,       // per MB per day
            apiCalls: 0.00001,     // per API call
            dataTransfer: 0.00001, // per MB
            computeTime: 0.0001,   // per second
            workers: 0.01          // per worker hour
        };
    }
    
    async init() {
        console.log('[UsageTracker] Initializing usage tracking');
        
        // Start periodic aggregation
        this.startAggregation();
        
        // Start cost calculation
        this.startCostCalculation();
        
        // Start alert monitoring
        this.startAlertMonitoring();
        
        this.initialized = true;
    }
    
    // Track different types of usage
    trackExecution(pipelineId, userId, duration, nodeCount) {
        const tags = { 
            pipelineId, 
            userId, 
            tier: licenseManager.currentTier 
        };
        
        // Record metrics
        this.collector.increment('pipeline.executions', tags);
        this.collector.histogram('pipeline.duration', duration, tags);
        this.collector.gauge('pipeline.nodes', nodeCount, tags);
        
        // Track compute time
        this.collector.histogram('compute.time', duration / 1000, tags);
        
        // Update usage
        this.updateDailyUsage('executions', 1);
        this.updateDailyUsage('computeTime', duration / 1000);
        
        // Check limits
        this.checkLimits('maxExecutions');
        
        this.emit('execution', {
            pipelineId,
            userId,
            duration,
            nodeCount
        });
    }
    
    trackAPICall(endpoint, method, userId, responseTime, statusCode) {
        const tags = {
            endpoint,
            method,
            userId,
            statusCode: Math.floor(statusCode / 100) + 'xx'
        };
        
        this.collector.increment('api.calls', tags);
        this.collector.histogram('api.latency', responseTime, tags);
        
        if (statusCode >= 400) {
            this.collector.increment('api.errors', tags);
        }
        
        this.updateDailyUsage('apiCalls', 1);
        
        // Check API rate limits
        this.checkLimits('apiCalls');
    }
    
    trackStorage(userId, sizeBytes, operation = 'write') {
        const sizeMB = sizeBytes / (1024 * 1024);
        const tags = { userId, operation };
        
        this.collector.gauge('storage.used', sizeMB, tags);
        this.collector.increment(`storage.${operation}`, tags);
        
        this.updateDailyUsage('storage', sizeMB);
        
        // Check storage limits
        this.checkLimits('storage');
    }
    
    trackDataTransfer(direction, sizeBytes, userId) {
        const sizeMB = sizeBytes / (1024 * 1024);
        const tags = { direction, userId };
        
        this.collector.histogram('data.transfer', sizeMB, tags);
        
        this.updateDailyUsage('dataTransfer', sizeMB);
    }
    
    trackWorker(workerId, state, duration) {
        const tags = { workerId, state };
        
        this.collector.gauge('workers.active', state === 'busy' ? 1 : 0, tags);
        
        if (duration) {
            const hours = duration / 3600000;
            this.collector.histogram('workers.runtime', hours, tags);
            this.updateDailyUsage('workers', hours);
        }
    }
    
    trackError(type, message, userId) {
        const tags = { type, userId };
        
        this.collector.increment('errors', tags);
        
        this.emit('error', {
            type,
            message,
            userId,
            timestamp: new Date().toISOString()
        });
    }
    
    // Update daily usage counters
    updateDailyUsage(metric, value) {
        const today = new Date().toISOString().split('T')[0];
        const key = `${today}:${metric}`;
        
        const current = this.usage.get(key) || 0;
        this.usage.set(key, current + value);
        
        // Also track with license manager
        try {
            licenseManager.trackUsage(metric, value);
        } catch (error) {
            this.emit('limitExceeded', { metric, error: error.message });
        }
    }
    
    // Check usage limits
    checkLimits(metric) {
        const limit = licenseManager.getLimit(metric);
        if (limit === Infinity) return;
        
        const today = new Date().toISOString().split('T')[0];
        const key = `${today}:${metric}`;
        const current = this.usage.get(key) || 0;
        
        const percentage = (current / limit) * 100;
        
        // Alert at different thresholds
        if (percentage >= 100) {
            this.createAlert('error', `${metric} limit exceeded`, {
                current,
                limit,
                percentage
            });
        } else if (percentage >= 90) {
            this.createAlert('warning', `${metric} approaching limit (${percentage.toFixed(1)}%)`, {
                current,
                limit,
                percentage
            });
        } else if (percentage >= 75) {
            this.createAlert('info', `${metric} at ${percentage.toFixed(1)}% of limit`, {
                current,
                limit,
                percentage
            });
        }
    }
    
    // Cost calculation
    calculateCosts(period = 'daily') {
        const costs = {};
        const multiplier = period === 'monthly' ? 30 : 1;
        
        // Get today's usage
        const today = new Date().toISOString().split('T')[0];
        
        Object.entries(this.pricing).forEach(([metric, price]) => {
            const key = `${today}:${metric}`;
            const usage = this.usage.get(key) || 0;
            costs[metric] = usage * price * multiplier;
        });
        
        costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
        
        return costs;
    }
    
    // Get comprehensive usage report
    getUsageReport(startDate, endDate) {
        const report = {
            period: {
                start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: endDate || new Date().toISOString()
            },
            tier: licenseManager.currentTier,
            limits: licenseManager.getInfo().limits,
            usage: {},
            metrics: {},
            costs: {},
            trends: {}
        };
        
        // Aggregate usage data
        for (const [key, value] of this.usage) {
            const [date, metric] = key.split(':');
            
            if (!report.usage[metric]) {
                report.usage[metric] = {};
            }
            
            report.usage[metric][date] = value;
        }
        
        // Calculate metrics
        report.metrics = {
            executions: this.collector.aggregate('pipeline.executions', {}, 'count'),
            avgDuration: this.collector.aggregate('pipeline.duration', {}, 'avg'),
            p95Duration: this.collector.aggregate('pipeline.duration', {}, 'p95'),
            apiCalls: this.collector.aggregate('api.calls', {}, 'count'),
            avgLatency: this.collector.aggregate('api.latency', {}, 'avg'),
            errors: this.collector.aggregate('errors', {}, 'count'),
            storage: this.collector.aggregate('storage.used', {}, 'max')
        };
        
        // Calculate costs
        report.costs = this.calculateCosts('monthly');
        
        // Calculate trends (compare to previous period)
        const currentPeriod = this.collector.aggregate('pipeline.executions', {}, 'count', 7 * 24 * 60 * 60 * 1000);
        const previousPeriod = this.collector.aggregate('pipeline.executions', {}, 'count', 14 * 24 * 60 * 60 * 1000) - currentPeriod;
        
        report.trends = {
            executions: previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0,
            growth: currentPeriod > previousPeriod ? 'up' : 'down'
        };
        
        return report;
    }
    
    // Alert management
    createAlert(level, message, details = {}) {
        const alert = {
            id: Date.now().toString(),
            level,
            message,
            details,
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        
        this.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        
        this.emit('alert', alert);
        
        console.log(`[Alert] ${level.toUpperCase()}: ${message}`);
    }
    
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
        }
    }
    
    getAlerts(filter = {}) {
        let alerts = [...this.alerts];
        
        if (filter.level) {
            alerts = alerts.filter(a => a.level === filter.level);
        }
        
        if (filter.acknowledged !== undefined) {
            alerts = alerts.filter(a => a.acknowledged === filter.acknowledged);
        }
        
        return alerts;
    }
    
    // Periodic tasks
    startAggregation() {
        // Aggregate metrics every minute
        setInterval(() => {
            this.aggregateMetrics();
        }, 60000);
    }
    
    startCostCalculation() {
        // Calculate costs every hour
        setInterval(() => {
            const costs = this.calculateCosts();
            this.emit('costs', costs);
            
            // Store historical costs
            const timestamp = new Date().toISOString();
            this.costs.set(timestamp, costs);
        }, 3600000);
    }
    
    startAlertMonitoring() {
        // Check for anomalies every 5 minutes
        setInterval(() => {
            this.checkAnomalies();
        }, 300000);
    }
    
    aggregateMetrics() {
        const aggregations = {
            'pipeline.success_rate': () => {
                const total = this.collector.aggregate('pipeline.executions', {}, 'count', 3600000);
                const errors = this.collector.aggregate('errors', { type: 'pipeline' }, 'count', 3600000);
                return total > 0 ? ((total - errors) / total) * 100 : 100;
            },
            'api.error_rate': () => {
                const total = this.collector.aggregate('api.calls', {}, 'count', 3600000);
                const errors = this.collector.aggregate('api.errors', {}, 'count', 3600000);
                return total > 0 ? (errors / total) * 100 : 0;
            },
            'system.health': () => {
                const successRate = aggregations['pipeline.success_rate']();
                const errorRate = aggregations['api.error_rate']();
                return successRate > 95 && errorRate < 5 ? 'healthy' : 'degraded';
            }
        };
        
        Object.entries(aggregations).forEach(([metric, calculator]) => {
            const value = calculator();
            this.collector.gauge(metric, value);
        });
    }
    
    checkAnomalies() {
        // Check for unusual patterns
        const recentErrors = this.collector.aggregate('errors', {}, 'count', 300000); // Last 5 min
        const avgErrors = this.collector.aggregate('errors', {}, 'avg', 3600000); // Last hour
        
        if (recentErrors > avgErrors * 3) {
            this.createAlert('warning', 'Unusual error spike detected', {
                recent: recentErrors,
                average: avgErrors
            });
        }
        
        // Check for performance degradation
        const recentLatency = this.collector.aggregate('api.latency', {}, 'p95', 300000);
        const avgLatency = this.collector.aggregate('api.latency', {}, 'p95', 3600000);
        
        if (recentLatency > avgLatency * 2) {
            this.createAlert('warning', 'Performance degradation detected', {
                recent: recentLatency,
                average: avgLatency
            });
        }
    }
    
    // Export metrics for monitoring systems
    exportPrometheus() {
        const lines = [];
        
        for (const [key, data] of this.collector.metrics) {
            if (data.length > 0) {
                const latest = data[data.length - 1];
                const [metric, tags] = key.split('{');
                
                lines.push(`# TYPE ${metric} gauge`);
                lines.push(`${key} ${latest.value} ${latest.timestamp}`);
            }
        }
        
        return lines.join('\n');
    }
    
    exportJSON() {
        const metrics = {};
        
        for (const [key, data] of this.collector.metrics) {
            metrics[key] = data;
        }
        
        return {
            timestamp: new Date().toISOString(),
            tier: licenseManager.currentTier,
            metrics,
            usage: Object.fromEntries(this.usage),
            costs: this.calculateCosts(),
            alerts: this.alerts
        };
    }
}

// Singleton instance
const usageTracker = new UsageTracker();

module.exports = {
    UsageTracker,
    usageTracker,
    MetricsCollector
};