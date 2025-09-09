# Multi-stage build for OMNIX
FROM rust:1.75 as builder

WORKDIR /usr/src/omnix

# Copy manifests
COPY Cargo.toml Cargo.lock ./
COPY compiler/Cargo.toml compiler/
COPY runtime/Cargo.toml runtime/
COPY consensus/Cargo.toml consensus/
COPY networking/Cargo.toml networking/

# Copy source code
COPY compiler/src compiler/src
COPY runtime/src runtime/src
COPY src/ src/

# Build the release binary
RUN cargo build --release --bin omnix

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /usr/src/omnix/target/release/omnix /usr/local/bin/omnix

# Create data directory
RUN mkdir -p /data /examples

# Set working directory
WORKDIR /data

# Expose default ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD omnix check -i /examples/counter_cluster_mvp.omx || exit 1

# Default command
CMD ["omnix", "--help"]