# OMNIX Development Roadmap

## Current Status: MVP Complete (v0.1)
✅ Basic lexer/parser with consensus operators  
✅ Simplified Raft consensus implementation  
✅ Runtime executor for basic programs  
✅ CLI with check/compile/run commands  
✅ Documentation foundation with mdBook  

## Phase 1: Parser & Language Correctness (v0.2) - 2-4 weeks

### 1.1 Pratt Parser Implementation ⚡ CRITICAL
- [x] Create precedence table with correct operator priorities
- [ ] Implement precedence climbing algorithm
- [ ] Right-associative assignment and consensus operators
- [ ] Unary operators (!, -, +)
- [ ] Member access (.) and indexing ([])

### 1.2 Rich LValues & Assignment
- [x] Define LValue enum (Identifier, Member, Index)
- [ ] Parse complex assignment targets (a.b[c] = d)
- [ ] Assignment as expression (x = y = 5)
- [ ] Compound assignments (+=, -=, *=, /=)

### 1.3 Accurate Span Tracking
- [x] SpanTracker utility for start/end positions
- [ ] Update all AST nodes with accurate spans
- [ ] Line/column information preservation
- [ ] Source map generation for debugging

### 1.4 Error Recovery & Diagnostics
- [ ] Context-aware synchronization sets
- [ ] Expected token suggestions
- [ ] Codeframe error display (using miette/ariadne)
- [ ] Error recovery in nested contexts

### 1.5 Parser Testing
- [ ] Golden AST tests for all syntax forms
- [ ] Property-based testing (parse-print-parse stability)
- [ ] Fuzzing with cargo-fuzz/AFL
- [ ] Regression test suite

## Phase 2: Type System & Static Analysis (v0.3) - 4-6 weeks

### 2.1 Type Checker Foundation
- [ ] Name resolution pass (identifier → declaration)
- [ ] Symbol table with scopes
- [ ] Basic type inference for literals
- [ ] Type checking for binary operations

### 2.2 Distributed Effect Types
- [ ] `replicated<T>` type for distributed state
- [ ] Consensus capability types
- [ ] Effect tracking for propose/vote/commit
- [ ] Linear types for consensus results

### 2.3 Advanced Types
- [ ] Sum types (enums) with pattern matching
- [ ] Generic functions and types
- [ ] Type aliases
- [ ] Traits/interfaces for extensibility

### 2.4 Static Validation
- [ ] Replicated state access rules
- [ ] Consensus operator validation
- [ ] Invariant checking
- [ ] Dead code elimination

## Phase 3: Runtime & Networking (v0.4) - 6-8 weeks

### 3.1 Complete Raft Implementation
- [ ] Persistent WAL with sled/rocksdb
- [ ] Snapshot support for log compaction
- [ ] Membership changes (joint consensus)
- [ ] Pre-vote optimization
- [ ] Leadership transfer

### 3.2 Real P2P Networking
- [ ] libp2p integration completion
- [ ] mDNS peer discovery
- [ ] QUIC transport with Noise encryption
- [ ] Request/response RPC for Raft
- [ ] Gossip protocol for events

### 3.3 Fault Tolerance
- [ ] Network partition detection
- [ ] Automatic reconnection with backoff
- [ ] Byzantine fault detection
- [ ] Split-brain prevention

### 3.4 Observability
- [ ] OpenTelemetry integration
- [ ] Metrics (consensus rounds, latencies)
- [ ] Distributed tracing
- [ ] Health check endpoints

## Phase 4: Developer Experience (v0.5) - 4-6 weeks

### 4.1 Language Server Protocol
- [ ] Parse and cache ASTs incrementally
- [ ] Go-to-definition
- [ ] Find references
- [ ] Hover for types/docs
- [ ] Code completion
- [ ] Refactoring support

### 4.2 Tooling
- [ ] Code formatter (omnix fmt)
- [ ] Linter with custom rules
- [ ] Test framework
- [ ] Benchmark suite
- [ ] Documentation generator

### 4.3 Debugging
- [ ] Time-travel debugger for consensus
- [ ] State inspection tools
- [ ] Network traffic analyzer
- [ ] Consensus visualizer

## Phase 5: Advanced Features (v0.6+) - 3-6 months

### 5.1 Alternative Consensus
- [ ] PBFT implementation
- [ ] Tendermint/HotStuff
- [ ] Pluggable consensus interface
- [ ] Hybrid consensus modes

### 5.2 Formal Verification
- [ ] Operational semantics specification
- [ ] TLA+ model extraction
- [ ] Property-based testing
- [ ] Invariant proving

### 5.3 Performance
- [ ] JIT compilation with Cranelift
- [ ] SIMD optimizations
- [ ] Zero-copy networking
- [ ] Parallel consensus rounds

### 5.4 Ecosystem
- [ ] Package manager (omnix-pkg)
- [ ] Standard library (CRDTs, crypto)
- [ ] Web playground (WASM)
- [ ] Cloud deployment tools

## Immediate Action Items (Next Sprint)

1. **Fix Parser Precedence** (3 days)
   - Integrate Pratt parser
   - Update expression parsing
   - Add comprehensive tests

2. **Complete Networking** (5 days)
   - Wire up libp2p in network.rs
   - Test 3-node cluster locally
   - Add network simulation tests

3. **Add Persistence** (3 days)
   - WAL implementation
   - Crash recovery
   - State snapshots

4. **Create Demo** (2 days)
   - Docker Compose setup
   - Video recording
   - Blog post

## Success Metrics

### v0.2 Goals
- ✅ Parser handles complex expressions correctly
- ✅ 100% of syntax tests passing
- ✅ Error messages with source locations

### v0.3 Goals
- ✅ Type checker catches all type errors
- ✅ Distributed effects properly tracked
- ✅ Zero runtime type errors

### v0.4 Goals
- ✅ 3+ nodes maintain consensus under partition
- ✅ < 100ms consensus latency (LAN)
- ✅ Automatic recovery from crashes

### v0.5 Goals
- ✅ LSP working in VS Code
- ✅ < 1s compile time for 10K LOC
- ✅ Developer satisfaction > 4/5

## Technical Debt to Address

1. **Parser**: Migrate to Pratt parsing ⚡
2. **AST**: Add proper span information
3. **Runtime**: Complete Raft implementation
4. **Network**: Real P2P instead of stubs
5. **Tests**: Comprehensive test coverage
6. **Docs**: API documentation
7. **CI**: Integration tests in GitHub Actions

## Research Questions

1. How to handle Byzantine failures elegantly?
2. Can we prove consensus properties at compile time?
3. How to optimize for geo-distributed clusters?
4. What's the right abstraction for cross-chain?
5. How to make debugging distributed systems intuitive?

## Community Building

- [ ] Discord server setup
- [ ] Weekly development updates
- [ ] Tutorial video series
- [ ] Conference talks (FOSDEM, Strange Loop)
- [ ] Academic paper on consensus operators

---

*This roadmap is a living document. Priorities may shift based on community feedback and technical discoveries.*