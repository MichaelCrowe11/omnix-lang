# Change Log

All notable changes to the OMNIX Language extension will be documented in this file.

## [0.2.0] - 2025-01-10

### Added
- **Language Server Protocol (LSP)** implementation for advanced IDE features
- **Enhanced IntelliSense** with context-aware completions
- **Real-time diagnostics** with error detection and warnings
- **Code formatting** with automatic indentation
- **Semantic highlighting** for better syntax distinction
- **Code lens** for running tests inline
- **Cluster topology visualization** webview
- **Consensus template** insertion command
- **Status bar** showing OMNIX server status

### New Examples
- **Distributed KV Store** - Full implementation with Byzantine fault tolerance
- **Cross-Chain DEX** - Decentralized exchange with atomic swaps

### Improved
- Better hover documentation with detailed explanations
- Enhanced snippet library with more patterns
- Faster completion suggestions
- More accurate syntax highlighting

### Technical
- Added language server in TypeScript
- Integrated vscode-languageclient
- Implemented document validation
- Added semantic token provider

## [0.1.0] - 2025-01-10

### Initial Release

#### Features
- **Syntax Highlighting**: Full TextMate grammar support for OMNIX language
  - Keywords highlighting (consensus, cluster, node, function, etc.)
  - Operators highlighting including consensus operators (<!>, <?>, <#>, <@>)
  - String interpolation support
  - Comments (line and block)
  - Type annotations
  - Decorators/annotations (@network, @replicated, @rpc, etc.)

- **Code Snippets**: Comprehensive snippet library
  - Node and cluster definitions
  - Consensus proposals
  - Function and service declarations
  - Event handlers
  - Cross-chain contracts
  - Data processing pipelines

- **Language Configuration**
  - Auto-closing pairs for brackets, quotes, and comments
  - Bracket matching
  - Code folding support
  - Indentation rules

- **Editor Features**
  - IntelliSense/Auto-completion for keywords and types
  - Hover documentation for OMNIX constructs
  - Basic diagnostics and syntax checking

- **Commands**
  - `OMNIX: Compile Current File` - Compile active OMNIX file
  - `OMNIX: Run Current File` - Execute OMNIX program
  - `OMNIX: Format Document` - Format OMNIX code

- **File Support**
  - `.omx` file extension
  - `.omnix` file extension (alternative)

#### Language Support
- Consensus algorithms (Raft, PBFT, Tendermint)
- Distributed state management
- Cross-chain operations
- Byzantine fault tolerance
- Event broadcasting
- RPC functions

#### Documentation
- Comprehensive README with examples
- Publishing guide for multiple platforms
- Language grammar specification

### Known Issues
- Compiler integration requires OMNIX compiler to be installed separately
- Advanced type checking pending full language server implementation

### Future Enhancements
- Language Server Protocol (LSP) implementation
- Advanced error checking and diagnostics
- Code formatting with prettier-omnix
- Debugging support
- Go to definition/references
- Refactoring tools
- Test runner integration

---

## Version History

- **0.1.0** (2025-01-10): Initial release with basic language support
- **0.0.1** (Internal): Development version

For more information, visit [OMNIX Language Documentation](https://omnixlang.org)