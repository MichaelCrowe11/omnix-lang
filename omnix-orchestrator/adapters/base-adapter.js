/**
 * OmnixLang Base Adapter
 * Abstract base class for polyglot language adapters
 */

class BaseAdapter {
    constructor(config = {}) {
        this.config = config;
        this.runtime = null;
        this.initialized = false;
    }
    
    /**
     * Initialize the adapter runtime
     */
    async init() {
        throw new Error('init() must be implemented by subclass');
    }
    
    /**
     * Execute code with given input data
     * @param {string} code - The code to execute
     * @param {any} inputData - Input data for the code
     * @returns {Promise<any>} - Execution result
     */
    async execute(code, inputData = null) {
        throw new Error('execute() must be implemented by subclass');
    }
    
    /**
     * Validate code syntax
     * @param {string} code - The code to validate
     * @returns {Promise<{valid: boolean, errors: Array}>}
     */
    async validate(code) {
        throw new Error('validate() must be implemented by subclass');
    }
    
    /**
     * Transform data between adapter formats
     * @param {any} data - Data to transform
     * @param {string} fromFormat - Source format
     * @param {string} toFormat - Target format
     */
    transformData(data, fromFormat = 'json', toFormat = 'json') {
        if (fromFormat === toFormat) return data;
        
        // Handle common transformations
        if (fromFormat === 'json' && toFormat === 'csv') {
            return this.jsonToCsv(data);
        }
        if (fromFormat === 'csv' && toFormat === 'json') {
            return this.csvToJson(data);
        }
        
        return data;
    }
    
    /**
     * Convert JSON to CSV
     */
    jsonToCsv(data) {
        if (!Array.isArray(data) || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => 
                    JSON.stringify(row[header] || '')
                ).join(',')
            )
        ];
        
        return csv.join('\n');
    }
    
    /**
     * Convert CSV to JSON
     */
    csvToJson(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            
            headers.forEach((header, index) => {
                let value = values[index]?.trim() || '';
                // Try to parse as JSON (handles quoted strings)
                try {
                    value = JSON.parse(value);
                } catch {
                    // Keep as string if not valid JSON
                }
                row[header] = value;
            });
            
            data.push(row);
        }
        
        return data;
    }
    
    /**
     * Get adapter metadata
     */
    getMetadata() {
        return {
            name: this.constructor.name,
            version: '1.0.0',
            supportedFormats: ['json', 'csv'],
            initialized: this.initialized
        };
    }
    
    /**
     * Clean up resources
     */
    async cleanup() {
        this.initialized = false;
        this.runtime = null;
    }
}

module.exports = BaseAdapter;