# OMNIX Language Publishing Guide

This guide covers publishing the OMNIX language support to various platforms.

## Prerequisites

Before publishing, ensure you have:
1. Node.js and npm installed
2. Required publisher accounts (see below)
3. Built and tested the extension locally

## Platform-Specific Publishing Instructions

### 1. VS Code Marketplace

#### Setup Publisher Account
1. Create a Microsoft/Azure DevOps account at https://dev.azure.com/
2. Create a Personal Access Token:
   - Go to User Settings > Personal Access Tokens
   - Create new token with "Marketplace (Publish)" scope
   - Save the token securely

#### Install Publishing Tools
```bash
npm install -g @vscode/vsce
```

#### Create Publisher
```bash
vsce create-publisher omnix-lang
```

#### Build and Publish
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
vsce package

# Publish to marketplace
vsce publish
```

### 2. Open VSX Registry (VSCodium, Eclipse Theia)

#### Setup Account
1. Create account at https://open-vsx.org/
2. Get access token from your profile settings

#### Publish
```bash
# Install ovsx CLI
npm install -g ovsx

# Publish using token
ovsx publish -p <token>
```

### 3. NPM Registry

#### Setup NPM Account
1. Create account at https://www.npmjs.com/
2. Login locally:
```bash
npm login
```

#### Publish Package
```bash
# Ensure package.json is configured correctly
npm publish --access public
```

### 4. GitHub Releases

#### Automated Release with GitHub Actions
Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 16
          
      - run: npm ci
      - run: npm run compile
      - run: vsce package
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: '*.vsix'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 5. JetBrains Marketplace (for IntelliJ IDEA, WebStorm, etc.)

For JetBrains IDEs, you'll need to create a separate plugin. This requires:
1. Setting up a JetBrains plugin project
2. Implementing language support using their SDK
3. Publishing to https://plugins.jetbrains.com/

### 6. Sublime Text Package Control

1. Create a Sublime Text package structure
2. Submit to Package Control: https://packagecontrol.io/docs/submitting_a_package

### 7. Atom Package Registry

Note: Atom has been sunset, but for historical reference:
```bash
apm publish
```

## Version Management

### Semantic Versioning
Follow semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes

### Update Version
```bash
# Update version in package.json
npm version patch  # or minor, major

# This creates a git tag automatically
git push && git push --tags
```

## Testing Before Publishing

### Local Testing
```bash
# Compile
npm run compile

# Run tests
npm test

# Package locally
vsce package

# Install VSIX locally in VS Code
code --install-extension omnix-lang-*.vsix
```

### Pre-publish Checklist
- [ ] All tests pass
- [ ] README.md is up to date
- [ ] CHANGELOG.md reflects new changes
- [ ] Version number updated
- [ ] Icon and screenshots included
- [ ] Grammar file tested with various code samples
- [ ] Extension manifest validated

## Marketplace Listings Optimization

### VS Code Marketplace
- Use clear, descriptive title
- Include screenshots/GIFs in README
- Add relevant tags for discoverability
- Provide detailed feature list
- Include badges (version, downloads, rating)

### Keywords for Better Discovery
Include in package.json:
- omnix
- distributed-systems
- consensus
- blockchain
- distributed-computing
- parallel-computing
- fault-tolerance

## Post-Publishing

### Monitor
- Check download statistics
- Respond to user reviews/issues
- Monitor GitHub issues

### Update Documentation
- Update project website
- Announce on social media
- Update documentation sites

## Automation Script

Create `scripts/publish-all.sh`:
```bash
#!/bin/bash

# Build
npm ci
npm run compile
vsce package

# Publish to VS Code Marketplace
vsce publish

# Publish to Open VSX
ovsx publish -p $OVSX_TOKEN

# Publish to NPM
npm publish --access public

# Create GitHub release
gh release create v$(node -p "require('./package.json').version") *.vsix

echo "Published to all platforms!"
```

## Support Channels

- GitHub Issues: https://github.com/omnix-lang/omnix/issues
- Discord: https://discord.gg/omnixlang
- Email: support@omnixlang.org

## License

This extension is licensed under Apache-2.0. Ensure all dependencies are compatible.