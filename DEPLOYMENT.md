# Deployment Guide

This guide covers all deployment options for the GCP Access Visualizer.

## Table of Contents

1. [Docker Compose](#docker-compose)
2. [Kubernetes (Minikube)](#kubernetes-minikube)
3. [GitHub Actions CI/CD](#github-actions-cicd)

## Docker Compose

### Prerequisites

- Docker and Docker Compose installed
- GCP service account key file
- GCP project ID

### Quick Start

```bash
# 1. Set environment variables
export GCP_PROJECT_ID=your-project-id
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# 2. Start services
docker-compose up -d

# 3. Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8080
```

### Stop Services

```bash
docker-compose down
```

## Kubernetes (Minikube)

### Prerequisites

- Minikube installed and running
- kubectl configured
- GCP service account key file

### Setup Steps

1. **Start Minikube** (if not already running):
   ```bash
   minikube start
   ```

2. **Enable Ingress**:
   ```bash
   minikube addons enable ingress
   ```

3. **Configure Kubernetes Manifests**:
   ```bash
   cd k8s
   
   # Edit configmap.yaml with your GCP project ID
   # GCP_PROJECT_ID: "your-actual-project-id"
   
   # Create secret from example
   cp secret.yaml.example secret.yaml
   
   # Encode your service account key
   cat /path/to/service-account-key.json | base64 -w 0
   
   # Paste the output into secret.yaml under credentials.json
   ```

4. **Deploy**:
   ```bash
   # Option 1: Use the deployment script
   ./deploy.sh
   
   # Option 2: Manual deployment
   kubectl apply -f .
   ```

5. **Configure /etc/hosts**:
   ```bash
   # Get minikube IP
   minikube ip
   
   # Add to /etc/hosts (requires sudo)
   echo "$(minikube ip) gcp-visualizer.local" | sudo tee -a /etc/hosts
   ```

6. **Access the Application**:
   - Frontend: http://gcp-visualizer.local
   - Backend API: http://gcp-visualizer.local/api/health

### Verify Deployment

```bash
# Check pods
kubectl get pods -n gcp-visualizer

# Check services
kubectl get svc -n gcp-visualizer

# Check ingress
kubectl get ingress -n gcp-visualizer

# View logs
kubectl logs -f deployment/gcp-visualizer-backend -n gcp-visualizer
kubectl logs -f deployment/gcp-visualizer-frontend -n gcp-visualizer
```

### Update Deployment

After pushing new images:

```bash
kubectl rollout restart deployment/gcp-visualizer-backend -n gcp-visualizer
kubectl rollout restart deployment/gcp-visualizer-frontend -n gcp-visualizer
```

### Cleanup

```bash
kubectl delete namespace gcp-visualizer
```

## GitHub Actions CI/CD

### Setup

1. **Add Docker Hub Secrets to GitHub**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `DOCKER_USERNAME`: Your Docker Hub username (pavelzagalsky)
     - `DOCKER_PASSWORD`: Your Docker Hub password or access token

2. **Push to Master**:
   ```bash
   git push origin master
   ```

3. **Monitor Build**:
   - Go to Actions tab in GitHub
   - Watch the workflow build and push images

### Image Tags

Images are automatically tagged with:
- `latest` - Latest build from master branch
- `master-<sha>` - Builds from master with commit SHA
- `v*` - Semantic version tags (if you create tags)

### Using Images

After the workflow completes, pull and use the images:

```bash
# Pull images
docker pull pavelzagalsky/gcp-access-visualizer-backend:latest
docker pull pavelzagalsky/gcp-access-visualizer-frontend:latest

# Or use in Kubernetes (already configured in manifests)
```

## Troubleshooting

### Docker Compose Issues

**Services won't start:**
- Check environment variables are set
- Verify service account key file path is correct
- Check Docker logs: `docker-compose logs`

**CORS errors:**
- Ensure frontend is using the correct API URL
- Check backend CORS configuration

### Kubernetes Issues

**Pods in CrashLoopBackOff:**
- Check pod logs: `kubectl logs <pod-name> -n gcp-visualizer`
- Verify ConfigMap has correct GCP_PROJECT_ID
- Verify Secret contains valid service account key

**Cannot access via ingress:**
- Verify ingress addon is enabled: `minikube addons list`
- Check /etc/hosts entry points to correct minikube IP
- Verify ingress status: `kubectl describe ingress -n gcp-visualizer`

**GCP authentication errors:**
- Verify service account has required permissions
- Check secret is properly base64 encoded
- Verify GOOGLE_APPLICATION_CREDENTIALS path in deployment

### GitHub Actions Issues

**Build fails:**
- Check Docker Hub credentials are correct
- Verify Docker Hub username matches repository name
- Check workflow logs for specific errors

**Images not pushed:**
- Verify secrets are set correctly
- Check if workflow is running on correct branch
- Ensure you're not on a pull request (images aren't pushed for PRs)

## Security Best Practices

1. **Never commit secrets** - Use Kubernetes secrets or environment variables
2. **Use Workload Identity** - For GKE, prefer Workload Identity over service account keys
3. **Rotate credentials** - Regularly rotate service account keys
4. **Least privilege** - Grant only necessary IAM roles
5. **Image scanning** - Regularly scan Docker images for vulnerabilities

## Next Steps

- Set up monitoring and alerting
- Configure autoscaling for Kubernetes deployments
- Set up SSL/TLS certificates for production
- Implement health checks and readiness probes (already included)
- Consider using a service mesh for advanced traffic management

