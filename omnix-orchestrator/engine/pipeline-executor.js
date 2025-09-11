/**
 * OmnixLang Pipeline Executor
 * Executes visual pipelines from the Graph IDE
 */

const { adapterManager } = require('../adapters');
const EventEmitter = require('events');

class PipelineExecutor extends EventEmitter {
    constructor() {
        super();
        this.running = false;
        this.currentPipeline = null;
        this.executionLog = [];
        this.nodeResults = new Map();
    }
    
    async init() {
        // Initialize adapter manager
        if (!adapterManager.initialized) {
            await adapterManager.init();
        }
        console.log('[PipelineExecutor] Initialized');
    }
    
    /**
     * Execute a pipeline with nodes and connections
     * @param {Object} pipeline - Pipeline configuration from Graph IDE
     */
    async execute(pipeline) {
        if (this.running) {
            throw new Error('Pipeline already running');
        }
        
        this.running = true;
        this.currentPipeline = pipeline;
        this.executionLog = [];
        this.nodeResults.clear();
        
        try {
            await this.init();
            
            this.emit('start', { pipeline: pipeline.name || 'Unnamed Pipeline' });
            this.log('info', 'Pipeline execution started');
            
            // Build execution order (topological sort)
            const executionOrder = this.buildExecutionOrder(pipeline.nodes, pipeline.connections);
            this.log('info', `Execution order: ${executionOrder.map(n => n.type).join(' → ')}`);
            
            // Execute nodes in order
            for (const node of executionOrder) {
                await this.executeNode(node, pipeline.connections);
            }
            
            this.log('success', 'Pipeline completed successfully');
            this.emit('complete', { results: this.nodeResults });
            
            return {
                success: true,
                results: Object.fromEntries(this.nodeResults),
                logs: this.executionLog
            };
            
        } catch (error) {
            this.log('error', `Pipeline failed: ${error.message}`);
            this.emit('error', { error: error.message });
            
            return {
                success: false,
                error: error.message,
                logs: this.executionLog
            };
            
        } finally {
            this.running = false;
            this.currentPipeline = null;
        }
    }
    
    /**
     * Execute a single node
     */
    async executeNode(node, connections) {
        this.log('info', `Executing ${node.type} node (${node.id})`);
        this.emit('nodeStart', { node });
        
        try {
            // Get input data from connected nodes
            const inputData = this.getNodeInput(node, connections);
            
            let result;
            
            switch (node.type) {
                case 'input':
                    result = await this.executeInputNode(node);
                    break;
                    
                case 'python':
                    result = await this.executePythonNode(node, inputData);
                    break;
                    
                case 'javascript':
                    result = await this.executeJavaScriptNode(node, inputData);
                    break;
                    
                case 'sql':
                    result = await this.executeSQLNode(node, inputData);
                    break;
                    
                case 'transform':
                    result = await this.executeTransformNode(node, inputData);
                    break;
                    
                case 'output':
                    result = await this.executeOutputNode(node, inputData);
                    break;
                    
                default:
                    throw new Error(`Unknown node type: ${node.type}`);
            }
            
            // Store result
            this.nodeResults.set(node.id, result);
            
            this.log('success', `Node ${node.id} completed`);
            this.emit('nodeComplete', { node, result });
            
            return result;
            
        } catch (error) {
            this.log('error', `Node ${node.id} failed: ${error.message}`);
            this.emit('nodeError', { node, error: error.message });
            throw error;
        }
    }
    
    /**
     * Execute input node - load data from source
     */
    async executeInputNode(node) {
        const { source, path, format } = node.properties;
        
        this.log('info', `Loading ${format} data from ${source}: ${path}`);
        
        // Simulate data loading
        const mockData = [
            { id: 1, value: 100, timestamp: '2024-01-20 10:00:00', category: 'A' },
            { id: 2, value: 150, timestamp: '2024-01-20 11:00:00', category: 'B' },
            { id: 3, value: 120, timestamp: '2024-01-20 12:00:00', category: 'A' },
            { id: 4, value: 180, timestamp: '2024-01-20 13:00:00', category: 'C' },
            { id: 5, value: 140, timestamp: '2024-01-20 14:00:00', category: 'B' }
        ];
        
        return {
            data: mockData,
            metadata: {
                source,
                path,
                format,
                recordCount: mockData.length
            }
        };
    }
    
    /**
     * Execute Python node
     */
    async executePythonNode(node, inputData) {
        const code = node.properties.code || '';
        const adapter = adapterManager.getAdapter('python');
        
        // Extract data from input
        const data = inputData?.data || inputData;
        
        const result = await adapter.execute(code, data);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data;
    }
    
    /**
     * Execute JavaScript node
     */
    async executeJavaScriptNode(node, inputData) {
        const code = node.properties.code || '';
        const adapter = adapterManager.getAdapter('javascript');
        
        // Extract data from input
        const data = inputData?.data || inputData;
        
        const result = await adapter.execute(code, data);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data;
    }
    
    /**
     * Execute SQL node
     */
    async executeSQLNode(node, inputData) {
        const query = node.properties.query || '';
        const adapter = adapterManager.getAdapter('sql');
        
        const result = await adapter.execute(query, inputData);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data;
    }
    
    /**
     * Execute transform node
     */
    async executeTransformNode(node, inputData) {
        const { operation, config } = node.properties;
        const data = inputData?.data || inputData;
        
        this.log('info', `Applying ${operation} transformation`);
        
        switch (operation) {
            case 'filter':
                // Parse config as filter conditions
                return data.filter(row => row.value > 100);
                
            case 'aggregate':
                // Simple aggregation
                return {
                    count: data.length,
                    sum: data.reduce((sum, row) => sum + (row.value || 0), 0),
                    avg: data.reduce((sum, row) => sum + (row.value || 0), 0) / data.length
                };
                
            case 'sort':
                return [...data].sort((a, b) => a.value - b.value);
                
            default:
                return data;
        }
    }
    
    /**
     * Execute output node - save results
     */
    async executeOutputNode(node, inputData) {
        const { destination, path, format } = node.properties;
        const data = inputData?.data || inputData;
        
        this.log('info', `Saving ${format} data to ${destination}: ${path}`);
        
        // Simulate saving
        return {
            success: true,
            destination,
            path,
            format,
            recordCount: Array.isArray(data) ? data.length : 1,
            data: data // Keep data for inspection
        };
    }
    
    /**
     * Get input data for a node from its connections
     */
    getNodeInput(node, connections) {
        // Find connections where this node is the target
        const inputConnection = connections.find(c => c.to.id === node.id);
        
        if (!inputConnection) {
            return null;
        }
        
        // Get result from source node
        return this.nodeResults.get(inputConnection.from.id);
    }
    
    /**
     * Build execution order using topological sort
     */
    buildExecutionOrder(nodes, connections) {
        const graph = new Map();
        const inDegree = new Map();
        
        // Initialize graph
        nodes.forEach(node => {
            graph.set(node.id, []);
            inDegree.set(node.id, 0);
        });
        
        // Build adjacency list and count in-degrees
        connections.forEach(conn => {
            graph.get(conn.from.id).push(conn.to.id);
            inDegree.set(conn.to.id, inDegree.get(conn.to.id) + 1);
        });
        
        // Topological sort using Kahn's algorithm
        const queue = [];
        const result = [];
        
        // Find nodes with no incoming edges
        nodes.forEach(node => {
            if (inDegree.get(node.id) === 0) {
                queue.push(node);
            }
        });
        
        while (queue.length > 0) {
            const node = queue.shift();
            result.push(node);
            
            // Process neighbors
            graph.get(node.id).forEach(neighborId => {
                inDegree.set(neighborId, inDegree.get(neighborId) - 1);
                
                if (inDegree.get(neighborId) === 0) {
                    const neighborNode = nodes.find(n => n.id === neighborId);
                    queue.push(neighborNode);
                }
            });
        }
        
        // Check for cycles
        if (result.length !== nodes.length) {
            throw new Error('Pipeline contains cycles');
        }
        
        return result;
    }
    
    /**
     * Add log entry
     */
    log(level, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message
        };
        
        this.executionLog.push(entry);
        this.emit('log', entry);
        
        console.log(`[PipelineExecutor] ${level.toUpperCase()}: ${message}`);
    }
    
    /**
     * Stop running pipeline
     */
    async stop() {
        if (this.running) {
            this.running = false;
            this.log('warning', 'Pipeline stopped by user');
            this.emit('stopped');
        }
    }
}

module.exports = PipelineExecutor;