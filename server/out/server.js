"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create connection
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', '<', '!', '?', '#', '@']
            },
            hoverProvider: true,
            documentFormattingProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            codeActionProvider: true,
            codeLensProvider: {
                resolveProvider: true
            },
            documentHighlightProvider: true,
            renameProvider: true,
            foldingRangeProvider: true
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
});
// OMNIX Language Keywords and Types
const omnixKeywords = [
    'consensus', 'cluster', 'node', 'function', 'service', 'state',
    'when', 'phase', 'broadcast', 'on', 'let', 'return', 'if', 'else',
    'for', 'while', 'loop', 'break', 'continue', 'await', 'emit'
];
const omnixTypes = [
    'u64', 'i64', 'f64', 'bool', 'String', 'Bytes',
    'Vec', 'Set', 'Map', 'Option', 'Result',
    'ChainId', 'TokenAmount', 'Peer', 'Request', 'Response'
];
const omnixBuiltins = [
    'println', 'print', 'assert', 'panic', 'todo',
    'sync_with_peer', 'join_cluster', 'start', 'synchronized',
    'is_majority_partition', 'continue_operation', 'enter_read_only_mode'
];
const consensusAlgorithms = [
    'Consensus::Raft', 'Consensus::PBFT', 'Consensus::Tendermint',
    'Consensus::HotStuff', 'Consensus::Avalanche'
];
// Completion
connection.onCompletion((_textDocumentPosition) => {
    const completions = [];
    // Add keywords
    omnixKeywords.forEach(keyword => {
        completions.push({
            label: keyword,
            kind: node_1.CompletionItemKind.Keyword,
            detail: `OMNIX keyword: ${keyword}`,
            documentation: getKeywordDocumentation(keyword)
        });
    });
    // Add types
    omnixTypes.forEach(type => {
        completions.push({
            label: type,
            kind: node_1.CompletionItemKind.Class,
            detail: `OMNIX type: ${type}`,
            documentation: getTypeDocumentation(type)
        });
    });
    // Add built-in functions
    omnixBuiltins.forEach(func => {
        completions.push({
            label: func,
            kind: node_1.CompletionItemKind.Function,
            detail: `Built-in function: ${func}`,
            documentation: getFunctionDocumentation(func)
        });
    });
    // Add consensus algorithms
    consensusAlgorithms.forEach(algo => {
        completions.push({
            label: algo,
            kind: node_1.CompletionItemKind.Enum,
            detail: 'Consensus algorithm',
            documentation: getConsensusDocumentation(algo)
        });
    });
    // Add consensus operators
    const operators = [
        { label: '<!>', detail: 'Propose operator', doc: 'Submit value to consensus protocol' },
        { label: '<?>', detail: 'Vote operator', doc: 'Participate in voting on proposal' },
        { label: '<#>', detail: 'Merge operator', doc: 'Apply consensus-safe merge' },
        { label: '<@>', detail: 'Query operator', doc: 'Query distributed state' }
    ];
    operators.forEach(op => {
        completions.push({
            label: op.label,
            kind: node_1.CompletionItemKind.Operator,
            detail: op.detail,
            documentation: op.doc
        });
    });
    return completions;
});
// Hover information
connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const position = params.position;
    const line = document.getText({
        start: { line: position.line, character: 0 },
        end: { line: position.line + 1, character: 0 }
    });
    const wordRange = getWordRangeAtPosition(document, position);
    if (!wordRange)
        return null;
    const word = document.getText(wordRange);
    const documentation = getHoverDocumentation(word);
    if (documentation) {
        return {
            contents: {
                kind: node_1.MarkupKind.Markdown,
                value: documentation
            }
        };
    }
    return null;
});
// Document validation
async function validateDocument(textDocument) {
    const text = textDocument.getText();
    const diagnostics = [];
    // Check for common syntax errors
    const lines = text.split('\n');
    lines.forEach((line, i) => {
        // Check for unclosed brackets
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        if (openBraces > closeBraces && !line.includes('//')) {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Warning,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                message: 'Possible unclosed brace',
                source: 'omnix'
            });
        }
        if (openParens > closeParens && !line.includes('//')) {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Warning,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                },
                message: 'Possible unclosed parenthesis',
                source: 'omnix'
            });
        }
        // Check for missing semicolons (simplified)
        const trimmed = line.trim();
        if (trimmed &&
            !trimmed.endsWith(';') &&
            !trimmed.endsWith('{') &&
            !trimmed.endsWith('}') &&
            !trimmed.startsWith('//') &&
            !trimmed.startsWith('@') &&
            !omnixKeywords.some(kw => trimmed.startsWith(kw)) &&
            trimmed.includes('=')) {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Information,
                range: {
                    start: { line: i, character: line.length - 1 },
                    end: { line: i, character: line.length }
                },
                message: 'Statement should end with semicolon',
                source: 'omnix'
            });
        }
    });
    // Check for undefined consensus algorithms
    const consensusPattern = /Consensus::\w+/g;
    let match;
    while ((match = consensusPattern.exec(text)) !== null) {
        if (!consensusAlgorithms.includes(match[0])) {
            const position = textDocument.positionAt(match.index);
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: position,
                    end: textDocument.positionAt(match.index + match[0].length)
                },
                message: `Unknown consensus algorithm: ${match[0]}`,
                source: 'omnix'
            });
        }
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
// Document formatting
connection.onDocumentFormatting((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const formatted = formatOmnixCode(text);
    return [{
            range: {
                start: document.positionAt(0),
                end: document.positionAt(text.length)
            },
            newText: formatted
        }];
});
// Helper functions
function getWordRangeAtPosition(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    let start = offset;
    let end = offset;
    while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
    }
    while (end < text.length && /\w/.test(text[end])) {
        end++;
    }
    if (start === end)
        return null;
    return {
        start: document.positionAt(start),
        end: document.positionAt(end)
    };
}
function getKeywordDocumentation(keyword) {
    const docs = {
        'consensus': 'Defines a consensus-based distributed cluster',
        'cluster': 'Groups nodes together for distributed computation',
        'node': 'Defines a distributed node in the OMNIX network',
        'function': 'Declares a function',
        'service': 'Declares a service function with automatic distribution',
        'state': 'Declares state variable that can be replicated',
        'when': 'Conditional execution based on consensus results',
        'phase': 'Defines execution phases for distributed operations',
        'broadcast': 'Sends an event to all nodes in the cluster'
    };
    return docs[keyword] || '';
}
function getTypeDocumentation(type) {
    const docs = {
        'u64': 'Unsigned 64-bit integer',
        'i64': 'Signed 64-bit integer',
        'f64': '64-bit floating point number',
        'bool': 'Boolean value (true/false)',
        'String': 'UTF-8 string',
        'Vec': 'Dynamic array',
        'Map': 'Key-value map',
        'Set': 'Unordered collection of unique values'
    };
    return docs[type] || '';
}
function getFunctionDocumentation(func) {
    const docs = {
        'println': 'Print line to console with newline',
        'sync_with_peer': 'Synchronize state with a peer node',
        'join_cluster': 'Join a distributed cluster',
        'start': 'Start the node or service'
    };
    return docs[func] || '';
}
function getConsensusDocumentation(algo) {
    const docs = {
        'Consensus::Raft': 'Raft consensus algorithm for leader election and log replication',
        'Consensus::PBFT': 'Practical Byzantine Fault Tolerance for Byzantine environments',
        'Consensus::Tendermint': 'Tendermint BFT consensus with instant finality'
    };
    return docs[algo] || '';
}
function getHoverDocumentation(word) {
    let documentation = getKeywordDocumentation(word);
    if (documentation) {
        return `**${word}**\n\n${documentation}`;
    }
    documentation = getTypeDocumentation(word);
    if (documentation) {
        return `**${word}**\n\n${documentation}`;
    }
    documentation = getFunctionDocumentation(word);
    if (documentation) {
        return `**${word}**\n\n${documentation}`;
    }
    // Check consensus algorithms
    if (word.startsWith('Consensus::')) {
        documentation = getConsensusDocumentation(word);
        if (documentation) {
            return `**${word}**\n\n${documentation}`;
        }
    }
    return null;
}
function formatOmnixCode(code) {
    // Simple formatter - can be enhanced
    const lines = code.split('\n');
    let indentLevel = 0;
    const formatted = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.endsWith('}')) {
            indentLevel--;
        }
        const indent = '    '.repeat(Math.max(0, indentLevel));
        formatted.push(indent + trimmed);
        if (trimmed.endsWith('{')) {
            indentLevel++;
        }
    }
    return formatted.join('\n');
}
// Listen for document changes
documents.onDidChangeContent(change => {
    validateDocument(change.document);
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map