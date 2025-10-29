# Troubleshooting Docker Deployments

## Network Error During Deployment

If you see "Network error - could not reach server" when deploying:

### 1. Check Your API URL Configuration

```bash
# Check current API URL
vaf config

# Or get just the API URL
vaf config get api-url
```

### 2. Verify API URL is Correct

The API URL should point to your backend service. Common values:
- Local development: `http://localhost:3000/api`
- Production: `https://api.yourdomain.com/api`

### 3. Set Correct API URL

```bash
# Set the API URL
vaf config set api-url https://your-backend-url.com/api
```

### 4. Verify Environment Resolution

When deploying, the CLI will show:
```
ℹ Resolving environment...
ℹ Using environment: production (env-123)
```

If the environment is not found, you'll see a list of available environments.

### 5. Check Network Connectivity

```bash
# Test if you can reach the backend
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend-url.com/api/projects/PROJECT_ID/environments
```

### 6. Verify Authentication

```bash
# Check if you're authenticated
vaf whoami

# If not authenticated, login
vaf login
```

## Common Issues

### Issue: "Environment not found"

**Cause:** Environment name doesn't match any environment in the project.

**Solution:** List available environments:
```bash
vaf env list <project-id>
```

### Issue: "Network error - could not reach server"

**Causes:**
1. API URL is incorrect
2. Backend server is down
3. Network connectivity issues
4. Firewall blocking the connection

**Solutions:**
1. Check API URL: `vaf config get api-url`
2. Test network: `curl https://your-backend-url.com/api`
3. Check firewall settings
4. Verify backend is running

### Issue: Docker Build Fails

**Causes:**
1. Dockerfile not found
2. Docker daemon not running
3. Build context missing required files

**Solutions:**
1. Verify Dockerfile exists at the expected path
2. Check Docker is running: `docker ps`
3. Ensure all required files are in the build context

### Issue: Lambda Function Fails with Architecture Error

**Symptom:** Function fails immediately with "exec format error" or architecture mismatch, or build fails with "image was found but does not provide the specified platform"

**Cause:** Docker image was built for the wrong architecture (e.g., ARM64 on Apple Silicon) or cached layers have architecture conflicts

**Solutions:**
1. The VAF CLI automatically:
   - Builds for `linux/amd64` platform
   - Removes cached base images from your Dockerfile
   - Uses `--pull` flag to ensure correct base images
2. If you still encounter issues, manually clear your Docker cache:
   ```bash
   docker system prune -a
   ```
3. Or explicitly remove the problematic image from your Dockerfile:
   ```bash
   # For example, if using nodejs:20
   docker rmi public.ecr.aws/lambda/nodejs:20
   ```

**Note:** The CLI automatically reads your Dockerfile, extracts the base image, and removes any cached version to ensure the correct architecture (linux/amd64) is pulled.

## Debug Mode

To get more detailed error information, you can add debugging to the CLI:

1. Set environment variable: `DEBUG=vaf:*`
2. Run deployment: `vaf deploy production --runtime docker`
3. Check the detailed logs for the specific failure point

## Getting Help

If you continue to experience issues:

1. Check the logs for the specific API endpoint being called
2. Verify the environment ID is correct
3. Ensure the backend service is accessible
4. Check the project ID matches your backend configuration
