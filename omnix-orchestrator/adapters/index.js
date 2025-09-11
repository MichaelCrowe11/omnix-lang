/**
 * OmnixLang Adapter Manager
 * Central registry for all language adapters
 */

const PythonAdapter = require('./python-adapter');
const JavaScriptAdapter = require('./javascript-adapter');
const SQLAdapter = require('./sql-adapter');

class AdapterManager {
    constructor() {
        this.adapters = new Map();
        this.initialized = false;
    }
    
    async init() {
        console.log('[AdapterManager] Initializing adapters...');
        
        // Register default adapters
        await this.registerAdapter('python', new PythonAdapter());
        await this.registerAdapter('javascript', new JavaScriptAdapter());
        await this.registerAdapter('sql', new SQLAdapter({ mockMode: true }));
        
        this.initialized = true;
        console.log('[AdapterManager] All adapters initialized');
    }
    
    async registerAdapter(type, adapter) {
        try {
            await adapter.init();
            this.adapters.set(type, adapter);
            console.log(`[AdapterManager] Registered ${type} adapter`);
        } catch (error) {
            console.error(`[AdapterManager] Failed to register ${type} adapter:`, error.message);
        }
    }
    
    getAdapter(type) {
        const adapter = this.adapters.get(type);
        if (!adapter) {
            throw new Error(`Unknown adapter type: ${type}`);
        }
        return adapter;
    }
    
    async execute(type, code, inputData = null) {
        const adapter = this.getAdapter(type);
        return await adapter.execute(code, inputData);
    }
    
    async validate(type, code) {
        const adapter = this.getAdapter(type);
        return await adapter.validate(code);
    }
    
    listAdapters() {
        const list = [];
        for (const [type, adapter] of this.adapters) {
            list.push({
                type,
                ...adapter.getMetadata()
            });
        }
        return list;
    }
    
    async transformData(data, fromAdapter, toAdapter) {
        const from = this.getAdapter(fromAdapter);
        const to = this.getAdapter(toAdapter);
        
        // Use base adapter's transform if available
        return from.transformData(data, 'json', 'json');
    }
}

// Singleton instance
const adapterManager = new AdapterManager();

module.exports = {
    AdapterManager,
    adapterManager,
    PythonAdapter,
    JavaScriptAdapter,
    SQLAdapter
};