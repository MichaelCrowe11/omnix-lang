"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function activate(context) {
    console.log('OMNIX Language extension is now active!');
    // Register compile command
    const compileCommand = vscode.commands.registerCommand('omnix.compile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'omnix') {
            vscode.window.showErrorMessage('This command can only be run on OMNIX files');
            return;
        }
        await document.save();
        const filePath = document.fileName;
        const compilerPath = vscode.workspace.getConfiguration('omnix').get('compilerPath', 'omnix');
        try {
            const { stdout, stderr } = await execAsync(`${compilerPath} compile "${filePath}"`);
            if (stderr) {
                vscode.window.showErrorMessage(`Compilation failed: ${stderr}`);
            }
            else {
                vscode.window.showInformationMessage(`Compilation successful: ${stdout}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Compilation error: ${error.message}`);
        }
    });
    // Register run command
    const runCommand = vscode.commands.registerCommand('omnix.run', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'omnix') {
            vscode.window.showErrorMessage('This command can only be run on OMNIX files');
            return;
        }
        await document.save();
        const filePath = document.fileName;
        const compilerPath = vscode.workspace.getConfiguration('omnix').get('compilerPath', 'omnix');
        const terminal = vscode.window.createTerminal('OMNIX Run');
        terminal.show();
        terminal.sendText(`${compilerPath} run "${filePath}"`);
    });
    // Register format command
    const formatCommand = vscode.commands.registerCommand('omnix.format', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'omnix') {
            vscode.window.showErrorMessage('This command can only be run on OMNIX files');
            return;
        }
        await document.save();
        const filePath = document.fileName;
        const compilerPath = vscode.workspace.getConfiguration('omnix').get('compilerPath', 'omnix');
        try {
            const { stdout, stderr } = await execAsync(`${compilerPath} fmt "${filePath}"`);
            if (stderr) {
                vscode.window.showErrorMessage(`Formatting failed: ${stderr}`);
            }
            else {
                // Reload the document to show formatted content
                await vscode.commands.executeCommand('workbench.action.files.revert');
                vscode.window.showInformationMessage('Document formatted successfully');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Formatting error: ${error.message}`);
        }
    });
    // Register hover provider for documentation
    const hoverProvider = vscode.languages.registerHoverProvider('omnix', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            // Provide hover information for OMNIX keywords
            const hoverInfo = getHoverInfo(word);
            if (hoverInfo) {
                return new vscode.Hover(hoverInfo);
            }
        }
    });
    // Register completion provider
    const completionProvider = vscode.languages.registerCompletionItemProvider('omnix', {
        provideCompletionItems(document, position, token, context) {
            const completionItems = [];
            // Add OMNIX keywords
            const keywords = [
                'consensus', 'cluster', 'node', 'function', 'service', 'state',
                'when', 'phase', 'broadcast', 'on', 'let', 'return', 'if', 'else',
                'for', 'while', 'loop', 'break', 'continue'
            ];
            keywords.forEach(keyword => {
                const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
                item.detail = `OMNIX keyword: ${keyword}`;
                completionItems.push(item);
            });
            // Add types
            const types = ['u64', 'i64', 'f64', 'bool', 'String', 'Bytes', 'Vec', 'Set', 'Map'];
            types.forEach(type => {
                const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.Class);
                item.detail = `OMNIX type: ${type}`;
                completionItems.push(item);
            });
            // Add consensus algorithms
            const algorithms = ['Raft', 'PBFT', 'Tendermint'];
            algorithms.forEach(algo => {
                const item = new vscode.CompletionItem(`Consensus::${algo}`, vscode.CompletionItemKind.Enum);
                item.detail = `Consensus algorithm: ${algo}`;
                completionItems.push(item);
            });
            return completionItems;
        }
    });
    // Register diagnostic provider for basic syntax checking
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('omnix');
    const updateDiagnostics = (document) => {
        if (document.languageId !== 'omnix') {
            return;
        }
        const diagnostics = [];
        const text = document.getText();
        const lines = text.split('\n');
        // Basic syntax checking
        lines.forEach((line, i) => {
            // Check for unclosed brackets
            const openBrackets = (line.match(/{/g) || []).length;
            const closeBrackets = (line.match(/}/g) || []).length;
            if (openBrackets > closeBrackets && !line.includes('//')) {
                const range = new vscode.Range(i, 0, i, line.length);
                const diagnostic = new vscode.Diagnostic(range, 'Possible unclosed bracket', vscode.DiagnosticSeverity.Warning);
                diagnostics.push(diagnostic);
            }
            // Check for missing semicolons (simplified)
            if (line.trim() && !line.trim().endsWith(';') && !line.trim().endsWith('{') &&
                !line.trim().endsWith('}') && !line.includes('//') &&
                !line.trim().startsWith('@') && !line.includes('function') &&
                !line.includes('node') && !line.includes('cluster')) {
                // This is a simplified check - in production, use proper parser
            }
        });
        diagnosticCollection.set(document.uri, diagnostics);
    };
    // Update diagnostics on document change
    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'omnix') {
            updateDiagnostics(event.document);
        }
    });
    // Update diagnostics on document open
    vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'omnix') {
            updateDiagnostics(document);
        }
    });
    context.subscriptions.push(compileCommand, runCommand, formatCommand, hoverProvider, completionProvider, diagnosticCollection);
}
exports.activate = activate;
function getHoverInfo(word) {
    const hoverData = {
        'consensus': '**consensus** - Defines a consensus-based distributed cluster',
        'cluster': '**cluster** - Groups nodes together for distributed computation',
        'node': '**node** - Defines a distributed node in the OMNIX network',
        'function': '**function** - Declares a function',
        'service': '**service** - Declares a service function with automatic distribution',
        'state': '**state** - Declares state variable that can be replicated',
        'when': '**when** - Conditional execution based on consensus results',
        'phase': '**phase** - Defines execution phases for distributed operations',
        'broadcast': '**broadcast** - Sends an event to all nodes in the cluster',
        'replicated': '**@replicated** - Marks state as replicated across nodes',
        'rpc': '**@rpc** - Exposes function as RPC endpoint',
        'Raft': '**Raft** - Raft consensus algorithm for leader election',
        'PBFT': '**PBFT** - Practical Byzantine Fault Tolerance consensus',
        'Tendermint': '**Tendermint** - Tendermint BFT consensus algorithm'
    };
    const info = hoverData[word];
    if (info) {
        const markdown = new vscode.MarkdownString(info);
        markdown.isTrusted = true;
        return markdown;
    }
    return undefined;
}
function deactivate() {
    console.log('OMNIX Language extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map