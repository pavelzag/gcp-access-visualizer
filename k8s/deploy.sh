#!/bin/bash

set -e

echo "🚀 Deploying GCP Access Visualizer to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if minikube is running
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster is not accessible. Please start minikube first: minikube start"
    exit 1
fi

# Enable ingress if not already enabled
echo "📦 Checking ingress addon..."
if ! minikube addons list | grep -q "ingress.*enabled"; then
    echo "🔧 Enabling ingress addon..."
    minikube addons enable ingress
    echo "⏳ Waiting for ingress to be ready..."
    sleep 10
fi

# Apply manifests
echo "📝 Applying Kubernetes manifests..."

kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml

# Check if secret.yaml exists
if [ -f "secret.yaml" ]; then
    kubectl apply -f secret.yaml
    echo "✅ Using existing secret.yaml"
else
    echo "⚠️  secret.yaml not found. Please create it from secret.yaml.example"
    echo "   You can create it with: cp secret.yaml.example secret.yaml"
    echo "   Then edit it with your base64-encoded service account key"
    read -p "Continue without secret? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f services.yaml
kubectl apply -f ingress.yaml

echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/gcp-visualizer-backend -n gcp-visualizer
kubectl wait --for=condition=available --timeout=300s deployment/gcp-visualizer-frontend -n gcp-visualizer

# Get minikube IP
MINIKUBE_IP=$(minikube ip)
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add this line to your /etc/hosts file:"
echo "   $MINIKUBE_IP gcp-visualizer.local"
echo ""
echo "2. Access the application at:"
echo "   Frontend: http://gcp-visualizer.local"
echo "   Backend API: http://gcp-visualizer.local/api/health"
echo ""
echo "📊 Check status with:"
echo "   kubectl get pods -n gcp-visualizer"
echo "   kubectl get svc -n gcp-visualizer"
echo "   kubectl get ingress -n gcp-visualizer"

