# Release Guide

## Setup NPM Publishing

### 1. Create NPM Access Token

1. Go to [npmjs.com](https://www.npmjs.com/) and login
2. Navigate to **Account Settings** → **Access Tokens**
3. Click **Generate New Token** → **Automation**
4. Copy the token (it won't be shown again)

### 2. Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click **Add secret**

### 3. Verify GitHub Actions is Enabled

1. Go to **Settings** → **Actions** → **General**
2. Ensure "Allow all actions and reusable workflows" is selected
3. Under "Workflow permissions", select "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Save changes

## Publishing a New Version

The project uses [semantic-release](https://semantic-release.gitbook.io/) for automated versioning and publishing.

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Version Bumps

- **Patch** (3.0.x): `fix:`, `perf:`, `refactor:`
- **Minor** (3.x.0): `feat:`
- **Major** (x.0.0): Any commit with `BREAKING CHANGE:` in footer

### Examples

```bash
# Patch release (3.0.5 → 3.0.6)
git commit -m "fix(api): resolve token refresh issue"

# Minor release (3.0.5 → 3.1.0)
git commit -m "feat(admin): add bulk sync button"

# Major release (3.0.5 → 4.0.0)
git commit -m "feat(api): redesign configuration structure

BREAKING CHANGE: Configuration format has changed"
```

### Publishing Process

1. Make your changes
2. Commit with conventional commit message
3. Push to main branch:
   ```bash
   git push origin main
   ```

4. GitHub Actions will automatically:
   - Analyze commit messages
   - Determine version bump
   - Update `package.json` and `CHANGELOG.md`
   - Build the package
   - Publish to npm
   - Create GitHub release with notes

### Manual Publishing (Emergency)

If automatic publishing fails:

```bash
# Build the package
pnpm run build

# Login to npm
npm login

# Publish
npm publish --access public
```

## Monitoring Releases

- **GitHub Actions**: Check the Actions tab for release workflow status
- **npm**: Visit https://www.npmjs.com/package/medusa-plugin-bling
- **GitHub Releases**: Check repository releases page

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
pnpm run clean
pnpm run build
```

### Token Expired

1. Generate new NPM token
2. Update GitHub secret `NPM_TOKEN`

### Release Workflow Not Triggering

1. Check if commit message follows conventional commits
2. Verify GitHub Actions is enabled
3. Check workflow file: `.github/workflows/release.yml`

## Version Strategy

Current version: **3.0.5**

- **3.x.x**: MedusaJS v2.3+ compatibility
- **4.x.x**: Future major changes (breaking)
- Pre-release tags: `3.1.0-beta.1`, `3.1.0-rc.1`
