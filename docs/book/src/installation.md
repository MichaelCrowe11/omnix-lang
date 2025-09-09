# Installation

OMNIX can be installed through multiple methods. Choose the one that works best for your platform and use case.

## Quick Install (Recommended)

### Using Cargo (Rust Package Manager)

If you have Rust installed, you can install OMNIX directly from crates.io:

```bash
cargo install omnix
```

This will install the `omnix` command globally on your system.

### Using Pre-built Binaries

Download the latest release for your platform:

- **Linux (x86_64)**: [omnix-linux-x86_64.tar.gz](https://github.com/omnix-lang/omnix/releases/latest)
- **macOS (Intel)**: [omnix-macos-x86_64.tar.gz](https://github.com/omnix-lang/omnix/releases/latest)
- **macOS (Apple Silicon)**: [omnix-macos-arm64.tar.gz](https://github.com/omnix-lang/omnix/releases/latest)
- **Windows**: [omnix-windows-x86_64.zip](https://github.com/omnix-lang/omnix/releases/latest)

Extract and add to your PATH:

```bash
# Linux/macOS
tar -xzf omnix-*.tar.gz
sudo mv omnix /usr/local/bin/

# Windows
# Extract to C:\Program Files\OMNIX and add to PATH
```

## Building from Source

### Prerequisites

- Rust 1.70+ with Cargo
- Git

### Clone and Build

```bash
git clone https://github.com/omnix-lang/omnix.git
cd omnix-lang
cargo build --release
```

The binary will be available at `target/release/omnix`.

### Development Build

For development with debugging symbols:

```bash
cargo build
./target/debug/omnix --version
```

## Verification

Verify your installation:

```bash
omnix --version
# Output: omnix 0.1.0
```

Check that all components are working:

```bash
omnix check --help
omnix compile --help
omnix run --help
omnix init --help
```

## Platform-Specific Notes

### Linux

OMNIX requires `libssl` and `pkg-config`:

```bash
# Ubuntu/Debian
sudo apt install libssl-dev pkg-config

# CentOS/RHEL/Fedora
sudo yum install openssl-devel pkgconf-pkg-config
# or
sudo dnf install openssl-devel pkgconf-pkg-config
```

### macOS

Install via Homebrew (coming soon):

```bash
# brew install omnix  # Coming soon
```

For now, use the pre-built binaries or build from source.

### Windows

OMNIX works on Windows 10+ with either:
- Native Windows (MSVC toolchain)
- WSL2 (recommended for development)

## Editor Support

### VS Code

Install the OMNIX extension from the VS Code marketplace:

```bash
code --install-extension omnix-lang.omnix-vscode
```

Features:
- Syntax highlighting
- Error diagnostics
- Code completion
- Go to definition
- Format on save

### Vim/Neovim

Add syntax highlighting:

```bash
git clone https://github.com/omnix-lang/omnix-vim.git ~/.vim/pack/omnix/start/omnix-vim
```

### Other Editors

Language Server Protocol (LSP) support coming soon for:
- Emacs
- Sublime Text
- IntelliJ IDEA

## Next Steps

Now that you have OMNIX installed, let's create your first distributed system:

→ [Hello, Distributed World!](./hello-world.md)

## Troubleshooting

### Common Issues

**"omnix: command not found"**
- Ensure the binary is in your PATH
- Try running with full path: `./target/release/omnix`

**Linking errors on Linux**
- Install development packages: `sudo apt install build-essential`

**Permission denied on macOS**
- The binary may be quarantined: `xattr -d com.apple.quarantine omnix`

**Slow compilation**
- Use more cores: `cargo build --release -j$(nproc)`
- Enable incremental compilation: `export CARGO_INCREMENTAL=1`

### Getting Help

If you encounter issues:
1. Check [GitHub Issues](https://github.com/omnix-lang/omnix/issues)
2. Join our [Discord](https://discord.gg/omnix)
3. Read the [Troubleshooting Guide](./reference/troubleshooting.md)