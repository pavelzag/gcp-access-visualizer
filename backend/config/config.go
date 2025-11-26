package config

import (
	"fmt"
	"os"
)

// Config holds the application configuration
type Config struct {
	ProjectID string
	Port      string
}

// Load loads the configuration from environment variables
func Load() (*Config, error) {
	projectID := os.Getenv("GCP_PROJECT_ID")
	if projectID == "" {
		return nil, fmt.Errorf("GCP_PROJECT_ID environment variable is required")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return &Config{
		ProjectID: projectID,
		Port:      port,
	}, nil
}
