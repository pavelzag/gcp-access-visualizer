package gcp

import (
	"context"

	compute "cloud.google.com/go/compute/apiv1"
	container "cloud.google.com/go/container/apiv1"
	resourcemanager "cloud.google.com/go/resourcemanager/apiv3"
	run "cloud.google.com/go/run/apiv2"
)

// Client holds all GCP API clients
type Client struct {
	ProjectID       string
	ComputeClient   *compute.InstancesClient
	ContainerClient *container.ClusterManagerClient
	RunClient       *run.ServicesClient
	ResourceManager *resourcemanager.ProjectsClient
	ctx             context.Context
}

// NewClient creates a new GCP client with all necessary API clients
func NewClient(ctx context.Context, projectID string) (*Client, error) {
	// Initialize Compute Engine client
	computeClient, err := compute.NewInstancesRESTClient(ctx)
	if err != nil {
		return nil, err
	}

	// Initialize GKE client
	containerClient, err := container.NewClusterManagerRESTClient(ctx)
	if err != nil {
		computeClient.Close()
		return nil, err
	}

	// Initialize Cloud Run client
	runClient, err := run.NewServicesRESTClient(ctx)
	if err != nil {
		computeClient.Close()
		containerClient.Close()
		return nil, err
	}

	// Initialize Resource Manager client
	resourceManagerClient, err := resourcemanager.NewProjectsRESTClient(ctx)
	if err != nil {
		computeClient.Close()
		containerClient.Close()
		runClient.Close()
		return nil, err
	}

	return &Client{
		ProjectID:       projectID,
		ComputeClient:   computeClient,
		ContainerClient: containerClient,
		RunClient:       runClient,
		ResourceManager: resourceManagerClient,
		ctx:             ctx,
	}, nil
}

// Close closes all GCP clients
func (c *Client) Close() error {
	c.ComputeClient.Close()
	c.ContainerClient.Close()
	c.RunClient.Close()
	c.ResourceManager.Close()
	return nil
}
