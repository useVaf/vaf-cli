# Docker/Container Support Implementation

## Summary

This document describes the Docker/container-based Lambda deployment support added to the VAF CLI.

## What Was Implemented

### 1. ECR Configuration Retrieval (`src/commands/deploy.ts`)
- Added `getEcrConfig()` function that fetches ECR configuration from the backend API
- Endpoint: `/api/projects/{projectId}/environments/{environmentId}/deployment/ecr-config`
- Returns: ECR repository URI, AWS account ID, region, repository name, and Docker login command

### 2. Docker Build and Push (`src/commands/deploy.ts`)
- Added `buildAndPushDockerImage()` function that:
  - Validates Dockerfile exists
  - Authenticates with AWS ECR using the login command
  - Builds Docker image locally
  - Tags image for ECR
  - Pushes image to ECR

### 3. Docker Support in Deploy Command (`src/commands/deploy.ts`)
- Added runtime detection for Docker deployments (`runtime === 'docker'`)
- Added separate deployment flow for Docker that:
  - Skips build commands (Dockerfile handles it)
  - Gets ECR configuration
  - Builds and pushes Docker image
  - Sends image URI to backend for deployment
- Added CLI options:
  - `--dockerfile <path>` - Path to Dockerfile (default: `./Dockerfile`)
  - `--image-tag <tag>` - Docker image tag (default: `latest`)
  - `--runtime <runtime>` - Now supports `docker` as a runtime option

### 4. YAML Configuration Support (`src/commands/deploy.ts`)
- Updated `VafConfig` interface to support:
  - `dockerfile?: string` - Path to Dockerfile
  - `imageTag?: string` - Docker image tag
- YAML config values are used as defaults, CLI options override them

### 5. Documentation Updates
- Updated `README.md` with Docker deployment section
- Created `Dockerfile.example` with example Lambda container Dockerfile
- Updated `vaf.yml.example` with Docker configuration example

### 6. Type Definitions (`src/utils.ts`)
- Added `EcrConfigResponse` interface for ECR configuration data

## Usage

### Basic Docker Deployment

```bash
# Deploy using Docker (from CLI)
vaf deploy <project-id> <env-name> --runtime docker --image-tag v1.0.0

# Deploy using YAML config
vaf deploy production  # If runtime: docker in vaf.yml
```

### YAML Configuration

```yaml
id: 73512
name: MyProject
environments:
  production:
    runtime: docker
    memory: 3008
    timeout: 900
    database: my-database
    dockerfile: ./Dockerfile
    imageTag: latest
```

### Create a Dockerfile

Example Dockerfile for Node.js Lambda:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:18
WORKDIR ${LAMBDA_TASK_ROOT}
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD [ "index.handler" ]
```

## How It Works

### Docker Deployment Flow

1. User runs: `vaf deploy production --runtime docker`
2. CLI detects `runtime === 'docker'` and enters Docker deployment mode
3. CLI skips build commands (no npm build step)
4. CLI fetches ECR config from backend API
5. CLI authenticates with AWS ECR using login command
6. CLI builds Docker image using local Dockerfile
7. CLI tags and pushes image to ECR
8. CLI sends deployment request to backend with image URI
9. Backend creates/updates Lambda function with the container image

### API Endpoints Used

1. **GET** `/api/projects/{projectId}/environments/{environmentId}/deployment/ecr-config`
   - Returns ECR repository configuration
   - Includes Docker login command

2. **POST** `/api/projects/{projectId}/environments/{environmentId}/deployment/deploy`
   - Sends deployment request with `imageUri` parameter
   - Backend deploys Lambda function with container image

## Differences from Zip Deployments

| Feature | Zip Deployment | Docker Deployment |
|---------|---------------|-------------------|
| Build | Runs build commands | Dockerfile handles build |
| Dependencies | Installs prod deps locally | Dockerfile installs deps |
| Package | Creates ZIP file | Builds Docker image |
| Upload | Uploads to S3 | Pushes to ECR |
| Size Limit | 250MB unzipped | Up to 10GB container image |
| Layers | Optional | Not applicable |

## Requirements

- Docker must be installed and running on the local machine
- AWS credentials configured (for ECR push)
- Backend API must provide ECR configuration endpoint

## Files Modified

1. `src/commands/deploy.ts` - Added Docker support logic
2. `src/utils.ts` - Added EcrConfigResponse interface
3. `README.md` - Added Docker deployment documentation
4. `vaf.yml.example` - Added Docker configuration example
5. `Dockerfile.example` - Created example Dockerfile

## CLI Options Added

- `--runtime <runtime>` - Supports `docker` as runtime value
- `--dockerfile <path>` - Path to Dockerfile (default: `./Dockerfile`)
- `--image-tag <tag>` - Docker image tag (default: `latest`)

## YAML Configuration Options Added

- `dockerfile` - Path to Dockerfile
- `imageTag` - Docker image tag

## Testing

To test the Docker deployment:

```bash
# Create a Dockerfile
cp Dockerfile.example Dockerfile

# Deploy using Docker
vaf deploy production --runtime docker --image-tag test

# Or use YAML config
vaf deploy production  # if runtime: docker in vaf.yml

# Use environment-specific Dockerfile
cp production.Dockerfile.example production.Dockerfile
vaf deploy production  # will automatically use production.Dockerfile
```

## Dockerfile Selection Priority

The CLI uses the following priority order to find the Dockerfile:

1. **CLI option** `--dockerfile` (highest priority)
2. **YAML config** `dockerfile` field
3. **Environment-specific** `{env-name}.Dockerfile` (e.g., `production.Dockerfile`)
4. **Default** `./Dockerfile` (fallback)

Example:
```bash
# Production environment will look for:
# 1. production.Dockerfile (if exists)
# 2. ./Dockerfile (fallback)

# Development environment will look for:
# 1. develop.Dockerfile (if exists)
# 2. ./Dockerfile (fallback)
```

## Notes

- Docker deployments skip the build step automatically
- Lambda layers are not used for Docker deployments
- Docker images are built using `docker buildx` for `linux/amd64` platform (required for AWS Lambda)
- The `--load` flag loads the built image into local Docker for pushing to ECR
- This ensures compatibility even when building on Apple Silicon (M1/M2/M3) Macs
- Watch mode works with Docker deployments
- The Docker image must follow AWS Lambda container image format
