# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the GCP Access Visualizer to your minikube cluster.

## Prerequisites

1. **Minikube** installed and running
2. **kubectl** configured to use your minikube cluster
3. **Ingress addon** enabled in minikube

## Setup Steps

### 1. Enable Ingress in Minikube

```bash
minikube addons enable ingress
```

### 2. Configure Your GCP Project

Edit `configmap.yaml` and set your GCP project ID:

```yaml
GCP_PROJECT_ID: "your-actual-project-id"
```

### 3. Create GCP Credentials Secret

You have two options:

#### Option A: Service Account Key File (Quick Setup)

1. Create a service account key in GCP Console
2. Base64 encode it:
   ```bash
   cat service-account-key.json | base64 -w 0
   ```
3. Copy the output and paste it into `secret.yaml` (create from example):
   ```bash
   cp secret.yaml.example secret.yaml
   # Edit secret.yaml and paste the base64 encoded JSON
   ```

#### Option B: Workload Identity (Recommended for Production)

If you're using GKE, you can use Workload Identity instead. See the example in `secret.yaml.example`.

### 4. Deploy to Kubernetes

Apply all manifests in order:

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create configmap
kubectl apply -f configmap.yaml

# Create secret (if using service account key)
kubectl apply -f secret.yaml

# Deploy backend
kubectl apply -f backend-deployment.yaml

# Deploy frontend
kubectl apply -f frontend-deployment.yaml

# Create services
kubectl apply -f services.yaml

# Create ingress
kubectl apply -f ingress.yaml
```

Or apply all at once:

```bash
kubectl apply -f .
```

### 5. Configure /etc/hosts (for local access)

Add the following line to your `/etc/hosts` file:

```
$(minikube ip) gcp-visualizer.local
```

To get the minikube IP:
```bash
minikube ip
```

### 6. Access the Application

Once deployed, access the application at:
- Frontend: http://gcp-visualizer.local
- Backend API: http://gcp-visualizer.local/api

## Verifying Deployment

Check the status of your pods:

```bash
kubectl get pods -n gcp-visualizer
```

Check services:

```bash
kubectl get svc -n gcp-visualizer
```

Check ingress:

```bash
kubectl get ingress -n gcp-visualizer
```

View logs:

```bash
# Backend logs
kubectl logs -f deployment/gcp-visualizer-backend -n gcp-visualizer

# Frontend logs
kubectl logs -f deployment/gcp-visualizer-frontend -n gcp-visualizer
```

## Updating the Application

After pushing new images to Docker Hub, update the deployments:

```bash
kubectl rollout restart deployment/gcp-visualizer-backend -n gcp-visualizer
kubectl rollout restart deployment/gcp-visualizer-frontend -n gcp-visualizer
```

Or force pull new images:

```bash
kubectl set image deployment/gcp-visualizer-backend backend=pavelzagalsky/gcp-access-visualizer-backend:latest -n gcp-visualizer
kubectl set image deployment/gcp-visualizer-frontend frontend=pavelzagalsky/gcp-access-visualizer-frontend:latest -n gcp-visualizer
kubectl rollout restart deployment/gcp-visualizer-backend -n gcp-visualizer
kubectl rollout restart deployment/gcp-visualizer-frontend -n gcp-visualizer
```

## Troubleshooting

### Pods not starting

Check pod status and events:
```bash
kubectl describe pod <pod-name> -n gcp-visualizer
```

### Cannot access via ingress

1. Verify ingress is enabled: `minikube addons list`
2. Check ingress status: `kubectl get ingress -n gcp-visualizer`
3. Verify /etc/hosts entry points to minikube IP

### GCP authentication errors

1. Verify the secret is created: `kubectl get secret gcp-visualizer-credentials -n gcp-visualizer`
2. Check the service account has required permissions
3. Verify GCP_PROJECT_ID in ConfigMap is correct

## Cleanup

To remove all resources:

```bash
kubectl delete namespace gcp-visualizer
```

