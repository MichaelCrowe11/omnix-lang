/**
 * OmnixLang Python Adapter
 * Executes Python code in Node.js environment
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const BaseAdapter = require('./base-adapter');

class PythonAdapter extends BaseAdapter {
    constructor(config = {}) {
        super(config);
        this.pythonPath = config.pythonPath || 'python';
        this.tempDir = config.tempDir || os.tmpdir();
    }
    
    async init() {
        // Verify Python is available
        try {
            await this.executeCommand([this.pythonPath, '--version']);
            this.initialized = true;
            console.log('[PythonAdapter] Initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize Python adapter: ${error.message}`);
        }
    }
    
    async execute(code, inputData = null) {
        if (!this.initialized) {
            await this.init();
        }
        
        // Create wrapper code that handles input/output
        const wrappedCode = this.wrapCode(code, inputData);
        
        // Write to temporary file
        const tempFile = path.join(this.tempDir, `omnix_${Date.now()}.py`);
        await fs.writeFile(tempFile, wrappedCode);
        
        try {
            // Execute Python code
            const result = await this.executeCommand([this.pythonPath, tempFile]);
            
            // Parse output
            const output = this.parseOutput(result);
            
            return {
                success: true,
                data: output,
                logs: result.stderr || ''
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                logs: error.stderr || ''
            };
        } finally {
            // Clean up temp file
            try {
                await fs.unlink(tempFile);
            } catch {
                // Ignore cleanup errors
            }
        }
    }
    
    async validate(code) {
        if (!this.initialized) {
            await this.init();
        }
        
        // Use Python's compile() to check syntax
        const validationCode = `
import sys
import ast
try:
    compile('''${code.replace(/'/g, "\\'")}''', '<string>', 'exec')
    print("VALID")
except SyntaxError as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`;
        
        try {
            await this.executeCommand([this.pythonPath, '-c', validationCode]);
            return { valid: true, errors: [] };
        } catch (error) {
            const errorMessage = error.message || error.stderr || 'Unknown error';
            return {
                valid: false,
                errors: [errorMessage]
            };
        }
    }
    
    wrapCode(code, inputData) {
        // Standard imports that are always available
        const imports = `
import json
import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
`;
        
        // Input data handling
        const inputSetup = inputData ? 
            `input_data = json.loads('${JSON.stringify(inputData).replace(/'/g, "\\'")}')\ndata = input_data` : 
            'input_data = None\ndata = None';
        
        // Process function wrapper
        const wrapper = `
${imports}

# Input data
${inputSetup}

# User code wrapped in process function
def process(data):
    ${code.split('\n').map(line => '    ' + line).join('\n')}

# Execute and output result
try:
    result = process(data)
    
    # Convert pandas DataFrame to dict if needed
    if hasattr(result, 'to_dict'):
        result = result.to_dict('records')
    
    # Output as JSON
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;
        
        return wrapper;
    }
    
    parseOutput(result) {
        const stdout = result.stdout.trim();
        
        if (!stdout) {
            return null;
        }
        
        try {
            return JSON.parse(stdout);
        } catch {
            // If not JSON, return as string
            return stdout;
        }
    }
    
    executeCommand(args) {
        return new Promise((resolve, reject) => {
            const proc = spawn(args[0], args.slice(1), {
                encoding: 'utf8',
                shell: process.platform === 'win32'
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    const error = new Error(`Process exited with code ${code}`);
                    error.stderr = stderr;
                    error.stdout = stdout;
                    reject(error);
                }
            });
            
            proc.on('error', reject);
        });
    }
    
    getMetadata() {
        return {
            ...super.getMetadata(),
            name: 'PythonAdapter',
            runtime: 'Python 3.x',
            supportedLibraries: ['pandas', 'numpy', 'json', 'datetime'],
            features: ['DataFrames', 'NumPy arrays', 'JSON processing']
        };
    }
}

module.exports = PythonAdapter;