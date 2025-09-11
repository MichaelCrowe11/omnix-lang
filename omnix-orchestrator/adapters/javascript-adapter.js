/**
 * OmnixLang JavaScript Adapter
 * Executes JavaScript code in sandboxed environment
 */

const vm = require('vm');
const BaseAdapter = require('./base-adapter');

class JavaScriptAdapter extends BaseAdapter {
    constructor(config = {}) {
        super(config);
        this.timeout = config.timeout || 5000;
        this.memoryLimit = config.memoryLimit || 128; // MB
    }
    
    async init() {
        this.initialized = true;
        console.log('[JavaScriptAdapter] Initialized successfully');
    }
    
    async execute(code, inputData = null) {
        if (!this.initialized) {
            await this.init();
        }
        
        try {
            // Create sandbox with safe globals
            const sandbox = this.createSandbox(inputData);
            
            // Wrap user code in process function
            const wrappedCode = this.wrapCode(code);
            
            // Create script
            const script = new vm.Script(wrappedCode, {
                filename: 'omnix-script.js',
                timeout: this.timeout
            });
            
            // Create context
            const context = vm.createContext(sandbox);
            
            // Run script
            script.runInContext(context, {
                timeout: this.timeout,
                breakOnSigint: true
            });
            
            // Get result
            const result = sandbox.__result;
            
            return {
                success: true,
                data: result,
                logs: sandbox.__logs.join('\n')
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                logs: error.stack || ''
            };
        }
    }
    
    async validate(code) {
        try {
            // Try to create a script to check syntax
            new vm.Script(code, {
                filename: 'validation.js'
            });
            
            return { valid: true, errors: [] };
        } catch (error) {
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }
    
    createSandbox(inputData) {
        const logs = [];
        
        return {
            // Input data
            data: inputData,
            input_data: inputData,
            
            // Safe console
            console: {
                log: (...args) => logs.push(args.join(' ')),
                error: (...args) => logs.push('ERROR: ' + args.join(' ')),
                warn: (...args) => logs.push('WARN: ' + args.join(' '))
            },
            
            // Utility functions
            JSON: JSON,
            Math: Math,
            Date: Date,
            Array: Array,
            Object: Object,
            String: String,
            Number: Number,
            Boolean: Boolean,
            RegExp: RegExp,
            
            // Lodash-like utilities
            _: {
                map: (arr, fn) => arr.map(fn),
                filter: (arr, fn) => arr.filter(fn),
                reduce: (arr, fn, init) => arr.reduce(fn, init),
                groupBy: (arr, key) => {
                    return arr.reduce((result, item) => {
                        const group = item[key];
                        if (!result[group]) result[group] = [];
                        result[group].push(item);
                        return result;
                    }, {});
                },
                sortBy: (arr, key) => {
                    return [...arr].sort((a, b) => {
                        if (a[key] < b[key]) return -1;
                        if (a[key] > b[key]) return 1;
                        return 0;
                    });
                },
                uniq: (arr) => [...new Set(arr)],
                flatten: (arr) => arr.flat(),
                sum: (arr) => arr.reduce((a, b) => a + b, 0),
                mean: (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
            },
            
            // Async utilities
            Promise: Promise,
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval,
            
            // HTTP fetch simulation (returns mock data)
            fetch: async (url) => {
                logs.push(`Fetch simulated: ${url}`);
                return {
                    json: async () => ({ mock: true, url }),
                    text: async () => 'Mock response',
                    status: 200
                };
            },
            
            // Internal
            __logs: logs,
            __result: null
        };
    }
    
    wrapCode(code) {
        return `
// Process function that wraps user code
function process(data) {
    ${code}
}

// Execute and capture result
try {
    __result = process(data);
    
    // Handle promises
    if (__result && typeof __result.then === 'function') {
        __result.then(res => {
            __result = res;
        }).catch(err => {
            __result = { error: err.message };
        });
    }
} catch (error) {
    __result = { error: error.message };
    console.error('Execution error:', error.message);
}
`;
    }
    
    getMetadata() {
        return {
            ...super.getMetadata(),
            name: 'JavaScriptAdapter',
            runtime: 'Node.js (sandboxed)',
            supportedFeatures: [
                'ES6+ syntax',
                'Async/await',
                'Array methods',
                'JSON processing',
                'Lodash-like utilities'
            ],
            security: 'Sandboxed execution with timeout'
        };
    }
}

module.exports = JavaScriptAdapter;