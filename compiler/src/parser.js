/**
 * OMNIX Parser - Builds Abstract Syntax Tree from tokens
 */

const { Lexer } = require('./lexer');

class ASTNode {
    constructor(type, props = {}) {
        this.type = type;
        Object.assign(this, props);
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
    }
    
    peek(offset = 0) {
        return this.tokens[this.current + offset] || { type: 'EOF' };
    }
    
    advance() {
        return this.tokens[this.current++];
    }
    
    expect(type) {
        const token = this.peek();
        if (token.type !== type) {
            throw new Error(`Expected ${type} but got ${token.type} at line ${token.line}`);
        }
        return this.advance();
    }
    
    match(...types) {
        return types.includes(this.peek().type);
    }
    
    consume(type) {
        if (this.match(type)) {
            return this.advance();
        }
        return null;
    }
    
    parse() {
        const program = new ASTNode('Program', { body: [] });
        
        while (!this.match('EOF')) {
            program.body.push(this.parseTopLevel());
        }
        
        return program;
    }
    
    parseTopLevel() {
        // Handle annotations
        const annotations = [];
        while (this.match('AT')) {
            annotations.push(this.parseAnnotation());
        }
        
        const token = this.peek();
        
        if (token.type === 'KEYWORD') {
            switch (token.value) {
                case 'consensus':
                    return this.parseConsensusCluster(annotations);
                case 'node':
                    return this.parseNode(annotations);
                case 'function':
                    return this.parseFunction(annotations);
                case 'contract':
                    return this.parseContract(annotations);
                case 'pipeline':
                    return this.parsePipeline(annotations);
                case 'cross_chain':
                    return this.parseCrossChainContract(annotations);
                case 'import':
                    return this.parseImport();
                case 'export':
                    return this.parseExport();
                default:
                    // Allow statements at top level for scripting
                    return this.parseStatement();
            }
        }
        
        // Allow expressions at top level for scripting
        if (token.type === 'IDENTIFIER' || token.type === 'INTEGER' || 
            token.type === 'STRING' || token.type === 'FLOAT') {
            return this.parseStatement();
        }
        
        throw new Error(`Unexpected token ${token.type} at top level`);
    }
    
    parseAnnotation() {
        this.expect('AT');
        const name = this.expect('IDENTIFIER').value;
        const params = [];
        
        if (this.match('LPAREN')) {
            this.advance();
            
            while (!this.match('RPAREN')) {
                const paramName = this.expect('IDENTIFIER').value;
                this.expect('COLON');
                const paramValue = this.parseExpression();
                params.push({ name: paramName, value: paramValue });
                
                if (!this.match('RPAREN')) {
                    this.expect('COMMA');
                }
            }
            
            this.expect('RPAREN');
        }
        
        return new ASTNode('Annotation', { name, params });
    }
    
    parseConsensusCluster(annotations) {
        this.expect('KEYWORD'); // consensus
        this.expect('KEYWORD'); // cluster
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');
        
        const properties = {};
        const methods = [];
        const states = [];
        
        while (!this.match('RBRACE')) {
            if (this.match('IDENTIFIER')) {
                const id = this.peek().value;
                
                if (id === 'replicas' || id === 'consensus' || id === 'zones') {
                    const prop = this.advance().value;
                    this.expect('COLON');
                    properties[prop] = this.parseExpression();
                    continue;
                }
            }
            
            if (this.match('AT')) {
                const methodAnnotations = [this.parseAnnotation()];
                if (this.peek().value === 'state') {
                    states.push(this.parseState(methodAnnotations));
                } else {
                    methods.push(this.parseFunction(methodAnnotations));
                }
                continue;
            }
            
            if (this.peek().value === 'state') {
                states.push(this.parseState([]));
            } else if (this.peek().value === 'service' || this.peek().value === 'function') {
                methods.push(this.parseFunction([]));
            } else {
                this.advance(); // Skip unknown
            }
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('ConsensusCluster', {
            name,
            annotations,
            properties,
            states,
            methods
        });
    }
    
    parseNode(annotations) {
        this.expect('KEYWORD'); // node
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');
        
        const states = [];
        const methods = [];
        
        while (!this.match('RBRACE')) {
            if (this.match('AT')) {
                const methodAnnotations = [this.parseAnnotation()];
                if (this.peek().value === 'state') {
                    states.push(this.parseState(methodAnnotations));
                } else {
                    methods.push(this.parseFunction(methodAnnotations));
                }
            } else if (this.peek().value === 'state') {
                states.push(this.parseState([]));
            } else if (this.peek().value === 'function' || this.peek().value === 'on') {
                methods.push(this.parseFunction([]));
            } else {
                this.advance(); // Skip
            }
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('Node', {
            name,
            annotations,
            states,
            methods
        });
    }
    
    parseContract(annotations) {
        this.expect('KEYWORD'); // contract
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');
        
        const methods = [];
        
        while (!this.match('RBRACE')) {
            if (this.peek().value === 'function') {
                methods.push(this.parseFunction([]));
            } else {
                this.advance();
            }
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('Contract', {
            name,
            annotations,
            methods
        });
    }
    
    parseState(annotations) {
        this.expect('KEYWORD'); // state
        const name = this.expect('IDENTIFIER').value;
        this.expect('COLON');
        const type = this.parseType();
        
        let initialValue = null;
        if (this.consume('ASSIGN')) {
            initialValue = this.parseExpression();
        }
        
        this.consume('SEMICOLON');
        
        return new ASTNode('State', {
            name,
            type,
            initialValue,
            annotations
        });
    }
    
    parseFunction(annotations) {
        const isService = this.peek().value === 'service';
        const isEventHandler = this.peek().value === 'on';
        
        this.advance(); // function/service/on
        
        const name = this.expect('IDENTIFIER').value;
        this.expect('LPAREN');
        
        const params = [];
        while (!this.match('RPAREN')) {
            const paramName = this.expect('IDENTIFIER').value;
            this.expect('COLON');
            const paramType = this.parseType();
            params.push({ name: paramName, type: paramType });
            
            if (!this.match('RPAREN')) {
                this.expect('COMMA');
            }
        }
        
        this.expect('RPAREN');
        
        let returnType = null;
        if (this.consume('ARROW')) {
            returnType = this.parseType();
        }
        
        const body = this.parseBlock();
        
        return new ASTNode('Function', {
            name,
            params,
            returnType,
            body,
            annotations,
            isService,
            isEventHandler
        });
    }
    
    parseBlock() {
        this.expect('LBRACE');
        const statements = [];
        
        while (!this.match('RBRACE')) {
            statements.push(this.parseStatement());
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('Block', { statements });
    }
    
    parseStatement() {
        const token = this.peek();
        
        if (token.type === 'KEYWORD') {
            switch (token.value) {
                case 'let':
                    return this.parseLetStatement();
                case 'return':
                    return this.parseReturnStatement();
                case 'if':
                    return this.parseIfStatement();
                case 'when':
                    return this.parseWhenStatement();
                case 'phase':
                    return this.parsePhaseStatement();
                case 'broadcast':
                    return this.parseBroadcastStatement();
                case 'for':
                    return this.parseForStatement();
                case 'while':
                    return this.parseWhileStatement();
                default:
                    break;
            }
        }
        
        // Check for assignment statement (identifier = expression)
        if (token.type === 'IDENTIFIER' && this.peek(1).type === 'ASSIGN') {
            const name = this.advance().value;
            this.advance(); // consume =
            const value = this.parseExpression();
            this.consume('SEMICOLON');
            return new ASTNode('AssignmentStatement', { name, value });
        }
        
        // Expression statement
        const expr = this.parseExpression();
        this.consume('SEMICOLON');
        return new ASTNode('ExpressionStatement', { expression: expr });
    }
    
    parseLetStatement() {
        this.expect('KEYWORD'); // let
        const name = this.expect('IDENTIFIER').value;
        this.expect('ASSIGN');
        const value = this.parseExpression();
        this.consume('SEMICOLON');
        
        return new ASTNode('LetStatement', { name, value });
    }
    
    parseReturnStatement() {
        this.expect('KEYWORD'); // return
        
        let value = null;
        if (!this.match('SEMICOLON')) {
            value = this.parseExpression();
        }
        
        this.consume('SEMICOLON');
        
        return new ASTNode('ReturnStatement', { value });
    }
    
    parseWhenStatement() {
        this.expect('KEYWORD'); // when
        const condition = this.parseExpression();
        const body = this.parseBlock();
        
        return new ASTNode('WhenStatement', { condition, body });
    }
    
    parsePhaseStatement() {
        this.expect('KEYWORD'); // phase
        const name = this.expect('IDENTIFIER').value;
        const body = this.parseBlock();
        
        return new ASTNode('PhaseStatement', { name, body });
    }
    
    parseBroadcastStatement() {
        this.expect('KEYWORD'); // broadcast
        this.expect('LPAREN');
        const event = this.parseExpression();
        this.expect('RPAREN');
        this.consume('SEMICOLON');
        
        return new ASTNode('BroadcastStatement', { event });
    }
    
    parseIfStatement() {
        this.expect('KEYWORD'); // if
        const condition = this.parseExpression();
        const thenBranch = this.parseBlock();
        
        let elseBranch = null;
        if (this.consume('KEYWORD') && this.peek(-1).value === 'else') {
            elseBranch = this.match('LBRACE') ? this.parseBlock() : this.parseIfStatement();
        }
        
        return new ASTNode('IfStatement', { condition, thenBranch, elseBranch });
    }
    
    parseForStatement() {
        this.expect('KEYWORD'); // for
        const variable = this.expect('IDENTIFIER').value;
        this.expect('KEYWORD'); // in
        const iterable = this.parseExpression();
        const body = this.parseBlock();
        
        return new ASTNode('ForStatement', { variable, iterable, body });
    }
    
    parseWhileStatement() {
        this.expect('KEYWORD'); // while
        const condition = this.parseExpression();
        const body = this.parseBlock();
        
        return new ASTNode('WhileStatement', { condition, body });
    }
    
    parseExpression() {
        return this.parseConsensusExpression();
    }
    
    parseConsensusExpression() {
        let left = this.parseLogicalOr();
        
        if (this.match('CONSENSUS_OP')) {
            const op = this.advance().value;
            this.expect('LBRACE');
            
            const options = {};
            while (!this.match('RBRACE')) {
                const key = this.expect('IDENTIFIER').value;
                this.expect('COLON');
                const value = this.parseExpression();
                options[key] = value;
                
                if (!this.match('RBRACE')) {
                    this.expect('COMMA');
                }
            }
            
            this.expect('RBRACE');
            
            return new ASTNode('ConsensusExpression', {
                value: left,
                operation: op,
                options
            });
        }
        
        return left;
    }
    
    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        
        while (this.match('LOGICAL_OR')) {
            const op = this.advance();
            const right = this.parseLogicalAnd();
            left = new ASTNode('BinaryExpression', {
                operator: op.value,
                left,
                right
            });
        }
        
        return left;
    }
    
    parseLogicalAnd() {
        let left = this.parseEquality();
        
        while (this.match('LOGICAL_AND')) {
            const op = this.advance();
            const right = this.parseEquality();
            left = new ASTNode('BinaryExpression', {
                operator: op.value,
                left,
                right
            });
        }
        
        return left;
    }
    
    parseEquality() {
        let left = this.parseComparison();
        
        while (this.match('EQUAL', 'NOT_EQUAL')) {
            const op = this.advance();
            const right = this.parseComparison();
            left = new ASTNode('BinaryExpression', {
                operator: op.value,
                left,
                right
            });
        }
        
        return left;
    }
    
    parseComparison() {
        let left = this.parseAddition();
        
        while (this.match('GREATER', 'GREATER_EQUAL', 'LESS', 'LESS_EQUAL')) {
            const op = this.advance();
            const right = this.parseAddition();
            left = new ASTNode('BinaryExpression', {
                operator: op.value,
                left,
                right
            });
        }
        
        return left;
    }
    
    parseAddition() {
        let left = this.parseMultiplication();
        
        while (this.match('PLUS', 'MINUS')) {
            const op = this.advance();
            const right = this.parseMultiplication();
            left = new ASTNode('BinaryExpression', {
                operator: op.value,
                left,
                right
            });
        }
        
        return left;
    }
    
    parseMultiplication() {
        let left = this.parseUnary();
        
        while (this.match('MULTIPLY', 'DIVIDE', 'MODULO')) {
            const op = this.advance();
            const right = this.parseUnary();
            left = new ASTNode('BinaryExpression', {
                operator: op.value,
                left,
                right
            });
        }
        
        return left;
    }
    
    parseUnary() {
        if (this.match('NOT', 'MINUS')) {
            const op = this.advance();
            const operand = this.parseUnary();
            return new ASTNode('UnaryExpression', {
                operator: op.value,
                operand
            });
        }
        
        return this.parsePostfix();
    }
    
    parsePostfix() {
        let left = this.parsePrimary();
        
        while (true) {
            if (this.match('LPAREN')) {
                // Function call
                this.advance();
                const args = [];
                
                while (!this.match('RPAREN')) {
                    args.push(this.parseExpression());
                    if (!this.match('RPAREN')) {
                        this.expect('COMMA');
                    }
                }
                
                this.expect('RPAREN');
                
                left = new ASTNode('CallExpression', {
                    callee: left,
                    arguments: args
                });
            } else if (this.match('DOT')) {
                // Member access
                this.advance();
                const property = this.expect('IDENTIFIER').value;
                left = new ASTNode('MemberExpression', {
                    object: left,
                    property
                });
            } else if (this.match('LBRACKET')) {
                // Array/map access
                this.advance();
                const index = this.parseExpression();
                this.expect('RBRACKET');
                
                left = new ASTNode('IndexExpression', {
                    object: left,
                    index
                });
            } else {
                break;
            }
        }
        
        return left;
    }
    
    parsePrimary() {
        // Literals
        if (this.match('INTEGER')) {
            const value = this.advance().value;
            return new ASTNode('IntegerLiteral', { value });
        }
        
        if (this.match('FLOAT')) {
            const value = this.advance().value;
            return new ASTNode('FloatLiteral', { value });
        }
        
        if (this.match('STRING')) {
            const value = this.advance().value;
            return new ASTNode('StringLiteral', { value });
        }
        
        if (this.match('TIME')) {
            const { value, unit } = this.advance().value;
            return new ASTNode('TimeLiteral', { value, unit });
        }
        
        if (this.peek().value === 'true' || this.peek().value === 'false') {
            const value = this.advance().value === 'true';
            return new ASTNode('BooleanLiteral', { value });
        }
        
        if (this.peek().value === 'null') {
            this.advance();
            return new ASTNode('NullLiteral');
        }
        
        // Identifiers
        if (this.match('IDENTIFIER')) {
            const name = this.advance().value;
            
            // Check for :: operator (static access)
            if (this.match('DOUBLE_COLON')) {
                this.advance();
                const method = this.expect('IDENTIFIER').value;
                return new ASTNode('StaticAccess', {
                    class: name,
                    method
                });
            }
            
            return new ASTNode('Identifier', { name });
        }
        
        // Consensus algorithms
        if (this.match('CONSENSUS_ALGO')) {
            const algorithm = this.advance().value;
            return new ASTNode('ConsensusAlgorithm', { algorithm });
        }
        
        // Array literals
        if (this.match('LBRACKET')) {
            this.advance();
            const elements = [];
            
            while (!this.match('RBRACKET')) {
                elements.push(this.parseExpression());
                if (!this.match('RBRACKET')) {
                    this.expect('COMMA');
                }
            }
            
            this.expect('RBRACKET');
            return new ASTNode('ArrayLiteral', { elements });
        }
        
        // Object literals
        if (this.match('LBRACE')) {
            this.advance();
            const properties = [];
            
            while (!this.match('RBRACE')) {
                const key = this.expect('IDENTIFIER').value;
                this.expect('COLON');
                const value = this.parseExpression();
                properties.push({ key, value });
                
                if (!this.match('RBRACE')) {
                    this.expect('COMMA');
                }
            }
            
            this.expect('RBRACE');
            return new ASTNode('ObjectLiteral', { properties });
        }
        
        // Parenthesized expression
        if (this.match('LPAREN')) {
            this.advance();
            const expr = this.parseExpression();
            this.expect('RPAREN');
            return expr;
        }
        
        throw new Error(`Unexpected token ${this.peek().type} at line ${this.peek().line}`);
    }
    
    parseType() {
        if (this.match('TYPE')) {
            const baseType = this.advance().value;
            
            // Generic types
            if (this.match('LESS')) {
                this.advance();
                const typeParams = [];
                
                while (!this.match('GREATER')) {
                    typeParams.push(this.parseType());
                    if (!this.match('GREATER')) {
                        this.expect('COMMA');
                    }
                }
                
                this.expect('GREATER');
                
                return new ASTNode('GenericType', {
                    base: baseType,
                    params: typeParams
                });
            }
            
            return new ASTNode('SimpleType', { name: baseType });
        }
        
        if (this.match('IDENTIFIER')) {
            const name = this.advance().value;
            return new ASTNode('SimpleType', { name });
        }
        
        throw new Error(`Expected type but got ${this.peek().type}`);
    }
    
    parseImport() {
        this.expect('KEYWORD'); // import
        const module = this.expect('STRING').value;
        this.consume('SEMICOLON');
        
        return new ASTNode('ImportStatement', { module });
    }
    
    parseExport() {
        this.expect('KEYWORD'); // export
        const declaration = this.parseTopLevel();
        
        return new ASTNode('ExportStatement', { declaration });
    }
    
    // New distributed systems constructs
    
    parsePipeline(annotations) {
        this.expect('KEYWORD'); // pipeline
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');
        
        const stages = [];
        const properties = {};
        
        while (!this.match('RBRACE')) {
            if (this.match('IDENTIFIER')) {
                const id = this.peek().value;
                
                if (id === 'input' || id === 'output') {
                    const prop = this.advance().value;
                    this.expect('COLON');
                    properties[prop] = this.parseExpression();
                    continue;
                }
                
                if (id === 'stage') {
                    stages.push(this.parseStage());
                    continue;
                }
            }
            
            // Skip unknown tokens
            this.advance();
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('Pipeline', {
            name,
            annotations,
            properties,
            stages
        });
    }
    
    parseStage() {
        this.expect('KEYWORD'); // stage
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');
        
        const properties = {};
        
        while (!this.match('RBRACE')) {
            if (this.match('IDENTIFIER')) {
                const key = this.advance().value;
                this.expect('COLON');
                properties[key] = this.parseExpression();
                
                if (!this.match('RBRACE')) {
                    this.consume('COMMA') || this.consume('SEMICOLON');
                }
            } else {
                this.advance(); // Skip unknown
            }
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('Stage', {
            name,
            properties
        });
    }
    
    parseCrossChainContract(annotations) {
        this.expect('KEYWORD'); // cross_chain
        this.expect('LPAREN');
        
        // Parse chain list
        const chains = [];
        if (this.match('LBRACKET')) {
            this.advance();
            
            while (!this.match('RBRACKET')) {
                chains.push(this.expect('STRING').value);
                if (!this.match('RBRACKET')) {
                    this.expect('COMMA');
                }
            }
            
            this.expect('RBRACKET');
        }
        
        this.expect('RPAREN');
        this.expect('KEYWORD'); // contract
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');
        
        const methods = [];
        
        while (!this.match('RBRACE')) {
            if (this.peek().value === 'function') {
                methods.push(this.parseFunction([]));
            } else {
                this.advance();
            }
        }
        
        this.expect('RBRACE');
        
        return new ASTNode('CrossChainContract', {
            name,
            chains,
            annotations,
            methods
        });
    }
}

module.exports = { Parser, ASTNode };