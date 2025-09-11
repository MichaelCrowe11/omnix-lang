/**
 * OMNIX Interpreter - Executes the Abstract Syntax Tree
 */

class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.variables = new Map();
        this.functions = new Map();
        this.states = new Map();
    }
    
    define(name, value) {
        this.variables.set(name, value);
    }
    
    get(name) {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        if (this.parent) {
            return this.parent.get(name);
        }
        throw new Error(`Undefined variable: ${name}`);
    }
    
    set(name, value) {
        if (this.variables.has(name)) {
            this.variables.set(name, value);
            return;
        }
        if (this.parent) {
            this.parent.set(name, value);
            return;
        }
        throw new Error(`Undefined variable: ${name}`);
    }
}

class ConsensusResult {
    constructor(value, accepted = true) {
        this.value = value;
        this._accepted = accepted;
    }
    
    accepted() {
        return this._accepted;
    }
}

class OmnixNode {
    constructor(name, env) {
        this.name = name;
        this.env = env;
        this.id = Math.random().toString(36).substr(2, 9);
        this.running = false;
        this.cluster = null;
        this.replicas = [];
    }
    
    start() {
        this.running = true;
        console.log(`[Node ${this.id}] Started`);
    }
    
    join_cluster(clusterName) {
        this.cluster = clusterName;
        console.log(`[Node ${this.id}] Joined cluster: ${clusterName}`);
    }
    
    synchronized() {
        return Promise.resolve(true);
    }
}

class Interpreter {
    constructor() {
        this.globalEnv = new Environment();
        this.currentEnv = this.globalEnv;
        this.nodes = new Map();
        this.consensusLogs = [];
        
        // Built-in functions
        this.globalEnv.define('println', (...args) => {
            console.log(...args);
        });
        
        this.globalEnv.define('print', (...args) => {
            process.stdout.write(args.join(' '));
        });
        
        this.globalEnv.define('assert', (condition, message = 'Assertion failed') => {
            if (!condition) {
                throw new Error(message);
            }
        });
        
        this.globalEnv.define('now', () => Date.now());
        
        this.globalEnv.define('sleep', (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        });
        
        // Built-in types
        this.globalEnv.define('Map', {
            new: () => new Map(),
            insert: (map, key, value) => {
                map.set(key, value);
                return map;
            },
            get: (map, key) => map.get(key),
            remove: (map, key) => {
                map.delete(key);
                return map;
            }
        });
        
        this.globalEnv.define('Vec', {
            new: () => [],
            push: (vec, item) => {
                vec.push(item);
                return vec;
            }
        });
    }
    
    interpret(ast) {
        return this.evaluate(ast, this.globalEnv);
    }
    
    evaluate(node, env) {
        if (!node) return null;
        
        switch (node.type) {
            case 'Program':
                return this.evaluateProgram(node, env);
                
            case 'ConsensusCluster':
                return this.evaluateConsensusCluster(node, env);
                
            case 'Node':
                return this.evaluateNode(node, env);
                
            case 'Function':
                return this.evaluateFunction(node, env);
                
            case 'Pipeline':
                return this.evaluatePipeline(node, env);
                
            case 'CrossChainContract':
                return this.evaluateCrossChainContract(node, env);
                
            case 'Block':
                return this.evaluateBlock(node, env);
                
            case 'LetStatement':
                return this.evaluateLetStatement(node, env);
                
            case 'AssignmentStatement':
                return this.evaluateAssignmentStatement(node, env);
                
            case 'ReturnStatement':
                return { type: 'return', value: this.evaluate(node.value, env) };
                
            case 'ExpressionStatement':
                return this.evaluate(node.expression, env);
                
            case 'WhenStatement':
                return this.evaluateWhenStatement(node, env);
                
            case 'PhaseStatement':
                return this.evaluatePhaseStatement(node, env);
                
            case 'BroadcastStatement':
                return this.evaluateBroadcastStatement(node, env);
                
            case 'IfStatement':
                return this.evaluateIfStatement(node, env);
                
            case 'ForStatement':
                return this.evaluateForStatement(node, env);
                
            case 'WhileStatement':
                return this.evaluateWhileStatement(node, env);
                
            case 'ConsensusExpression':
                return this.evaluateConsensusExpression(node, env);
                
            case 'BinaryExpression':
                return this.evaluateBinaryExpression(node, env);
                
            case 'UnaryExpression':
                return this.evaluateUnaryExpression(node, env);
                
            case 'CallExpression':
                return this.evaluateCallExpression(node, env);
                
            case 'MemberExpression':
                return this.evaluateMemberExpression(node, env);
                
            case 'IndexExpression':
                return this.evaluateIndexExpression(node, env);
                
            case 'StaticAccess':
                return this.evaluateStaticAccess(node, env);
                
            case 'Identifier':
                return env.get(node.name);
                
            case 'IntegerLiteral':
                return node.value;
                
            case 'FloatLiteral':
                return node.value;
                
            case 'StringLiteral':
                return node.value;
                
            case 'BooleanLiteral':
                return node.value;
                
            case 'NullLiteral':
                return null;
                
            case 'TimeLiteral':
                return this.convertTime(node.value, node.unit);
                
            case 'ConsensusAlgorithm':
                return node.algorithm;
                
            case 'ArrayLiteral':
                return node.elements.map(el => this.evaluate(el, env));
                
            case 'ObjectLiteral':
                const obj = {};
                node.properties.forEach(prop => {
                    obj[prop.key] = this.evaluate(prop.value, env);
                });
                return obj;
                
            case 'State':
                return this.evaluateState(node, env);
                
            default:
                console.warn(`Unknown node type: ${node.type}`);
                return null;
        }
    }
    
    evaluateProgram(node, env) {
        let lastValue = null;
        
        for (const stmt of node.body) {
            lastValue = this.evaluate(stmt, env);
            
            // Handle early returns
            if (lastValue && lastValue.type === 'return') {
                return lastValue.value;
            }
        }
        
        return lastValue;
    }
    
    evaluateConsensusCluster(node, env) {
        console.log(`[Consensus Cluster] Initializing ${node.name}`);
        
        const clusterEnv = new Environment(env);
        
        // Store properties
        Object.entries(node.properties).forEach(([key, value]) => {
            const val = this.evaluate(value, clusterEnv);
            console.log(`  ${key}: ${JSON.stringify(val)}`);
            clusterEnv.define(key, val);
        });
        
        // Initialize states
        node.states.forEach(state => {
            this.evaluate(state, clusterEnv);
        });
        
        // Define methods
        node.methods.forEach(method => {
            clusterEnv.functions.set(method.name, method);
        });
        
        // Store cluster
        env.define(node.name, {
            type: 'cluster',
            name: node.name,
            env: clusterEnv,
            methods: clusterEnv.functions
        });
        
        return null;
    }
    
    evaluateNode(node, env) {
        console.log(`[Node] Initializing ${node.name}`);
        
        const nodeEnv = new Environment(env);
        
        // Initialize states
        node.states.forEach(state => {
            this.evaluate(state, nodeEnv);
        });
        
        // Define methods
        node.methods.forEach(method => {
            nodeEnv.functions.set(method.name, method);
        });
        
        // Create node instance constructor
        const NodeConstructor = {
            new: () => {
                const instance = new OmnixNode(node.name, nodeEnv);
                
                // Bind methods to instance
                nodeEnv.functions.forEach((method, name) => {
                    instance[name] = (...args) => {
                        const funcEnv = new Environment(nodeEnv);
                        funcEnv.define('self', instance);
                        
                        // Bind parameters
                        method.params.forEach((param, i) => {
                            funcEnv.define(param.name, args[i]);
                        });
                        
                        return this.evaluate(method.body, funcEnv);
                    };
                });
                
                // Copy states to instance
                nodeEnv.states.forEach((value, name) => {
                    instance[name] = value;
                });
                
                return instance;
            }
        };
        
        env.define(node.name, NodeConstructor);
        
        return null;
    }
    
    evaluateFunction(node, env) {
        // Store function definition
        env.functions.set(node.name, node);
        
        // Also define it as a callable
        env.define(node.name, (...args) => {
            const funcEnv = new Environment(env);
            
            // Bind parameters
            node.params.forEach((param, i) => {
                funcEnv.define(param.name, args[i]);
            });
            
            const result = this.evaluate(node.body, funcEnv);
            
            // Handle return value
            if (result && result.type === 'return') {
                return result.value;
            }
            
            return result;
        });
        
        return null;
    }
    
    evaluateBlock(node, env) {
        const blockEnv = new Environment(env);
        let lastValue = null;
        
        for (const stmt of node.statements) {
            lastValue = this.evaluate(stmt, blockEnv);
            
            // Handle early returns
            if (lastValue && lastValue.type === 'return') {
                return lastValue;
            }
        }
        
        return lastValue;
    }
    
    evaluateLetStatement(node, env) {
        const value = this.evaluate(node.value, env);
        env.define(node.name, value);
        return value;
    }
    
    evaluateAssignmentStatement(node, env) {
        const value = this.evaluate(node.value, env);
        env.set(node.name, value);
        return value;
    }
    
    evaluateWhenStatement(node, env) {
        const condition = this.evaluate(node.condition, env);
        
        if (this.isTruthy(condition)) {
            return this.evaluate(node.body, env);
        }
        
        return null;
    }
    
    evaluatePhaseStatement(node, env) {
        console.log(`[Phase] Entering phase: ${node.name}`);
        return this.evaluate(node.body, env);
    }
    
    evaluateBroadcastStatement(node, env) {
        const event = this.evaluate(node.event, env);
        console.log(`[Broadcast] Event: ${JSON.stringify(event)}`);
        return null;
    }
    
    evaluateIfStatement(node, env) {
        const condition = this.evaluate(node.condition, env);
        
        if (this.isTruthy(condition)) {
            return this.evaluate(node.thenBranch, env);
        } else if (node.elseBranch) {
            return this.evaluate(node.elseBranch, env);
        }
        
        return null;
    }
    
    evaluateForStatement(node, env) {
        const iterable = this.evaluate(node.iterable, env);
        const loopEnv = new Environment(env);
        
        for (const item of iterable) {
            loopEnv.define(node.variable, item);
            const result = this.evaluate(node.body, loopEnv);
            
            if (result && result.type === 'return') {
                return result;
            }
        }
        
        return null;
    }
    
    evaluateWhileStatement(node, env) {
        while (this.isTruthy(this.evaluate(node.condition, env))) {
            const result = this.evaluate(node.body, env);
            
            if (result && result.type === 'return') {
                return result;
            }
        }
        
        return null;
    }
    
    evaluateConsensusExpression(node, env) {
        const value = this.evaluate(node.value, env);
        const options = {};
        
        Object.entries(node.options).forEach(([key, optNode]) => {
            options[key] = this.evaluate(optNode, env);
        });
        
        console.log(`[Consensus] Operation: ${node.operation}`);
        console.log(`  Value: ${JSON.stringify(value)}`);
        console.log(`  Options: ${JSON.stringify(options)}`);
        
        // Simulate consensus
        const validators = options.validators || 3;
        const timeout = options.timeout || 2000;
        
        // Log consensus operation
        this.consensusLogs.push({
            operation: node.operation,
            value,
            options,
            timestamp: Date.now()
        });
        
        // Simulate consensus result (always succeeds for now)
        return new ConsensusResult(value, true);
    }
    
    evaluateBinaryExpression(node, env) {
        const left = this.evaluate(node.left, env);
        const right = this.evaluate(node.right, env);
        
        switch (node.operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '==': return left === right;
            case '!=': return left !== right;
            case '<': return left < right;
            case '<=': return left <= right;
            case '>': return left > right;
            case '>=': return left >= right;
            case '&&': return left && right;
            case '||': return left || right;
            default:
                throw new Error(`Unknown operator: ${node.operator}`);
        }
    }
    
    evaluateUnaryExpression(node, env) {
        const operand = this.evaluate(node.operand, env);
        
        switch (node.operator) {
            case '!': return !operand;
            case '-': return -operand;
            default:
                throw new Error(`Unknown unary operator: ${node.operator}`);
        }
    }
    
    evaluateCallExpression(node, env) {
        const callee = this.evaluate(node.callee, env);
        const args = node.arguments.map(arg => this.evaluate(arg, env));
        
        if (typeof callee === 'function') {
            return callee(...args);
        }
        
        throw new Error(`Not a function: ${node.callee.name || node.callee.type}`);
    }
    
    evaluateMemberExpression(node, env) {
        const object = this.evaluate(node.object, env);
        
        if (object && typeof object === 'object') {
            return object[node.property];
        }
        
        throw new Error(`Cannot access property ${node.property} of ${object}`);
    }
    
    evaluateIndexExpression(node, env) {
        const object = this.evaluate(node.object, env);
        const index = this.evaluate(node.index, env);
        
        if (Array.isArray(object) || typeof object === 'string') {
            return object[index];
        }
        
        if (object instanceof Map) {
            return object.get(index);
        }
        
        throw new Error(`Cannot index ${object}`);
    }
    
    evaluateStaticAccess(node, env) {
        const cls = env.get(node.class);
        
        if (cls && cls[node.method]) {
            return cls[node.method];
        }
        
        throw new Error(`Unknown static method: ${node.class}::${node.method}`);
    }
    
    evaluateState(node, env) {
        const initialValue = node.initialValue ? 
            this.evaluate(node.initialValue, env) : null;
        
        env.states.set(node.name, initialValue);
        env.define(node.name, initialValue);
        
        return null;
    }
    
    convertTime(value, unit) {
        switch (unit) {
            case 'ms': return value;
            case 's': return value * 1000;
            case 'm': return value * 60000;
            case 'h': return value * 3600000;
            case 'days': return value * 86400000;
            default: return value;
        }
    }
    
    isTruthy(value) {
        if (value === null || value === undefined || value === false) {
            return false;
        }
        
        if (value instanceof ConsensusResult) {
            return value.accepted();
        }
        
        return true;
    }
    
    // New distributed systems evaluation methods
    
    evaluatePipeline(node, env) {
        console.log(`[Pipeline] Initializing ${node.name}`);
        
        const pipelineEnv = new Environment(env);
        
        // Store properties
        Object.entries(node.properties).forEach(([key, value]) => {
            const val = this.evaluate(value, pipelineEnv);
            console.log(`  ${key}: ${JSON.stringify(val)}`);
            pipelineEnv.define(key, val);
        });
        
        // Process stages
        const stages = [];
        node.stages.forEach(stage => {
            const stageResult = this.evaluateStage(stage, pipelineEnv);
            stages.push(stageResult);
            console.log(`  Stage ${stage.name}: ${JSON.stringify(stageResult.properties)}`);
        });
        
        // Store pipeline
        env.define(node.name, {
            type: 'pipeline',
            name: node.name,
            properties: node.properties,
            stages: stages,
            execute: (data) => this.executePipeline(stages, data, pipelineEnv)
        });
        
        return null;
    }
    
    evaluateStage(node, env) {
        const properties = {};
        
        Object.entries(node.properties).forEach(([key, value]) => {
            properties[key] = this.evaluate(value, env);
        });
        
        return {
            name: node.name,
            properties
        };
    }
    
    executePipeline(stages, inputData, env) {
        console.log(`[Pipeline] Executing ${stages.length} stages`);
        let data = inputData;
        
        for (const stage of stages) {
            console.log(`  Executing stage: ${stage.name}`);
            
            // Simulate stage processing based on properties
            const { workers, parallel, gpu_workers, process: processFunc } = stage.properties;
            
            if (parallel) {
                console.log(`    Running in parallel with ${workers || 'auto'} workers`);
            }
            
            if (gpu_workers) {
                console.log(`    Using ${gpu_workers} GPU workers`);
            }
            
            // Simulate processing delay
            const startTime = Date.now();
            
            // Apply transformation if process function is defined
            if (processFunc && typeof processFunc === 'function') {
                data = processFunc(data);
            } else {
                // Default transformation - just add stage metadata
                if (Array.isArray(data)) {
                    data = data.map(item => ({
                        ...item,
                        processedBy: stage.name,
                        timestamp: new Date().toISOString()
                    }));
                }
            }
            
            const duration = Date.now() - startTime;
            console.log(`    Stage completed in ${duration}ms`);
        }
        
        return {
            success: true,
            data,
            stages: stages.length,
            timestamp: new Date().toISOString()
        };
    }
    
    evaluateCrossChainContract(node, env) {
        console.log(`[CrossChain] Deploying contract ${node.name} to chains: ${node.chains.join(', ')}`);
        
        const contractEnv = new Environment(env);
        
        // Add blockchain utilities
        contractEnv.define('lock_tokens', (chain, amount) => {
            console.log(`  Locking ${amount} tokens on ${chain}`);
            return { success: true, lockId: `lock_${Date.now()}` };
        });
        
        contractEnv.define('mint_tokens', (chain, amount) => {
            console.log(`  Minting ${amount} tokens on ${chain}`);
            return { success: true, mintId: `mint_${Date.now()}` };
        });
        
        contractEnv.define('emit', (event, ...args) => {
            console.log(`  Emitting event ${event}:`, args);
            return { success: true };
        });
        
        // Define methods
        const methods = {};
        node.methods.forEach(method => {
            methods[method.name] = (...args) => {
                console.log(`[CrossChain] Executing ${method.name} on all chains`);
                
                const results = {};
                node.chains.forEach(chain => {
                    console.log(`  Executing on ${chain}...`);
                    
                    const chainEnv = new Environment(contractEnv);
                    chainEnv.define('current_chain', chain);
                    
                    // Bind parameters
                    method.params.forEach((param, i) => {
                        chainEnv.define(param.name, args[i]);
                    });
                    
                    results[chain] = this.evaluate(method.body, chainEnv);
                });
                
                return {
                    success: true,
                    results,
                    chains: node.chains
                };
            };
        });
        
        // Store contract
        env.define(node.name, {
            type: 'cross_chain_contract',
            name: node.name,
            chains: node.chains,
            methods,
            deploy: () => {
                console.log(`[CrossChain] Deploying ${node.name} across ${node.chains.length} chains`);
                return {
                    success: true,
                    addresses: node.chains.reduce((acc, chain) => {
                        acc[chain] = `0x${Math.random().toString(16).substr(2, 40)}`;
                        return acc;
                    }, {})
                };
            }
        });
        
        return null;
    }
}

module.exports = { Interpreter, Environment, ConsensusResult, OmnixNode };