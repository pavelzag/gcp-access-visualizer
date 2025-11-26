package gcp

import (
	"fmt"

	computepb "cloud.google.com/go/compute/apiv1/computepb"
	containerpb "cloud.google.com/go/container/apiv1/containerpb"
	iampb "cloud.google.com/go/iam/apiv1/iampb"
	runpb "cloud.google.com/go/run/apiv2/runpb"
	"google.golang.org/api/iterator"
)

// Resource represents a GCP resource
type Resource struct {
	ID       string              `json:"id"`
	Name     string              `json:"name"`
	Type     string              `json:"type"` // "gke", "vm", "cloudrun"
	Location string              `json:"location"`
	IAM      map[string][]string `json:"iam"` // role -> []members
}

// GetResources fetches all resources (GKE, VMs, Cloud Run)
func (c *Client) GetResources() ([]Resource, error) {
	var resources []Resource

	// Fetch GKE clusters
	gkeClusters, err := c.getGKEClusters()
	if err != nil {
		return nil, fmt.Errorf("failed to get GKE clusters: %w", err)
	}
	resources = append(resources, gkeClusters...)

	// Fetch VMs
	vms, err := c.getVMs()
	if err != nil {
		return nil, fmt.Errorf("failed to get VMs: %w", err)
	}
	resources = append(resources, vms...)

	// Fetch Cloud Run services
	cloudRunServices, err := c.getCloudRunServices()
	if err != nil {
		return nil, fmt.Errorf("failed to get Cloud Run services: %w", err)
	}
	resources = append(resources, cloudRunServices...)

	return resources, nil
}

func (c *Client) getGKEClusters() ([]Resource, error) {
	var resources []Resource

	// List all GKE clusters in the project
	req := &containerpb.ListClustersRequest{
		Parent: fmt.Sprintf("projects/%s/locations/-", c.ProjectID),
	}

	resp, err := c.ContainerClient.ListClusters(c.ctx, req)
	if err != nil {
		return nil, err
	}

	for _, cluster := range resp.Clusters {
		resource := Resource{
			ID:       cluster.SelfLink,
			Name:     cluster.Name,
			Type:     "gke",
			Location: cluster.Location,
			IAM:      make(map[string][]string),
		}

		// Get IAM policy for the cluster (note: GKE uses project-level IAM)
		// For simplicity, we'll mark that GKE clusters inherit project IAM
		resource.IAM["inherited"] = []string{"project-level"}

		resources = append(resources, resource)
	}

	return resources, nil
}

func (c *Client) getVMs() ([]Resource, error) {
	var resources []Resource

	// List all zones
	zones := []string{"us-central1-a", "us-central1-b", "us-east1-b", "us-west1-a", "europe-west1-b"}

	for _, zone := range zones {
		req := &computepb.ListInstancesRequest{
			Project: c.ProjectID,
			Zone:    zone,
		}

		it := c.ComputeClient.List(c.ctx, req)
		for {
			instance, err := it.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				// Continue to next zone if this zone has an error
				break
			}

			resource := Resource{
				ID:       fmt.Sprintf("%d", instance.GetId()),
				Name:     instance.GetName(),
				Type:     "vm",
				Location: zone,
				IAM:      make(map[string][]string),
			}

			// Get IAM policy for the instance
			iamReq := &computepb.GetIamPolicyInstanceRequest{
				Project:  c.ProjectID,
				Zone:     zone,
				Resource: instance.GetName(),
			}

			policy, err := c.ComputeClient.GetIamPolicy(c.ctx, iamReq)
			if err == nil && policy != nil {
				for _, binding := range policy.Bindings {
					resource.IAM[binding.GetRole()] = binding.Members
				}
			}

			resources = append(resources, resource)
		}
	}

	return resources, nil
}

func (c *Client) getCloudRunServices() ([]Resource, error) {
	var resources []Resource

	// List Cloud Run services
	req := &runpb.ListServicesRequest{
		Parent: fmt.Sprintf("projects/%s/locations/-", c.ProjectID),
	}

	it := c.RunClient.ListServices(c.ctx, req)
	for {
		service, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		resource := Resource{
			ID:       service.Name,
			Name:     service.Name,
			Type:     "cloudrun",
			Location: extractLocation(service.Name),
			IAM:      make(map[string][]string),
		}

		// Get IAM policy for the Cloud Run service
		iamReq := &iampb.GetIamPolicyRequest{
			Resource: service.Name,
		}

		policy, err := c.RunClient.GetIamPolicy(c.ctx, iamReq)
		if err == nil && policy != nil {
			for _, binding := range policy.Bindings {
				resource.IAM[binding.Role] = binding.Members
			}
		}

		resources = append(resources, resource)
	}

	return resources, nil
}

// extractLocation extracts the location from a Cloud Run service name
// Format: projects/PROJECT/locations/LOCATION/services/SERVICE
func extractLocation(name string) string {
	// Simple parsing - in production, use proper parsing
	// For now, return a placeholder
	return "us-central1"
}
