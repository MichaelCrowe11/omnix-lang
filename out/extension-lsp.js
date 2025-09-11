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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const node_1 = require("vscode-languageclient/node");
let client;
function activate(context) {
    console.log('OMNIX Language extension with LSP is now active!');
    // Path to language server
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // Server options
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Client options
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'omnix' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.omx')
        }
    };
    // Create and start the language client
    client = new node_1.LanguageClient('omnixLanguageServer', 'OMNIX Language Server', serverOptions, clientOptions);
    // Start the client
    client.start();
    // Register additional commands
    registerCommands(context);
    // Register custom features
    registerCustomFeatures(context);
}
exports.activate = activate;
function registerCommands(context) {
    // Compile command
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
        const terminal = vscode.window.createTerminal('OMNIX Compiler');
        terminal.show();
        terminal.sendText(`omnix compile "${document.fileName}"`);
    });
    // Run command
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
        const terminal = vscode.window.createTerminal('OMNIX Run');
        terminal.show();
        terminal.sendText(`omnix run "${document.fileName}"`);
    });
    // Format command
    const formatCommand = vscode.commands.registerCommand('omnix.format', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        // Trigger formatting through LSP
        await vscode.commands.executeCommand('editor.action.formatDocument');
    });
    // New consensus template command
    const consensusTemplate = vscode.commands.registerCommand('omnix.insertConsensusTemplate', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const template = `consensus cluster ServiceName {
    replicas: 5
    consensus: PBFT
    zones: ["us-east", "eu-west", "asia-pacific"]
    
    @replicated
    state counter: u64 = 0;
    
    service handle_request(req: Request) -> Response {
        let proposal = compute_value(req);
        let result = proposal <!> {
            validators: 3,
            timeout: 2000ms,
            algorithm: Consensus::PBFT
        };
        
        when result.accepted() {
            state <#> result.value;
            broadcast(StateUpdate(state));
        }
        
        return Response { success: true };
    }
}`;
        editor.insertSnippet(new vscode.SnippetString(template));
    });
    // Visualize cluster topology
    const visualizeTopology = vscode.commands.registerCommand('omnix.visualizeTopology', () => {
        const panel = vscode.window.createWebviewPanel('omnixTopology', 'OMNIX Cluster Topology', vscode.ViewColumn.Two, {
            enableScripts: true
        });
        panel.webview.html = getTopologyVisualizationHtml();
    });
    context.subscriptions.push(compileCommand, runCommand, formatCommand, consensusTemplate, visualizeTopology);
}
function registerCustomFeatures(context) {
    // Status bar item showing consensus status
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(symbol-namespace) OMNIX';
    statusBarItem.tooltip = 'OMNIX Language Server Active';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Code lens provider for running tests
    const codeLensProvider = vscode.languages.registerCodeLensProvider({ language: 'omnix' }, {
        provideCodeLenses(document) {
            const codeLenses = [];
            const text = document.getText();
            const regex = /function\s+test_\w+/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const line = document.positionAt(match.index).line;
                const range = new vscode.Range(line, 0, line, 0);
                codeLenses.push(new vscode.CodeLens(range, {
                    title: 'Run Test',
                    command: 'omnix.runTest',
                    arguments: [match[0]]
                }));
            }
            return codeLenses;
        }
    });
    context.subscriptions.push(codeLensProvider);
    // Semantic token provider for enhanced syntax highlighting
    const tokenTypes = ['class', 'interface', 'enum', 'function', 'variable'];
    const tokenModifiers = ['declaration', 'readonly', 'static', 'async'];
    const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
    const provider = {
        provideDocumentSemanticTokens(document) {
            const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
            // Add semantic tokens for consensus keywords
            const text = document.getText();
            const consensusRegex = /\b(consensus|cluster|node)\s+(\w+)/g;
            let match;
            while ((match = consensusRegex.exec(text)) !== null) {
                const position = document.positionAt(match.index + match[1].length + 1);
                tokensBuilder.push(position.line, position.character, match[2].length, 0, // class
                0 // declaration
                );
            }
            return tokensBuilder.build();
        }
    };
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'omnix' }, provider, legend));
}
function getTopologyVisualizationHtml() {
    return `<!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                background: #1e1e1e;
                color: #cccccc;
                font-family: 'Segoe UI', sans-serif;
                padding: 20px;
            }
            #topology {
                width: 100%;
                height: 500px;
                border: 1px solid #464647;
                border-radius: 5px;
            }
            h2 {
                color: #9333EA;
            }
            .info {
                margin-top: 20px;
                padding: 10px;
                background: #252526;
                border-radius: 5px;
            }
        </style>
    </head>
    <body>
        <h2>OMNIX Cluster Topology</h2>
        <canvas id="topology"></canvas>
        <div class="info">
            <h3>Cluster Information</h3>
            <p>Nodes: 8</p>
            <p>Consensus: PBFT</p>
            <p>Replication Factor: 3</p>
            <p>Zones: us-east, eu-west, asia-pacific</p>
        </div>
        <script>
            const canvas = document.getElementById('topology');
            const ctx = canvas.getContext('2d');
            canvas.width = canvas.clientWidth;
            canvas.height = 500;
            
            // Draw distributed nodes
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 150;
            const nodes = 8;
            
            // Draw connections
            ctx.strokeStyle = '#9333EA30';
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes; i++) {
                const angle1 = (i * 2 * Math.PI) / nodes;
                const x1 = centerX + radius * Math.cos(angle1);
                const y1 = centerY + radius * Math.sin(angle1);
                
                for (let j = i + 1; j < nodes; j++) {
                    const angle2 = (j * 2 * Math.PI) / nodes;
                    const x2 = centerX + radius * Math.cos(angle2);
                    const y2 = centerY + radius * Math.sin(angle2);
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }
            
            // Draw central consensus
            ctx.fillStyle = '#9333EA';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw nodes
            for (let i = 0; i < nodes; i++) {
                const angle = (i * 2 * Math.PI) / nodes;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                ctx.fillStyle = '#3B82F6';
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, 2 * Math.PI);
                ctx.fill();
                
                // Node label
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('N' + (i + 1), x, y + 25);
            }
            
            // Central label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PBFT', centerX, centerY + 4);
        </script>
    </body>
    </html>`;
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension-lsp.js.map