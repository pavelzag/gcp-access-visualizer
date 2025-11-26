# GCP Access Visualizer

A powerful web application that visualizes IAM permissions and access relationships across Google Cloud Platform (GCP) resources. Built with Go backend and React frontend.

![GCP Access Visualizer](https://img.shields.io/badge/GCP-Access%20Visualizer-blue)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)

## Features

- 🔐 **IAM Principal Discovery**: Automatically fetches all users, service accounts, and groups from your GCP project
- 📦 **Resource Inventory**: Lists GKE clusters, Compute Engine VMs, and Cloud Run services
- 📊 **Access Matrix**: Interactive table showing user-to-resource access relationships
- 🌐 **Network Graph**: Visual network diagram of access patterns with force-directed layout
- 🎨 **Premium UI**: Modern dark theme with glassmorphism effects and smooth animations
- 🔍 **Search & Filter**: Quickly find specific users or resources

## Architecture

```
gcp-access-visualizer/
├── backend/               # Go REST API server
│   ├── main.go           # Entry point
│   ├── config/           # Configuration management
│   └── internal/
│       ├── gcp/          # GCP API clients and logic
│       └── handlers/     # HTTP request handlers
└── frontend/             # React + Vite frontend
    └── src/
        ├── api/          # API client
        ├── components/   # React components
        └── index.css     # Design system
```

## Prerequisites

### GCP Permissions

The application uses the **Cloud Asset Inventory API** to comprehensively search all IAM policies across your project.

**Required:**
1. **Enable the Cloud Asset API:**
   ```bash
   gcloud services enable cloudasset.googleapis.com --project=YOUR_PROJECT_ID
   ```

2. **Service Account Roles:**
   Create a service account with these roles:
   - `roles/cloudasset.viewer` - Read all IAM policies via Asset Inventory API
   - `roles/iam.securityReviewer` - Read project IAM policies for user list
   - `roles/viewer` - General read access

   OR create a custom role with these permissions:
   - `resourcemanager.projects.get`
   - `resourcemanager.projects.getIamPolicy`
   - `cloudasset.assets.searchAllIamPolicies`

### Software Requirements

- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **npm** or **yarn**
- **GCP Service Account** with appropriate permissions

## Setup Instructions

### 1. Clone and Navigate

```bash
cd /path/to/gcp-access-visualizer
```

### 2. Backend Setup

```bash
cd backend

# Install Go dependencies
go mod download

# Create .env file
cp .env.example .env

# Edit .env and set your GCP project ID
# GCP_PROJECT_ID=your-project-id
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### 3. GCP Authentication

Option A: Use a service account key file
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

Option B: Use Application Default Credentials
```bash
gcloud auth application-default login
```

### 4. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
export GCP_PROJECT_ID=your-project-id
go run main.go
```

The backend API will be available at `http://localhost:8080`

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Docker Deployment

### Using Docker Compose

The easiest way to run the application with Docker:

```bash
# Set your GCP project ID
export GCP_PROJECT_ID=your-project-id
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Start both services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

### Building Docker Images Manually

```bash
# Build backend
cd backend
docker build -t pavelzagalsky/gcp-access-visualizer-backend:latest .

# Build frontend
cd ../frontend
docker build -t pavelzagalsky/gcp-access-visualizer-frontend:latest .
```

## Kubernetes Deployment (Minikube)

### Prerequisites

- Minikube installed and running
- kubectl configured
- Ingress addon enabled

### Quick Deploy

```bash
cd k8s

# 1. Configure your GCP project ID in configmap.yaml
# 2. Create secret.yaml from secret.yaml.example with your service account key
# 3. Run the deployment script
./deploy.sh
```

### Manual Deployment

See detailed instructions in [k8s/README.md](k8s/README.md)

### Access the Application

After deployment, add to `/etc/hosts`:
```
$(minikube ip) gcp-visualizer.local
```

Then access at: http://gcp-visualizer.local

## CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow that automatically builds and pushes Docker images to Docker Hub on every push to `master` branch.

### Setup

1. Add Docker Hub credentials to GitHub Secrets:
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub password or access token

2. Push to `master` branch - images will be built and pushed automatically

### Multi-Platform Support

Images are built for both **linux/amd64** and **linux/arm64** architectures, ensuring compatibility with:
- Intel Macs (amd64)
- Apple Silicon Macs (M1/M2/M3) (arm64)
- Linux servers (both architectures)

Kubernetes will automatically select the correct image architecture for each node.

Images will be available at:
- `pavelzagalsky/gcp-access-visualizer-backend:latest` (multi-platform)
- `pavelzagalsky/gcp-access-visualizer-frontend:latest` (multi-platform)

## Usage

1. **Network Graph View**: See all users and resources as nodes with access relationships as edges
2. **Access Matrix View**: Table view showing which users have access to which resources
3. **Users View**: Browse all IAM principals with search functionality
4. **Resources View**: View all GCP resources grouped by type

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/users` - List all IAM principals
- `GET /api/resources` - List all GCP resources
- `GET /api/access` - Get complete access matrix

## Development

### Backend Development

```bash
cd backend
go run main.go
```

### Frontend Development

```bash
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Environment Variables

### Backend

- `GCP_PROJECT_ID` - Your GCP project ID (required)
- `PORT` - Server port (default: 8080)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key JSON
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (default: localhost URLs)

### Frontend

- `VITE_API_BASE_URL` - Backend API base URL (default: http://localhost:8080/api)

## Security Considerations

- Store service account keys securely
- Use least-privilege IAM roles
- Rotate credentials regularly
- Never commit credentials to version control
- Consider using Workload Identity in production

## Troubleshooting

### "Permission Denied" Errors

Ensure your service account has the required IAM roles listed in Prerequisites.

### "Project Not Found"

Verify that `GCP_PROJECT_ID` is set correctly and matches your GCP project.

### CORS Errors

The backend is configured to allow requests from `http://localhost:5173` and `http://localhost:3000`. Update the CORS configuration in `backend/main.go` if using different ports.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Acknowledgments

- Built with [Go](https://golang.org/)
- Frontend powered by [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Visualizations using [react-force-graph](https://github.com/vasturiano/react-force-graph)
- GCP integration via [Google Cloud Go SDK](https://cloud.google.com/go)

---

**Note**: This tool is for visualization and analysis purposes. Always follow your organization's security policies when working with IAM and access data.
