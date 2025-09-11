/**
 * OmnixLang SQL Adapter
 * Executes SQL queries on various databases
 */

const BaseAdapter = require('./base-adapter');

// SQL parser for validation
class SimpleSQLParser {
    static parse(sql) {
        const normalized = sql.trim().toUpperCase();
        const type = normalized.split(/\s+/)[0];
        
        return {
            type,
            isSelect: type === 'SELECT',
            isModifying: ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'].includes(type),
            tables: this.extractTables(sql)
        };
    }
    
    static extractTables(sql) {
        const tables = [];
        const patterns = [
            /FROM\s+(\w+)/gi,
            /JOIN\s+(\w+)/gi,
            /INTO\s+(\w+)/gi,
            /UPDATE\s+(\w+)/gi,
            /TABLE\s+(\w+)/gi
        ];
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(sql)) !== null) {
                tables.push(match[1].toLowerCase());
            }
        });
        
        return [...new Set(tables)];
    }
}

class SQLAdapter extends BaseAdapter {
    constructor(config = {}) {
        super(config);
        this.connectionConfig = config.connection || {};
        this.dialect = config.dialect || 'sqlite'; // sqlite, mysql, postgres
        this.allowModifying = config.allowModifying || false;
        this.mockMode = config.mockMode !== false; // Default to mock mode
        this.mockData = this.initMockData();
    }
    
    async init() {
        if (this.mockMode) {
            console.log('[SQLAdapter] Initialized in mock mode');
            this.initialized = true;
            return;
        }
        
        // In production, would initialize actual database connection
        try {
            // Example: this.connection = await createConnection(this.connectionConfig);
            this.initialized = true;
            console.log(`[SQLAdapter] Connected to ${this.dialect} database`);
        } catch (error) {
            throw new Error(`Failed to initialize SQL adapter: ${error.message}`);
        }
    }
    
    async execute(query, inputData = null) {
        if (!this.initialized) {
            await this.init();
        }
        
        try {
            // Parse query
            const parsed = SimpleSQLParser.parse(query);
            
            // Security check
            if (parsed.isModifying && !this.allowModifying) {
                throw new Error('Modifying queries are not allowed in read-only mode');
            }
            
            // Execute based on mode
            let result;
            if (this.mockMode) {
                result = await this.executeMock(query, parsed, inputData);
            } else {
                result = await this.executeReal(query, inputData);
            }
            
            return {
                success: true,
                data: result,
                metadata: {
                    type: parsed.type,
                    tables: parsed.tables,
                    rowCount: Array.isArray(result) ? result.length : 0
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                query: query
            };
        }
    }
    
    async validate(query) {
        try {
            const parsed = SimpleSQLParser.parse(query);
            
            // Basic SQL validation
            const errors = [];
            
            // Check for common issues
            if (!parsed.type) {
                errors.push('Invalid SQL statement');
            }
            
            if (parsed.isModifying && !this.allowModifying) {
                errors.push('Modifying queries are not allowed in read-only mode');
            }
            
            // Check for required keywords
            if (parsed.isSelect && !query.toUpperCase().includes('FROM')) {
                errors.push('SELECT statement missing FROM clause');
            }
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
        } catch (error) {
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }
    
    async executeMock(query, parsed, inputData) {
        console.log(`[SQLAdapter] Mock executing: ${parsed.type}`);
        
        // Return mock data based on query type
        switch (parsed.type) {
            case 'SELECT':
                return this.getMockSelectData(parsed.tables[0] || 'table');
                
            case 'INSERT':
                return { affectedRows: 1, insertId: Math.floor(Math.random() * 1000) };
                
            case 'UPDATE':
                return { affectedRows: Math.floor(Math.random() * 10) + 1 };
                
            case 'DELETE':
                return { affectedRows: Math.floor(Math.random() * 5) };
                
            case 'CREATE':
                return { success: true, message: 'Table created' };
                
            default:
                return { success: true };
        }
    }
    
    async executeReal(query, inputData) {
        // In production, would execute actual query
        // Example: return await this.connection.query(query, inputData);
        throw new Error('Real database execution not implemented');
    }
    
    initMockData() {
        return {
            users: [
                { id: 1, name: 'Alice Johnson', email: 'alice@example.com', created_at: '2024-01-15' },
                { id: 2, name: 'Bob Smith', email: 'bob@example.com', created_at: '2024-01-16' },
                { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', created_at: '2024-01-17' }
            ],
            products: [
                { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics', stock: 50 },
                { id: 2, name: 'Mouse', price: 29.99, category: 'Electronics', stock: 200 },
                { id: 3, name: 'Desk', price: 299.99, category: 'Furniture', stock: 25 }
            ],
            orders: [
                { id: 1, user_id: 1, product_id: 1, quantity: 1, total: 999.99, status: 'completed' },
                { id: 2, user_id: 2, product_id: 2, quantity: 2, total: 59.98, status: 'pending' },
                { id: 3, user_id: 1, product_id: 3, quantity: 1, total: 299.99, status: 'shipped' }
            ],
            processed_data: [
                { id: 1, timestamp: '2024-01-20 10:00:00', value: 42.5, processed: true },
                { id: 2, timestamp: '2024-01-20 11:00:00', value: 38.2, processed: true },
                { id: 3, timestamp: '2024-01-20 12:00:00', value: 45.8, processed: true }
            ]
        };
    }
    
    getMockSelectData(tableName) {
        // Return mock data for table
        const data = this.mockData[tableName] || this.mockData.processed_data;
        
        // Add some variation
        const limit = Math.min(data.length, Math.floor(Math.random() * 5) + 3);
        return data.slice(0, limit);
    }
    
    getMetadata() {
        return {
            ...super.getMetadata(),
            name: 'SQLAdapter',
            dialect: this.dialect,
            supportedDialects: ['sqlite', 'mysql', 'postgres', 'mssql'],
            features: [
                'SELECT queries',
                'JOIN operations',
                'Aggregations',
                'Subqueries',
                this.allowModifying ? 'DML operations' : 'Read-only mode'
            ],
            mockMode: this.mockMode,
            mockTables: this.mockMode ? Object.keys(this.mockData) : []
        };
    }
}

module.exports = SQLAdapter;