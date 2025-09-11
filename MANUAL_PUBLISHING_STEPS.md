# Manual Publishing Steps for OMNIX Language Extension

## 📁 Important File Locations

### Core Files
- **Main Directory**: `C:\Users\micha\omnix-lang\`
- **Package Manifest**: `C:\Users\micha\omnix-lang\package.json`
- **Extension Source**: `C:\Users\micha\omnix-lang\src\extension.ts`
- **TypeScript Config**: `C:\Users\micha\omnix-lang\tsconfig.json`

### Language Support Files
- **Grammar**: `C:\Users\micha\omnix-lang\syntaxes\omnix.tmLanguage.json`
- **Language Config**: `C:\Users\micha\omnix-lang\language-configuration.json`
- **Snippets**: `C:\Users\micha\omnix-lang\snippets\omnix.json`

### Branding & Assets
- **Logo (SVG)**: `C:\Users\micha\omnix-lang\images\omnix-logo.svg`
- **Icon Generator**: `C:\Users\micha\omnix-lang\images\generate-icons.html`
  - Open this HTML file in browser to generate PNG icons
  - Download 128x128, 256x256, and 512x512 versions

### Documentation
- **README**: `C:\Users\micha\omnix-lang\README.md`
- **CHANGELOG**: `C:\Users\micha\omnix-lang\CHANGELOG.md`
- **LICENSE**: `C:\Users\micha\omnix-lang\LICENSE`
- **Publishing Guide**: `C:\Users\micha\omnix-lang\PUBLISHING_GUIDE.md`

## 🚀 Step-by-Step Manual Publishing

### 1. VS Code Marketplace

#### Prerequisites
1. **Create Publisher Account**
   - Go to: https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft account
   - Create publisher ID: `omnix-lang`

2. **Get Personal Access Token**
   - Visit: https://dev.azure.com/YOUR_ORG/_usersSettings/tokens
   - Click "New Token"
   - Name: "VS Code Publishing"
   - Organization: Select your org
   - Expiration: 90 days (or custom)
   - Scopes: Custom defined
   - Check: Marketplace > Manage
   - Copy and save token securely

#### Publishing Steps
```bash
# Navigate to extension directory
cd C:\Users\micha\omnix-lang

# Install vsce globally if not installed
npm install -g @vscode/vsce

# Login with your publisher
vsce login omnix-lang
# Enter your Personal Access Token when prompted

# Package the extension
vsce package
# This creates: omnix-lang-0.1.0.vsix

# Publish to marketplace
vsce publish
# Or publish specific version
vsce publish 0.1.0

# Alternative: Publish via web interface
# 1. Go to https://marketplace.visualstudio.com/manage
# 2. Click "New Extension" > "Visual Studio Code"
# 3. Upload the .vsix file
```

### 2. Open VSX Registry (VSCodium, Gitpod, Theia)

#### Prerequisites
1. **Create Account**
   - Register at: https://open-vsx.org/
   - Verify email
   - Generate access token:
     - Profile > Settings > Access Tokens
     - Create token with "Publish Extensions" permission
     - Save token

#### Publishing Steps
```bash
# Install ovsx CLI
npm install -g ovsx

# Navigate to extension directory
cd C:\Users\micha\omnix-lang

# Package if not already done
vsce package

# Publish with token
ovsx publish omnix-lang-0.1.0.vsix -p YOUR_TOKEN

# Or set token as environment variable
set OVSX_PAT=YOUR_TOKEN
ovsx publish
```

### 3. NPM Registry

#### Prerequisites
1. **NPM Account**
   - Create at: https://www.npmjs.com/signup
   - Verify email

#### Publishing Steps
```bash
# Navigate to extension directory
cd C:\Users\micha\omnix-lang

# Login to npm
npm login
# Enter username, password, email

# Ensure package.json has correct name
# Should be: "name": "omnix-lang"

# Publish publicly
npm publish --access public

# View published package
# https://www.npmjs.com/package/omnix-lang
```

### 4. GitHub Release

#### Manual Release via Web
1. Go to: https://github.com/omnix-lang/omnix/releases
2. Click "Draft a new release"
3. Tag version: `v0.1.0`
4. Release title: `OMNIX Language v0.1.0`
5. Description: Copy from CHANGELOG.md
6. Attach files:
   - `omnix-lang-0.1.0.vsix`
   - Source code (auto-attached)
7. Click "Publish release"

#### Via GitHub CLI
```bash
# Install GitHub CLI if needed
# Download from: https://cli.github.com/

# Navigate to extension directory
cd C:\Users\micha\omnix-lang

# Create release
gh release create v0.1.0 omnix-lang-0.1.0.vsix --title "OMNIX Language v0.1.0" --notes-file CHANGELOG.md
```

### 5. Manual Installation (Testing)

#### Install VSIX Locally
```bash
# Via command line
code --install-extension C:\Users\micha\omnix-lang\omnix-lang-0.1.0.vsix

# Or in VS Code:
# 1. Open Command Palette (Ctrl+Shift+P)
# 2. Run: "Extensions: Install from VSIX..."
# 3. Select: C:\Users\micha\omnix-lang\omnix-lang-0.1.0.vsix
```

## 🎨 Branding Guidelines

### Colors
- **Primary**: `#7C3AED` (Purple)
- **Secondary**: `#3B82F6` (Blue)
- **Gradient Start**: `#6B46C1`
- **Gradient End**: `#9333EA`

### Logo Usage
- Use SVG for VS Code marketplace
- Generate PNGs for other platforms
- Maintain aspect ratio
- Minimum size: 128x128px

## 📋 Pre-Publishing Checklist

Before publishing, verify:

- [ ] Version number updated in `package.json`
- [ ] CHANGELOG.md updated with release notes
- [ ] README.md reviewed and accurate
- [ ] All tests pass: `npm test`
- [ ] Extension compiles: `npm run compile`
- [ ] No linting errors: `npm run lint`
- [ ] Icon/logo files present
- [ ] LICENSE file included
- [ ] .vscodeignore excludes unnecessary files
- [ ] Test VSIX locally before publishing

## 🔧 Troubleshooting

### Common Issues

1. **"Publisher not found"**
   - Create publisher first: `vsce create-publisher omnix-lang`
   - Verify publisher ID matches package.json

2. **"Personal Access Token expired"**
   - Generate new token in Azure DevOps
   - Re-login: `vsce login omnix-lang`

3. **"Package.json validation failed"**
   - Check required fields: name, version, publisher, engines
   - Validate JSON syntax

4. **"Icon not found"**
   - Ensure path is relative: `"icon": "images/omnix-logo.svg"`
   - File must exist in package

## 📊 Post-Publishing

### Monitor Performance
- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=omnix-lang.omnix-lang
- **NPM**: https://www.npmjs.com/package/omnix-lang
- **Open VSX**: https://open-vsx.org/extension/omnix-lang/omnix-lang

### Update Locations
- GitHub README
- Project website
- Documentation site
- Social media announcement

## 🆘 Support

For publishing issues:
- VS Code: https://github.com/microsoft/vscode-vsce/issues
- Open VSX: https://github.com/eclipse/openvsx/issues
- NPM: https://docs.npmjs.com/

---

**Last Updated**: January 2025
**Extension Version**: 0.1.0
**Author**: OMNIX Team