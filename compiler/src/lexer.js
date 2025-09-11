/**
 * OMNIX Lexer - Tokenizes OMNIX source code
 */

class Token {
    constructor(type, value, line, column) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
}

class Lexer {
    constructor(source) {
        this.source = source;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        
        this.keywords = new Set([
            'consensus', 'cluster', 'node', 'function', 'service',
            'state', 'when', 'phase', 'broadcast', 'on', 'let',
            'return', 'if', 'else', 'for', 'while', 'loop',
            'break', 'continue', 'await', 'emit', 'true', 'false',
            'null', 'new', 'self', 'import', 'export', 'contract',
            // Distributed systems keywords
            'pipeline', 'stage', 'workers', 'auto_scale', 'gpu_workers', 'parallel',
            'cross_chain', 'blockchain', 'verify', 'deploy', 'scale', 'balance',
            'edge', 'cloud', 'region', 'zone', 'replica', 'shard', 'load',
            'input', 'output', 'process', 'model', 'gpu', 'cpu'
        ]);
        
        this.types = new Set([
            'u64', 'i64', 'f64', 'bool', 'String', 'Bytes',
            'Vec', 'Set', 'Map', 'Option', 'Result',
            // Distributed types
            'ChainId', 'TokenAmount', 'Address', 'Block', 'Transaction',
            'UserRequest', 'Response', 'RawData', 'ProcessedData'
        ]);
        
        // Consensus algorithms
        this.consensusAlgorithms = new Set([
            'PBFT', 'Raft', 'PoW', 'PoS', 'DPoS', 'Tendermint', 'HotStuff'
        ]);
        
        // Blockchain networks
        this.blockchainNetworks = new Set([
            'ethereum', 'polygon', 'arbitrum', 'optimism', 'solana', 
            'avalanche', 'cosmos', 'bitcoin', 'polkadot'
        ]);
        
        this.consensusOps = {
            '<!>': 'PROPOSE',
            '<?>': 'VOTE',
            '<#>': 'MERGE',
            '<@>': 'QUERY'
        };
    }
    
    current() {
        return this.source[this.position] || '\0';
    }
    
    peek(offset = 1) {
        return this.source[this.position + offset] || '\0';
    }
    
    advance() {
        if (this.current() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
        return this.current();
    }
    
    skipWhitespace() {
        while (/\s/.test(this.current())) {
            this.advance();
        }
    }
    
    skipComment() {
        if (this.current() === '/' && this.peek() === '/') {
            while (this.current() !== '\n' && this.current() !== '\0') {
                this.advance();
            }
            return true;
        }
        
        if (this.current() === '/' && this.peek() === '*') {
            this.advance(); // /
            this.advance(); // *
            while (!(this.current() === '*' && this.peek() === '/') && this.current() !== '\0') {
                this.advance();
            }
            this.advance(); // *
            this.advance(); // /
            return true;
        }
        
        return false;
    }
    
    readString() {
        const quote = this.current();
        let value = '';
        this.advance();
        
        while (this.current() !== quote && this.current() !== '\0') {
            if (this.current() === '\\') {
                this.advance();
                switch (this.current()) {
                    case 'n': value += '\n'; break;
                    case 't': value += '\t'; break;
                    case 'r': value += '\r'; break;
                    case '\\': value += '\\'; break;
                    case '"': value += '"'; break;
                    case "'": value += "'"; break;
                    default: value += this.current();
                }
            } else {
                value += this.current();
            }
            this.advance();
        }
        
        this.advance(); // closing quote
        return new Token('STRING', value, this.line, this.column);
    }
    
    readNumber() {
        let value = '';
        
        while (/[0-9]/.test(this.current())) {
            value += this.current();
            this.advance();
        }
        
        if (this.current() === '.' && /[0-9]/.test(this.peek())) {
            value += this.current();
            this.advance();
            
            while (/[0-9]/.test(this.current())) {
                value += this.current();
                this.advance();
            }
            
            return new Token('FLOAT', parseFloat(value), this.line, this.column);
        }
        
        // Check for time units
        if (/[a-z]/.test(this.current())) {
            let unit = '';
            while (/[a-z]/.test(this.current())) {
                unit += this.current();
                this.advance();
            }
            
            if (['ms', 's', 'm', 'h', 'days'].includes(unit)) {
                return new Token('TIME', { value: parseInt(value), unit }, this.line, this.column);
            }
            
            // Rewind if not a time unit
            this.position -= unit.length;
        }
        
        return new Token('INTEGER', parseInt(value), this.line, this.column);
    }
    
    readIdentifier() {
        let value = '';
        
        while (/[a-zA-Z0-9_]/.test(this.current())) {
            value += this.current();
            this.advance();
        }
        
        if (this.keywords.has(value)) {
            return new Token('KEYWORD', value, this.line, this.column);
        }
        
        if (this.types.has(value)) {
            return new Token('TYPE', value, this.line, this.column);
        }
        
        // Check for consensus algorithms
        if (this.consensusAlgorithms.has(value)) {
            return new Token('CONSENSUS_ALGO', value, this.line, this.column);
        }
        
        // Check for blockchain networks
        if (this.blockchainNetworks.has(value)) {
            return new Token('BLOCKCHAIN', value, this.line, this.column);
        }
        
        // Check for Consensus::Algorithm pattern
        if (value === 'Consensus' && this.current() === ':' && this.peek() === ':') {
            this.advance(); // :
            this.advance(); // :
            let algorithm = '';
            while (/[a-zA-Z]/.test(this.current())) {
                algorithm += this.current();
                this.advance();
            }
            return new Token('CONSENSUS_ALGO', `Consensus::${algorithm}`, this.line, this.column);
        }
        
        return new Token('IDENTIFIER', value, this.line, this.column);
    }
    
    readOperator() {
        const operators = {
            '+': 'PLUS',
            '-': 'MINUS',
            '*': 'MULTIPLY',
            '/': 'DIVIDE',
            '%': 'MODULO',
            '=': 'ASSIGN',
            '!': 'NOT',
            '>': 'GREATER',
            '<': 'LESS',
            '&': 'AND',
            '|': 'OR',
            '^': 'XOR',
            '~': 'BITNOT',
            '.': 'DOT',
            ',': 'COMMA',
            ';': 'SEMICOLON',
            ':': 'COLON',
            '(': 'LPAREN',
            ')': 'RPAREN',
            '[': 'LBRACKET',
            ']': 'RBRACKET',
            '{': 'LBRACE',
            '}': 'RBRACE',
            '@': 'AT'
        };
        
        // Check for consensus operators
        if (this.current() === '<') {
            const next1 = this.peek(1);
            const next2 = this.peek(2);
            
            if (next1 === '!' && next2 === '>') {
                this.advance(); this.advance(); this.advance();
                return new Token('CONSENSUS_OP', 'PROPOSE', this.line, this.column);
            }
            if (next1 === '?' && next2 === '>') {
                this.advance(); this.advance(); this.advance();
                return new Token('CONSENSUS_OP', 'VOTE', this.line, this.column);
            }
            if (next1 === '#' && next2 === '>') {
                this.advance(); this.advance(); this.advance();
                return new Token('CONSENSUS_OP', 'MERGE', this.line, this.column);
            }
            if (next1 === '@' && next2 === '>') {
                this.advance(); this.advance(); this.advance();
                return new Token('CONSENSUS_OP', 'QUERY', this.line, this.column);
            }
        }
        
        // Check for multi-character operators
        const current = this.current();
        const next = this.peek();
        
        if (current === '=' && next === '=') {
            this.advance(); this.advance();
            return new Token('EQUAL', '==', this.line, this.column);
        }
        if (current === '!' && next === '=') {
            this.advance(); this.advance();
            return new Token('NOT_EQUAL', '!=', this.line, this.column);
        }
        if (current === '<' && next === '=') {
            this.advance(); this.advance();
            return new Token('LESS_EQUAL', '<=', this.line, this.column);
        }
        if (current === '>' && next === '=') {
            this.advance(); this.advance();
            return new Token('GREATER_EQUAL', '>=', this.line, this.column);
        }
        if (current === '&' && next === '&') {
            this.advance(); this.advance();
            return new Token('LOGICAL_AND', '&&', this.line, this.column);
        }
        if (current === '|' && next === '|') {
            this.advance(); this.advance();
            return new Token('LOGICAL_OR', '||', this.line, this.column);
        }
        if (current === '-' && next === '>') {
            this.advance(); this.advance();
            return new Token('ARROW', '->', this.line, this.column);
        }
        if (current === ':' && next === ':') {
            this.advance(); this.advance();
            return new Token('DOUBLE_COLON', '::', this.line, this.column);
        }
        
        // Single character operator
        if (operators[current]) {
            const op = operators[current];
            this.advance();
            return new Token(op, current, this.line, this.column);
        }
        
        return null;
    }
    
    tokenize() {
        while (this.current() !== '\0') {
            this.skipWhitespace();
            
            if (this.current() === '\0') break;
            
            if (this.skipComment()) continue;
            
            const startLine = this.line;
            const startColumn = this.column;
            
            // String literals
            if (this.current() === '"' || this.current() === "'") {
                this.tokens.push(this.readString());
                continue;
            }
            
            // Numbers
            if (/[0-9]/.test(this.current())) {
                this.tokens.push(this.readNumber());
                continue;
            }
            
            // Identifiers and keywords
            if (/[a-zA-Z_]/.test(this.current())) {
                this.tokens.push(this.readIdentifier());
                continue;
            }
            
            // Operators
            const op = this.readOperator();
            if (op) {
                this.tokens.push(op);
                continue;
            }
            
            // Unknown character
            throw new Error(`Unexpected character '${this.current()}' at line ${this.line}, column ${this.column}`);
        }
        
        this.tokens.push(new Token('EOF', null, this.line, this.column));
        return this.tokens;
    }
}

module.exports = { Lexer, Token };