package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"gcp-access-visualizer/config"
	"gcp-access-visualizer/internal/gcp"
	"gcp-access-visualizer/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize GCP client
	ctx := context.Background()
	gcpClient, err := gcp.NewClient(ctx, cfg.ProjectID)
	if err != nil {
		log.Fatalf("Failed to create GCP client: %v", err)
	}
	defer gcpClient.Close()

	// Initialize handlers
	handler := handlers.NewHandler(gcpClient)

	// Set up Gin router
	router := gin.Default()

	// Configure CORS
	corsOrigins := []string{"http://localhost:5173", "http://localhost:3000"}
	if allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); allowedOrigins != "" {
		corsOrigins = strings.Split(allowedOrigins, ",")
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// API routes
	api := router.Group("/api")
	{
		api.GET("/health", handler.HealthCheck)
		api.GET("/users", handler.GetUsers)
		api.GET("/resources", handler.GetResources)
		api.GET("/access", handler.GetAccess)
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
