/**
 * OmnixLang Pipeline Test
 * Demonstrates polyglot execution with Python, JavaScript, and SQL
 */

const PipelineExecutor = require('./engine/pipeline-executor');

async function testPipeline() {
    console.log('='.repeat(60));
    console.log('OmnixLang Orchestrator - Polyglot Pipeline Test');
    console.log('='.repeat(60));
    
    const executor = new PipelineExecutor();
    
    // Listen to events
    executor.on('log', (entry) => {
        const prefix = {
            'info': '📝',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️'
        }[entry.level] || '•';
        
        console.log(`${prefix} ${entry.message}`);
    });
    
    // Define test pipeline
    const pipeline = {
        name: 'ETL Demo Pipeline',
        nodes: [
            {
                id: 1,
                type: 'input',
                properties: {
                    source: 'file',
                    path: '/data/input.csv',
                    format: 'csv'
                }
            },
            {
                id: 2,
                type: 'python',
                properties: {
                    code: `
# Python transformation
import pandas as pd

# Filter and enhance data
df = pd.DataFrame(data)
df['value_squared'] = df['value'] ** 2
df['is_high'] = df['value'] > 130
filtered = df[df['is_high'] == True]

return filtered.to_dict('records')
`
                }
            },
            {
                id: 3,
                type: 'javascript',
                properties: {
                    code: `
// JavaScript processing
const enriched = data.map(row => ({
    ...row,
    processed_at: new Date().toISOString(),
    risk_score: row.value_squared > 20000 ? 'HIGH' : 'LOW',
    category_code: row.category.charCodeAt(0)
}));

// Sort by value
return enriched.sort((a, b) => b.value - a.value);
`
                }
            },
            {
                id: 4,
                type: 'sql',
                properties: {
                    query: `
SELECT 
    id,
    value,
    category,
    timestamp,
    processed
FROM processed_data
WHERE processed = true
LIMIT 5
`
                }
            },
            {
                id: 5,
                type: 'output',
                properties: {
                    destination: 'file',
                    path: '/data/output.json',
                    format: 'json'
                }
            }
        ],
        connections: [
            { from: { id: 1 }, to: { id: 2 } },
            { from: { id: 2 }, to: { id: 3 } },
            { from: { id: 3 }, to: { id: 4 } },
            { from: { id: 4 }, to: { id: 5 } }
        ]
    };
    
    console.log('\nExecuting pipeline with:');
    console.log('• Python data processing');
    console.log('• JavaScript enrichment');
    console.log('• SQL querying');
    console.log('• Automated data flow\n');
    
    // Execute pipeline
    const result = await executor.execute(pipeline);
    
    console.log('\n' + '='.repeat(60));
    
    if (result.success) {
        console.log('✨ Pipeline completed successfully!\n');
        
        // Show results from each node
        console.log('Node Results:');
        console.log('-'.repeat(40));
        
        for (const [nodeId, nodeResult] of Object.entries(result.results)) {
            const node = pipeline.nodes.find(n => n.id == nodeId);
            console.log(`\n${node.type.toUpperCase()} Node (${nodeId}):`);
            
            if (Array.isArray(nodeResult)) {
                console.log(`  Records: ${nodeResult.length}`);
                if (nodeResult[0]) {
                    console.log(`  Sample: ${JSON.stringify(nodeResult[0], null, 2).split('\n').join('\n  ')}`);
                }
            } else if (typeof nodeResult === 'object' && nodeResult.data) {
                console.log(`  Records: ${nodeResult.data?.length || 1}`);
                console.log(`  Metadata: ${JSON.stringify(nodeResult.metadata || {})}`);
            } else {
                console.log(`  Result: ${JSON.stringify(nodeResult)}`);
            }
        }
    } else {
        console.log(`❌ Pipeline failed: ${result.error}`);
    }
    
    console.log('\n' + '='.repeat(60));
}

// Test individual adapters
async function testAdapters() {
    const { adapterManager } = require('./adapters');
    
    console.log('\n' + '='.repeat(60));
    console.log('Testing Individual Adapters');
    console.log('='.repeat(60));
    
    await adapterManager.init();
    
    // Test Python adapter
    console.log('\n📘 Python Adapter Test:');
    const pythonResult = await adapterManager.execute('python', 
        `return [x**2 for x in range(5)]`, 
        null
    );
    console.log('Result:', pythonResult.data);
    
    // Test JavaScript adapter
    console.log('\n📗 JavaScript Adapter Test:');
    const jsResult = await adapterManager.execute('javascript',
        `return [1,2,3,4,5].map(x => x * 2)`,
        null
    );
    console.log('Result:', jsResult.data);
    
    // Test SQL adapter
    console.log('\n📙 SQL Adapter Test:');
    const sqlResult = await adapterManager.execute('sql',
        'SELECT * FROM users LIMIT 3',
        null
    );
    console.log('Result:', sqlResult.data);
    
    // List all adapters
    console.log('\n📚 Available Adapters:');
    const adapters = adapterManager.listAdapters();
    adapters.forEach(adapter => {
        console.log(`\n• ${adapter.name}:`);
        console.log(`  Runtime: ${adapter.runtime || 'N/A'}`);
        console.log(`  Initialized: ${adapter.initialized}`);
    });
}

// Run tests
async function main() {
    try {
        // Test adapters first
        await testAdapters();
        
        // Then test full pipeline
        console.log('\n');
        await testPipeline();
        
        console.log('\n🎉 All tests completed!\n');
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Check if Python is available
const { exec } = require('child_process');
exec('python --version', (error) => {
    if (error) {
        console.log('\n⚠️  Python not found. Python adapter will be skipped.');
        console.log('   Install Python 3.x to enable Python node execution.\n');
    }
    
    // Run tests
    main();
});