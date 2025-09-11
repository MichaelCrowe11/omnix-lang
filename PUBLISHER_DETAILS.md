# OMNIX Language Publisher Details & PyPI Publishing

## 📋 Publisher Information

Based on the package configuration, here are the publisher details:

### Organization Details
- **Publisher ID**: `omnix-lang`
- **Organization Name**: OMNIX Team
- **Email**: team@omnixlang.org
- **Website**: https://omnixlang.org
- **GitHub Organization**: https://github.com/omnix-lang

### Package Identifiers
- **NPM Package Name**: `omnix-lang`
- **PyPI Package Name**: `omnix-lang`
- **VS Code Publisher**: `omnix-lang`
- **Extension ID**: `omnix-lang.omnix-lang`

### Repository Information
- **Main Repository**: https://github.com/omnix-lang/omnix
- **Issues**: https://github.com/omnix-lang/omnix/issues
- **Documentation**: https://docs.omnixlang.org
- **Discord**: https://discord.gg/omnixlang

### Branding
- **Primary Color**: `#7C3AED` (Purple)
- **Gallery Banner Theme**: Dark
- **Logo**: SVG distributed network design

---

## 🐍 PyPI Publishing Instructions

Yes, we can publish to PyPI! I've created the necessary configuration files for Python package distribution.

### Files Created for PyPI

1. **`C:\Users\micha\omnix-lang\setup.py`** - Traditional setup configuration
2. **`C:\Users\micha\omnix-lang\pyproject.toml`** - Modern Python packaging config
3. **`C:\Users\micha\omnix-lang\python\omnix\__init__.py`** - Package initialization
4. **`C:\Users\micha\omnix-lang\python\omnix\parser.py`** - Parser module
5. **`C:\Users\micha\omnix-lang\python\omnix\lexer.py`** - Lexer module
6. **`C:\Users\micha\omnix-lang\python\omnix\compiler.py`** - Compiler interface

### Prerequisites for PyPI Publishing

1. **Create PyPI Account**
   - Register at: https://pypi.org/account/register/
   - Verify email address
   - Enable 2FA (recommended)

2. **Create Test PyPI Account** (for testing)
   - Register at: https://test.pypi.org/account/register/
   - Use for testing before production release

3. **Generate API Token**
   - Go to: https://pypi.org/manage/account/token/
   - Create token with scope "Entire account" or specific to "omnix-lang"
   - Save token securely (starts with `pypi-`)

### Step-by-Step PyPI Publishing

#### 1. Install Build Tools
```bash
# Navigate to project directory
cd C:\Users\micha\omnix-lang

# Install build tools
pip install --upgrade pip setuptools wheel twine build
```

#### 2. Build the Package
```bash
# Using modern build (recommended)
python -m build

# Or using setup.py (traditional)
python setup.py sdist bdist_wheel
```

This creates:
- `dist/omnix-lang-0.1.0.tar.gz` (source distribution)
- `dist/omnix_lang-0.1.0-py3-none-any.whl` (wheel distribution)

#### 3. Test with TestPyPI (Optional but Recommended)
```bash
# Upload to TestPyPI
python -m twine upload --repository testpypi dist/*

# Enter credentials:
# Username: __token__
# Password: [your-test-pypi-token]

# Test installation
pip install --index-url https://test.pypi.org/simple/ omnix-lang
```

#### 4. Upload to PyPI
```bash
# Upload to production PyPI
python -m twine upload dist/*

# Enter credentials:
# Username: __token__
# Password: [your-pypi-token]
```

#### 5. Verify Installation
```bash
# Install from PyPI
pip install omnix-lang

# Test import
python -c "import omnix; print(omnix.__version__)"
```

### Using .pypirc for Automation

Create `~/.pypirc` (or `%USERPROFILE%\.pypirc` on Windows):

```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = pypi-YOUR_TOKEN_HERE

[testpypi]
username = __token__
password = pypi-YOUR_TEST_TOKEN_HERE
```

Then publish without entering credentials:
```bash
# To TestPyPI
twine upload --repository testpypi dist/*

# To PyPI
twine upload --repository pypi dist/*
```

### GitHub Actions for Automated PyPI Publishing

Create `.github/workflows/publish-pypi.yml`:

```yaml
name: Publish to PyPI

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.x'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install build twine
    
    - name: Build package
      run: python -m build
    
    - name: Publish to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
      run: twine upload dist/*
```

### Package Contents

The Python package includes:
- **Core Modules**: Parser, Lexer, Compiler interface
- **Grammar Files**: Syntax definitions (when added)
- **Templates**: OMNIX code templates
- **CLI Tools**: `omnix` and `omnix-lsp` commands

### Version Management

Update version in these files:
1. `setup.py` - version="0.1.0"
2. `pyproject.toml` - version = "0.1.0"
3. `python/omnix/__init__.py` - __version__ = "0.1.0"

### PyPI Package URLs

Once published:
- **Package Page**: https://pypi.org/project/omnix-lang/
- **Documentation**: https://omnix-lang.readthedocs.io/ (if configured)
- **Statistics**: https://pypistats.org/packages/omnix-lang

---

## 📦 Multi-Platform Publishing Summary

The OMNIX language can now be published to:

1. **VS Code Marketplace** ✅
   - Extension for syntax highlighting and IDE features
   - Publisher: omnix-lang

2. **NPM Registry** ✅
   - JavaScript/TypeScript tools and VS Code extension
   - Package: omnix-lang

3. **PyPI** ✅ (NEW)
   - Python tools and compiler interface
   - Package: omnix-lang
   - CLI tools included

4. **Open VSX** ✅
   - For VSCodium and other editors
   - Same as VS Code extension

5. **GitHub Releases** ✅
   - Binary distributions
   - Source code archives

6. **Cargo/Crates.io** (Future)
   - Rust compiler and tools
   - Would require Rust implementation

### Quick Publishing Commands

```bash
# VS Code
vsce publish

# NPM
npm publish

# PyPI
python -m build && twine upload dist/*

# Open VSX
ovsx publish -p TOKEN

# GitHub Release
gh release create v0.1.0 *.vsix dist/*
```

---

**Note**: All tokens and credentials should be stored securely and never committed to version control.