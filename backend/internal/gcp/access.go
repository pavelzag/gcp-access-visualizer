package gcp

import (
	"context"
	"fmt"
	"strings"

	asset "cloud.google.com/go/asset/apiv1"
	"cloud.google.com/go/asset/apiv1/assetpb"
	"google.golang.org/api/iterator"
)

// AccessEntry represents a user's access to a resource
type AccessEntry struct {
	UserEmail    string   `json:"userEmail"`
	ResourceID   string   `json:"resourceId"`
	ResourceName string   `json:"resourceName"`
	ResourceType string   `json:"resourceType"`
	Roles        []string `json:"roles"`
}

// AccessMatrix represents the complete access matrix
type AccessMatrix struct {
	Users     []User        `json:"users"`
	Resources []Resource    `json:"resources"`
	Access    []AccessEntry `json:"access"`
}

// GetAccessMatrix aggregates all access data using Asset Inventory API
func (c *Client) GetAccessMatrix() (*AccessMatrix, error) {
	// Get users from project IAM
	users, err := c.GetUsers()
	if err != nil {
		return nil, err
	}

	// Create a set of valid user emails
	validUsers := make(map[string]bool)
	for _, user := range users {
		validUsers[user.Email] = true
	}

	// Use Asset Inventory API to search all IAM policies
	ctx := context.Background()
	assetClient, err := asset.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create asset client: %w", err)
	}
	defer assetClient.Close()

	// Search all IAM policies in the project
	scope := fmt.Sprintf("projects/%s", c.ProjectID)
	req := &assetpb.SearchAllIamPoliciesRequest{
		Scope: scope,
	}

	it := assetClient.SearchAllIamPolicies(ctx, req)

	// Maps to track unique resources and access entries
	resourcesMap := make(map[string]*Resource)
	accessMap := make(map[string]*AccessEntry) // key: userEmail::resourceID::role

	// 1. Pre-populate with known resources (GKE, VM, Cloud Run)
	knownResources, err := c.GetResources()
	if err == nil {
		for _, res := range knownResources {
			// Create a copy to avoid pointer issues
			r := res
			resourcesMap[res.ID] = &r
		}
	} else {
		// Log error but continue with IAM search
		fmt.Printf("Warning: failed to fetch known resources: %v\n", err)
	}

	for {
		policy, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to iterate policies: %w", err)
		}

		resourceID := policy.Resource
		resourceName := extractResourceName(resourceID)
		resourceType := extractResourceType(resourceID)

		// Add resource if not already tracked
		if _, exists := resourcesMap[resourceID]; !exists {
			resourcesMap[resourceID] = &Resource{
				ID:       resourceID,
				Name:     resourceName,
				Type:     resourceType,
				Location: "global", // Asset API doesn't provide location directly
				IAM:      make(map[string][]string),
			}
		}

		// Process IAM bindings
		for _, binding := range policy.Policy.Bindings {
			role := binding.Role
			for _, member := range binding.Members {
				user := parseUser(member)

				// Add user to validUsers if not already present
				// This ensures we capture users with only resource-level permissions
				if !validUsers[user.Email] {
					validUsers[user.Email] = true
					users = append(users, user)
				}

				// Add to access entries
				key := fmt.Sprintf("%s::%s::%s", user.Email, resourceID, role)
				if _, exists := accessMap[key]; !exists {
					accessMap[key] = &AccessEntry{
						UserEmail:    user.Email,
						ResourceID:   resourceID,
						ResourceName: resourceName,
						ResourceType: resourceType,
						Roles:        []string{role},
					}
				}
			}
		}
	}

	// Step 2: Resolve inherited permissions from project-level IAM
	// Find the project resource and propagate its IAM bindings to child resources
	projectResourceID := fmt.Sprintf("//cloudresourcemanager.googleapis.com/projects/%s", c.ProjectID)

	// Collect all project-level access entries
	projectAccessByUser := make(map[string][]string) // userEmail -> []roles
	for _, entry := range accessMap {
		if entry.ResourceID == projectResourceID {
			projectAccessByUser[entry.UserEmail] = append(projectAccessByUser[entry.UserEmail], entry.Roles[0])
		}
	}

	fmt.Printf("Found %d users with project-level permissions\n", len(projectAccessByUser))

	// For each user with project-level permissions, create inherited access entries
	for userEmail, roles := range projectAccessByUser {
		for _, role := range roles {
			// Determine which resource types this role applies to
			applicableTypes := getApplicableResourceTypes(role)

			// Create access entries for all matching resources
			for resourceID, resource := range resourcesMap {
				// Skip the project itself
				if resourceID == projectResourceID {
					continue
				}

				// Check if this role applies to this resource type
				if contains(applicableTypes, resource.Type) {
					key := fmt.Sprintf("%s::%s::%s", userEmail, resourceID, role)
					// Only add if not already exists (don't override direct permissions)
					if _, exists := accessMap[key]; !exists {
						accessMap[key] = &AccessEntry{
							UserEmail:    userEmail,
							ResourceID:   resourceID,
							ResourceName: resource.Name,
							ResourceType: resource.Type,
							Roles:        []string{role},
						}
					}
				}
			}
		}
	}

	// Convert maps to slices
	var resources []Resource
	for _, res := range resourcesMap {
		resources = append(resources, *res)
	}

	var accessEntries []AccessEntry
	// Group roles by user-resource combination
	userResourceRoles := make(map[string][]string) // key: userEmail::resourceID
	for _, entry := range accessMap {
		key := fmt.Sprintf("%s::%s", entry.UserEmail, entry.ResourceID)
		userResourceRoles[key] = append(userResourceRoles[key], entry.Roles[0])
	}

	for key, roles := range userResourceRoles {
		parts := strings.Split(key, "::")
		if len(parts) != 2 {
			continue
		}
		userEmail := parts[0]
		resourceID := parts[1]

		resource := resourcesMap[resourceID]
		if resource != nil {
			accessEntries = append(accessEntries, AccessEntry{
				UserEmail:    userEmail,
				ResourceID:   resourceID,
				ResourceName: resource.Name,
				ResourceType: resource.Type,
				Roles:        roles,
			})
		}
	}

	return &AccessMatrix{
		Users:     users,
		Resources: resources,
		Access:    accessEntries,
	}, nil
}

// extractResourceName extracts a human-readable name from resource ID
func extractResourceName(resourceID string) string {
	// Resource ID format: //service.googleapis.com/projects/PROJECT/...
	parts := strings.Split(resourceID, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return resourceID
}

// extractResourceType extracts the resource type from resource ID
func extractResourceType(resourceID string) string {
	// Extract service name from URL
	if strings.Contains(resourceID, "cloudresourcemanager.googleapis.com/projects") {
		return "project"
	} else if strings.Contains(resourceID, "cloudresourcemanager.googleapis.com/organizations") {
		return "organization"
	} else if strings.Contains(resourceID, "compute.googleapis.com") {
		return "vm"
	} else if strings.Contains(resourceID, "container.googleapis.com") {
		return "gke"
	} else if strings.Contains(resourceID, "run.googleapis.com") {
		return "cloudrun"
	} else if strings.Contains(resourceID, "storage.googleapis.com") {
		return "storage"
	} else if strings.Contains(resourceID, "bigquery.googleapis.com") {
		return "bigquery"
	} else if strings.Contains(resourceID, "iam.googleapis.com") {
		return "serviceaccount"
	}

	// Default: extract service name
	if strings.HasPrefix(resourceID, "//") {
		parts := strings.Split(resourceID[2:], "/")
		if len(parts) > 0 {
			serviceParts := strings.Split(parts[0], ".")
			if len(serviceParts) > 0 {
				return serviceParts[0]
			}
		}
	}

	return "other"
}

// getApplicableResourceTypes returns the resource types that a given role applies to
// This is used to determine which child resources should inherit project-level permissions
func getApplicableResourceTypes(role string) []string {
	// Owner, Editor, and Viewer roles apply to all resource types
	if strings.Contains(role, "roles/owner") || strings.Contains(role, "roles/editor") || strings.Contains(role, "roles/viewer") {
		return []string{"storage", "vm", "gke", "cloudrun", "bigquery", "project", "serviceaccount"}
	}

	// Storage roles apply to storage buckets
	if strings.Contains(role, "roles/storage.") {
		return []string{"storage"}
	}

	// Compute roles apply to VMs
	if strings.Contains(role, "roles/compute.") {
		return []string{"vm"}
	}

	// Container roles apply to GKE clusters
	if strings.Contains(role, "roles/container.") {
		return []string{"gke"}
	}

	// Cloud Run roles apply to Cloud Run services
	if strings.Contains(role, "roles/run.") {
		return []string{"cloudrun"}
	}

	// BigQuery roles apply to BigQuery resources
	if strings.Contains(role, "roles/bigquery.") {
		return []string{"bigquery"}
	}

	// IAM roles apply to service accounts
	if strings.Contains(role, "roles/iam.") {
		return []string{"serviceaccount"}
	}

	// Default: no applicable types (role doesn't cascade)
	return []string{}
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
