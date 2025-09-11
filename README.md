# OMNIX Language Support for Visual Studio Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/omnix-lang.omnix-lang)](https://marketplace.visualstudio.com/items?itemName=omnix-lang.omnix-lang)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/omnix-lang.omnix-lang)](https://marketplace.visualstudio.com/items?itemName=omnix-lang.omnix-lang)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/omnix-lang.omnix-lang)](https://marketplace.visualstudio.com/items?itemName=omnix-lang.omnix-lang)

**OMNIX Programming Language - The Distributed Systems Language**

*Planet-Scale Computing Made Simple.*

This extension provides comprehensive language support for OMNIX, a programming language built from the ground up for distributed computing, blockchain systems, and planetary-scale applications.

## 🎨 Extension Features

### Syntax Highlighting
- Full syntax highlighting for `.omx` and `.omnix` files
- Support for consensus operators (`<!>`, `<?>`, `<#>`, `<@>`)
- Keyword highlighting for distributed constructs
- String interpolation and escape sequences
- Annotation/decorator highlighting

### IntelliSense
- Auto-completion for keywords, types, and consensus algorithms
- Hover documentation for OMNIX language constructs
- Signature help for functions and services

### Code Snippets
- Quick snippets for common patterns:
  - Node and cluster definitions
  - Consensus proposals
  - Event handlers
  - Cross-chain contracts
  - Data pipelines

### Editor Commands
- **Compile**: `OMNIX: Compile Current File`
- **Run**: `OMNIX: Run Current File`
- **Format**: `OMNIX: Format Document`

## 🌐 Language Features

- **Native Consensus Protocols**: Built-in blockchain, PBFT, and Raft consensus
- **Automatic Distribution**: Geographic distribution and load balancing
- **Cross-Chain Interoperability**: Connect multiple blockchain networks
- **Byzantine Fault Tolerance**: Resilient to malicious actors
- **Edge-to-Cloud Orchestration**: Seamless deployment across infrastructure
- **Zero-Downtime Deployments**: Rolling updates and blue-green deployments

## 🚀 Quick Start

```omnix
// Distributed consensus with automatic failover
consensus cluster UserService {
    replicas: 5
    consensus: PBFT
    zones: ["us-east", "eu-west", "asia-pacific"]
    
    service handle_request(req: UserRequest) -> Response {
        // Automatically distributed across replicas
        user = database.get_user(req.user_id)
        
        // Cross-chain verification
        verified = blockchain.verify {
            chain: "ethereum"
            contract: user.wallet_address
        }
        
        return Response { user, verified }
    }
}

// Cross-chain smart contract deployment
@cross_chain(["ethereum", "polygon", "arbitrum"])
contract TokenBridge {
    function transfer(
        from_chain: ChainId,
        to_chain: ChainId,
        amount: TokenAmount
    ) {
        // Automatic atomic cross-chain transfer
        lock_tokens(from_chain, amount)
        mint_tokens(to_chain, amount)
        emit CrossChainTransfer(from_chain, to_chain, amount)
    }
}

// Distributed data processing pipeline
pipeline DataProcessor {
    input: KafkaStream<RawData>
    
    stage preprocess {
        parallel workers: auto_scale(load)
        process(data) => clean_and_validate(data)
    }
    
    stage ml_inference {
        gpu_workers: 4
        model: load_model("data_classifier")
        process(data) => model.predict(data)
    }
    
    output: DatabaseSink<ProcessedData>
}
```

## 📦 Installation

### Extension Installation
1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P` to open Quick Open
3. Type `ext install omnix-lang.omnix-lang`
4. Press Enter

### Compiler Installation
```bash
# Install OMNIX compiler
npm install -g @omnix-lang/cli

# Or using cargo
cargo install omnix-lang

# Or download binary
curl -sSL https://get.omnixlang.org | sh
```

## 🏗️ Project Structure

```
omnix-lang/
├── compiler/           # OMNIX compiler and optimizer
├── runtime/           # Distributed runtime system
├── consensus/         # Consensus algorithm implementations
├── blockchain/        # Blockchain integration layer
├── networking/        # P2P networking and protocols
├── deployment/        # Infrastructure deployment tools
├── examples/          # Example distributed applications
├── docs/              # Documentation
└── tools/             # Development and debugging tools
```

## 🔧 Building from Source

```bash
git clone https://github.com/omnix-lang/omnix
cd omnix
cargo build --release

# Run distributed tests
cargo test --features distributed

# Build with blockchain support
cargo build --features blockchain --release
```

## 🌟 Use Cases

### Blockchain Applications
- Cross-chain DEX protocols
- Multi-chain NFT marketplaces
- Distributed autonomous organizations (DAOs)
- Layer 2 scaling solutions

### Distributed Systems
- Microservices orchestration
- Global content delivery networks
- Distributed databases
- Real-time analytics platforms

### Edge Computing
- IoT device coordination
- Edge AI inference
- Distributed caching
- Content personalization

## 🔗 Integrations

### Blockchain Networks
- Ethereum, Polygon, Arbitrum, Optimism
- Solana, Avalanche, Cosmos
- Bitcoin Lightning Network
- Polkadot parachains

### Cloud Platforms
- AWS, Google Cloud, Azure
- Kubernetes, Docker Swarm
- Terraform, Pulumi
- CDN providers (Cloudflare, Fastly)

## 📚 Documentation

- [Getting Started](./docs/getting-started.md)
- [Consensus Algorithms](./docs/consensus.md)
- [Blockchain Integration](./docs/blockchain.md)
- [Deployment Guide](./docs/deployment.md)
- [API Reference](./docs/api/README.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## ⚙️ Extension Settings

This extension contributes the following settings:

- `omnix.enableAutoCompletion`: Enable/disable auto-completion
- `omnix.enableLinting`: Enable/disable linting
- `omnix.compilerPath`: Path to OMNIX compiler executable

## 🔧 Requirements

- Visual Studio Code 1.74.0 or higher
- OMNIX compiler (optional, for compilation features)

## 🐛 Known Issues

- Compiler integration requires separate OMNIX compiler installation
- Advanced type checking pending Language Server Protocol implementation

## 📝 Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## 🔗 Links

- Website: https://omnixlang.org
- Documentation: https://docs.omnixlang.org
- GitHub: https://github.com/omnix-lang/omnix
- Discord: https://discord.gg/omnixlang
- Twitter: [@omnixlang](https://twitter.com/omnixlang)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](https://github.com/omnix-lang/omnix/blob/main/CONTRIBUTING.md) for details.

---

*OMNIX: Connecting the world's computing resources*

**Enjoy coding with OMNIX!**