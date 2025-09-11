#!/usr/bin/env node

/**
 * OMNIX Compiler/Interpreter
 * Main entry point for executing OMNIX programs
 */

const fs = require('fs');
const path = require('path');
const { Lexer } = require('./lexer');
const { Parser } = require('./parser');
const { Interpreter } = require('./interpreter');

class OmnixCompiler {
    constructor() {
        this.interpreter = new Interpreter();
    }
    
    compile(source, filename = '<stdin>') {
        try {
            // Lexical analysis
            console.log('[Lexer] Tokenizing source...');
            const lexer = new Lexer(source);
            const tokens = lexer.tokenize();
            
            // Parsing
            console.log('[Parser] Building AST...');
            const parser = new Parser(tokens);
            const ast = parser.parse();
            
            return {
                success: true,
                ast,
                tokens
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                filename
            };
        }
    }
    
    execute(ast) {
        try {
            console.log('[Interpreter] Executing program...');
            console.log('─'.repeat(50));
            
            const result = this.interpreter.interpret(ast);
            
            console.log('─'.repeat(50));
            console.log('[Interpreter] Execution completed');
            
            // Show consensus operations if any
            if (this.interpreter.consensusLogs.length > 0) {
                console.log('\n[Consensus Log]');
                this.interpreter.consensusLogs.forEach((log, i) => {
                    console.log(`  ${i + 1}. ${log.operation} at ${new Date(log.timestamp).toISOString()}`);
                    console.log(`     Value: ${JSON.stringify(log.value)}`);
                });
            }
            
            return {
                success: true,
                result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    run(source, filename = '<stdin>') {
        const compileResult = this.compile(source, filename);
        
        if (!compileResult.success) {
            console.error(`Compilation Error: ${compileResult.error}`);
            return false;
        }
        
        const executeResult = this.execute(compileResult.ast);
        
        if (!executeResult.success) {
            console.error(`Runtime Error: ${executeResult.error}`);
            return false;
        }
        
        return true;
    }
    
    runFile(filepath) {
        if (!fs.existsSync(filepath)) {
            console.error(`File not found: ${filepath}`);
            return false;
        }
        
        const source = fs.readFileSync(filepath, 'utf8');
        return this.run(source, filepath);
    }
    
    repl() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'omnix> '
        });
        
        console.log('OMNIX REPL v0.2.0');
        console.log('Type ".help" for help, ".exit" to quit\n');
        
        rl.prompt();
        
        rl.on('line', (line) => {
            const trimmed = line.trim();
            
            if (trimmed === '.exit') {
                console.log('Goodbye!');
                process.exit(0);
            } else if (trimmed === '.help') {
                console.log('Commands:');
                console.log('  .help     Show this help');
                console.log('  .exit     Exit REPL');
                console.log('  .clear    Clear screen');
                console.log('  .env      Show environment');
                console.log('  .ast      Show last AST');
            } else if (trimmed === '.clear') {
                console.clear();
            } else if (trimmed === '.env') {
                console.log('Global Environment:');
                this.interpreter.globalEnv.variables.forEach((value, key) => {
                    console.log(`  ${key}: ${JSON.stringify(value)}`);
                });
            } else if (trimmed === '.ast') {
                if (this.lastAst) {
                    console.log(JSON.stringify(this.lastAst, null, 2));
                } else {
                    console.log('No AST available');
                }
            } else if (trimmed) {
                const compileResult = this.compile(trimmed);
                
                if (compileResult.success) {
                    this.lastAst = compileResult.ast;
                    const executeResult = this.execute(compileResult.ast);
                    
                    if (executeResult.success && executeResult.result !== null) {
                        console.log('=> ' + JSON.stringify(executeResult.result));
                    } else if (!executeResult.success) {
                        console.error('Runtime Error:', executeResult.error);
                    }
                } else {
                    console.error('Syntax Error:', compileResult.error);
                }
            }
            
            rl.prompt();
        });
    }
    
    formatAST(ast, indent = 0) {
        const spaces = '  '.repeat(indent);
        
        if (!ast) return 'null';
        
        if (typeof ast !== 'object') {
            return JSON.stringify(ast);
        }
        
        if (Array.isArray(ast)) {
            if (ast.length === 0) return '[]';
            let result = '[\n';
            ast.forEach((item, i) => {
                result += spaces + '  ' + this.formatAST(item, indent + 1);
                if (i < ast.length - 1) result += ',';
                result += '\n';
            });
            result += spaces + ']';
            return result;
        }
        
        const { type, ...props } = ast;
        let result = `${type} {\n`;
        
        Object.entries(props).forEach(([key, value], i, arr) => {
            result += spaces + '  ' + key + ': ';
            if (value && typeof value === 'object') {
                result += this.formatAST(value, indent + 1);
            } else {
                result += JSON.stringify(value);
            }
            if (i < arr.length - 1) result += ',';
            result += '\n';
        });
        
        result += spaces + '}';
        return result;
    }
}

// CLI interface
if (require.main === module) {
    const compiler = new OmnixCompiler();
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Start REPL
        compiler.repl();
    } else {
        const command = args[0];
        
        switch (command) {
            case 'run':
                if (args[1]) {
                    const success = compiler.runFile(args[1]);
                    process.exit(success ? 0 : 1);
                } else {
                    console.error('Usage: omnix run <file>');
                    process.exit(1);
                }
                break;
                
            case 'compile':
                if (args[1]) {
                    const source = fs.readFileSync(args[1], 'utf8');
                    const result = compiler.compile(source, args[1]);
                    
                    if (result.success) {
                        console.log('Compilation successful');
                        
                        if (args[2] === '--ast') {
                            console.log('\nAST:');
                            console.log(compiler.formatAST(result.ast));
                        }
                        
                        // Save compiled AST
                        const outputFile = args[1].replace('.omx', '.omxc');
                        fs.writeFileSync(outputFile, JSON.stringify(result.ast));
                        console.log(`Compiled to: ${outputFile}`);
                    } else {
                        console.error('Compilation failed:', result.error);
                        process.exit(1);
                    }
                } else {
                    console.error('Usage: omnix compile <file>');
                    process.exit(1);
                }
                break;
                
            case 'repl':
                compiler.repl();
                break;
                
            case 'help':
                console.log('OMNIX Compiler v0.2.0');
                console.log('\nUsage:');
                console.log('  omnix                  Start REPL');
                console.log('  omnix run <file>       Run OMNIX program');
                console.log('  omnix compile <file>   Compile to AST');
                console.log('  omnix repl             Start REPL');
                console.log('  omnix help             Show this help');
                break;
                
            default:
                // Try to run file directly
                if (fs.existsSync(command)) {
                    const success = compiler.runFile(command);
                    process.exit(success ? 0 : 1);
                } else {
                    console.error(`Unknown command or file not found: ${command}`);
                    process.exit(1);
                }
        }
    }
}

module.exports = { OmnixCompiler };