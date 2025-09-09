.PHONY: help build test run demo clean docker-build docker-run docker-stop fmt lint check

# Default target
help:
	@echo "OMNIX Development Commands:"
	@echo "  make build       - Build the OMNIX compiler and runtime"
	@echo "  make test        - Run all tests"
	@echo "  make run         - Run a single node locally"
	@echo "  make demo        - Run 3-node cluster demo with Docker"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make fmt         - Format code with rustfmt"
	@echo "  make lint        - Run clippy linter"
	@echo "  make check       - Check example files"

# Build the project
build:
	cargo build --release
	@echo "✅ Build complete: target/release/omnix"

# Run tests
test:
	cargo test --all
	@echo "✅ All tests passed"

# Run a single node locally
run: build
	./target/release/omnix run \
		-i examples/counter_cluster_mvp.omx \
		--node-id local-node \
		--port 8080 \
		-v

# Format code
fmt:
	cargo fmt --all
	@echo "✅ Code formatted"

# Lint code
lint:
	cargo clippy --all-targets --all-features -- -D warnings
	@echo "✅ No lint warnings"

# Check example files
check: build
	./target/release/omnix check -i examples/counter_cluster_mvp.omx
	./target/release/omnix check -i examples/blockchain_consensus.omx
	@echo "✅ All examples valid"

# Docker operations
docker-build:
	docker-compose build
	@echo "✅ Docker images built"

docker-run: docker-build
	docker-compose up -d
	@echo "✅ 3-node cluster started"
	@echo "View logs: docker-compose logs -f"
	@echo "Node 1: http://localhost:8080"
	@echo "Node 2: http://localhost:8081"
	@echo "Node 3: http://localhost:8082"
	@echo "Grafana: http://localhost:3000 (admin/omnix)"

docker-stop:
	docker-compose down
	@echo "✅ Cluster stopped"

docker-clean:
	docker-compose down -v
	@echo "✅ Cluster stopped and volumes removed"

# Full demo sequence
demo: docker-clean docker-run
	@echo "🚀 OMNIX 3-Node Demo Running!"
	@echo ""
	@echo "Watch consensus in action:"
	@echo "  Terminal 1: docker-compose logs -f node1"
	@echo "  Terminal 2: docker-compose logs -f node2"
	@echo "  Terminal 3: docker-compose logs -f node3"
	@echo ""
	@echo "Test consensus:"
	@echo "  curl -X POST http://localhost:8080/increment"
	@echo "  curl http://localhost:8080/value"
	@echo "  curl http://localhost:8081/value"
	@echo "  curl http://localhost:8082/value"
	@echo ""
	@echo "Stop with: make docker-stop"

# Clean build artifacts
clean:
	cargo clean
	rm -rf target/
	@echo "✅ Build artifacts cleaned"

# Development workflow
dev: fmt lint test
	@echo "✅ Ready for commit"

# CI simulation
ci: fmt lint build test check
	@echo "✅ CI checks passed"

# Install development tools
install-tools:
	cargo install cargo-watch
	cargo install cargo-audit
	cargo install cargo-outdated
	cargo install cargo-bloat
	@echo "✅ Development tools installed"

# Watch for changes and rebuild
watch:
	cargo watch -x build -x test

# Security audit
audit:
	cargo audit

# Check for outdated dependencies
outdated:
	cargo outdated

# Analyze binary size
bloat:
	cargo bloat --release --bin omnix

# Generate documentation
docs:
	cargo doc --no-deps --open

# Benchmarks
bench:
	cargo bench

# Profile with flamegraph (requires cargo-flamegraph)
profile:
	cargo flamegraph --bin omnix -- run -i examples/counter_cluster_mvp.omx

# Release build with optimizations
release:
	RUSTFLAGS="-C target-cpu=native" cargo build --release
	strip target/release/omnix
	@echo "✅ Optimized release build complete"
	@ls -lh target/release/omnix