package gcp

import (
	"fmt"

	iampb "cloud.google.com/go/iam/apiv1/iampb"
)

// User represents a GCP principal (user, service account, or group)
type User struct {
	Email string `json:"email"`
	Type  string `json:"type"` // "user", "serviceAccount", "group", "domain"
}

// GetUsers fetches all unique IAM principals from the project
func (c *Client) GetUsers() ([]User, error) {
	// Get the project IAM policy
	req := &iampb.GetIamPolicyRequest{
		Resource: fmt.Sprintf("projects/%s", c.ProjectID),
	}

	policy, err := c.ResourceManager.GetIamPolicy(c.ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get IAM policy: %w", err)
	}

	// Extract unique members
	usersMap := make(map[string]User)
	for _, binding := range policy.Bindings {
		for _, member := range binding.Members {
			if _, exists := usersMap[member]; !exists {
				user := parseUser(member)
				usersMap[member] = user
			}
		}
	}

	// Convert map to slice
	users := make([]User, 0, len(usersMap))
	for _, user := range usersMap {
		users = append(users, user)
	}

	return users, nil
}

// parseUser parses a member string into a User struct
func parseUser(member string) User {
	// Member format: "user:email@example.com", "serviceAccount:sa@project.iam.gserviceaccount.com", etc.
	var userType, email string

	switch {
	case len(member) > 5 && member[:5] == "user:":
		userType = "user"
		email = member[5:]
	case len(member) > 15 && member[:15] == "serviceAccount:":
		userType = "serviceAccount"
		email = member[15:]
	case len(member) > 6 && member[:6] == "group:":
		userType = "group"
		email = member[6:]
	case len(member) > 7 && member[:7] == "domain:":
		userType = "domain"
		email = member[7:]
	default:
		userType = "other"
		email = member
	}

	return User{
		Email: email,
		Type:  userType,
	}
}
