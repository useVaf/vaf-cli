# VAF CLI Quick Start

## Getting Started

### 1. Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI globally for development
npm link
```

### 2. Configuration

Set your API endpoint:

```bash
vaf config set api-url http://localhost:3000/api
```

Or edit `~/.vaf/config.json` directly:

```json
{
  "apiUrl": "http://localhost:3000/api"
}
```

### 3. Authentication

Login to get started:

```bash
vaf login
```

Enter your email and password when prompted.

### 4. Create Your First Project

```bash
# List projects
vaf projects list

# Create a new project
vaf projects create my-app --region us-east-1

# Create an environment
vaf env create <project-id> production
```

### 5. Deploy Your Application

**Option A: Using YAML Configuration (Recommended)**

Create a `vaf.yml` file in your project root:

```yaml
id: 73512
name: MyApp
environments:
    production:
        runtime: nodejs18.x
        memory: 512
        timeout: 30
        database: my-db
        cache: my-cache
        storage: my-storage
        build:
            - 'npm ci'
            - 'npm run build'
```

Then deploy:

```bash
# Deploy to production (uses vaf.yml)
vaf deploy production

# Or use watch mode for auto-deploy
vaf deploy production --watch
```

**Option B: Without YAML Configuration**

```bash
# Deploy with all parameters
vaf deploy <project-id> <env-name> \\
  --memory 512 \\
  --timeout 30 \\
  --database my-db \\
  --runtime nodejs18.x

# Or use watch mode for auto-deploy
vaf deploy <project-id> <env-name> --watch
```

### 6. Manage Environment Variables

```bash
# Set environment variables
vaf env vars set <project-id> <env-id> NODE_ENV production
vaf env vars set <project-id> <env-id> DATABASE_URL postgres://...

# Or bulk import from .env file
vaf env vars set-file <project-id> <env-id> .env

# List all variables
vaf env vars list <project-id> <env-id>
```

## Example Workflow

```bash
# 1. Login
vaf login

# 2. Create project
vaf projects create my-app --region us-east-1
# Note the project ID from the output

# 3. Create environments
vaf env create <project-id> production
vaf env create <project-id> staging
vaf env create <project-id> development

# 4. Set production environment variables
vaf env vars set <project-id> <production-env-id> NODE_ENV production
vaf env vars set <project-id> <production-env-id> PORT 3000

# 5. Deploy to production
cd my-app-directory
vaf deploy <project-id> <production-env-id>
```

## Tips

- Use `.vafignore` to exclude files from deployment (similar to `.gitignore`)
- Use `--watch` flag for development to auto-deploy on file changes
- Use `--force` flag with delete commands to skip confirmation
- Check deployment status with project and environment show commands

## Help

Get help for any command:

```bash
vaf --help
vaf projects --help
vaf env --help
vaf deploy --help
```

