# VAF CLI

A command-line interface tool for interacting with the VAF backend API. Built with Node.js, TypeScript, and Commander.js.

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI globally (for development)
npm link
```

## Usage

### Project Initialization

```bash
# Initialize a new VAF project
vaf init
```

This will create a `vaf.yml` configuration file in your current directory. The interactive wizard will guide you through:
- Project ID and name
- Number of environments
- Runtime settings (memory, timeout)
- Database, cache, and storage configuration
- Build commands
- Deployment commands

### Authentication

```bash
# Login to VAF backend
vaf login

# Logout and clear credentials
vaf logout

# Display current user info
vaf whoami
```

### Project Management

```bash
# List all projects
vaf projects list

# Create a new project
vaf projects create my-project --region us-east-1

# Show project details
vaf projects show <project-id>

# Delete a project
vaf projects delete <project-id>
```

### Environment Management

```bash
# List environments for a project
vaf env list <project-id>

# Create a new environment
vaf env create <project-id> production

# Show environment details
vaf env show <project-id> <env-id>

# Delete an environment
vaf env delete <project-id> <env-id>
```

### Environment Variables

```bash
# List all environment variables
vaf env vars list <project-id> <env-id>

# Set an environment variable
vaf env vars set <project-id> <env-id> DATABASE_URL "postgres://..."

# Remove an environment variable
vaf env vars remove <project-id> <env-id> DATABASE_URL

# Bulk set from .env file
vaf env vars set-file <project-id> <env-id> .env
```

### Database Management

```bash
# List all databases
vaf databases list

# Create a new database
vaf databases create

# Show database details
vaf databases show <database-id>

# Delete a database (with confirmation)
vaf databases delete <database-id>

# Delete without confirmation
vaf databases delete <database-id> --force
```

**Database Engines:**
- MySQL 8.0 Fixed Size Database
- MySQL 5.7 Fixed Size Database
- MySQL 8.0 Serverless v2
- PostgreSQL 17 Fixed Size Database
- PostgreSQL 16.4 Serverless v2
- PostgreSQL 11.0 Serverless v1

**Server Specifications:**
- T3 Family: db.t3.micro, db.t3.small, db.t3.medium, db.t3.large, db.t3.xlarge, db.t3.2xlarge
- T4G Family: db.t4g.micro, db.t4g.small, db.t4g.medium, db.t4g.large, db.t4g.xlarge
- M5 Family: db.m5.large, db.m5.xlarge, db.m5.2xlarge
- R5 Family: db.r5.large, db.r5.xlarge, db.r5.2xlarge

**Note:** Database creation and deletion are asynchronous operations. Use `vaf databases show <id>` to check status.

### Cache Management

```bash
# List all caches
vaf caches list

# Create a new cache
vaf caches create

# Show cache details
vaf caches show <cache-id>

# Delete a cache (with confirmation)
vaf caches delete <cache-id>

# Delete without confirmation
vaf caches delete <cache-id> --force
```

**Cache Types:**
- Redis 7.x Cluster
- Redis 6.x Cluster
- Redis 5.x Cluster

**Server Specifications:**
- cache.t3.micro, cache.t3.small, cache.t3.medium, cache.t3.large, cache.t3.xlarge
- cache.r5.large, cache.r5.xlarge, cache.r5.2xlarge

**Note:** Cache creation and deletion are asynchronous operations. Use `vaf caches show <id>` to check status.

### Deployment

**Using YAML Configuration (Recommended):**

Create a `vaf.yml` or `vapor.yml` file in your project root:

```yaml
id: 73512
name: SnapSnag
environments:
    develop:
        runtime: nodejs18.x
        memory: 3008
        timeout: 900
        database: dev-snapsnag-db
        cache: eventers-cache
        storage: develop-snapsnag-storage
        build:
            - 'npm ci'
            - 'npm run build'
        deploy:
            - 'npm run migrate'
    
    production:
        runtime: nodejs18.x
        memory: 3008
        timeout: 900
        database: prd-snapsnag-db
        cache: eventers-cache
        storage: prd-snapsnag-storage
        build:
            - 'npm ci'
            - 'npm run build:prod'
```

Then deploy:

```bash
# Deploy using YAML config (with project ID in vaf.yml)
vaf deploy production
# or if you want to specify project ID explicitly
vaf deploy <project-id> production

# Deploy with watch mode
vaf deploy production --watch

# Deploy with Lambda layers (for large packages)
vaf deploy production --use-layers

# Override configuration from CLI
vaf deploy develop --memory 4096 --timeout 1200
```

**Note:** When your `vaf.yml` contains a project ID, you can simply run `vaf deploy <environment-name>`. The project ID from the YAML file will be used automatically.

**Without YAML Configuration:**

```bash
# Deploy with all parameters specified
vaf deploy <project-id> <env-name> \\
  --memory 3008 \\
  --timeout 900 \\
  --database prd-db \\
  --cache my-cache \\
  --storage my-storage \\
  --runtime nodejs18.x \\
  --handler index.handler

# Deploy with watch mode (auto-deploy on changes)
vaf deploy <project-id> <env-name> --watch

# Deploy with Lambda layers (for large packages >50MB)
vaf deploy <project-id> <env-name> --use-layers
```

**YAML Configuration Options:**
- `id` - Project ID (can be overridden with CLI argument)
- `name` - Project name
- `environments.<env-name>.runtime` - Runtime (e.g., nodejs18.x, docker)
- `environments.<env-name>.memory` - Memory in MB
- `environments.<env-name>.timeout` - Timeout in seconds
- `environments.<env-name>.database` - Database name
- `environments.<env-name>.cache` - Cache name
- `environments.<env-name>.storage` - Storage name
- `environments.<env-name>.dockerfile` - Path to Dockerfile (for docker runtime)
- `environments.<env-name>.imageTag` - Docker image tag (for docker runtime)
- `environments.<env-name>.build` - Array of build commands to run
- `environments.<env-name>.deploy` - Array of deployment commands (future feature)

**CLI Options:**
- `--memory <mb>` - Memory in MB (overrides YAML)
- `--timeout <seconds>` - Timeout in seconds (overrides YAML)
- `--database <name>` - Database name (overrides YAML)
- `--cache <name>` - Cache name (overrides YAML)
- `--storage <name>` - Storage name (overrides YAML)
- `--runtime <runtime>` - Runtime (e.g., nodejs18.x, docker) (overrides YAML)
- `--handler <handler>` - Handler function (overrides YAML)
- `--dockerfile <path>` - Path to Dockerfile (for docker runtime). Overrides YAML config and env-specific Dockerfiles
- `--image-tag <tag>` - Docker image tag (for docker runtime, defaults to latest)
- `--no-build` - Skip running build commands from YAML
- `--watch` - Watch for changes and auto-deploy
- `--use-layers` - Use Lambda layers for large node_modules (>50MB recommended)

**The deployment process:**

For **Zip-based deployments** (nodejs18.x, etc.):
1. Loads configuration from `vaf.yml` or `vapor.yml` (optional)
2. Runs build commands from YAML or falls back to `npm run build`
3. Installs production dependencies (`npm ci --omit=dev`)
4. Creates deployment package:
   - **Without layers**: Includes source code + node_modules
   - **With layers** (`--use-layers`): Creates layer with node_modules, thin package with code only
5. Gets a signed upload URL from the API
6. Uploads the package (and layer if using layers)
7. Triggers deployment with your configuration

For **Docker deployments** (runtime: docker):
1. Loads configuration from `vaf.yml` or `vapor.yml` (optional)
2. Skips build commands (Dockerfile handles the build)
3. Gets ECR configuration from the API (repository URI, login command, etc.)
4. Authenticates with AWS ECR
5. Builds Docker image using your Dockerfile
6. Tags and pushes image to ECR
7. Triggers deployment with image URI

**Docker Example:**
```bash
# Deploy using Docker (runtime must be 'docker' in YAML or --runtime docker)
vaf deploy production --runtime docker --image-tag v1.0.0

# Override Dockerfile path
vaf deploy production --runtime docker --dockerfile ./custom.Dockerfile
```

**Dockerfile Selection Priority:**
1. `--dockerfile` CLI option (highest priority)
2. `dockerfile` field in YAML config
3. `{env-name}.Dockerfile` (e.g., `production.Dockerfile` for production environment)
4. `./Dockerfile` (default fallback)

**Dockerfile example:**
```dockerfile
# Default: ./Dockerfile
# Or environment-specific: production.Dockerfile, develop.Dockerfile, etc.

FROM public.ecr.aws/lambda/nodejs:18
WORKDIR ${LAMBDA_TASK_ROOT}
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD [ "index.handler" ]
```

**Important:** Docker images are automatically built using `docker buildx` for `linux/amd64` architecture to ensure compatibility with AWS Lambda, regardless of your local machine's architecture (including Apple Silicon Macs).

**Lambda Layers:**
Layers are **enabled by default** to handle large packages efficiently. They:
- Keep deployment packages within Lambda limits (250MB unzipped)
- Enable faster code-only deployments (only change code, not dependencies)
- Support large node_modules folders
- Are automatically created and reused

**To disable layers (use full package):**
```yaml
environments:
    production:
        useLayers: false  # Disable layers
```

Or use CLI: `vaf deploy production --no-use-layers`

### Configuration

```bash
# Show current configuration
vaf config

# Set API URL
vaf config set api-url https://api.vaf.com/api

# Get specific configuration value
vaf config get api-url
```

## Features

- **Beautiful Terminal Output**: Color-coded messages and progress indicators
- **Interactive Prompts**: User-friendly input prompts for authentication
- **Secure Token Storage**: JWT tokens stored in `~/.vaf/config.json`
- **Multiple Environments**: Support for production, staging, and development
- **Watch Mode**: Auto-deploy on file changes
- **Error Handling**: Comprehensive error messages and retry logic
- **Pretty JSON**: Formatted API response output

## Configuration File

Configuration is stored in `~/.vaf/config.json`:

```json
{
  "apiUrl": "http://localhost:3000/api",
  "token": "your-jwt-token",
  "environment": "production"
}
```

## YAML Configuration

Create a `vaf.yml` or `vapor.yml` file in your project root to configure deployment settings. This allows you to:

- Store project ID and environment configuration
- Define custom build commands per environment
- Reuse configurations across deployments
- Override settings via CLI arguments

### Example Configuration

```yaml
id: 73512
name: SnapSnag
environments:
    develop:
        runtime: docker
        memory: 3008
        timeout: 900
        database: dev-snapsnag-db
        cache: eventers-cache
        storage: develop-snapsnag-storage
        build:
            - 'COMPOSER_MIRROR_PATH_REPOS=1 composer install --no-dev'
            - 'php artisan event:cache'
            - 'npm ci && npm run prod && rm -rf node_modules'
        deploy:
            - 'php artisan migrate --force'
    
    production:
        runtime: nodejs18.x
        memory: 3008
        timeout: 900
        database: prd-snapsnag-db
        cache: eventers-cache
        storage: prd-snapsnag-storage
        build:
            - 'npm ci'
            - 'npm run build:prod'
```

### Supported Fields

**Project Level:**
- `id` - Project ID (required if not provided via CLI)
- `name` - Project name

**Environment Level:**
- `runtime` - Runtime version (e.g., `nodejs18.x`, `docker`)
- `memory` - Memory in MB
- `timeout` - Timeout in seconds
- `handler` - Handler function (e.g., `index.handler`)
- `database` - Database connection name
- `cache` - Cache connection name
- `storage` - Storage connection name
- `useLayers` - Use Lambda layers for large packages (default: `true`)
- `build` - Array of shell commands to run before deployment
- `deploy` - Array of shell commands to run after deployment (planned feature)

### Usage with YAML

```bash
# Deploy using environment from YAML
vaf deploy develop

# Deploy and override a setting
vaf deploy production --memory 4096

# Skip build commands
vaf deploy develop --no-build

# Use watch mode
vaf deploy production --watch
```

## .vafignore

Create a `.vafignore` file in your project root to exclude files from deployment:

```
node_modules/
.git/
*.log
.env
.DS_Store
dist/
coverage/
```

## Backend API Endpoints

The CLI expects the following API structure:

**Authentication:**
- `POST /api/login` - Authenticate user
- `GET /api/me` - Get current user info

**Projects:**
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `DELETE /api/projects/:id` - Delete project

**Environments:**
- `GET /api/projects/:id/environments` - List environments
- `POST /api/projects/:id/environments` - Create environment
- `GET /api/projects/:id/environments/:envId` - Get environment details
- `DELETE /api/projects/:id/environments/:envId` - Delete environment

**Environment Variables:**
- `GET /api/projects/:id/environments/:envId/env-variables` - Get env variables
- `POST /api/projects/:id/environments/:envId/env-variables` - Set env variables

**Deployment:**
- `GET /api/projects/:projectId/environments/:envName/deployment/upload-url` - Get signed upload URL
- `POST /api/projects/:projectId/environments/:envName/deployment/deploy` - Trigger deployment
- `GET /api/projects/:projectId/environments/:envName/deployment/:deploymentId` - Get deployment status

**Database Management:**
- `POST /api/databases` - Create database
- `GET /api/databases` - List user databases
- `GET /api/databases/:id` - Get database details
- `DELETE /api/databases/:id` - Delete database

**Cache Management:**
- `POST /api/caches` - Create cache
- `GET /api/caches` - List user caches
- `GET /api/caches/:id` - Get cache details
- `DELETE /api/caches/:id` - Delete cache

All requests (except login) require JWT Bearer token authentication.

## Development

```bash
# Watch mode for development
npm run watch

# Run in development mode
npm run dev

# Build for production
npm run build
```

## License

MIT

