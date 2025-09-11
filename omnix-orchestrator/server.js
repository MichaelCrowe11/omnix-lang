/**
 * OmnixLang Orchestrator Server
 * HTTP API and WebSocket server for the Graph IDE
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const PipelineExecutor = require('./engine/pipeline-executor');
const { adapterManager } = require('./adapters');

class OrchestratorServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.executors = new Map(); // Active pipeline executions
        this.connections = new Map(); // WebSocket connections
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }
    
    setupMiddleware() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: false, // Allow inline scripts for development
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        }));
        
        // Compression
        this.app.use(compression());
        
        // Logging
        this.app.use(morgan('combined'));
        
        // JSON parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Static files (serve the Graph IDE)
        this.app.use('/ide', express.static(path.join(__dirname, 'ide')));
        this.app.use('/', express.static(path.join(__dirname, 'ide')));
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '0.1.0',
                adapters: adapterManager.listAdapters().length
            });
        });
        
        // Get adapter information
        this.app.get('/api/adapters', async (req, res) => {
            try {
                if (!adapterManager.initialized) {
                    await adapterManager.init();
                }
                
                const adapters = adapterManager.listAdapters();
                res.json({ adapters });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Validate code
        this.app.post('/api/validate', async (req, res) => {
            try {
                const { type, code } = req.body;
                
                if (!type || !code) {
                    return res.status(400).json({ 
                        error: 'Missing required fields: type, code' 
                    });
                }
                
                const result = await adapterManager.validate(type, code);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Execute single node
        this.app.post('/api/execute', async (req, res) => {
            try {
                const { type, code, data } = req.body;
                
                if (!type || !code) {
                    return res.status(400).json({ 
                        error: 'Missing required fields: type, code' 
                    });
                }
                
                const result = await adapterManager.execute(type, code, data);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Execute pipeline
        this.app.post('/api/pipeline/execute', async (req, res) => {
            try {
                const pipeline = req.body;
                
                if (!pipeline.nodes || !pipeline.connections) {
                    return res.status(400).json({ 
                        error: 'Invalid pipeline: missing nodes or connections' 
                    });
                }
                
                const executionId = uuidv4();
                const executor = new PipelineExecutor();
                
                // Store executor
                this.executors.set(executionId, executor);
                
                // Set up event forwarding via WebSocket
                this.setupExecutorEvents(executor, executionId);
                
                // Start execution
                const result = await executor.execute(pipeline);
                
                // Clean up
                this.executors.delete(executionId);
                
                res.json({
                    executionId,
                    ...result
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Stop pipeline
        this.app.post('/api/pipeline/stop/:executionId', (req, res) => {
            const { executionId } = req.params;
            const executor = this.executors.get(executionId);
            
            if (executor) {
                executor.stop();
                res.json({ message: 'Pipeline stopped' });
            } else {
                res.status(404).json({ error: 'Execution not found' });
            }
        });
        
        // Get execution status
        this.app.get('/api/pipeline/status/:executionId', (req, res) => {
            const { executionId } = req.params;
            const executor = this.executors.get(executionId);
            
            if (executor) {
                res.json({
                    executionId,
                    running: executor.running,
                    logs: executor.executionLog
                });
            } else {
                res.status(404).json({ error: 'Execution not found' });
            }
        });
        
        // Serve Graph IDE at root
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'ide', 'graph-editor.html'));
        });
        
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });
        
        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const connectionId = uuidv4();
            this.connections.set(connectionId, ws);
            
            console.log(`[WebSocket] New connection: ${connectionId}`);
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                connectionId,
                timestamp: new Date().toISOString()
            }));
            
            // Handle messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(ws, connectionId, message);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Invalid JSON message'
                    }));
                }
            });
            
            // Handle disconnection
            ws.on('close', () => {
                console.log(`[WebSocket] Connection closed: ${connectionId}`);
                this.connections.delete(connectionId);
            });
            
            ws.on('error', (error) => {
                console.error(`[WebSocket] Connection error ${connectionId}:`, error);
                this.connections.delete(connectionId);
            });
        });
    }
    
    handleWebSocketMessage(ws, connectionId, message) {
        switch (message.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
                
            case 'subscribe':
                // Subscribe to execution events
                ws.executionId = message.executionId;
                break;
                
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `Unknown message type: ${message.type}`
                }));
        }
    }
    
    setupExecutorEvents(executor, executionId) {
        // Forward all executor events to WebSocket clients
        const events = ['start', 'complete', 'error', 'nodeStart', 'nodeComplete', 'nodeError', 'log'];
        
        events.forEach(eventType => {
            executor.on(eventType, (data) => {
                this.broadcast({
                    type: `pipeline.${eventType}`,
                    executionId,
                    data,
                    timestamp: new Date().toISOString()
                }, executionId);
            });
        });
    }
    
    broadcast(message, executionId = null) {
        const messageStr = JSON.stringify(message);
        
        this.connections.forEach((ws, connectionId) => {
            if (ws.readyState === WebSocket.OPEN) {
                // Send to all connections, or only those subscribed to this execution
                if (!executionId || ws.executionId === executionId) {
                    ws.send(messageStr);
                }
            }
        });
    }
    
    async start() {
        // Initialize adapters
        console.log('🔧 Initializing adapters...');
        await adapterManager.init();
        
        // Start server
        this.server.listen(this.port, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 OmnixLang Orchestrator Server Started');
            console.log('='.repeat(60));
            console.log(`📡 HTTP Server: http://localhost:${this.port}`);
            console.log(`🎨 Graph IDE: http://localhost:${this.port}/`);
            console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
            console.log(`📊 Health Check: http://localhost:${this.port}/health`);
            console.log(`🔧 API Docs: http://localhost:${this.port}/api/adapters`);
            console.log('='.repeat(60));
            console.log('Ready for polyglot pipeline orchestration! 🎯\n');
        });
    }
    
    async stop() {
        // Stop all running executions
        for (const executor of this.executors.values()) {
            await executor.stop();
        }
        
        // Close WebSocket server
        this.wss.close();
        
        // Close HTTP server
        this.server.close();
        
        console.log('🛑 OmnixLang Orchestrator Server stopped');
    }
}

// Start server if run directly
if (require.main === module) {
    const port = process.env.PORT || 3000;
    const server = new OrchestratorServer(port);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });
    
    server.start().catch(console.error);
}

module.exports = OrchestratorServer;