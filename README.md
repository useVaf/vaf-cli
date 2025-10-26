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

### Deployment

```bash
# Deploy to an environment
vaf deploy <project-id> <env-id>

# Deploy with watch mode (auto-deploy on changes)
vaf deploy <project-id> <env-id> --watch
```

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

- `POST /api/login` - Authenticate user
- `GET /api/me` - Get current user info
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/environments` - List environments
- `POST /api/projects/:id/environments` - Create environment
- `GET /api/projects/:id/environments/:envId` - Get environment details
- `DELETE /api/projects/:id/environments/:envId` - Delete environment
- `GET /api/projects/:id/environments/:envId/env-variables` - Get env variables
- `POST /api/projects/:id/environments/:envId/env-variables` - Set env variables
- `POST /api/projects/:id/environments/:envId/deployments` - Create deployment
- `GET /api/projects/:id/environments/:envId/deployments/:deploymentId` - Get deployment status

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

