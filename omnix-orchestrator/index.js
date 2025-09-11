/**
 * OmnixLang Orchestrator - Main Entry Point
 * Systems Integration & Orchestration Platform
 */

const PipelineExecutor = require('./engine/pipeline-executor');
const { AdapterManager, adapterManager } = require('./adapters');
const { PythonAdapter, JavaScriptAdapter, SQLAdapter } = require('./adapters');
const OrchestratorServer = require('./server');

// Main exports
module.exports = {
    // Core classes
    PipelineExecutor,
    AdapterManager,
    OrchestratorServer,
    
    // Adapters
    PythonAdapter,
    JavaScriptAdapter,
    SQLAdapter,
    
    // Singleton instances
    adapterManager,
    
    // Utilities
    createServer: (port = 3000) => new OrchestratorServer(port),
    
    // Quick start functions
    async executeCode(type, code, data = null) {
        if (!adapterManager.initialized) {
            await adapterManager.init();
        }
        return await adapterManager.execute(type, code, data);
    },
    
    async executePipeline(pipeline) {
        const executor = new PipelineExecutor();
        return await executor.execute(pipeline);
    },
    
    async startServer(port = 3000) {
        const server = new OrchestratorServer(port);
        await server.start();
        return server;
    },
    
    // Version info
    version: '0.1.0',
    phase: 0,
    
    // Metadata
    metadata: {
        name: 'OmnixLang Orchestrator',
        description: 'Visual Pipeline Builder for Heterogeneous Data Systems',
        features: [
            'Polyglot execution (Python, JavaScript, SQL)',
            'Visual graph-based pipeline design',
            'Real-time execution monitoring',
            'WebSocket API for live updates',
            'RESTful API for integrations',
            'Modular adapter architecture'
        ],
        business: {
            model: 'Open Core',
            phase: 'Phase 0 - Foundation',
            target: 'Free tier with basic features',
            nextPhase: 'Phase 1 - Monetization (distributed execution, team features)'
        }
    }
};

// CLI support
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'start':
        case 'serve':
            const port = args[1] || process.env.PORT || 3000;
            module.exports.startServer(parseInt(port));
            break;
            
        case 'test':
            require('./test-pipeline');
            break;
            
        case 'version':
            console.log(`OmnixLang Orchestrator v${module.exports.version}`);
            console.log(`Phase: ${module.exports.phase}`);
            break;
            
        case 'help':
        default:
            console.log(`
🔄 OmnixLang Orchestrator v${module.exports.version}

Usage:
  node index.js <command> [options]

Commands:
  start [port]    Start the orchestrator server (default: 3000)
  serve [port]    Alias for start
  test            Run pipeline tests
  version         Show version information
  help            Show this help message

Examples:
  node index.js start 8080     # Start server on port 8080
  node index.js test           # Run test pipeline
  node index.js version        # Show version

Web Interface:
  http://localhost:3000        # Graph IDE
  http://localhost:3000/health # Health check
  http://localhost:3000/api/adapters # API docs

For more information, visit: https://omnixlang.dev/orchestrator
`);
    }
}