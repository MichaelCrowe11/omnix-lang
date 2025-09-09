# Introduction to OMNIX

OMNIX is a distributed consensus programming language designed for building Byzantine fault-tolerant distributed systems. It provides first-class support for consensus algorithms, replicated state management, and distributed computing patterns through intuitive language constructs and consensus operators.

## Why OMNIX?

Building reliable distributed systems is notoriously difficult. Traditional programming languages treat distributed computing as an afterthought, requiring developers to manually implement consensus protocols, handle network partitions, and manage replicated state. OMNIX changes this by making distributed consensus a first-class citizen in the language.

### Key Features

🔐 **Byzantine Fault Tolerance**: Built-in support for BFT consensus algorithms including Raft, PBFT, and Tendermint

⚡ **Consensus Operators**: First-class operators (`<!>`, `<#>`, `<?>`) for proposing values, merging state, and querying consensus

🌐 **Network-Aware**: Automatic peer discovery, gossip protocols, and failure detection

📊 **Replicated State**: Automatic state replication with configurable consistency levels

🛡️ **Error Handling**: Comprehensive error handling for network failures, timeouts, and Byzantine faults

⚙️ **Performance**: Optimized runtime with minimal overhead for consensus operations

## Use Cases

OMNIX is ideal for building:

- **Distributed Databases**: Consensus-based key-value stores and distributed SQL systems
- **Blockchain Systems**: Custom blockchain implementations with pluggable consensus
- **Coordination Services**: Distributed locks, leader election, and configuration management
- **Financial Systems**: High-availability trading systems and payment processors
- **IoT Networks**: Reliable coordination in edge computing environments
- **Gaming**: Authoritative game state management in multiplayer games

## Language Philosophy

OMNIX follows the principle that **consensus should be as easy as assignment**. Instead of writing hundreds of lines of boilerplate consensus code, you can express complex distributed algorithms in just a few lines:

```omx
// Traditional approach (pseudocode)
let proposal = create_proposal(value);
let votes = broadcast_and_collect_votes(proposal);
if votes.majority_accept() {
    replicated_state.update(value);
    broadcast_commit(value);
}

// OMNIX approach
let result = value <!> { validators: 5, timeout: 2s };
when result.accepted() {
    state <#> result.value;
}
```

## Architecture Overview

OMNIX programs compile to native code with an embedded distributed runtime. The runtime handles:

- **Consensus Protocols**: Raft, PBFT, and Tendermint implementations
- **Networking**: P2P communication with mDNS discovery and QUIC transport
- **State Management**: Conflict-free replicated data types (CRDTs) and strong consistency
- **Fault Detection**: Failure detectors and network partition handling
- **Security**: Ed25519 signatures and Noise protocol encryption

## Getting Started

Ready to build your first distributed system with OMNIX? Let's start with [installation](./installation.md) and then build a simple distributed counter in the [Hello, Distributed World!](./hello-world.md) tutorial.

## Community and Support

OMNIX is open source and actively developed. Join our community:

- **GitHub**: [github.com/omnix-lang/omnix](https://github.com/omnix-lang/omnix)
- **Discord**: [discord.gg/omnix](https://discord.gg/omnix)
- **Documentation**: [docs.omnix.dev](https://docs.omnix.dev)
- **Examples**: [github.com/omnix-lang/examples](https://github.com/omnix-lang/examples)

Welcome to the future of distributed programming! 🚀